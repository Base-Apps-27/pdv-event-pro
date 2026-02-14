/**
 * stripEventContent.js — Template Sanitization Layer
 * 
 * Decision: "Templates must strip event-specific content, preserving only structure."
 * 
 * When saving an event as a template, all person names, dates, scripture references,
 * song details, video links, submission content, and other instance-specific data
 * must be cleared. Only the structural skeleton remains: segment types, durations,
 * order, visibility toggles, department note *structure* (not content), and actions.
 * 
 * Placeholder "[TBD]" is used for key fields so templates are visually obvious.
 */

const TBD = "[TBD]";

// ── Event-level fields to clear ──
// Structural fields KEPT: name (overridden by user), year, status, print_color, origin
// Content fields CLEARED:
const EVENT_CLEAR = [
  'theme', 'location', 'start_date', 'end_date', 'description', 'slug',
  'promote_in_announcements', 'promotion_start_date', 'promotion_end_date',
  'announcement_blurb', 'announcement_has_video', 'promotion_targets',
];

export function stripEvent(eventData) {
  const stripped = { ...eventData };
  EVENT_CLEAR.forEach(field => {
    stripped[field] = (field === 'promote_in_announcements' || field === 'announcement_has_video')
      ? false
      : (field === 'promotion_targets' ? [] : '');
  });
  return stripped;
}

// ── Session-level fields to clear ──
// Structural KEPT: name, order, session_color, planned_start_time, planned_end_time,
//   default_stage_call_offset_min, is_translated_session, has_livestream
// Content CLEARED: all team names, presenter, date, location, notes, live director fields
const SESSION_CONTENT_FIELDS = [
  'date', 'location', 'notes', 'presenter',
  'admin_team', 'coordinators', 'sound_team', 'lights_team', 'video_team',
  'tech_team', 'ushers_team', 'translation_team', 'hospitality_team',
  'photography_team', 'worship_leader',
  // Live director fields (instance-specific, never part of template)
  'live_adjustment_enabled', 'last_live_adjustment_time',
  'live_director_user_id', 'live_director_user_name', 'live_director_started_at',
];

export function stripSession(sessionData) {
  const stripped = { ...sessionData };
  SESSION_CONTENT_FIELDS.forEach(field => {
    if (typeof stripped[field] === 'boolean') {
      stripped[field] = false;
    } else {
      stripped[field] = '';
    }
  });
  return stripped;
}

// ── PreSessionDetails fields to clear ──
// Structural KEPT: (linked to session)
// Content CLEARED: times, notes, asset references
const PSD_CONTENT_FIELDS = [
  'registration_desk_open_time', 'library_open_time',
  'facility_notes', 'general_notes',
  'music_profile_id', 'slide_pack_id',
];

export function stripPreSessionDetails(psdData) {
  const stripped = { ...psdData };
  PSD_CONTENT_FIELDS.forEach(field => { stripped[field] = ''; });
  return stripped;
}

// ── HospitalityTask: skip entirely for templates ──
// Hospitality tasks are fully instance-specific (food orders, setup tasks).
// Templates should not carry them.
export function shouldCopyHospitalityTasks() {
  return false;
}

// ── Segment-level fields ──
// Structural KEPT: segment_type, title, duration_min, order, color_code,
//   show_in_general, show_in_projection, show_in_sound, show_in_ushers,
//   show_in_livestream, requires_translation, translation_mode,
//   number_of_songs, stage_call_offset_min, major_break,
//   art_types (structural, describes what *kind* of arts), breakout_rooms structure
// Content CLEARED: all person names, scriptures, songs, videos, submissions, notes, URLs
const SEGMENT_CLEAR_FIELDS = [
  // Person assignments
  'presenter', 'translator_name', 'panel_moderators', 'panel_panelists',
  // Message / scripture content
  'message_title', 'scripture_references', 'parsed_verse_data',
  'submitted_content', 'submission_status',
  // Presentation / media
  'presentation_url', 'notes_url', 'content_is_slides_only',
  // Video
  'has_video', 'video_name', 'video_location', 'video_owner',
  'video_length_sec', 'video_url', 'video_url_meta',
  // Department notes (instance-specific instructions)
  'projection_notes', 'sound_notes', 'ushers_notes', 'translation_notes',
  'livestream_notes', 'stage_decor_notes', 'microphone_assignments', 'other_notes',
  'description_details', 'prep_instructions',
  // Songs (individual song fields)
  'song_1_title', 'song_1_lead', 'song_1_key',
  'song_2_title', 'song_2_lead', 'song_2_key',
  'song_3_title', 'song_3_lead', 'song_3_key',
  'song_4_title', 'song_4_lead', 'song_4_key',
  'song_5_title', 'song_5_lead', 'song_5_key',
  'song_6_title', 'song_6_lead', 'song_6_key',
  // Arts detail fields (person-specific, instance content)
  'drama_handheld_mics', 'drama_headset_mics',
  'drama_start_cue', 'drama_end_cue',
  'drama_has_song', 'drama_song_title', 'drama_song_source', 'drama_song_owner',
  'drama_song_1_url_meta',
  'drama_song_2_title', 'drama_song_2_url', 'drama_song_2_owner', 'drama_song_2_url_meta',
  'drama_song_3_title', 'drama_song_3_url', 'drama_song_3_owner', 'drama_song_3_url_meta',
  'dance_has_song', 'dance_song_title', 'dance_song_source', 'dance_song_owner',
  'dance_song_1_url_meta',
  'dance_song_2_title', 'dance_song_2_url', 'dance_song_2_owner', 'dance_song_2_url_meta',
  'dance_song_3_title', 'dance_song_3_url', 'dance_song_3_owner', 'dance_song_3_url_meta',
  'dance_handheld_mics', 'dance_headset_mics',
  'dance_start_cue', 'dance_end_cue',
  'art_other_description', 'arts_run_of_show_url', 'arts_run_of_show_url_meta',
  // Announcement (instance-specific)
  'announcement_title', 'announcement_description', 'announcement_date',
  'announcement_tone', 'announcement_series_id',
  // Live timing (instance-specific)
  'actual_start_time', 'actual_end_time', 'is_live_adjusted', 'timing_source',
  'live_status', 'live_hold_status', 'live_hold_placed_at', 'live_hold_placed_by',
  // Slide/countdown/music refs (instance-specific asset links)
  'slide_pack_id', 'countdown_asset_id', 'music_profile_id',
];

