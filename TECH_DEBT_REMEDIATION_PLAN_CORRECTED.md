# Tech Debt Remediation Plan — Corrected & Verified

> Updated: 2026-02-11
> Source: Independent cross-check of original plan against actual codebase
> Status: **Ready for execution**

---

## Corrections Applied

### Phantom Files Resolved

| Original Plan File | Actual File | Lines |
|---|---|---|
| `ServiceSegmentCard.jsx` | `SegmentRow.jsx` (161) + `PublicProgramSegment.jsx` (837) | Split across two files |
| `EventsPage.jsx` | `pages/Events.jsx` | 516 lines |
| `EnhancedServicePDF.jsx` | `generateEventReportsPDFClient.jsx` | 1,103 lines |

### Size Corrections

| File | Plan Stated | Actual |
|---|---|---|
| `WeeklyServiceManager.jsx` | ~2,400 | **4,261** |

### Dependency Corrections

| Dependency | Plan Stated | Actual |
|---|---|---|
| `moment` | "Consolidate → date-fns" (Medium) | **Zero active imports.** Trivial removal from `package.json`. |
| `jspdf` | "Multiple PDF libs in use" | **Zero active imports.** All PDF generation uses `pdfmake`. Trivial removal from `package.json`. |
| `@react-pdf/renderer` | Listed as active | **CORRECTION: IS in package.json (`^3.4.4`) but has zero active imports. Should be removed from package.json in Phase 0.** |
| `pdfmake` | — | **Sole PDF library.** Used by all 5 frontend generators + 1 backend function. No consolidation needed. |

### Codebase Scale (Verified)

| Metric | Plan Claimed | Actual | Factor |
|---|---|---|---|
| Components (.jsx) | ~60+ | **164** | 2.7x |
| Backend functions | ~10 | **23** | 2.3x |
| Pages | ~20+ | **37** | 1.85x |
| Files over 500 lines | 3 | **31** | 10.3x |

### `alert()` Usage (9 files confirmed)

EditHistoryModal, SessionManager, LiveOperationsChat, LiveTimeAdjustmentModal, ServiceBuilder, ServiceTemplatesTab, CustomServiceBuilder, People, WeeklyServiceManager

---

## Phase Plan (Corrected)

### Phase 0 — Safety Net (1–2 days)

No changes from original plan, plus:

- [ ] Remove `moment` from `package.json` (zero imports confirmed)
- [ ] Remove `jspdf` from `package.json` (zero imports confirmed — all PDF uses `pdfmake`)
- [ ] Remove `@react-pdf/renderer` from `package.json` (zero imports confirmed — was listed as "not installed" in original correction but IS present at `^3.4.4`)
- [ ] Pin `pdfmake` version in `package.json` (currently uses `build/pdfmake` CDN-style import)
- [ ] Confirm `document.title` is "PDV Event Pro" (not "Base44 APP")
- [ ] Verify entity count (~24 entities)

### Phase 1 — Stability & Data Integrity (3–5 days)

No changes from original plan:

- [ ] Install Error Boundaries (confirmed absent)
- [ ] Audit `localStorage` usage (confirmed 9 files)
- [ ] Audit real-time subscriptions for cleanup
- [ ] Standardize `window.confirm` / `alert()` replacement (9 files)

### Phase 2 — Foundation Code Quality (5–7 days)

- [ ] Extract shared utilities (gradients, time math, verse parsing)
- [ ] Create centralized error handler
- [ ] Replace `alert()` calls with toast/dialog pattern
- [ ] **NEW (moved from Phase 10):** Investigate Vitest feasibility on Base44 platform
- [ ] **NEW (moved from Phase 10):** If Vitest works, write tests for extracted utilities before Phase 3

### Phase 3 — Component Decomposition (15–25 days)

**CORRECTED TARGETS — all verified against actual codebase:**

#### Phase 3A — WeeklyServiceManager.jsx (4,261 lines) → Target: ~800 lines

| Extraction | Target Component | Est. Lines Saved |
|---|---|---|
| Print layout + CSS | `WeeklyServicePrintLayout.jsx` | ~1,100 |
| Announcement section | `WeeklyAnnouncementManager.jsx` | ~400 |
| Blueprint/initialization logic | `useWeeklyServiceData.js` (hook) | ~300 |
| 9:30 service column | `ServiceTimeSlotColumn.jsx` | ~350 |
| Special segment dialog | `SpecialSegmentDialog.jsx` | ~120 |
| Overflow detection helpers | `useOverflowDetection.js` (hook) | ~100 |
| Copy/propagation functions | `useServiceCopyActions.js` (hook) | ~150 |
| Verse parser integration | Already extracted (VerseParserDialog) | 0 |
| **Total extraction** | | **~2,520** |
| **Remaining** | | **~1,740** |

