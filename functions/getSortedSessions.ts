import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Returns sessions sorted at the data source to ensure consistent ordering across all consumers
// Sort strategy (deterministic, non-destructive):
// 1) Primary: explicit session.order (ascending) when present
// 2) Secondary: date (YYYY-MM-DD asc)
// 3) Tertiary: planned_start_time (HH:MM asc)
// 4) Quaternary: name (localeCompare)
// If both eventId and serviceId are provided (or neither), returns 400.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { eventId, serviceId } = body || {};

    if ((!eventId && !serviceId) || (eventId && serviceId)) {
      return Response.json({ error: 'Provide exactly one of eventId or serviceId' }, { status: 400 });
    }

    // Auth is optional for read in this context; if required later, add checks

    let sessions = [];
    if (eventId) {
      sessions = await base44.asServiceRole.entities.Session.filter({ event_id: eventId });
    } else if (serviceId) {
      sessions = await base44.asServiceRole.entities.Session.filter({ service_id: serviceId });
    }

    // Defensive: ensure array
    sessions = Array.isArray(sessions) ? sessions : [];

    // DECISION-004 (ATT-015): Chronological sort as primary.
    // Previous sort used `order` as primary — but order field is unreliable
    // (can be duplicated, wrong, or stale). Chronological sort matches user
    // expectations and what EventDetail/SessionManager already display.
    // Sort: date → planned_start_time → order (tiebreaker) → name
    const sorted = sessions.sort((a, b) => {
      const ad = a?.date || '';
      const bd = b?.date || '';
      if (ad !== bd) {
        if (!ad) return 1;
        if (!bd) return -1;
        return ad.localeCompare(bd);
      }

      const at = a?.planned_start_time || '';
      const bt = b?.planned_start_time || '';
      if (at !== bt) {
        if (!at) return 1;
        if (!bt) return -1;
        return at.localeCompare(bt);
      }

      const ao = Number.isFinite(a?.order) ? a.order : Number.POSITIVE_INFINITY;
      const bo = Number.isFinite(b?.order) ? b.order : Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;

      const an = a?.name || '';
      const bn = b?.name || '';
      return an.localeCompare(bn);
    });

    return Response.json({ sessions: sorted });
  } catch (error) {
    console.error('[getSortedSessions ERROR]', { message: error.message, stack: error.stack });
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});