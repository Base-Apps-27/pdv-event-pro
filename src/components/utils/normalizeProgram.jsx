/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  normalizeProgram.js — CANONICAL NORMALIZATION ADAPTER                 ║
 * ║                                                                        ║
 * ║  MASTER TRANSLATION LAYER for all segment data in the application.     ║
 * ║                                                                        ║
 * ║  STATUS: Active on PublicCountdownDisplay (TV).                        ║
 * ║  NEXT:   Wire into ServiceProgramView + EventProgramView (Phase 2).   ║
 * ║                                                                        ║
 * ║  CONSTITUTION: Read-only transform. Never writes to database.          ║
 * ║  SAFETY:      No schema changes. No field deletions. Additive only.   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The application has THREE distinct segment data shapes produced by THREE
 * different authoring surfaces. Every UI consumer was independently parsing
 * these shapes, leading to divergence bugs (missing actions on TV, wrong
 * timing on StickyOps, etc.).
 *
 * This adapter is the SINGLE SOURCE OF TRUTH for translating raw backend
 * data into a canonical shape that all consumers can rely on.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE THREE SOURCE FORMATS (NEVER DELETE THIS SECTION)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SOURCE 1: EVENT SEGMENTS (Segment entity)                              │
 * │                                                                        │
 * │ Authoring: EventDetail → SessionManager → SegmentForm                 │
 * │ Storage:   Segment entity (flat fields at root)                       │
 * │ Actions:   SegmentAction entity (linked by segment_id)                │
 * │            + segment_actions[] embedded array (merged by backend)      │
 * │                                                                        │
 * │ Key fields at ROOT:                                                    │
 * │   segment_type, title, presenter, duration_min, start_time, end_time  │
 * │   message_title, scripture_references, parsed_verse_data              │
 * │   projection_notes, sound_notes, ushers_notes, translation_notes      │
 * │   stage_decor_notes, other_notes, prep_instructions                   │
 * │   microphone_assignments, coordinator_notes (via notes field)         │
 * │   requires_translation, translator_name, translation_mode             │
 * │   panel_moderators, panel_panelists, major_break                      │
 * │   room_id, breakout_rooms, slide_pack_id, countdown_asset_id          │
 * │   song_1_title..song_6_title, song_1_lead..song_6_lead               │
 * │   song_1_key..song_6_key                                              │
 * │   has_video, video_name, video_url, video_location, video_owner       │
 * │   video_length_sec                                                     │
 * │   art_types, drama_*, dance_*, arts_run_of_show_url                   │
 * │   presentation_url, notes_url, content_is_slides_only                 │
 * │   actual_start_time, actual_end_time, is_live_adjusted                │
 * │   submitted_content, submission_status                                 │
 * │   announcement_title, announcement_description, announcement_date     │
 * │   announcement_tone, announcement_series_id                            │
 * │                                                                        │
 * │ Actions shape (segment_actions[]):                                     │
 * │   { label, department, timing, offset_min, absolute_time,             │
 * │     is_prep, is_required, notes }                                      │
 * │   timing enum: before_start | after_start | before_end | absolute     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SOURCE 2: WEEKLY SERVICE SEGMENTS (Service entity, embedded JSON)      │
 * │                                                                        │
 * │ Authoring: WeeklyServiceManager                                        │
 * │ Storage:   Service entity → "9:30am"[] and "11:30am"[] arrays         │
 * │                                                                        │
 * │ Structure per segment:                                                 │
 * │   {                                                                    │
 * │     type: "worship"|"welcome"|"offering"|"message"|"special"|"break"  │
 * │     title: string,                                                     │
 * │     duration: number,              // NOTE: "duration" not "duration_min" │
 * │     fields: string[],              // UI field declarations            │
 * │     data: {                        // ALL content lives here           │
 * │       leader: string,              // Worship leader                   │
 * │       preacher: string,            // Message speaker                  │
 * │       presenter: string,           // Generic presenter                │
 * │       translator: string,          // Translator name                  │
 * │       messageTitle: string,        // NOTE: camelCase not snake_case   │
 * │       verse: string,               // NOTE: "verse" not "scripture_references" │
 * │       coordinator_notes: string,                                       │
 * │       projection_notes: string,                                        │
 * │       sound_notes: string,                                             │
 * │       ushers_notes: string,                                            │
 * │       translation_notes: string,                                       │
 * │       stage_decor_notes: string,                                       │
 * │       other_notes: string,                                             │
 * │       microphone_assignments: string,                                  │
 * │       parsed_verse_data: object,                                       │
 * │       presentation_url: string,                                        │
 * │       notes_url: string,                                               │
 * │       content_is_slides_only: boolean,                                 │
 * │     },                                                                 │
 * │     songs: [{title, lead, key}],   // NOTE: at root, NOT in data      │
 * │     actions: [{                     // NOTE: at root, NOT in data      │
 * │       label, department, timing, offset_min, absolute_time, notes      │
 * │     }],                                                                │
 * │     sub_assignments: [{             // Sub-roles within segment         │
 * │       label, person_field_name, duration_min                           │
 * │     }],                                                                │
 * │     requires_translation: boolean,  // At root                         │
 * │     default_translator_source: string,                                │
 * │     submitted_content: string,                                         │
 * │     parsed_verse_data: object,                                         │
 * │     submission_status: string,                                         │
 * │     presentation_url: string,                                          │
 * │     notes_url: string,                                                 │
 * │     content_is_slides_only: boolean,                                   │
 * │   }                                                                    │
 * │                                                                        │
 * │ CRITICAL DIFFERENCES FROM EVENTS:                                      │
 * │   - "duration" vs "duration_min"                                       │
 * │   - "type" vs "segment_type"                                           │
 * │   - "data.messageTitle" vs "message_title"                             │
 * │   - "data.verse" vs "scripture_references"                             │
 * │   - "data.translator" vs "translator_name"                             │
 * │   - songs[] at root vs song_N_title flat fields                       │
 * │   - actions[] at root vs segment_actions[] / SegmentAction entity     │
 * │   - start_time/end_time ABSENT (calculated by PublicProgramView)      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SOURCE 3: CUSTOM SERVICE SEGMENTS (Service entity, segments array)     │
 * │                                                                        │
 * │ Authoring: CustomServiceBuilder                                        │
 * │ Storage:   Service entity → "segments"[] array                        │
 * │            ALSO synced to real Segment entities via syncToSession      │
 * │                                                                        │
 * │ Structure: HYBRID — dual-writes to both root AND data sub-object      │
 * │   {                                                                    │
 * │     type: string,                  // Same as weekly service types     │
 * │     title: string,                                                     │
 * │     duration: number,              // At root                          │
 * │     start_time: string,            // PRESENT (unlike weekly)          │
 * │     end_time: string,              // PRESENT (unlike weekly)          │
 * │     data: { ...same as weekly... },                                   │
 * │     songs: [],                     // At root                          │
 * │     actions: [],                   // At root                          │
 * │     sub_assignments: [],           // At root                          │
 * │     // ALSO has root copies:                                           │
 * │     presenter: string,             // Dual-written                      │
 * │     leader: string,                // Dual-written                      │
 * │     preacher: string,              // Dual-written                      │
 * │   }                                                                    │
 * │                                                                        │
 * │ CRITICAL DIFFERENCE FROM WEEKLY:                                       │
 * │   - Has start_time/end_time (weekly does not)                         │
 * │   - Dual-writes people fields to root AND data                        │
 * │   - Gets synced to real Segment entities (can have Segment.id)        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CANONICAL OUTPUT SHAPE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every consumer should expect THIS shape after normalization.
 * If you add a new field to any source, you MUST add it here too.
 *
 * {
 *   // ─── IDENTITY ───
 *   id: string,                    // Entity ID or generated
 *   title: string,                 // Segment block title
 *   segment_type: string,          // Canonical: "Alabanza", "Plenaria", etc.
 *   segment_type_raw: string,      // Original before normalization
 *
 *   // ─── TIMING ───
 *   start_time: string|null,       // "HH:MM" — may be null for weekly (pre-calculation)
 *   end_time: string|null,         // "HH:MM"
 *   duration_min: number,          // Duration in minutes (from "duration" or "duration_min")
 *   date: string|null,             // "YYYY-MM-DD" — from session/service
 *   session_id: string|null,       // Session reference (event) or synthetic slot ID (service)
 *
 *   // ─── PEOPLE ───
 *   presenter: string,             // Generic: who's on stage
 *   leader: string,                // Worship leader specifically
 *   preacher: string,              // Message speaker specifically
 *   translator: string,            // From data.translator OR translator_name
 *
 *   // ─── CONTENT ───
 *   message_title: string,         // From message_title OR data.messageTitle
 *   scripture_references: string,  // From scripture_references OR data.verse
 *   parsed_verse_data: object|null,
 *   presentation_url: string,
 *   notes_url: string,
 *   content_is_slides_only: boolean,
 *
 *   // ─── OPERATIONAL NOTES ───
 *   description: string,
 *   description_details: string,
 *   projection_notes: string,
 *   sound_notes: string,
 *   ushers_notes: string,
 *   translation_notes: string,
 *   stage_decor_notes: string,
 *   coordinator_notes: string,
 *   other_notes: string,
 *   prep_instructions: string,
 *   microphone_assignments: string,
 *
 *   // ─── TRANSLATION ───
 *   requires_translation: boolean,
 *
 *   // ─── SONGS ───
 *   songs: Array<{title: string, lead: string, key: string}>,
 *
 *   // ─── ACTIONS (UNIFIED) ───
 *   actions: Array<{
 *     label: string,
 *     department: string,           // "Admin"|"MC"|"Sound"|"Projection"|etc.
 *     timing: string,               // "before_start"|"after_start"|"before_end"|"absolute"
 *     offset_min: number,
 *     absolute_time: string|null,
 *     notes: string,
 *     order: number,
 *     is_prep: boolean,             // Computed: timing === 'before_start'
 *     id: string|null,
 *   }>,
 *
 *   // ─── PASSTHROUGH (preserved from source, not transformed) ───
 *   color_code: string,
 *   show_in_general: boolean,
 *   is_live_adjusted: boolean,
 *   actual_start_time: string|null,
 *   actual_end_time: string|null,
 *   breakout_rooms: array|null,
 *   panel_moderators: string,
 *   panel_panelists: string,
 *   major_break: boolean,
 *   room_id: string|null,
 *   sub_assignments: array,
 *   art_types: array|null,
 *   has_video: boolean,
 *   video_name: string,
 *   video_url: string,
 *   video_location: string,
 *   video_owner: string,
 *   video_length_sec: number|null,
 *   slide_pack_id: string|null,
 *   countdown_asset_id: string|null,
 *   announcement_title: string,
 *   announcement_description: string,
 *   announcement_date: string,
 *   announcement_tone: string,
 *   submitted_content: string,
 *   submission_status: string,
 *
 *   // ─── ARTS PASSTHROUGH ───
 *   drama_handheld_mics: number|null,
 *   drama_headset_mics: number|null,
 *   drama_start_cue: string,
 *   drama_end_cue: string,
 *   drama_has_song: boolean,
 *   drama_song_title: string,
 *   drama_song_source: string,
 *   drama_song_owner: string,
 *   drama_song_2_title: string,
 *   drama_song_2_url: string,
 *   drama_song_2_owner: string,
 *   drama_song_3_title: string,
 *   drama_song_3_url: string,
 *   drama_song_3_owner: string,
 *   dance_has_song: boolean,
 *   dance_song_title: string,
 *   dance_song_source: string,
 *   dance_song_owner: string,
 *   dance_song_2_title: string,
 *   dance_song_2_url: string,
 *   dance_song_2_owner: string,
 *   dance_song_3_title: string,
 *   dance_song_3_url: string,
 *   dance_song_3_owner: string,
 *   dance_handheld_mics: number|null,
 *   dance_headset_mics: number|null,
 *   dance_start_cue: string,
 *   dance_end_cue: string,
 *   art_other_description: string,
 *   arts_run_of_show_url: string,
 *
 *   // ─── SOURCE TRACKING ───
 *   _source: 'event' | 'weekly_service' | 'custom_service',
 *   _raw: object,                  // Original segment (for debug/passthrough)
 * }
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CONSUMERS AND THEIR FIELD DEPENDENCIES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * These are the components that consume segment data. When adding a field
 * to the canonical shape, check each consumer and update if needed.
 *
 * ┌────────────────────────────────┬────────────────────────────────────────┐
 * │ CONSUMER                       │ KEY FIELDS USED                        │
 * ├────────────────────────────────┼────────────────────────────────────────┤
 * │ PublicCountdownDisplay (TV)    │ title, segment_type, presenter,        │
 * │ [USES ADAPTER ✓]              │ start_time, end_time, duration_min,    │
 * │                                │ actions[], is_live_adjusted,           │
 * │                                │ actual_start_time, actual_end_time,    │
 * │                                │ session_id, date                       │
 * ├────────────────────────────────┼────────────────────────────────────────┤
 * │ CountdownBlock (TV)            │ title, segment_type, presenter,        │
 * │                                │ start_time, end_time, duration_min,    │
 * │                                │ is_live_adjusted                       │
 * ├────────────────────────────────┼────────────────────────────────────────┤
 * │ CoordinatorActionsDisplay (TV) │ start_time, duration_min, title,       │
 * │                                │ segment_actions[] OR actions[],        │
 * │                                │ action.timing, action.offset_min,      │
 * │                                │ action.label, action.department,       │
 * │                                │ action.notes                           │
 * ├────────────────────────────────┼────────────────────────────────────────┤
 * │ LiveStatusCard                 │ start_time, end_time, title,           │
 * │                                │ data.title, type, segment_type,        │
 * │                                │ data.leader/preacher/presenter,        │
 * │                                │ presentation_url, notes_url,           │
 * │                                │ content_is_slides_only,                │
 * │                                │ message_title, is_live_adjusted,       │
 * │                                │ date (via getSegmentData accessor)     │
 * ├────────────────────────────────┼────────────────────────────────────────┤
 * │ StickyOpsDeck (Events)         │ start_time, end_time, duration_min,    │
 * │                                │ title, segment_actions[] OR actions[], │
 * │                                │ action.timing/offset_min/label/dept,   │
 * │                                │ date, session_id                       │
 * ├────────────────────────────────┼────────────────────────────────────────┤
 * │ StickyOpsDeckService           │ Same as StickyOpsDeck but also:        │
 * │                                │ type (for break detection),            │
 * │                                │ Permissive action parsing              │
 * ├────────────────────────────────┼────────────────────────────────────────┤
 * │ PublicProgramSegment           │ READS VIA getSegmentData() accessor:   │
 * │ [NOT YET ON ADAPTER]           │ title, type/segment_type, start_time,  │
 * │                                │ end_time, duration_min, presenter,     │
 * │                                │ leader, preacher, translator(_name),   │
 * │                                │ message_title/data.messageTitle,       │
 * │                                │ scripture_references/data.verse,       │
 * │                                │ parsed_verse_data, presentation_url,   │
 * │                                │ notes_url, content_is_slides_only,     │
 * │                                │ description_details, coordinator_notes,│
 * │                                │ projection_notes, sound_notes,         │
 * │                                │ ushers_notes, translation_notes,       │
 * │                                │ stage_decor_notes, other_notes,        │
 * │                                │ prep_instructions,                     │
 * │                                │ microphone_assignments,                │
 * │                                │ panel_moderators, panel_panelists,     │
 * │                                │ major_break, room_id,                  │
 * │                                │ sub_assignments[], songs[] (via        │
 * │                                │ getNormalizedSongs),                   │
 * │                                │ segment_actions/actions[],             │
 * │                                │ has_video, video_*, art_types,         │
 * │                                │ drama_*, dance_*, arts_*,              │
 * │                                │ announcement_*, slide_pack_id,         │
 * │                                │ countdown_asset_id,                    │
 * │                                │ requires_translation,                  │
 * │                                │ translation_mode, translator_name      │
 * ├────────────────────────────────┼────────────────────────────────────────┤
 * │ ServiceProgramView             │ Passes segments to PublicProgramSegment│
 * │ [NOT YET ON ADAPTER]           │ Also: inline time adjustment logic     │
 * │                                │ reads liveAdjustments, session_id      │
 * ├────────────────────────────────┼────────────────────────────────────────┤
 * │ EventProgramView               │ Passes segments to PublicProgramSegment│
 * │ [NOT YET ON ADAPTER]           │ Also: breakout_rooms rendering,        │
 * │                                │ segment_actions[] for breakout display │
 * └────────────────────────────────┴────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EXISTING ACCESSORS (COMPATIBILITY LAYER)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * segmentDataUtils.js provides getSegmentData() and getNormalizedSongs().
 * PublicProgramSegment uses these exclusively to read segment fields.
 *
 * IMPORTANT: When Phase 2 wires the adapter into ServiceProgramView/
 * EventProgramView, the normalized segments will have ALL fields at root.
 * getSegmentData() will continue to work correctly because it checks
 * root first for structural fields and data first for content fields —
 * and normalized segments have both.
 *
 * getNormalizedSongs() will also work because normalized segments
 * have a root-level songs[] array.
 *
 * Therefore: Phase 2 requires NO changes to PublicProgramSegment.
 * The adapter's output is compatible with getSegmentData() as-is.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * HOW TO ADD A NEW FIELD (MANDATORY CHECKLIST)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. Add field to the relevant entity schema (Segment and/or Service)
 * 2. Add field to the appropriate authoring surface:
 *    - SegmentForm (events)
 *    - WeeklyServiceManager (weekly services)
 *    - CustomServiceBuilder (custom services)
 * 3. Add field to normalizeOneSegment() below (in the correct section)
 * 4. Add field to the CANONICAL OUTPUT SHAPE documentation above
 * 5. Add field to the CONSUMERS table above
 * 6. If the field is in Service.data sub-object, add it to getField()
 * 7. If the field needs display in PublicProgramSegment, add it there
 * 8. If the field needs display on TV, add to CountdownBlock/etc.
 * 9. Update the SOURCE FORMAT documentation if the storage pattern differs
 *
 * FAILURE TO FOLLOW THIS CHECKLIST WILL CAUSE DRIFT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IMPLEMENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─── TYPE NORMALIZATION MAP ───
