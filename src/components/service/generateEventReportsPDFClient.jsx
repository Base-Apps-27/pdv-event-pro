import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { pdfTheme, getSegmentColor, getLabelStyle, toESTTimeStr } from './pdfThemeSystem';

if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}

// ============================================================================
// CELL BUILDERS — Layout Intent System
// ============================================================================

function buildTimeCell(seg) {
  const color = getSegmentColor(seg.segment_type);
  return {
    stack: [
      {
        text: seg.start_time ? toESTTimeStr(seg.start_time) : '—',
        bold: true,
        color: pdfTheme.text.primary,
        fontSize: pdfTheme.fontSize.lg,
      },
      seg.end_time
        ? {
            text: toESTTimeStr(seg.end_time),
            color: pdfTheme.text.muted,
            fontSize: pdfTheme.fontSize.base,
            margin: [0, 1, 0, 0],
          }
        : null,
      seg.duration_min
        ? {
            text: `(${seg.duration_min}m)`,
            color: pdfTheme.text.muted,
            fontSize: pdfTheme.fontSize.sm,
            margin: [0, 1, 0, 0],
          }
        : null,
    ].filter(Boolean),
    verticalAlign: 'top',
    fillColor: pdfTheme.fills.timeCell,
    borderLeft: true,
    borderLeftColor: color.hex,
    borderLeftWidth: 3,
  };
}

