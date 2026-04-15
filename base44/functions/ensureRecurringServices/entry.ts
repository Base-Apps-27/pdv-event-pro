/**
 * ensureRecurringServices
 * 
 * DECISION-002 Contract 1 (2026-02-25): Entity-First Data Path.
 * This function MUST create Session + Segment entities — NOT JSON blobs.
 * 
 * Scheduled function that runs daily to guarantee a Service record exists
 * for EVERY active ServiceSchedule's next occurrence date.
 * 
 * Without this, surfaces like the Speaker Submission Form and Live View
 * can't find a service to link to until an admin opens WeeklyServiceManager.
 * 
 * Logic:
 * 1. Load ALL active ServiceSchedule records
 * 2. For each: calculate the next occurrence date (in America/New_York)
 * 3. Check if a Service record already exists for that date + day_of_week
 * 4. If not, create Service + Session + Segment entities from blueprint
 * 5. Mark with origin: 'auto_created' for traceability
 * 
 * P0 FIX (2026-02-25): Previously wrote JSON blobs to Service entity.
 * DayServiceEditor STRICT MODE only reads Session/Segment entities.
 * This caused auto-created services to appear empty in the editor.
 * Now creates Session + Segment entities matching EmptyDayPrompt flow.
 * See: SYSTEM_AUDIT_RECURRING_SERVICES.md §4
 */

// 2026-04-12: SDK bumped from 0.8.6 → 0.8.25 for consistency across all backend functions.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DAY_LABELS = {
  Sunday: "Domingo", Monday: "Lunes", Tuesday: "Martes",
  Wednesday: "Miércoles", Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado"
};

// JS day indices: 0=Sunday, 1=Monday, ... 6=Saturday
const DAY_INDEX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6
};

// DECISION-002 Contract 2: Shared type normalization (inlined for Deno — no local imports).
// This MUST stay in sync with components/utils/segmentTypeMap.js
const TYPE_TO_ENUM = {
  'worship': 'Alabanza', 'alabanza': 'Alabanza',
  'welcome': 'Bienvenida', 'bienvenida': 'Bienvenida',
  'offering': 'Ofrenda', 'ofrenda': 'Ofrenda', 'ofrendas': 'Ofrenda',
  'message': 'Plenaria', 'plenaria': 'Plenaria', 'predica': 'Plenaria', 'mensaje': 'Plenaria',
  'video': 'Video', 'anuncio': 'Anuncio',
  'dinamica': 'Dinámica', 'dinámica': 'Dinámica',
  'break': 'Break', 'techonly': 'TechOnly',
  'prayer': 'Oración', 'oracion': 'Oración', 'oración': 'Oración',
  'special': 'Especial', 'especial': 'Especial',
  'closing': 'Cierre', 'cierre': 'Cierre',
  'ministry': 'Ministración', 'ministracion': 'Ministración', 'ministración': 'Ministración',
  'mc': 'MC', 'artes': 'Artes', 'breakout': 'Breakout', 'panel': 'Panel',
  'receso': 'Receso', 'almuerzo': 'Almuerzo',
};

function resolveSegmentEnum(rawType) {
  if (!rawType) return 'Especial';
  return TYPE_TO_ENUM[rawType.toLowerCase()] || rawType;
}

/**
 * BUGFIX (2026-03-04): Derive planned_start_time from slot name like "9:30am".
 * Used ONLY as a last-resort fallback when ServiceSchedule.sessions[].planned_start_time
 * is not available. The primary source is the schedule's session definition.
 */
