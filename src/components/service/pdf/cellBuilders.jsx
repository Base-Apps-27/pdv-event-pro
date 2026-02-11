/**
 * PDF Cell Builders — Layout Intent System (Matching HTML Reports 1:1)
 * 
 * Extracted from generateEventReportsPDFClient.jsx (Phase 3E-1)
 * Decision: Phase 3 decomposition — zero behavior changes, verbatim extraction.
 * 
 * Exports:
 *   SESSION_COLOR_BG_MAP
 *   buildTimeCell(seg, sessionColor)
 *   buildDetailsLeftCell(seg, allRooms)
 *   calculateActionTimeForPDF(seg, act)
 *   buildDetailsRightCell(seg)
 */
import { pdfTheme, getSegmentColor, getLabelStyle, toESTTimeStr } from '../pdfThemeSystem';

// Session color to light background hex mapping for time cell visibility
export const SESSION_COLOR_BG_MAP = {
  green: '#DCFCE7',   // green-100
  blue: '#DBEAFE',    // blue-100
  pink: '#FCE7F3',    // pink-100
  orange: '#FFEDD5',  // orange-100
  yellow: '#FEF9C3',  // yellow-100
  purple: '#F3E8FF',  // purple-100
  red: '#FEE2E2',     // red-100
};

export function buildTimeCell(seg, sessionColor = null) {
  // Use session color background for visibility, fall back to default
  const bgColor = sessionColor && SESSION_COLOR_BG_MAP[sessionColor] 
    ? SESSION_COLOR_BG_MAP[sessionColor] 
    : pdfTheme.fills.timeCell;
  
  const stack = [
    {
      text: seg.start_time ? toESTTimeStr(seg.start_time) : '—',
      bold: true,
      color: '#000000', // Black text for contrast on colored background
      fontSize: pdfTheme.fontSize.lg,
    },
  ];

  if (seg.end_time) {
    stack.push({
      text: toESTTimeStr(seg.end_time),
      color: '#374151', // gray-700 for better contrast
      fontSize: pdfTheme.fontSize.sm,
      margin: [0, 0, 0, 0],
    });
  }

  if (seg.duration_min) {
    stack.push({
      text: `(${seg.duration_min}m)`,
      color: '#374151', // gray-700 for better contrast
      fontSize: pdfTheme.fontSize.xs,
      margin: [0, 0, 0, 0],
    });
  }

  // Translation mode indicator in time cell with emoji icons (using NotoEmoji font)
  if (seg.requires_translation) {
    const isInPerson = seg.translation_mode === 'InPerson';
    stack.push({
      text: isInPerson ? '🎙' : '🎧',
      font: 'NotoEmoji',
      fontSize: pdfTheme.fontSize.xs,
      color: '#7C3AED',
      alignment: 'center',
      margin: [0, 0, 0, 0],
    });
  }

  // Major break indicator with emoji icon
  if (seg.major_break) {
    stack.push({
      text: '🍽',
      font: 'NotoEmoji',
      fontSize: pdfTheme.fontSize.xs,
      color: '#EA580C',
      alignment: 'center',
      margin: [0, 0, 0, 0],
    });
  }

  return {
    stack,
    verticalAlign: 'top',
    fillColor: bgColor,
  };
}

