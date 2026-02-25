# Attempt Log

## [ATT-001] Fix stale serviceId in executeResetToBlueprint via prop passing
**Date:** 2026-02-25
**Surfaces:** useWeeklyServiceHandlers, DayServiceEditor
**What was attempted:** Pass `serviceId` as a prop from DayServiceEditor to useWeeklyServiceHandlers, to avoid stale closure over `serviceData.id` in the reset handler.
**Result:** REVERTED — The prop was removed in the same session after recognizing it didn't solve the root cause (stale state closure). Replaced with direct `serviceData.id` access.
**Disposition:** REVERTED
**Lesson:** Band-aid props don't fix stale closure issues. The real fix is either using refs or restructuring the dependency chain.

## [ATT-002] Fix 429 rate limits in loadWeeklyFromSessions via batch queries
**Date:** 2026-02-25
**Surfaces:** weeklySessionSync (loadWeeklyFromSessions)
**What was attempted:** Replaced N+1 per-session Segment queries with a single batch query using `$in` operator on `session_id`. Same for PreSessionDetails.
**Result:** SUCCESS — Reduced API calls from O(N) to O(1) for segment loading.
**Disposition:** IMPLEMENTED

## [ATT-003] Suppress false integrity breach toast for blueprint segments
**Date:** 2026-02-25
**Surfaces:** DayServiceEditor integrity check
**What was attempted:** Converted the integrity toast (segments without _entityId) from user-facing toast to console.warn, since blueprint-seeded segments from ensureRecurringServices don't have entity IDs until the editor creates them.
**Result:** SUCCESS — No more false alarms.
**Disposition:** IMPLEMENTED

## [ATT-004] System Audit of Recurring Service Lifecycle
**Date:** 2026-02-25
**Surfaces:** All (Service, Session, Segment, PreSessionDetails, ensureRecurringServices, EmptyDayPrompt, DayServiceEditor, weeklySessionSync, useSegmentMutation, useWeeklyServiceHandlers, submitWeeklyServiceContent, serveWeeklyServiceSubmission, BlueprintEditor)
**What was attempted:** Full code read of all 12+ files involved in the recurring service lifecycle. Documented every phase, every data flow, every inconsistency.
**Result:** Completed. Found 7 systemic issues. See SYSTEM_AUDIT_RECURRING_SERVICES.md.
**Disposition:** COMPLETED (audit only, no code changes yet)
**Key Findings:**
1. ensureRecurringServices writes JSON blobs, but DayServiceEditor only reads entities → services appear empty
2. SEGMENT_FIELD_MAP missing `leader` → presenter mapping
3. Type normalization duplicated in 4 places with drift
4. Reset has no atomicity or rollback
5. Public form submission vulnerable to mid-reset entity deletion

## [ATT-005] P1: Add `leader` → `presenter` to SEGMENT_FIELD_MAP
**Date:** 2026-02-25
**Surfaces:** useSegmentMutation
**What was attempted:** Added `leader: "presenter"` mapping to SEGMENT_FIELD_MAP so worship director edits persist correctly to the Segment entity's `presenter` column.
**Result:** SUCCESS
**Disposition:** IMPLEMENTED

## [ATT-006] P0: Rewrite ensureRecurringServices to create Session+Segment entities
**Date:** 2026-02-25
**Surfaces:** functions/ensureRecurringServices, Session entity, Segment entity
**What was attempted:** Full rewrite of ensureRecurringServices to create Service metadata (no JSON blobs) + Session entities + Segment entities per slot, matching the EmptyDayPrompt flow. Eliminates the root cause of auto-created services appearing empty in DayServiceEditor.
**Result:** SUCCESS
**Disposition:** IMPLEMENTED
**Backup:** Previous version preserved in git. No existing production data affected (additive only — creates new entities for future dates).

## [ATT-007] P2: Extract shared normalizeSegmentType() and resolveSegmentEnum()
**Date:** 2026-02-25
**Surfaces:** components/utils/segmentTypeMap (NEW), EmptyDayPrompt, useWeeklyServiceHandlers (executeResetToBlueprint), DayServiceEditor (mergeSegmentsWithBlueprint), weeklySessionSync (findMatchingBlueprintSegment)
**What was attempted:** Created `components/utils/segmentTypeMap.js` with two exported functions: `resolveSegmentEnum()` (UI→entity enum) and `normalizeSegmentType()` (any→lowercase key). Replaced all 4 inline typeMap objects with imports from this shared module. Backend function (ensureRecurringServices) has an inlined copy since Deno can't import frontend modules.
**Result:** SUCCESS
**Disposition:** IMPLEMENTED

## [ATT-008] P3: Add pre-reset snapshot for reset atomicity
**Date:** 2026-02-25
**Surfaces:** useWeeklyServiceHandlers (executeResetToBlueprint)
**What was attempted:** Added a pre-reset snapshot that captures all existing segment IDs + titles before deletion. Logged to console for debugging. This doesn't provide automatic rollback but ensures traceability of what was deleted if reset partially fails.
**Result:** SUCCESS (partial — logging only, not auto-rollback)
**Disposition:** IMPLEMENTED (Phase 1 — logging. Phase 2 — auto-rollback — deferred.)