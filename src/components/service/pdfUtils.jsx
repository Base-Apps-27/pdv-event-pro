import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Initialize fonts once
if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}

export const BRAND = {
  BLACK: '#1A1A1A',
  TEAL: '#1F8A70',
  GREEN: '#8DC63F',
  LIME: '#D7DF23',
  WHITE: '#FFFFFF',
  GRAY: '#4B5563',
  LIGHT_GRAY: '#E5E7EB',
  RED: '#DC2626',
  BLUE: '#2563EB',
  PURPLE: '#7C3AED',
  ORANGE: '#EA580C',
  AMBER: '#B45309',
  PINK: '#DB2777'
};

/**
 * Safe date formatting — guards against Invalid Date from malformed strings.
 * Returns empty string instead of throwing RangeError.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  if (isNaN(date.getTime())) return '';
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
}

/**
 * Safe time-slot parser — converts slot names like "9:30am", "11:30am", "7:00pm"
 * into a valid Date object. Returns midnight fallback if unparseable.
 *
 * Centralised here so every PDF generator and time-math caller shares one
 * bulletproof implementation — no more RangeError: Invalid time value.
 */
export function safeParseTimeSlot(timeSlot) {
  if (!timeSlot || typeof timeSlot !== 'string') {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }

  // Strategy 1: regex extraction (most reliable — no date-fns dependency)
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = (match[3] || '').toLowerCase();
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    const d = new Date(); d.setHours(h, m, 0, 0); return d;
  }

  // Strategy 2: fallback — midnight
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

export function parseHtmlToPdfMake(html, globalScale = 1) {
  if (!html || typeof html !== 'string') return '';

  // Clean unwanted tags but keep b, i, strong, em, br
  let cleaned = html
    .replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

  // If no HTML tags, return plain text
  if (!/<[^>]+>/.test(cleaned)) return cleaned;

  const result = [];
  const parts = cleaned.split(/(<\/?(?:b|i|strong|em|br\s*\/?)>)/gi);

  let currentBold = false;
  let currentItalic = false;

  for (let part of parts) {
    if (!part) continue;
    if (part === '<b>' || part === '<strong>') {
      currentBold = true;
    } else if (part === '</b>' || part === '</strong>') {
      currentBold = false;
    } else if (part === '<i>' || part === '<em>') {
      currentItalic = true;
    } else if (part === '</i>' || part === '</em>') {
      currentItalic = false;
    } else if (part === '<br>' || part === '<br/>') {
      result.push({ text: '\n' });
    } else if (part && part.trim()) {
      result.push({
        text: part,
        ...(currentBold && { bold: true }),
        ...(currentItalic && { italics: true })
      });
    }
  }

  return result.length > 0 ? result : cleaned;
}