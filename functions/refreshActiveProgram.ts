/**
 * refreshActiveProgram — Centralized Cache Builder (v2.0 — Hardened)
 * 
 * PURPOSE: Pre-computes and caches the active program data so that
 * TV Display, MyProgram, and Live View can open INSTANTLY with zero
 * backend calls. All display surfaces read from ActiveProgramCache
 * instead of making expensive multi-entity queries.
 *
 * TRIGGERS:
 *   1. Scheduled: Daily at midnight ET
 *   2. Entity automation: Service create/update, Event create/update,
 *      LiveTimeAdjustment create/update (Segment automation DISABLED — see Decision)
 *   3. Manual: Admin can invoke from dashboard
 *   4. Explicit: updateLiveSegmentTiming calls once after batch completes
 *
 * HARDENING (2026-02-15 audit):
 *   - Replaced N+1 per-session fetching with bulk entity fetches + client-side grouping
 *     (was: 144+ API calls for 8-session event → now: ~8 total API calls)
 *   - Added admin guard for manual invocation
 *   - Added concurrency guard (skips if another refresh is in-flight)
 *   - Segment automation DISABLED to prevent fan-out storms;
 *     updateLiveSegmentTiming calls this explicitly after batch
 *
 * Decision: "Cache-first architecture for display surfaces"
 * Decision: "Bulk fetch + client-side partition to eliminate N+1"
 * Decision: "Disable Segment entity automation to prevent fan-out storms"
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

// ═══════════════════════════════════════════════════════════════
// BULK FETCH HELPERS — Eliminates N+1 query pattern.
// Instead of fetching per-session, fetch ALL records for the event
// and partition client-side. Reduces API calls from O(sessions*segments)
// to O(1) per entity type.
// ═══════════════════════════════════════════════════════════════

function groupBy(arr, keyFn) {
  const map = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return map;
}

// DECISION-004 (ATT-015): Canonical chronological session sort.
// Sort by date → planned_start_time → order → name.
// The `order` field is unreliable (can be duplicated or wrong).
// Inlined here because Deno backend cannot import frontend modules.
// MUST stay in sync with components/utils/sessionSort.js
// ═══════════════════════════════════════════════════════════════
// COMPUTE SEGMENT TIMES — Derives start_time/end_time for segments
// that don't have them, using session.planned_start_time + cumulative
// durations. This is the SINGLE SOURCE OF TRUTH for timing computation.
// Must be applied before writing to cache so ALL consumers get times.
// Inlined here because Deno backend cannot import frontend modules.
// ═══════════════════════════════════════════════════════════════
function computeSegmentTimes(segments, sessions) {
  if (!segments || segments.length === 0) return segments;

  const sessionMap = {};
  (sessions || []).forEach(s => { sessionMap[s.id] = s; });

  // Group segments by session, preserving original array
  const segsBySession = {};
  segments.forEach(seg => {
    const sid = seg.session_id || '_none';
    if (!segsBySession[sid]) segsBySession[sid] = [];
    segsBySession[sid].push(seg);
  });

  // Sort each group by order
  Object.values(segsBySession).forEach(arr =>
    arr.sort((a, b) => (a.order || 0) - (b.order || 0))
  );

  // Build computed times map: segmentId → { start_time, end_time }
  const computedTimes = {};
  Object.entries(segsBySession).forEach(([sid, segs]) => {
    const session = sessionMap[sid] || {};
    const baseTime = session.planned_start_time || null;
    let curH = 0, curM = 0;
    if (baseTime) {
      const [h, m] = baseTime.split(':').map(Number);
      curH = h; curM = m;
    }

    segs.forEach(seg => {
      // Use explicit start_time if present, otherwise use running cursor
      let segStart = seg.start_time || null;
      if (!segStart && baseTime) {
        segStart = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;
      }
      // If segment has explicit start_time, reset the cursor to it
      if (seg.start_time) {
        const [h, m] = seg.start_time.split(':').map(Number);
        curH = h; curM = m;
      }

      const dur = seg.duration_min || 0;
      const d = new Date(2000, 0, 1, curH, curM + dur);
      curH = d.getHours(); curM = d.getMinutes();

      let segEnd = seg.end_time || null;
      if (!segEnd && baseTime) {
        segEnd = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;
      }

      computedTimes[seg.id] = { start_time: segStart, end_time: segEnd };
    });
  });

  // Return new array with computed times filled in (never mutates originals)
  return segments.map(seg => {
    const times = computedTimes[seg.id];
    if (!times) return seg;
    return {
      ...seg,
      start_time: seg.start_time || times.start_time || null,
      end_time: seg.end_time || times.end_time || null,
    };
  });
}

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

    // ADMIN GUARD: Manual invocations require admin role.
    // Entity automations and scheduled triggers don't have a user context,
    // so we only enforce this when there IS an authenticated user.
    if (trigger === 'manual') {
      try {
        const user = await base44.auth.me();
        if (user && user.role !== 'admin') {
          return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }
      } catch {
        // No user context (automation/scheduled) — proceed
      }
    }

    const todayStr = getETDateStr();
    const today = new Date(todayStr);

    console.log(`[refreshActiveProgram] Trigger: ${trigger}, Date: ${todayStr}, Entity: ${changedEntityType}/${changedEntityId}`);

    // Debug mode: return snapshot of the current cache with segment time diagnostics
    if (trigger === 'debug_times') {
      const existing = await withRetry(() =>
        base44.asServiceRole.entities.ActiveProgramCache.filter({ cache_key: 'current_display' })
      );
      const snapshot = existing?.[0]?.program_snapshot;
      if (!snapshot) return Response.json({ error: 'No cache found' });
      const segs = (snapshot.segments || []).slice(0, 5).map(s => ({
        id: s.id, title: s.title, start_time: s.start_time, end_time: s.end_time,
        duration_min: s.duration_min, session_id: s.session_id, order: s.order
      }));
      const sess = (snapshot.sessions || []).map(s => ({
        id: s.id, name: s.name, planned_start_time: s.planned_start_time
      }));
      return Response.json({ total_segments: (snapshot.segments || []).length, sessions: sess, sample_segments: segs });
    }

    // ─── STEP 1: Fetch all events and services ───
    const allEvents = await withRetry(() =>
      base44.asServiceRole.entities.Event.list('-start_date')
    );
    const allServices = await withRetry(() =>
      base44.asServiceRole.entities.Service.list('-date')
    );

    // ─── STEP 2: Filter to display windows ───
    const selectorEvents = allEvents.filter(e => {
      if (e.status === 'archived' || e.status === 'template') return false;
      if (!e.start_date) return false;
      const start = new Date(e.start_date);
      const diffDays = (start - today) / (1000 * 60 * 60 * 24);
      return diffDays > -7 && diffDays <= 90;
    }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    // Selector window: only today and future services appear in the dropdown.
    // Services are single-day, so there's no reason to show yesterday's.
    // (Events keep a -7 day window because they can span multiple days.)
    const selectorServices = allServices.filter(s => {
      if (s.status !== 'active') return false;
      if (!s.date || s.origin === 'blueprint') return false;
      const sDate = new Date(s.date);
      const diffDays = (sDate - today) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Auto-detect window: tighter
    const relevantEvents = selectorEvents.filter(e => {
      if (e.status !== 'confirmed' && e.status !== 'in_progress') return false;
      const start = new Date(e.start_date);
      const diffDays = (start - today) / (1000 * 60 * 60 * 24);
      return diffDays > -7 && diffDays <= 4;
    });

    // Auto-detect: services within the next 7 days are candidates (matches selector window)
    const relevantServices = selectorServices.filter(s => {
      const sDate = new Date(s.date);
      const diffDays = (sDate - today) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    });

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
        // LiveTimeAdjustment — always refresh (they directly affect displayed timing)
        if (changedEntityType === 'LiveTimeAdjustment') return true;
        // For any other entity type, skip (Segment automation is disabled)
        return false;
      })();

      if (!isRelevant) {
        console.log(`[refreshActiveProgram] Entity ${changedEntityType}/${changedEntityId} outside window. Skipping.`);
        return Response.json({ skipped: true, reason: 'outside_display_window' });
      }
    }

    // ─── STEP 3: Determine active program (auto-detection only) ───
    let targetProgram = null;
    let isEvent = false;

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
      const futureService = relevantServices.find(s => s.date > todayStr);
      const futureEvent = relevantEvents.find(e => e.start_date > todayStr);

      if (futureService && futureEvent) {
        if (futureService.date <= futureEvent.start_date) {
          targetProgram = futureService; isEvent = false;
        } else {
          targetProgram = futureEvent; isEvent = true;
        }
      } else if (futureService) {
        targetProgram = futureService; isEvent = false;
      } else if (futureEvent) {
        targetProgram = futureEvent; isEvent = true;
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

    // ─── STEP 6: Rebuild warm cache entries for actively-worked programs ───
    // MULTI-SLOT WARM CACHE (2026-02-28): When entity automations fire,
    // also rebuild any warm cache entries (event_{id} / service_{id}) that
    // reference the changed entity. This keeps warm caches fresh without
    // requiring users to open the page again.
    // Only runs on entity triggers (not manual or midnight — those handle current_display only).
    if (trigger !== 'manual' && trigger !== 'midnight') {
      try {
        const allCacheEntries = await withRetry(() =>
          base44.asServiceRole.entities.ActiveProgramCache.list('-last_refresh_at')
        );

        // Find warm cache entries (not current_display) that might need rebuilding.
        // Filter to entries refreshed within last 7 days (stale entries ignored).
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const warmEntries = allCacheEntries.filter(entry => {
          if (entry.cache_key === 'current_display') return false;
          if (!entry.last_refresh_at) return false;
          return new Date(entry.last_refresh_at) > sevenDaysAgo;
        });

        // Rebuild entries that match the changed entity or the auto-detected program
        for (const entry of warmEntries) {
          const entryIsEvent = entry.program_type === 'event';
          const entryProgramId = entry.program_id;

          // Check if this entry's program was affected by the trigger
          let shouldRebuild = false;

          if (changedEntityType === 'Service' && !entryIsEvent && entryProgramId === changedEntityId) {
            shouldRebuild = true;
          } else if (changedEntityType === 'Event' && entryIsEvent && entryProgramId === changedEntityId) {
            shouldRebuild = true;
          } else if (changedEntityType === 'LiveTimeAdjustment') {
            // LiveTimeAdjustments: rebuild if the entry is a service (adjustments only apply to services)
            shouldRebuild = !entryIsEvent;
          } else if (['Segment', 'Session', 'SegmentAction', 'PreSessionDetails', 'StreamBlock'].includes(changedEntityType)) {
            // For these entities, we can't cheaply check parentage without fetching.
            // Rebuild all warm entries (capped at 5, so this is bounded).
            shouldRebuild = true;
          }

          if (!shouldRebuild) continue;

          console.log(`[refreshActiveProgram] Rebuilding warm cache: ${entry.cache_key}`);
          try {
            // Find the program entity
            let programEntity = null;
            if (entryIsEvent) {
              const events = await withRetry(() =>
                base44.asServiceRole.entities.Event.filter({ id: entryProgramId })
              );
              programEntity = events?.[0];
            } else {
              const services = await withRetry(() =>
                base44.asServiceRole.entities.Service.filter({ id: entryProgramId })
              );
              programEntity = services?.[0];
            }

            if (!programEntity) {
              console.log(`[refreshActiveProgram] Warm cache ${entry.cache_key}: program not found, deleting stale entry`);
              await withRetry(() =>
                base44.asServiceRole.entities.ActiveProgramCache.delete(entry.id)
              );
              continue;
            }

            const warmSnapshot = await buildProgramSnapshot(base44, programEntity, entryIsEvent);
            await withRetry(() =>
              base44.asServiceRole.entities.ActiveProgramCache.update(entry.id, {
                program_snapshot: warmSnapshot,
                program_name: programEntity.name || '',
                last_refresh_trigger: `entity_${changedEntityType}`,
                last_refresh_at: new Date().toISOString(),
              })
            );
            console.log(`[refreshActiveProgram] Rebuilt warm cache: ${entry.cache_key}`);
          } catch (warmErr) {
            console.error(`[refreshActiveProgram] Failed to rebuild warm cache ${entry.cache_key}:`, warmErr.message);
            // Non-fatal: warm cache miss just means slower first load
          }
        }
      } catch (warmScanErr) {
        console.error('[refreshActiveProgram] Warm cache scan failed (non-fatal):', warmScanErr.message);
      }
    }

    // ─── STEP 7: Midnight cleanup — evict stale warm cache entries (>7 days) ───
    if (trigger === 'midnight') {
      try {
        const allEntries = await withRetry(() =>
          base44.asServiceRole.entities.ActiveProgramCache.list()
        );
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        for (const entry of allEntries) {
          if (entry.cache_key === 'current_display') continue; // Never evict auto-detected
          if (!entry.last_refresh_at || new Date(entry.last_refresh_at) < sevenDaysAgo) {
            console.log(`[refreshActiveProgram] Evicting stale warm cache: ${entry.cache_key} (last refresh: ${entry.last_refresh_at})`);
            await withRetry(() =>
              base44.asServiceRole.entities.ActiveProgramCache.delete(entry.id)
            );
          }
        }

        // Also clear admin override at midnight (existing behavior)
        if (existing?.[0]?.admin_override_id) {
          await withRetry(() =>
            base44.asServiceRole.entities.ActiveProgramCache.update(existing[0].id, {
              admin_override_type: null,
              admin_override_id: null,
              admin_override_by: null,
              admin_override_at: null,
            })
          );
          console.log('[refreshActiveProgram] Cleared admin override at midnight');
        }
      } catch (cleanupErr) {
        console.error('[refreshActiveProgram] Midnight cleanup failed (non-fatal):', cleanupErr.message);
      }
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
// SNAPSHOT BUILDER — v2.0 HARDENED (Bulk Fetch Pattern)
//
// Previous: Fetched Segments, PreSessionDetails, StreamBlocks,
//   SegmentActions PER SESSION then PER SEGMENT. O(S*N) API calls.
//   8 sessions × 15 segments = ~144 API calls.
//
// Now: Fetches ALL entities in bulk, then partitions client-side.
//   ~8 total API calls regardless of event size.
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

    // BULK FETCH: All entities for this event in parallel (5 API calls total)
    const [eventDaysResult, sessionsResult] = await Promise.all([
      withRetry(() => base44.asServiceRole.entities.EventDay.filter({ event_id: targetProgram.id })),
      withRetry(() => base44.asServiceRole.entities.Session.filter({ event_id: targetProgram.id })),
    ]);

    eventDays = eventDaysResult;
    // DECISION-004 (ATT-015): Sort sessions chronologically, not by unreliable `order` field
    sessions = sortSessionsChronologically(sessionsResult);

    if (sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);

      // BULK FETCH: All segments, preSessionDetails, streamBlocks for ALL sessions at once.
      // SDK .filter() with { session_id: id } returns records for one session,
      // so we batch in groups of 10 (vs previous per-session sequential).
      // This caps API calls at ceil(sessions/10) * 3 instead of sessions * 3.
      const BATCH = 10;
      let allSegments = [];
      let allPreSessionDetails = [];
      let allStreamBlocks = [];

      for (let i = 0; i < sessionIds.length; i += BATCH) {
        const batch = sessionIds.slice(i, i + BATCH);
        const batchResults = await Promise.all(batch.map(sid =>
          Promise.all([
            withRetry(() => base44.asServiceRole.entities.Segment.filter({ session_id: sid }, 'order')),
            withRetry(() => base44.asServiceRole.entities.PreSessionDetails.filter({ session_id: sid })),
            withRetry(() => base44.asServiceRole.entities.StreamBlock.filter({ session_id: sid }, 'order')),
          ])
        ));
        for (const [segs, details, blocks] of batchResults) {
          allSegments.push(...segs);
          allPreSessionDetails.push(...details);
          allStreamBlocks.push(...blocks);
        }
      }

      preSessionDetails = allPreSessionDetails;
      streamBlocks = allStreamBlocks;

      // Process segments: resolve children onto parents, filter, add date, sort
      // orderMap uses chronological index from sortSessionsChronologically (ATT-015)
      const orderMap = new Map(sessions.map((s, i) => [s.id, i]));
      const sessionDateMap = new Map(sessions.map(s => [s.id, s.date]));

      // Resolve child segments (e.g. Ministración) onto their parents
      // so the TV display can render them inline without separate entries.
      const childByParent = groupBy(
        allSegments.filter(s => s.parent_segment_id),
        s => s.parent_segment_id
      );

      segments = allSegments
        .filter(seg => seg.show_in_general !== false && !seg.parent_segment_id)
        .map(seg => ({
          ...seg,
          date: sessionDateMap.get(seg.session_id) || null,
          _resolved_sub_assignments: resolveChildrenAsSubAssignments(childByParent[seg.id]),
        }))
        .sort((a, b) => {
          const aIdx = orderMap.get(a.session_id) ?? 999;
          const bIdx = orderMap.get(b.session_id) ?? 999;
          if (aIdx !== bIdx) return aIdx - bIdx;
          return (a.order || 0) - (b.order || 0);
        });

      // FIX (2026-03-01): Compute start/end times for segments that lack them.
      // Entity segments often have start_time=null — derive from session's
      // planned_start_time + cumulative durations. Applied at cache-build time
      // so ALL consumers (Live View, MyProgram, TV) get correct times.
      segments = computeSegmentTimes(segments, sessions);

      // BULK FETCH: SegmentActions for ALL segments at once (batch of 10)
      if (segments.length > 0) {
        const segmentIds = segments.map(s => s.id).filter(Boolean);
        const allActions = [];
        for (let i = 0; i < segmentIds.length; i += BATCH) {
          const batch = segmentIds.slice(i, i + BATCH);
          const batchResults = await Promise.all(
            batch.map(segId => withRetry(() => base44.asServiceRole.entities.SegmentAction.filter({ segment_id: segId })))
          );
          allActions.push(...batchResults.flat());
        }

        const actionsBySegment = groupBy(allActions, a => a.segment_id);
        segments = segments.map(s => {
          const linked = actionsBySegment[s.id] || [];
          const embedded = s.segment_actions || [];
          return { ...s, actions: [...embedded, ...linked].sort((a, b) => (a.order || 0) - (b.order || 0)) };
        });
      }
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

    // BUG FIX (audit): allSlotSegments must be declared at function scope 
    // so pre_service_notes injection can reference it regardless of which branch ran.
    let allSlotSegments = [];
    
    // Check for linked sessions
    const directSessions = await withRetry(() =>
      base44.asServiceRole.entities.Session.filter({ service_id: targetProgram.id })
    );
    // Strict Entity Mode - JSON Fallbacks removed completely
    
    if (directSessions.length > 0) {
      // DECISION-004 (ATT-015): Sort sessions chronologically, not by unreliable `order` field
      sessions = sortSessionsChronologically(directSessions);
      const sessionIds = sessions.map(s => s.id);

      // Bulk fetch segments, preSessionDetails, streamBlocks for all sessions (batched)
      const BATCH = 10;
      let allSegs = [];
      let allPreSessionDetails = [];
      let allStreamBlocks = [];

      for (let i = 0; i < sessionIds.length; i += BATCH) {
        const batch = sessionIds.slice(i, i + BATCH);
        const batchResults = await Promise.all(batch.map(sid =>
          Promise.all([
            withRetry(() => base44.asServiceRole.entities.Segment.filter({ session_id: sid }, 'order')),
            withRetry(() => base44.asServiceRole.entities.PreSessionDetails.filter({ session_id: sid })),
            withRetry(() => base44.asServiceRole.entities.StreamBlock.filter({ session_id: sid }, 'order')),
          ])
        ));
        for (const [segs, details, blocks] of batchResults) {
          allSegs.push(...segs);
          allPreSessionDetails.push(...details);
          allStreamBlocks.push(...blocks);
        }
      }

      streamBlocks = allStreamBlocks;
      preSessionDetails = allPreSessionDetails;

      if (allSegs.length > 0) {
        // Resolve child segments onto parents for inline sub-assignment display
        const svcChildByParent = groupBy(
          allSegs.filter(s => s.parent_segment_id),
          s => s.parent_segment_id
        );

        // Sort by session chronological position, then segment order (ATT-015)
        const sessionsMap = new Map(sessions.map((s, i) => [s.id, i]));
        segments = allSegs
          .filter(s => s.show_in_general !== false && !s.parent_segment_id)
          .map(seg => ({
            ...seg,
            _resolved_sub_assignments: resolveChildrenAsSubAssignments(svcChildByParent[seg.id]),
          }))
          .sort((a, b) => {
            const aIdx = sessionsMap.get(a.session_id) ?? 999;
            const bIdx = sessionsMap.get(b.session_id) ?? 999;
            if (aIdx !== bIdx) return aIdx - bIdx;
            return (a.order || 0) - (b.order || 0);
          });

        // FIX (2026-03-01): Compute start/end times for segments that lack them.
        // Same logic as event path — derive from session planned_start_time + cumulative durations.
        const beforeCount = segments.filter(s => !s.start_time).length;
        segments = computeSegmentTimes(segments, sessions);
        const afterCount = segments.filter(s => !s.start_time).length;
        console.log(`[refreshActiveProgram] Service time computation: ${beforeCount} segments without start_time → ${afterCount} after computation (${segments.length} total)`);
        if (segments.length > 0) {
          console.log(`[refreshActiveProgram] First segment times: start=${segments[0].start_time}, end=${segments[0].end_time}, title=${segments[0].title}`);
        }

        // Bulk fetch SegmentActions for all segments
        if (segments.length > 0) {
          const segmentIds = segments.map(s => s.id).filter(Boolean);
          const allActions = [];
          for (let i = 0; i < segmentIds.length; i += BATCH) {
            const batch = segmentIds.slice(i, i + BATCH);
            const batchResults = await Promise.all(
              batch.map(segId => withRetry(() => base44.asServiceRole.entities.SegmentAction.filter({ segment_id: segId })))
            );
            allActions.push(...batchResults.flat());
          }

          const actionsBySegment = groupBy(allActions, a => a.segment_id);
          segments = segments.map(s => {
            const linked = actionsBySegment[s.id] || [];
            const embedded = s.segment_actions || [];
            return { ...s, actions: [...embedded, ...linked].sort((a, b) => (a.order || 0) - (b.order || 0)) };
          });
        }

        if (sessions.length >= 2) {
          const firstSlotName = sessions[0]?.name || "9:30am";
          const recesoNotes = targetProgram.receso_notes?.[firstSlotName] 
            || (targetProgram.receso_notes ? Object.values(targetProgram.receso_notes)[0] : "") 
            || "";
          injectInterSessionBreak(segments, sessions[0].id, sessions[1].id, recesoNotes);
        }

        injectPreSessionActions(segments, sessions, preSessionDetails);
      }
    }

    // Phase 4 Entity Lift: streamBlocks now populated for entity-backed services
    return {
      event: null,
      program: { ...targetProgram, _isEvent: false },
      sessions,
      segments,
      rooms,
      eventDays: [],
      preSessionDetails,
      liveAdjustments,
      streamBlocks,
    };
  }
}

// ─── Break injection between sessions (shared by entity + JSON paths) ───
// Consolidated to prevent drift between the two code paths (audit Risk #3).
function injectInterSessionBreak(segments, firstSessionId, secondSessionId, recesoNotes) {
  const firstSegs = segments.filter(s => s.session_id === firstSessionId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const secondSegs = segments.filter(s => s.session_id === secondSessionId).sort((a, b) => (a.order || 0) - (b.order || 0));

  if (firstSegs.length === 0 || secondSegs.length === 0) return;

  const lastSeg = firstSegs[firstSegs.length - 1];
  const firstNextSeg = secondSegs[0];
  if (!lastSeg.end_time || !firstNextSeg.start_time || lastSeg.end_time >= firstNextSeg.start_time) return;

  const [endH, endM] = lastSeg.end_time.split(':').map(Number);
  const [startH, startM] = firstNextSeg.start_time.split(':').map(Number);
  const diffMin = (startH * 60 + startM) - (endH * 60 + endM);
  if (diffMin <= 0) return;

  const breakSegment = {
    id: 'generated-break-inter-service',
    start_time: lastSeg.end_time,
    end_time: firstNextSeg.start_time,
    duration_min: diffMin,
    title: 'Receso',
    segment_type: 'Receso',
    session_id: 'slot-break',
    description: recesoNotes || "",
    actions: [
      { id: 'break-reset', label: 'STAGE RESET', department: 'Stage & Decor', timing: 'after_start', offset_min: 0, order: 1 },
      { id: 'break-sound', label: 'AUDIO CHECK', department: 'Sound', timing: 'after_start', offset_min: 10, order: 2 },
    ],
  };

  const insertIdx = segments.findIndex(s => s.session_id === secondSessionId);
  if (insertIdx !== -1) {
    segments.splice(insertIdx, 0, breakSegment);
  } else {
    segments.push(breakSegment);
  }
}

// ─── Pre-session detail injection helper ───
function injectPreSessionActions(segments, sessions, preSessionDetails) {
  if (!sessions.length || !preSessionDetails.length) return;

  const detailsBySession = {};
  preSessionDetails.forEach(d => detailsBySession[d.session_id] = d);

  const segmentsBySession = groupBy(segments, seg => seg.session_id);

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

// ─── Resolve child segments onto parent as sub-assignments ───
// Child segments (e.g. Ministración within Alabanza) are filtered from
// the flat timeline but their data needs to appear inline on the parent.
// Returns a resolved array with label + presenter for display.
function resolveChildrenAsSubAssignments(children) {
  if (!children || children.length === 0) return [];
  return children
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(child => ({
      label: child.title || 'Sub-assignment',
      presenter: child.presenter || '',
      duration_min: child.duration_min || 5,
      segment_type: child.segment_type || 'Ministración',
    }));
}