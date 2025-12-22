import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { sessionIds } = body;

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return Response.json({ segments: [] });
    }

    // Fetch segments efficiently using parallel filter queries
    // This is more efficient than fetching all segments globally
    const segmentResults = await Promise.all(
      sessionIds.map(sessionId => 
        base44.asServiceRole.entities.Segment.filter({ session_id: sessionId }, 'order')
      )
    );
    
    const sorted = segmentResults.flat();

    return Response.json({ segments: sorted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});