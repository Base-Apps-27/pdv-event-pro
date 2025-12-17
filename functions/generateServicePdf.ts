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

// ASCII-safe text for Helvetica (jsPDF default font doesn't support full Unicode)
function safeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[áàâä]/gi, (c) => c.toLowerCase() === c ? 'a' : 'A')
    .replace(/[éèêë]/gi, (c) => c.toLowerCase() === c ? 'e' : 'E')
    .replace(/[íìîï]/gi, (c) => c.toLowerCase() === c ? 'i' : 'I')
    .replace(/[óòôö]/gi, (c) => c.toLowerCase() === c ? 'o' : 'O')
    .replace(/[úùûü]/gi, (c) => c.toLowerCase() === c ? 'u' : 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/¡/g, '!').replace(/¿/g, '?')
    .replace(/[""]/g, '"').replace(/['']/g, "'");
}

// ===== COLORS =====
const COLORS = {
  black: [26, 26, 26],
  gray: [75, 85, 99],
  grayLight: [107, 114, 128],
  grayBorder: [229, 231, 235],
  red: [185, 28, 28],
  green: [141, 198, 63],
  greenDark: [34, 139, 34],
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
    const maxContentY = pageHeight - footerHeight - 20;

    // ==================== PAGE 1: SERVICE ORDER ====================
    let y = margin;

    // Logo
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', margin, y - 5, 28, 28);
    }

    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text('ORDEN DE SERVICIO', pageWidth / 2, y + 10, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text(safeText(formatDateSpanish(selectedDate)), pageWidth / 2, y + 24, { align: 'center' });

    y += 38;

    // Team info bar
    doc.setDrawColor(...COLORS.grayBorder);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;

    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    const coord = service.coordinators?.['9:30am'] || service.coordinators?.['11:30am'] || '';
    const ujier = service.ujieres?.['9:30am'] || service.ujieres?.['11:30am'] || '';
    const sonido = service.sound?.['9:30am'] || '';
    const luces = service.luces?.['9:30am'] || service.luces?.['11:30am'] || '';

    let teamX = margin;
    const teamItems = [
      { label: 'Coordinador:', value: coord },
      { label: 'Ujier:', value: ujier },
      { label: 'Sonido:', value: sonido },
      { label: 'Luces:', value: luces }
    ];
    teamItems.forEach((item, i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(safeText(item.label), teamX, y);
      const labelW = doc.getTextWidth(safeText(item.label));
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.teal);
      doc.text(safeText(item.value || '-'), teamX + labelW + 3, y);
      doc.setTextColor(...COLORS.gray);
      teamX += labelW + doc.getTextWidth(safeText(item.value || '-')) + 20;
    });

    y += 20;

    // Column headers
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text('9:30 A.M.', col1X, y);
    doc.text('11:30 A.M.', col2X, y);
    y += 6;

    // Segment rendering
    const segments930 = (service['9:30am'] || []).filter(s => s.type !== 'break');
    const segments1130 = (service['11:30am'] || []).filter(s => s.type !== 'break');

    let y1 = y;
    let y2 = y;

    const renderSegment = (seg, x, startY, colW, allSegs, idx, startH, startM) => {
      let cy = startY;
      const time = calculateSegmentTime(allSegs, idx, startH, startM);

      // Time + Title line
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.red);
      doc.text(time, x, cy);

      doc.setTextColor(...COLORS.black);
      const timeW = doc.getTextWidth(time);
      const title = safeText((seg.title || '').toUpperCase());
      doc.text(title, x + timeW + 6, cy);

      if (seg.duration) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.grayLight);
        doc.setFontSize(8);
        const titleW = doc.getTextWidth(title);
        doc.text(`(${seg.duration} mins)`, x + timeW + titleW + 12, cy);
      }

      cy += 11;

      // Details
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);

      // Leader with "Dirige: P. Name" format
      if (seg.data?.leader) {
        doc.text('Dirige: ', x, cy);
        doc.setTextColor(...COLORS.teal);
        doc.setFont('helvetica', 'bold');
        doc.text(safeText('P. ' + seg.data.leader), x + doc.getTextWidth('Dirige: '), cy);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.gray);
        cy += 10;
      }

      // Sub-notes (projection notes, etc)
      if (seg.data?.projection_notes) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.grayLight);
        doc.setFont('helvetica', 'italic');
        doc.text(safeText('- ' + seg.data.projection_notes), x, cy);
        doc.setFont('helvetica', 'normal');
        cy += 9;
      }

      // Songs
      if (seg.songs) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        seg.songs.filter(s => s.title).forEach(s => {
          const songLine = `- ${s.title}${s.lead ? ` (${s.lead})` : ''}`;
          doc.text(safeText(songLine), x, cy);
          cy += 9;
        });
      }

      // Ministry section
      if (seg.data?.ministry_leader) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.black);
        doc.text(safeText('Ministracion de Sanidad y Milagros'), x, cy);
        cy += 10;
        doc.setTextColor(...COLORS.teal);
        doc.text(safeText('P. ' + seg.data.ministry_leader), x, cy);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.grayLight);
        doc.setFontSize(7.5);
        doc.text(' (4 mins.)', x + doc.getTextWidth(safeText('P. ' + seg.data.ministry_leader)), cy);
        cy += 9;
        doc.setFont('helvetica', 'italic');
        doc.text(safeText('(Debe estar listo (a) desde que inicia la adoracion)'), x, cy);
        doc.setFont('helvetica', 'normal');
        cy += 9;
      }

      // Presenter
      if (seg.data?.presenter && !seg.data?.ministry_leader) {
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.teal);
        doc.setFont('helvetica', 'bold');
        doc.text(safeText('P. ' + seg.data.presenter), x, cy);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.gray);
        cy += 10;
      }

      // Preacher
      if (seg.data?.preacher) {
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.teal);
        doc.setFont('helvetica', 'bold');
        doc.text(safeText('A. ' + seg.data.preacher), x, cy);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.gray);
        cy += 10;
      }

      // Message title
      if (seg.data?.title) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text(safeText(seg.data.title), x, cy);
        cy += 9;
      }

      // Notes/instructions
      if (seg.data?.sound_notes) {
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.grayLight);
        doc.setFont('helvetica', 'italic');
        doc.text(safeText(seg.data.sound_notes), x, cy);
        doc.setFont('helvetica', 'normal');
        cy += 8;
      }

      // Actions (italicized cues)
      if (seg.actions && seg.actions.length > 0) {
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.grayLight);
        doc.setFont('helvetica', 'italic');
        seg.actions.forEach(action => {
          let txt = stripCuePrefix(action.label);
          if (action.timing === 'before_end' && action.offset_min) {
            txt += ` (${action.offset_min} min antes)`;
          }
          doc.text(safeText(txt), x, cy);
          cy += 8;
        });
        doc.setFont('helvetica', 'normal');
      }

      return cy + 6;
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
    const recesoY = Math.max(y1, y2) + 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text('11:00AM A 11:30AM', pageWidth / 2, recesoY, { align: 'center' });
    doc.text('RECESO', pageWidth / 2, recesoY + 14, { align: 'center' });

    // Footer gradient bar
    doc.setFillColor(...COLORS.green);
    doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text(safeText('!Atrevete a cambiar!'), pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ==================== PAGE 2: ANNOUNCEMENTS ====================
    if (includeAnnouncements && announcements && announcements.length > 0) {
      doc.addPage();
      let ay = margin;

      // Logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', pageWidth / 2 - 14, ay - 5, 28, 28);
      }

      ay += 30;

      // Title
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.black);
      doc.text('ANUNCIOS', pageWidth / 2, ay, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.text(safeText(formatDateSpanish(selectedDate)), pageWidth / 2, ay + 14, { align: 'center' });

      ay += 30;

      // Two-column announcements
      let ay1 = ay;
      let ay2 = ay;
      const annColWidth = colWidth;

      const renderAnnouncement = (ann, x, startY, colW) => {
        let cy = startY;
        const title = safeText(ann.title || ann.name || '');

        // Title with left border accent
        doc.setDrawColor(...COLORS.teal);
        doc.setLineWidth(3);
        doc.line(x, cy - 2, x, cy + 10);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.black);
        doc.text(title, x + 8, cy + 6);
        cy += 18;

        // Content
        const content = ann.content || ann.announcement_blurb || ann.description || '';
        if (content) {
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.gray);
          const lines = doc.splitTextToSize(safeText(content), colW - 10);
          doc.text(lines, x, cy);
          cy += lines.length * 10;
        }

        // CUE box
        if (ann.instructions) {
          cy += 4;
          const instrText = stripCuePrefix(ann.instructions);
          const instrLines = doc.splitTextToSize(safeText(instrText), colW - 45);
          const boxHeight = instrLines.length * 9 + 12;

          // Yellow background box
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

          cy += boxHeight + 6;
        }

        return cy + 10;
      };

      // Distribute announcements alternating columns
      announcements.forEach((ann, i) => {
        if (i % 2 === 0) {
          ay1 = renderAnnouncement(ann, col1X, ay1, annColWidth);
        } else {
          ay2 = renderAnnouncement(ann, col2X, ay2, annColWidth);
        }
      });

      // Footer
      doc.setFillColor(...COLORS.green);
      doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.white);
      doc.text(safeText('!Atrevete a cambiar!'), pageWidth / 2, pageHeight - 10, { align: 'center' });
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