/**
 * useSpecialSegment.js — V2 thin wrapper over useStructuralOps for add/remove.
 *
 * 2026-04-15: REFACTORED — All structural logic (re-index, time cascade, lock)
 * moved to useStructuralOps. This file preserved for API compatibility with
 * WeeklyEditorV2 and SpecialSegmentDialog.
 *
 * The add() signature accepts the same params as before (sessionId, serviceId,
 * title, duration, etc.) and translates them into useStructuralOps.add() format.
 *
 * Previous issues fixed by useStructuralOps:
 *   - Duplicate re-index logic with useMoveSegment → single implementation
 *   - No serialization lock → concurrent add+move could corrupt order
 *   - Per-segment log entries → single log per operation
 *   - No time cascade on insert → times now recalculated
 *
 * Decision: "Unified structural ops with serialization lock" (2026-04-15)
 */

import { useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useStructuralOps } from "./useStructuralOps";

export function useSpecialSegment(queryKey) {
  const { add: structuralAdd, remove: structuralRemove } = useStructuralOps(queryKey);

  /**
   * Add a segment to a session at the specified position.
   * Translates SpecialSegmentDialog params → useStructuralOps.add() format.
   */
  const add = useCallback(async ({
    sessionId, serviceId, title, duration, presenter, translator,
    insertAfterIdx, segmentType, requires_translation, translation_mode,
    default_translator_source
  }) => {
    if (!sessionId || !serviceId) {
      toast.error("Faltan datos: sessionId o serviceId");
      return;
    }

    const resolvedTitle = (title || "").trim() || "Especial";
    const resolvedType = segmentType || "Especial";

    try {
      // Step 1: Resolve insertion position.
      // insertAfterIdx comes from SpecialSegmentDialog which filters out "special" types,
      // so idx 2 means "after the 3rd non-special segment". Map back to the full array.
      const allSegs = await base44.entities.Segment.filter({ session_id: sessionId });
      const parentSegs = allSegs
        .filter(s => !s.parent_segment_id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      let insertPosition = 0;
      if (insertAfterIdx >= 0) {
        const nonSpecialSegs = parentSegs.filter(s => s.segment_type !== 'Especial');
        const targetSeg = nonSpecialSegs[insertAfterIdx];
        if (targetSeg) {
          insertPosition = parentSegs.findIndex(s => s.id === targetSeg.id) + 1;
        } else {
          insertPosition = parentSegs.length;
        }
      }

      // Step 2: Resolve translator from source segment when auto_from_segment:* pattern
      let resolvedTranslator = translator || "";
      if (requires_translation && default_translator_source?.startsWith('auto_from_segment:')) {
        const sourceId = default_translator_source.split(':')[1];
        const sourceSegment = allSegs.find(s => s.id === sourceId || String(allSegs.indexOf(s)) === sourceId);
        if (sourceSegment?.translator_name) {
          resolvedTranslator = sourceSegment.translator_name;
          console.log(`[V2 Special] Auto-resolved translator "${resolvedTranslator}" from segment ${sourceId}`);
        }
      }

      // Step 3: Delegate to structural ops — handles create, re-index, time cascade, logging
      const created = await structuralAdd({
        sessionId,
        serviceId,
        position: insertPosition,
        segmentData: {
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
        },
      });

      toast.success(`"${resolvedTitle}" agregado`);
      return created;
    } catch (err) {
      console.error('[V2 Special] Create failed:', err.message);
      toast.error("Error al agregar segmento: " + err.message);
    }
  }, [structuralAdd]);

  /**
   * Remove a segment from a session.
   * Delegates to useStructuralOps.remove() which handles children, re-index,
   * time cascade, and logging.
   */
  const remove = useCallback(async (sessionId, segmentIndex, segmentId) => {
    if (!segmentId) {
      toast.error("No se puede eliminar: falta ID del segmento");
      return;
    }

    try {
      await structuralRemove(sessionId, segmentId);
      toast.success("Segmento eliminado");
    } catch (err) {
      console.error('[V2 Special] Delete failed:', err.message);
      toast.error("Error al eliminar: " + err.message);
    }
  }, [structuralRemove]);

  return { add, remove };
}