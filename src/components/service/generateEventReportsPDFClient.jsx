import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { pdfTheme, getSegmentColor, getLabelStyle, toESTTimeStr } from './pdfThemeSystem';

if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}

// ============================================================================
// CELL BUILDERS — Layout Intent System (Matching HTML Reports 1:1)
// ============================================================================

function buildTimeCell(seg) {
  const color = getSegmentColor(seg.segment_type);
  const stack = [
    {
      text: seg.start_time ? toESTTimeStr(seg.start_time) : '—',
      bold: true,
      color: pdfTheme.text.primary,
      fontSize: pdfTheme.fontSize.lg,
    },
  ];

  if (seg.end_time) {
    stack.push({
      text: toESTTimeStr(seg.end_time),
      color: pdfTheme.text.muted,
      fontSize: pdfTheme.fontSize.base,
      margin: [0, 1, 0, 0],
    });
  }

  if (seg.duration_min) {
    stack.push({
      text: `(${seg.duration_min}m)`,
      color: pdfTheme.text.muted,
      fontSize: pdfTheme.fontSize.sm,
      margin: [0, 1, 0, 0],
    });
  }

  // Translation mode icons in time cell (matching HTML)
  if (seg.requires_translation) {
    if (seg.translation_mode === 'InPerson') {
      stack.push({
        text: '🎙️',
        fontSize: pdfTheme.fontSize.sm,
        color: '#7C3AED',
        margin: [0, 2, 0, 0],
      });
    } else if (seg.translation_mode === 'RemoteBooth') {
      stack.push({
        text: '🎧',
        fontSize: pdfTheme.fontSize.sm,
        color: '#7C3AED',
        margin: [0, 2, 0, 0],
      });
    }
  }

  // Major break icon
  if (seg.major_break) {
    stack.push({
      text: '🍽️',
      fontSize: pdfTheme.fontSize.sm,
      color: '#EA580C',
      margin: [0, 2, 0, 0],
    });
  }

  return {
    stack,
    verticalAlign: 'top',
    fillColor: pdfTheme.fills.timeCell,
  };
}

