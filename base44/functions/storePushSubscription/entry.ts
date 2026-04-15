/**
 * storePushSubscription
 * 
 * Receives Web Push subscription from frontend after user grants permission.
 * Stores encrypted subscription keys (auth, p256dh) for later Web Push delivery.
 * 
 * Deduplication: One subscription per user + device (user_agent).
 * If subscription already exists, updates endpoint (may change on browser reinstall).
 * 
 * 2026-03-10: VAPID Web Push backend storage
 * 2026-04-15: Added unsubscribe action — clears VAPID keys when is_active=false
 *   (security: keys are no longer needed once subscription is deactivated)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // ── UNSUBSCRIBE: Deactivate + clear VAPID keys ──────────────
    // 2026-04-15: Security fix — auth_key and p256dh_key are cleared when
    // subscription is deactivated so stale keys don't persist in the DB.
    if (action === 'unsubscribe') {
      const existing = await base44.asServiceRole.entities.PushSubscription.filter({
        user_email: user.email,
        is_active: true,
      });
      let deactivated = 0;
      for (const sub of existing) {
        await base44.asServiceRole.entities.PushSubscription.update(sub.id, {
          is_active: false,
          auth_key: null,
          p256dh_key: null,
        });
        deactivated++;
      }
      console.log(`[PUSH] Deactivated ${deactivated} subscription(s) for ${user.email}`);
      return Response.json({ success: true, deactivated });
    }

    // ── SUBSCRIBE: Store or update VAPID keys ───────────────────
    const { endpoint, auth_key, p256dh_key, user_agent } = body;

    if (!endpoint || !auth_key || !p256dh_key) {
      return Response.json({ error: 'Missing subscription keys' }, { status: 400 });
    }

    // Check if subscription already exists for this user + device
    const existing = await base44.asServiceRole.entities.PushSubscription.filter({
      user_email: user.email,
      user_agent,
    });

    let result;
    if (existing.length > 0) {
      // Update endpoint (may have changed)
      result = await base44.asServiceRole.entities.PushSubscription.update(existing[0].id, {
        endpoint,
        auth_key,
        p256dh_key,
        is_active: true,
      });
      console.log(`[PUSH] Updated subscription for ${user.email}`);
    } else {
      // Create new subscription
      result = await base44.asServiceRole.entities.PushSubscription.create({
        user_email: user.email,
        endpoint,
        auth_key,
        p256dh_key,
        user_agent,
        is_active: true,
      });
      console.log(`[PUSH] Created subscription for ${user.email}`);
    }

    return Response.json({ success: true, subscriptionId: result.id });
  } catch (error) {
    console.error('[STORE_PUSH_ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});