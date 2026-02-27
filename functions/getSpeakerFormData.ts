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
        const eventIdParam = url.searchParams.get('event_id');

        let targetEvent = null;
        let options = [];

        if (eventIdParam) {
            targetEvent = await base44.asServiceRole.entities.Event.get(eventIdParam);
        } else {
            // Find next upcoming confirmed event
            const events = await base44.asServiceRole.entities.Event.filter({ status: 'confirmed' });
            const today = new Date().toISOString().split('T')[0];
            const upcoming = events
                .filter(e => e.start_date >= today)
                .sort((a, b) => a.start_date.localeCompare(b.start_date));

            if (upcoming.length > 0) {
                targetEvent = upcoming[0];
            } else {
                // Fallback to in_progress
                const progress = await base44.asServiceRole.entities.Event.filter({ status: 'in_progress' });
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

            options = allSegments.map(seg => {
                const session = sessions.find(s => s.id === seg.session_id);
                return {
                    id: seg.id,
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