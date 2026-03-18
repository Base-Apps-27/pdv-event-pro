import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// One-time audit function: Scans all active services for ghost "Enviar texto" actions
// on Ofrendas segments. The blueprint has actions:[] for Ofrendas, so any action there
// is a ghost that was added manually and never cleaned up.
// Admin-only.

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { dryRun = true } = await req.json();

        // Fetch all non-blueprint, non-archived services
        const allServices = await base44.asServiceRole.entities.Service.list('-date', 200);
        const targetServices = allServices.filter(s => s.status !== 'blueprint');

        const findings = [];
        const fixed = [];

        for (const service of targetServices) {
            const timeSlots = ['9:30am', '11:30am'];
            let needsUpdate = false;
            const updates = {};

            for (const slot of timeSlots) {
                const segments = service[slot];
                if (!Array.isArray(segments)) continue;

                let slotModified = false;
                const cleanedSegments = segments.map((seg, idx) => {
                    // Check Ofrendas segments for ghost actions
                    if (seg.type === 'offering' && Array.isArray(seg.actions) && seg.actions.length > 0) {
                        // Any action on Ofrendas is a ghost (blueprint has actions:[])
                        const ghostActions = seg.actions.map(a => a.label);
                        findings.push({
                            serviceId: service.id,
                            serviceName: service.name,
                            date: service.date,
                            status: service.status,
                            timeSlot: slot,
                            segmentIdx: idx,
                            segmentTitle: seg.title,
                            ghostActions: ghostActions
                        });
                        slotModified = true;
                        return { ...seg, actions: [] };
                    }
                    return seg;
                });

                if (slotModified) {
                    needsUpdate = true;
                    updates[slot] = cleanedSegments;
                }
            }

            // Also check custom service segments array
            if (Array.isArray(service.segments)) {
                let customModified = false;
                const cleanedCustom = service.segments.map((seg, idx) => {
                    if (seg.type === 'offering' && Array.isArray(seg.actions) && seg.actions.length > 0) {
                        const ghostActions = seg.actions.map(a => a.label);
                        findings.push({
                            serviceId: service.id,
                            serviceName: service.name,
                            date: service.date,
                            status: service.status,
                            timeSlot: 'segments',
                            segmentIdx: idx,
                            segmentTitle: seg.title,
                            ghostActions: ghostActions
                        });
                        customModified = true;
                        return { ...seg, actions: [] };
                    }
                    return seg;
                });
                if (customModified) {
                    needsUpdate = true;
                    updates.segments = cleanedCustom;
                }
            }

            if (needsUpdate && !dryRun) {
                await base44.asServiceRole.entities.Service.update(service.id, updates);
                fixed.push(service.id);
            }
        }

        return Response.json({
            scanned: targetServices.length,
            findingsCount: findings.length,
            findings,
            dryRun,
            fixedIds: fixed,
            fixedCount: fixed.length
        });

    } catch (error) {
        console.error("[AUDIT_ERROR]", error.message);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
});