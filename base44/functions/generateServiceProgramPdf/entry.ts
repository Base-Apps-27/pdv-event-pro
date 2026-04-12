// 2026-04-12: SDK bumped from 0.8.4 → 0.8.25 for consistency across all backend functions.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      serviceData, 
      selectedDate, 
      selectedAnnouncements, 
      page1Scale = 100, 
      page2Scale = 100,
      debug = false,
      processorVersion = '116'
    } = await req.json();

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

    const apiKey = Deno.env.get('PDFSHIFT_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'PDFShift API key not configured' }, { status: 500 });
    }

    console.log('=== PDF GENERATION START ===');
    console.log('Debug mode:', debug);
    console.log('Processor version:', processorVersion);

    // MANDATORY: Hello World test runs FIRST (even in production)
    console.log('\n=== HELLO WORLD TEST (MANDATORY) ===');
    const helloHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Hello PDFShift</title>
  <style>
    @page { size: Letter; margin: 0.5in; }
    body { font-family: Arial, sans-serif; background: #fff; color: #000; }
  </style>
</head>
<body>
  <h1>Hello World</h1>
  <p>If you can see this, PDFShift is rendering correctly.</p>
</body>
</html>`;

    const helloResponse = await callPDFShift(apiKey, processorVersion, helloHtml, true);
    
    if (!helloResponse.ok) {
      const errorText = await helloResponse.text();
      console.error('HELLO WORLD TEST FAILED:', helloResponse.status, errorText);
      return Response.json({ 
        error: 'PDFShift Hello World test failed - API is not operational',
        status: helloResponse.status,
        details: errorText
      }, { status: 500 });
    }

    const helloBlob = await helloResponse.arrayBuffer();
    const helloBytes = new Uint8Array(helloBlob);
    const helloPdfHeader = Array.from(helloBytes.slice(0, 8))
      .map(b => String.fromCharCode(b))
      .join('');
    
    if (!helloPdfHeader.startsWith('%PDF-') || helloBlob.byteLength < 10000) {
      console.error('HELLO WORLD TEST FAILED: Invalid or suspiciously small PDF');
      console.error('Byte length:', helloBlob.byteLength);
      console.error('Header:', helloPdfHeader);
      return Response.json({ 
        error: 'Hello World test produced invalid PDF',
        byteLength: helloBlob.byteLength,
        header: helloPdfHeader
      }, { status: 500 });
    }

    logPDFShiftHeaders(helloResponse);
    console.log('✓ HELLO WORLD TEST PASSED - PDFShift operational');

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

    // DEBUG MODE: Template Ladder
    if (debug) {
      console.log('=== DEBUG MODE: TEMPLATE LADDER ===');
      const results = await runTemplateLadder(apiKey, processorVersion, serviceData, selectedDate, announcements);
      return Response.json(results, { status: 200 });
    }

    // PRODUCTION MODE: Generate full template
    const html = generateServiceProgramHtml(serviceData, selectedDate, announcements, page1Scale, page2Scale);

    console.log('=== HTML GENERATION ===');
    console.log('HTML length:', html.length);
    console.log('9:30am segments:', serviceData['9:30am']?.length || 0);
    console.log('11:30am segments:', serviceData['11:30am']?.length || 0);
    console.log('Announcements:', announcements.length);

    // Call PDFShift API with hardened options
    console.log('Calling PDFShift API (production)...');
    const pdfResponse = await callPDFShift(apiKey, processorVersion, html, false);

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('=== PDFSHIFT API ERROR ===');
      console.error('Status:', pdfResponse.status);
      console.error('Error body:', errorText);
      
      return Response.json({ 
        error: 'PDF generation failed', 
        status: pdfResponse.status,
        details: errorText
      }, { status: 500 });
    }

    // Log response headers
    logPDFShiftHeaders(pdfResponse);

    const pdfBlob = await pdfResponse.arrayBuffer();
    
    console.log('=== PDF VALIDATION ===');
    console.log('PDF byte length:', pdfBlob.byteLength);
    
    const uint8 = new Uint8Array(pdfBlob);
    const first8 = Array.from(uint8.slice(0, 8))
      .map(b => String.fromCharCode(b))
      .join('');
    console.log('Starts with %PDF-:', first8.startsWith('%PDF-'));
    
    if (!first8.startsWith('%PDF-')) {
      console.error('INVALID PDF');
      return Response.json({ error: 'Invalid PDF returned' }, { status: 500 });
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

// Helper: Call PDFShift API with standardized options
async function callPDFShift(apiKey, processorVersion, html, isSandbox = true) {
  return await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-Processor-Version': processorVersion
    },
    body: JSON.stringify({
      source: html,
      format: 'Letter',
      use_print: true,
      delay: 250,
      disable_javascript: true,
      wait_for_network: false,
      sandbox: isSandbox,
      log_request: true
    })
  });
}

// Helper: Call PDFShift PNG endpoint
async function callPDFShiftPNG(apiKey, processorVersion, html, isSandbox = true) {
  return await fetch('https://api.pdfshift.io/v3/convert/png', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-Processor-Version': processorVersion
    },
    body: JSON.stringify({
      source: html,
      format: 'Letter',
      use_print: true,
      delay: 250,
      disable_javascript: true,
      wait_for_network: false,
      sandbox: isSandbox
    })
  });
}

// Helper: Log PDFShift response headers
function logPDFShiftHeaders(response) {
  console.log('=== PDFSHIFT RESPONSE HEADERS ===');
  console.log('X-PDFShift-Processor:', response.headers.get('X-PDFShift-Processor'));
  console.log('X-PDFShift-Duration:', response.headers.get('X-PDFShift-Duration'));
  console.log('X-Response-Duration:', response.headers.get('X-Response-Duration'));
  console.log('X-Credits-Used:', response.headers.get('X-Credits-Used'));
  console.log('X-Credits-Cost:', response.headers.get('X-Credits-Cost'));
  console.log('X-Request-Id:', response.headers.get('X-Request-Id'));
}

// DEBUG: Template Ladder
async function runTemplateLadder(apiKey, processorVersion, serviceData, selectedDate, announcements) {
  const results = { ladder: [], pngs: {} };

  // T0: Minimal HTML
  console.log('\n=== T0: MINIMAL HTML ===');
  const t0Html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>T0</title></head>
<body style="font-family:Arial;padding:1in;"><h1 style="color:#000;">T0 VISIBLE</h1><p style="color:#000;">Minimal test passed.</p></body></html>`;
  
  const t0Pdf = await callPDFShift(apiKey, processorVersion, t0Html, true);
  const t0Png = await callPDFShiftPNG(apiKey, processorVersion, t0Html, true);
  
  logPDFShiftHeaders(t0Pdf);
  
  // Capture PNG as base64 for inspection
  if (t0Png.ok) {
    const t0PngBlob = await t0Png.arrayBuffer();
    const t0PngBase64 = btoa(String.fromCharCode(...new Uint8Array(t0PngBlob)));
    results.pngs['T0'] = `data:image/png;base64,${t0PngBase64}`;
  }
  
  results.ladder.push({
    stage: 'T0',
    pdfOk: t0Pdf.ok,
    pdfStatus: t0Pdf.status,
    pngOk: t0Png.ok,
    pngStatus: t0Png.status,
    htmlLength: t0Html.length
  });

  // T1: Full CSS but simple content WITH SENTINEL
  console.log('\n=== T1: FULL CSS, SIMPLE CONTENT ===');
  const t1Html = generateT1Html();
  
  const t1Pdf = await callPDFShift(apiKey, processorVersion, t1Html, true);
  const t1Png = await callPDFShiftPNG(apiKey, processorVersion, t1Html, true);
  
  logPDFShiftHeaders(t1Pdf);
  
  // Capture PNG as base64
  if (t1Png.ok) {
    const t1PngBlob = await t1Png.arrayBuffer();
    const t1PngBase64 = btoa(String.fromCharCode(...new Uint8Array(t1PngBlob)));
    results.pngs['T1'] = `data:image/png;base64,${t1PngBase64}`;
  }
  
  results.ladder.push({
    stage: 'T1',
    pdfOk: t1Pdf.ok,
    pdfStatus: t1Pdf.status,
    pngOk: t1Png.ok,
    pngStatus: t1Png.status,
    htmlLength: t1Html.length
  });

  // T2: Full layout with static dummy data
  console.log('\n=== T2: FULL LAYOUT, STATIC DATA ===');
  const t2Html = generateT2Html(selectedDate);
  
  const t2Pdf = await callPDFShift(apiKey, processorVersion, t2Html, true);
  const t2Png = await callPDFShiftPNG(apiKey, processorVersion, t2Html, true);
  
  logPDFShiftHeaders(t2Pdf);
  
  // Capture PNG as base64
  if (t2Png.ok) {
    const t2PngBlob = await t2Png.arrayBuffer();
    const t2PngBase64 = btoa(String.fromCharCode(...new Uint8Array(t2PngBlob)));
    results.pngs['T2'] = `data:image/png;base64,${t2PngBase64}`;
  }
  
  results.ladder.push({
    stage: 'T2',
    pdfOk: t2Pdf.ok,
    pdfStatus: t2Pdf.status,
    pngOk: t2Png.ok,
    pngStatus: t2Png.status,
    htmlLength: t2Html.length
  });

  // T3: Full template with real data (T4 in your numbering)
  console.log('\n=== T3: FULL TEMPLATE, REAL DATA ===');
  const t3Html = generateServiceProgramHtml(serviceData, selectedDate, announcements, 100, 100);
  
  const t3Pdf = await callPDFShift(apiKey, processorVersion, t3Html, true);
  const t3Png = await callPDFShiftPNG(apiKey, processorVersion, t3Html, true);
  
  logPDFShiftHeaders(t3Pdf);
  
  // Capture PNG as base64
  if (t3Png.ok) {
    const t3PngBlob = await t3Png.arrayBuffer();
    const t3PngBase64 = btoa(String.fromCharCode(...new Uint8Array(t3PngBlob)));
    results.pngs['T3'] = `data:image/png;base64,${t3PngBase64}`;
  }
  
  results.ladder.push({
    stage: 'T3',
    pdfOk: t3Pdf.ok,
    pdfStatus: t3Pdf.status,
    pngOk: t3Png.ok,
    pngStatus: t3Png.status,
    htmlLength: t3Html.length
  });

  console.log('\n=== LADDER RESULTS ===');
  results.ladder.forEach(r => {
    console.log(`${r.stage}: PDF=${r.pdfStatus} PNG=${r.pngStatus} HTML=${r.htmlLength}bytes`);
  });
  
  console.log('\n=== DIAGNOSTIC ===');
  const firstBlank = results.ladder.find(r => !r.pngOk || r.pngStatus !== 200);
  if (firstBlank) {
    console.log(`⚠️  FIRST FAILURE AT ${firstBlank.stage}`);
  } else {
    console.log('✓ All stages generated PNG/PDF successfully');
    console.log('⚠️  If PDFs are blank but PNGs have content: print-specific CSS issue');
    console.log('⚠️  If both PNG and PDF are blank at same stage: layout/CSS rendering issue');
  }

  return results;
}

