/**
 * getArtsChangeHistory.js
 * 2026-02-28: Returns recent ArtsSubmissionLog entries for a given event.
 * Used by the public arts form to show collaborative change history.
 * 
 * Public endpoint — no auth required. Uses asServiceRole for reads.
 * Rate-limited to prevent abuse.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const rateLimiter = new Map();

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Rate limiting: 20 reads per minute per IP (generous for reads)
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const attempts = (rateLimiter.get(clientIp) || []).filter(t => now - t < 60000);
    if (attempts.length >= 20) {
        return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
    }
    attempts.push(now);
    rateLimiter.set(clientIp, attempts);

    try {
        const base44 = createClientFromRequest(req);

        let eventId = null;
        if (req.method === 'POST') {
            try {
                const body = await req.json();
                eventId = body.event_id;
            } catch (e) { /* no body */ }
        }
        if (!eventId) {
            const url = new URL(req.url);
            eventId = url.searchParams.get('event_id');
        }

        if (!eventId) {
            return Response.json({ error: 'Missing event_id' }, { status: 400, headers: corsHeaders });
        }

        // Fetch recent logs for this event, sorted by submitted_at desc
        // ArtsSubmissionLog has event_id field for grouping
        const logs = await base44.asServiceRole.entities.ArtsSubmissionLog.filter(
            { event_id: eventId },
            '-submitted_at',
            30  // Last 30 entries max
        );

        // Sanitize output — only expose what the UI needs
        const history = logs.map(log => ({
            id: log.id,
            segment_title: log.segment_title || '',
            submitter_name: log.submitter_name || '',
            submitted_at: log.submitted_at || log.created_date || '',
            fields_changed: log.fields_changed || [],
        }));

        return Response.json({ history }, { headers: corsHeaders });

    } catch (error) {
        console.error('[getArtsChangeHistory] Error:', error);
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});