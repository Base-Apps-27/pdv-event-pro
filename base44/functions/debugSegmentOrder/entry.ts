/**
 * debugSegmentOrder.js — Diagnostic tool to inspect segment ordering for a service.
 * Prints a compact summary of all segments grouped by session, showing:
 * - order value, title, type, parent/child status, and ID
 * 
 * 2026-04-12: Created for live debugging of segment reorder issue.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { serviceId } = await req.json();
    if (!serviceId) {
      return Response.json({ error: 'serviceId required' }, { status: 400 });
    }

    // Get all sessions and segments for this service
    const sessions = await base44.asServiceRole.entities.Session.filter({ service_id: serviceId });
    const segments = await base44.asServiceRole.entities.Segment.filter({ service_id: serviceId });

    const sessionMap = {};
    sessions
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach(s => {
        sessionMap[s.id] = {
          name: s.name,
          order: s.order,
          planned_start_time: s.planned_start_time,
          segments: []
        };
      });

    // Group segments by session
    for (const seg of segments) {
      const sid = seg.session_id;
      if (!sessionMap[sid]) {
        sessionMap[sid] = { name: 'ORPHAN', order: -1, segments: [] };
      }
      sessionMap[sid].segments.push({
        id: seg.id,
        order: seg.order,
        title: seg.title,
        type: seg.segment_type,
        is_child: !!seg.parent_segment_id,
        parent_id: seg.parent_segment_id || null,
        origin: seg.origin,
        presenter: seg.presenter || '',
        duration_min: seg.duration_min,
        updated_date: seg.updated_date,
      });
    }

    // Sort segments within each session
    for (const sid in sessionMap) {
      sessionMap[sid].segments.sort((a, b) => {
        // Parents first (by order), then children (by order within parent)
        if (a.is_child && !b.is_child) return 1;
        if (!a.is_child && b.is_child) return -1;
        return (a.order || 0) - (b.order || 0);
      });
    }

    // Build compact report
    const report = {};
    for (const sid in sessionMap) {
      const sess = sessionMap[sid];
      const parents = sess.segments.filter(s => !s.is_child);
      const children = sess.segments.filter(s => s.is_child);
      
      // Check for order issues
      const orderValues = parents.map(s => s.order);
      const hasDuplicates = new Set(orderValues).size !== orderValues.length;
      const hasGaps = parents.some((s, i) => s.order !== i + 1);
      
      report[sess.name] = {
        session_id: sid,
        planned_start: sess.planned_start_time,
        parent_count: parents.length,
        child_count: children.length,
        order_issues: {
          has_duplicate_orders: hasDuplicates,
          has_gaps: hasGaps,
          order_sequence: orderValues,
        },
        parents: parents.map(s => ({
          order: s.order,
          title: s.title,
          type: s.type,
          presenter: s.presenter,
          duration: s.duration_min,
          id: s.id,
          origin: s.origin,
          updated: s.updated_date,
        })),
        children: children.map(s => ({
          order: s.order,
          title: s.title,
          type: s.type,
          parent_id: s.parent_id,
          id: s.id,
        })),
      };
    }

    return Response.json({ 
      service_id: serviceId,
      total_segments: segments.length,
      total_sessions: sessions.length,
      report 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});