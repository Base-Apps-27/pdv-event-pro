# PDV Event Pro — Comprehensive Codebase Audit Plan

> Created: 2026-02-20
> Status: **Ready for review**
> Scope: Full codebase — code cleanliness, efficiency, Constitution & Decision adherence

---

## Audit Objectives

1. **Code Cleanliness** — dead code, unused imports, console.logs, commented-out code, naming consistency, file organization
2. **Efficiency** — unnecessary re-renders, missing memoization, redundant queries, expensive operations, bundle weight
3. **Constitution Adherence** — no schema mutations, no destructive ops, bilingual compliance, platform constraints, attempt logging
4. **Decision Adherence** — pdfmake-only PDF, optimistic locking, entity hierarchy patterns, RBAC model, in-browser testing
5. **Consistency** — error handling patterns, i18n usage, query key conventions, import style, component patterns

---

## Constitution Rules (Audit Checklist)

Every module will be checked against these:

| # | Rule | What to look for |
|---|------|-----------------|
| C1 | No schema changes (additive only) | Any code that alters entity schema structure at runtime |
| C2 | No destructive operations | `delete()`, bulk removals, data overwrite without backup |
| C3 | Bilingual requirement (EN/ES) | Hardcoded English/Spanish strings not using `t()` |
| C4 | Platform constraints | Unsupported libraries, Node.js APIs in frontend, file system access |
| C5 | Dependency tracking (§5) | Cross-module dependencies undocumented in DependencyTracker |
| C6 | Read-only transforms | Normalization/transform functions that accidentally write |
| C7 | Attempt logging | Phase closures without AttemptLog entries |

## Key Decisions (Audit Checklist)

| # | Decision | What to look for |
|---|----------|-----------------|
| D1 | pdfmake is sole PDF library | Any imports of jspdf, @react-pdf/renderer, or other PDF libs |
| D2 | Optimistic locking via useStaleGuard | Mutation paths missing stale-check before write |
| D3 | Embedded segments for weekly services | Weekly service code bypassing JSON embedded structure |
| D4 | Session/Segment entities for events | Event code using flat/embedded structures instead of entities |
| D5 | In-browser tests (not Vitest) | Test infrastructure that assumes Node.js runtime |
| D6 | safeLocalStorage wrapper | Direct `localStorage` access without wrapper |
| D7 | React Query for all reads | Direct base44 fetches outside React Query |
| D8 | Query keys via queryKeys.js | Inline/ad-hoc query key strings |
| D9 | Error Boundaries | Pages or major views without error boundaries |

---

## Module Inventory

Based on the DependencyTracker module definitions and actual file organization:

| Module | Directory Scope | Files | Description |
|--------|----------------|-------|-------------|
| **WeeklyServices** | `service/weekly/`, `WeeklyServiceManager`, `WeeklyServiceReport`, `ServiceBlueprints`, related functions | ~25 | Sunday/weekday service planning, blueprints, PDF |
| **EventPro** | `event/`, `session/`, `Events`, `EventDetail`, `SessionDetail`, related functions | ~45 | Multi-day event engine, sessions, segments |
| **LiveOps** | `live/`, `director/`, `DirectorConsole`, `LiveTimeAdjustment*`, related functions | ~18 | Real-time chat, director console, live timing |
| **ServiceCommon** | `service/custom-builder/`, `service/pdf/`, `CustomServiceBuilder`, `ServiceDetail`, `Services` | ~20 | Custom/one-off services, shared service components |
| **Announcements** | `announcements/`, `ServiceAnnouncementBuilder` | ~5 | Announcement items, series, builder |
| **Reports & PDF** | `report/`, `Reports`, `DetailedProgram`, `GeneralProgram`, `ProjectionView`, `SoundView`, `UshersView` | ~18 | Report views, PDF generation pipeline |
| **People & Auth** | `people/`, `People`, `UserManagement`, `RolePermissionManager`, `Teams` | ~6 | Member directory, RBAC, permissions |
| **Public** | `myprogram/`, `PublicProgramView`, `PublicCountdownDisplay`, `MyProgram` | ~15 | Anonymous program views, countdown, submissions |
| **Platform** | `utils/`, `ui/`, `nav/`, `shared/`, `hooks/`, `lib/`, `api/` | ~105 | UI primitives, utilities, i18n, permissions, error handling |
| **Admin** | `BuildMemory`, `SchemaGuide`, `DataSeeder`, `DependencyTracker`, `TestDashboard`, `ActivityLog`, `Calendar` | ~12 | Internal admin tools, diagnostics |
| **Backend** | `functions/` | 26 | Server-side Deno Deploy functions |

