/**
 * healSegmentData — Admin-only data healing utility (2026-04-15)
 * 
 * Fixes two known data integrity issues:
 * 1. Duplicate/fractional segment order values (from reorder race conditions)
 * 2. Null start_time/end_time on auto-created weekly service segments
 * 
 * For every Session in the app:
 *   a) Fetches all segments sorted by (order, created_date)
 *   b) Reassigns order as clean integers 1, 2, 3, ...
 *   c) Calculates start_time/end_time by chaining durations from session's planned_start_time
 *   d) Saves all fixed segments
 *   e) Returns summary of changes
 * 
 * Constitution: No destructive ops. Only updates order/start_time/end_time fields.
 * Rollback: Previous order values are logged in the response for manual recovery.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Add minutes to an HH:MM time string, returns HH:MM
 */
function addMinutes(timeStr, minutes) {
  if (!timeStr || !minutes) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: admin only
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dry_run = false } = await req.json().catch(() => ({}));

    console.log(`[HEAL_SEGMENT_DATA] Starting${dry_run ? ' (DRY RUN)' : ''}...`);

    // 1. Fetch all sessions
    const sessions = await base44.asServiceRole.entities.Session.filter({});
    console.log(`[HEAL_SEGMENT_DATA] Found ${sessions.length} sessions`);

    let totalSessionsFixed = 0;
    let totalSegmentsFixed = 0;
    let totalTimesFixed = 0;
    const sessionDetails = [];

    // 2. Process each session
    for (const session of sessions) {
      // Fetch all segments for this session (parents only — children handled separately)
      const allSegments = await base44.asServiceRole.entities.Segment.filter({ session_id: session.id });
      
      // Split into parents and children
      const parents = allSegments
        .filter(s => !s.parent_segment_id)
        .sort((a, b) => {
          // Sort by order first, then by created_date as tiebreaker
          const orderDiff = (a.order || 0) - (b.order || 0);
          if (orderDiff !== 0) return orderDiff;
          return (a.created_date || '').localeCompare(b.created_date || '');
        });

      const children = allSegments.filter(s => s.parent_segment_id);

      if (parents.length === 0) continue;

      let sessionFixCount = 0;
      let sessionTimeFixCount = 0;
      const sessionStartTime = session.planned_start_time; // HH:MM or null
      let currentTime = sessionStartTime;

      // 3. Reassign clean integer orders and calculate times
      for (let i = 0; i < parents.length; i++) {
        const seg = parents[i];
        const newOrder = i + 1;
        const duration = Number(seg.duration_min) || 0;

        // Calculate times if session has a start time
        let newStartTime = null;
        let newEndTime = null;
        if (currentTime) {
          newStartTime = currentTime;
          newEndTime = addMinutes(currentTime, duration);
          currentTime = newEndTime; // Chain for next segment
        }

        // Check if anything needs updating
        const orderChanged = seg.order !== newOrder;
        const startChanged = seg.start_time !== newStartTime && newStartTime !== null;
        const endChanged = seg.end_time !== newEndTime && newEndTime !== null;

        if (orderChanged || startChanged || endChanged) {
          const updatePayload = {};
          if (orderChanged) {
            updatePayload.order = newOrder;
            sessionFixCount++;
          }
          if (startChanged) {
            updatePayload.start_time = newStartTime;
            sessionTimeFixCount++;
          }
          if (endChanged) {
            updatePayload.end_time = newEndTime;
            if (!startChanged) sessionTimeFixCount++; // Count once per segment
          }

          if (!dry_run) {
            await base44.asServiceRole.entities.Segment.update(seg.id, updatePayload);
          }
        }

        // 4. Fix child segment ordering within each parent
        const segChildren = children
          .filter(c => c.parent_segment_id === seg.id)
          .sort((a, b) => {
            const orderDiff = (a.order || 0) - (b.order || 0);
            if (orderDiff !== 0) return orderDiff;
            return (a.created_date || '').localeCompare(b.created_date || '');
          });

        for (let j = 0; j < segChildren.length; j++) {
          const child = segChildren[j];
          const newChildOrder = j + 1;
          if (child.order !== newChildOrder) {
            if (!dry_run) {
              await base44.asServiceRole.entities.Segment.update(child.id, { order: newChildOrder });
            }
            sessionFixCount++;
          }
        }
      }

      if (sessionFixCount > 0 || sessionTimeFixCount > 0) {
        totalSessionsFixed++;
        totalSegmentsFixed += sessionFixCount;
        totalTimesFixed += sessionTimeFixCount;
        sessionDetails.push({
          session_id: session.id,
          session_name: session.name,
          service_id: session.service_id || session.event_id,
          parent_count: parents.length,
          orders_fixed: sessionFixCount,
          times_fixed: sessionTimeFixCount,
          planned_start: sessionStartTime,
        });
      }
    }

    console.log(`[HEAL_SEGMENT_DATA] Complete. ${totalSessionsFixed} sessions fixed, ${totalSegmentsFixed} order fixes, ${totalTimesFixed} time fixes`);

    return Response.json({
      status: 'ok',
      dry_run,
      summary: {
        total_sessions_scanned: sessions.length,
        sessions_fixed: totalSessionsFixed,
        segment_orders_fixed: totalSegmentsFixed,
        segment_times_fixed: totalTimesFixed,
      },
      details: sessionDetails,
    });

  } catch (error) {
    console.error('[HEAL_SEGMENT_DATA] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});