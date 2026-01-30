import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { pdfTheme, getSegmentColor, toESTTimeStr } from './pdfThemeSystem';

// Initialize pdfMake fonts
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

// ============================================================================
// CONSTANTS - HTML Print-Matching Layout
// ============================================================================

// LETTER landscape: 11" x 8.5" = 792 x 612 pts
// With 18pt margins on each side: usable width = 792 - 36 = 756pt
const COL_TIME = 50;      // Narrow time column
const COL_NOTES = 220;    // Notes sidebar (narrower than details)
const COL_DETAILS = '*';  // Details gets remaining space (~486pt)

// Muted label color (matches HTML's text-gray-600/700)
const LABEL_COLOR = '#6B7280';
const TEXT_COLOR = '#111827';
const MUTED_COLOR = '#9CA3AF';

// Zebra striping colors
const ROW_WHITE = '#FFFFFF';
const ROW_GRAY = '#F9FAFB';

// ============================================================================
// HELPER: Build inline label:value text runs (HTML print style)
// ============================================================================

function labelValue(label, value, labelColor = LABEL_COLOR) {
  if (!value) return null;
  return [
    { text: `${label}: `, bold: true, color: labelColor, fontSize: 6.5 },
    { text: value, color: TEXT_COLOR, fontSize: 6.5 },
  ];
}

// ============================================================================
// TIME CELL - Compact, matches HTML
// ============================================================================

function buildTimeCell(seg, rowIndex) {
  const fill = rowIndex % 2 === 0 ? ROW_WHITE : ROW_GRAY;
  const parts = [];

  // Start time (bold)
  parts.push({
    text: seg.start_time ? toESTTimeStr(seg.start_time) : '—',
    bold: true,
    fontSize: 7.5,
    color: TEXT_COLOR,
  });

  // End time (muted, same line or below)
  if (seg.end_time) {
    parts.push({
      text: `\n${toESTTimeStr(seg.end_time)}`,
      fontSize: 6.5,
      color: MUTED_COLOR,
    });
  }

  // Duration
  if (seg.duration_min) {
    parts.push({
      text: `\n(${seg.duration_min}m)`,
      fontSize: 6,
      color: MUTED_COLOR,
    });
  }

  // Translation indicator (text-based, no emoji font needed)
  if (seg.requires_translation) {
    const mode = seg.translation_mode === 'InPerson' ? 'T' : 'C';
    parts.push({
      text: `\n[${mode}]`,
      fontSize: 6,
      color: '#7C3AED',
      bold: true,
    });
  }

  return {
    text: parts,
    fillColor: fill,
  };
}

// ============================================================================
// DETAILS CELL - Compact inline text, matches HTML SegmentReportRow
// ============================================================================

