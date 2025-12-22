import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { sessionIds } = body;

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return Response.json({ segments: [] });
    }

    // Fetch all segments and filter by session IDs
    // This consolidates what was previously done client-side across multiple components
    const allSegments = await base44.asServiceRole.entities.Segment.list();
    const sessionIdSet = new Set(sessionIds);
    const filtered = allSegments.filter(seg => sessionIdSet.has(seg.session_id));
    
    // Sort by order for consistency
    const sorted = filtered.sort((a, b) => (a.order || 0) - (b.order || 0));

    return Response.json({ segments: sorted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});