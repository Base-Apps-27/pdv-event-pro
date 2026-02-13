import { addMinutes, parse, format, isValid } from 'date-fns';

/**
 * Resolves the start and end times for a StreamBlock based on its anchor configuration
 * and the current state of the main program segments.
 * 
 * @param {Object} block - The StreamBlock entity
 * @param {Array} segments - Array of Segment entities for the session
 * @param {Date|String} sessionDate - The session date (for absolute time resolution)
 * @returns {Object} { startTime, endTime, isOrphaned }
 */
export function resolveBlockTime(block, segments, sessionDate) {
  // 1. Handle Absolute Time (No anchor)
  if (block.anchor_point === 'absolute') {
    if (!block.absolute_time) return { startTime: null, endTime: null, isOrphaned: false };
    
    const startTime = parseTimeOnDate(block.absolute_time, sessionDate);
    const endTime = block.duration_min ? addMinutes(startTime, block.duration_min) : addMinutes(startTime, 10); // Default 10 if missing
    
    return { startTime, endTime, isOrphaned: false };
  }

  // 2. Find Anchor Segment
  const anchor = segments?.find(s => s.id === block.anchor_segment_id);

  // 3. Handle Orphaned Blocks
  if (!anchor) {
    // If we have a last_known_start, try to use it as a fallback absolute time
    if (block.last_known_start) {
      const startTime = parseTimeOnDate(block.last_known_start, sessionDate);
      const endTime = block.duration_min ? addMinutes(startTime, block.duration_min) : addMinutes(startTime, 10);
      return { startTime, endTime, isOrphaned: true };
    }
    return { startTime: null, endTime: null, isOrphaned: true };
  }

  // 4. Determine Anchor Reference Time (Actual vs Planned)
  // Priority: actual_start_time (live) > start_time (planned)
  const anchorStartStr = anchor.actual_start_time || anchor.start_time;
  const anchorEndStr = anchor.actual_end_time || anchor.end_time;

  const anchorStart = parseTimeOnDate(anchorStartStr, sessionDate);
  const anchorEnd = parseTimeOnDate(anchorEndStr, sessionDate);

  if (!isValid(anchorStart)) {
    return { startTime: null, endTime: null, isOrphaned: false, error: 'Invalid anchor time' };
  }

  // 5. Calculate Block Start Time based on Anchor Point + Offset
  let startTime;
  switch (block.anchor_point) {
    case 'before_start':
      startTime = addMinutes(anchorStart, block.offset_min || 0); // usually negative offset
      break;
    case 'at_start':
      startTime = addMinutes(anchorStart, block.offset_min || 0);
      break;
    case 'at_end':
      // If anchor hasn't ended yet (no actual_end_time), rely on calculated end from duration
      // But here we rely on what's passed in. 
      // If anchorEnd is invalid (e.g. data missing), fallback to start + duration
      let effectiveEnd = anchorEnd;
      if (!isValid(effectiveEnd) && anchor.duration_min) {
        effectiveEnd = addMinutes(anchorStart, anchor.duration_min);
      }
      startTime = addMinutes(effectiveEnd, block.offset_min || 0);
      break;
    default:
      startTime = anchorStart;
  }

  // 6. Calculate Block End Time
  let endTime;
  
  // For 'link' and 'replace', we typically inherit duration unless specified
  if ((block.block_type === 'link' || block.block_type === 'replace') && !block.duration_min) {
    // Inherit duration from anchor
    const anchorDuration = anchor.duration_min || 0;
    endTime = addMinutes(startTime, anchorDuration);
  } else {
    // Use fixed duration
    endTime = addMinutes(startTime, block.duration_min || 10); // Default 10 if missing
  }

  return {
    startTime,
    endTime,
    isOrphaned: false
  };
}

/**
 * Helper to parse HH:MM string into a Date object on a specific date.
 *
 * CRITICAL FIX (2026-02-13): When sessionDate is "YYYY-MM-DD" (no time/zone),
 * `new Date("2026-02-13")` parses as midnight UTC = Feb 12 7pm ET.
 * This caused all stream blocks to resolve to the WRONG date, so isCurrent
 * was always false and everything appeared greyed out.
 *
 * Fix: Parse "YYYY-MM-DD" with explicit local-time components to avoid
 * the UTC midnight shift.
 */
function parseTimeOnDate(timeStr, dateContext) {
  if (!timeStr) return new Date(); // Fallback

  // Parse dateContext safely — avoid UTC midnight shift for "YYYY-MM-DD" strings
  let year, month, day;
  if (typeof dateContext === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateContext)) {
    // Explicit component extraction avoids Date constructor UTC parsing
    const parts = dateContext.split('-').map(Number);
    year = parts[0];
    month = parts[1] - 1; // JS months are 0-based
    day = parts[2];
  } else {
    const dateBase = dateContext ? new Date(dateContext) : new Date();
    year = dateBase.getFullYear();
    month = dateBase.getMonth();
    day = dateBase.getDate();
  }

  // Parse HH:MM and set on the correct local date
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month, day, hours, minutes, 0, 0);
}