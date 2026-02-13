import { normalizeSegments } from './normalizeProgram';

/**
 * Normalizes StreamBlocks for public consumption.
 * Currently a passthrough but structure allows for future normalization.
 * 
 * @param {Array} blocks - Raw StreamBlock entities
 * @param {Array} segments - Normalized segments (for anchoring context if needed)
 * @returns {Array} Normalized StreamBlocks
 */
export function normalizeStreamBlocks(blocks, segments = []) {
  if (!blocks || !Array.isArray(blocks)) return [];
  
  // Return a sorted copy to prevent mutation
  return [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0)).map(block => ({
    ...block,
    _source: 'stream_block'
  }));
}