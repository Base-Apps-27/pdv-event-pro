import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * submitArtsSegment.js
 * Public endpoint to save arts data directly to a Segment entity.
 * Called from the public Arts Submission form (serveArtsSubmission).
 * 
 * No auth required — saves using service role.
 * Rate-limited to prevent abuse.
 * Only updates arts-related fields to prevent overwriting other segment data.
 */

const rateLimiter = new Map();

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Rate limiting: 10 requests per minute per IP
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowMs = 60000;
    const maxAttempts = 10;

    if (!rateLimiter.has(clientIp)) rateLimiter.set(clientIp, []);
    const attempts = rateLimiter.get(clientIp).filter(t => now - t < windowMs);
    if (attempts.length >= maxAttempts) {
        return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
    }
    attempts.push(now);
    rateLimiter.set(clientIp, attempts);

    try {
        const base44 = createClientFromRequest(req);
        const { segment_id, submitter_name, submitter_email, data } = await req.json();

        if (!segment_id) {
            return Response.json({ error: 'Missing segment_id' }, { status: 400, headers: corsHeaders });
        }
        if (!data || typeof data !== 'object') {
            return Response.json({ error: 'Missing data payload' }, { status: 400, headers: corsHeaders });
        }

        // Verify segment exists
        const segment = await base44.asServiceRole.entities.Segment.get(segment_id);
        if (!segment) {
            return Response.json({ error: 'Segment not found' }, { status: 404, headers: corsHeaders });
        }

        // Whitelist of allowed arts fields to prevent overwriting non-arts data
        const ALLOWED_FIELDS = [
            'art_types',
            // Dance
            'dance_has_song', 'dance_handheld_mics', 'dance_headset_mics',
            'dance_start_cue', 'dance_end_cue',
            'dance_song_title', 'dance_song_source', 'dance_song_owner',
            'dance_song_2_title', 'dance_song_2_url', 'dance_song_2_owner',
            'dance_song_3_title', 'dance_song_3_url', 'dance_song_3_owner',
            // Drama
            'drama_has_song', 'drama_handheld_mics', 'drama_headset_mics',
            'drama_start_cue', 'drama_end_cue',
            'drama_song_title', 'drama_song_source', 'drama_song_owner',
            'drama_song_2_title', 'drama_song_2_url', 'drama_song_2_owner',
            'drama_song_3_title', 'drama_song_3_url', 'drama_song_3_owner',
            // Video
            'has_video', 'video_name', 'video_url', 'video_owner',
            'video_length_sec', 'video_location',
            // Spoken Word (2026-02-28)
            'spoken_word_mic_position', 'spoken_word_has_music',
            'spoken_word_music_title', 'spoken_word_music_url', 'spoken_word_music_owner',
            'spoken_word_notes',
            'spoken_word_description', 'spoken_word_speaker', 'spoken_word_script_url',
            'spoken_word_audio_url',
            // Painting (2026-02-28)
            'painting_needs_easel', 'painting_needs_drop_cloth', 'painting_needs_lighting',
            'painting_canvas_size', 'painting_other_setup', 'painting_notes',
            // Ordering (2026-02-28: art type performance sequence)
            'arts_type_order',
            // Other / General
            'art_other_description', 'arts_run_of_show_url', 'description_details',
        ];

        // Build sanitized update payload
        const updatePayload = {};
        for (const field of ALLOWED_FIELDS) {
            if (data[field] !== undefined) {
                updatePayload[field] = data[field];
            }
        }

        // Clear url_meta fields when URLs change (so they can be re-fetched)
        if (data.arts_run_of_show_url !== undefined) {
            updatePayload.arts_run_of_show_url_meta = null;
        }
        if (data.dance_song_source !== undefined) {
            updatePayload.dance_song_1_url_meta = null;
        }
        if (data.dance_song_2_url !== undefined) {
            updatePayload.dance_song_2_url_meta = null;
        }
        if (data.dance_song_3_url !== undefined) {
            updatePayload.dance_song_3_url_meta = null;
        }
        if (data.drama_song_source !== undefined) {
            updatePayload.drama_song_1_url_meta = null;
        }
        if (data.drama_song_2_url !== undefined) {
            updatePayload.drama_song_2_url_meta = null;
        }
        if (data.drama_song_3_url !== undefined) {
            updatePayload.drama_song_3_url_meta = null;
        }
        if (data.video_url !== undefined) {
            updatePayload.video_url_meta = null;
        }
        // 2026-02-28 audit: clear meta for all URL fields that have _meta counterparts

        // ── ARTS SUBMISSION TRACKING (2026-02-27) ──
        // 1. Stamp the segment with who submitted and when
        updatePayload.arts_last_submitted_by = `${submitter_name || 'Unknown'} (${submitter_email || 'no-email'})`;
        updatePayload.arts_last_submitted_at = new Date().toISOString();

        // 2. Save to the Segment entity
        await base44.asServiceRole.entities.Segment.update(segment_id, updatePayload);

        // 3. Compute which fields actually changed (for the audit log)
        const fieldsChanged = [];
        for (const field of Object.keys(updatePayload)) {
            // Skip meta/tracking fields from diff
            if (['arts_last_submitted_by', 'arts_last_submitted_at'].includes(field)) continue;
            const oldVal = JSON.stringify(segment[field] ?? null);
            const newVal = JSON.stringify(updatePayload[field] ?? null);
            if (oldVal !== newVal) fieldsChanged.push(field);
        }

        // 4. Create immutable audit log entry (ArtsSubmissionLog)
        // Resolve event_id from the segment's session for grouping
        let eventId = null;
        if (segment.session_id) {
            try {
                const sessions = await base44.asServiceRole.entities.Session.filter({ id: segment.session_id });
                if (sessions[0]?.event_id) eventId = sessions[0].event_id;
            } catch (e) { /* non-critical — log continues without event_id */ }
        }

        await base44.asServiceRole.entities.ArtsSubmissionLog.create({
            segment_id: segment_id,
            event_id: eventId || '',
            segment_title: segment.title || '',
            submitter_name: submitter_name || 'Unknown',
            submitter_email: submitter_email || '',
            submitted_at: new Date().toISOString(),
            data_snapshot: updatePayload,
            fields_changed: fieldsChanged,
        });

        console.log(`[ArtsSubmission] Segment ${segment_id} updated by ${submitter_name} (${submitter_email}). Changed: ${fieldsChanged.join(', ') || 'none'}`);

        return Response.json({ success: true, fields_changed: fieldsChanged.length }, { headers: corsHeaders });

    } catch (error) {
        console.error('[ArtsSubmission] Error:', error);
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});