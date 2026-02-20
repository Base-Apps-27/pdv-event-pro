# PDV Event Pro — Comprehensive Codebase Audit Report

> **Date:** 2026-02-20
> **Scope:** Full codebase — 332+ files, ~75,000 lines of code
> **Methodology:** 15 parallel audit agents across 12 phases (A-L)
> **Status:** Complete

---

## Executive Summary

The codebase is a **professional, well-architected event management platform** that has undergone significant recent refactoring (Phase 3 decompositions, Phase 7 performance optimizations). The architecture is sound, with clear separation of concerns, a centralized design system (shadcn/ui + Tailwind), and a robust utility layer.

**However, the audit uncovered 127 distinct findings across 5 severity levels:**

| Severity | Count | Examples |
|----------|-------|---------|
| **Critical** | 8 | XSS in public form, undefined `user` variable, dead dependencies |
| **High** | 19 | Privilege escalation surface, state mutation bugs, stale permission keys |
| **Medium** | 48 | i18n gaps, `confirm()` calls, duplicated logic, missing staleTime |
| **Low** | 38 | Unused imports, console.logs, naming inconsistencies |
| **Info** | 14 | Positive patterns, documentation notes |

### Health Dashboard

| Dimension | Grade | Summary |
|-----------|-------|---------|
| **Code Cleanliness** | B- | 124 console statements, 101 unused imports, 860-line dead file, but overall well-organized |
| **Efficiency** | B | Good React Query adoption, but missing staleTime globally, N+1 queries in backend |
| **Constitution Compliance** | C+ | 17 `.delete()` calls (3 bulk), i18n gaps in 20+ files, read-only transforms PASS |
| **Decision Compliance** | C | D1 (pdfmake) PASS, D8 (query keys) systemically FAILED, D2 (stale guard) partially FAILED |
| **Security** | C+ | XSS in public form, SSRF risk, token in localStorage, postMessage('*') |

---

## Critical Findings (Fix Immediately)

### CRIT-1: XSS in Public Speaker Submission Form
**File:** `functions/serveSpeakerSubmission.ts`
**Lines:** 80, 97, 115, 127, 399, 416, 430, 588

Event names, session names, speaker names, and error messages are interpolated directly into HTML template literals without escaping. Any admin-controlled field containing `<script>` would execute in the browser of anonymous users visiting the submission form.

**Fix:** Add an HTML escape function (replace `<>&"'` with HTML entities) and apply to all interpolated values.

---

### CRIT-2: `user` Variable Undefined in CustomServiceBuilder
**File:** `src/pages/CustomServiceBuilder.jsx`
**Lines:** 192-194

The `logUpdate` and `logCreate` calls reference `user`, which is never declared or imported. This throws a `ReferenceError` on every service save.

**Fix:** Add `const { user } = useCurrentUser()` hook.

---

### CRIT-3: Dead Dependencies Bloating Bundle (~120-150KB)
**Files:** `package.json`

4 completely unused packages: `lodash` (~70KB), `zod` (~13KB), `@hookform/resolvers` (~5KB), `react-hook-form`. Plus 10 Radix UI packages with wrappers that are never imported by any consumer.

**Fix:** Remove from `package.json` and delete corresponding unused wrapper files.

---

### CRIT-4: Centralized Query Keys Never Used (D8 Systemic Failure)
**File:** `src/components/utils/queryKeys.jsx`

The centralized query key factories (`segmentKeys`, `sessionKeys`, `editLogKeys`) are defined but **never used as `queryKey:` values in any `useQuery` call**. All 100+ `useQuery` calls use inline string arrays. This undermines cache consistency and makes refactoring error-prone.

**Fix:** Migrate all inline `queryKey: [...]` usages to centralized key factories. Extend `queryKeys.jsx` to cover all entity types.

---

### CRIT-5: 6 Entirely Dead Utility Files
**Directory:** `src/components/utils/`

6 files export functions that are never imported anywhere:
- `errorHandler.jsx` (4 exports)
- `liveAdjustmentHelpers.jsx` (2 exports)
- `liveStatusHelpers.jsx` (1 export)
- `brandStyles.jsx` (6 exports)
- `lazyPages.jsx` (6 exports)
- `serviceTimeMath.jsx` (4 exports)

**Fix:** Delete these files.

---

### CRIT-6: 860-Line Dead Component (SegmentForm.jsx)
**File:** `src/components/session/SegmentForm.jsx`