function buildDetailsCell(seg, rowIndex, allRooms = []) {
  const fill = rowIndex % 2 === 0 ? ROW_WHITE : ROW_GRAY;
  const lines = [];

  // Line 1: TITLE (Type) - inline type in muted gray
  const titleLine = [
    { text: (seg.title || '—').toUpperCase(), bold: true, fontSize: 7.5, color: TEXT_COLOR },
  ];
  if (seg.segment_type) {
    titleLine.push({ text: ` (${seg.segment_type})`, fontSize: 6.5, color: MUTED_COLOR });
  }
  lines.push({ text: titleLine, margin: [0, 0, 0, 1] });

  // Presenter (blue accent for names)
  if (seg.presenter) {
    const label = ['Break', 'Receso', 'Almuerzo'].includes(seg.segment_type) ? 'Encargado' : 'Ministra';
    lines.push({
      text: [
        { text: `${label}: `, bold: true, fontSize: 6.5, color: LABEL_COLOR },
        { text: seg.presenter, fontSize: 6.5, color: '#2563EB' },
      ],
      margin: [0, 0, 0, 1],
    });
  }

  // Break visual (Receso/Almuerzo)
  if (['Receso', 'Almuerzo'].includes(seg.segment_type)) {
    const icon = seg.segment_type === 'Almuerzo' ? '[Almuerzo]' : '[Receso]';
    lines.push({
      text: `${icon} ${seg.duration_min || 0} min`,
      fontSize: 6.5,
      color: seg.segment_type === 'Almuerzo' ? '#C2410C' : LABEL_COLOR,
      bold: true,
      margin: [0, 0, 0, 1],
    });
  }

  // Translation info
  if (seg.requires_translation) {
    const mode = seg.translation_mode === 'InPerson' ? 'TRAD-TARIMA' : 'TRAD-CABINA';
    const translatorText = seg.translator_name ? `: ${seg.translator_name}` : '';
    lines.push({
      text: [
        { text: `${mode}`, bold: true, fontSize: 6.5, color: '#7C3AED' },
        { text: translatorText, fontSize: 6.5, color: '#7C3AED' },
      ],
      margin: [0, 0, 0, 1],
    });
  }

  // Songs (Alabanza) - compact bullet list
  if (seg.segment_type === 'Alabanza' && seg.number_of_songs > 0) {
    const songParts = [{ text: 'Canciones: ', bold: true, fontSize: 6.5, color: '#166534' }];
    const songList = [];
    for (let i = 1; i <= Math.min(seg.number_of_songs, 6); i++) {
      const title = seg[`song_${i}_title`];
      if (title) {
        const lead = seg[`song_${i}_lead`] ? ` (${seg[`song_${i}_lead`]})` : '';
        const key = seg[`song_${i}_key`] ? ` [${seg[`song_${i}_key`]}]` : '';
        songList.push(`${i}. ${title}${lead}${key}`);
      }
    }
    songParts.push({ text: songList.join(' • '), fontSize: 6.5, color: TEXT_COLOR });
    lines.push({ text: songParts, margin: [0, 0, 0, 1] });
  }

  // Message title (Plenaria)
  if (seg.segment_type === 'Plenaria' && seg.message_title) {
    const lv = labelValue('Mensaje', `"${seg.message_title}"`, '#1E40AF');
    if (lv) lines.push({ text: lv, margin: [0, 0, 0, 1] });
  }

  // Scripture references
  if (seg.scripture_references) {
    const lv = labelValue('Citas', seg.scripture_references, '#1E40AF');
    if (lv) lines.push({ text: lv, margin: [0, 0, 0, 1] });
  }

  // Video info
  if (seg.has_video) {
    const videoParts = [{ text: 'Video: ', bold: true, fontSize: 6.5, color: '#1E40AF' }];
    const details = [];
    if (seg.video_name) details.push(seg.video_name);
    if (seg.video_length_sec) {
      const mins = Math.floor(seg.video_length_sec / 60);
      const secs = seg.video_length_sec % 60;
      details.push(`${mins}:${String(secs).padStart(2, '0')}`);
    }
    if (seg.video_location) details.push(seg.video_location);
    if (seg.video_owner) details.push(seg.video_owner);
    videoParts.push({ text: details.join(' • '), fontSize: 6.5, color: TEXT_COLOR });
    lines.push({ text: videoParts, margin: [0, 0, 0, 1] });
  }

  // Panel (moderators/panelists)
  if (seg.segment_type === 'Panel') {
    if (seg.panel_moderators) {
      const lv = labelValue('Mod', seg.panel_moderators, '#B45309');
      if (lv) lines.push({ text: lv, margin: [0, 0, 0, 1] });
    }
    if (seg.panel_panelists) {
      const lv = labelValue('Pan', seg.panel_panelists, '#B45309');
      if (lv) lines.push({ text: lv, margin: [0, 0, 0, 1] });
    }
  }

  // Artes
  if (seg.segment_type === 'Artes' && Array.isArray(seg.art_types) && seg.art_types.length) {
    const artLabels = seg.art_types.map(t => 
      t === 'DANCE' ? 'Danza' : t === 'DRAMA' ? 'Drama' : t === 'VIDEO' ? 'Video' : 'Otro'
    ).join(', ');
    lines.push({
      text: [
        { text: 'Artes: ', bold: true, fontSize: 6.5, color: '#BE185D' },
        { text: artLabels, fontSize: 6.5, color: TEXT_COLOR },
      ],
      margin: [0, 0, 0, 1],
    });

    // Drama details
    if (seg.art_types.includes('DRAMA')) {
      const dramaParts = [];
      if (seg.drama_handheld_mics > 0) dramaParts.push(`Mano: ${seg.drama_handheld_mics}`);
      if (seg.drama_headset_mics > 0) dramaParts.push(`Headset: ${seg.drama_headset_mics}`);
      if (seg.drama_start_cue) dramaParts.push(`Inicio: ${seg.drama_start_cue}`);
      if (seg.drama_end_cue) dramaParts.push(`Fin: ${seg.drama_end_cue}`);
      if (seg.drama_has_song && seg.drama_song_title) dramaParts.push(`Canción: ${seg.drama_song_title}`);
      if (dramaParts.length) {
        lines.push({ text: `  ${dramaParts.join(' • ')}`, fontSize: 6, color: MUTED_COLOR, margin: [0, 0, 0, 1] });
      }
    }

    // Dance details
    if (seg.art_types.includes('DANCE')) {
      const danceParts = [];
      if (seg.dance_has_song && seg.dance_song_title) danceParts.push(`Música: ${seg.dance_song_title}`);
      if (seg.dance_handheld_mics > 0) danceParts.push(`Mano: ${seg.dance_handheld_mics}`);
      if (seg.dance_headset_mics > 0) danceParts.push(`Headset: ${seg.dance_headset_mics}`);
      if (danceParts.length) {
        lines.push({ text: `  ${danceParts.join(' • ')}`, fontSize: 6, color: MUTED_COLOR, margin: [0, 0, 0, 1] });
      }
    }

    if (seg.art_types.includes('OTHER') && seg.art_other_description) {
      lines.push({ text: `  ${seg.art_other_description}`, fontSize: 6, color: MUTED_COLOR, margin: [0, 0, 0, 1] });
    }
  }

  // Breakout Rooms - compact list
  if (seg.segment_type === 'Breakout' && Array.isArray(seg.breakout_rooms) && seg.breakout_rooms.length > 0) {
    seg.breakout_rooms.forEach((room, idx) => {
      const roomName = room.room_id && allRooms.length
        ? (allRooms.find(r => r.id === room.room_id)?.name || `Sala ${idx + 1}`)
        : `Sala ${idx + 1}`;
      
      const roomParts = [`[${roomName}]`];
      if (room.topic) roomParts.push(`"${room.topic}"`);
      if (room.hosts) roomParts.push(`Anfitrión: ${room.hosts}`);
      if (room.speakers) roomParts.push(`Presentador: ${room.speakers}`);
      if (room.requires_translation) {
        const mode = room.translation_mode === 'InPerson' ? 'Tarima' : 'Cabina';
        roomParts.push(`Trad: ${mode}${room.translator_name ? ` (${room.translator_name})` : ''}`);
      }
      
      lines.push({
        text: roomParts.join(' • '),
        fontSize: 6,
        color: TEXT_COLOR,
        margin: [0, 0, 0, 1],
      });
      
      if (room.general_notes) {
        lines.push({ text: `  ${room.general_notes}`, fontSize: 6, color: MUTED_COLOR, italics: true, margin: [0, 0, 0, 1] });
      }
      if (room.other_notes) {
        lines.push({ text: `  ${room.other_notes}`, fontSize: 6, color: MUTED_COLOR, margin: [0, 0, 0, 1] });
      }
    });
  }

  // Prep instructions
  if (seg.prep_instructions) {
    lines.push({
      text: [
        { text: 'Prep: ', bold: true, fontSize: 6.5, color: '#B45309' },
        { text: seg.prep_instructions, fontSize: 6.5, color: TEXT_COLOR, italics: true },
      ],
      margin: [0, 0, 0, 1],
    });
  }

  // Description details
  if (seg.description_details) {
    lines.push({
      text: seg.description_details,
      fontSize: 6,
      color: MUTED_COLOR,
      italics: true,
      margin: [0, 0, 0, 1],
    });
  }

  // DURANTE actions (inline in details, not separate column)
  const duringActions = (Array.isArray(seg.segment_actions) ? seg.segment_actions : [])
    .filter(a => a.timing !== 'before_start');
  
  if (duringActions.length > 0) {
    lines.push({
      text: '▶ DURANTE',
      bold: true,
      fontSize: 6,
      color: '#1E40AF',
      margin: [0, 2, 0, 1],
    });
    duringActions.forEach(act => {
      const parts = [];
      if (act.department) parts.push(`[${act.department}]`);
      parts.push(act.label || '');
      if (act.is_required) parts.push('*');
      if (act.timing === 'after_start' && act.offset_min !== undefined) parts.push(`(${act.offset_min}m después)`);
      if (act.timing === 'before_end' && act.offset_min !== undefined) parts.push(`(${act.offset_min}m antes fin)`);
      if (act.notes) parts.push(`— ${act.notes}`);
      
      lines.push({
        text: parts.join(' '),
        fontSize: 6,
        color: TEXT_COLOR,
        margin: [0, 0, 0, 0.5],
      });
    });
  }

  return {
    stack: lines.length ? lines : [{ text: '—', fontSize: 6.5, color: MUTED_COLOR }],
    fillColor: fill,
  };
}

