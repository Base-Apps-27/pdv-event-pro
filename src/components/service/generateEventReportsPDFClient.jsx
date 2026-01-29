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

function buildDetailed(session, segments) {
  const body = [[
    { text: 'Hora', bold: true, fontSize: 10, color: '#111827' },
    { text: 'Detalles', bold: true, fontSize: 10, color: '#111827' },
    { text: 'Acciones & Notas', bold: true, fontSize: 10, color: '#111827' },
  ]];

  segments.forEach(seg => {
    const left = [];
    if (seg.start_time) {
      left.push({ text: toESTTimeStr(seg.start_time), bold: true, fontSize: 10, color: '#111827' });
      if (seg.end_time) left.push({ text: toESTTimeStr(seg.end_time), fontSize: 8, color: '#6B7280', margin: [0, 0, 0, 0] });
      if (seg.duration_min) left.push({ text: `(${seg.duration_min}m)`, fontSize: 8, color: '#6B7280', margin: [0, 0, 0, 0] });
    } else {
      left.push({ text: '—', color: '#9CA3AF' });
    }

    const details = [];
    if (seg.title) details.push({ text: seg.title.toUpperCase(), bold: true, fontSize: 9, color: '#111827' });
    
    // Type badge with color
    if (seg.segment_type) {
      const typeColors = { 'Alabanza': '#16A34A', 'Plenaria': '#1D4ED8', 'Artes': '#BE185D', 'Panel': '#92400E', 'Video': '#2563EB' };
      details.push({ text: seg.segment_type, fontSize: 8, color: typeColors[seg.segment_type] || '#374151', bold: true, margin: [0, 0.5, 0, 0] });
    }
    
    if (seg.presenter) details.push({ text: seg.presenter, color: '#2563EB', bold: true, fontSize: 8, margin: [0, 1, 0, 0] });
    
    // Translation badge if needed
    if (seg.requires_translation) {
      const transParts = [];
      if (seg.translation_mode === 'InPerson') transParts.push('🎙️');
      transParts.push('TRAD');
      if (seg.translator_name) transParts.push(seg.translator_name);
      details.push({ text: transParts.join(' '), color: '#7C3AED', bold: true, fontSize: 8, margin: [0, 0.5, 0, 0] });
    }
    
    if (seg.segment_type === 'Plenaria' && seg.message_title) {
      details.push({ text: `MENSAJE: ${seg.message_title}`, color: '#1D4ED8', bold: true, fontSize: 8, margin: [0, 1, 0, 0] });
    }
    
    if (seg.segment_type === 'Alabanza' && seg.number_of_songs > 0) {
      const songs = [];
      for (let i = 1; i <= seg.number_of_songs; i++) {
        const t = seg[`song_${i}_title`];
        const l = seg[`song_${i}_lead`];
        if (t) songs.push(`${i}. ${t}${l ? ` (${l})` : ''}`);
      }
      if (songs.length) {
        details.push({ text: `CANCIONES: ${songs.join(' • ')}`, color: '#16A34A', bold: true, fontSize: 8, margin: [0, 1, 0, 0] });
      }
    }
    
    if (seg.has_video) {
      const parts = [];
      if (seg.video_name) parts.push(seg.video_name);
      if (seg.video_location) parts.push(seg.video_location);
      if (typeof seg.video_length_sec === 'number') {
        const min = Math.floor(seg.video_length_sec / 60);
        const sec = seg.video_length_sec % 60;
        parts.push(`${min}:${String(sec).padStart(2, '0')}`);
      }
      if (seg.video_owner) parts.push(`• ${seg.video_owner}`);
      details.push({ text: `VIDEO: ${parts.filter(x=>x).join(' - ')}`, color: '#2563EB', bold: true, fontSize: 8, margin: [0, 1, 0, 0] });
    }
    
    if (seg.segment_type === 'Artes' && Array.isArray(seg.art_types) && seg.art_types.length) {
      const at = seg.art_types.map(t => t === 'DANCE' ? 'Danza' : t === 'DRAMA' ? 'Drama' : t === 'VIDEO' ? 'Video' : 'Otro').join(', ');
      let artDetail = `ARTES: ${at}`;
      if (seg.art_types.includes('DRAMA')) {
        const parts = [];
        if (seg.drama_handheld_mics > 0) parts.push(`HH: ${seg.drama_handheld_mics}`);
        if (seg.drama_headset_mics > 0) parts.push(`HS: ${seg.drama_headset_mics}`);
        if (parts.length) artDetail += ` • ${parts.join(' • ')}`;
      }
      if (seg.art_types.includes('DANCE')) {
        const parts = [];
        if (seg.dance_has_song && seg.dance_song_title) parts.push(seg.dance_song_title);
        if (seg.dance_handheld_mics > 0) parts.push(`HH: ${seg.dance_handheld_mics}`);
        if (seg.dance_headset_mics > 0) parts.push(`HS: ${seg.dance_headset_mics}`);
        if (parts.length) artDetail += ` • ${parts.join(' • ')}`;
      }
      details.push({ text: artDetail, color: '#BE185D', bold: true, fontSize: 8, margin: [0, 1, 0, 0] });
    }

    if (seg.segment_type === 'Panel' && (seg.panel_moderators || seg.panel_panelists)) {
      const parts = [];
      if (seg.panel_moderators) parts.push(`MOD: ${seg.panel_moderators}`);
      if (seg.panel_panelists) parts.push(`PAN: ${seg.panel_panelists}`);
      details.push({ text: parts.join(' • '), color: '#92400E', bold: true, fontSize: 8, margin: [0, 1, 0, 0] });
    }
    
    if (seg.description_details && seg.segment_type !== 'Panel') {
      details.push({ text: seg.description_details, fontSize: 8, color: '#374151', margin: [0, 1, 0, 0] });
    }

    // Build actions + notes column
    const actionsNotes = [];
    
    // Prep actions
    const prepActions = Array.isArray(seg.segment_actions) ? seg.segment_actions.filter(a => a.timing === 'before_start' && a.department !== 'Hospitality') : [];
    if (prepActions.length > 0) {
      actionsNotes.push({ text: '⚠ PREP', bold: true, color: '#EA580C', fontSize: 8, margin: [0, 0, 0.5, 0] });
      prepActions.forEach(act => {
        const label = (act.label || '').replace(/^\s*\[[^\]]+\]\s*/, '').substring(0, 40);
        const timing = act.offset_min !== undefined ? ` (${act.offset_min}m)` : '';
        actionsNotes.push({ text: `${label}${timing}`, fontSize: 7, color: '#6B7280', margin: [0, 0.5, 0.25, 0] });
      });
    }
    
    // During actions
    const duringActions = Array.isArray(seg.segment_actions) ? seg.segment_actions.filter(a => a.timing !== 'before_start' && a.department !== 'Hospitality') : [];
    if (duringActions.length > 0) {
      if (actionsNotes.length > 0) actionsNotes.push({ text: '', margin: [0, 0.5, 0, 0] });
      actionsNotes.push({ text: '▶ DURANTE', bold: true, color: '#2563EB', fontSize: 8, margin: [0, 0, 0.5, 0] });
      duringActions.forEach(act => {
        const label = (act.label || '').replace(/^\s*\[[^\]]+\]\s*/, '').substring(0, 40);
        actionsNotes.push({ text: label, fontSize: 7, color: '#6B7280', margin: [0, 0.5, 0.25, 0] });
      });
    }

    // Team notes
    const notes = [];
    if (seg.sound_notes) notes.push({ text: `SONIDO: ${seg.sound_notes.substring(0, 60)}`, color: '#DC2626', bold: true, fontSize: 7 });
    if (seg.projection_notes) notes.push({ text: `PROYECCIÓN: ${seg.projection_notes.substring(0, 50)}`, color: '#7C3AED', bold: true, fontSize: 7, margin: [0, notes.length ? 0.5 : 0, 0, 0] });
    if (seg.ushers_notes) notes.push({ text: `UJIERES: ${seg.ushers_notes.substring(0, 50)}`, color: '#16A34A', bold: true, fontSize: 7, margin: [0, notes.length ? 0.5 : 0, 0, 0] });
    if (seg.stage_decor_notes) notes.push({ text: `STAGE: ${seg.stage_decor_notes.substring(0, 50)}`, color: '#7C3AED', bold: true, fontSize: 7, margin: [0, notes.length ? 0.5 : 0, 0, 0] });

    const actionNotesStack = [];
    if (actionsNotes.length > 0) actionNotesStack.push(...actionsNotes);
    if (notes.length > 0) {
      if (actionNotesStack.length > 0) actionNotesStack.push({ text: '', margin: [0, 0.5, 0, 0] });
      actionNotesStack.push(...notes);
    }

    body.push([
      { stack: left, margin: [0, 1, 0, 1] }, 
      { stack: details.length ? details : [{ text: '—', color: '#9CA3AF' }], margin: [0, 1, 0, 1] }, 
      { stack: actionNotesStack.length ? actionNotesStack : [{ text: '—', color: '#9CA3AF' }], margin: [0, 1, 0, 1] }
    ]);
  });

  return simpleTable(body, [70, '*', '*']);
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