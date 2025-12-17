import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { jsPDF } from 'npm:jspdf@2.5.1';

// ===== UTILITIES =====
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:image/png;base64,${btoa(binary)}`;
  } catch (e) {
    console.error('Logo fetch error:', e);
    return null;
  }
}

function formatDateSpanish(dateStr) {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const date = new Date(dateStr + 'T12:00:00');
  return `Domingo ${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
}

function calculateSegmentTime(segments, index, startHour, startMin) {
  let totalMinutes = 0;
  for (let i = 0; i < index; i++) {
    if (segments[i] && segments[i].type !== 'break') {
      totalMinutes += segments[i].duration || 0;
    }
  }
  const totalMins = startHour * 60 + startMin + totalMinutes;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function stripCuePrefix(text) {
  if (!text) return '';
  return text.replace(/^CUE[:\s]*/gi, '').trim();
}

// Map special characters to ASCII equivalents for Helvetica
function toAscii(text) {
  if (!text) return '';
  const map = {
    'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
    'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Ö': 'O',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
    'ñ': 'n', 'Ñ': 'N',
    '¡': '!', '¿': '?',
    '"': '"', '"': '"', ''': "'", ''': "'"
  };
  return String(text).split('').map(c => map[c] || c).join('');
}

// ===== COLORS =====
const COLORS = {
  black: [26, 26, 26],
  gray: [75, 85, 99],
  grayLight: [107, 114, 128],
  grayBorder: [229, 231, 235],
  red: [185, 28, 28],
  green: [141, 198, 63],
  teal: [31, 138, 112],
  white: [255, 255, 255],
  cueBoxBg: [254, 243, 199],
  cueBoxBorder: [251, 191, 36],
  cueBoxText: [146, 64, 14]
};

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serviceData, selectedDate, includeAnnouncements } = await req.json();
    const { service, announcements } = serviceData;

    const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png';
    const logoBase64 = await fetchImageAsBase64(logoUrl);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    const colWidth = (contentWidth - 24) / 2;
    const col1X = margin;
    const col2X = margin + colWidth + 24;
    const footerHeight = 28;

    // ==================== PAGE 1: SERVICE ORDER ====================
    let y = margin;

    // Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin, y - 5, 28, 28);
      } catch (e) {
        console.error('Logo add error:', e);
      }
    }

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text('ORDEN DE SERVICIO', pageWidth / 2, y + 10, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text(toAscii(formatDateSpanish(selectedDate)), pageWidth / 2, y + 26, { align: 'center' });

    y += 42;

    // Team info bar
    doc.setDrawColor(...COLORS.grayBorder);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;

    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    const coord = service.coordinators?.['9:30am'] || service.coordinators?.['11:30am'] || '-';
    const ujier = service.ujieres?.['9:30am'] || service.ujieres?.['11:30am'] || '-';
    const sonido = service.sound?.['9:30am'] || '-';
    const luces = service.luces?.['9:30am'] || service.luces?.['11:30am'] || '-';

    const teamText = `Coordinador: ${coord}   |   Ujier: ${ujier}   |   Sonido: ${sonido}   |   Luces: ${luces}`;
    doc.text(toAscii(teamText), pageWidth / 2, y, { align: 'center' });

    y += 20;

    // Column headers
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text('9:30 A.M.', col1X, y);
    doc.text('11:30 A.M.', col2X, y);
    
    // Underline headers
    doc.setDrawColor(...COLORS.teal);
    doc.setLineWidth(2);
    doc.line(col1X, y + 3, col1X + 55, y + 3);
    doc.line(col2X, y + 3, col2X + 60, y + 3);
    
    y += 16;

    // Segment rendering
    const segments930 = (service['9:30am'] || []).filter(s => s.type !== 'break');
    const segments1130 = (service['11:30am'] || []).filter(s => s.type !== 'break');

    let y1 = y;
    let y2 = y;

    const renderSegment = (seg, x, startY, colW, allSegs, idx, startH, startM) => {
      let cy = startY;
      const time = calculateSegmentTime(allSegs, idx, startH, startM);

      // Time in red bold
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.red);
      doc.text(time, x, cy);
      
      // Title in black bold
      const timeW = doc.getTextWidth(time);
      doc.setTextColor(...COLORS.black);
      const title = toAscii((seg.title || '').toUpperCase());
      doc.text(title, x + timeW + 6, cy);

      // Duration
      if (seg.duration) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.grayLight);
        doc.setFontSize(8);
        const titleW = doc.getTextWidth(title);
        doc.text(`(${seg.duration} mins)`, x + timeW + titleW + 12, cy);
      }

      cy += 12;

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);

      // Leader
      if (seg.data?.leader) {
        doc.text('Dirige: ', x, cy);
        const labelW = doc.getTextWidth('Dirige: ');
        doc.setTextColor(...COLORS.teal);
        doc.setFont('helvetica', 'bold');
        doc.text(toAscii('P. ' + seg.data.leader), x + labelW, cy);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.gray);
        cy += 11;
      }

      // Projection notes
      if (seg.data?.projection_notes) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.grayLight);
        doc.setFont('helvetica', 'italic');
        const noteLines = doc.splitTextToSize(toAscii('- ' + seg.data.projection_notes), colW - 10);
        doc.text(noteLines, x, cy);
        cy += noteLines.length * 9;
        doc.setFont('helvetica', 'normal');
      }

      // Songs
      if (seg.songs) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        seg.songs.filter(s => s.title).forEach(s => {
          const songLine = toAscii(`- ${s.title}${s.lead ? ` (${s.lead})` : ''}`);
          doc.text(songLine, x, cy);
          cy += 10;
        });
      }

      // Ministry section
      if (seg.data?.ministry_leader) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.black);
        doc.text(toAscii('Ministracion de Sanidad y Milagros'), x, cy);
        cy += 11;
        doc.setTextColor(...COLORS.teal);
        doc.text(toAscii('P. ' + seg.data.ministry_leader), x, cy);
        const nameW = doc.getTextWidth(toAscii('P. ' + seg.data.ministry_leader));
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.grayLight);
        doc.setFontSize(7.5);
        doc.text(' (4 mins.)', x + nameW, cy);
        cy += 10;
        doc.setFont('helvetica', 'italic');
        doc.text(toAscii('(Debe estar listo (a) desde que inicia la adoracion)'), x, cy);
        doc.setFont('helvetica', 'normal');
        cy += 10;
      }

      // Presenter
      if (seg.data?.presenter && !seg.data?.ministry_leader) {
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.teal);
        doc.setFont('helvetica', 'bold');
        doc.text(toAscii('P. ' + seg.data.presenter), x, cy);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.gray);
        cy += 11;
      }

      // Preacher
      if (seg.data?.preacher) {
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.teal);
        doc.setFont('helvetica', 'bold');
        doc.text(toAscii('A. ' + seg.data.preacher), x, cy);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.gray);
        cy += 11;
      }

      // Message title
      if (seg.data?.title) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text(toAscii(seg.data.title), x, cy);
        cy += 10;
      }

      // Sound notes
      if (seg.data?.sound_notes) {
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.grayLight);
        doc.setFont('helvetica', 'italic');
        const noteLines = doc.splitTextToSize(toAscii(seg.data.sound_notes), colW - 10);
        doc.text(noteLines, x, cy);
        cy += noteLines.length * 8;
        doc.setFont('helvetica', 'normal');
      }

      // Actions (cues)
      if (seg.actions && seg.actions.length > 0) {
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.grayLight);
        doc.setFont('helvetica', 'italic');
        seg.actions.forEach(action => {
          let txt = stripCuePrefix(action.label);
          if (action.timing === 'before_end' && action.offset_min) {
            txt += ` (${action.offset_min} min antes)`;
          }
          doc.text(toAscii(txt), x, cy);
          cy += 9;
        });
        doc.setFont('helvetica', 'normal');
      }

      return cy + 8;
    };

    // Render 9:30 column
    segments930.forEach((seg, idx) => {
      y1 = renderSegment(seg, col1X, y1, colWidth, segments930, idx, 9, 30);
    });

    // Render 11:30 column
    segments1130.forEach((seg, idx) => {
      y2 = renderSegment(seg, col2X, y2, colWidth, segments1130, idx, 11, 30);
    });

    // Receso section
    const recesoY = Math.max(y1, y2) + 12;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text('11:00AM A 11:30AM', pageWidth / 2, recesoY, { align: 'center' });
    doc.text('RECESO', pageWidth / 2, recesoY + 14, { align: 'center' });

    // Footer bar
    doc.setFillColor(...COLORS.green);
    doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text(toAscii('!Atrevete a cambiar!'), pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ==================== PAGE 2: ANNOUNCEMENTS ====================
    if (includeAnnouncements && announcements && announcements.length > 0) {
      doc.addPage();
      let ay = margin;

      // Logo centered
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 14, ay - 5, 28, 28);
        } catch (e) {
          console.error('Logo add error page 2:', e);
        }
      }

      ay += 30;

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.black);
      doc.text('ANUNCIOS', pageWidth / 2, ay, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.text(toAscii(formatDateSpanish(selectedDate)), pageWidth / 2, ay + 16, { align: 'center' });

      ay += 36;

      let ay1 = ay;
      let ay2 = ay;

      const renderAnnouncement = (ann, x, startY, colW) => {
        let cy = startY;
        const title = toAscii(ann.title || ann.name || '');

        // Left accent bar
        doc.setFillColor(...COLORS.teal);
        doc.rect(x, cy, 3, 12, 'F');

        // Title
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.black);
        doc.text(title, x + 8, cy + 8);
        cy += 18;

        // Content
        const content = ann.content || ann.announcement_blurb || ann.description || '';
        if (content) {
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.gray);
          const contentLines = doc.splitTextToSize(toAscii(content), colW - 10);
          doc.text(contentLines, x, cy);
          cy += contentLines.length * 10 + 4;
        }

        // CUE box
        if (ann.instructions) {
          cy += 4;
          const instrText = toAscii(stripCuePrefix(ann.instructions));
          const instrLines = doc.splitTextToSize(instrText, colW - 20);
          const boxHeight = instrLines.length * 9 + 22;

          // Yellow box background
          doc.setFillColor(...COLORS.cueBoxBg);
          doc.setDrawColor(...COLORS.cueBoxBorder);
          doc.setLineWidth(1);
          doc.roundedRect(x, cy, colW - 5, boxHeight, 3, 3, 'FD');

          // CUE label
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.cueBoxText);
          doc.text('CUE PARA EL ANUNCIADOR', x + 6, cy + 10);

          // CUE content
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'italic');
          doc.text(instrLines, x + 6, cy + 20);

          cy += boxHeight + 8;
        }

        return cy + 12;
      };

      // Alternate announcements between columns
      announcements.forEach((ann, i) => {
        if (i % 2 === 0) {
          ay1 = renderAnnouncement(ann, col1X, ay1, colWidth);
        } else {
          ay2 = renderAnnouncement(ann, col2X, ay2, colWidth);
        }
      });

      // Footer
      doc.setFillColor(...COLORS.green);
      doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.white);
      doc.text(toAscii('!Atrevete a cambiar!'), pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    // Output
    const pdfOutput = doc.output('arraybuffer');
    return new Response(pdfOutput, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="servicio-${selectedDate}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});