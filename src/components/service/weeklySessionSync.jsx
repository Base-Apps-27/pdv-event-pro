/**
 * weeklySessionSync.jsx
 * Service Segment Entity Lift: Bidirectional sync between weekly service
 * JSON format and Session/Segment entities.
 *
 * WRITE: syncWeeklyToSessions() — creates/updates Session + Segment + PreSessionDetails
 *        entities from weekly service JSON state. Called fire-and-forget after save.
 *
 * READ:  loadWeeklyFromSessions() — loads Session + Segment entities and transforms
 *        back to the weekly JSON format that the UI expects.
 *
 * Guards:
 *   - Skips segment recreation if session.live_adjustment_enabled is true
 *   - Returns null from load if no sessions exist (signals JSON fallback)
 */

import { addMinutes, parse, format } from "date-fns";
import { getSegmentData, getNormalizedSongs } from "@/components/utils/segmentDataUtils";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

// Phase 2: Default TIME_SLOTS used only as fallback when no schedule is provided.
// Callers should pass timeSlots from useServiceSchedules when available.
const DEFAULT_TIME_SLOTS = [
  { name: "9:30am", time: "09:30", order: 1, color: "green" },
  { name: "11:30am", time: "11:30", order: 2, color: "blue" },
];

// Weekly JSON types → canonical Segment entity types
const TYPE_MAP = {
  worship: "Alabanza", alabanza: "Alabanza",
  welcome: "Bienvenida", bienvenida: "Bienvenida",
  offering: "Ofrenda", ofrenda: "Ofrenda", ofrendas: "Ofrenda",
  message: "Plenaria", plenaria: "Plenaria", predica: "Plenaria", mensaje: "Plenaria",
  video: "Video",
  announcement: "Anuncio", anuncio: "Anuncio",
  dynamic: "Dinámica", "dinámica": "Dinámica",
  break: "Break", receso: "Receso", almuerzo: "Almuerzo",
  techonly: "TechOnly",
  prayer: "Oración", "oración": "Oración",
  special: "Especial", especial: "Especial",
  closing: "Cierre", cierre: "Cierre",
  mc: "MC",
  "ministración": "Ministración",
  artes: "Artes",
  breakout: "Breakout",
  panel: "Panel",
};

function normalizeSegmentType(rawType) {
  if (!rawType) return "Especial";
  return TYPE_MAP[rawType.toLowerCase()] || rawType;
}

// ═══════════════════════════════════════════════════════════════
// SYNC: Weekly Service JSON → Session + Segment + PreSessionDetails
// ═══════════════════════════════════════════════════════════════

/**
 * Phase 2: accepts optional timeSlots array from useServiceSchedules.
 * Format: [{ name: "9:30am", time: "09:30", order: 1, color: "green" }]
 * Falls back to DEFAULT_TIME_SLOTS if not provided.
 */