function buildDetailsLeftCell(seg) {
  const stack = [];

  // Title + Type badge
  const titleParts = [
    {
      text: seg.title ? seg.title.toUpperCase() : '—',
      bold: true,
      color: pdfTheme.text.primary,
      fontSize: pdfTheme.fontSize.lg,
    },
  ];
  if (seg.segment_type) {
    const color = getSegmentColor(seg.segment_type);
    titleParts.push({
      text: `  ${seg.segment_type}`,
      color: color.hex,
      fontSize: pdfTheme.fontSize.sm,
      bold: true,
    });
  }
  stack.push({
    text: titleParts,
    margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
  });

  // Presenter - use appropriate label based on segment type
  if (seg.presenter) {
    const isBreakType = ['Break', 'Receso', 'Almuerzo'].includes(seg.segment_type);
    const presenterLabel = isBreakType ? 'ENCARGADO: ' : 'MINISTRA: ';
    stack.push({
      text: [
        { text: presenterLabel, bold: true, color: '#2563EB', fontSize: pdfTheme.fontSize.sm },
        { text: seg.presenter, color: '#1E40AF', fontSize: pdfTheme.fontSize.sm },
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Break type visual distinction (Receso/Almuerzo)
  if (['Receso', 'Almuerzo'].includes(seg.segment_type)) {
    const isLunch = seg.segment_type === 'Almuerzo';
    stack.push({
      text: [
        { text: isLunch ? '🍽️ ' : '☕ ', fontSize: pdfTheme.fontSize.lg },
        { text: `${seg.duration_min || 0} min`, bold: true, color: isLunch ? '#C2410C' : '#374151', fontSize: pdfTheme.fontSize.sm },
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
      fillColor: isLunch ? '#FFF7ED' : '#F3F4F6',
    });
  }

  // Translation - InPerson (on stage)
  if (seg.requires_translation && seg.translation_mode === 'InPerson') {
    const parts = [{ text: '🎙️ TRAD (tarima)', bold: true, color: '#2563EB', fontSize: pdfTheme.fontSize.sm }];
    if (seg.translator_name) {
      parts.push({
        text: `: ${seg.translator_name.substring(0, 25)}`,
        color: '#1E40AF',
        fontSize: pdfTheme.fontSize.xs,
      });
    }
    stack.push({
      text: parts,
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Translation - RemoteBooth (headphones) - displayed separately
  if (seg.requires_translation && seg.translation_mode === 'RemoteBooth') {
    const parts = [{ text: '🎧 CABINA', bold: true, color: '#7C3AED', fontSize: pdfTheme.fontSize.sm }];
    if (seg.translator_name) {
      parts.push({
        text: `: ${seg.translator_name.substring(0, 25)}`,
        color: '#6D28D9',
        fontSize: pdfTheme.fontSize.xs,
      });
    }
    stack.push({
      text: parts,
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Message (Plenaria)
  if (seg.segment_type === 'Plenaria' && seg.message_title) {
    stack.push({
      text: [
        { text: 'MENSAJE: ', bold: true, color: '#1E40AF', fontSize: pdfTheme.fontSize.sm },
        { text: seg.message_title.substring(0, 60), color: '#1E3A8A', fontSize: pdfTheme.fontSize.sm },
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Songs (Alabanza)
  if (seg.segment_type === 'Alabanza' && seg.number_of_songs > 0) {
    stack.push({
      text: 'CANCIONES:',
      bold: true,
      color: '#166534',
      fontSize: pdfTheme.fontSize.sm,
      margin: [0, 0, 0, 0.3],
    });
    for (let i = 1; i <= seg.number_of_songs; i++) {
      const title = seg[`song_${i}_title`];
      if (title) {
        const lead = seg[`song_${i}_lead`];
        stack.push({
          text: [
            { text: `${i}. `, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs },
            { text: title.substring(0, 40), color: pdfTheme.text.primary, fontSize: pdfTheme.fontSize.xs, bold: true },
            lead ? { text: ` (${lead.substring(0, 15)})`, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs, italics: true } : '',
          ],
          margin: [0, 0, 0, 0.2],
        });
      }
    }
  }

  // Video
  if (seg.has_video) {
    stack.push({
      text: [
        { text: 'VIDEO: ', bold: true, color: '#1E40AF', fontSize: pdfTheme.fontSize.sm },
        { text: seg.video_name || '', color: '#1E3A8A', fontSize: pdfTheme.fontSize.xs },
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Artes
  if (seg.segment_type === 'Artes' && Array.isArray(seg.art_types) && seg.art_types.length) {
    const artLabels = seg.art_types.map(t => (t === 'DANCE' ? 'Danza' : t === 'DRAMA' ? 'Drama' : t === 'VIDEO' ? 'Video' : 'Otro')).join(', ');
    stack.push({
      text: [{ text: 'ARTES: ', bold: true, color: '#831843', fontSize: pdfTheme.fontSize.sm }, { text: artLabels, fontSize: pdfTheme.fontSize.sm }],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
    if (seg.art_types.includes('DRAMA')) {
      const dramaParts = [];
      if (seg.drama_handheld_mics > 0) dramaParts.push(`HH: ${seg.drama_handheld_mics}`);
      if (seg.drama_headset_mics > 0) dramaParts.push(`HS: ${seg.drama_headset_mics}`);
      if (dramaParts.length) {
        stack.push({
          text: dramaParts.join(' • '),
          color: pdfTheme.text.secondary,
          fontSize: pdfTheme.fontSize.xs,
          margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
        });
      }
    }
  }

  // Panel
  if (seg.segment_type === 'Panel') {
    if (seg.panel_moderators) {
      stack.push({
        text: [
          { text: 'MOD: ', bold: true, color: '#B45309', fontSize: pdfTheme.fontSize.sm },
          { text: seg.panel_moderators.substring(0, 40), color: '#92400E', fontSize: pdfTheme.fontSize.sm },
        ],
        margin: [0, 0, 0, 0.3],
      });
    }
    if (seg.panel_panelists) {
      stack.push({
        text: [
          { text: 'PAN: ', bold: true, color: '#B45309', fontSize: pdfTheme.fontSize.sm },
          { text: seg.panel_panelists.substring(0, 40), color: '#92400E', fontSize: pdfTheme.fontSize.sm },
        ],
        margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
      });
    }
  }

  const color = getSegmentColor(seg.segment_type);
  return {
    stack: stack.length ? stack : [{ text: '—', fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.muted }],
    verticalAlign: 'top',
    fillColor: color.bg,
  };
}

function buildDetailsRightCell(seg) {
  const stack = [];

  // DURANTE actions ALWAYS go in this center column
  const duringActions = (Array.isArray(seg.segment_actions) ? seg.segment_actions : []).filter(a => a.timing !== 'before_start' && a.department !== 'Hospitality');

  if (duringActions.length > 0) {
    stack.push({
      text: '▶ DURANTE',
      fontSize: pdfTheme.fontSize.sm,
      bold: true,
      color: pdfTheme.labels.durante.text,
      margin: [0, 0, 0, 0.3],
    });
    duringActions.forEach(act => {
      const label = (act.label || '').replace(/^\s*\[[^\]]+\]\s*/, '').substring(0, 45);
      stack.push({
        text: [
          { text: label, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.xs },
          act.offset_min !== undefined ? { text: ` (${act.offset_min}m)`, color: pdfTheme.text.light, fontSize: pdfTheme.fontSize.xs } : '',
        ],
        margin: [0, 0, 0, 0.3],
      });
    });
  }

  return {
    stack: stack.length ? stack : [{ text: '—', fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.muted }],
    verticalAlign: 'top',
  };
}

function buildNotesCell(seg) {
  const stack = [];

  // PREP actions
  const prepActions = (Array.isArray(seg.segment_actions) ? seg.segment_actions : []).filter(a => a.timing === 'before_start' && a.department !== 'Hospitality');

  if (prepActions.length > 0) {
    prepActions.forEach(act => {
      const label = (act.label || '').replace(/^\s*\[[^\]]+\]\s*/, '').substring(0, 40);
      const offset = act.offset_min !== undefined ? `(${act.offset_min}m antes)` : '';
      const dept = act.department ? `[${act.department}]` : '';

      stack.push({
        columns: [
          {
            width: 28,
            stack: [
              {
                text: '⚠ PREP',
                bold: true,
                fontSize: pdfTheme.fontSize.xs,
                color: pdfTheme.labels.prep.badgeText,
                fillColor: pdfTheme.labels.prep.badge,
                alignment: 'center',
                padding: [1, 1, 1, 1],
              },
            ],
          },
          {
            width: '*',
            stack: [
              {
                text: [
                  dept ? { text: `${dept} `, bold: true, fontSize: pdfTheme.fontSize.xs, color: '#92400E' } : '',
                  { text: label, fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.secondary },
                  offset ? { text: ` ${offset}`, fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.light, italics: true } : '',
                ],
                margin: [1, 1, 1, 1],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 0.5],
        fillColor: pdfTheme.labels.prep.bg,
        border: [true, true, true, true],
        borderColor: [pdfTheme.labels.prep.badge, pdfTheme.labels.prep.badge, pdfTheme.labels.prep.badge, pdfTheme.labels.prep.badge],
      });
    });
  }

  // Team notes: SONIDO, TRAD, UJIER, STAGE, VIDEO
  const notes = [
    { label: 'SONIDO', val: seg.sound_notes, style: pdfTheme.labels.sonido },
    { label: 'TRAD', val: seg.translation_notes, style: pdfTheme.labels.trad },
    { label: 'VIDEO', val: seg.video_location || seg.video_name, style: pdfTheme.labels.video },
    { label: 'UJIER', val: seg.ushers_notes, style: pdfTheme.labels.ujier },
    { label: 'STAGE', val: seg.stage_decor_notes, style: pdfTheme.labels.stage },
    { label: 'PROY', val: seg.projection_notes, style: pdfTheme.labels.video },
  ].filter(n => n.val);

  notes.forEach(n => {
    const text = n.val.substring(0, 35);
    stack.push({
      text: [{ text: `${n.label}: `, bold: true, color: n.style.text, fontSize: pdfTheme.fontSize.xs }, { text: text, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.xs }],
      margin: [1, 1, 1, 1],
      fillColor: n.style.bg,
      border: [true, true, true, true],
      borderColor: [n.style.badge, n.style.badge, n.style.badge, n.style.badge],
    });
  });

  return {
    stack: stack.length ? stack : [{ text: '—', fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.muted }],
    verticalAlign: 'top',
    fillColor: pdfTheme.fills.notesCell,
  };
}

// ============================================================================
// TABLE BUILDER — 4-Column Grid
// ============================================================================

function buildDayTable(session, segments) {
  const headerRow = [
    {
      text: 'HORA',
      bold: true,
      fontSize: pdfTheme.fontSize.base,
      color: pdfTheme.text.primary,
      alignment: 'center',
      fillColor: pdfTheme.fills.header,
    },
    {
      text: 'DETALLES',
      bold: true,
      fontSize: pdfTheme.fontSize.base,
      color: pdfTheme.text.primary,
      alignment: 'left',
      colSpan: 2,
      fillColor: pdfTheme.fills.header,
    },
    {}, // Dummy for colSpan
    {
      text: 'NOTAS POR EQUIPO',
      bold: true,
      fontSize: pdfTheme.fontSize.base,
      color: pdfTheme.text.primary,
      alignment: 'left',
      fillColor: pdfTheme.fills.header,
    },
  ];

  const rows = [headerRow];

  segments
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach(seg => {
      rows.push([buildTimeCell(seg), buildDetailsLeftCell(seg), buildDetailsRightCell(seg), buildNotesCell(seg)]);
    });

  return {
    table: {
      widths: [50, '*', 120, 170],
      body: rows,
      headerRows: 1,
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
      vLineWidth: (i, node) => 0.5,
      hLineColor: pdfTheme.borders.color,
      vLineColor: pdfTheme.borders.lightColor,
    },
    margin: [0, 0, 0, 4],
  };
}

// ============================================================================
// DAY HEADER
// ============================================================================

function buildDayHeader(event, session) {
  const dateStr = session?.date ? new Date(session.date).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-') : '';
  const timeStr = session?.planned_start_time ? toESTTimeStr(session.planned_start_time) : '';
  const locStr = session?.location || '';
  const arrivalStr = session?.default_stage_call_offset_min ? `Llegada: ${session.default_stage_call_offset_min} min antes` : '';

  const meta = [dateStr, timeStr, locStr, arrivalStr].filter(x => x).join(' • ');

  return {
    columns: [
      {
        text: [
          { text: (event?.name || 'EVENT').toUpperCase() + ' — ', color: '#1F8A70', bold: true, fontSize: pdfTheme.fontSize.title },
          { text: (session?.name || 'SESSION').toUpperCase(), bold: true, color: pdfTheme.text.primary, fontSize: pdfTheme.fontSize.title },
        ],
      },
      { text: meta, alignment: 'right', color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.header },
    ],
    margin: [0, 0, 0, 4],
  };
}

// ============================================================================
// PRE-SESSION DETAILS BLOCK
// ============================================================================

function buildPreSessionDetailsBlock(preSessionDetails) {
  if (!preSessionDetails) return null;

  const details = [];
  if (preSessionDetails.registration_desk_open_time) {
    details.push(`Registro: ${toESTTimeStr(preSessionDetails.registration_desk_open_time)}`);
  }
  if (preSessionDetails.library_open_time) {
    details.push(`Librería: ${toESTTimeStr(preSessionDetails.library_open_time)}`);
  }

  if (details.length === 0) return null;

  return {
    text: details.join(' • '),
    fontSize: pdfTheme.fontSize.header,
    color: pdfTheme.text.muted,
    margin: [0, 0, 0, 4],
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function generateEventReportPDFClient({ event, sessions, segmentsBySession, preSessionDetailsBySession }) {
  const content = [];

  sessions.forEach((session, idx) => {
    // Day header
    content.push(buildDayHeader(event, session));

    // Pre-session details
    const psd = preSessionDetailsBySession?.[session.id];
    if (psd) {
      const psdBlock = buildPreSessionDetailsBlock(psd);
      if (psdBlock) content.push(psdBlock);
    }

    // Main table
    const allSegs = (segmentsBySession?.[session.id] || []);
    content.push(buildDayTable(session, allSegs));

    // Page break after each session (except last)
    if (idx < sessions.length - 1) {
      content.push({ text: '', pageBreak: 'after' });
    }
  });

  const docDefinition = {
    pageSize: 'LETTER',
    pageOrientation: 'portrait',
    pageMargins: [20, 15, 20, 20],
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
          fontSize: pdfTheme.fontSize.sm,
        },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.sm },
      ],
      margin: [20, 10],
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