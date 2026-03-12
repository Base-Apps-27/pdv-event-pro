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
// SIMPLE TABLE BUILDERS FOR FILTERED REPORT TYPES
// ============================================================================

function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${p}`;
}

const TH = (text) => ({ text, bold: true, fillColor: '#f3f4f6', fontSize: 8, color: '#111827' });

function buildSimpleNotesTable(segments, noteField, columnTitle) {
  const body = [[TH('Hora'), TH('Título'), TH(columnTitle)]];
  segments
    .filter(s => s[noteField] || true) // show all, blank notes show dash
    .forEach(s => body.push([
      { text: fmt12(s.start_time) || '—', fontSize: 8 },
      { text: s.title || '—', fontSize: 8, bold: true },
      { text: s[noteField] || '—', fontSize: 8 },
    ]));
  return { table: { widths: [60, 160, '*'], body }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 6] };
}

function buildGeneralTable(segments) {
  const body = [[TH('Hora'), TH('Título'), TH('Responsable'), TH('Duración')]];
  segments
    .filter(s => s.show_in_general !== false)
    .forEach(s => body.push([
      { text: fmt12(s.start_time) || '—', fontSize: 8 },
      { text: s.title || '—', fontSize: 8, bold: true },
      { text: s.presenter || '—', fontSize: 8 },
      { text: s.duration_min ? `${s.duration_min} min` : '—', fontSize: 8 },
    ]));
  return { table: { widths: [60, '*', 160, 60], body }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 6] };
}

function buildHospitalityTable(tasks) {
  const body = [[TH('Tiempo'), TH('Categoría'), TH('Descripción'), TH('Ubicación'), TH('Notas')]];
  if (!tasks || tasks.length === 0) {
    body.push([{ text: 'Sin tareas registradas', colSpan: 5, color: '#6b7280', fontSize: 8 }, {}, {}, {}, {}]);
  } else {
    tasks.forEach(t => body.push([
      { text: t.time_hint || '—', fontSize: 8 },
      { text: t.category || '—', fontSize: 8 },
      { text: t.description || '—', fontSize: 8 },
      { text: t.location_notes || '—', fontSize: 8 },
      { text: t.notes || '—', fontSize: 8 },
    ]));
  }
  return { table: { widths: [60, 70, '*', 100, 100], body }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 6] };
}

function buildLivestreamTable(segments) {
  const body = [[TH('Hora'), TH('Título'), TH('Presenter'), TH('Notas Livestream')]];
  segments
    .filter(s => s.show_in_livestream !== false)
    .forEach(s => body.push([
      { text: fmt12(s.start_time) || '—', fontSize: 8 },
      { text: s.title || '—', fontSize: 8, bold: true },
      { text: s.presenter || '—', fontSize: 8 },
      { text: s.livestream_notes || '—', fontSize: 8 },
    ]));
  return { table: { widths: [60, 160, 120, '*'], body }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 6] };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function generateEventReportPDFClient({ event, sessions, segmentsBySession, preSessionDetailsBySession, rooms = [], hospitalityTasksBySession = {}, reportType = 'detailed' }) {
  const content = [];

  sessions.forEach((session, idx) => {
    const allSegs = (segmentsBySession?.[session.id] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const hasHospitalityTasks = Array.isArray(hospitalityTasksBySession?.[session.id]) && hospitalityTasksBySession[session.id].length > 0;

    // Session header with team info (all report types)
    content.push(buildSessionHeader(event, session, hasHospitalityTasks));

    // Pre-session details (all report types)
    const psd = preSessionDetailsBySession?.[session.id];
    if (psd) {
      const psdBlock = buildPreSessionDetailsBlock(psd);
      if (psdBlock) content.push(psdBlock);
    }

    // Main table — branch by reportType
    if (reportType === 'projection') {
      content.push(buildSimpleNotesTable(allSegs.filter(s => s.show_in_projection !== false), 'projection_notes', 'Notas Proyección'));
    } else if (reportType === 'sound') {
      content.push(buildSimpleNotesTable(allSegs.filter(s => s.show_in_sound !== false), 'sound_notes', 'Notas Sonido'));
    } else if (reportType === 'ushers') {
      content.push(buildSimpleNotesTable(allSegs.filter(s => s.show_in_ushers !== false), 'ushers_notes', 'Notas Ujieres'));
    } else if (reportType === 'general') {
      content.push(buildGeneralTable(allSegs));
    } else if (reportType === 'hospitality') {
      content.push(buildHospitalityTable(hospitalityTasksBySession?.[session.id] || []));
    } else if (reportType === 'livestream') {
      content.push(buildLivestreamTable(allSegs));
    } else {
      // 'detailed' (default)
      content.push(buildDayTable(session, allSegs, rooms));
    }

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