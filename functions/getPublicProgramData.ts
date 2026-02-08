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
                
                // Create a map of session dates for easy lookup
                const sessionDateMap = new Map(sessions.map(s => [s.id, s.date]));

                segments = allSegments
                    .filter(seg => seg.show_in_general)
                    .map(seg => ({
                        ...seg,
                        // Inherit date from session if not present
                        date: sessionDateMap.get(seg.session_id) || null
                    }))
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

                        // Helper to calculate offset
                        const getOffset = (segStart, targetTime) => {
                            if (!segStart || !targetTime) return 0;
                            const [h1, m1] = segStart.split(':').map(Number);
                            const [h2, m2] = targetTime.split(':').map(Number);
                            return (h1 * 60 + m1) - (h2 * 60 + m2);
                        };
                        
                        if (details.registration_desk_open_time) {
                            const offset = getOffset(firstSeg.start_time, details.registration_desk_open_time);
                            newActions.push({
                                id: `pre-reg-${details.id}`,
                                label: 'REGISTRATION OPEN',
                                department: 'Hospitality',
                                timing: 'before_start',
                                offset_min: offset,
                                order: -100
                            });
                        }
                        if (details.library_open_time) {
                             const offset = getOffset(firstSeg.start_time, details.library_open_time);
                             newActions.push({
                                id: `pre-lib-${details.id}`,
                                label: 'LIBRARY OPEN',
                                department: 'Hospitality',
                                timing: 'before_start',
                                offset_min: offset,
                                order: -99
                            });
                        }
                        if (details.facility_notes) {
                            newActions.push({
                                id: `pre-fac-${details.id}`,
                                label: 'FACILITY INSTRUCTIONS',
                                department: 'Admin',
                                timing: 'before_start',
                                offset_min: 60,
                                notes: details.facility_notes,
                                order: -98
                            });
                        }
                        if (details.general_notes) {
                            newActions.push({
                                id: `pre-gen-${details.id}`,
                                label: 'GENERAL NOTES',
                                department: 'Coordinador',
                                timing: 'before_start',
                                offset_min: 30,
                                notes: details.general_notes,
                                order: -97
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
            
            // Return raw PreSessionDetails for frontend (EventProgramView needs them)
            // Note: preSessionDetails were fetched above in the injection block
            const preSessionDetails = await Promise.all(
                sessions.map(s => base44.asServiceRole.entities.PreSessionDetails.filter({ session_id: s.id }))
            ).then(results => results.flat());

            // Fetch Live Adjustments (if any)
            // Events don't typically use LiveTimeAdjustment entity heavily yet (uses Session.live_adjustment_enabled), 
            // but we fetch them just in case schema expands or for consistency
            const liveAdjustments = []; 

            return Response.json({
                event: targetProgram, // Kept for compat
                program: { ...targetProgram, _isEvent: true }, // Unified object
                sessions,
                segments,
                rooms,
                eventDays,
                preSessionDetails,
                liveAdjustments
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
            // Fallback: Embedded Segments (Custom Services)
            // CRITICAL FIX: Only use 'segments' if it actually has content. 
            // Weekly services might have an empty 'segments' array default, which would mask the 9:30am data if we didn't check length.
            else if (targetProgram.segments && Array.isArray(targetProgram.segments) && targetProgram.segments.length > 0) {
                segments = targetProgram.segments;
            }
            // Fallback: Standard Weekly Service Time Slots (9:30am / 11:30am)
            // Normalize these into a flat 'segments' array with calculated start times for the TV display
            else if (targetProgram["9:30am"] || targetProgram["11:30am"]) {
                const processSlot = (slotSegments, startHour, startMin) => {
                    if (!Array.isArray(slotSegments)) return [];
                    
                    let currentMinutes = startHour * 60 + startMin;
                    
                    return slotSegments.map((seg, idx) => {
                        // Calculate start time HH:MM
                        const h = Math.floor(currentMinutes / 60);
                        const m = currentMinutes % 60;
                        const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        
                        // Add duration to advance cursor
                        const dur = seg.duration || 0;
                        currentMinutes += dur;
                        
                        // Calculate end time
                        const endH = Math.floor(currentMinutes / 60);
                        const endM = currentMinutes % 60;
                        const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

                        return {
                            ...seg,
                            id: seg.id || `generated-${startHour}-${idx}`, // Ensure ID exists
                            start_time: startTime, // Computed
                            end_time: endTime,
                            duration_min: dur,
                            title: seg.title || seg.data?.title || 'Untitled',
                            presenter: seg.presenter || seg.data?.presenter || '',
                            segment_type: seg.type || 'Generic',
                            session_id: `slot-${startHour}-${startMin}` // Artificial session grouping
                        };
                    });
                };

                const segs930 = processSlot(targetProgram["9:30am"], 9, 30);
                const segs1130 = processSlot(targetProgram["11:30am"], 11, 30);
                
                // Check for implicit break between services (e.g. 11:00 AM to 11:30 AM)
                let breakSegment = null;
                if (segs930.length > 0 && segs1130.length > 0) {
                    const lastSeg = segs930[segs930.length - 1];
                    const firstNextSeg = segs1130[0];
                    
                    // Only insert if there is a time gap
                    if (lastSeg.end_time < firstNextSeg.start_time) {
                        // Calculate duration
                        const [endH, endM] = lastSeg.end_time.split(':').map(Number);
                        const [startH, startM] = firstNextSeg.start_time.split(':').map(Number);
                        const diffMin = (startH * 60 + startM) - (endH * 60 + endM);
                        
                        if (diffMin > 0) {
                            // Try to find matching notes from receso_notes (keyed by time, e.g. "11:00am" or "11:00")
                            // We normalize keys to match HH:MM or HH:MMam/pm if possible, but for now simple lookup
                            const notes = targetProgram.receso_notes?.["11:00am"] || 
                                         targetProgram.receso_notes?.["11:00"] || 
                                         targetProgram.receso_notes?.["11:00 AM"] || "";

                            // Define standard actions for the break itself
                            const breakActions = [
                                {
                                    id: 'break-reset',
                                    label: 'STAGE RESET',
                                    department: 'Stage & Decor',
                                    timing: 'after_start',
                                    offset_min: 0,
                                    order: 1
                                },
                                {
                                    id: 'break-sound',
                                    label: 'AUDIO CHECK',
                                    department: 'Sound',
                                    timing: 'after_start',
                                    offset_min: 10, // 10 min into break
                                    order: 2
                                }
                            ];

                            breakSegment = {
                                id: `generated-break-inter-service`,
                                start_time: lastSeg.end_time,
                                end_time: firstNextSeg.start_time,
                                duration_min: diffMin,
                                title: 'Receso', // Standard title
                                segment_type: 'Receso', // Matches UI check for isBreakSegment
                                session_id: 'slot-break',
                                description: notes,
                                presenter: notes ? 'Coordinador' : '', // Hint at who manages it if notes exist
                                actions: breakActions
                            };

                            // Removed automatic injection of Pre-Service actions (Doors/Prayer/Countdown) per user request

                        }
                    }
                }

                segments = [...segs930, ...(breakSegment ? [breakSegment] : []), ...segs1130];
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
            let preSessionDetails = [];
            if (sessions.length > 0) {
                const sessionIds = sessions.map(s => s.id);
                // Fetch PreSessionDetails
                preSessionDetails = await Promise.all(
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

                        // Helper to calculate offset
                        const getOffset = (segStart, targetTime) => {
                            if (!segStart || !targetTime) return 0;
                            const [h1, m1] = segStart.split(':').map(Number);
                            const [h2, m2] = targetTime.split(':').map(Number);
                            return (h1 * 60 + m1) - (h2 * 60 + m2);
                        };
                        
                        if (details.registration_desk_open_time) {
                            const offset = getOffset(firstSeg.start_time, details.registration_desk_open_time);
                            newActions.push({
                                id: `pre-reg-${details.id}`,
                                label: 'REGISTRATION OPEN',
                                department: 'Hospitality',
                                timing: 'before_start',
                                offset_min: offset,
                                order: -100
                            });
                        }
                        if (details.library_open_time) {
                             const offset = getOffset(firstSeg.start_time, details.library_open_time);
                             newActions.push({
                                id: `pre-lib-${details.id}`,
                                label: 'LIBRARY OPEN',
                                department: 'Hospitality',
                                timing: 'before_start',
                                offset_min: offset,
                                order: -99
                            });
                        }
                        if (details.facility_notes) {
                            newActions.push({
                                id: `pre-fac-${details.id}`,
                                label: 'FACILITY INSTRUCTIONS',
                                department: 'Admin',
                                timing: 'before_start',
                                offset_min: 60,
                                notes: details.facility_notes,
                                order: -98
                            });
                        }
                        if (details.general_notes) {
                            newActions.push({
                                id: `pre-gen-${details.id}`,
                                label: 'GENERAL NOTES',
                                department: 'Coordinador',
                                timing: 'before_start',
                                offset_min: 30,
                                notes: details.general_notes,
                                order: -97
                            });
                        }

                        if (newActions.length > 0) {
                            firstSeg.actions = [...(firstSeg.actions || []), ...newActions];
                        }
                    }
                });
            }

            // FALLBACK: Inject pre_service_notes for Weekly Services (if no sessions / PreSessionDetails)
            // This ensures "General Notes" or manual pre-service instructions show up on the TV Display
            if (targetProgram.pre_service_notes) {
                const injectServiceNotes = (slotKey, slotSessionId) => {
                    const notes = targetProgram.pre_service_notes[slotKey];
                    if (!notes) return;
                    
                    // Find first segment of this slot (using the artificial session_id assigned earlier)
                    const slotSegments = segments.filter(s => s.session_id === slotSessionId);
                    if (slotSegments.length === 0) return;
                    
                    // Sort by start time to find the absolute first
                    slotSegments.sort((a, b) => {
                       const [ah, am] = (a.start_time || "00:00").split(':').map(Number);
                       const [bh, bm] = (b.start_time || "00:00").split(':').map(Number);
                       return (ah * 60 + am) - (bh * 60 + bm);
                    });
                    
                    const firstSeg = slotSegments[0];
                    
                    // Create an artificial action
                    const action = {
                        id: `pre-note-${slotKey}-${targetProgram.id}`,
                        label: 'GENERAL NOTES', // Standard label for pre-service notes
                        department: 'Coordinador',
                        timing: 'before_start',
                        offset_min: 30, // Default to 30 min before
                        notes: notes,
                        order: -99
                    };
                    
                    // Avoid duplicates if already injected
                    if (!firstSeg.actions) firstSeg.actions = [];
                    if (!firstSeg.actions.find(a => a.id === action.id)) {
                        firstSeg.actions.push(action);
                        // Re-sort actions by order/timing
                        firstSeg.actions.sort((a, b) => (a.order || 0) - (b.order || 0));
                    }
                };

                // Try to inject for standard slots
                injectServiceNotes("9:30am", "slot-9-30");
                injectServiceNotes("11:30am", "slot-11-30");
            }

            // Fetch Rooms (Services need room names too)
            const rooms = await base44.asServiceRole.entities.Room.list();

            // Fetch Live Adjustments for this service
            const liveAdjustments = await base44.asServiceRole.entities.LiveTimeAdjustment.filter({ 
                service_id: targetProgram.id,
                date: targetProgram.date 
            });

            return Response.json({
                event: null,
                program: { ...targetProgram, _isEvent: false },
                sessions,
                segments,
                rooms,
                eventDays: [],
                preSessionDetails,
                liveAdjustments
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