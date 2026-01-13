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

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
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