**Total: ~295 files** (164 components + 40 pages + 26 functions + misc)

---

## Phase Breakdown

### Phase A — Cross-Cutting Hygiene Sweep (all modules)

Automated and semi-automated checks that apply to the entire codebase before diving into module-specific audits. This provides a baseline health snapshot.

#### A1: Dead Code & Unused Imports
- Scan all `.jsx`/`.ts` files for unused imports
- Identify exported functions/components never imported elsewhere
- Find commented-out code blocks (>3 lines)
- Flag `console.log`/`console.warn`/`console.error` left in production code
- Check for dead CSS classes in `globals.css`

#### A2: Constitution Compliance Scan
- **C1/C2**: Grep for `.delete(`, destructive patterns, schema mutation calls
- **C3**: Identify all hardcoded user-facing strings not wrapped in `t()`
- **C4**: Check for Node.js API usage (`fs`, `path`, `process`) in frontend code
- **C6**: Verify normalization functions (`normalizeProgram`, `normalizeSession`) are read-only

#### A3: Decision Compliance Scan
- **D1**: Verify zero active imports of `jspdf`, `@react-pdf/renderer`
- **D6**: Find all direct `localStorage.getItem`/`setItem` calls not using `safeLocalStorage`
- **D7/D8**: Find base44 entity calls outside React Query; find inline query keys
- **D9**: Map which pages/major views have Error Boundaries vs which don't

#### A4: Package & Dependency Health
- Check `package.json` for unused dependencies (moment, jspdf, @react-pdf/renderer confirmed unused)
- Check for unpinned versions (`"latest"`, `^`, `~` on critical deps)
- Verify `StrictMode` status in `main.jsx`

---

### Phase B — Platform & Shared Module Audit

The foundation layer that every other module depends on. Issues here have the widest blast radius.

#### B1: UI Primitives (`components/ui/` — 53 files)
- Verify shadcn/ui components are unmodified (or modifications are documented)
- Check for custom variants that duplicate existing ones
- Validate accessibility attributes (aria-labels, keyboard navigation)
- Check for inline styles that should be Tailwind classes

#### B2: Utilities (`components/utils/` — 38 files)
- **i18n.jsx**: Dictionary completeness (all keys have both EN and ES values)
- **permissions.js**: Role hierarchy correctness, no orphaned permission keys
- **queryKeys.js**: All query keys centralized, no ad-hoc keys elsewhere
- **timeFormat.js**: Edge case handling (midnight crossover, negative durations)
- **safeLocalStorage**: Error handling completeness
- **normalizeProgram.jsx**: Read-only guarantee (no write calls)
- **normalizeSession.jsx**: Entity-first path correctness

#### B3: Navigation & Layout (`nav/`, `Layout.jsx` — 5 files)
- Permission-based nav hiding correctness
- Route guard logic for auth/public splits
- Mobile vs desktop nav consistency
- Sidebar item ordering vs actual page importance

#### B4: Hooks & API Layer (`hooks/`, `api/`, `lib/` — 11 files)
- Custom hook cleanup (effect dependencies, subscription teardown)
- Base44 client configuration
- Error interceptors / global error handling

---

### Phase C — WeeklyServices Module Audit

The largest and most complex module. Contains the 4,261-line `WeeklyServiceManager.jsx`.

