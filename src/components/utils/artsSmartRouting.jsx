/**
 * artsSmartRouting.js — Smart Field Routing for Arts Segments
 * 
 * 2026-02-28: Decision — "Computed Smart Notes at read-time" (Option A).
 * Pure function that maps concrete arts fields to department-relevant data items.
 * Zero schema changes, zero double-entry. Always fresh from source fields.
 * 
 * Usage:
 *   const items = getArtsSmartNotes(segment, 'sound');
 *   // Returns: [{ icon: '🎤', label: 'Mic (Spoken Word)', value: 'Headset' }, ...]
 * 
 * Consumers:
 *   - DepartmentNotes (MyProgram filtering)
 *   - SegmentReportRow (HTML event reports — notes column)
 *   - PublicProgramSegment (Live View — team notes grid)
 *   - PDF cellBuilders (event PDF — notes cell)
 * 
 * IMPORTANT: Only returns items for 'Artes' segments with art_types present.
 * Returns empty array for non-arts segments — safe to call unconditionally.
 */

/**
 * Routing map: department → array of field extractors.
 * Each extractor: { field(s) to check, icon, labelEs, labelEn, format function }
 */
const ROUTING = {
  sound: [
    // Drama mics
    { check: (s) => s.drama_handheld_mics > 0, icon: '🎤', labelEs: 'Mics mano (Drama)', labelEn: 'Handheld Mics (Drama)', value: (s) => String(s.drama_handheld_mics) },
    { check: (s) => s.drama_headset_mics > 0, icon: '🎧', labelEs: 'Headset (Drama)', labelEn: 'Headset (Drama)', value: (s) => String(s.drama_headset_mics) },
    // Dance mics
    { check: (s) => s.dance_handheld_mics > 0, icon: '🎤', labelEs: 'Mics mano (Danza)', labelEn: 'Handheld Mics (Dance)', value: (s) => String(s.dance_handheld_mics) },
    { check: (s) => s.dance_headset_mics > 0, icon: '🎧', labelEs: 'Headset (Danza)', labelEn: 'Headset (Dance)', value: (s) => String(s.dance_headset_mics) },
    // Spoken word mic
    { check: (s) => !!s.spoken_word_mic_position, icon: '🎤', labelEs: 'Mic (Spoken Word)', labelEn: 'Mic (Spoken Word)', value: (s) => {
      const MIC_LABELS = { headset: 'Headset', handheld: 'Handheld', stand: 'Stand/Atril', off_stage: 'Off Stage', lapel: 'Lapel', podium: 'Podium/Podio' };
      return MIC_LABELS[s.spoken_word_mic_position] || s.spoken_word_mic_position;
    }},
    // Spoken word background music — check data presence, not checkbox (may not be set via public form)
    { check: (s) => !!s.spoken_word_music_title, icon: '🎵', labelEs: 'Música fondo (Spoken Word)', labelEn: 'BG Music (Spoken Word)', value: (s) => s.spoken_word_music_title },
    // Drama songs to queue — check data presence, not drama_has_song checkbox
    { check: (s) => !!s.drama_song_title, icon: '🎵', labelEs: 'Pista (Drama)', labelEn: 'Track (Drama)', value: (s) => s.drama_song_title },
    { check: (s) => !!s.drama_song_2_title, icon: '🎵', labelEs: 'Pista 2 (Drama)', labelEn: 'Track 2 (Drama)', value: (s) => s.drama_song_2_title },
    { check: (s) => !!s.drama_song_3_title, icon: '🎵', labelEs: 'Pista 3 (Drama)', labelEn: 'Track 3 (Drama)', value: (s) => s.drama_song_3_title },
    // Dance songs to queue — check data presence, not dance_has_song checkbox
    { check: (s) => !!s.dance_song_title, icon: '🎵', labelEs: 'Música (Danza)', labelEn: 'Music (Dance)', value: (s) => s.dance_song_title },
    { check: (s) => !!s.dance_song_2_title, icon: '🎵', labelEs: 'Música 2 (Danza)', labelEn: 'Music 2 (Dance)', value: (s) => s.dance_song_2_title },
    { check: (s) => !!s.dance_song_3_title, icon: '🎵', labelEs: 'Música 3 (Danza)', labelEn: 'Music 3 (Dance)', value: (s) => s.dance_song_3_title },
    // Video duration (sound routing / muting)
    { check: (s) => (s.art_types || []).includes('VIDEO') && typeof s.video_length_sec === 'number', icon: '🎬', labelEs: 'Video duración', labelEn: 'Video duration', value: (s) => `${Math.floor(s.video_length_sec / 60)}:${String(s.video_length_sec % 60).padStart(2, '0')}` },
    // Start/end cues — critical for sound to know when to cut/start
    { check: (s) => !!s.drama_start_cue, icon: '▶', labelEs: 'Cue inicio (Drama)', labelEn: 'Start cue (Drama)', value: (s) => s.drama_start_cue },
    { check: (s) => !!s.drama_end_cue, icon: '⏹', labelEs: 'Cue fin (Drama)', labelEn: 'End cue (Drama)', value: (s) => s.drama_end_cue },
    { check: (s) => !!s.dance_start_cue, icon: '▶', labelEs: 'Cue inicio (Danza)', labelEn: 'Start cue (Dance)', value: (s) => s.dance_start_cue },
    { check: (s) => !!s.dance_end_cue, icon: '⏹', labelEs: 'Cue fin (Danza)', labelEn: 'End cue (Dance)', value: (s) => s.dance_end_cue },
  ],

  projection: [
    // Video to load
    { check: (s) => !!s.video_name, icon: '🎬', labelEs: 'Video', labelEn: 'Video', value: (s) => s.video_name },
    { check: (s) => !!s.video_location, icon: '📁', labelEs: 'Ubicación video', labelEn: 'Video location', value: (s) => s.video_location },
    { check: (s) => typeof s.video_length_sec === 'number' && (s.art_types || []).includes('VIDEO'), icon: '⏱', labelEs: 'Duración video', labelEn: 'Video duration', value: (s) => `${Math.floor(s.video_length_sec / 60)}:${String(s.video_length_sec % 60).padStart(2, '0')}` },
    // Spoken word script (possible lower-thirds)
    { check: (s) => !!s.spoken_word_script_url, icon: '📄', labelEs: 'Script (Spoken Word)', labelEn: 'Script (Spoken Word)', value: () => 'Ver enlace' },
    // Run of show PDF
    { check: (s) => !!s.arts_run_of_show_url, icon: '📋', labelEs: 'Guía de Artes', labelEn: 'Arts Run of Show', value: () => 'Ver enlace' },
    // Cues for timing coordination
    { check: (s) => !!s.dance_start_cue, icon: '▶', labelEs: 'Cue inicio (Danza)', labelEn: 'Start cue (Dance)', value: (s) => s.dance_start_cue },
    { check: (s) => !!s.dance_end_cue, icon: '⏹', labelEs: 'Cue fin (Danza)', labelEn: 'End cue (Dance)', value: (s) => s.dance_end_cue },
    { check: (s) => !!s.drama_start_cue, icon: '▶', labelEs: 'Cue inicio (Drama)', labelEn: 'Start cue (Drama)', value: (s) => s.drama_start_cue },
    { check: (s) => !!s.drama_end_cue, icon: '⏹', labelEs: 'Cue fin (Drama)', labelEn: 'End cue (Drama)', value: (s) => s.drama_end_cue },
  ],

  livestream: [
    // Video for stream
    { check: (s) => !!s.video_name && (s.art_types || []).includes('VIDEO'), icon: '🎬', labelEs: 'Video', labelEn: 'Video', value: (s) => s.video_name },
    { check: (s) => typeof s.video_length_sec === 'number' && (s.art_types || []).includes('VIDEO'), icon: '⏱', labelEs: 'Duración video', labelEn: 'Video duration', value: (s) => `${Math.floor(s.video_length_sec / 60)}:${String(s.video_length_sec % 60).padStart(2, '0')}` },
    // Performance sequence for camera blocking
    { check: (s) => Array.isArray(s.arts_type_order) && s.arts_type_order.length > 1, icon: '📋', labelEs: 'Orden de presentación', labelEn: 'Performance order', value: (s) => {
      const TYPE_SHORT = { DANCE: 'Danza', DRAMA: 'Drama', VIDEO: 'Video', SPOKEN_WORD: 'Spoken Word', PAINTING: 'Pintura', OTHER: 'Otro' };
      return [...s.arts_type_order].sort((a, b) => (a.order || 0) - (b.order || 0)).map(i => TYPE_SHORT[i.type] || i.type).join(' → ');
    }},
    // Run of show
    { check: (s) => !!s.arts_run_of_show_url, icon: '📋', labelEs: 'Guía de Artes', labelEn: 'Arts Run of Show', value: () => 'Ver enlace' },
  ],

  stage_decor: [
    // Painting setup
    { check: (s) => s.painting_needs_easel, icon: '🖼', labelEs: 'Necesita caballete', labelEn: 'Needs easel', value: () => '✓' },
    { check: (s) => s.painting_needs_drop_cloth, icon: '🧹', labelEs: 'Protección de piso', labelEn: 'Drop cloth', value: () => '✓' },
    { check: (s) => s.painting_needs_lighting, icon: '💡', labelEs: 'Iluminación especial', labelEn: 'Special lighting', value: () => '✓' },
    { check: (s) => !!s.painting_canvas_size, icon: '📐', labelEs: 'Tamaño lienzo', labelEn: 'Canvas size', value: (s) => s.painting_canvas_size },
    { check: (s) => !!s.painting_other_setup, icon: '⚙', labelEs: 'Setup adicional', labelEn: 'Additional setup', value: (s) => s.painting_other_setup },
  ],

  coordination: [
    // Overview of what's happening in this segment
    { check: (s) => Array.isArray(s.art_types) && s.art_types.length > 0, icon: '🎭', labelEs: 'Tipos de arte', labelEn: 'Art types', value: (s) => {
      const TYPE_SHORT = { DANCE: 'Danza', DRAMA: 'Drama', VIDEO: 'Video', SPOKEN_WORD: 'Spoken Word', PAINTING: 'Pintura', OTHER: 'Otro' };
      return s.art_types.map(t => TYPE_SHORT[t] || t).join(', ');
    }},
    // Performance order
    { check: (s) => Array.isArray(s.arts_type_order) && s.arts_type_order.length > 1, icon: '📋', labelEs: 'Orden', labelEn: 'Order', value: (s) => {
      const TYPE_SHORT = { DANCE: 'Danza', DRAMA: 'Drama', VIDEO: 'Video', SPOKEN_WORD: 'Spoken Word', PAINTING: 'Pintura', OTHER: 'Otro' };
      return [...s.arts_type_order].sort((a, b) => (a.order || 0) - (b.order || 0)).map(i => TYPE_SHORT[i.type] || i.type).join(' → ');
    }},
    // Spoken word speaker
    { check: (s) => !!s.spoken_word_speaker, icon: '🎤', labelEs: 'Orador (Spoken Word)', labelEn: 'Speaker (Spoken Word)', value: (s) => s.spoken_word_speaker },
    // Run of show
    { check: (s) => !!s.arts_run_of_show_url, icon: '📋', labelEs: 'Guía de Artes', labelEn: 'Arts Run of Show', value: () => 'Ver enlace' },
  ],
};