// T1: Full CSS but simple visible content WITH SENTINEL
function generateT1Html() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>T1 Test</title>
  <style>
    @page {
      size: letter portrait;
      margin: 0.5in;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 12pt;
      color: #000000;
      background: #ffffff;
      position: relative;
    }
    .sentinel {
      position: fixed;
      top: 0;
      left: 0;
      font-size: 18px;
      color: #000;
      background: #FFFF00;
      padding: 4px 8px;
      z-index: 9999;
    }
  </style>
</head>
<body>
  <div style="position: fixed; top: 10px; left: 10px; z-index: 999999; font-size: 24px; color: black; background: white;">VISIBLE SENTINEL</div>
  <div class="sentinel">SENTINEL OK</div>
  <div style="break-after: page;">
    <div style="margin-top: 40px; font-size: 48px; font-weight: 700; color: #000000; text-align: center;">T1 VISIBLE</div>
    <h1 style="font-size: 24pt; color: #000000; text-align: center; margin-top: 40px;">PAGE 1</h1>
    <p style="font-size: 14pt; color: #000000; text-align: center; margin-top: 20px;">This is page 1 with simple black text. No columns, no floats.</p>
  </div>
  <div>
    <h1 style="font-size: 24pt; color: #000000; text-align: center; margin: 1in 0;">T1 VISIBLE - PAGE 2</h1>
    <p style="font-size: 14pt; color: #000000; text-align: center;">This is page 2 with simple black text. No columns, no floats.</p>
  </div>
