/**
 * syncGraduacionSegments.js
 * ONE-OFF SYNC: Lifts GRADUACIÓN DE ACADEMIA JSON segments → Segment entities.
 *
 * Service ID: 698ac5b10ae43cd1ca545107
 * Session ID: 698ac5b1837e071b6f43053b
 * Base time:  19:30 (from Session.planned_start_time, since Service.time is null)
 *
 * Admin-only. Safe to re-run (deletes & recreates segments).
 * After success, trigger refreshActiveProgram to update the cache.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SERVICE_ID = '698ac5b10ae43cd1ca545107';
const SESSION_ID = '698ac5b1837e071b6f43053b';
const BASE_TIME  = '19:30';

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // 1. Load the service
    const service = await base44.entities.Service.get(SERVICE_ID);
    if (!service) return Response.json({ error: 'Service not found' }, { status: 404 });

    const jsonSegments = service.segments || [];
    if (jsonSegments.length === 0) {
      return Response.json({ error: 'No JSON segments found on service' }, { status: 400 });
    }

    // 2. Delete existing Segment entities for this session
    const existing = await base44.entities.Segment.filter({ session_id: SESSION_ID });
    if (existing.length > 0) {
      await Promise.all(existing.map(s => base44.entities.Segment.delete(s.id)));
      console.log(`[syncGraduacion] Deleted ${existing.length} existing segments`);
    }

    // 3. Build new Segment entities from JSON, walking time from BASE_TIME
    let currentTime = BASE_TIME;
    const toCreate = [];

    for (let i = 0; i < jsonSegments.length; i++) {
      const seg = jsonSegments[i];

      // Resolve fields from both root and nested data object
      const get = (field) => {
        const val = seg[field];
        if (val !== undefined && val !== null && val !== '') return val;
        return seg.data?.[field] ?? '';
      };

      const duration = Number(seg.duration || 0);
      const startTime = currentTime;
      const endTime = addMinutes(startTime, duration);
      currentTime = endTime;

      // Flatten songs
      const songs = get('songs') || [];
      const flatSongs = {};
      if (Array.isArray(songs)) {
        songs.forEach((song, idx) => {
          if (idx < 6 && (song.title || song.lead)) {
            flatSongs[`song_${idx+1}_title`] = song.title || '';
            flatSongs[`song_${idx+1}_lead`]  = song.lead  || '';
            flatSongs[`song_${idx+1}_key`]   = song.key   || '';
          }
        });
      }

      toCreate.push({
        session_id:          SESSION_ID,
        service_id:          SERVICE_ID,
        order:               i + 1,
        title:               seg.title || `Segmento ${i + 1}`,
        segment_type:        seg.type || 'Especial',
        start_time:          startTime,
        end_time:            endTime,
        duration_min:        duration,
        presenter:           get('presenter') || get('leader') || '',
        translator_name:     get('translator') || '',
        description_details: get('description_details') || get('description') || '',
        coordinator_notes:   get('coordinator_notes') || '',
        projection_notes:    get('projection_notes') || '',
        sound_notes:         get('sound_notes') || '',
        ushers_notes:        get('ushers_notes') || '',
        translation_notes:   get('translation_notes') || '',
        stage_decor_notes:   get('stage_decor_notes') || '',
        message_title:       get('messageTitle') || '',
        scripture_references:get('verse') || '',
        presentation_url:    get('presentation_url') || '',
        content_is_slides_only: !!get('content_is_slides_only'),
        parsed_verse_data:   get('parsed_verse_data') || null,
        segment_actions:     get('actions') || [],
        requires_translation:!!(get('translator') || '').length,
        show_in_general:     true,
        ...flatSongs,
      });
    }

    const created = await base44.entities.Segment.bulkCreate(toCreate);
    console.log(`[syncGraduacion] Created ${created.length} segment entities`);

    // 4. Update Session.planned_start_time to ensure it's set
    await base44.entities.Session.update(SESSION_ID, {
      planned_start_time: BASE_TIME,
    });

    return Response.json({
      success: true,
      segments_created: created.length,
      base_time: BASE_TIME,
      session_id: SESSION_ID,
      service_id: SERVICE_ID,
      timeline: created.map(s => ({ title: s.title, start: s.start_time, end: s.end_time })),
    });

  } catch (error) {
    console.error('[syncGraduacion] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});