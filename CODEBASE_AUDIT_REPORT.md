# PDV Event Pro — Comprehensive Codebase Audit Report (v2)

> **Date:** 2026-02-22 (Rebased re-audit)
> **Scope:** Full codebase — 358 source files, 27 backend functions
> **Methodology:** 12 parallel audit agents across 12 phases (A-L)
> **Status:** Complete

---

## Executive Summary

The codebase is a **professional, well-architected event management platform** that has undergone significant recent refactoring (Phase 3 decompositions, Phase 7 performance optimizations). The architecture is sound, with clear separation of concerns, a centralized design system (shadcn/ui + Tailwind), and a robust utility layer.

**The re-audit uncovered 145+ distinct findings across 5 severity levels:**

| Severity | Count | Examples |
|----------|-------|---------|
| **Critical** | 10 | XSS in public forms, Hooks violation, dead dependencies, state mutation bugs |
| **High** | 22 | Privilege escalation, delete-first data sync, stale permission keys, dead test suite |
| **Medium** | 52 | i18n gaps, `confirm()` calls, duplicated logic, missing staleTime, no CSRF |
| **Low** | 42 | Unused imports, console.logs, naming inconsistencies, dead code |
| **Info** | 19+ | Positive patterns, documentation notes |

### Health Dashboard

| Dimension | Grade | Summary |
|-----------|-------|---------|
| **Code Cleanliness** | B- | 223 console statements (73 `console.log`), 330 unused imports, 22 dead UI files |
| **Efficiency** | B | Good React Query adoption, but missing staleTime globally, N+1 queries in backend |
| **Constitution Compliance** | C+ | `.delete()` calls in 14+ files, i18n gaps in 30+ files, read-only transforms PASS |
| **Decision Compliance** | C | D1 (pdfmake) PASS, D8 (query keys) systemically FAILED, D2 (stale guard) partially FAILED |
| **Security** | C+ | XSS in 2 public forms, SSRF risk, privilege escalation, no CSRF on public forms |

---

## Critical Findings (Fix Immediately)

### CRIT-1: XSS in Weekly Service Submission Form
**File:** `functions/serveWeeklyServiceSubmission.ts`
**Lines:** 310, 461-464

Two XSS vectors:
1. **Line 310:** `siblingMapJS` (from `JSON.stringify`) injected into a `<script>` tag without `</script>` breakout protection. A session name containing `</script>` would inject arbitrary JavaScript.
2. **Lines 461-464:** `error.message` interpolated into HTML response without `escapeHtml()`. The equivalent code in `serveSpeakerSubmission.ts` (line 603) correctly escapes.

**Fix:** (1) Add `.replace(/</g, '\\u003c')` to the JSON string before injection. (2) Wrap `error.message` with `escapeHtml()`.

**Note:** `serveSpeakerSubmission.ts` has been properly remediated with `escapeHtml()` on all interpolated values.

---

### CRIT-2: React Hooks Violation in WeeklyServiceInputs
**File:** `src/components/service/WeeklyServiceInputs.jsx`
**Line:** 175

`RecesoNotesInput` component has an early `return null` (line 175) BEFORE subsequent `useContext`, `useState`, `useDebouncedCommit`, and `useEffect` calls. This violates React's Rules of Hooks — hooks must not be called conditionally. When `resolvedSlot` changes from null to a valid value, the component will have a different number of hooks, causing a runtime React error.

**Fix:** Move the early return to after all hook calls, or restructure to always call hooks.

---

### CRIT-3: Dead Dependencies Bloating Bundle
**Files:** `package.json`

**4 completely unused packages:** `lodash`, `zod`, `@hookform/resolvers`, `react-hook-form`

**14 packages used only by dead UI wrapper files:** `embla-carousel-react`, `input-otp`, `react-resizable-panels`, `vaul`, `cmdk`, `recharts`, `@radix-ui/react-hover-card`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-context-menu`, `@radix-ui/react-toggle-group`, `@radix-ui/react-progress`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-toggle`

