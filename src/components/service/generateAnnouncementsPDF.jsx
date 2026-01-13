/**
 * pdfmake-based Announcements PDF Generator
 * Generates two-column announcements layout (Fixed | Events)
 */

import pdfMake from 'pdfmake/build/pdfmake';
import { getLogoDataUrl } from './pdfLogoData';
import { BRAND, formatDate, parseHtmlToPdfMake } from './pdfUtils';

// Font setup now handled in pdfUtils (imported indirectly or assumed set)
// Redundant check doesn't hurt
import pdfFonts from 'pdfmake/build/vfs_fonts';
if (pdfMake && !pdfMake.vfs && pdfFonts && pdfFonts.vfs) {
  pdfMake.vfs = pdfFonts.vfs;
}

/**
 * Estimate optimal scale using continuous "line unit" counting.
 * Accounts for 2-column layout by measuring the tallest column.
 * Target: ~45 lines of content per column fits comfortably at 1.0 scale.
 * Range: 0.55 (dense) to 1.25 (sparse).
 */
function estimateOptimalScale(announcements) {
  const fixed = announcements.filter(a => a.category === 'General');
  const dynamic = announcements.filter(a => a.category !== 'General' || a.isEvent);

  const countLines = (items) => {
    let lines = 0;
    if (!items) return 0;
    
    items.forEach(a => {
      // Title (Bold)
      if (a.title || a.name) lines += 2;
      
      // Date (for events)
      if (a.date_of_occurrence || a.start_date) lines += 1.2;
      
      // Content (Body) - Approx 55 chars per line at 10pt
      const content = a.isEvent ? (a.announcement_blurb || a.description) : a.content;
      if (content) {
        // Strip HTML for counting
        const clean = content.replace(/<[^>]+>/g, '');
        lines += Math.ceil(clean.length / 55);
      }
      
      // Instructions/Cue
      if (a.instructions) {
        const clean = a.instructions.replace(/<[^>]+>/g, '');
        lines += 1.0 + Math.ceil(clean.length / 60);
      }
      
      // Video Tag
      if (a.has_video || a.announcement_has_video) lines += 1;
      
      // Spacing/Divider overhead
      lines += 2.0; 
      
      // Box overhead (emphasis)
      if (a.emphasize || a.category === 'Urgent') lines += 1.5;
    });
    
    return lines;
  };

  const leftLoad = countLines(fixed);
  const rightLoad = countLines(dynamic) + 3; // +3 for "PRÓXIMOS EVENTOS" header
  const maxLoad = Math.max(leftLoad, rightLoad);

  // Target Capacity: ~40 lines per column (Conservative to ensure single-page fit)
  const TARGET_LINES = 40;
  
  let scale = TARGET_LINES / maxLoad;
  
  // Clamp scale
  // Max 1.25 (12.5pt font) - don't get comically large
  // Min 0.55 (5.5pt font) - don't get unreadable
  return Math.max(0.55, Math.min(1.25, scale));
}