Never imported anywhere. The active form is `SegmentFormTwoColumn.jsx`. The dead file has diverged (different segment types, missing newer features like field origins, concurrent edit guard, overlap detection).

**Fix:** Delete the file.

---

### CRIT-7: State Mutation Bug in ServiceTimeSlotColumn
**File:** `src/components/service/ServiceTimeSlotColumn.jsx`
**Lines:** 284, 450

```js
setServiceData(prev => {
  const updated = { ...prev };
  updated[timeSlot][idx].duration = newDuration; // MUTATES prev!
  return updated;
});
```

Shallow spread does not deep-clone nested arrays. This mutates React state in-place, violating React's immutability contract and causing missed re-renders.

**Fix:** Deep-clone the nested array: `updated[timeSlot] = [...prev[timeSlot]]` then `updated[timeSlot][idx] = { ...updated[timeSlot][idx], duration: newDuration }`.

---

### CRIT-8: Duplicate Permission Definitions with Stale Keys
**File:** `src/pages/UserManagement.jsx`
**Lines:** 221-235

Local `getRolePermissions()` duplicates `DEFAULT_ROLE_PERMISSIONS` from `permissions.jsx` but is incomplete (missing 3 roles) and uses stale key `view_live_program` instead of the canonical `access_my_program`. This causes incorrect permission UI checkboxes.

**Fix:** Remove the local duplicate and import from `permissions.jsx`.

---

## High-Severity Findings

### Security

| # | Finding | File | Line |
|---|---------|------|------|
| H-SEC-1 | **postMessage('*') without origin validation** — sends DOM manipulation commands to any parent window and accepts commands from any origin | `src/lib/VisualEditAgent.jsx` | 166, 242, 404, 415, 488, 534 |
| H-SEC-2 | **Auth token stored in localStorage** — vulnerable to XSS. Token also passes via URL parameter (visible in browser history/logs) | `src/lib/app-params.js` | 23 |
| H-SEC-3 | **No privilege escalation protection** — UserManagement has no check preventing users from editing their own role to Admin | `src/pages/UserManagement.jsx` | — |
| H-SEC-4 | **SSRF risk in fetchUrlMetadata** — OpenGraph fallback fetches arbitrary user-supplied URLs from server side with no private IP blocking | `functions/fetchUrlMetadata.ts` | 191-238 |
| H-SEC-5 | **XSS in email HTML** — `messagePreview` and `senderName` interpolated into HTML without sanitization | `functions/sendChatNotification.ts` | 65, 68 |

### Bugs

| # | Finding | File | Line |
|---|---------|------|------|
| H-BUG-1 | **Mobile onClick short-circuit** — `setEditingField('start') && setEditValue(...)` never calls `setEditValue` because setState returns undefined | `src/components/service/LiveDirectorPanel.jsx` | 170 |
| H-BUG-2 | **Takeover notification uses wrong field names** — message won't appear in chat | `functions/updateLiveSegmentTiming.ts` | 286-293 |
| H-BUG-3 | **sessionSync parent-child mapping bug** — all sub-segments assigned to first parent when multiple Alabanza segments exist | `src/components/service/sessionSync.jsx` | 157-183 |
| H-BUG-4 | **Auto-save hardcodes `service_type: 'one_off'`** instead of using `resolvedServiceType` | `src/pages/CustomServiceBuilder.jsx` | 243 |
| H-BUG-5 | **Delete mutation type mismatch** — `deleteMutation.mutate(item.id)` but mutationFn expects `{id}` | `src/pages/AnnouncementsReport.jsx` | 204 |
| H-BUG-6 | **Client PDF ignores `reportType`** — always generates detailed report regardless of parameter | `src/components/service/generateEventReportsPDFClient.jsx` | — |
| H-BUG-7 | **Tailwind JIT dynamic class** — `text-${accentColor}-600` won't be included in production CSS | `src/components/service/ServiceTimeSlotColumn.jsx` | 81 |

### Architecture