</body>
</html>`;
}

// T2: Full layout with static dummy segments
function generateT2Html(selectedDate) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>T2 Test</title>
  <style>
    @page { size: letter portrait; margin: 0.5in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #000000; background: #ffffff; }
    .page { break-after: page; }
    .page:last-child { break-after: auto; }
    .header { text-align: center; margin-bottom: 20px; }
    .title { font-size: 20pt; font-weight: 700; color: #000000; }
    .date { font-size: 13pt; color: #000000; }
    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3in; }
    .column { min-width: 0; }
    .column-header { font-size: 12pt; font-weight: 700; color: #000000; margin-bottom: 10px; border-bottom: 1px solid #CCCCCC; }
    .segment { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 0.5px solid #EEEEEE; }
    .segment-title { font-size: 10.5pt; font-weight: 600; color: #000000; }
    .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #CCCCCC; text-align: center; font-size: 9pt; color: #666666; }
  </style>
</head>
<body>
  <div style="position: fixed; top: 10px; left: 10px; z-index: 999999; font-size: 24px; color: black; background: white;">VISIBLE SENTINEL</div>
  <div class="page">
    <div class="header">
      <div class="title">ORDEN DE SERVICIO</div>
      <div class="date">Domingo ${escapeHtml(selectedDate)}</div>
    </div>
    <div class="columns">
      <div class="column">
        <div class="column-header">9:30 A.M.</div>
        <div class="segment"><div class="segment-title">Segment 1 Dummy</div></div>
        <div class="segment"><div class="segment-title">Segment 2 Dummy</div></div>
      </div>
      <div class="column">
        <div class="column-header">11:30 A.M.</div>
        <div class="segment"><div class="segment-title">Segment 1 Dummy</div></div>
        <div class="segment"><div class="segment-title">Segment 2 Dummy</div></div>
      </div>
    </div>
    <div class="footer">Test Footer</div>
  </div>
  <div class="page">
    <div class="header">
      <div class="title">ANUNCIOS</div>
      <div class="date">Domingo ${escapeHtml(selectedDate)}</div>
    </div>
    <div class="columns">
      <div class="column">
        <div class="segment"><div class="segment-title">Announcement 1 Dummy</div></div>
      </div>
      <div class="column">
        <div class="segment"><div class="segment-title">Announcement 2 Dummy</div></div>
      </div>
    </div>
    <div class="footer">Test Footer</div>
  </div>
</body>
</html>`;
}

