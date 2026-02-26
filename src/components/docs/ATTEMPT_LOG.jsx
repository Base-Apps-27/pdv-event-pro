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

## [ATT-009] Fix 429 cascade after metadata save / reset
**Date:** 2026-02-25
**Surfaces:** DayServiceEditor (saveMetadataMutation.onSuccess)
**What was attempted:** Changed `queryClient.invalidateQueries` in metadata save's `onSuccess` from default `refetchType` (which auto-refetches) to `refetchType: 'none'` (marks stale but doesn't trigger immediate refetch). The metadata auto-save fires every 3s; each save was triggering loadWeeklyFromSessions → 2 API calls (Segment.filter + PreSessionDetails.filter), which cascaded into 429 rate limits especially after reset (which creates many entities in rapid succession).
**Result:** SUCCESS — 429 errors eliminated after reset
**Disposition:** IMPLEMENTED

## [ATT-010] Post-Implementation Verification Audit
**Date:** 2026-02-25
**Surfaces:** All surfaces from ATT-004
**What was attempted:** Re-read all code files AND queried production DB to verify each audit finding was addressed.
**Result:** COMPLETED — Verification results:
- P0 (ensureRecurringServices entity-first): ✅ VERIFIED. DB confirms Session + Segment entities exist for auto-created service 699bdf1cf3c959efcc24d06b. Function test returns `already_exists`.
- P1 (leader → presenter mapping): ✅ VERIFIED. `SEGMENT_FIELD_MAP.leader = "presenter"` present in code.
- P2 (shared type normalization): ✅ VERIFIED. All 4 frontend consumers import from `segmentTypeMap.js`. Backend has sync'd inline copy.
- P3 (reset snapshot): ✅ VERIFIED. Pre-reset snapshot logs segment IDs before deletion. Auto-rollback deferred.
- P4 (public form mid-reset vulnerability): ⚠️ NOT YET ADDRESSED (documented risk, not in P0-P3 scope)
- P5 (dead blueprint slot code in read path): ⚠️ HARMLESS — dead code for entity-backed segments, only affects pre-migration data
- P6 (concurrent ops): ⚠️ ACCEPTED TRADEOFF per DECISION-002
- 429 fix (ATT-009): ✅ VERIFIED. Metadata save no longer triggers cascading refetches.
**Disposition:** COMPLETED

### Remaining Known Risks (documented, not blocking):
1. **Stale JSON blobs on Service entity**: Pre-fix services still have `9:30am`/`11:30am` JSON arrays. Harmless (ignored by STRICT MODE) but not cleaned up. Non-destructive cleanup could be done later.
2. **Public form mid-reset**: Speaker submission could fail if admin resets segments during form open. Mitigation: check entity existence before Segment.update() in submitWeeklyServiceContent.
3. **Reset partial failure**: Sequential segment creation could fail mid-loop. Mitigation (deferred): bulkCreate + auto-rollback.
4. **Blueprint versioning**: Still none. Reset always uses current blueprint. Accepted tradeoff per DECISION-002 Contract 3.

## [ATT-011] Weekly Editor V2 — Full Zero-Trust Rewrite
**Date:** 2026-02-26
**Surfaces:** NEW files in components/service/v2/ (19 files). Integration: pages/WeeklyServiceManager (1 edit swap).
**What was attempted:** Complete rewrite of the weekly service editor with entity-first architecture. Zero code reuse from V1 editor components. See DECISION-003 for full architecture spec.
**Result:** COMPLETED — All phases implemented:
  - Phase 1: Foundation (fieldMap, useWeeklyData, useEntityWrite, useExternalSync) ✅
  - Phase 2: Segments (FieldRenderer, SongRows, SpeakerMaterialSection, SubAssignmentRow, SegmentNotesPanel, SegmentCard) ✅
  - Phase 3: Columns (PreServiceSection, RecesoSection, TeamSection, SlotColumn, SlotColumnContainer) ✅
  - Phase 4: Actions (useResetToBlueprint, useMoveSegment, useSpecialSegment, useCopyBetweenSlots) ✅
  - Phase 5: Orchestrator (WeeklyEditorV2) ✅
  - Phase 6: Integration (WeeklyServiceManager swap V1→V2) ✅
  - Phase 7: Wiring (VerseParser dialog connected with segmentId state, SpecialSegmentDialog adapted for V2 entity shape) ✅
**Disposition:** IMPLEMENTED
**Backup:** All V1 files remain untouched (DayServiceEditor, weeklySessionSync, useWeeklyServiceHandlers, ServiceTimeSlotColumn, ServiceSlotColumns, SundaySlotColumns, WeeklyServiceInputs, useSegmentMutation). Rollback = change import in WeeklyServiceManager back to DayServiceEditor.

