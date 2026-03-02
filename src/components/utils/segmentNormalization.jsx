/**
 * segmentNormalization.jsx — Stub re-export for test compatibility.
 * 
 * The segmentNormalization.test.jsx file imports from this path.
 * Actual utilities live in segmentDataUtils.js.
 * 
 * normalizeServiceData is a test-only function that was never fully implemented
 * in the main codebase. It's defined here as a minimal stub so the test file
 * can import without breaking the build.
 */

export { getNormalizedSongs } from './segmentDataUtils';

/**
 * normalizeServiceData — Extracts a flat array of segments from a service data object.
 * Used by tests only. Production code uses entity-based paths directly.
 */
export function normalizeServiceData(serviceData, serviceType) {
  if (!serviceData) return [];

  const date = serviceData.date || '';

  if (serviceType === 'event') {
    return (serviceData.segments || []).map(seg => ({
      ...seg,
      source: seg.id ? 'entity' : 'json',
    }));
  }

  if (serviceType === 'custom') {
    return (serviceData.segments || []).map((seg, idx) => ({
      ...seg,
      date,
      source: seg.id ? 'entity' : 'json',
      id: seg.id || `custom-${date}-${idx}`,
    }));
  }

  // weekly: extract from time-slot keys like "9:30am", "11:30am"
  const TIME_SLOT_RE = /^\d+:\d+[ap]m$/i;
  const result = [];
  for (const key of Object.keys(serviceData)) {
    if (!TIME_SLOT_RE.test(key)) continue;
    const segs = serviceData[key];
    if (!Array.isArray(segs)) continue;
    segs.forEach((seg, idx) => {
      result.push({
        ...seg,
        timeSlot: key,
        date,
        source: seg.id ? 'entity' : 'json',
        id: seg.id || `weekly-${date}-${key}-${idx}`,
      });
    });
  }
  return result;
}