// ============================================================================
// NOTES CELL - Compact sidebar, muted labels
// ============================================================================

function buildNotesCell(seg, rowIndex) {
  const fill = rowIndex % 2 === 0 ? ROW_WHITE : ROW_GRAY;
  const lines = [];

  // All team notes with muted inline labels (matching HTML)
  const noteItems = [
    { label: 'PROYECCIÓN', val: seg.projection_notes },
    { label: 'SONIDO', val: seg.sound_notes },
    { label: 'MICS', val: seg.microphone_assignments },
    { label: 'UJIERES', val: seg.ushers_notes },
    { label: 'STAGE', val: seg.stage_decor_notes },
    { label: 'TRAD', val: seg.translation_notes },
    { label: 'OTRO', val: seg.other_notes },
  ].filter(n => n.val);

  noteItems.forEach(n => {
    lines.push({
      text: [
        { text: `${n.label}: `, bold: true, fontSize: 6, color: LABEL_COLOR },
        { text: n.val, fontSize: 6, color: TEXT_COLOR },
      ],
      margin: [0, 0, 0, 1],
    });
  });

  // Video timecode in notes if present
  if (seg.has_video && seg.video_length_sec) {
    const mins = Math.floor(seg.video_length_sec / 60);
    const secs = seg.video_length_sec % 60;
    lines.push({
      text: [
        { text: 'VIDEO: ', bold: true, fontSize: 6, color: LABEL_COLOR },
        { text: `[${mins}:${String(secs).padStart(2, '0')}]`, fontSize: 6, color: '#6B21A8', bold: true },
      ],
      margin: [0, 0, 0, 1],
    });
  }

  return {
    stack: lines.length ? lines : [{ text: '—', fontSize: 6, color: MUTED_COLOR }],
    fillColor: fill,
  };
}