function generateServiceProgramHtml(serviceData, selectedDate, announcements, page1Scale, page2Scale) {
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
  if (coord) roles.push(`Coordinador: ${escapeHtml(coord)}`);
  if (ujier) roles.push(`Ujier: ${escapeHtml(ujier)}`);
  if (sound) roles.push(`Sonido: ${escapeHtml(sound)}`);
  if (luces) roles.push(`Luces: ${escapeHtml(luces)}`);
  const rolesLine = roles.join(' • ');

  // Validate announcements
  const announcementsList = Array.isArray(announcements) ? announcements : [];
  
  // Split announcements into two columns
  const midpoint = Math.ceil(announcementsList.length / 2);
  const leftAnnouncements = announcementsList.slice(0, midpoint);
  const rightAnnouncements = announcementsList.slice(midpoint);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Orden de Servicio - ${selectedDate}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 0.5in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.3;
      color: #333333;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .page {
      background: #ffffff;
      position: relative;
      break-after: page;
    }
    
    .page:last-child {
      break-after: auto;
    }
    
    .logo {
      display: none; /* Temporarily disabled for debugging */
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-top: 4px;
    }
    
    .title {
      font-size: 20pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1A1A1A;
      margin-bottom: 6px;
    }
    
    .date {
      font-size: 13pt;
      color: #333333;
      margin-bottom: 4px;
      font-weight: 600;
    }
    
    .roles-line {
      font-size: 9.5pt;
      color: #666666;
      margin-top: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90%;
      margin-left: auto;
      margin-right: auto;
    }
    
    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.3in;
    }
    
    .column {
      min-width: 0;
    }
    
    .column-header {
      font-size: 12pt;
      font-weight: 700;
      color: #1A1A1A;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #E6E6E6;
    }
    
    .time-accent {
      color: #C0392B;
      font-weight: 600;
    }
    
    .segment {
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 0.5px solid #F0F0F0;
    }
    
    .segment:last-child {
      border-bottom: none;
    }
    
    .segment-time {
      font-size: 10pt;
      color: #C0392B;
      font-weight: 600;
      margin-bottom: 3px;
    }
    
    .segment-title {
      font-size: 10.5pt;
      font-weight: 600;
      color: #1A1A1A;
      margin-bottom: 3px;
    }
    
    .segment-detail {
      font-size: 10pt;
      color: #333333;
      margin-top: 2px;
      line-height: 1.3;
    }
    
    .segment-name {
      color: #1FBA70;
      font-weight: 600;
    }
    
    .segment-note {
      font-size: 9.5pt;
      color: #666666;
      font-style: italic;
      margin-top: 2px;
    }
    
    .receso-block {
      margin: 16px 0;
      padding: 10px 0;
      border-top: 1px solid #E6E6E6;
      border-bottom: 1px solid #E6E6E6;
      text-align: center;
    }
    
    .receso-title {
      font-size: 11pt;
      font-weight: 600;
      color: #1A1A1A;
      margin-bottom: 4px;
    }
    
    .receso-note {
      font-size: 9.5pt;
      color: #666666;
      font-style: italic;
    }
    
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #E6E6E6;
      text-align: center;
      font-size: 9pt;
      color: #666666;
    }
    
    .footer-accent {
      color: #1FBA70;
      font-weight: 600;
    }
    
    /* Page 2 - Announcements */
    .announcements-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.3in;
    }
    
    .announcements-column {
      min-width: 0;
    }
    
    .announcement-item {
      margin-bottom: 14px;
    }
    
    .announcement-marker {
      width: 3px;
      height: 12px;
      background: #1FBA70;
      display: inline-block;
      margin-right: 6px;
      vertical-align: middle;
    }
    
    .announcement-title {
      font-size: 10.5pt;
      font-weight: 600;
      color: #1A1A1A;
      margin-bottom: 4px;
    }
    
    .announcement-content {
      font-size: 10pt;
      color: #333333;
      line-height: 1.3;
      margin-top: 4px;
    }
    
    .announcement-cue {
      font-size: 9.5pt;
      color: #666666;
      font-style: italic;
      margin-top: 6px;
      padding-left: 10px;
      border-left: 2px solid #E6E6E6;
    }
    
    .cue-label {
      font-weight: 600;
      font-style: normal;
      text-transform: uppercase;
      font-size: 8.5pt;
      letter-spacing: 0.5px;
    }
    
    .announcement-date {
      font-size: 9pt;
      color: #666666;
      margin-top: 4px;
    }
    
    .announcement-divider {
      height: 1px;
      background: #F0F0F0;
      margin: 12px 0;
    }
  </style>
