import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse body for event_id
        let body = {};
        try {
            body = await req.json();
        } catch (e) {
            // body might be empty
        }
        
        const eventId = body.event_id || null;

        // --- 1. DATA FETCHING (SSR) ---
        let targetEvent = null;
        let eventError = null;
        let options = [];

        try {
            if (eventId) {
                targetEvent = await base44.asServiceRole.entities.Event.get(eventId);
            } else {
                // Find next upcoming confirmed event
                const events = await base44.asServiceRole.entities.Event.filter({ status: 'confirmed' });
                const today = new Date().toISOString().split('T')[0];
                const upcoming = events.filter(e => e.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
                
                if (upcoming.length > 0) {
                    targetEvent = upcoming[0];
                } else {
                    // Fallback to in_progress
                    const progress = await base44.asServiceRole.entities.Event.filter({ status: 'in_progress' });
                    if (progress.length > 0) targetEvent = progress[0];
                }
            }

            if (targetEvent) {
                // Fetch Sessions
                const sessions = await base44.asServiceRole.entities.Session.filter({ event_id: targetEvent.id });
                
                if (sessions.length > 0) {
                     // Fetch Plenaria Segments (Parallelized)
                    const segmentPromises = sessions.map(sess => 
                        base44.asServiceRole.entities.Segment.filter({ 
                            session_id: sess.id,
                            segment_type: 'Plenaria'
                        })
                    );
                    
                    const segmentsResults = await Promise.all(segmentPromises);
                    const allSegments = segmentsResults.flat();

                    // Format Options
                    options = allSegments.map(seg => {
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

                    // Sort
                    options.sort((a, b) => {
                        const da = new Date((a.date || '1970-01-01') + 'T' + (a.time || '00:00'));
                        const db = new Date((b.date || '1970-01-01') + 'T' + (b.time || '00:00'));
                        return da - db;
                    });
                }
            } else {
                eventError = "No active event found.";
            }

        } catch (err) {
            console.error("Data fetching error:", err);
            eventError = "Error loading event data.";
        }

        return Response.json({
            options,
            event_name: targetEvent?.name,
            event_id: targetEvent?.id,
            error: eventError
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});