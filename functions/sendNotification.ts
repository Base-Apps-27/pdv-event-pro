import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * sendNotification
 *
 * Broadcasts a push notification to ALL PushEngage subscribers via the
 * PushEngage REST API (POST /apiv1/notifications).
 *
 * Previously used web-push + local PushSubscription entity records — that
 * approach was abandoned because it only reached the initiating device.
 * PushEngage manages subscriber registration; this function just triggers delivery.
 *
 * Payload contract (unchanged from legacy — frontend callers need no updates):
 *   type: 'action' | 'segment_starting'
 *   segmentTitle: string
 *   actionLabel?: string   (required when type === 'action')
 *   actionTime?: string
 *   segmentId?: string
 *   sessionId?: string
 *   language?: 'es' | 'en'  (defaults to user.ui_language or 'es')
 */

const TITLES = {
  en: { action: 'Action Needed',     segment_starting: 'Segment Starting' },
  es: { action: 'Acción Requerida',  segment_starting: 'Segmento Comenzando' },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const {
      type, actionLabel, segmentTitle, segmentId, sessionId,
      actionTime, language = user.ui_language || 'es',
    } = payload;

    if (!type || !segmentTitle) {
      return Response.json({ error: 'Missing required fields: type, segmentTitle' }, { status: 400 });
    }

    const lang = ['en', 'es'].includes(language) ? language : 'es';
    const title = TITLES[lang][type] || TITLES.es[type] || 'Notification';

    let body = '';
    if (type === 'action' && actionLabel) {
      body = lang === 'es'
        ? `${actionLabel} en ${segmentTitle}`
        : `${actionLabel} in ${segmentTitle}`;
      if (actionTime) body += ` @ ${actionTime}`;
    } else if (type === 'segment_starting') {
      body = lang === 'es'
        ? `${segmentTitle} está comenzando`
        : `${segmentTitle} is starting`;
    }

    const apiKey = Deno.env.get('PUSHENGAGE_API_KEY');
    if (!apiKey) {
      console.error('[PUSH] PUSHENGAGE_API_KEY not set');
      return Response.json({ error: 'Push service not configured' }, { status: 500 });
    }

    // Broadcast to all subscribers via PushEngage REST API
    // Docs: https://pushengage.com/support/article/rest-api-send-notification/
    const pePayload = {
      notification_title: title,
      notification_message: body,
      notification_url: 'https://' + (req.headers.get('host') || 'pdveventpro.com'),
      // send to all subscribers (no segment filter = broadcast)
    };

    console.log(`[PUSH] Broadcasting — type:${type} title:"${title}" body:"${body}"`);

    // PushEngage REST API requires form-encoded body (not JSON)
    const formBody = new URLSearchParams(pePayload).toString();
    const peRes = await fetch('https://api.pushengage.com/apiv1/notifications', {
      method: 'POST',
      headers: {
        'api_key': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });

    const peData = await peRes.json();
    console.log('[PUSH] PushEngage response:', JSON.stringify(peData));

    // Return 200 even if PushEngage rejects (rate limit, duplicate, etc.) so the
    // frontend test buttons don't throw and callers can log/inspect the details.
    const delivered = peRes.ok;
    if (!delivered) {
      console.error('[PUSH] PushEngage API error:', peRes.status, JSON.stringify(peData));
    }

    return Response.json({
      success: delivered,
      notification: { title, body },
      pushengage: peData,
    });

  } catch (error) {
    console.error('[NOTIFICATION_ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});