// Fields that should get the TBD placeholder instead of blank
const SEGMENT_TBD_FIELDS = ['presenter'];

export function stripSegment(segmentData) {
  const stripped = { ...segmentData };

  SEGMENT_CLEAR_FIELDS.forEach(field => {
    if (stripped[field] === undefined) return; // Don't add fields that weren't there
    if (typeof stripped[field] === 'boolean') {
      stripped[field] = false;
    } else if (typeof stripped[field] === 'number') {
      stripped[field] = 0;
    } else if (typeof stripped[field] === 'object' && stripped[field] !== null) {
      stripped[field] = null;
    } else {
      stripped[field] = '';
    }
  });

  // Apply TBD placeholders for key visible fields
  SEGMENT_TBD_FIELDS.forEach(field => {
    stripped[field] = TBD;
  });

  // Clear breakout room person assignments but keep the room structure
  if (Array.isArray(stripped.breakout_rooms)) {
    stripped.breakout_rooms = stripped.breakout_rooms.map(br => ({
      room_id: br.room_id || '',
      topic: br.topic || '',
      general_notes: '',
      other_notes: '',
      hosts: TBD,
      speakers: TBD,
      requires_translation: br.requires_translation || false,
      translation_mode: br.translation_mode || 'InPerson',
      translator_name: '',
    }));
  }

  // Clear segment_actions person-specific content but keep structure
  if (Array.isArray(stripped.segment_actions)) {
    stripped.segment_actions = stripped.segment_actions.map(action => ({
      label: action.label || '',
      department: action.department || 'Other',
      timing: action.timing || 'before_start',
      offset_min: action.offset_min || 0,
      absolute_time: '',
      is_prep: action.is_prep ?? true,
      is_required: action.is_required ?? false,
      notes: '', // Clear instance-specific notes
    }));
  }

  // Submission status always resets
  stripped.submission_status = 'ignored';

  return stripped;
}

// ── SegmentAction (standalone entity) ──
// Structural KEPT: order, label, department, time_hint structure
// Content CLEARED: details text, color_hint
export function stripSegmentAction(actionData) {
  const stripped = { ...actionData };
  stripped.details = '';
  stripped.color_hint = '';
  // Keep: order, label, department, time_hint (these define the action template)
  return stripped;
}

// ── StreamBlock (livestream timeline blocks) ──
// Structural KEPT: block_type, anchor_point, offset_min, order, duration_min, color_code, title
// Content CLEARED: presenter, description, stream_notes, absolute_time,
//   stream_actions notes, orphaned state, last_known_start
// NOTE: anchor_segment_id is remapped separately during duplication (not here)
const STREAMBLOCK_CLEAR_FIELDS = [
  'presenter', 'description', 'stream_notes',
  'absolute_time', 'last_known_start',
];

export function stripStreamBlock(blockData) {
  const stripped = { ...blockData };
  STREAMBLOCK_CLEAR_FIELDS.forEach(field => {
    stripped[field] = '';
  });
  stripped.orphaned = false;
  // Keep stream_actions structure but clear instance-specific notes
  if (Array.isArray(stripped.stream_actions)) {
    stripped.stream_actions = stripped.stream_actions.map(action => ({
      label: action.label || '',
      timing: action.timing || 'before_start',
      offset_min: action.offset_min || 0,
      absolute_time: '',
      notes: '',
      is_required: action.is_required ?? false,
    }));
  }
  return stripped;
}