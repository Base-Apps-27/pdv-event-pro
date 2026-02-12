/**
 * sessionSync.js
 * Phase 3C extraction: Syncs Service JSON to Session/Segment entities for Live Control.
 * CRITICAL: This function mutates backend data (deletes and recreates segments).
 * Extracted VERBATIM — zero logic changes.
 *
 * @param {object} base44 - The base44 SDK client instance
 * @param {object} serviceResult - The saved Service entity result
 * @param {Array} segments - The serviceData.segments array (from UI state)
 */

import { addMinutes, parse, format } from "date-fns";
import { getSegmentData } from "@/components/utils/segmentDataUtils";

export async function syncToSession(base44, serviceResult, segments) {
  if (!serviceResult || !serviceResult.id) return;
  
  console.log('[SYNC] Starting sync to Session entities...');
  const serviceId = serviceResult.id;
  
  // 1. Find or Create Session
  let session = null;
  const existingSessions = await base44.entities.Session.filter({ service_id: serviceId });
  
  if (existingSessions.length > 0) {
    session = existingSessions[0];
    // Update session details if needed
    if (session.name !== serviceResult.name || session.date !== serviceResult.date || session.location !== serviceResult.location) {
       await base44.entities.Session.update(session.id, {
         name: serviceResult.name,
         date: serviceResult.date,
         location: serviceResult.location,
         planned_start_time: serviceResult.time
       });
    }
  } else {
    session = await base44.entities.Session.create({
      service_id: serviceId,
      name: serviceResult.name,
      date: serviceResult.date,
      location: serviceResult.location,
      planned_start_time: serviceResult.time,
      live_adjustment_enabled: false
    });
  }
  
  // 2. Sync Segments
  // We delete all existing segments for this session and recreate them to ensure order and content match perfectly.
  // NOTE: This resets "Live" status if it was active. This is a tradeoff for the Builder.
  const existingSegments = await base44.entities.Segment.filter({ session_id: session.id });
  if (existingSegments.length > 0) {
    // Parallel delete
    await Promise.all(existingSegments.map(s => base44.entities.Segment.delete(s.id)));
  }
  
  // 3. Create new Segments (including parent/child for sub-asignaciones)
  const newSegments = [];
  let currentTime = parse(serviceResult.time, "HH:mm", new Date());
  
  for (let i = 0; i < segments.length; i++) {
    const segData = segments[i];
    // Use helper to get data (prioritizes data object, falls back to root)
    const getData = (field) => getSegmentData(segData, field);
    
    const duration = segData.duration || 0;
    
    const startTimeStr = format(currentTime, "HH:mm");
    currentTime = addMinutes(currentTime, duration);
    const endTimeStr = format(currentTime, "HH:mm");
    
    // Flatten songs
    const flatSongs = {};
    const songs = getData('songs');
    if (songs && Array.isArray(songs)) {
      songs.forEach((song, idx) => {
        if (idx < 6) {
          flatSongs[`song_${idx+1}_title`] = song.title;
          flatSongs[`song_${idx+1}_lead`] = song.lead;
          flatSongs[`song_${idx+1}_key`] = song.key;
        }
      });
    }

    const parentSegmentData = {
      session_id: session.id,
      service_id: serviceId,
      order: i + 1,
      title: segData.title,
      segment_type: segData.type || 'Especial',
      start_time: startTimeStr,
      end_time: endTimeStr,
      duration_min: duration,
      presenter: getData('presenter'),
      translator_name: getData('translator'),
      description_details: getData('description_details') || getData('description'),
      coordinator_notes: getData('coordinator_notes'),
      projection_notes: getData('projection_notes'),
      sound_notes: getData('sound_notes'),
      ushers_notes: getData('ushers_notes'),
      translation_notes: getData('translation_notes'),
      stage_decor_notes: getData('stage_decor_notes'),
      message_title: getData('messageTitle'),
      scripture_references: getData('verse'),
      presentation_url: getData('presentation_url'),
      content_is_slides_only: !!getData('content_is_slides_only'),
      parsed_verse_data: getData('parsed_verse_data'),
      ...flatSongs,
      segment_actions: getData('actions'),
      requires_translation: !!getData('translator'),
      show_in_general: true
    };
    
    newSegments.push(parentSegmentData);
    
    // If Alabanza with sub-asignaciones, add child Ministración segments
    if (segData.type === 'Alabanza' && segData.sub_asignaciones && segData.sub_asignaciones.length > 0) {
      let subStartTime = currentTime = parse(startTimeStr, "HH:mm", new Date());
      
      segData.sub_asignaciones.forEach((sub, subIdx) => {
        const subDuration = sub.duration || 5;
        const subStartStr = format(subStartTime, "HH:mm");
        subStartTime = addMinutes(subStartTime, subDuration);
        const subEndStr = format(subStartTime, "HH:mm");
        
        newSegments.push({
          session_id: session.id,
          service_id: serviceId,
          parent_segment_id: "{PARENT_ID}", // Will be replaced after parent creation
          order: subIdx + 1,
          title: sub.title || `Ministración ${subIdx + 1}`,
          segment_type: 'Ministración',
          start_time: subStartStr,
          end_time: subEndStr,
          duration_min: subDuration,
          presenter: sub.presenter || "",
          show_in_general: true,
          _isSubAsignacion: true // Temporary marker for post-processing
        });
      });
      
      // Update parent duration to sum of all sub-asignaciones
      const totalSubDuration = segData.sub_asignaciones.reduce((sum, sub) => sum + (sub.duration || 5), 0);
      if (totalSubDuration !== duration) {
        parentSegmentData.duration_min = totalSubDuration;
        const newEndTime = addMinutes(parse(startTimeStr, "HH:mm", new Date()), totalSubDuration);
        parentSegmentData.end_time = format(newEndTime, "HH:mm");
      }
    }
  }
  
  // Batch create parent segments first, then update sub-segments with parent_segment_id
  const parentSegments = newSegments.filter(s => !s._isSubAsignacion);
  const subSegments = newSegments.filter(s => s._isSubAsignacion);
  
  const createdParents = await base44.entities.Segment.bulkCreate(parentSegments);
  
  // Create mapping of original indices to created parent IDs
  let parentIdMap = {};
  let parentIdx = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].type === 'Alabanza') {
      parentIdMap[i] = createdParents[parentIdx]?.id;
    }
    parentIdx++;
  }
  
  // Recreate sub-segments with correct parent_segment_id references
  if (subSegments.length > 0) {
    let segIdx = 0;
    const subSegmentsWithParent = subSegments.map((sub) => {
      // Find which parent this belongs to (iterate through original segments)
      for (let i = 0; i < segments.length; i++) {
        if (segments[i].type === 'Alabanza' && segments[i].sub_asignaciones?.length > 0) {
          if (parentIdMap[i]) {
            return {
              ...sub,
              parent_segment_id: parentIdMap[i],
              _isSubAsignacion: undefined
            };
          }
        }
      }
      return sub;
    });
    
    await base44.entities.Segment.bulkCreate(subSegmentsWithParent);
  }
  
  console.log('[SYNC] Completed sync to Session/Segments with sub-asignaciones');
}