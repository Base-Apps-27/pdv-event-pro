import { format } from 'date-fns';

/**
 * Segment data normalization utilities
 * Converts all service data sources into uniform segment structure
 */

/**
 * Normalizes service data into uniform segment array with stable IDs
 * 
 * Input: Raw Service or Event data
 * Output: Array of NormalizedSegments with:
 *   - id (stable across renders)
 *   - source ('entity' | 'json')
 *   - serviceType ('event' | 'weekly' | 'custom')
 *   - date (ISO date string)
 *   - all original segment fields
 * 
 * @param {Object} serviceData - Raw service/event data
 * @param {string} serviceType - "weekly" | "custom" | "event"
 * @returns {Array} Normalized segments
 */
export function normalizeServiceData(serviceData, serviceType) {
  let segments = [];
  let contextDate = serviceData.date || format(new Date(), 'yyyy-MM-dd');
  
  switch (serviceType) {
    case 'weekly':
      // Extract from time slots
      if (serviceData['9:30am']) {
        segments.push(...serviceData['9:30am'].map(seg => ({
          ...seg,
          timeSlot: '9:30am',
          date: contextDate
        })));
      }
      if (serviceData['11:30am']) {
        segments.push(...serviceData['11:30am'].map(seg => ({
          ...seg,
          timeSlot: '11:30am',
          date: contextDate
        })));
      }
      break;
      
    case 'custom':
      // Direct from segments array
      segments = (serviceData.segments || []).map(seg => ({
        ...seg,
        date: contextDate
      }));
      break;
      
    case 'event':
      // Already normalized (entities from sessions)
      segments = serviceData.segments || [];
      break;
  }
  
  // Add stable IDs and source metadata
  return segments.map((seg, idx) => ({
    ...seg,
    id: seg.id || generateStableId(serviceType, contextDate, seg, idx),
    source: seg.id ? 'entity' : 'json',
    serviceType,
    date: seg.date || contextDate,
  }));
}

/**
 * Generates stable ID for JSON segments (not entity-backed)
 * Uses date + time + index to ensure consistency across renders
 * 
 * @param {string} serviceType
 * @param {string} date - ISO date
 * @param {Object} segment
 * @param {number} index
 * @returns {string} Stable ID
 */
function generateStableId(serviceType, date, segment, index) {
  const timeComponent = segment.start_time?.replace(':', '') || '0000';
  const titleComponent = segment.title?.substring(0, 10).replace(/\s/g, '-') || 'untitled';
  return `${serviceType}-${date}-${timeComponent}-${titleComponent}-${index}`;
}

/**
 * Normalizes songs array from various formats into consistent structure
 * Handles both canonical data.songs and legacy flat song_X_... fields
 * 
 * @param {Object} segment - Raw segment data
 * @returns {Array} Normalized songs: [{ title, lead, key }]
 */
export function getNormalizedSongs(segment) {
  // Check canonical location first
  if (segment.data?.songs && Array.isArray(segment.data.songs)) {
    return segment.data.songs;
  }
  
  // Check root songs array
  if (segment.songs && Array.isArray(segment.songs)) {
    return segment.songs;
  }
  
  // Extract from flat song_X_... fields
  const songs = [];
  const numberOfSongs = segment.number_of_songs || 0;
  
  for (let i = 1; i <= numberOfSongs; i++) {
    const title = segment[`song_${i}_title`];
    if (title) {
      songs.push({
        title,
        lead: segment[`song_${i}_lead`] || null,
        key: segment[`song_${i}_key`] || null,
      });
    }
  }
  
  return songs;
}