import { addMinutesToTime } from './liveStatusHelpers';

/**
 * Live timing adjustment application logic
 * Handles offset-based adjustments for all service types
 */

/**
 * Applies live timing adjustments to segments based on adjustment type
 * ONE function handles weekly (time_slot), custom (global), and event (session) adjustments
 * 
 * @param {Array} segments - Normalized segments to adjust
 * @param {Array} adjustments - LiveTimeAdjustment records
 * @param {string} serviceType - "weekly" | "custom" | "event"
 * @param {string} timeSlot - For weekly services: "9:30am" | "11:30am"
 * @param {string} sessionId - For events: session ID to match
 * @returns {Array} Adjusted segments with _adjusted flag and _offset value
 */
export function applyLiveAdjustments(segments, adjustments, serviceType, timeSlot = null, sessionId = null) {
  if (!adjustments?.length) return segments;
  
  return segments.map(segment => {
    // Find applicable adjustment for this segment
    const applicable = adjustments.find(adj => {
      // Weekly: match time_slot
      if (serviceType === 'weekly' && adj.adjustment_type === 'time_slot') {
        return adj.time_slot === timeSlot;
      }
      
      // Custom: global offset (applies to all segments)
      if (serviceType === 'custom' && adj.adjustment_type === 'global') {
        return true;
      }
      
      // Event: match session
      if (serviceType === 'event' && adj.adjustment_type === 'session') {
        return segment.session_id === adj.session_id || segment.session_id === sessionId;
      }
      
      return false;
    });
    
    if (!applicable) return segment;
    
    // Apply offset to times
    return {
      ...segment,
      start_time: addMinutesToTime(segment.start_time, applicable.offset_minutes),
      end_time: addMinutesToTime(segment.end_time, applicable.offset_minutes),
      _adjusted: true,
      _offset: applicable.offset_minutes
    };
  });
}

/**
 * Gets the current offset for a specific target
 * 
 * @param {Array} adjustments - LiveTimeAdjustment records
 * @param {string} serviceType - "weekly" | "custom" | "event"
 * @param {Object} context - { timeSlot?, sessionId? }
 * @returns {number} Current offset in minutes (0 if none)
 */
export function getCurrentOffset(adjustments, serviceType, context = {}) {
  if (!adjustments?.length) return 0;
  
  const applicable = adjustments.find(adj => {
    if (serviceType === 'weekly' && adj.adjustment_type === 'time_slot') {
      return adj.time_slot === context.timeSlot;
    }
    if (serviceType === 'custom' && adj.adjustment_type === 'global') {
      return true;
    }
    if (serviceType === 'event' && adj.adjustment_type === 'session') {
      return adj.session_id === context.sessionId;
    }
    return false;
  });
  
  return applicable?.offset_minutes || 0;
}