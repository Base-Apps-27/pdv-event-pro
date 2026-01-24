import { format } from 'date-fns';

/**
 * Date-aware time comparison utilities for Live View
 * Handles segments from events (multi-day), weekly services, and custom services
 */

/**
 * Determines if a segment is currently active
 * Works for ALL segment types by using date context
 * 
 * @param {Object} segment - Normalized segment with start_time, end_time, date
 * @param {Date} currentTime - Current time to compare against
 * @returns {boolean}
 */
export function isSegmentCurrent(segment, currentTime) {
  if (!segment.start_time) return false;
  
  // Build full DateTime with date context
  const segmentDate = segment.date || format(currentTime, 'yyyy-MM-dd');
  const [h, m] = segment.start_time.split(':').map(Number);
  const segmentStart = new Date(segmentDate);
  segmentStart.setHours(h, m, 0, 0);
  
  // Use end_time or fallback to start_time
  const endTimeStr = segment.end_time || segment.start_time;
  const [eh, em] = endTimeStr.split(':').map(Number);
  const segmentEnd = new Date(segmentDate);
  segmentEnd.setHours(eh, em, 0, 0);
  
  return currentTime >= segmentStart && currentTime <= segmentEnd;
}

/**
 * Determines if a segment is upcoming (within threshold)
 * 
 * @param {Object} segment - Normalized segment with start_time, date
 * @param {Date} currentTime - Current time
 * @param {number} thresholdMinutes - Minutes ahead to consider "upcoming" (default 15)
 * @returns {boolean}
 */
export function isSegmentUpcoming(segment, currentTime, thresholdMinutes = 15) {
  if (!segment.start_time) return false;
  
  const segmentDate = segment.date || format(currentTime, 'yyyy-MM-dd');
  const [h, m] = segment.start_time.split(':').map(Number);
  const segmentStart = new Date(segmentDate);
  segmentStart.setHours(h, m, 0, 0);
  
  const diffMinutes = (segmentStart - currentTime) / (1000 * 60);
  return diffMinutes > 0 && diffMinutes <= thresholdMinutes;
}

/**
 * Gets current and next segments from any segment list
 * Handles multi-day events correctly by using date context
 * 
 * @param {Array} segments - Array of normalized segments
 * @param {Date} currentTime - Current time
 * @returns {Object} { current, next }
 */
export function getCurrentAndNextSegments(segments, currentTime) {
  // Sort by full date-time (not just time string)
  const sorted = [...segments].sort((a, b) => {
    const aDate = a.date || format(currentTime, 'yyyy-MM-dd');
    const bDate = b.date || format(currentTime, 'yyyy-MM-dd');
    const aTime = new Date(`${aDate} ${a.start_time}`);
    const bTime = new Date(`${bDate} ${b.start_time}`);
    return aTime - bTime;
  });
  
  const current = sorted.find(s => isSegmentCurrent(s, currentTime));
  
  const next = sorted.find(s => {
    const segmentDate = s.date || format(currentTime, 'yyyy-MM-dd');
    const [h, m] = s.start_time.split(':').map(Number);
    const segmentStart = new Date(segmentDate);
    segmentStart.setHours(h, m, 0, 0);
    return segmentStart > currentTime;
  });
  
  return { current, next };
}

/**
 * Adds minutes to a time string (HH:MM)
 * 
 * @param {string} timeStr - Time in HH:MM format
 * @param {number} minutes - Minutes to add (can be negative)
 * @returns {string} Adjusted time in HH:MM format
 */
export function addMinutesToTime(timeStr, minutes) {
  if (!timeStr) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m + minutes, 0, 0);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}