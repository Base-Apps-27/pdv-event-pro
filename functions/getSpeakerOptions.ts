import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Use service role to bypass RLS, but validate data
        // This is a PUBLIC endpoint, so no user auth check (or maybe check query token if needed)
        // Since it's read-only for options, it's low risk if we filter data properly.
        
        const { event_id } = await req.json();

        // If no event_id, maybe fetch active event? For now assume it's passed or fetch recent.
        
        // 1. Fetch Event Sessions
        const sessionsQuery = event_id ? { event_id } : {};
        // Use service role for consistent access to event structure
        const sessions = await base44.asServiceRole.entities.Session.filter(sessionsQuery);
        
        if (!sessions.length) {
            return Response.json({ options: [] });
        }

        const sessionIds = sessions.map(s => s.id);
        
        // 2. Fetch Plenaria Segments
        // Filter by segment_type='Plenaria' (and maybe 'Especial' if requested)
        // We do this in code if filter() limitations exist, but here we can query.
        
        // NOTE: .filter() logic depends on DB capabilities. 
        // We'll fetch all segments for these sessions and filter in memory to be safe and precise.
        // Or if we can, filter by session_id IN ... and segment_type='Plenaria'.
        
        // Let's fetch all segments for these sessions.
        // Since we can't do "IN" query easily in all implementations, 
        // we might loop or if there are few sessions, it's fine.
        // Assuming reasonably small dataset for an event.
        
        let allSegments = [];
        for (const sess of sessions) {
             const segs = await base44.asServiceRole.entities.Segment.filter({ 
                 session_id: sess.id,
                 segment_type: 'Plenaria'
             });
             allSegments = allSegments.concat(segs);
        }

        // 3. Format Options
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

        return Response.json({ options });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});