/**
 * timeCascade.js — Recalculates start_time and end_time for all segments
 * in a session after a reorder, insert, or delete operation.
 *
 * 2026-04-15: Created as shared utility for structural operations.
 *
 * Logic:
 *   For each segment in order:
 *     start_time = previous segment's end_time (or session planned_start_time for first)
 *     end_time = start_time + duration_min
 *
 * Returns an array of { id, start_time, end_time } for segments whose times changed.
 * Caller is responsible for persisting these to the DB.
 */

/**
 * @param {Array} orderedSegments - Segments sorted by order (each must have id, duration_min)
 * @param {string} sessionStartTime - Session planned_start_time in "HH:MM" format
 * @returns {Array<{id: string, start_time: string, end_time: string}>} Only changed segments
 */
export function computeTimeCascade(orderedSegments, sessionStartTime) {
  if (!orderedSegments?.length || !sessionStartTime) return [];

  const [startH, startM] = sessionStartTime.split(':').map(Number);
  if (isNaN(startH) || isNaN(startM)) return [];

  let currentMinutes = startH * 60 + startM;
  const updates = [];

  for (const seg of orderedSegments) {
    const duration = Number(seg.duration_min) || 0;
    const newStart = minutesToHHMM(currentMinutes);
    const newEnd = minutesToHHMM(currentMinutes + duration);

    // Only include if times actually changed
    if (seg.start_time !== newStart || seg.end_time !== newEnd) {
      updates.push({
        id: seg.id,
        start_time: newStart,
        end_time: newEnd,
      });
    }

    currentMinutes += duration;
  }

  return updates;
}

function minutesToHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}