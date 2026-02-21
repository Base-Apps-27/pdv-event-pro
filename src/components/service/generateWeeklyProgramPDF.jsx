/**
 * WEEKLY SERVICE PDF GENERATOR
 * 
 * SYNC PROTOCOL: See components/service/PDF_SYNC_PROTOCOL.md
 * - Shares rendering standards with generateProgramPDF.jsx (colors, fonts, presenter hierarchy)
 * - Intentional divergence: 2-column layout, time-slot segmentation, sub_assignments structure
 * - When updating colors, fonts, or label hierarchy: UPDATE BOTH GENERATORS
 * - When adding layout features: clarify if it's weekly-only or applies to custom too
 */

import pdfMake from 'pdfmake/build/pdfmake';
import { getLogoDataUrl } from './pdfLogoData';
import { es } from "date-fns/locale";
import { addMinutes, format } from "date-fns";
import { BRAND, formatDate, safeParseTimeSlot } from './pdfUtils';

// Font setup now handled in pdfUtils (imported indirectly or assumed set)
// Redundant check doesn't hurt
import pdfFonts from 'pdfmake/build/vfs_fonts';
if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}

/**
 * Heuristic scaling for Weekly Services (2 columns)
 * Checks the denser column to determine scale
 * UPDATED: Now accounts for text density in notes
 */
export function estimateWeeklyOptimalScale(serviceData) {
  // Revised Heuristic: Accounts for "Box" overhead and uses continuous scaling
  const countContent = (segments, preServiceNote) => {
    let units = 0;
    
    // Pre-service note
    if (preServiceNote) {
      units += 2 + Math.ceil(preServiceNote.length / 60);
    }

    if (!segments) return units;

    segments.filter(s => s.type !== 'break').forEach(seg => {
      // 1. Header (Time + Title + Duration) - Approx 2 lines + margins
      units += 2.5;

      // 2. Roles (Leader/Preacher/Presenter/Translator)
      if (seg.data?.leader || seg.data?.preacher || seg.data?.presenter) units += 1.1;
      if (seg.requires_translation && seg.data?.translator) units += 1.1;

      // 3. Songs (Boxed)
      // Box overhead (padding/margins) = ~1.5 lines
      const songCount = seg.songs?.filter(s => s.title).length || 0;
      if (songCount > 0) {
        units += 1.5 + (songCount * 1.1);
      }

      // 4. Sub-assignments
      if (seg.sub_assignments) {
        seg.sub_assignments.forEach(sub => {
          if (seg.data?.[sub.person_field_name]) units += 1.1;
        });
      }
      // Legacy ministry fallback
      if (!seg.sub_assignments?.length && seg.data?.ministry_leader) units += 1.1;

      // 5. Message Box (Title + Verse)
      const messageTitle = seg.data?.title || seg.data?.messageTitle;
      const hasMessageTitle = messageTitle && seg.type === 'message';
      const hasVerse = !!seg.data?.verse;
      if (hasMessageTitle || hasVerse) {
        units += 1.5; // Box overhead
        if (hasMessageTitle) units += 1.2;
        if (hasVerse) units += 0.5 + Math.ceil(seg.data.verse.length / 60);
      }

      // 6. Notes (Boxed)
      const noteFields = [
        seg.data?.coordinator_notes,
        seg.data?.projection_notes,
        seg.data?.sound_notes,
        seg.data?.ushers_notes,
        seg.data?.translation_notes,
        seg.data?.stage_decor_notes,
        seg.data?.description_details,
        seg.data?.description
      ];

      noteFields.forEach(note => {
        if (note) {
          // Box overhead per note + content
          // Truncated at 350 chars (~5-6 lines at 7.5pt)
          const effectiveLength = Math.min(note.length, 350);
          units += 1.2 + Math.ceil(effectiveLength / 75); 
        }
      });

      // 7. Actions/Cues (Boxed)
      if (seg.actions?.length > 0) {
         // Separate boxes for prep vs during?
         const prepCount = seg.actions.filter(a => a.timing === 'before_start').length;
         const duringCount = seg.actions.filter(a => a.timing !== 'before_start').length;
         
         if (prepCount > 0) units += 1.5 + prepCount; // Box + items
         if (duringCount > 0) units += 1.5 + duringCount; // Box + items
      }

      // 8. Inter-segment Spacing
      units += 1.0;
    });

    return units;
  };

  // Entity Lift: dynamic slots from serviceData._slotNames or legacy fallback
  const slotNames = serviceData._slotNames || ["9:30am", "11:30am"];
  const loads = slotNames.map(name => countContent(serviceData[name], serviceData.pre_service_notes?.[name]));
  const maxLoad = Math.max(...loads, 0);

  // Continuous Scaling Formula (Aggressive Mode)
  // Target: 50 units per column. Lowering to ensure fit.
  const TARGET_CAPACITY = 50;
  
  let scale = 1.0;
  if (maxLoad > TARGET_CAPACITY) {
    scale = TARGET_CAPACITY / maxLoad;
  }

  // Lower floor to 0.40 to accommodate huge blocks of text
  return Math.max(0.40, Math.min(1.0, scale));
}

