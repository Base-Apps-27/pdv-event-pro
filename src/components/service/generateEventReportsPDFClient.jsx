import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}

// Color palette matching report view
const COLORS = {
  alabanza: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  plenaria: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  artes: { bg: '#fbf0f9', text: '#831843', border: '#f0abfc' },
  panel: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  video: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  sound: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  projection: { bg: '#f3e8ff', text: '#5b21b6', border: '#e9d5ff' },
  ushers: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  translation: { bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe' },
  stage: { bg: '#f3e8ff', text: '#5b21b6', border: '#e9d5ff' },
  prep: { bg: '#fed7aa', text: '#92400e', border: '#fdba74' },
  durante: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
};

function toESTTimeStr(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '-';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '-';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = (h % 12) || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function headerBand(event, session) {
  const dateStr = session?.date || '';
  const timeStr = session?.planned_start_time ? toESTTimeStr(session.planned_start_time) : '';
  const locStr = session?.location || '';
  const meta = [dateStr, timeStr, locStr].filter(x => x).join(' • ');

  return {
    columns: [
      { 
        text: [
          { text: event?.name || '', color: '#1F8A70', bold: true }, 
          { text: ' — ', color: '#111827' }, 
          { text: session?.name || '', bold: true, color: '#111827' }
        ], 
        fontSize: 12 
      },
      { text: meta, alignment: 'right', color: '#6B7280', fontSize: 10 }
    ],
    margin: [0, 0, 0, 10]
  };
}

function simpleTable(body, widths) {
  return { 
    table: { widths, body, headerRows: 1 }, 
    layout: {
      fillColor: (rowIndex) => rowIndex === 0 ? '#F3F4F6' : null,
      hLineWidth: (i, node) => i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#E5E7EB',
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 2,
      paddingBottom: () => 2
    }
  };
}

function buildDetailedSegments(session, segments) {
  // Build as block-style layout (like print view) instead of table
  return segments.map((seg, idx) => [
    // Time column
    {
      columns: [
        {
          width: 70,
          stack: [
            { text: seg.start_time ? toESTTimeStr(seg.start_time) : '—', bold: true, fontSize: 10, color: '#111827' },
            seg.end_time ? { text: toESTTimeStr(seg.end_time), fontSize: 8, color: '#6B7280', margin: [0, 2, 0, 0] } : null,
            seg.duration_min ? { text: `(${seg.duration_min}m)`, fontSize: 8, color: '#6B7280', margin: [0, 2, 0, 0] } : null,
          ].filter(Boolean)
        },
        { width: '*', text: '' },
      ]
    },

    // Main segment box (left column)
    {
      columns: [
        {
          width: '*',
          stack: [
            // Title + type
            {
              text: seg.title ? seg.title.toUpperCase() : '—',
              bold: true,
              fontSize: 9,
              color: '#111827',
              margin: [0, 0, 0, 3]
            },
            seg.segment_type ? {
              text: seg.segment_type,
              fontSize: 8,
              bold: true,
              color: COLORS[seg.segment_type.toLowerCase()] ? COLORS[seg.segment_type.toLowerCase()].text : '#374151',
              margin: [0, 0, 0, 2]
            } : null,
            seg.presenter ? {
              text: seg.presenter,
              fontSize: 8,
              color: '#2563EB',
              bold: true,
              margin: [0, 0, 0, 2]
            } : null,
            seg.requires_translation ? {
              text: `🎙️ TRAD${seg.translator_name ? ': ' + seg.translator_name : ''}${seg.translation_mode === 'RemoteBooth' ? ' (Remoto)' : ''}`,
              fontSize: 8,
              color: '#7C3AED',
              bold: true,
              margin: [0, 0, 0, 2]
            } : null,
            
            // Message title
            seg.segment_type === 'Plenaria' && seg.message_title ? {
              text: `MENSAJE: ${seg.message_title}`,
              fontSize: 8,
              color: '#1D4ED8',
              bold: true,
              margin: [0, 2, 0, 0],
              fillColor: COLORS.plenaria.bg,
              border: [1, 1, 1, 1],
              borderColor: COLORS.plenaria.border,
              padding: [2, 2, 2, 2]
            } : null,

            // Songs
            seg.segment_type === 'Alabanza' && seg.number_of_songs > 0 ? {
              stack: [
                { text: 'CANCIONES:', fontSize: 8, bold: true, color: COLORS.alabanza.text },
                ...Array.from({ length: seg.number_of_songs }, (_, i) => {
                  const t = seg[`song_${i + 1}_title`];
                  const l = seg[`song_${i + 1}_lead`];
                  return t ? { text: `${i + 1}. ${t}${l ? ` (${l})` : ''}`, fontSize: 8, color: '#374151', margin: [0, 1, 0, 0] } : null;
                }).filter(Boolean)
              ],
              fillColor: COLORS.alabanza.bg,
              border: [1, 1, 1, 1],
              borderColor: COLORS.alabanza.border,
              padding: [2, 2, 2, 2],
              margin: [0, 2, 0, 0]
            } : null,

            // Video
            seg.has_video ? {
              stack: [
                { text: 'VIDEO:', fontSize: 8, bold: true, color: '#1e40af' },
                {
                  text: [
                    seg.video_name || '',
                    seg.video_location ? ` (${seg.video_location})` : '',
                    typeof seg.video_length_sec === 'number' ? ` - ${Math.floor(seg.video_length_sec / 60)}:${String(seg.video_length_sec % 60).padStart(2, '0')}` : '',
                    seg.video_owner ? ` • ${seg.video_owner}` : ''
                  ].join(''),
                  fontSize: 8,
                  color: '#374151'
                }
              ],
              fillColor: COLORS.video.bg,
              border: [1, 1, 1, 1],
              borderColor: COLORS.video.border,
              padding: [2, 2, 2, 2],
              margin: [0, 2, 0, 0]
            } : null,

            // Artes
            seg.segment_type === 'Artes' && Array.isArray(seg.art_types) && seg.art_types.length ? {
              stack: [
                {
                  text: `ARTES: ${seg.art_types.map(t => t === 'DANCE' ? 'Danza' : t === 'DRAMA' ? 'Drama' : t === 'VIDEO' ? 'Video' : 'Otro').join(', ')}`,
                  fontSize: 8,
                  bold: true,
                  color: COLORS.artes.text,
                  margin: [0, 0, 0, 1]
                },
                seg.art_types.includes('DRAMA') ? {
                  text: [
                    seg.drama_handheld_mics > 0 ? `HH: ${seg.drama_handheld_mics} • ` : '',
                    seg.drama_headset_mics > 0 ? `HS: ${seg.drama_headset_mics}` : ''
                  ].join(''),
                  fontSize: 7,
                  color: '#374151'
                } : null,
                seg.art_types.includes('DANCE') && seg.dance_song_title ? {
                  text: seg.dance_song_title,
                  fontSize: 7,
                  color: '#374151'
                } : null
              ].filter(Boolean),
              fillColor: COLORS.artes.bg,
              border: [1, 1, 1, 1],
              borderColor: COLORS.artes.border,
              padding: [2, 2, 2, 2],
              margin: [0, 2, 0, 0]
            } : null,

            // Panel
            seg.segment_type === 'Panel' && (seg.panel_moderators || seg.panel_panelists) ? {
              stack: [
                seg.panel_moderators ? { text: `MOD: ${seg.panel_moderators}`, fontSize: 8, color: '#374151' } : null,
                seg.panel_panelists ? { text: `PAN: ${seg.panel_panelists}`, fontSize: 8, color: '#374151', margin: [0, 1, 0, 0] } : null
              ].filter(Boolean),
              fillColor: COLORS.panel.bg,
              border: [1, 1, 1, 1],
              borderColor: COLORS.panel.border,
              padding: [2, 2, 2, 2],
              margin: [0, 2, 0, 0]
            } : null,

            seg.description_details && seg.segment_type !== 'Panel' ? {
              text: seg.description_details,
              fontSize: 8,
              color: '#374151',
              margin: [0, 2, 0, 0]
            } : null
          ].filter(Boolean),
          margin: [0, 2, 0, 2]
        },

        // Right column: prep/durante actions + team notes
        {
          width: 200,
          stack: (() => {
            const stack = [];
            const prepActions = Array.isArray(seg.segment_actions) ? seg.segment_actions.filter(a => a.timing === 'before_start') : [];
            const duringActions = Array.isArray(seg.segment_actions) ? seg.segment_actions.filter(a => a.timing !== 'before_start') : [];

            // Prep
            if (prepActions.length > 0) {
              stack.push({
                text: '⚠ PREP',
                fontSize: 8,
                bold: true,
                color: COLORS.prep.text,
                fillColor: COLORS.prep.bg,
                padding: [2, 2, 2, 2],
                margin: [0, 0, 2, 0]
              });
              prepActions.forEach(a => {
                stack.push({
                  text: `${(a.label || '').replace(/^\s*\[[^\]]+\]\s*/, '').substring(0, 50)}${a.offset_min !== undefined ? ` (${a.offset_min}m)` : ''}`,
                  fontSize: 7,
                  color: '#374151',
                  margin: [0, 0, 1, 0]
                });
              });
            }

            // During
            if (duringActions.length > 0) {
              stack.push({
                text: '▶ DURANTE',
                fontSize: 8,
                bold: true,
                color: COLORS.durante.text,
                fillColor: COLORS.durante.bg,
                padding: [2, 2, 2, 2],
                margin: [0, 0, 2, 0]
              });
              duringActions.forEach(a => {
                stack.push({
                  text: (a.label || '').replace(/^\s*\[[^\]]+\]\s*/, '').substring(0, 50),
                  fontSize: 7,
                  color: '#374151',
                  margin: [0, 0, 1, 0]
                });
              });
            }

            // Team notes
            const notes = [];
            if (seg.sound_notes) notes.push({ label: 'SONIDO:', text: seg.sound_notes, color: COLORS.sound });
            if (seg.projection_notes) notes.push({ label: 'PROYECCIÓN:', text: seg.projection_notes, color: COLORS.projection });
            if (seg.ushers_notes) notes.push({ label: 'UJIERES:', text: seg.ushers_notes, color: COLORS.ushers });
            if (seg.stage_decor_notes) notes.push({ label: 'STAGE:', text: seg.stage_decor_notes, color: COLORS.stage });
            if (seg.requires_translation && seg.translation_notes) notes.push({ label: 'TRAD:', text: seg.translation_notes, color: COLORS.translation });

            notes.forEach((n, ni) => {
              stack.push({
                text: [
                  { text: n.label, bold: true, color: n.color.text },
                  ' ',
                  n.text.substring(0, 40)
                ],
                fontSize: 7,
                color: '#374151',
                fillColor: n.color.bg,
                border: [1, 1, 1, 1],
                borderColor: n.color.border,
                padding: [1.5, 2, 1.5, 2],
                margin: [0, 0, ni < notes.length - 1 ? 1 : 0, 0]
              });
            });

            return stack.length ? stack : [{ text: '—', fontSize: 8, color: '#9CA3AF' }];
          })(),
          margin: [0, 2, 0, 2]
        }
      ]
    },

    // Spacer between segments
    { text: '', margin: [0, 2, 0, 0] }
  ]);
}

function buildSimple(session, segments, columnTitle, selector) {
  const body = [[
    { text: 'Hora', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: 'Título', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: columnTitle, bold: true, fillColor: '#F3F4F6', fontSize: 9 },
  ]];
  segments.forEach(seg => {
    body.push([
      { text: seg.start_time ? toESTTimeStr(seg.start_time) : '-', fontSize: 9 },
      { text: seg.title || '', bold: true, fontSize: 10 },
      { text: seg[selector] || '—', fontSize: 9 },
    ]);
  });
  return simpleTable(body, [70, 200, '*']);
}

function buildGeneral(session, segments) {
  const body = [[
    { text: 'Hora', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: 'Título', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: 'Responsable', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: 'Duración', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
  ]];
  segments.forEach(seg => {
    body.push([
      { text: seg.start_time ? toESTTimeStr(seg.start_time) : '-', fontSize: 9 },
      { text: seg.title || '—', bold: true, fontSize: 10 },
      { text: seg.presenter || '—', fontSize: 9 },
      { text: seg.duration_min ? `${seg.duration_min} min` : '—', fontSize: 9 },
    ]);
  });
  return simpleTable(body, [70, '*', 180, 70]);
}

function buildHospitality(tasks) {
  const body = [[
    { text: 'Tiempo', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: 'Categoría', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: 'Descripción', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: 'Ubicación', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: 'Notas', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
  ]];
  tasks.forEach(t => {
    body.push([
      t.time_hint || '—',
      t.category || '—',
      t.description || '—',
      t.location_notes || '—',
      t.notes || '—',
    ]);
  });
  return simpleTable(body, [70, 80, '*', 120, 120]);
}

export async function generateEventReportPDFClient({ event, sessions, segmentsBySession, preSessionDetailsBySession, hospitalityTasksBySession, reportType }) {
  const content = [];

  // Per-session rendering, one session per page
  sessions.forEach((session, idx) => {
    content.push(headerBand(event, session));

    // Optional: Pre-session details block
    const psd = preSessionDetailsBySession?.[session.id];
    if (psd && (psd.music_profile_id || psd.slide_pack_id || psd.registration_desk_open_time || psd.library_open_time || psd.facility_notes || psd.general_notes)) {
      content.push({
        text: 'Detalles Previos (Segmento 0)',
        fontSize: 11,
        bold: true,
        color: '#2563EB',
        decoration: 'underline',
        margin: [0, 0, 0, 4]
      });
      const rows = [];
      if (psd.registration_desk_open_time) rows.push({ text: `Registro: ${toESTTimeStr(psd.registration_desk_open_time)}`, fontSize: 9, color: '#374151' });
      if (psd.library_open_time) rows.push({ text: `Librería: ${toESTTimeStr(psd.library_open_time)}`, fontSize: 9, color: '#374151', margin: [0, 1, 0, 0] });
      if (psd.music_profile_id) rows.push({ text: `Música: ${psd.music_profile_id}`, fontSize: 9, color: '#374151', margin: [0, 1, 0, 0] });
      if (psd.slide_pack_id) rows.push({ text: `Slides: ${psd.slide_pack_id}`, fontSize: 9, color: '#374151', margin: [0, 1, 0, 0] });
      if (psd.facility_notes) rows.push({ text: `Instalaciones: ${psd.facility_notes}`, fontSize: 9, color: '#374151', margin: [0, 1, 0, 0] });
      if (psd.general_notes) rows.push({ text: `General: ${psd.general_notes}`, fontSize: 9, color: '#374151', margin: [0, 1, 0, 0] });
      content.push({ stack: rows, margin: [0, 0, 0, 8] });
    }

    const allSegs = (segmentsBySession?.[session.id] || []).slice().sort((a,b)=> (a.order||0)-(b.order||0));

    if (reportType === 'detailed') {
      content.push(...buildDetailedSegments(session, allSegs));
    } else if (reportType === 'projection') {
      const filtered = allSegs.filter(s => s.show_in_projection !== false);
      content.push(buildSimple(session, filtered, 'Notas Proyección', 'projection_notes'));
    } else if (reportType === 'sound') {
      const filtered = allSegs.filter(s => s.show_in_sound !== false);
      content.push(buildSimple(session, filtered, 'Notas Sonido', 'sound_notes'));
    } else if (reportType === 'ushers') {
      const filtered = allSegs.filter(s => s.show_in_ushers !== false);
      content.push(buildSimple(session, filtered, 'Notas Ujieres', 'ushers_notes'));
    } else if (reportType === 'hospitality') {
      const tasks = (hospitalityTasksBySession?.[session.id] || []).slice().sort((a,b)=> (a.order||0)-(b.order||0));
      content.push(buildHospitality(tasks));
    } else if (reportType === 'general') {
      const filtered = allSegs.filter(s => s.show_in_general !== false);
      content.push(buildGeneral(session, filtered));
    }

    if (idx < sessions.length - 1) {
      content.push({ text: '', pageBreak: 'after' });
    }
  });

  const docDefinition = {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [30, 24, 30, 30],
    defaultStyle: { fontSize: 10, color: '#111827', font: 'Roboto' },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }), color: '#6B7280', fontSize: 9 },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#6B7280', fontSize: 9 },
      ],
      margin: [30, 12],
    }),
  };

  // Create PDF and return Uint8Array for consistent download handling
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