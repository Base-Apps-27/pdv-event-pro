/**
 * useResetToBlueprint.js — V2 reset handler.
 * Deletes all segments in target sessions, recreates from blueprint.
 * Uses resolveSegmentEnum for type normalization.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { resolveSegmentEnum } from "@/components/utils/segmentTypeMap";

export function useResetToBlueprint(queryKey) {
  const queryClient = useQueryClient();

  const execute = useCallback(async ({ sessions, blueprintSegments, serviceId }) => {
    const toastId = toast.loading("Restableciendo estructura...");
    try {
      for (const session of sessions) {
        // 1. Snapshot before delete (traceability)
        const existing = await base44.entities.Segment.filter({ session_id: session.id });
        console.log(`[V2 Reset] Pre-reset snapshot for ${session.name}:`, existing.map(s => ({ id: s.id, title: s.title })));

        // 2. Delete all segments (parent + child)
        await Promise.all(existing.map(s => base44.entities.Segment.delete(s.id)));

        // 3. Create new segments from blueprint
        for (let i = 0; i < blueprintSegments.length; i++) {
          const bp = blueprintSegments[i];
          const payload = {
            session_id: session.id,
            service_id: serviceId,
            order: i + 1,
            title: bp.title || "Untitled",
            segment_type: resolveSegmentEnum(bp.type),
            duration_min: Number(bp.duration) || 0,
            show_in_general: true,
            ui_fields: Array.isArray(bp.fields) ? bp.fields : [],
            ui_sub_assignments: Array.isArray(bp.sub_assignments)
              ? bp.sub_assignments.map(sa => ({
                  label: sa.label || "Untitled",
                  person_field_name: sa.person_field_name || "",
                  duration_min: Number(sa.duration_min || sa.duration) || 0,
                }))
              : [],
            requires_translation: !!bp.requires_translation,
            default_translator_source: bp.default_translator_source || "manual",
          };
          if (bp.number_of_songs !== undefined) {
            payload.number_of_songs = Number(bp.number_of_songs) || 0;
          }
          await base44.entities.Segment.create(payload);
        }
      }

      // Invalidate cache to reload fresh data
      queryClient.invalidateQueries({ queryKey });
      toast.success("Servicio restablecido al diseño original", { id: toastId });
    } catch (error) {
      console.error("[V2 Reset] Failed:", error);
      toast.error("Error al restablecer: " + error.message, { id: toastId });
    }
  }, [queryClient, queryKey]);

  return { execute };
}