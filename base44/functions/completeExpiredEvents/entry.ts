/**
 * completeExpiredEvents.js (intent: manageEventLifecycle)
 * 
 * 2026-03-16 v2: Full Event Lifecycle Automation
 * Scheduled nightly at 12:30 AM ET.
 * 
 * Two transitions:
 *   1. confirmed → in_progress  — when start_date <= today (ET)
 *   2. in_progress → completed  — when end_date < today (ET)
 * 
 * Decision: "Automate full event lifecycle based on dates"
 * - Only touches confirmed and in_progress events
 * - planning events are untouched (they need manual confirmation)
 * - Completed status triggers form closure via getSpeakerFormData/getArtsFormData
 * - Defense-in-depth: form endpoints also check end_date directly
 * 
 * Surfaces affected: Event entity, public submission forms
 * Rollback: Set event status back manually if needed
 * 
 * PERF (v2.1): Fetch confirmed and in_progress in parallel to avoid
 * sequential cold-start timeout. Keep queries small (limit 20).
 */

// 2026-04-12: SDK bumped from 0.8.20 → 0.8.25 for consistency across all backend functions.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get current date in ET
    const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayETStr = `${nowET.getFullYear()}-${String(nowET.getMonth() + 1).padStart(2, '0')}-${String(nowET.getDate()).padStart(2, '0')}`;

    console.log(`[eventLifecycle] ET date: ${todayETStr}`);

    // Fetch both statuses in parallel to avoid sequential timeout
    const [confirmedEvents, inProgressEvents] = await Promise.all([
      base44.asServiceRole.entities.Event.filter({ status: 'confirmed' }, '-start_date', 20),
      base44.asServiceRole.entities.Event.filter({ status: 'in_progress' }, '-end_date', 20),
    ]);

    let activatedCount = 0;
    let completedCount = 0;

    // Phase 1: confirmed → in_progress (start_date <= today)
    for (const event of confirmedEvents) {
      if (event.start_date && event.start_date <= todayETStr) {
        console.log(`[eventLifecycle] Activating ${event.id} (${event.name})`);
        await base44.asServiceRole.entities.Event.update(event.id, { status: 'in_progress' });
        activatedCount++;
      }
    }

    // Phase 2: in_progress → completed (end_date < today)
    for (const event of inProgressEvents) {
      const endDate = event.end_date || event.start_date;
      if (endDate && endDate < todayETStr) {
        console.log(`[eventLifecycle] Completing ${event.id} (${event.name})`);
        await base44.asServiceRole.entities.Event.update(event.id, { status: 'completed' });
        completedCount++;
      }
    }

    console.log(`[eventLifecycle] Done: activated=${activatedCount}, completed=${completedCount}`);

    return Response.json({
      success: true,
      activated: activatedCount,
      completed: completedCount,
      date: todayETStr
    });

  } catch (error) {
    console.error('[eventLifecycle] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});