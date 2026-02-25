/**
 * weeklySessionSync.jsx
 * READ path for weekly service entity data.
 *
 * Entity Separation (2026-02-23): The WRITE path (syncWeeklyToSessions) has been
 * removed. Writes now go through useSegmentMutation.jsx which writes directly to
 * individual Session/Segment/PreSessionDetails entities per-field.
 *
 * READ: loadWeeklyFromSessions() — loads Session + Segment entities and transforms
 *       back to the weekly JSON format that the UI expects for initialization.
 *       Once the UI reads Session/Segment entities directly, this function
 *       and segmentEntityToWeeklyJSON() become unnecessary.
 */

import { getNormalizedSongs } from "@/components/utils/segmentDataUtils";

// ═══════════════════════════════════════════════════════════════
// LOAD: Session + Segment entities → Weekly Service JSON format
// ═══════════════════════════════════════════════════════════════

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
    _sessionIds: {},
  };

  for (const session of sessions.sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  )) {
    const slotName = session.name; // "9:30am" or "11:30am"
    result._sessionIds[slotName] = session.id;

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
 * Convert a Segment entity + its children back to weekly JSON format.
 * The output shape must be identical to what WeeklyServiceManager expects
 * as an element of the serviceData["9:30am"] or serviceData["11:30am"] array.
 *
 * Entity Lift Phase: Now reads ui_fields and ui_sub_assignments from entity
 * instead of blueprint matching. Blueprint is used ONLY as fallback for
 * segments created before these fields were stored (pre-migration data).
 */
function segmentEntityToWeeklyJSON(segment, childSegments, blueprintSlotSegments, idx) {
  let songs = getNormalizedSongs(segment);
  const segType = segment.segment_type || "Especial";

  // SONG-SLOT FIX: Worship segments must always have song slots for the UI.
  const isWorship = segType === "Alabanza" || segType === "worship";
  if (isWorship && songs.length === 0) {
    const numSongs = segment.number_of_songs || 4;
    songs = Array.from({ length: numSongs }, () => ({ title: "", lead: "", key: "" }));
  }

  // Build data object with values in all possible field locations
  const data = {
    presenter: segment.presenter || "",
    preacher: segment.preacher || "",
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

  // Songs must be in BOTH data.songs (for PDF) AND root (for UI SongInputRow)
  if (songs.length > 0) {
    data.songs = songs;
  }

  // Clean null/undefined values
  Object.keys(data).forEach((key) => {
    if (data[key] === null || data[key] === undefined) delete data[key];
  });

  const rootSongs = songs.length > 0 ? songs : undefined;

  // Build sub_asignaciones from child segments and inject presenter data
  // back into the parent's data object so the UI inputs can display it.
  let sub_asignaciones;
  if (childSegments.length > 0) {
    const subConfig = segment.ui_sub_assignments || [];
    sub_asignaciones = childSegments.map((child, ci) => {
      const fieldName = subConfig[ci]?.person_field_name || "ministry_leader";
      if (child.presenter) {
        data[fieldName] = child.presenter;
      }
      return {
        title: child.title,
        label: child.title,
        presenter: child.presenter || "",
        duration: child.duration_min || 5,
        person_field_name: fieldName,
        duration_min: child.duration_min || 5,
      };
    });
  }

  // Entity Lift: Read ui_fields and ui_sub_assignments from entity first.
  // Fall back to blueprint matching ONLY for pre-migration segments.
  let fields = segment.ui_fields;
  let sub_assignments = segment.ui_sub_assignments;

  if (!fields || fields.length === 0) {
    const blueprintSeg = findMatchingBlueprintSegment(
      segType,
      blueprintSlotSegments,
      idx
    );
    fields = blueprintSeg?.fields || [];
    sub_assignments = sub_assignments || blueprintSeg?.sub_assignments || [];
  }
  if (!sub_assignments) sub_assignments = [];

  // If child entities exist but sub_assignments config is empty (pre-migration data),
  // derive the config from child entities so the UI renders the input rows.
  if (sub_assignments.length === 0 && sub_asignaciones && sub_asignaciones.length > 0) {
    sub_assignments = sub_asignaciones.map(sa => ({
      label: sa.label || sa.title,
      person_field_name: sa.person_field_name || "ministry_leader",
      duration_min: sa.duration_min || sa.duration || 5,
    }));
  }

  return {
    title: segment.title || "",
    type: segType,
    duration: segment.duration_min || 0,
    fields,
    data,
    songs: rootSongs,
    number_of_songs: segment.number_of_songs || (rootSongs ? rootSongs.length : undefined),
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