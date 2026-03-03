/**
 * getWeeklyFormData.js
 * 
 * JSON data endpoint for the React-based Weekly Service Submission form.
 * 
 * CSP Migration (2026-02-27): Platform CDN injects restrictive CSP
 * that blocks inline scripts in function-served HTML. Moving form
 * rendering to React pages bypasses CDN-level CSP.
 * 
 * Auth: None required (public form). Uses asServiceRole for reads.
 * 
 * REFACTOR (2026-03-03): Stripped JSON fallback entirely — entity-only.
 * Reduced API calls by fetching sessions & segments in bulk.
 * Fixed sort direction bug that starved future services from results.
 * Removed Layer 2 rate limiting that caused unnecessary DB writes.
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

        // SEC-1: In-memory rate limiting (resets on cold start, sufficient for read endpoint).
        const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
        if (!globalThis._weeklyDataRL) globalThis._weeklyDataRL = new Map();
        const rlNow = Date.now();
        const rlAttempts = (globalThis._weeklyDataRL.get(clientIp) || []).filter(t => rlNow - t < 60000);
        if (rlAttempts.length >= 15) {
            return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
        }
        rlAttempts.push(rlNow);
        globalThis._weeklyDataRL.set(clientIp, rlAttempts);

        // DEV-4 (2026-03-02): ET-aware date to avoid UTC midnight drift.
        const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const yy = nowET.getFullYear();
        const mm = String(nowET.getMonth() + 1).padStart(2, '0');
        const dd = String(nowET.getDate()).padStart(2, '0');
        const todayETStr = `${yy}-${mm}-${dd}`;
        const weekAhead = new Date(nowET);
        weekAhead.setDate(weekAhead.getDate() + 14);
        const weekAheadStr = weekAhead.toISOString().split('T')[0];

        // FIX (2026-03-03): Sort descending so newest services come first,
        // preventing old active services from consuming the 50-record limit.
        const allActiveServices = await base44.asServiceRole.entities.Service.filter(
            { status: 'active' }, '-date', 50
        );
        const upcomingServices = allActiveServices.filter(s => s.date >= todayETStr && s.date <= weekAheadStr);

        // Discover active ServiceSchedules
        let schedules = [];
        try {
            schedules = await base44.asServiceRole.entities.ServiceSchedule.filter({ is_active: true });
        } catch (e) {
            console.warn("[getWeeklyFormData] Could not fetch ServiceSchedule:", e.message);
        }

        // Collect the target services — schedule-matched first, then one-offs
        const processedServiceIds = new Set();
        const targetServices = [];

        for (const schedule of schedules) {
            const dayServices = upcomingServices.filter(s =>
                s.day_of_week === schedule.day_of_week && !processedServiceIds.has(s.id)
            );
            if (dayServices.length === 0) continue;
            // Sort ascending within the window so nearest Sunday is picked first
            dayServices.sort((a, b) => a.date.localeCompare(b.date));
            const service = dayServices[0];
            processedServiceIds.add(service.id);
            targetServices.push(service);
        }

        for (const service of upcomingServices) {
            if (processedServiceIds.has(service.id)) continue;
            if (service.status === 'blueprint') continue;
            processedServiceIds.add(service.id);
            targetServices.push(service);
        }

        if (targetServices.length === 0) {
            return Response.json({
                serviceGroups: [],
                siblingMap: {},
                error: "No se encontraron servicios programados próximamente."
            }, { headers: corsHeaders });
        }

        // BULK fetch: all sessions for target services in ONE call
        // (Platform filter supports $in-style via multiple calls, but we can
        //  fetch per-service since targetServices is small — typically 1-2.)
        const allSessions = [];
        const sessionFetches = targetServices.map(s =>
            base44.asServiceRole.entities.Session.filter({ service_id: s.id })
                .then(sessions => { allSessions.push(...sessions); })
                .catch(e => console.warn(`[getWeeklyFormData] Sessions fetch failed for ${s.id}:`, e.message))
        );
        await Promise.all(sessionFetches);

        if (allSessions.length === 0) {
            return Response.json({
                serviceGroups: [],
                siblingMap: {},
                error: "No se encontraron sesiones para los servicios próximos."
            }, { headers: corsHeaders });
        }

        // BULK fetch: all segments for all sessions in parallel
        const segmentsBySessionId = {};
        const segmentFetches = allSessions.map(session =>
            base44.asServiceRole.entities.Segment.filter({ session_id: session.id }, 'order')
                .then(segments => { segmentsBySessionId[session.id] = segments; })
                .catch(e => {
                    console.warn(`[getWeeklyFormData] Segments fetch failed for session ${session.id}:`, e.message);
                    segmentsBySessionId[session.id] = [];
                })
        );
        await Promise.all(segmentFetches);

        // Build service groups from entity data only (no JSON fallback)
        const PLENARIA_TYPES = ['plenaria', 'message', 'predica', 'mensaje'];
        const serviceGroups = [];

        for (const service of targetServices) {
            const svcDate = new Date(service.date + 'T12:00:00');
            const formattedDate = svcDate.toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'numeric', year: '2-digit'
            });
            const label = `${service.name || service.day_of_week} — ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}`;

            const options = [];
            const sessionNames = [];

            const serviceSessions = allSessions
                .filter(s => s.service_id === service.id)
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            for (const session of serviceSessions) {
                const segments = segmentsBySessionId[session.id] || [];
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

            if (options.length > 0) {
                serviceGroups.push({ label, date: service.date, serviceId: service.id, options, sessionNames });
            }
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