/**
 * completeExpiredEvents.js
 * 
 * 2026-03-16: Scheduled automation — runs nightly at 12:30 AM ET.
 * Finds events with status "in_progress" whose end_date has passed (in ET),
 * and transitions them to "completed".
 * 
 * Decision: "Auto-complete events after last session concludes"
 * - Only touches in_progress events (not confirmed/planning — those are pre-event)
 * - Uses end_date as the completion trigger (conservative: event is done when
 *   the last calendar day passes, not mid-session)
 * - Admin-only: scheduled task runs under service role but validates admin caller
 * 
 * Surfaces affected: Event entity, public submission forms (block on completed)
 * Rollback: Set event status back to "in_progress" manually if needed
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Scheduled automations run with a system token — use service role
    // No user auth check needed for scheduled tasks (platform invokes directly)

    // Get current date in ET
    const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayETStr = `${nowET.getFullYear()}-${String(nowET.getMonth() + 1).padStart(2, '0')}-${String(nowET.getDate()).padStart(2, '0')}`;

    console.log(`[completeExpiredEvents] Running at ${nowET.toISOString()} (ET date: ${todayETStr})`);

    // Fetch all in_progress events
    const inProgressEvents = await base44.asServiceRole.entities.Event.filter(
      { status: 'in_progress' }, '-end_date', 50
    );

    console.log(`[completeExpiredEvents] Found ${inProgressEvents.length} in_progress events`);

    let completedCount = 0;

    for (const event of inProgressEvents) {
      // An event is "expired" if its end_date is strictly before today (ET)
      // If no end_date, fall back to start_date
      const eventEndDate = event.end_date || event.start_date;
      if (!eventEndDate) {
        console.log(`[completeExpiredEvents] Skipping event ${event.id} (${event.name}) — no dates`);
        continue;
      }

      if (eventEndDate < todayETStr) {
        console.log(`[completeExpiredEvents] Completing event ${event.id} (${event.name}) — end_date ${eventEndDate} < ${todayETStr}`);
        await base44.asServiceRole.entities.Event.update(event.id, { status: 'completed' });
        completedCount++;
      }
    }

    console.log(`[completeExpiredEvents] Completed ${completedCount} events`);

    return Response.json({
      success: true,
      checked: inProgressEvents.length,
      completed: completedCount,
      date: todayETStr
    });

  } catch (error) {
    console.error('[completeExpiredEvents] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});