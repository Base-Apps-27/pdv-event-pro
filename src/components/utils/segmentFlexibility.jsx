/**
 * Segment Flexibility Configuration for Live Director
 * 
 * DECISION: Live Director Architecture (2026-02-11)
 * 
 * Each segment type has:
 * - score: 0-10 where 0 = completely rigid (cannot compress), 10 = fully compressible
 * - skipDefault: default disposition when a segment is consumed by an overrun
 *   'skip' = system recommends skipping this segment
 *   'shift' = system recommends shifting to later in the schedule
 * - label_en / label_es: human-readable explanation for the Director Console UI
 * 
 * These scores are used by:
 * 1. Phantom segment reconciliation (default skip/shift recommendation)
 * 2. AI cascade proposal generation (which segments to compress and by how much)
 * 3. Director Console display (visual indicator of segment rigidity)
 * 
 * Score interpretation:
 * 0-2: Rigid — content is fixed-length or critical (Video, Artes, Breakout)
 * 3-4: Semi-rigid — can compress slightly but not easily (Plenaria, Oración, Especial, Ministración)
 * 5-6: Flexible — can shorten or skip without major impact (Bienvenida, Ofrenda, Cierre, Dinámica)
 * 7-8: Highly flexible — first candidates for compression/skip (Anuncio, MC, TechOnly, Almuerzo)
 * 9-10: Fully compressible — absorbs overruns first (Break, Receso)
 */

export const SEGMENT_FLEXIBILITY = {
  Alabanza:     { score: 4, skipDefault: 'shift', label_en: 'Semi-rigid — can drop a song',          label_es: 'Semi-rígido — puede omitir una canción' },
  Bienvenida:   { score: 5, skipDefault: 'skip',  label_en: 'Flexible — can shorten or skip',        label_es: 'Flexible — puede acortar u omitir' },
  Ofrenda:      { score: 5, skipDefault: 'skip',  label_en: 'Flexible — can shorten or skip',        label_es: 'Flexible — puede acortar u omitir' },
  Plenaria:     { score: 2, skipDefault: 'shift', label_en: 'Rigid — main content, compress reluctantly', label_es: 'Rígido — contenido principal, comprimir con cautela' },
  Video:        { score: 0, skipDefault: 'shift', label_en: 'Fixed — runtime cannot change',         label_es: 'Fijo — duración no puede cambiar' },
  Anuncio:      { score: 7, skipDefault: 'skip',  label_en: 'Highly flexible — can skip entirely',   label_es: 'Muy flexible — puede omitir completamente' },
  Dinámica:     { score: 6, skipDefault: 'skip',  label_en: 'Flexible — can shorten or skip',        label_es: 'Flexible — puede acortar u omitir' },
  Break:        { score: 10, skipDefault: 'skip', label_en: 'Fully compressible — first to absorb',  label_es: 'Totalmente comprimible — primero en absorber' },
  TechOnly:     { score: 8, skipDefault: 'skip',  label_en: 'Highly flexible — can eliminate',       label_es: 'Muy flexible — puede eliminar' },
  Oración:      { score: 4, skipDefault: 'shift', label_en: 'Semi-rigid — can shorten slightly',     label_es: 'Semi-rígido — puede acortar ligeramente' },
  Especial:     { score: 3, skipDefault: 'shift', label_en: 'Semi-rigid — usually planned specifically', label_es: 'Semi-rígido — generalmente planificado específicamente' },
  Cierre:       { score: 5, skipDefault: 'skip',  label_en: 'Flexible — can shorten',                label_es: 'Flexible — puede acortar' },
  MC:           { score: 7, skipDefault: 'skip',  label_en: 'Highly flexible — can skip or compress', label_es: 'Muy flexible — puede omitir o comprimir' },
  Ministración: { score: 3, skipDefault: 'shift', label_en: 'Semi-rigid — sensitive, compress carefully', label_es: 'Semi-rígido — sensible, comprimir con cuidado' },
  Receso:       { score: 10, skipDefault: 'skip', label_en: 'Fully compressible — first to absorb',  label_es: 'Totalmente comprimible — primero en absorber' },
  Almuerzo:     { score: 8, skipDefault: 'shift', label_en: 'Break — can compress up to 15 min',     label_es: 'Receso — puede comprimir hasta 15 min' },
  Artes:        { score: 1, skipDefault: 'shift', label_en: 'Fixed — choreographed/recorded content', label_es: 'Fijo — contenido coreografiado/grabado' },
  Breakout:     { score: 1, skipDefault: 'shift', label_en: 'Fixed — rooms pre-assigned',            label_es: 'Fijo — salas pre-asignadas' },
  Panel:        { score: 3, skipDefault: 'shift', label_en: 'Semi-rigid — multiple participants coordinated', label_es: 'Semi-rígido — múltiples participantes coordinados' },
};

/**
 * Get flexibility info for a segment type.
 * Returns the config object or a safe default for unknown types.
 */
export function getSegmentFlexibility(segmentType) {
  return SEGMENT_FLEXIBILITY[segmentType] || {
    score: 5,
    skipDefault: 'shift',
    label_en: 'Unknown type — default flexibility',
    label_es: 'Tipo desconocido — flexibilidad predeterminada',
  };
}

/**
 * Determine if a segment type is considered rigid (score <= 2).
 * Rigid segments should never be auto-skipped and are flagged in Director UI.
 */
export function isRigidSegment(segmentType) {
  const flex = getSegmentFlexibility(segmentType);
  return flex.score <= 2;
}

/**
 * Determine if a segment type is the first candidate for compression (score >= 8).
 * These are targeted first when recovering time from overruns.
 */
export function isHighlyCompressible(segmentType) {
  const flex = getSegmentFlexibility(segmentType);
  return flex.score >= 8;
}

/**
 * Calculate maximum minutes a segment can be compressed based on its flexibility score and planned duration.
 * Formula: (score / 10) * planned_duration_min, rounded down.
 * A score-0 segment cannot be compressed at all. A score-10 segment can be fully eliminated.
 */
export function maxCompressMinutes(segmentType, plannedDurationMin) {
  const flex = getSegmentFlexibility(segmentType);
  return Math.floor((flex.score / 10) * plannedDurationMin);
}