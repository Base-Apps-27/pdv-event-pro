# Technical Debt Remediation & Production Readiness

> Comprehensive plan to address all 12 audit sections plus 3 self-identified gaps (subscription cleanup, concurrent editing, accessibility), achieving a codebase that is stable, maintainable, traceable, and ready for team expansion.

## Problem Restatement

The audit identified systemic technical debt across architecture, duplication, error handling, testing, i18n, performance, dependencies, documentation, monitoring, and storage. Three additional self-identified risks (subscription leaks, concurrent editing, accessibility) compound the picture. A remediation plan is needed that sequences work correctly, respects platform constraints, avoids data loss, and produces provable progress at each stage.

## Affected Surfaces

| Surface | Sections Affected |
|---------|-------------------|
| Pages (all ~20+) | §1, §2, §3, §5, §6, §7, §14 |
| Components (~60+) | §1, §2, §3, §5, §7, §13, §14 |
| Functions (~10) | §8, §9 |
| Entities (~25) | §9 (documentation only, no schema changes) |
| Layout.js | §3, §5 |
| globals.css | §14 |
| Package dependencies | §8 |
| localStorage | §12 |
| Platform config (index.html, main.jsx) | §6, §9 |

---

## Phased Remediation Plan

### PHASE 0 — SAFETY NET (Days 1–2)

Everything here exists to make subsequent phases reversible.

| # | Task | Section | Scope | Details |
|---|------|---------|-------|---------|
| 0.1 | Pin pdfmake version | §8 | Trivial | Replace `"latest"` with specific semver in package.json. Zero code changes, eliminates supply-chain risk immediately. |
| 0.2 | Update index.html title | §9 | Trivial | Change `<title>Base44 APP</title>` to `<title>PDV Event Pro</title>`. |
| 0.3 | Snapshot current entity schemas | Safety | Small | Read all ~25 entity JSON files, create a Decision entry documenting the complete data model as of this date. This becomes the baseline reference for all subsequent work. No schema modifications in any phase. |
| 0.4 | Create AttemptLog conventions entry | Safety | Trivial | Log this remediation plan as an AttemptLog so future work can reference what was planned and why. |

**Closure condition:** pdfmake pinned, title updated, schema snapshot recorded, plan logged.

---

### PHASE 1 — CRASH PREVENTION (Days 3–7)

Eliminate white-screen risks and data-loss paths.

| # | Task | Section | Scope | Details |
|---|------|---------|-------|---------|
| 1.1 | Global Error Boundary | §3 | Small | Create `components/shared/GlobalErrorBoundary.jsx`. Wrap in Layout.js. Shows bilingual "Something went wrong" with reload button. Catches render errors only (React limitation). |
| 1.2 | Director Console Error Boundary | §3 | Small | Create `components/director/DirectorErrorBoundary.jsx`. Wrap around the Director Console content area specifically. This is the highest-risk surface during live events — it gets its own boundary with contextual messaging ("Director Console encountered an error — timeline data is preserved"). |
| 1.3 | WeeklyServiceManager Error Boundary | §3 | Small | Same pattern. Wraps the main service editor. On error, surfaces the localStorage backup recovery option. |
| 1.4 | localStorage cleanup routine | §12 | Small | Create `components/shared/localStorageCleanup.js`. On app load (called from Layout.js), iterate localStorage keys matching `service_backup_*` and `pdf_cache_*`. Delete entries older than 30 days based on embedded timestamps. Log count cleaned to console. |
| 1.5 | localStorage quota guard | §12 | Small | Wrap all `localStorage.setItem` calls in a try/catch utility (`safeLocalStorageSet`). On `QuotaExceeded`, evict oldest entries first, retry once, then show toast warning. |
| 1.6 | Subscription cleanup audit | Self-ID | Medium | Audit every `useEffect` that calls `base44.entities.*.subscribe()`. Verify each returns the unsubscribe function in the cleanup. Fix any that don't. Priority files: DirectorConsole.jsx, WeeklyServiceManager.jsx, LiveOpsChat.jsx, and any component using real-time subscriptions. Document findings in AttemptLog. |

