/**
 * PDF Section Builders — Session headers, pre-session details, PREP action rows
 * 
 * Extracted from generateEventReportsPDFClient.jsx (Phase 3E-2)
 * Decision: Phase 3 decomposition — zero behavior changes, verbatim extraction.
 * 
 * Exports:
 *   buildNotesCell(seg)
 *   buildSessionHeader(event, session, hasHospitalityTasks)
 *   buildPreSessionDetailsBlock(psd)
 *   buildPrepActionRow(act, seg)
 *   buildBreakPrepActionRow(act, seg)
 */
// Phase 3 cleanup: removed unused getSegmentColor import
import { pdfTheme, toESTTimeStr } from '../pdfThemeSystem';
import { calculateActionTimeForPDF } from './cellBuilders';
// 2026-02-28: Smart routing import removed from Detailed PDF notes cell.
// AUTO routing only used on filtered per-department surfaces, not "show everything" views.

export function buildNotesCell(seg) {
  const stack = [];

  // NOTE: PREP actions are now rendered as separate full-width rows below the segment
  // See buildPrepActionRow() function

  // Team notes - ALL notes matching HTML (full labels, no truncation)
  // Color coding:
  // - Projection: slate (#475569 text, #F1F5F9 bg) - distinct from translation
  // - Translation & Stage & Decor: purple (#7C3AED text, #F5F3FF bg)
  // - Sound: red
  // - Ujieres: green
  // 2026-02-28: Added COORDINACIÓN — was missing from event reports (present in weekly PDF + entity schema)
  const notes = [
    { label: 'COORDINACIÓN', val: seg.coordinator_notes, color: '#F97316', bg: '#FFF7ED' },
    { label: 'PROYECCIÓN', val: seg.projection_notes, color: '#475569', bg: '#F1F5F9' },
    { label: 'SONIDO', val: seg.sound_notes, color: '#DC2626', bg: '#FEF2F2' },
    { label: 'UJIERES', val: seg.ushers_notes, color: '#16A34A', bg: '#F0FDF4' },
    { label: 'STAGE & DECOR', val: seg.stage_decor_notes, color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'TRAD', val: seg.translation_notes, color: '#7C3AED', bg: '#F5F3FF' },
    // 2026-02-28: Added LIVESTREAM — was missing (present on entity + weekly PDF)
    { label: 'LIVESTREAM', val: seg.livestream_notes, color: '#0891B2', bg: '#ECFEFF' },
    { label: 'OTRO', val: seg.other_notes, color: '#6B7280', bg: '#F9FAFB' },
  ].filter(n => n.val);

  // Microphone assignments (often shown in SONIDO context)
  if (seg.microphone_assignments) {
    stack.push({
      text: [
        { text: 'MICS: ', bold: true, color: '#DC2626', fontSize: pdfTheme.fontSize.xs },
        { text: seg.microphone_assignments, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.xs },
      ],
      fillColor: '#FEF2F2',
      margin: [0, 0, 0, 1],
    });
  }

  // Video info in notes column (matching HTML) with timecode marker
  if (seg.has_video && (seg.video_name || seg.video_location)) {
    const videoParts = [
      { text: '🎬 ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.xs },
      { text: 'VIDEO: ', bold: true, color: '#1E40AF', fontSize: pdfTheme.fontSize.xs },
      { text: seg.video_name || seg.video_location || '', fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.secondary },
    ];
    // Include video length as timecode marker
    if (seg.video_length_sec !== undefined && seg.video_length_sec !== null) {
      const mins = Math.floor(seg.video_length_sec / 60);
      const secs = seg.video_length_sec % 60;
      videoParts.push({ text: ` [${mins}:${String(secs).padStart(2, '0')}]`, bold: true, fontSize: pdfTheme.fontSize.xs, color: '#6B21A8' });
    } else {
      videoParts.push({ text: ' [0:00]', bold: true, fontSize: pdfTheme.fontSize.xs, color: '#6B21A8' });
    }
    stack.push({
      text: videoParts,
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

  // Translation info for notes column - ONLY booth translation (stage is shown inline with presenter)
  // All translation items use purple color scheme
  if (seg.requires_translation && seg.translation_mode === 'RemoteBooth') {
    stack.push({
      text: [
        { text: '🎧 ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.xs },
        { text: 'TRAD-CABINA', bold: true, color: '#7C3AED', fontSize: pdfTheme.fontSize.xs },
        seg.translator_name ? { text: `: ${seg.translator_name}`, color: '#7C3AED', fontSize: pdfTheme.fontSize.xs } : '',
      ],
      fillColor: '#F5F3FF',
      margin: [0, 0, 0, 1],
    });
  }

  // 2026-02-28: Smart-routed arts AUTO blocks REMOVED from Detailed PDF notes cell.
  // Rationale: Detailed PDF shows ALL departments + full arts detail in the details cell,
  // so per-department AUTO routing duplicates the same data 5x. AUTO routing remains on
  // filtered surfaces: MyProgram, individual HTML reports, individual PDF reports.
  // See Decision: "Smart routing only on filtered views".

  return {
    stack: stack.length ? stack : [{ text: '—', fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.muted }],
    verticalAlign: 'top',
    fillColor: pdfTheme.fills.notesCell,
  };
}

// ============================================================================
// SESSION HEADER - Matching HTML team grid exactly
// ============================================================================

export function buildSessionHeader(event, session, hasHospitalityTasks = false) {
  const stack = [];

  // Event name + Session name
  const dateStr = session?.date
    ? new Date(session.date + 'T12:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
    : '';
  const timeStr = session?.planned_start_time ? toESTTimeStr(session.planned_start_time) : '';
  const locStr = session?.location || '';
  const arrivalStr = session?.default_stage_call_offset_min ? `Llegada: ${session.default_stage_call_offset_min} min antes` : '';

  // Build session title with indicators
  const titleParts = [
    { text: (event?.name || 'EVENT').toUpperCase() + ' — ', color: '#1F8A70', bold: true, fontSize: pdfTheme.fontSize.title },
    { text: (session?.name || 'SESSION').toUpperCase(), bold: true, color: pdfTheme.text.primary, fontSize: pdfTheme.fontSize.title },
  ];
  // Hospitality tasks indicator (🍴)
  if (hasHospitalityTasks) {
    titleParts.push({ text: ' 🍴', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.lg, color: '#DB2777' });
  }
  // Translated session indicator (🌐)
  if (session?.is_translated_session) {
    titleParts.push({ text: ' 🌐', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.lg });
  }

  stack.push({
    text: titleParts,
    margin: [0, 0, 0, 1],
  });

  // Date/time/location line
  const meta = [dateStr, timeStr, locStr].filter(x => x).join(' • ');
  if (meta || arrivalStr) {
    stack.push({
      text: [
        { text: meta, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.base },
        arrivalStr ? { text: ` • ${arrivalStr}`, color: '#EA580C', fontSize: pdfTheme.fontSize.base, bold: true } : '',
      ],
      margin: [0, 0, 0, 1],
    });
  }

  // Team info grid - matching HTML exactly (full team roster)
  const teams = [];
  if (session?.worship_leader) teams.push({ label: 'ALAB', value: session.worship_leader, color: '#16A34A' });
  if (session?.coordinators) teams.push({ label: 'COORD', value: session.coordinators, color: '#4F46E5' });
  if (session?.admin_team) teams.push({ label: 'ADMIN', value: session.admin_team, color: '#EA580C' });
  if (session?.sound_team) teams.push({ label: 'SONIDO', value: session.sound_team, color: '#DC2626' });
  if (session?.lights_team) teams.push({ label: 'LUCES', value: session.lights_team, color: '#D97706' });
  if (session?.video_team) teams.push({ label: 'VIDEO', value: session.video_team, color: '#0891B2' });
  if (session?.tech_team) teams.push({ label: 'TÉC', value: session.tech_team, color: '#7C3AED' });
  if (session?.translation_team) teams.push({ label: 'TRAD', value: session.translation_team, color: '#7C3AED' });
  if (session?.hospitality_team) teams.push({ label: 'HOSP', value: session.hospitality_team, color: '#DB2777' });
  if (session?.photography_team) teams.push({ label: 'FOTO', value: session.photography_team, color: '#0D9488' });
  if (session?.ushers_team) teams.push({ label: 'UJIERES', value: session.ushers_team, color: '#2563EB' });
  if (session?.presenter) teams.push({ label: 'PRES', value: session.presenter, color: '#2563EB' });

  if (teams.length > 0) {
    // Build 5-column grid for more compact layout
    const rows = [];
    for (let i = 0; i < teams.length; i += 5) {
      const rowCells = teams.slice(i, i + 5).map(t => ({
        text: [
          { text: `${t.label}: `, bold: true, color: t.color, fontSize: pdfTheme.fontSize.xs },
          { text: t.value, color: pdfTheme.text.secondary, fontSize: pdfTheme.fontSize.xs },
        ],
        fillColor: '#FAFAFA',
        margin: [1, 0, 1, 0],
      }));
      // Pad to 5 columns
      while (rowCells.length < 5) {
        rowCells.push({ text: '', fillColor: '#FAFAFA' });
      }
      rows.push(rowCells);
    }

    stack.push({
      table: {
        widths: ['*', '*', '*', '*', '*'],
        body: rows,
      },
      layout: {
        hLineWidth: () => 0.25,
        vLineWidth: () => 0.25,
        hLineColor: () => '#E5E7EB',
        vLineColor: () => '#E5E7EB',
        paddingTop: () => 1,
        paddingBottom: () => 1,
      },
      margin: [0, 0, 0, 2],
    });
  }

  return { stack, margin: [0, 0, 0, 2] };
}

// ============================================================================
// PRE-SESSION DETAILS - Matching HTML exactly
// ============================================================================

export function buildPreSessionDetailsBlock(psd) {
  if (!psd) return null;

  const details = [];

  if (psd.music_profile_id) details.push({ icon: '🎵', useEmoji: true, label: 'Música', value: psd.music_profile_id });
  if (psd.slide_pack_id) details.push({ icon: '📊', useEmoji: true, label: 'Slides', value: psd.slide_pack_id });
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
    // Inline details separated by bullets
    const textParts = [];
    details.forEach((d, idx) => {
      if (d.useEmoji && d.icon) {
        textParts.push({ text: d.icon + ' ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.xs });
      }
      textParts.push({ text: `${d.label}: `, bold: true, fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.secondary });
      textParts.push({ text: d.value, fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.primary });
      if (idx < details.length - 1) {
        textParts.push({ text: ' • ', fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.muted });
      }
    });
    stack.push({
      text: textParts,
      margin: [0, 0, 0, 1],
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
    margin: [0, 0, 0, 2],
  };
}

// ============================================================================
// PREP ACTION ROW — Full-width styled row matching HTML
// ============================================================================

export function buildPrepActionRow(act, seg) {
  const dept = act.department ? `[${act.department}]` : '';
  const label = act.label || '';
  const actionTime = seg ? calculateActionTimeForPDF(seg, act) : null;
  const required = act.is_required ? ' *' : '';
  const notes = act.notes ? ` — ${act.notes}` : '';

  return [
    {
      colSpan: 4,
      fillColor: '#FFFBEB',
      stack: [{
        columns: [
          {
            width: 55,
            stack: [{
              text: [
                { text: '⚠ ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.xs },
                { text: 'PREP', bold: true, fontSize: pdfTheme.fontSize.xs, color: '#FFFFFF' },
              ],
              alignment: 'center',
              margin: [0, 2, 0, 2],
            }],
            fillColor: '#F59E0B',
          },
          {
            width: '*',
            text: [
              dept ? { text: `${dept} `, bold: true, fontSize: pdfTheme.fontSize.sm, color: '#92400E' } : '',
              { text: label, fontSize: pdfTheme.fontSize.sm, color: pdfTheme.text.secondary },
              required ? { text: required, fontSize: pdfTheme.fontSize.sm, color: '#DC2626', bold: true } : '',
              actionTime ? { text: `  @ ${actionTime}`, fontSize: pdfTheme.fontSize.xs, color: '#B45309', bold: true } : '',
              notes ? { text: notes, fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.muted, italics: true } : '',
            ],
            margin: [4, 2, 0, 2],
          },
        ],
      }],
    },
    {},
    {},
    {},
  ];
}

// Build PREP action rows for break types (Receso/Almuerzo) - same layout as regular segments
export function buildBreakPrepActionRow(act, seg) {
  const dept = act.department ? `[${act.department}]` : '';
  const label = act.label || '';
  const actionTime = seg ? calculateActionTimeForPDF(seg, act) : null;
  const required = act.is_required ? ' *' : '';
  const notes = act.notes ? ` — ${act.notes}` : '';

  return [
    {
      colSpan: 4,
      fillColor: '#FFFBEB',
      stack: [{
        columns: [
          {
            width: 55,
            stack: [{
              text: [
                { text: '⚠ ', font: 'NotoEmoji', fontSize: pdfTheme.fontSize.xs },
                { text: 'PREP', bold: true, fontSize: pdfTheme.fontSize.xs, color: '#FFFFFF' },
              ],
              alignment: 'center',
              margin: [0, 2, 0, 2],
            }],
            fillColor: '#F59E0B',
          },
          {
            width: '*',
            text: [
              dept ? { text: `${dept} `, bold: true, fontSize: pdfTheme.fontSize.sm, color: '#92400E' } : '',
              { text: label, fontSize: pdfTheme.fontSize.sm, color: pdfTheme.text.secondary },
              required ? { text: required, fontSize: pdfTheme.fontSize.sm, color: '#DC2626', bold: true } : '',
              actionTime ? { text: `  @ ${actionTime}`, fontSize: pdfTheme.fontSize.xs, color: '#B45309', bold: true } : '',
              notes ? { text: notes, fontSize: pdfTheme.fontSize.xs, color: pdfTheme.text.muted, italics: true } : '',
            ],
            margin: [4, 2, 0, 2],
          },
        ],
      }],
    },
    {},
    {},
    {},
  ];
}