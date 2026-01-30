/**
 * Edit Action Logger - Utility for logging entity edits with undo support
 * 
 * This module provides functions to log create/update/delete actions on
 * Event, Session, Segment, EventDay, and PreSessionDetails entities.
 * 
 * Logs capture:
 * - Full previous state (for undo)
 * - Field-level changes (for display)
 * - User attribution
 * - Human-readable descriptions
 */

import { base44 } from "@/api/base44Client";

/**
 * Generate a human-readable description of changes
 */
function generateChangeDescription(entityType, actionType, fieldChanges, entityTitle) {
  const entityNames = {
    Event: 'Evento',
    Session: 'Sesión',
    Segment: 'Segmento',
    EventDay: 'Día del Evento',
    PreSessionDetails: 'Detalles Pre-Sesión'
  };
  
  const actionNames = {
    create: 'creó',
    update: 'actualizó',
    delete: 'eliminó',
    reorder: 'reordenó'
  };
  
  const entityName = entityNames[entityType] || entityType;
  const actionName = actionNames[actionType] || actionType;
  const title = entityTitle ? `"${entityTitle}"` : '';
  
  if (actionType === 'create') {
    return `Se ${actionName} ${entityName} ${title}`.trim();
  }
  
  if (actionType === 'delete') {
    return `Se ${actionName} ${entityName} ${title}`.trim();
  }
  
  if (actionType === 'update' && fieldChanges) {
    const changedFields = Object.keys(fieldChanges);
    if (changedFields.length === 1) {
      return `Se ${actionName} ${changedFields[0]} en ${entityName} ${title}`.trim();
    }
    if (changedFields.length <= 3) {
      return `Se ${actionName} ${changedFields.join(', ')} en ${entityName} ${title}`.trim();
    }
    return `Se ${actionName} ${changedFields.length} campos en ${entityName} ${title}`.trim();
  }
  
  if (actionType === 'reorder') {
    return `Se ${actionName} ${entityName} ${title}`.trim();
  }
  
  return `Se ${actionName} ${entityName} ${title}`.trim();
}

/**
 * Calculate field-level changes between two states
 */
