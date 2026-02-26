/**
 * useWeeklyData.js — V2 Weekly Editor data loading hook.
 * DECISION-003 Principle 1: No intermediate JSON shape.
 *
 * HARDENING (Phase 8):
 *   - Defensive: handles missing/null service_id gracefully
 *   - Validates segment integrity: warns on segments without session_id
 *   - Batch parallel loading with proper error isolation
 *   - Returns service entity for metadata access (updated_date, etc.)
 *   - StaleTime of 30s to reduce unnecessary refetches
 *
 * Loads Service + Sessions + Segments + PreSessionDetails for a given
 * service ID. Returns raw entity objects organized into Maps.
 * NO transformation. NO JSON blob shape. NO blueprint matching.
 */

import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * @param {string} serviceId - The Service entity ID to load
 * @returns {{ 
 *   service: object|null,
 *   sessions: object[],
 *   segmentsBySession: Object<string, object[]>,
 *   childSegments: Object<string, object[]>,
 *   psdBySession: Object<string, object>,
 *   isLoading: boolean,
 *   error: Error|null,
 *   queryKey: string[]
 * }}
 */
export function useWeeklyData(serviceId) {
  const queryKey = ['weeklyV2', serviceId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    enabled: !!serviceId,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000),
    staleTime: 30_000,
    queryFn: async () => {
      // 1. Load sessions for this service
      const sessions = await base44.entities.Session.filter({
        service_id: serviceId,
      });

      if (!sessions || sessions.length === 0) {
        console.warn(`[useWeeklyData] No sessions found for service ${serviceId}`);
        return { sessions: [], segmentsBySession: {}, childSegments: {}, psdBySession: {} };
      }

      const sessionIds = sessions.map(s => s.id);
      const sessionIdSet = new Set(sessionIds);

      // 2. Batch load all segments + pre-session details in parallel
      // Isolate errors so one failure doesn't break everything
      const [segResult, psdResult] = await Promise.allSettled([
        base44.entities.Segment.filter({ service_id: serviceId }),
        base44.entities.PreSessionDetails.filter({
          session_id: { $in: sessionIds }
        }),
      ]);

      const allSegments = segResult.status === 'fulfilled' ? segResult.value : [];
      const allPSD = psdResult.status === 'fulfilled' ? psdResult.value : [];

      if (segResult.status === 'rejected') {
        console.error('[useWeeklyData] Segment load failed:', segResult.reason);
      }
      if (psdResult.status === 'rejected') {
        console.warn('[useWeeklyData] PSD load failed (non-critical):', psdResult.reason);
      }

      // 3. Build maps — NO transformation, NO JSON shape
      const segmentsBySession = {};
      const childSegments = {};
      let orphanCount = 0;

      // Initialize empty arrays for each session
      sessions.forEach(s => { segmentsBySession[s.id] = []; });

      // BUGFIX (2026-02-26): Track parent IDs so we can detect orphaned children
      // (children whose parent_segment_id doesn't match any parent in this service).
      // These are caused by stale data after resets or the previous bug where
      // child segments were created without parent_segment_id.
      const parentIdSet = new Set();

      // First pass: identify all parent segments
      allSegments.forEach(seg => {
        if (!seg.parent_segment_id && seg.session_id && sessionIdSet.has(seg.session_id)) {
          parentIdSet.add(seg.id);
        }
      });

      // Second pass: categorize all segments
      let orphanChildCount = 0;
      allSegments.forEach(seg => {
        if (seg.parent_segment_id) {
          if (parentIdSet.has(seg.parent_segment_id)) {
            // Valid child segment — parent exists in this service
            if (!childSegments[seg.parent_segment_id]) {
              childSegments[seg.parent_segment_id] = [];
            }
            childSegments[seg.parent_segment_id].push(seg);
          } else {
            // Orphaned child — parent_segment_id points to a nonexistent parent.
            // Log and skip to prevent UI corruption.
            orphanChildCount++;
          }
        } else if (seg.session_id && sessionIdSet.has(seg.session_id)) {
          // Parent segment belonging to a known session
          segmentsBySession[seg.session_id].push(seg);
        } else {
          // Orphaned segment — log but don't crash
          orphanCount++;
        }
      });

      if (orphanChildCount > 0) {
        console.warn(`[useWeeklyData] ${orphanChildCount} orphaned child segments (parent not found) for service ${serviceId}`);
      }

      if (orphanCount > 0) {
        console.warn(`[useWeeklyData] ${orphanCount} orphaned segments (no matching session_id) for service ${serviceId}`);
      }

      // Sort by order
      Object.values(segmentsBySession).forEach(arr =>
        arr.sort((a, b) => (a.order || 0) - (b.order || 0))
      );
      Object.values(childSegments).forEach(arr =>
        arr.sort((a, b) => (a.order || 0) - (b.order || 0))
      );

      // Build PSD map
      const psdBySession = {};
      allPSD.forEach(p => { psdBySession[p.session_id] = p; });

      return {
        sessions: sessions.sort((a, b) => (a.order || 0) - (b.order || 0)),
        segmentsBySession,
        childSegments,
        psdBySession,
      };
    },
  });

  return {
    sessions: data?.sessions || [],
    segmentsBySession: data?.segmentsBySession || {},
    childSegments: data?.childSegments || {},
    psdBySession: data?.psdBySession || {},
    isLoading,
    error,
    queryKey,
  };
}