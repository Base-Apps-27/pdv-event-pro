/**
 * debugSegmentOrder.js — Diagnostic tool to inspect segment ordering for a service.
 * 2026-04-12: Created for live debugging of segment reorder issue.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { serviceId, sessionId } = await req.json();
    if (!serviceId) {
      return Response.json({ error: 'serviceId required' }, { status: 400 });
    }

    // Get segments — optionally filter by session
    const filter = { service_id: serviceId };
    if (sessionId) filter.session_id = sessionId;
    
    const segments = await base44.asServiceRole.entities.Segment.filter(filter);

    // Separate parents and children
    const parents = segments
      .filter(s => !s.parent_segment_id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const children = segments
      .filter(s => !!s.parent_segment_id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // Compact output — only essential fields
    const orderSeq = parents.map(s => s.order);
    const hasDupes = new Set(orderSeq).size !== orderSeq.length;
    const hasGaps = parents.some((s, i) => s.order !== i + 1);

    return Response.json({
      session_id: sessionId || 'all',
      total: segments.length,
      parent_count: parents.length,
      child_count: children.length,
      order_issues: { hasDupes, hasGaps, orderSeq },
      parents: parents.map(s => ({
        ord: s.order,
        title: s.title,
        type: s.segment_type,
        presenter: s.presenter || '',
        dur: s.duration_min,
        id: s.id,
        origin: s.origin,
        created: s.created_date,
        updated: s.updated_date,
        created_by: s.created_by,
      })),
      children: children.map(s => ({
        ord: s.order,
        title: s.title,
        type: s.segment_type,
        parent: s.parent_segment_id,
        id: s.id,
        created: s.created_date,
        updated: s.updated_date,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});