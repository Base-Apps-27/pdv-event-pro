import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Require authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Service role for cleanup
    const services = await base44.asServiceRole.entities.Service.list();
    
    // Filter to only date-specific services (exclude blueprints, templates, custom services)
    const dateServices = services.filter(s => 
      s.date && 
      s.status === 'active' && 
      s.origin !== 'blueprint'
    );
    
    // Group by date
    const byDate = {};
    for (const service of dateServices) {
      if (!byDate[service.date]) {
        byDate[service.date] = [];
      }
      byDate[service.date].push(service);
    }
    
    // Find duplicates (dates with multiple records)
    const duplicates = {};
    for (const [date, servicesForDate] of Object.entries(byDate)) {
      if (servicesForDate.length > 1) {
        // Sort by updated_date descending (newest first)
        servicesForDate.sort((a, b) => 
          new Date(b.updated_date) - new Date(a.updated_date)
        );
        
        duplicates[date] = {
          keep: servicesForDate[0],
          delete: servicesForDate.slice(1)
        };
      }
    }
    
    // Perform deletion
    const deletedIds = [];
    for (const [date, { keep, delete: toDelete }] of Object.entries(duplicates)) {
      for (const service of toDelete) {
        await base44.asServiceRole.entities.Service.delete(service.id);
        deletedIds.push({
          id: service.id,
          date: service.date,
          name: service.name,
          updated_date: service.updated_date
        });
      }
    }
    
    return Response.json({
      success: true,
      summary: {
        totalServicesScanned: dateServices.length,
        datesWithDuplicates: Object.keys(duplicates).length,
        recordsDeleted: deletedIds.length
      },
      deletedRecords: deletedIds,
      keptRecords: Object.entries(duplicates).map(([date, { keep }]) => ({
        id: keep.id,
        date: keep.date,
        name: keep.name,
        updated_date: keep.updated_date
      }))
    });
    
  } catch (error) {
    console.error('[CLEANUP ERROR]', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});