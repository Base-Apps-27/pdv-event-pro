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
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { sortSessionsChronologically, buildSessionIndexMap } from '@/components/utils/sessionSort';
import { getTodayET } from '@/components/utils/timeFormat';

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
  // MULTI-SLOT (2026-02-28): Invalidates the specific cache key we're watching.
  const debouncedInvalidate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['activeProgramCache', activeCacheKey] });
      debounceRef.current = null;
    }, 800);
  }, [queryClient, activeCacheKey]);

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
  // MULTI-SLOT (2026-02-28): Uses dynamic activeCacheKey to support warm cache
  // for user-selected programs alongside auto-detected 'current_display'.
  const { data: cacheRecord, isLoading: cacheLoading, error: cacheError } = useQuery({
    queryKey: ['activeProgramCache', activeCacheKey],
    queryFn: async () => {
      const records = await base44.entities.ActiveProgramCache.filter({ cache_key: activeCacheKey });
      return records?.[0] || null;
    },
    staleTime: 60 * 1000,        // Treat data as fresh for 1 min (sub handles live updates)
    refetchInterval: 2 * 60 * 1000, // Safety net poll every 2 min (catches missed subs)
    retry: 3,                     // Retry 3 times with exponential backoff
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    // HARDENING (2026-03-08): Keep the last successfully fetched data visible while a
    // background refetch is in-flight. Without this, invalidation from the subscription
    // causes a brief window where cacheRecord is undefined, which flows through to
    // normalizeProgramData returning null → service=null → TV shows blank StandbyScreen.
    // keepPreviousData ensures the TV always displays the last known-good program data
    // until the new fetch resolves successfully. This is the correct fix for issue #1.
    placeholderData: keepPreviousData,
    enabled: !overrideServiceId && !overrideEventId, // Skip auto-detection when override is active
  });

  // ── Multi-program array (2026-03-27) ──
  // Returns all programs for the detected date, ordered by start time.
  // Each entry has: program_type, program_id, program_name, program_snapshot,
  // first_session_start_time, last_session_end_time.
  // MUST be declared BEFORE `detected` useMemo which references `programs` and `activeIndex`.
  const programs = useMemo(() => {
    if (overrideData) return []; // Override = single program, no progression
    return cacheRecord?.programs || [];
  }, [cacheRecord, overrideData]);

  // ── Auto-progression: determine which program is "active now" ──
  // Compare current ET time against each program's last_session_end_time.
  // The active program is the last one whose first_session_start_time has been reached
  // but whose last_session_end_time hasn't yet passed. If all have ended, show the last.
  // If none have started, show the first.
  // Re-evaluates every 60s via a clock tick.
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setClockTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const activeIndex = useMemo(() => {
    if (programs.length <= 1) return 0;
    // Get current time in ET as HH:MM
    const nowET = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date());
    // Find the program that is currently active
    // Logic: iterate from last to first. The first program whose start has been reached is active,
    // UNLESS a later program has also started (in which case the later one wins).
    for (let i = programs.length - 1; i >= 0; i--) {
      const p = programs[i];
      if (p.first_session_start_time && nowET >= p.first_session_start_time) {
        return i;
      }
    }
    return 0; // None started yet — show the first (upcoming)
  }, [programs, clockTick]);

  // ── Extract data: override takes precedence over cache ──
  // 2026-03-27: Multi-program awareness. Uses activeIndex from programs[] when available.
  const detected = useMemo(() => {
    const record = overrideData || cacheRecord;
    if (!record) return { contextType: null, contextId: null, event: null, service: null };

    // Multi-program path: use the active program from the array
    if (!overrideData && programs.length > 0 && programs[activeIndex]) {
      const activeProgram = programs[activeIndex];
      const snapshot = activeProgram.program_snapshot;
      const programType = activeProgram.program_type;
      if (!snapshot) return { contextType: null, contextId: null, event: null, service: null };
      return {
        contextType: programType,
        contextId: activeProgram.program_id,
        event: programType === 'event' ? snapshot.event || snapshot.program : null,
        service: programType === 'service' ? snapshot.program : null,
        _isOverride: false,
      };
    }

    // Backward compat: single program_snapshot
    const snapshot = record.program_snapshot;
    const programType = record.program_type;

    if (programType === 'none' || !snapshot) {
      return { contextType: null, contextId: null, event: null, service: null };
    }

    return {
      contextType: programType,
      contextId: record.program_id,
      event: programType === 'event' ? snapshot.event || snapshot.program : null,
      service: programType === 'service' ? snapshot.program : null,
      _isOverride: !!overrideData,
    };
  }, [cacheRecord, overrideData, programs, activeIndex]);

  // ── Program data: use the active program from the array if available ──
  const programData = useMemo(() => {
    const record = overrideData || cacheRecord;
    if (!record) return null;
    // If multi-program array exists and has data, use the active program's snapshot
    if (programs.length > 0 && programs[activeIndex]?.program_snapshot) {
      return programs[activeIndex].program_snapshot;
    }
    // Backward compat: fall back to single program_snapshot
    if (!record.program_snapshot) return null;
    return record.program_snapshot;
  }, [cacheRecord, overrideData, programs, activeIndex]);

  // ── Selector options for Live View dropdowns ──
  const selectorOptions = useMemo(() => {
    if (!cacheRecord?.selector_options) return { events: [], services: [] };
    return cacheRecord.selector_options;
  }, [cacheRecord]);

  // ── Real-time subscription: ONLY ActiveProgramCache ──
  // All entity automations (Service, Event, Segment, LiveTimeAdjustment)
  // trigger refreshActiveProgram → updates this record → triggers this sub.
  // This single-subscription pattern eliminates redundant refetches.
  // MULTI-SLOT (2026-02-28): Invalidates the specific cache key we're watching.
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

  // ── HARDENING (2026-03-08): Visibility-change reconnection ──
  // TV displays may sleep/wake (OS screen saver, browser throttling, tab switching).
  // When the tab becomes visible again, immediately refetch instead of waiting
  // for the next 2-min poll or relying on a subscription that may have disconnected.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['activeProgramCache', activeCacheKey] });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [queryClient, activeCacheKey]);

  return {
    ...detected,
    programData,
    selectorOptions,
    isLoading: overrideLoading || cacheLoading,
    isError: !!cacheError, // Expose error state for consumers to show fallback UI
    allEvents: selectorOptions.events || [],
    allServices: selectorOptions.services || [],
    cacheRecord: overrideData || cacheRecord, // For debugging / metadata display
    // 2026-03-27: Multi-program-per-day support
    programs,       // Full ordered array of all day's programs
    activeIndex,    // Index of the currently-active program (auto-progression)
  };
}