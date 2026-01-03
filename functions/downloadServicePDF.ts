import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * downloadServicePDF
 * 
 * PURPOSE: Receives a PDF blob (base64) from frontend and returns it as a file download.
 * This is a simple passthrough function that handles the Content-Disposition header.
 * 
 * FLOW:
 * 1. Frontend generates PDF using html2canvas + jsPDF
 * 2. Converts PDF to base64 string
 * 3. Sends to this function
 * 4. Function returns binary PDF with download headers
 * 
 * INPUT:
 * {
 *   pdfBase64: string (base64-encoded PDF, with or without data URI prefix)
 *   filename: string (e.g., "Servicio-2025-01-15.pdf")
 * }
 * 
 * OUTPUT:
 * Binary PDF file with Content-Disposition: attachment
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // CRITICAL: Require authentication (prevents unauthorized PDF generation)
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pdfBase64, filename } = await req.json();
    
    if (!pdfBase64) {
      return Response.json({ error: 'Missing pdfBase64' }, { status: 400 });
    }

    // Strip data URI prefix if present (data:application/pdf;base64,...)
    const cleanBase64 = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
    
    // Decode base64 to binary
    const pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
    
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename || 'servicio.pdf'}"`
      }
    });
  } catch (error) {
    console.error('[downloadServicePDF] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});