function calculateFieldChanges(previousState, newState) {
  if (!previousState || !newState) return null;
  
  const changes = {};
  const allKeys = new Set([...Object.keys(previousState), ...Object.keys(newState)]);
  
  // Skip internal/system fields
  const skipFields = ['id', 'created_date', 'updated_date', 'created_by', 'field_origins'];
  
  for (const key of allKeys) {
    if (skipFields.includes(key)) continue;
    
    const oldVal = previousState[key];
    const newVal = newState[key];
    
    // Normalize values: treat undefined, null, empty strings, and empty arrays as equivalent
    const normalizeValue = (val) => {
      if (val === undefined || val === null) return null;
      if (val === '') return null;
      if (Array.isArray(val) && val.length === 0) return null;
      return val;
    };
    
    const normalizedOld = normalizeValue(oldVal);
    const normalizedNew = normalizeValue(newVal);
    
    // Deep comparison for objects/arrays
    const oldStr = JSON.stringify(normalizedOld);
    const newStr = JSON.stringify(normalizedNew);
    
    if (oldStr !== newStr) {
      changes[key] = {
        old_value: oldVal,
        new_value: newVal
      };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Log an entity creation
 */
export async function logCreate(entityType, newEntity, parentId = null, user = null) {
  try {
    const title = newEntity.title || newEntity.name || newEntity.description || '';
    
    // Get session context for segments
    const resolvedParentId = parentId || newEntity.session_id || null;
    
    console.log('[EditActionLog] Logging create for', entityType, newEntity.id);
    
    await base44.entities.EditActionLog.create({
      entity_type: entityType,
      entity_id: newEntity.id,
      parent_id: resolvedParentId,
      action_type: 'create',
      field_changes: null,
      previous_state: null,
      new_state: { ...newEntity },
      description: generateChangeDescription(entityType, 'create', null, title),
      user_email: user?.email || null,
      user_name: user?.full_name || null,
      undone: false
    });
  } catch (error) {
    console.error('Failed to log create action:', error);
    // Don't throw - logging should not block the main operation
  }
}

/**
 * Log an entity update
 */
export async function logUpdate(entityType, entityId, previousState, newState, parentId = null, user = null) {
  try {
    const fieldChanges = calculateFieldChanges(previousState, newState);
    
    // Don't log if nothing actually changed
    if (!fieldChanges) {
      console.log('[EditActionLog] No changes detected, skipping log for', entityType, entityId);
      return;
    }
    
    const title = newState.title || newState.name || previousState.title || previousState.name || '';
    
    // Get session context for segments
    const resolvedParentId = parentId || newState.session_id || previousState.session_id || null;
    
    console.log('[EditActionLog] Logging update for', entityType, entityId, 'with', Object.keys(fieldChanges).length, 'field changes');
    
    await base44.entities.EditActionLog.create({
      entity_type: entityType,
      entity_id: entityId,
      parent_id: resolvedParentId,
      action_type: 'update',
      field_changes: fieldChanges,
      previous_state: { ...previousState },
      new_state: { ...newState },
      description: generateChangeDescription(entityType, 'update', fieldChanges, title),
      user_email: user?.email || null,
      user_name: user?.full_name || null,
      undone: false
    });
  } catch (error) {
    console.error('Failed to log update action:', error);
  }
}

/**
 * Log an entity deletion
 */
export async function logDelete(entityType, deletedEntity, parentId = null, user = null) {
  try {
    const title = deletedEntity.title || deletedEntity.name || deletedEntity.description || '';
    
    // Get session context for segments
    const resolvedParentId = parentId || deletedEntity.session_id || null;
    
    console.log('[EditActionLog] Logging delete for', entityType, deletedEntity.id);
    
    await base44.entities.EditActionLog.create({
      entity_type: entityType,
      entity_id: deletedEntity.id,
      parent_id: resolvedParentId,
      action_type: 'delete',
      field_changes: null,
      previous_state: { ...deletedEntity },
      new_state: null,
      description: generateChangeDescription(entityType, 'delete', null, title),
      user_email: user?.email || null,
      user_name: user?.full_name || null,
      undone: false
    });
  } catch (error) {
    console.error('Failed to log delete action:', error);
  }
}

/**
 * Log a reorder action (e.g., segment reordering)
 */
export async function logReorder(entityType, entityId, previousOrder, newOrder, parentId = null, user = null, entityTitle = '') {
  try {
    await base44.entities.EditActionLog.create({
      entity_type: entityType,
      entity_id: entityId,
      parent_id: parentId,
      action_type: 'reorder',
      field_changes: {
        order: { old_value: previousOrder, new_value: newOrder }
      },
      previous_state: { order: previousOrder },
      new_state: { order: newOrder },
      description: generateChangeDescription(entityType, 'reorder', null, entityTitle),
      user_email: user?.email || null,
      user_name: user?.full_name || null,
      undone: false
    });
  } catch (error) {
    console.error('Failed to log reorder action:', error);
  }
}

/**
 * Get recent action logs for an entity or parent context
 * @param {string} entityType - Filter by entity type (optional)
 * @param {string} parentId - Filter by parent ID (e.g., session_id)
 * @param {number} limit - Max number of logs to return
 */
export async function getRecentLogs(entityType = null, parentId = null, limit = 50) {
  try {
    const filter = {};
    if (entityType) filter.entity_type = entityType;
    if (parentId) filter.parent_id = parentId;
    
    const logs = await base44.entities.EditActionLog.filter(filter, '-created_date', limit);
    return logs;
  } catch (error) {
    console.error('Failed to fetch action logs:', error);
    return [];
  }
}

/**
 * Get undoable logs (most recent non-undone actions, up to limit)
 * @param {string} parentId - Filter by parent context
 * @param {number} limit - Max undoable actions (default 2)
 */
export async function getUndoableLogs(parentId = null, limit = 2) {
  try {
    const filter = { undone: false };
    if (parentId) filter.parent_id = parentId;
    
    const logs = await base44.entities.EditActionLog.filter(filter, '-created_date', limit);
    return logs;
  } catch (error) {
    console.error('Failed to fetch undoable logs:', error);
    return [];
  }
}