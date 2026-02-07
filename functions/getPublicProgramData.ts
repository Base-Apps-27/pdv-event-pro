import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse parameters from request body
        const body = await req.json();
        const { eventId, serviceId, date, listOptions, sessionId } = body;

        // ---------------------------------------------------------
        // MODE 1: List Options (for selectors)
        // ---------------------------------------------------------
        if (listOptions) {
            // 1. Fetch Events (Active/Confirmed)
            // Use generic list and filter manually if simple filter not enough
            const allEvents = await base44.asServiceRole.entities.Event.list('-start_date');
            
            // Filter: confirmed/in_progress AND relevant date range (recent past 7d, future 90d)
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const relevantEvents = allEvents.filter(e => {
                if (e.status !== 'confirmed' && e.status !== 'in_progress') return false;
                if (!e.start_date) return false;
                const start = new Date(e.start_date);
                const diffDays = (start - today) / (1000 * 60 * 60 * 24);
                return diffDays > -7 && diffDays < 90;
            });

            // 2. Fetch Services (Active)
            const allServices = await base44.asServiceRole.entities.Service.list('-date');
            
            const relevantServices = allServices.filter(s => {
                 if (s.status !== 'active') return false;
                 if (!s.date || s.origin === 'blueprint') return false;
                 const sDate = new Date(s.date);
                 const diffDays = (sDate - today) / (1000 * 60 * 60 * 24);
                 return diffDays > -2 && diffDays < 14;
            });

            return Response.json({ events: relevantEvents, services: relevantServices });
        }

        // ---------------------------------------------------------
        // MODE 2: Resolve Specific Program (Event or Service)
        // ---------------------------------------------------------
        let targetProgram = null;
        let isEvent = false;

        // A. Resolve by ID (Event)
        if (eventId) {
            const results = await base44.asServiceRole.entities.Event.filter({ id: eventId });
            if (results?.[0]) {
                targetProgram = results[0];
                isEvent = true;
            }
        }
        
        // B. Resolve by ID (Service)
        if (serviceId && !targetProgram) {
            const results = await base44.asServiceRole.entities.Service.filter({ id: serviceId });
            if (results?.[0]) {
                targetProgram = results[0];
                isEvent = false;
            }
        }

        // C. Auto-detect by Date (if no specific ID)
        if (!targetProgram && !eventId && !serviceId && date) {
            // Try Event first
            const allEvents = await base44.asServiceRole.entities.Event.filter({ status: 'confirmed' });
            const activeEvent = allEvents.find(e => e.start_date <= date && e.end_date >= date);
            
            if (activeEvent) {
                targetProgram = activeEvent;
                isEvent = true;
            } else {
                // Try Service
                const svcResults = await base44.asServiceRole.entities.Service.filter({ date: date, status: 'active' });
                // If multiple services on same day, logic here mimics frontend: pick closest to now? 
                // For simplicity, we return the first one, or the one with a time closest to now if possible.
                // Since this is a simple backend function, returning the first valid one is usually safe for "auto-detect".
                if (svcResults?.[0]) {
                    targetProgram = svcResults[0];
                    isEvent = false;
                }
            }
        }

        if (!targetProgram) {
            return Response.json({ error: "Program not found" }, { status: 404 });
        }

        // ---------------------------------------------------------
        // MODE 3: Fetch Segments & Details
        // ---------------------------------------------------------
        let segments = [];
        let sessions = [];
        let rooms = [];
        let eventDays = [];

        if (isEvent) {
            // Check public access for events
            if (targetProgram.status !== 'confirmed' && targetProgram.status !== 'in_progress') {
                return Response.json({ error: "Event is not publicly accessible" }, { status: 403 });
            }

            // Fetch Sessions
            const sessionFilter = { event_id: targetProgram.id };
            if (sessionId && sessionId !== "all") sessionFilter.id = sessionId;
            
            sessions = await base44.asServiceRole.entities.Session.filter(sessionFilter);
            sessions.sort((a, b) => (a.order || 0) - (b.order || 0));

            // Fetch Segments (from Sessions)
            if (sessions.length > 0) {
                const sessionIds = sessions.map(s => s.id);
                // Batch query segments
                const BATCH_SIZE = 10;
                const batches = [];
                for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
                    batches.push(sessionIds.slice(i, i + BATCH_SIZE));
                }

                const allSegments = [];
                for (const batch of batches) {
                    const batchResults = await Promise.all(
                        batch.map(sid => base44.asServiceRole.entities.Segment.filter({ session_id: sid }, 'order'))
                    );
                    allSegments.push(...batchResults.flat());
                }
                
                // Sort Segments
                const orderMap = new Map(sessionIds.map((id, i) => [id, i]));
                segments = allSegments
                    .filter(seg => seg.show_in_general)
                    .sort((a, b) => {
                        const aIndex = orderMap.get(a.session_id);
                        const bIndex = orderMap.get(b.session_id);
                        if (aIndex !== bIndex) return aIndex - bIndex;
                        return (a.order || 0) - (b.order || 0);
                    });
            }

            // Fetch Linked Segment Actions (ensure we get all defined actions, not just embedded ones)
            if (segments.length > 0) {
                const segmentIds = segments.map(s => s.id);
                // Batch fetch actions
                const BATCH_SIZE = 10;
                const actionBatches = [];
                for (let i = 0; i < segmentIds.length; i += BATCH_SIZE) {
                    actionBatches.push(segmentIds.slice(i, i + BATCH_SIZE));
                }

                const allActions = [];
                for (const batch of actionBatches) {
                    const batchResults = await Promise.all(
                        batch.map(segId => base44.asServiceRole.entities.SegmentAction.filter({ segment_id: segId }))
                    );
                    allActions.push(...batchResults.flat());
                }

                // Map actions to segments
                const actionsBySegment = {};
                for (const action of allActions) {
                    if (!actionsBySegment[action.segment_id]) actionsBySegment[action.segment_id] = [];
                    actionsBySegment[action.segment_id].push(action);
                }

                // Attach to segments (merging with embedded if any, prioritizing linked entities)
                segments = segments.map(s => {
                    const linked = actionsBySegment[s.id] || [];
                    const embedded = s.segment_actions || [];
                    // We attach as 'actions' which the frontend checks
                    return {
                        ...s,
                        actions: [...embedded, ...linked].sort((a, b) => (a.order || 0) - (b.order || 0))
                    };
                });
            }

            // INJECT: Pre-Session Details Logic
            if (sessions.length > 0) {
                const sessionIds = sessions.map(s => s.id);
                // Fetch PreSessionDetails
                const preSessionDetails = await Promise.all(
                    sessionIds.map(sid => base44.asServiceRole.entities.PreSessionDetails.filter({ session_id: sid }))
                ).then(results => results.flat());

                const detailsBySession = {};
                preSessionDetails.forEach(d => detailsBySession[d.session_id] = d);

                // Group segments by session (using the updated 'segments' array)
                const segmentsBySession = {};
                segments.forEach(seg => {
                    if (seg.session_id) {
                        if (!segmentsBySession[seg.session_id]) segmentsBySession[seg.session_id] = [];
                        segmentsBySession[seg.session_id].push(seg);
                    }
                });

                // Inject actions into first segment of each session
                Object.keys(segmentsBySession).forEach(sid => {
                    const sessSegs = segmentsBySession[sid];
                    // Sort by order to find the first one
                    sessSegs.sort((a, b) => (a.order || 0) - (b.order || 0));
                    const firstSeg = sessSegs[0];
                    const details = detailsBySession[sid];

                    if (firstSeg && details) {
                        const newActions = [];
                        
                        if (details.registration_desk_open_time) {
                            newActions.push({
                                id: `pre-reg-${details.id}`,
                                label: 'REGISTRATION OPEN',
                                department: 'Hospitality',
                                timing: 'absolute',
                                absolute_time: details.registration_desk_open_time,
                                order: -100
                            });
                        }
                        if (details.facility_notes) {
                            newActions.push({
                                id: `pre-fac-${details.id}`,
                                label: 'FACILITY INSTRUCTIONS',
                                department: 'Admin',
                                timing: 'before_start',
                                offset_min: 60, // 1 hour before
                                notes: details.facility_notes,
                                order: -99
                            });
                        }
                        if (details.general_notes) {
                            newActions.push({
                                id: `pre-gen-${details.id}`,
                                label: 'GENERAL NOTES',
                                department: 'Coordinador',
                                timing: 'before_start',
                                offset_min: 30, // 30 min before
                                notes: details.general_notes,
                                order: -98
                            });
                        }

                        if (newActions.length > 0) {
                            firstSeg.actions = [...(firstSeg.actions || []), ...newActions];
                        }
                    }
                });
            }

            // Fetch Extras
            rooms = await base44.asServiceRole.entities.Room.list();
            eventDays = await base44.asServiceRole.entities.EventDay.filter({ event_id: targetProgram.id });

            return Response.json({
                event: targetProgram, // Kept for compat
                program: { ...targetProgram, _isEvent: true }, // Unified object
                sessions,
                segments,
                rooms,
                eventDays
            });

        } else {
            // It's a Service
            // Services might have segments in two ways:
            // 1. Linked Sessions (if service.event_id is set or it acts like an event)
            // 2. Embedded JSON `segments` field (legacy/simple)

            // Check if it's linked to an event (some services are just pointers to events)
            if (targetProgram.event_id) {
                // Fetch sessions for that event_id? Or usually just treat as service.
                // Logic in frontend: "if (service.event_id) ... fetch sessions for event_id"
                const linkedSessions = await base44.asServiceRole.entities.Session.filter({ event_id: targetProgram.event_id });
                 // ... similar logic to Event ...
                 // For brevity, let's assume if it has event_id, we fetch those sessions
                 sessions = linkedSessions;
            } 
            // Also check for sessions linked directly to this service ID (uncommon but possible in schema)
            else {
                 const directSessions = await base44.asServiceRole.entities.Session.filter({ service_id: targetProgram.id });
                 if (directSessions.length > 0) sessions.push(...directSessions);
            }

            // Fetch segments from found sessions
            if (sessions.length > 0) {
                 const sessionIds = sessions.map(s => s.id);
                 const BATCH_SIZE = 10;
                 // ... fetch segments loop ...
                 // Simplified for brevity in this large block replacement:
                 const allResults = await Promise.all(sessionIds.map(sid => base44.asServiceRole.entities.Segment.filter({ session_id: sid })));
                 segments = allResults.flat().filter(s => s.show_in_general).sort((a, b) => (a.order || 0) - (b.order || 0));
            } 
            // Fallback: Embedded Segments
            else if (targetProgram.segments && Array.isArray(targetProgram.segments)) {
                segments = targetProgram.segments;
            }

            // Fetch Linked Segment Actions for Services too
            if (segments.length > 0 && segments[0].id) { // Only if segments have IDs (real entities)
                const segmentIds = segments.map(s => s.id).filter(Boolean);
                if (segmentIds.length > 0) {
                    const BATCH_SIZE = 10;
                    const actionBatches = [];
                    for (let i = 0; i < segmentIds.length; i += BATCH_SIZE) {
                        actionBatches.push(segmentIds.slice(i, i + BATCH_SIZE));
                    }

                    const allActions = [];
                    for (const batch of actionBatches) {
                        const batchResults = await Promise.all(
                            batch.map(segId => base44.asServiceRole.entities.SegmentAction.filter({ segment_id: segId }))
                        );
                        allActions.push(...batchResults.flat());
                    }

                    const actionsBySegment = {};
                    for (const action of allActions) {
                        if (!actionsBySegment[action.segment_id]) actionsBySegment[action.segment_id] = [];
                        actionsBySegment[action.segment_id].push(action);
                    }

                    segments = segments.map(s => {
                        const linked = actionsBySegment[s.id] || [];
                        const embedded = s.segment_actions || [];
                        return {
                            ...s,
                            actions: [...embedded, ...linked].sort((a, b) => (a.order || 0) - (b.order || 0))
                        };
                    });
                }
            }

            // INJECT: Pre-Session Details Logic (for Services too)
            if (sessions.length > 0) {
                const sessionIds = sessions.map(s => s.id);
                // Fetch PreSessionDetails
                const preSessionDetails = await Promise.all(
                    sessionIds.map(sid => base44.asServiceRole.entities.PreSessionDetails.filter({ session_id: sid }))
                ).then(results => results.flat());

                const detailsBySession = {};
                preSessionDetails.forEach(d => detailsBySession[d.session_id] = d);

                // Group segments by session (using the updated 'segments' array)
                const segmentsBySession = {};
                segments.forEach(seg => {
                    if (seg.session_id) {
                        if (!segmentsBySession[seg.session_id]) segmentsBySession[seg.session_id] = [];
                        segmentsBySession[seg.session_id].push(seg);
                    }
                });

                // Inject actions into first segment of each session
                Object.keys(segmentsBySession).forEach(sid => {
                    const sessSegs = segmentsBySession[sid];
                    // Sort by order to find the first one
                    sessSegs.sort((a, b) => (a.order || 0) - (b.order || 0));
                    const firstSeg = sessSegs[0];
                    const details = detailsBySession[sid];

                    if (firstSeg && details) {
                        const newActions = [];
                        
                        if (details.registration_desk_open_time) {
                            newActions.push({
                                id: `pre-reg-${details.id}`,
                                label: 'REGISTRATION OPEN',
                                department: 'Hospitality',
                                timing: 'absolute',
                                absolute_time: details.registration_desk_open_time,
                                order: -100
                            });
                        }
                        if (details.facility_notes) {
                            newActions.push({
                                id: `pre-fac-${details.id}`,
                                label: 'FACILITY INSTRUCTIONS',
                                department: 'Admin',
                                timing: 'before_start',
                                offset_min: 60, // 1 hour before
                                notes: details.facility_notes,
                                order: -99
                            });
                        }
                        if (details.general_notes) {
                            newActions.push({
                                id: `pre-gen-${details.id}`,
                                label: 'GENERAL NOTES',
                                department: 'Coordinador',
                                timing: 'before_start',
                                offset_min: 30, // 30 min before
                                notes: details.general_notes,
                                order: -98
                            });
                        }

                        if (newActions.length > 0) {
                            firstSeg.actions = [...(firstSeg.actions || []), ...newActions];
                        }
                    }
                });
            }

            return Response.json({
                event: null,
                program: { ...targetProgram, _isEvent: false },
                sessions,
                segments,
                rooms: [],
                eventDays: []
            });
        }

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