**Wrong framework:** `next-themes` (Next.js-specific, used in Vite SPA — imported only in dead `sonner.jsx` wrapper)

**Fix:** Remove all 19 packages from `package.json` and delete corresponding 15 dead UI wrapper files.

---

### CRIT-4: Centralized Query Keys Never Used (D8 Systemic Failure)
**File:** `src/components/utils/queryKeys.jsx`

The centralized query key factories (`segmentKeys`, `sessionKeys`, `editLogKeys`) are defined but **never used as `queryKey:` values in any `useQuery` call**. All 100+ `useQuery` calls use inline string arrays. Over 30 distinct ad-hoc query key patterns found across the codebase.

**Fix:** Migrate all inline `queryKey: [...]` usages to centralized key factories. Extend `queryKeys.jsx` to cover all entity types.

---

### CRIT-5: 22 Entirely Dead UI Wrapper Files
**Directory:** `src/components/ui/`

22 UI primitive files are never imported by any consumer component — 2,631 lines (56% of the UI layer by line count). Includes: `aspect-ratio`, `avatar`, `breadcrumb`, `carousel`, `chart`, `command`, `context-menu`, `drawer`, `form`, `hover-card`, `input-otp`, `menubar`, `navigation-menu`, `pagination`, `resizable`, `sidebar` (626 lines!), `sonner`, `toggle-group`, `toggle`, `accordion`, `progress`, `MessageBubble`.

**Fix:** Delete these files. Remove corresponding packages from `package.json`.

---

### CRIT-6: State Mutation Bugs (4 locations)
**Files and Lines:**
1. `src/components/service/ServiceTimeSlotColumn.jsx` — Lines 340-345, 526-530 (documented as fixed with CRIT-7 FIX comments — **RESOLVED**)
2. `src/components/service/weekly/useWeeklyServiceHandlers.jsx` — Lines 157-166: `handleSaveParsedVerses` mutates `prev[timeSlot][segmentIdx].data` without cloning the array or segment object
3. `src/components/templates/ServiceTemplatesTab.jsx` — Lines 326-355: `updateSegmentField` mutates `prev[service][segmentIndex]` properties directly (every branch except `data`)
4. `src/components/service/custom-builder/SegmentTimelineCard.jsx` — Lines 111-149: Song and sub-assignment objects mutated in place after shallow array copy

**Fix:** Deep-clone nested arrays and objects before mutation in all 3 remaining locations.

---

### CRIT-7: useStaleGuard Dead Code in WeeklyServiceManager
**File:** `src/pages/WeeklyServiceManager.jsx`
**Line:** 174

`checkServiceStale` is destructured from `useStaleGuard()` and `captureBaseline` is called correctly, but `checkServiceStale` is **never invoked anywhere in the save flow**. Neither the auto-save, manual save, per-field push, nor exit flush calls `checkStale()` before writing. The `StaleEditWarningDialog` is rendered but `showStaleWarning` is never set to `true` by any code path.

**Result:** Optimistic locking is completely non-functional. Two simultaneous editors silently overwrite each other.

**Fix:** Call `checkServiceStale()` before every save mutation. Set `showStaleWarning = true` on stale detection.

---

### CRIT-8: reportHelpers.test.jsx Silently Discards Results
**File:** `src/components/testing/tests/reportHelpers.test.jsx`

This test file returns a raw `results` array instead of using the `describe/it/expect` API from TestRunner. The test runner's `runSuite()` expects `describe()` blocks, but this file never calls `describe()`. The tests execute but their results are silently discarded — they always show 0 tests in the UI.

**Fix:** Rewrite to use TestRunner's `describe/it/expect` pattern.

---

### CRIT-9: sessionSync Delete-First Pattern (Data Loss Risk)
**File:** `src/components/service/sessionSync.jsx`
**Line:** 52

`await Promise.all(existingSegments.map(s => base44.entities.Segment.delete(s.id)))` deletes ALL segments BEFORE creating new ones. If creation fails (network error, server error), all segment data is permanently lost. The weekly variant (`weeklySessionSync.jsx`) has already been upgraded to the safer create-before-delete pattern.

