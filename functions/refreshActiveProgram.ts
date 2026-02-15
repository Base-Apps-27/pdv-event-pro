/**
 * refreshActiveProgram — Centralized Cache Builder
 * 
 * PURPOSE: Pre-computes and caches the active program data so that
 * TV Display, MyProgram, and Live View can open INSTANTLY with zero
 * backend calls. All display surfaces read from ActiveProgramCache
 * instead of making expensive multi-entity queries.
 *
 * TRIGGERS:
 *   1. Scheduled: Daily at midnight ET
 *   2. Entity automation: Service create/update, Event create/update
 *   3. Manual: Admin can invoke from dashboard
 *
 * WHAT IT DOES:
 *   1. Determines today's date in ET
 *   2. Finds active events/services within display windows
 *   3. Builds selector options (dropdown data for Live View)
 *   4. For the "current_display" program, fetches ALL related data
 *      (segments, sessions, rooms, actions, pre-session details, etc.)
 *   5. Writes everything to a single ActiveProgramCache record
 *
 * CONSUMERS:
 *   - PublicCountdownDisplay (TV) — reads cache_key='current_display'
 *   - MyProgram — reads cache_key='current_display'
 *   - PublicProgramView (Live View) — reads cache_key='current_display' for initial load,
 *     uses selector_options for dropdowns
 *
 * Decision: "Cache-first architecture for display surfaces"
 * Decision: "Entity subscriptions for real-time timing updates"
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Retry wrapper for rate-limit resilience
async function withRetry(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status || err?.response?.status || 0;
      if (status === 429 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

function getETDateStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parse optional trigger metadata from body
    let trigger = 'manual';
    let changedEntityType = null;
    let changedEntityId = null;
    try {
      const body = await req.json();
      trigger = body?.trigger || body?.event?.type || 'manual';
      changedEntityType = body?.event?.entity_name || body?.changedEntityType || null;
      changedEntityId = body?.event?.entity_id || body?.changedEntityId || null;
    } catch { /* no body or not JSON — fine for scheduled triggers */ }

    const todayStr = getETDateStr();
    const today = new Date(todayStr);

    console.log(`[refreshActiveProgram] Trigger: ${trigger}, Date: ${todayStr}, Entity: ${changedEntityType}/${changedEntityId}`);

    // ─── STEP 1: Fetch all events and services ───
    const allEvents = await withRetry(() =>
      base44.asServiceRole.entities.Event.list('-start_date')
    );
    const allServices = await withRetry(() =>
      base44.asServiceRole.entities.Service.list('-date')
    );

    // ─── STEP 2: Filter to display windows ───
    // ── Selector options: wider window for Live View dropdowns ──
    // Events: past 7 days + next 90 days (Live View shows ~90-day window)
    const selectorEvents = allEvents.filter(e => {
      if (e.status === 'archived' || e.status === 'template') return false;
      if (!e.start_date) return false;
      const start = new Date(e.start_date);
      const diffDays = (start - today) / (1000 * 60 * 60 * 24);
      return diffDays > -7 && diffDays <= 90;
    }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    // Services: past 1 day + next 7 days (Live View shows ~7-day window)
    const selectorServices = allServices.filter(s => {
      if (s.status !== 'active') return false;
      if (!s.date || s.origin === 'blueprint') return false;
      const sDate = new Date(s.date);
      const diffDays = (sDate - today) / (1000 * 60 * 60 * 24);
      return diffDays >= -1 && diffDays <= 7;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    // ── Auto-detect window: tighter for active program detection ──
    // Events: confirmed/in_progress within 4 days ahead or 7 days past
    const relevantEvents = selectorEvents.filter(e => {
      if (e.status !== 'confirmed' && e.status !== 'in_progress') return false;
      const start = new Date(e.start_date);
      const diffDays = (start - today) / (1000 * 60 * 60 * 24);
      return diffDays > -7 && diffDays <= 4;
    });

    // Services: active within 1 day ahead or 2 days past
    const relevantServices = selectorServices.filter(s => {
      const sDate = new Date(s.date);
      const diffDays = (sDate - today) / (1000 * 60 * 60 * 24);
      return diffDays > -2 && diffDays <= 1;
    });

    // Selector options use the wider window so Live View dropdowns show more options
    const selectorOptions = { events: selectorEvents, services: selectorServices };

    // ─── STEP 2b: Early exit for entity triggers outside display window ───
    if (changedEntityType && changedEntityId) {
      const isRelevant = (() => {
        if (changedEntityType === 'Service') {
          return relevantServices.some(s => s.id === changedEntityId);
        }
        if (changedEntityType === 'Event') {
          return relevantEvents.some(e => e.id === changedEntityId);
        }
        // For Segment, Session, LiveTimeAdjustment — always refresh
        // (they're children of the active program)
        return true;
      })();

      if (!isRelevant) {
        console.log(`[refreshActiveProgram] Changed entity ${changedEntityType}/${changedEntityId} is outside display window. Skipping.`);
        return Response.json({ skipped: true, reason: 'outside_display_window' });
      }
    }

    // ─── STEP 3: Determine active program (same logic as getPublicProgramData) ───
    let targetProgram = null;
    let isEvent = false;

    // Priority: today's service > today's event > next upcoming
    const todayService = relevantServices.find(s => s.date === todayStr);
    const todayEvent = relevantEvents.find(e => {
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
      // Next upcoming
      const futureService = relevantServices.find(s => s.date > todayStr);
      const futureEvent = relevantEvents.find(e => e.start_date > todayStr);

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

    // ─── STEP 4: Build full program snapshot ───
    let programSnapshot = null;

    if (targetProgram) {
      programSnapshot = await buildProgramSnapshot(base44, targetProgram, isEvent);
    }

    // ─── STEP 5: Write to ActiveProgramCache ───
    const cacheData = {
      cache_key: 'current_display',
      program_type: targetProgram ? (isEvent ? 'event' : 'service') : 'none',
      program_id: targetProgram?.id || '',
      program_name: targetProgram?.name || '',
      program_date: isEvent ? (targetProgram?.start_date || '') : (targetProgram?.date || ''),
      detected_date: todayStr,
      program_snapshot: programSnapshot,
      selector_options: selectorOptions,
      last_refresh_trigger: trigger,
      last_refresh_at: new Date().toISOString(),
    };

    // Find existing cache record
    const existing = await withRetry(() =>
      base44.asServiceRole.entities.ActiveProgramCache.filter({ cache_key: 'current_display' })
    );

    if (existing && existing.length > 0) {
      await withRetry(() =>
        base44.asServiceRole.entities.ActiveProgramCache.update(existing[0].id, cacheData)
      );
      console.log(`[refreshActiveProgram] Updated cache record ${existing[0].id}`);
    } else {
      await withRetry(() =>
        base44.asServiceRole.entities.ActiveProgramCache.create(cacheData)
      );
      console.log(`[refreshActiveProgram] Created new cache record`);
    }

    return Response.json({
      success: true,
      program_type: cacheData.program_type,
      program_id: cacheData.program_id,
      program_name: cacheData.program_name,
      detected_date: todayStr,
      trigger,
    });

  } catch (error) {
    console.error('[refreshActiveProgram] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ═══════════════════════════════════════════════════════════════
// SNAPSHOT BUILDER — Replicates getPublicProgramData logic
// but writes result to cache instead of returning to caller.
// ═══════════════════════════════════════════════════════════════

async function buildProgramSnapshot(base44, targetProgram, isEvent) {
  let segments = [];
  let sessions = [];
  let rooms = [];
  let eventDays = [];
  let preSessionDetails = [];
  let liveAdjustments = [];
  let streamBlocks = [];

  // Fetch rooms (always needed)
  rooms = await withRetry(() => base44.asServiceRole.entities.Room.list());

  if (isEvent) {
    // ── Event snapshot ──
    if (targetProgram.status !== 'confirmed' && targetProgram.status !== 'in_progress') {
      return { program: { ...targetProgram, _isEvent: true }, sessions: [], segments: [], rooms, eventDays: [], preSessionDetails: [], liveAdjustments: [], streamBlocks: [] };
    }

    eventDays = await withRetry(() =>
      base44.asServiceRole.entities.EventDay.filter({ event_id: targetProgram.id })
    );

    sessions = await withRetry(() =>
      base44.asServiceRole.entities.Session.filter({ event_id: targetProgram.id })
    );
    sessions.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Fetch segments, preSessionDetails, streamBlocks sequentially
    if (sessions.length > 0) {
      for (const s of sessions) {
        const segs = await withRetry(() =>
          base44.asServiceRole.entities.Segment.filter({ session_id: s.id }, 'order')
        );
        segments.push(...segs);

        const details = await withRetry(() =>
          base44.asServiceRole.entities.PreSessionDetails.filter({ session_id: s.id })
        );
        preSessionDetails.push(...details);

        const blocks = await withRetry(() =>
          base44.asServiceRole.entities.StreamBlock.filter({ session_id: s.id }, 'order')
        );
        streamBlocks.push(...blocks);
      }
    }

    // Process segments
    const orderMap = new Map(sessions.map((s, i) => [s.id, i]));
    const sessionDateMap = new Map(sessions.map(s => [s.id, s.date]));

    segments = segments
      .filter(seg => seg.show_in_general)
      .map(seg => ({ ...seg, date: sessionDateMap.get(seg.session_id) || null }))
      .sort((a, b) => {
        const aIdx = orderMap.get(a.session_id) ?? 999;
        const bIdx = orderMap.get(b.session_id) ?? 999;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return (a.order || 0) - (b.order || 0);
      });

    // Fetch and attach segment actions
    if (segments.length > 0) {
      const allActions = [];
      for (const seg of segments) {
        const actions = await withRetry(() =>
          base44.asServiceRole.entities.SegmentAction.filter({ segment_id: seg.id })
        );
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
        return { ...s, actions: [...embedded, ...linked].sort((a, b) => (a.order || 0) - (b.order || 0)) };
      });
    }

    // Inject pre-session details as actions
    injectPreSessionActions(segments, sessions, preSessionDetails);

    return {
      event: targetProgram,
      program: { ...targetProgram, _isEvent: true },
      sessions,
      segments,
      rooms,
      eventDays,
      preSessionDetails,
      liveAdjustments: [],
      streamBlocks,
    };

  } else {
    // ── Service snapshot ──
    liveAdjustments = await withRetry(() =>
      base44.asServiceRole.entities.LiveTimeAdjustment.filter({
        service_id: targetProgram.id,
        date: targetProgram.date,
      })
    );

    // Check for linked sessions
    const directSessions = await withRetry(() =>
      base44.asServiceRole.entities.Session.filter({ service_id: targetProgram.id })
    );
    if (directSessions.length > 0) {
      sessions = directSessions;
      for (const s of sessions) {
        const segs = await withRetry(() =>
          base44.asServiceRole.entities.Segment.filter({ session_id: s.id })
        );
        segments.push(...segs);
      }
      segments = segments.filter(s => s.show_in_general).sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    // Weekly service: process 9:30am/11:30am slots into flat segments
    else if (targetProgram["9:30am"] || targetProgram["11:30am"]) {
      const processSlot = (slotSegments, startHour, startMin) => {
        if (!Array.isArray(slotSegments)) return [];
        let currentMinutes = startHour * 60 + startMin;
        return slotSegments.map((seg, idx) => {
          const h = Math.floor(currentMinutes / 60);
          const m = currentMinutes % 60;
          const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const dur = seg.duration || 0;
          currentMinutes += dur;
          const endH = Math.floor(currentMinutes / 60);
          const endM = currentMinutes % 60;
          const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
          return {
            ...seg,
            id: seg.id || `generated-${startHour}-${idx}`,
            start_time: startTime,
            end_time: endTime,
            duration_min: dur,
            title: seg.title || seg.data?.title || 'Untitled',
            presenter: seg.presenter || seg.data?.presenter || '',
            segment_type: seg.type || 'Generic',
            session_id: `slot-${startHour}-${startMin}`,
          };
        });
      };

      const segs930 = processSlot(targetProgram["9:30am"], 9, 30);
      const segs1130 = processSlot(targetProgram["11:30am"], 11, 30);

      // Insert break between services if there's a gap
      let breakSegment = null;
      if (segs930.length > 0 && segs1130.length > 0) {
        const lastSeg = segs930[segs930.length - 1];
        const firstNextSeg = segs1130[0];
        if (lastSeg.end_time < firstNextSeg.start_time) {
          const [endH, endM] = lastSeg.end_time.split(':').map(Number);
          const [startH, startM] = firstNextSeg.start_time.split(':').map(Number);
          const diffMin = (startH * 60 + startM) - (endH * 60 + endM);
          if (diffMin > 0) {
            const notes = targetProgram.receso_notes?.["11:00am"] || targetProgram.receso_notes?.["11:00"] || "";
            breakSegment = {
              id: 'generated-break-inter-service',
              start_time: lastSeg.end_time,
              end_time: firstNextSeg.start_time,
              duration_min: diffMin,
              title: 'Receso',
              segment_type: 'Receso',
              session_id: 'slot-break',
              description: notes,
              actions: [
                { id: 'break-reset', label: 'STAGE RESET', department: 'Stage & Decor', timing: 'after_start', offset_min: 0, order: 1 },
                { id: 'break-sound', label: 'AUDIO CHECK', department: 'Sound', timing: 'after_start', offset_min: 10, order: 2 },
              ],
            };
          }
        }
      }

      segments = [...segs930, ...(breakSegment ? [breakSegment] : []), ...segs1130];
    }
    // Custom service with embedded segments
    else if (targetProgram.segments && Array.isArray(targetProgram.segments) && targetProgram.segments.length > 0) {
      segments = targetProgram.segments;
    }

    // Inject pre_service_notes for weekly services
    if (targetProgram.pre_service_notes) {
      const injectNotes = (slotKey, slotSessionId) => {
        const notes = targetProgram.pre_service_notes[slotKey];
        if (!notes) return;
        const slotSegments = segments.filter(s => s.session_id === slotSessionId);
        if (slotSegments.length === 0) return;
        slotSegments.sort((a, b) => {
          const [ah, am] = (a.start_time || "00:00").split(':').map(Number);
          const [bh, bm] = (b.start_time || "00:00").split(':').map(Number);
          return (ah * 60 + am) - (bh * 60 + bm);
        });
        const firstSeg = slotSegments[0];
        if (!firstSeg.actions) firstSeg.actions = [];
        const actionId = `pre-note-${slotKey}-${targetProgram.id}`;
        if (!firstSeg.actions.find(a => a.id === actionId)) {
          firstSeg.actions.push({
            id: actionId, label: 'GENERAL NOTES', department: 'Coordinador',
            timing: 'before_start', offset_min: 30, notes, order: -99,
          });
          firstSeg.actions.sort((a, b) => (a.order || 0) - (b.order || 0));
        }
      };
      injectNotes("9:30am", "slot-9-30");
      injectNotes("11:30am", "slot-11-30");
    }

    return {
      event: null,
      program: { ...targetProgram, _isEvent: false },
      sessions,
      segments,
      rooms,
      eventDays: [],
      preSessionDetails: [],
      liveAdjustments,
      streamBlocks: [],
    };
  }
}

// ─── Pre-session detail injection helper ───
function injectPreSessionActions(segments, sessions, preSessionDetails) {
  if (!sessions.length || !preSessionDetails.length) return;

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
    if (!firstSeg || !details) return;

    const getOffset = (segStart, targetTime) => {
      if (!segStart || !targetTime) return 0;
      const [h1, m1] = segStart.split(':').map(Number);
      const [h2, m2] = targetTime.split(':').map(Number);
      return (h1 * 60 + m1) - (h2 * 60 + m2);
    };

    const newActions = [];
    if (details.registration_desk_open_time) {
      newActions.push({ id: `pre-reg-${details.id}`, label: 'REGISTRATION OPEN', department: 'Hospitality', timing: 'before_start', offset_min: getOffset(firstSeg.start_time, details.registration_desk_open_time), order: -100 });
    }
    if (details.library_open_time) {
      newActions.push({ id: `pre-lib-${details.id}`, label: 'LIBRARY OPEN', department: 'Hospitality', timing: 'before_start', offset_min: getOffset(firstSeg.start_time, details.library_open_time), order: -99 });
    }
    if (details.facility_notes) {
      newActions.push({ id: `pre-fac-${details.id}`, label: 'FACILITY INSTRUCTIONS', department: 'Admin', timing: 'before_start', offset_min: 60, notes: details.facility_notes, order: -98 });
    }
    if (details.general_notes) {
      newActions.push({ id: `pre-gen-${details.id}`, label: 'GENERAL NOTES', department: 'Coordinador', timing: 'before_start', offset_min: 30, notes: details.general_notes, order: -97 });
    }

    if (newActions.length > 0) {
      if (!firstSeg.actions) firstSeg.actions = [];
      firstSeg.actions = [...firstSeg.actions, ...newActions];
    }
  });
}