#### C1: WeeklyServiceManager.jsx (4,261 lines)
- **Size**: Evaluate decomposition progress vs TECH_DEBT plan Phase 3A targets
- **State management**: Identify god-state objects, prop drilling depth
- **Auto-save**: Verify 3-second debounce, race condition safety
- **Print layout**: Embedded CSS audit — should it be extracted?
- **Copy/propagate**: Segment copy logic correctness
- **Blueprint loading**: Initialization path clarity

#### C2: Service Time Slot Components
- `ServiceTimeSlotColumn.jsx` — segment rendering, drag/drop, ordering
- `WeekdayServicePanel.jsx` — entity-based vs JSON-based read path
- Dual-write consistency (`syncWeeklyToSessions`)

#### C3: Weekly PDF Generation
- `generateWeeklyProgramPDF.jsx` (698 lines) — pdfmake usage, brand constants
- Auto-fit heuristics — edge cases with very long/short content
- Print settings modal integration

#### C4: Service Blueprints & Templates
- `ServiceBlueprints.jsx` — template CRUD, blueprint initialization logic
- `ServiceTemplatesTab.jsx` (848 lines) — evaluate size, alert() usage

#### C5: Weekly Backend Functions
- `ensureNextSundayService.ts` — Constitution compliance (additive only)
- `serveWeeklyServiceSubmission.ts` — entity-first vs JSON fallback
- `submitWeeklyServiceContent.ts` — dual-write correctness

---

### Phase D — EventPro Module Audit

Multi-day event engine with session/segment entity hierarchy.

#### D1: Event Management
- `Events.jsx` (515 lines) — list/filter/CRUD
- `EventDetail.jsx` — event editing, day management
- `event/` components (16 files) — calendar, duplication, edit forms

#### D2: Session Management
- `SessionManager.jsx` (986 lines) — session CRUD, ordering, team assignment
- `SessionDetail.jsx` — individual session editing
- `session/` components (24 files) — segment forms, stream blocks

#### D3: Segment Forms
- `SegmentFormTwoColumn.jsx` (2,066 lines) — major decomposition target
- `SegmentForm.jsx` (827 lines) — legacy? overlap with TwoColumn?
- `segment-form/` subdirectory — already-extracted sub-components
- Segment type handling completeness (all 19 types)

#### D4: Event Backend Functions
- `getPublicProgramData.ts` — enrichment pipeline, entity path
- `refreshActiveProgram.ts` — entity enrichment
- `getSortedSessions.ts`, `getSegmentsBySessionIds.ts` — query correctness

---

### Phase E — LiveOps Module Audit

Real-time features with the highest correctness requirements.

#### E1: Director Console
- `DirectorConsole.jsx` page — lock acquisition, hold/finalize/cascade
- `director/` components (6 files) — timeline, drift display, action log
- `LiveDirectorPanel.jsx` (960 lines) — evaluate size
- Events-only enforcement (services excluded per Decision)

#### E2: Live Chat
- `LiveOperationsChat.jsx` (1,009 lines) — real-time messaging, pinning, reactions
- Subscription cleanup on unmount
- `sendChatNotification.ts` — notification delivery

#### E3: Live Timing
- `LiveTimeAdjustmentModal` — offset application, alert() usage
- `updateLiveSegmentTiming.ts`, `updateLiveTiming.ts` — timing mutation safety
- `generateCascadeProposal.ts` — cascade algorithm correctness
- `archiveLiveOperationsMessages.ts` — Constitution C2 check (archiving vs deleting)

---

### Phase F — ServiceCommon Module Audit

Custom/one-off service builder and shared service components.

#### F1: CustomServiceBuilder
- `CustomServiceBuilder.jsx` (2,064 lines) — major decomposition target
- Session sync logic (`syncToSession`) — entity-first path
- Print CSS embedded vs extracted
- `alert()` usage (confirmed present)