// Maps all known type strings to canonical segment_type values.
// Source: WeeklyServiceManager uses lowercase English, Events use Spanish PascalCase.
const TYPE_MAP = {
  // Weekly service types (lowercase English)
  'worship': 'Alabanza',
  'welcome': 'Bienvenida',
  'offering': 'Ofrenda',
  'message': 'Plenaria',
  'special': 'Especial',
  'break': 'Receso',
  'generic': 'Especial',
  // Already canonical (from Event SegmentForm or backend)
  'alabanza': 'Alabanza',
  'bienvenida': 'Bienvenida',
  'ofrenda': 'Ofrenda',
  'plenaria': 'Plenaria',
  'video': 'Video',
  'anuncio': 'Anuncio',
  'dinámica': 'Dinámica',
  'receso': 'Receso',
  'techonly': 'TechOnly',
  'oración': 'Oración',
  'especial': 'Especial',
  'cierre': 'Cierre',
  'mc': 'MC',
  'ministración': 'Ministración',
  'almuerzo': 'Almuerzo',
  'artes': 'Artes',
  'breakout': 'Breakout',
  'panel': 'Panel',
};

function normalizeType(raw) {
  if (!raw) return 'Especial';
  const key = String(raw).toLowerCase().trim();
  return TYPE_MAP[key] || raw; // Preserve unknown types as-is (future-proof)
}

