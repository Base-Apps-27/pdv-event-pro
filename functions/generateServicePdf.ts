import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { jsPDF } from 'npm:jspdf@2.5.1';

// Fetch image and convert to base64
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return `data:image/png;base64,${base64}`;
  } catch (e) {
    console.error('Failed to fetch logo:', e);
    return null;
  }
}

// Format date in Spanish
function formatDateSpanish(dateStr) {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const date = new Date(dateStr + 'T12:00:00');
  return `${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
}

// Calculate segment time
function calculateSegmentTime(segments, index, startTime) {
  let totalMinutes = 0;
  for (let i = 0; i < index; i++) {
    if (segments[i].type !== 'break' && segments[i].type !== 'ministry') {
      totalMinutes += segments[i].duration || 0;
    }
  }
  
  const [hours, minutes] = startTime.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const segmentMinutes = startMinutes + totalMinutes;
  
  const h = Math.floor(segmentMinutes / 60);
  const m = segmentMinutes % 60;
  const period = h >= 12 ? 'p.m.' : 'a.m.';
  const h12 = h > 12 ? h - 12 : h;
  
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serviceData, selectedDate, includeAnnouncements } = await req.json();
    const { service, announcements } = serviceData;

    // Fetch logo
    const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png';
    const logoBase64 = await fetchImageAsBase64(logoUrl);

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    let y = margin;

    // ===== PAGE 1: SERVICE ORDER =====
    
    // Logo
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', margin, y, 50, 50);
    }

    // Header title (centered)
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDEN DE SERVICIO', pageWidth / 2, y + 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(`Domingo ${formatDateSpanish(selectedDate)}`, pageWidth / 2, y + 36, { align: 'center' });

    // Team info line
    y += 55;
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    const teamLine = [
      `Coordinador: ${service.coordinators?.['9:30am'] || service.coordinators?.['11:30am'] || '-'}`,
      `Ujier: ${service.ujieres?.['9:30am'] || service.ujieres?.['11:30am'] || '-'}`,
      `Sonido: ${service.sound?.['9:30am'] || '-'}`,
      `Luces: ${service.luces?.['9:30am'] || service.luces?.['11:30am'] || '-'}`
    ].join('   •   ');
    
    // Separator line
    doc.setDrawColor(209, 213, 219);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;
    doc.text(teamLine, pageWidth / 2, y, { align: 'center' });
    y += 20;

    // Two columns setup
    const colWidth = (pageWidth - margin * 2 - 20) / 2;
    const col1X = margin;
    const col2X = margin + colWidth + 20;

    // Column headers
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 95, 140); // Blue color
    doc.text('9:30 A.M.', col1X, y);
    doc.text('11:30 A.M.', col2X, y);
    
    // Underlines
    doc.setDrawColor(31, 95, 140);
    doc.setLineWidth(1.5);
    doc.line(col1X, y + 4, col1X + 70, y + 4);
    doc.line(col2X, y + 4, col2X + 70, y + 4);
    y += 20;

    doc.setTextColor(0, 0, 0);

    // Render segments function
    const renderSegment = (seg, x, currentY, maxWidth, segments, idx, startTimeStr) => {
      if (seg.type === 'break') return currentY;

      const segTime = calculateSegmentTime(segments, idx, startTimeStr);
      
      // Time in red
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(181, 55, 55);
      doc.text(segTime, x, currentY);
      
      // Title in black bold uppercase
      doc.setTextColor(26, 26, 26);
      const titleX = x + 55;
      doc.text((seg.title || '').toUpperCase(), titleX, currentY);
      
      // Duration
      if (seg.duration) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(9);
        doc.text(`(${seg.duration} mins)`, titleX + doc.getTextWidth((seg.title || '').toUpperCase()) + 5, currentY);
      }
      
      currentY += 13;
      doc.setTextColor(55, 65, 81);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      // Leader
      if (seg.data?.leader) {
        doc.text(`Dirige: `, x, currentY);
        doc.setTextColor(141, 198, 63);
        doc.setFont('helvetica', 'bold');
        doc.text(seg.data.leader, x + 35, currentY);
        doc.setTextColor(55, 65, 81);
        doc.setFont('helvetica', 'normal');
        currentY += 11;
      }

      // Translator (for 11:30)
      if (seg.data?.translator) {
        doc.text(`/ traduce: `, x, currentY);
        doc.setTextColor(141, 198, 63);
        doc.setFont('helvetica', 'bold');
        doc.text(seg.data.translator, x + 45, currentY);
        doc.setTextColor(55, 65, 81);
        doc.setFont('helvetica', 'normal');
        currentY += 11;
      }

      // Songs
      if (seg.songs) {
        seg.songs.filter(s => s.title).forEach(s => {
          const songText = `- ${s.title}${s.lead ? ` (${s.lead})` : ''}`;
          doc.text(songText, x, currentY);
          currentY += 10;
        });
      }

      // Ministry leader
      if (seg.data?.ministry_leader) {
        doc.text(`Ministración: `, x, currentY);
        doc.setTextColor(141, 198, 63);
        doc.setFont('helvetica', 'bold');
        doc.text(seg.data.ministry_leader, x + 55, currentY);
        doc.setTextColor(55, 65, 81);
        doc.setFont('helvetica', 'normal');
        currentY += 11;
      }

      // Presenter
      if (seg.data?.presenter && !seg.data?.ministry_leader) {
        doc.setTextColor(141, 198, 63);
        doc.setFont('helvetica', 'bold');
        doc.text(seg.data.presenter, x, currentY);
        doc.setTextColor(55, 65, 81);
        doc.setFont('helvetica', 'normal');
        currentY += 11;
      }

      // Preacher
      if (seg.data?.preacher) {
        doc.setTextColor(141, 198, 63);
        doc.setFont('helvetica', 'bold');
        doc.text(seg.data.preacher, x, currentY);
        doc.setTextColor(55, 65, 81);
        doc.setFont('helvetica', 'normal');
        currentY += 11;
      }

      // Message title
      if (seg.data?.title) {
        doc.text(seg.data.title, x, currentY);
        currentY += 11;
      }

      // Verse
      if (seg.data?.verse) {
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(seg.data.verse, x, currentY);
        doc.setFontSize(9);
        doc.setTextColor(55, 65, 81);
        currentY += 10;
      }

      // Actions
      if (seg.actions && seg.actions.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.setFont('helvetica', 'italic');
        seg.actions.forEach(action => {
          let actionText = action.label;
          if (action.timing === 'before_end') actionText += ` (${action.offset_min} min antes)`;
          doc.text(actionText, x, currentY);
          currentY += 9;
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(55, 65, 81);
      }

      return currentY + 6;
    };

    // Render both columns
    let y1 = y;
    let y2 = y;

    const segments930 = (service['9:30am'] || []).filter(s => s.type !== 'break');
    const segments1130 = (service['11:30am'] || []).filter(s => s.type !== 'break');

    segments930.forEach((seg, idx) => {
      y1 = renderSegment(seg, col1X, y1, colWidth, service['9:30am'], idx, '9:30');
    });

    segments1130.forEach((seg, idx) => {
      y2 = renderSegment(seg, col2X, y2, colWidth, service['11:30am'], idx, '11:30');
    });

    // Receso section
    y = Math.max(y1, y2) + 15;
    
    doc.setFillColor(31, 95, 140);
    doc.rect(margin, y, pageWidth - margin * 2, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('11:00am a 11:30am', pageWidth / 2, y + 12, { align: 'center' });
    doc.text('RECESO', pageWidth / 2, y + 24, { align: 'center' });

    // Footer gradient bar
    doc.setFillColor(141, 198, 63);
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text('¡Atrévete a cambiar!', pageWidth / 2, pageHeight - 7, { align: 'center' });

    // ===== PAGE 2: ANNOUNCEMENTS =====
    if (includeAnnouncements && announcements && announcements.length > 0) {
      doc.addPage();
      y = margin;

      // Logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, y, 50, 50);
      }

      // Header
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('ANUNCIOS', pageWidth / 2, y + 20, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);
      doc.text(`Domingo ${formatDateSpanish(selectedDate)}`, pageWidth / 2, y + 36, { align: 'center' });
      
      y += 65;

      // Two column announcements
      const annColWidth = (pageWidth - margin * 2 - 20) / 2;
      let leftY = y;
      let rightY = y;
      let useLeft = true;

      announcements.forEach((ann, idx) => {
        const colX = useLeft ? margin : margin + annColWidth + 20;
        let currentY = useLeft ? leftY : rightY;

        // Check page break
        if (currentY > pageHeight - 100) {
          doc.addPage();
          leftY = margin;
          rightY = margin;
          currentY = margin;
          
          // Footer on new page
          doc.setFillColor(141, 198, 63);
          doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(9);
          doc.text('¡Atrévete a cambiar!', pageWidth / 2, pageHeight - 7, { align: 'center' });
        }

        // Title
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 26, 26);
        const title = (ann.title || ann.name || '').toUpperCase();
        doc.text(title, colX, currentY);
        currentY += 12;

        // Separator
        doc.setDrawColor(209, 213, 219);
        doc.line(colX, currentY - 4, colX + annColWidth - 10, currentY - 4);

        // Date
        if (ann.date_of_occurrence || ann.start_date) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(181, 55, 55);
          doc.text(ann.date_of_occurrence || ann.start_date, colX, currentY + 4);
          currentY += 14;
        }

        // Content
        const content = ann.content || ann.announcement_blurb || ann.description || '';
        if (content) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(55, 65, 81);
          const lines = doc.splitTextToSize(content, annColWidth - 10);
          doc.text(lines, colX, currentY);
          currentY += lines.length * 11;
        }

        // Instructions
        if (ann.instructions) {
          currentY += 4;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(107, 114, 128);
          doc.text('CUE: ', colX, currentY);
          doc.setFont('helvetica', 'normal');
          const instrLines = doc.splitTextToSize(ann.instructions, annColWidth - 30);
          doc.text(instrLines, colX + 25, currentY);
          currentY += instrLines.length * 10;
        }

        currentY += 15;

        if (useLeft) {
          leftY = currentY;
        } else {
          rightY = currentY;
        }
        useLeft = !useLeft;
      });

      // Footer
      doc.setFillColor(141, 198, 63);
      doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('¡Atrévete a cambiar!', pageWidth / 2, pageHeight - 7, { align: 'center' });
    }

    // Output PDF
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