export async function syncWeeklyToSessions(base44, serviceResult, serviceData, timeSlots) {
  if (!serviceResult?.id) return;

  const serviceId = serviceResult.id;
  const date = serviceResult.date || serviceData?.date;
  const slots = (timeSlots && timeSlots.length > 0) ? timeSlots : DEFAULT_TIME_SLOTS;

  for (const slot of slots) {
    const segments = serviceData?.[slot.name];
    if (!segments || !Array.isArray(segments) || segments.length === 0) continue;

    // ── 1. Find or create Session ──
    let session = null;
    const existingSessions = await base44.entities.Session.filter({
      service_id: serviceId,
      name: slot.name,
    });

    const sessionFields = {
      service_id: serviceId,
      name: slot.name,
      date: date,
      planned_start_time: slot.time,
      order: slot.order,
      status: "confirmed",
      session_color: slot.color,
      coordinators: serviceData.coordinators?.[slot.name] || "",
      ushers_team: serviceData.ujieres?.[slot.name] || "",
      sound_team: serviceData.sound?.[slot.name] || "",
      tech_team: serviceData.luces?.[slot.name] || "",
      photography_team: serviceData.fotografia?.[slot.name] || "",
    };

    if (existingSessions.length > 0) {
      session = existingSessions[0];
      // Don't clobber live director state
      const updatePayload = { ...sessionFields };
      if (session.live_adjustment_enabled) {
        delete updatePayload.live_adjustment_enabled;
      }
      await base44.entities.Session.update(session.id, updatePayload);
    } else {
      session = await base44.entities.Session.create({
        ...sessionFields,
        live_adjustment_enabled: false,
      });
    }

    // ── 2. Pre-session notes → PreSessionDetails ──
    const preNotes = serviceData.pre_service_notes?.[slot.name] || "";
    try {
      const existingPSD = await base44.entities.PreSessionDetails.filter({
        session_id: session.id,
      });
      if (existingPSD.length > 0) {
        if (existingPSD[0].general_notes !== preNotes) {
          await base44.entities.PreSessionDetails.update(existingPSD[0].id, {
            general_notes: preNotes,
          });
        }
      } else if (preNotes) {
        await base44.entities.PreSessionDetails.create({
          session_id: session.id,
          general_notes: preNotes,
        });
      }
    } catch (err) {
      console.error("[WEEKLY_SYNC] PreSessionDetails sync error:", err.message);
    }

    // ── 3. Guard: skip segment recreation if live mode active ──
    if (session.live_adjustment_enabled) {
      console.warn(
        `[WEEKLY_SYNC] Skipping segment recreation for ${slot.name} — live mode active`
      );
      continue;
    }

    // ── 4. Build new segment entities BEFORE deleting old ones ──
    // Create-before-delete pattern: ensures segments always exist even if
    // the process fails partway through. Orphaned old segments are harmless
    // (cleaned up at the end), but zero segments is a data loss scenario.
    const newSegments = [];
    let currentTime = parse(slot.time, "HH:mm", new Date());

    for (let i = 0; i < segments.length; i++) {
      const segData = segments[i];
      const getData = (field) => getSegmentData(segData, field);

      const duration = segData.duration || 0;
      const startTimeStr = format(currentTime, "HH:mm");
      currentTime = addMinutes(currentTime, duration);
      const endTimeStr = format(currentTime, "HH:mm");

      // Resolve presenter from type-specific fields
      const presenter = resolvePresenter(segData, getData);

      // Flatten songs array to song_N_* fields
      const flatSongs = flattenSongs(getData("songs"));

      const parentSegmentData = {
        session_id: session.id,
        service_id: serviceId,
        order: i + 1,
        title: segData.title || "",
        segment_type: normalizeSegmentType(segData.type),
        start_time: startTimeStr,
        end_time: endTimeStr,
        duration_min: duration,
        presenter: presenter,
        translator_name: getData("translator") || "",
        requires_translation:
          !!getData("translator") || !!segData.requires_translation,
        default_translator_source: segData.default_translator_source || "manual",
        description_details:
          getData("description_details") || getData("description") || "",
        coordinator_notes: getData("coordinator_notes") || "",
        projection_notes:
          getData("projection_notes") || segData.projection_notes || "",
        sound_notes: getData("sound_notes") || "",
        ushers_notes: getData("ushers_notes") || "",
        translation_notes: getData("translation_notes") || "",
        stage_decor_notes: getData("stage_decor_notes") || "",
        message_title:
          getData("messageTitle") ||
          getData("message_title") ||
          segData.message_title ||
          "",
        scripture_references:
          getData("verse") ||
          getData("scripture_references") ||
          segData.scripture_references ||
          "",
        parsed_verse_data:
          getData("parsed_verse_data") || segData.parsed_verse_data || null,
        submitted_content:
          getData("submitted_content") || segData.submitted_content || "",
        submission_status: segData.submission_status || null,
        presentation_url:
          getData("presentation_url") || segData.presentation_url || "",
        notes_url: segData.notes_url || "",
        content_is_slides_only:
          !!getData("content_is_slides_only") ||
          !!segData.content_is_slides_only,
        segment_actions: getData("actions") || segData.actions || [],
        number_of_songs: flatSongs._count || 0,
        ...flatSongs._fields,
        show_in_general: true,
        // Entity Lift: Persist UI metadata to eliminate blueprint matching on read
        ui_fields: segData.fields || [],
        ui_sub_assignments: segData.sub_assignments || [],
      };

      newSegments.push(parentSegmentData);

      // Handle sub_asignaciones (Alabanza with Ministración children)
      buildSubAsignaciones(
        segData,
        getData,
        session.id,
        serviceId,
        startTimeStr,
        newSegments
      );
    }

    // ── 5. Snapshot old segment IDs for cleanup AFTER new ones are created ──
    const existingSegs = await base44.entities.Segment.filter({
      session_id: session.id,
    });
    const oldSegmentIds = existingSegs.map((s) => s.id);

    // ── 6. Bulk create: parents first, then children with parent IDs ──
    // Clean internal markers before sending to DB
    const parentSegments = newSegments
      .filter((s) => !s._isSubAsignacion)
      .map(({ _isSubAsignacion, _parentOrder, ...rest }) => rest);
    const subSegments = newSegments.filter((s) => s._isSubAsignacion);

    const createdParents = await base44.entities.Segment.bulkCreate(
      parentSegments
    );

    if (subSegments.length > 0 && createdParents.length > 0) {
      // Map sub-segments to their parent Alabanza segment IDs
      const alabanzaParents = createdParents.filter(
        (p) => p.segment_type === "Alabanza"
      );
      let currentAlabanzaIdx = 0;
      let prevParentMarker = null;

      const subSegmentsWithParent = subSegments.map((sub) => {
        const { _isSubAsignacion, _parentOrder, ...cleaned } = sub;

        // Track which parent this sub belongs to via _parentOrder marker
        if (_parentOrder !== prevParentMarker) {
          if (prevParentMarker !== null) currentAlabanzaIdx++;
          prevParentMarker = _parentOrder;
        }

        if (currentAlabanzaIdx < alabanzaParents.length) {
          cleaned.parent_segment_id = alabanzaParents[currentAlabanzaIdx].id;
        }
        return cleaned;
      });

      await base44.entities.Segment.bulkCreate(subSegmentsWithParent);
    }

    // ── 7. Delete OLD segments now that new ones are safely created ──
    // Create-before-delete: if steps 6 failed, old segments remain intact.
    if (oldSegmentIds.length > 0) {
      await Promise.all(
        oldSegmentIds.map((id) => base44.entities.Segment.delete(id))
      );
    }

    // Update session planned_end_time
    if (newSegments.length > 0) {
      const lastParent = parentSegments[parentSegments.length - 1];
      if (lastParent?.end_time) {
        await base44.entities.Session.update(session.id, {
          planned_end_time: lastParent.end_time,
        });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// LOAD: Session + Segment entities → Weekly Service JSON format
// ═══════════════════════════════════════════════════════════════
// @deprecated — This entity→JSON conversion exists only because the UI
// still reads the weekly JSON shape. Once the UI reads Session/Segment
// entities directly (via subscriptions + React Query), this function
// and segmentEntityToWeeklyJSON() below become unnecessary.
// Target removal: after weekday tabs UI reads entities directly.

export async function loadWeeklyFromSessions(base44, serviceId, blueprint) {
  if (!serviceId) return null;

  const sessions = await base44.entities.Session.filter({
    service_id: serviceId,
  });
  if (!sessions || sessions.length === 0) return null;

  const result = {
    coordinators: {},
    ujieres: {},
    sound: {},
    luces: {},
    fotografia: {},
    pre_service_notes: {},
  };

  for (const session of sessions.sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  )) {
    const slotName = session.name; // "9:30am" or "11:30am"

    // Team fields → reverse map to weekly JSON keys
    result.coordinators[slotName] = session.coordinators || "";
    result.ujieres[slotName] = session.ushers_team || "";
    result.sound[slotName] = session.sound_team || "";
    result.luces[slotName] = session.tech_team || "";
    result.fotografia[slotName] = session.photography_team || "";

    // Pre-session notes from PreSessionDetails
    try {
      const psd = await base44.entities.PreSessionDetails.filter({
        session_id: session.id,
      });
      result.pre_service_notes[slotName] = psd[0]?.general_notes || "";
    } catch {
      result.pre_service_notes[slotName] = "";
    }

    // Load all segments for this session
    const allSegments = await base44.entities.Segment.filter({
      session_id: session.id,
    });

    const parentSegments = allSegments
      .filter((s) => !s.parent_segment_id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const childSegments = allSegments.filter((s) => s.parent_segment_id);

    // Transform each parent segment back to weekly JSON format
    const blueprintSlot = blueprint?.[slotName];
    result[slotName] = parentSegments.map((seg, idx) => {
      const children = childSegments
        .filter((c) => c.parent_segment_id === seg.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      return segmentEntityToWeeklyJSON(seg, children, blueprintSlot, idx);
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve presenter from type-specific data fields.
 * Weekly services store the primary person under different keys depending on type:
 *   worship → data.leader, message → data.preacher, other → data.presenter
 */
function resolvePresenter(segData, getData) {
  const typeL = (segData.type || "").toLowerCase();
  if (typeL === "worship" || typeL === "alabanza") {
    return getData("leader") || getData("presenter") || "";
  }
  if (
    typeL === "message" ||
    typeL === "plenaria" ||
    typeL === "predica" ||
    typeL === "mensaje"
  ) {
    return getData("preacher") || getData("presenter") || "";
  }
  return getData("presenter") || "";
}

/**
 * Flatten songs array into individual song_N_title/lead/key fields.
 * Returns { _fields: { song_1_title: ..., ... }, _count: N }
 */
function flattenSongs(songs) {
  const fields = {};
  let count = 0;
  if (songs && Array.isArray(songs)) {
    songs.forEach((song, idx) => {
      if (idx < 6 && song && song.title) {
        fields[`song_${idx + 1}_title`] = song.title;
        fields[`song_${idx + 1}_lead`] = song.lead || "";
        fields[`song_${idx + 1}_key`] = song.key || "";
        count++;
      }
    });
  }
  return { _fields: fields, _count: count };
}

/**
 * Build child Ministración segments for Alabanza with sub_asignaciones.
 * Mutates newSegments array in place.
 */
function buildSubAsignaciones(
  segData,
  getData,
  sessionId,
  serviceId,
  parentStartTimeStr,
  newSegments
) {
  const typeL = (segData.type || "").toLowerCase();
  if (typeL !== "worship" && typeL !== "alabanza") return;

  const subAssignments =
    segData.sub_asignaciones || segData.sub_assignments || [];
  if (subAssignments.length === 0) return;

  // Check if any sub-assignment has actual person data
  const hasData = subAssignments.some((sub) => {
    const fieldName = sub.person_field_name;
    const value = fieldName
      ? segData.data?.[fieldName] || getData(fieldName)
      : sub.presenter;
    return !!value;
  });
  if (!hasData) return;

  const parentOrder = newSegments.length; // Track which parent these belong to
  let subStartTime = parse(parentStartTimeStr, "HH:mm", new Date());

  subAssignments.forEach((sub, subIdx) => {
    const subDuration = sub.duration_min || sub.duration || 5;
    const subStartStr = format(subStartTime, "HH:mm");
    subStartTime = addMinutes(subStartTime, subDuration);
    const subEndStr = format(subStartTime, "HH:mm");

    const fieldName = sub.person_field_name;
    const subPresenter = fieldName
      ? segData.data?.[fieldName] || getData(fieldName) || sub.presenter || ""
      : sub.presenter || "";

    newSegments.push({
      session_id: sessionId,
      service_id: serviceId,
      parent_segment_id: "{PARENT_ID}",
      order: subIdx + 1,
      title: sub.label || sub.title || `Ministración ${subIdx + 1}`,
      segment_type: "Ministración",
      start_time: subStartStr,
      end_time: subEndStr,
      duration_min: subDuration,
      presenter: subPresenter,
      show_in_general: true,
      _isSubAsignacion: true,
      _parentOrder: parentOrder,
    });
  });
}

/**
 * Convert a Segment entity + its children back to weekly JSON format.
 * The output shape must be identical to what WeeklyServiceManager expects
 * as an element of the serviceData["9:30am"] or serviceData["11:30am"] array.
 *
 * Entity Lift Phase: Now reads ui_fields and ui_sub_assignments from entity
 * instead of blueprint matching. Blueprint is used ONLY as fallback for
 * segments created before these fields were stored (pre-migration data).
 */
function segmentEntityToWeeklyJSON(segment, childSegments, blueprintSlotSegments, idx) {
  const songs = getNormalizedSongs(segment);
  const segType = segment.segment_type || "Especial";

  // Build data object with values in all possible field locations
  // (different code paths read from data.leader, data.preacher, data.presenter, etc.)
  const data = {
    presenter: segment.presenter || "",
    leader: segment.presenter || "",
    preacher: segment.presenter || "",
    message_title: segment.message_title || "",
    title: segment.message_title || "",
    verse: segment.scripture_references || "",
    scripture_references: segment.scripture_references || "",
    parsed_verse_data: segment.parsed_verse_data || null,
    translator: segment.translator_name || "",
    submitted_content: segment.submitted_content || "",
    description_details: segment.description_details || "",
    presentation_url: segment.presentation_url || "",
    content_is_slides_only: !!segment.content_is_slides_only,
    coordinator_notes: segment.coordinator_notes || "",
    projection_notes: segment.projection_notes || "",
    sound_notes: segment.sound_notes || "",
    ushers_notes: segment.ushers_notes || "",
    translation_notes: segment.translation_notes || "",
    stage_decor_notes: segment.stage_decor_notes || "",
    actions: segment.segment_actions || [],
  };

  // Include songs array if present
  // Songs must be in BOTH data.songs (for PDF/entity path) AND root (for UI ServiceTimeSlotColumn)
  if (songs.length > 0) {
    data.songs = songs;
  }

  // Clean null/undefined values
  Object.keys(data).forEach((key) => {
    if (data[key] === null || data[key] === undefined) delete data[key];
  });

  // Build sub_asignaciones from child segments
  const sub_asignaciones =
    childSegments.length > 0
      ? childSegments.map((child) => ({
          title: child.title,
          label: child.title,
          presenter: child.presenter || "",
          duration: child.duration_min || 5,
          person_field_name: "ministry_leader",
          duration_min: child.duration_min || 5,
        }))
      : undefined;

  // Entity Lift: Read ui_fields and ui_sub_assignments from entity first.
  // Fall back to blueprint matching ONLY for pre-migration segments that
  // don't have these fields stored yet.
  let fields = segment.ui_fields;
  let sub_assignments = segment.ui_sub_assignments;

  if (!fields || fields.length === 0) {
    // Legacy fallback: blueprint matching (will be removed after all data is re-saved)
    const blueprintSeg = findMatchingBlueprintSegment(
      segType,
      blueprintSlotSegments,
      idx
    );
    fields = blueprintSeg?.fields || [];
    sub_assignments = sub_assignments || blueprintSeg?.sub_assignments || [];
  }
  if (!sub_assignments) sub_assignments = [];

  return {
    title: segment.title || "",
    type: segType,
    duration: segment.duration_min || 0,
    fields,
    data,
    actions: segment.segment_actions || [],
    sub_assignments,
    sub_asignaciones,
    requires_translation: !!segment.requires_translation,
    default_translator_source: segment.default_translator_source || "manual",
    // Root-level duplicates (some code reads from root instead of data):
    message_title: segment.message_title || "",
    submitted_content: segment.submitted_content || "",
    parsed_verse_data: segment.parsed_verse_data || null,
    scripture_references: segment.scripture_references || "",
    presentation_url: segment.presentation_url || "",
    notes_url: segment.notes_url || "",
    content_is_slides_only: !!segment.content_is_slides_only,
    submission_status: segment.submission_status || null,
    projection_notes: segment.projection_notes || "",
    // Entity metadata (prefixed with _ to avoid persisting back)
    _entityId: segment.id,
    _sessionId: segment.session_id,
  };
}

/**
 * Find the matching blueprint segment by type and position.
 * Uses the same normalization logic as WeeklyServiceManager's mergeSegmentsWithBlueprint.
 */
function findMatchingBlueprintSegment(segType, blueprintSlotSegments, idx) {
  if (!blueprintSlotSegments) return null;

  const normalizeType = (t) => {
    if (!t) return "";
    const lower = t.toLowerCase();
    if (lower === "alabanza" || lower === "worship") return "worship";
    if (lower === "bienvenida" || lower === "welcome") return "welcome";
    if (lower === "ofrenda" || lower === "ofrendas" || lower === "offering")
      return "offering";
    if (
      lower === "plenaria" ||
      lower === "predica" ||
      lower === "mensaje" ||
      lower === "message"
    )
      return "message";
    return lower;
  };

  const targetType = normalizeType(segType);

  // Try position match first
  const positional = blueprintSlotSegments[idx];
  if (positional && normalizeType(positional.type) === targetType) {
    return positional;
  }

  // Fall back to type match
  return blueprintSlotSegments.find(
    (b) => normalizeType(b.type) === targetType
  );
}