// ─── ACTION NORMALIZATION ───
// Ensures every action has guaranteed fields with permissive defaults.
// CRITICAL: The timing field MUST default to 'after_start' (not be dropped)
// because weekly service blueprints sometimes omit it during save.
function normalizeAction(action) {
  if (!action || typeof action !== 'object') return null;

  return {
    label: action.label || '',
    department: action.department || 'General',
    timing: action.timing || 'after_start',  // PERMISSIVE DEFAULT — never drop
    offset_min: action.offset_min || 0,
    absolute_time: action.absolute_time || null,
    notes: action.notes || '',
    order: action.order || 0,
    is_prep: (action.timing || 'after_start') === 'before_start',
    is_required: !!action.is_required,
    id: action.id || null,
  };
}

// ─── SONG NORMALIZATION ───
// Handles three formats:
//   1. songs[] at root (weekly/custom services)
//   2. data.songs[] (custom services dual-write)
//   3. song_N_title flat fields (event Segment entities)
function normalizeSongs(seg) {
  // 1. Root songs array (weekly services, custom services)
  if (seg.songs && Array.isArray(seg.songs) && seg.songs.length > 0) {
    return seg.songs.filter(s => s && (s.title || s.lead));
  }

  // 2. data.songs array (custom service dual-write)
  if (seg.data?.songs && Array.isArray(seg.data.songs) && seg.data.songs.length > 0) {
    return seg.data.songs.filter(s => s && (s.title || s.lead));
  }

  // 3. Flat fields (event Segment entities: song_1_title through song_6_title)
  const songs = [];
  for (let i = 1; i <= 6; i++) {
    const title = seg[`song_${i}_title`];
    const lead = seg[`song_${i}_lead`];
    const key = seg[`song_${i}_key`];
    if (title || lead) {
      songs.push({ title: title || '', lead: lead || '', key: key || '' });
    }
  }
  return songs;
}