export async function generateAnnouncementsPDF(announcements, serviceDataOrDate) {
  const serviceDate = typeof serviceDataOrDate === 'string' ? serviceDataOrDate : (serviceDataOrDate?.date || '');
  const serviceData = typeof serviceDataOrDate === 'object' ? serviceDataOrDate : null;

  // Split announcements
  const fixed = announcements.filter(a => a.category === 'General');
  const dynamic = announcements.filter(a => a.category !== 'General' || a.isEvent);
  const globalScale = estimateOptimalScale(announcements);
  const logoDataUrl = await getLogoDataUrl();
  
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [36, 48, 36, 56], // Increased top margin slightly for brand bar
    
    // Background Header Bar (Brand Gradient)
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
      // Logo + Title Header (PDV Branding)
      {
        columns: [
          logoDataUrl ? {
            width: 60,
            image: logoDataUrl,
            fit: [60, 60],
            alignment: 'left'
          } : { width: 60, text: '' },
          { width: '*', text: '' },
          {
            width: 'auto',
            stack: [
              {
                text: 'ANUNCIOS',
                fontSize: 22 * globalScale,
                bold: true,
                alignment: 'center',
                color: BRAND.BLACK,
                characterSpacing: 0.5,
                margin: [0, 4, 0, 2]
              },
              {
                text: formatDate(serviceDate).toUpperCase(),
                fontSize: 10 * globalScale,
                bold: true,
                alignment: 'center',
                color: BRAND.TEAL,
                characterSpacing: 1,
                margin: [0, 0, 0, 4]
              },
              ...getWelcomePresenterInfo(serviceData, globalScale, BRAND)
            ]
          },
          { width: '*', text: '' },
          { width: 60, text: '' }
        ],
        margin: [0, 0, 0, 12]
      },
      
      // Divider (Brand Colors)
      { 
        canvas: [{ 
          type: 'line', 
          x1: 0, y1: 0, x2: 540, y2: 0, 
          lineWidth: 2, 
          lineColor: BRAND.GREEN // Green accent line
        }], 
        margin: [0, 0, 0, 16] 
      },
      
      // Two columns
      {
        columns: [
          {
            width: '*',
            stack: buildFixedAnnouncements(fixed, globalScale)
          },
          { width: 20, text: '' }, // Gap
          {
            width: '*',
            stack: [
              {
                text: 'PRÓXIMOS EVENTOS',
                fontSize: 10 * globalScale,
                bold: true,
                color: BRAND.TEAL,
                margin: [0, 0, 0, 8]
              },
              {
                canvas: [{
                  type: 'line',
                  x1: 0, y1: 0, x2: 250, y2: 0,
                  lineWidth: 1,
                  lineColor: BRAND.LIME
                }],
                margin: [0, 0, 0, 10]
              },
              ...buildDynamicAnnouncements(dynamic, globalScale)
            ]
          }
        ]
      }
    ],
    
    // Brand Footer: White Background + Gradient Top Border
    footer: (currentPage, pageCount) => ({
      stack: [
        // Gradient Accent Line
        {
          canvas: [{ 
            type: 'rect', 
            x: 0, y: 0, w: 612, h: 4, 
            linearGradient: [BRAND.TEAL, BRAND.GREEN, BRAND.LIME] 
          }] 
        },
        // Footer Text
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
      fontSize: 9.5 * globalScale, 
      lineHeight: 1.3,
      color: BRAND.BLACK
    }
  };
  
  return pdfMake.createPdf(docDefinition, {});
}

function getWelcomePresenterInfo(serviceData, scale, BRAND) {
  if (!serviceData) return [];
  
  const findWelcome = (segments) => segments?.find(s => 
    (s.title?.toLowerCase().includes('bienvenida') && s.title?.toLowerCase().includes('anuncios')) ||
    (s.type === 'welcome')
  );
  
  const seg930 = findWelcome(serviceData["9:30am"]);
  const seg1130 = findWelcome(serviceData["11:30am"]);
  
  const p9 = seg930?.data?.presenter;
  const t9 = seg930?.data?.translator;
  const p11 = seg1130?.data?.presenter;
  const t11 = seg1130?.data?.translator;
  
  const items = [];
  const clean = (name) => name ? name.replace(/\s*(?:trad|traduc|traducción|translation)[\s:.-].*$/i, '') : '';
  
  const p9Clean = clean(p9);
  const p11Clean = clean(p11);
  
  if (p9Clean || p11Clean) {
    if (p9Clean === p11Clean && t9 === t11) {
      // Same presenter/translator for both
      if (p9Clean) {
        let text = `BIENVENIDA: ${p9Clean}`;
        if (t9) text += ` / TRAD: ${t9}`;
        items.push({ 
          text: text.toUpperCase(), 
          fontSize: 9 * scale, 
          color: BRAND.BLACK, 
          bold: true, 
          alignment: 'center', 
          margin: [0, 2, 0, 0] 
        });
      }
    } else {
      // Different
      if (p9Clean) {
        let text = `9:30 AM: ${p9Clean}`;
        if (t9) text += ` (Trad: ${t9})`;
        items.push({ 
          text: text.toUpperCase(), 
          fontSize: 8.5 * scale, 
          color: BRAND.BLACK, 
          bold: true, 
          alignment: 'center', 
          margin: [0, 1, 0, 0] 
        });
      }
      if (p11Clean) {
        let text = `11:30 AM: ${p11Clean}`;
        if (t11) text += ` (Trad: ${t11})`;
        items.push({ 
          text: text.toUpperCase(), 
          fontSize: 8.5 * scale, 
          color: BRAND.BLACK, 
          bold: true, 
          alignment: 'center', 
          margin: [0, 1, 0, 0] 
        });
      }
    }
  }
  
  return items;
}

