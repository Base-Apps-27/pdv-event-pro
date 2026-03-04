import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import PdfPrinter from 'npm:pdfmake@0.2.10';

// Global in-memory cache for Inter font buffers to avoid re-fetching on warm runs
const fontCache = {
  normal: null,
  bold: null,
  italics: null,
  bolditalics: null,
  ready: false,
};

async function fetchFont(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch font: ${url} (${res.status})`);
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

async function ensureFonts() {
  if (fontCache.ready) return fontCache;

  const interSources = {
    normal: [
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-400-normal.ttf',
      'https://unpkg.com/@fontsource/inter@5.0.8/files/inter-latin-400-normal.ttf',
    ],
    bold: [
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-700-normal.ttf',
      'https://unpkg.com/@fontsource/inter@5.0.8/files/inter-latin-700-normal.ttf',
    ],
    italics: [
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-400-italic.ttf',
      'https://unpkg.com/@fontsource/inter@5.0.8/files/inter-latin-400-italic.ttf',
    ],
    bolditalics: [
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-700-italic.ttf',
      'https://unpkg.com/@fontsource/inter@5.0.8/files/inter-latin-700-italic.ttf',
    ],
  };

  async function tryFetchOne(list) {
    for (const url of list) {
      try { return await fetchFont(url); } catch (_) { /* try next */ }
    }
    return null;
  }

  try {
    const [n, b, i, bi] = await Promise.all([
      tryFetchOne(interSources.normal),
      tryFetchOne(interSources.bold),
      tryFetchOne(interSources.italics),
      tryFetchOne(interSources.bolditalics),
    ]);
    if (n && b) {
      fontCache.normal = n;
      fontCache.bold = b;
      fontCache.italics = i || n;
      fontCache.bolditalics = bi || b;
      fontCache.ready = true;
      return fontCache;
    }
  } catch (_) {
    // ignore
  }
  // Could not fetch Inter – mark to use standard fonts (Helvetica) without network
  fontCache.ready = true;
  fontCache.useStandard = true;
  return fontCache;
}

// Utility: ET time formatting (HH:MM -> h:mm AM/PM)
function formatTimeToESTLocal(time24) {
  if (!time24) return '';
  const [hours, minutes] = String(time24).split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

function sortSessions(sessions) {
  return [...sessions]
    .sort((a, b) => {
      const ao = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
      const bo = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      if ((a.date || '') !== (b.date || '')) return (a.date || '').localeCompare(b.date || '');
      const at = a.planned_start_time || '';
      const bt = b.planned_start_time || '';
      return at.localeCompare(bt);
    });
}

// Heuristic density score -> font size profile
function computeFontProfile(segments) {
  let actions = 0;
  let notes = 0;
  for (const s of segments) {
    if (Array.isArray(s.segment_actions)) actions += s.segment_actions.length;
    if (s.projection_notes) notes++;
    if (s.sound_notes) notes++;
    if (s.ushers_notes) notes++;
    if (s.stage_decor_notes) notes++;
    if (s.translation_notes || s.requires_translation) notes++;
    if (s.has_video) notes++;
    if (s.segment_type === 'Artes') notes++;
  }
  const rows = segments.length;
  const score = rows + Math.ceil(actions / 3) + notes; // coarse density
  // Base sizes
  let body = 9, small = 8, tiny = 7, header = 12;
  if (score > 55) { body = 7; small = 7; tiny = 6; header = 10; }
  else if (score > 40) { body = 8; small = 7; tiny = 7; header = 11; }
  return { body, small, tiny, header };
}

function detailedTableForSession(session, segments, tSizes) {
  const headerRow = [
    { text: 'Hora', style: 'th', alignment: 'center' },
    { text: 'Detalles', style: 'th' },
    { text: 'Notas de equipo', style: 'th' },
  ];
  const body = [headerRow];

  for (const seg of segments) {
    const left = {
      stack: [
        { text: seg.start_time ? formatTimeToESTLocal(seg.start_time) : '-', alignment: 'center' },
        seg.end_time ? { text: formatTimeToESTLocal(seg.end_time), alignment: 'center', color: '#6b7280', fontSize: tSizes.tiny } : {},
        seg.duration_min ? { text: `(${seg.duration_min}m)`, alignment: 'center', fontSize: tSizes.tiny, color: '#6b7280', margin: [0, 2, 0, 0] } : {},
      ].filter(Boolean),
    };

    const detailsStack = [];
    const titleParts = [{ text: seg.title || '', style: 'rowTitle' }];
    if ((seg.presentation_url && seg.presentation_url.length > 0) || (seg.notes_url && seg.notes_url.length > 0) || seg.content_is_slides_only) {
      titleParts.push({ text: '  [RECURSOS]', color: '#3b82f6', fontSize: tSizes.tiny, bold: true });
    }
    if (seg.parsed_verse_data?.key_takeaways?.length > 0 || seg.scripture_references) {
      titleParts.push({ text: '  [VERSOS]', color: '#f59e0b', fontSize: tSizes.tiny, bold: true });
    }
    detailsStack.push({ text: titleParts });
    if (seg.segment_type) detailsStack.push({ text: seg.segment_type, style: 'badge' });
    if (seg.presenter) detailsStack.push({ text: seg.presenter, color: '#2563eb', bold: true, fontSize: tSizes.small });

    if (seg.segment_type === 'Alabanza' && seg.number_of_songs > 0) {
      const songs = [];
      for (let i = 1; i <= seg.number_of_songs; i++) {
        const title = seg[`song_${i}_title`];
        const lead = seg[`song_${i}_lead`];
        if (title) songs.push({ text: `${i}. ${title}${lead ? ` (${lead})` : ''}`, fontSize: tSizes.small });
      }
      if (songs.length) detailsStack.push({ text: 'CANCIONES:', color: '#166534', bold: true, fontSize: tSizes.small, margin: [0, 3, 0, 1] });
      if (songs.length) detailsStack.push({ ul: songs.map(s => s.text), fontSize: tSizes.small, margin: [8, 0, 0, 0] });
    }

    if (seg.segment_type === 'Plenaria' && seg.message_title) {
      detailsStack.push({ text: `MENSAJE: ${seg.message_title}`, color: '#1d4ed8', bold: true, fontSize: tSizes.small, margin: [0, 3, 0, 0] });
    }

    if (seg.has_video) {
      const parts = [];
      if (seg.video_name) parts.push(seg.video_name);
      if (seg.video_location) parts.push(`(${seg.video_location})`);
      if (typeof seg.video_length_sec === 'number')
        parts.push(`- ${Math.floor(seg.video_length_sec/60)}:${String(seg.video_length_sec%60).padStart(2,'0')}`);
      if (seg.video_owner) parts.push(`• ${seg.video_owner}`);
      detailsStack.push({ text: `VIDEO: ${parts.join(' ')}`, color: '#1d4ed8', bold: true, fontSize: tSizes.small, margin: [0, 3, 0, 0] });
    }

    if (seg.segment_type === 'Artes' && Array.isArray(seg.art_types) && seg.art_types.length) {
      const at = seg.art_types.map(t => t === 'DANCE' ? 'Danza' : t === 'DRAMA' ? 'Drama' : t === 'VIDEO' ? 'Video' : 'Otro').join(', ');
      const artsLines = [{ text: `ARTES: ${at}`, color: '#9d174d', bold: true, fontSize: tSizes.small, margin: [0, 3, 0, 1] }];
      if (seg.art_types.includes('DRAMA')) {
        const drama = [];
        if (seg.drama_handheld_mics > 0) drama.push(`M.Hand: ${seg.drama_handheld_mics}`);
        if (seg.drama_headset_mics > 0) drama.push(`M.Head: ${seg.drama_headset_mics}`);
        if (seg.drama_start_cue) drama.push(`Inicio: ${seg.drama_start_cue}`);
        if (seg.drama_end_cue) drama.push(`Fin: ${seg.drama_end_cue}`);
        if (seg.drama_has_song && seg.drama_song_title) drama.push(`Canción: ${seg.drama_song_title}`);
        if (drama.length) artsLines.push({ text: drama.join(' • '), fontSize: tSizes.small, margin: [8, 0, 0, 0] });
      }
      if (seg.art_types.includes('DANCE')) {
        const dance = [];
        if (seg.dance_handheld_mics > 0) dance.push(`M.Hand: ${seg.dance_handheld_mics}`);
        if (seg.dance_headset_mics > 0) dance.push(`M.Head: ${seg.dance_headset_mics}`);
        if (seg.dance_has_song && seg.dance_song_title) dance.push(`Música: ${seg.dance_song_title}`);
        if (dance.length) artsLines.push({ text: dance.join(' • '), fontSize: tSizes.small, margin: [8, 0, 0, 0] });
      }
      if (seg.art_types.includes('OTHER') && seg.art_other_description) {
        artsLines.push({ text: seg.art_other_description, fontSize: tSizes.small, color: '#374151', margin: [8, 0, 0, 0] });
      }
      detailsStack.push(...artsLines);
    }

    if (seg.description_details) detailsStack.push({ text: seg.description_details, fontSize: tSizes.small, color: '#374151', margin: [0, 3, 0, 0] });

    const teamNotes = [];
    if (seg.projection_notes) teamNotes.push({ text: `PROYECCIÓN: ${seg.projection_notes}`, color: '#6b21a8', fontSize: tSizes.small });
    if (seg.sound_notes) teamNotes.push({ text: `SONIDO: ${seg.sound_notes}`, color: '#b91c1c', fontSize: tSizes.small });
    if (seg.ushers_notes) teamNotes.push({ text: `UJIERES: ${seg.ushers_notes}`, color: '#166534', fontSize: tSizes.small });
    if (seg.stage_decor_notes) teamNotes.push({ text: `STAGE & DECOR: ${seg.stage_decor_notes}`, color: '#6b21a8', fontSize: tSizes.small });
    if (seg.requires_translation) {
      const extra = [];
      if (seg.translator_name) extra.push(seg.translator_name);
      if (seg.translation_mode === 'RemoteBooth') extra.push('(Remoto)');
      if (seg.translation_notes) extra.push(`- ${seg.translation_notes}`);
      teamNotes.push({ text: `TRADUCCIÓN: ${extra.join(' ')}`, color: '#1d4ed8', fontSize: tSizes.small });
    }

    body.push([
      left,
      { stack: detailsStack, margin: [2, 0, 4, 0] },
      { stack: teamNotes.length ? teamNotes : [{ text: '—', color: '#9ca3af' }], margin: [2, 0, 0, 0] },
    ]);
  }

  return {
    table: {
      widths: [60, '*', '*'],
      body,
    },
    layout: {
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
      hLineColor: '#e5e7eb',
      vLineColor: '#e5e7eb',
    },
  };
}

function simpleNotesTable(session, segments, columnTitle, selector, tSizes) {
  const body = [[
    { text: 'Hora', style: 'th' },
    { text: 'Título', style: 'th' },
    { text: columnTitle, style: 'th' },
  ]];
  for (const seg of segments) {
    body.push([
      { text: seg.start_time ? formatTimeToESTLocal(seg.start_time) : '-', fontSize: tSizes.body },
      { text: seg.title || '', fontSize: tSizes.body, bold: true },
      { text: seg[selector] || '—', fontSize: tSizes.body },
    ]);
  }
  return {
    table: { widths: [70, 180, '*'], body },
    layout: 'lightHorizontalLines',
  };
}

function headerBand(event, session, sizes) {
  const meta = [];
  if (session.date) meta.push(session.date);
  if (session.planned_start_time) meta.push(formatTimeToESTLocal(session.planned_start_time));
  if (session.location) meta.push(session.location);
  
  return {
    columns: [
      {
        width: '*',
        stack: [
          { text: [{ text: event.name || '', color: '#1F8A70', bold: true }, { text: ' — ' }, { text: session.name || '', bold: true }], fontSize: sizes.header, margin: [0, 0, 0, 2] },
          { text: meta.join(' • '), color: '#374151', fontSize: sizes.small }
        ]
      },
      {
        width: 50,
        stack: [
          { qr: 'https://pdv-event-pro.base44.app', fit: 36, alignment: 'right', foreground: '#1F8A70' },
          { text: 'SCAN', fontSize: 5, alignment: 'right', color: '#6b7280', margin: [0, 1, 0, 0] }
        ]
      }
    ],
    margin: [0, 0, 0, 8],
  };
}

function preSessionBlock(psd, sizes) {
  if (!psd) return null;
  const rows = [];
  if (psd.music_profile_id) rows.push({ text: `Música: ${psd.music_profile_id}`, margin: [0, 0, 8, 0] });
  if (psd.slide_pack_id) rows.push({ text: `Slides: ${psd.slide_pack_id}`, margin: [0, 0, 8, 0] });
  if (psd.registration_desk_open_time) rows.push({ text: `Registro: ${formatTimeToESTLocal(psd.registration_desk_open_time)}`, margin: [0, 0, 8, 0] });
  if (psd.library_open_time) rows.push({ text: `Librería: ${formatTimeToESTLocal(psd.library_open_time)}`, margin: [0, 0, 8, 0] });
  if (psd.facility_notes) rows.push({ text: `Instalaciones: ${psd.facility_notes}`, margin: [0, 0, 8, 0] });
  if (psd.general_notes) rows.push({ text: `General: ${psd.general_notes}`, margin: [0, 0, 8, 0] });
  if (!rows.length) return null;
  return {
    table: {
      widths: ['*'],
      body: [[{ text: 'Detalles Previos (Segmento 0)', bold: true, color: '#1d4ed8', fontSize: sizes.small }], [{ stack: rows, fontSize: sizes.tiny, color: '#374151' }]],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 6],
  };
}

function mergePreSessionDetails(records) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const merged = {};
  const pickFirst = (key) => { const f = records.find(r => r && r[key]); if (f) merged[key] = f[key]; };
  pickFirst('music_profile_id'); pickFirst('slide_pack_id'); pickFirst('facility_notes'); pickFirst('general_notes');
  const times = (key) => {
    const arr = records.map(r => r && r[key]).filter(Boolean);
    if (!arr.length) return; 
    arr.sort((a,b)=> (a||'').localeCompare(b||''));
    merged[key] = arr[0];
  };
  times('registration_desk_open_time'); times('library_open_time');
  return merged;
}

function filterSegments(segments, key) {
  if (!key) return segments;
  return segments.filter(s => s[key]);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { eventId, reportType } = payload || {};
    if (!eventId || !reportType) {
      return Response.json({ error: 'Missing eventId or reportType' }, { status: 400 });
    }

    const fonts = await ensureFonts();
    const useStandard = fonts.useStandard === true;
    const fontDefs = useStandard ? {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      }
    } : {
      Inter: {
        normal: fonts.normal,
        bold: fonts.bold,
        italics: fonts.italics,
        bolditalics: fonts.bolditalics,
      }
    };
    const defaultFontName = useStandard ? 'Helvetica' : 'Inter';
    const printer = new PdfPrinter(fontDefs);

    // Fetch event and sessions
    const events = await base44.entities.Event.filter({ id: eventId });
    const event = events[0];
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });

    // Sessions may be linked either directly by event_id OR indirectly via EventDay.event_id
    const directSessions = await base44.entities.Session.filter({ event_id: eventId });

    const eventDays = await base44.entities.EventDay.filter({ event_id: eventId });
    let viaDaySessions = [];
    if (eventDays.length) {
      const dayIds = eventDays.map(d => d.id);
      const results = await Promise.all(dayIds.map((did) => base44.entities.Session.filter({ event_day_id: did })));
      viaDaySessions = results.flat();
    }

    // Merge + dedupe
    const sessionsMap = new Map();
    for (const s of [...directSessions, ...viaDaySessions]) sessionsMap.set(s.id, s);
    const sessions = sortSessions([...sessionsMap.values()]);

    const sessionIds = sessions.map(s => s.id);

    // Fetch segments per session (UI parity)
    const segmentsBySession = {};
    for (const sid of sessionIds) {
      segmentsBySession[sid] = await base44.entities.Segment.filter({ session_id: sid });
      // sort by order then time
      segmentsBySession[sid].sort((a,b)=> (a.order||0)-(b.order||0));
    }

    // Pre-session details
    const psdBySession = {};
    for (const sid of sessionIds) {
      const recs = await base44.entities.PreSessionDetails.filter({ session_id: sid });
      psdBySession[sid] = mergePreSessionDetails(recs);
    }

    // Hospitality tasks (badge logic handled in header if needed)
    const hospBySession = {};
    const tasksBySession = {};
    for (const sid of sessionIds) {
      const tasks = await base44.entities.HospitalityTask.filter({ session_id: sid });
      hospBySession[sid] = tasks && tasks.length > 0;
      tasksBySession[sid] = tasks || [];
    }

    // Build docDefinition
    const content = [];

    const addSessionPage = async (session, segments) => {
      const sizes = computeFontProfile(segments);
      content.push(headerBand(event, session, sizes));
      const psd = psdBySession[session.id];
      const psdBlock = preSessionBlock(psd, sizes);
      if (psdBlock) content.push(psdBlock);

      if (reportType === 'detailed') {
        content.push(detailedTableForSession(session, segments, sizes));
      } else if (reportType === 'projection') {
        const filtered = filterSegments(segments, 'show_in_projection');
        content.push(simpleNotesTable(session, filtered, 'Notas Proyección', 'projection_notes', sizes));
      } else if (reportType === 'sound') {
        const filtered = filterSegments(segments, 'show_in_sound');
        content.push(simpleNotesTable(session, filtered, 'Notas Sonido', 'sound_notes', sizes));
      } else if (reportType === 'ushers') {
        const filtered = filterSegments(segments, 'show_in_ushers');
        content.push(simpleNotesTable(session, filtered, 'Notas Ujieres', 'ushers_notes', sizes));
      } else if (reportType === 'hospitality') {
        // Hospitality: table of tasks (if any)
        const tasks = tasksBySession[session.id] || [];
        const body = [[
          { text: 'Tiempo', style: 'th' },
          { text: 'Categoría', style: 'th' },
          { text: 'Descripción', style: 'th' },
          { text: 'Ubicación', style: 'th' },
          { text: 'Notas', style: 'th' },
        ]];
        for (const t of tasks) {
          body.push([
            t.time_hint || '—',
            t.category || '—',
            t.description || '—',
            t.location_notes || '—',
            t.notes || '—',
          ]);
        }
        content.push({ table: { widths: [70, 80, '*', 120, 120], body }, layout: 'lightHorizontalLines' });
      } else if (reportType === 'general') {
        // General program: time | title | presenter | duration
        const filtered = filterSegments(segments, 'show_in_general');
        const body = [[
          { text: 'Hora', style: 'th' },
          { text: 'Título', style: 'th' },
          { text: 'Responsable', style: 'th' },
          { text: 'Duración', style: 'th' },
        ]];
        for (const seg of filtered) {
          body.push([
            seg.start_time ? formatTimeToESTLocal(seg.start_time) : '-',
            seg.title || '—',
            seg.presenter || '—',
            seg.duration_min ? `${seg.duration_min} min` : '—',
          ]);
        }
        content.push({ table: { widths: [70, '*', 180, 70], body }, layout: 'lightHorizontalLines' });
      }

      // Ensure one session per page
      content.push({ text: '', pageBreak: 'after' });
    };

    for (const session of sessions) {
      const segs = segmentsBySession[session.id] || [];
      await addSessionPage(session, segs);
    }

    // Remove the last trailing pageBreak
    if (content.length && content[content.length - 1].pageBreak === 'after') content.pop();

    const docDefinition = {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [24, 20, 24, 24],
      defaultStyle: { font: defaultFontName, fontSize: 9, color: '#111827' },
      styles: {
        th: { bold: true, fillColor: '#f3f4f6', fontSize: 9 },
        rowTitle: { bold: true, fontSize: 10 },
        badge: { fontSize: 8, color: '#374151' },
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }), color: '#6b7280', fontSize: 8 },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: '#6b7280', fontSize: 8 },
        ],
        margin: [24, 8],
      }),
      content,
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    await new Promise((resolve, reject) => {
      pdfDoc.on('data', (d) => chunks.push(new Uint8Array(d)));
      pdfDoc.on('end', resolve);
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
    let total = 0;
    for (const c of chunks) total += c.length;
    const blob = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { blob.set(c, offset); offset += c.length; }

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});