/**
 * generateArtsReportPDF.js
 * 2026-03-09: pdfmake-based Arts Production Report generator.
 *
 * Mirrors the visual logic of ArtsReportSegmentCard.jsx but outputs a
 * downloadable PDF via pdfmake (same library used by generateEventReportsPDFClient).
 *
 * Design decisions:
 * - Portrait LETTER — better for per-segment reference docs vs the landscape event reports
 * - Brand teal (#1F8A70) header per segment
 * - Per-type blocks with type-specific accent fill (dance=purple, drama=red, etc.)
 * - Side-by-side columns when a segment has 2+ art types
 * - Empty fields are skipped entirely (mirrors card component behavior)
 * - Hyperlinks preserved on URLs (pdfmake supports link on text nodes)
 *
 * Exports:
 *   generateArtsReportPDF({ event, sessions, segments }) → Promise<Uint8Array>
 *   downloadArtsPdf(bytes, eventName)                   → triggers browser download
 */
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { toESTTimeStr } from '@/components/service/pdfThemeSystem';

// Init pdfMake fonts (idempotent guard matches generateEventReportsPDFClient pattern)
if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  DANCE: 'Danza', DRAMA: 'Drama', VIDEO: 'Video',
  SPOKEN_WORD: 'Spoken Word', PAINTING: 'Pintura', OTHER: 'Otro',
};

// Per-type accent colors for PDF fill blocks (mirrors web component TYPE_ACCENT)
const TYPE_FILLS = {
  DANCE:       { fill: '#F5F3FF', accent: '#7C3AED' },
  DRAMA:       { fill: '#FEF2F2', accent: '#DC2626' },
  VIDEO:       { fill: '#EFF6FF', accent: '#2563EB' },
  SPOKEN_WORD: { fill: '#FFFBEB', accent: '#D97706' },
  PAINTING:    { fill: '#FDF2F8', accent: '#BE185D' },
  OTHER:       { fill: '#F9FAFB', accent: '#6B7280' },
};

const MIC_LABELS = {
  headset: 'Headset', handheld: 'Handheld', stand: 'Atril',
  off_stage: 'Fuera del escenario', lapel: 'Lapel', podium: 'Podio',
};

const BRAND_TEAL  = '#1F8A70';
const LABEL_COLOR = '#9CA3AF';
const LABEL_W     = 68; // fixed label column width in pt

// ── Primitive pdfmake helpers ─────────────────────────────────────────────────

/** Coerces a URL array or string to a single string, or null */
function urlStr(url) {
  const s = Array.isArray(url) ? url[0] : url;
  return s || null;
}

/** Derives a short display name from a URL (strips hash prefixes) */
function urlDisplay(url) {
  const s = urlStr(url);
  if (!s) return null;
  try {
    const u = new URL(s);
    const filename = u.pathname.split('/').pop().replace(/^[a-f0-9]{6,}_/, '');
    return filename || s;
  } catch { return s; }
}

/** Label + value row — returns null if value is empty */
function pdfRow(label, value) {
  if (value === null || value === undefined || value === '') return null;
  return {
    columns: [
      { text: label.toUpperCase(), width: LABEL_W, fontSize: 6, color: LABEL_COLOR, bold: true },
      { text: String(value), fontSize: 7.5, color: '#111827', width: '*' },
    ],
    columnGap: 4,
    marginBottom: 2,
  };
}

/** Label + hyperlink row — returns null if url is empty */
function pdfLinkRow(label, url) {
  const s = urlStr(url);
  if (!s) return null;
  return {
    columns: [
      { text: label.toUpperCase(), width: LABEL_W, fontSize: 6, color: LABEL_COLOR, bold: true },
      { text: '↗ ' + (urlDisplay(url) || 'Ver archivo'), fontSize: 7.5, color: BRAND_TEAL, link: s, decoration: 'underline', width: '*' },
    ],
    columnGap: 4,
    marginBottom: 2,
  };
}

/** Mic count badges as inline text */
function pdfMicLine(handheld, headset) {
  const parts = [];
  if (handheld > 0) parts.push(`${handheld}× Handheld`);
  if (headset > 0)  parts.push(`${headset}× Headset`);
  if (parts.length === 0) return null;
  return { text: parts.join('   '), fontSize: 7, color: '#374151', bold: true, marginBottom: 3 };
}

