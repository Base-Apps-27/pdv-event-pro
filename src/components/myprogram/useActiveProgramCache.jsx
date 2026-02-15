/**
 * useActiveProgramCache — Cache-first hook for display surfaces
 * 
 * PURPOSE: Replaces useSessionDetector for MyProgram, TV Display, and
 * provides initial data for Live View. Reads from ActiveProgramCache
 * entity (pre-computed by refreshActiveProgram function) so that
 * pages open INSTANTLY with zero backend function calls.
 *
 * STABILITY DESIGN (2026-02-15):
 * - Single source of real-time updates: subscribes ONLY to ActiveProgramCache.
 *   Entity automations (Service, Event, Segment, LiveTimeAdjustment) all
 *   trigger refreshActiveProgram → which updates ActiveProgramCache →
 *   which triggers this subscription. This eliminates redundant invalidation
 *   storms that occurred when we subscribed to 4+ entities separately.
 * - Debounced invalidation: rapid-fire entity changes (e.g., director bulk
 *   edits) coalesce into a single refetch after a short settle period.
 * - Safety-net poll every 2 min catches any missed subscription events.
 *
 * Decision: "Cache-first architecture for display surfaces"
 * Decision: "Single-subscription pattern to prevent invalidation storms"
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useMemo, useEffect, useRef, useCallback } from 'react';

export default function useActiveProgramCache() {
  const queryClient = useQueryClient();
  const debounceRef = useRef(null);

  // Debounced invalidation: coalesces rapid-fire updates into one refetch.
  // Settle time: 800ms — fast enough for user-perceived real-time,
  // slow enough to absorb burst updates (director marking 3 segments in 2s).
  const debouncedInvalidate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['activeProgramCache'] });
      debounceRef.current = null;
    }, 800);
  }, [queryClient]);

  // ── Primary: Read from ActiveProgramCache entity (instant, no function call) ──
  const { data: cacheRecord, isLoading: cacheLoading } = useQuery({
    queryKey: ['activeProgramCache'],
    queryFn: async () => {
      const records = await base44.entities.ActiveProgramCache.filter({ cache_key: 'current_display' });
      return records?.[0] || null;
    },
    staleTime: 60 * 1000,        // Treat data as fresh for 1 min (sub handles live updates)
    refetchInterval: 2 * 60 * 1000, // Safety net poll every 2 min (catches missed subs)
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

  // ── Real-time subscription: ONLY ActiveProgramCache ──
  // All entity automations (Service, Event, Segment, LiveTimeAdjustment)
  // trigger refreshActiveProgram → updates this record → triggers this sub.
  // This single-subscription pattern eliminates redundant refetches.
  useEffect(() => {
    const unsub = base44.entities.ActiveProgramCache.subscribe(() => {
      debouncedInvalidate();
    });

    // Cleanup debounce timer and subscription on unmount
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (typeof unsub === 'function') unsub();
    };
  }, [debouncedInvalidate]);

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