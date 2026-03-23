/**
 * getWeeklyFormData.js
 * 
 * JSON data endpoint for the React-based Weekly Service Submission form.
 * Auth: None required (public form). Uses asServiceRole for reads.
 * 
 * REFACTOR (2026-03-03): Entity-only path, no JSON fallback.
 * Minimized API calls to prevent CPU timeout:
 *   1. Fetch ServiceSchedules (1 call)
 *   2. Fetch only upcoming weekly services by day_of_week (1 call per schedule)
 *   3. Fetch sessions for matched service (1 call)
 *   4. Fetch segments for each session (N calls, typically 2)
 * 
 * Returns:
 * - serviceGroups: array of { label, date, serviceId, options, sessionNames }
 * - siblingMap: { compositeId: [{ id, label }] }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const base44 = createClientFromRequest(req);

        // SEC-1: In-memory rate limiting (resets on cold start).
        const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
        if (!globalThis._weeklyDataRL) globalThis._weeklyDataRL = new Map();
        const rlNow = Date.now();
        const rlAttempts = (globalThis._weeklyDataRL.get(clientIp) || []).filter(t => rlNow - t < 60000);
        if (rlAttempts.length >= 15) {
            return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
        }
        rlAttempts.push(rlNow);
        globalThis._weeklyDataRL.set(clientIp, rlAttempts);

        // ET-aware date window (today → 14 days ahead)
        const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const todayETStr = `${nowET.getFullYear()}-${String(nowET.getMonth() + 1).padStart(2, '0')}-${String(nowET.getDate()).padStart(2, '0')}`;
        const weekAhead = new Date(nowET);
        weekAhead.setDate(weekAhead.getDate() + 14);
        const weekAheadStr = weekAhead.toISOString().split('T')[0];

        // Step 1: Get active schedules
        let schedules = [];
        try {
            schedules = await base44.asServiceRole.entities.ServiceSchedule.filter({ is_active: true });
        } catch (e) {
            console.warn("[getWeeklyFormData] ServiceSchedule fetch failed:", e.message);
        }

        const PLENARIA_TYPES = ['plenaria', 'message', 'predica', 'mensaje'];
        const serviceGroups = [];
        const processedServiceIds = new Set();

        // Step 2: For each schedule, find matching upcoming service by day_of_week
        // This is much cheaper than fetching ALL active services (which transfers huge JSON payloads).
        for (const schedule of schedules) {
            let dayServices = [];
            try {
                dayServices = await base44.asServiceRole.entities.Service.filter(
                    { day_of_week: schedule.day_of_week, status: 'active' }, '-date', 10
                );
            } catch (e) {
                console.warn(`[getWeeklyFormData] Service fetch for ${schedule.day_of_week} failed:`, e.message);
                continue;
            }

            // Filter to upcoming window, sort ascending to pick nearest
            const upcoming = dayServices
                .filter(s => s.date >= todayETStr && s.date <= weekAheadStr && !processedServiceIds.has(s.id))
                .sort((a, b) => a.date.localeCompare(b.date));

            if (upcoming.length === 0) continue;
            const service = upcoming[0];
            processedServiceIds.add(service.id);

            // Step 3: Fetch sessions for this service
            const group = await buildServiceGroup(base44, service, PLENARIA_TYPES);
            if (group && group.options.length > 0) serviceGroups.push(group);
        }

        // Build sibling map
        const siblingMap = {};
        for (const group of serviceGroups) {
            if (group.options.length > 1) {
                for (const opt of group.options) {
                    siblingMap[opt.id] = group.options
                        .filter(o => o.id !== opt.id)
                        .map(o => ({ id: o.id, label: o.sessionLabel || o.label }));
                }
            }
        }

        return Response.json({
            serviceGroups,
            siblingMap,
            error: serviceGroups.length === 0 ? "No se encontraron servicios programados próximamente." : null
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('getWeeklyFormData error:', error);
        return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
});

/**
 * Build a service group from Session + Segment entities only.
 * No JSON fallback — entity-exclusive (2026-03-03).
 */
async function buildServiceGroup(base44, service, PLENARIA_TYPES) {
    const svcDate = new Date(service.date + 'T12:00:00');
    const formattedDate = svcDate.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'numeric', year: '2-digit'
    });
    const label = `${service.name || service.day_of_week} — ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}`;

    // Fetch sessions
    let sessions = [];
    try {
        sessions = await base44.asServiceRole.entities.Session.filter({ service_id: service.id });
    } catch (e) {
        console.warn(`[getWeeklyFormData] Session fetch failed for service ${service.id}:`, e.message);
        return null;
    }

    if (sessions.length === 0) return null;

    // Fetch segments for all sessions in parallel
    const segmentsBySession = {};
    await Promise.all(
        sessions.map(session =>
            base44.asServiceRole.entities.Segment.filter({ session_id: session.id }, 'order')
                .then(segs => { segmentsBySession[session.id] = segs; })
                .catch(e => {
                    console.warn(`[getWeeklyFormData] Segment fetch failed for session ${session.id}:`, e.message);
                    segmentsBySession[session.id] = [];
                })
        )
    );

    const options = [];
    const sessionNames = [];

    for (const session of sessions.sort((a, b) => (a.order || 0) - (b.order || 0))) {
        const segments = segmentsBySession[session.id] || [];
        segments.forEach((seg, idx) => {
            const type = (seg.segment_type || "").toLowerCase();
            if (PLENARIA_TYPES.includes(type)) {
                const compositeId = `weekly_service|${service.id}|${session.name}|${idx}|message`;
                const presenter = seg.presenter || "Sin asignar";
                options.push({
                    id: compositeId,
                    label: `${session.name} - ${presenter}`,
                    sessionLabel: session.name,
                    title: seg.message_title || "",
                    serviceId: service.id,
                });
                if (!sessionNames.includes(session.name)) sessionNames.push(session.name);
            }
        });
    }

    if (options.length === 0) return null;
    return { label, date: service.date, serviceId: service.id, options, sessionNames };
}