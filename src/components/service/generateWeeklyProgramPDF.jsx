import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { getLogoDataUrl } from './pdfLogoData';
import { es } from "date-fns/locale";
import { addMinutes, parse, format } from "date-fns";

pdfMake.vfs = pdfFonts.vfs;

// Brand Palette
const BRAND = {
  BLACK: '#1A1A1A',
  TEAL: '#1F8A70',
  GREEN: '#8DC63F',
  LIME: '#D7DF23',
  WHITE: '#FFFFFF',
  GRAY: '#4B5563',
  LIGHT_GRAY: '#E5E7EB',
  RED: '#DC2626',
  BLUE: '#2563EB',
  PURPLE: '#7C3AED',
  ORANGE: '#EA580C',
  AMBER: '#B45309',
  PINK: '#DB2777'
};

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
      const hasMessageTitle = seg.data?.title && seg.type === 'message';
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

  const load930 = countContent(serviceData["9:30am"], serviceData.pre_service_notes?.["9:30am"]);
  const load1130 = countContent(serviceData["11:30am"], serviceData.pre_service_notes?.["11:30am"]);
  const maxLoad = Math.max(load930, load1130);

  // Continuous Scaling Formula
  // Target: 55 units per column fits comfortably at 1.0 scale
  // If load > 55, we scale down: scale = 55 / load
  const TARGET_CAPACITY = 55;
  
  let scale = 1.0;
  if (maxLoad > TARGET_CAPACITY) {
    scale = TARGET_CAPACITY / maxLoad;
  }

  // Hard clamp to prevent unreadable text (0.6 minimum)
  return Math.max(0.60, Math.min(1.0, scale));
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
    pageMargins: [36, 48, 36, 56],

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

      // 2-Column Content
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: '9:30 A.M.', fontSize: 14 * globalScale, bold: true, color: BRAND.RED, margin: [0, 0, 0, 8] },
              ...buildWeeklySegments(serviceData["9:30am"], "9:30am", globalScale, serviceData.pre_service_notes?.["9:30am"])
            ]
          },
          { width: 24, text: '' }, // Gutter
          {
            width: '*',
            stack: [
              { text: '11:30 A.M.', fontSize: 14 * globalScale, bold: true, color: BRAND.BLUE, margin: [0, 0, 0, 8] },
              ...buildWeeklySegments(serviceData["11:30am"], "11:30am", globalScale, serviceData.pre_service_notes?.["11:30am"])
            ]
          }
        ]
      },

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
      lineHeight: 1.2,
      color: BRAND.BLACK
    }
  };

  return pdfMake.createPdf(docDefinition);
}