/** Start / end cue pair in two columns */
function pdfCuePair(startCue, endCue) {
  if (!startCue && !endCue) return null;
  return {
    columns: [
      startCue ? {
        stack: [
          { text: 'CUE INICIO', fontSize: 6, color: LABEL_COLOR, bold: true, marginBottom: 1 },
          { text: startCue, fontSize: 7.5, color: '#111827' },
        ], width: '*',
      } : { text: '', width: '*' },
      endCue ? {
        stack: [
          { text: 'CUE FIN', fontSize: 6, color: LABEL_COLOR, bold: true, marginBottom: 1 },
          { text: endCue, fontSize: 7.5, color: '#111827' },
        ], width: '*',
      } : { text: '', width: '*' },
    ],
    columnGap: 8,
    marginBottom: 3,
  };
}

/** Songs block — mirrors SongsBlock in the card component */
function pdfSongs(prefix, seg) {
  const songs = [
    { num: 1, title: seg[`${prefix}_song_title`],   url: seg[`${prefix}_song_source`], owner: seg[`${prefix}_song_owner`] },
    { num: 2, title: seg[`${prefix}_song_2_title`], url: seg[`${prefix}_song_2_url`],  owner: seg[`${prefix}_song_2_owner`] },
    { num: 3, title: seg[`${prefix}_song_3_title`], url: seg[`${prefix}_song_3_url`],  owner: seg[`${prefix}_song_3_owner`] },
  ].filter(s => s.title || urlStr(s.url));

  if (songs.length === 0) return null;

  return {
    stack: [
      { text: 'CANCIONES', fontSize: 6, color: LABEL_COLOR, bold: true, marginBottom: 2 },
      ...songs.map(s => ({
        columns: [
          { text: `#${s.num}`, width: 16, fontSize: 6, color: LABEL_COLOR },
          {
            text: [
              s.title ? { text: s.title, bold: true } : '',
              s.owner ? { text: ` · ${s.owner}`, color: '#6B7280', fontSize: 6.5 } : '',
            ],
            width: '*', fontSize: 7.5,
          },
          urlStr(s.url) ? { text: '↗', color: BRAND_TEAL, link: urlStr(s.url), width: 12, fontSize: 7.5 } : { text: '', width: 12 },
        ],
        columnGap: 4,
        marginBottom: 1.5,
      })),
    ],
    marginTop: 3,
  };
}

// ── Per-type content builders ─────────────────────────────────────────────────

function buildDanceContent(seg) {
  return [
    pdfMicLine(seg.dance_handheld_mics, seg.dance_headset_mics),
    pdfCuePair(seg.dance_start_cue, seg.dance_end_cue),
    pdfRow('Vestuario', seg.dance_outfit_colors),
    pdfRow('Artículos esp.', seg.dance_special_items),
    seg.dance_has_song !== false ? pdfSongs('dance', seg) : null,
  ].filter(Boolean);
}

function buildDramaContent(seg) {
  return [
    pdfMicLine(seg.drama_handheld_mics, seg.drama_headset_mics),
    pdfCuePair(seg.drama_start_cue, seg.drama_end_cue),
    pdfRow('Vestuario', seg.drama_outfit_colors),
    pdfRow('Artículos esp.', seg.drama_special_items),
    seg.drama_has_song ? pdfSongs('drama', seg) : null,
  ].filter(Boolean);
}

function buildVideoContent(seg) {
  const dur = seg.video_length_sec
    ? `${Math.floor(seg.video_length_sec / 60)}:${String(seg.video_length_sec % 60).padStart(2, '0')}`
    : null;
  return [
    pdfRow('Nombre', seg.video_name),
    pdfLinkRow('Archivo', seg.video_url),
    pdfRow('Duración', dur),
    pdfRow('Responsable', seg.video_owner),
    pdfRow('Ubicación', seg.video_location),
  ].filter(Boolean);
}

function buildSpokenWordContent(seg) {
  const rows = [
    pdfRow('Orador', seg.spoken_word_speaker),
    pdfRow('Pieza', seg.spoken_word_description),
    pdfRow('Micrófono', MIC_LABELS[seg.spoken_word_mic_position] || seg.spoken_word_mic_position),
    pdfRow('Vestuario', seg.spoken_word_outfit_colors),
    pdfRow('Artículos esp.', seg.spoken_word_special_items),
    pdfLinkRow('Guión', seg.spoken_word_script_url),
    pdfLinkRow('Audio', seg.spoken_word_audio_url),
  ].filter(Boolean);

  if (seg.spoken_word_has_music) {
    rows.push({
      stack: [
        { text: 'MÚSICA DE FONDO', fontSize: 6, color: '#D97706', bold: true, marginBottom: 2 },
        pdfRow('Track', seg.spoken_word_music_title),
        pdfRow('Responsable', seg.spoken_word_music_owner),
        pdfLinkRow('Archivo', seg.spoken_word_music_url),
      ].filter(Boolean),
      margin: [4, 3, 0, 0],
    });
  }

  if (seg.spoken_word_notes) rows.push(pdfRow('Notas', seg.spoken_word_notes));
  return rows;
}

