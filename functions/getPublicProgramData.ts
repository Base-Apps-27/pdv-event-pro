import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse parameters from request body
        const body = await req.json();
        const eventId = body.eventId;
        const sessionId = body.sessionId;

        // Validate required parameters
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
        const allSegments = await base44.asServiceRole.entities.Segment.list();
        
        // Filter segments: must belong to one of the sessions AND show_in_general must be true
        const filteredSegments = allSegments
            .filter(seg => sessionIds.includes(seg.session_id) && seg.show_in_general)
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