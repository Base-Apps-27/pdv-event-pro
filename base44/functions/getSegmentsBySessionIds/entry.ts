import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const MAX_SESSION_IDS = 50;
const BATCH_SIZE = 10;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { sessionIds: rawSessionIds } = body;

    if (!rawSessionIds || !Array.isArray(rawSessionIds)) {
      return Response.json({ segments: [] });
    }

    // Input normalization: filter to valid strings, deduplicate while preserving order
    const validIds = rawSessionIds.filter(id => id && typeof id === 'string' && id.trim().length > 0);
    const seen = new Set();
    const sessionIds = validIds.filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (sessionIds.length === 0) {
      return Response.json({ segments: [] });
    }

    // Safety cap applied after deduplication
    if (sessionIds.length > MAX_SESSION_IDS) {
      return Response.json({ 
        error: `Too many unique sessions requested. Maximum ${MAX_SESSION_IDS} allowed.`,
        sessionCount: sessionIds.length 
      }, { status: 400 });
    }

    // Build constant-time lookup map for sorting
    const orderMap = new Map(sessionIds.map((id, i) => [id, i]));

    // Batch parallel queries to avoid overload (groups of 10)
    const batches = [];
    for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
      batches.push(sessionIds.slice(i, i + BATCH_SIZE));
    }

    const allResults = [];
    const dataEnv = req.headers.get('x-data-env') || 'prod';
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(sessionId => 
          base44.asServiceRole.entities.Segment.filter({ session_id: sessionId }, 'order', undefined, undefined, dataEnv)
        )
      );
      allResults.push(...batchResults.flat());
    }

    // Deterministic ordering: by session order, then by start_time (HH:MM), then by order as tie-breaker
    const toMinutes = (t) => {
      if (!t || typeof t !== 'string') return Number.POSITIVE_INFINITY;
      const [h, m] = t.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return Number.POSITIVE_INFINITY;
      return h * 60 + m;
    };
    const sorted = allResults.sort((a, b) => {
      const aIndex = orderMap.has(a.session_id) ? orderMap.get(a.session_id) : Number.MAX_SAFE_INTEGER;
      const bIndex = orderMap.has(b.session_id) ? orderMap.get(b.session_id) : Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) return aIndex - bIndex;
      const tm = toMinutes(a.start_time) - toMinutes(b.start_time);
      if (tm !== 0) return tm;
      return (a.order || 0) - (b.order || 0);
    });

    console.log('[getSegmentsBySessionIds SUCCESS]', {
      sessionCount: sessionIds.length,
      batchCount: batches.length,
      segmentsReturned: sorted.length,
      timestamp: new Date().toISOString()
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