#### F2: Service List & Detail
- `Services.jsx` — service list with type filtering (`weekly` vs `one_off`)
- `ServiceDetail.jsx` — detail view, team display
- `CustomServicesManager.jsx` — CRUD operations
- `ServiceQuickEditor.jsx` — inline editing

#### F3: Service PDF
- `service/pdf/` — PDF generation components
- Brand constant consistency with `pdfUtils.js`

---

### Phase G — Reports & PDF Module Audit

#### G1: Reports Page
- `Reports.jsx` (1,609 lines) — major decomposition target
- Render functions (`renderDetailedProgram`, `renderProjectionView`, etc.)
- View-specific filtering logic
- Print CSS blocks

#### G2: Report Sub-Pages
- `DetailedProgram.jsx`, `GeneralProgram.jsx`, `ProjectionView.jsx`, `SoundView.jsx`, `UshersView.jsx`
- Data flow from event/session/segment queries
- `AnnouncementsReport.jsx` — announcement rendering

#### G3: PDF Generation Pipeline
- `generateEventReportsPDFClient.jsx` (1,103 lines) — decomposition target
- `generateEventReportsPdf.ts` (backend) — server-side PDF
- `generateServicePdf.ts`, `generateServiceProgramPdf.ts` — service PDFs
- `pdfUtils.js` — shared brand constants, consistency audit

---

### Phase H — Announcements Module Audit

#### H1: Announcement Components
- `announcements/` (3 files) — item/series management
- `ServiceAnnouncementBuilder.jsx` — builder integration
- `AnnouncementSeries` entity usage — sort strategy, dynamic events

---

### Phase I — People & Auth Module Audit

#### I1: People Management
- `People.jsx` — member directory, alert() usage
- `people/` component — person form/display

#### I2: RBAC
- `UserManagement.jsx` (664 lines) — role assignment, permission grants/revokes
- `RolePermissionManager.jsx` — role template management
- `permissions.js` — role hierarchy, permission check logic
- `Teams.jsx` — team assignment view

---

### Phase J — Public Module Audit

#### J1: Public Program Views
- `PublicProgramView.jsx` (1,078 lines) — anonymous access, no auth required
- `PublicCountdownDisplay.jsx` — countdown timer, asset display
- `myprogram/` (12 files) — MyProgram components

#### J2: Speaker Submissions
- `MessageProcessing.jsx` — submission processing pipeline
- `serveSpeakerSubmission.ts`, `submitSpeakerContent.ts` — backend submission handling
- `processNewSubmissionVersion.ts`, `processPendingSubmissions.ts` — version management
- `SpeakerSubmissionVersion` entity — versioning correctness

---

### Phase K — Admin Module Audit

#### K1: Internal Tools
- `BuildMemory.jsx` — Decision/AttemptLog CRUD
- `SchemaGuide.jsx` (938 lines) — documentation page
- `DataSeeder.jsx` — test data seeding
- `DependencyTracker.jsx` — Constitution §5 UI
- `ActivityLog.jsx` — edit action log display

#### K2: Testing Infrastructure
- `TestDashboard.jsx` (521 lines) — test runner UI
- `testing/` (3 files) — in-browser test framework
- `testing/tests/` — test suites (coverage audit)

#### K3: Documentation Components
- `docs/` (7 files) — architecture docs rendered as components
- Accuracy vs actual codebase state

---

### Phase L — Backend Functions Audit

All 26 functions in `functions/`:

#### L1: Data Access Functions
- `getPublicProgramData.ts`, `getSortedSessions.ts`, `getSegmentsBySessionIds.ts`, `getSpeakerOptions.ts`
- Read-only verification, no accidental writes

#### L2: Mutation Functions
- `updateLiveSegmentTiming.ts`, `updateLiveTiming.ts` — timing safety
- `ensureNextSundayService.ts` — additive-only (Constitution C2)
- `refreshSuggestions.ts`, `refreshActiveProgram.ts` — cache refresh safety

