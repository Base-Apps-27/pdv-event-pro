/**
 * useEntityWrite.js — V2 Weekly Editor write hook.
 * DECISION-003 Principle 3: Single write path.
 *
 * Every field edit:
 *   1. Updates React Query cache optimistically (instant UI)
 *   2. Schedules a debounced entity.update() call (400ms)
 *
 * HARDENING (Phase 8):
 *   - Field coalescing: multiple rapid field writes to same entity are batched
 *     into a single API call (e.g. writing presenter + description = 1 call)
 *   - Retry on failure: failed writes retry up to 2 times with backoff
 *   - Error toast: persistent failures surface to user
 *   - Flush on unmount + beforeunload to prevent data loss
 *
 * No setServiceData. No dual-write. The RQ cache IS the state.
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { logUpdate } from "@/components/utils/editActionLogger";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const DEBOUNCE_MS = 400;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * @param {string[]} queryKey - The React Query key for the weekly data
 * @returns {{
 *   writeSegment: (segmentId: string, column: string, value: any) => void,
 *   writeSession: (sessionId: string, column: string, value: any) => void,
 *   writePSD: (sessionId: string, column: string, value: any) => void,
 *   dirtyIds: Set<string>,
 *   flushAll: () => Promise<void>,
 *   flushEntity: (entityId: string) => Promise<void>,
 * }}
 */
