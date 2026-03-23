/**
 * sendNotification — DEPRECATED & DISABLED (2026-03-13)
 *
 * This function previously broadcast push notifications to ALL PushEngage
 * subscribers. It was the primary vector for mass notification spam:
 * - NotificationTrigger (browser-mounted) called this on every segment update
 * - Any segment update from ANY session triggered a broadcast to ALL subscribers
 * - ensureRecurringServices creating segments at midnight → 15+ notifications
 *
 * REPLACED BY: checkUpcomingNotifications (scheduled, server-side, 5-min interval)
 *
 * This endpoint now rejects all calls with 410 Gone to prevent any stale
 * caller from triggering a mass broadcast. If you see 410 errors in logs,
 * find and remove the caller — it's using a dead code path.
 *
 * Decision: "Notification System Rebuild" (2026-03-13)
 */

Deno.serve(async (req) => {
  console.error('[PUSH_DEPRECATED] sendNotification called — this function is disabled. Caller must be updated to stop calling this endpoint.');
  return Response.json({
    error: 'sendNotification is deprecated and disabled (2026-03-13). Push notifications are now handled by the scheduled checkUpcomingNotifications function.',
    deprecated: true,
  }, { status: 410 });
});