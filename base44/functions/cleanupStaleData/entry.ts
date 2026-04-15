/**
 * cleanupStaleData — Scheduled housekeeping for security and data hygiene.
 * 
 * 2026-04-15: Created to address three issues:
 *   1. PublicFormIdempotency records accumulate indefinitely (may contain PII)
 *      → Delete records older than 7 days
 *   2. Deactivated PushSubscription records retain VAPID keys
 *      → Clear auth_key and p256dh_key on inactive subscriptions
 *   3. General data hygiene for ephemeral entities
 *
 * Runs as a scheduled automation (daily at 3 AM ET).
 * Admin-only: verifies caller is admin before executing.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const results = { idempotency: 0, pushKeys: 0, errors: [] };

    // ── 1. PublicFormIdempotency TTL: Delete records older than 7 days ──
    // 2026-04-15: Security fix — response_payload may contain PII from form submissions.
    // 7-day window is sufficient for idempotency retries.
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      // Fetch old records in batches and delete
      const staleRecords = await base44.asServiceRole.entities.PublicFormIdempotency.filter(
        {}, '-created_date', 200
      );
      
      const toDelete = staleRecords.filter(r => r.created_date && r.created_date < cutoffDate);
      
      for (const record of toDelete) {
        await base44.asServiceRole.entities.PublicFormIdempotency.delete(record.id);
        results.idempotency++;
      }
      console.log(`[CLEANUP] Deleted ${results.idempotency} stale PublicFormIdempotency records (>7 days)`);
    } catch (err) {
      console.error('[CLEANUP] PublicFormIdempotency cleanup failed:', err.message);
      results.errors.push(`idempotency: ${err.message}`);
    }

    // ── 2. PushSubscription: Clear VAPID keys on inactive subscriptions ──
    // 2026-04-15: Security fix — auth_key and p256dh_key should not persist
    // after a subscription is deactivated.
    try {
      const inactiveSubs = await base44.asServiceRole.entities.PushSubscription.filter({
        is_active: false,
      });
      
      // Only update those that still have keys
      const withKeys = inactiveSubs.filter(s => s.auth_key || s.p256dh_key);
      
      for (const sub of withKeys) {
        await base44.asServiceRole.entities.PushSubscription.update(sub.id, {
          auth_key: null,
          p256dh_key: null,
        });
        results.pushKeys++;
      }
      console.log(`[CLEANUP] Cleared VAPID keys on ${results.pushKeys} inactive PushSubscription records`);
    } catch (err) {
      console.error('[CLEANUP] PushSubscription cleanup failed:', err.message);
      results.errors.push(`pushKeys: ${err.message}`);
    }

    console.log(`[CLEANUP] Complete: ${JSON.stringify(results)}`);
    return Response.json({ success: true, ...results });
  } catch (error) {
    console.error('[CLEANUP] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});