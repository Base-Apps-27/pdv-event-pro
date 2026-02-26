/**
 * useEntityWrite.js — V2 Weekly Editor write hook.
 * DECISION-003 Principle 3: Single write path.
 *
 * Every field edit:
 *   1. Updates React Query cache optimistically (instant UI)
 *   2. Schedules a debounced entity.update() call (300ms)
 *
 * No setServiceData. No dual-write. The RQ cache IS the state.
 *
 * Flush on unmount and beforeunload to prevent data loss.
 */

import { useRef, useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const DEBOUNCE_MS = 300;

/**
 * @param {string[]} queryKey - The React Query key for the weekly data
 * @returns {{
 *   writeSegment: (segmentId: string, column: string, value: any) => void,
 *   writeSession: (sessionId: string, column: string, value: any) => void,
 *   writePSD: (sessionId: string, column: string, value: any) => void,
 *   writeSongs: (segmentId: string, songs: object[]) => void,
 *   dirtyIds: Set<string>,
 *   flushAll: () => Promise<void>,
 *   flushEntity: (entityId: string) => Promise<void>,
 * }}
 */
export function useEntityWrite(queryKey) {
  const queryClient = useQueryClient();
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

  // ── Core scheduler ────────────────────────────────────────────
  const scheduleWrite = useCallback((key, entityId, writeFn) => {
    const existing = timersRef.current[key];
    if (existing?.timerId) clearTimeout(existing.timerId);

    markDirty(entityId);

    const timerId = setTimeout(async () => {
      delete timersRef.current[key];
      try {
        await writeFn();
      } catch (err) {
        console.error(`[useEntityWrite] Write failed for ${key}:`, err.message);
      }
      // If no more pending writes for this entity, mark clean
      const hasMore = Object.keys(timersRef.current).some(k =>
        timersRef.current[k]?.entityId === entityId
      );
      if (!hasMore) markClean(entityId);
    }, DEBOUNCE_MS);

    timersRef.current[key] = { timerId, writeFn, entityId };
  }, [markDirty, markClean]);

  // ── Public write methods ──────────────────────────────────────

  const writeSegment = useCallback((segmentId, column, value) => {
    if (!segmentId) {
      console.error('[useEntityWrite] writeSegment blocked: no segmentId for', column);
      return;
    }
    // Optimistic update
    updateCache('Segment', segmentId, { [column]: value });
    // Debounced write
    const key = `seg:${segmentId}:${column}`;
    scheduleWrite(key, segmentId, () =>
      base44.entities.Segment.update(segmentId, { [column]: value })
    );
  }, [updateCache, scheduleWrite]);

  const writeSession = useCallback((sessionId, column, value) => {
    if (!sessionId) {
      console.error('[useEntityWrite] writeSession blocked: no sessionId for', column);
      return;
    }
    updateCache('Session', sessionId, { [column]: value });
    const key = `sess:${sessionId}:${column}`;
    scheduleWrite(key, sessionId, () =>
      base44.entities.Session.update(sessionId, { [column]: value })
    );
  }, [updateCache, scheduleWrite]);

  const writePSD = useCallback((psdId, sessionId, column, value) => {
    if (!psdId) {
      // Create PSD if it doesn't exist
      if (!sessionId || !value) return;
      const key = `psd:${sessionId}:${column}`;
      scheduleWrite(key, sessionId, async () => {
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
      });
      return;
    }
    updateCache('PreSessionDetails', psdId, { [column]: value });
    const key = `psd:${psdId}:${column}`;
    scheduleWrite(key, psdId, () =>
      base44.entities.PreSessionDetails.update(psdId, { [column]: value })
    );
  }, [updateCache, scheduleWrite, queryClient, queryKey]);

  const writeSongs = useCallback((segmentId, songs) => {
    if (!segmentId) return;
    // Build flat field payload
    const payload = {};
    const safeArray = Array.isArray(songs) ? songs : [];
    for (let i = 0; i < 6; i++) {
      const song = safeArray[i];
      payload[`song_${i + 1}_title`] = song?.title || "";
      payload[`song_${i + 1}_lead`] = song?.lead || "";
      payload[`song_${i + 1}_key`] = song?.key || "";
    }
    payload.number_of_songs = safeArray.length;

    updateCache('Segment', segmentId, payload);
    const key = `seg:${segmentId}:songs`;
    scheduleWrite(key, segmentId, () =>
      base44.entities.Segment.update(segmentId, payload)
    );
  }, [updateCache, scheduleWrite]);

  // ── Flush logic ───────────────────────────────────────────────

  const flushAllRef = useRef(null);
  flushAllRef.current = async () => {
    const entries = { ...timersRef.current };
    timersRef.current = {};
    const writes = Object.entries(entries).map(([key, entry]) => {
      if (entry?.timerId) clearTimeout(entry.timerId);
      return entry?.writeFn?.() || Promise.resolve();
    });
    await Promise.allSettled(writes);
    setDirtyIds(new Set());
  };

  const flushAll = useCallback(async () => {
    if (flushAllRef.current) await flushAllRef.current();
  }, []);

  const flushEntity = useCallback(async (entityId) => {
    const eid = String(entityId);
    const keys = Object.keys(timersRef.current).filter(
      k => timersRef.current[k]?.entityId === eid
    );
    const writes = keys.map(key => {
      const entry = timersRef.current[key];
      if (entry?.timerId) clearTimeout(entry.timerId);
      delete timersRef.current[key];
      return entry?.writeFn?.() || Promise.resolve();
    });
    await Promise.allSettled(writes);
    markClean(eid);
  }, [markClean]);

  // Flush on unmount + beforeunload
  useEffect(() => {
    const handleUnload = (e) => {
      const hasPending = Object.keys(timersRef.current).length > 0;
      if (hasPending) {
        // Fire-and-forget flush
        Object.values(timersRef.current).forEach(entry => {
          if (entry?.timerId) clearTimeout(entry.timerId);
          entry?.writeFn?.();
        });
        timersRef.current = {};
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      // Unmount flush
      Object.values(timersRef.current).forEach(entry => {
        if (entry?.timerId) clearTimeout(entry.timerId);
        entry?.writeFn?.();
      });
      timersRef.current = {};
    };
  }, []);

  return {
    writeSegment,
    writeSession,
    writePSD,
    writeSongs,
    dirtyIds,
    flushAll,
    flushEntity,
  };
}