function buildDetailsLeftCell(seg, allRooms = []) {
  const stack = [];

  // Title + Type badge (matching HTML exactly)
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

  // Presenter - use appropriate label based on segment type (ENCARGADO for breaks, MINISTRA for others)
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

  // Break type visual distinction (Receso/Almuerzo) with duration badge
  if (['Receso', 'Almuerzo'].includes(seg.segment_type)) {
    const isLunch = seg.segment_type === 'Almuerzo';
    stack.push({
      text: [
        { text: isLunch ? '🍽️ ' : '☕ ', fontSize: pdfTheme.fontSize.base },
        { text: `${seg.duration_min || 0} min`, bold: true, color: isLunch ? '#C2410C' : '#374151', fontSize: pdfTheme.fontSize.sm },
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Translation - InPerson (on stage)
  if (seg.requires_translation && seg.translation_mode === 'InPerson') {
    stack.push({
      text: [
        { text: '🎙️ TRAD-TARIMA', bold: true, color: '#2563EB', fontSize: pdfTheme.fontSize.sm },
        seg.translator_name ? { text: `: ${seg.translator_name}`, color: '#1E40AF', fontSize: pdfTheme.fontSize.sm } : '',
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Translation - RemoteBooth (headphones)
  if (seg.requires_translation && seg.translation_mode === 'RemoteBooth') {
    stack.push({
      text: [
        { text: '🎧 TRAD-CABINA', bold: true, color: '#0891B2', fontSize: pdfTheme.fontSize.sm },
        seg.translator_name ? { text: `: ${seg.translator_name}`, color: '#0E7490', fontSize: pdfTheme.fontSize.sm } : '',
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Songs (Alabanza) - full list matching HTML
  if (seg.segment_type === 'Alabanza' && seg.number_of_songs > 0) {
    stack.push({
      text: 'CANCIONES:',
      bold: true,
      color: '#166534',
      fontSize: pdfTheme.fontSize.sm,
      margin: [0, 0, 0, 1],
    });
    for (let i = 1; i <= Math.min(seg.number_of_songs, 6); i++) {
      const title = seg[`song_${i}_title`];
      if (title) {
        const lead = seg[`song_${i}_lead`];
        const key = seg[`song_${i}_key`];
        stack.push({
          text: [
            { text: `${i}. `, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs },
            { text: title, color: pdfTheme.text.primary, fontSize: pdfTheme.fontSize.sm, bold: true },
            lead ? { text: ` (${lead})`, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs, italics: true } : '',
            key ? { text: ` [${key}]`, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs, bold: true } : '',
          ],
          margin: [0, 0, 0, 0.5],
        });
      }
    }
  }

  // Video info - full details matching HTML
  if (seg.has_video) {
    const videoParts = [{ text: 'VIDEO: ', bold: true, color: '#1E40AF', fontSize: pdfTheme.fontSize.sm }];
    if (seg.video_name) videoParts.push({ text: seg.video_name, color: '#1E3A8A', fontSize: pdfTheme.fontSize.sm });
    if (seg.video_length_sec) {
      const mins = Math.floor(seg.video_length_sec / 60);
      const secs = seg.video_length_sec % 60;
      videoParts.push({ text: ` - ${mins}:${String(secs).padStart(2, '0')}`, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs });
    }
    if (seg.video_owner) videoParts.push({ text: ` • ${seg.video_owner}`, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs });
    stack.push({ text: videoParts, margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom] });
  }

  // Artes - full details matching HTML (types, mics, cues, songs)
  if (seg.segment_type === 'Artes' && Array.isArray(seg.art_types) && seg.art_types.length) {
    const artLabels = seg.art_types.map(t => (t === 'DANCE' ? 'Danza' : t === 'DRAMA' ? 'Drama' : t === 'VIDEO' ? 'Video' : 'Otro')).join(', ');
    stack.push({
      text: [{ text: 'ARTES: ', bold: true, color: '#831843', fontSize: pdfTheme.fontSize.sm }, { text: artLabels, fontSize: pdfTheme.fontSize.sm }],
      margin: [0, 0, 0, 1],
    });

    // Drama details
    if (seg.art_types.includes('DRAMA')) {
      const dramaParts = [];
      if (seg.drama_handheld_mics > 0) dramaParts.push(`Mics mano: ${seg.drama_handheld_mics}`);
      if (seg.drama_headset_mics > 0) dramaParts.push(`Headset: ${seg.drama_headset_mics}`);
      if (seg.drama_start_cue) dramaParts.push(`Inicio: ${seg.drama_start_cue}`);
      if (seg.drama_end_cue) dramaParts.push(`Fin: ${seg.drama_end_cue}`);
      if (dramaParts.length) {
        stack.push({
          text: dramaParts.join(' • '),
          color: pdfTheme.text.secondary,
          fontSize: pdfTheme.fontSize.xs,
          margin: [0, 0, 0, 1],
        });
      }
      if (seg.drama_has_song && seg.drama_song_title) {
        stack.push({
          text: `Canción: ${seg.drama_song_title}`,
          color: pdfTheme.text.secondary,
          fontSize: pdfTheme.fontSize.xs,
          margin: [0, 0, 0, 1],
        });
      }
    }

    // Dance details
    if (seg.art_types.includes('DANCE')) {
      const danceParts = [];
      if (seg.dance_handheld_mics > 0) danceParts.push(`Mics mano: ${seg.dance_handheld_mics}`);
      if (seg.dance_headset_mics > 0) danceParts.push(`Headset: ${seg.dance_headset_mics}`);
      if (seg.dance_start_cue) danceParts.push(`Inicio: ${seg.dance_start_cue}`);
      if (seg.dance_end_cue) danceParts.push(`Fin: ${seg.dance_end_cue}`);
      if (danceParts.length) {
        stack.push({
          text: danceParts.join(' • '),
          color: pdfTheme.text.secondary,
          fontSize: pdfTheme.fontSize.xs,
          margin: [0, 0, 0, 1],
        });
      }
      if (seg.dance_has_song && seg.dance_song_title) {
        stack.push({
          text: `Música: ${seg.dance_song_title}`,
          color: pdfTheme.text.secondary,
          fontSize: pdfTheme.fontSize.xs,
          margin: [0, 0, 0, 1],
        });
      }
    }

    // Other art description
    if (seg.art_types.includes('OTHER') && seg.art_other_description) {
      stack.push({
        text: seg.art_other_description,
        color: pdfTheme.text.secondary,
        fontSize: pdfTheme.fontSize.xs,
        margin: [0, 0, 0, 1],
      });
    }
  }

  // Message (Plenaria) - full title
  if (seg.segment_type === 'Plenaria' && seg.message_title) {
    stack.push({
      text: [
        { text: 'MENSAJE: ', bold: true, color: '#1E40AF', fontSize: pdfTheme.fontSize.sm },
        { text: `"${seg.message_title}"`, color: '#1E3A8A', fontSize: pdfTheme.fontSize.sm },
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Panel - moderators and panelists
  if (seg.segment_type === 'Panel') {
    if (seg.panel_moderators) {
      stack.push({
        text: [
          { text: 'MOD: ', bold: true, color: '#B45309', fontSize: pdfTheme.fontSize.sm },
          { text: seg.panel_moderators, color: '#92400E', fontSize: pdfTheme.fontSize.sm },
        ],
        margin: [0, 0, 0, 1],
      });
    }
    if (seg.panel_panelists) {
      stack.push({
        text: [
          { text: 'PAN: ', bold: true, color: '#B45309', fontSize: pdfTheme.fontSize.sm },
          { text: seg.panel_panelists, color: '#92400E', fontSize: pdfTheme.fontSize.sm },
        ],
        margin: [0, 0, 0, 1],
      });
    }
    if (seg.description_details) {
      stack.push({
        text: seg.description_details,
        color: pdfTheme.text.secondary,
        fontSize: pdfTheme.fontSize.xs,
        margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
      });
    }
  }

  // Breakout Rooms - 3-column card grid matching HTML
  if (seg.segment_type === 'Breakout' && Array.isArray(seg.breakout_rooms) && seg.breakout_rooms.length > 0) {
    const roomCards = seg.breakout_rooms.map((room, idx) => {
      const roomName = room.room_id && allRooms.length
        ? (allRooms.find(r => r.id === room.room_id)?.name || `Sala ${idx + 1}`)
        : `Sala ${idx + 1}`;

      const cardStack = [];
      // Room name badge
      cardStack.push({
        text: roomName,
        bold: true,
        color: '#1E40AF',
        fontSize: pdfTheme.fontSize.xs,
        fillColor: '#EFF6FF',
        margin: [0, 0, 0, 2],
      });
      // Topic
      if (room.topic) {
        cardStack.push({
          text: `"${room.topic}"`,
          bold: true,
          color: pdfTheme.text.primary,
          fontSize: pdfTheme.fontSize.sm,
          margin: [0, 0, 0, 1],
        });
      }
      // Host
      if (room.hosts) {
        cardStack.push({
          text: [
            { text: 'Anfitrión: ', bold: true, color: '#4338CA', fontSize: pdfTheme.fontSize.xs },
            { text: room.hosts.toUpperCase(), color: '#4338CA', fontSize: pdfTheme.fontSize.xs },
          ],
          margin: [0, 0, 0, 0.5],
        });
      }
      // Speaker
      if (room.speakers) {
        cardStack.push({
          text: [
            { text: 'Presentador: ', bold: true, color: '#2563EB', fontSize: pdfTheme.fontSize.xs },
            { text: room.speakers, color: '#2563EB', fontSize: pdfTheme.fontSize.xs },
          ],
          margin: [0, 0, 0, 0.5],
        });
      }
      // Translation
      if (room.requires_translation) {
        const mode = room.translation_mode === 'RemoteBooth' ? 'Traducción Remota' : 'Traducción en Persona';
        cardStack.push({
          text: [
            { text: mode, color: '#7C3AED', fontSize: pdfTheme.fontSize.xs, italics: true },
            room.translator_name ? { text: ` — ${room.translator_name}`, color: '#7C3AED', fontSize: pdfTheme.fontSize.xs } : '',
          ],
          margin: [0, 0, 0, 0.5],
        });
      }

      return {
        stack: cardStack,
        fillColor: '#FFFBEB',
        margin: [2, 2, 2, 2],
      };
    });

    // Build 3-column grid
    const columnCount = 3;
    const rows = [];
    for (let i = 0; i < roomCards.length; i += columnCount) {
      const rowCells = roomCards.slice(i, i + columnCount);
      // Pad to 3 columns if needed
      while (rowCells.length < columnCount) {
        rowCells.push({ text: '', fillColor: '#FFFFFF' });
      }
      rows.push(rowCells);
    }

    stack.push({
      table: {
        widths: ['*', '*', '*'],
        body: rows,
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#FCD34D',
        vLineColor: () => '#FCD34D',
        paddingTop: () => 3,
        paddingBottom: () => 3,
        paddingLeft: () => 4,
        paddingRight: () => 4,
      },
      margin: [0, 2, 0, 4],
    });
  }

  // Description details (prep instructions) - if not already shown
  if (seg.description_details && seg.segment_type !== 'Panel') {
    stack.push({
      text: seg.description_details,
      color: pdfTheme.text.secondary,
      fontSize: pdfTheme.fontSize.xs,
      italics: true,
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
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

  // DURANTE actions - center column
  const duringActions = (Array.isArray(seg.segment_actions) ? seg.segment_actions : []).filter(a => a.timing !== 'before_start');

  if (duringActions.length > 0) {
    stack.push({
      text: '▶ DURANTE',
      fontSize: pdfTheme.fontSize.sm,
      bold: true,
      color: pdfTheme.labels.durante.text,
      margin: [0, 0, 0, 1],
    });
    duringActions.forEach(act => {
      const dept = act.department ? `[${act.department}] ` : '';
      const label = act.label || '';
      const timing = [];
      if (act.timing === 'before_end' && act.offset_min !== undefined) timing.push(`${act.offset_min}m antes fin`);
      if (act.timing === 'after_start' && act.offset_min !== undefined) timing.push(`${act.offset_min}m después`);
      if (act.notes) timing.push(act.notes);

      stack.push({
        text: [
          dept ? { text: dept, bold: true, fontSize: pdfTheme.fontSize.xs, color: '#6B7280' } : '',
          { text: label, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.sm },
          timing.length ? { text: `\n${timing.join(' • ')}`, color: pdfTheme.text.light, fontSize: pdfTheme.fontSize.xs, italics: true } : '',
        ],
        margin: [0, 0, 0, 1],
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

  // NOTE: PREP actions are now rendered as separate full-width rows below the segment
  // See buildPrepActionRow() function

  // Team notes - ALL notes matching HTML (no truncation)
  const notes = [
    { label: 'PROY', val: seg.projection_notes, color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'SONIDO', val: seg.sound_notes, color: '#DC2626', bg: '#FEF2F2' },
    { label: 'UJIER', val: seg.ushers_notes, color: '#16A34A', bg: '#F0FDF4' },
    { label: 'STAGE', val: seg.stage_decor_notes, color: '#DB2777', bg: '#FDF2F8' },
    { label: 'TRAD', val: seg.translation_notes, color: '#7C3AED', bg: '#F5F3FF' },
  ].filter(n => n.val);

  // Video info in notes column (matching HTML)
  if (seg.has_video && (seg.video_name || seg.video_location)) {
    stack.push({
      text: [
        { text: 'VIDEO: ', bold: true, color: '#1E40AF', fontSize: pdfTheme.fontSize.xs },
        { text: seg.video_name || seg.video_location || '', fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.secondary },
      ],
      fillColor: '#EFF6FF',
      margin: [0, 0, 0, 1],
    });
  }

  notes.forEach(n => {
    stack.push({
      text: [
        { text: `${n.label}: `, bold: true, color: n.color, fontSize: pdfTheme.fontSize.xs },
        { text: n.val, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.xs },
      ],
      fillColor: n.bg,
      margin: [0, 0, 0, 1],
    });
  });

  // Translation info for notes column if present
  if (seg.requires_translation) {
    const mode = seg.translation_mode === 'InPerson' ? '🎙️ TRAD-TARIMA' : '🎧 TRAD-CABINA';
    const color = seg.translation_mode === 'InPerson' ? '#2563EB' : '#0891B2';
    stack.push({
      text: [
        { text: mode, bold: true, color, fontSize: pdfTheme.fontSize.xs },
        seg.translator_name ? { text: `: ${seg.translator_name}`, color, fontSize: pdfTheme.fontSize.xs } : '',
      ],
      fillColor: seg.translation_mode === 'InPerson' ? '#EFF6FF' : '#ECFEFF',
      margin: [0, 0, 0, 1],
    });
  }

  return {
    stack: stack.length ? stack : [{ text: '—', fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.muted }],
    verticalAlign: 'top',
    fillColor: pdfTheme.fills.notesCell,
  };
}

// ============================================================================
// SESSION HEADER - Matching HTML team grid exactly
// ============================================================================

function buildSessionHeader(event, session) {
  const stack = [];

  // Event name + Session name
  const dateStr = session?.date
    ? new Date(session.date + 'T12:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
    : '';
  const timeStr = session?.planned_start_time ? toESTTimeStr(session.planned_start_time) : '';
  const locStr = session?.location || '';
  const arrivalStr = session?.default_stage_call_offset_min ? `Llegada: ${session.default_stage_call_offset_min} min antes` : '';

  stack.push({
    text: [
      { text: (event?.name || 'EVENT').toUpperCase() + ' — ', color: '#1F8A70', bold: true, fontSize: pdfTheme.fontSize.title },
      { text: (session?.name || 'SESSION').toUpperCase(), bold: true, color: pdfTheme.text.primary, fontSize: pdfTheme.fontSize.title },
      session?.is_translated_session ? { text: ' 🌐', fontSize: pdfTheme.fontSize.lg } : '',
    ],
    margin: [0, 0, 0, 2],
  });

  // Date/time/location line
  const meta = [dateStr, timeStr, locStr].filter(x => x).join(' • ');
  if (meta || arrivalStr) {
    stack.push({
      text: [
        { text: meta, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.header },
        arrivalStr ? { text: ` • ${arrivalStr}`, color: '#2563EB', fontSize: pdfTheme.fontSize.header, bold: true } : '',
      ],
      margin: [0, 0, 0, 3],
    });
  }

  // Team info grid - matching HTML exactly
  const teams = [];
  if (session?.worship_leader) teams.push({ label: 'ALAB', value: session.worship_leader, color: '#16A34A' });
  if (session?.coordinators) teams.push({ label: 'COORD', value: session.coordinators, color: '#4F46E5' });
  if (session?.admin_team) teams.push({ label: 'ADMIN', value: session.admin_team, color: '#EA580C' });
  if (session?.sound_team) teams.push({ label: 'SONIDO', value: session.sound_team, color: '#DC2626' });
  if (session?.tech_team) teams.push({ label: 'TÉC', value: session.tech_team, color: '#7C3AED' });
  if (session?.translation_team) teams.push({ label: 'TRAD', value: session.translation_team, color: '#7C3AED' });
  if (session?.hospitality_team) teams.push({ label: 'HOSP', value: session.hospitality_team, color: '#DB2777' });
  if (session?.photography_team) teams.push({ label: 'FOTO', value: session.photography_team, color: '#0D9488' });
  if (session?.ushers_team) teams.push({ label: 'UJIER', value: session.ushers_team, color: '#2563EB' });
  if (session?.presenter) teams.push({ label: 'PRES', value: session.presenter, color: '#2563EB' });

  if (teams.length > 0) {
    // Build 4-column grid like HTML
    const rows = [];
    for (let i = 0; i < teams.length; i += 4) {
      const rowCells = teams.slice(i, i + 4).map(t => ({
        text: [
          { text: `${t.label}: `, bold: true, color: t.color, fontSize: pdfTheme.fontSize.xs },
          { text: t.value, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.xs },
        ],
        fillColor: '#FAFAFA',
        margin: [2, 1, 2, 1],
      }));
      // Pad to 4 columns
      while (rowCells.length < 4) {
        rowCells.push({ text: '', fillColor: '#FAFAFA' });
      }
      rows.push(rowCells);
    }

    stack.push({
      table: {
        widths: ['*', '*', '*', '*'],
        body: rows,
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#E5E7EB',
        vLineColor: () => '#E5E7EB',
      },
      margin: [0, 0, 0, 4],
    });
  }

  return { stack, margin: [0, 0, 0, 4] };
}

// ============================================================================
// PRE-SESSION DETAILS - Matching HTML exactly
// ============================================================================

function buildPreSessionDetailsBlock(psd) {
  if (!psd) return null;

  const details = [];

  if (psd.music_profile_id) details.push({ icon: '🎵', label: 'Música', value: psd.music_profile_id });
  if (psd.slide_pack_id) details.push({ icon: '📊', label: 'Slides', value: psd.slide_pack_id });
  if (psd.registration_desk_open_time) details.push({ label: 'Registro', value: toESTTimeStr(psd.registration_desk_open_time) });
  if (psd.library_open_time) details.push({ label: 'Librería', value: toESTTimeStr(psd.library_open_time) });

  if (details.length === 0 && !psd.facility_notes && !psd.general_notes) return null;

  const stack = [];

  stack.push({
    text: 'DETALLES PREVIOS (SEGMENTO 0)',
    bold: true,
    color: '#1E40AF',
    fontSize: pdfTheme.fontSize.sm,
    margin: [0, 0, 0, 2],
  });

  if (details.length > 0) {
    stack.push({
      text: details.map(d => `${d.icon || ''}${d.label}: ${d.value}`).join(' • '),
      fontSize: pdfTheme.fontSize.xs,
      color: pdfTheme.text.secondary,
      margin: [0, 0, 0, 2],
    });
  }

  if (psd.facility_notes) {
    stack.push({
      text: [
        { text: 'Instalaciones: ', bold: true, fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.secondary },
        { text: psd.facility_notes, fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.muted },
      ],
      margin: [0, 0, 0, 1],
    });
  }

  if (psd.general_notes) {
    stack.push({
      text: [
        { text: 'General: ', bold: true, fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.secondary },
        { text: psd.general_notes, fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.muted },
      ],
      margin: [0, 0, 0, 1],
    });
  }

  return {
    stack,
    fillColor: '#EFF6FF',
    margin: [0, 0, 0, 6],
  };
}

// ============================================================================
// TABLE BUILDER — 4-Column Grid
// ============================================================================

function buildDayTable(session, segments, allRooms = []) {
  const headerRow = [
    {
      text: 'HORA',
      bold: true,
      fontSize: pdfTheme.fontSize.sm,
      color: pdfTheme.text.primary,
      alignment: 'center',
      fillColor: pdfTheme.fills.header,
    },
    {
      text: 'DETALLES',
      bold: true,
      fontSize: pdfTheme.fontSize.sm,
      color: pdfTheme.text.primary,
      alignment: 'left',
      colSpan: 2,
      fillColor: pdfTheme.fills.header,
    },
    {},
    {
      text: 'NOTAS POR EQUIPO',
      bold: true,
      fontSize: pdfTheme.fontSize.sm,
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
      rows.push([
        buildTimeCell(seg),
        buildDetailsLeftCell(seg, allRooms),
        buildDetailsRightCell(seg),
        buildNotesCell(seg),
      ]);
    });

  return {
    table: {
      widths: [55, '*', 130, 180],
      body: rows,
      headerRows: 1,
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
      vLineWidth: () => 0.5,
      hLineColor: (i) => i === 1 ? '#9CA3AF' : pdfTheme.borders.color,
      vLineColor: () => pdfTheme.borders.lightColor,
      paddingTop: () => 3,
      paddingBottom: () => 3,
      paddingLeft: () => 4,
      paddingRight: () => 4,
    },
    margin: [0, 0, 0, 4],
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function generateEventReportPDFClient({ event, sessions, segmentsBySession, preSessionDetailsBySession, rooms = [] }) {
  const content = [];

  sessions.forEach((session, idx) => {
    // Session header with team info
    content.push(buildSessionHeader(event, session));

    // Pre-session details
    const psd = preSessionDetailsBySession?.[session.id];
    if (psd) {
      const psdBlock = buildPreSessionDetailsBlock(psd);
      if (psdBlock) content.push(psdBlock);
    }

    // Main table
    const allSegs = segmentsBySession?.[session.id] || [];
    content.push(buildDayTable(session, allSegs, rooms));

    // Page break after each session (except last)
    if (idx < sessions.length - 1) {
      content.push({ text: '', pageBreak: 'after' });
    }
  });

  const docDefinition = {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [18, 12, 18, 18],
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