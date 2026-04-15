/* eslint-disable */
// # Decision Log

## [DECISION-001] Verse & Key Takeaways Feature Parity Protocol
**Date:** 2026-02-24
**Status:** ACTIVE
**Context:** The application maintains two parallel pipelines for speaker content submission: one for "Weekly Services" (Sundays) and one for "Events" (Conferences). These pipelines share 90% of their logic (verse parsing, LLM extraction, media URLs) but live in separate code paths (`serveWeeklyServiceSubmission` vs `serveSpeakerSubmission`, `DayServiceEditor` vs `PlenariaSection`).

**Decision:**
Any functional improvement, UI enhancement, or schema change made to the **Verse/Key Takeaways** submission form or display for **Services** MUST be evaluated and implemented for **Events** (and vice versa).

**Rules of Engagement:**
1.  **Default to Parity:** Assume all new fields (e.g., "Notes URL", "Slides Only Toggle") belong in both pipelines.
2.  **Intentional Drift Only:** Divergence is permitted ONLY when the feature is strictly domain-specific.
    *   *Example of Allowed Drift:* "Apply to 9:30am & 11:30am" checkbox (Specific to Weekly Services structure).
    *   *Example of Disallowed Drift:* "Extract Key Takeaways" (Applies to any speaker, regardless of context).
3.  **Sync Logic:** When updating extraction logic (regex, LLM prompts), update ALL copies (Frontend Dialog, Backend Inline, Backend Automation).

**Consequences:**
*   Reduces technical debt by preventing "forgotten" features in the Events module.
*   Ensures a consistent experience for speakers who speak at both Sunday services and Special Events.

---

## [DECISION-002] Recurring Service Lifecycle Audit & Architecture Contract
**Date:** 2026-02-25
**Status:** ACTIVE
**Context:** Multiple one-off fixes to the service creation, blueprint, and reset cycles caused cascading failures. A full audit identified 7 systemic issues (see SYSTEM_AUDIT_RECURRING_SERVICES.md).

**Decision:**
All code paths that create, load, or reset recurring service data MUST use Session + Segment entities (NOT Service JSON blobs). The following contracts are established:

### Contract 1: Entity-First Data Path
- **ensureRecurringServices** MUST create Session + Segment entities (same as EmptyDayPrompt)
- Service entity stores ONLY metadata (name, date, day_of_week, status, selected_announcements, receso_notes, print_settings)
- No segment data on Service entity blobs

### Contract 2: Shared Type Normalization
- A single `normalizeSegmentType(rawType) → enumType` function MUST be used everywhere
- Located in: `components/utils/segmentNormalization.js` (or new shared util)
- No inline typeMap objects

### Contract 3: Blueprint is Read-Only Reference
- Blueprints are stored as `Service.segments[]` (canonical array, not slot-keyed)
- Blueprint data is cloned, never mutated
- Reset uses the CURRENT blueprint (no versioning — accepted tradeoff)

### Contract 4: Reset Atomicity
- Before deleting segments, capture a snapshot of current segment IDs + data
- If segment creation fails, log the error but do NOT leave a half-reset state
- Use bulkCreate where possible to reduce API calls

### Contract 5: Field Mapping Completeness
- SEGMENT_FIELD_MAP must cover ALL fields the UI renders, including `leader`
- Any new field added to BlueprintSegmentEditor MUST be added to SEGMENT_FIELD_MAP

**Consequences:**
- ensureRecurringServices requires update (P0)
- SEGMENT_FIELD_MAP requires `leader` entry (P1)
- Type normalization extraction (P2)
- Reset hardening (P3)

---

## [DECISION-003] Weekly Editor V2 — Entity-First Zero-Trust Rewrite
**Date:** 2026-02-26
**Status:** ACTIVE
**Context:** The V1 weekly editor was incrementally migrated from JSON-blob to entity-based storage. This migration left behind: hardcoded sub-assignment fallbacks, a JSON transformation layer (weeklySessionSync) that injects phantom fields, dual-write patterns (state blob + entity), and multi-alias field access chains. Multiple patching attempts (ATT-001 through ATT-010) fixed individual symptoms but the architecture remains fragile.

**Decision:**
Build a completely new Weekly Editor (V2) from scratch with zero code reuse from V1 editor components. The V2 architecture:

### Principle 1: No Intermediate JSON Shape
- Components receive raw entity objects directly from React Query cache
- No `serviceData["9:30am"][idx].data.presenter` shape
- No `weeklySessionSync` transformation layer
- No `segmentEntityToWeeklyJSON()` function