// ============================================================================
// PREP ACTION ROW - Full-width amber bar (matches HTML)
// ============================================================================

function buildPrepRow(act) {
  const parts = [];
  parts.push({ text: '⚠ PREP ', bold: true, fontSize: 6.5, color: '#92400E' });
  if (act.department) parts.push({ text: `[${act.department}] `, bold: true, fontSize: 6.5, color: '#92400E' });
  parts.push({ text: act.label || '', fontSize: 6.5, color: TEXT_COLOR });
  if (act.is_required) parts.push({ text: ' *', bold: true, fontSize: 6.5, color: '#DC2626' });
  if (act.offset_min !== undefined) parts.push({ text: ` (${act.offset_min}m antes)`, fontSize: 6, color: MUTED_COLOR, italics: true });
  if (act.notes) parts.push({ text: ` — ${act.notes}`, fontSize: 6, color: MUTED_COLOR, italics: true });

  return [
    { text: '', fillColor: '#FEF3C7' },
    { text: parts, colSpan: 2, fillColor: '#FEF3C7' },
    {},
  ];
}

// ============================================================================
// SESSION HEADER - Light band with pills (matches HTML print)
// ============================================================================

function buildSessionHeader(event, session, hasHospitalityTasks = false) {
  const content = [];

  // Title line: EVENT — SESSION
  const titleParts = [
    { text: (event?.name || 'EVENT').toUpperCase(), bold: true, fontSize: 11, color: '#1F8A70' },
    { text: ' — ', fontSize: 11, color: MUTED_COLOR },
    { text: (session?.name || 'SESSION').toUpperCase(), bold: true, fontSize: 11, color: TEXT_COLOR },
  ];
  if (hasHospitalityTasks) {
    titleParts.push({ text: ' [H]', fontSize: 9, color: '#DB2777', bold: true });
  }
  if (session?.is_translated_session) {
    titleParts.push({ text: ' [T]', fontSize: 9, color: '#7C3AED', bold: true });
  }
  content.push({ text: titleParts, margin: [0, 0, 0, 2] });

  // Meta line: date • time • location • arrival
  const metaParts = [];
  if (session?.date) {
    const d = new Date(session.date + 'T12:00:00');
    metaParts.push(d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }));
  }
  if (session?.planned_start_time) metaParts.push(toESTTimeStr(session.planned_start_time));
  if (session?.location) metaParts.push(session.location);
  
  const metaText = [{ text: metaParts.join(' • '), fontSize: 8, color: MUTED_COLOR }];
  if (session?.default_stage_call_offset_min) {
    metaText.push({ text: ` • Llegada: ${session.default_stage_call_offset_min} min antes`, fontSize: 8, color: '#2563EB', bold: true });
  }
  content.push({ text: metaText, margin: [0, 0, 0, 3] });

  // Team roster as compact pills-like text
  const teams = [];
  if (session?.presenter) teams.push({ label: 'PRES', value: session.presenter });
  if (session?.worship_leader) teams.push({ label: 'ALAB', value: session.worship_leader });
  if (session?.coordinators) teams.push({ label: 'COORD', value: session.coordinators });
  if (session?.admin_team) teams.push({ label: 'ADMIN', value: session.admin_team });
  if (session?.sound_team) teams.push({ label: 'SONIDO', value: session.sound_team });
  if (session?.tech_team) teams.push({ label: 'TÉC', value: session.tech_team });
  if (session?.ushers_team) teams.push({ label: 'UJIERES', value: session.ushers_team });
  if (session?.translation_team) teams.push({ label: 'TRAD', value: session.translation_team });
  if (session?.hospitality_team) teams.push({ label: 'HOSP', value: session.hospitality_team });
  if (session?.photography_team) teams.push({ label: 'FOTO', value: session.photography_team });

  if (teams.length > 0) {
    const teamText = teams.map(t => `${t.label}: ${t.value}`).join('  |  ');
    content.push({
      text: teamText,
      fontSize: 7,
      color: TEXT_COLOR,
      margin: [0, 0, 0, 2],
    });
  }

  return {
    stack: content,
    fillColor: '#F3F4F6',
    margin: [0, 0, 0, 4],
  };
}