function buildFixedAnnouncements(announcements, globalScale = 1) {
  if (!announcements || announcements.length === 0) return [];

  return announcements.flatMap((ann, idx) => {
    if (!ann) return [];
    const items = [];

    // Title
    if (ann.title) {
      items.push({
        text: String(ann.title),
        fontSize: 10 * globalScale,
        bold: true,
        color: '#000000',
        margin: [0, idx > 0 ? 8 : 0, 0, 3]
      });
    }

    // Content (parse HTML formatting)
    if (ann.content) {
      items.push({
        text: parseHtmlToPdfMake(ann.content, globalScale),
        fontSize: 9.5 * globalScale,
        color: '#374151',
        margin: [0, 0, 0, 2]
      });
    }

    // Instructions (CUE with HTML formatting)
    if (ann.instructions) {
      const parsedInstructions = parseHtmlToPdfMake(ann.instructions, globalScale);
      const instructionsArray = Array.isArray(parsedInstructions) ? parsedInstructions : [{ text: String(parsedInstructions), italics: true }];

      items.push({
        text: [
          { text: 'CUE: ', bold: true, fontSize: 8.5 * globalScale, color: '#1F2937' },
          ...instructionsArray.map(item => ({ 
            ...item, 
            text: String(item.text || ''),
            fontSize: 8.5 * globalScale, 
            color: '#6B7280',
            italics: item.italics !== false 
          }))
        ],
        margin: [6, 2, 0, 0]
      });
    }

    // Video indicator
    if (ann.has_video) {
      items.push({
        text: '📹 Video',
        fontSize: 8 * globalScale,
        color: '#8B5CF6',
        margin: [0, 2, 0, 0]
      });
    }

    // Divider
    items.push({
      canvas: [{
        type: 'line',
        x1: 0, y1: 0, x2: 250, y2: 0,
        lineWidth: 0.5,
        lineColor: '#E5E7EB'
      }],
      margin: [0, 6, 0, 0]
    });

    return items;
  });
}

function buildDynamicAnnouncements(announcements, globalScale = 1) {
  if (!announcements || announcements.length === 0) return [];

  return announcements.flatMap((ann, idx) => {
    if (!ann) return [];
    const items = [];
    const isEmphasized = ann.emphasize || ann.category === 'Urgent';

    // Event block
    const eventItems = [];

    // Title
    const titleText = ann.isEvent ? (ann.name || '') : (ann.title || '');
    if (titleText) {
      eventItems.push({
        text: String(titleText),
        fontSize: 10 * globalScale,
        bold: true,
        color: '#16A34A',
        margin: [0, 0, 0, 2]
      });
    }

    // Date
    const eventDate = ann.date_of_occurrence || ann.start_date;
    if (eventDate) {
      eventItems.push({
        text: formatDate(eventDate),
        fontSize: 9 * globalScale,
        color: '#4B5563',
        bold: true,
        margin: [0, 0, 0, 2]
      });
    }

    // Content (parse HTML formatting)
    const content = ann.isEvent ? (ann.announcement_blurb || ann.description) : ann.content;
    if (content) {
      eventItems.push({
        text: parseHtmlToPdfMake(content, globalScale),
        fontSize: 9 * globalScale,
        color: '#374151',
        margin: [0, 0, 0, 2]
      });
    }

    // Instructions (CUE with HTML formatting)
    if (ann.instructions) {
      const parsedInstructions = parseHtmlToPdfMake(ann.instructions, globalScale);
      const instructionsArray = Array.isArray(parsedInstructions) ? parsedInstructions : [{ text: String(parsedInstructions || ''), italics: true }];

      eventItems.push({
        text: [
          { text: 'CUE: ', bold: true, fontSize: 8.5 * globalScale, color: '#1F2937' },
          ...instructionsArray.map(item => ({ 
            ...item, 
            text: String(item.text || ''),
            fontSize: 8.5 * globalScale, 
            color: '#6B7280',
            italics: item.italics !== false 
          }))
        ],
        margin: [6, 2, 0, 0]
      });
    }

    // Video indicator
    if (ann.has_video || ann.announcement_has_video) {
      eventItems.push({
        text: '📹 Video',
        fontSize: 8 * globalScale,
        color: '#8B5CF6',
        margin: [0, 2, 0, 0]
      });
    }

    // Wrapper (with emphasis if needed)
    if (isEmphasized) {
      items.push({
        stack: eventItems,
        background: '#FEF3C7',
        margin: [0, idx > 0 ? 6 : 0, 0, 0],
        padding: [6, 4, 6, 4]
      });
    } else {
      items.push({
        stack: eventItems,
        margin: [0, idx > 0 ? 6 : 0, 0, 4]
      });
    }

    // Divider
    items.push({
      canvas: [{
        type: 'line',
        x1: 0, y1: 0, x2: 250, y2: 0,
        lineWidth: 0.5,
        lineColor: '#F3F4F6'
      }],
      margin: [0, 4, 0, 0]
    });

    return items;
  });
}