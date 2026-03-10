import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import webpush from 'npm:web-push@3.6.7';

/**
 * sendNotification
 *
 * Delivers Web Push notifications via VAPID to subscribed users when:
 * - Segment actions are created (prep alerts)
 * - Segments transition to active state (segment start alerts)
 *
 * Uses the web-push library for proper RFC 8291 payload encryption
 * and VAPID (RFC 8292) authentication.
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

    // Validate VAPID config
    const vapidPublicKeyB64 = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@pdvevent.local';

    if (!vapidPublicKeyB64 || !vapidPrivateKeyB64) {
      console.error('[NOTIFICATION] VAPID keys not configured');
      return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // Decode base64url keys to raw format for web-push library
    const decodeBase64Url = (str) => {
      const padding = '='.repeat((4 - str.length % 4) % 4);
      const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
      return base64;
    };

    webpush.setVapidDetails(vapidSubject, vapidPublicKeyB64, decodeBase64Url(vapidPrivateKeyB64));

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

    console.log(`[NOTIFICATION] User: ${user.email}, Type: ${type}`);

    // Retrieve user's push subscriptions
    const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter(
      { user_email: user.email, is_active: true }
    );

    if (subscriptions.length === 0) {
      console.log(`[NOTIFICATION] No active subscriptions for ${user.email}`);
      return Response.json({ success: true, message: 'No subscriptions', notification: { title, body } });
    }

    // Build push payload
    const notificationPayload = JSON.stringify({
      title,
      body,
      tag: `${type}-${segmentId || 'general'}`,
      data: { sessionId, segmentId, type },
    });

    // Send to all subscriptions via web-push (handles encryption + VAPID signing)
    let sent = 0;
    let failed = 0;
    let expired = 0;

    for (const sub of subscriptions) {
      if (!sub.endpoint || !sub.auth_key || !sub.p256dh_key) {
        console.warn('[PUSH] Incomplete subscription, skipping:', sub.id);
        failed++;
        continue;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth_key,
              p256dh: sub.p256dh_key,
            },
          },
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
          console.error(`[PUSH] Failed for sub ${sub.id}:`, error.statusCode, error.body);
        }
      }
    }

    console.log(`[NOTIFICATION] Sent: ${sent}, Failed: ${failed}, Expired: ${expired}`);

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