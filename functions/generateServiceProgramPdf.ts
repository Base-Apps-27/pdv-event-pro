import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serviceData, selectedDate, selectedAnnouncements, page1Scale = 100, page2Scale = 100 } = await req.json();

    console.log('PDF Generation Request:', {
      hasServiceData: !!serviceData,
      selectedDate,
      selectedAnnouncementsCount: selectedAnnouncements?.length || 0,
      page1Scale,
      page2Scale
    });

    if (!serviceData || !selectedDate) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch announcement objects if we have IDs
    let announcements = [];
    if (selectedAnnouncements && selectedAnnouncements.length > 0) {
      try {
        const allAnnouncements = await base44.asServiceRole.entities.AnnouncementItem.list();
        announcements = allAnnouncements.filter(a => selectedAnnouncements.includes(a.id));
        console.log('Fetched announcements:', announcements.length);
      } catch (error) {
        console.error('Error fetching announcements:', error);
      }
    }

    const apiKey = Deno.env.get('PDFSHIFT_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'PDFShift API key not configured' }, { status: 500 });
    }

    // Generate HTML for both pages
    const html = generateServiceProgramHtml(serviceData, selectedDate, announcements, page1Scale, page2Scale);
    
    console.log('Generated HTML length:', html.length);
    console.log('HTML preview:', html.substring(0, 500));

    // Call PDFShift API - encode API key as base64
    const auth = btoa(`api:${apiKey}`);
    
    console.log('Calling PDFShift API...');
    const pdfResponse = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        source: html,
        landscape: false,
        use_print: true,
        format: 'Letter'
      })
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('PDFShift API error:', pdfResponse.status, errorText);
      return Response.json({ 
        error: 'PDF generation failed', 
        status: pdfResponse.status,
        details: errorText 
      }, { status: 500 });
    }
    
    console.log('PDF generated successfully');

    const pdfBlob = await pdfResponse.arrayBuffer();

    return new Response(pdfBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Orden-de-Servicio-${selectedDate}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function generateServiceProgramHtml(serviceData, selectedDate, announcements, page1Scale, page2Scale) {
  const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png';
  
  // Build roles line
  const coord = serviceData.coordinators?.['9:30am'] || serviceData.coordinators?.['11:30am'] || '';
  const ujier = serviceData.ujieres?.['9:30am'] || serviceData.ujieres?.['11:30am'] || '';
  const sound = serviceData.sound?.['9:30am'] || serviceData.sound?.['11:30am'] || '';
  const luces = serviceData.luces?.['9:30am'] || serviceData.luces?.['11:30am'] || '';
  
  const roles = [];
  if (coord) roles.push(`Coordinador: ${coord}`);
  if (ujier) roles.push(`Ujier: ${ujier}`);
  if (sound) roles.push(`Sonido: ${sound}`);
  if (luces) roles.push(`Luces: ${luces}`);
  const rolesLine = roles.join(' • ');

  // Use fetched announcements directly
  const announcementsList = announcements || [];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: letter;
      margin: 0.5in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #1A1A1A;
    }
    
    .page {
      page-break-after: always;
      position: relative;
      min-height: 9in;
    }
    
    .logo {
      position: absolute;
      left: 0;
      top: 0;
      width: 72px;
      height: 72px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 16px;
    }
    
    .title {
      font-size: 24pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .date {
      font-size: 14pt;
      color: #1F8A70;
      margin-bottom: 6px;
    }
    
    .roles-line {
      font-size: 9.5pt;
      color: #666;
      margin-top: 6px;
    }
    
    .columns {
      display: flex;
      gap: 16px;
      margin-top: 16px;
    }
    
    .column {
      flex: 1;
      border: 1px solid #D1D5DB;
      border-radius: 4px;
      padding: 8px;
    }
    
    .column-header {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #1F8A70;
    }
    
    .segment {
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 0.5px solid #E5E7EB;
    }
    
    .segment:last-child {
      border-bottom: none;
    }
    
    .segment-title {
      font-size: 10pt;
      font-weight: bold;
    }
    
    .segment-time {
      font-size: 8pt;
      color: #6B7280;
      margin-top: 2px;
    }
    
    .segment-details {
      font-size: 8pt;
      color: #374151;
      margin-top: 2px;
    }
    
    .footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 7pt;
      color: #9CA3AF;
    }
    
    /* Page 2 styles */
    .announcements-columns {
      display: flex;
      gap: 16px;
      margin-top: 16px;
    }
    
    .announcements-column {
      flex: 1;
    }
    
    .announcement-item {
      margin-bottom: 12px;
      padding: 8px;
      border: 1px solid #E5E7EB;
      border-radius: 4px;
      background: #F9FAFB;
      page-break-inside: avoid;
    }
    
    .announcement-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    
    .announcement-icon {
      width: 16px;
      height: 16px;
      background: #1F8A70;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .announcement-title {
      font-size: 10pt;
      font-weight: bold;
      color: #1A1A1A;
    }
    
    .announcement-content {
      font-size: 9pt;
      color: #374151;
      line-height: 1.3;
      margin-top: 4px;
    }
    
    .announcement-cue {
      font-size: 8pt;
      color: #6B7280;
      font-style: italic;
      margin-top: 4px;
      padding-left: 8px;
      border-left: 2px solid #D1D5DB;
    }
    
    .announcement-date {
      font-size: 8pt;
      color: #1F8A70;
      font-weight: 600;
      margin-top: 4px;
    }
    
    .event-item {
      margin-bottom: 10px;
      padding: 6px;
      border-left: 3px solid #4DC15F;
      background: #F0F9FF;
      page-break-inside: avoid;
    }
    
    .event-title {
      font-size: 10pt;
      font-weight: bold;
      color: #1A1A1A;
    }
    
    .event-date {
      font-size: 9pt;
      color: #1F8A70;
      font-weight: 600;
      margin-top: 2px;
    }
    
    .event-description {
      font-size: 8.5pt;
      color: #374151;
      margin-top: 3px;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <!-- Page 1: Service Program -->
  <div class="page page1">
    <img src="${logoUrl}" class="logo" />
    
    <div class="header">
      <div class="title">ORDEN DE SERVICIO</div>
      <div class="date">Domingo ${selectedDate}</div>
      ${rolesLine ? `<div class="roles-line">${rolesLine}</div>` : ''}
    </div>
    
    <div class="columns">
      ${renderServiceColumn('9:30 AM', serviceData['9:30am'])}
      ${renderServiceColumn('11:30 AM', serviceData['11:30am'])}
    </div>
    
    <div class="footer">Palabras de Vida • ¡Atrévete a Cambiar!</div>
  </div>
  
  <!-- Page 2: Announcements -->
  <div class="page page2">
    <img src="${logoUrl}" class="logo" />
    
    <div class="header">
      <div class="title">ANUNCIOS</div>
      <div class="date">Domingo ${selectedDate}</div>
    </div>
    
    ${announcementsList.length > 0 ? `
      <div class="announcements-columns">
        <div class="announcements-column">
          ${announcementsList.slice(0, Math.ceil(announcementsList.length / 2)).map(renderAnnouncement).join('')}
        </div>
        <div class="announcements-column">
          ${announcementsList.slice(Math.ceil(announcementsList.length / 2)).map(renderAnnouncement).join('')}
        </div>
      </div>
    ` : `
      <div style="padding: 20px; text-align: center; color: #6B7280;">
        No hay anuncios seleccionados / No announcements selected
      </div>
    `}
    
    <div class="footer">Palabras de Vida • ¡Atrévete a Cambiar!</div>
  </div>
</body>
</html>
  `;
}

function renderServiceColumn(timeSlot, segments) {
  if (!segments || segments.length === 0) {
    return `
      <div class="column">
        <div class="column-header">${timeSlot}</div>
        <div class="segment-details">No hay segmentos</div>
      </div>
    `;
  }
  
  const segmentsHtml = segments
    .filter(s => s.type !== 'break')
    .map(segment => `
      <div class="segment">
        <div class="segment-title">${escapeHtml(segment.title)}</div>
        ${segment.duration ? `<div class="segment-time">${segment.duration} min</div>` : ''}
        ${segment.data?.leader ? `<div class="segment-details">Dirige: ${escapeHtml(segment.data.leader)}</div>` : ''}
        ${segment.data?.presenter ? `<div class="segment-details">${escapeHtml(segment.data.presenter)}</div>` : ''}
        ${segment.data?.preacher ? `<div class="segment-details">${escapeHtml(segment.data.preacher)}</div>` : ''}
        ${segment.data?.title ? `<div class="segment-details">${escapeHtml(segment.data.title)}</div>` : ''}
      </div>
    `).join('');
  
  return `
    <div class="column">
      <div class="column-header">${timeSlot}</div>
      ${segmentsHtml}
    </div>
  `;
}

function renderAnnouncement(ann) {
  const content = sanitizeText(ann.content || '');
  const cue = ann.instructions ? sanitizeText(stripCuePrefix(ann.instructions)) : '';
  
  return `
    <div class="announcement-item">
      <div class="announcement-header">
        <div class="announcement-icon"></div>
        <div class="announcement-title">${escapeHtml(ann.title)}</div>
      </div>
      ${content ? `<div class="announcement-content">${escapeHtml(content)}</div>` : ''}
      ${cue ? `<div class="announcement-cue">CUE: ${escapeHtml(cue)}</div>` : ''}
      ${ann.date_of_occurrence ? `<div class="announcement-date">${ann.date_of_occurrence}</div>` : ''}
    </div>
  `;
}

function renderEvent(event) {
  const description = sanitizeText(event.announcement_blurb || event.description || '');
  
  return `
    <div class="event-item">
      <div class="event-title">${escapeHtml(event.name)}</div>
      ${event.start_date ? `<div class="event-date">${event.start_date}</div>` : ''}
      ${description ? `<div class="event-description">${escapeHtml(description)}</div>` : ''}
    </div>
  `;
}

function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCuePrefix(text) {
  if (!text) return '';
  return text.replace(/^CUE:\s*/i, '');
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}