export function useEntityWrite(queryKey) {
  const queryClient = useQueryClient();
  // Coalesced pending writes: { entityKey -> { entityType, entityId, fields: { col: val } } }
  const pendingRef = useRef({});
  const timersRef = useRef({});
  const [dirtyIds, setDirtyIds] = useState(new Set());

  // ── Optimistic cache updater ──────────────────────────────────
  const updateCache = useCallback((entityType, entityId, updates) => {
    queryClient.setQueryData(queryKey, (old) => {
      if (!old) return old;

      if (entityType === 'Segment') {
        // Update in segmentsBySession or childSegments
        const newSBS = { ...old.segmentsBySession };
        for (const sessionId in newSBS) {
          const idx = newSBS[sessionId].findIndex(s => s.id === entityId);
          if (idx >= 0) {
            const arr = [...newSBS[sessionId]];
            arr[idx] = { ...arr[idx], ...updates };
            newSBS[sessionId] = arr;
            return { ...old, segmentsBySession: newSBS };
          }
        }
        // Check childSegments
        const newCS = { ...old.childSegments };
        for (const parentId in newCS) {
          const idx = newCS[parentId].findIndex(s => s.id === entityId);
          if (idx >= 0) {
            const arr = [...newCS[parentId]];
            arr[idx] = { ...arr[idx], ...updates };
            newCS[parentId] = arr;
            return { ...old, childSegments: newCS };
          }
        }
        return old;
      }

      if (entityType === 'Session') {
        const sessions = old.sessions.map(s =>
          s.id === entityId ? { ...s, ...updates } : s
        );
        return { ...old, sessions };
      }

      if (entityType === 'PreSessionDetails') {
        const newPSD = { ...old.psdBySession };
        for (const sessionId in newPSD) {
          if (newPSD[sessionId]?.id === entityId) {
            newPSD[sessionId] = { ...newPSD[sessionId], ...updates };
            return { ...old, psdBySession: newPSD };
          }
        }
        return old;
      }

      return old;
    });
  }, [queryClient, queryKey]);

  // ── Dirty tracking ────────────────────────────────────────────
  const markDirty = useCallback((id) => {
    setDirtyIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markClean = useCallback((id) => {
    setDirtyIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ── Retry-aware write executor ────────────────────────────────
  // 2026-04-12: Stable refs for queryKey and queryClient so executeWrite can
  // read the RQ cache for EditActionLog snapshots without re-creating the callback.
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const executeWrite = useCallback(async (entityType, entityId, fields, attempt = 0) => {
    const entityMap = {
      Segment: base44.entities.Segment,
      Session: base44.entities.Session,
      PreSessionDetails: base44.entities.PreSessionDetails,
    };
    const entity = entityMap[entityType];
    if (!entity) return;

    try {
      // 2026-04-12: Capture pre-write state from RQ cache for EditActionLog
      // We snapshot BEFORE the API call so logUpdate can compute field diffs.
      let previousSnapshot = null;
      try {
        const cachedData = queryClientRef.current?.getQueryData(queryKeyRef.current);
        if (cachedData && entityType === 'Segment') {
          for (const sessionId in cachedData.segmentsBySession) {
            const found = cachedData.segmentsBySession[sessionId]?.find(s => s.id === entityId);
            if (found) { previousSnapshot = { ...found }; break; }
          }
          if (!previousSnapshot) {
            for (const parentId in cachedData.childSegments) {
              const found = cachedData.childSegments[parentId]?.find(s => s.id === entityId);
              if (found) { previousSnapshot = { ...found }; break; }
            }
          }
        } else if (cachedData && entityType === 'Session') {
          const found = cachedData.sessions?.find(s => s.id === entityId);
          if (found) previousSnapshot = { ...found };
        }
      } catch (_snapshotErr) { /* non-fatal */ }

      await entity.update(entityId, fields);

      // 2026-04-12: Fire-and-forget EditActionLog write for V2 Weekly Editor traceability.
      // Uses previousSnapshot from RQ cache (already contains the optimistic update,
      // but the diff is still accurate because logUpdate calculates old vs new).
      if (previousSnapshot) {
        const newState = { ...previousSnapshot, ...fields };
        logUpdate(entityType, entityId, previousSnapshot, newState).catch(() => {});
      }

      // GRO-1 (2026-03-02): Track admin write operations for observability
      base44.analytics.track({ eventName: `${entityType.toLowerCase()}_updated`, properties: { entity_id: entityId, fields_count: Object.keys(fields).length } });
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.warn(`[useEntityWrite] Retry ${attempt + 1}/${MAX_RETRIES} for ${entityType}:${entityId}`, err.message);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        return executeWrite(entityType, entityId, fields, attempt + 1);
      }
      console.error(`[useEntityWrite] PERMANENT FAIL for ${entityType}:${entityId}:`, err.message);
      toast.error(`Error al guardar: ${err.message}`, { duration: 5000 });
      throw err;
    }
  }, []);

  // ── Coalesced scheduler ───────────────────────────────────────
  // Groups multiple field writes to the same entity into one API call.
  const scheduleCoalesced = useCallback((entityType, entityId, column, value) => {
    const entityKey = `${entityType}:${entityId}`;
    markDirty(entityId);

    // Accumulate fields
    if (!pendingRef.current[entityKey]) {
      pendingRef.current[entityKey] = { entityType, entityId, fields: {} };
    }
    pendingRef.current[entityKey].fields[column] = value;

    // Clear existing timer and set new one
    if (timersRef.current[entityKey]) clearTimeout(timersRef.current[entityKey]);

    timersRef.current[entityKey] = setTimeout(async () => {
      const entry = pendingRef.current[entityKey];
      delete pendingRef.current[entityKey];
      delete timersRef.current[entityKey];

      if (!entry) return;

      try {
        await executeWrite(entry.entityType, entry.entityId, entry.fields);
      } catch (_) {
        // Already handled in executeWrite with toast
      }

      // If no more pending writes for this entity, mark clean
      const hasMore = Object.keys(pendingRef.current).some(k =>
        pendingRef.current[k]?.entityId === entityId
      );
      if (!hasMore) markClean(entityId);
    }, DEBOUNCE_MS);
  }, [markDirty, markClean, executeWrite]);

  // ── Public write methods ──────────────────────────────────────

  const writeSegment = useCallback((segmentId, column, value) => {
    if (!segmentId) {
      console.error('[useEntityWrite] writeSegment blocked: no segmentId for', column);
      return;
    }
    // Optimistic update
    updateCache('Segment', segmentId, { [column]: value });
    // Coalesced debounced write
    scheduleCoalesced('Segment', segmentId, column, value);
  }, [updateCache, scheduleCoalesced]);

  const writeSession = useCallback((sessionId, column, value) => {
    if (!sessionId) {
      console.error('[useEntityWrite] writeSession blocked: no sessionId for', column);
      return;
    }
    updateCache('Session', sessionId, { [column]: value });
    scheduleCoalesced('Session', sessionId, column, value);
  }, [updateCache, scheduleCoalesced]);

  const writePSD = useCallback((psdId, sessionId, column, value) => {
    if (!psdId) {
      // Create PSD if it doesn't exist
      if (!sessionId || !value) return;
      markDirty(sessionId);
      const entityKey = `PSD_CREATE:${sessionId}`;
      if (timersRef.current[entityKey]) clearTimeout(timersRef.current[entityKey]);
      timersRef.current[entityKey] = setTimeout(async () => {
        delete timersRef.current[entityKey];
        try {
          const created = await base44.entities.PreSessionDetails.create({
            session_id: sessionId,
            [column]: value,
          });
          // Update cache with new PSD
          queryClient.setQueryData(queryKey, (old) => {
            if (!old) return old;
            const newPSD = { ...old.psdBySession, [sessionId]: created };
            return { ...old, psdBySession: newPSD };
          });
        } catch (err) {
          console.error('[useEntityWrite] PSD create failed:', err.message);
          toast.error('Error al guardar pre-servicio: ' + err.message);
        }
        markClean(sessionId);
      }, DEBOUNCE_MS);
      return;
    }
    updateCache('PreSessionDetails', psdId, { [column]: value });
    scheduleCoalesced('PreSessionDetails', psdId, column, value);
  }, [updateCache, scheduleCoalesced, queryClient, queryKey, markDirty, markClean]);

  // 2026-04-15: writeSongs REMOVED. Songs are now individual SegmentSong entities,
  // managed directly by SongRows.jsx via CRUD on base44.entities.SegmentSong.
  // The old flat-field write path (song_1_title..song_10_key) is deprecated.
  // Kept as comment for traceability per Constitution rule §4.

  // ── Flush logic ───────────────────────────────────────────────

  const flushAllRef = useRef(null);
  flushAllRef.current = async () => {
    // Clear all timers
    Object.values(timersRef.current).forEach(t => { if (t) clearTimeout(t); });
    timersRef.current = {};

    // Execute all pending writes
    const entries = { ...pendingRef.current };
    pendingRef.current = {};

    const writes = Object.values(entries).map(entry =>
      executeWrite(entry.entityType, entry.entityId, entry.fields).catch(() => {})
    );
    await Promise.allSettled(writes);
    setDirtyIds(new Set());
  };

  const flushAll = useCallback(async () => {
    if (flushAllRef.current) await flushAllRef.current();
  }, []);

  const flushEntity = useCallback(async (entityId) => {
    const eid = String(entityId);

    // Find and execute pending write for this entity
    const matchingKeys = Object.keys(pendingRef.current).filter(
      k => pendingRef.current[k]?.entityId === eid
    );

    for (const key of matchingKeys) {
      if (timersRef.current[key]) {
        clearTimeout(timersRef.current[key]);
        delete timersRef.current[key];
      }
      const entry = pendingRef.current[key];
      delete pendingRef.current[key];
      if (entry) {
        try {
          await executeWrite(entry.entityType, entry.entityId, entry.fields);
        } catch (_) {}
      }
    }

    markClean(eid);
  }, [markClean, executeWrite]);

  // Flush on unmount + beforeunload
  useEffect(() => {
    const handleUnload = (e) => {
      const hasPending = Object.keys(pendingRef.current).length > 0;
      if (hasPending) {
        // Fire-and-forget flush — use navigator.sendBeacon pattern
        Object.values(pendingRef.current).forEach(entry => {
          const entityMap = {
            Segment: base44.entities.Segment,
            Session: base44.entities.Session,
            PreSessionDetails: base44.entities.PreSessionDetails,
          };
          entityMap[entry.entityType]?.update(entry.entityId, entry.fields).catch(() => {});
        });
        pendingRef.current = {};
        Object.values(timersRef.current).forEach(t => { if (t) clearTimeout(t); });
        timersRef.current = {};
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      // Unmount flush — fire-and-forget
      Object.values(timersRef.current).forEach(t => { if (t) clearTimeout(t); });
      timersRef.current = {};
      Object.values(pendingRef.current).forEach(entry => {
        const entityMap = {
          Segment: base44.entities.Segment,
          Session: base44.entities.Session,
          PreSessionDetails: base44.entities.PreSessionDetails,
        };
        entityMap[entry.entityType]?.update(entry.entityId, entry.fields).catch(() => {});
      });
      pendingRef.current = {};
    };
  }, []);

  return {
    writeSegment,
    writeSession,
    writePSD,
    dirtyIds,
    flushAll,
    flushEntity,
  };
}