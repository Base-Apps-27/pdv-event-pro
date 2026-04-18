# DECISION: PDF Generation Sync Protocol & Architecture

**Created:** 2026-01-23  
**Category:** Architecture  
**Status:** ACTIVE  
**Applies To:** PDF generation code, maintenance discipline  
**Related Files:**
  - `components/service/generateProgramPDF.jsx` (Custom Service PDF)
  - `components/service/generateWeeklyProgramPDF.jsx` (Weekly Service PDF)
  - `components/service/PDF_SYNC_PROTOCOL.md` (Sync rules & checkpoints)

---

## The Problem

Two PDF generators exist with overlapping logic:
- `generateProgramPDF.jsx` — Custom services (single column, flat segments)
- `generateWeeklyProgramPDF.jsx` — Weekly services (2 columns, time slots)

**Drift Risk:** Fixes/improvements to one are often forgotten in the other, causing:
- Inconsistent visual rendering across service types
- Duplicated bug fixes (same bug fixed differently in each)
- Maintenance debt accumulation
- Style divergence over time

**Constraint:** Cannot merge into one generator (legitimate layout + data model divergence).

---

## The Decision

**KEEP SEPARATION** (by design) + **ENFORCE EXPLICIT SYNC PROTOCOL**

### Rationale

1. **Legitimate Divergence:**
   - Custom services: Single-column, flat `segments[]` array
   - Weekly services: 2-column layout with `["9:30am"]` / `["11:30am"]` time slots
   - Custom services: New `sub_asignaciones[]` feature
   - Weekly services: Legacy `sub_assignments[]` DB structure
   - Cannot merge without major refactoring + data model changes

2. **Shared Standards Must Stay in Sync:**
   - Presenter label hierarchy (DIRIGE, PREDICA, MINISTRA)
   - Colors, fonts, box styles (Slate-50 for songs, Blue-50 for messages, etc.)
   - Translator style (purple, italic, subordinate)
   - Brand gradient styling

3. **Protocol > Refactoring:**
   - Creating a shared "super-generator" would add complexity and risk bugs
   - Extracting utilities is better than merging logic
   - Documentation + decision tree prevents drift better than code-level abstraction

---

## What's Shared (Must Stay in Sync)

| Element | Both Generators |
|---------|-----------------|
| Presenter hierarchy (DIRIGE/PREDICA/MINISTRA colors) | ✅ Yes |
| Translator style (purple italic) | ✅ Yes |
| Songs box styling (Slate-50, borders) | ✅ Yes |
| Message box styling (Blue-50, labels) | ✅ Yes |
| Prep notes styling (Gray-50) | ✅ Yes |
| Font scales (9pt, 8.5pt, 7.5pt) | ✅ Yes |
| Brand gradient (#1F8A70 → #4DC15F → #D9DF32) | ✅ Yes |
| BRAND constants from pdfUtils.js | ✅ Yes |

---

## What's Divergent (Intentional)

| Aspect | Custom | Weekly | Why |
|--------|--------|--------|-----|
| Layout | Single column | 2 columns (time slots) | Different service structure |
| Segments | `serviceData.segments[]` | `serviceData["9:30am"]` / `["11:30am"]` | Data model difference |
| Sub-assignments | `sub_asignaciones[]` (flat array) | `sub_assignments[]` (structured) | Custom is new; weekly is legacy |
| Time calculation | Computed per segment | Pre-stored in time slots | Weekly doesn't recalculate |
| Scaling | Segment count + notes | Content density + box overhead | Different layout constraints |

---

## The Sync Protocol

**Location:** `components/service/PDF_SYNC_PROTOCOL.md`

**Core Mechanism:** Decision Tree for every change:
1. Is it a **rendering rule** (colors, fonts, hierarchy)? → **UPDATE BOTH**
2. Is it a **utility or constant**? → **EXTRACT TO SHARED, IMPORT IN BOTH**
3. Is it **layout-specific**? → **UPDATE ONLY THAT GENERATOR + ADD DIVERGENCE COMMENT**
4. Is it a **bug fix**? → **CHECK IF IT APPLIES TO BOTH; IF YES, FIX BOTH**

**Verification Checklist:**
- [ ] Read PDF_SYNC_PROTOCOL.md before modifying
- [ ] Ask decision tree questions
- [ ] If modifying shared rendering: update BOTH files + add comment reference
- [ ] If adding utilities: extract to pdfUtils.js
- [ ] If diverging: add `// DIVERGENCE:` comment explaining why
- [ ] Test rendering in BOTH contexts
- [ ] Log significant changes in AttemptLog

---

## Breadcrumb Trail

**Added to each generator:**
- File-level comment referencing PDF_SYNC_PROTOCOL.md
- Comment on each divergent section (e.g., "DIVERGENCE: Sub-asignaciones are CUSTOM-ONLY")
- Example: `// Per PDF_SYNC_PROTOCOL.md: Shared rendering standard`

**Example Divergence Comment:**
```javascript
// DIVERGENCE (per PDF_SYNC_PROTOCOL.md):
// Sub-asignaciones (seg.sub_asignaciones[]) are CUSTOM-ONLY
// Weekly services use seg.sub_assignments[] (legacy DB structure)
// Do NOT apply this logic to generateWeeklyProgramPDF.jsx
```

---

## Implementation Checklist

- [x] Create `PDF_SYNC_PROTOCOL.md` with decision tree and sync checkpoints
- [x] Add file-level comments to both generators referencing protocol
- [x] Add divergence comments to sub-asignaciones sections
- [x] Document shared vs. divergent in decision document
- [ ] During code review: enforce decision tree (ask "did you check both generators?")
- [ ] Quarterly: audit both generators for drift; raise issues if found
- [ ] Log all PDF improvements in AttemptLog (category: "pdf_generation")

---

## How This Prevents Drift

1. **Decision Tree:** Forces every change through a lens ("does this apply to both?")
2. **Explicit Comments:** Divergences are marked, not hidden
3. **Shared Standards Documentation:** Clear what MUST stay in sync vs. what CAN diverge
4. **Audit Trail:** AttemptLog provides history of what was changed and why
5. **Breadcrumb Comments:** Future devs see the protocol reference without searching

---

## Escalation Path

If drift still accumulates after 6 months:
- Consider extracting a `pdfRenderer` utility with shared logic
- Or: Plan a larger refactor to unify data models
- Revisit this decision; it may be time for merging

---

## Related Decisions

- None yet (this is foundational)

## Related Attempts

- (Will be logged as improvements are made)