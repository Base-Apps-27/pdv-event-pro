/**
 * normalizeProgram.js
 * 
 * CANONICAL NORMALIZATION ADAPTER
 * 
 * Converts both Event and Service backend responses into a unified segment format.
 * This is a READ-ONLY transform — it never writes back to the database.
 * 
 * WHY THIS EXISTS:
 * Events use Segment entities with flat fields (segment_type, presenter, segment_actions[]).
 * Weekly Services use embedded JSON arrays with nested data objects (type, data.leader, actions[]).
 * Custom Services dual-write to root + data sub-object.
 * Every UI consumer was independently translating these formats, causing divergence bugs.
 * 
 * CANONICAL OUTPUT SHAPE (per segment):
 * {
 *   id: string,
 *   title: string,
 *   segment_type: string,      // Normalized: "Alabanza", "Plenaria", "Bienvenida", etc.
 *   start_time: string|null,    // "HH:MM"
 *   end_time: string|null,      // "HH:MM"
 *   duration_min: number,
 *   date: string|null,          // "YYYY-MM-DD" (from session for events, from service for services)
 *   session_id: string|null,
 *   presenter: string,          // Unified: whoever is leading (presenter, leader, preacher)
 *   leader: string,             // Worship leader specifically
 *   preacher: string,           // Speaker specifically
 *   translator: string,
 *   message_title: string,
 *   scripture_references: string,
 *   parsed_verse_data: object|null,
 *   presentation_url: string,
 *   notes_url: string,
 *   content_is_slides_only: boolean,
 *   description: string,
 *   description_details: string,
 *   projection_notes: string,
 *   sound_notes: string,
 *   ushers_notes: string,
 *   translation_notes: string,
 *   stage_decor_notes: string,
 *   coordinator_notes: string,
 *   other_notes: string,
 *   requires_translation: boolean,
 *   songs: Array<{title, lead, key}>,
 *   actions: Array<{label, department, timing, offset_min, absolute_time, notes, order, is_prep}>,
 *   // Passthrough fields (preserved from source)
 *   color_code: string,
 *   show_in_general: boolean,
 *   is_live_adjusted: boolean,
 *   actual_start_time: string|null,
 *   actual_end_time: string|null,
 *   breakout_rooms: array|null,
 *   segment_type_raw: string,   // Original type before normalization
 *   panel_moderators: string,
 *   panel_panelists: string,
 *   major_break: boolean,
 *   room_id: string|null,
 *   // Source tracking
 *   _source: 'event' | 'weekly_service' | 'custom_service',
 *   _raw: object,               // Original segment object (for debugging/passthrough)
 * }
 */

// ─── TYPE NORMALIZATION MAP ───
// Maps all known type strings to canonical segment_type values
const TYPE_MAP = {
  // Weekly service types (lowercase)
  'worship': 'Alabanza',
  'welcome': 'Bienvenida',
  'offering': 'Ofrenda',
  'message': 'Plenaria',
  'special': 'Especial',
  'break': 'Receso',
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
  'generic': 'Especial',
};

function normalizeType(raw) {
  if (!raw) return 'Especial';
  const key = String(raw).toLowerCase().trim();
  return TYPE_MAP[key] || raw; // Preserve unknown types as-is
}

// ─── ACTION NORMALIZATION ───
// Ensures every action has guaranteed fields with permissive defaults
function normalizeAction(action, segmentStartTime) {
  if (!action || typeof action !== 'object') return null;
  
  return {
    label: action.label || '',
    department: action.department || 'General',
    timing: action.timing || 'after_start', // PERMISSIVE: default instead of drop
    offset_min: action.offset_min || 0,
    absolute_time: action.absolute_time || null,
    notes: action.notes || '',
    order: action.order || 0,
    is_prep: (action.timing || 'after_start') === 'before_start',
    // Preserve original id if present
    id: action.id || null,
  };
}

