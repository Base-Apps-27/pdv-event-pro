import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// WATCHDOG: Stuck Submission Safety Net (DECISION-008 / 2026-03-08)
//
// Purpose: Catch segments where submission_status='pending' has been stuck
// for >3 minutes — meaning the entity automation fired but silently skipped
// (stale payload race condition) or genuinely failed to trigger.
//
// This is the THIRD tier of the submission reliability stack:
//   Tier 1: Resilience fetch in processSegmentSubmission (live)
//   Tier 2: Entity automation (primary trigger)
//   Tier 3: This watchdog (scheduled safety net, runs every 5 min)
//
// Scheduled: every 5 minutes via automation.
// Admin-only: no user token required — called by scheduler.
// Safe: read-then-invoke only, no destructive writes.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Watchdog runs as service role — no user token available from scheduler
    const staleThresholdMs = 3 * 60 * 1000; // 3 minutes
    const cutoffTime = new Date(Date.now() - staleThresholdMs).toISOString();

    // Find all segments stuck in 'pending' for more than 3 minutes
    // updated_date reflects when submission_status was last written
    const stuckSegments = await base44.asServiceRole.entities.Segment.filter(
      { submission_status: 'pending' },
      '-updated_date',
      50
    );

    // Filter to only those updated more than 3 minutes ago
    const stalePending = stuckSegments.filter(seg => {
      const updatedAt = seg.updated_date || seg.created_date;
      return updatedAt && new Date(updatedAt) < new Date(cutoffTime);
    });

    if (stalePending.length === 0) {
      console.log('[WATCHDOG] No stuck pending submissions found.');
      return Response.json({ success: true, requeued: 0 });
    }

    console.log(`[WATCHDOG] Found ${stalePending.length} stuck segment(s) — re-queuing...`);

    const results = [];
    for (const seg of stalePending) {
      try {
        console.log(`[WATCHDOG] Re-queuing segment ${seg.id} (stuck since ${seg.updated_date})`);
        // FIX (2026-03-10): Use direct { segmentId } invocation pattern.
        // The old { event: { entity_name: 'Segment', ... } } pattern is now rejected
        // by processSegmentSubmission to prevent the entity automation infinite loop.
        await base44.asServiceRole.functions.invoke('processSegmentSubmission', {
          segmentId: seg.id
        });
        results.push({ id: seg.id, status: 'requeued' });
      } catch (err) {
        console.error(`[WATCHDOG] Failed to requeue segment ${seg.id}: ${err.message}`);
        results.push({ id: seg.id, status: 'failed', error: err.message });
      }
    }

    const requeuedCount = results.filter(r => r.status === 'requeued').length;
    console.log(`[WATCHDOG] Done. Requeued: ${requeuedCount}/${stalePending.length}`);

    return Response.json({ success: true, requeued: requeuedCount, results });
  } catch (error) {
    console.error(`[WATCHDOG] Fatal error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});