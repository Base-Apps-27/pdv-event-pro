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
    
    console.log('=== HTML GENERATION DEBUG ===');
    console.log('HTML length:', html.length);
    console.log('9:30am segments:', serviceData['9:30am']?.length || 0);
    console.log('11:30am segments:', serviceData['11:30am']?.length || 0);
    console.log('Announcements:', announcements.length);
    console.log('HTML preview (first 800 chars):', html.substring(0, 800));
    console.log('HTML preview (last 500 chars):', html.substring(html.length - 500));

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
    
    // Binary validation
    console.log('=== PDF BINARY VALIDATION ===');
    console.log('PDF byte length:', pdfBlob.byteLength);
    
    const uint8 = new Uint8Array(pdfBlob);
    const first8 = Array.from(uint8.slice(0, 8))
      .map(b => String.fromCharCode(b))
      .join('');
    console.log('First 8 bytes:', first8);
    console.log('Is valid PDF (starts with %PDF-):', first8.startsWith('%PDF-'));
    
    if (!first8.startsWith('%PDF-')) {
      console.error('INVALID PDF: Does not start with %PDF-');
      const textSample = new TextDecoder().decode(uint8.slice(0, 500));
      console.error('Response content (first 500 chars):', textSample);
      return Response.json({ 
        error: 'Invalid PDF returned', 
        details: textSample 
      }, { status: 500 });
    }
    
    if (pdfBlob.byteLength < 10000) {
      console.warn('WARNING: PDF is suspiciously small (<10KB)');
    }

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
  // Inline logo as data URI (base64) - eliminates external dependency
  const logoDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  // Note: Replace above with actual logo base64 if needed, or use external URL with timeout handling
  const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691b19c064436ea35f171ca3/e75f54157_image.png';
  
  // Validate serviceData
  if (!serviceData) {
    console.error('ERROR: serviceData is null/undefined');
    serviceData = { '9:30am': [], '11:30am': [] };
  }
  
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

  // Validate announcements
  const announcementsList = Array.isArray(announcements) ? announcements : [];

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orden de Servicio - ${selectedDate}</title>
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
      background: #fff;
    }
    
    /* Ensure content is visible */
    .page {
      background: #fff;
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
        <div class="segment-details" style="padding: 12px; color: #666;">No hay segmentos / No segments</div>
      </div>
    `;
  }
  
  // Filter and validate segments
  const validSegments = segments.filter(s => s && s.type !== 'break');
  
  if (validSegments.length === 0) {
    return `
      <div class="column">
        <div class="column-header">${timeSlot}</div>
        <div class="segment-details" style="padding: 12px; color: #666;">No hay segmentos visibles</div>
      </div>
    `;
  }
  
  const segmentsHtml = validSegments.map(segment => {
    const title = segment.title || 'Sin título';
    const duration = segment.duration || '';
    const data = segment.data || {};
    
    return `
      <div class="segment">
        <div class="segment-title">${escapeHtml(title)}</div>
        ${duration ? `<div class="segment-time">${escapeHtml(String(duration))} min</div>` : ''}
        ${data.leader ? `<div class="segment-details">Dirige: ${escapeHtml(data.leader)}</div>` : ''}
        ${data.presenter ? `<div class="segment-details">${escapeHtml(data.presenter)}</div>` : ''}
        ${data.preacher ? `<div class="segment-details">${escapeHtml(data.preacher)}</div>` : ''}
        ${data.title ? `<div class="segment-details">${escapeHtml(data.title)}</div>` : ''}
      </div>
    `;
  }).join('');
  
  return `
    <div class="column">
      <div class="column-header">${timeSlot}</div>
      ${segmentsHtml}
    </div>
  `;
}

function renderAnnouncement(ann) {
  if (!ann) return '';
  
  const title = ann.title || ann.announcement_title || 'Sin título';
  const content = sanitizeText(ann.content || ann.announcement_description || '');
  const cue = ann.instructions ? sanitizeText(stripCuePrefix(ann.instructions)) : '';
  const date = ann.date_of_occurrence || '';
  
  return `
    <div class="announcement-item">
      <div class="announcement-header">
        <div class="announcement-icon"></div>
        <div class="announcement-title">${escapeHtml(title)}</div>
      </div>
      ${content ? `<div class="announcement-content">${escapeHtml(content)}</div>` : ''}
      ${cue ? `<div class="announcement-cue">CUE: ${escapeHtml(cue)}</div>` : ''}
      ${date ? `<div class="announcement-date">${escapeHtml(date)}</div>` : ''}
    </div>
  `;
}

function renderEvent(event) {
  if (!event) return '';
  
  const name = event.name || 'Evento sin nombre';
  const description = sanitizeText(event.announcement_blurb || event.description || '');
  const date = event.start_date || '';
  
  return `
    <div class="event-item">
      <div class="event-title">${escapeHtml(name)}</div>
      ${date ? `<div class="event-date">${escapeHtml(date)}</div>` : ''}
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