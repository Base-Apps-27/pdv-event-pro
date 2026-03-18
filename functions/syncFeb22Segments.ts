import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get the Feb 22 service
    const services = await base44.entities.Service.filter({ 
      date: '2026-02-22',
      service_type: 'weekly'
    });
    
    if (services.length === 0) {
      return Response.json({ error: 'No service found for Feb 22' }, { status: 404 });
    }
    
    const service = services[0];
    const serviceId = service.id;
    
    // Get the two sessions (9:30am and 11:30am)
    const sessions = await base44.entities.Session.filter({ service_id: serviceId });
    
    if (sessions.length === 0) {
      return Response.json({ error: 'No sessions found' }, { status: 404 });
    }
    
    // Sort sessions by order (9:30am = order 1, 11:30am = order 2)
    sessions.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const slot930 = sessions[0];
    const slot1130 = sessions[1];
    
    const segmentsCreated = [];
    
    // Create segments for 9:30am slot
    const segments930 = service["9:30am"] || [];
    let currentTime930 = new Date('2026-02-22T09:30:00');
    
    for (let i = 0; i < segments930.length; i++) {
      const seg = segments930[i];
      const duration = seg.duration || 0;
      const startTime = `${String(currentTime930.getHours()).padStart(2, '0')}:${String(currentTime930.getMinutes()).padStart(2, '0')}`;
      currentTime930 = new Date(currentTime930.getTime() + duration * 60000);
      const endTime = `${String(currentTime930.getHours()).padStart(2, '0')}:${String(currentTime930.getMinutes()).padStart(2, '0')}`;
      
      // Flatten songs
      const songs = seg.songs || [];
      const songFields = {};
      songs.forEach((song, idx) => {
        if (idx < 6 && song.title) {
          songFields[`song_${idx + 1}_title`] = song.title;
          songFields[`song_${idx + 1}_lead`] = song.lead || '';
          songFields[`song_${idx + 1}_key`] = song.key || '';
        }
      });
      
      const segmentData = {
        session_id: slot930.id,
        service_id: serviceId,
        order: i + 1,
        title: seg.title || '',
        segment_type: seg.type || 'Especial',
        start_time: startTime,
        end_time: endTime,
        duration_min: duration,
        presenter: seg.data?.presenter || seg.data?.leader || seg.data?.preacher || '',
        translator_name: seg.data?.translator || '',
        requires_translation: !!seg.data?.translator || !!seg.requires_translation,
        description_details: seg.data?.description_details || '',
        projection_notes: seg.projection_notes || '',
        message_title: seg.data?.message_title || seg.data?.title || '',
        scripture_references: seg.data?.verse || seg.data?.scripture_references || '',
        parsed_verse_data: seg.parsed_verse_data || null,
        segment_actions: seg.actions || [],
        number_of_songs: songs.length,
        ...songFields,
        ui_fields: seg.fields || [],
        ui_sub_assignments: seg.sub_assignments || [],
        show_in_general: true,
      };
      
      const created = await base44.entities.Segment.create(segmentData);
      segmentsCreated.push(created);
    }
    
    // Create segments for 11:30am slot
    const segments1130 = service["11:30am"] || [];
    let currentTime1130 = new Date('2026-02-22T11:30:00');
    
    for (let i = 0; i < segments1130.length; i++) {
      const seg = segments1130[i];
      const duration = seg.duration || 0;
      const startTime = `${String(currentTime1130.getHours()).padStart(2, '0')}:${String(currentTime1130.getMinutes()).padStart(2, '0')}`;
      currentTime1130 = new Date(currentTime1130.getTime() + duration * 60000);
      const endTime = `${String(currentTime1130.getHours()).padStart(2, '0')}:${String(currentTime1130.getMinutes()).padStart(2, '0')}`;
      
      // Flatten songs
      const songs = seg.songs || [];
      const songFields = {};
      songs.forEach((song, idx) => {
        if (idx < 6 && song.title) {
          songFields[`song_${idx + 1}_title`] = song.title;
          songFields[`song_${idx + 1}_lead`] = song.lead || '';
          songFields[`song_${idx + 1}_key`] = song.key || '';
        }
      });
      
      const segmentData = {
        session_id: slot1130.id,
        service_id: serviceId,
        order: i + 1,
        title: seg.title || '',
        segment_type: seg.type || 'Especial',
        start_time: startTime,
        end_time: endTime,
        duration_min: duration,
        presenter: seg.data?.presenter || seg.data?.leader || seg.data?.preacher || '',
        translator_name: seg.data?.translator || '',
        requires_translation: !!seg.data?.translator || !!seg.requires_translation,
        description_details: seg.data?.description_details || '',
        projection_notes: seg.projection_notes || '',
        message_title: seg.data?.message_title || seg.data?.title || '',
        scripture_references: seg.data?.verse || seg.data?.scripture_references || '',
        parsed_verse_data: seg.parsed_verse_data || null,
        segment_actions: seg.actions || [],
        number_of_songs: songs.length,
        ...songFields,
        ui_fields: seg.fields || [],
        ui_sub_assignments: seg.sub_assignments || [],
        show_in_general: true,
      };
      
      const created = await base44.entities.Segment.create(segmentData);
      segmentsCreated.push(created);
    }
    
    return Response.json({
      success: true,
      service_id: serviceId,
      segments_created: segmentsCreated.length,
      slot_930_count: segments930.length,
      slot_1130_count: segments1130.length,
    });
    
  } catch (error) {
    console.error('[SYNC FEB 22] Error:', error);
    return Response.json({
      error: 'Internal server error',
    }, { status: 500 });
  }
});