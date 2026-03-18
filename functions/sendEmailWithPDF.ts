import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body, pdfBlob } = await req.json();

    if (!to || !subject || !body || !pdfBlob) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
    if (!SENDGRID_API_KEY) {
      return Response.json({ error: 'SendGrid API key not configured' }, { status: 500 });
    }

    // Convert base64 PDF to attachment
    const pdfBase64 = pdfBlob.split(',')[1] || pdfBlob;

    const senderEmail = Deno.env.get('SENDER_EMAIL') || 'danny.sena@ccpvida.org';
    const senderName = Deno.env.get('SENDER_NAME') || 'Palabras de Vida';

    const emailData = {
      personalizations: [{
        to: [{ email: to }],
        subject: subject
      }],
      from: {
        email: senderEmail,
        name: senderName
      },
      content: [{
        type: 'text/plain',
        value: body
      }],
      attachments: [{
        content: pdfBase64,
        filename: 'Orden-de-Servicio.pdf',
        type: 'application/pdf',
        disposition: 'attachment'
      }]
    };

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('SendGrid error:', errorBody);
      return Response.json({ error: 'Failed to send email' }, { status: 502 });
    }

    return Response.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});