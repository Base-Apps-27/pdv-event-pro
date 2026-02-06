import React from "react";
import { formatTimeToEST } from "@/components/utils/timeFormat";
import { normalizeName } from "@/components/utils/textNormalization";

/**
 * LiveChangeToast
 * 
 * Generates a rich, truncated summary of what changed in a live program update.
 * Used by the real-time subscription system in PublicProgramView.
 * 
 * Returns a React element suitable for sonner's toast() JSX support.
 */

// Max characters for any single detail line
const MAX_LINE = 60;
const truncate = (str, max = MAX_LINE) => {
  if (!str) return '';
  const s = String(str).trim();
  return s.length > max ? s.substring(0, max) + '…' : s;
};

/**
 * Build a summary object from an entity subscription event.
 * @param {string} entityType - 'Segment' | 'Session' | 'Service' | 'Event' | 'PreSessionDetails' | 'SegmentAction'
 * @param {object} event - { type: 'create'|'update'|'delete', id, data }
 * @param {string} language - 'es' | 'en'
 * @returns {{ title: string, details: string[], icon: string }}
 */
export function buildChangeSummary(entityType, event, language = 'es') {
  const es = language === 'es';
  const action = event.type;
  const d = event.data || {};

  const actionLabel = {
    create: es ? 'Añadido' : 'Added',
    update: es ? 'Editado' : 'Edited',
    delete: es ? 'Eliminado' : 'Removed',
  }[action] || (es ? 'Cambio' : 'Change');

  let title = '';
  let details = [];
  let icon = '🔄';

  switch (entityType) {
    case 'Segment': {
      const segTitle = d.title || (es ? 'Segmento' : 'Segment');
      const segType = d.segment_type || '';
      title = `${actionLabel}: ${truncate(segTitle, 40)}`;
      icon = action === 'delete' ? '🗑️' : '📋';

      if (segType) details.push(`${es ? 'Tipo' : 'Type'}: ${segType}`);
      if (d.start_time) details.push(`${es ? 'Hora' : 'Time'}: ${formatTimeToEST(d.start_time)}`);
      if (d.presenter) details.push(`${es ? 'Presenta' : 'Presenter'}: ${truncate(normalizeName(d.presenter), 30)}`);
      if (d.duration_min) details.push(`${es ? 'Duración' : 'Duration'}: ${d.duration_min} min`);
      if (action === 'update') {
        // Highlight fields that are commonly edited
        if (d.projection_notes) details.push(`${es ? 'Notas proyección actualizadas' : 'Projection notes updated'}`);
        if (d.sound_notes) details.push(`${es ? 'Notas sonido actualizadas' : 'Sound notes updated'}`);
      }
      break;
    }

    case 'Session': {
      const sessName = d.name || (es ? 'Sesión' : 'Session');
      title = `${actionLabel}: ${truncate(sessName, 40)}`;
      icon = '🎤';

      if (d.planned_start_time) details.push(`${es ? 'Inicio' : 'Start'}: ${formatTimeToEST(d.planned_start_time)}`);
      if (d.location) details.push(`📍 ${truncate(d.location, 35)}`);
      if (d.coordinators) details.push(`${es ? 'Coord' : 'Coord'}: ${truncate(normalizeName(d.coordinators), 30)}`);
      if (d.worship_leader) details.push(`${es ? 'Alabanza' : 'Worship'}: ${truncate(normalizeName(d.worship_leader), 30)}`);
      break;
    }

    case 'Service': {
      const svcName = d.name || (es ? 'Servicio' : 'Service');
      title = `${actionLabel}: ${truncate(svcName, 40)}`;
      icon = '⛪';

      if (d.date) details.push(`${es ? 'Fecha' : 'Date'}: ${d.date}`);
      if (d.time) details.push(`${es ? 'Hora' : 'Time'}: ${formatTimeToEST(d.time)}`);
      break;
    }

    case 'Event': {
      const evName = d.name || (es ? 'Evento' : 'Event');
      title = `${actionLabel}: ${truncate(evName, 40)}`;
      icon = '📅';

      if (d.start_date) details.push(`${es ? 'Fecha' : 'Date'}: ${d.start_date}`);
      if (d.location) details.push(`📍 ${truncate(d.location, 35)}`);
      break;
    }

    case 'PreSessionDetails': {
      title = es ? `${actionLabel}: Detalles Pre-Sesión` : `${actionLabel}: Pre-Session Details`;
      icon = '🚪';

      if (d.registration_desk_open_time) details.push(`${es ? 'Registro abre' : 'Reg. opens'}: ${formatTimeToEST(d.registration_desk_open_time)}`);
      if (d.library_open_time) details.push(`${es ? 'Librería abre' : 'Library opens'}: ${formatTimeToEST(d.library_open_time)}`);
      if (d.facility_notes) details.push(truncate(d.facility_notes, 50));
      break;
    }

    case 'SegmentAction': {
      const actLabel = d.label || (es ? 'Acción' : 'Action');
      title = `${actionLabel}: ${truncate(actLabel, 40)}`;
      icon = '⚡';

      if (d.department) details.push(`${es ? 'Depto' : 'Dept'}: ${d.department}`);
      if (d.timing) details.push(`${es ? 'Momento' : 'Timing'}: ${d.timing}`);
      if (d.notes) details.push(truncate(d.notes, 45));
      break;
    }

    default:
      title = `${actionLabel}: ${entityType}`;
  }

  // Cap at 3 detail lines
  details = details.slice(0, 3);

  return { title, details, icon };
}

/**
 * React element for sonner toast description.
 * Renders the detail lines as a compact list.
 */
export function ChangeToastContent({ details }) {
  if (!details || details.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 mt-1">
      {details.map((line, i) => (
        <span key={i} className="text-xs text-gray-600 leading-tight">{line}</span>
      ))}
    </div>
  );
}