export async function generateWeeklyProgramPDF(serviceData) {
  // Use manual scale if provided in serviceData, otherwise heuristic
  const heuristicScale = estimateWeeklyOptimalScale(serviceData);
  let globalScale = heuristicScale;
  
  // If user explicitly set a scale, use it
  if (serviceData.print_settings_page1?.globalScale) {
     globalScale = serviceData.print_settings_page1.globalScale;
  }

  const logoDataUrl = await getLogoDataUrl();

  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [24, 36, 24, 40],

    // Brand Header Bar
    background: function(currentPage, pageSize) {
      if (currentPage === 1) {
        return {
          canvas: [
            {
              type: 'rect',
              x: 0, y: 0, w: pageSize.width, h: 12,
              linearGradient: [BRAND.TEAL, BRAND.GREEN, BRAND.LIME]
            }
          ]
        };
      }
      return null;
    },

    content: [
      // Header
      buildHeader(serviceData, logoDataUrl, globalScale),
      
      // Team Info
      buildWeeklyTeamInfo(serviceData, globalScale),

      // Divider
      { 
        canvas: [{ 
          type: 'line', x1: 0, y1: 0, x2: 540, y2: 0, lineWidth: 2, lineColor: BRAND.GREEN 
        }], 
        margin: [0, 0, 0, 12] 
      },

      // Entity Lift: Dynamic column generation from slot names
      (() => {
        const pdfSlots = serviceData._slotNames || ["9:30am", "11:30am"];
        const SLOT_COLORS = [BRAND.RED, BRAND.BLUE, BRAND.TEAL, '#9333EA']; // color per column
        const columns = [];
        pdfSlots.forEach((slotName, idx) => {
          if (idx > 0) columns.push({ width: 24, text: '' }); // Gutter
          columns.push({
            width: '*',
            stack: [
              { text: slotName.replace('am', ' A.M.').replace('pm', ' P.M.').toUpperCase(), fontSize: 14 * globalScale, bold: true, color: SLOT_COLORS[idx % SLOT_COLORS.length], margin: [0, 0, 0, 8] },
              ...buildWeeklySegments(serviceData[slotName], slotName, globalScale, serviceData.pre_service_notes?.[slotName], SLOT_COLORS[idx % SLOT_COLORS.length])
            ]
          });
        });
        return { columns };
      })(),

      // Receso (Bottom)
      buildReceso(serviceData, globalScale)
    ],

    footer: (currentPage, pageCount) => ({
      stack: [
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 612, h: 4, linearGradient: [BRAND.TEAL, BRAND.GREEN, BRAND.LIME] }] },
        {
          text: '¡ATRÉVETE A CAMBIAR!',
          color: BRAND.BLACK,
          fontSize: 10,
          bold: true,
          alignment: 'center',
          margin: [0, 10, 0, 10]
        }
      ],
      margin: [0, 0, 0, 0]
    }),

    defaultStyle: {
      fontSize: 10 * globalScale,
      // Dynamic line height: condense spacing when scaling down
      lineHeight: globalScale < 0.85 ? 0.9 : 1.2,
      color: BRAND.BLACK
    }
  };

  return pdfMake.createPdf(docDefinition);
}

