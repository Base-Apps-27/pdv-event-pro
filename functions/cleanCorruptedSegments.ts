import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default async function handler(req) {
  const base44 = createClientFromRequest(req);
  
  try {
    const services = await base44.entities.Service.list(100); // Fetch recent services
    const updates = [];
    const log = [];

    for (const service of services) {
      let isDirty = false;
      const updatesForService = {};

      for (const timeSlot of ['9:30am', '11:30am']) {
        if (!service[timeSlot] || !Array.isArray(service[timeSlot])) continue;

        const originalSegments = service[timeSlot];
        const cleanedSegments = originalSegments.map(seg => {
          // Check for Special segments
          const isSpecial = ['special', 'Special', 'Especial'].includes(seg.type) || 
                            ['special', 'Special', 'Especial'].includes(seg.segment_type);

          if (isSpecial && seg.actions && Array.isArray(seg.actions)) {
            const originalActionCount = seg.actions.length;
            
            // Filter out the specific corrupted actions from Blueprint merging
            const cleanActions = seg.actions.filter(action => {
              const label = (action.label || '').toLowerCase();
              return !label.includes('pianista sube') && !label.includes('equipo de a&a sube');
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
        // Perform update
        await base44.entities.Service.update(service.id, updatesForService);
        updates.push({
          id: service.id,
          name: service.name,
          date: service.date
        });
        log.push(`Cleaned service: ${service.name} (${service.date})`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      cleaned_count: updates.length,
      details: log
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
}