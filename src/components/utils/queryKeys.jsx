/**
 * CENTRALIZED QUERY KEY DEFINITIONS
 * =================================
 * 
 * This file defines ALL query keys used for segment-related data.
 * It serves as a contract between components that fetch and invalidate data.
 * 
 * IMPORTANT: When adding new segment queries, add the key pattern here.
 * 
 * INVALIDATION STRATEGY:
 * - Use `segmentKeys.invalidateAll(queryClient)` after ANY segment mutation
 * - This ensures all segment caches are refreshed regardless of key structure
 * 
 * WHY PREDICATE-BASED INVALIDATION:
 * - EventDetail uses composite keys: ['segments', eventId, sessionIdsKey]
 * - SessionManager uses simple keys: ['segments', sessionId]
 * - Predicate matching on key[0] ensures both are invalidated
 * 
 * DECISION LOG REFERENCE: Segment Query Key Consolidation (2025)
 */

// ============================================================
// SEGMENT QUERY KEYS
// ============================================================

export const segmentKeys = {
  // Base key for all segment queries
  all: ['segments'],
  
  // Segments for a single session
  // Usage: useQuery({ queryKey: segmentKeys.bySession(sessionId), ... })
  bySession: (sessionId) => ['segments', sessionId],
  
  // Segments for an event (via session IDs)
  // Usage: useQuery({ queryKey: segmentKeys.byEvent(eventId, sessionIdsKey), ... })
  // Note: sessionIdsKey should be JSON.stringify(sessionIds.sort()) for stability
  byEvent: (eventId, sessionIdsKey) => ['segments', eventId, sessionIdsKey],
  
  // Alternative key pattern used in some views
  allSegments: () => ['allSegments'],
  
  /**
   * CRITICAL: Call this after ANY segment mutation (create, update, delete, reorder)
   * 
   * Uses predicate-based invalidation to match ALL segment query patterns:
   * - ['segments', sessionId]
   * - ['segments', eventId, sessionIdsKey]
   * - ['allSegments', ...]
   * 
   * @param {QueryClient} queryClient - The React Query client instance
   * @param {Object} options - Optional settings
   * @param {boolean} options.debug - If true, logs invalidated keys to console
   */
  invalidateAll: (queryClient, options = {}) => {
    const { debug = false } = options;
    
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        const isSegmentQuery = Array.isArray(key) && 
          (key[0] === 'segments' || key[0] === 'allSegments');
        
        if (debug && isSegmentQuery) {
          console.log('[QueryKeys] Invalidating:', key);
        }
        
        return isSegmentQuery;
      }
    });
  },
};

// ============================================================
// SESSION QUERY KEYS
// ============================================================

export const sessionKeys = {
  all: ['sessions'],
  byEvent: (eventId) => ['sessions', eventId],
  single: (sessionId) => ['session', sessionId],
  
  /**
   * Invalidate all session queries
   */
  invalidateAll: (queryClient) => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && 
          (key[0] === 'sessions' || key[0] === 'session');
      }
    });
  },
};

// ============================================================
// EDIT ACTION LOG QUERY KEYS
// ============================================================

export const editLogKeys = {
  all: ['editActionLogs'],
  byEntity: (entityType, entityId) => ['editActionLogs', entityType, entityId],
  
  invalidateAll: (queryClient) => {
    queryClient.invalidateQueries({ queryKey: ['editActionLogs'] });
  },
};

// ============================================================
// COMBINED INVALIDATION HELPERS
// ============================================================

/**
 * Invalidates all segment-related caches after a mutation.
 * This is the CANONICAL way to invalidate after segment changes.
 * 
 * @param {QueryClient} queryClient
 * @param {Object} options
 * @param {boolean} options.includeEditLogs - Also invalidate edit action logs (default: true)
 * @param {boolean} options.debug - Log invalidated keys
 */
export function invalidateSegmentCaches(queryClient, options = {}) {
  const { includeEditLogs = true, debug = false } = options;
  
  // Always invalidate all segment queries
  segmentKeys.invalidateAll(queryClient, { debug });
  
  // Optionally invalidate edit logs
  if (includeEditLogs) {
    editLogKeys.invalidateAll(queryClient);
  }
}