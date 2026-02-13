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
 * Helper to parse HH:MM string into a Date object on a specific date
 */
function parseTimeOnDate(timeStr, dateContext) {
  if (!timeStr) return new Date(); // Fallback
  const dateBase = dateContext ? new Date(dateContext) : new Date();
  const parsed = parse(timeStr, 'HH:mm', dateBase);
  
  // Preserve the date part from dateContext
  parsed.setFullYear(dateBase.getFullYear());
  parsed.setMonth(dateBase.getMonth());
  parsed.setDate(dateBase.getDate());
  
  return parsed;
}