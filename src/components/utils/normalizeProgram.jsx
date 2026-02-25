/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  normalizeProgram.js — TIME ADJUSTMENT ADAPTER                         ║
 * ║                                                                        ║
 * ║  STATUS: Active on PublicCountdownDisplay (TV) and Live Views.         ║
 * ║                                                                        ║
 * ║  NOTE (2026-02-25): Legacy JSON schema-mapping logic was purged        ║
 * ║  after the "Entity Lift" was completed. The backend now natively      ║
 * ║  serves pristine Segment entities. This file now exclusively manages   ║
 * ║  Live Director time offsets.                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

/**
 * Apply LiveTimeAdjustments to entity segments.
 * Returns a NEW array — does not mutate inputs.
 *
 * @param {Array} segments - Entity segments
 * @param {Array} liveAdjustments - LiveTimeAdjustment records
 * @param {Array} sessions - Session entities (for resolving IDs to names)
 * @returns {Array} Adjusted segments (new array)
 */
export function applyTimeAdjustments(segments, liveAdjustments = [], sessions = []) {
  if (!liveAdjustments || liveAdjustments.length === 0) return segments;

  // Build session name lookup to match against time_slot adjustments
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

    const sessionName = sessionNameMap.get(seg.session_id) || null;

    if (seg.session_id && seg.session_id !== 'slot-break') {
      // Resolve via explicit matching based on adjustment types
      const adj = liveAdjustments.find(a => 
        (a.adjustment_type === 'time_slot' && sessionName && a.time_slot === sessionName) || 
        (a.adjustment_type === 'session' && a.session_id === seg.session_id) ||
        (a.adjustment_type === 'global')
      );
      if (adj) offsetMinutes = adj.offset_minutes || 0;
    } else if (seg.session_id === 'slot-break') {
      // The inter-service break follows the first slot's adjustment
      const firstAdj = liveAdjustments.find(a => a.time_slot && /^\d+:\d+[ap]m$/i.test(a.time_slot));
      if (firstAdj) offsetMinutes = firstAdj.offset_minutes || 0;
    } else {
      // Global adjustment (Custom services or events without session_id)
      const globalAdj = liveAdjustments.find(a => a.adjustment_type === 'global');
      if (globalAdj) offsetMinutes = globalAdj.offset_minutes || 0;
    }

    if (offsetMinutes === 0) return seg;

    return {
      ...seg,
      original_start_time: seg.start_time,
      original_end_time: seg.end_time,
      start_time: addMinutes(seg.start_time, offsetMinutes),
      end_time: addMinutes(seg.end_time, offsetMinutes),
      _time_adjusted: true,
      _time_offset: offsetMinutes,
    };
  });
}

/**
 * Full normalization pipeline (Now strictly a Time Adjustment pipeline).
 * Single entry point: apply adjustments to pristine entities.
 *
 * @param {Object} programData - Raw response from getPublicProgramData/refreshActiveProgram
 * @returns {Object} 
 */
export function normalizeProgramData(programData) {
  if (!programData) return { segments: [], source: 'event', sessions: [], program: null };

  const sessions = programData.sessions || [];
  const liveAdjustments = programData.liveAdjustments || [];
  
  // The backend now filters child segments inherently via _resolved_sub_assignments, 
  // but we enforce it here as a final display-layer guarantee.
  const rawSegments = (programData.segments || []).filter(seg => !seg.parent_segment_id);

  // Apply live time adjustments (only reads session_id, start_time, end_time)
  const adjusted = applyTimeAdjustments(rawSegments, liveAdjustments, sessions);

  return {
    segments: adjusted,
    source: programData.program?._isEvent ? 'event' : 'weekly_service',
    sessions,
    program: programData.program,
    rooms: programData.rooms || [],
    preSessionDetails: programData.preSessionDetails || [],
    liveAdjustments,
    _raw: programData,
  };
}