#### L3: Submission Functions
- `submitWeeklyServiceContent.ts`, `submitSpeakerContent.ts` — dual-write
- `processNewSubmissionVersion.ts`, `processPendingSubmissions.ts`
- `serveSpeakerSubmission.ts`, `serveWeeklyServiceSubmission.ts`

#### L4: Notification & Utility Functions
- `sendChatNotification.ts`, `sendEmailWithPDF.ts`
- `fetchUrlMetadata.ts` — URL validation, injection prevention
- `archiveLiveOperationsMessages.ts` — archive vs delete (Constitution C2)

#### L5: PDF & Diagnostic Functions
- `generateEventReportsPdf.ts`, `generateServicePdf.ts`, `generateServiceProgramPdf.ts`
- `auditServiceActions.ts`, `diagnoseWeeklyServiceActions.ts`
- `syncGraduacionSegments.ts` — one-off migration, should it still be active?
- `generateCascadeProposal.ts` — cascade algorithm

---

## Execution Strategy

### Priority Order

```
Phase A  →  Cross-cutting sweep (baseline for all modules)
Phase B  →  Platform & Shared (highest blast radius)
Phase C  →  WeeklyServices (largest, most complex module)
Phase D  →  EventPro (core business logic)
Phase E  →  LiveOps (highest correctness requirement)
Phase L  →  Backend Functions (server-side safety)
Phase F  →  ServiceCommon
Phase G  →  Reports & PDF
Phase J  →  Public (security-sensitive, anonymous access)
Phase I  →  People & Auth
Phase H  →  Announcements (smallest module)
Phase K  →  Admin (internal-only, lowest risk)
```

### Per-Module Audit Procedure

For each module, each file will be evaluated on:

1. **Cleanliness Score** (1-5)
   - Unused imports, dead code, console.logs, commented-out blocks
   - Naming consistency (camelCase functions, PascalCase components)
   - File length appropriateness for responsibility

2. **Efficiency Score** (1-5)
   - Unnecessary re-renders (missing memo/useMemo/useCallback)
   - Redundant queries or fetches
   - Heavy computation in render path
   - Missing lazy loading for large components

3. **Constitution Compliance** (Pass/Fail per rule)
   - Each C1-C7 rule checked

4. **Decision Compliance** (Pass/Fail per decision)
   - Each D1-D9 decision checked

5. **Risk Level** (Critical/High/Medium/Low)
   - Based on blast radius and data integrity impact

### Deliverables Per Phase

Each phase produces:
- **Findings table**: file, issue, severity, Constitution/Decision rule, recommended fix
- **Metrics**: files audited, issues found by severity, compliance rate
- **Action items**: prioritized list of fixes (Critical first)

---

## Estimated Scope

| Phase | Files to Audit | Complexity |
|-------|---------------|------------|
| A — Cross-cutting | ~295 (automated) | Medium |
| B — Platform | ~105 | High (foundation) |
| C — WeeklyServices | ~25 | Very High (4,261-line file) |
| D — EventPro | ~45 | High (complex hierarchy) |
| E — LiveOps | ~18 | Very High (real-time) |
| F — ServiceCommon | ~20 | Medium |
| G — Reports & PDF | ~18 | Medium |
| H — Announcements | ~5 | Low |
| I — People & Auth | ~6 | Medium (security) |
| J — Public | ~15 | Medium (anonymous access) |
| K — Admin | ~12 | Low |
| L — Backend | 26 | High (server-side) |

---

## Relationship to Existing Plans

This audit is **complementary to** (not a replacement for) the existing remediation plans:

- **TECH_DEBT_REMEDIATION_PLAN_CORRECTED.md** — Focuses on execution (decomposition, dependency cleanup, i18n). This audit provides the **pre-execution health check**.
- **LIFT_EXECUTION_PLAN.md** — Focuses on entity migration. This audit verifies **current state integrity** of the migration path.
- **PLAN-service-entity-lift.md** — Tracks migration progress. This audit checks **completed work quality**.

Audit findings will be logged as AttemptLog entries in the BuildMemory system per Constitution requirements.