**Closure condition:** No render error can crash the full app. localStorage is bounded. All subscriptions clean up.

**Sequencing:** Phase 1 has zero dependencies on later phases. Error Boundaries and localStorage work are independent of each other — can be parallelized.

---

### PHASE 2 — SHARED FOUNDATION (Days 8–14)

Extract shared utilities that all subsequent refactors depend on.

| # | Task | Section | Scope | Details |
|---|------|---------|-------|---------|
| 2.1 | Create `components/shared/timeUtils.js` | §2 | Small | Extract: `addMinutes(HH:MM, min)`, `diffMinutes(HH:MM, HH:MM)`, `formatHHMM(Date)`, `parseHHMM(string)`, `formatDuration(min)`. Source from WeeklyServiceManager, ServiceSegmentCard, LiveTimeAdjustmentModal. Replace usages in those 3 files first, then sweep remaining files. |
| 2.2 | Create `components/shared/themeConstants.js` | §2 | Small | Extract: `SEGMENT_COLORS`, `SESSION_COLORS`, `PRINT_COLORS`, `GRADIENT_MAP`, `COLOR_CODE_MAP`. Single source of truth. Replace in 6+ components. |
| 2.3 | Create `components/shared/verseUtils.js` | §2 | Medium | Extract: `parseVerseReference(string)`, `formatVerseDisplay(parsed)`, `extractVersesFromText(string)`. Source from VerseDisplay, ServiceSegmentCard, PublicProgramView. |
| 2.4 | Create `components/shared/FormControls.jsx` | §2 | Medium | Extract: `ThemedInput`, `ThemedSelect`, `ThemedTextarea`, `ThemedLabel` — styled wrappers matching the app's dark/branded aesthetic. Replace duplicated styled inputs across pages. |
| 2.5 | Create `components/shared/errorHandler.js` | §3 | Small | `handleError(error, context, options)` — logs structured info, shows `toast.error()` with bilingual message, future-proofed for monitoring integration. Options: `{silent, blocking, severity}`. |
| 2.6 | Replace all `alert()` with AlertDialog or toast | §3 | Small | Audit codebase for `alert(` calls. Replace blocking alerts with AlertDialog component, transient alerts with `toast.error()`. Primary targets: LiveTimeAdjustmentModal, any segment operation confirmations. |
| 2.7 | Create `components/shared/useTranslationStrict.js` | §5 | Small | Wrapper hook around existing `useTranslation` that logs warnings in development when a key is missing (returns the key as fallback but `console.warn`s). This makes i18n gaps visible without breaking anything. |

**Closure condition:** Four shared utility modules exist and are imported by at least their source files. All `alert()` eliminated. Error handler integrated.

**Sequencing:** 2.1–2.4 are independent of each other (parallelize). 2.5 depends on nothing. 2.6 depends on 2.5. 2.7 depends on nothing.

---

### PHASE 3 — COMPONENT DECOMPOSITION (Days 15–28)

Break down the largest files. Each decomposition is an independent branch.

#### Branch 3A: WeeklyServiceManager Decomposition (Large)

| # | Extract | Target File | Lines Saved |
|---|---------|-------------|-------------|
| 3A.1 | Backup/restore logic | `components/service/useServiceBackup.js` (custom hook) | ~200 |
| 3A.2 | Segment timing calculations | `components/service/useSegmentTiming.js` (custom hook) — uses shared timeUtils | ~150 |
| 3A.3 | Drag-and-drop state + handlers | `components/service/useDragReorder.js` (custom hook) | ~100 |
| 3A.4 | Top toolbar (date nav, actions, export) | `components/service/ServiceToolbar.jsx` | ~150 |
| 3A.5 | Segment list container + DnD wrapper | `components/service/SegmentListContainer.jsx` | ~200 |
| 3A.6 | PDF export trigger + dialog | `components/service/ServicePDFExportDialog.jsx` | ~100 |
| 3A.7 | Real-time sync subscription logic | `components/service/useServiceSync.js` (custom hook) | ~80 |

