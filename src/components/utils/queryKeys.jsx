/**
 * CENTRALIZED QUERY KEY DEFINITIONS
 * =================================
 * 
 * This file defines ALL query keys used for segment-related data.
 * It serves as a contract between components that fetch and invalidate data.
 * 
 * IMPORTANT: When adding new segment queries, add the key pattern here.
 * 
 * ============================================================
 * CANONICAL CACHE ARCHITECTURE (DECISION: 2025-02-03)
 * ============================================================
 * 
 * SOURCE OF TRUTH: Event-level segments cache
 *   - Key: ['segments', eventId, sessionIdsKey]
 *   - Fetches ALL segments for an event via getSegmentsBySessionIds
 *   - This is the CANONICAL source that mutations invalidate
 * 
 * DERIVED CACHES:
 *   - Session-level lists MUST derive from event cache OR refetch
 *   - SegmentList receives segments as props from parent (SessionManager)
 *   - SessionManager receives segments as props from parent (EventDetail)
 *   
 * WHY EVENT-LEVEL IS CANONICAL:
 *   1. Single network call for all event segments (efficient)
 *   2. Consistent data across all session views
 *   3. Simple invalidation: invalidate event cache, children re-render
 *   4. Avoids N+1 queries for N sessions
 * 
 * SESSION-LEVEL DIRECT FETCH:
 *   - Used ONLY in SegmentFormTwoColumn for overlap validation
 *   - Key: ['segments', sessionId]
 *   - This is a READ-ONLY cache for form validation
 *   - Mutations still invalidate via predicate (catches both patterns)
 * 
 * sessionIdsKey STABILIZATION:
 *   - MUST be sorted: sessions.map(s => s.id).sort().join(',')
 *   - Without sorting, key changes when sessions reorder
 *   - This causes unnecessary refetches and cache misses
 * 
 * ============================================================
 * INVALIDATION STRATEGY
 * ============================================================
 * 
 * - Use `segmentKeys.invalidateAll(queryClient)` after ANY segment mutation
 * - This ensures all segment caches are refreshed regardless of key structure
 * 
 * WHY PREDICATE-BASED INVALIDATION:
 * - EventDetail uses composite keys: ['segments', eventId, sessionIdsKey]
 * - SegmentFormTwoColumn uses simple keys: ['segments', sessionId]
 * - Predicate matching on key[0] ensures BOTH are invalidated
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