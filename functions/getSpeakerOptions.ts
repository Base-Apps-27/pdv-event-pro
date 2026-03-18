import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Rate Limiter (InMemory - resets on deployment/cold start)
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

    // Layer 1: In-memory rate limiting (best-effort, resets on cold start)
    // NOTE: TOCTOU race under concurrency is accepted; Layer 2 provides persistent protection.
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxAttempts = 20; // Allow enough for browsing options

    if (!rateLimiter.has(clientIp)) {
        rateLimiter.set(clientIp, []);
    }
    const attempts = rateLimiter.get(clientIp).filter(t => now - t < windowMs);
    if (attempts.length >= maxAttempts) {
        return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
    }
    attempts.push(now);
    rateLimiter.set(clientIp, attempts);

    try {
        const base44 = createClientFromRequest(req);
        
        const { event_id } = await req.json();
        let targetEvent = null;

        // 1. Determine Target Event
        if (event_id) {
            targetEvent = await base44.asServiceRole.entities.Event.get(event_id);
        } else {
            // Find next upcoming event (status confirmed or planning, start_date >= today)
            // Limitations on filtering might exist, so let's fetch 'confirmed' and 'planning' events and sort in memory if needed
            // Or just fetch all active events.
            // Let's try to filter by status 'confirmed' as a primary target
            const events = await base44.asServiceRole.entities.Event.filter({ status: 'confirmed' });
            // Sort by start_date
            const today = new Date().toISOString().split('T')[0];
            const upcoming = events.filter(e => e.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
            
            if (upcoming.length > 0) {
                targetEvent = upcoming[0];
            } else {
                // Fallback to any active event if no upcoming confirmed
                // maybe check 'planning' or 'in_progress'
                const progress = await base44.asServiceRole.entities.Event.filter({ status: 'in_progress' });
                if (progress.length > 0) targetEvent = progress[0];
            }
        }

        if (!targetEvent) {
             return Response.json({ options: [], event_name: null, error: "No active event found" }, { headers: corsHeaders });
        }

        // 2. Fetch Sessions for this Event
        const sessions = await base44.asServiceRole.entities.Session.filter({ event_id: targetEvent.id });
        
        if (!sessions.length) {
            return Response.json({ options: [], event_name: targetEvent.name }, { headers: corsHeaders });
        }

        // 3. Fetch Plenaria Segments
        let allSegments = [];
        // Parallelize fetching if possible, but sequential is safer for now
        for (const sess of sessions) {
             const segs = await base44.asServiceRole.entities.Segment.filter({ 
                 session_id: sess.id,
                 segment_type: 'Plenaria'
             });
             allSegments = allSegments.concat(segs);
        }

        // 4. Format Options
        const options = allSegments.map(seg => {
            const session = sessions.find(s => s.id === seg.session_id);
            return {
                id: seg.id,
                title: seg.title,
                speaker: seg.presenter || seg.message_title || 'TBA',
                time: seg.start_time,
                date: session?.date,
                session_name: session?.name,
                label: `${session?.name || ''} - ${seg.title} (${seg.start_time || 'TBA'})`
            };
        });

        // Sort by date/time
        options.sort((a, b) => {
            const da = new Date(a.date + 'T' + (a.time || '00:00'));
            const db = new Date(b.date + 'T' + (b.time || '00:00'));
            return da - db;
        });

        return Response.json({ 
            options, 
            event_name: targetEvent.name,
            event_id: targetEvent.id
        }, { headers: corsHeaders });

    } catch (error) {
        return Response.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
    }
});