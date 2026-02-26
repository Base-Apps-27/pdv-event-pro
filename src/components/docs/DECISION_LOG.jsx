# Decision Log

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