// ============================================================================
// PRE-SESSION DETAILS (Segment 0)
// ============================================================================

function buildPreSessionBlock(psd) {
  if (!psd) return null;

  const parts = [];
  if (psd.music_profile_id) parts.push(`Música: ${psd.music_profile_id}`);
  if (psd.slide_pack_id) parts.push(`Slides: ${psd.slide_pack_id}`);
  if (psd.registration_desk_open_time) parts.push(`Registro: ${toESTTimeStr(psd.registration_desk_open_time)}`);
  if (psd.library_open_time) parts.push(`Librería: ${toESTTimeStr(psd.library_open_time)}`);

  if (parts.length === 0 && !psd.facility_notes && !psd.general_notes) return null;

  const content = [];
  content.push({
    text: 'DETALLES PREVIOS (SEGMENTO 0)',
    bold: true,
    fontSize: 7,
    color: '#1E40AF',
    margin: [0, 0, 0, 1],
  });

  if (parts.length > 0) {
    content.push({ text: parts.join(' • '), fontSize: 6.5, color: TEXT_COLOR, margin: [0, 0, 0, 1] });
  }
  if (psd.facility_notes) {
    content.push({
      text: [
        { text: 'Instalaciones: ', bold: true, fontSize: 6.5, color: LABEL_COLOR },
        { text: psd.facility_notes, fontSize: 6.5, color: MUTED_COLOR },
      ],
      margin: [0, 0, 0, 1],
    });
  }
  if (psd.general_notes) {
    content.push({
      text: [
        { text: 'General: ', bold: true, fontSize: 6.5, color: LABEL_COLOR },
        { text: psd.general_notes, fontSize: 6.5, color: MUTED_COLOR },
      ],
      margin: [0, 0, 0, 1],
    });
  }

  return { stack: content, fillColor: '#EFF6FF', margin: [0, 0, 0, 4] };
}

