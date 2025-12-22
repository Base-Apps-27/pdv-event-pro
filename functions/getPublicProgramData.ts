import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse parameters from request body
        const body = await req.json();
        const eventId = body.eventId;
        const sessionId = body.sessionId;
        const listPublicEvents = body.listPublicEvents;

        // If requesting list of public events
        if (listPublicEvents) {
            const allEvents = await base44.asServiceRole.entities.Event.list('-year');
            const publicEvents = allEvents.filter(e => e.status === 'confirmed' || e.status === 'in_progress');
            return Response.json({ events: publicEvents });
        }

        // Validate required parameters for event details
        if (!eventId) {
            return Response.json({ 
                error: "Missing required parameter: eventId" 
            }, { status: 400 });
        }

        // Fetch event
        const events = await base44.asServiceRole.entities.Event.filter({ id: eventId });
        const selectedEvent = events[0];

        if (!selectedEvent) {
            return Response.json({ 
                error: "Event not found" 
            }, { status: 404 });
        }

        // Check if event is public (confirmed or in_progress status)
        if (selectedEvent.status !== 'confirmed' && selectedEvent.status !== 'in_progress') {
            return Response.json({ 
                error: "Event is not publicly accessible" 
            }, { status: 403 });
        }

        // Fetch sessions (filtered by sessionId if provided)
        const sessionFilter = { event_id: eventId };
        if (sessionId && sessionId !== "all") {
            sessionFilter.id = sessionId;
        }
        
        const allSessions = await base44.asServiceRole.entities.Session.filter(sessionFilter);
        
        // Sort sessions by order
        const sessions = allSessions.sort((a, b) => (a.order || 0) - (b.order || 0));

        if (sessions.length === 0) {
            return Response.json({
                event: selectedEvent,
                sessions: [],
                segments: [],
                rooms: [],
                eventDays: []
            });
        }

        // Fetch segments using canonical backend function (reuse getSegmentsBySessionIds logic)
        const sessionIds = sessions.map(s => s.id);
        
        // Inline efficient fetch to avoid internal HTTP call overhead
        // This duplicates the query logic from getSegmentsBySessionIds for performance
        const validIds = sessionIds.filter(id => id && typeof id === 'string');
        const seen = new Set();
        const uniqueSessionIds = validIds.filter(id => {
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });

        if (uniqueSessionIds.length === 0) {
            return Response.json({
                event: selectedEvent,
                sessions: sessions,
                segments: [],
                rooms: [],
                eventDays: []
            });
        }

        // Batch parallel queries (groups of 10)
        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < uniqueSessionIds.length; i += BATCH_SIZE) {
            batches.push(uniqueSessionIds.slice(i, i + BATCH_SIZE));
        }

        const allResults = [];
        for (const batch of batches) {
            const batchResults = await Promise.all(
                batch.map(sessionId => 
                    base44.asServiceRole.entities.Segment.filter({ session_id: sessionId }, 'order')
                )
            );
            allResults.push(...batchResults.flat());
        }

        // Filter to show_in_general only and maintain session order
        const orderMap = new Map(uniqueSessionIds.map((id, i) => [id, i]));
        const filteredSegments = allResults
            .filter(seg => seg.show_in_general)
            .sort((a, b) => {
                const aIndex = orderMap.has(a.session_id) ? orderMap.get(a.session_id) : Number.MAX_SAFE_INTEGER;
                const bIndex = orderMap.has(b.session_id) ? orderMap.get(b.session_id) : Number.MAX_SAFE_INTEGER;
                if (aIndex !== bIndex) return aIndex - bIndex;
                return (a.order || 0) - (b.order || 0);
            });

        // Fetch rooms
        const rooms = await base44.asServiceRole.entities.Room.list();

        // Fetch EventDays for this event
        const eventDays = await base44.asServiceRole.entities.EventDay.filter({ event_id: eventId });

        return Response.json({
            event: selectedEvent,
            sessions: sessions,
            segments: filteredSegments,
            rooms: rooms,
            eventDays: eventDays
        });

    } catch (error) {
        console.error("Error in getPublicProgramData:", error);
        
        // Return more detailed error information
        return Response.json({ 
            error: "Internal server error",
            details: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
});