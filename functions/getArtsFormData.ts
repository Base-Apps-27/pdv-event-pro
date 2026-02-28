/**
 * getArtsFormData.js
 * 
 * JSON data endpoint for the React-based Arts Submission form.
 * Replaces the SSR data-fetching portion of serveArtsSubmission.
 * 
 * CSP Migration (2026-02-27): Platform CDN injects restrictive CSP
 * that blocks inline scripts in function-served HTML. Moving form
 * rendering to React pages bypasses CDN-level CSP.
 * 
 * Auth: None required (public form). Uses asServiceRole for reads.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);

        // Accept event_id from URL params or POST body
        let eventIdParam = url.searchParams.get('event_id');
        if (!eventIdParam && req.method === 'POST') {
            try {
                const body = await req.json();
                eventIdParam = body.event_id;
            } catch (e) { /* no body */ }
        }

        let targetEvent = null;

        if (eventIdParam) {
            targetEvent = await base44.asServiceRole.entities.Event.get(eventIdParam);
        } else {
            // Find next upcoming confirmed event
            const events = await base44.asServiceRole.entities.Event.filter({ status: 'confirmed' });
            const today = new Date().toISOString().split('T')[0];
            const upcoming = events.filter(e => e.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
            if (upcoming.length > 0) {
                targetEvent = upcoming[0];
            } else {
                const progress = await base44.asServiceRole.entities.Event.filter({ status: 'in_progress' });
                if (progress.length > 0) targetEvent = progress[0];
            }
        }

        if (!targetEvent) {
            return Response.json({
                error: 'No se encontró un evento activo. / No active event found.',
                event: null,
                segments: []
            }, { headers: corsHeaders });
        }

        // Fetch sessions and "Artes" segments
        const sessions = await base44.asServiceRole.entities.Session.filter({ event_id: targetEvent.id });
        const sessionsMap = {};
        sessions.forEach(s => { sessionsMap[s.id] = s; });

        let artsSegments = [];
        if (sessions.length > 0) {
            const segPromises = sessions.map(sess =>
                base44.asServiceRole.entities.Segment.filter({
                    session_id: sess.id,
                    segment_type: 'Artes'
                })
            );
            const results = await Promise.all(segPromises);
            artsSegments = results.flat();

            // Sort by session date then start_time
            artsSegments.sort((a, b) => {
                const sa = sessionsMap[a.session_id];
                const sb = sessionsMap[b.session_id];
                const da = (sa?.date || '') + (a.start_time || '');
                const db = (sb?.date || '') + (b.start_time || '');
                return da.localeCompare(db);
            });
        }

        // Determine if this is a "Única" event (strict media rules)
        const isUnicaEvent = targetEvent.name ? /\bÚnica\b/i.test(targetEvent.name) || /\bunica\b/i.test(targetEvent.name) : false;

        // Map segments to a client-safe format
        const segmentsData = artsSegments.map(seg => {
            const sess = sessionsMap[seg.session_id];
            return {
                id: seg.id,
                title: seg.title || 'Sin título',
                session_name: sess?.name || '',
                session_date: sess?.date || '',
                start_time: seg.start_time || '',
                presenter: seg.presenter || '',
                description_details: seg.description_details || '',
                art_types: seg.art_types || [],
                // Dance fields
                dance_has_song: seg.dance_has_song || false,
                dance_handheld_mics: seg.dance_handheld_mics || 0,
                dance_headset_mics: seg.dance_headset_mics || 0,
                dance_start_cue: seg.dance_start_cue || '',
                dance_end_cue: seg.dance_end_cue || '',
                dance_song_title: seg.dance_song_title || '',
                dance_song_source: seg.dance_song_source || '',
                dance_song_owner: seg.dance_song_owner || '',
                dance_song_2_title: seg.dance_song_2_title || '',
                dance_song_2_url: seg.dance_song_2_url || '',
                dance_song_2_owner: seg.dance_song_2_owner || '',
                dance_song_3_title: seg.dance_song_3_title || '',
                dance_song_3_url: seg.dance_song_3_url || '',
                dance_song_3_owner: seg.dance_song_3_owner || '',
                // Drama fields
                drama_has_song: seg.drama_has_song || false,
                drama_handheld_mics: seg.drama_handheld_mics || 0,
                drama_headset_mics: seg.drama_headset_mics || 0,
                drama_start_cue: seg.drama_start_cue || '',
                drama_end_cue: seg.drama_end_cue || '',
                drama_song_title: seg.drama_song_title || '',
                drama_song_source: seg.drama_song_source || '',
                drama_song_owner: seg.drama_song_owner || '',
                drama_song_2_title: seg.drama_song_2_title || '',
                drama_song_2_url: seg.drama_song_2_url || '',
                drama_song_2_owner: seg.drama_song_2_owner || '',
                drama_song_3_title: seg.drama_song_3_title || '',
                drama_song_3_url: seg.drama_song_3_url || '',
                drama_song_3_owner: seg.drama_song_3_owner || '',
                // Video fields
                has_video: seg.has_video || false,
                video_name: seg.video_name || '',
                video_url: seg.video_url || '',
                video_owner: seg.video_owner || '',
                video_length_sec: seg.video_length_sec || 0,
                video_location: seg.video_location || '',
                // Spoken Word (2026-02-28: added per Hybrid UX refactor)
                spoken_word_mic_position: seg.spoken_word_mic_position || '',
                spoken_word_has_music: seg.spoken_word_has_music || false,
                spoken_word_music_title: seg.spoken_word_music_title || '',
                spoken_word_music_url: seg.spoken_word_music_url || '',
                spoken_word_music_owner: seg.spoken_word_music_owner || '',
                spoken_word_notes: seg.spoken_word_notes || '',
                spoken_word_description: seg.spoken_word_description || '',
                spoken_word_speaker: seg.spoken_word_speaker || '',
                spoken_word_script_url: seg.spoken_word_script_url || '',
                spoken_word_audio_url: seg.spoken_word_audio_url || '',
                // Painting (2026-02-28: added per Hybrid UX refactor)
                painting_needs_easel: seg.painting_needs_easel || false,
                painting_needs_drop_cloth: seg.painting_needs_drop_cloth || false,
                painting_needs_lighting: seg.painting_needs_lighting || false,
                painting_canvas_size: seg.painting_canvas_size || '',
                painting_other_setup: seg.painting_other_setup || '',
                painting_notes: seg.painting_notes || '',
                // Other
                art_other_description: seg.art_other_description || '',
                arts_run_of_show_url: seg.arts_run_of_show_url || '',
                // Last submission info
                arts_last_submitted_by: seg.arts_last_submitted_by || '',
                arts_last_submitted_at: seg.arts_last_submitted_at || '',
            };
        });

        return Response.json({
            event: {
                id: targetEvent.id,
                name: targetEvent.name,
                location: targetEvent.location || '',
                start_date: targetEvent.start_date || '',
            },
            segments: segmentsData,
            isUnicaEvent
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('getArtsFormData error:', error);
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});