**Fix:** Upgrade to create-before-delete pattern matching `weeklySessionSync.jsx`.

---

### CRIT-10: Triple `auth.me()` Call on Every Page Load
**Files:** `src/lib/AuthContext.jsx` (line 94), `src/Layout.jsx` (line 52), `src/components/utils/i18n.jsx` (line 1052)

Three separate locations independently call `base44.auth.me()` on app startup, creating 3 redundant network requests. None of them use the `useCurrentUser()` hook which provides React Query deduplication.

**Fix:** Consolidate all auth calls through `useCurrentUser()`. Remove independent `auth.me()` calls from Layout and i18n.

---

## High-Severity Findings

### Security

| # | Finding | File | Line |
|---|---------|------|------|
| H-SEC-1 | **Privilege escalation** — UserManagement has zero page-level permission checks. Any authenticated user navigating to `/UserManagement` can modify roles, including self-promotion to Admin. Bulk operations also unguarded. | `src/pages/UserManagement.jsx` | 93-106, 158-181 |
| H-SEC-2 | **5 of 7 admin pages have no page-level auth** — rely solely on nav-item hiding, bypassed by direct URL. DataSeeder, Calendar, TestDashboard not even in nav. | Multiple admin pages | — |
| H-SEC-3 | **postMessage('*') without origin validation** — 6 calls across main.jsx, NavigationTracker, VisualEditAgent. Platform-managed constraint. | `src/lib/VisualEditAgent.jsx` | 242, 404, 488, 534 |
| H-SEC-4 | **SSRF risk in fetchUrlMetadata** — OpenGraph fallback fetches arbitrary user-supplied URLs from server side with no private IP blocking | `functions/fetchUrlMetadata.ts` | 191-238 |
| H-SEC-5 | **XSS in email HTML** — `messagePreview` and `senderName` interpolated into HTML without sanitization | `functions/sendChatNotification.ts` | 65, 68 |
| H-SEC-6 | **No CSRF protection** on public submission forms — any domain can programmatically submit. Partially mitigated by idempotency keys. | `serveSpeakerSubmission.ts`, `serveWeeklyServiceSubmission.ts` | — |
| H-SEC-7 | **Sensitive data logged** — Director email logged in plaintext | `functions/sendChatNotification.ts` | 90 |

### Bugs

| # | Finding | File | Line |
|---|---------|------|------|
| H-BUG-1 | **C2 violation: Hard delete in WeeklyServiceManager** — `AnnouncementItem.delete(id)` permanently destroys user content. AnnouncementsReport correctly uses soft-delete. | `src/pages/WeeklyServiceManager.jsx` | 549 |
| H-BUG-2 | **C2 violation: No delete guards anywhere** — Event.delete, Session.delete, Segment.delete, StreamBlock.delete execute unconditionally regardless of parent status. Completed event data can be destroyed. | Multiple (Events, SessionManager, SegmentList, StreamBlockList) | — |
| H-BUG-3 | **Client PDF ignores `reportType`** — function signature doesn't destructure it. All 6 report types produce identical "detailed" output. | `generateEventReportsPDFClient.jsx` | 48 |
| H-BUG-4 | **Tailwind JIT dynamic classes** — `bg-${accentColor}-50` etc. won't be included in production CSS. Fixed for header but remains at 4 other sites. | `ServiceTimeSlotColumn.jsx` | 161, 263, 376, 387 |
| H-BUG-5 | **Stale permission key in tests** — `view_live_program` referenced in 5 places but doesn't exist. Should be `access_my_program`. Tests silently fail. | `permissions.test.jsx` | 33, 48, 57, 101, 122 |
| H-BUG-6 | **Missing LiveManager role in selector** — UserManagement role dropdown omits LiveManager. Users can't be assigned this role. | `UserManagement.jsx` | 462-498 |

### Architecture