function buildHeader(serviceData, logoDataUrl, scale) {
  // Use centralized formatDate if available, otherwise manual format matches style
  let dateStr = '';
  if (serviceData.date) {
    const parsed = new Date(serviceData.date + 'T12:00:00');
    if (!isNaN(parsed.getTime())) {
      dateStr = format(parsed, "d 'de' MMMM, yyyy", { locale: es });
    }
  }

  return {
    columns: [
      logoDataUrl ? { width: 60, image: logoDataUrl, fit: [60, 60] } : { width: 60, text: '' },
      { width: '*', text: '' },
      {
        width: 'auto',
        stack: [
          {
            text: 'ORDEN DE SERVICIO',
            fontSize: 22 * scale,
            bold: true,
            alignment: 'center',
            color: BRAND.BLACK,
            characterSpacing: 0.5,
            margin: [0, 4, 0, 2]
          },
          {
            text: `DOMINGO ${dateStr}`.toUpperCase(),
            fontSize: 10 * scale,
            bold: true,
            alignment: 'center',
            color: BRAND.TEAL,
            characterSpacing: 1,
            margin: [0, 0, 0, 4]
          }
        ]
      },
      { width: '*', text: '' },
      { width: 60, text: '' }
    ],
    margin: [0, 0, 0, 8]
  };
}

function buildWeeklyTeamInfo(serviceData, scale) {
  // Entity Lift: pick team from first available slot
  const firstSlot = (serviceData._slotNames || ["9:30am"])[0];
  const teams = [
    { label: 'Coordinador', value: serviceData.coordinators?.[firstSlot] },
    { label: 'Ujier', value: serviceData.ujieres?.[firstSlot] },
    { label: 'Sonido', value: serviceData.sound?.[firstSlot] },
    { label: 'Luces', value: serviceData.luces?.[firstSlot] },
    { label: 'Foto', value: serviceData.fotografia?.[firstSlot] }
  ].filter(t => t.value);

  if (teams.length === 0) return null;

  return {
    text: teams.map(t => [
      { text: `${t.label}: `, bold: true, color: BRAND.BLACK },
      { text: t.value, color: BRAND.GRAY }
    ]).flat().reduce((acc, curr, idx) => {
      if (idx > 0) acc.push({ text: ' / ', color: BRAND.LIGHT_GRAY });
      acc.push(curr);
      return acc;
    }, []),
    fontSize: 9 * scale,
    alignment: 'center',
    margin: [0, 0, 0, 8]
  };
}

