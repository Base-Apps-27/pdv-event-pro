import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serviceData, selectedDate, includeAnnouncements } = await req.json();

    // Generate HTML content for PDF
    const htmlContent = generateServiceHTML(serviceData, selectedDate, includeAnnouncements);

    // Use external PDF service (PDFShift or similar)
    const pdfApiResponse = await fetch('https://api.html2pdf.app/v1/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: htmlContent,
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        }
      })
    });

    if (!pdfApiResponse.ok) {
      throw new Error(`PDF service error: ${pdfApiResponse.status}`);
    }

    const pdfBuffer = await pdfApiResponse.arrayBuffer();

    // Return PDF as binary response
    return new Response(pdfBuffer, {
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