> Note: Original plan extracted ~980 lines from a file it believed was 2,400. Actual file is 4,261 — extraction scope more than doubled.

#### Phase 3B — SegmentFormTwoColumn.jsx (2,066 lines) → Target: ~600 lines

| Extraction | Target Component | Est. Lines Saved |
|---|---|---|
| Artes block (Dance/Drama/Other) | `ArtesFormSection.jsx` | ~400 |
| Breakout rooms editor | `BreakoutRoomsEditor.jsx` | ~250 |
| Worship songs section | `WorshipSongsSection.jsx` | ~100 |
| Announcement series section | `AnnouncementSeriesSection.jsx` | ~100 |
| Segment actions editor | `SegmentActionsEditor.jsx` | ~200 |
| Team notes section | `TeamNotesSection.jsx` | ~150 |
| Visibility toggles | `VisibilityTogglesSection.jsx` | ~50 |
| **Total extraction** | | **~1,250** |
| **Remaining** | | **~816** |

#### Phase 3C — CustomServiceBuilder.jsx (2,064 lines) → Target: ~600 lines

| Extraction | Target Component | Est. Lines Saved |
|---|---|---|
| Print CSS + layout | `CustomServicePrintLayout.jsx` | ~600 |
| Segment card rendering | `CustomSegmentCard.jsx` | ~400 |
| Session sync logic | `useSessionSync.js` (hook) | ~200 |
| Team section | `ServiceTeamSection.jsx` | ~100 |
| Service details form | `ServiceDetailsForm.jsx` | ~100 |
| **Total extraction** | | **~1,400** |
| **Remaining** | | **~664** |

#### Phase 3D — Reports.jsx (1,609 lines) → Target: ~400 lines

| Extraction | Target Component | Est. Lines Saved |
|---|---|---|
| `renderDetailedProgram` | `DetailedProgramReport.jsx` | ~400 |
| `renderProjectionView` | `ProjectionReport.jsx` | ~130 |
| `renderSoundView` | `SoundReport.jsx` | ~130 |
| `renderUshersView` | `UshersReport.jsx` | ~80 |
| `renderHospitalityView` | `HospitalityReport.jsx` | ~80 |
| `renderGeneralProgram` | `GeneralProgramReport.jsx` | ~80 |
| Print CSS block | `ReportPrintStyles.jsx` | ~130 |
| PDF download/normalize helpers | `pdfDownloadHelper.js` | ~60 |
| **Total extraction** | | **~1,090** |
| **Remaining** | | **~519** |

#### Phase 3E — generateEventReportsPDFClient.jsx (1,103 lines) → Target: ~400 lines

| Extraction | Target Component | Est. Lines Saved |
|---|---|---|
| Cell builders (Time, Details, Notes) | `pdfCellBuilders.js` | ~400 |
| Session header + pre-session block | `pdfSessionHeader.js` | ~150 |
| Prep action row builder | `pdfPrepActionRow.js` | ~100 |
| **Total extraction** | | **~650** |
| **Remaining** | | **~453** |

#### Phase 3F — Evaluate Remaining 500+ Line Files

Files to triage (not auto-targeted, but evaluated):

| File | Lines | Recommendation |
|---|---|---|
| `PublicProgramView.jsx` | 1,078 | Evaluate — may benefit from segment list extraction |
| `ScheduleReview.jsx` | 1,050 | Evaluate |
| `LiveOperationsChat.jsx` | 1,009 | Evaluate — shared component, high risk |
| `SessionManager.jsx` | 986 | Evaluate |
| `LiveDirectorPanel.jsx` | 960 | Evaluate |
| `SchemaGuide.jsx` | 938 | Low priority — documentation page |
| `PrintSettingsModal.jsx` | 870 | Low priority — modal |
| `ServiceTemplatesTab.jsx` | 848 | Evaluate |
| `PublicProgramSegment.jsx` | 837 | Acceptable — single-responsibility |
| `SegmentForm.jsx` | 827 | Evaluate (legacy? overlaps with TwoColumn?) |
| `normalizeProgram.jsx` | 824 | Acceptable — utility |
| `EventAIHelper.jsx` | 824 | Acceptable — AI integration |
| `i18n.jsx` | 781 | Acceptable — translation dictionary |
| Others (< 700 lines) | — | Skip unless flagged |

