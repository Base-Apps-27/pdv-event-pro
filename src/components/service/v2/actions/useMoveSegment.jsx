/**
 * useMoveSegment.js — V2 reorder segments via entity order field swap.
 * Optimistic cache update + parallel entity writes.
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
      if (targetIdx < 0 || targetIdx >= arr.length) return old;

      // Swap in cache
      const seg1 = arr[index];
      const seg2 = arr[targetIdx];
      arr[index] = { ...seg2, order: index + 1 };
      arr[targetIdx] = { ...seg1, order: targetIdx + 1 };
      newSBS[sessionId] = arr;

      // Entity writes (fire-and-forget)
      if (seg1.id && seg2.id) {
        Promise.all([
          base44.entities.Segment.update(seg1.id, { order: targetIdx + 1 }),
          base44.entities.Segment.update(seg2.id, { order: index + 1 }),
        ]).catch(err => console.error('[V2 Move] Swap failed:', err.message));
      }

      return { ...old, segmentsBySession: newSBS };
    });
  }, [queryClient, queryKey]);

  return { move };
}