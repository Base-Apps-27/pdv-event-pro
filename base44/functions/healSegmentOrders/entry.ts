/**
 * healSegmentOrders — One-time auto-healing for duplicate segment orders and null times.
 * 2026-04-16: Created to fix ~50+ segments with duplicate order=1 and null start/end times.
 *
 * BEHAVIOR:
 *   1. Fetch all Sessions
 *   2. For each session, fetch segments sorted by (order ASC, created_date ASC)
 *   3. Detect problems: duplicate orders OR null start_time on any segment
 *   4. If problems found:
 *      a. Assign clean integer orders: 1, 2, 3, ... based on sort position
 *      b. Chain start_time/end_time from session.planned_start_time + duration_min
 *      c. Batch-save all fixed segments
 *   5. Return count of fixed sessions and segments
 *
 * SAFETY:
 *   - Admin-only (auth check)
 *   - Read-heavy, write-only on segments that actually need fixing
 *   - Idempotent: running twice is a no-op (clean orders + times = no problems detected)
 *   - Does NOT delete records or change schema
 *
 * CLEANUP: Remove after confirming all segments are healed.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function addMinutes(timeStr, minutes) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all sessions
    const allSessions = await base44.asServiceRole.entities.Session.list('-created_date', 200);
    console.log(`[healSegmentOrders] Found ${allSessions.length} sessions to check`);

    let fixedSessions = 0;
    let fixedSegments = 0;

    for (const session of allSessions) {
      // Fetch segments for this session, sorted by order then created_date
      let segments;
      try {
        segments = await base44.asServiceRole.entities.Segment.filter(
          { session_id: session.id },
          'order'
        );
      } catch (err) {
        console.warn(`[healSegmentOrders] Failed to fetch segments for session ${session.id}: ${err.message}`);
        continue;
      }

      // Only process non-child (root) segments
      const rootSegments = segments.filter(s => !s.parent_segment_id);
      if (rootSegments.length === 0) continue;

      // Sort by (order ASC, created_date ASC) for stable deduplication
      rootSegments.sort((a, b) => {
        const orderDiff = (a.order || 0) - (b.order || 0);
        if (orderDiff !== 0) return orderDiff;
        // Tie-break by created_date (earlier first)
        const aDate = a.created_date ? new Date(a.created_date).getTime() : 0;
        const bDate = b.created_date ? new Date(b.created_date).getTime() : 0;
        return aDate - bDate;
      });

      // Detect problems: duplicate orders or null start_time
      const orderSet = new Set();
      let hasDuplicateOrder = false;
      let hasNullTime = false;
      for (const seg of rootSegments) {
        if (orderSet.has(seg.order)) hasDuplicateOrder = true;
        orderSet.add(seg.order);
        if (!seg.start_time) hasNullTime = true;
      }

      if (!hasDuplicateOrder && !hasNullTime) continue;

      // Fix: assign clean orders and chain times
      const sessionStart = session.planned_start_time || '09:00';
      let currentTime = sessionStart;
      const updates = [];

      for (let i = 0; i < rootSegments.length; i++) {
        const seg = rootSegments[i];
        const newOrder = i + 1;
        const duration = seg.duration_min || 5;
        const newStart = currentTime;
        const newEnd = addMinutes(currentTime, duration);

        // Only update if something actually changed
        const needsUpdate =
          seg.order !== newOrder ||
          seg.start_time !== newStart ||
          seg.end_time !== newEnd;

        if (needsUpdate) {
          updates.push({
            id: seg.id,
            data: {
              order: newOrder,
              start_time: newStart,
              end_time: newEnd,
            }
          });
        }

        currentTime = newEnd;
      }

      if (updates.length > 0) {
        console.log(`[healSegmentOrders] Session ${session.id} (${session.name}): fixing ${updates.length} segments`);
        for (const upd of updates) {
          // Rate-limit mitigation: small delay between writes
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await base44.asServiceRole.entities.Segment.update(upd.id, upd.data);
              break;
            } catch (retryErr) {
              if (attempt < 2 && retryErr.message?.includes('Rate limit')) {
                console.warn(`[healSegmentOrders] Rate limited, waiting 2s before retry...`);
                await new Promise(r => setTimeout(r, 2000));
              } else {
                throw retryErr;
              }
            }
          }
          // 200ms pause between updates to stay under rate limits
          await new Promise(r => setTimeout(r, 200));
        }
        fixedSessions++;
        fixedSegments += updates.length;
      }
    }

    console.log(`[healSegmentOrders] Complete: fixed ${fixedSessions} sessions, ${fixedSegments} segments`);
    return Response.json({ fixedSessions, fixedSegments });
  } catch (error) {
    console.error('[healSegmentOrders] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});