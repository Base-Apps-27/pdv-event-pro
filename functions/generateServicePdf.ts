import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serviceData, selectedDate, includeAnnouncements } = await req.json();
    const { service, announcements } = serviceData;

    // Create PDF with jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('PALABRAS DE VIDA', pageWidth / 2, y, { align: 'center' });
    y += 20;
    
    doc.setFontSize(10);
    doc.setTextColor(31, 138, 112);
    doc.text('¡ATRÉVETE A CAMBIAR!', pageWidth / 2, y, { align: 'center' });
    y += 30;

    // Date
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`Orden de Servicio - ${selectedDate}`, pageWidth / 2, y, { align: 'center' });
    y += 30;

    // Two columns
    const colWidth = (pageWidth - margin * 3) / 2;
    const col1X = margin;
    const col2X = margin * 2 + colWidth;

    // 9:30 AM Column Header
    doc.setFillColor(239, 68, 68);
    doc.rect(col1X, y, colWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('9:30 a.m.', col1X + colWidth / 2, y + 17, { align: 'center' });

    // 11:30 AM Column Header
    doc.setFillColor(59, 130, 246);
    doc.rect(col2X, y, colWidth, 25, 'F');
    doc.text('11:30 a.m.', col2X + colWidth / 2, y + 17, { align: 'center' });
    y += 35;

    doc.setTextColor(0, 0, 0);

    // Render segments for both columns
    let y1 = y;
    let y2 = y;

    const renderSegments = (segments, startX, startY, maxWidth) => {
      let currentY = startY;
      doc.setFont('helvetica', 'normal');
      
      (segments || []).forEach(seg => {
        if (seg.type === 'break') return;
        
        // Title
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(seg.title || 'Sin título', startX, currentY);
        currentY += 14;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        if (seg.data?.leader) {
          doc.text(`Líder: ${seg.data.leader}`, startX, currentY);
          currentY += 12;
        }

        if (seg.data?.preacher) {
          doc.text(`Predicador: ${seg.data.preacher}`, startX, currentY);
          currentY += 12;
        }

        if (seg.data?.presenter) {
          doc.text(`Presentador: ${seg.data.presenter}`, startX, currentY);
          currentY += 12;
        }

        if (seg.songs) {
          seg.songs.filter(s => s.title).forEach((s, i) => {
            const songText = `${i + 1}. ${s.title}${s.lead ? ` (${s.lead})` : ''}`;
            doc.text(songText, startX + 5, currentY);
            currentY += 11;
          });
        }

        currentY += 8;
      });

      return currentY;
    };

    y1 = renderSegments(service['9:30am'], col1X, y1, colWidth);
    y2 = renderSegments(service['11:30am'], col2X, y2, colWidth);

    // Team info
    y = Math.max(y1, y2) + 20;
    
    if (y > pageHeight - 100) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const teams = [
      { label: 'Coordinador', value: service.coordinators?.['9:30am'] || '-' },
      { label: 'Ujieres', value: service.ujieres?.['9:30am'] || '-' },
      { label: 'Sonido', value: service.sound?.['9:30am'] || '-' },
      { label: 'Luces', value: service.luces?.['9:30am'] || '-' }
    ];

    teams.forEach((team, i) => {
      doc.text(`${team.label}: `, col1X + (i % 2) * colWidth, y + Math.floor(i / 2) * 14);
      doc.setFont('helvetica', 'normal');
      doc.text(team.value, col1X + (i % 2) * colWidth + 70, y + Math.floor(i / 2) * 14);
      doc.setFont('helvetica', 'bold');
    });

    // Announcements page
    if (includeAnnouncements && announcements && announcements.length > 0) {
      doc.addPage();
      y = margin;

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 138, 112);
      doc.text('ANUNCIOS', pageWidth / 2, y, { align: 'center' });
      y += 30;

      doc.setTextColor(0, 0, 0);

      announcements.forEach(ann => {
        if (y > pageHeight - 80) {
          doc.addPage();
          y = margin;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(ann.title || ann.name || 'Sin título', margin, y);
        y += 16;

        const content = ann.content || ann.announcement_blurb || ann.description || '';
        if (content) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          const lines = doc.splitTextToSize(content, pageWidth - margin * 2);
          doc.text(lines, margin, y);
          y += lines.length * 12 + 15;
        }
      });
    }

    // Output PDF
    const pdfOutput = doc.output('arraybuffer');

    return new Response(pdfOutput, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="service-order-${selectedDate}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper functions removed - now using jsPDF directly