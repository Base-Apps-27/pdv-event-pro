/**
 * useTVProgramData — Backend-function-based data hook for TV Display
 *
 * PURPOSE: The TV Display (PublicCountdownDisplay) runs on a PUBLIC page
 * without user authentication. The standard useActiveProgramCache hook
 * reads directly from the ActiveProgramCache entity via the frontend SDK,
 * which REQUIRES authentication. On unauthenticated public pages, the
 * entity read silently returns null → TV shows StandbyScreen.
 *
 * This hook calls getPublicProgramData (a backend function that uses
 * asServiceRole) which always works regardless of auth state. It also
 * receives the same cache-first data that the backend prepares.
 *
 * Decision: "TV Display must use backend function for data access (public page auth constraint)"
 * AttemptLog: "Direct entity read from public page fails silently — root cause of persistent standby"
 *
 * POLLING: 30s interval matches the TV's real-time needs without overloading.
 * The backend function serves from cache (< 5ms) so polling is cheap.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useMemo, useEffect, useState } from 'react';

export default function useTVProgramData(overrideParams = {}) {
  const queryClient = useQueryClient();
  const { overrideServiceId, overrideEventId } = overrideParams;

  // Build the request payload based on overrides or auto-detect
  const requestPayload = useMemo(() => {
    if (overrideServiceId) return { serviceId: overrideServiceId };
    if (overrideEventId) return { eventId: overrideEventId };
    // Auto-detect: let the backend find the current program from cache
    return { detectActive: true, includeOptions: true };
  }, [overrideServiceId, overrideEventId]);

  const { data: rawData, isLoading, isError, error } = useQuery({
    queryKey: ['tvProgramData', overrideServiceId, overrideEventId],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPublicProgramData', requestPayload);
      return response.data;
    },
    staleTime: 20 * 1000,          // Treat as fresh for 20s
    refetchInterval: 30 * 1000,    // Poll every 30s (backend serves from cache, very cheap)
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  // ── Visibility-change reconnection (same pattern as useActiveProgramCache) ──
  // TV displays may sleep/wake. Immediately refetch when tab becomes visible.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['tvProgramData', overrideServiceId, overrideEventId] });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [queryClient, overrideServiceId, overrideEventId]);

  // ── Multi-program array (2026-03-27) ──
  const programs = useMemo(() => {
    if (overrideServiceId || overrideEventId) return [];
    return rawData?.programs || [];
  }, [rawData, overrideServiceId, overrideEventId]);

  // ── Auto-progression: same logic as useActiveProgramCache ──
  // Re-evaluates every 60s.
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setClockTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const activeIndex = useMemo(() => {
    if (programs.length <= 1) return 0;
    const nowET = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date());
    for (let i = programs.length - 1; i >= 0; i--) {
      if (programs[i].first_session_start_time && nowET >= programs[i].first_session_start_time) {
        return i;
      }
    }
    return 0;
  }, [programs, clockTick]);

  // ── Shape the data to match what PublicCountdownDisplay expects ──
  // 2026-03-27: Uses active program from multi-program array when available.
  const activeProgram = useMemo(() => {
    if (programs.length > 0 && programs[activeIndex]?.program_snapshot) {
      return programs[activeIndex].program_snapshot;
    }
    return rawData;
  }, [rawData, programs, activeIndex]);

  const programData = useMemo(() => {
    if (!activeProgram) return null;
    if (!activeProgram.program && !activeProgram.event) return null;
    return activeProgram;
  }, [activeProgram]);

  const service = useMemo(() => {
    if (!programData?.program) return null;
    return programData.program._isEvent ? null : programData.program;
  }, [programData]);

  const event = useMemo(() => {
    if (!programData?.program) return null;
    return programData.program._isEvent ? programData.program : null;
  }, [programData]);

  return {
    contextType: event ? 'event' : service ? 'service' : null,
    contextId: programData?.program?.id || null,
    event,
    service,
    programData,
    isLoading,
    isError,
    _isOverride: !!(overrideServiceId || overrideEventId),
    cacheRecord: null,
    // 2026-03-27: Multi-program support
    programs,
    activeIndex,
  };
}