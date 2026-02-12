/**
 * compressionLevel.js
 * Phase 3C extraction: Utility function for detecting service complexity
 * and returning a compression level for print layout.
 * Pure function — zero side effects.
 */

export function getCompressionLevel(serviceData) {
  if (!serviceData) return 'normal';
  
  const totalSegments = (serviceData.segments || []).length;
  const avgNotesLength = (serviceData.segments || []).reduce((sum, seg) => {
    const notes = [seg.coordinator_notes, seg.projection_notes, seg.sound_notes, seg.description_details].join(' ').length;
    return sum + notes;
  }, 0) / Math.max(totalSegments, 1);
  
  const contentDensity = totalSegments + (avgNotesLength > 100 ? 2 : 0);
  
  if (contentDensity > 12) return 'aggressive'; // 10+ segments or heavy notes
  if (contentDensity > 8) return 'moderate';    // 6-9 segments
  return 'normal';                               // <= 5 segments
}