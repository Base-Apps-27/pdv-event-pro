/**
 * pdfmake-based Announcements PDF Generator
 * Generates two-column announcements layout (Fixed | Events)
 */

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
pdfMake.vfs = pdfFonts.pdfMake.vfs;

export function generateAnnouncementsPDF(announcements, serviceDate) {
  // Split announcements
  const fixed = announcements.filter(a => a.category === 'General');
  const dynamic = announcements.filter(a => a.category !== 'General' || a.isEvent);
  
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [36, 36, 36, 56],
    
    content: [
      // Header
      { 
        text: 'ANUNCIOS', 
        fontSize: 18, 
        bold: true, 
        alignment: 'center', 
        margin: [0, 0, 0, 8],
        color: '#000000'
      },
      { 
        text: formatDate(serviceDate), 
        fontSize: 11, 
        alignment: 'center', 
        margin: [0, 0, 0, 5],
        color: '#4B5563'
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
            stack: buildFixedAnnouncements(fixed)
          },
          { width: 20, text: '' }, // Gap
          {
            width: '*',
            stack: [
              {
                text: 'PRÓXIMOS EVENTOS',
                fontSize: 9,
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
              ...buildDynamicAnnouncements(dynamic)
            ]
          }
        ]
      }
    ],
    
    footer: (currentPage, pageCount) => ({
      stack: [
        {
          canvas: [{
            type: 'rect',
            x: 0, y: 0,
            w: 612, h: 20,
            color: '#1F8A70'
          }],
          margin: [0, 0, 0, 0]
        },
        {
          text: '¡Atrévete a cambiar!',
          alignment: 'center',
          fontSize: 9,
          bold: true,
          color: 'white',
          margin: [0, -14, 0, 0]
        }
      ],
      margin: [0, 772, 0, 0]
    }),
    
    defaultStyle: { 
      font: 'Helvetica', 
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

function sanitizeHtml(html) {
  if (!html) return '';
  return html
    .replace(/<(?!\/?(b|i|strong|em|br)\b)[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n');
}

function buildFixedAnnouncements(announcements) {
  if (announcements.length === 0) return [];
  
  return announcements.flatMap((ann, idx) => {
    const items = [];
    
    // Title
    items.push({
      text: ann.title,
      fontSize: 10,
      bold: true,
      color: '#000000',
      margin: [0, idx > 0 ? 8 : 0, 0, 3]
    });
    
    // Content
    if (ann.content) {
      items.push({
        text: sanitizeHtml(ann.content),
        fontSize: 9.5,
        color: '#374151',
        margin: [0, 0, 0, 2]
      });
    }
    
    // Instructions (CUE)
    if (ann.instructions) {
      items.push({
        text: [
          { text: 'CUE: ', bold: true, fontSize: 8.5, color: '#1F2937' },
          { text: sanitizeHtml(ann.instructions), fontSize: 8.5, color: '#6B7280', italics: true }
        ],
        margin: [6, 2, 0, 0]
      });
    }
    
    // Video indicator
    if (ann.has_video) {
      items.push({
        text: '📹 Video',
        fontSize: 8,
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

function buildDynamicAnnouncements(announcements) {
  if (announcements.length === 0) return [];
  
  return announcements.flatMap((ann, idx) => {
    const items = [];
    const isEmphasized = ann.emphasize || ann.category === 'Urgent';
    
    // Event block
    const eventItems = [];
    
    // Title
    eventItems.push({
      text: ann.isEvent ? ann.name : ann.title,
      fontSize: 10,
      bold: true,
      color: '#16A34A',
      margin: [0, 0, 0, 2]
    });
    
    // Date
    const eventDate = ann.date_of_occurrence || ann.start_date;
    if (eventDate) {
      eventItems.push({
        text: formatDate(eventDate),
        fontSize: 9,
        color: '#4B5563',
        bold: true,
        margin: [0, 0, 0, 2]
      });
    }
    
    // Content
    const content = ann.isEvent ? (ann.announcement_blurb || ann.description) : ann.content;
    if (content) {
      eventItems.push({
        text: sanitizeHtml(content),
        fontSize: 9,
        color: '#374151',
        margin: [0, 0, 0, 2]
      });
    }
    
    // Instructions
    if (ann.instructions) {
      eventItems.push({
        text: [
          { text: 'CUE: ', bold: true, fontSize: 8.5, color: '#1F2937' },
          { text: sanitizeHtml(ann.instructions), fontSize: 8.5, color: '#6B7280', italics: true }
        ],
        margin: [6, 2, 0, 0]
      });
    }
    
    // Video indicator
    if (ann.has_video || ann.announcement_has_video) {
      eventItems.push({
        text: '📹 Video',
        fontSize: 8,
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