// ============================================================================
// MAIN TABLE BUILDER - 3 columns matching HTML ratio
// ============================================================================

function buildSessionTable(session, segments, allRooms = []) {
  // Header row
  const headerRow = [
    { text: 'HORA', bold: true, fontSize: 7, color: TEXT_COLOR, fillColor: '#E5E7EB', alignment: 'center' },
    { text: 'DETALLES', bold: true, fontSize: 7, color: TEXT_COLOR, fillColor: '#E5E7EB' },
    { text: 'NOTAS EQUIPO', bold: true, fontSize: 7, color: TEXT_COLOR, fillColor: '#E5E7EB' },
  ];

  const rows = [headerRow];
  let rowIndex = 0;

  const sortedSegs = segments.slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  sortedSegs.forEach(seg => {
    // PREP actions as full-width rows before segment
    const prepActions = (Array.isArray(seg.segment_actions) ? seg.segment_actions : [])
      .filter(a => a.timing === 'before_start');
    
    prepActions.forEach(act => {
      rows.push(buildPrepRow(act));
    });

    // Main segment row
    rows.push([
      buildTimeCell(seg, rowIndex),
      buildDetailsCell(seg, rowIndex, allRooms),
      buildNotesCell(seg, rowIndex),
    ]);
    rowIndex++;
  });

  return {
    table: {
      widths: [COL_TIME, COL_DETAILS, COL_NOTES],
      body: rows,
      headerRows: 1,
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.5 : 0.25,
      vLineWidth: () => 0.25,
      hLineColor: () => '#D1D5DB',
      vLineColor: () => '#E5E7EB',
      paddingTop: () => 2,
      paddingBottom: () => 2,
      paddingLeft: () => 3,
      paddingRight: () => 3,
    },
    margin: [0, 0, 0, 0],
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function generateEventReportPDFClient({
  event,
  sessions,
  segmentsBySession,
  preSessionDetailsBySession,
  rooms = [],
  hospitalityTasksBySession = {},
}) {
  const content = [];

  sessions.forEach((session, idx) => {
    const hasHospitalityTasks = Array.isArray(hospitalityTasksBySession?.[session.id]) && 
      hospitalityTasksBySession[session.id].length > 0;

    // Session header (light gray band)
    content.push(buildSessionHeader(event, session, hasHospitalityTasks));

    // Pre-session details
    const psd = preSessionDetailsBySession?.[session.id];
    const psdBlock = buildPreSessionBlock(psd);
    if (psdBlock) content.push(psdBlock);

    // Main segments table
    const segs = segmentsBySession?.[session.id] || [];
    content.push(buildSessionTable(session, segs, rooms));

    // Page break after each session (except last)
    if (idx < sessions.length - 1) {
      content.push({ text: '', pageBreak: 'after' });
    }
  });

  const docDefinition = {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [18, 12, 18, 18],
    defaultStyle: {
      fontSize: 7,
      color: TEXT_COLOR,
      font: 'Roboto',
    },
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
            hour12: true,
          }),
          fontSize: 6,
          color: MUTED_COLOR,
        },
        {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'right',
          fontSize: 6,
          color: MUTED_COLOR,
        },
      ],
      margin: [18, 4],
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