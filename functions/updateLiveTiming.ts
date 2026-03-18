import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Unified live timing adjustment function
 * Supports weekly (time_slot), custom (global), and event (session) adjustments
 * 
 * Payload:
 * {
 *   adjustmentType: "time_slot" | "global" | "session",
 *   target: { serviceId?, timeSlot?, eventId?, sessionId? },
 *   offsetMinutes: number,
 *   date: "YYYY-MM-DD"
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Permission check: require admin role or 'manage_live_timing' permission
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const hasManagePermission = Array.isArray(user.custom_permissions) && user.custom_permissions.includes('manage_live_timing');
    const isAdmin = user.role === 'admin';
    if (!isAdmin && !hasManagePermission) {
      return Response.json({ error: 'Forbidden: manage_live_timing required' }, { status: 403 });
    }
    
    const { adjustmentType, target, offsetMinutes, date } = await req.json();
    
    // Validate inputs
    if (!['time_slot', 'global', 'session'].includes(adjustmentType)) {
      return Response.json({ error: 'Invalid adjustmentType' }, { status: 400 });
    }
    
    if (typeof offsetMinutes !== 'number') {
      return Response.json({ error: 'offsetMinutes must be a number' }, { status: 400 });
    }
    
    if (!date) {
      return Response.json({ error: 'date is required' }, { status: 400 });
    }
    
    // Build adjustment record
    const adjustmentData = {
      date,
      adjustment_type: adjustmentType,
      offset_minutes: offsetMinutes,
      authorized_by: user.email,
    };
    
    // Add type-specific fields and validate
    if (adjustmentType === 'time_slot') {
      if (!target.serviceId || !target.timeSlot) {
        return Response.json({ error: 'time_slot adjustment requires serviceId and timeSlot' }, { status: 400 });
      }
      adjustmentData.service_id = target.serviceId;
      adjustmentData.time_slot = target.timeSlot;
    } else if (adjustmentType === 'global') {
      if (!target.serviceId) {
        return Response.json({ error: 'global adjustment requires serviceId' }, { status: 400 });
      }
      adjustmentData.service_id = target.serviceId;
    } else if (adjustmentType === 'session') {
      if (!target.eventId || !target.sessionId) {
        return Response.json({ error: 'session adjustment requires eventId and sessionId' }, { status: 400 });
      }
      adjustmentData.event_id = target.eventId;
      adjustmentData.session_id = target.sessionId;
    }
    
    // Check if adjustment already exists (update) or create new
    const filterQuery = {
      date,
      adjustment_type: adjustmentType,
    };
    
    if (adjustmentData.service_id) {
      filterQuery.service_id = adjustmentData.service_id;
    }
    if (adjustmentData.time_slot) {
      filterQuery.time_slot = adjustmentData.time_slot;
    }
    if (adjustmentData.session_id) {
      filterQuery.session_id = adjustmentData.session_id;
    }
    
    const existing = await base44.asServiceRole.entities.LiveTimeAdjustment.filter(filterQuery);
    
    if (existing.length > 0) {
      // Update existing adjustment
      await base44.asServiceRole.entities.LiveTimeAdjustment.update(
        existing[0].id, 
        { offset_minutes: offsetMinutes, authorized_by: user.email }
      );
      
      // Explicit cache refresh for immediate UI updates across displays
      try {
        await base44.asServiceRole.functions.invoke('refreshActiveProgram', {
          trigger: 'live_timing_adjustment_update',
          changedEntityType: 'LiveTimeAdjustment',
          changedEntityId: existing[0].id
        });
      } catch (cacheErr) {
        console.error('[updateLiveTiming] Cache refresh failed:', cacheErr.message);
      }

      return Response.json({ 
        success: true, 
        action: 'updated',
        adjustmentId: existing[0].id 
      });
    } else {
      // Create new adjustment
      const created = await base44.asServiceRole.entities.LiveTimeAdjustment.create(adjustmentData);
      
      // Explicit cache refresh for immediate UI updates across displays
      try {
        await base44.asServiceRole.functions.invoke('refreshActiveProgram', {
          trigger: 'live_timing_adjustment_create',
          changedEntityType: 'LiveTimeAdjustment',
          changedEntityId: created.id
        });
      } catch (cacheErr) {
        console.error('[updateLiveTiming] Cache refresh failed:', cacheErr.message);
      }

      return Response.json({ 
        success: true, 
        action: 'created',
        adjustmentId: created.id 
      });
    }
    
  } catch (error) {
    console.error('Live timing update error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});