| # | Finding | File |
|---|---------|------|
| H-ARCH-1 | **Dual auth systems** — Layout.jsx and AuthContext.jsx independently call `base44.auth.me()`, creating two parallel auth flows. i18n.jsx adds a third. | Layout, AuthContext, i18n |
| H-ARCH-2 | **RoleTemplate entities never consumed** — `RolePermissionManager` creates templates but `hasPermission()` only reads from hardcoded `DEFAULT_ROLE_PERMISSIONS`. Dead data. | RolePermissionManager, permissions.jsx |
| H-ARCH-3 | **ServiceTemplatesTab.jsx is likely obsolete** — superseded by BlueprintEditor.jsx. Uses different query key (`sunday-blueprint` vs `serviceBlueprint`). Contains 150 lines of stale hardcoded defaults. | ServiceTemplatesTab.jsx |
| H-ARCH-4 | **Code divergence: getPublicProgramData vs refreshActiveProgram** — 838 vs 723 lines implementing similar program assembly. refreshActiveProgram has dynamic slot detection and bulk fetch; getPublicProgramData uses hardcoded slots and sequential fetching. | functions/ |
| H-ARCH-5 | **Deprecated browser API** — `document.execCommand` used for bold/italic/insert in StaticAnnouncementForm | StaticAnnouncementForm.jsx | 55, 61 |

---

## Constitution Compliance Summary

| Rule | Verdict | Key Findings |
|------|---------|-------------|
| **C1: No schema changes** | PASS | No runtime schema mutations found |
| **C2: No destructive operations** | FAIL | `.delete()` calls in 14+ files; hard-delete on announcements; delete-first sync in sessionSync; no status guards on any entity delete |
| **C3: Bilingual (EN/ES)** | FAIL | 7+ pages with zero i18n; ~300 hardcoded strings; ActivityLog imports `t()` but never uses it |
| **C4: Platform constraints** | PASS | No Node.js APIs in frontend |
| **C5: Dependency tracking** | PASS | DependencyTracker UI is complete and well-built |
| **C6: Read-only transforms** | PASS | All designated transform files confirmed pure |

---

## Decision Compliance Summary

| Decision | Verdict | Key Findings |
|----------|---------|-------------|
| **D1: pdfmake sole PDF library** | PASS | Zero imports of jspdf, @react-pdf/renderer, or alternatives |
| **D2: Optimistic locking (useStaleGuard)** | FAIL | WeeklyServiceManager checkStale never called; auto-save also bypasses stale guard |
| **D5: In-browser tests** | PASS | 11 test suites, all run in-browser, no Node.js assumptions |
| **D6: safeLocalStorage** | PASS | All localStorage access uses safe wrappers (except bootstrap `app-params.js` which is acceptable) |
| **D7: React Query for all reads** | PARTIAL | ~10 files with direct entity fetches outside useQuery |
| **D8: Centralized query keys** | FAIL | 100+ inline keys; centralized keys defined but never used. 30+ ad-hoc patterns. |
| **D9: Error Boundaries** | PASS | Single top-level boundary wraps all pages; no boundary at App level (gap if Layout throws) |

---

## Module Scorecards

| Module | Files | Cleanliness | Efficiency | Risk Level | Top Issue |
|--------|-------|-------------|------------|------------|-----------|
| **Platform** | ~105 | 4/5 | 3/5 | MEDIUM | Triple auth.me(), 22 dead UI files, postMessage('*') |
| **WeeklyServices** | ~25 | 3/5 | 3/5 | HIGH | checkStale dead code, state mutation bugs, 150+ hardcoded strings |
| **EventPro** | ~46 | 4/5 | 4/5 | MEDIUM | No delete status guards, SessionManager 1,143 lines zero i18n |
| **LiveOps** | ~33 | 4/5 | 4/5 | LOW | LiveOperationsChat zero i18n, proper subscription cleanup |
| **ServiceCommon** | ~22 | 3/5 | 3/5 | HIGH | Hooks violation, sessionSync delete-first, state mutations |
| **Reports & PDF** | ~36 | 4/5 | 3/5 | MEDIUM | reportType ignored, 5 dead pages, 2 empty files, duplicated logic |
| **Announcements** | ~8 | 3/5 | 3/5 | MEDIUM | Zero i18n, deprecated execCommand, hard delete vs soft delete inconsistency |
| **People & Auth** | ~8 | 4/5 | 4/5 | HIGH | Privilege escalation, no page-level auth, dual auth systems |
| **Public** | ~15 | 4/5 | 4/5 | MEDIUM | XSS in weekly submission form, no CSRF, data over-exposure |
| **Admin** | ~12 | 4/5 | 4/5 | LOW | 5/7 pages no auth check, stale docs, dead test suite |
| **Backend** | 27 | 4/5 | 3/5 | MEDIUM | Code divergence, ~810 lines BIBLE_BOOKS duplication, 4 dead files |