function buildWeeklySegments(segments, timeSlot, scale, preServiceNote, slotColor) {
  const items = [];

  // Pre-service Note
  if (preServiceNote) {
    items.push({
      text: preServiceNote,
      fontSize: 9.5 * scale,
      color: '#14532D',
      background: '#F0FDF4',
      margin: [0, 0, 0, 8],
      padding: [4, 4, 4, 4]
    });
  }

  if (!segments) return items;

  // Centralised safe time parser — eliminates RangeError: Invalid time value
  let currentTime = safeParseTimeSlot(timeSlot);

  segments.filter(s => s.type !== 'break').forEach((seg, idx) => {
    // Calculate time
    const timeStr = format(currentTime, "h:mm a");
    currentTime = addMinutes(currentTime, seg.duration || 0);

    // Header: Time + Title + Duration
    items.push({
      text: [
        { text: timeStr, bold: true, color: slotColor || BRAND.RED, fontSize: 10 * scale },
        { text: '  ' + (seg.title || '').toUpperCase(), bold: true, color: BRAND.BLACK, fontSize: 10.5 * scale },
        seg.type ? { text: `  ${seg.type.toUpperCase()}  `, color: '#374151', background: '#F3F4F6', fontSize: 7 * scale, bold: true } : '',
        { text: ` (${seg.duration} min)`, color: BRAND.GRAY, fontSize: 9 * scale }
      ],
      margin: [0, idx > 0 ? 6 : 0, 0, 2]
    });

    // Content: Roles (Strict Hierarchy, No Emojis)
    const segmentType = seg.segment_type || seg.type || seg.data?.type || '';
    const isWorship = ['Alabanza', 'worship'].includes(segmentType);
    const isMessage = ['Plenaria', 'message', 'Message'].includes(segmentType);
    
    // Presenter (Non-Worship/Non-Message)
    if (!isWorship && !isMessage && seg.data?.presenter) {
      // Logic from PublicProgramSegment: Show "MINISTRA: Name" or just "Name"
      const label = segmentType === 'Ministración' ? 'MINISTRA: ' : '';
      items.push({
        text: [
          label ? { text: label, bold: true, color: '#2563EB', fontSize: 9 * scale } : '', // Blue-600
          { text: seg.data.presenter, bold: true, color: '#2563EB', fontSize: 10 * scale } // Name is larger/bolder
        ],
        margin: [8, 0, 0, 1]
      });
    }

    // Leader (Worship)
    if (isWorship && seg.data?.leader) {
      items.push({
        text: [
          { text: 'DIRIGE: ', bold: true, color: '#16A34A', fontSize: 9 * scale }, // Green-600
          { text: seg.data.leader, bold: true, color: '#16A34A', fontSize: 10 * scale }
        ],
        margin: [8, 0, 0, 1]
      });
    }

    // Preacher (Message)
    if (isMessage && seg.data?.preacher) {
      items.push({
        text: [
          { text: 'PREDICA: ', bold: true, color: '#4F46E5', fontSize: 9 * scale }, // Indigo-600
          { text: seg.data.preacher, bold: true, color: '#4F46E5', fontSize: 10 * scale }
        ],
        margin: [8, 0, 0, 1]
      });
    }

    // Panel moderators/panelists (rare in weekly, safe to render if present)
    if (seg.data?.panel_moderators || seg.data?.panel_panelists) {
      if (seg.data.panel_moderators) {
        items.push({
          text: [
            { text: 'MODERADOR(ES): ', bold: true, color: '#B45309', fontSize: 9 * scale },
            { text: seg.data.panel_moderators, bold: true, color: '#92400E', fontSize: 9.5 * scale }
          ],
          margin: [8, 0, 0, 1]
        });
      }
      if (seg.data.panel_panelists) {
        items.push({
          text: [
            { text: 'PANELISTA(S): ', bold: true, color: '#B45309', fontSize: 9 * scale },
            { text: seg.data.panel_panelists, bold: true, color: '#92400E', fontSize: 9.5 * scale }
          ],
          margin: [8, 0, 0, 1]
        });
      }
    }

    // Songs - Styled Box (Slate-50)
    if (seg.songs && seg.songs.some(s => s.title)) {
      items.push({
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                { text: 'CANCIONES:', bold: true, fontSize: 8.5 * scale, color: '#334155', margin: [0, 0, 0, 2] },
                ...seg.songs.filter(s => s.title).map((song, i) => ({
                  text: [
                    { text: `${i + 1}. `, color: '#64748B', fontSize: 8.5 * scale },
                    { text: song.title, color: '#0F172A', fontSize: 9 * scale, bold: true },
                    song.lead ? { text: ` (${song.lead})`, color: '#64748B', fontSize: 8.5 * scale, italics: true } : '',
                    song.key ? { text: ` [${song.key}]`, color: '#64748B', fontSize: 8 * scale, bold: true } : ''
                  ],
                  margin: [0, 0, 0, 1]
                }))
              ],
              fillColor: '#F8FAFC', // Slate-50
              border: [true, true, true, true],
              borderColor: ['#E2E8F0', '#E2E8F0', '#E2E8F0', '#E2E8F0'], // Slate-200
              margin: [4, 4, 4, 4]
            }
          ]]
        },
        margin: [8, 4, 0, 4]
      });
    }

    // DIVERGENCE (per PDF_SYNC_PROTOCOL.md): Sub-assignments are WEEKLY-ONLY (legacy DB structure)
    // Weekly services use structured seg.sub_assignments[] records with backwards-compatibility
    // Custom services use flat seg.sub_asignaciones[] array (new feature)
    // Do NOT apply custom sub_asignaciones logic here; use this pattern for weekly services only
    if (seg.sub_assignments) {
      seg.sub_assignments.forEach(sub => {
        const val = seg.data?.[sub.person_field_name];
        if (val) {
          items.push({
            text: [
              { text: `${sub.label}: `, bold: true, fontSize: 9.5 * scale },
              { text: val, color: BRAND.PURPLE, fontSize: 9.5 * scale },
              sub.duration_min ? { text: ` (${sub.duration_min} min)`, fontSize: 8.5 * scale, color: BRAND.GRAY } : ''
            ],
            margin: [8, 1, 0, 1]
          });
        }
      });
    }

    // Legacy Ministry Leader Fallback
    if (!seg.sub_assignments?.length && seg.data?.ministry_leader) {
      items.push({
        text: [
          { text: 'Ministración: ', bold: true, fontSize: 9.5 * scale },
          { text: seg.data.ministry_leader, color: BRAND.PURPLE, fontSize: 9.5 * scale },
          { text: ' (5 min)', fontSize: 8.5 * scale, color: BRAND.GRAY }
        ],
        margin: [8, 1, 0, 1]
      });
    }

    // Translator - Subordinate Style with mode distinction
    // InPerson = on stage with speaker, RemoteBooth = headphones for audience
    // NOTE: Using » symbol instead of emojis for PDF font compatibility
    if (seg.requires_translation && seg.data?.translator) {
      const isRemoteBooth = seg.translation_mode === 'RemoteBooth';
      items.push({
        text: [
          { text: isRemoteBooth ? '» Trad-Cabina: ' : '» Trad-Tarima: ', fontSize: 8.5 * scale, color: isRemoteBooth ? '#0891B2' : '#7C3AED', italics: true },
          { text: seg.data.translator, fontSize: 8.5 * scale, color: isRemoteBooth ? '#0E7490' : '#5B21B6', italics: true, bold: true }
        ],
        margin: [8, 0, 0, 1]
      });
    }

    // Message Details - Styled Box (Blue-50), no scriptures in exports
    const messageTitle = seg.data?.title || seg.data?.messageTitle;
    if (messageTitle && seg.type === 'message') {
      items.push({
        table: {
          widths: ['*'],
          body: [[
            {
              stack: [
                { 
                  text: [
                    { text: 'MENSAJE: ', bold: true, color: '#1E40AF' },
                    { text: messageTitle, color: '#1E3A8A' }
                  ],
                  fontSize: 9 * scale
                }
              ],
              fillColor: '#EFF6FF', // Blue-50
              border: [true, true, true, true],
              borderColor: ['#BFDBFE', '#BFDBFE', '#BFDBFE', '#BFDBFE'], // Blue-200
              margin: [4, 4, 4, 4]
            }
          ]]
        },
        margin: [8, 2, 0, 2]
      });
    }

    // Notes - Consolidated Block (Layout Efficiency)
    // Instead of separate boxes (which add padding/margin overhead), we stack all notes
    // into a single "Operations" block with colored labels. This mimics the dense "Settings" view.
    
    const NOTES_STYLE = {
      COORD: { color: '#F97316', label: 'COORDINACIÓN' },
      PROJ:  { color: '#2563EB', label: 'PROYECCIÓN' },
      SOUND: { color: '#DC2626', label: 'SONIDO' },
      UJIER: { color: '#16A34A', label: 'UJIERES' },
      TRAD:  { color: '#9333EA', label: 'TRADUCCIÓN' },
      STAGE: { color: '#DB2777', label: 'STAGE' },
      GEN:   { color: '#4B5563', label: 'NOTAS' }
    };

    const noteConfig = [
      { key: 'coordinator_notes', ...NOTES_STYLE.COORD },
      { key: 'projection_notes', ...NOTES_STYLE.PROJ },
      { key: 'sound_notes', ...NOTES_STYLE.SOUND },
      { key: 'ushers_notes', ...NOTES_STYLE.UJIER },
      { key: 'translation_notes', ...NOTES_STYLE.TRAD },
      { key: 'stage_decor_notes', ...NOTES_STYLE.STAGE },
      { key: 'description_details', ...NOTES_STYLE.GEN },
      { key: 'description', ...NOTES_STYLE.GEN }
    ];

    // Collect all active notes
    const activeNotes = [];
    noteConfig.forEach(conf => {
      const rawVal = seg.data?.[conf.key];
      if (rawVal) {
        // Clean text: Replace newlines with bullets, remove excess whitespace
        // NO TRUNCATION per user request - rely on layout efficiency
        const cleanVal = rawVal.replace(/\n+/g, ' • ').trim();
        activeNotes.push({
          label: conf.label,
          color: conf.color,
          text: cleanVal
        });
      }
    });

    // Render as a single consolidated block if notes exist
    if (activeNotes.length > 0) {
      items.push({
        table: {
          widths: [2, '*'], // Single left accent border
          body: [[
            { 
              text: '', 
              fillColor: '#6B7280', // Neutral Gray accent 
              border: [false, false, false, false] 
            },
            {
              stack: activeNotes.map((note, idx) => ({
                text: [
                  { text: `${note.label}: `, bold: true, color: note.color, fontSize: 7.5 * scale },
                  { text: note.text, color: '#374151', fontSize: 7.5 * scale }
                ],
                // Add tiny spacing between notes, but much tighter than separate boxes
                margin: [0, idx > 0 ? 2 : 0, 0, 0],
                // Ultra-tight line height for notes when scaled
                lineHeight: scale < 0.85 ? 0.85 : 1.1
              })),
              fillColor: '#F9FAFB', // Very light gray background for the whole block
              border: [false, false, false, false],
              margin: [4, 3, 2, 3] // Tight internal padding
            }
          ]]
        },
        margin: [8, 2, 0, 2] // Single margin for the whole block
      });
    }

    // Actions (Prep & During) - Demoted Visuals (No Icons, Small Text)
    // Helper to calculate action time for weekly PDF
    const calcActionTime = (action) => {
      if (!currentTime) return null;
      const segStartMinutes = currentTime.getHours() * 60 + currentTime.getMinutes() - (seg.duration || 0);
      const segEndMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
      const offset = action.offset_min || 0;
      let targetMinutes;
      
      switch (action.timing) {
        case 'before_start':
          targetMinutes = segStartMinutes - offset;
          break;
        case 'after_start':
          targetMinutes = segStartMinutes + offset;
          break;
        case 'before_end':
          targetMinutes = segEndMinutes - offset;
          break;
        case 'absolute':
          return action.absolute_time || null;
        default:
          return null;
      }
      
      if (targetMinutes < 0) targetMinutes += 24 * 60;
      const h = Math.floor(targetMinutes / 60) % 24;
      const m = targetMinutes % 60;
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, '0')} ${period}`;
    };

    if (seg.actions?.length > 0) {
      const prepActions = seg.actions.filter(a => a.timing === 'before_start');
      const duringActions = seg.actions.filter(a => a.timing !== 'before_start');

      // Prep Actions
      if (prepActions.length > 0) {
        items.push({
          table: {
            widths: ['*'],
            body: [[
              {
                stack: [
                  { text: 'PREPARACIÓN', bold: true, fontSize: 7.5 * scale, color: '#6B7280', margin: [0, 0, 0, 2] },
                  ...prepActions.map(a => {
                    const actionTime = calcActionTime(a);
                    return {
                      text: [
                        { text: `[${a.department || 'General'}] `, bold: true, color: '#6B7280', fontSize: 7.5 * scale },
                        { text: a.label, color: '#4B5563', fontSize: 8 * scale },
                        actionTime ? { text: ` @ ${actionTime}`, bold: true, color: '#B45309', fontSize: 7.5 * scale } : ''
                      ],
                      margin: [0, 0, 0, 1]
                    };
                  })
                ],
                fillColor: '#F9FAFB', // Gray-50
                border: [true, true, true, true],
                borderColor: ['#E5E7EB', '#E5E7EB', '#E5E7EB', '#E5E7EB'],
                margin: [4, 2, 4, 2] // Tighter padding
              }
            ]]
          },
          margin: [8, 2, 0, 2]
        });
      }

      // During Actions
      if (duringActions.length > 0) {
        items.push({
          table: {
            widths: ['*'],
            body: [[
              {
                stack: [
                  { text: 'DURANTE SEGMENTO', bold: true, fontSize: 7.5 * scale, color: '#6B7280', margin: [0, 0, 0, 2] },
                  ...duringActions.map(a => {
                    const actionTime = calcActionTime(a);
                    return {
                      text: [
                        { text: `[${a.department || 'General'}] `, bold: true, color: '#6B7280', fontSize: 7.5 * scale },
                        { text: a.label, color: '#4B5563', fontSize: 8 * scale },
                        actionTime ? { text: ` @ ${actionTime}`, bold: true, color: '#1D4ED8', fontSize: 7.5 * scale } : ''
                      ],
                      margin: [0, 0, 0, 1]
                    };
                  })
                ],
                fillColor: '#F9FAFB', // Gray-50
                border: [true, true, true, true],
                borderColor: ['#E5E7EB', '#E5E7EB', '#E5E7EB', '#E5E7EB'],
                margin: [4, 2, 4, 2]
              }
            ]]
          },
          margin: [8, 0, 0, 2]
        });
      }
    }

    // Separator line
    items.push({ 
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 250, y2: 0, lineWidth: 0.5, lineColor: '#F3F4F6' }], 
      margin: [0, 4, 0, 4] 
    });
  });

  return items;
}

function buildReceso(serviceData, scale) {
  // Dynamic: render a receso block for each non-last slot that has break notes
  const pdfSlots = serviceData._slotNames || ["9:30am", "11:30am"];
  const blocks = [];

  pdfSlots.slice(0, -1).forEach((slotName, idx) => {
    const recesoNote = serviceData.receso_notes?.[slotName];
    if (!recesoNote) return;

    const label = pdfSlots.length > 2
      ? `RECESO (${slotName} → ${pdfSlots[idx + 1]})  `
      : 'RECESO  ';

    blocks.push({
      stack: [
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 540, y2: 0, lineWidth: 1, lineColor: BRAND.LIGHT_GRAY }],
          margin: [0, 10, 0, 10]
        },
        {
          text: [
            { text: label, bold: true, color: BRAND.BLACK },
            { text: `(${recesoNote})`, italics: true, color: BRAND.GRAY, fontSize: 9 * scale }
          ],
          alignment: 'center',
          fontSize: 11 * scale
        }
      ]
    });
  });

  return blocks.length > 0 ? { stack: blocks.flatMap(b => b.stack) } : null;
}