| # | Finding | File |
|---|---------|------|
| H-ARCH-1 | **Dual auth systems** — Layout.jsx and AuthContext.jsx independently call `base44.auth.me()`, creating two parallel auth flows | `src/Layout.jsx`, `src/lib/AuthContext.jsx` |
| H-ARCH-2 | **`requiresAuth: false` on API client** — SDK doesn't enforce auth; relies entirely on manual client-side checks | `src/api/base44Client.js:12` |
| H-ARCH-3 | **RoleTemplate entities never consumed** — `RolePermissionManager` creates templates but `hasPermission()` only reads from hardcoded `DEFAULT_ROLE_PERMISSIONS` | `src/pages/RolePermissionManager.jsx`, `src/components/utils/permissions.jsx` |
| H-ARCH-4 | **WeeklyServiceManager imports useStaleGuard but never calls checkStale** — concurrent editors silently overwrite each other | `src/pages/WeeklyServiceManager.jsx` |
| H-ARCH-5 | **Duplicate toast systems** — Both custom Radix toast and Sonner installed; 45 files call Sonner's `toast()` but only the Radix `<Toaster/>` is mounted in App.jsx | `src/App.jsx`, multiple |

---

## Constitution Compliance Summary

| Rule | Verdict | Key Findings |
|------|---------|-------------|
| **C1: No schema changes** | PASS | No runtime schema mutations found |
| **C2: No destructive operations** | FAIL | 17 `.delete()` calls across 14 files; 3 bulk delete patterns (sessionSync, weeklySessionSync, syncGraduacionSegments) |
| **C3: Bilingual (EN/ES)** | FAIL | 7 pages with zero i18n; ~252 hardcoded placeholders; 20+ files with significant untranslated strings |
| **C4: Platform constraints** | PASS | No Node.js APIs in frontend; `window`/`document` unguarded but acceptable for SPA |
| **C6: Read-only transforms** | PASS | All 3 designated transform files confirmed pure — zero writes |

---

## Decision Compliance Summary

| Decision | Verdict | Key Findings |
|----------|---------|-------------|
| **D1: pdfmake sole PDF library** | PASS | Zero imports of jspdf, @react-pdf/renderer, or alternatives |
| **D2: Optimistic locking (useStaleGuard)** | FAIL | WeeklyServiceManager skips stale check; 15+ entity update paths completely unguarded |
| **D5: In-browser tests** | PASS | 11 test suites, all run in-browser, no Node.js assumptions |
| **D6: safeLocalStorage** | FAIL | 2 raw `localStorage` calls in TestDashboard |
| **D7: React Query for all reads** | PARTIAL | ~10 files with direct entity fetches outside useQuery |
| **D8: Centralized query keys** | FAIL | 100+ inline keys; centralized keys defined but never used in any useQuery |
| **D9: Error Boundaries** | PASS | Single top-level boundary wraps all pages (advisory: no page-level boundaries) |

---

## Module Scorecards

| Module | Files | Cleanliness | Efficiency | Risk Level | Top Issue |
|--------|-------|-------------|------------|------------|-----------|
| **Platform** | ~105 | 4/5 | 3/5 | MEDIUM | Dual auth, missing staleTime, postMessage('*') |
| **WeeklyServices** | ~25 | 3/5 | 3/5 | MEDIUM | State mutation bug, dual auto-save timers, blueprint triple-copy |
| **EventPro** | ~46 | 4/5 | 4/5 | MEDIUM | Dead SegmentForm.jsx, SessionManager no i18n, confirm() calls |
| **LiveOps** | ~18 | 4/5 | 4/5 | LOW | Mobile onClick bug, takeover notification wrong fields |
| **ServiceCommon** | ~22 | 3/5 | 3/5 | HIGH | `user` undefined bug, sessionSync delete-recreate, parent mapping |
| **Reports & PDF** | ~25 | 4/5 | 3/5 | MEDIUM | reportType ignored, 100% function duplicate, 4 empty files |
| **Announcements** | ~5 | 3/5 | 3/5 | MEDIUM | Zero i18n, deprecated execCommand, sort_strategy not consumed |
| **People & Auth** | ~6 | 4/5 | 4/5 | HIGH | Privilege escalation surface, stale permission key |
| **Public** | ~15 | 4/5 | 4/5 | HIGH | XSS in serveSpeakerSubmission.ts |
| **Admin** | ~12 | 4/5 | 4/5 | LOW | Stale documentation, inconsistent auth patterns |
| **Backend** | 26 | 4/5 | 3/5 | MEDIUM | Code divergence between getPublicProgramData/refreshActiveProgram |

---

## Dead Code Inventory

### Files to Delete

