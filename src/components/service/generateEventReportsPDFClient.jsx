import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Initialize embedded fonts once (same pattern as weekly/custom generators)
if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}

// Simple ET time formatter: "HH:MM" -> "h:mm AM/PM"
function toESTTimeStr(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '-';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '-';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = (h % 12) || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function headerBand(event, session) {
  return {
    columns: [
      { text: [{ text: event?.name || '', color: '#1F8A70', bold: true }, { text: ' — ' }, { text: session?.name || '', bold: true }], fontSize: 11 },
      { text: [
          session?.date ? session.date : '',
          session?.planned_start_time ? ` • ${toESTTimeStr(session.planned_start_time)}` : '',
          session?.location ? ` • ${session.location}` : ''
        ].join(''), alignment: 'right', color: '#374151', fontSize: 9 }
    ],
    margin: [0, 0, 0, 6]
  };
}

function simpleTable(body, widths) {
  return { table: { widths, body }, layout: 'lightHorizontalLines' };
}

function buildDetailed(session, segments) {
  const body = [[
    { text: 'Hora', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: 'Detalles', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
    { text: 'Notas de equipo', bold: true, fillColor: '#F3F4F6', fontSize: 9 },
  ]];
  segments.forEach(seg => {
    const left = [
      { text: seg.start_time ? toESTTimeStr(seg.start_time) : '-', alignment: 'center' }
    ];
    if (seg.end_time) left.push({ text: toESTTimeStr(seg.end_time), alignment: 'center', color: '#6b7280', fontSize: 7 });
    if (seg.duration_min) left.push({ text: `(${seg.duration_min}m)`, alignment: 'center', fontSize: 7, color: '#6b7280', margin: [0, 2, 0, 0] });

    const details = [];
    if (seg.title) details.push({ text: seg.title, bold: true, fontSize: 10 });
    if (seg.segment_type) details.push({ text: seg.segment_type, fontSize: 8, color: '#374151' });
    if (seg.presenter) details.push({ text: seg.presenter, color: '#2563eb', bold: true, fontSize: 9 });
    if (seg.segment_type === 'Plenaria' && seg.message_title) details.push({ text: `MENSAJE: ${seg.message_title}`, color: '#1d4ed8', bold: true, fontSize: 9, margin: [0, 3, 0, 0] });
    if (seg.segment_type === 'Alabanza' && seg.number_of_songs > 0) {
      const songs = [];
      for (let i = 1; i <= seg.number_of_songs; i++) {
        const t = seg[`song_${i}_title`];
        const l = seg[`song_${i}_lead`];
        if (t) songs.push(`${i}. ${t}${l ? ` (${l})` : ''}`);
      }
      if (songs.length) details.push({ text: `CANCIONES: ${songs.join('  •  ')}`, color: '#166534', bold: true, fontSize: 8, margin: [0, 2, 0, 0] });
    }
    if (seg.has_video) {
      const parts = [];
      if (seg.video_name) parts.push(seg.video_name);
      if (seg.video_location) parts.push(`(${seg.video_location})`);
      if (typeof seg.video_length_sec === 'number') parts.push(`- ${Math.floor(seg.video_length_sec/60)}:${String(seg.video_length_sec%60).padStart(2,'0')}`);
      if (seg.video_owner) parts.push(`• ${seg.video_owner}`);
      details.push({ text: `VIDEO: ${parts.join(' ')}`, color: '#1d4ed8', bold: true, fontSize: 9, margin: [0, 2, 0, 0] });
    }
    if (seg.segment_type === 'Artes' && Array.isArray(seg.art_types) && seg.art_types.length) {
      const at = seg.art_types.map(t => t === 'DANCE' ? 'Danza' : t === 'DRAMA' ? 'Drama' : t === 'VIDEO' ? 'Video' : 'Otro').join(', ');
      details.push({ text: `ARTES: ${at}`, color: '#9d174d', bold: true, fontSize: 9, margin: [0, 2, 0, 0] });
    }
    if (seg.description_details) details.push({ text: seg.description_details, fontSize: 8.5, color: '#374151', margin: [0, 3, 0, 0] });

    const notes = [];
    if (seg.projection_notes) notes.push({ text: `PROYECCIÓN: ${seg.projection_notes}`, color: '#6b21a8', fontSize: 9 });
    if (seg.sound_notes) notes.push({ text: `SONIDO: ${seg.sound_notes}`, color: '#b91c1c', fontSize: 9 });
    if (seg.ushers_notes) notes.push({ text: `UJIERES: ${seg.ushers_notes}`, color: '#166534', fontSize: 9 });
    if (seg.stage_decor_notes) notes.push({ text: `STAGE & DECOR: ${seg.stage_decor_notes}`, color: '#6b21a8', fontSize: 9 });
    if (seg.requires_translation) {
      const extra = [];
      if (seg.translator_name) extra.push(seg.translator_name);
      if (seg.translation_mode === 'RemoteBooth') extra.push('(Remoto)');
      if (seg.translation_notes) extra.push(`- ${seg.translation_notes}`);
      notes.push({ text: `TRADUCCIÓN: ${extra.join(' ')}`, color: '#1d4ed8', fontSize: 9 });
    }

    body.push([{ stack: left }, { stack: details }, { stack: notes.length ? notes : [{ text: '—', color: '#9ca3af' }] }]);
  });
  return simpleTable(body, [60, '*', '*']);
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

    // Optional: Pre-session details block (compact)
    const psd = preSessionDetailsBySession?.[session.id];
    if (psd && (psd.music_profile_id || psd.slide_pack_id || psd.registration_desk_open_time || psd.library_open_time || psd.facility_notes || psd.general_notes)) {
      const rows = [];
      if (psd.music_profile_id) rows.push({ text: `Música: ${psd.music_profile_id}`, margin: [0, 0, 8, 0] });
      if (psd.slide_pack_id) rows.push({ text: `Slides: ${psd.slide_pack_id}`, margin: [0, 0, 8, 0] });
      if (psd.registration_desk_open_time) rows.push({ text: `Registro: ${toESTTimeStr(psd.registration_desk_open_time)}`, margin: [0, 0, 8, 0] });
      if (psd.library_open_time) rows.push({ text: `Librería: ${toESTTimeStr(psd.library_open_time)}`, margin: [0, 0, 8, 0] });
      if (psd.facility_notes) rows.push({ text: `Instalaciones: ${psd.facility_notes}` });
      if (psd.general_notes) rows.push({ text: `General: ${psd.general_notes}` });
      content.push(simpleTable([[{ text: 'Detalles Previos (Segmento 0)', bold: true, color: '#1d4ed8', fontSize: 9 }], [{ stack: rows, fontSize: 8, color: '#374151' }]], ['*']));
    }

    const allSegs = (segmentsBySession?.[session.id] || []).slice().sort((a,b)=> (a.order||0)-(b.order||0));

    if (reportType === 'detailed') {
      content.push(buildDetailed(session, allSegs));
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
    pageMargins: [24, 20, 24, 24],
    defaultStyle: { fontSize: 9, color: '#111827' },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }), color: '#6b7280', fontSize: 8 },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#6b7280', fontSize: 8 },
      ],
      margin: [24, 8],
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