---

## Dead Code Inventory

### Files to Delete

| File | Lines | Reason |
|------|-------|--------|
| 22 dead UI wrappers in `src/components/ui/` | 2,631 | Zero consumers |
| 6 dead utility files in `src/components/utils/` | 608 | Zero consumers (errorHandler, liveAdjustmentHelpers, liveStatusHelpers, brandStyles, lazyPages, serviceTimeMath) |
| `src/components/service/pdf/ServicePdfPreview.jsx` | 0 | Empty file |
| `src/components/service/pdf/ServiceProgramPdf.jsx` | 0 | Empty file |
| `src/components/service/generateEventReportsPDFClient.js.bak.jsx` | 5 | Backup in source control |
| `functions/generateServicePdf.ts` | 0 | Empty file |
| `functions/generateServiceProgramPdf.ts` | 0 | Empty file |
| `functions/syncGraduacionSegments.ts` | 133 | Completed one-off migration; destructive if re-run |
| `functions/syncFeb22Segments.ts` | ~130 | Completed one-off migration |
| `src/Dashboard.js` | 0 | Empty orphan; real dashboard is `pages/Dashboard.jsx` |
| `src/utils/timeFormat.js` | 0 | Empty; real file is `components/utils/timeFormat.jsx` |
| 5 placeholder pages (DetailedProgram, GeneralProgram, ProjectionView, SoundView, UshersView) | 100 | Dead routes; real views live in `components/report/` |
| 2 dead doc files in `src/components/utils/` | 208 | GMAIL_API_PLAN.md.jsx, SEGMENT_REGRESSION_CHECKLIST.md.jsx — never imported |

**Total dead code: ~3,815+ lines** across 42 files.

### Unused Dependencies to Remove (19 packages)

**Completely unused (4):** `lodash`, `zod`, `@hookform/resolvers`, `react-hook-form`

**Only in dead UI wrappers (14):** `embla-carousel-react`, `input-otp`, `react-resizable-panels`, `vaul`, `cmdk`, `recharts`, `@radix-ui/react-hover-card`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-context-menu`, `@radix-ui/react-toggle-group`, `@radix-ui/react-progress`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-toggle`

**Wrong framework (1):** `next-themes` (Next.js-specific, used in Vite SPA)

---

## Unused Imports: 330 Total