// ─── FIELD ACCESSOR ───
// Safely gets a field checking both root and data sub-object.
// Priority: root > data > empty string
// This matches the behavior of getSegmentData() in segmentDataUtils.js
// for content fields (which checks data first for weekly services).
// For the adapter, we check root first because normalized output
// flattens everything to root level.
function getField(seg, field) {
  if (seg[field] !== undefined && seg[field] !== null && seg[field] !== '') return seg[field];
  if (seg.data && seg.data[field] !== undefined && seg.data[field] !== null && seg.data[field] !== '') return seg.data[field];
  return '';
}

// ─── SINGLE SEGMENT NORMALIZER ───
// This is the core translation function. It takes ANY segment shape
// and produces the canonical output documented above.
function normalizeOneSegment(seg, source, defaults = {}) {
  const rawType = seg.segment_type || seg.type || '';
  const canonicalType = normalizeType(rawType);

  // ── Actions: merge all possible sources ──
  // Events: segment_actions[] (embedded, merged by backend from SegmentAction entity)
  // Services: actions[] (at root, from blueprint editor)
  // Normalize + deduplicate
  const rawActions = [
    ...(seg.segment_actions || []),
    ...(seg.actions || []),
  ];
  const actions = rawActions
    .map(a => normalizeAction(a))
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Dedupe by label+timing+offset (backend sometimes merges embedded+linked)
  const seen = new Set();
  const dedupedActions = actions.filter(a => {
    const key = `${a.label}|${a.timing}|${a.offset_min}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    // ─── IDENTITY ───
    id: seg.id || defaults.id || `generated-${Math.random().toString(36).substr(2, 8)}`,
    title: getField(seg, 'title') || 'Untitled',
    segment_type: canonicalType,
    segment_type_raw: rawType,

    // ─── TIMING ───
    start_time: seg.start_time || null,
    end_time: seg.end_time || null,
    duration_min: seg.duration_min || seg.duration || 0, // "duration_min" (events) vs "duration" (services)
    date: seg.date || defaults.date || null,
    session_id: seg.session_id || defaults.session_id || null,

    // ─── PEOPLE ───
    // Events: presenter at root, no leader/preacher split
    // Services: data.leader, data.preacher, data.presenter, data.translator
    // Custom:  dual-write to root AND data
    presenter: getField(seg, 'presenter'),
    leader: getField(seg, 'leader'),
    preacher: getField(seg, 'preacher'),
    translator: getField(seg, 'translator') || getField(seg, 'translator_name'),

    // ─── CONTENT ───
    // "messageTitle" (camelCase, weekly) vs "message_title" (snake_case, events)
    message_title: getField(seg, 'message_title') || getField(seg, 'messageTitle'),
    // "verse" (weekly) vs "scripture_references" (events)
    scripture_references: getField(seg, 'scripture_references') || getField(seg, 'verse'),
    parsed_verse_data: seg.parsed_verse_data || seg.data?.parsed_verse_data || null,
    presentation_url: getField(seg, 'presentation_url'),
    notes_url: getField(seg, 'notes_url'),
    content_is_slides_only: !!(seg.content_is_slides_only || seg.data?.content_is_slides_only),

    // ─── OPERATIONAL NOTES ───
    description: getField(seg, 'description'),
    description_details: getField(seg, 'description_details'),
    projection_notes: getField(seg, 'projection_notes'),
    sound_notes: getField(seg, 'sound_notes'),
    ushers_notes: getField(seg, 'ushers_notes'),
    translation_notes: getField(seg, 'translation_notes'),
    stage_decor_notes: getField(seg, 'stage_decor_notes'),
    coordinator_notes: getField(seg, 'coordinator_notes'),
    other_notes: getField(seg, 'other_notes'),
    prep_instructions: getField(seg, 'prep_instructions'),
    microphone_assignments: getField(seg, 'microphone_assignments'),

    // ─── TRANSLATION ───
    requires_translation: !!(seg.requires_translation || seg.data?.requires_translation),
    translation_mode: getField(seg, 'translation_mode'),

    // ─── SONGS (unified array) ───
    songs: normalizeSongs(seg),

    // ─── ACTIONS (unified, deduped, sorted) ───
    actions: dedupedActions,

    // ─── PASSTHROUGH: Visual/Display ───
    color_code: seg.color_code || 'default',
    show_in_general: seg.show_in_general !== false,
    is_live_adjusted: !!seg.is_live_adjusted,
    actual_start_time: seg.actual_start_time || null,
    actual_end_time: seg.actual_end_time || null,

    // ─── PASSTHROUGH: Structural ───
    breakout_rooms: seg.breakout_rooms || null,
    panel_moderators: getField(seg, 'panel_moderators'),
    panel_panelists: getField(seg, 'panel_panelists'),
    major_break: !!seg.major_break,
    room_id: seg.room_id || null,
    sub_assignments: seg.sub_assignments || [],
    slide_pack_id: seg.slide_pack_id || null,
    countdown_asset_id: seg.countdown_asset_id || null,

    // ─── PASSTHROUGH: Video ───
    has_video: !!seg.has_video,
    video_name: getField(seg, 'video_name'),
    video_url: getField(seg, 'video_url'),
    video_location: getField(seg, 'video_location'),
    video_owner: getField(seg, 'video_owner'),
    video_length_sec: seg.video_length_sec || null,

    // ─── PASSTHROUGH: Arts (Drama/Dance) ───
    art_types: seg.art_types || null,
    drama_handheld_mics: seg.drama_handheld_mics || null,
    drama_headset_mics: seg.drama_headset_mics || null,
    drama_start_cue: getField(seg, 'drama_start_cue'),
    drama_end_cue: getField(seg, 'drama_end_cue'),
    drama_has_song: !!seg.drama_has_song,
    drama_song_title: getField(seg, 'drama_song_title'),
    drama_song_source: getField(seg, 'drama_song_source'),
    drama_song_owner: getField(seg, 'drama_song_owner'),
    drama_song_2_title: getField(seg, 'drama_song_2_title'),
    drama_song_2_url: getField(seg, 'drama_song_2_url'),
    drama_song_2_owner: getField(seg, 'drama_song_2_owner'),
    drama_song_3_title: getField(seg, 'drama_song_3_title'),
    drama_song_3_url: getField(seg, 'drama_song_3_url'),
    drama_song_3_owner: getField(seg, 'drama_song_3_owner'),
    dance_has_song: !!seg.dance_has_song,
    dance_song_title: getField(seg, 'dance_song_title'),
    dance_song_source: getField(seg, 'dance_song_source'),
    dance_song_owner: getField(seg, 'dance_song_owner'),
    dance_song_2_title: getField(seg, 'dance_song_2_title'),
    dance_song_2_url: getField(seg, 'dance_song_2_url'),
    dance_song_2_owner: getField(seg, 'dance_song_2_owner'),
    dance_song_3_title: getField(seg, 'dance_song_3_title'),
    dance_song_3_url: getField(seg, 'dance_song_3_url'),
    dance_song_3_owner: getField(seg, 'dance_song_3_owner'),
    dance_handheld_mics: seg.dance_handheld_mics || null,
    dance_headset_mics: seg.dance_headset_mics || null,
    dance_start_cue: getField(seg, 'dance_start_cue'),
    dance_end_cue: getField(seg, 'dance_end_cue'),
    art_other_description: getField(seg, 'art_other_description'),
    arts_run_of_show_url: getField(seg, 'arts_run_of_show_url'),

    // ─── PASSTHROUGH: Announcements ───
    announcement_title: getField(seg, 'announcement_title'),
    announcement_description: getField(seg, 'announcement_description'),
    announcement_date: getField(seg, 'announcement_date'),
    announcement_tone: getField(seg, 'announcement_tone'),

    // ─── PASSTHROUGH: Submissions ───
    submitted_content: getField(seg, 'submitted_content'),
    submission_status: getField(seg, 'submission_status'),

    // ─── COMPATIBILITY: Preserve data sub-object for getSegmentData() ───
    // PublicProgramSegment reads via getSegmentData() which checks data first
    // for content fields. We preserve this so Phase 2 wiring is seamless.
    data: seg.data || {},

    // ─── COMPATIBILITY: Preserve type field for break detection ───
    // StickyOpsDeckService and LiveStatusCard filter on seg.type === 'break'
    type: seg.type || rawType,

    // ─── SOURCE TRACKING ───
    _source: source,
    _raw: seg,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize the flat segment list from getPublicProgramData backend response.
 * Works for Events, Weekly Services, and Custom Services.
 *
 * @param {Array} segments - Raw segments from backend
 * @param {string} source - 'event' | 'weekly_service' | 'custom_service'
 * @param {Object} options - { sessions: [], serviceDate: string }
 * @returns {Array} Normalized canonical segments
 */
export function normalizeSegments(segments, source = 'event', options = {}) {
  if (!segments || !Array.isArray(segments)) return [];

  const { sessions = [], serviceDate = null } = options;

  // Build session date lookup for events
  const sessionDateMap = new Map();
  sessions.forEach(s => {
    if (s.id && s.date) sessionDateMap.set(s.id, s.date);
  });

  return segments.map(seg => {
    const defaults = {
      date: seg.date || sessionDateMap.get(seg.session_id) || serviceDate || null,
    };
    return normalizeOneSegment(seg, source, defaults);
  });
}

/**
 * Apply LiveTimeAdjustments to normalized segments.
 * Returns a NEW array — does not mutate inputs.
 *
 * Adjustment mapping:
 *   - Weekly services (JSON): session_id 'slot-9-30' → time_slot '9:30am'
 *   - Weekly services (JSON): session_id 'slot-11-30' → time_slot '11:30am'
 *   - Weekly services (JSON): session_id 'slot-break' → follows 9:30am offset
 *   - Weekly services (entity): session_id is real UUID → resolve via sessions array
 *   - Custom services: adjustment_type 'global' applies to all
 *   - Events: not handled here (events use LiveDirectorPanel)
 *
 * @param {Array} segments - Normalized segments
 * @param {Array} liveAdjustments - LiveTimeAdjustment records
 * @param {Array} sessions - Session entities (for resolving real session IDs to names)
 * @returns {Array} Adjusted segments (new array)
 */
export function applyTimeAdjustments(segments, liveAdjustments = [], sessions = []) {
  if (!liveAdjustments || liveAdjustments.length === 0) return segments;

  // Build session name lookup for entity-sourced segments
  const sessionNameMap = new Map();
  if (sessions && sessions.length > 0) {
    sessions.forEach(s => { if (s.id && s.name) sessionNameMap.set(s.id, s.name); });
  }

  const addMinutes = (timeStr, minutes) => {
    if (!timeStr || !minutes) return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(2000, 0, 1, h, m + minutes, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return segments.map(seg => {
    let offsetMinutes = 0;

    // Resolve session name: entity-sourced segments have real UUIDs,
    // JSON-sourced segments have synthetic IDs like 'slot-9-30'
    const sessionName = sessionNameMap.get(seg.session_id) || null;

    if (sessionName) {
      // Entity-sourced: resolve via session name
      const adj = liveAdjustments.find(a => a.time_slot === sessionName);
      if (adj) offsetMinutes = adj.offset_minutes || 0;
    } else if (seg.session_id === 'slot-9-30') {
      const adj = liveAdjustments.find(a => a.time_slot === '9:30am');
      if (adj) offsetMinutes = adj.offset_minutes || 0;
    } else if (seg.session_id === 'slot-11-30') {
      const adj = liveAdjustments.find(a => a.time_slot === '11:30am');
      if (adj) offsetMinutes = adj.offset_minutes || 0;
    } else if (seg.session_id === 'slot-break') {
      // Break follows morning service adjustment
      const adj = liveAdjustments.find(a => a.time_slot === '9:30am');
      if (adj) offsetMinutes = adj.offset_minutes || 0;
    } else {
      // Custom service or event: check for global adjustment
      const globalAdj = liveAdjustments.find(a => a.adjustment_type === 'global');
      if (globalAdj) offsetMinutes = globalAdj.offset_minutes || 0;
    }

    if (offsetMinutes === 0) return seg;

    return {
      ...seg,
      start_time: addMinutes(seg.start_time, offsetMinutes),
      end_time: addMinutes(seg.end_time, offsetMinutes),
      _time_adjusted: true,
      _time_offset: offsetMinutes,
    };
  });
}

/**
 * Detect the source type from backend program data.
 *
 * @param {Object} programData - Response from getPublicProgramData
 * @returns {'event' | 'weekly_service' | 'custom_service'}
 */
export function detectSourceType(programData) {
  if (!programData?.program) return 'event';
  const program = programData.program;
  if (program._isEvent) return 'event';
  if (program.segments && program.segments.length > 0) return 'custom_service';
  if (program['9:30am'] || program['11:30am']) return 'weekly_service';
  // Entity-sourced weekly: sessions have names like "9:30am" / "11:30am"
  if (programData.sessions && programData.sessions.some(s =>
    s.name === '9:30am' || s.name === '11:30am'
  )) return 'weekly_service';
  return 'custom_service'; // Fallback
}

/**
 * Full normalization pipeline.
 * Single entry point: detect source → normalize segments → apply adjustments.
 *
 * @param {Object} programData - Raw response from getPublicProgramData
 * @returns {{
 *   segments: Array,          // Normalized + time-adjusted segments
 *   source: string,           // 'event' | 'weekly_service' | 'custom_service'
 *   sessions: Array,          // Raw sessions passthrough
 *   program: Object,          // Raw program passthrough
 *   rooms: Array,             // Raw rooms passthrough
 *   preSessionDetails: Array, // Raw preSessionDetails passthrough
 *   liveAdjustments: Array,   // Raw liveAdjustments passthrough
 *   _raw: Object,             // Full raw response (for components not yet on adapter)
 * }}
 */
export function normalizeProgramData(programData) {
  if (!programData) return { segments: [], source: 'event', sessions: [], program: null };

  const source = detectSourceType(programData);
  const sessions = programData.sessions || [];
  const serviceDate = programData.program?.date || null;
  const liveAdjustments = programData.liveAdjustments || [];

  // Step 1: Normalize raw segments into canonical shape
  const normalized = normalizeSegments(
    programData.segments || [],
    source,
    { sessions, serviceDate }
  );

  // Step 2: Apply live time adjustments (pass sessions for entity ID resolution)
  const adjusted = applyTimeAdjustments(normalized, liveAdjustments, sessions);

  return {
    segments: adjusted,
    source,
    sessions,
    program: programData.program,
    rooms: programData.rooms || [],
    preSessionDetails: programData.preSessionDetails || [],
    liveAdjustments,
    _raw: programData,
  };
}