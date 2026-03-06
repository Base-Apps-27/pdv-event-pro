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

export function useSpecialSegment(queryKey) {
  const queryClient = useQueryClient();

  // 2026-03-06: Added requires_translation + translation_mode + default_translator_source support
  const add = useCallback(async ({ sessionId, serviceId, title, duration, presenter, translator, insertAfterIdx, segmentType, requires_translation, translation_mode, default_translator_source }) => {
    if (!sessionId || !serviceId) {
      toast.error("Faltan datos: sessionId o serviceId");
      return;
    }

    const resolvedTitle = (title || "").trim() || "Especial";
    const resolvedType = segmentType || "Especial";

    try {
      console.log(`[V2 Special] Adding "${resolvedTitle}" to session ${sessionId} after idx ${insertAfterIdx}`);

      // 2026-03-06: Resolve translator from source segment when auto_from_segment:* pattern
      let resolvedTranslator = translator || "";
      if (requires_translation && default_translator_source?.startsWith('auto_from_segment:')) {
        const sourceId = default_translator_source.split(':')[1];
        try {
          const allSegs = await base44.entities.Segment.filter({ session_id: sessionId });
          const sourceSegment = allSegs.find(s => s.id === sourceId || String(allSegs.indexOf(s)) === sourceId);
          if (sourceSegment?.translator_name) {
            resolvedTranslator = sourceSegment.translator_name;
            console.log(`[V2 Special] Auto-resolved translator "${resolvedTranslator}" from segment ${sourceId}`);
          }
        } catch (err) {
          console.warn('[V2 Special] Could not resolve translator source:', err.message);
        }
      }

      const created = await base44.entities.Segment.create({
        session_id: sessionId,
        service_id: serviceId,
        order: (insertAfterIdx || 0) + 2,
        title: resolvedTitle,
        segment_type: resolvedType,
        duration_min: Math.max(1, duration || 15),
        presenter: presenter || "",
        translator_name: resolvedTranslator,
        // 2026-03-06: Translation fields from SpecialSegmentDialog
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

      // Refresh cache
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

      // Also delete any child segments
      const children = await base44.entities.Segment.filter({ parent_segment_id: segmentId });
      if (children.length > 0) {
        await Promise.all(children.map(c => base44.entities.Segment.delete(c.id)));
        console.log(`[V2 Special] Deleted ${children.length} child segments`);
      }

      await base44.entities.Segment.delete(segmentId);

      // Re-order remaining segments to prevent order gaps
      if (sessionId) {
        const remaining = await base44.entities.Segment.filter({ session_id: sessionId });
        const parents = remaining.filter(s => !s.parent_segment_id).sort((a, b) => (a.order || 0) - (b.order || 0));
        const reorderPromises = parents
          .filter((seg, idx) => seg.order !== idx + 1)
          .map((seg, idx) => base44.entities.Segment.update(seg.id, { order: idx + 1 }));
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