### V2 File Inventory (19 files):
- `v2/constants/fieldMap.js` — field registry, team fields, notes fields, speaker material fields
- `v2/hooks/useWeeklyData.js` — entity loader (no JSON transformation)
- `v2/hooks/useEntityWrite.js` — debounced write + optimistic cache + dirty tracking
- `v2/hooks/useExternalSync.js` — concurrent editing detection
- `v2/segments/FieldRenderer.jsx` — renders single field from ui_fields
- `v2/segments/SongRows.jsx` — worship song inputs
- `v2/segments/SpeakerMaterialSection.jsx` — presentation/notes URL inputs
- `v2/segments/SubAssignmentRow.jsx` — child entity inputs
- `v2/segments/SegmentNotesPanel.jsx` — expandable department notes
- `v2/segments/SegmentCard.jsx` — single segment card
- `v2/columns/PreServiceSection.jsx` — pre-service notes
- `v2/columns/RecesoSection.jsx` — break notes
- `v2/columns/TeamSection.jsx` — session team inputs
- `v2/columns/SlotColumn.jsx` — full time-slot column
- `v2/columns/SlotColumnContainer.jsx` — responsive desktop/mobile layout
- `v2/actions/useResetToBlueprint.js` — reset handler
- `v2/actions/useMoveSegment.js` — reorder handler
- `v2/actions/useSpecialSegment.js` — add/remove special segments
- `v2/actions/useCopyBetweenSlots.js` — cross-slot copy handler
- `v2/WeeklyEditorV2.jsx` — day-level orchestrator

## [ATT-012] V2 Phase 8 — Foundation Hardening
**Date:** 2026-02-26
**Surfaces:** All 19 V2 files (hooks, actions, segments, columns)
**What was attempted:** Comprehensive hardening pass across all V2 layers to make the foundation durable for long-term use. No new UI features — focused on reliability, correctness, and resilience.
**Changes:**
  - **useEntityWrite**: Field coalescing (multiple rapid writes to same entity batched into 1 API call), retry with backoff (2 retries), error toast on permanent failure, cleaner flush lifecycle
  - **useExternalSync**: Now watches Segment + Session entities (not just Service), separate event handler with better debouncing
  - **useWeeklyData**: Promise.allSettled for parallel loading (segment load failure doesn't kill PSD), orphan segment detection + warning, 30s staleTime to reduce refetches
  - **fieldMap**: Added livestream_notes, microphone_assignments, prep_instructions, other_notes to NOTES_FIELDS. Exported TEXT_COPY_COLUMNS for cross-slot copy consistency
  - **useCopyBetweenSlots**: Uses TEXT_COPY_COLUMNS from registry (single source of truth), copies parsed_verse_data, field count in toast
  - **useResetToBlueprint**: Deletes children before parents (prevents orphans), carries color_code + segment_actions + visibility flags from blueprint, partial success handling with per-session error reporting
  - **useSpecialSegment**: Input validation, child cascade delete, automatic re-ordering after remove to prevent order gaps
  - **useMoveSegment**: Full re-index after swap (prevents cumulative order drift from partial updates)
  - **SegmentNotesPanel**: Added visibility toggles (show_in_*), stage_call_offset input, collapsible empty notes (click to expand), department badge on actions
  - **SegmentCard**: React.memo for performance, entity color_code support (worship/preach/break/tech/special), unconfigured segments now allow notes expansion + reorder
  - **WeeklyEditorV2**: Flush on unmount, empty sessions error state, AlertCircle import
**Result:** IMPLEMENTED
**Disposition:** IMPLEMENTED — V2 foundation hardened. All layers now have retry, validation, traceability, and defensive patterns.

## [ATT-013] V2 Phase 9 — UI/UX Polish & Print Readiness
**Date:** 2026-02-26
**Surfaces:** All V2 column + segment components (8 files)
**What was attempted:** Comprehensive UI/UX polish pass: memoization for render performance, print-friendly rendering throughout, collapsible empty sections, and visual polish.
**Changes:**
  - **All components**: React.memo applied to every leaf + container component to prevent re-render cascade
  - **TeamSection**: AutocompleteInput for team suggestions, 2-column grid on desktop, print read-only text, labeled fields
  - **PreServiceSection**: Collapsible when empty (saves vertical space), auto-expands when content exists, print read-only
  - **RecesoSection**: Collapsible when empty, flush-on-unmount to prevent data loss, print read-only, ref-based closure for timer
  - **SlotColumn**: Empty segment list warning with guidance, segment count badge in header, memoized timing calculations
  - **SlotColumnContainer**: Dirty indicator (red dot) on mobile tabs when unsaved changes exist, print layout stacks all columns
  - **FieldRenderer**: Labels above each field, print read-only text, console.warn for unknown ui_fields keys (don't crash), all sub-components memoized
  - **SongRows**: Print read-only song list with numbering, Music icon in header, tracks all lead/key fields for sync
  - **SubAssignmentRow**: Assignment status badge (Asignado/Pendiente), print read-only
  - **SpeakerMaterialSection**: URL validation green border, print URLs as clickable links, Link icon in header
**Result:** IMPLEMENTED
**Disposition:** IMPLEMENTED — V2 now production-ready with full print support, performance optimization, and polished UX across all 19 components.