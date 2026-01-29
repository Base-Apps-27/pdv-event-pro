import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}

// Color palette by segment type
const SEGMENT_COLORS = {
  alabanza: { hex: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
  bienvenida: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  ofrenda: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  plenaria: { hex: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
  artes: { hex: '#BE185D', bg: '#FDF2F8', border: '#F0ABFC' },
  panel: { hex: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  video: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  dinamica: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  cierre: { hex: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  receso: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  mc: { hex: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  almuerzo: { hex: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  breakout: { hex: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
};

function toESTTimeStr(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '—';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '—';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = (h % 12) || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function getSegmentColor(segmentType) {
  const type = (segmentType || '').toLowerCase().replace(/[áéíóú]/g, a => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[a]));
  return SEGMENT_COLORS[type] || { hex: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' };
}

function buildDetailesColumn(seg) {
  // Right column: Prep, Durante, Team notes (tight stacked)
  const stack = [];

  // Prep actions
  const prepActions = (Array.isArray(seg.segment_actions) ? seg.segment_actions : [])
    .filter(a => a.timing === 'before_start' && a.department !== 'Hospitality');
  
  if (prepActions.length > 0) {
    stack.push({
      text: '⚠ PREP',
      fontSize: 7,
      bold: true,
      color: '#92400E',
      margin: [0, 0, 0, 1]
    });
    prepActions.forEach(act => {
      const label = (act.label || '').replace(/^\s*\[[^\]]+\]\s*/, '').substring(0, 45);
      stack.push({
        text: [
          { text: label, color: '#374151', fontSize: 6.5 },
          act.offset_min !== undefined ? { text: ` (${act.offset_min}m)`, color: '#9CA3AF', fontSize: 6 } : ''
        ],
        margin: [0, 0, 0, 0.5]
      });
    });
  }

  // Durante actions
  const duringActions = (Array.isArray(seg.segment_actions) ? seg.segment_actions : [])
    .filter(a => a.timing !== 'before_start' && a.department !== 'Hospitality');
  
  if (duringActions.length > 0) {
    stack.push({
      text: '▶ DURANTE',
      fontSize: 7,
      bold: true,
      color: '#1E40AF',
      margin: [0, 1, 0, 1]
    });
    duringActions.forEach(act => {
      const label = (act.label || '').replace(/^\s*\[[^\]]+\]\s*/, '').substring(0, 45);
      stack.push({
        text: label,
        color: '#374151',
        fontSize: 6.5,
        margin: [0, 0, 0, 0.5]
      });
    });
  }

  // Team notes (compressed)
  const notes = [
    { label: 'SONIDO:', val: seg.sound_notes, color: '#991B1B' },
    { label: 'PROY:', val: seg.projection_notes, color: '#5B21B6' },
    { label: 'UJIER:', val: seg.ushers_notes, color: '#166534' },
    { label: 'STAGE:', val: seg.stage_decor_notes, color: '#5B21B6' },
    { label: 'TRAD:', val: seg.translation_notes, color: '#5B21B6' }
  ].filter(n => n.val);

  notes.forEach(n => {
    const text = n.val.substring(0, 35);
    stack.push({
      text: [
        { text: `${n.label} `, bold: true, color: n.color, fontSize: 6 },
        { text, color: '#4B5563', fontSize: 6 }
      ],
      margin: [0, 0.5, 0, 0.5]
    });
  });

  return stack.length ? stack : [{ text: '—', fontSize: 6, color: '#D1D5DB' }];
}

function buildDetailsColumn(seg) {
  // Middle column: Title, type, presenter, details
  const stack = [];
  const color = getSegmentColor(seg.segment_type);

  // Title + Type tag + Duration
  const titleParts = [
    { text: seg.title ? seg.title.toUpperCase() : '—', bold: true, color: '#111827', fontSize: 8.5 }
  ];
  
  if (seg.segment_type) {
    titleParts.push({
      text: `  ${seg.segment_type}`,
      color: color.hex,
      background: '#F3F4F6',
      fontSize: 6.5,
      bold: true
    });
  }

  if (seg.duration_min) {
    titleParts.push({
      text: `  (${seg.duration_min}m)`,
      color: '#6B7280',
      fontSize: 7
    });
  }

  stack.push({
    text: titleParts,
    margin: [0, 0, 0, 1]
  });

  // Presenter
  if (seg.presenter) {
    stack.push({
      text: [
        { text: 'MINISTRA: ', bold: true, color: '#2563EB', fontSize: 7 },
        { text: seg.presenter, color: '#1E40AF', fontSize: 7 }
      ],
      margin: [0, 0, 0, 0.5]
    });
  }

  // Translation badge
  if (seg.requires_translation) {
    const transParts = [{ text: '🎙️ TRAD', bold: true, color: '#7C3AED', fontSize: 7 }];
    if (seg.translation_mode === 'RemoteBooth') {
      transParts.push({ text: ' (R)', color: '#7C3AED', fontSize: 6, italics: true });
    }
    if (seg.translator_name) {
      transParts.push({ text: `: ${seg.translator_name.substring(0, 25)}`, color: '#7C3AED', fontSize: 6 });
    }
    stack.push({
      text: transParts,
      margin: [0, 0, 0, 0.5]
    });
  }

  // Message title (Plenaria)
  if (seg.segment_type === 'Plenaria' && seg.message_title) {
    stack.push({
      text: [
        { text: 'MENSAJE: ', bold: true, color: '#1E40AF', fontSize: 7 },
        { text: seg.message_title.substring(0, 50), color: '#1E3A8A', fontSize: 7 }
      ],
      fillColor: color.bg,
      border: [true, true, true, true],
      borderColor: [color.border, color.border, color.border, color.border],
      padding: [1, 1, 1, 1],
      margin: [0, 0.5, 0, 0.5]
    });
  }

  // Songs (Alabanza)
  if (seg.segment_type === 'Alabanza' && seg.number_of_songs > 0) {
    const songs = [];
    songs.push({ text: 'CANCIONES:', bold: true, color: '#166534', fontSize: 6.5, margin: [0, 0, 0, 0.5] });
    for (let i = 1; i <= seg.number_of_songs; i++) {
      const title = seg[`song_${i}_title`];
      if (title) {
        songs.push({
          text: [
            { text: `${i}. `, color: '#6B7280', fontSize: 6 },
            { text: title.substring(0, 40), color: '#0F172A', fontSize: 6.5, bold: true },
            seg[`song_${i}_lead`] ? { text: ` (${seg[`song_${i}_lead`].substring(0, 15)})`, color: '#6B7280', fontSize: 6, italics: true } : ''
          ],
          margin: [0, 0, 0, 0.3]
        });
      }
    }
    if (songs.length > 1) {
      stack.push({
        stack: songs,
        fillColor: color.bg,
        border: [true, true, true, true],
        borderColor: [color.border, color.border, color.border, color.border],
        padding: [1, 1, 1, 1],
        margin: [0, 0.5, 0, 0.5]
      });
    }
  }

  // Video
  if (seg.has_video) {
    stack.push({
      text: [
        { text: 'VIDEO: ', bold: true, color: '#1E40AF', fontSize: 7 },
        { text: seg.video_name || '', color: '#1E3A8A', fontSize: 6.5 },
        seg.video_location ? { text: ` (${seg.video_location.substring(0, 20)})`, color: '#6B7280', fontSize: 6 } : ''
      ],
      fillColor: color.bg,
      border: [true, true, true, true],
      borderColor: [color.border, color.border, color.border, color.border],
      padding: [1, 1, 1, 1],
      margin: [0, 0.5, 0, 0.5]
    });
  }

  // Artes
  if (seg.segment_type === 'Artes' && Array.isArray(seg.art_types) && seg.art_types.length) {
    const arts = [];
    arts.push({
      text: `ARTES: ${seg.art_types.map(t => t === 'DANCE' ? 'Danza' : t === 'DRAMA' ? 'Drama' : t === 'VIDEO' ? 'Video' : 'Otro').join(', ')}`,
      bold: true,
      color: '#831843',
      fontSize: 7,
      margin: [0, 0, 0, 0.5]
    });
    if (seg.art_types.includes('DRAMA')) {
      const dramaParts = [];
      if (seg.drama_handheld_mics > 0) dramaParts.push(`HH: ${seg.drama_handheld_mics}`);
      if (seg.drama_headset_mics > 0) dramaParts.push(`HS: ${seg.drama_headset_mics}`);
      if (dramaParts.length) {
        arts.push({ text: dramaParts.join(' • '), color: '#4B5563', fontSize: 6, margin: [0, 0, 0, 0.3] });
      }
    }
    stack.push({
      stack: arts,
      fillColor: color.bg,
      border: [true, true, true, true],
      borderColor: [color.border, color.border, color.border, color.border],
      padding: [1, 1, 1, 1],
      margin: [0, 0.5, 0, 0.5]
    });
  }

  // Panel
  if (seg.segment_type === 'Panel' && (seg.panel_moderators || seg.panel_panelists)) {
    const panel = [];
    if (seg.panel_moderators) {
      panel.push({
        text: [
          { text: 'MOD: ', bold: true, color: '#B45309', fontSize: 7 },
          { text: seg.panel_moderators.substring(0, 40), color: '#92400E', fontSize: 6.5 }
        ]
      });
    }
    if (seg.panel_panelists) {
      panel.push({
        text: [
          { text: 'PAN: ', bold: true, color: '#B45309', fontSize: 7 },
          { text: seg.panel_panelists.substring(0, 40), color: '#92400E', fontSize: 6.5 }
        ],
        margin: [0, 0.3, 0, 0]
      });
    }
    stack.push({
      stack: panel,
      fillColor: color.bg,
      border: [true, true, true, true],
      borderColor: [color.border, color.border, color.border, color.border],
      padding: [1, 1, 1, 1],
      margin: [0, 0.5, 0, 0]
    });
  }

  return stack;
}

function buildSessionTable(session, segments) {
  // Build 3-column table: time | details | detalles
  const rows = segments
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(seg => {
      const color = getSegmentColor(seg.segment_type);
      return [
        // Column 1: Time
        {
          stack: [
            { text: seg.start_time ? toESTTimeStr(seg.start_time) : '—', bold: true, color: '#111827', fontSize: 8 },
            seg.end_time ? { text: toESTTimeStr(seg.end_time), color: '#6B7280', fontSize: 7, margin: [0, 0.5, 0, 0] } : null
          ].filter(Boolean),
          verticalAlign: 'top',
          fillColor: '#F9FAFB'
        },
        // Column 2: Details (with segment-type background)
        {
          stack: buildDetailsColumn(seg),
          verticalAlign: 'top',
          fillColor: color.bg
        },
        // Column 3: Detalles
        {
          stack: buildDetailesColumn(seg),
          verticalAlign: 'top',
          fillColor: '#F0F1F3'
        }
      ];
    });

  return {
    table: {
      widths: [40, '*', 160],
      body: rows,
      border: [true, true, true, true],
      borderColor: ['#D1D5DB', '#D1D5DB', '#D1D5DB', '#D1D5DB'],
      borderDashArray: null
    },
    margin: [0, 0, 0, 0],
    layout: {
      hLineWidth: (i, node) => 0.5,
      vLineWidth: (i, node) => 0.5,
      hLineColor: '#E5E7EB',
      vLineColor: '#E5E7EB'
    }
  };
}

function headerBand(event, session) {
  const dateStr = session?.date ? new Date(session.date).toLocaleDateString('en-US') : '';
  const timeStr = session?.planned_start_time ? toESTTimeStr(session.planned_start_time) : '';
  const locStr = session?.location || '';
  const meta = [dateStr, timeStr, locStr].filter(x => x).join(' • ');

  return {
    columns: [
      { 
        text: [
          { text: event?.name || '', color: '#1F8A70', bold: true, fontSize: 12 }, 
          { text: ' — ', color: '#111827' }, 
          { text: session?.name || '', bold: true, color: '#111827', fontSize: 12 }
        ]
      },
      { text: meta, alignment: 'right', color: '#6B7280', fontSize: 9 }
    ],
    margin: [0, 0, 0, 6]
  };
}

export async function generateEventReportPDFClient({ event, sessions, segmentsBySession, preSessionDetailsBySession }) {
  const content = [];

  sessions.forEach((session, idx) => {
    // Session header
    content.push(headerBand(event, session));

    // Pre-session details (optional)
    const psd = preSessionDetailsBySession?.[session.id];
    if (psd && (psd.registration_desk_open_time || psd.library_open_time || psd.music_profile_id || psd.general_notes)) {
      const details = [];
      if (psd.registration_desk_open_time) details.push(`Registro: ${toESTTimeStr(psd.registration_desk_open_time)}`);
      if (psd.library_open_time) details.push(`Librería: ${toESTTimeStr(psd.library_open_time)}`);
      if (details.length) {
        content.push({
          text: details.join(' • '),
          fontSize: 8,
          color: '#6B7280',
          margin: [0, 0, 0, 4]
        });
      }
    }

    // Main session table
    const allSegs = (segmentsBySession?.[session.id] || []);
    content.push(buildSessionTable(session, allSegs));

    // Page break after each session (except last)
    if (idx < sessions.length - 1) {
      content.push({ text: '', pageBreak: 'after' });
    }
  });

  const docDefinition = {
    pageSize: 'LETTER',
    pageOrientation: 'portrait',
    pageMargins: [20, 15, 20, 20],
    defaultStyle: { fontSize: 9, color: '#111827', font: 'Roboto' },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }), color: '#6B7280', fontSize: 8 },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#6B7280', fontSize: 8 },
      ],
      margin: [20, 10],
    }),
  };

  const bytes = await new Promise((resolve, reject) => {
    try {
      const pdf = pdfMake.createPdf(docDefinition);
      pdf.getBase64((b64) => {
        try {
          const bin = atob(b64);
          const out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          resolve(out);
        } catch (e) { reject(e); }
      });
    } catch (err) {
      reject(err);
    }
  });

  return bytes;
}