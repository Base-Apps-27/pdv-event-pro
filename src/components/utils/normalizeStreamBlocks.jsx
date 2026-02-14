/**
 * Normalizes StreamBlocks for public consumption.
 * 
 * FIX #5 (2026-02-14): Enhanced from passthrough to include:
 * - Orphan detection (anchor_segment_id references a deleted segment)
 * - Defensive defaults for missing arrays (stream_actions)
 * - Removed unused import (normalizeSegments was never called)
 * 
 * @param {Array} blocks - Raw StreamBlock entities
 * @param {Array} segments - Normalized segments (for anchoring context)
 * @returns {Array} Normalized StreamBlocks
 */
export function normalizeStreamBlocks(blocks, segments = []) {
  if (!blocks || !Array.isArray(blocks)) return [];

  const segmentIds = new Set(segments.map(s => s.id));

  return [...blocks]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(block => {
      // Detect orphaned blocks: anchor references a segment that no longer exists
      const isOrphaned = !!(
        block.anchor_segment_id &&
        block.anchor_point !== 'absolute' &&
        !segmentIds.has(block.anchor_segment_id)
      );

      return {
        ...block,
        stream_actions: block.stream_actions || [], // Defensive default
        orphaned: isOrphaned || block.orphaned || false,
        _source: 'stream_block'
      };
    });
}