</head>
<body>
  <div style="position: fixed; top: 10px; left: 10px; z-index: 999999; font-size: 24px; color: black; background: white;">VISIBLE SENTINEL</div>
  <!-- Page 1: Service Program -->
  <div class="page">
    <div class="header">
      <div class="title">ORDEN DE SERVICIO</div>
      <div class="date">Domingo ${escapeHtml(selectedDate)}</div>
      ${rolesLine ? `<div class="roles-line">${rolesLine}</div>` : ''}
    </div>
    
    <div class="columns">
      ${renderServiceColumn('9:30 A.M.', serviceData['9:30am'])}
      ${renderServiceColumn('11:30 A.M.', serviceData['11:30am'])}
    </div>
    
    ${serviceData.receso_notes?.['9:30am'] ? `
      <div class="receso-block">
        <div class="receso-title">Receso</div>
        <div class="receso-note">${escapeHtml(serviceData.receso_notes['9:30am'])}</div>
      </div>
    ` : ''}
    
    <div class="footer">
      Palabras de Vida • <span class="footer-accent">¡Atrévete a cambiar!</span>
    </div>
  </div>
  
  <!-- Page 2: Announcements -->
  <div class="page">
    <div class="header">
      <div class="title">ANUNCIOS</div>
      <div class="date">Domingo ${escapeHtml(selectedDate)}</div>
    </div>
    
    ${announcementsList.length > 0 ? `
      <div class="announcements-grid">
        <div class="announcements-column">
          ${leftAnnouncements.map((ann, i) => renderAnnouncement(ann, i, leftAnnouncements.length)).join('')}
        </div>
        <div class="announcements-column">
          ${rightAnnouncements.map((ann, i) => renderAnnouncement(ann, i, rightAnnouncements.length)).join('')}
        </div>
      </div>
    ` : `
      <div style="padding: 30px; text-align: center; color: #666666; font-size: 10pt;">
        No hay anuncios seleccionados / No announcements selected
      </div>
    `}
    
    <div class="footer">
      Palabras de Vida • <span class="footer-accent">¡Atrévete a cambiar!</span>
    </div>
  </div>