**Target:** WeeklyServiceManager.jsx reduced from ~2,400 to ~600 lines.

**Validation:** Every feature must work identically after extraction. Manual test: create segment, reorder, export PDF, trigger backup, restore, real-time update from another tab.

#### Branch 3B: ServiceSegmentCard Decomposition (Medium)

| # | Extract | Target File |
|---|---------|-------------|
| 3B.1 | Timing display (planned vs actual, drift) | `components/service/SegmentTimingDisplay.jsx` |
| 3B.2 | Inline field editors | `components/service/SegmentFieldEditor.jsx` |
| 3B.3 | Sub-actions list | `components/service/SegmentActionsList.jsx` |
| 3B.4 | Media section (video, arts, songs) | `components/service/SegmentMediaSection.jsx` |

**Target:** ServiceSegmentCard.jsx reduced from ~1,000 to ~300 lines.

#### Branch 3C: EventsPage Decomposition (Medium)

| # | Extract | Target File |
|---|---------|-------------|
| 3C.1 | Event card | `components/events/EventCard.jsx` |
| 3C.2 | Filters bar | `components/events/EventFilters.jsx` |
| 3C.3 | Create/edit dialog | `components/events/EventFormDialog.jsx` |
| 3C.4 | CRUD operations | `components/events/useEventOperations.js` |

**Target:** EventsPage.jsx reduced from ~800 to ~350 lines.

#### Branch 3D: Remaining Large Files (Medium)

| File | Action |
|------|--------|
| EnhancedServicePDF.jsx | Extract section renderers into `PDFWorshipSection`, `PDFPlenarySection`, `PDFBreakSection` |
| PublicProgramView.jsx | Extract `PublicSegmentCard`, `PublicProgramHeader`, `PublicProgramFilters` |
| DirectorConsole.jsx | Already partially decomposed; extract `DirectorSegmentList`, `DirectorDriftPanel` if >600 lines |

**Closure condition per branch:** Original file under target line count. All features verified. AttemptLog entry written.

**Sequencing:** 3A, 3B, 3C, 3D are independent branches. 3A depends on Phase 2 utilities (timeUtils, themeConstants). 3B depends on 2.1, 2.2. 3C has no Phase 2 dependencies.

---

### PHASE 4 — DEPENDENCY CLEANUP (Days 29–35)

| # | Task | Section | Scope | Details |
|---|------|---------|-------|---------|
| 4.1 | Consolidate moment → date-fns | §8 | Medium | Audit all `import moment` and `require('moment')`. Replace with date-fns equivalents. Key patterns: `moment().format('HH:mm')` → `format(new Date(), 'HH:mm')`, `moment(x).diff(y, 'minutes')` → `differenceInMinutes(x, y)`. After full replacement, remove moment from dependencies. |
| 4.2 | Consolidate PDF libraries | §8 | Medium | Map current usage: jspdf (backend only → keep in functions/), @react-pdf/renderer (EnhancedServicePDF → keep), pdfmake (ServicePDFDocDef → keep). Remove jspdf from frontend imports if any exist. Document which library handles which use case in a Decision entry. Goal: 2 frontend PDF libs max, each with clear ownership. |
| 4.3 | Dynamic import for PDF generation | §7 | Small-Medium | In ServicePDFExportDialog (from 3A.6), lazy-load PDF libraries: `const { Document, Page } = await import('@react-pdf/renderer')`. This removes ~200KB+ from initial bundle. |
| 4.4 | Re-enable React StrictMode | §6 | Medium | Enable in main.jsx. Run the app through all major flows. Fix double-mount issues (likely: duplicate entity creates in effects, subscription double-fires). Each fix is a real bug being caught. Document all issues found and fixed in AttemptLog. |

**Closure condition:** Single date library. PDF libraries documented and scoped. StrictMode enabled with all issues resolved.

