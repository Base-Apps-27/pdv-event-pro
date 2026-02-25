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