// ─── SONG NORMALIZATION ───
// Handles both array format [{title,lead,key}] and flat format (song_1_title, etc.)
function normalizeSongs(seg) {
  // 1. Check canonical songs array (weekly services store here)
  if (seg.songs && Array.isArray(seg.songs) && seg.songs.length > 0) {
    return seg.songs.filter(s => s && (s.title || s.lead));
  }
  
  // 2. Check data.songs (custom services store here too)
  if (seg.data?.songs && Array.isArray(seg.data.songs) && seg.data.songs.length > 0) {
    return seg.data.songs.filter(s => s && (s.title || s.lead));
  }
  
  // 3. Check flat fields (event Segment entities)
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
// Safely gets a field from either root or data sub-object
function getField(seg, field) {
  // Priority: root field > data sub-object > empty string
  if (seg[field] !== undefined && seg[field] !== null && seg[field] !== '') return seg[field];
  if (seg.data && seg.data[field] !== undefined && seg.data[field] !== null && seg.data[field] !== '') return seg.data[field];
  return '';
}

// ─── SINGLE SEGMENT NORMALIZER ───
function normalizeOneSegment(seg, source, defaults = {}) {
  const rawType = seg.segment_type || seg.type || '';
  const canonicalType = normalizeType(rawType);
  
  // Actions: merge segment_actions (embedded) + actions (linked/blueprint)
  const rawActions = [
    ...(seg.segment_actions || []),
    ...(seg.actions || []),
  ];
  const actions = rawActions
    .map(a => normalizeAction(a, seg.start_time))
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Dedupe actions by label+timing (backend sometimes merges embedded+linked)
  const seen = new Set();
  const dedupedActions = actions.filter(a => {
    const key = `${a.label}|${a.timing}|${a.offset_min}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    // Identity
    id: seg.id || defaults.id || `generated-${Math.random().toString(36).substr(2, 8)}`,
    title: getField(seg, 'title') || 'Untitled',
    segment_type: canonicalType,
    segment_type_raw: rawType,
    
    // Timing
    start_time: seg.start_time || null,
    end_time: seg.end_time || null,
    duration_min: seg.duration_min || seg.duration || 0,
    date: seg.date || defaults.date || null,
    session_id: seg.session_id || defaults.session_id || null,
    
    // People
    presenter: getField(seg, 'presenter'),
    leader: getField(seg, 'leader'),
    preacher: getField(seg, 'preacher'),
    translator: getField(seg, 'translator') || getField(seg, 'translator_name'),
    
    // Content
    message_title: getField(seg, 'message_title') || getField(seg, 'messageTitle'),
    scripture_references: getField(seg, 'scripture_references') || getField(seg, 'verse'),
    parsed_verse_data: seg.parsed_verse_data || seg.data?.parsed_verse_data || null,
    presentation_url: getField(seg, 'presentation_url'),
    notes_url: getField(seg, 'notes_url'),
    content_is_slides_only: !!(seg.content_is_slides_only || seg.data?.content_is_slides_only),
    
    // Notes
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
    
    // Translation
    requires_translation: !!(seg.requires_translation || seg.data?.requires_translation),
    
    // Songs
    songs: normalizeSongs(seg),
    
    // Actions (unified, deduped, sorted)
    actions: dedupedActions,
    
    // Passthrough fields
    color_code: seg.color_code || 'default',
    show_in_general: seg.show_in_general !== false,
    is_live_adjusted: !!seg.is_live_adjusted,
    actual_start_time: seg.actual_start_time || null,
    actual_end_time: seg.actual_end_time || null,
    breakout_rooms: seg.breakout_rooms || null,
    panel_moderators: getField(seg, 'panel_moderators'),
    panel_panelists: getField(seg, 'panel_panelists'),
    major_break: !!seg.major_break,
    room_id: seg.room_id || null,
    microphone_assignments: getField(seg, 'microphone_assignments'),
    
    // Sub-assignments (weekly services)
    sub_assignments: seg.sub_assignments || [],
    
    // Arts fields passthrough
    art_types: seg.art_types || null,
    has_video: !!seg.has_video,
    video_name: getField(seg, 'video_name'),
    video_url: getField(seg, 'video_url'),
    
    // Source tracking
    _source: source,
    _raw: seg,
  };
}

// ─── PUBLIC API ───

/**
 * Normalize the flat segment list from getPublicProgramData backend response.
 * Works for both Events and Services — the backend already flattens weekly service
 * slots into a single segments array.
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
 * Mutates nothing — returns a new array.
 * 
 * @param {Array} segments - Normalized segments
 * @param {Array} liveAdjustments - LiveTimeAdjustment records
 * @param {Object} serviceData - Raw service data (for custom service detection)
 * @returns {Array} Adjusted segments
 */
export function applyTimeAdjustments(segments, liveAdjustments = [], serviceData = null) {
  if (!liveAdjustments || liveAdjustments.length === 0) return segments;
  
  const addMinutes = (timeStr, minutes) => {
    if (!timeStr || !minutes) return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(2000, 0, 1, h, m + minutes, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  
  return segments.map(seg => {
    let offsetMinutes = 0;
    
    // Weekly service slot mapping
    if (seg.session_id === 'slot-9-30') {
      const adj = liveAdjustments.find(a => a.time_slot === '9:30am');
      if (adj) offsetMinutes = adj.offset_minutes || 0;
    } else if (seg.session_id === 'slot-11-30') {
      const adj = liveAdjustments.find(a => a.time_slot === '11:30am');
      if (adj) offsetMinutes = adj.offset_minutes || 0;
    } else if (seg.session_id === 'slot-break') {
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
 * Determine the source type from backend program data.
 * @param {Object} programData - Response from getPublicProgramData
 * @returns {'event' | 'weekly_service' | 'custom_service'}
 */
export function detectSourceType(programData) {
  if (!programData?.program) return 'event';
  const program = programData.program;
  if (program._isEvent) return 'event';
  if (program.segments && program.segments.length > 0) return 'custom_service';
  if (program['9:30am'] || program['11:30am']) return 'weekly_service';
  return 'custom_service'; // Fallback
}

/**
 * Full normalization pipeline: detect source, normalize segments, apply adjustments.
 * Single entry point for all consumers.
 * 
 * @param {Object} programData - Raw response from getPublicProgramData
 * @returns {{ segments: Array, source: string, sessions: Array, program: Object }}
 */
export function normalizeProgramData(programData) {
  if (!programData) return { segments: [], source: 'event', sessions: [], program: null };
  
  const source = detectSourceType(programData);
  const sessions = programData.sessions || [];
  const serviceDate = programData.program?.date || null;
  const liveAdjustments = programData.liveAdjustments || [];
  
  // Normalize raw segments
  const normalized = normalizeSegments(
    programData.segments || [],
    source,
    { sessions, serviceDate }
  );
  
  // Apply live time adjustments
  const adjusted = applyTimeAdjustments(normalized, liveAdjustments, programData.program);
  
  return {
    segments: adjusted,
    source,
    sessions,
    program: programData.program,
    rooms: programData.rooms || [],
    preSessionDetails: programData.preSessionDetails || [],
    liveAdjustments,
    // Passthrough for components that still need raw data
    _raw: programData,
  };
}