function parseSlotNameToTime(slotName) {
  if (!slotName) return null;
  const match = slotName.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = match[2];
  const ampm = (match[3] || '').toLowerCase();
  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

// Hardcoded fallback blueprint for Sunday (legacy safety net)
const FALLBACK_BLUEPRINT_SEGMENTS = [
  { type: "worship", title: "Equipo de A&A", duration: 35, fields: ["leader", "songs", "ministry_leader"], sub_assignments: [{ label: "Ministración de Sanidad y Milagros", person_field_name: "ministry_leader", duration_min: 5 }], requires_translation: false, default_translator_source: "manual", number_of_songs: 4 },
  { type: "welcome", title: "Bienvenida y Anuncios", duration: 5, fields: ["presenter"], sub_assignments: [], requires_translation: false, default_translator_source: "manual" },
  { type: "offering", title: "Ofrendas", duration: 5, fields: ["presenter", "verse"], sub_assignments: [], requires_translation: false, default_translator_source: "manual" },
  { type: "message", title: "Mensaje", duration: 45, fields: ["preacher", "title", "verse"], sub_assignments: [{ label: "Cierre", person_field_name: "cierre_leader", duration_min: 5 }], requires_translation: false, default_translator_source: "manual" },
];

/**
 * Calculate the NEXT upcoming occurrence of a given day_of_week.
 * "Next" means strictly in the future (if today IS the target, returns next week).
 */
function getNextOccurrence(nowET, dayOfWeek) {
  const targetIdx = DAY_INDEX[dayOfWeek];
  if (targetIdx === undefined) return null;

  const currentIdx = nowET.getDay();
  let daysUntil = targetIdx - currentIdx;
  if (daysUntil <= 0) daysUntil += 7;

  const target = new Date(nowET);
  target.setDate(nowET.getDate() + daysUntil);
  return target;
}

function formatDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: scheduled job — verify admin caller
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 1. Current date in America/New_York
    const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    console.log(`[ENSURE_RECURRING] Running at ET: ${nowET.toISOString()}`);

    // 2. Load all active ServiceSchedules and shared blueprints
    const [schedules, blueprints] = await Promise.all([
      base44.asServiceRole.entities.ServiceSchedule.filter({ is_active: true }),
      base44.asServiceRole.entities.Service.filter({ status: 'blueprint' }),
    ]);

    console.log(`[ENSURE_RECURRING] Found ${schedules.length} active schedule(s), ${blueprints.length} blueprint(s)`);

    const results = [];

    // 3. Process each schedule
    for (const schedule of schedules) {
      const dayOfWeek = schedule.day_of_week;
      const dayLabel = DAY_LABELS[dayOfWeek] || dayOfWeek;

      const nextDate = getNextOccurrence(nowET, dayOfWeek);
      if (!nextDate) {
        console.warn(`[ENSURE_RECURRING] Invalid day_of_week: ${dayOfWeek}`);
        results.push({ schedule: schedule.name, status: 'skipped', reason: 'invalid day_of_week' });
        continue;
      }
      const dateStr = formatDateStr(nextDate);

      console.log(`[ENSURE_RECURRING] Checking ${schedule.name} (${dayOfWeek}) → ${dateStr}`);

      // 4. Check if service already exists for this date + day
      const existing = await base44.asServiceRole.entities.Service.filter({ date: dateStr });
      const match = existing.find(s =>
        s.status !== 'blueprint' &&
        s.day_of_week === dayOfWeek &&
        s.service_type === 'weekly'
      );

      // Legacy fallback for Sunday services without day_of_week
      if (!match && dayOfWeek === 'Sunday') {
        const legacyMatch = existing.find(s =>
          s.status !== 'blueprint' &&
          !s.service_type &&
          Object.keys(s).some(key => /^\d{1,2}:\d{2}(am|pm)$/i.test(key) && Array.isArray(s[key]) && s[key].length > 0)
        );
        if (legacyMatch) {
          console.log(`[ENSURE_RECURRING] Legacy Sunday service found for ${dateStr} (id: ${legacyMatch.id})`);
          results.push({ schedule: schedule.name, date: dateStr, status: 'already_exists', service_id: legacyMatch.id, note: 'legacy' });
          continue;
        }
      }

      if (match) {
        console.log(`[ENSURE_RECURRING] Service exists for ${dateStr} ${dayOfWeek} (id: ${match.id})`);
        results.push({ schedule: schedule.name, date: dateStr, status: 'already_exists', service_id: match.id });
        continue;
      }

      // 5. Derive slot names from schedule sessions
      let slotNames = ["9:30am"];
      if (schedule.sessions?.length > 0) {
        slotNames = schedule.sessions
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(s => s.name);
      }

      // 6. Create Service entity (metadata only — NO segment JSON blobs)
      const emptySlotObj = {};
      slotNames.forEach(name => { emptySlotObj[name] = ""; });

      const servicePayload = {
        name: `${dayLabel} - ${dateStr}`,
        day_of_week: dayOfWeek,
        date: dateStr,
        status: 'active',
        service_type: 'weekly',
        origin: 'auto_created',
        selected_announcements: [],
        coordinators: { ...emptySlotObj },
        ujieres: { ...emptySlotObj },
        sound: { ...emptySlotObj },
        luces: { ...emptySlotObj },
        fotografia: { ...emptySlotObj },
        pre_service_notes: { ...emptySlotObj },
        receso_notes: {},
      };
      slotNames.slice(0, -1).forEach(s => { servicePayload.receso_notes[s] = ""; });

      const newService = await base44.asServiceRole.entities.Service.create(servicePayload);
      console.log(`[ENSURE_RECURRING] Created Service for ${dayLabel} ${dateStr} (id: ${newService.id})`);

      // 7. Create Session + Segment entities for each slot
      // P0 FIX: This is the critical change — previously we wrote JSON blobs.
      let totalSegmentsCreated = 0;

      for (const slotName of slotNames) {
        // Resolve blueprint segments for this slot
        const sessionDef = schedule.sessions?.find(s => s.name === slotName);
        let bpSegments = [];

        if (sessionDef?.blueprint_id) {
          const bp = blueprints.find(b => b.id === sessionDef.blueprint_id);
          if (bp) {
            bpSegments = bp.segments || [];
            // Legacy fallback: look for old slot-keyed arrays
            if (bpSegments.length === 0) {
              const firstKey = Object.keys(bp).find(k =>
                Array.isArray(bp[k]) && !['segments', 'selected_announcements', 'actions'].includes(k)
              );
              if (firstKey) bpSegments = bp[firstKey];
            }
          }
        }

        // Fallback to hardcoded blueprint if nothing resolved
        if (!bpSegments || bpSegments.length === 0) {
          bpSegments = FALLBACK_BLUEPRINT_SEGMENTS;
        }

        // Create Session entity
        // BUGFIX (2026-03-04): Include planned_start_time so computeSegmentTimes
        // in buildProgramSnapshot can calculate segment start/end times.
        // Primary source: ServiceSchedule.sessions[].planned_start_time (authoritative).
        // Fallback: parse from slot name like "9:30am" (best-effort).
        const sessionDef2 = schedule.sessions?.find(s => s.name === slotName);
        const plannedStart = sessionDef2?.planned_start_time || parseSlotNameToTime(slotName);
        // BUGFIX (2026-03-06): Thread session_color from ServiceSchedule definition
        // so the weekly editor renders the configured accent color instead of defaulting to "blue".
        const session = await base44.asServiceRole.entities.Session.create({
          service_id: newService.id,
          name: slotName,
          date: dateStr,
          order: slotNames.indexOf(slotName) + 1,
          planned_start_time: plannedStart,
          session_color: sessionDef2?.color || undefined,
        });
        console.log(`[ENSURE_RECURRING] Created Session "${slotName}" (id: ${session.id})`);

        // 2026-04-15: Compute segment times by chaining durations from session start.
        // This eliminates null start_time/end_time on auto-created segments.
        let runningMinutes = 0;
        if (plannedStart) {
          const [pH, pM] = plannedStart.split(':').map(Number);
          if (!isNaN(pH) && !isNaN(pM)) runningMinutes = pH * 60 + pM;
        }

        // Create Segment entities from blueprint
        for (let i = 0; i < bpSegments.length; i++) {
          const segData = bpSegments[i];
          const segDuration = Number(segData.duration) || 0;

          // Calculate start_time and end_time from chained durations
          const segStartTime = plannedStart
            ? `${String(Math.floor(runningMinutes / 60) % 24).padStart(2, '0')}:${String(runningMinutes % 60).padStart(2, '0')}`
            : undefined;
          const segEndMinutes = runningMinutes + segDuration;
          const segEndTime = plannedStart
            ? `${String(Math.floor(segEndMinutes / 60) % 24).padStart(2, '0')}:${String(segEndMinutes % 60).padStart(2, '0')}`
            : undefined;

          const segmentPayload = {
            session_id: session.id,
            service_id: newService.id,
            order: i + 1,
            title: segData.title || "Untitled",
            segment_type: resolveSegmentEnum(segData.type),
            duration_min: segDuration,
            start_time: segStartTime,
            end_time: segEndTime,
            show_in_general: true,
            color_code: segData.color_code || 'default',
            ui_fields: Array.isArray(segData.fields) ? segData.fields : [],
            ui_sub_assignments: Array.isArray(segData.sub_assignments) ? segData.sub_assignments.map(sa => ({
              label: sa.label || "Untitled",
              person_field_name: sa.person_field_name || "",
              duration_min: Number(sa.duration_min || sa.duration) || 0,
            })) : [],
            requires_translation: !!segData.requires_translation,
            default_translator_source: segData.default_translator_source || "manual",
          };

          if (segData.number_of_songs !== undefined) {
            segmentPayload.number_of_songs = Number(segData.number_of_songs) || 0;
          }

          // BUGFIX (2026-02-27): Carry forward structured actions from blueprint.
          // Without this, StickyOpsDeck sees no actions on auto-created services.
          if (Array.isArray(segData.actions) && segData.actions.length > 0) {
            segmentPayload.segment_actions = segData.actions;
          }

          const createdSeg = await base44.asServiceRole.entities.Segment.create(segmentPayload);
          totalSegmentsCreated++;
          // Advance running time for next segment
          runningMinutes = segEndMinutes;

          // BUGFIX (2026-02-26): Create child Segment entities for sub_assignments
          // so Ministración rows appear immediately in the editor without manual creation.
          if (Array.isArray(segData.sub_assignments) && segData.sub_assignments.length > 0) {
            for (let saIdx = 0; saIdx < segData.sub_assignments.length; saIdx++) {
              const sa = segData.sub_assignments[saIdx];
              await base44.asServiceRole.entities.Segment.create({
                session_id: session.id,
                service_id: newService.id,
                parent_segment_id: createdSeg.id,
                order: saIdx + 1,
                title: sa.label || 'Sub-asignación',
                segment_type: 'Ministración',
                duration_min: Number(sa.duration_min || sa.duration) || 5,
                presenter: '',
                show_in_general: false,
                origin: 'template',
                ui_fields: [],
                ui_sub_assignments: [],
              });
              totalSegmentsCreated++;
            }
          }
        }
      }

      console.log(`[ENSURE_RECURRING] Created ${slotNames.length} sessions, ${totalSegmentsCreated} segments for ${dayLabel} ${dateStr}`);
      results.push({
        schedule: schedule.name,
        date: dateStr,
        status: 'created',
        service_id: newService.id,
        sessions_created: slotNames.length,
        segments_created: totalSegmentsCreated,
        blueprint_source: 'per-session-resolved',
      });
    }

    return Response.json({ status: 'ok', results });

  } catch (error) {
    console.error('[ENSURE_RECURRING] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});