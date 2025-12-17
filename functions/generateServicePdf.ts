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

function generateServiceHTML(serviceData, selectedDate, includeAnnouncements) {
  const { service, announcements, events } = serviceData;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: white;
      color: #1A1A1A;
      font-size: 10pt;
      line-height: 1.4;
    }
    
    .page {
      width: 100%;
      padding: 20px;
    }
    
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 3px solid;
      border-image: linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%) 1;
    }
    
    .logo {
      width: 60px;
      height: 60px;
    }
    
    .title-section h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28pt;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: #1A1A1A;
      margin-bottom: 4px;
    }
    
    .title-section p {
      font-size: 9pt;
      color: #1F8A70;
      font-weight: 600;
      letter-spacing: 0.1em;
    }
    
    .date-header {
      font-size: 14pt;
      font-weight: 700;
      color: #1A1A1A;
      margin-bottom: 16px;
      text-transform: uppercase;
    }
    
    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .service-column {
      border: 2px solid #D1D5DB;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .service-header {
      padding: 12px;
      font-weight: 700;
      font-size: 14pt;
      text-transform: uppercase;
      color: white;
    }
    
    .service-header.am {
      background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
    }
    
    .service-header.pm {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
    }
    
    .segment {
      padding: 10px;
      border-bottom: 1px solid #E5E7EB;
    }
    
    .segment:last-child {
      border-bottom: none;
    }
    
    .segment-title {
      font-weight: 700;
      font-size: 11pt;
      margin-bottom: 4px;
    }
    
    .segment-details {
      font-size: 9pt;
      color: #374151;
      margin-top: 2px;
    }
    
    .break-section {
      background: #F3F4F6;
      padding: 12px;
      text-align: center;
      font-weight: 700;
      color: #6B7280;
      margin: 16px 0;
      border-radius: 8px;
      border: 2px solid #D1D5DB;
    }
    
    .announcements-section {
      margin-top: 24px;
      page-break-before: always;
    }
    
    .announcements-header {
      background: linear-gradient(90deg, #1F8A70 0%, #4DC15F 50%, #D9DF32 100%);
      color: white;
      padding: 16px;
      font-size: 18pt;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 16px;
      border-radius: 8px;
    }
    
    .announcement-card {
      border: 2px solid #D1D5DB;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      background: white;
    }
    
    .announcement-title {
      font-weight: 700;
      font-size: 12pt;
      color: #1F8A70;
      margin-bottom: 6px;
    }
    
    .announcement-content {
      font-size: 10pt;
      color: #374151;
      line-height: 1.5;
    }
    
    .team-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed #D1D5DB;
      font-size: 8pt;
    }
    
    .team-item {
      display: flex;
      gap: 4px;
    }
    
    .team-label {
      font-weight: 700;
      color: #6B7280;
    }
    
    .team-value {
      color: #1A1A1A;
    }
    
    @page {
      size: letter;
      margin: 0.5in;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png" alt="Logo" class="logo" />
      <div class="title-section">
        <h1>PALABRAS DE VIDA</h1>
        <p>¡ATRÉVETE A CAMBIAR!</p>
      </div>
    </div>
    
    <div class="date-header">Orden de Servicio - ${selectedDate}</div>
    
    <!-- Service Columns -->
    <div class="two-column">
      <!-- 9:30 AM -->
      <div class="service-column">
        <div class="service-header am">9:30 a.m.</div>
        ${generateSegmentsHTML(service['9:30am'] || [], 'am')}
      </div>
      
      <!-- 11:30 AM -->
      <div class="service-column">
        <div class="service-header pm">11:30 a.m.</div>
        ${generateSegmentsHTML(service['11:30am'] || [], 'pm')}
      </div>
    </div>
    
    <!-- Team Info -->
    ${generateTeamInfoHTML(service)}
  </div>
  
  <!-- Announcements Page -->
  ${includeAnnouncements ? generateAnnouncementsHTML(announcements, events) : ''}
</body>
</html>
  `;
}

function generateSegmentsHTML(segments, timeSlot) {
  if (!segments || segments.length === 0) return '<div class="segment">No hay segmentos</div>';
  
  return segments.map(seg => {
    if (seg.type === 'break') {
      return ''; // Breaks handled separately
    }
    
    let html = `<div class="segment">
      <div class="segment-title">${seg.title || 'Sin título'}</div>`;
    
    if (seg.data?.leader) {
      html += `<div class="segment-details"><strong>Líder:</strong> ${seg.data.leader}</div>`;
    }
    
    if (seg.songs && seg.songs.length > 0) {
      const songList = seg.songs.filter(s => s.title).map((s, i) => 
        `${i + 1}. ${s.title}${s.lead ? ` (${s.lead})` : ''}`
      ).join('<br>');
      html += `<div class="segment-details"><strong>Canciones:</strong><br>${songList}</div>`;
    }
    
    if (seg.data?.preacher) {
      html += `<div class="segment-details"><strong>Predicador:</strong> ${seg.data.preacher}</div>`;
    }
    
    if (seg.data?.title) {
      html += `<div class="segment-details"><em>${seg.data.title}</em></div>`;
    }
    
    html += '</div>';
    return html;
  }).join('');
}

function generateTeamInfoHTML(service) {
  const teams = ['coordinators', 'ujieres', 'sound', 'luces'];
  const labels = {
    coordinators: 'Coordinadores',
    ujieres: 'Ujieres',
    sound: 'Sonido',
    luces: 'Luces/Proyección'
  };
  
  let html = '<div class="team-info">';
  
  teams.forEach(team => {
    const value = service[team];
    if (value && typeof value === 'object') {
      html += `<div class="team-item"><span class="team-label">${labels[team]}:</span><span class="team-value">${value['9:30am'] || '-'} / ${value['11:30am'] || '-'}</span></div>`;
    } else if (value) {
      html += `<div class="team-item"><span class="team-label">${labels[team]}:</span><span class="team-value">${value}</span></div>`;
    }
  });
  
  html += '</div>';
  return html;
}

function generateAnnouncementsHTML(announcements, events) {
  if (!announcements || announcements.length === 0) return '';
  
  let html = '<div class="announcements-section">';
  html += '<div class="announcements-header">ANUNCIOS</div>';
  
  announcements.forEach(ann => {
    html += `<div class="announcement-card">
      <div class="announcement-title">${ann.title || 'Sin título'}</div>
      <div class="announcement-content">${ann.content || ''}</div>
    </div>`;
  });
  
  if (events && events.length > 0) {
    events.forEach(evt => {
      html += `<div class="announcement-card">
        <div class="announcement-title">${evt.name}</div>
        <div class="announcement-content">${evt.announcement_blurb || evt.description || ''}</div>
      </div>`;
    });
  }
  
  html += '</div>';
  return html;
}