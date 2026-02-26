/**
 * useMoveSegment.js — V2 reorder segments via entity order field swap.
 * HARDENING (Phase 8):
 *   - Validates index bounds before swap
 *   - Full re-index after swap to prevent cumulative order drift
 *   - Logs reorder actions for traceability
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useMoveSegment(queryKey) {
  const queryClient = useQueryClient();

  const move = useCallback((sessionId, index, direction) => {
    queryClient.setQueryData(queryKey, (old) => {
      if (!old) return old;
      const newSBS = { ...old.segmentsBySession };
      const arr = [...(newSBS[sessionId] || [])];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;

      // Bounds check
      if (targetIdx < 0 || targetIdx >= arr.length) return old;

      // Swap
      const seg1 = arr[index];
      const seg2 = arr[targetIdx];
      arr[index] = seg2;
      arr[targetIdx] = seg1;

      // Full re-index (prevents cumulative drift from partial updates)
      const reindexed = arr.map((seg, i) => ({ ...seg, order: i + 1 }));
      newSBS[sessionId] = reindexed;

      // Entity writes — update ALL orders to match new positions
      const writes = reindexed
        .filter((seg, i) => seg.id && seg.order !== (old.segmentsBySession[sessionId]?.[i]?.order))
        .map(seg => base44.entities.Segment.update(seg.id, { order: seg.order }));

      if (writes.length > 0) {
        Promise.all(writes).catch(err =>
          console.error('[V2 Move] Re-index failed:', err.message)
        );
      }

      console.log(`[V2 Move] Session ${sessionId}: moved idx ${index} ${direction} → re-indexed ${writes.length} segments`);

      return { ...old, segmentsBySession: newSBS };
    });
  }, [queryClient, queryKey]);

  return { move };
}