| File | Lines | Reason |
|------|-------|--------|
| `src/components/session/SegmentForm.jsx` | 860 | Never imported; replaced by SegmentFormTwoColumn |
| `src/components/utils/errorHandler.jsx` | 139 | Zero consumers |
| `src/components/utils/liveAdjustmentHelpers.jsx` | 91 | Zero consumers |
| `src/components/utils/liveStatusHelpers.jsx` | 97 | Zero consumers |
| `src/components/utils/brandStyles.jsx` | 80 | Zero consumers |
| `src/components/utils/lazyPages.jsx` | 24 | Zero consumers |
| `src/components/utils/serviceTimeMath.jsx` | 177 | Zero consumers |
| `src/components/service/pdf/ServicePdfPreview.jsx` | 0 | Empty file |
| `src/components/service/pdf/ServiceProgramPdf.jsx` | 0 | Empty file |
| `functions/generateServicePdf.ts` | 0 | Empty file |
| `functions/generateServiceProgramPdf.ts` | 0 | Empty file |
| `src/components/service/generateEventReportsPDFClient.js.bak.jsx` | — | Backup committed to source control |
| 5 placeholder pages (DetailedProgram, GeneralProgram, ProjectionView, SoundView, UshersView) | 100 | Dead routes; real views live in components/report/ |

**Total dead code: ~1,568+ lines** across 17 files.

### Unused Dependencies to Remove

