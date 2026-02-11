/**
 * Service Time Math — Phase 2 Foundation Code Quality (2026-02-11)
 * 
 * Centralizes segment time calculation logic that was duplicated in:
 * - WeeklyServiceManager (calculateServiceTimes, time rendering in print/screen)
 * - CustomServiceBuilder (calculateTotalTime, syncToSession)
 * - PublicProgramView (segment time derivation)
 * 
 * Uses date-fns internally for time parsing/formatting.
 * 
 * Decision: "Extract service time math utilities" — Phase 2 shared utility.
 */

import { addMinutes, parse, format } from "date-fns";

/**
 * Calculates segment start/end times given a base start time and ordered segments.
 * 
 * @param {string} baseTime - Start time in "HH:mm" or "h:mma" format (e.g., "9:30am", "10:00")
 * @param {Array} segments - Array of segment objects with `duration` (minutes) and optional `type`
 * @param {Object} options
 * @param {string[]} options.skipTypes - Segment types to skip in time calculation (e.g., ['break', 'ministry'])
 * @returns {Array<{startTime: string, endTime: string, startTimeFormatted: string, endTimeFormatted: string, index: number}>}
 */
export function calculateSegmentTimes(baseTime, segments, options = {}) {
  const { skipTypes = [] } = options;

  if (!baseTime || !segments?.length) return [];

  // Parse base time — support both "h:mma" (9:30am) and "HH:mm" (10:00) formats
  let currentTime;
  try {
    if (/am|pm/i.test(baseTime)) {
      currentTime = parse(baseTime, "h:mma", new Date());
    } else {
      currentTime = parse(baseTime, "HH:mm", new Date());
    }
  } catch {
    console.warn('[serviceTimeMath] Failed to parse baseTime:', baseTime);
    return [];
  }

  if (isNaN(currentTime.getTime())) {
    console.warn('[serviceTimeMath] Invalid baseTime after parse:', baseTime);
    return [];
  }

  return segments.map((segment, idx) => {
    const startTime = format(currentTime, "HH:mm");
    const startTimeFormatted = format(currentTime, "h:mm a");

    const duration = segment.duration || 0;
    const shouldSkip = skipTypes.includes(segment.type?.toLowerCase?.());

    if (!shouldSkip && duration > 0) {
      currentTime = addMinutes(currentTime, duration);
    }

    const endTime = format(currentTime, "HH:mm");
    const endTimeFormatted = format(currentTime, "h:mm a");

    return {
      index: idx,
      startTime,
      endTime,
      startTimeFormatted,
      endTimeFormatted,
      duration,
    };
  });
}

/**
 * Calculates total service duration and end time.
 * 
 * @param {string} baseTime - Start time (e.g., "9:30am" or "10:00")
 * @param {Array} segments - Array of segments with `duration`
 * @param {Object} options
 * @param {string[]} options.skipTypes - Types to exclude from total
 * @param {number} options.targetDuration - Target duration in minutes for overage calculation
 * @returns {{ totalDuration: number, startTime: string, endTime: string, isOverage: boolean, overageAmount: number }}
 */
export function calculateServiceTotals(baseTime, segments, options = {}) {
  const { skipTypes = [], targetDuration = 90 } = options;

  if (!segments?.length) {
    return {
      totalDuration: 0,
      startTime: baseTime || "",
      endTime: baseTime || "",
      isOverage: false,
      overageAmount: 0,
    };
  }

  const totalDuration = segments
    .filter(seg => !skipTypes.includes(seg.type?.toLowerCase?.()))
    .reduce((sum, seg) => sum + (seg.duration || 0), 0);

  let startDate;
  try {
    if (/am|pm/i.test(baseTime)) {
      startDate = parse(baseTime, "h:mma", new Date());
    } else {
      startDate = parse(baseTime, "HH:mm", new Date());
    }
  } catch {
    return {
      totalDuration,
      startTime: baseTime || "",
      endTime: "N/A",
      isOverage: totalDuration > targetDuration,
      overageAmount: Math.max(0, totalDuration - targetDuration),
    };
  }

  if (isNaN(startDate.getTime())) {
    return {
      totalDuration,
      startTime: baseTime || "",
      endTime: "N/A",
      isOverage: totalDuration > targetDuration,
      overageAmount: Math.max(0, totalDuration - targetDuration),
    };
  }

  const endDate = addMinutes(startDate, totalDuration);

  return {
    totalDuration,
    startTime: format(startDate, "h:mm a"),
    endTime: format(endDate, "h:mm a"),
    isOverage: totalDuration > targetDuration,
    overageAmount: Math.max(0, totalDuration - targetDuration),
  };
}

/**
 * Adds minutes to a HH:mm time string.
 * Thin wrapper over date-fns for consistent usage.
 * 
 * @param {string} timeStr - Time in "HH:mm" format
 * @param {number} minutes - Minutes to add (can be negative)
 * @returns {string} Resulting time in "HH:mm" format, or original if parse fails
 */
export function addMinutesToTimeStr(timeStr, minutes) {
  if (!timeStr || typeof minutes !== 'number') return timeStr || "";
  try {
    const date = parse(timeStr, "HH:mm", new Date());
    if (isNaN(date.getTime())) return timeStr;
    const result = addMinutes(date, minutes);
    return format(result, "HH:mm");
  } catch {
    return timeStr;
  }
}

/**
 * Formats a "HH:mm" or "h:mma" time to "h:mm a" display format.
 * 
 * @param {string} timeStr - Time string
 * @returns {string} Formatted display time (e.g., "9:30 AM")
 */
export function formatTimeDisplay(timeStr) {
  if (!timeStr) return "";
  try {
    let date;
    if (/am|pm/i.test(timeStr)) {
      date = parse(timeStr, "h:mma", new Date());
    } else {
      date = parse(timeStr, "HH:mm", new Date());
    }
    if (isNaN(date.getTime())) return timeStr;
    return format(date, "h:mm a");
  } catch {
    return timeStr;
  }
}