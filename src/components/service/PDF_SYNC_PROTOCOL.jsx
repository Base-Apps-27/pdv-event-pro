/* eslint-disable */
// # PDF Generation Sync Protocol

**Status:** ACTIVE (2026-01-23)  
**Category:** Architecture → Maintenance Discipline  
**Applies To:** `generateProgramPDF.jsx` (Custom Services) & `generateWeeklyProgramPDF.jsx` (Weekly Services)

---

## Problem Statement

Two separate PDF generators exist for custom services and weekly services. While intentional (they serve different layouts/use cases), they have grown with overlapping logic and shared rendering patterns. Without an explicit sync protocol:
- Fixes/improvements to one are often forgotten in the other
- Bug fixes diverge, creating inconsistent behavior
- Visual style updates get applied unevenly
- Maintenance debt accumulates

**Decision:** Keep the separation (legitimate divergence in layout, data structure, time-series vs. flat segments) BUT establish **explicit sync rules and checkpoints** to prevent drift.

---

## What's Intentionally Different (Cannot Be Merged)

| Aspect | Custom Service PDF | Weekly Service PDF | Rationale |
|--------|--------------------|--------------------|-----------|
| **Layout** | Single-column, flat segments | 2-column (9:30am / 11:30am) | Weekly services run parallel time slots; custom is sequential |
| **Data Source** | `serviceData.segments[]` | `serviceData["9:30am"]` & `serviceData["11:30am"]` | Weekly services split by time slot in DB schema |
| **Time Calculation** | Parse + addMinutes per segment | Pre-calculated from time slots | Weekly doesn't recalculate; uses stored times |
| **Sub-Assignments** | `seg.sub_asignaciones[]` (array of objects) | `seg.sub_assignments[]` (structured records) | Custom is new; weekly has legacy `ministry_leader` fallback |
| **Scaling Strategy** | Segment-based heuristic (segment count + notes) | Content-density heuristic (box overhead + line-wrapping) | Custom focuses on count; weekly on actual space consumed |

---

## What's Intentionally the Same (Must Stay in Sync)

### **Shared Rendering Standards**