function buildPaintingContent(seg) {
  const needs = [
    seg.painting_needs_easel       && 'Caballete',
    seg.painting_needs_drop_cloth  && 'Protección de piso',
    seg.painting_needs_lighting    && 'Iluminación especial',
  ].filter(Boolean);
  return [
    needs.length > 0 ? { text: needs.map(n => `✓ ${n}`).join('   '), fontSize: 7, color: '#BE185D', marginBottom: 2 } : null,
    pdfRow('Lienzo', seg.painting_canvas_size),
    pdfRow('Montaje', seg.painting_other_setup),
    pdfRow('Notas', seg.painting_notes),
  ].filter(Boolean);
}

function buildOtherContent(seg) {
  return [pdfRow('Descripción', seg.art_other_description)].filter(Boolean);
}

const TYPE_BUILDERS = {
  DANCE: buildDanceContent, DRAMA: buildDramaContent, VIDEO: buildVideoContent,
  SPOKEN_WORD: buildSpokenWordContent, PAINTING: buildPaintingContent, OTHER: buildOtherContent,
};

// ── Order helper (mirrors ArtsReportSegmentCard) ──────────────────────────────

function getOrderedTypes(seg) {
  const types = seg.art_types || [];
  if (!seg.arts_type_order || seg.arts_type_order.length === 0) return types;
  const orderMap = {};
  seg.arts_type_order.forEach(o => { orderMap[o.type] = o.order ?? 99; });
  return [...types].sort((a, b) => (orderMap[a] ?? 99) - (orderMap[b] ?? 99));
}

// ── Segment card builder ──────────────────────────────────────────────────────

function buildSegmentCard(seg, sessionName) {
  const types = getOrderedTypes(seg);
  if (types.length === 0) return null;

  // Header metadata line
  const meta = [sessionName, toESTTimeStr(seg.start_time), seg.presenter].filter(Boolean).join(' · ');
  const typePillText = types.map((tp, i) => `${i + 1}. ${TYPE_LABELS[tp] || tp}`).join('   ');
  const submittedMeta = [
    seg.arts_last_submitted_by ? `Enviado por: ${seg.arts_last_submitted_by}` : null,
    seg.arts_last_submitted_at ? new Date(seg.arts_last_submitted_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }) : null,
  ].filter(Boolean).join(' · ');

  // ── Header row ──
  const headerBody = [[
    {
      stack: [
        { text: seg.title, fontSize: 10, bold: true, color: '#FFFFFF' },
        meta ? { text: meta, fontSize: 6.5, color: '#FFFFFFBB', marginTop: 1 } : null,
      ].filter(Boolean),
      fillColor: BRAND_TEAL,
      margin: [8, 6, 4, 6],
      border: [false, false, false, false],
    },
    {
      stack: [
        { text: typePillText, fontSize: 6.5, color: '#FFFFFF', alignment: 'right' },
        submittedMeta ? { text: submittedMeta, fontSize: 5.5, color: '#FFFFFF80', alignment: 'right', marginTop: 2 } : null,
      ].filter(Boolean),
      fillColor: BRAND_TEAL,
      margin: [4, 6, 8, 6],
      border: [false, false, false, false],
    },
  ]];

  // ── Per-type content columns ──
  const typeColumns = types.map(tp => {
    const builder = TYPE_BUILDERS[tp];
    const rows = builder ? builder(seg) : [];
    const { fill, accent } = TYPE_FILLS[tp] || TYPE_FILLS.OTHER;
    return {
      stack: [
        { text: (TYPE_LABELS[tp] || tp).toUpperCase(), fontSize: 6, bold: true, color: accent, marginBottom: 3 },
        ...rows,
      ],
      fillColor: fill,
      margin: [6, 5, 6, 5],
      border: [false, false, false, false],
    };
  });

  // Side-by-side if 2+ types, single column otherwise
  const contentTableWidths = Array(types.length).fill('*');
  const contentBody = [typeColumns];

  // ── Footer: run of show + notes ──
  const rosUrl = urlStr(seg.arts_run_of_show_url);
  const hasFooter = !!(rosUrl || seg.description_details);
  const footerBody = hasFooter ? [[{
    stack: [
      { text: 'NOTAS GENERALES', fontSize: 6, bold: true, color: LABEL_COLOR, marginBottom: 3 },
      rosUrl ? { text: '↗ Run of Show', fontSize: 7, color: BRAND_TEAL, link: rosUrl, decoration: 'underline', marginBottom: 2 } : null,
      seg.description_details ? { text: seg.description_details, fontSize: 7.5, color: '#111827' } : null,
    ].filter(Boolean),
    fillColor: '#F9FAFB',
    margin: [8, 5, 8, 5],
    border: [false, false, false, false],
  }]] : null;

  // Compose card as a bordered outer stack
  return {
    stack: [
      // Header
      {
        table: { widths: ['*', 'auto'], body: headerBody },
        layout: {
          hLineWidth: () => 0, vLineWidth: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0,
        },
      },
      // Type content
      {
        table: { widths: contentTableWidths, body: contentBody },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i) => (i > 0 && i < types.length) ? 0.5 : 0,
          vLineColor: () => '#E5E7EB',
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0,
        },
      },
      // Footer (conditional)
      ...(footerBody ? [{
        table: { widths: ['*'], body: footerBody },
        layout: {
          hLineWidth: (i) => i === 0 ? 0.5 : 0, hLineColor: () => '#E5E7EB',
          vLineWidth: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0,
        },
      }] : []),
    ],
    // Outer border around the whole card
    margin: [0, 0, 0, 8],
    unbreakable: true,
    // Apply outer border via a wrapper table
    _isCard: true, // marker for the wrapper below
  };
}

