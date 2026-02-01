import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  }

  const base44 = createClientFromRequest(req);
  const { sessionId, segmentId, action, value, field } = await req.json();

  try {
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Permission check: require admin role or 'manage_live_timing' permission
    const isAdmin = user.role === 'admin';
    const hasManagePermission = Array.isArray(user.custom_permissions) && user.custom_permissions.includes('manage_live_timing');
    if (!isAdmin && !hasManagePermission) {
      return new Response(JSON.stringify({ error: 'Forbidden: manage_live_timing required' }), { status: 403 });
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), { status: 400 });
    }

    // Helper: Add minutes to HH:MM string
    const addMinutes = (timeStr, minutes) => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      const date = new Date();
      date.setHours(h, m + minutes, 0, 0);
      const newH = String(date.getHours()).padStart(2, '0');
      const newM = String(date.getMinutes()).padStart(2, '0');
      return `${newH}:${newM}`;
    };

    // Helper: Get difference in minutes between two HH:MM strings
    const getDiffMinutes = (startStr, endStr) => {
      if (!startStr || !endStr) return 0;
      const [h1, m1] = startStr.split(':').map(Number);
      const [h2, m2] = endStr.split(':').map(Number);
      const d1 = new Date(); d1.setHours(h1, m1, 0, 0);
      const d2 = new Date(); d2.setHours(h2, m2, 0, 0);
      return Math.round((d2 - d1) / 60000);
    };

    if (action === 'toggle_live_adjustment') {
      const enabled = !!value;
      
      // Update session
      await base44.asServiceRole.entities.Session.update(sessionId, {
        live_adjustment_enabled: enabled,
        last_live_adjustment_time: new Date().toISOString()
      });

      if (!enabled) {
        // Reset all segments in session
        const segments = await base44.asServiceRole.entities.Segment.filter({ session_id: sessionId }, 'order');
        await Promise.all(segments.map(seg => 
          base44.asServiceRole.entities.Segment.update(seg.id, {
            actual_start_time: null,
            actual_end_time: null,
            is_live_adjusted: false
          })
        ));
      } else {
        // Initialize segments if not already set (optional, or just leave them null until adjusted)
        // Leaving null allows frontend to fallback to planned time, which is desired.
      }

      return new Response(JSON.stringify({ success: true, enabled }), { status: 200 });
    }

    // ============================================================
    // ACTION: mark_ended_manual
    // Sets segment's actual_end_time to NOW, and auto-sets next segment's actual_start_time to NOW.
    // NO cascade to subsequent segments - user manually adjusts those.
    // ============================================================
    if (action === 'mark_ended_manual') {
      const [session] = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
      if (!session || !session.live_adjustment_enabled) {
        return new Response(JSON.stringify({ error: 'Live adjustment not enabled for this session' }), { status: 400 });
      }

      let segments = await base44.asServiceRole.entities.Segment.filter({ session_id: sessionId }, 'order');
      segments = segments.sort((a, b) => (a.order || 0) - (b.order || 0));

      const targetIndex = segments.findIndex(s => s.id === segmentId);
      if (targetIndex === -1) {
        return new Response(JSON.stringify({ error: 'Segment not found' }), { status: 404 });
      }

      const targetSegment = segments[targetIndex];
      const now = new Date();
      const currentHHMM = value || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Update current segment with end time
      await base44.asServiceRole.entities.Segment.update(targetSegment.id, {
        actual_end_time: currentHHMM,
        is_live_adjusted: true,
        actual_start_time: targetSegment.actual_start_time || targetSegment.start_time
      });

      // Auto-set next segment's start time to NOW (single cascade)
      if (targetIndex + 1 < segments.length) {
        const nextSegment = segments[targetIndex + 1];
        await base44.asServiceRole.entities.Segment.update(nextSegment.id, {
          actual_start_time: currentHHMM,
          is_live_adjusted: true
        });
      }

      await base44.asServiceRole.entities.Session.update(sessionId, {
        last_live_adjustment_time: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true, endedAt: currentHHMM }), { status: 200 });
    }

    // ============================================================
    // ACTION: set_time
    // Manually set a single field (actual_start_time or actual_end_time) on a segment.
    // NO cascade - user is in full manual control.
    // ============================================================
    if (action === 'set_time') {
      const [session] = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
      if (!session || !session.live_adjustment_enabled) {
        return new Response(JSON.stringify({ error: 'Live adjustment not enabled for this session' }), { status: 400 });
      }

      if (!field || !['actual_start_time', 'actual_end_time'].includes(field)) {
        return new Response(JSON.stringify({ error: 'set_time requires valid field parameter (actual_start_time or actual_end_time)' }), { status: 400 });
      }

      if (!segmentId) {
        return new Response(JSON.stringify({ error: 'set_time requires segmentId' }), { status: 400 });
      }

      // Update the single field on the segment
      await base44.asServiceRole.entities.Segment.update(segmentId, {
        [field]: value,
        is_live_adjusted: true
      });

      await base44.asServiceRole.entities.Session.update(sessionId, {
        last_live_adjustment_time: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true, field, value }), { status: 200 });
    }

    // ============================================================
    // LEGACY ACTIONS: mark_ended, adjust_start (kept for backward compatibility)
    // These cascade to all subsequent segments.
    // ============================================================
    if (action === 'mark_ended' || action === 'adjust_start') {
      // 1. Verify session is enabled
      const [session] = await base44.asServiceRole.entities.Session.filter({ id: sessionId });
      if (!session || !session.live_adjustment_enabled) {
        return new Response(JSON.stringify({ error: 'Live adjustment not enabled for this session' }), { status: 400 });
      }

      // 2. Fetch segments
      let segments = await base44.asServiceRole.entities.Segment.filter({ session_id: sessionId }, 'order');
      segments = segments.sort((a, b) => (a.order || 0) - (b.order || 0));

      const targetIndex = segments.findIndex(s => s.id === segmentId);
      if (targetIndex === -1) {
        return new Response(JSON.stringify({ error: 'Segment not found' }), { status: 404 });
      }

      const targetSegment = segments[targetIndex];
      let offset = 0;

      if (action === 'mark_ended') {
        const now = new Date();
        const currentHHMM = value || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const expectedEnd = targetSegment.actual_end_time || targetSegment.end_time;
        if (!expectedEnd) {
             return new Response(JSON.stringify({ error: 'Segment has no end time defined' }), { status: 400 });
        }

        offset = getDiffMinutes(expectedEnd, currentHHMM);
        
        await base44.asServiceRole.entities.Segment.update(targetSegment.id, {
          actual_end_time: currentHHMM,
          is_live_adjusted: true,
          actual_start_time: targetSegment.actual_start_time || targetSegment.start_time
        });

      } else if (action === 'adjust_start') {
        offset = parseInt(value, 10);
        
        const newStart = addMinutes(targetSegment.actual_start_time || targetSegment.start_time, offset);
        const newEnd = addMinutes(targetSegment.actual_end_time || targetSegment.end_time, offset);
        
        await base44.asServiceRole.entities.Segment.update(targetSegment.id, {
          actual_start_time: newStart,
          actual_end_time: newEnd,
          is_live_adjusted: true
        });
      }

      // 3. Propagate to subsequent segments (legacy cascade behavior)
      const updates = [];
      for (let i = targetIndex + 1; i < segments.length; i++) {
        const seg = segments[i];
        const newStart = addMinutes(seg.actual_start_time || seg.start_time, offset);
        const newEnd = addMinutes(seg.actual_end_time || seg.end_time, offset);
        
        updates.push(base44.asServiceRole.entities.Segment.update(seg.id, {
          actual_start_time: newStart,
          actual_end_time: newEnd,
          is_live_adjusted: true
        }));
      }

      await Promise.all(updates);
      
      await base44.asServiceRole.entities.Session.update(sessionId, {
        last_live_adjustment_time: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true, offset }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});