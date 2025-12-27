import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const services = await base44.entities.Service.list(100);
    const updates = [];
    const logs = [];
    const inspection = []; // Log what we see in special segments

    for (const service of services) {
      let isDirty = false;
      const updatesForService = {};

      for (const timeSlot of ['9:30am', '11:30am']) {
        if (!service[timeSlot] || !Array.isArray(service[timeSlot])) continue;

        const originalSegments = service[timeSlot];
        const cleanedSegments = originalSegments.map(seg => {
          // Robust check for Special type
          const type = (seg.type || seg.segment_type || '').toLowerCase().trim();
          const isSpecial = type === 'special' || type === 'especial';

          if (isSpecial && seg.actions && Array.isArray(seg.actions) && seg.actions.length > 0) {
            
            // Log what we found for debugging
            inspection.push({
              service: service.name,
              slot: timeSlot,
              actions: seg.actions.map(a => a.label)
            });

            const originalActionCount = seg.actions.length;
            
            // BROADER FILTER:
            // The corruption comes from "Message" segment blueprint.
            // Typical Message actions: "Pianista sube...", "Equipo de A&A sube..."
            // We will filter based on broader keywords that shouldn't be auto-inherited.
            const cleanActions = seg.actions.filter(action => {
              const label = (action.label || '').toLowerCase();
              
              // Dangerous keywords that mark the corrupted blueprint actions
              const isPianist = label.includes('pianista');
              const isAA = label.includes('a&a') || label.includes('equipo de a&a');
              
              // If it matches these specific blueprint signatures, remove it
              return !(isPianist || isAA);
            });

            if (cleanActions.length !== originalActionCount) {
              isDirty = true;
              return { ...seg, actions: cleanActions };
            }
          }
          return seg;
        });

        if (isDirty) {
          updatesForService[timeSlot] = cleanedSegments;
        }
      }

      if (isDirty) {
        await base44.entities.Service.update(service.id, updatesForService);
        updates.push({ id: service.id, name: service.name });
        logs.push(`Cleaned ${service.name} (${service.date})`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      cleaned_count: updates.length,
      logs: logs,
      inspection_sample: inspection.slice(0, 10) // Show us what actions special segments have
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});