/**
 * useWeeklyData.js — V2 Weekly Editor data loading hook.
 * DECISION-003 Principle 1: No intermediate JSON shape.
 *
 * Loads Service + Sessions + Segments + PreSessionDetails for a given
 * service ID. Returns raw entity objects organized into Maps.
 * NO transformation. NO JSON blob shape. NO blueprint matching.
 *
 * Segments without ui_fields are returned as-is — the UI decides
 * how to display them (warning, not phantom fields).
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
    queryFn: async () => {
      // 1. Load sessions for this service
      const sessions = await base44.entities.Session.filter({
        service_id: serviceId,
      });

      if (!sessions || sessions.length === 0) {
        return { sessions: [], segmentsBySession: {}, childSegments: {}, psdBySession: {} };
      }

      const sessionIds = sessions.map(s => s.id);

      // 2. Batch load all segments + pre-session details in parallel
      const [allSegments, allPSD] = await Promise.all([
        base44.entities.Segment.filter({ service_id: serviceId }),
        base44.entities.PreSessionDetails.filter({
          session_id: { $in: sessionIds }
        }).catch(() => []),
      ]);

      // 3. Build maps — NO transformation, NO JSON shape
      const segmentsBySession = {};
      const childSegments = {};

      // Initialize empty arrays for each session
      sessions.forEach(s => { segmentsBySession[s.id] = []; });

      allSegments.forEach(seg => {
        if (seg.parent_segment_id) {
          // Child segment (Ministración, Cierre, etc.)
          if (!childSegments[seg.parent_segment_id]) {
            childSegments[seg.parent_segment_id] = [];
          }
          childSegments[seg.parent_segment_id].push(seg);
        } else {
          // Parent segment
          if (segmentsBySession[seg.session_id]) {
            segmentsBySession[seg.session_id].push(seg);
          }
        }
      });

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