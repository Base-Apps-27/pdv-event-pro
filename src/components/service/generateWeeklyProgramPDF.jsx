import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { getLogoDataUrl } from './pdfLogoData';
import { formatDate } from './generateProgramPDF'; // Reuse utils
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
  ORANGE: '#EA580C'
};

/**
 * Heuristic scaling for Weekly Services (2 columns)
 * Checks the denser column to determine scale
 * UPDATED: Now accounts for text density in notes
 */
export function estimateWeeklyOptimalScale(serviceData) {
  const countContent = (segments, preServiceNote) => {
    let units = 0;
    
    // Pre-service note
    if (preServiceNote) {
      units += 2 + Math.ceil(preServiceNote.length / 50);
    }

    if (!segments) return units;

    segments.filter(s => s.type !== 'break').forEach(seg => {
      // 1. Header (Time + Title + Duration)
      units += 2.5;

      // 2. Roles (Leader/Preacher/Presenter/Translator)
      if (seg.data?.leader || seg.data?.preacher || seg.data?.presenter) units += 1.2;
      if (seg.requires_translation && seg.data?.translator) units += 1.2;

      // 3. Songs
      const songCount = seg.songs?.filter(s => s.title).length || 0;
      units += songCount * 1.2;

      // 4. Sub-assignments
      if (seg.sub_assignments) {
        seg.sub_assignments.forEach(sub => {
          if (seg.data?.[sub.person_field_name]) units += 1.2;
        });
      }
      // Legacy ministry fallback
      if (!seg.sub_assignments?.length && seg.data?.ministry_leader) units += 1.2;

      // 5. Message Title & Verse
      if (seg.data?.title && seg.type === 'message') units += 1.5;
      if (seg.data?.verse) units += 1 + Math.ceil(seg.data.verse.length / 55);

      // 6. Notes (The biggest variable)
      const noteFields = [
        seg.data?.coordinator_notes,
        seg.data?.projection_notes,
        seg.data?.sound_notes,
        seg.data?.ushers_notes,
        seg.data?.stage_decor_notes,
        seg.data?.description_details, // "Notas Generales"
        seg.data?.description
      ];

      noteFields.forEach(note => {
        if (note) {
          // Approx 50 chars per line in a column + 0.5 unit spacing
          units += Math.ceil(note.length / 50) + 0.5;
        }
      });

      // 7. Actions/Cues
      if (seg.actions?.length > 0) {
        // Actions usually wrapped in one block, but can wrap lines
        const totalActionChars = seg.actions.reduce((sum, a) => sum + (a.label?.length || 0) + 5, 0);
        units += Math.ceil(totalActionChars / 50) + 1; // +1 for "CUES:" label
      }

      // 8. Spacing
      units += 1.5;
    });

    return units;
  };

  const load930 = countContent(serviceData["9:30am"], serviceData.pre_service_notes?.["9:30am"]);
  const load1130 = countContent(serviceData["11:30am"], serviceData.pre_service_notes?.["11:30am"]);
  const maxLoad = Math.max(load930, load1130);

  // console.log(`[PDF Heuristic] Load 9:30: ${load930}, Load 11:30: ${load1130}, Max: ${maxLoad}`);

  // Base scale starts at 1.0
  let scale = 1.0;

  // Thresholds for Letter page 2-column layout
  // Approx 65-70 lines fit comfortably at 1.0 scale
  if (maxLoad > 85) scale = 0.60;      // Extreme overflow
  else if (maxLoad > 75) scale = 0.65; // Heavy overflow
  else if (maxLoad > 65) scale = 0.72; // Moderate overflow
  else if (maxLoad > 55) scale = 0.80; // Light overflow
  else if (maxLoad > 45) scale = 0.90; // Dense
  else scale = 1.0;                    // Standard

  return Math.max(0.60, Math.min(1.0, scale));
}

