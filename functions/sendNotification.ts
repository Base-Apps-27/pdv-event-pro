import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import webpush from 'npm:web-push@3.6.7';

/**
 * sendNotification
 *
 * Builds bilingual notification payloads for:
 * - Segment actions (prep alerts)
 * - Segments transitioning to active (start alerts)
 *
 * Returns the notification payload so the frontend can display a local
 * Notification via the browser API. Additionally attempts Web Push delivery
 * to the user's registered subscriptions (best-effort).
 */

const NOTIFICATION_TITLES = {
  en: {
    action: "Action Needed",
    segment_starting: "Segment Starting",
  },
  es: {
    action: "Acción Requerida",
    segment_starting: "Segmento Comenzando",
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { type, actionLabel, segmentTitle, segmentId, sessionId, actionTime, language = user.ui_language || 'es' } = payload;

    if (!type || !segmentTitle) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build notification message (bilingual)
    const title = NOTIFICATION_TITLES[language]?.[type] || NOTIFICATION_TITLES.es[type] || 'Notification';
    let body = '';

    if (type === 'action' && actionLabel) {
      body = language === 'es'
        ? `${actionLabel} en ${segmentTitle}`
        : `${actionLabel} in ${segmentTitle}`;
      if (actionTime) {
        body += ` @ ${actionTime}`;
      }
    } else if (type === 'segment_starting') {
      body = language === 'es'
        ? `${segmentTitle} está comenzando`
        : `${segmentTitle} is starting`;
    }

    const notification = {
      title,
      body,
      tag: `${type}-${segmentId || 'general'}`,
      data: { sessionId, segmentId, type },
    };

    console.log(`[NOTIFICATION] User: ${user.email}, Type: ${type}, Title: ${title}`);

    // Attempt Web Push delivery (best-effort, never blocks the response)
    let sent = 0;
    let failed = 0;
    let expired = 0;

    try {
      const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter(
        { user_email: user.email, is_active: true }
      );

      if (subscriptions.length > 0) {
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
        const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@pdvevent.local';

        if (vapidPublicKey && vapidPrivateKey) {
          try {
            webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
          } catch (vapidError) {
            console.error('[NOTIFICATION] VAPID validation failed:', vapidError.message);
            console.error('[NOTIFICATION] Public key length:', vapidPublicKey?.length);
            console.error('[NOTIFICATION] Private key length:', vapidPrivateKey?.length);
            throw vapidError; // caught by outer try/catch — non-fatal
          }

          const notificationPayload = JSON.stringify(notification);

          for (const sub of subscriptions) {
            if (!sub.endpoint || !sub.auth_key || !sub.p256dh_key) {
              console.warn('[PUSH] Incomplete subscription, skipping:', sub.id);
              failed++;
              continue;
            }
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { auth: sub.auth_key, p256dh: sub.p256dh_key } },
                notificationPayload
              );
              sent++;
            } catch (error) {
              if (error.statusCode === 410 || error.statusCode === 404) {
                expired++;
                await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
                console.log(`[PUSH] Subscription expired, deactivated: ${sub.id}`);
              } else {
                failed++;
                console.warn(`[PUSH] Failed for sub ${sub.id}:`, error.statusCode || error.message);
              }
            }
          }
        } else {
          console.warn('[NOTIFICATION] VAPID keys not configured, skipping Web Push');
        }
      }
    } catch (pushError) {
      console.warn('[NOTIFICATION] Web Push delivery error (non-fatal):', pushError.message);
    }

    console.log(`[NOTIFICATION] Push results — Sent: ${sent}, Failed: ${failed}, Expired: ${expired}`);

    return Response.json({
      success: true,
      sent,
      failed,
      expired,
      notification: { title, body },
    });

  } catch (error) {
    console.error('[NOTIFICATION_ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
