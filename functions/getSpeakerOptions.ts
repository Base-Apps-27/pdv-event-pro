import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
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
             return Response.json({ options: [], event_name: null, error: "No active event found" });
        }

        // 2. Fetch Sessions for this Event
        const sessions = await base44.asServiceRole.entities.Session.filter({ event_id: targetEvent.id });
        
        if (!sessions.length) {
            return Response.json({ options: [], event_name: targetEvent.name });
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
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});