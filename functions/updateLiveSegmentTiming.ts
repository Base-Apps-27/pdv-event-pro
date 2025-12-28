import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  }

  const base44 = createClientFromRequest(req);
  const { sessionId, segmentId, action, value } = await req.json();

  try {
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Permission check
    // Need to verify 'manage_live_timing' or admin role. 
    // Since hasPermission is frontend util, we check roles directly or assume caller handles it? 
    // Best practice: backend check.
    // Assuming user permissions are available on user object or we fetch them.
    // For simplicity, we'll check role 'LiveManager' or 'Admin' or explicit permission if stored.
    // Base44 user object has `app_role` and `custom_permissions`.
    const role = user.app_role || 'EventDayViewer';
    const permissions = user.custom_permissions || [];
    const isLiveManager = role === 'Admin' || role === 'LiveManager' || permissions.includes('manage_live_timing');

    if (!isLiveManager) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
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
        // value is current time HH:MM (or calculated based on server time if not provided)
        const now = new Date();
        const currentHHMM = value || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        // Calculate offset based on expected end time
        // Priority: existing actual_end_time > end_time
        const expectedEnd = targetSegment.actual_end_time || targetSegment.end_time;
        if (!expectedEnd) {
             // Fallback if no end time defined (rare)
             return new Response(JSON.stringify({ error: 'Segment has no end time defined' }), { status: 400 });
        }

        offset = getDiffMinutes(expectedEnd, currentHHMM);
        
        // Update target segment
        await base44.asServiceRole.entities.Segment.update(targetSegment.id, {
          actual_end_time: currentHHMM,
          is_live_adjusted: true,
          // If we mark it ended, we might want to retroactively set start if null? 
          // For now, assume start was 'on time' or previously adjusted.
          actual_start_time: targetSegment.actual_start_time || targetSegment.start_time
        });

      } else if (action === 'adjust_start') {
        // value is offset in minutes (e.g. 5 for late start)
        offset = parseInt(value, 10);
        
        // Apply to target
        const newStart = addMinutes(targetSegment.actual_start_time || targetSegment.start_time, offset);
        const newEnd = addMinutes(targetSegment.actual_end_time || targetSegment.end_time, offset);
        
        await base44.asServiceRole.entities.Segment.update(targetSegment.id, {
          actual_start_time: newStart,
          actual_end_time: newEnd,
          is_live_adjusted: true
        });
      }

      // 3. Propagate to subsequent segments
      // Only subsequent ones need shifting
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
      
      // Touch session to trigger refetches
      await base44.asServiceRole.entities.Session.update(sessionId, {
        last_live_adjustment_time: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true, offset }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};