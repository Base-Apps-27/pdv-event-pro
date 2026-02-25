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
        if (data.drama_song_source !== undefined) {
            updatePayload.drama_song_1_url_meta = null;
        }

        // Save directly to the Segment entity
        await base44.asServiceRole.entities.Segment.update(segment_id, updatePayload);

        console.log(`[ArtsSubmission] Segment ${segment_id} updated by ${submitter_name} (${submitter_email})`);

        return Response.json({ success: true }, { headers: corsHeaders });

    } catch (error) {
        console.error('[ArtsSubmission] Error:', error);
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});