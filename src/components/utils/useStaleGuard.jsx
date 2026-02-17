/**
 * useStaleGuard — Phase 5 Task 4: Concurrent Editing Guard
 *
 * Simple optimistic locking via updated_date comparison.
 * When a form opens, we snapshot the entity's updated_date.
 * Before saving, call checkStale() which re-fetches the entity
 * and compares timestamps. If someone else saved in between,
 * the user gets a warning and can choose to force-save or cancel.
 *
 * SCOPE: SegmentFormTwoColumn, WeeklyServiceManager, CustomServiceBuilder
 *
 * DESIGN DECISIONS:
 * - No background polling — check only at save time (simple, reliable)
 * - Uses updated_date (built-in on all Base44 entities, always present)
 * - Returns { isStale, staleInfo } so callers can show UI however they want
 * - Force-save is always allowed (we warn, not block)
 *
 * USAGE:
 *   const { captureBaseline, checkStale } = useStaleGuard();
 *
 *   // On form open / data load:
 *   captureBaseline(entity.updated_date, entity.updated_by);
 *
 *   // Before save:
 *   const stale = await checkStale(entityName, entityId);
 *   if (stale.isStale) {
 *     // show warning, let user decide
 *   }
 */

import { useRef, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function useStaleGuard() {
  const baselineRef = useRef({ updated_date: null, captured_at: null });
  const onStaleCallbackRef = useRef(null);

  /**
   * Capture the baseline timestamp when form opens.
   * @param {string} updatedDate — entity.updated_date at load time
   */
  const captureBaseline = useCallback((updatedDate) => {
    baselineRef.current = {
      updated_date: updatedDate || null,
      captured_at: new Date().toISOString(),
    };
  }, []);

  /**
   * Check if the entity has been modified since we loaded it.
   * Re-fetches the entity by ID and compares updated_date.
   *
   * @param {string} entityName — e.g. "Segment", "Service"
   * @param {string} entityId — the entity record ID
   * @returns {Promise<{isStale: boolean, serverDate: string|null, baselineDate: string|null, modifiedBy: string|null}>}
   */
  const checkStale = useCallback(async (entityName, entityId) => {
    if (!entityId || !baselineRef.current.updated_date) {
      // New entity (no ID yet) or no baseline — can't be stale
      return { isStale: false, serverDate: null, baselineDate: null, modifiedBy: null };
    }

    try {
      const results = await base44.entities[entityName].filter({ id: entityId });
      const current = results?.[0];
      if (!current) {
        // Entity was deleted — let the save fail naturally
        return { isStale: false, serverDate: null, baselineDate: baselineRef.current.updated_date, modifiedBy: null };
      }

      const serverDate = current.updated_date;
      const baselineDate = baselineRef.current.updated_date;

      // Compare: if server is newer than our baseline, someone else edited
      const isStale = serverDate && baselineDate && new Date(serverDate) > new Date(baselineDate);

      return {
        isStale: !!isStale,
        serverDate,
        baselineDate,
        modifiedBy: current.updated_by || current.created_by || null,
      };
    } catch (err) {
      // If fetch fails, don't block the save — just warn in console
      console.warn("[useStaleGuard] Failed to check staleness:", err.message);
      return { isStale: false, serverDate: null, baselineDate: baselineRef.current.updated_date, modifiedBy: null };
    }
  }, []);

  /**
   * Update the baseline after a successful save (so next edit starts fresh).
   * @param {string} newUpdatedDate
   */
  const updateBaseline = useCallback((newUpdatedDate) => {
    baselineRef.current = {
      updated_date: newUpdatedDate || new Date().toISOString(),
      captured_at: new Date().toISOString(),
    };
  }, []);

  /**
   * Subscribe to real-time entity changes for proactive stale detection.
   * When the entity is updated by someone else, the onStale callback fires
   * immediately instead of waiting until save time.
   *
   * @param {string} entityName — e.g. "Session", "Service"
   * @param {string} entityId — the entity record ID to watch
   * @param {Function} onStale — callback({serverDate, baselineDate}) when stale detected
   * @returns {Function} unsubscribe
   */
  const subscribeToChanges = useCallback((entityName, entityId, onStale) => {
    if (!entityName || !entityId || !base44.entities[entityName]) return () => {};
    onStaleCallbackRef.current = onStale;

    const unsub = base44.entities[entityName].subscribe((event) => {
      if (event.id !== entityId) return;
      const baseline = baselineRef.current.updated_date;
      const serverDate = event.data?.updated_date;
      if (baseline && serverDate && new Date(serverDate) > new Date(baseline)) {
        onStaleCallbackRef.current?.({
          serverDate,
          baselineDate: baseline,
          modifiedBy: event.data?.updated_by || null,
        });
      }
    });

    return typeof unsub === 'function' ? unsub : () => {};
  }, []);

  return { captureBaseline, checkStale, updateBaseline, subscribeToChanges };
}