**Sequencing:** 4.1 depends on Phase 2 (timeUtils already extracted, so moment removal is cleaner). 4.2 depends on Phase 3A (PDF export extracted). 4.3 depends on 4.2. 4.4 depends on Phase 1 (subscription audit).

---

### PHASE 5 — ERROR HANDLING & MONITORING (Days 36–42)

| # | Task | Section | Scope | Details |
|---|------|---------|-------|---------|
| 5.1 | Standardize error feedback audit | §3 | Medium | Sweep all components for `console.error` without user feedback. For each: determine if user needs to know → add toast via errorHandler. For truly internal errors (non-actionable): leave as console but add structured format `{component, action, error}`. |
| 5.2 | Integrate `base44.analytics.track()` | §10 | Small | Add tracking to critical flows: `live_director_activated`, `live_director_deactivated`, `hold_placed`, `hold_finalized`, `pdf_exported`, `service_backup_restored`, `segment_created`, `segment_deleted`. Minimal properties, no PII. |
| 5.3 | Investigate Sentry feasibility | §10 | Small (investigation) | Attempt to install `@sentry/react`. Test if it initializes in Base44 runtime. If CSP blocks it, document in AttemptLog with disposition BLOCKED and implement fallback: custom ErrorLog entity + backend function that receives error reports from errorHandler. |
| 5.4 | Implement error reporting fallback | §10 | Medium (if Sentry blocked) | Create ErrorLog entity (message, stack, component, user_email, timestamp, severity). Create `functions/reportError.js`. Integrate into errorHandler.js — on severity >= 'error', fire-and-forget to backend. Retention: auto-archive after 30 days via scheduled function. |

**Closure condition:** All user-facing errors go through toast/AlertDialog. Critical flows are tracked. Error reporting exists (Sentry or custom).

**Sequencing:** 5.1 depends on Phase 2 (errorHandler exists). 5.2 is independent. 5.3 is independent. 5.4 depends on 5.3 outcome.

---

### PHASE 6 — INTERNATIONALIZATION COMPLETION (Days 43–56)

| # | Task | Section | Scope | Details |
|---|------|---------|-------|---------|
| 6.1 | String inventory | §5 | Medium | Automated grep for hardcoded Spanish strings across all components and pages. Generate a spreadsheet of file → line → string → proposed key. Priority order: (1) Director Console, (2) WeeklyServiceManager, (3) Public-facing pages, (4) Admin/settings. |
| 6.2 | Extract strings — Tier 1 (Live Operations) | §5 | Medium | Director Console, LiveOpsChat, LiveTimeAdjustmentModal, HoldFinalization — all surfaces used during live events where language switching is most critical. |
| 6.3 | Extract strings — Tier 2 (Weekly Workflow) | §5 | Large | WeeklyServiceManager (post-decomposition, so touching smaller files), ServiceSegmentCard components, PDF exports, EventsPage components. |
| 6.4 | Extract strings — Tier 3 (Admin & Settings) | §5 | Medium | Settings pages, People management, Announcement management, Template management. |
| 6.5 | Translation key completeness check | §5 | Small | Create a dev-only utility that compares EN and ES key counts, reports missing translations. Run as part of manual QA process. |

**Closure condition:** Zero hardcoded user-facing strings. Both language files have identical key coverage. useTranslationStrict reports zero warnings.

**Sequencing:** 6.1 first. 6.2–6.4 are independent tiers (do in priority order). 6.5 after all tiers complete.

---

### PHASE 7 — PERFORMANCE OPTIMIZATION (Days 57–63)

