/**
 * useResetToBlueprint.js — V2 reset handler.
 * HARDENING (Phase 8):
 *   - Pre-reset snapshot logged with full data for traceability
 *   - Blueprint actions (segment_actions) now carried forward
 *   - color_code carried from blueprint
 *   - Confirmation toast with segment count
 *   - Error reporting per session (partial success possible)
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { resolveSegmentEnum } from "@/components/utils/segmentTypeMap";

export function useResetToBlueprint(queryKey) {
  const queryClient = useQueryClient();

  const execute = useCallback(async ({ sessions, blueprintSegments, serviceId }) => {
    if (!sessions?.length || !blueprintSegments?.length || !serviceId) {
      toast.error("Faltan datos para restablecer");
      return;
    }

    const toastId = toast.loading("Restableciendo estructura...");
    let totalCreated = 0;
    const errors = [];

    for (const session of sessions) {
      try {
        // 1. Snapshot before delete (traceability — logged, not stored)
        const existing = await base44.entities.Segment.filter({ session_id: session.id });
        console.log(`[V2 Reset] Pre-reset snapshot for ${session.name}:`,
          JSON.stringify(existing.map(s => ({
            id: s.id, title: s.title, type: s.segment_type,
            presenter: s.presenter, order: s.order,
          })))
        );

        // 2. Delete all segments (parent + child) — children first to avoid orphans
        const children = existing.filter(s => s.parent_segment_id);
        const parents = existing.filter(s => !s.parent_segment_id);
        await Promise.all(children.map(s => base44.entities.Segment.delete(s.id)));
        await Promise.all(parents.map(s => base44.entities.Segment.delete(s.id)));

        // 3. Create new segments from blueprint
        for (let i = 0; i < blueprintSegments.length; i++) {
          const bp = blueprintSegments[i];
          const payload = {
            session_id: session.id,
            service_id: serviceId,
            order: i + 1,
            title: bp.title || "Sin título",
            segment_type: resolveSegmentEnum(bp.type),
            duration_min: Number(bp.duration) || 0,
            show_in_general: bp.show_in_general !== false,
            show_in_projection: bp.show_in_projection !== false,
            show_in_sound: bp.show_in_sound !== false,
            show_in_ushers: bp.show_in_ushers !== false,
            show_in_livestream: bp.show_in_livestream !== false,
            color_code: bp.color_code || 'default',
            ui_fields: Array.isArray(bp.fields) ? bp.fields : [],
            ui_sub_assignments: Array.isArray(bp.sub_assignments)
              ? bp.sub_assignments.map(sa => ({
                  label: sa.label || "Sin título",
                  person_field_name: sa.person_field_name || "",
                  duration_min: Number(sa.duration_min || sa.duration) || 0,
                }))
              : [],
            requires_translation: !!bp.requires_translation,
            default_translator_source: bp.default_translator_source || "manual",
          };

          // Carry forward structured actions from blueprint
          if (Array.isArray(bp.actions) && bp.actions.length > 0) {
            payload.segment_actions = bp.actions;
          }

          if (bp.number_of_songs !== undefined) {
            payload.number_of_songs = Number(bp.number_of_songs) || 0;
          }

          await base44.entities.Segment.create(payload);
          totalCreated++;
        }
      } catch (error) {
        console.error(`[V2 Reset] Failed for session ${session.name}:`, error);
        errors.push(`${session.name}: ${error.message}`);
      }
    }

    // Invalidate cache to reload fresh data
    queryClient.invalidateQueries({ queryKey });

    if (errors.length > 0) {
      toast.warning(
        `Parcialmente restablecido (${totalCreated} segmentos). Errores: ${errors.join('; ')}`,
        { id: toastId, duration: 8000 }
      );
    } else {
      toast.success(
        `Restablecido: ${totalCreated} segmentos creados en ${sessions.length} horario(s)`,
        { id: toastId }
      );
    }
  }, [queryClient, queryKey]);

  return { execute };
}