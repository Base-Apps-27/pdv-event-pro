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

    // ── RATE LIMITING (2026-02-28: hardened with dual keys — IP + email) ──
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxPerIp = 8;     // 8 saves per minute per IP (down from 10)

    if (!rateLimiter.has(clientIp)) rateLimiter.set(clientIp, []);
    const ipAttempts = rateLimiter.get(clientIp).filter(t => now - t < windowMs);
    if (ipAttempts.length >= maxPerIp) {
        console.warn(`[ArtsSubmission] IP rate limit hit: ${clientIp}`);
        return Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: corsHeaders });
    }
    ipAttempts.push(now);
    rateLimiter.set(clientIp, ipAttempts);

    // Periodic cleanup of stale rate limiter entries (every 100 requests, prevent memory leak)
    if (Math.random() < 0.01) {
        for (const [key, arr] of rateLimiter.entries()) {
            const fresh = arr.filter(t => now - t < windowMs * 5);
            if (fresh.length === 0) rateLimiter.delete(key);
            else rateLimiter.set(key, fresh);
        }
    }

    try {
        const base44 = createClientFromRequest(req);

        // ── PARSE & VALIDATE BODY (2026-02-28: size guard) ──
        const rawBody = await req.text();
        const MAX_BODY_SIZE = 100_000; // 100KB — generous for form data, blocks blob injection
        if (rawBody.length > MAX_BODY_SIZE) {
            console.warn(`[ArtsSubmission] Payload too large: ${rawBody.length} bytes from ${clientIp}`);
            return Response.json({ error: 'Payload too large' }, { status: 413, headers: corsHeaders });
        }
        const body = JSON.parse(rawBody);
        const { segment_id, submitter_name, submitter_email, data } = body;

        // ── HONEYPOT CHECK (2026-02-28) ──
        // The frontend includes a hidden "website" field that humans never fill.
        // If it has a value, this is almost certainly a bot.
        if (body.website) {
            console.warn(`[ArtsSubmission] Honeypot triggered from ${clientIp}, email: ${submitter_email}`);
            // Return fake success to not reveal detection — bot thinks it worked
            return Response.json({ success: true, fields_changed: 0 }, { headers: corsHeaders });
        }

        // ── INPUT VALIDATION (2026-02-28: hardened) ──
        if (!segment_id || typeof segment_id !== 'string') {
            return Response.json({ error: 'Missing segment_id' }, { status: 400, headers: corsHeaders });
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return Response.json({ error: 'Missing data payload' }, { status: 400, headers: corsHeaders });
        }
        if (!submitter_name || typeof submitter_name !== 'string' || submitter_name.length < 2 || submitter_name.length > 200) {
            return Response.json({ error: 'Invalid submitter name' }, { status: 400, headers: corsHeaders });
        }
        if (!submitter_email || typeof submitter_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitter_email)) {
            return Response.json({ error: 'Invalid email' }, { status: 400, headers: corsHeaders });
        }

        // ── PER-EMAIL RATE LIMIT (2026-02-28: prevents a single identity from rapid-fire saves) ──
        const emailKey = `email:${submitter_email.toLowerCase()}`;
        const maxPerEmail = 6; // 6 saves per minute per email
        if (!rateLimiter.has(emailKey)) rateLimiter.set(emailKey, []);
        const emailAttempts = rateLimiter.get(emailKey).filter(t => now - t < windowMs);
        if (emailAttempts.length >= maxPerEmail) {
            console.warn(`[ArtsSubmission] Email rate limit hit: ${submitter_email}`);
            return Response.json({ error: 'Too many saves. Please wait a moment.' }, { status: 429, headers: corsHeaders });
        }
        emailAttempts.push(now);
        rateLimiter.set(emailKey, emailAttempts);

        // Layer 2: Entity-based persistent rate limit (SEC-3/4, 2026-03-02).
        // ArtsSubmissionLog serves as the audit trail — count recent entries.
        const twoMinAgo = new Date(Date.now() - 120000).toISOString();
        const recentArtsSubmissions = await base44.asServiceRole.entities.ArtsSubmissionLog.filter(
            { submitter_email: submitter_email.toLowerCase(), created_date: { $gte: twoMinAgo } },
            '-created_date', 20
        );
        if (recentArtsSubmissions.length >= 12) {
            console.warn(`[ArtsSubmission] Entity rate limit hit: ${submitter_email}, ${recentArtsSubmissions.length} in 2min`);
            return Response.json({ error: 'Too many saves. Please wait.' }, { status: 429, headers: corsHeaders });
        }

        // Verify segment exists
        const segment = await base44.asServiceRole.entities.Segment.get(segment_id);
        if (!segment) {
            return Response.json({ error: 'Segment not found' }, { status: 404, headers: corsHeaders });
        }

        // ── SEGMENT TYPE GUARD (2026-02-28: only allow writes to Artes segments) ──
        if (segment.segment_type !== 'Artes') {
            console.warn(`[ArtsSubmission] Rejected: segment ${segment_id} is type "${segment.segment_type}", not Artes. IP: ${clientIp}`);
            return Response.json({ error: 'This segment does not accept arts data' }, { status: 403, headers: corsHeaders });
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

        // SEC-6 (2026-03-02): Validate URL fields to prevent XSS/injection.
        // Only https:// and http:// schemes allowed. Blocks javascript:, data:, file:.
        const URL_FIELDS = [
            'dance_song_source', 'dance_song_2_url', 'dance_song_3_url',
            'drama_song_source', 'drama_song_2_url', 'drama_song_3_url',
            'video_url', 'arts_run_of_show_url',
            'spoken_word_music_url', 'spoken_word_script_url', 'spoken_word_audio_url',
        ];
        for (const field of URL_FIELDS) {
            const val = data[field];
            if (val && typeof val === 'string' && val.trim() !== '') {
                const trimmed = val.trim().toLowerCase();
                if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                    return Response.json(
                        { error: `Invalid URL in field "${field}". Only http/https URLs are allowed.` },
                        { status: 400, headers: corsHeaders }
                    );
                }
            }
        }

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
            // FIX (2026-03-02): Normalize email to lowercase so entity rate limit query
            // (which filters by lowercase email) matches consistently.
            submitter_email: (submitter_email || '').toLowerCase(),
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