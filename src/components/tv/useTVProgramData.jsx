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
import { useMemo, useEffect, useRef } from 'react';

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

  // ── Shape the data to match what PublicCountdownDisplay expects ──
  const programData = useMemo(() => {
    if (!rawData) return null;
    // getPublicProgramData returns: { event, program, sessions, segments, rooms, ... }
    // The TV page expects programData.program, programData.sessions, programData.segments, etc.
    // This matches the program_snapshot shape.
    if (!rawData.program && !rawData.event) return null;
    return rawData;
  }, [rawData]);

  const service = useMemo(() => {
    if (!rawData?.program) return null;
    return rawData.program._isEvent ? null : rawData.program;
  }, [rawData]);

  const event = useMemo(() => {
    if (!rawData?.program) return null;
    return rawData.program._isEvent ? rawData.program : null;
  }, [rawData]);

  return {
    contextType: event ? 'event' : service ? 'service' : null,
    contextId: rawData?.program?.id || null,
    event,
    service,
    programData,
    isLoading,
    isError,
    _isOverride: !!(overrideServiceId || overrideEventId),
    // For the stale-data watchdog — no direct cache record, but we track freshness
    // via React Query's own dataUpdatedAt
    cacheRecord: null,
  };
}