### Principle 2: `ui_fields` and `ui_sub_assignments` Are Canonical
- These fields are stamped on Segment entities at creation time (from blueprint)
- The editor reads ONLY from `segment.ui_fields` to determine which inputs to show
- Zero fallback logic. Zero blueprint matching at read time.
- Segments without `ui_fields` show an "unconfigured" warning, NOT guessed fields.

### Principle 3: Single Write Path
- User input → optimistic React Query cache update → debounced entity.update()
- No `setServiceData()` blob. No `ServiceDataContext`. No `UpdatersContext`.
- No dual-write (state + entity) pattern.

### Principle 4: Entity Fields Read Directly
- `segment.presenter` not `segment.data.presenter` or `getSegmentData(segment, 'leader')`
- One location. One value. No alias chains.

### Principle 5: Additive Deployment
- V2 files built in `components/service/v2/` alongside V1
- V1 files remain untouched until V2 is verified
- Single edit to WeeklyServiceManager swaps V1→V2 (instantly revertible)

### File Structure:
- 19 new files, ~1,240 total lines (avg 65/file)
- Replaces 8 V1 files, ~2,850+ lines (avg 356/file)

### What V2 Does NOT Touch (updated):
- Entity schemas (Service, Session, Segment, PreSessionDetails)
- ensureRecurringServices (already entity-first)
- EmptyDayPrompt (already creates entities correctly)
- BlueprintEditor + BlueprintSegmentEditor
- useServiceSchedules
- segmentTypeMap.js
- PDF generation (adapter added if needed)
- Announcements (stay in WeeklyServiceManager parent)
- SpecialSegmentDialog, VerseParserDialog
- AutocompleteInput

**Consequences:**
- Ghost JSON injections eliminated at the architecture level
- Hardcoded fallbacks impossible (no fallback code exists)
- Every field rendered is traceable to `segment.ui_fields` on the entity
- Pre-migration segments without `ui_fields` show explicit warnings instead of phantom data

---

## [DECISION-004] Canonical Session Sort Strategy — Chronological Primary
**Date:** 2026-02-26
**Status:** ACTIVE
**Context:** Session `order` field is unreliable across the platform. It's assigned as `sessions.length + 1` at creation time but can be duplicated (all sessions with `order=4`), overwritten by AI Helper, or stale after deletions. Multiple surfaces sorted by `order` as primary key, causing sessions to appear in wrong order (e.g., Sábado PM before Viernes PM). EventDetail and SessionManager already sorted correctly by date+time for display, but all data pipelines (refreshActiveProgram, useActiveProgramCache, normalizeSession, getSortedSessions) used `order` as primary.

**Decision:**
All session sorting throughout the platform MUST use chronological sort as primary:

### Sort Priority (Canonical)
1. `date` ASC (YYYY-MM-DD string comparison)
2. `planned_start_time` ASC (HH:MM string comparison)
3. `order` ASC (tiebreaker only — for same date+time sessions)
4. `name` localeCompare (last resort)

### Implementation
- **Frontend canonical:** `components/utils/sessionSort.js` exports `sortSessionsChronologically()`, `compareSessionsChronologically()`, and `buildSessionIndexMap()`
- **Backend (Deno):** Inlined copy in `refreshActiveProgram` and `getSortedSessions` (Deno cannot import frontend modules). MUST be kept in sync with frontend canonical.

### Rules
1. The `order` field is NOT deleted, NOT renamed, NOT deprecated. It is preserved for backward compatibility and as a tiebreaker.
2. No surface may use `order` as the primary sort key for sessions.
3. Any new surface that displays or processes sessions MUST import from `sessionSort.js` (frontend) or inline the canonical sort (backend).
4. The `order` field continues to be set at creation time for backward compat, but its value is not authoritative.

### Affected Surfaces (all fixed in ATT-015)
- `functions/refreshActiveProgram` — event + service session sort
- `functions/getSortedSessions` — backend sorted sessions endpoint
- `components/myprogram/useActiveProgramCache` — override query sort
- `components/myprogram/normalizeSession` — event + entity-sourced segment sort
- `components/utils/sessionSort.js` — NEW canonical sort module

### Surfaces Already Correct (no changes needed)
- `pages/EventDetail` — already sorts by date → time
- `components/event/SessionManager` — already sorts by date → time

**Consequences:**
- Sessions always appear in chronological order regardless of `order` field values
- Eliminates the class of bugs where duplicate/wrong `order` values cause display inversions
- The `order` field becomes a "hint" rather than authoritative — safe to ignore when date+time are available

---

## [DECISION-005] Public HTML Form CSP Headers — Constitutional Non-Negotiable
**Date:** 2026-02-26
**Status:** ACTIVE — CONSTITUTIONAL AMENDMENT
**Context:** Backend functions that serve public HTML forms (`serveSpeakerSubmission`, `serveArtsSubmission`, `serveWeeklyServiceSubmission`, and any future form-serving functions) rely on inline scripts, inline styles, external CDN scripts (cdnjs.cloudflare.com), and Google Fonts. Without proper `Content-Security-Policy` headers, browsers block these resources entirely, rendering forms non-functional. This is not a feature — it is a hard prerequisite for form functionality.

