/**
 * ensureRecurringServices
 * 
 * Recurring Services Refactor (2026-02-23): Generalized from ensureNextSundayService.
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
 * 4. If not, create from schedule's blueprint_id (or shared blueprint, or hardcoded fallback)
 * 5. Mark with origin: 'auto_created' for traceability
 * 
 * Decision: "Recurring Services Refactor" (2026-02-23)
 * Predecessor: ensureNextSundayService v1.0
 * Constitution: No destructive ops. Additive only.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Hardcoded fallback blueprint for Sunday (legacy safety net)
const FALLBACK_BLUEPRINT = {
  "9:30am": [
    { type: "worship", title: "Equipo de A&A", duration: 35, fields: ["leader", "songs", "ministry_leader"], data: {}, actions: [], sub_assignments: [{ label: "Ministración de Sanidad y Milagros", person_field_name: "ministry_leader", duration_min: 5 }], songs: [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }], requires_translation: false, default_translator_source: "manual" },
    { type: "welcome", title: "Bienvenida y Anuncios", duration: 5, fields: ["presenter"], data: {}, actions: [], sub_assignments: [], requires_translation: false, default_translator_source: "manual" },
    { type: "offering", title: "Ofrendas", duration: 5, fields: ["presenter", "verse"], data: {}, actions: [], sub_assignments: [], requires_translation: false, default_translator_source: "manual" },
    { type: "message", title: "Mensaje", duration: 45, fields: ["preacher", "title", "verse"], data: {}, actions: [{ label: "Pianista Sube", timing: "before_end", offset_min: 10, department: "Alabanza" }, { label: "Equipo de A&A sube para cerrar", timing: "before_end", offset_min: 5, department: "Alabanza" }], sub_assignments: [{ label: "Cierre", person_field_name: "cierre_leader", duration_min: 5 }], requires_translation: false, default_translator_source: "manual" }
  ],
  "11:30am": [
    { type: "worship", title: "Equipo de A&A", duration: 35, fields: ["leader", "songs", "ministry_leader", "translator"], data: {}, actions: [], sub_assignments: [{ label: "Ministración de Sanidad y Milagros", person_field_name: "ministry_leader", duration_min: 5 }], songs: [{ title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }, { title: "", lead: "", key: "" }], requires_translation: true, default_translator_source: "manual" },
    { type: "welcome", title: "Bienvenida y Anuncios", duration: 5, fields: ["presenter", "translator"], data: {}, actions: [], sub_assignments: [], requires_translation: true, default_translator_source: "worship_segment_translator" },
    { type: "offering", title: "Ofrendas", duration: 5, fields: ["presenter", "verse", "translator"], data: {}, actions: [], sub_assignments: [], requires_translation: true, default_translator_source: "worship_segment_translator" },
    { type: "message", title: "Mensaje", duration: 45, fields: ["preacher", "title", "verse", "translator"], data: {}, actions: [{ label: "Pianista Sube", timing: "before_end", offset_min: 10, department: "Alabanza" }, { label: "Equipo de A&A sube", timing: "before_end", offset_min: 5, department: "Alabanza" }], sub_assignments: [{ label: "Cierre", person_field_name: "cierre_leader", duration_min: 5 }], requires_translation: true, default_translator_source: "manual" }
  ]
};

const DAY_LABELS = {
  Sunday: "Domingo", Monday: "Lunes", Tuesday: "Martes",
  Wednesday: "Miércoles", Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado"
};

// JS day indices: 0=Sunday, 1=Monday, ... 6=Saturday
const DAY_INDEX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6
};

/**
 * Calculate the next occurrence of a given day_of_week from a reference date.
 * If today IS that day, returns today.
 */
function getNextOccurrence(nowET, dayOfWeek) {
  const targetIdx = DAY_INDEX[dayOfWeek];
  if (targetIdx === undefined) return null;

  const currentIdx = nowET.getDay();
  let daysUntil = targetIdx - currentIdx;
  if (daysUntil < 0) daysUntil += 7;
  // If daysUntil === 0, it's today — that's fine, we want to ensure today's service exists

  const target = new Date(nowET);
  target.setDate(nowET.getDate() + daysUntil);
  return target;
}

function formatDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Deep-clone blueprint segments, clearing person-specific data but keeping structure.
 */
function cloneSegments(segments) {
  return (segments || []).map(seg => {
    const clone = JSON.parse(JSON.stringify(seg));
    if (clone.data) {
      const persisted = {};
      const structuralKeys = ['message_title', 'title'];
      for (const key of structuralKeys) {
        if (clone.data[key]) persisted[key] = clone.data[key];
      }
      clone.data = persisted;
    }
    clone.submitted_content = null;
    clone.parsed_verse_data = null;
    clone.submission_status = 'ignored';
    clone.scripture_references = null;
    clone.presentation_url = null;
    clone.notes_url = null;
    clone.content_is_slides_only = false;
    return clone;
  });
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

    // 2. Load all active ServiceSchedules and shared blueprint
    const [schedules, blueprints] = await Promise.all([
      base44.asServiceRole.entities.ServiceSchedule.filter({ is_active: true }),
      base44.asServiceRole.entities.Service.filter({ status: 'blueprint' }),
    ]);

    const sharedBlueprint = blueprints[0] || null;
    console.log(`[ENSURE_RECURRING] Found ${schedules.length} active schedule(s), shared blueprint: ${sharedBlueprint ? sharedBlueprint.id : 'none'}`);

    const results = [];

    // 3. Process each schedule
    for (const schedule of schedules) {
      const dayOfWeek = schedule.day_of_week;
      const dayLabel = DAY_LABELS[dayOfWeek] || dayOfWeek;

      // Calculate next occurrence
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

      // Derive slot names from schedule sessions
      let slotNames = ["9:30am"];
      if (schedule.sessions?.length > 0) {
        slotNames = schedule.sessions
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(s => s.name);
      }

      // 6. Create service
      const servicePayload = {
        name: `${dayLabel} - ${dateStr}`,
        day_of_week: dayOfWeek,
        date: dateStr,
        status: 'active',
        service_type: 'weekly',
        origin: 'auto_created',
        selected_announcements: [],
        segments: [],
      };

      const emptySlotObj = {};
      slotNames.forEach(name => { emptySlotObj[name] = ""; });
      servicePayload.coordinators = { ...emptySlotObj };
      servicePayload.ujieres = { ...emptySlotObj };
      servicePayload.sound = { ...emptySlotObj };
      servicePayload.luces = { ...emptySlotObj };
      servicePayload.fotografia = null;
      servicePayload.receso_notes = {};
      slotNames.slice(0, -1).forEach(s => { servicePayload.receso_notes[s] = ""; });
      servicePayload.pre_service_notes = { ...emptySlotObj };

      slotNames.forEach(name => {
        const sessionDef = schedule.sessions?.find(s => s.name === name);
        let bpSegments = [];
        
        if (sessionDef?.blueprint_id) {
          // Resolve blueprint per session
          const bp = blueprints.find(b => b.id === sessionDef.blueprint_id);
          if (bp) {
            bpSegments = bp.segments || [];
            if (bpSegments.length === 0) {
              const firstKey = Object.keys(bp).find(k => Array.isArray(bp[k]) && !['segments', 'selected_announcements', 'actions'].includes(k));
              if (firstKey) bpSegments = bp[firstKey];
            }
          }
        }
        
        // If still empty, use legacy fallback
        if (!bpSegments || bpSegments.length === 0) {
          bpSegments = FALLBACK_BLUEPRINT[name] || FALLBACK_BLUEPRINT["9:30am"] || [];
        }

        servicePayload[name] = cloneSegments(bpSegments);
      });

      const newService = await base44.asServiceRole.entities.Service.create(servicePayload);
      console.log(`[ENSURE_RECURRING] Created ${dayLabel} service for ${dateStr} (id: ${newService.id})`);
      results.push({
        schedule: schedule.name,
        date: dateStr,
        status: 'created',
        service_id: newService.id,
        blueprint_source: 'per-session-resolved'
      });
    }

    return Response.json({ status: 'ok', results });

  } catch (error) {
    console.error('[ENSURE_RECURRING] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});