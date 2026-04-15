/**
 * Edit Action Logger - Utility for logging entity edits with undo support
 * 
 * This module provides functions to log create/update/delete actions on
 * Event, Session, Segment, EventDay, and PreSessionDetails entities.
 * 
 * Logs capture:
 * - Field-level changes with old_value/new_value (for display AND undo)
 * - User attribution (email + name)
 * - Human-readable descriptions
 * 
 * 2026-04-15 SNAPSHOT BLOAT FIX:
 * previous_state and new_state are no longer written on new entries.
 * For Segment (169 fields), each log was storing two full copies.
 * field_changes already captures old_value/new_value per changed field,
 * which is all that's needed for both display and undo.
 * Historical entries with snapshots are preserved (no deletion).
 */

import { base44 } from "@/api/base44Client";

/**
 * Generate a human-readable description of changes
 */
function generateChangeDescription(entityType, actionType, fieldChanges, entityTitle) {
  // UNIVERSAL LOG EXPANSION (2026-02-19): Added all new entity type labels.
  const entityNames = {
    Event: 'Evento',
    Session: 'Sesión',
    Segment: 'Segmento',
    EventDay: 'Día del Evento',
    PreSessionDetails: 'Detalles Pre-Sesión',
    Service: 'Servicio',
    ServiceSchedule: 'Horario Recurrente',
    StreamBlock: 'Bloque de Stream',
    AnnouncementItem: 'Anuncio',
    AnnouncementSeries: 'Serie de Anuncios',
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
    
    // 2026-04-15: No longer storing new_state snapshot (bloat fix)
    await base44.entities.EditActionLog.create({
      entity_type: entityType,
      entity_id: newEntity.id,
      parent_id: resolvedParentId,
      action_type: 'create',
      field_changes: null,
      previous_state: null,
      new_state: null,
      description: generateChangeDescription(entityType, 'create', null, title),
      user_email: user?.email || null,
      user_name: user?.display_name || user?.full_name || null,
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
    
    // 2026-04-15: No longer storing previous_state/new_state snapshots (bloat fix).
    // field_changes already captures old_value/new_value per field — sufficient for undo.
    await base44.entities.EditActionLog.create({
      entity_type: entityType,
      entity_id: entityId,
      parent_id: resolvedParentId,
      action_type: 'update',
      field_changes: fieldChanges,
      previous_state: null,
      new_state: null,
      description: generateChangeDescription(entityType, 'update', fieldChanges, title),
      user_email: user?.email || null,
      user_name: user?.display_name || user?.full_name || null,
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
    
    // 2026-04-15: No longer storing previous_state snapshot (bloat fix).
    // Delete undo recreates from field_changes or is not supported without snapshot.
    await base44.entities.EditActionLog.create({
      entity_type: entityType,
      entity_id: deletedEntity.id,
      parent_id: resolvedParentId,
      action_type: 'delete',
      field_changes: null,
      previous_state: null,
      new_state: null,
      description: generateChangeDescription(entityType, 'delete', null, title),
      user_email: user?.email || null,
      user_name: user?.display_name || user?.full_name || null,
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
    // 2026-04-15: No longer storing previous_state/new_state snapshots (bloat fix)
    await base44.entities.EditActionLog.create({
      entity_type: entityType,
      entity_id: entityId,
      parent_id: parentId,
      action_type: 'reorder',
      field_changes: {
        order: { old_value: previousOrder, new_value: newOrder }
      },
      previous_state: null,
      new_state: null,
      description: generateChangeDescription(entityType, 'reorder', null, entityTitle),
      user_email: user?.email || null,
      user_name: user?.display_name || user?.full_name || null,
      undone: false
    });
  } catch (error) {
    console.error('Failed to log reorder action:', error);
  }
}

/**
 * Log a BATCH reorder — single EditActionLog entry for an entire session reorder.
 * 2026-04-15: Created to replace per-segment logReorder calls. Prevents N log entries
 * per reorder operation. Used by useStructuralOps.move().
 *
 * @param {string} sessionId - Session whose segments were reordered
 * @param {Array<{id: string, title: string, oldOrder: number, newOrder: number}>} changes - What changed
 * @param {string} description - Human-readable description of the operation
 */
export async function logBatchReorder(sessionId, changes, description = '') {
  try {
    // Build a compact field_changes map: { segmentId: { old: N, new: M } }
    const fieldChanges = {};
    for (const c of changes) {
      fieldChanges[c.id] = { old_value: c.oldOrder, new_value: c.newOrder };
    }

    // 2026-04-15: No longer storing previous_state/new_state snapshots (bloat fix).
    // field_changes already contains per-segment old/new order values.
    await base44.entities.EditActionLog.create({
      entity_type: 'Segment',
      entity_id: changes[0]?.id || 'batch',
      parent_id: sessionId,
      action_type: 'reorder',
      field_changes: fieldChanges,
      previous_state: null,
      new_state: null,
      description: description || `Se reordenaron ${changes.length} segmentos`,
      undone: false,
    });
  } catch (error) {
    console.error('Failed to log batch reorder:', error);
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

/**
 * Entity SDK mapping for undo operations
 * UNIVERSAL LOG EXPANSION (2026-02-19): Added Service, ServiceSchedule, StreamBlock,
 * AnnouncementItem, AnnouncementSeries to enable platform-wide logging.
 * All new entity types added here must also be covered in callers at their mutation sites.
 */
const ENTITY_SDK_MAP = {
  Event: () => base44.entities.Event,
  Session: () => base44.entities.Session,
  Segment: () => base44.entities.Segment,
  EventDay: () => base44.entities.EventDay,
  PreSessionDetails: () => base44.entities.PreSessionDetails,
  // Expanded 2026-02-19 for universal log coverage:
  Service: () => base44.entities.Service,
  ServiceSchedule: () => base44.entities.ServiceSchedule,
  StreamBlock: () => base44.entities.StreamBlock,
  AnnouncementItem: () => base44.entities.AnnouncementItem,
  AnnouncementSeries: () => base44.entities.AnnouncementSeries,
};

/**
 * Undo an update action - restores previous_state to the entity
 * 
 * SAFETY CHECKS:
 * 1. Verifies entity still exists before attempting restore
 * 2. Detects if entity was modified AFTER this log entry (conflict detection)
 * 3. Logs the undo operation as a new 'update' action for audit trail
 * 
 * @param {object} log - The EditActionLog entry to undo
 * @param {object} user - Current user performing the undo
 * @returns {object} { success: boolean, error?: string, conflictFields?: string[] }
 */
export async function undoUpdate(log, user = null) {
  // --- PRE-FLIGHT VALIDATION ---
  if (log.action_type !== 'update') {
    return { success: false, error: 'Can only undo update actions with this function' };
  }
  
  if (log.undone) {
    return { success: false, error: 'This action has already been undone' };
  }
  
  // 2026-04-15: Undo now works from field_changes (old_value/new_value per field)
  // instead of requiring previous_state. This is more reliable anyway because
  // previous_state could be stale if other edits happened between log and undo.
  if (!log.field_changes || Object.keys(log.field_changes).length === 0) {
    return { success: false, error: 'No field changes recorded to undo' };
  }
  
  const entitySdk = ENTITY_SDK_MAP[log.entity_type]?.();
  if (!entitySdk) {
    return { success: false, error: `Unknown entity type: ${log.entity_type}` };
  }
  
  try {
    // --- STEP 1: Verify entity still exists ---
    let currentEntity;
    try {
      const entities = await entitySdk.filter({ id: log.entity_id }, '-created_date', 1);
      currentEntity = entities?.[0];
    } catch (fetchError) {
      console.error('[EditActionLog] Failed to fetch entity for undo check:', fetchError);
      return { success: false, error: 'Failed to verify entity exists' };
    }
    
    if (!currentEntity) {
      return { success: false, error: 'Entity no longer exists - cannot undo' };
    }
    
    // --- STEP 2: Conflict detection ---
    // Check if any of the fields we want to restore have been modified since this log entry
    const conflictFields = [];
    for (const [field, change] of Object.entries(log.field_changes)) {
      const currentValue = currentEntity[field];
      const expectedValue = change.new_value;
      
      // Normalize for comparison
      const normalizeForComparison = (val) => {
        if (val === undefined || val === null || val === '') return null;
        if (Array.isArray(val) && val.length === 0) return null;
        return JSON.stringify(val);
      };
      
      const currentNorm = normalizeForComparison(currentValue);
      const expectedNorm = normalizeForComparison(expectedValue);
      
      // If current value doesn't match what we expect from the log's new_value,
      // someone modified this field after the log entry was created
      if (currentNorm !== expectedNorm) {
        conflictFields.push(field);
      }
    }
    
    if (conflictFields.length > 0) {
      console.warn('[EditActionLog] Conflict detected on fields:', conflictFields);
      return { 
        success: false, 
        error: `Entity was modified after this change. Conflicting fields: ${conflictFields.join(', ')}`,
        conflictFields 
      };
    }
    
    // --- STEP 3: Build restoration payload ---
    const fieldsToRestore = {};
    for (const [field, change] of Object.entries(log.field_changes)) {
      fieldsToRestore[field] = change.old_value;
    }
    
    console.log('[EditActionLog] Undoing update for', log.entity_type, log.entity_id, 'restoring fields:', Object.keys(fieldsToRestore));
    
    // --- STEP 4: Apply the restoration ---
    await entitySdk.update(log.entity_id, fieldsToRestore);
    
    // --- STEP 5: Fetch the restored entity for audit logging ---
    let restoredEntity;
    try {
      const entities = await entitySdk.filter({ id: log.entity_id }, '-created_date', 1);
      restoredEntity = entities?.[0];
    } catch (e) {
      // Non-fatal - we still succeeded with the undo
      console.warn('[EditActionLog] Could not fetch restored entity for logging');
    }
    
    // --- STEP 6: Log the undo as a new action (for audit trail) ---
    // 2026-04-15: No longer storing snapshots (bloat fix)
    await base44.entities.EditActionLog.create({
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      parent_id: log.parent_id,
      action_type: 'update',
      field_changes: invertFieldChanges(log.field_changes), // Swap old/new
      previous_state: null,
      new_state: null,
      description: `[UNDO] ${log.description}`,
      user_email: user?.email || null,
      user_name: user?.display_name || user?.full_name || null,
      undone: false
    });
    
    // --- STEP 7: Mark the original log entry as undone ---
    await base44.entities.EditActionLog.update(log.id, {
      undone: true,
      undone_at: new Date().toISOString(),
      undone_by: user?.email || null
    });
    
    return { success: true };
  } catch (error) {
    console.error('[EditActionLog] Failed to undo update:', error);
    return { success: false, error: error.message || 'Failed to restore entity' };
  }
}

/**
 * Helper: Invert field_changes for undo logging (swap old_value and new_value)
 */
function invertFieldChanges(fieldChanges) {
  if (!fieldChanges) return null;
  const inverted = {};
  for (const [field, change] of Object.entries(fieldChanges)) {
    inverted[field] = {
      old_value: change.new_value,
      new_value: change.old_value
    };
  }
  return inverted;
}

/**
 * Undo a delete action - recreates the entity from previous_state
 * 
 * IMPORTANT CONSTRAINTS:
 * 1. The recreated entity will have a NEW ID (original ID cannot be restored)
 * 2. Parent references (session_id, event_id) must still exist
 * 3. For Segments: validates parent session still exists
 * 4. For Sessions: validates parent event still exists
 * 5. Logs creation with [UNDO-DELETE] prefix for traceability
 * 
 * @param {object} log - The EditActionLog entry to undo
 * @param {object} user - Current user performing the undo
 * @returns {object} { success: boolean, newEntityId?: string, error?: string }
 */
export async function undoDelete(log, user = null) {
  // --- PRE-FLIGHT VALIDATION ---
  if (log.action_type !== 'delete') {
    return { success: false, error: 'Can only undo delete actions with this function' };
  }
  
  if (log.undone) {
    return { success: false, error: 'This action has already been undone' };
  }
  
  // 2026-04-15: New entries no longer store previous_state. Undo-delete requires
  // the snapshot to recreate the entity. Only historical entries (pre-2026-04-15) support this.
  if (!log.previous_state) {
    return { success: false, error: 'No previous state snapshot available. Delete undo is only available for entries created before 2026-04-15.' };
  }
  
  const entitySdk = ENTITY_SDK_MAP[log.entity_type]?.();
  if (!entitySdk) {
    return { success: false, error: `Unknown entity type: ${log.entity_type}` };
  }
  
  try {
    // --- STEP 1: Validate parent still exists (critical for referential integrity) ---
    const parentId = log.previous_state.session_id || log.previous_state.event_id || log.parent_id;
    
    if (log.entity_type === 'Segment' && log.previous_state.session_id) {
      // Verify session still exists
      const sessions = await base44.entities.Session.filter({ id: log.previous_state.session_id }, '-created_date', 1);
      if (!sessions?.[0]) {
        return { success: false, error: 'Parent session no longer exists - cannot restore segment' };
      }
    }
    
    if (log.entity_type === 'Session' && log.previous_state.event_id) {
      // Verify event still exists
      const events = await base44.entities.Event.filter({ id: log.previous_state.event_id }, '-created_date', 1);
      if (!events?.[0]) {
        return { success: false, error: 'Parent event no longer exists - cannot restore session' };
      }
    }
    
    // --- STEP 2: Prepare entity data (exclude system fields) ---
    const { id, created_date, updated_date, created_by, ...entityData } = log.previous_state;
    
    // Ensure we don't have stale/invalid references
    // Note: We keep the original parent references but the ID will be new
    
    console.log('[EditActionLog] Undoing delete for', log.entity_type, 'recreating entity with data keys:', Object.keys(entityData));
    
    // --- STEP 3: Recreate the entity ---
    const newEntity = await entitySdk.create(entityData);
    
    if (!newEntity?.id) {
      return { success: false, error: 'Entity creation returned no ID' };
    }
    
    // --- STEP 4: Log the restoration (NOT using logCreate - custom description) ---
    // 2026-04-15: No longer storing new_state snapshot (bloat fix)
    const title = newEntity.title || newEntity.name || entityData.title || entityData.name || '';
    await base44.entities.EditActionLog.create({
      entity_type: log.entity_type,
      entity_id: newEntity.id,
      parent_id: parentId || null,
      action_type: 'create',
      field_changes: null,
      previous_state: null,
      new_state: null,
      description: `[UNDO-DELETE] Restored ${log.entity_type} "${title}" (original ID: ${log.entity_id})`,
      user_email: user?.email || null,
      user_name: user?.display_name || user?.full_name || null,
      undone: false
    });
    
    // --- STEP 5: Mark the original log entry as undone ---
    await base44.entities.EditActionLog.update(log.id, {
      undone: true,
      undone_at: new Date().toISOString(),
      undone_by: user?.email || null
    });
    
    console.log('[EditActionLog] Successfully restored deleted', log.entity_type, 'with new ID:', newEntity.id);
    
    return { success: true, newEntityId: newEntity.id };
  } catch (error) {
    console.error('[EditActionLog] Failed to undo delete:', error);
    return { success: false, error: error.message || 'Failed to recreate entity' };
  }
}