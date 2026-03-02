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

    // ─── CTO-2 (2026-03-02): Concurrency guard using ActiveProgramCache as soft lock ───
    // Prevents two near-simultaneous refreshes (e.g. entity automations within 200ms)
    // from both rebuilding cache at the same time. 30s TTL prevents stale locks.
    try {
      const existingLock = await withRetry(() =>
        base44.asServiceRole.entities.ActiveProgramCache.filter({ cache_key: 'current_display' })
      );
      if (existingLock.length > 0) {
        const lockEntry = existingLock[0];
        if (lockEntry.refresh_in_progress && lockEntry.last_refresh_at) {
          const lockAge = Date.now() - new Date(lockEntry.last_refresh_at).getTime();
          if (lockAge < 30000) {
            console.log(`[refreshActiveProgram] Concurrency guard: another refresh in progress (${lockAge}ms ago). Skipping.`);
            return Response.json({ skipped: true, reason: 'concurrency_guard' });
          }
          // Lock older than 30s — stale, proceed and overwrite
          console.log(`[refreshActiveProgram] Stale lock detected (${lockAge}ms). Proceeding.`);
        }
        // Set the lock
        await withRetry(() =>
          base44.asServiceRole.entities.ActiveProgramCache.update(lockEntry.id, {
            refresh_in_progress: true,
            last_refresh_at: new Date().toISOString(),
          })
        );
      }
    } catch (lockErr) {
      console.warn('[refreshActiveProgram] Lock check failed (non-fatal, proceeding):', lockErr.message);
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
    // BUG FIX (2026-03-01): Segment, Session, PreSessionDetails, SegmentAction,
    // and StreamBlock automations were falling through to `return false`, causing
    // the current_display cache to NEVER rebuild on child entity changes.
    // This was the root cause of PWA/TV displays not updating after service edits.
    // Only Service and Event entities can be checked against the display window
    // by ID — child entities must always proceed to rebuild.
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
        // Child entities (Segment, Session, PreSessionDetails, SegmentAction, StreamBlock)
        // cannot be cheaply checked by ID against the display window.
        // Always proceed to rebuild — the snapshot builder handles scoping.
        if (['Segment', 'Session', 'PreSessionDetails', 'SegmentAction', 'StreamBlock'].includes(changedEntityType)) {
          return true;
        }
        // Unknown entity type — skip to avoid unnecessary rebuilds
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
      const response = await base44.functions.invoke('buildProgramSnapshot', {
        targetProgram,
        isEvent
      });
      programSnapshot = response.data;
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

    // CTO-2 (2026-03-02): Clear concurrency lock on write
    cacheData.refresh_in_progress = false;

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
            // GRO-4 (2026-03-02): Scope cache invalidation to affected program.
            // Try to resolve the changed entity's parent program. Only rebuild
            // warm caches that match. Falls back to rebuild-all on resolution failure.
            if (changedEntityId) {
              try {
                let parentProgramId = null;
                if (changedEntityType === 'Segment' || changedEntityType === 'SegmentAction') {
                  // Resolve: Segment → session_id → Session → service_id/event_id
                  const segId = changedEntityType === 'SegmentAction'
                    ? (await withRetry(() => base44.asServiceRole.entities.SegmentAction.filter({ id: changedEntityId })))?.[0]?.segment_id
                    : changedEntityId;
                  if (segId) {
                    const segs = await withRetry(() => base44.asServiceRole.entities.Segment.filter({ id: segId }));
                    const seg = segs?.[0];
                    if (seg?.session_id) {
                      const sess = await withRetry(() => base44.asServiceRole.entities.Session.filter({ id: seg.session_id }));
                      parentProgramId = sess?.[0]?.service_id || sess?.[0]?.event_id || null;
                    }
                  }
                } else if (changedEntityType === 'Session') {
                  const sess = await withRetry(() => base44.asServiceRole.entities.Session.filter({ id: changedEntityId }));
                  parentProgramId = sess?.[0]?.service_id || sess?.[0]?.event_id || null;
                } else if (changedEntityType === 'PreSessionDetails' || changedEntityType === 'StreamBlock') {
                  // These have session_id directly
                  const entityType = changedEntityType === 'PreSessionDetails' ? 'PreSessionDetails' : 'StreamBlock';
                  const items = await withRetry(() => base44.asServiceRole.entities[entityType].filter({ id: changedEntityId }));
                  if (items?.[0]?.session_id) {
                    const sess = await withRetry(() => base44.asServiceRole.entities.Session.filter({ id: items[0].session_id }));
                    parentProgramId = sess?.[0]?.service_id || sess?.[0]?.event_id || null;
                  }
                }
                // Only rebuild if this warm cache matches the resolved parent
                if (parentProgramId) {
                  shouldRebuild = entryProgramId === parentProgramId;
                } else {
                  // Resolution failed — fall back to rebuild all (safe default)
                  shouldRebuild = true;
                }
              } catch (resolveErr) {
                console.warn(`[refreshActiveProgram] GRO-4 parentage resolution failed: ${resolveErr.message}. Rebuilding all.`);
                shouldRebuild = true;
              }
            } else {
              shouldRebuild = true;
            }
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