- **148 files** have unnecessary `import React` (React 18 JSX transform doesn't require it)
- **182 non-React unused imports** across 63 files
- Worst offenders: `People.jsx` (13 unused), `DirectorConsole.jsx` (13 unused), `SegmentRow.jsx` (11 unused)

---

## console.* Usage: 223 Total

| Type | Count |
|------|-------|
| `console.log` | 73 (38 backend, 35 client) |
| `console.warn` | 38 |
| `console.error` | 111 |
| `console.info` | 1 |

**1 sensitive data leak:** `sendChatNotification.ts:90` logs director email in plaintext.

---

## `confirm()` / `alert()` Remaining Calls: 14 Active

| File | Line | Context |
|------|------|---------|
| `ServiceTemplatesTab.jsx` | 319, 373 | Blueprint reset/delete |
| `LiveOperationsChat.jsx` | 906 | Message delete (user-facing!) |
| `SuggestionsManager.jsx` | 186 | Suggestion delete |
| `EditHistoryModal.jsx` | 175 | Undo confirmation |
| `SessionManager.jsx` | 547 | Session delete |
| `SegmentList.jsx` | 448, 640 | Segment delete (desktop + mobile) |
| `StreamBlockList.jsx` | 107 | Block delete |
| `MessageProcessing.jsx` | 238 | Submission ignore |
| `Rooms.jsx` | 115 | Room delete |
| `Templates.jsx` | 216, 306 | Template delete |
| `SessionColumn.jsx` | 26 | Clear assignments |
| `ServiceBuilder.jsx` | 122 | Copy from previous |

---

## Duplication Inventory

| What | Copies | Files |
|------|--------|-------|
| BIBLE_BOOKS + parseScriptureReferences | 4 | submitWeeklyServiceContent, processNewSubmissionVersion, processPendingSubmissions, submitSpeakerContent (~810 lines total) |
| `calculateActionTime` algorithm | 4 | reportHelpers, cellBuilders, generateWeeklyProgramPDF, PublicProgramSegment |
| Program assembly logic | 2 | getPublicProgramData.ts (866 lines), refreshActiveProgram.ts (723 lines) |
| `withRetry` wrapper | 3 | getPublicProgramData, refreshActiveProgram, generateEventReportsPdf |
| `getNormalizedSongs()` | 3 | segmentDataUtils, segmentNormalization, normalizeProgram |
| Time formatting (12h) | 3 | timeFormat.jsx, pdfThemeSystem.jsx, generateEventReportsPdf.ts |
| Session color-to-hex map | 3 | DetailedProgramView (x2), cellBuilders |
| Art type label mapping | 5 | ProjectionReportView, SoundReportView, SegmentReportRow, cellBuilders, generateEventReportsPdf |
| VFS font initialization | 5 | pdfUtils, generateEventReportsPDFClient, generateWeeklyProgramPDF, generateAnnouncementsPDF, generateProgramPDFWithAutoFit |
| Brand gradient CSS | 5+ | DesktopSidebar, MobileNav, CustomServicesManager, TimePicker, customServicePrintStyles |
| Blueprint defaults | 3 | ServiceTemplatesTab, ensureNextSundayService, Database |
| Nav component logic | 2 | DesktopSidebar (342 lines), MobileNav (283 lines) — ~70% shared logic |
| Announcement list component | 2 | AnnouncementListSelector, WeeklyAnnouncementSection — nearly identical |

---

## i18n Gap Summary

### Pages with Zero i18n Integration
`SchemaGuide`, `TestDashboard`, `BuildMemory`, `DependencyTracker`, `SessionDetail`, `MessageProcessing`, `WeeklyServiceReport`, `PageNotFound`, `UserNotRegisteredError`

### Components with Zero i18n (Worst 10)
1. `SessionManager.jsx` — 100+ hardcoded strings (1,143-line core component)
2. `ScheduleReview.jsx` — 1,050 lines, all Spanish hardcoded
3. `LiveOperationsChat.jsx` — 1,012 lines, ~20 hardcoded strings
4. `ServiceTimeSlotColumn.jsx` — 35+ hardcoded strings
5. `SegmentTimelineCard.jsx` — zero `t()` calls
6. `StreamBlockForm.jsx` — all English hardcoded
7. `StreamBlockList.jsx` — all English hardcoded
8. `AnnouncementSeriesManager.jsx` — all Spanish hardcoded
9. `SuggestionsManager.jsx` — all Spanish hardcoded
10. `ActivityLog.jsx` — imports `t()` but never uses it (all Spanish)

---

## Prioritized Remediation Roadmap

### Tier 1: Security & Data Integrity (This Week)

1. **CRIT-1:** Fix XSS in `serveWeeklyServiceSubmission.ts` — JSON injection + unescaped error
2. **CRIT-2:** Fix Hooks violation in `WeeklyServiceInputs.jsx` — move early return after hooks
3. **CRIT-6:** Fix 3 remaining state mutation bugs (useWeeklyServiceHandlers, ServiceTemplatesTab, SegmentTimelineCard)
4. **CRIT-7:** Wire `checkStale()` into WeeklyServiceManager save path
5. **CRIT-9:** Upgrade sessionSync.jsx to create-before-delete pattern
6. **H-SEC-1:** Add `hasPermission` guard to UserManagement page component
7. **H-SEC-5:** Sanitize email HTML in sendChatNotification.ts
8. **H-BUG-1:** Fix hard-delete in WeeklyServiceManager — change to soft-delete

### Tier 2: Dead Code & Dependencies (Next Sprint)

9. **CRIT-3 + CRIT-5:** Remove 19 unused npm packages and 42 dead files (~3,815 lines)
10. Remove 330 unused imports across 63 files
11. **CRIT-8:** Rewrite reportHelpers.test.jsx to use describe/it/expect
12. **CRIT-10:** Consolidate triple auth.me() into useCurrentUser()
13. Re-enable React.StrictMode in `main.jsx`

### Tier 3: Architecture & Compliance (Planned)

14. **CRIT-4:** Migrate all inline query keys to centralized `queryKeys.jsx`
15. **H-ARCH-2:** Connect RoleTemplate entities to hasPermission() or remove dead system
16. **H-BUG-3:** Add reportType filtering to generateEventReportsPDFClient
17. Replace 14 `confirm()`/`alert()` calls with dialog components
18. Add page-level `hasPermission` checks to all 5 unguarded admin pages
19. Add delete status guards to Event/Session/Segment/StreamBlock delete operations
20. Deprecate and remove `syncGraduacionSegments.ts` and `syncFeb22Segments.ts`

### Tier 4: Quality & Consistency (Ongoing)

21. i18n pass for top 10 worst-offending components
22. Consolidate duplicated utility functions (BIBLE_BOOKS, calculateActionTime, withRetry, getNormalizedSongs)
23. Extract shared backend logic from getPublicProgramData/refreshActiveProgram
24. Remove 73 `console.log` statements (prioritize 35 client-side)
25. Add page-level error boundaries for high-risk components
26. Add `staleTime` to React Query client configuration
27. Replace deprecated `document.execCommand` in StaticAnnouncementForm
28. Fix LIME color discrepancy (`#D7DF23` vs `#D9DF32`)

---

## Positive Patterns Worth Preserving

- **Phase 3 decompositions** — cleanly executed across 4 major components
- **normalizeProgram.jsx** — exemplary read-only transform with explicit Constitution compliance header
- **useStaleGuard** — well-designed optimistic locking hook (just needs broader adoption)
- **LiveOps Director Console** — clean 6-component architecture with proper lock/hold/cascade flow
- **In-browser test framework** — creative D5-compliant solution with 11 test suites
- **pdfThemeSystem.jsx** — excellent centralized PDF theming
- **archiveLiveOperationsMessages.ts** — model C2 compliance (archive, not delete)
- **getSegmentsBySessionIds.ts** and **getSortedSessions.ts** — model backend functions
- **DependencyTracker** — well-built Constitution §5 UI
- **safeLocalStorage** — comprehensive error handling for all edge cases
- **LiveOperationsChat soft-delete** — uses `is_archived: true` with audit trail (C2 model)
- **useActiveProgramCache** — excellent subscription cleanup with debounced invalidation
- **serveSpeakerSubmission.ts** — comprehensive `escapeHtml()` coverage (model for serveWeeklyServiceSubmission)
- **weeklySessionSync.jsx** — create-before-delete pattern (model for sessionSync)
- **ActivityLog.jsx** — best admin auth pattern (`hasPermission` + access-denied UI)
- **Zero TODO/FIXME/HACK comments** — remarkably clean codebase

---

*This report was generated by a comprehensive re-audit of the entire codebase (post-rebase) using 12 parallel analysis agents across 12 phases. Each file referenced includes specific line numbers for verification.*
