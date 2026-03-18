import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Admin-only diagnostic to compare legacy actions vs segment_actions in weekly Service records
// Non-destructive: reads Services and reports where legacy actions override or differ
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch services (production); include both active and blueprint states
    const services = await base44.asServiceRole.entities.Service.list();

    const normalizeSet = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.map((a) => ({
        label: (a?.label ?? '').trim(),
        department: (a?.department ?? '').trim(),
        timing: (a?.timing ?? '').trim(),
      }));
    };

    const compareSets = (a, b) => {
      const toKey = (x) => `${x.department}|${x.timing}|${x.label}`.toLowerCase();
      const setA = new Set(a.map(toKey));
      const setB = new Set(b.map(toKey));
      if (setA.size !== setB.size) return true;
      for (const k of setA) if (!setB.has(k)) return true;
      return false;
    };

    const report = {
      scannedServices: services.length,
      legacyOnlyCount: 0,
      bothButDifferentCount: 0,
      items: [],
    };

    const pushItem = (svc, timeSlot, seg, kind, legacyArr, modernArr) => {
      report.items.push({
        service_id: svc.id,
        service_name: svc.name,
        status: svc.status,
        time_slot: timeSlot,
        segment_title: seg.title || seg.data?.title || '(sin título)',
        segment_type: seg.segment_type || seg.type || seg.data?.type || '',
        kind, // 'legacy_only' | 'both_different'
        legacy_count: Array.isArray(legacyArr) ? legacyArr.length : 0,
        modern_count: Array.isArray(modernArr) ? modernArr.length : 0,
        sample_legacy: normalizeSet(legacyArr).slice(0, 3),
        sample_modern: normalizeSet(modernArr).slice(0, 3),
      });
    };

    const scanSegments = (svc, timeSlot, segments = []) => {
      for (const seg of segments) {
        const legacy = seg.actions || seg.data?.actions || [];
        const modern = seg.segment_actions || seg.data?.segment_actions || [];
        if (Array.isArray(legacy) && legacy.length > 0 && (!Array.isArray(modern) || modern.length === 0)) {
          report.legacyOnlyCount += 1;
          pushItem(svc, timeSlot, seg, 'legacy_only', legacy, modern);
        } else if (Array.isArray(legacy) && Array.isArray(modern) && legacy.length > 0 && modern.length > 0) {
          const diff = compareSets(normalizeSet(legacy), normalizeSet(modern));
          if (diff) {
            report.bothButDifferentCount += 1;
            pushItem(svc, timeSlot, seg, 'both_different', legacy, modern);
          }
        }
      }
    };

    for (const svc of services) {
      // Only weekly service-like structures
      if (Array.isArray(svc['9:30am'])) scanSegments(svc, '9:30am', svc['9:30am']);
      if (Array.isArray(svc['11:30am'])) scanSegments(svc, '11:30am', svc['11:30am']);
      // Also scan custom service segments if present
      if (Array.isArray(svc.segments)) scanSegments(svc, 'custom', svc.segments);
    }

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});