</body>
</html>
  `;
}

function renderServiceColumn(timeSlot, segments) {
  if (!segments || segments.length === 0) {
    return `
      <div class="column">
        <div class="column-header"><span class="time-accent">${escapeHtml(timeSlot)}</span></div>
        <div style="padding: 12px; color: #666666; font-size: 10pt;">No hay segmentos</div>
      </div>
    `;
  }
  
  const validSegments = segments.filter(s => s && s.type !== 'break');
  
  if (validSegments.length === 0) {
    return `
      <div class="column">
        <div class="column-header"><span class="time-accent">${escapeHtml(timeSlot)}</span></div>
        <div style="padding: 12px; color: #666666; font-size: 10pt;">No hay segmentos</div>
      </div>
    `;
  }
  
  const segmentsHtml = validSegments.map(segment => {
    const title = segment.title || 'Sin título';
    const duration = segment.duration || '';
    const data = segment.data || {};
    
    let html = '<div class="segment">';
    
    // Time marker (if present)
    if (duration) {
      html += `<div class="segment-time">${escapeHtml(String(duration))} min</div>`;
    }
    
    // Title
    html += `<div class="segment-title">${escapeHtml(title)}</div>`;
    
    // Leader (with name styling)
    if (data.leader) {
      html += `<div class="segment-detail">Dirige: <span class="segment-name">${escapeHtml(data.leader)}</span></div>`;
    }
    
    // Presenter
    if (data.presenter) {
      html += `<div class="segment-detail"><span class="segment-name">${escapeHtml(data.presenter)}</span></div>`;
    }
    
    // Preacher
    if (data.preacher) {
      html += `<div class="segment-detail"><span class="segment-name">${escapeHtml(data.preacher)}</span></div>`;
    }
    
    // Message title
    if (data.title) {
      html += `<div class="segment-detail">${escapeHtml(data.title)}</div>`;
    }
    
    // Notes
    if (data.notes) {
      html += `<div class="segment-note">${escapeHtml(data.notes)}</div>`;
    }
    
    html += '</div>';
    return html;
  }).join('');
  
  return `
    <div class="column">
      <div class="column-header"><span class="time-accent">${escapeHtml(timeSlot)}</span></div>
      ${segmentsHtml}
    </div>
  `;
}

function renderAnnouncement(ann, index, total) {
  if (!ann) return '';
  
  const title = ann.title || ann.announcement_title || 'Sin título';
  const content = renderRichText(ann.content || ann.announcement_description || '');
  const cue = ann.instructions ? sanitizeText(stripCuePrefix(ann.instructions)) : '';
  const date = ann.date_of_occurrence || '';
  
  const showDivider = index < total - 1;
  
  return `
    <div class="announcement-item">
      <div class="announcement-title">
        <span class="announcement-marker"></span>${escapeHtml(title)}
      </div>
      ${content ? `<div class="announcement-content">${content}</div>` : ''}
      ${cue ? `<div class="announcement-cue"><span class="cue-label">CUE:</span> ${escapeHtml(cue)}</div>` : ''}
      ${date ? `<div class="announcement-date">${escapeHtml(date)}</div>` : ''}
    </div>
    ${showDivider ? '<div class="announcement-divider"></div>' : ''}
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

function renderRichText(text) {
  if (!text) return '';
  
  // Support basic rich text: <strong>, <em>, <ul>, <li>, <br>
  let html = text;
  
  // Convert line breaks
  html = html.replace(/<br\s*\/?>/gi, '<br>');
  
  // Handle bold
  html = html.replace(/<strong>(.*?)<\/strong>/gi, '<strong>$1</strong>');
  html = html.replace(/<b>(.*?)<\/b>/gi, '<strong>$1</strong>');
  
  // Handle italic
  html = html.replace(/<em>(.*?)<\/em>/gi, '<em>$1</em>');
  html = html.replace(/<i>(.*?)<\/i>/gi, '<em>$1</em>');
  
  // Handle lists (simple bullets)
  html = html.replace(/<ul>(.*?)<\/ul>/gis, '<ul style="margin: 4px 0; padding-left: 18px;">$1</ul>');
  html = html.replace(/<li>(.*?)<\/li>/gi, '<li style="margin: 2px 0;">$1</li>');
  
  // Strip any other tags
  html = html.replace(/<(?!\/?(?:strong|em|br|ul|li|b|i)\b)[^>]+>/gi, '');
  
  return html;
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