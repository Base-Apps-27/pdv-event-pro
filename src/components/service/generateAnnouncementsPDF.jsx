/**
 * pdfmake-based Announcements PDF Generator
 * Generates two-column announcements layout (Fixed | Events)
 */

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { getLogoDataUrl } from './pdfLogoData';
pdfMake.vfs = pdfFonts.vfs;

/**
 * Estimate optimal scale based on announcements density
 * Target: 620pt content area (accounts for header + footer)
 * Returns scale factor 0.80–1.0
 */
function estimateOptimalScale(announcements) {
  const totalItems = announcements.length;
  const totalChars = announcements.reduce((sum, a) => sum + (a.content?.length || 0) + (a.instructions?.length || 0), 0);
  
  // Light: <5 items, <1000 chars → 1.0
  // Medium: 5-10 items, 1000-3000 chars → 0.90
  // Heavy: 10+ items or 3000+ chars → 0.80
  
  let scale = 1.0;
  if (totalItems > 10 || totalChars > 3000) scale = 0.80;
  else if (totalItems > 5 || totalChars > 1000) scale = 0.90;
  
  return scale;
}

export async function generateAnnouncementsPDF(announcements, serviceDate) {
  // Split announcements
  const fixed = announcements.filter(a => a.category === 'General');
  const dynamic = announcements.filter(a => a.category !== 'General' || a.isEvent);
  const globalScale = estimateOptimalScale(announcements);
  const logoDataUrl = await getLogoDataUrl();
  
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [36, 36, 36, 56],
    
    content: [
      // Logo + Title Header (PDV Branding)
      {
        columns: [
          logoDataUrl ? {
            width: 50,
            image: logoDataUrl,
            width: 50,
            height: 50,
            alignment: 'left'
          } : { width: 50, text: '' },
          { width: '*', text: '' },
          {
            width: 'auto',
            stack: [
              {
                text: 'ANUNCIOS',
                fontSize: 18 * globalScale,
                bold: true,
                alignment: 'center',
                color: '#000000',
                margin: [0, 0, 0, 2]
              },
              {
                text: formatDate(serviceDate),
                fontSize: 11 * globalScale,
                alignment: 'center',
                color: '#4B5563',
                margin: [0, 0, 0, 4]
              }
            ]
          },
          { width: '*', text: '' },
          { width: 50, text: '' }
        ],
        margin: [0, 0, 0, 8]
      },
      
      // Divider
      { 
        canvas: [{ 
          type: 'line', 
          x1: 0, y1: 0, x2: 540, y2: 0, 
          lineWidth: 0.5, 
          lineColor: '#E5E7EB' 
        }], 
        margin: [0, 0, 0, 15] 
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
                fontSize: 9 * globalScale,
                bold: true,
                color: '#6B7280',
                margin: [0, 0, 0, 8]
              },
              {
                canvas: [{
                  type: 'line',
                  x1: 0, y1: 0, x2: 250, y2: 0,
                  lineWidth: 0.5,
                  lineColor: '#E5E7EB'
                }],
                margin: [0, 0, 0, 8]
              },
              ...buildDynamicAnnouncements(dynamic, globalScale)
            ]
          }
        ]
      }
    ],
    
    footer: (currentPage, pageCount) => {
      return {
        stack: [
          {
            canvas: [{
              type: 'rect',
              x: 0,
              y: 0,
              w: 612,
              h: 24,
              color: '#1F8A70'
            }]
          },
          {
            text: '¡Atrévete a cambiar!',
            color: 'white',
            fontSize: 10,
            bold: true,
            alignment: 'center',
            margin: [-36, -18, -36, 0]
          }
        ]
      };
    },
    
    defaultStyle: { 
      fontSize: 9.5, 
      lineHeight: 1.3,
      color: '#374151'
    }
  };
  
  return pdfMake.createPdf(docDefinition);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
}

function parseHtmlToPdfMake(html, globalScale = 1) {
  if (!html || typeof html !== 'string') return '';

  // Clean unwanted tags but keep b, i, strong, em, br
  let cleaned = html
    .replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

  // If no HTML tags, return plain text
  if (!/<[^>]+>/.test(cleaned)) return cleaned;

  const result = [];
  const parts = cleaned.split(/(<\/?(?:b|i|strong|em|br\s*\/?)>)/gi);

  let currentBold = false;
  let currentItalic = false;

  for (let part of parts) {
    if (!part) continue;
    if (part === '<b>' || part === '<strong>') {
      currentBold = true;
    } else if (part === '</b>' || part === '</strong>') {
      currentBold = false;
    } else if (part === '<i>' || part === '<em>') {
      currentItalic = true;
    } else if (part === '</i>' || part === '</em>') {
      currentItalic = false;
    } else if (part === '<br>' || part === '<br/>') {
      result.push({ text: '\n' });
    } else if (part && part.trim()) {
      result.push({
        text: part,
        ...(currentBold && { bold: true }),
        ...(currentItalic && { italics: true })
      });
    }
  }

  return result.length > 0 ? result : cleaned;
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