import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Use pdfkit instead - it has native Unicode support
import PDFDocument from 'npm:pdfkit@0.15.0';

// ===== UTILITIES =====
async function fetchImageBuffer(url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
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

// ===== COLORS (RGB 0-255) =====
const COLORS = {
  black: '#1a1a1a',
  gray: '#4b5563',
  grayLight: '#6b7280',
  grayBorder: '#e5e7eb',
  red: '#b91c1c',
  green: '#8dc63f',
  teal: '#1f8a70',
  white: '#ffffff',
  cueBoxBg: '#fef3c7',
  cueBoxBorder: '#fbbf24',
  cueBoxText: '#92400e'
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
    const logoBuffer = await fetchImageBuffer(logoUrl);

    // Create PDF with pdfkit - native Unicode support
    const doc = new PDFDocument({
      size: 'letter',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      bufferPages: true
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const pageWidth = 612; // letter width in points
    const pageHeight = 792; // letter height in points
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    const colWidth = (contentWidth - 24) / 2;
    const col1X = margin;
    const col2X = margin + colWidth + 24;
    const footerHeight = 28;

    // ==================== PAGE 1: SERVICE ORDER ====================
    
    // Logo
    if (logoBuffer) {
      doc.image(logoBuffer, margin, 35, { width: 28 });
    }

    // Title
    doc.fontSize(20).font('Helvetica-Bold').fillColor(COLORS.black);
    doc.text('ORDEN DE SERVICIO', margin, 40, { align: 'center', width: contentWidth });
    
    doc.fontSize(11).font('Helvetica').fillColor(COLORS.gray);
    doc.text(formatDateSpanish(selectedDate), margin, 62, { align: 'center', width: contentWidth });

    // Team info bar
    let y = 85;
    doc.strokeColor(COLORS.grayBorder).lineWidth(0.5);
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
    y += 12;

    doc.fontSize(8);
    const coord = service.coordinators?.['9:30am'] || service.coordinators?.['11:30am'] || '-';
    const ujier = service.ujieres?.['9:30am'] || service.ujieres?.['11:30am'] || '-';
    const sonido = service.sound?.['9:30am'] || '-';
    const luces = service.luces?.['9:30am'] || service.luces?.['11:30am'] || '-';

    const teamText = `Coordinador: ${coord}    Ujier: ${ujier}    Sonido: ${sonido}    Luces: ${luces}`;
    doc.fillColor(COLORS.gray).text(teamText, margin, y, { align: 'center', width: contentWidth });

    y += 22;

    // Column headers
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.black);
    doc.text('9:30 A.M.', col1X, y);
    doc.text('11:30 A.M.', col2X, y);
    y += 18;

    // Segment rendering
    const segments930 = (service['9:30am'] || []).filter(s => s.type !== 'break');
    const segments1130 = (service['11:30am'] || []).filter(s => s.type !== 'break');

    let y1 = y;
    let y2 = y;

    const renderSegment = (seg, x, startY, allSegs, idx, startH, startM) => {
      let cy = startY;
      const time = calculateSegmentTime(allSegs, idx, startH, startM);
      const title = (seg.title || '').toUpperCase();

      // Time in red bold
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.red);
      doc.text(time, x, cy, { continued: true });
      
      // Title in black bold
      doc.fillColor(COLORS.black).text(`  ${title}`, { continued: true });
      
      // Duration in gray
      if (seg.duration) {
        doc.font('Helvetica').fillColor(COLORS.grayLight).fontSize(8);
        doc.text(` (${seg.duration} mins)`);
      } else {
        doc.text('');
      }
      cy += 12;

      doc.fontSize(8.5).font('Helvetica').fillColor(COLORS.gray);

      // Leader
      if (seg.data?.leader) {
        doc.text('Dirige: ', x, cy, { continued: true });
        doc.font('Helvetica-Bold').fillColor(COLORS.teal).text(`P. ${seg.data.leader}`);
        doc.font('Helvetica').fillColor(COLORS.gray);
        cy += 11;
      }

      // Projection notes
      if (seg.data?.projection_notes) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor(COLORS.grayLight);
        doc.text(`- ${seg.data.projection_notes}`, x, cy);
        doc.font('Helvetica').fillColor(COLORS.gray);
        cy += 10;
      }

      // Songs
      if (seg.songs) {
        doc.fontSize(8).fillColor(COLORS.gray);
        seg.songs.filter(s => s.title).forEach(s => {
          const songLine = `- ${s.title}${s.lead ? ` (${s.lead})` : ''}`;
          doc.text(songLine, x, cy);
          cy += 10;
        });
      }

      // Ministry section
      if (seg.data?.ministry_leader) {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COLORS.black);
        doc.text('Ministración de Sanidad y Milagros', x, cy);
        cy += 11;
        doc.fillColor(COLORS.teal).text(`P. ${seg.data.ministry_leader}`, x, cy, { continued: true });
        doc.font('Helvetica').fillColor(COLORS.grayLight).fontSize(7.5).text(' (4 mins.)');
        cy += 10;
        doc.font('Helvetica-Oblique').text('(Debe estar listo (a) desde que inicia la adoración)', x, cy);
        doc.font('Helvetica');
        cy += 10;
      }

      // Presenter
      if (seg.data?.presenter && !seg.data?.ministry_leader) {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COLORS.teal);
        doc.text(`P. ${seg.data.presenter}`, x, cy);
        doc.font('Helvetica').fillColor(COLORS.gray);
        cy += 11;
      }

      // Preacher
      if (seg.data?.preacher) {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COLORS.teal);
        doc.text(`A. ${seg.data.preacher}`, x, cy);
        doc.font('Helvetica').fillColor(COLORS.gray);
        cy += 11;
      }

      // Message title
      if (seg.data?.title) {
        doc.fontSize(8).fillColor(COLORS.gray);
        doc.text(seg.data.title, x, cy);
        cy += 10;
      }

      // Sound notes
      if (seg.data?.sound_notes) {
        doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(COLORS.grayLight);
        doc.text(seg.data.sound_notes, x, cy);
        doc.font('Helvetica');
        cy += 9;
      }

      // Actions
      if (seg.actions && seg.actions.length > 0) {
        doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(COLORS.grayLight);
        seg.actions.forEach(action => {
          let txt = stripCuePrefix(action.label);
          if (action.timing === 'before_end' && action.offset_min) {
            txt += ` (${action.offset_min} min antes)`;
          }
          doc.text(txt, x, cy);
          cy += 9;
        });
        doc.font('Helvetica');
      }

      return cy + 8;
    };

    // Render both columns
    segments930.forEach((seg, idx) => {
      y1 = renderSegment(seg, col1X, y1, segments930, idx, 9, 30);
    });

    segments1130.forEach((seg, idx) => {
      y2 = renderSegment(seg, col2X, y2, segments1130, idx, 11, 30);
    });

    // Receso section
    const recesoY = Math.max(y1, y2) + 10;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.black);
    doc.text('11:00AM A 11:30AM', margin, recesoY, { align: 'center', width: contentWidth });
    doc.text('RECESO', margin, recesoY + 14, { align: 'center', width: contentWidth });

    // Footer bar
    doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight).fill(COLORS.green);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.white);
    doc.text('¡Atrévete a cambiar!', 0, pageHeight - footerHeight + 9, { align: 'center', width: pageWidth });

    // ==================== PAGE 2: ANNOUNCEMENTS ====================
    if (includeAnnouncements && announcements && announcements.length > 0) {
      doc.addPage();

      // Logo centered
      if (logoBuffer) {
        doc.image(logoBuffer, pageWidth / 2 - 14, 35, { width: 28 });
      }

      // Title
      doc.fontSize(20).font('Helvetica-Bold').fillColor(COLORS.black);
      doc.text('ANUNCIOS', margin, 70, { align: 'center', width: contentWidth });
      
      doc.fontSize(11).font('Helvetica').fillColor(COLORS.gray);
      doc.text(formatDateSpanish(selectedDate), margin, 92, { align: 'center', width: contentWidth });

      let ay = 115;
      let ay1 = ay;
      let ay2 = ay;

      const renderAnnouncement = (ann, x, startY, colW) => {
        let cy = startY;
        const title = ann.title || ann.name || '';

        // Left accent bar
        doc.rect(x, cy, 3, 14).fill(COLORS.teal);

        // Title
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.black);
        doc.text(title, x + 8, cy + 2);
        cy += 18;

        // Content
        const content = ann.content || ann.announcement_blurb || ann.description || '';
        if (content) {
          doc.fontSize(8.5).font('Helvetica').fillColor(COLORS.gray);
          doc.text(content, x, cy, { width: colW - 10 });
          cy += doc.heightOfString(content, { width: colW - 10 }) + 4;
        }

        // CUE box
        if (ann.instructions) {
          cy += 4;
          const instrText = stripCuePrefix(ann.instructions);
          const instrHeight = doc.heightOfString(instrText, { width: colW - 20 });
          const boxHeight = instrHeight + 24;

          // Yellow box
          doc.roundedRect(x, cy, colW - 5, boxHeight, 3).fillAndStroke(COLORS.cueBoxBg, COLORS.cueBoxBorder);

          // CUE label
          doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.cueBoxText);
          doc.text('CUE PARA EL ANUNCIADOR', x + 6, cy + 6);

          // CUE content
          doc.fontSize(7.5).font('Helvetica-Oblique');
          doc.text(instrText, x + 6, cy + 18, { width: colW - 20 });

          cy += boxHeight + 6;
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
      doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight).fill(COLORS.green);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.white);
      doc.text('¡Atrévete a cambiar!', 0, pageHeight - footerHeight + 9, { align: 'center', width: pageWidth });
    }

    // Finalize
    doc.end();

    // Wait for all chunks
    const pdfBuffer = await new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    return new Response(pdfBuffer, {
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