/**
 * Returns an array of { icon, label, value } items for a given segment + department.
 * 
 * @param {Object} segment - Full segment entity object
 * @param {string} department - Department key (sound, projection, livestream, stage_decor, coordination)
 * @param {string} language - 'es' | 'en' (default 'es')
 * @returns {Array<{icon: string, label: string, value: string}>}
 */
export function getArtsSmartNotes(segment, department, language = 'es') {
  if (!segment) return [];
  
  // Only applies to Artes segments with active art types
  const isArtes = segment.segment_type === 'Artes';
  const artTypes = segment.art_types;
  if (!isArtes || !Array.isArray(artTypes) || artTypes.length === 0) return [];

  const routes = ROUTING[department];
  if (!routes) return [];

  const items = [];
  for (const route of routes) {
    if (route.check(segment)) {
      items.push({
        icon: route.icon,
        label: language === 'es' ? route.labelEs : route.labelEn,
        value: route.value(segment),
      });
    }
  }

  return items;
}

/**
 * Returns all departments that have routed items for this segment.
 * Useful for the "general" view to show a summary of which departments
 * have auto-routed info.
 * 
 * @param {Object} segment
 * @returns {Array<string>} department keys with items
 */
export function getArtsDepartmentsWithNotes(segment) {
  if (!segment || segment.segment_type !== 'Artes') return [];
  const artTypes = segment.art_types;
  if (!Array.isArray(artTypes) || artTypes.length === 0) return [];

  const depts = [];
  for (const dept of Object.keys(ROUTING)) {
    const routes = ROUTING[dept];
    if (routes.some(r => r.check(segment))) {
      depts.push(dept);
    }
  }
  return depts;
}