> Decision: Explicitly exclude files marked "Acceptable" with reasoning. Target files marked "Evaluate" only if capacity allows after 3A–3E.

### Phase 4 — Dependency Consolidation (2–3 days)

**SIGNIFICANTLY REDUCED from original plan:**

- ~~4.1 Moment → date-fns migration~~ → **DONE** (zero imports, just remove from package.json in Phase 0)
- ~~4.2 PDF library consolidation~~ → **DONE** (already unified on pdfmake; remove unused jspdf and @react-pdf/renderer in Phase 0)
- [ ] 4.3 Pin all dependency versions (audit `package.json`)
- [ ] 4.4 Re-enable `StrictMode` in `main.jsx` (confirmed commented out)

### Phase 5 — Error Handling & Monitoring (5–7 days)

No changes from original, plus:

- [ ] **NEW (moved from Phase 7.4):** Concurrent editing guard for Director Console
  - Rationale: "last write wins" is a data integrity risk for a live-event tool, not a performance optimization
  - Should be addressed alongside monitoring infrastructure

### Phase 6 — Internationalization (10–14 days)

**SCOPE INCREASE:** Original plan underestimated. Only ~5 files actively use `t()` out of 164 components. The effort is significantly larger than "uneven coverage."

- [ ] Audit all 164 components + 37 pages for hardcoded strings
- [ ] Prioritize user-facing pages first, admin-only pages second
- [ ] Ensure Spanish text expansion is tolerated in all layouts

### Phase 7 — Performance Optimization (5–7 days)

- [ ] Memoization audit (React.memo, useMemo, useCallback)
- [ ] Lazy loading for heavy pages
- [ ] Query deduplication audit
- ~~7.4 Concurrent editing guard~~ → Moved to Phase 5

### Phase 8 — Accessibility (5–7 days)

No changes. Covers ~37 pages (not ~20).

### Phase 9 — Documentation (3–5 days)

- [ ] README with architecture overview
- [ ] Entity reference guide
- [ ] PDF generation architecture doc (single library: pdfmake)

### Phase 10 — Testing (5–10 days)

- ~~10.1 Vitest investigation~~ → Moved to Phase 2 (before risky decomposition)
- [ ] Integration tests for critical workflows
- [ ] PDF generation regression tests

---

## Timeline (Revised)

| Phase | Original Est. | Revised Est. | Change Reason |
|---|---|---|---|
| Phase 0 | 1–2 days | 1–2 days | Added jspdf + @react-pdf/renderer removal (trivial) |
| Phase 1 | 3–5 days | 3–5 days | No change |
| Phase 2 | 5–7 days | 7–10 days | Added Vitest investigation + utility tests |
| Phase 3 | 15–20 days | **25–35 days** | 5 decomposition targets (not 3), file sizes 2x larger |
| Phase 4 | 5–7 days | **2–3 days** | Moment + PDF consolidation already done |
| Phase 5 | 5–7 days | 7–10 days | Added concurrent editing guard |
| Phase 6 | 10–14 days | 12–18 days | 2.7x more components than scoped |
| Phase 7 | 5–7 days | 5–7 days | Removed concurrent editing (moved to P5) |
| Phase 8 | 5–7 days | 5–7 days | No change |
| Phase 9 | 3–5 days | 3–5 days | No change |
| Phase 10 | 5–10 days | 3–7 days | Vitest moved to P2; less testing scope remaining |
| **Total** | **65–90 days** | **73–109 days** | Net: dependency work shrunk, decomposition grew |

---

## Rollback Strategy

**Git tags required at each phase boundary:**

```
remediation/phase-0-complete
remediation/phase-1-complete
remediation/phase-2-complete
...
```

Each tag provides instant rollback if a later phase introduces subtle regressions.

---

## What's Confirmed Solid (No Changes Needed)

- Phase sequencing and dependency graph
- Risk registry
- Constitution alignment (no schema changes, all additive, bilingual requirement)
- Error Boundary approach
- Monitoring strategy (analytics.track → Sentry investigation → custom fallback)
- StrictMode re-enablement plan
- Subscription audit need

---

## Decision Log Reference

This plan supersedes the original `TECH_DEBT_REMEDIATION_PLAN.md` for execution purposes. The original remains as historical context. All discrepancies between the two documents are resolved in favor of this corrected version, which is verified against the actual codebase as of 2026-02-11.
