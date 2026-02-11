/**
 * Event Reports PDF — Client-side generator (pdfmake)
 * 
 * PHASE 3E REFACTOR: Decomposed from 1,103 → ~120 lines.
 * Internal functions extracted to:
 *   - pdf/cellBuilders.js     (buildTimeCell, buildDetailsLeftCell, etc.)
 *   - pdf/sectionBuilders.js  (buildNotesCell, buildSessionHeader, etc.)
 *   - pdf/tableBuilder.js     (buildDayTable)
 * 
 * This file retains only: pdfMake initialization + main export function.
 */
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { pdfTheme } from './pdfThemeSystem';

// Extracted module imports — Phase 3E
import { buildSessionHeader, buildPreSessionDetailsBlock } from './pdf/sectionBuilders';
import { buildDayTable } from './pdf/tableBuilder';

// Initialize pdfMake fonts
if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}

// Configure NotoEmoji font for emoji support in PDF
// Using CDN-hosted Noto Emoji Monochrome font
const NOTO_EMOJI_CDN = 'https://cdn.jsdelivr.net/gh/zjaco13/Noto-Emoji-Monochrome@24d8485dc7eeda9ec8d08788dfacad75127aebc7/fonts/NotoEmoji-Medium.ttf';

pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
  NotoEmoji: {
    normal: NOTO_EMOJI_CDN,
    bold: NOTO_EMOJI_CDN,
    italics: NOTO_EMOJI_CDN,
    bolditalics: NOTO_EMOJI_CDN,
  },
};

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function generateEventReportPDFClient({ event, sessions, segmentsBySession, preSessionDetailsBySession, rooms = [], hospitalityTasksBySession = {} }) {
  const content = [];

  sessions.forEach((session, idx) => {
    // Check if session has hospitality tasks assigned
    const hasHospitalityTasks = Array.isArray(hospitalityTasksBySession?.[session.id]) && hospitalityTasksBySession[session.id].length > 0;
    
    // Session header with team info
    content.push(buildSessionHeader(event, session, hasHospitalityTasks));

    // Pre-session details
    const psd = preSessionDetailsBySession?.[session.id];
    if (psd) {
      const psdBlock = buildPreSessionDetailsBlock(psd);
      if (psdBlock) content.push(psdBlock);
    }

    // Main table
    const allSegs = segmentsBySession?.[session.id] || [];
    content.push(buildDayTable(session, allSegs, rooms));

    // Page break after each session (except last)
    if (idx < sessions.length - 1) {
      content.push({ text: '', pageBreak: 'after' });
    }
  });

  const docDefinition = {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [12, 8, 12, 14],
    defaultStyle: { fontSize: pdfTheme.fontSize.base, color: pdfTheme.text.primary, font: 'Roboto' },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: new Date().toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }),
          color: pdfTheme.text.muted,
          fontSize: pdfTheme.fontSize.xs,
        },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs },
      ],
      margin: [18, 8],
    }),
  };

  const bytes = await new Promise((resolve, reject) => {
    try {
      const pdf = pdfMake.createPdf(docDefinition);
      pdf.getBase64(b64 => {
        try {
          const bin = atob(b64);
          const out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          resolve(out);
        } catch (e) {
          reject(e);
        }
      });
    } catch (err) {
      reject(err);
    }
  });

  return bytes;
}