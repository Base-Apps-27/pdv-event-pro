/**
 * ensureNextSundayService
 * 
 * Scheduled function that runs weekly to guarantee a Service record
 * exists for next Sunday. Solves the lazy-creation problem where
 * services only exist after someone opens WeeklyServiceManager.
 * 
 * Without this, surfaces like the Speaker Submission Form
 * (serveWeeklyServiceSubmission) can't find a service to link to.
 * 
 * Logic:
 * 1. Calculate next Sunday date in America/New_York
 * 2. Check if an active Service record already exists for that date
 * 3. If not, instantiate one from the blueprint (or hardcoded fallback)
 * 4. Mark it with origin: 'auto_created' for traceability
 * 
 * Decision: "Auto-create next Sunday service" (2026-02-16)
 * Version: 1.0
 * Constitution: No destructive ops. Additive only.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Hardcoded fallback blueprint (matches weeklyBlueprint.js)
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: This is a scheduled job — verify admin caller
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 1. Calculate next Sunday in America/New_York
    const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = nowET.getDay(); // 0 = Sunday
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    const nextSunday = new Date(nowET);
    nextSunday.setDate(nowET.getDate() + daysUntilSunday);
    const dateStr = `${nextSunday.getFullYear()}-${String(nextSunday.getMonth() + 1).padStart(2, '0')}-${String(nextSunday.getDate()).padStart(2, '0')}`;

    console.log(`[ENSURE_SERVICE] Checking for service on ${dateStr}`);

    // 2. Check if a service already exists for this date
    const existing = await base44.asServiceRole.entities.Service.filter({ date: dateStr });
    const weeklyServices = existing.filter(s =>
      s.status !== 'blueprint' &&
      (s["9:30am"]?.length > 0 || s["11:30am"]?.length > 0 || (!s.segments || s.segments.length === 0))
    );

    if (weeklyServices.length > 0) {
      console.log(`[ENSURE_SERVICE] Service already exists for ${dateStr} (id: ${weeklyServices[0].id}). No action needed.`);
      return Response.json({ 
        status: 'already_exists', 
        date: dateStr, 
        service_id: weeklyServices[0].id 
      });
    }

    // 3. Load blueprint from DB (or use hardcoded fallback)
    // Also load ServiceSchedule for dynamic slot names (Entity Lift)
    const [blueprints, schedules] = await Promise.all([
      base44.asServiceRole.entities.Service.filter({ status: 'blueprint' }),
      base44.asServiceRole.entities.ServiceSchedule.filter({ day_of_week: 'Sunday', is_active: true }),
    ]);
    // Build per-session blueprint map from ServiceSchedule → blueprint_id
    const blueprintMap = {};
    if (schedules.length > 0 && schedules[0].sessions?.length > 0) {
      for (const sess of schedules[0].sessions) {
        if (sess.blueprint_id) {
          const bp = blueprints.find(b => b.id === sess.blueprint_id);
          if (bp) blueprintMap[sess.name] = bp;
        }
      }
    }
    const blueprint = blueprints[0] || null;
    
    // Entity Lift: derive slot names from ServiceSchedule, fallback to legacy
    let slotNames = ["9:30am", "11:30am"];
    if (schedules.length > 0 && schedules[0].sessions?.length > 0) {
      slotNames = schedules[0].sessions
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(s => s.name);
    }

    const source930 = blueprint?.["9:30am"] || FALLBACK_BLUEPRINT["9:30am"];
    const source1130 = blueprint?.["11:30am"] || FALLBACK_BLUEPRINT["11:30am"];

    // Deep-clone segments to avoid mutation, clear person-specific data
    const cloneSegments = (segments) => segments.map(seg => {
      const clone = JSON.parse(JSON.stringify(seg));
      // Clear person-specific data fields (presenter, preacher, etc.) 
      // but keep structural data (type, title, duration, actions, fields)
      if (clone.data) {
        // Keep only non-person fields
        const persisted = {};
        // These are structural fields that should carry over
        const structuralKeys = ['message_title', 'title'];
        for (const key of structuralKeys) {
          if (clone.data[key]) persisted[key] = clone.data[key];
        }
        clone.data = persisted;
      }
      // Clear submission-related fields
      clone.submitted_content = null;
      clone.parsed_verse_data = null;
      clone.submission_status = 'ignored';
      clone.scripture_references = null;
      clone.presentation_url = null;
      clone.notes_url = null;
      clone.content_is_slides_only = false;
      return clone;
    });

    // 4. Create the service record
    // Entity Lift: Build slot data dynamically from ServiceSchedule slot names
    const servicePayload = {
      name: `Domingo - ${dateStr}`,
      day_of_week: 'Sunday',
      date: dateStr,
      status: 'active',
      service_type: 'weekly',
      origin: 'auto_created',
      selected_announcements: [],
      segments: [],
    };
    // Build empty team objects and slot segment arrays dynamically
    const emptySlotObj = {};
    slotNames.forEach(name => { emptySlotObj[name] = ""; });
    servicePayload.coordinators = { ...emptySlotObj };
    servicePayload.ujieres = { ...emptySlotObj };
    servicePayload.sound = { ...emptySlotObj };
    servicePayload.luces = { ...emptySlotObj };
    servicePayload.fotografia = null;
    servicePayload.receso_notes = { [slotNames[0]]: "" };
    servicePayload.pre_service_notes = { ...emptySlotObj };
    const newService = await base44.asServiceRole.entities.Service.create(servicePayload);

    console.log(`[ENSURE_SERVICE] Created service for ${dateStr} (id: ${newService.id})`);

    // DECISION-002: Create Session + Segment entities (NOT JSON blobs).
    // Uses per-session blueprint resolution so each session gets its own
    // requires_translation and field settings.
    let totalSegmentsCreated = 0;
    for (const slotName of slotNames) {
      // Resolve blueprint for this specific session
      const sessionBp = blueprintMap[slotName];
      let bpSegments = sessionBp?.segments || [];
      // Legacy fallback: old slot-keyed arrays or hardcoded
      if (!bpSegments.length && blueprint) {
        bpSegments = blueprint[slotName] || blueprint.segments || [];
      }
      if (!bpSegments.length) {
        bpSegments = FALLBACK_BLUEPRINT[slotName] || FALLBACK_BLUEPRINT["9:30am"];
      }

      const sessionOrder = slotNames.indexOf(slotName) + 1;
      const session = await base44.asServiceRole.entities.Session.create({
        service_id: newService.id,
        name: slotName,
        date: dateStr,
        order: sessionOrder,
      });

      for (let i = 0; i < bpSegments.length; i++) {
        const segData = bpSegments[i];
        const segPayload = {
          session_id: session.id,
          service_id: newService.id,
          order: i + 1,
          title: segData.title || "Sin título",
          segment_type: resolveSegmentEnum(segData.type),
          duration_min: Number(segData.duration) || 0,
          show_in_general: true,
          ui_fields: Array.isArray(segData.fields) ? segData.fields : [],
          ui_sub_assignments: Array.isArray(segData.sub_assignments) ? segData.sub_assignments.map(sa => ({
            label: sa.label || "Sin título",
            person_field_name: sa.person_field_name || "",
            duration_min: Number(sa.duration_min || sa.duration) || 0,
          })) : [],
          requires_translation: !!segData.requires_translation,
          default_translator_source: segData.default_translator_source || "manual",
        };
        if (segData.number_of_songs !== undefined) {
          segPayload.number_of_songs = Number(segData.number_of_songs) || 0;
        }
        if (Array.isArray(segData.actions) && segData.actions.length > 0) {
          segPayload.segment_actions = segData.actions;
        }

        const createdSeg = await base44.asServiceRole.entities.Segment.create(segPayload);
        totalSegmentsCreated++;

        // Create child entities for sub_assignments
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

    console.log(`[ENSURE_SERVICE] Created service ${dateStr} (id: ${newService.id}), ${slotNames.length} sessions, ${totalSegmentsCreated} segments`);

    return Response.json({ 
      status: 'created', 
      date: dateStr, 
      service_id: newService.id,
      sessions_created: slotNames.length,
      segments_created: totalSegmentsCreated,
      blueprint_source: blueprint ? 'database' : 'fallback'
    });

  } catch (error) {
    console.error('[ENSURE_SERVICE] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});