// Pure utility to preview ripple shifts for a session's segments
// Modes: 'additive' adds delta to downstream start times; 'reflow' makes schedule contiguous

export function timeToMin(hhmm) {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return (h * 60 + m) % (24 * 60);
}

export function minToTime(mins) {
  if (mins == null) return '';
  const wrapped = ((mins % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function computeShiftPreview({ segments, editedSegmentId, newStartTime, mode = 'additive', stopAtMajorBreak = true, stopAtBreakout = true }) {
  const segs = Array.isArray(segments) ? segments.slice() : [];
  const edited = segs.find(s => s.id === editedSegmentId);
  if (!edited) return { affected: [], deltaMin: 0 };

  const origStart = timeToMin(edited.start_time);
  const newStart = timeToMin(newStartTime);
  const duration = Number(edited.duration_min) || 0;
  const deltaMin = (origStart != null && newStart != null) ? (newStart - origStart) : 0;

  // Downstream scope by order; fallback to chronological if needed
  const sorted = segs
    .filter(s => s.id !== editedSegmentId)
    .sort((a, b) => {
      const ao = Number.isFinite(a.order) ? a.order : 1e9;
      const bo = Number.isFinite(b.order) ? b.order : 1e9;
      if (ao !== bo) return ao - bo;
      const at = timeToMin(a.start_time) ?? 0;
      const bt = timeToMin(b.start_time) ?? 0;
      return at - bt;
    });

  // Find downstream starting index
  const startIdx = sorted.findIndex(s => (Number.isFinite(s.order) && Number.isFinite(edited.order)) ? s.order > edited.order : (timeToMin(s.start_time) ?? 0) >= (origStart ?? 0));
  if (startIdx === -1) return { affected: [], deltaMin };

  let downstream = sorted.slice(startIdx);

  // Apply barriers
  if (stopAtMajorBreak) {
    const idx = downstream.findIndex(s => s.major_break === true);
    if (idx >= 0) downstream = downstream.slice(0, idx); // stop before major break
  }
  if (stopAtBreakout) {
    const idx = downstream.findIndex(s => s.segment_type === 'Breakout');
    if (idx >= 0) downstream = downstream.slice(0, idx);
  }

  const affected = [];
  if (mode === 'additive') {
    for (const s of downstream) {
      const os = timeToMin(s.start_time);
      const dur = Number(s.duration_min) || 0;
      if (os == null || dur <= 0) continue;
      const ns = os + deltaMin;
      affected.push({ id: s.id, title: s.title, oldStart: s.start_time, oldEnd: s.end_time, newStart: minToTime(ns), newEnd: minToTime(ns + dur), duration_min: dur });
    }
  } else {
    // reflow contiguous from edited new end
    let cursor = (newStart != null ? newStart : origStart) + duration;
    for (const s of downstream) {
      const dur = Number(s.duration_min) || 0;
      if (dur <= 0) continue;
      const ns = cursor;
      affected.push({ id: s.id, title: s.title, oldStart: s.start_time, oldEnd: s.end_time, newStart: minToTime(ns), newEnd: minToTime(ns + dur), duration_min: dur });
      cursor = ns + dur;
    }
  }

  return { affected, deltaMin };
}