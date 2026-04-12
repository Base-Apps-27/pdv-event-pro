/**
 * useMoveSegment.js — V2 reorder segments via entity order field swap.
 * BUGFIX (2026-03-09): Now uses writeSegment from useEntityWrite for reliable coalesced writes + error handling.
 * Previously fire-and-forget Promise.all() could fail silently, leaving UI inconsistent with database.
 * 
 * Validates index bounds, re-indexes all affected segments, and surfaces write errors via callback.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { logReorder } from "@/components/utils/editActionLogger";

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

      // 2026-04-05: BUGFIX — Use ID-based comparison instead of positional index.
      // Previously compared reindexed[i].order against old[i].order, but after inserts
      // the array composition changes (different segments at each index). Now we build
      // an ID→order map from the old state and compare by segment ID.
      const oldOrderById = {};
      (old.segmentsBySession[sessionId] || []).forEach(s => {
        if (s.id) oldOrderById[s.id] = s.order;
      });
      const changedSegs = reindexed.filter(
        seg => seg.id && seg.order !== oldOrderById[seg.id]
      );

      for (const seg of changedSegs) {
        try {
          writeSegment(seg.id, 'order', seg.order);
          // 2026-04-12: Log reorder for traceability
          const prevOrder = oldOrderById[seg.id];
          logReorder('Segment', seg.id, prevOrder, seg.order, sessionId, null, seg.title).catch(() => {});
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