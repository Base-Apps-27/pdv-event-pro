/**
 * getSpeakerFormData.js
 * 
 * JSON data endpoint for the React-based Speaker Submission form.
 * Replaces the SSR data-fetching portion of serveSpeakerSubmission.
 * 
 * CSP Migration (2026-02-27): Platform CDN began injecting restrictive CSP
 * headers that block inline scripts in function-served HTML. Moving form
 * rendering to React pages (which run inside the trusted app shell) bypasses
 * the CDN-level CSP. This function provides the data those React pages need.
 * 
 * Query params: ?event_id=xxx (optional — auto-detects upcoming event if omitted)
 * Auth: None required (public form). Uses asServiceRole for reads.
 */

// 2026-04-12: SDK bumped from 0.8.20 → 0.8.25 for consistency across all backend functions.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
        const eventIdParam = url.searchParams.get('event_id');

        // SEC-1 (2026-03-02): Dual-layer rate limiting for data endpoints.
        // Layer 1: In-memory (fast, resets on cold start).
        const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
        const rateLimitKey = `rl:speaker_data:${clientIp}`;
        if (!globalThis._speakerDataRL) globalThis._speakerDataRL = new Map();
        const rlNow = Date.now();
        const rlAttempts = (globalThis._speakerDataRL.get(rateLimitKey) || []).filter(t => rlNow - t < 60000);
        if (rlAttempts.length >= 15) {
            return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
        }
        rlAttempts.push(rlNow);
        globalThis._speakerDataRL.set(rateLimitKey, rlAttempts);

        // Layer 2 entity-based rate limiting REMOVED (2026-03-03):
        // Caused unnecessary DB writes on every read. In-memory Layer 1 is sufficient.
        // See Decision: "getWeeklyFormData: Entity-only, no JSON fallback, targeted queries"

        let targetEvent = null;
        let options = [];

        if (eventIdParam) {
            targetEvent = await base44.asServiceRole.entities.Event.get(eventIdParam);
        } else {
            // Auto-detect: find nearest upcoming confirmed or in_progress event.
            // PERF-FIX (2026-03-03): Fetch only 5 most recent per status to avoid
            // transferring large Event payloads. Events are lightweight but the
            // unfiltered call was timing out on cold starts.
            const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
            const todayETStr = `${nowET.getFullYear()}-${String(nowET.getMonth() + 1).padStart(2, '0')}-${String(nowET.getDate()).padStart(2, '0')}`;

            // Try confirmed first (most common), then in_progress
            const confirmed = await base44.asServiceRole.entities.Event.filter(
                { status: 'confirmed' }, '-start_date', 10
            );
            const upcoming = confirmed
                .filter(e => e.start_date >= todayETStr)
                .sort((a, b) => a.start_date.localeCompare(b.start_date));

            if (upcoming.length > 0) {
                targetEvent = upcoming[0];
            } else {
                // Fallback to in_progress
                const progress = await base44.asServiceRole.entities.Event.filter(
                    { status: 'in_progress' }, '-start_date', 5
                );
                if (progress.length > 0) targetEvent = progress[0];
            }
        }

        if (!targetEvent) {
            return Response.json({
                error: 'No active event found',
                event: null,
                options: []
            }, { headers: corsHeaders });
        }

        // 2026-03-16 v2: Block submissions for completed/archived events.
        // Defense-in-depth: also check end_date directly in case the nightly
        // lifecycle job hasn't run yet (e.g., event ended today at midnight but
        // job runs at 12:30 AM — there's a 30-min window). This catches it.
        // Decision: "Automate full event lifecycle based on dates"
        const _nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const _todayStr = `${_nowET.getFullYear()}-${String(_nowET.getMonth() + 1).padStart(2, '0')}-${String(_nowET.getDate()).padStart(2, '0')}`;
        const _eventEnd = targetEvent.end_date || targetEvent.start_date;
        const isExpiredByDate = _eventEnd && _eventEnd < _todayStr;
        const isClosedStatus = targetEvent.status === 'completed' || targetEvent.status === 'archived';

        if (isClosedStatus || isExpiredByDate) {
            return Response.json({
                closed: true,
                event: {
                    id: targetEvent.id,
                    name: targetEvent.name,
                    location: targetEvent.location || '',
                    start_date: targetEvent.start_date || '',
                },
                options: []
            }, { headers: corsHeaders });
        }

        // Fetch sessions for this event
        const sessions = await base44.asServiceRole.entities.Session.filter({ event_id: targetEvent.id });

        if (sessions.length > 0) {
            // Fetch Plenaria segments in parallel
            const segmentPromises = sessions.map(sess =>
                base44.asServiceRole.entities.Segment.filter({
                    session_id: sess.id,
                    segment_type: 'Plenaria'
                })
            );
            const segmentsResults = await Promise.all(segmentPromises);
            const allSegments = segmentsResults.flat();

            // SEC-1 (2026-03-02): Strip internal entity IDs from public response.
            // Only expose display-necessary fields. Use index as client-side key.
            options = allSegments.map((seg, idx) => {
                const session = sessions.find(s => s.id === seg.session_id);
                return {
                    id: seg.id, // Needed for submission target
                    title: seg.title,
                    speaker: seg.presenter || 'TBA',
                    message_title: seg.message_title,
                    time: seg.start_time,
                    date: session?.date,
                    session_name: session?.name,
                };
            });

            // Sort chronologically
            options.sort((a, b) => {
                const da = new Date((a.date || '1970-01-01') + 'T' + (a.time || '00:00'));
                const db = new Date((b.date || '1970-01-01') + 'T' + (b.time || '00:00'));
                return da - db;
            });
        }

        return Response.json({
            event: {
                id: targetEvent.id,
                name: targetEvent.name,
                location: targetEvent.location || '',
                start_date: targetEvent.start_date || '',
            },
            options
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('getSpeakerFormData error:', error);
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});