**Decision:**
Every backend function that returns `Content-Type: text/html` with inline scripts or external script dependencies MUST include CSP headers. This is a **constitutional non-negotiable** — forms are not considered complete, shippable, or functional without them.

### Required Headers (Canonical)
Every HTML-serving response MUST include:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'
```

### Rules
1. **Non-Negotiable:** Any backend function returning `text/html` with `<script>` tags MUST include the CSP header. No exceptions.
2. **Definition of Done:** A public HTML form is NOT done unless CSP headers are present and verified.
3. **New Form Checklist:** When creating a new HTML-serving backend function, the CSP header MUST be included in the initial implementation — not added as a fix later.
4. **Update Protocol:** When modifying an existing HTML-serving function, verify CSP headers are present. If missing, add them as part of the change.
5. **Scope Extension:** If a form adds a new external script domain (beyond cdnjs.cloudflare.com), the CSP header MUST be updated to include it. Document the addition in the commit.

### Affected Functions (current)
- `functions/serveSpeakerSubmission` — ✅ CSP added
- `functions/serveArtsSubmission` — ✅ CSP added
- `functions/serveWeeklyServiceSubmission` — ✅ CSP added

### Why Constitutional
- Without CSP headers, forms silently break in production with no user-visible error
- The failure mode is invisible — the HTML loads but scripts don't execute
- This is a platform infrastructure concern, not a feature toggle
- Every form, every time, no exceptions

**Consequences:**
- All current and future HTML-serving functions are protected against CSP blocking
- Forms are guaranteed functional at the browser level
- Any new HTML form function that omits CSP headers is considered incomplete and must not ship

---

## [DECISION-006] Live View Services Always Fresh-Fetch (No Cache Snapshot)
**Date:** 2026-02-27
**Status:** ACTIVE
**Context:** The Live View (PublicProgramView) had two data paths: (1) cache-first via ActiveProgramCache snapshot for the auto-detected program, and (2) fresh-fetch via `getPublicProgramData` for explicitly selected programs. Services auto-detected by the cache used the snapshot, but if that snapshot was stale (e.g., built before segment_actions were added to newly created segments), the StickyOpsDeck showed no actions. Events never had this problem because selecting an event always triggered a fresh fetch from `getPublicProgramData`, which queries entities directly. The cache architecture was designed for passive display surfaces (TV Display, MyProgram) where instant load matters and ~30s staleness is acceptable. The Live View is an authenticated, interactive surface where a ~1s fetch is perfectly fine and data freshness is critical for operational cues.

**Decision:**
Services in the Live View (PublicProgramView) ALWAYS use `getPublicProgramData` fresh-fetch, matching how events work. The `isCachedSelection` flag returns `false` for `viewType === 'service'`, forcing the explicit fetch query to activate.

### What Uses Cache (unchanged)
- **TV Display** (PublicCountdownDisplay): Cache snapshot — instant load, no interaction
- **MyProgram**: Cache snapshot — instant load, passive display
- **Live View auto-detection**: Cache is used ONLY for determining which program to auto-select and populating selector dropdowns
- **Live View events**: Cache when selection matches auto-detected event (events have robust entity automations)

### What Now Fresh-Fetches
- **Live View services**: ALWAYS fresh-fetch via `getPublicProgramData`, regardless of whether the selection matches the cached program

### Why Not Events Too?
Events have robust entity automation coverage (Event create/update triggers `refreshActiveProgram`), and their sessions/segments are typically created well before live viewing. Services are more volatile — created by auto-jobs and manual "Create Service" buttons minutes before live use. Fresh-fetching events could be added later if needed, but there's no current evidence of staleness issues.

### Affected Surfaces
- `pages/PublicProgramView` — `isCachedSelection` now returns `false` for services

### Complementary Fixes (same session)
- `EmptyDayPrompt`: Now carries `segment_actions` and `color_code` from blueprint at creation time
- `ensureRecurringServices`: Now carries `segment_actions` and `color_code` from blueprint at creation time
- These ensure the cache snapshot is ALSO correct for TV Display and MyProgram

**Consequences:**
- Live View services always show the latest entity data, including actions added at creation time
- StickyOpsDeck shows correct countdown actions for newly created services immediately
- No dependency on `refreshActiveProgram` having run after service creation for Live View
- Adds ~1s load time for service programs in Live View (acceptable for interactive surface)
- Cache still serves TV Display and MyProgram (those surfaces are unaffected)