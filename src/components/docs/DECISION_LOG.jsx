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