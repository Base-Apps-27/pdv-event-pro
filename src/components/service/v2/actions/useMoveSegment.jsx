/**
 * useMoveSegment.js — V2 thin wrapper over useStructuralOps.move().
 *
 * 2026-04-15: REFACTORED — All structural logic moved to useStructuralOps.
 * This file preserved for API compatibility with SlotColumn/SegmentCard.
 * The move() signature remains (sessionId, index, direction) so no call-site
 * changes are needed in WeeklyEditorV2 or SlotColumn.
 *
 * Previous issues fixed by useStructuralOps:
 *   - Individual segment.update() calls per segment → batch Promise.all
 *   - Race condition with useEntityWrite's 400ms debounce → serialization lock
 *   - Per-segment EditActionLog spam → single logBatchReorder entry
 *   - No time cascade → start_time/end_time recalculated after every reorder
 *
 * Decision: "Unified structural ops with serialization lock" (2026-04-15)
 */

import { useStructuralOps } from "./useStructuralOps";

export function useMoveSegment(queryKey, _writeSegment, onError) {
  // writeSegment param is no longer used — structural ops bypass debounce entirely.
  // Kept in signature for backward compatibility with WeeklyEditorV2 call site.
  const { move: structuralMove } = useStructuralOps(queryKey);

  const move = async (sessionId, index, direction) => {
    try {
      await structuralMove(sessionId, index, direction);
    } catch (err) {
      if (onError) onError(err);
    }
  };

  return { move };
}