**Completely unused (14 packages):**
`lodash`, `zod`, `@hookform/resolvers`, `react-hook-form`, `@radix-ui/react-toast`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-context-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-progress`, `@radix-ui/react-toggle-group`, `embla-carousel-react`, `input-otp`, `react-resizable-panels`

**Wrong framework:** `next-themes` (Next.js-specific, used in Vite SPA)

---

## Duplication Inventory

| What | Copies | Files |
|------|--------|-------|
| `getNormalizedSongs()` | 3 | segmentDataUtils, segmentNormalization, normalizeProgram |
| Time formatting (12h) | 3 | timeFormat.jsx, pdfThemeSystem.jsx, generateEventReportsPdf.ts |
| `calculateActionTime` | 2 | reportHelpers.jsx, cellBuilders.jsx |
| `mergePreSessionDetails` | 2 | reportHelpers.jsx, generateEventReportsPdf.ts |
| `buildPrepActionRow` / `buildBreakPrepActionRow` | 2 (identical) | sectionBuilders.jsx |
| Blueprint defaults | 3 | ServiceTemplatesTab, ensureNextSundayService, Database |
| BIBLE_BOOKS + parseScriptureReferences | 4 | submitWeeklyServiceContent, processNewSubmissionVersion, processPendingSubmissions, submitSpeakerContent |
| `withRetry` wrapper | 3 | getPublicProgramData, refreshActiveProgram, generateEventReportsPdf |
| Session color-to-hex map | 3 | DetailedProgramView (x2), cellBuilders |
| Art type label mapping | 5 | ProjectionReportView, SoundReportView, SegmentReportRow, cellBuilders, generateEventReportsPdf |
| Brand gradient CSS | 5+ | DesktopSidebar, MobileNav, CustomServicesManager, TimePicker, customServicePrintStyles |
| Program assembly logic | 2 | getPublicProgramData.ts (838 lines), refreshActiveProgram.ts (723 lines) |

---

## `confirm()` / `alert()` Remaining Calls

| File | Line | String |
|------|------|--------|
| `ServiceTemplatesTab.jsx` | 319, 373 | Spanish confirmation dialogs |
| `LiveOperationsChat.jsx` | 906 | `'¿Eliminar este mensaje?'` |
| `SuggestionsManager.jsx` | 186 | Dynamic delete confirmation |
| `EditHistoryModal.jsx` | 175 | Restore confirmation |
| `SessionManager.jsx` | 547 | Session delete confirmation |
| `SegmentList.jsx` | 448, 640 | Segment delete confirmations |
| `StreamBlockList.jsx` | 107 | Block delete confirmation |
| `MessageProcessing.jsx` | 238 | Submission ignore confirmation |
| `serveSpeakerSubmission.ts` | 562 | `alert('Mensaje enviado')` |

**Total: 11 calls across 9 files** — all should be replaced with dialog components.

---

## i18n Gap Summary

### Pages with Zero i18n Integration (7)
`SchemaGuide`, `TestDashboard`, `BuildMemory`, `DependencyTracker`, `SessionDetail`, `MessageProcessing`, `WeeklyServiceReport`

### Components with Zero i18n (Worst 10)
1. `ScheduleReview.jsx` — 42 hardcoded strings
2. `SessionManager.jsx` — 26 hardcoded strings (1,143-line core component)
3. `SegmentForm.jsx` — 21 (dead code, can delete)
4. `StreamBlockForm.jsx` — 17
5. `SubmissionDiagnosticModal.jsx` — 17
6. `AnnouncementSeriesManager.jsx` — 14
7. `EventEditDialog.jsx` — 11
8. `SegmentFormTwoColumn.jsx` — 10
9. `SegmentTimelineCard.jsx` — 10 (entire component, zero `t()` calls)
10. `SuggestionsManager.jsx` — all strings hardcoded Spanish

### Hardcoded Placeholders: ~252 across 42 files

---

## Prioritized Remediation Roadmap

### Tier 1: Security & Data Integrity (Do This Week)

1. **CRIT-1:** Add HTML escaping to `serveSpeakerSubmission.ts` — XSS on public form
2. **CRIT-2:** Add `useCurrentUser()` to `CustomServiceBuilder.jsx` — ReferenceError on every save
3. **CRIT-7:** Fix state mutation in `ServiceTimeSlotColumn.jsx` — silent data corruption
4. **H-BUG-1:** Fix mobile onClick short-circuit in `LiveDirectorPanel.jsx`
5. **H-BUG-2:** Fix takeover notification field names in `updateLiveSegmentTiming.ts`
6. **H-SEC-1:** Add origin validation to `VisualEditAgent.jsx` postMessage calls
7. **CRIT-8:** Remove duplicate `getRolePermissions()` from `UserManagement.jsx`

### Tier 2: Dead Code & Dependencies (Next Sprint)

8. **CRIT-3:** Remove 15+ unused npm packages
9. **CRIT-5 + CRIT-6:** Delete 17 dead files (~1,568 lines)
10. **H-ARCH-5:** Resolve duplicate toast systems — mount Sonner `<Toaster/>` or migrate to Radix
11. Remove 101 unused imports across 28 files
12. Re-enable React.StrictMode in `main.jsx`

### Tier 3: Architecture & Compliance (Planned)

13. **CRIT-4:** Migrate all inline query keys to centralized `queryKeys.jsx`
14. **H-ARCH-1:** Consolidate dual auth systems
15. **H-ARCH-4:** Wire `checkStale` into WeeklyServiceManager save path
16. Replace 11 `confirm()`/`alert()` calls with dialog components
17. Fix `buildBreakPrepActionRow` 100% duplication in sectionBuilders.jsx
18. Deprecate `syncGraduacionSegments.ts` (one-off migration complete)

### Tier 4: Quality & Consistency (Ongoing)

19. i18n pass for top 10 worst-offending components
20. Consolidate duplicated utility functions (time formatting, getNormalizedSongs, calculateActionTime)
21. Extract shared backend logic from getPublicProgramData/refreshActiveProgram
22. Remove 124 console statements (prioritize 40 `console.log` calls)
23. Add page-level error boundaries for high-risk components
24. Add `staleTime` to React Query client configuration

---

## Positive Patterns Worth Preserving

- **Phase 3 decompositions** were executed cleanly (WeeklyServiceManager 4,261→928, CustomServiceBuilder 2,064→474, SegmentFormTwoColumn 2,066→421, Reports 1,609→427)
- **normalizeProgram.jsx** — exemplary read-only transform with explicit Constitution compliance header
- **useStaleGuard** — well-designed optimistic locking hook (just needs broader adoption)
- **LiveOps Director Console** — clean 6-component architecture with proper lock/hold/cascade flow
- **In-browser test framework** — creative D5-compliant solution with 11 test suites
- **pdfThemeSystem.jsx** — excellent centralized PDF theming
- **archiveLiveOperationsMessages.ts** — model Constitution C2 compliance (archive, not delete)
- **getSegmentsBySessionIds.ts** and **getSortedSessions.ts** — model backend functions (clean, focused, well-documented)
- **DependencyTracker** — well-built Constitution §5 UI
- **safeLocalStorage** — comprehensive error handling for all edge cases

---

*This report was generated by a comprehensive audit of the entire codebase using 15 parallel analysis agents. Each file referenced includes specific line numbers for verification.*
