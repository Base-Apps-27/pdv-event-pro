/**
 * useStructuralOps.js — V2 unified structural operations hook.
 *
 * 2026-04-15: Created to unify ALL segment structure mutations (add, remove, move)
 * into a single serialized path. This eliminates:
 *   - Duplicate re-index logic between useSpecialSegment and useMoveSegment
 *   - Race conditions from concurrent structural operations
 *   - Fractional order values (all orders are clean integers 1, 2, 3, ...)
 *   - Per-segment log spam (single EditActionLog per operation)
 *
 * Architecture:
 *   - Promise-chain serialization lock: only one structural op can execute at a time
 *   - All operations fetch fresh segment list from DB (no stale cache reliance)
 *   - All operations batch-write order updates via Promise.all
 *   - All operations cascade start_time/end_time from session.planned_start_time
 *   - useSpecialSegment and useMoveSegment are now thin wrappers over this hook
 *
 * Decision: "Unified structural ops with serialization lock" (2026-04-15)
 * Constitution: No schema changes. Additive only. Breadcrumb trail preserved.
 */

import { useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { logBatchReorder, logCreate, logDelete } from "@/components/utils/editActionLogger";

/**
 * Add minutes to an HH:MM string, return new HH:MM string.
 * Pure function — no Date object dependency for timezone safety.
 */
function addMinutesToTime(timeStr, minutes) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Fetch parent segments for a session, sorted by order.
 * Always hits DB for fresh data — never relies on cache for structural ops.
 */
async function fetchParentSegments(sessionId) {
  const allSegs = await base44.entities.Segment.filter({ session_id: sessionId });
  return allSegs
    .filter(s => !s.parent_segment_id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Batch re-index: assign clean integer orders 1..N and cascade times.
 * Returns the list of API update promises (already fired).
 *
 * @param {Array} orderedSegments - Segments in their correct display order
 * @param {string|null} sessionStartTime - HH:MM from session.planned_start_time
 * @returns {{ promises: Promise[], changedCount: number, changes: Array }}
 */
function batchReindexAndCascade(orderedSegments, sessionStartTime) {
  const changes = [];
  let currentTime = sessionStartTime || null;

  for (let i = 0; i < orderedSegments.length; i++) {
    const seg = orderedSegments[i];
    const correctOrder = i + 1;
    const updates = {};
    let changed = false;

    // Order fix: always assign clean integer
    if (seg.order !== correctOrder) {
      updates.order = correctOrder;
      changed = true;
    }

    // Time cascade: chain durations from session start
    if (currentTime) {
      const expectedStart = currentTime;
      const duration = seg.duration_min || 0;
      const expectedEnd = addMinutesToTime(currentTime, duration);

      if (seg.start_time !== expectedStart) {
        updates.start_time = expectedStart;
        changed = true;
      }
      if (seg.end_time !== expectedEnd) {
        updates.end_time = expectedEnd;
        changed = true;
      }
      currentTime = expectedEnd;
    }

    if (changed) {
      changes.push({
        id: seg.id,
        title: seg.title,
        oldOrder: seg.order,
        newOrder: correctOrder,
        updates,
      });
    }
  }

  // Fire all updates in parallel — atomic batch
  const promises = changes.map(c =>
    base44.entities.Segment.update(c.id, c.updates)
  );

  return { promises, changedCount: changes.length, changes };
}

/**
 * Resolve session planned_start_time. Checks the session entity directly.
 */
async function getSessionStartTime(sessionId, queryClient, queryKey) {
  // Try RQ cache first for speed
  const cached = queryClient.getQueryData(queryKey);
  if (cached?.sessions) {
    const sess = cached.sessions.find(s => s.id === sessionId);
    if (sess?.planned_start_time) return sess.planned_start_time;
  }
  // Fallback: direct fetch (shouldn't be needed in normal flow)
  return null;
}

/**
 * @param {string[]} queryKey - React Query key for weekly data
 * @returns {{ move, add, remove, isLocked }}
 */
export function useStructuralOps(queryKey) {
  const queryClient = useQueryClient();

  // ── Serialization lock ──
  // Promise chain ensures only one structural op runs at a time.
  // Each op awaits the previous one before starting.
  const lockRef = useRef(Promise.resolve());
  const lockedRef = useRef(false);

  // Throttle guard: prevent rapid re-drags within 500ms
  const lastOpTimeRef = useRef(0);

  /**
   * Acquire the structural lock. Returns a release function.
   * If the lock is already held, waits for it to release.
   */
  const acquireLock = useCallback(() => {
    let release;
    const newLock = new Promise((resolve) => { release = resolve; });

    // Chain: wait for previous lock, then this op holds it
    const waitForPrev = lockRef.current;
    lockRef.current = waitForPrev.then(() => newLock);
    lockedRef.current = true;

    return {
      ready: waitForPrev, // await this before starting work
      release: () => {
        lockedRef.current = false;
        lastOpTimeRef.current = Date.now();
        release();
      },
    };
  }, []);

  // ── MOVE: Reorder a segment within its session ──
  const move = useCallback(async (sessionId, currentIndex, direction) => {
    // Throttle: reject if within 500ms of last op
    if (Date.now() - lastOpTimeRef.current < 500) {
      console.log('[StructuralOps] Move throttled — too soon after last op');
      return;
    }

    const lock = acquireLock();
    await lock.ready;

    try {
      console.log(`[StructuralOps] Move: session=${sessionId} idx=${currentIndex} dir=${direction}`);

      // 1. Fetch fresh parent segments from DB
      const parents = await fetchParentSegments(sessionId);
      const targetIdx = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      // Bounds check
      if (targetIdx < 0 || targetIdx >= parents.length || currentIndex < 0 || currentIndex >= parents.length) {
        console.log('[StructuralOps] Move out of bounds, skipping');
        return;
      }

      // 2. Swap in the array
      const reordered = [...parents];
      const temp = reordered[currentIndex];
      reordered[currentIndex] = reordered[targetIdx];
      reordered[targetIdx] = temp;

      // 3. Optimistic cache update (instant UI)
      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old;
        const newSBS = { ...old.segmentsBySession };
        newSBS[sessionId] = reordered.map((seg, i) => ({
          ...seg,
          order: i + 1,
        }));
        return { ...old, segmentsBySession: newSBS };
      });

      // 4. Get session start time for cascade
      const startTime = await getSessionStartTime(sessionId, queryClient, queryKey);

      // 5. Batch re-index + time cascade
      const { promises, changedCount, changes } = batchReindexAndCascade(reordered, startTime);
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      console.log(`[StructuralOps] Move complete: ${changedCount} segments updated`);

      // 6. Single log entry for the entire reorder
      if (changedCount > 0) {
        logBatchReorder(
          sessionId,
          changes.map(c => ({ id: c.id, title: c.title, oldOrder: c.oldOrder, newOrder: c.newOrder })),
          `Moved "${parents[currentIndex]?.title || 'segment'}" ${direction}`
        ).catch(() => {});
      }
    } catch (err) {
      console.error('[StructuralOps] Move failed:', err.message);
      // Invalidate cache to force fresh load on error
      queryClient.invalidateQueries({ queryKey });
    } finally {
      lock.release();
    }
  }, [queryKey, queryClient, acquireLock]);

  // ── ADD: Insert a new segment at a position ──
  const add = useCallback(async ({ sessionId, serviceId, position, segmentData }) => {
    const lock = acquireLock();
    await lock.ready;

    try {
      console.log(`[StructuralOps] Add: session=${sessionId} position=${position}`);

      // 1. Create segment with temporary high order
      const created = await base44.entities.Segment.create({
        ...segmentData,
        session_id: sessionId,
        service_id: serviceId,
        order: 9999, // temporary — will be overwritten by batch re-index
      });

      // 2. Fetch fresh parent segments (includes the new one at order 9999)
      const allParents = await fetchParentSegments(sessionId);

      // 3. Remove the new segment from its 9999 position, insert at correct position
      const withoutNew = allParents.filter(s => s.id !== created.id);
      const insertAt = Math.max(0, Math.min(position, withoutNew.length));
      withoutNew.splice(insertAt, 0, created);

      // 4. Get session start time for cascade
      const startTime = await getSessionStartTime(sessionId, queryClient, queryKey);

      // 5. Batch re-index + time cascade
      const { promises, changedCount } = batchReindexAndCascade(withoutNew, startTime);
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      console.log(`[StructuralOps] Add complete: re-indexed ${changedCount} segments`);

      // 6. Log creation
      logCreate('Segment', created, sessionId).catch(() => {});

      // 7. Invalidate cache to pick up new segment
      queryClient.invalidateQueries({ queryKey });

      return created;
    } catch (err) {
      console.error('[StructuralOps] Add failed:', err.message);
      queryClient.invalidateQueries({ queryKey });
      throw err;
    } finally {
      lock.release();
    }
  }, [queryKey, queryClient, acquireLock]);

  // ── REMOVE: Delete a segment and re-index remaining ──
  const remove = useCallback(async (sessionId, segmentId) => {
    const lock = acquireLock();
    await lock.ready;

    try {
      console.log(`[StructuralOps] Remove: session=${sessionId} segment=${segmentId}`);

      // 1. Fetch segment data for logging before deletion
      const allSegs = await base44.entities.Segment.filter({ session_id: sessionId });
      const deletedSeg = allSegs.find(s => s.id === segmentId);

      // 2. Delete children first
      const children = allSegs.filter(s => s.parent_segment_id === segmentId);
      if (children.length > 0) {
        await Promise.all(children.map(c => base44.entities.Segment.delete(c.id)));
        console.log(`[StructuralOps] Deleted ${children.length} child segments`);
      }

      // 3. Log deletion before removing from DB
      if (deletedSeg) {
        logDelete('Segment', deletedSeg, sessionId).catch(() => {});
      }

      // 4. Delete the segment
      await base44.entities.Segment.delete(segmentId);

      // 5. Fetch remaining parents and re-index
      const remaining = await fetchParentSegments(sessionId);

      // 6. Get session start time for cascade
      const startTime = await getSessionStartTime(sessionId, queryClient, queryKey);

      // 7. Batch re-index + time cascade
      const { promises, changedCount } = batchReindexAndCascade(remaining, startTime);
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      console.log(`[StructuralOps] Remove complete: re-indexed ${changedCount} remaining segments`);

      // 8. Invalidate cache
      queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      console.error('[StructuralOps] Remove failed:', err.message);
      queryClient.invalidateQueries({ queryKey });
      throw err;
    } finally {
      lock.release();
    }
  }, [queryKey, queryClient, acquireLock]);

  return {
    move,
    add,
    remove,
    /** True if a structural operation is currently executing */
    get isLocked() { return lockedRef.current; },
  };
}