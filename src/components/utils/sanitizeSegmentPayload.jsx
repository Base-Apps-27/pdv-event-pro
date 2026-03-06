/**
 * sanitizeSegmentPayload.js — Schema-Driven Segment Payload Sanitizer
 * 
 * DECISION 2026-03-06: Single source of truth for type coercion before Segment API calls.
 * 
 * WHY THIS EXISTS:
 * Base44 platform returns 422 Unprocessable Content when field values don't match the
 * JSON schema. Common violations:
 *   - "" (empty string) sent for type: "number" fields → platform expects number or null
 *   - "" sent for enum fields → not a valid enum value
 *   - null or "" sent for type: "array" fields → platform expects array or null
 *   - "string" sent for type: "array" fields → not an array
 * 
 * Previously, these were handled by manually maintained lists in useSegmentFormSubmit.
 * This was fragile — every new field required updating 3 separate lists.
 * 
 * HOW IT WORKS:
 * Declares field types inline (derived from Segment.json schema) and applies coercion.
 * Any field NOT in the type map is passed through unchanged (strings are always safe).
 * 
 * USAGE:
 *   import { sanitizeSegmentPayload } from '@/components/utils/sanitizeSegmentPayload';
 *   const cleanData = sanitizeSegmentPayload(rawFormData);
 *   await base44.entities.Segment.update(id, cleanData);
 * 
 * MAINTENANCE:
 * When adding a new field to Segment.json:
 *   - If it's type "string" — no action needed (pass-through is safe)
 *   - If it's type "number" — add to NUMBER_FIELDS
 *   - If it's type "string" + enum — add to ENUM_FIELDS
 *   - If it's type "array" — add to ARRAY_FIELDS
 *   - If it's type "boolean" — add to BOOLEAN_FIELDS (optional, booleans are mostly safe)
 *   - If it's type "object" — no action needed (pass-through is safe)
 */

// ── NUMBER FIELDS ──
// Platform rejects "" but accepts null or a valid number.
const NUMBER_FIELDS = new Set([
  'order',
  'duration_min',
  'stage_call_offset_min',
  'number_of_songs',
  'video_length_sec',
  'drama_handheld_mics',
  'drama_headset_mics',
  'dance_handheld_mics',
  'dance_headset_mics',
]);

// ── ENUM FIELDS ──
// Platform rejects "" — it's not a valid enum value. Must be deleted or set to a valid value.
// We only list enums that can legitimately be empty in the form (user hasn't selected one).
// Enums that always have a valid default (e.g. segment_type, color_code) are excluded.
const ENUM_FIELDS = new Set([
  'spoken_word_mic_position',
  'live_status',
  'live_hold_status',
  'timing_source',
]);

// ── ARRAY FIELDS ──
// Platform rejects "" and non-array values. Must be [] or a valid array.
// Includes ALL array-typed fields, not just URL fields.
const ARRAY_FIELDS = new Set([
  // URL arrays
  'presentation_url',
  'notes_url',
  'video_url',
  'arts_run_of_show_url',
  'drama_song_source',
  'drama_song_2_url',
  'drama_song_3_url',
  'dance_song_source',
  'dance_song_2_url',
  'dance_song_3_url',
  'spoken_word_music_url',
  'spoken_word_script_url',
  'spoken_word_audio_url',
  // Non-URL arrays
  'art_types',
  'segment_actions',
  'ui_fields',
  'ui_sub_assignments',
  'arts_type_order',
  'breakout_rooms',
]);

// ── BOOLEAN FIELDS ──
// Platform is lenient with booleans but we normalize for consistency.
const BOOLEAN_FIELDS = new Set([
  'show_in_general',
  'show_in_projection',
  'show_in_sound',
  'show_in_ushers',
  'show_in_livestream',
  'requires_translation',
  'major_break',
  'has_video',
  'content_is_slides_only',
  'is_live_adjusted',
  'drama_has_song',
  'dance_has_song',
  'spoken_word_has_music',
  'painting_needs_easel',
  'painting_needs_drop_cloth',
  'painting_needs_lighting',
]);

/**
 * Sanitize a raw form data object into a schema-safe payload for Segment create/update.
 * 
 * @param {object} raw — The form data object (may contain invalid types from user input)
 * @returns {object} — A new object with all values coerced to schema-safe types
 */
export function sanitizeSegmentPayload(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const result = {};

  for (const [key, value] of Object.entries(raw)) {
    // Skip internal UI state flags (prefixed with _)
    if (key.startsWith('_')) continue;

    // ── NUMBER FIELDS ──
    if (NUMBER_FIELDS.has(key)) {
      if (value === '' || value === undefined) {
        // Don't send the field at all — platform uses its default or keeps existing value
        // This is safer than sending null for required fields like duration_min
        continue;
      }
      if (value === null) {
        result[key] = null;
        continue;
      }
      const num = Number(value);
      result[key] = isFinite(num) ? num : null;
      continue;
    }

    // ── ENUM FIELDS ──
    if (ENUM_FIELDS.has(key)) {
      if (value === '' || value === undefined || value === null) {
        // Don't send the field — omitting is safe, platform keeps existing value
        continue;
      }
      result[key] = value;
      continue;
    }

    // ── ARRAY FIELDS ──
    if (ARRAY_FIELDS.has(key)) {
      if (value == null) {
        // null or undefined → safe empty array
        result[key] = [];
        continue;
      }
      if (typeof value === 'string') {
        // String → split into array (handles comma-separated URLs from legacy data)
        result[key] = value.trim() ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
        continue;
      }
      if (Array.isArray(value)) {
        // Clean array items: trim strings, remove falsy
        result[key] = value.map(item => typeof item === 'string' ? item.trim() : item).filter(Boolean);
        continue;
      }
      // Unknown type → safe empty array
      result[key] = [];
      continue;
    }

    // ── BOOLEAN FIELDS ──
    if (BOOLEAN_FIELDS.has(key)) {
      result[key] = Boolean(value);
      continue;
    }

    // ── PASS-THROUGH ──
    // Strings, objects, and unknown fields pass through unchanged.
    // Strings are always safe (platform accepts "" and null).
    // Objects (like parsed_verse_data, field_origins) are always safe.
    result[key] = value;
  }

  return result;
}