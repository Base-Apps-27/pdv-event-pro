/**
 * useActiveProgramCache — Cache-first hook for display surfaces
 * 
 * PURPOSE: Replaces useSessionDetector for MyProgram, TV Display, and
 * provides initial data for Live View. Reads from ActiveProgramCache
 * entity (pre-computed by refreshActiveProgram function) so that
 * pages open INSTANTLY with zero backend function calls.
 *
 * REAL-TIME UPDATES:
 * - Subscribes to ActiveProgramCache entity changes so any refresh
 *   (midnight, service save, event save) propagates instantly.
 * - Subscribes to LiveTimeAdjustment for real-time timing updates
 *   from Live View / Director Console.
 * - Subscribes to Segment/Session for live director changes (events).
 *
 * Decision: "Cache-first architecture for display surfaces"
 * Decision: "Entity subscriptions for real-time timing updates"
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useMemo, useEffect } from 'react';

export default function useActiveProgramCache() {
  const queryClient = useQueryClient();

  // ── Primary: Read from ActiveProgramCache entity (instant, no function call) ──
  const { data: cacheRecord, isLoading: cacheLoading } = useQuery({
    queryKey: ['activeProgramCache'],
    queryFn: async () => {
      const records = await base44.entities.ActiveProgramCache.filter({ cache_key: 'current_display' });
      return records?.[0] || null;
    },
    staleTime: 5 * 60 * 1000, // Cache is valid for 5 min (entity sub handles live updates)
    refetchInterval: 5 * 60 * 1000, // Safety net poll every 5 min
    retry: 2,
  });

  // ── Extract data from cache record ──
  const detected = useMemo(() => {
    if (!cacheRecord) return { contextType: null, contextId: null, event: null, service: null };

    const snapshot = cacheRecord.program_snapshot;
    const programType = cacheRecord.program_type;

    if (programType === 'none' || !snapshot) {
      return { contextType: null, contextId: null, event: null, service: null };
    }

    return {
      contextType: programType, // 'event' or 'service'
      contextId: cacheRecord.program_id,
      event: programType === 'event' ? snapshot.event || snapshot.program : null,
      service: programType === 'service' ? snapshot.program : null,
    };
  }, [cacheRecord]);

  // ── Program data (the full snapshot) ──
  const programData = useMemo(() => {
    if (!cacheRecord?.program_snapshot) return null;
    return cacheRecord.program_snapshot;
  }, [cacheRecord]);

  // ── Selector options for Live View dropdowns ──
  const selectorOptions = useMemo(() => {
    if (!cacheRecord?.selector_options) return { events: [], services: [] };
    return cacheRecord.selector_options;
  }, [cacheRecord]);

  // ── Real-time subscriptions ──
  useEffect(() => {
    const unsubs = [];

    // 1. ActiveProgramCache changes → instant refresh (midnight job, service save, etc.)
    unsubs.push(
      base44.entities.ActiveProgramCache.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['activeProgramCache'] });
      })
    );

    // 2. LiveTimeAdjustment changes → instant timing updates
    //    When someone adjusts service start time from Live View or Director,
    //    the cache will be refreshed by the entity automation, but we also
    //    invalidate locally for immediate feedback.
    unsubs.push(
      base44.entities.LiveTimeAdjustment.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['activeProgramCache'] });
      })
    );

    // 3. Segment changes → live director adjustments for events
    unsubs.push(
      base44.entities.Segment.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['activeProgramCache'] });
      })
    );

    // 4. Session changes → session timing adjustments
    unsubs.push(
      base44.entities.Session.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['activeProgramCache'] });
      })
    );

    return () => unsubs.forEach(u => typeof u === 'function' && u());
  }, [queryClient]);

  return {
    ...detected,
    programData,
    selectorOptions,
    isLoading: cacheLoading,
    allEvents: selectorOptions.events || [],
    allServices: selectorOptions.services || [],
    cacheRecord, // For debugging / metadata display
  };
}