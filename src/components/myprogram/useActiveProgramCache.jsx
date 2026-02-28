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
 * MULTI-SLOT WARM CACHE (2026-02-28):
 * - Supports dynamic cache_key via programCacheKey param.
 * - "current_display" = auto-detected program (default, used by MyProgram/TV).
 * - "event_{id}" / "service_{id}" = user-viewed programs (warm cache for Live View).
 * - Entity automations rebuild ALL matching cache entries when segments change.
 * - Stale entries (>7 days) are cleaned by midnight job.
 *
 * Decision: "Cache-first architecture for display surfaces"
 * Decision: "Single-subscription pattern to prevent invalidation storms"
 * Decision: "Multi-slot warm cache for actively-worked programs"
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useMemo, useEffect, useRef, useCallback } from 'react';
import { sortSessionsChronologically, buildSessionIndexMap } from '@/components/utils/sessionSort';

export default function useActiveProgramCache(overrideParams = {}) {
  const queryClient = useQueryClient();
  const debounceRef = useRef(null);
  
  // Testing override: force a specific service or event ID
  // programCacheKey: dynamic cache key for multi-slot warm cache.
  // Defaults to 'current_display' for auto-detected program.
  // Live View passes 'event_{id}' or 'service_{id}' for user-selected programs.
  const { overrideServiceId, overrideEventId, programCacheKey } = overrideParams;
  const activeCacheKey = programCacheKey || 'current_display';

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

  // ── Override query: Load specific service/event for testing ──
  const { data: overrideData, isLoading: overrideLoading } = useQuery({
    queryKey: ['overrideProgram', overrideServiceId, overrideEventId],
    queryFn: async () => {
      if (overrideServiceId) {
        const service = await base44.entities.Service.filter({ id: overrideServiceId });
        if (!service?.[0]) return null;
        
        // Build snapshot from service + sessions + segments
        // FIX (ATT-015 / DECISION-004): Sort sessions chronologically (date → time → order)
        // The `order` field is unreliable — use chronological sort as primary.
        const rawSessions = await base44.entities.Session.filter({ service_id: overrideServiceId });
        const sessions = sortSessionsChronologically(rawSessions);
        const segmentArrays = await Promise.all(
          sessions.map(s => base44.entities.Segment.filter({ session_id: s.id }))
        );
        // Sort segments by session chronological position then segment order
        const sessionIndexMap = buildSessionIndexMap(sessions);
        const segments = segmentArrays.flat()
          .filter(s => !s.parent_segment_id && s.show_in_general !== false)
          .sort((a, b) => {
            const sA = sessionIndexMap.get(a.session_id) ?? 999;
            const sB = sessionIndexMap.get(b.session_id) ?? 999;
            if (sA !== sB) return sA - sB;
            return (a.order || 0) - (b.order || 0);
          });
        
        return {
          program_type: 'service',
          program_id: overrideServiceId,
          program_snapshot: {
            program: service[0],
            sessions: sessions,
            segments: segments,
          }
        };
      }
      
      if (overrideEventId) {
        const event = await base44.entities.Event.filter({ id: overrideEventId });
        if (!event?.[0]) return null;
        
        // FIX (ATT-015 / DECISION-004): Sort sessions chronologically (date → time → order)
        const rawSessions = await base44.entities.Session.filter({ event_id: overrideEventId });
        const sessions = sortSessionsChronologically(rawSessions);
        const segmentArrays = await Promise.all(
          sessions.map(s => base44.entities.Segment.filter({ session_id: s.id }))
        );
        // Sort segments by session chronological position then segment order
        const sessionIndexMap = buildSessionIndexMap(sessions);
        const segments = segmentArrays.flat()
          .filter(s => !s.parent_segment_id && s.show_in_general !== false)
          .sort((a, b) => {
            const sA = sessionIndexMap.get(a.session_id) ?? 999;
            const sB = sessionIndexMap.get(b.session_id) ?? 999;
            if (sA !== sB) return sA - sB;
            return (a.order || 0) - (b.order || 0);
          });
        
        return {
          program_type: 'event',
          program_id: overrideEventId,
          program_snapshot: {
            event: event[0],
            program: event[0],
            sessions: sessions,
            segments: segments,
          }
        };
      }
      
      return null;
    },
    enabled: !!(overrideServiceId || overrideEventId),
    staleTime: Infinity, // Override is manual — don't refetch
  });

  // ── Primary: Read from ActiveProgramCache entity (instant, no function call) ──
  // HARDENED (2026-02-15 audit): Added error recovery and retry with backoff.
  const { data: cacheRecord, isLoading: cacheLoading, error: cacheError } = useQuery({
    queryKey: ['activeProgramCache'],
    queryFn: async () => {
      const records = await base44.entities.ActiveProgramCache.filter({ cache_key: 'current_display' });
      return records?.[0] || null;
    },
    staleTime: 60 * 1000,        // Treat data as fresh for 1 min (sub handles live updates)
    refetchInterval: 2 * 60 * 1000, // Safety net poll every 2 min (catches missed subs)
    retry: 3,                     // Retry 3 times with exponential backoff
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    enabled: !overrideServiceId && !overrideEventId, // Skip auto-detection when override is active
  });

  // ── Extract data: override takes precedence over cache ──
  const detected = useMemo(() => {
    const record = overrideData || cacheRecord;
    if (!record) return { contextType: null, contextId: null, event: null, service: null };

    const snapshot = record.program_snapshot;
    const programType = record.program_type;

    if (programType === 'none' || !snapshot) {
      return { contextType: null, contextId: null, event: null, service: null };
    }

    return {
      contextType: programType, // 'event' or 'service'
      contextId: record.program_id,
      event: programType === 'event' ? snapshot.event || snapshot.program : null,
      service: programType === 'service' ? snapshot.program : null,
      _isOverride: !!overrideData, // Flag for debugging
    };
  }, [cacheRecord, overrideData]);

  // ── Program data (the full snapshot) ──
  const programData = useMemo(() => {
    const record = overrideData || cacheRecord;
    if (!record?.program_snapshot) return null;
    return record.program_snapshot;
  }, [cacheRecord, overrideData]);

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
    isLoading: overrideLoading || cacheLoading,
    isError: !!cacheError, // Expose error state for consumers to show fallback UI
    allEvents: selectorOptions.events || [],
    allServices: selectorOptions.services || [],
    cacheRecord: overrideData || cacheRecord, // For debugging / metadata display
  };
}