/** Wraps a card stack in a thin border table for clean outer border */
function wrapCard(card) {
  return {
    table: {
      widths: ['*'],
      body: [[{ stack: card.stack, margin: [0, 0, 0, 0], border: [false, false, false, false] }]],
    },
    layout: {
      hLineWidth: () => 0.5, vLineWidth: () => 0.5,
      hLineColor: () => '#D1D5DB', vLineColor: () => '#D1D5DB',
      paddingLeft: () => 0, paddingRight: () => 0,
      paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: card.margin,
    unbreakable: card.unbreakable,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate an Arts Production Report PDF.
 *
 * @param {object} options
 * @param {object} options.event    - Event entity
 * @param {Array}  options.sessions - Sorted session entities
 * @param {Array}  options.segments - All segments (arts-only or full list — non-arts filtered internally)
 * @returns {Promise<Uint8Array>}
 */
export async function generateArtsReportPDF({ event, sessions, segments }) {
  const content = [];

  // Document header
  content.push({ text: event?.name || 'Evento', fontSize: 16, bold: true, color: BRAND_TEAL, marginBottom: 2 });
  content.push({ text: 'REPORTE DE PRODUCCIÓN — ARTES', fontSize: 8, color: '#6B7280', marginBottom: 14 });

  let hasAnyContent = false;

  sessions.forEach(session => {
    const artsSegs = segments
      .filter(s => s.session_id === session.id && s.art_types && s.art_types.length > 0)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (artsSegs.length === 0) return;
    hasAnyContent = true;

    // Session divider — horizontal rule with centered label
    content.push({
      columns: [
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 510, y2: 5, lineWidth: 0.4, lineColor: '#D1D5DB' }], width: '*' },
        { text: session.name.toUpperCase(), fontSize: 6.5, bold: true, color: '#9CA3AF', width: 'auto', margin: [8, 0] },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 510, y2: 5, lineWidth: 0.4, lineColor: '#D1D5DB' }], width: '*' },
      ],
      marginBottom: 8,
    });

    artsSegs.forEach(seg => {
      const card = buildSegmentCard(seg, session.name);
      if (card) content.push(wrapCard(card));
    });
  });

  if (!hasAnyContent) {
    content.push({
      text: 'No hay segmentos de artes registrados para este evento.',
      fontSize: 9, color: '#9CA3AF', italics: true,
    });
  }

  const docDefinition = {
    pageSize: 'LETTER',
    pageOrientation: 'portrait',
    pageMargins: [36, 36, 36, 40],
    defaultStyle: { font: 'Roboto', fontSize: 7.5, color: '#111827' },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: new Date().toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: '2-digit', day: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
          }),
          color: '#9CA3AF', fontSize: 6, margin: [36, 0],
        },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#9CA3AF', fontSize: 6, margin: [0, 0, 36, 0] },
      ],
      margin: [0, 8],
    }),
  };

  return new Promise((resolve, reject) => {
    try {
      const pdf = pdfMake.createPdf(docDefinition);
      pdf.getBase64(b64 => {
        try {
          const bin = atob(b64);
          const out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          resolve(out);
        } catch (e) { reject(e); }
      });
    } catch (err) { reject(err); }
  });
}

/**
 * Trigger a browser download of Arts PDF bytes.
 * Mirrors downloadPdf() from reportHelpers.js.
 */
export function downloadArtsPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename || 'artes-reporte'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}