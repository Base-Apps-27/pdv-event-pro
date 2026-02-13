/**
 * Report Helper Functions
 * 
 * Extracted from pages/Reports.jsx (Phase 3D-1)
 * Decision: Phase 3 decomposition — zero behavior changes, verbatim extraction.
 * 
 * Exports:
 *   sessionColorClasses, eventColorClasses, departmentColors
 *   getSegmentActions(segment)
 *   isPrepAction(action)
 *   calculateActionTime(segment, action)
 *   normalizeToBytes(data)
 *   downloadPdf(filename, data)
 *   parseHM(t)
 *   mergePreSessionDetails(records)
 */
import { formatTimeToEST } from '../utils/timeFormat';

// Session left-border color mapping - used to visually distinguish sessions
// Note: green uses inline style for custom brand green (#8DC63F), others use Tailwind classes
export const sessionColorClasses = {
  green: 'border-l-8',  // Uses inline style for borderLeftColor
  blue: 'border-l-8 border-l-blue-500',
  pink: 'border-l-8 border-l-pink-500',
  orange: 'border-l-8 border-l-orange-500',
  yellow: 'border-l-8 border-l-yellow-400',
  purple: 'border-l-8 border-l-purple-500',
  red: 'border-l-8 border-l-red-500',
};

export const eventColorClasses = {
  green: 'border-t-8',
  blue: 'border-t-8 border-blue-500',
  pink: 'border-t-8 border-pink-500',
  orange: 'border-t-8 border-orange-500',
  yellow: 'border-t-8 border-yellow-400',
  purple: 'border-t-8 border-purple-500',
  red: 'border-t-8 border-red-500',
  teal: 'border-t-8 border-teal-600',
  charcoal: 'border-t-8 border-gray-800',
};

// Color coding by department:
// - Projection: slate (neutral gray) - distinct from translation
// - Translation & Stage & Decor: purple - all translation-related items
// - Sound: red
// - Ujieres: green
// - Hospitality: pink
export const departmentColors = {
  Admin: "bg-orange-50 border-orange-200 text-orange-700",
  MC: "bg-blue-50 border-blue-200 text-blue-700",
  Sound: "bg-red-50 border-red-200 text-red-700",
  Projection: "bg-slate-100 border-slate-300 text-slate-700",
  Hospitality: "bg-pink-50 border-pink-200 text-pink-700",
  Ujieres: "bg-green-50 border-green-200 text-green-700",
  Kids: "bg-yellow-50 border-yellow-200 text-yellow-700",
  Coordinador: "bg-orange-50 border-orange-200 text-orange-700",
  "Stage & Decor": "bg-purple-50 border-purple-200 text-purple-700",
  Translation: "bg-purple-50 border-purple-200 text-purple-700",
  Livestream: "bg-indigo-50 border-indigo-200 text-indigo-700",
  Other: "bg-gray-50 border-gray-200 text-gray-700"
};

export const getSegmentActions = (segment) => {
  return segment?.segment_actions || [];
};

export const isPrepAction = (action) => {
  // Prep = before_start timing, During = everything else
  return action.timing === 'before_start';
};

// Helper to calculate action time based on segment timing and offset
export const calculateActionTime = (segment, action) => {
  const segmentStart = segment.start_time;
  const segmentEnd = segment.end_time;
  if (!segmentStart) return null;
  
  const [startH, startM] = segmentStart.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  
  let endMinutes = startMinutes + (segment.duration_min || 0);
  if (segmentEnd) {
    const [endH, endM] = segmentEnd.split(':').map(Number);
    endMinutes = endH * 60 + endM;
  }
  
  const offset = action.offset_min || 0;
  let targetMinutes;
  
  switch (action.timing) {
    case 'before_start':
      targetMinutes = startMinutes - offset;
      break;
    case 'after_start':
      targetMinutes = startMinutes + offset;
      break;
    case 'before_end':
      targetMinutes = endMinutes - offset;
      break;
    case 'absolute':
      return action.absolute_time ? formatTimeToEST(action.absolute_time) : null;
    default:
      return null;
  }
  
  if (targetMinutes < 0) targetMinutes += 24 * 60;
  const h = Math.floor(targetMinutes / 60) % 24;
  const m = targetMinutes % 60;
  return formatTimeToEST(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
};

// Robust binary normalization for function responses (arraybuffer/object/base64/string)
export function normalizeToBytes(data) {
  // 1) Native binary types
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer);

  // 2) Buffer-like object shapes from Axios/Node adapters
  if (data && typeof data === 'object') {
    // { type: 'Buffer', data: [..] }
    if (data.type === 'Buffer' && Array.isArray(data.data)) {
      return new Uint8Array(data.data);
    }
    // { data: [..numbers..] }
    if (Array.isArray(data.data) && typeof data.data[0] === 'number') {
      return new Uint8Array(data.data);
    }
    // Plain numeric array
    if (Array.isArray(data) && typeof data[0] === 'number') {
      return new Uint8Array(data);
    }
    // Flat object of numeric values {0:..,1:..}
    const vals = Object.values(data);
    if (vals.length && typeof vals[0] === 'number') return new Uint8Array(vals);
  }

  // 3) String payloads
  if (typeof data === 'string') {
    // Base64 attempt
    try {
      const bstr = atob(data);
      const bytes = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);
      if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return bytes;
    } catch (_) { /* not base64 */ }
    // Raw text fallback (may work for ASCII-only PDFs)
    return new TextEncoder().encode(data);
  }

  // 4) Last resort
  return new Uint8Array();
}

export async function downloadPdf(filename, data) {
  const bytes = normalizeToBytes(data);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

// Merge multiple PreSessionDetails records for a session into a single block.
// Non-destructive: prefers earliest times; for text fields, uses first non-empty value.
export const parseHM = (t) => {
  if (!t || typeof t !== 'string') return Number.POSITIVE_INFINITY;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return Number.POSITIVE_INFINITY;
  return h * 60 + m;
};

export const mergePreSessionDetails = (records) => {
  if (!Array.isArray(records) || records.length === 0) return null;
  if (records.length > 1) {
    // Breadcrumb for ops: duplicates exist; we consolidate at render time.
    console.warn('Reports: multiple PreSessionDetails found for session, consolidating', records.map(r => r.id));
  }
  const merged = {};

  // Simple pickers: first non-empty
  const pickFirst = (key) => {
    const found = records.find(r => r && r[key]);
    if (found) merged[key] = found[key];
  };
  pickFirst('music_profile_id');
  pickFirst('slide_pack_id');
  pickFirst('facility_notes');
  pickFirst('general_notes');

  // Time pickers: earliest
  const pickEarliest = (key) => {
    const times = records.map(r => r && r[key]).filter(Boolean);
    if (times.length === 0) return;
    times.sort((a, b) => parseHM(a) - parseHM(b));
    merged[key] = times[0];
  };
  pickEarliest('registration_desk_open_time');
  pickEarliest('library_open_time');

  return merged;
};