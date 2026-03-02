/**
 * getWeeklyFormData.js
 * 
 * JSON data endpoint for the React-based Weekly Service Submission form.
 * Replaces the SSR data-fetching portion of serveWeeklyServiceSubmission.
 * 
 * CSP Migration (2026-02-27): Platform CDN injects restrictive CSP
 * that blocks inline scripts in function-served HTML. Moving form
 * rendering to React pages bypasses CDN-level CSP.
 * 
 * Auth: None required (public form). Uses asServiceRole for reads.
 * 
 * Returns:
 * - serviceGroups: array of { label, date, serviceId, options, sessionNames }
 * - siblingMap: { compositeId: [{ id, label }] }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        // SEC-1 (2026-03-02): Dual-layer rate limiting for data endpoints.
        // Layer 1: In-memory (fast, resets on cold start).
        const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
        if (!globalThis._weeklyDataRL) globalThis._weeklyDataRL = new Map();
        const rlNow = Date.now();
        const rlAttempts = (globalThis._weeklyDataRL.get(clientIp) || []).filter(t => rlNow - t < 60000);
        if (rlAttempts.length >= 15) {
            return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
        }
        rlAttempts.push(rlNow);
        globalThis._weeklyDataRL.set(clientIp, rlAttempts);

        // Layer 2: Entity-based persistent rate limit (SEC-1 P1, 2026-03-02).
        const twoMinAgo = new Date(Date.now() - 120000).toISOString();
        const recentDataReqs = await base44.asServiceRole.entities.PublicFormIdempotency.filter(
            { form_type: 'weekly_data_read', site_id: clientIp, created_date: { $gte: twoMinAgo } },
            '-created_date', 30
        );
        if (recentDataReqs.length >= 20) {
            return Response.json({ error: 'Too many requests' }, { status: 429, headers: corsHeaders });
        }
        await base44.asServiceRole.entities.PublicFormIdempotency.create({
            idempotency_key: `weekly_data_${clientIp}_${rlNow}`,
            form_type: 'weekly_data_read',
            site_id: clientIp,
            status: 'succeeded'
        });

        let serviceGroups = [];

        // Current date in ET
        const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const todayETStr = nowET.toISOString().split('T')[0];
        const weekAhead = new Date(nowET);
        weekAhead.setDate(weekAhead.getDate() + 14);
        const weekAheadStr = weekAhead.toISOString().split('T')[0];

        // Discover active ServiceSchedules
        let schedules = [];
        try {
            schedules = await base44.asServiceRole.entities.ServiceSchedule.filter({ is_active: true });
        } catch (e) {
            console.warn("[getWeeklyFormData] Could not fetch ServiceSchedule:", e.message);
        }

        // Fetch upcoming services
        const allActiveServices = await base44.asServiceRole.entities.Service.filter(
            { status: 'active' }, 'date', 50
        );
        const upcomingServices = allActiveServices.filter(s => s.date >= todayETStr && s.date <= weekAheadStr);

        const processedServiceIds = new Set();

        // For each schedule, find next matching service
        for (const schedule of schedules) {
            const dayServices = upcomingServices.filter(s =>
                s.day_of_week === schedule.day_of_week && !processedServiceIds.has(s.id)
            );
            if (dayServices.length === 0) continue;
            const service = dayServices[0];
            processedServiceIds.add(service.id);
            const group = await buildServiceGroup(base44, service, schedule.sessions || []);
            if (group && group.options.length > 0) serviceGroups.push(group);
        }

        // One-off services not covered by schedules
        for (const service of upcomingServices) {
            if (processedServiceIds.has(service.id)) continue;
            if (service.status === 'blueprint') continue;
            processedServiceIds.add(service.id);
            const group = await buildServiceGroup(base44, service, []);
            if (group && group.options.length > 0) serviceGroups.push(group);
        }

        // Legacy fallback: Sunday services
        if (serviceGroups.length === 0) {
            const sundayServices = await base44.asServiceRole.entities.Service.filter(
                { day_of_week: 'Sunday', status: 'active' }, 'date', 10
            );
            const validSunday = sundayServices.filter(s => s.date >= todayETStr);
            if (validSunday.length > 0) {
                const group = await buildServiceGroup(base44, validSunday[0], []);
                if (group && group.options.length > 0) serviceGroups.push(group);
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

/**
 * Build a service group (options list) for a single Service record.
 * Tries Entity path first (Sessions + Segments), falls back to JSON-on-Service.
 * Mirrors the logic from serveWeeklyServiceSubmission exactly.
 */
async function buildServiceGroup(base44, service, scheduleSessions) {
    const svcDate = new Date(service.date + 'T12:00:00');
    const formattedDate = svcDate.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'numeric', year: '2-digit'
    });
    const label = `${service.name || service.day_of_week} — ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}`;

    const options = [];
    const sessionNames = [];
    const PLENARIA_TYPES = ['plenaria', 'message', 'predica', 'mensaje'];

    // Entity path: Sessions + Segments
    try {
        const sessions = await base44.asServiceRole.entities.Session.filter({ service_id: service.id });
        if (sessions.length > 0) {
            for (const session of sessions.sort((a, b) => (a.order || 0) - (b.order || 0))) {
                const segments = await base44.asServiceRole.entities.Segment.filter({ session_id: session.id }, 'order');
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
            if (options.length > 0) return { label, date: service.date, serviceId: service.id, options, sessionNames };
        }
    } catch (e) {
        console.warn("[getWeeklyFormData] Entity path failed:", e.message);
    }

    // JSON fallback: discover slot keys dynamically
    const knownSlotNames = scheduleSessions.map(s => s.name);
    const allKeys = Object.keys(service);
    const slotKeys = [];

    for (const key of allKeys) {
        if (knownSlotNames.includes(key)) {
            slotKeys.push(key);
        } else if (
            Array.isArray(service[key]) &&
            service[key].length > 0 &&
            typeof service[key][0] === 'object' &&
            service[key][0] !== null &&
            ('type' in service[key][0] || 'title' in service[key][0])
        ) {
            const skipKeys = ['segments', 'selected_announcements'];
            if (!skipKeys.includes(key)) slotKeys.push(key);
        }
    }

    for (const slot of slotKeys) {
        if (!Array.isArray(service[slot])) continue;
        service[slot].forEach((seg, idx) => {
            const type = (seg.type || "").toLowerCase();
            if (PLENARIA_TYPES.includes(type)) {
                const compositeId = `weekly_service|${service.id}|${slot}|${idx}|message`;
                const presenter = seg.data?.preacher || seg.data?.presenter || seg.data?.leader || "Sin asignar";
                options.push({
                    id: compositeId,
                    label: `${slot} - ${presenter}`,
                    sessionLabel: slot,
                    title: seg.message_title || seg.data?.message_title || seg.data?.title || "",
                    serviceId: service.id,
                });
                if (!sessionNames.includes(slot)) sessionNames.push(slot);
            }
        });
    }

    if (options.length > 0) return { label, date: service.date, serviceId: service.id, options, sessionNames };
    return null;
}