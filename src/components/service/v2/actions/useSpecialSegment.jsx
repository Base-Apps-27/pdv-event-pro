/**
 * useSpecialSegment.js — V2 add/remove special segments.
 * Creates/deletes Segment entities and updates cache.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export function useSpecialSegment(queryKey) {
  const queryClient = useQueryClient();

  const add = useCallback(async ({ sessionId, serviceId, title, duration, presenter, translator, insertAfterIdx }) => {
    try {
      const created = await base44.entities.Segment.create({
        session_id: sessionId,
        service_id: serviceId,
        order: (insertAfterIdx || 0) + 2,
        title: title || "Especial",
        segment_type: "Especial",
        duration_min: duration || 15,
        presenter: presenter || "",
        translator_name: translator || "",
        show_in_general: true,
        ui_fields: ["presenter", "description"],
        ui_sub_assignments: [],
      });

      // Refresh cache
      queryClient.invalidateQueries({ queryKey });
      toast.success(`Segmento "${title}" agregado`);
      return created;
    } catch (err) {
      console.error('[V2 Special] Create failed:', err.message);
      toast.error("Error al agregar segmento: " + err.message);
    }
  }, [queryClient, queryKey]);

  const remove = useCallback(async (sessionId, segmentIndex, segmentId) => {
    if (!segmentId) return;
    try {
      await base44.entities.Segment.delete(segmentId);
      queryClient.invalidateQueries({ queryKey });
      toast.success("Segmento eliminado");
    } catch (err) {
      console.error('[V2 Special] Delete failed:', err.message);
      toast.error("Error al eliminar: " + err.message);
    }
  }, [queryClient, queryKey]);

  return { add, remove };
}