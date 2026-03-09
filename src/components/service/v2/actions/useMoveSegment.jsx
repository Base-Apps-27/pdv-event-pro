/**
 * useMoveSegment.js — V2 reorder segments via entity order field swap.
 * BUGFIX (2026-03-09): Now uses writeSegment from useEntityWrite for reliable coalesced writes + error handling.
 * Previously fire-and-forget Promise.all() could fail silently, leaving UI inconsistent with database.
 * 
 * Validates index bounds, re-indexes all affected segments, and surfaces write errors via callback.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useMoveSegment(queryKey, writeSegment, onError) {
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

      // Queue entity writes via useEntityWrite (coalesced + retry-safe)
      const changedSegs = reindexed.filter(
        (seg, i) => seg.id && seg.order !== (old.segmentsBySession[sessionId]?.[i]?.order)
      );

      for (const seg of changedSegs) {
        try {
          writeSegment(seg.id, 'order', seg.order);
        } catch (err) {
          console.error('[V2 Move] Write failed for segment', seg.id, err.message);
          if (onError) onError(err);
        }
      }

      console.log(`[V2 Move] Session ${sessionId}: moved idx ${index} ${direction} → queued ${changedSegs.length} segment updates`);

      return { ...old, segmentsBySession: newSBS };
    });
  }, [queryClient, queryKey, writeSegment, onError]);

  return { move };
}