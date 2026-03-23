import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Retry wrapper — retries on 429 (rate limit) with exponential backoff.
 * Critical for reliability: the function makes many parallel SDK calls
 * and the platform has per-function rate limits.
 *
 * Decision: "Backend retry on 429 to prevent user-facing empty states"
 */
async function withRetry(fn, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const status = err?.status || err?.response?.status || 0;
            if (status === 429 && attempt < maxRetries) {
                // Exponential backoff: 500ms, 1500ms
                await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                continue;
            }
            throw err;
        }
    }
}

/**
 * PRODUCTION-READINESS FIX (2026-03-03): sortSessionsChronologically was used but never defined.
 * Copied from buildProgramSnapshot for parity. This function is the fallback path when
 * the cache is stale or unavailable — it MUST be self-contained.
 */
function sortSessionsChronologically(sessions) {
    return [...sessions].sort((a, b) => {
        const aDate = a?.date || '';
        const bDate = b?.date || '';
        if (aDate !== bDate) {
            if (!aDate) return 1;
            if (!bDate) return -1;
            return aDate.localeCompare(bDate);
        }
        const aTime = a?.planned_start_time || '';
        const bTime = b?.planned_start_time || '';
        if (aTime !== bTime) {
            if (!aTime) return 1;
            if (!bTime) return -1;
            return aTime.localeCompare(bTime);
        }
        const aOrder = Number.isFinite(a?.order) ? a.order : Infinity;
        const bOrder = Number.isFinite(b?.order) ? b.order : Infinity;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a?.name || '').localeCompare(b?.name || '');
    });
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse parameters from request body
        const body = await req.json();
        const { eventId, serviceId, date, listOptions, sessionId, includeOptions, detectActive } = body;
        
        // Context-aware environment
        const dataEnv = req.headers.get('x-data-env') || 'prod';

        // ---------------------------------------------------------
        // CTO-4 (2026-03-02): CACHE-FIRST PATH
        // For production reads, try ActiveProgramCache first.
        // This eliminates the duplicated snapshot-building logic (~400 lines)
        // by delegating to refreshActiveProgram as the single source of truth.
        // Fallback: if cache miss or test env, fall through to full rebuild.
        // ---------------------------------------------------------
        if (dataEnv === 'prod') {
          // Specific program requested by ID → try warm cache
          const cacheKey = eventId
            ? `event_${eventId}`
            : serviceId
              ? `service_${serviceId}`
              : 'current_display';

          try {
            const cacheEntries = await withRetry(() =>
              base44.asServiceRole.entities.ActiveProgramCache.filter({ cache_key: cacheKey })
            );

            if (cacheEntries.length > 0 && cacheEntries[0].program_snapshot) {
              const cached = cacheEntries[0];
              const cacheAge = Date.now() - new Date(cached.last_refresh_at || 0).getTime();
              // Serve from cache if < 5 min old
              if (cacheAge < 300000) {
                console.log(`[getPublicProgramData] Cache HIT for ${cacheKey} (${Math.round(cacheAge / 1000)}s old)`);
                const snap = cached.program_snapshot;
                const response = {
                  event: snap.event || null,
                  program: snap.program || null,
                  sessions: snap.sessions || [],
                  segments: snap.segments || [],
                  rooms: snap.rooms || [],
                  eventDays: snap.eventDays || [],
                  preSessionDetails: snap.preSessionDetails || [],
                  liveAdjustments: snap.liveAdjustments || [],
                  streamBlocks: snap.streamBlocks || [],
                };
                // Merge selector options if requested
                if (listOptions || includeOptions) {
                  response.events = cached.selector_options?.events || [];
                  response.services = cached.selector_options?.services || [];
                }
                return Response.json(response);
              }
            }

            // Cache miss for specific program but current_display exists → check if it matches
            if (cacheKey !== 'current_display' && cacheEntries.length === 0) {
              const mainCache = await withRetry(() =>
                base44.asServiceRole.entities.ActiveProgramCache.filter({ cache_key: 'current_display' })
              );
              if (mainCache.length > 0 && mainCache[0].program_id === (eventId || serviceId)) {
                const cached = mainCache[0];
                const cacheAge = Date.now() - new Date(cached.last_refresh_at || 0).getTime();
                if (cacheAge < 300000 && cached.program_snapshot) {
                  console.log(`[getPublicProgramData] Cache HIT via current_display fallback`);
                  const snap = cached.program_snapshot;
                  const response = {
                    event: snap.event || null,
                    program: snap.program || null,
                    sessions: snap.sessions || [],
                    segments: snap.segments || [],
                    rooms: snap.rooms || [],
                    eventDays: snap.eventDays || [],
                    preSessionDetails: snap.preSessionDetails || [],
                    liveAdjustments: snap.liveAdjustments || [],
                    streamBlocks: snap.streamBlocks || [],
                  };
                  if (listOptions || includeOptions) {
                    response.events = cached.selector_options?.events || [];
                    response.services = cached.selector_options?.services || [];
                  }
                  return Response.json(response);
                }
              }
            }

            // Auto-detect mode: use current_display cache
            if (!eventId && !serviceId && (detectActive || !date)) {
              const mainCache = await withRetry(() =>
                base44.asServiceRole.entities.ActiveProgramCache.filter({ cache_key: 'current_display' })
              );
              if (mainCache.length > 0 && mainCache[0].program_snapshot) {
                const cached = mainCache[0];
                const cacheAge = Date.now() - new Date(cached.last_refresh_at || 0).getTime();
                if (cacheAge < 300000) {
                  console.log(`[getPublicProgramData] Cache HIT for auto-detect (${Math.round(cacheAge / 1000)}s old)`);
                  const snap = cached.program_snapshot;
                  const response = {
                    event: snap.event || null,
                    program: snap.program || null,
                    sessions: snap.sessions || [],
                    segments: snap.segments || [],
                    rooms: snap.rooms || [],
                    eventDays: snap.eventDays || [],
                    preSessionDetails: snap.preSessionDetails || [],
                    liveAdjustments: snap.liveAdjustments || [],
                    streamBlocks: snap.streamBlocks || [],
                  };
                  if (listOptions || includeOptions) {
                    response.events = cached.selector_options?.events || [];
                    response.services = cached.selector_options?.services || [];
                  }
                  return Response.json(response);
                }
              }
            }
          } catch (cacheErr) {
            console.warn('[getPublicProgramData] Cache read failed, falling through to full rebuild:', cacheErr.message);
          }
        }
        // ─── END CTO-4 CACHE-FIRST PATH ───
        // Fall through to existing full rebuild logic for cache misses, test env, etc.

        // ---------------------------------------------------------
        // SHARED: Options Fetching (Mode 1 or Mode 4 combined)
        // ---------------------------------------------------------
        let optionsData = null;
        
        if (listOptions || includeOptions) {
            // Fetch events and services SEQUENTIALLY to avoid rate-limit spikes.
            // These are list calls that return moderate-sized payloads; sequential
            // adds ~200ms but avoids the 429 cascade that causes "no program" errors.
            const allEvents = await withRetry(() =>
                base44.asServiceRole.entities.Event.list('-start_date', undefined, undefined, dataEnv)
            );
            const allServices = await withRetry(() =>
                base44.asServiceRole.entities.Service.list('-date', undefined, undefined, dataEnv)
            );
            
            // Use ET for "Today" to match user perception (America/New_York)
            // This ensures "Date-1" means "Day before in ET", not "Day before in UTC"
            const getETDateStr = () => {
                return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
            };
            const todayStr = getETDateStr();
            const today = new Date(todayStr); // UTC midnight of ET date
            
            // Sort ASCENDING so 'find' logic picks the earliest upcoming item
            // Events: Visible from 4 days before (Date-4) until 7 days after
            const relevantEvents = allEvents.filter(e => {
                if (e.status !== 'confirmed' && e.status !== 'in_progress') return false;
                if (!e.start_date) return false;
                const start = new Date(e.start_date); // YYYY-MM-DD -> UTC Midnight
                const diffDays = (start - today) / (1000 * 60 * 60 * 24);
                return diffDays > -7 && diffDays <= 4; 
            }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

            // Services: Visible from 1 day before (Date-1) until 2 days after
            const relevantServices = allServices.filter(s => {
                 if (s.status !== 'active') return false;
                 if (!s.date || s.origin === 'blueprint') return false;
                 const sDate = new Date(s.date); // YYYY-MM-DD -> UTC Midnight
                 const diffDays = (sDate - today) / (1000 * 60 * 60 * 24);
                 return diffDays > -2 && diffDays <= 1;
            }).sort((a, b) => new Date(a.date) - new Date(b.date));

            optionsData = { events: relevantEvents, services: relevantServices };
            
            // Mode 1: Options Only (Legacy)
            if (listOptions && !detectActive) {
                return Response.json(optionsData);
            }
        }

        // ---------------------------------------------------------
        // MODE 2: Resolve Specific Program (Event or Service)
        // ---------------------------------------------------------
        let targetProgram = null;
        let isEvent = false;

        // A. Resolve by ID (Event)
        if (eventId) {
            const results = await withRetry(() => base44.asServiceRole.entities.Event.filter({ id: eventId }, undefined, undefined, undefined, dataEnv));
            if (results?.[0]) {
                targetProgram = results[0];
                isEvent = true;
            }
        }
        
        // B. Resolve by ID (Service)
        if (serviceId && !targetProgram) {
            const results = await withRetry(() => base44.asServiceRole.entities.Service.filter({ id: serviceId }, undefined, undefined, undefined, dataEnv));
            if (results?.[0]) {
                targetProgram = results[0];
                isEvent = false;
            }
        }

        // C. Auto-detect logic (Date or Smart Detect)
        if (!targetProgram && !eventId && !serviceId) {
            // Determine date to check: explicit param or today (ET)
            const getETDateStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
            const checkDateStr = date || getETDateStr();
            const checkDate = new Date(checkDateStr + 'T00:00:00'); 

            if (detectActive && optionsData) {
                // Smart Detect using already fetched options (fastest)
                const { events, services } = optionsData;
                
                // 1. Check for TODAY match
                // We use string comparison for YYYY-MM-DD
                const todayStr = checkDateStr;
                
                const todayService = services.find(s => s.date === todayStr);
                const todayEvent = events.find(e => {
                    if (!e.start_date) return false;
                    return todayStr >= e.start_date && todayStr <= (e.end_date || e.start_date);
                });

                if (todayService) {
                    targetProgram = todayService;
                    isEvent = false;
                } else if (todayEvent) {
                    targetProgram = todayEvent;
                    isEvent = true;
                } else {
                    // 2. Fallback: Next upcoming (prioritize service then event)
                    // Simplified logic: find first future service/event in the list
                    const futureService = services.find(s => s.date > todayStr);
                    const futureEvent = events.find(e => e.start_date > todayStr);
                    
                    if (futureService && futureEvent) {
                        if (futureService.date <= futureEvent.start_date) {
                            targetProgram = futureService;
                            isEvent = false;
                        } else {
                            targetProgram = futureEvent;
                            isEvent = true;
                        }
                    } else if (futureService) {
                        targetProgram = futureService;
                        isEvent = false;
                    } else if (futureEvent) {
                        targetProgram = futureEvent;
                        isEvent = true;
                    }
                }
            } else if (date) {
                // Legacy Date-only auto-detect (fetches from DB)
                const allEvents = await withRetry(() => base44.asServiceRole.entities.Event.filter({ status: 'confirmed' }, undefined, undefined, undefined, dataEnv));
                const svcResults = await withRetry(() => base44.asServiceRole.entities.Service.filter({ date: date, status: 'active' }, undefined, undefined, undefined, dataEnv));
                
                const activeEvent = allEvents.find(e => e.start_date <= date && e.end_date >= date);
                
                if (activeEvent) {
                    targetProgram = activeEvent;
                    isEvent = true;
                } else if (svcResults?.[0]) {
                    targetProgram = svcResults[0];
                    isEvent = false;
                }
            }
        }

        if (!targetProgram) {
            // Mode 4 Special: If we tried to auto-detect but failed, we should still return options if requested
            if (optionsData) {
                return Response.json({ ...optionsData, error: "No active program found" });
            }
            return Response.json({ error: "Program not found" }, { status: 404 });
        }

        // ---------------------------------------------------------
        // HELPERS
        // ---------------------------------------------------------
        const resolveChildrenAsSubAssignments = (children) => {
            if (!children || children.length === 0) return [];
            return children
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(child => ({
                    label: child.title || 'Sub-assignment',
                    presenter: child.presenter || '',
                    duration_min: child.duration_min || 5,
                    segment_type: child.segment_type || 'Ministración',
                }));
        };

        const groupBy = (arr, keyFn) => {
            const map = {};
            for (const item of arr) {
                const key = keyFn(item);
                if (!key) continue;
                if (!map[key]) map[key] = [];
                map[key].push(item);
            }
            return map;
        };

        // ---------------------------------------------------------
        // MODE 3: Fetch Segments & Details
        // ---------------------------------------------------------
        let segments = [];
        let sessions = [];
        let rooms = [];
        let eventDays = [];
        let preSessionDetails = [];
        let liveAdjustments = [];
        let streamBlocks = [];

        // Fetch independent resources SEQUENTIALLY to avoid rate-limit cascades.
        // Using withRetry on each to handle transient 429s.
        const fetchExtrasPromise = (async () => {
            const rooms = await withRetry(() => 
                base44.asServiceRole.entities.Room.list(undefined, undefined, undefined, dataEnv)
            );
            const eventDays = isEvent 
                ? await withRetry(() => base44.asServiceRole.entities.EventDay.filter({ event_id: targetProgram.id }, undefined, undefined, undefined, dataEnv))
                : [];
            const adjustments = !isEvent
                ? await withRetry(() => base44.asServiceRole.entities.LiveTimeAdjustment.filter({ service_id: targetProgram.id, date: targetProgram.date }, undefined, undefined, undefined, dataEnv))
                : [];
            return [rooms, eventDays, adjustments];
        })();

        if (isEvent) {
            // Check public access for events
            if (targetProgram.status !== 'confirmed' && targetProgram.status !== 'in_progress') {
                return Response.json({ error: "Event is not publicly accessible" }, { status: 403 });
            }

            // Fetch Sessions
            const sessionFilter = { event_id: targetProgram.id };
            if (sessionId && sessionId !== "all") sessionFilter.id = sessionId;

            sessions = await withRetry(() => base44.asServiceRole.entities.Session.filter(sessionFilter, undefined, undefined, undefined, dataEnv));
            // DECISION-004 (ATT-015): Sort sessions chronologically, not by unreliable `order` field
            sessions = sortSessionsChronologically(sessions);

            // Fetch segments, preSessionDetails, streamBlocks, and extras SEQUENTIALLY
            // to avoid rate-limit cascades. Each batch uses withRetry for resilience.
            const extras = await fetchExtrasPromise;

            // Fetch Segments (batched, sequential batches)
            let allSegmentsFetched = [];
            if (sessions.length > 0) {
                const sessionIds = sessions.map(s => s.id);
                const BATCH_SIZE = 5; // Smaller batches to stay under rate limits
                for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
                    const batch = sessionIds.slice(i, i + BATCH_SIZE);
                    const batchResults = await Promise.all(
                        batch.map(sid => withRetry(() => base44.asServiceRole.entities.Segment.filter({ session_id: sid }, 'order', undefined, undefined, dataEnv)))
                    );
                    allSegmentsFetched.push(...batchResults.flat());
                }
            }

            // Fetch PreSessionDetails
            let preSessionDetailsFetched = [];
            if (sessions.length > 0) {
                for (const s of sessions) {
                    const details = await withRetry(() => base44.asServiceRole.entities.PreSessionDetails.filter({ session_id: s.id }, undefined, undefined, undefined, dataEnv));
                    preSessionDetailsFetched.push(...details);
                }
            }

            // Fetch StreamBlocks
            let streamBlocksFetched = [];
            if (sessions.length > 0) {
                for (const s of sessions) {
                    const blocks = await withRetry(() => base44.asServiceRole.entities.StreamBlock.filter({ session_id: s.id }, 'order', undefined, undefined, dataEnv));
                    streamBlocksFetched.push(...blocks);
                }
            }

            const segmentsAndDetails = [allSegmentsFetched, preSessionDetailsFetched, streamBlocksFetched];

            [rooms, eventDays, liveAdjustments] = extras;
            let allSegments = allSegmentsFetched;
            preSessionDetails = preSessionDetailsFetched;
            streamBlocks = streamBlocksFetched;

            // Process Segments (Sort & Filter)
            if (allSegments.length > 0) {
                const orderMap = new Map(sessions.map((s, i) => [s.id, i]));
                const sessionDateMap = new Map(sessions.map(s => [s.id, s.date]));

                const childByParent = groupBy(
                    allSegments.filter(s => s.parent_segment_id),
                    s => s.parent_segment_id
                );

                segments = allSegments
                    .filter(seg => seg.show_in_general !== false && !seg.parent_segment_id)
                    .map(seg => ({
                        ...seg,
                        date: sessionDateMap.get(seg.session_id) || null,
                        _resolved_sub_assignments: resolveChildrenAsSubAssignments(childByParent[seg.id])
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
                // Batch fetch actions — smaller batches with retry to avoid 429
                const BATCH_SIZE = 5;
                const actionBatches = [];
                for (let i = 0; i < segmentIds.length; i += BATCH_SIZE) {
                    actionBatches.push(segmentIds.slice(i, i + BATCH_SIZE));
                }

                const allActions = [];
                for (const batch of actionBatches) {
                    const batchResults = await Promise.all(
                        batch.map(segId => withRetry(() => base44.asServiceRole.entities.SegmentAction.filter({ segment_id: segId }, undefined, undefined, undefined, dataEnv)))
                    );
                    allActions.push(...batchResults.flat());
                }

                // Map actions to segments
                const actionsBySegment = {};
                for (const action of allActions) {
                    if (!actionsBySegment[action.segment_id]) actionsBySegment[action.segment_id] = [];
                    actionsBySegment[action.segment_id].push(action);
                }

                // Attach to segments
                segments = segments.map(s => {
                    const linked = actionsBySegment[s.id] || [];
                    const embedded = s.segment_actions || [];
                    return {
                        ...s,
                        actions: [...embedded, ...linked].sort((a, b) => (a.order || 0) - (b.order || 0))
                    };
                });
            }

            // INJECT: Pre-Session Details Logic
            // ... (same injection logic as before, using preSessionDetails fetched in parallel) ...
            if (sessions.length > 0 && preSessionDetails.length > 0) {
                const detailsBySession = {};
                preSessionDetails.forEach(d => detailsBySession[d.session_id] = d);

                const segmentsBySession = {};
                segments.forEach(seg => {
                    if (seg.session_id) {
                        if (!segmentsBySession[seg.session_id]) segmentsBySession[seg.session_id] = [];
                        segmentsBySession[seg.session_id].push(seg);
                    }
                });

                Object.keys(segmentsBySession).forEach(sid => {
                    const sessSegs = segmentsBySession[sid];
                    sessSegs.sort((a, b) => (a.order || 0) - (b.order || 0));
                    const firstSeg = sessSegs[0];
                    const details = detailsBySession[sid];

                    if (firstSeg && details) {
                        const newActions = [];
                        const getOffset = (segStart, targetTime) => {
                            if (!segStart || !targetTime) return 0;
                            const [h1, m1] = segStart.split(':').map(Number);
                            const [h2, m2] = targetTime.split(':').map(Number);
                            return (h1 * 60 + m1) - (h2 * 60 + m2);
                        };

                        if (details.registration_desk_open_time) {
                            newActions.push({
                                id: `pre-reg-${details.id}`,
                                label: 'REGISTRATION OPEN',
                                department: 'Hospitality',
                                timing: 'before_start',
                                offset_min: getOffset(firstSeg.start_time, details.registration_desk_open_time),
                                order: -100
                            });
                        }
                        // ... (other injections same as original) ...
                        // simplified copy for brevity in patch
                        if (details.library_open_time) newActions.push({id:`pre-lib-${details.id}`, label:'LIBRARY OPEN', department:'Hospitality', timing:'before_start', offset_min: getOffset(firstSeg.start_time, details.library_open_time), order:-99});
                        if (details.facility_notes) newActions.push({id:`pre-fac-${details.id}`, label:'FACILITY INSTRUCTIONS', department:'Admin', timing:'before_start', offset_min:60, notes:details.facility_notes, order:-98});
                        if (details.general_notes) newActions.push({id:`pre-gen-${details.id}`, label:'GENERAL NOTES', department:'Coordinador', timing:'before_start', offset_min:30, notes:details.general_notes, order:-97});

                        if (newActions.length > 0) {
                            firstSeg.actions = [...(firstSeg.actions || []), ...newActions];
                        }
                    }
                });
            }

            const responsePayload = {
                event: targetProgram,
                program: { ...targetProgram, _isEvent: true },
                sessions,
                segments,
                rooms,
                eventDays,
                preSessionDetails,
                liveAdjustments,
                streamBlocks
            };
            // Merge options if requested
            if (optionsData) Object.assign(responsePayload, optionsData);
            return Response.json(responsePayload);

        } else {
            // It's a Service (Strict Entity Mode)
            // JSON fallbacks have been removed as Entity Lift is complete.
            
            if (targetProgram.event_id) {
                sessions = await withRetry(() => base44.asServiceRole.entities.Session.filter({ event_id: targetProgram.event_id }, undefined, undefined, undefined, dataEnv));
            } else {
                 sessions = await withRetry(() => base44.asServiceRole.entities.Session.filter({ service_id: targetProgram.id }, undefined, undefined, undefined, dataEnv));
            }

            if (sessions.length > 0) {
                 // DECISION-004 (ATT-015): Sort sessions chronologically, not by unreliable `order` field
                 sessions = sortSessionsChronologically(sessions);

                 const sessionIds = sessions.map(s => s.id);
                 const allResults = [];
                 for (const sid of sessionIds) {
                     const segs = await withRetry(() => base44.asServiceRole.entities.Segment.filter({ session_id: sid }, undefined, undefined, undefined, dataEnv));
                     allResults.push(...segs);
                 }

                 if (allResults.length > 0) {
                     // A. Sort by session order, then segment order (matching event path)
                     const sessionOrderMap = new Map(sessions.map((s, i) => [s.id, i]));
                     
                     const childByParent = groupBy(
                         allResults.filter(s => s.parent_segment_id),
                         s => s.parent_segment_id
                     );

                     segments = allResults
                         .filter(s => s.show_in_general !== false && !s.parent_segment_id)
                         .map(seg => ({
                             ...seg,
                             _resolved_sub_assignments: resolveChildrenAsSubAssignments(childByParent[seg.id])
                         }))
                         .sort((a, b) => {
                             const aSessionIdx = sessionOrderMap.get(a.session_id) ?? 999;
                             const bSessionIdx = sessionOrderMap.get(b.session_id) ?? 999;
                             if (aSessionIdx !== bSessionIdx) return aSessionIdx - bSessionIdx;
                             return (a.order || 0) - (b.order || 0);
                         });

                     // 2026-03-01: Compute start_time/end_time for service segments that lack them.
                     // Service segments often only have duration_min and order; times must be derived
                     // from session.planned_start_time + cumulative duration of preceding segments.
                     // Without this, StickyOpsDeck sees no start_time and skips all segments → invisible.
                     const sessionStartMap = new Map(sessions.map(s => [s.id, s.planned_start_time]));
                     const segsBySession = {};
                     for (const seg of segments) {
                         if (!segsBySession[seg.session_id]) segsBySession[seg.session_id] = [];
                         segsBySession[seg.session_id].push(seg);
                     }
                     for (const [sid, segs] of Object.entries(segsBySession)) {
                         const baseTime = sessionStartMap.get(sid);
                         if (!baseTime) continue;
                         const [bH, bM] = baseTime.split(':').map(Number);
                         let cumulativeMin = 0;
                         for (const seg of segs) {
                             if (!seg.start_time) {
                                 const startTotal = bH * 60 + bM + cumulativeMin;
                                 const sH = Math.floor(startTotal / 60);
                                 const sM = startTotal % 60;
                                 seg.start_time = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
                             }
                             const dur = seg.duration_min || 0;
                             if (!seg.end_time && seg.start_time) {
                                 const [eH, eM] = seg.start_time.split(':').map(Number);
                                 const endTotal = eH * 60 + eM + dur;
                                 seg.end_time = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
                             }
                             cumulativeMin += dur;
                         }
                     }

                     // B. Inject break segment between service sessions if there's a time gap
                     if (sessions.length >= 2) {
                         const enrichedSegments = [];
                         for (let sIdx = 0; sIdx < sessions.length; sIdx++) {
                             const currentSession = sessions[sIdx];
                             const currentSessionSegments = segments.filter(seg => seg.session_id === currentSession.id);
                             enrichedSegments.push(...currentSessionSegments);

                             if (sIdx < sessions.length - 1) {
                                 const nextSession = sessions[sIdx + 1];
                                 const nextSessionSegments = segments.filter(seg => seg.session_id === nextSession.id);

                                 if (currentSessionSegments.length > 0 && nextSessionSegments.length > 0) {
                                     const lastSeg = currentSessionSegments[currentSessionSegments.length - 1];
                                     const firstNextSeg = nextSessionSegments[0];

                                     if (lastSeg.end_time && firstNextSeg.start_time && lastSeg.end_time < firstNextSeg.start_time) {
                                         const [endH, endM] = lastSeg.end_time.split(':').map(Number);
                                         const [startH, startM] = firstNextSeg.start_time.split(':').map(Number);
                                         const diffMin = (startH * 60 + startM) - (endH * 60 + endM);

                                         if (diffMin > 0) {
                                             const recesoKey = currentSession.name || sessions[0]?.name || "9:30am";
                                             const notes = targetProgram.receso_notes?.[recesoKey]
                                                 || (targetProgram.receso_notes ? Object.values(targetProgram.receso_notes)[0] : "")
                                                 || "";

                                             enrichedSegments.push({
                                                 id: 'generated-break-inter-service',
                                                 start_time: lastSeg.end_time,
                                                 end_time: firstNextSeg.start_time,
                                                 duration_min: diffMin,
                                                 title: 'Receso',
                                                 segment_type: 'Receso',
                                                 session_id: 'slot-break',
                                                 description: notes,
                                                 presenter: notes ? 'Coordinador' : '',
                                                 actions: [
                                                     { id: 'break-reset', label: 'STAGE RESET', department: 'Stage & Decor', timing: 'after_start', offset_min: 0, order: 1 },
                                                     { id: 'break-sound', label: 'AUDIO CHECK', department: 'Sound', timing: 'after_start', offset_min: 10, order: 2 }
                                                 ]
                                             });
                                         }
                                     }
                                 }
                             }
                         }
                         segments = enrichedSegments;
                     }
                 }
            }

            // Fetch Linked Segment Actions for Services too (sequential with retry)
            if (segments.length > 0 && segments[0].id) { // Only if segments have IDs (real entities)
                const segmentIds = segments.map(s => s.id).filter(Boolean);
                if (segmentIds.length > 0) {
                    const allActions = [];
                    for (const segId of segmentIds) {
                        const actions = await withRetry(() => base44.asServiceRole.entities.SegmentAction.filter({ segment_id: segId }, undefined, undefined, undefined, dataEnv));
                        allActions.push(...actions);
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
                // Fetch PreSessionDetails (sequential with retry)
                for (const s of sessions) {
                    const details = await withRetry(() => base44.asServiceRole.entities.PreSessionDetails.filter({ session_id: s.id }, undefined, undefined, undefined, dataEnv));
                    preSessionDetails.push(...details);
                }

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

            // (JSON fallbacks for Pre_Service_Notes have been removed - handled entirely by PreSessionDetails and Entity Lift)

            // Fetch Rooms & Adjustments (Parallelized above)
            [rooms, eventDays, liveAdjustments] = await fetchExtrasPromise;

            const responsePayload = {
                event: null,
                program: { ...targetProgram, _isEvent: false },
                sessions,
                segments,
                rooms,
                eventDays: [],
                preSessionDetails,
                liveAdjustments,
                streamBlocks: []
            };
            if (optionsData) Object.assign(responsePayload, optionsData);
            return Response.json(responsePayload);
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