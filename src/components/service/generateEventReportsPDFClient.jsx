import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}

const COLORS = {
  alabanza: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC', hex: '#16A34A' },
  plenaria: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', hex: '#1E40AF' },
  artes: { bg: '#FDF2F8', text: '#831843', border: '#F0ABFC', hex: '#BE185D' },
  panel: { bg: '#FFFBEB', text: '#92400E', border: '#FCD34D', hex: '#B45309' },
  video: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', hex: '#2563EB' },
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

function buildDetailedSegments(session, segments) {
  return segments.flatMap((seg, idx) => {
    const items = [];

    // Time header
    const titleParts = [];
    if (seg.start_time) {
      titleParts.push({ text: toESTTimeStr(seg.start_time), bold: true, color: '#111827', fontSize: 10 });
      titleParts.push({ text: '  ', fontSize: 10 });
    }
    titleParts.push({ text: seg.title ? seg.title.toUpperCase() : '—', bold: true, color: '#111827', fontSize: 10.5 });

    const segType = (seg.segment_type || '').toLowerCase();
    const typeColor = COLORS[segType]?.hex || '#6B7280';
    if (seg.segment_type) {
      titleParts.push({ text: `  ${seg.segment_type}  `, color: typeColor, background: '#F3F4F6', fontSize: 7, bold: true });
    }
    if (seg.duration_min) {
      titleParts.push({ text: ` (${seg.duration_min} min)`, color: '#6B7280', fontSize: 9 });
    }
    if (seg.end_time) {
      titleParts.push({ text: `  —  ${toESTTimeStr(seg.end_time)}`, color: '#6B7280', fontSize: 9 });
    }

    items.push({
      text: titleParts,
      margin: [0, idx > 0 ? 4 : 0, 0, 2]
    });

    // Presenter/Leader
    if (seg.presenter) {
      items.push({
        text: [
          { text: 'MINISTRA: ', bold: true, color: '#2563EB', fontSize: 9 },
          { text: seg.presenter, bold: true, color: '#2563EB', fontSize: 10 }
        ],
        margin: [8, 0, 0, 1]
      });
    }

    // Translation badge
    if (seg.requires_translation) {
      const transParts = [{ text: '🎙️ ', fontSize: 9 }];
      transParts.push({ text: 'TRAD', bold: true, color: '#7C3AED', fontSize: 9 });
      if (seg.translation_mode === 'RemoteBooth') {
        transParts.push({ text: ' (Remoto)', color: '#7C3AED', italics: true, fontSize: 8 });
      }
      if (seg.translator_name) {
        transParts.push({ text: `: ${seg.translator_name}`, color: '#7C3AED', fontSize: 8 });
      }
      items.push({
        text: transParts,
        margin: [8, 0, 0, 1]
      });
    }

    // Message title (blue box)
    if (seg.segment_type === 'Plenaria' && seg.message_title) {
      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              {
                text: [
                  { text: 'MENSAJE: ', bold: true, color: '#1E40AF', fontSize: 9 },
                  { text: seg.message_title, color: '#1E3A8A', fontSize: 9 }
                ]
              }
            ],
            fillColor: COLORS.plenaria.bg,
            border: [true, true, true, true],
            borderColor: [COLORS.plenaria.border, COLORS.plenaria.border, COLORS.plenaria.border, COLORS.plenaria.border],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // Songs (green box)
    if (seg.segment_type === 'Alabanza' && seg.number_of_songs > 0) {
      const songStack = [{ text: 'CANCIONES:', bold: true, fontSize: 8.5, color: COLORS.alabanza.text, margin: [0, 0, 0, 2] }];
      for (let i = 1; i <= seg.number_of_songs; i++) {
        const title = seg[`song_${i}_title`];
        const lead = seg[`song_${i}_lead`];
        if (title) {
          songStack.push({
            text: [
              { text: `${i}. `, color: '#6B7280', fontSize: 8.5 },
              { text: title, color: '#0F172A', fontSize: 9, bold: true },
              lead ? { text: ` (${lead})`, color: '#6B7280', fontSize: 8.5, italics: true } : ''
            ],
            margin: [0, 0, 0, 1]
          });
        }
      }
      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: songStack,
            fillColor: COLORS.alabanza.bg,
            border: [true, true, true, true],
            borderColor: [COLORS.alabanza.border, COLORS.alabanza.border, COLORS.alabanza.border, COLORS.alabanza.border],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // Video
    if (seg.has_video) {
      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'VIDEO:', bold: true, color: '#1E40AF', fontSize: 9, margin: [0, 0, 0, 2] },
              {
                text: [
                  seg.video_name || '',
                  seg.video_location ? ` (${seg.video_location})` : '',
                  typeof seg.video_length_sec === 'number' ? ` - ${Math.floor(seg.video_length_sec / 60)}:${String(seg.video_length_sec % 60).padStart(2, '0')}` : '',
                  seg.video_owner ? ` • ${seg.video_owner}` : ''
                ].join(''),
                color: '#1E3A8A',
                fontSize: 8.5
              }
            ],
            fillColor: COLORS.video.bg,
            border: [true, true, true, true],
            borderColor: [COLORS.video.border, COLORS.video.border, COLORS.video.border, COLORS.video.border],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // Artes
    if (seg.segment_type === 'Artes' && Array.isArray(seg.art_types) && seg.art_types.length) {
      const artStack = [
        {
          text: `ARTES: ${seg.art_types.map(t => t === 'DANCE' ? 'Danza' : t === 'DRAMA' ? 'Drama' : t === 'VIDEO' ? 'Video' : 'Otro').join(', ')}`,
          bold: true,
          color: COLORS.artes.text,
          fontSize: 9,
          margin: [0, 0, 0, 2]
        }
      ];

      if (seg.art_types.includes('DRAMA')) {
        const dramaParts = [];
        if (seg.drama_handheld_mics > 0) dramaParts.push(`HH: ${seg.drama_handheld_mics}`);
        if (seg.drama_headset_mics > 0) dramaParts.push(`HS: ${seg.drama_headset_mics}`);
        if (dramaParts.length) {
          artStack.push({ text: dramaParts.join(' • '), color: '#4B5563', fontSize: 8 });
        }
      }
      if (seg.art_types.includes('DANCE') && seg.dance_song_title) {
        artStack.push({ text: seg.dance_song_title, color: '#4B5563', fontSize: 8, margin: [0, 1, 0, 0] });
      }

      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: artStack,
            fillColor: COLORS.artes.bg,
            border: [true, true, true, true],
            borderColor: [COLORS.artes.border, COLORS.artes.border, COLORS.artes.border, COLORS.artes.border],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // Panel
    if (seg.segment_type === 'Panel' && (seg.panel_moderators || seg.panel_panelists)) {
      const panelStack = [];
      if (seg.panel_moderators) {
        panelStack.push({
          text: [
            { text: 'MOD: ', bold: true, color: '#B45309', fontSize: 9 },
            { text: seg.panel_moderators, color: '#92400E', fontSize: 9 }
          ]
        });
      }
      if (seg.panel_panelists) {
        panelStack.push({
          text: [
            { text: 'PAN: ', bold: true, color: '#B45309', fontSize: 9 },
            { text: seg.panel_panelists, color: '#92400E', fontSize: 9 }
          ],
          margin: [0, 1, 0, 0]
        });
      }
      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: panelStack,
            fillColor: COLORS.panel.bg,
            border: [true, true, true, true],
            borderColor: [COLORS.panel.border, COLORS.panel.border, COLORS.panel.border, COLORS.panel.border],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // Prep actions
    const prepActions = Array.isArray(seg.segment_actions) ? seg.segment_actions.filter(a => a.timing === 'before_start' && a.department !== 'Hospitality') : [];
    if (prepActions.length > 0) {
      const prepStack = [{ text: '⚠ PREP', bold: true, color: '#92400E', fontSize: 9, margin: [0, 0, 0, 2] }];
      prepActions.forEach(act => {
        prepStack.push({
          text: [
            { text: (act.label || '').replace(/^\s*\[[^\]]+\]\s*/, '').substring(0, 60), color: '#4B5563', fontSize: 8 },
            act.offset_min !== undefined ? { text: ` (${act.offset_min}m)`, color: '#9CA3AF', fontSize: 7 } : ''
          ]
        });
      });

      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: prepStack,
            fillColor: '#FED7AA',
            border: [true, true, true, true],
            borderColor: ['#FDBA74', '#FDBA74', '#FDBA74', '#FDBA74'],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // During actions
    const duringActions = Array.isArray(seg.segment_actions) ? seg.segment_actions.filter(a => a.timing !== 'before_start' && a.department !== 'Hospitality') : [];
    if (duringActions.length > 0) {
      const duringStack = [{ text: '▶ DURANTE', bold: true, color: '#1E40AF', fontSize: 9, margin: [0, 0, 0, 2] }];
      duringActions.forEach(act => {
        duringStack.push({
          text: (act.label || '').replace(/^\s*\[[^\]]+\]\s*/, '').substring(0, 60),
          color: '#4B5563',
          fontSize: 8
        });
      });

      items.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: duringStack,
            fillColor: '#DBEAFE',
            border: [true, true, true, true],
            borderColor: ['#93C5FD', '#93C5FD', '#93C5FD', '#93C5FD'],
            margin: [4, 4, 4, 4]
          }]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // Team notes
    const notesList = [
      { label: 'SONIDO', val: seg.sound_notes, color: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5' },
      { label: 'PROYECCIÓN', val: seg.projection_notes, color: '#5B21B6', bg: '#F3E8FF', border: '#E9D5FF' },
      { label: 'UJIERES', val: seg.ushers_notes, color: '#166534', bg: '#F0FDF4', border: '#86EFAC' },
      { label: 'STAGE', val: seg.stage_decor_notes, color: '#5B21B6', bg: '#F3E8FF', border: '#E9D5FF' },
      { label: 'TRAD', val: seg.translation_notes, color: '#5B21B6', bg: '#EDE9FE', border: '#DDD6FE' }
    ].filter(n => n.val);

    notesList.forEach((n) => {
      items.push({
        table: {
          widths: ['*'],
          body: [[{
            text: [
              { text: `${n.label}: `, bold: true, color: n.color, fontSize: 8 },
              { text: n.val.substring(0, 100), color: '#4B5563', fontSize: 7.5 }
            ],
            fillColor: n.bg,
            border: [true, true, true, true],
            borderColor: [n.border, n.border, n.border, n.border],
            margin: [4, 3, 4, 3]
          }]]
        },
        margin: [8, 1, 0, 1]
      });
    });

    return items;
  });
}

export async function generateEventReportPDFClient({ event, sessions, segmentsBySession, preSessionDetailsBySession, hospitalityTasksBySession, reportType }) {
  const content = [];

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