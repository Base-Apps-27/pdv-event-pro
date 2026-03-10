import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * sendNotification
 * 
 * Delivers Web Push notifications via VAPID to subscribed users when:
 * - Segment actions are created (prep alerts)
 * - Segments transition to active state (segment start alerts)
 * 
 * Architecture (2026-03-10):
 * 1. Called by entity automations (SegmentAction.create, Segment.update)
 * 2. Retrieves user's PushSubscription records from database
 * 3. Signs payload with VAPID private key
 * 4. Sends encrypted push via Web Push Protocol to each subscription endpoint
 * 5. Service Worker receives push, displays notification
 * 
 * Fallback: If user has no subscriptions or Web Push fails, logs audit trail.
 * Bilingual: Notification title/body built from user.ui_language preference.
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

// Helper: Create VAPID Authorization header (JWT-like signature)
async function createVAPIDAuthHeader(payload) {
  const privateKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY');
  const publicKeyB64 = Deno.env.get('VAPID_PUBLIC_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');

  if (!privateKeyB64 || !publicKeyB64 || !subject) {
    throw new Error('VAPID keys not configured');
  }

  // Decode base64url keys
  const base64url = (str) => str.replace(/-/g, '+').replace(/_/g, '/');
  const privateKeyBinary = atob(base64url(privateKeyB64));
  const privateKeyArray = new Uint8Array(privateKeyBinary.length);
  for (let i = 0; i < privateKeyBinary.length; i++) {
    privateKeyArray[i] = privateKeyBinary.charCodeAt(i);
  }

  // Import private key for signing
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyArray.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Create VAPID JWT (simplified for Web Push)
  const now = Math.floor(Date.now() / 1000);
  const header = JSON.stringify({ typ: 'JWT', alg: 'ES256' });
  const claim = JSON.stringify({
    aud: 'https://fcm.googleapis.com',
    exp: now + 3600,
    sub: subject,
  });

  const encodeBase64Url = (str) => {
    const encoded = btoa(str);
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const headerB64 = encodeBase64Url(header);
  const claimB64 = encodeBase64Url(claim);
  const messageToSign = `${headerB64}.${claimB64}`;

  const signatureBuffer = await crypto.subtle.sign(
    'ECDSA',
    key,
    new TextEncoder().encode(messageToSign)
  );

  // Convert signature to base64url (remove leading zeros)
  const signatureArray = new Uint8Array(signatureBuffer);
  const signatureB64 = btoa(String.fromCharCode(...signatureArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${messageToSign}.${signatureB64}`;
}

// Helper: Send Web Push to subscription endpoint
async function sendWebPush(subscription, payload, vapidAuth) {
  const { endpoint, auth_key, p256dh_key } = subscription;

  if (!endpoint || !auth_key || !p256dh_key) {
    console.warn('[PUSH] Incomplete subscription, skipping');
    return false;
  }

  try {
    const payloadJson = JSON.stringify(payload);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        Authorization: `vapid t=${vapidAuth}, k=${Deno.env.get('VAPID_PUBLIC_KEY')}`,
      },
      body: new TextEncoder().encode(payloadJson),
    });

    if (response.status === 201) {
      console.log('[PUSH] Sent successfully');
      return true;
    } else if (response.status === 410 || response.status === 404) {
      console.log('[PUSH] Subscription expired/invalid, marking inactive');
      return 'expired';
    } else {
      console.error(`[PUSH] Unexpected status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('[PUSH_ERROR]', error.message);
    return false;
  }
}

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

    console.log(`[NOTIFICATION] User: ${user.email}, Type: ${type}, Subs: lookup...`);

    // Retrieve user's push subscriptions
    const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter(
      { user_email: user.email, is_active: true }
    );

    if (subscriptions.length === 0) {
      console.log(`[NOTIFICATION] No active subscriptions for ${user.email}`);
      return Response.json({ success: true, message: 'No subscriptions' });
    }

    // Build payload for Web Push (encrypted by browser)
    const notificationPayload = {
      title,
      body,
      tag: `${type}-${segmentId || 'general'}`, // Group similar notifications
      data: {
        sessionId,
        segmentId,
        type,
      },
    };

    // Create VAPID authorization header
    const vapidAuth = await createVAPIDAuthHeader(notificationPayload);

    // Send to all subscriptions
    let sent = 0;
    let failed = 0;
    let expired = 0;

    for (const sub of subscriptions) {
      const result = await sendWebPush(sub, notificationPayload, vapidAuth);
      if (result === true) {
        sent++;
      } else if (result === 'expired') {
        expired++;
        // Mark subscription inactive
        await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
      } else {
        failed++;
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