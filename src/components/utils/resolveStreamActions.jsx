import { resolveBlockTime } from "@/components/utils/streamTiming";

/**
 * resolveStreamActions — Resolves stream_actions within StreamBlocks
 * into time-stamped operational actions compatible with StickyOpsDeck.
 *
 * Each stream block has stream_actions[] with timing relative to the block
 * (before_start, after_start, before_end). This utility resolves those
 * into absolute Date objects using the block's resolved start/end times.
 *
 * Returns an array of action objects matching StickyOpsDeck's expected shape:
 *   { id, time, label, segmentTitle, segmentId, type, isPrep, notes, isStreamAction, blockTitle }
 *
 * WHY THIS EXISTS:
 * Stream actions (e.g., "Camera 2 ready", "Lower third ON", "Interview prep")
 * are operationally critical but were invisible in the StickyOpsDeck countdown.
 * A speaker walking off stage to prep for a stream interview is a cross-departmental
 * action that BOTH room and stream teams need visibility into.
 *
 * 2026-02-14: Created for Option C (Unified Ops Deck with Source Tagging)
 *
 * @param {Array} streamBlocks - Raw StreamBlock entities from DB
 * @param {Array} segments - Session segments (needed for anchor resolution)
 * @param {String} sessionDate - YYYY-MM-DD for the session
 * @returns {Array} Resolved action objects ready for StickyOpsDeck aggregation
 */
export function resolveStreamActions(streamBlocks, segments, sessionDate) {
  if (!streamBlocks?.length) return [];

  const actions = [];

  for (const block of streamBlocks) {
    // Skip blocks with no actions
    if (!block.stream_actions?.length) continue;

    // Resolve the block's absolute start and end times
    const { startTime: blockStart, endTime: blockEnd, isOrphaned } = resolveBlockTime(block, segments, sessionDate);

    // Skip orphaned or unresolvable blocks — no reliable time anchor
    if (!blockStart || !blockEnd || isOrphaned) continue;

    const blockStartMs = blockStart.getTime();
    const blockEndMs = blockEnd.getTime();

    for (const action of block.stream_actions) {
      if (!action.label) continue; // Skip empty cues

      let actionTime;
      const offsetMs = (action.offset_min || 0) * 60000;

      // Resolve timing relative to block boundaries
      switch (action.timing) {
        case 'before_start':
          actionTime = new Date(blockStartMs - offsetMs);
          break;
        case 'after_start':
          actionTime = new Date(blockStartMs + offsetMs);
          break;
        case 'before_end':
          actionTime = new Date(blockEndMs - offsetMs);
          break;
        case 'absolute':
          if (action.absolute_time && sessionDate) {
            const [h, m] = action.absolute_time.split(':').map(Number);
            const [y, mo, d] = sessionDate.split('-').map(Number);
            actionTime = new Date(y, mo - 1, d, h, m, 0, 0);
          }
          break;
        default:
          // Fallback: treat as after_start
          actionTime = new Date(blockStartMs + offsetMs);
          break;
      }

      if (!actionTime || isNaN(actionTime.getTime())) continue;

      actions.push({
        id: `stream-${block.id}-${action.label}-${action.timing || 'default'}`,
        time: actionTime,
        label: action.label,
        segmentTitle: block.title, // Block title as context
        segmentId: null, // Stream actions don't link to room segments
        blockId: block.id, // For scrolling to the block in stream view
        type: 'Livestream', // Department tag — always Livestream
        isPrep: action.timing === 'before_start',
        isStreamAction: true, // SOURCE TAG: distinguishes from room segment actions
        blockTitle: block.title,
        notes: action.notes || null,
        isRequired: action.is_required || false
      });
    }
  }

  return actions;
}