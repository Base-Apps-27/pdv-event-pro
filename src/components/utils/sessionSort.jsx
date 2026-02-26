/**
 * sessionSort.js — Canonical Session Sort Strategy (DECISION-004)
 *
 * PROBLEM: Session `order` field is unreliable. It's assigned as a simple
 * counter at creation time (sessions.length + 1) but:
 *   - Multiple sessions can have the same `order` value
 *   - AI Helper may overwrite order values
 *   - Nobody recalculates order on add/delete/reorder
 *
 * SOLUTION: All data pipelines sort sessions chronologically:
 *   1. Primary: date (YYYY-MM-DD ascending)
 *   2. Secondary: planned_start_time (HH:MM ascending)
 *   3. Tertiary: order (ascending, tiebreaker only)
 *   4. Quaternary: name (localeCompare, last resort)
 *
 * This matches what EventDetail and SessionManager already do for display,
 * and what users expect (chronological order).
 *
 * CONSUMERS:
 *   - refreshActiveProgram (backend — inlined copy, keep in sync)
 *   - useActiveProgramCache (override query)
 *   - normalizeSession (normalizeEventSegments, normalizeEntitySourcedSegments)
 *   - getSortedSessions (backend — inlined copy, keep in sync)
 *   - EventDetail, SessionManager (already correct, no change needed)
 *
 * ATT-015 / DECISION-004
 */

/**
 * Sort sessions chronologically: date → start_time → order → name.
 * Non-destructive: returns a NEW sorted array (does not mutate input).
 *
 * @param {Array} sessions - Array of session objects
 * @returns {Array} New array sorted chronologically
 */
export function sortSessionsChronologically(sessions) {
  if (!sessions || !Array.isArray(sessions)) return [];
  return [...sessions].sort(compareSessionsChronologically);
}

/**
 * Comparator function for sorting sessions chronologically.
 * Can be used directly with Array.prototype.sort().
 *
 * Sort priority:
 *   1. date ASC (missing dates sort last)
 *   2. planned_start_time ASC (missing times sort last)
 *   3. order ASC (tiebreaker for same date+time)
 *   4. name localeCompare (last resort)
 */
export function compareSessionsChronologically(a, b) {
  // 1. Date (YYYY-MM-DD string comparison works for ISO dates)
  const aDate = a?.date || '';
  const bDate = b?.date || '';
  if (aDate !== bDate) {
    // Sessions without dates sort last
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.localeCompare(bDate);
  }

  // 2. Start time (HH:MM string comparison works for 24h format)
  const aTime = a?.planned_start_time || '';
  const bTime = b?.planned_start_time || '';
  if (aTime !== bTime) {
    if (!aTime) return 1;
    if (!bTime) return -1;
    return aTime.localeCompare(bTime);
  }

  // 3. Order field (tiebreaker only — unreliable as primary sort)
  const aOrder = Number.isFinite(a?.order) ? a.order : Infinity;
  const bOrder = Number.isFinite(b?.order) ? b.order : Infinity;
  if (aOrder !== bOrder) return aOrder - bOrder;

  // 4. Name (last resort)
  return (a?.name || '').localeCompare(b?.name || '');
}

/**
 * Build a session-index map from a chronologically sorted session array.
 * Used for sorting segments by their session's chronological position.
 *
 * @param {Array} sortedSessions - Sessions already sorted chronologically
 * @returns {Map<string, number>} Map of session.id → chronological index
 */
export function buildSessionIndexMap(sortedSessions) {
  return new Map(sortedSessions.map((s, i) => [s.id, i]));
}