| Element | Standard | Applies To |
|---------|----------|-----------|
| **Presenter/Leader/Preacher Hierarchy** | Worship → `DIRIGE:` (Green-600), Message → `PREDICA:` (Indigo-600), Other → `MINISTRA:` (Blue-600) | Both PDF generators |
| **Translator Style** | Purple italic, subordinate position, after roles | Both PDF generators |
| **Songs Box** | Slate-50 (#F8FAFC) background, borders, numbered list with lead + key | Both PDF generators |
| **Message Box** | Blue-50 (#EFF6FF) background, `MENSAJE:` + `ESCRITURAS:` labels | Both PDF generators |
| **Prep Notes Box** | Gray-50 (#F9FAFB) background, labeled sections | Both PDF generators |
| **Font Scales** | `9pt` for labels, `8.5pt` for metadata, `7.5pt` for notes | Both PDF generators |
| **Brand Gradient** | `TEAL → GREEN → LIME` (#1F8A70 → #4DC15F → #D9DF32) | Both PDF generators |

### **Shared Utilities**

- `BRAND` color constants (imported from `pdfUtils.js`)
- `formatDate()` helper (from `pdfUtils.js`)
- Logo data URL retrieval (`getLogoDataUrl()`)
- pdfMake font setup (vfs_fonts registration)

---

## Sync Checkpoints (Decision Tree)

**When you modify a PDF generator, ask:**

### A. Is this a **rendering rule** (colors, fonts, hierarchy, style)?
✅ **YES** → Update BOTH files with identical logic (or identical comment referencing this protocol)  
❌ **NO** → Continue to B

### B. Is this a **utility or constant** (BRAND colors, formatDate, logo)?
✅ **YES** → Extract to shared file if not already done; import in both generators  
❌ **NO** → Continue to C

### C. Is this **layout-specific** (columns, time calculation, segmentation)?
✅ **YES** → Update ONLY the relevant generator; ADD a comment explaining the divergence  
❌ **NO** → Continue to D

### D. Is this a **bug fix or performance improvement**?
✅ **YES** → Consider if it applies to the other generator; if yes, apply to both (create AttemptLog entry)  
❌ **NO** → Proceed with caution; add clear breadcrumb comment

---

## Sync Verification Checklist

**Before committing a PDF generator change:**

- [ ] Read this protocol
- [ ] Ask Decision Tree questions A–D above
- [ ] If modifying shared rendering (e.g., presenter labels, colors, fonts):
  - [ ] Update BOTH `generateProgramPDF.jsx` AND `generateWeeklyProgramPDF.jsx`
  - [ ] Add comment referencing this protocol and the specific element
  - [ ] Test rendering in both custom and weekly contexts
- [ ] If adding/fixing a utility:
  - [ ] Ensure it's in `pdfUtils.js` or extracted to a shared location
  - [ ] Both generators import the same function
  - [ ] Document in the utility itself why it's shared
- [ ] If diverging intentionally:
  - [ ] Add a `// DIVERGENCE:` comment explaining why this generator differs
  - [ ] Include the sync protocol line number reference
- [ ] Log in AttemptLog if it's a non-trivial fix or significant improvement

---

## File-Level Breadcrumbs (What to Include in Each Generator)

### In `generateProgramPDF.jsx` (Custom Service)

```javascript
/**
 * CUSTOM SERVICE PDF GENERATOR
 * 
 * SYNC PROTOCOL: See components/service/PDF_SYNC_PROTOCOL.md
 * - Shares rendering standards with generateWeeklyProgramPDF.jsx
 * - Intentional divergence: Single-column layout, sub_asignaciones array structure
 * - When updating colors, fonts, or presenter hierarchy: update BOTH generators
 */
```

### In `generateWeeklyProgramPDF.jsx` (Weekly Service)

```javascript
/**
 * WEEKLY SERVICE PDF GENERATOR
 * 
 * SYNC PROTOCOL: See components/service/PDF_SYNC_PROTOCOL.md
 * - Shares rendering standards with generateProgramPDF.jsx
 * - Intentional divergence: 2-column layout, time-slot segmentation, sub_assignments structure
 * - When updating colors, fonts, or presenter hierarchy: update BOTH generators
 */
```

---

## How to Add an Improvement

### Example: Changing the Presenter Label Color from Blue-600 to Blue-700

1. **Identify what changed:** Rendering rule (presenter style)
2. **Check Decision Tree:** → "Is this a rendering rule?" → YES
3. **Action:** Update BOTH generators
4. **Comment in both:** Add comment referencing this protocol

```javascript
// Per PDF_SYNC_PROTOCOL.md: Presenter hierarchy color updated
// MINISTRA (non-worship/non-message) now uses Blue-700 (was Blue-600)
// Applied to both generateProgramPDF.jsx and generateWeeklyProgramPDF.jsx
const presenterColor = '#1D4ED8'; // Blue-700
```

5. **Test:** Render custom service PDF, then weekly service PDF; compare rendering
6. **Log:** Create an AttemptLog entry:
   - Approach: "Update presenter label color to Blue-700 across both PDF generators"
   - Outcome: "success"
   - Category: "pdf_generation"
   - Details: "Verified rendering in both custom and weekly contexts; colors match"

---

## How to Document a Divergence

### Example: Sub-Asignaciones Only in Custom Service PDF

In `generateProgramPDF.jsx`:
```javascript
// DIVERGENCE (per PDF_SYNC_PROTOCOL.md):
// Sub-asignaciones (seg.sub_asignaciones[]) are CUSTOM-ONLY feature.
// Weekly services use seg.sub_assignments[] (legacy DB structure).
// Do NOT apply this logic to generateWeeklyProgramPDF.jsx
// Reason: Weekly services have different data model for mini-assignments.

const subAsignaciones = seg.sub_asignaciones || [];
if (subAsignaciones.length > 0) {
  // Render purple-themed ministration box...
}
```

In `generateWeeklyProgramPDF.jsx`:
```javascript
// DIVERGENCE (per PDF_SYNC_PROTOCOL.md):
// Weekly services use structured seg.sub_assignments[] (legacy records).
// Custom services use flat array seg.sub_asignaciones[].
// Do NOT apply custom sub_asignaciones logic here.
// Reason: Different data model; weekly has backwards-compatibility requirements.

if (seg.sub_assignments) {
  seg.sub_assignments.forEach(sub => {
    // Render per legacy structure...
  });
}
```

---

## Review & Maintenance Schedule

- **Quarterly Audit:** Search both generators for divergent styles/bugs; raise issues
- **Per-Change Review:** Enforce decision tree in code review
- **Yearly Update:** Revisit this protocol; add new standards if patterns emerge

---

## See Also

- `Decision: PDF_Generation_Architecture` (why separation was chosen)
- `AttemptLog: PDF_Rendering_Fixes` (tagged improvements)
- `pdfUtils.js` (shared constants and utilities)