function buildHeader(serviceData, logoDataUrl, scale) {
  const dateStr = serviceData.date 
    ? format(new Date(serviceData.date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
    : '';

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
  const teams = [
    { label: 'Coordinador', value: serviceData.coordinators?.["9:30am"] || serviceData.coordinators?.["11:30am"] },
    { label: 'Ujier', value: serviceData.ujieres?.["9:30am"] },
    { label: 'Sonido', value: serviceData.sound?.["9:30am"] },
    { label: 'Luces', value: serviceData.luces?.["9:30am"] },
    { label: 'Foto', value: serviceData.fotografia?.["9:30am"] }
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

function buildWeeklySegments(segments, timeSlot, scale, preServiceNote) {
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

  let currentTime = parse(timeSlot, "h:mma", new Date());

  segments.filter(s => s.type !== 'break').forEach((seg, idx) => {
    // Calculate time
    const timeStr = format(currentTime, "h:mm a");
    currentTime = addMinutes(currentTime, seg.duration || 0);

    // Header: Time + Title + Duration
    items.push({
      text: [
        { text: timeStr, bold: true, color: timeSlot === '9:30am' ? BRAND.RED : BRAND.BLUE, fontSize: 10 * scale },
        { text: '  ' + seg.title.toUpperCase(), bold: true, color: BRAND.BLACK, fontSize: 10.5 * scale },
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

    // Translator - Subordinate Style
    if (seg.requires_translation && seg.data?.translator) {
      items.push({
        text: [
          { text: 'Traductor: ', fontSize: 8.5 * scale, color: '#7C3AED', italics: true }, // Purple-600
          { text: seg.data.translator, fontSize: 8.5 * scale, color: '#5B21B6', italics: true, bold: true } // Purple-800
        ],
        margin: [8, 0, 0, 1]
      });
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

    // Sub-assignments
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

    // Message/Special Details - Styled Box (Blue-50)
    if ((seg.data?.title && seg.type === 'message') || seg.data?.scripture_references || seg.data?.verse) {
      const msgContent = [];
      if (seg.data?.title && seg.type === 'message') {
        msgContent.push({ 
          text: [
            { text: 'MENSAJE: ', bold: true, color: '#1E40AF' }, // Blue-800
            { text: seg.data.title, color: '#1E3A8A' } // Blue-900
          ], 
          fontSize: 9 * scale,
          margin: [0, 0, 0, 2] 
        });
      }
      
      const verseText = seg.data?.scripture_references || seg.data?.verse;
      if (verseText) {
        msgContent.push({
          text: [
            { text: 'ESCRITURAS: ', bold: true, color: '#1E40AF' },
            { text: verseText, color: '#1E3A8A' }
          ],
          fontSize: 9 * scale
        });
      }

      if (msgContent.length > 0) {
        items.push({
          table: {
            widths: ['*'],
            body: [[
              {
                stack: msgContent,
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
    }

    // Notes - Styled Callout Boxes (Compact Operational Style)
    // helper to clean and compact text
    const cleanAndCompact = (text) => {
      if (!text) return '';
      // 1. Replace newlines with bullets to save vertical space
      const compacted = text.replace(/\n+/g, ' • ');
      // 2. Truncate to ~350 chars to prevent page overflow (Operational Constraint)
      if (compacted.length > 350) {
        return compacted.substring(0, 350) + '...';
      }
      return compacted;
    };

    const buildCallout = (label, value, colors) => {
      const compactValue = cleanAndCompact(value);
      return {
        table: {
          widths: [2, '*'], // Thinner accent border
          body: [[
            { 
              text: '', 
              fillColor: colors.dark, 
              border: [false, false, false, false] 
            },
            {
              text: [
                { text: `${label}: `, bold: true, color: colors.dark, fontSize: 7.5 * scale }, // Smaller label
                { text: compactValue, color: colors.text, fontSize: 7.5 * scale } // Significantly smaller content
              ],
              fillColor: colors.light,
              border: [false, false, false, false],
              margin: [3, 1, 2, 1] // Tighter padding
            }
          ]]
        },
        margin: [8, 1, 0, 1] // Tighter margins
      };
    };

    const NOTES_STYLE = {
      COORD: { light: '#FFF7ED', dark: '#F97316', text: '#7C2D12' }, // Orange-50/500/900
      PROJ:  { light: '#EFF6FF', dark: '#3B82F6', text: '#1E3A8A' }, // Blue
      SOUND: { light: '#FEF2F2', dark: '#EF4444', text: '#7F1D1D' }, // Red
      UJIER: { light: '#F0FDF4', dark: '#22C55E', text: '#14532D' }, // Green
      TRAD:  { light: '#FAF5FF', dark: '#A855F7', text: '#581C87' }, // Purple
      STAGE: { light: '#FDF2F8', dark: '#EC4899', text: '#831843' }, // Pink
      GEN:   { light: '#F3F4F6', dark: '#6B7280', text: '#111827' }  // Gray
    };

    const noteConfig = [
      { key: 'coordinator_notes', label: 'COORDINACIÓN', style: NOTES_STYLE.COORD },
      { key: 'projection_notes', label: 'PROYECCIÓN', style: NOTES_STYLE.PROJ },
      { key: 'sound_notes', label: 'SONIDO', style: NOTES_STYLE.SOUND },
      { key: 'ushers_notes', label: 'UJIERES', style: NOTES_STYLE.UJIER },
      { key: 'translation_notes', label: 'TRADUCCIÓN', style: NOTES_STYLE.TRAD },
      { key: 'stage_decor_notes', label: 'STAGE & DECOR', style: NOTES_STYLE.STAGE },
      { key: 'description_details', label: 'NOTAS', style: NOTES_STYLE.GEN },
      { key: 'description', label: 'NOTAS', style: NOTES_STYLE.GEN }
    ];

    noteConfig.forEach(conf => {
      const val = seg.data?.[conf.key];
      if (val) {
        items.push(buildCallout(conf.label, val, conf.style));
      }
    });

    // Actions (Prep & During) - Demoted Visuals (No Icons, Small Text)
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
                  ...prepActions.map(a => ({
                    text: [
                      { text: `[${a.department || 'General'}] `, bold: true, color: '#6B7280', fontSize: 7.5 * scale },
                      { text: a.label, color: '#4B5563', fontSize: 8 * scale },
                      a.offset_min ? { text: ` (${a.offset_min}m antes)`, italics: true, color: '#9CA3AF', fontSize: 7.5 * scale } : ''
                    ],
                    margin: [0, 0, 0, 1]
                  }))
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
                  ...duringActions.map(a => ({
                    text: [
                      { text: `[${a.department || 'General'}] `, bold: true, color: '#6B7280', fontSize: 7.5 * scale },
                      { text: a.label, color: '#4B5563', fontSize: 8 * scale }
                    ],
                    margin: [0, 0, 0, 1]
                  }))
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
  if (!serviceData.receso_notes?.["9:30am"]) return null;

  return {
    stack: [
      { 
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 540, y2: 0, lineWidth: 1, lineColor: BRAND.LIGHT_GRAY }],
        margin: [0, 10, 0, 10]
      },
      {
        text: [
          { text: '11:00 A.M. — 11:30 A.M. • RECESO  ', bold: true, color: BRAND.BLACK },
          { text: `(${serviceData.receso_notes["9:30am"]})`, italics: true, color: BRAND.GRAY, fontSize: 9 * scale }
        ],
        alignment: 'center',
        fontSize: 11 * scale
      }
    ]
  };
}