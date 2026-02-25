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