export async function generateWeeklyProgramPDF(serviceData) {
  // Use manual scale if provided in serviceData, otherwise heuristic
  const userScale = serviceData.print_settings_page1?.globalScale;
  const heuristicScale = estimateWeeklyOptimalScale(serviceData);
  
  // If user explicitly set a scale (and it's not the default 1.0 placeholder from initialization if we want strictness, but 
  // usually if it's saved in DB it's intentional. However, print_settings might be default. 
  // Let's prefer heuristic IF print_settings is just the default 1.0 AND heuristic says we need smaller.)
  // Actually, simpler: if print_settings exists, trust it. If not, auto.
  // Exception: If the user hasn't "Saved" settings yet, print_settings_page1 might be null or default.
  // WeeklyServiceManager passes the full serviceData.
  
  let globalScale = heuristicScale;
  
  // If we have saved settings that deviate from 1.0 OR correspond to a previous manual save
  if (serviceData.print_settings_page1?.globalScale) {
     // We'll use the user's setting, but maybe warn if it differs? No, just use it.
     // Users expect "Settings" to rule.
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
  // Logic matches existing print view: prefer 9:30 but fallback/combine if needed
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
        { text: ` (${seg.duration} min)`, color: BRAND.GRAY, fontSize: 9 * scale }
      ],
      margin: [0, idx > 0 ? 6 : 0, 0, 2]
    });

    // Content: Leader/Preacher/Presenter
    const leaderName = seg.data?.leader || seg.data?.preacher || seg.data?.presenter;
    if (leaderName) {
      items.push({
        text: leaderName.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, ''),
        bold: true,
        color: BRAND.BLUE,
        fontSize: 10.5 * scale,
        margin: [8, 0, 0, 1]
      });
    }

    // Translator
    if (seg.requires_translation && seg.data?.translator) {
      items.push({
        text: `🌐 Traduce: ${seg.data.translator}`,
        fontSize: 9 * scale,
        color: BRAND.GRAY,
        italics: true,
        margin: [8, 0, 0, 1]
      });
    }

    // Songs
    if (seg.songs && seg.songs.some(s => s.title)) {
      seg.songs.filter(s => s.title).forEach(song => {
        items.push({
          text: [
            { text: `• ${song.title}`, color: BRAND.BLACK },
            song.lead ? { text: ` (${song.lead})`, color: BRAND.GRAY, italics: true } : ''
          ],
          fontSize: 9.5 * scale,
          margin: [8, 0, 0, 1]
        });
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

    // Message Title & Verse
    if (seg.data?.title && seg.type === 'message') {
      items.push({ text: seg.data.title, italics: true, color: BRAND.GRAY, fontSize: 9.5 * scale, margin: [8, 1, 0, 0] });
    }
    if (seg.data?.verse) {
      items.push({ text: seg.data.verse, italics: true, color: BRAND.GRAY, fontSize: 9 * scale, margin: [8, 0, 0, 0] });
    }

    // Notes (Coordinator/Projection/etc) - Condensed
    const notes = [
      { l: 'Coord', v: seg.data?.coordinator_notes, c: BRAND.BLUE },
      { l: 'Proj', v: seg.data?.projection_notes, c: BRAND.BLUE },
      { l: 'Sonido', v: seg.data?.sound_notes, c: BRAND.RED },
      { l: 'Ujier', v: seg.data?.ushers_notes, c: BRAND.GREEN },
      { l: 'Stage', v: seg.data?.stage_decor_notes, c: BRAND.PURPLE }
    ].filter(n => n.v);

    if (notes.length > 0) {
      items.push({
        text: notes.map(n => [
          { text: `${n.l}: `, bold: true, color: n.c },
          { text: `${n.v}  `, color: BRAND.GRAY }
        ]).flat(),
        fontSize: 8.5 * scale,
        margin: [8, 2, 0, 0]
      });
    }

    // Actions
    if (seg.actions?.length > 0) {
      const actionText = seg.actions.map(a => a.label).join(' • ');
      items.push({
        text: `CUES: ${actionText}`,
        fontSize: 8 * scale,
        color: BRAND.ORANGE,
        background: '#FFF7ED',
        margin: [8, 2, 0, 0]
      });
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