| # | Task | Section | Scope | Details |
|---|------|---------|-------|---------|
| 7.1 | Replace JSON.stringify comparisons | §7 | Medium | In WeeklyServiceManager (post-decomposition): replace deep-compare dirty tracking with field-level `useRef` for initial values + shallow comparison of specific fields. Create `useFormDirty(fields)` hook. |
| 7.2 | Memoize segment list renders | §7 | Medium | Wrap segment card components in `React.memo` with custom comparator checking only: id, updated_date, order, actual_start_time, actual_end_time, live_hold_status. This prevents full-list re-render on single segment change. |
| 7.3 | Effect dependency audit | §7 | Medium | Audit top 5 components (post-decomposition, so smaller files): verify all useEffect dependencies are minimal and correct. Split compound effects into focused single-purpose effects. |
| 7.4 | Concurrent editing guard | Self-ID | Medium | Implement optimistic locking for segment edits: include `updated_date` in update payload, backend function checks `updated_date` matches before applying. On conflict: toast warning "This segment was modified by another user — please refresh." Start with Director Console (highest-risk surface), expand later. |

**Closure condition:** No `JSON.stringify` in render paths. Segment lists are memoized. Concurrent edit conflicts are detected and surfaced.

**Sequencing:** 7.1–7.3 depend on Phase 3 (decomposition). 7.4 is independent but should follow Phase 1 (subscription audit) so real-time updates are clean.

---

### PHASE 8 — ACCESSIBILITY (Days 64–70)

| # | Task | Section | Scope | Details |
|---|------|---------|-------|---------|
| 8.1 | Keyboard navigation audit | Self-ID | Medium | Test all interactive surfaces with keyboard only (Tab, Enter, Escape, Arrow keys). Priority: Director Console (used under time pressure), WeeklyServiceManager, dialog flows. Fix focus traps, missing tabIndex, non-interactive elements with click handlers. |
| 8.2 | ARIA labels and roles | Self-ID | Medium | Add `aria-label` to all icon-only buttons. Add role attributes to custom widgets (drag handles, color pickers, time inputs). Add `aria-live="polite"` to toast regions and real-time update areas. |
| 8.3 | Color contrast audit | Self-ID | Small | Director Console dark theme: verify all text meets WCAG AA (4.5:1 for normal text, 3:1 for large). Fix any failing elements. |
| 8.4 | Spanish text expansion tolerance | §5/§14 | Small | Audit all fixed-width containers, buttons, and badges for overflow when Spanish text is ~30% longer than English equivalents. Fix with min-width, flex-wrap, or truncate as appropriate. |

**Closure condition:** All interactive elements keyboard-accessible. ARIA coverage on all custom widgets. Contrast passes WCAG AA.

---

### PHASE 9 — DOCUMENTATION (Days 71–77)

| # | Task | Section | Scope | Details |
|---|------|---------|-------|---------|
| 9.1 | README.md | §9 | Small | Project overview, architecture diagram (entities → pages → functions → agents), development workflow, Base44-specific constraints, deployment notes. |
| 9.2 | Environment reference | §9 | Small | Document all secrets (SENDGRID_API_KEY, future Sentry DSN), URL parameters used by pages (sessionId, eventId, etc.), Base44 platform variables. |
| 9.3 | Entity reference document | §9 | Medium | All ~25 entities: name, purpose, fields with types, relationships (foreign keys), required fields, enum values, built-in vs custom fields. Generate from actual schema files. |
| 9.4 | Component architecture map | §9 | Small | Document the post-decomposition component tree: which components compose which pages, shared utility locations, hook inventory. |
| 9.5 | Decision & AttemptLog index | §9 | Small | Create a summary document linking to key Decision and AttemptLog entries for architectural choices, failed approaches, and platform constraints discovered. |

**Closure condition:** New developer can understand the system from documentation alone within 2 hours.

---

### PHASE 10 — TESTING FOUNDATION (Days 78–90)

