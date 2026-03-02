/**
 * useCustomServiceInit.js — Creates a new Custom Service + Session + initial Segments.
 *
 * DECISION (2026-03-02): Custom V2 services are created entity-first.
 * No JSON blob is ever written to Service.segments.
 * Initial segments are created from DEFAULT_UI_FIELDS map.
 *
 * Flow:
 *   1. Create Service entity (service_type='one_off', status='active')
 *   2. Create 1 Session entity linked to the Service
 *   3. Create 4 default Segment entities (Alabanza, Bienvenida, Ofrenda, Plenaria)
 *   4. Create child Segment entities for Alabanza sub-assignments
 *   5. Return the new Service ID for navigation
 */

import { useCallback, useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getDefaultUiFields, getDefaultSubAssignments } from "./DEFAULT_UI_FIELDS";

const DEFAULT_SEGMENTS = [
  { title: 'Equipo de A&A', type: 'Alabanza', duration: 35, order: 1 },
  { title: 'Bienvenida y Anuncios', type: 'Bienvenida', duration: 5, order: 2 },
  { title: 'Ofrendas', type: 'Ofrenda', duration: 5, order: 3 },
  { title: 'Mensaje', type: 'Plenaria', duration: 45, order: 4 },
];

export function useCustomServiceInit() {
  const [creating, setCreating] = useState(false);

  const createService = useCallback(async ({ name, date, time, location, description }) => {
    if (!name?.trim()) {
      toast.error('El nombre del servicio es requerido');
      return null;
    }

    setCreating(true);
    try {
      // 1. Compute day of week
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = date ? days[new Date(date + 'T00:00:00').getDay()] : 'Sunday';

      // 2. Create Service entity
      const service = await base44.entities.Service.create({
        name: name.trim(),
        date: date || new Date().toISOString().split('T')[0],
        day_of_week: dayOfWeek,
        time: time || '10:00',
        location: location || '',
        description: description || '',
        service_type: 'one_off',
        status: 'active',
        origin: 'manual',
      });

      // 3. Create 1 Session entity
      const session = await base44.entities.Session.create({
        service_id: service.id,
        name: time || '10:00',
        date: service.date,
        planned_start_time: time || '10:00',
        order: 1,
      });

      // 4. Create default Segment entities
      for (const seg of DEFAULT_SEGMENTS) {
        const uiFields = getDefaultUiFields(seg.type);
        const subAssignments = getDefaultSubAssignments(seg.type);

        const created = await base44.entities.Segment.create({
          session_id: session.id,
          service_id: service.id,
          order: seg.order,
          title: seg.title,
          segment_type: seg.type,
          duration_min: seg.duration,
          show_in_general: true,
          show_in_projection: true,
          show_in_sound: true,
          show_in_ushers: true,
          show_in_livestream: true,
          ui_fields: uiFields,
          ui_sub_assignments: subAssignments,
          origin: 'manual',
          color_code: seg.type === 'Alabanza' ? 'worship' : seg.type === 'Plenaria' ? 'preach' : 'default',
        });

        // 5. Create child entities for sub-assignments (e.g., Ministración under Alabanza)
        for (let i = 0; i < subAssignments.length; i++) {
          const sa = subAssignments[i];
          await base44.entities.Segment.create({
            session_id: session.id,
            service_id: service.id,
            parent_segment_id: created.id,
            order: i + 1,
            title: sa.label,
            segment_type: 'Ministración',
            duration_min: sa.duration_min || 5,
            presenter: '',
            show_in_general: false,
            origin: 'manual',
            ui_fields: [],
            ui_sub_assignments: [],
          });
        }
      }

      toast.success('Servicio creado');
      return service.id;
    } catch (err) {
      console.error('[useCustomServiceInit] Creation failed:', err);
      toast.error('Error al crear servicio: ' + err.message);
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createService, creating };
}