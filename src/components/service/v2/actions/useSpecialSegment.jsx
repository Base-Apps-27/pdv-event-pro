/**
 * useSpecialSegment.js — V2 add/remove special segments.
 * HARDENING (Phase 8):
 *   - Validates required fields before create
 *   - Re-orders remaining segments after remove to prevent gaps
 *   - Handles special segment types beyond 'Especial' (Oración, Cierre, etc.)
 *   - Logs actions for traceability
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { logCreate, logDelete } from "@/components/utils/editActionLogger";

export function useSpecialSegment(queryKey) {
  const queryClient = useQueryClient();

  // 2026-04-05: BUGFIX — Atomic insert + re-index.
  // Previously, the new segment was created with a computed order but existing
  // segments were NOT re-indexed, causing order collisions. Also, insertAfterIdx
  // came from a filtered list in SpecialSegmentDialog (non-special segments only),
  // so it didn't map to the actual segment array position. Now we:
  //   1. Fetch existing parent segments for the session
  //   2. Compute the correct insertion position using the actual segment list
  //   3. Create the new segment with a temporary high order
  //   4. Re-index ALL parent segments atomically
  //   5. Only THEN invalidate the query cache (prevents race condition)
  const add = useCallback(async ({ sessionId, serviceId, title, duration, presenter, translator, insertAfterIdx, segmentType, requires_translation, translation_mode, default_translator_source }) => {
    if (!sessionId || !serviceId) {
      toast.error("Faltan datos: sessionId o serviceId");
      return;
    }

    const resolvedTitle = (title || "").trim() || "Especial";
    const resolvedType = segmentType || "Especial";

    try {
      console.log(`[V2 Special] Adding "${resolvedTitle}" to session ${sessionId} after idx ${insertAfterIdx}`);

      // Step 1: Fetch all existing parent segments for this session (sorted by order)
      const allSegs = await base44.entities.Segment.filter({ session_id: sessionId });
      const parentSegs = allSegs
        .filter(s => !s.parent_segment_id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      // Step 2: Resolve translator from source segment when auto_from_segment:* pattern
      let resolvedTranslator = translator || "";
      if (requires_translation && default_translator_source?.startsWith('auto_from_segment:')) {
        const sourceId = default_translator_source.split(':')[1];
        try {
          const sourceSegment = allSegs.find(s => s.id === sourceId || String(allSegs.indexOf(s)) === sourceId);
          if (sourceSegment?.translator_name) {
            resolvedTranslator = sourceSegment.translator_name;
            console.log(`[V2 Special] Auto-resolved translator "${resolvedTranslator}" from segment ${sourceId}`);
          }
        } catch (err) {
          console.warn('[V2 Special] Could not resolve translator source:', err.message);
        }
      }

      // Step 3: Compute actual insertion position.
      // insertAfterIdx comes from SpecialSegmentDialog which filters out "special" types,
      // so idx 2 means "after the 3rd non-special segment". Map back to the full array.
      // -1 means "at the beginning".
      let insertPosition = 0; // position in the full parentSegs array (0 = before first)
      if (insertAfterIdx >= 0) {
        // The dialog's dropdown uses the filtered-list index. Map it back.
        const nonSpecialSegs = parentSegs.filter(s => s.segment_type !== 'Especial');
        const targetSeg = nonSpecialSegs[insertAfterIdx];
        if (targetSeg) {
          insertPosition = parentSegs.findIndex(s => s.id === targetSeg.id) + 1;
        } else {
          // Fallback: insert at end if index is out of range
          insertPosition = parentSegs.length;
        }
      }

      // Step 4: Create the new segment with a temporary high order (will be re-indexed)
      const created = await base44.entities.Segment.create({
        session_id: sessionId,
        service_id: serviceId,
        order: 9999, // temporary — will be overwritten by re-index below
        title: resolvedTitle,
        segment_type: resolvedType,
        duration_min: Math.max(1, duration || 15),
        presenter: presenter || "",
        translator_name: resolvedTranslator,
        requires_translation: !!requires_translation,
        translation_mode: requires_translation ? (translation_mode || "InPerson") : undefined,
        default_translator_source: requires_translation ? (default_translator_source || "manual") : undefined,
        show_in_general: true,
        show_in_projection: true,
        show_in_sound: true,
        show_in_ushers: true,
        show_in_livestream: true,
        ui_fields: ["presenter", "description"],
        ui_sub_assignments: [],
        origin: "manual",
      });

      // Step 5: Build the new ordered list and re-index ALL parent segments
      const newOrder = [...parentSegs];
      newOrder.splice(insertPosition, 0, created);

      const reindexPromises = newOrder
        .map((seg, idx) => ({ id: seg.id, correctOrder: idx + 1, currentOrder: seg.order }))
        .filter(item => item.correctOrder !== item.currentOrder)
        .map(item => base44.entities.Segment.update(item.id, { order: item.correctOrder }));

      if (reindexPromises.length > 0) {
        await Promise.all(reindexPromises);
        console.log(`[V2 Special] Re-indexed ${reindexPromises.length} segments after insert at position ${insertPosition}`);
      }

      // Step 6: Log creation for traceability (2026-04-12)
      logCreate('Segment', created, sessionId).catch(() => {});

      // Step 7: NOW invalidate cache — all DB writes are committed
      queryClient.invalidateQueries({ queryKey });
      toast.success(`"${resolvedTitle}" agregado`);
      return created;
    } catch (err) {
      console.error('[V2 Special] Create failed:', err.message);
      toast.error("Error al agregar segmento: " + err.message);
    }
  }, [queryClient, queryKey]);

  const remove = useCallback(async (sessionId, segmentIndex, segmentId) => {
    if (!segmentId) {
      toast.error("No se puede eliminar: falta ID del segmento");
      return;
    }

    try {
      console.log(`[V2 Special] Removing segment ${segmentId} from session ${sessionId}`);

      // Fetch segment data before deletion for logging
      const allSegsForDelete = await base44.entities.Segment.filter({ session_id: sessionId });

      // Also delete any child segments
      const children = await base44.entities.Segment.filter({ parent_segment_id: segmentId });
      if (children.length > 0) {
        await Promise.all(children.map(c => base44.entities.Segment.delete(c.id)));
        console.log(`[V2 Special] Deleted ${children.length} child segments`);
      }

      // 2026-04-12: Log deletion for traceability before removing from DB
      const deletedSeg = allSegsForDelete?.find(s => s.id === segmentId);
      if (deletedSeg) logDelete('Segment', deletedSeg, sessionId).catch(() => {});

      await base44.entities.Segment.delete(segmentId);

      // Re-order remaining segments to prevent order gaps
      // 2026-04-10: BUGFIX — Use single loop instead of .filter().map() chain.
      // The old pattern filtered first (changing indices), then mapped with wrong idx.
      // Now we iterate the sorted parents array once, only updating segments whose
      // order differs from their position. Same pattern as the add() re-index.
      if (sessionId) {
        const remaining = await base44.entities.Segment.filter({ session_id: sessionId });
        const parents = remaining.filter(s => !s.parent_segment_id).sort((a, b) => (a.order || 0) - (b.order || 0));
        const reorderPromises = parents
          .map((seg, idx) => ({ id: seg.id, correctOrder: idx + 1, currentOrder: seg.order }))
          .filter(item => item.correctOrder !== item.currentOrder)
          .map(item => base44.entities.Segment.update(item.id, { order: item.correctOrder }));
        if (reorderPromises.length > 0) {
          await Promise.all(reorderPromises);
          console.log(`[V2 Special] Re-ordered ${reorderPromises.length} segments`);
        }
      }

      queryClient.invalidateQueries({ queryKey });
      toast.success("Segmento eliminado");
    } catch (err) {
      console.error('[V2 Special] Delete failed:', err.message);
      toast.error("Error al eliminar: " + err.message);
    }
  }, [queryClient, queryKey]);

  return { add, remove };
}