/**
 * completeExpiredEvents.js (renamed intent: manageEventLifecycle)
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
 * Surfaces affected: Event entity, public submission forms (block on completed)
 * Rollback: Set event status back manually if needed
 * 
 * Cost justification: ~1 lightweight query per night, negligible for 365 nights
 * vs. ~5 events/year. Simplest reliable way to catch midnight date boundaries.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get current date in ET
    const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayETStr = `${nowET.getFullYear()}-${String(nowET.getMonth() + 1).padStart(2, '0')}-${String(nowET.getDate()).padStart(2, '0')}`;

    console.log(`[eventLifecycle] Running at ${nowET.toISOString()} (ET date: ${todayETStr})`);

    let activatedCount = 0;
    let completedCount = 0;

    // ── Phase 1: confirmed → in_progress ────────────────────────────
    // An event starts when today >= start_date
    const confirmedEvents = await base44.asServiceRole.entities.Event.filter(
      { status: 'confirmed' }, '-start_date', 50
    );
    console.log(`[eventLifecycle] Found ${confirmedEvents.length} confirmed events`);

    for (const event of confirmedEvents) {
      if (!event.start_date) {
        console.log(`[eventLifecycle] Skipping confirmed event ${event.id} (${event.name}) — no start_date`);
        continue;
      }
      // Activate if today is on or after start_date
      if (event.start_date <= todayETStr) {
        console.log(`[eventLifecycle] Activating event ${event.id} (${event.name}) — start_date ${event.start_date} <= ${todayETStr}`);
        await base44.asServiceRole.entities.Event.update(event.id, { status: 'in_progress' });
        activatedCount++;
      }
    }

    // ── Phase 2: in_progress → completed ────────────────────────────
    // An event completes when today is strictly after end_date (or start_date if no end_date)
    const inProgressEvents = await base44.asServiceRole.entities.Event.filter(
      { status: 'in_progress' }, '-end_date', 50
    );
    console.log(`[eventLifecycle] Found ${inProgressEvents.length} in_progress events`);

    for (const event of inProgressEvents) {
      const eventEndDate = event.end_date || event.start_date;
      if (!eventEndDate) {
        console.log(`[eventLifecycle] Skipping in_progress event ${event.id} (${event.name}) — no dates`);
        continue;
      }
      // Complete if today is strictly after end_date (event ran through end_date fully)
      if (eventEndDate < todayETStr) {
        console.log(`[eventLifecycle] Completing event ${event.id} (${event.name}) — end_date ${eventEndDate} < ${todayETStr}`);
        await base44.asServiceRole.entities.Event.update(event.id, { status: 'completed' });
        completedCount++;
      }
    }

    console.log(`[eventLifecycle] Activated ${activatedCount}, Completed ${completedCount}`);

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