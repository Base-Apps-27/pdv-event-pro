/**
 * segmentTypeMap.js — Single source of truth for segment type normalization.
 *
 * DECISION-002 Contract 2 (2026-02-25): All code that converts between
 * UI/blueprint type names and Segment entity enum values MUST use this map.
 *
 * Previous state: 4 separate inline typeMap objects with drift.
 *   - EmptyDayPrompt (21 entries)
 *   - executeResetToBlueprint (21 entries)
 *   - segmentEntityToWeeklyJSON (8 entries, read-path)
 *   - mergeSegmentsWithBlueprint (8 entries, read-path)
 *
 * Segment entity enum (from Segment.json schema):
 *   Alabanza, Bienvenida, Ofrenda, Plenaria, Video, Anuncio, Dinámica,
 *   Break, TechOnly, Oración, Especial, Cierre, MC, Ministración,
 *   Receso, Almuerzo, Artes, Breakout, Panel
 */

// Blueprint/UI type → Segment entity enum value
const TYPE_TO_ENUM = {
  // Core service types
  'worship': 'Alabanza',
  'alabanza': 'Alabanza',
  'welcome': 'Bienvenida',
  'bienvenida': 'Bienvenida',
  'offering': 'Ofrenda',
  'ofrenda': 'Ofrenda',
  'ofrendas': 'Ofrenda',
  'message': 'Plenaria',
  'plenaria': 'Plenaria',
  'predica': 'Plenaria',
  'mensaje': 'Plenaria',

  // Media & announcements
  'video': 'Video',
  'anuncio': 'Anuncio',

  // Flow types
  'dinamica': 'Dinámica',
  'dinámica': 'Dinámica',
  'break': 'Break',
  'techonly': 'TechOnly',
  'prayer': 'Oración',
  'oracion': 'Oración',
  'oración': 'Oración',
  'special': 'Especial',
  'especial': 'Especial',
  'closing': 'Cierre',
  'cierre': 'Cierre',
  'ministry': 'Ministración',
  'ministracion': 'Ministración',
  'ministración': 'Ministración',

  // Extended types
  'mc': 'MC',
  'artes': 'Artes',
  'breakout': 'Breakout',
  'panel': 'Panel',
  'receso': 'Receso',
  'almuerzo': 'Almuerzo',
};

// Reverse: Segment entity enum → normalized lowercase key (for read-path matching)
const ENUM_TO_NORMALIZED = {
  'Alabanza': 'worship',
  'Bienvenida': 'welcome',
  'Ofrenda': 'offering',
  'Plenaria': 'message',
  'Video': 'video',
  'Anuncio': 'anuncio',
  'Dinámica': 'dinamica',
  'Break': 'break',
  'TechOnly': 'techonly',
  'Oración': 'prayer',
  'Especial': 'special',
  'Cierre': 'closing',
  'MC': 'mc',
  'Ministración': 'ministry',
  'Receso': 'receso',
  'Almuerzo': 'almuerzo',
  'Artes': 'artes',
  'Breakout': 'breakout',
  'Panel': 'panel',
};

/**
 * Convert a raw type string (from blueprint, UI, or entity) to
 * the Segment entity enum value.
 *
 * Examples:
 *   resolveSegmentEnum('worship')  → 'Alabanza'
 *   resolveSegmentEnum('Plenaria') → 'Plenaria'  (already valid)
 *   resolveSegmentEnum('garbage')  → 'Especial'  (safe default)
 *
 * @param {string} rawType - The type string from any source
 * @returns {string} Valid Segment.segment_type enum value
 */
export function resolveSegmentEnum(rawType) {
  if (!rawType) return 'Especial';
  // If it's already a valid enum value, return as-is
  if (ENUM_TO_NORMALIZED[rawType]) return rawType;
  // Otherwise look up from the lowercase map
  return TYPE_TO_ENUM[rawType.toLowerCase()] || rawType;
}

/**
 * Normalize any segment type string to a stable lowercase key
 * for comparison / blueprint matching.
 *
 * Examples:
 *   normalizeSegmentType('Alabanza')  → 'worship'
 *   normalizeSegmentType('worship')   → 'worship'
 *   normalizeSegmentType('Plenaria')  → 'message'
 *   normalizeSegmentType('message')   → 'message'
 *
 * @param {string} rawType
 * @returns {string} Normalized lowercase key
 */
export function normalizeSegmentType(rawType) {
  if (!rawType) return '';
  // If it's an enum value, use the reverse map
  if (ENUM_TO_NORMALIZED[rawType]) return ENUM_TO_NORMALIZED[rawType];
  // If it's already a lowercase key that maps to an enum, use it
  const lower = rawType.toLowerCase();
  if (TYPE_TO_ENUM[lower]) {
    const enumVal = TYPE_TO_ENUM[lower];
    return ENUM_TO_NORMALIZED[enumVal] || lower;
  }
  return lower;
}