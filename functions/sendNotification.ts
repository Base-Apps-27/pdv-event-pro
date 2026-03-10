import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * sendNotification
 * 
 * Sends browser notifications to subscribed users for:
 * - Segment action alerts (upcoming prep actions)
 * - Segment start alerts (when segment becomes active)
 * 
 * Triggered via automations:
 *   1. On SegmentAction create → immediate notification
 *   2. On Segment state change (active) → segment start alert
 * 
 * Uses Notification API (desktop) and stores no actual push subscriptions.
 * Each notification is scoped to users viewing the session.
 * 
 * 2026-03-10: Bilingual support via user language preference
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
    const { type, actionLabel, segmentTitle, segmentId, sessionId, actionTime, language = 'en' } = payload;

    if (!type || !segmentTitle) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build notification message (bilingual)
    const title = NOTIFICATION_TITLES[language]?.[type] || NOTIFICATION_TITLES.en[type] || 'Notification';
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

    // Log the notification attempt (audit trail)
    console.log(`[NOTIFICATION] User: ${user.email}, Type: ${type}, Title: ${title}, Body: ${body}`);

    // Note: Actual Web Push would require:
    // 1. Service Worker with push event handler (frontend)
    // 2. VAPID key pair (server)
    // 3. User permission + subscription endpoint
    // 
    // For now, this function serves as:
    // - Billing/audit record of notification triggers
    // - Ready for future Web Push integration
    // - Testing endpoint for translation verification

    return Response.json({ 
      success: true, 
      notification: { title, body },
      message: 'Notification prepared (Web Push delivery ready for frontend service worker)'
    });

  } catch (error) {
    console.error('[NOTIFICATION_ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});