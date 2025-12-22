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

        // Fetch segments for these sessions
        const sessionIds = sessions.map(s => s.id);
        
        // Efficient fetch: get only segments for these sessions
        const allSegments = await base44.asServiceRole.entities.Segment.list();
        const sessionIdSet = new Set(sessionIds);
        const filteredSegments = allSegments
            .filter(seg => sessionIdSet.has(seg.session_id) && seg.show_in_general)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

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