| # | Task | Section | Scope | Details |
|---|------|---------|-------|---------|
| 10.1 | Investigate Vitest on Base44 | §4 | Small | Attempt install for Vitest. Test if `npx vitest run` executes. If blocked by platform: document in AttemptLog, design tests that run via a manual script or in-browser test page. |
| 10.2 | Test shared utilities | §4 | Medium | Unit tests for: timeUtils (all functions, edge cases: midnight rollover, negative durations), verseUtils (parse various Bible reference formats), themeConstants (validate all enums have entries), errorHandler (verify toast calls). |
| 10.3 | Test custom hooks | §4 | Medium | Test extracted hooks: useServiceBackup (save, restore, cleanup), useSegmentTiming (calculation accuracy), useFormDirty (change detection). Use `@testing-library/react-hooks` or Vitest's built-in hook testing. |
| 10.4 | Test backend functions | §4 | Medium | Test critical backend functions: updateLiveSegmentTiming (all action types, permission checks, edge cases), exportTasks, any function touching notification logic. Document expected inputs/outputs. |
| 10.5 | Critical path integration tests | §4 | Large | Test key user flows: (1) Create service → add segments → reorder → export PDF, (2) Enable Director → place hold → finalize → deactivate, (3) Send chat message → pin → react. These can be component-level tests rendering the actual page with mocked entity data. |

**Closure condition:** Shared utilities have 90%+ coverage. Critical paths have at least smoke tests. Test runner documented in README.

---

## Sequencing Dependencies Summary

```
PHASE 0 (Safety Net) ─── no dependencies
    │
PHASE 1 (Crash Prevention) ─── depends on nothing
    │
PHASE 2 (Shared Foundation) ─── depends on nothing (parallel with Phase 1)
    │
    ├── PHASE 3 (Decomposition) ─── depends on Phase 2 utilities
    │       │
    │       ├── PHASE 4 (Dependencies) ─── depends on Phase 3 extractions
    │       │
    │       ├── PHASE 7 (Performance) ─── depends on Phase 3 decomposition
    │       │
    │       └── PHASE 10 (Testing) ─── depends on Phase 3 hooks
    │
    ├── PHASE 5 (Monitoring) ─── depends on Phase 2 errorHandler
    │
    ├── PHASE 6 (i18n) ─── depends on Phase 3 (smaller files to audit)
    │
    ├── PHASE 8 (Accessibility) ─── independent, but easier after Phase 3
    │
    └── PHASE 9 (Documentation) ─── depends on Phases 3–8 being done
```

---

## Risk Registry

| Risk | Mitigation |
|------|------------|
| Phase 3 decomposition breaks existing functionality | Each extraction is one branch, manually tested before merging. Backup via localStorage + entity data unchanged. |
| StrictMode (4.4) surfaces many issues | Time-boxed to 2 days. If >10 issues found, log them and defer non-critical ones. |
| Sentry blocked by platform | Fallback plan (5.4) already designed. |
| Vitest blocked by platform | Fallback: in-browser test runner page or manual test scripts. |
| i18n scope larger than estimated | Tier-based approach allows partial delivery. Tier 1 (live ops) is the MVP. |
| Concurrent editing guard (7.4) requires backend changes | Scoped to Director Console first. Uses existing `updated_date` field — no schema changes. |

---

## Scope Estimate Summary

| Phase | Effort | Calendar Days |
|-------|--------|---------------|
| Phase 0 | Trivial | 1–2 |
| Phase 1 | Small-Medium | 3–5 |
| Phase 2 | Medium | 5–7 |
| Phase 3 | Large | 10–14 |
| Phase 4 | Medium | 5–7 |
| Phase 5 | Medium | 5–7 |
| Phase 6 | Large | 10–14 |
| Phase 7 | Medium | 5–7 |
| Phase 8 | Medium | 5–7 |
| Phase 9 | Small-Medium | 5–7 |
| Phase 10 | Medium-Large | 10–12 |
| **Total** | | **~65–90 working days** |

---

## Constitution Alignment

Pass. No schema changes proposed. No destructive operations. No data deletion. All phases are additive. Backup/snapshot rule satisfied by Phase 0.3 (schema snapshot before work begins). Bilingual requirement addressed in Phase 6. Attempt logging required at each phase closure. Platform constraints respected throughout (no unsupported libraries, no shared frontend/backend modules, no file system access).
