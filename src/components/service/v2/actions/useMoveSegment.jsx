/**
 * useMoveSegment.js — V2 reorder segments via entity order field swap.
 *
 * 2026-04-12: CRITICAL FIX — Order writes now bypass useEntityWrite's 400ms debounce.
 * Previously, order updates went through writeSegment → scheduleCoalesced → 400ms timer.
 * This created a race condition where useSpecialSegment.add() would re-index all segments
 * atomically, but a pending debounced order write from a recent move would fire AFTER
 * the re-index and revert the segment to its old position.
 *
 * Fix: Use base44.entities.Segment.update() directly for order changes. Order is a
 * structural field (not a "user is typing" field) and must be committed immediately.
 * The RQ cache is still updated optimistically for instant UI response.
 *
 * Decision: "Segment order writes bypass debounce to prevent re-index race condition"
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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

      // ID-based comparison: only update segments whose order actually changed
      const oldOrderById = {};
      (old.segmentsBySession[sessionId] || []).forEach(s => {
        if (s.id) oldOrderById[s.id] = s.order;
      });
      const changedSegs = reindexed.filter(
        seg => seg.id && seg.order !== oldOrderById[seg.id]
      );

      // 2026-04-12: DIRECT API WRITES — bypass debounce for order field.
      // Order is structural and must be committed atomically.
      // Using Promise.all ensures all order writes land together.
      // If any fail, we surface the error via onError callback.
      if (changedSegs.length > 0) {
        Promise.all(
          changedSegs.map(seg =>
            base44.entities.Segment.update(seg.id, { order: seg.order })
              .then(() => {
                const prevOrder = oldOrderById[seg.id];
                logReorder('Segment', seg.id, prevOrder, seg.order, sessionId, null, seg.title).catch(() => {});
              })
              .catch(err => {
                console.error('[V2 Move] Direct order write failed for segment', seg.id, err.message);
                if (onError) onError(err);
              })
          )
        ).then(() => {
          console.log(`[V2 Move] Session ${sessionId}: committed ${changedSegs.length} order updates directly`);
        });
      }

      return { ...old, segmentsBySession: newSBS };
    });
  }, [queryClient, queryKey, onError]);

  return { move };
}