export function buildDetailsLeftCell(seg, allRooms = []) {
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

  // Presenter - use label only for breaks (ENCARGADO), otherwise just show name
  if (seg.presenter) {
    const isBreakType = ['Break', 'Receso', 'Almuerzo'].includes(seg.segment_type);
    if (isBreakType) {
      stack.push({
        text: [
          { text: 'ENCARGADO: ', bold: true, color: '#2563EB', fontSize: pdfTheme.fontSize.sm },
          { text: seg.presenter, color: '#1E40AF', fontSize: pdfTheme.fontSize.sm },
        ],
        margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
      });
    } else {
      stack.push({
        text: seg.presenter,
        color: '#2563EB',
        fontSize: pdfTheme.fontSize.sm,
        bold: true,
        margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
      });
    }
  }

  // Break type visual distinction (Receso/Almuerzo) - inline, no box
  if (['Receso', 'Almuerzo'].includes(seg.segment_type)) {
    const isLunch = seg.segment_type === 'Almuerzo';
    stack.push({
      text: [
        { text: isLunch ? '🍽 ' : '☕ ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.sm },
        { text: `${seg.duration_min || 0} min`, bold: true, color: isLunch ? '#C2410C' : '#374151', fontSize: pdfTheme.fontSize.xs },
      ],
      margin: [0, 0, 0, 0],
    });
  }

  // Translation for breaks (Receso/Almuerzo) - show if present
  // All translation items use purple color scheme
  if (['Receso', 'Almuerzo'].includes(seg.segment_type) && seg.requires_translation) {
    const isInPerson = seg.translation_mode === 'InPerson';
    stack.push({
      text: [
        { text: isInPerson ? '🎙 ' : '🎧 ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.sm },
        { text: isInPerson ? 'TRAD-TARIMA' : 'TRAD-CABINA', bold: true, color: '#7C3AED', fontSize: pdfTheme.fontSize.sm },
        seg.translator_name ? { text: `: ${seg.translator_name}`, color: '#6D28D9', fontSize: pdfTheme.fontSize.sm } : '',
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Translation - InPerson (on stage) - emoji icon for TARIMA
  // All translation items use purple color scheme
  if (seg.requires_translation && seg.translation_mode === 'InPerson' && !['Receso', 'Almuerzo'].includes(seg.segment_type)) {
    stack.push({
      text: [
        { text: '🎙 ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.sm },
        { text: 'TRAD-TARIMA', bold: true, color: '#7C3AED', fontSize: pdfTheme.fontSize.sm },
        seg.translator_name ? { text: `: ${seg.translator_name}`, color: '#6D28D9', fontSize: pdfTheme.fontSize.sm } : '',
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // NOTE: RemoteBooth (headphones/booth) translation is shown ONLY in the notes column
  // to avoid duplication - see buildNotesCell() for booth translation display

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

  // Video info - full details matching HTML (in details left column)
  if (seg.has_video) {
    const videoParts = [
      { text: '🎬 ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.sm },
      { text: 'VIDEO: ', bold: true, color: '#1E40AF', fontSize: pdfTheme.fontSize.sm },
    ];
    if (seg.video_name) videoParts.push({ text: seg.video_name, color: '#1E3A8A', fontSize: pdfTheme.fontSize.sm });
    if (seg.video_length_sec) {
      const mins = Math.floor(seg.video_length_sec / 60);
      const secs = seg.video_length_sec % 60;
      videoParts.push({ text: ` - ${mins}:${String(secs).padStart(2, '0')}`, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs });
    } else {
      videoParts.push({ text: ' - 0:00', color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs });
    }
    if (seg.video_location) videoParts.push({ text: ` • ${seg.video_location}`, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs });
    if (seg.video_owner) videoParts.push({ text: ` • ${seg.video_owner}`, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs });
    stack.push({ text: videoParts, margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom] });
  }

  // Prep instructions (if present and not shown elsewhere)
  if (seg.prep_instructions) {
    stack.push({
      text: [
        { text: 'PREP: ', bold: true, color: '#B45309', fontSize: pdfTheme.fontSize.xs },
        { text: seg.prep_instructions, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.xs, italics: true },
      ],
      fillColor: '#FFFBEB',
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
  }

  // Scripture references (for Plenarias)
  if (seg.scripture_references) {
    stack.push({
      text: [
        { text: '📖 ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.xs },
        { text: 'CITAS: ', bold: true, color: '#1E40AF', fontSize: pdfTheme.fontSize.xs },
        { text: seg.scripture_references, color: '#1E3A8A', fontSize: pdfTheme.fontSize.xs },
      ],
      margin: [0, 0, 0, pdfTheme.spacing.textMarginBottom],
    });
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
      // Translation indicator with emoji
      if (room.requires_translation) {
        const isInPerson = room.translation_mode === 'InPerson';
        cardStack.push({
          text: [
            { text: isInPerson ? '🎙 ' : '🎧 ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.xs },
            room.translator_name ? { text: room.translator_name, color: '#7C3AED', fontSize: pdfTheme.fontSize.xs } : { text: 'Traducción', color: '#7C3AED', fontSize: pdfTheme.fontSize.xs, italics: true },
          ],
          margin: [0, 0, 0, 0.5],
        });
      }
      // General notes for room
      if (room.general_notes) {
        cardStack.push({
          text: room.general_notes,
          color: pdfTheme.text.muted,
          fontSize: pdfTheme.fontSize.xs,
          italics: true,
          margin: [0, 0, 0, 0.5],
        });
      }
      // Other notes for room
      if (room.other_notes) {
        cardStack.push({
          text: room.other_notes,
          color: pdfTheme.text.muted,
          fontSize: pdfTheme.fontSize.xs,
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

// Helper to calculate action time for PDF
export function calculateActionTimeForPDF(seg, act) {
  const segmentStart = seg.start_time;
  const segmentEnd = seg.end_time;
  if (!segmentStart) return null;
  
  const [startH, startM] = segmentStart.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  
  let endMinutes = startMinutes + (seg.duration_min || 0);
  if (segmentEnd) {
    const [endH, endM] = segmentEnd.split(':').map(Number);
    endMinutes = endH * 60 + endM;
  }
  
  const offset = act.offset_min || 0;
  let targetMinutes;
  
  switch (act.timing) {
    case 'before_start':
      targetMinutes = startMinutes - offset;
      break;
    case 'after_start':
      targetMinutes = startMinutes + offset;
      break;
    case 'before_end':
      targetMinutes = endMinutes - offset;
      break;
    case 'absolute':
      return act.absolute_time ? toESTTimeStr(act.absolute_time) : null;
    default:
      return null;
  }
  
  if (targetMinutes < 0) targetMinutes += 24 * 60;
  const h = Math.floor(targetMinutes / 60) % 24;
  const m = targetMinutes % 60;
  return toESTTimeStr(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

export function buildDetailsRightCell(seg) {
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
      const required = act.is_required ? '*' : '';
      const actionTime = calculateActionTimeForPDF(seg, act);
      const notes = act.notes || '';

      stack.push({
        text: [
          dept ? { text: dept, bold: true, fontSize: pdfTheme.fontSize.xs, color: '#6B7280' } : '',
          { text: label, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.sm },
          required ? { text: ` ${required}`, color: '#DC2626', fontSize: pdfTheme.fontSize.sm, bold: true } : '',
          actionTime ? { text: ` @ ${actionTime}`, color: '#1D4ED8', fontSize: pdfTheme.fontSize.xs, bold: true } : '',
          notes ? { text: `\n${notes}`, color: pdfTheme.text.muted, fontSize: pdfTheme.fontSize.xs, italics: true } : '',
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