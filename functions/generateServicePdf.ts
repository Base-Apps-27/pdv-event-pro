import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { jsPDF } from 'npm:jspdf@2.5.1';

// Server receives pre-rendered images from client and assembles into PDF
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { page1Image, page2Image, selectedDate } = await req.json();

    if (!page1Image) {
      return Response.json({ error: 'No page1Image provided' }, { status: 400 });
    }

    // Create PDF - letter size
    const doc = new jsPDF({ 
      orientation: 'portrait', 
      unit: 'pt', 
      format: 'letter' 
    });

    const pageWidth = doc.internal.pageSize.getWidth();   // 612
    const pageHeight = doc.internal.pageSize.getHeight(); // 792

    // Add page 1 image (service order)
    doc.addImage(page1Image, 'PNG', 0, 0, pageWidth, pageHeight);

    // Add page 2 image (announcements) if provided
    if (page2Image) {
      doc.addPage();
      doc.addImage(page2Image, 'PNG', 0, 0, pageWidth, pageHeight);
    }

    // Output
    const pdfOutput = doc.output('arraybuffer');
    
    return new Response(pdfOutput, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="servicio-${selectedDate || 'export'}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});