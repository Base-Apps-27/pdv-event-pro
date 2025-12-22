import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const MAX_SESSION_IDS = 50;
const BATCH_SIZE = 10;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { sessionIds } = body;

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return Response.json({ segments: [] });
    }

    // Safety cap to prevent excessive queries
    if (sessionIds.length > MAX_SESSION_IDS) {
      return Response.json({ 
        error: `Too many sessions requested. Maximum ${MAX_SESSION_IDS} allowed.`,
        sessionCount: sessionIds.length 
      }, { status: 400 });
    }

    // Batch parallel queries to avoid overload (groups of 10)
    const batches = [];
    for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
      batches.push(sessionIds.slice(i, i + BATCH_SIZE));
    }

    const allResults = [];
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(sessionId => 
          base44.asServiceRole.entities.Segment.filter({ session_id: sessionId }, 'order')
        )
      );
      allResults.push(...batchResults.flat());
    }

    // Ensure deterministic ordering: by session_id, then by order
    const sessionIdOrder = sessionIds;
    const sorted = allResults.sort((a, b) => {
      const aIndex = sessionIdOrder.indexOf(a.session_id);
      const bIndex = sessionIdOrder.indexOf(b.session_id);
      if (aIndex !== bIndex) return aIndex - bIndex;
      return (a.order || 0) - (b.order || 0);
    });

    return Response.json({ segments: sorted });
  } catch (error) {
    console.error('[getSegmentsBySessionIds ERROR]', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return Response.json({ error: error.message }, { status: 500 });
  }
});