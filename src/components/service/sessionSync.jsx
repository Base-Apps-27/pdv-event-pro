/**
 * sessionSync.js
 * Phase 3C extraction: Syncs Service JSON to Session/Segment entities for Live Control.
 * 
 * REFACTOR (2026-02-24): Switched from "Destructive Sync" (Delete All/Create All) 
 * to "Smart Upsert" (Update existing, Create new, Delete missing).
 * This preserves entity IDs, preventing breaks in Live Control and other references.
 *
 * @param {object} base44 - The base44 SDK client instance
 * @param {object} serviceResult - The saved Service entity result
 * @param {Array} segments - The serviceData.segments array (from UI state)
 */

import { addMinutes, parse, format } from "date-fns";
import { getSegmentData } from "@/components/utils/segmentDataUtils";

export async function syncToSession(base44, serviceResult, segments) {
  if (!serviceResult || !serviceResult.id) return;
  
  const serviceId = serviceResult.id;
  
  // 1. Find or Create Session (UPSERT)
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
  
  // 2. Fetch ALL existing segments for this session
  const existingSegments = await base44.entities.Segment.filter({ session_id: session.id });
  
  // Separate into Parents and Children (by ID) for easier lookup
  const dbParents = existingSegments.filter(s => !s.parent_segment_id);
  const dbChildren = existingSegments.filter(s => s.parent_segment_id);
  
  // Map ID -> Segment for O(1) lookup
  const dbParentMap = new Map(dbParents.map(s => [s.id, s]));
  
  // Track IDs processed to identify deletions
  const processedParentIds = new Set();
  
  // 3. Process UI Segments (Parents)
  // Default to 10:00 if time is missing/invalid
  let currentTime = new Date();
  try {
    currentTime = parse(serviceResult.time || "10:00", "HH:mm", new Date());
  } catch (e) {
    currentTime = parse("10:00", "HH:mm", new Date());
  }
  
  for (let i = 0; i < segments.length; i++) {
    const segData = segments[i];
    // Use helper to get data (prioritizes data object, falls back to root)
    const getData = (field) => getSegmentData(segData, field);
    
    // --- Calculate Timings ---
    const duration = Number(segData.duration) || 0;
    const startTimeStr = format(currentTime, "HH:mm");
    currentTime = addMinutes(currentTime, duration);
    const endTimeStr = format(currentTime, "HH:mm");
    
    // --- Prepare Entity Payload ---
    // Flatten songs
    const flatSongs = {};
    const songs = getData('songs');
    if (songs && Array.isArray(songs)) {
      songs.forEach((song, idx) => {
        if (idx < 6) {
          flatSongs[`song_${idx+1}_title`] = song.title || "";
          flatSongs[`song_${idx+1}_lead`] = song.lead || "";
          flatSongs[`song_${idx+1}_key`] = song.key || "";
        }
      });
    }
    
    const parentPayload = {
      session_id: session.id,
      service_id: serviceId,
      order: i + 1,
      title: segData.title || "Untitled",
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
      message_title: getData('messageTitle') || getData('message_title'),
      scripture_references: getData('verse') || getData('scripture_references'),
      presentation_url: getData('presentation_url'),
      notes_url: getData('notes_url'),
      content_is_slides_only: !!getData('content_is_slides_only'),
      parsed_verse_data: getData('parsed_verse_data'),
      ...flatSongs,
      segment_actions: getData('actions'),
      requires_translation: !!getData('translator'),
      show_in_general: true
    };

    // --- UPSERT PARENT ---
    let parentId = null;
    const entityId = segData._entityId;
    
    if (entityId && dbParentMap.has(entityId)) {
      // UPDATE
      await base44.entities.Segment.update(entityId, parentPayload);
      parentId = entityId;
      processedParentIds.add(entityId);
    } else {
      // CREATE
      const created = await base44.entities.Segment.create(parentPayload);
      parentId = created.id;
      // Note: We don't update UI state here (it's a sync function), 
      // but next load will pick up the new ID.
    }
    
    // --- SYNC CHILDREN (Sub-asignaciones) ---
    // If Alabanza with sub-asignaciones
    if ((segData.type === 'Alabanza' || segData.type === 'Worship') && segData.sub_asignaciones && segData.sub_asignaciones.length > 0) {
      // Get existing children for THIS parent
      const myDbChildren = dbChildren.filter(c => c.parent_segment_id === parentId);
      const myDbChildMap = new Map(myDbChildren.map(c => [c.id, c]));
      const processedChildIds = new Set();
      
      let subStartTime = parse(startTimeStr, "HH:mm", new Date());
      
      for (let j = 0; j < segData.sub_asignaciones.length; j++) {
        const sub = segData.sub_asignaciones[j];
        const subDuration = Number(sub.duration) || 5;
        const subStartStr = format(subStartTime, "HH:mm");
        subStartTime = addMinutes(subStartTime, subDuration);
        const subEndStr = format(subStartTime, "HH:mm");
        
        const childPayload = {
          session_id: session.id,
          service_id: serviceId,
          parent_segment_id: parentId,
          order: j + 1,
          title: sub.title || `Ministración ${j + 1}`,
          segment_type: 'Ministración',
          start_time: subStartStr,
          end_time: subEndStr,
          duration_min: subDuration,
          presenter: sub.presenter || "",
          show_in_general: false
        };
        
        const subEntityId = sub._entityId; // We added this in L1.1 fix
        
        if (subEntityId && myDbChildMap.has(subEntityId)) {
          // UPDATE CHILD
          await base44.entities.Segment.update(subEntityId, childPayload);
          processedChildIds.add(subEntityId);
        } else {
          // CREATE CHILD
          await base44.entities.Segment.create(childPayload);
        }
      }
      
      // DELETE ORPHANED CHILDREN
      const orphans = myDbChildren.filter(c => !processedChildIds.has(c.id));
      if (orphans.length > 0) {
        await Promise.all(orphans.map(c => base44.entities.Segment.delete(c.id)));
      }
      
      // Update parent duration to match sum of children if mismatched
      const totalSubDuration = segData.sub_asignaciones.reduce((sum, sub) => sum + (Number(sub.duration) || 5), 0);
      if (totalSubDuration !== duration) {
         const newEndTime = addMinutes(parse(startTimeStr, "HH:mm", new Date()), totalSubDuration);
         await base44.entities.Segment.update(parentId, {
           duration_min: totalSubDuration,
           end_time: format(newEndTime, "HH:mm")
         });
         currentTime = newEndTime;
      }
    } else {
      // If parent has NO sub-asignaciones in UI, verify if it has orphans in DB (e.g. removed all subs)
      const myDbChildren = dbChildren.filter(c => c.parent_segment_id === parentId);
      if (myDbChildren.length > 0) {
        await Promise.all(myDbChildren.map(c => base44.entities.Segment.delete(c.id)));
      }
    }
  }
  
  // 4. Delete Removed Parents
  const removedParents = dbParents.filter(p => !processedParentIds.has(p.id));
  if (removedParents.length > 0) {
    const removedParentIds = new Set(removedParents.map(p => p.id));
    const childrenOfRemoved = dbChildren.filter(c => removedParentIds.has(c.parent_segment_id));
    
    await Promise.all([
      ...removedParents.map(p => base44.entities.Segment.delete(p.id)),
      ...childrenOfRemoved.map(c => base44.entities.Segment.delete(c.id))
    ]);
  }
}