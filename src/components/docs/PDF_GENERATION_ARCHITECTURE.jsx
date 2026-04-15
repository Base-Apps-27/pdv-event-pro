/* eslint-disable */
// # PDF Generation Architecture

**Version:** 2026-02-12  
**Single Library:** pdfmake (client-side)  
**Decision:** pdfmake chosen over jsPDF (poor table support) and @react-pdf/renderer (server dependency, React lifecycle overhead). See Decision log.

---

## 1. Generator Inventory

| Generator | File | Purpose | Layout |
|-----------|------|---------|--------|
| Custom Service Program | `generateProgramPDFWithAutoFit.jsx` | One-off service programs | Single column |
| Weekly Service Program | `generateWeeklyProgramPDF.jsx` | Sunday 2-slot service | 2-column (9:30/11:30) |
| Announcements | `generateAnnouncementsPDF.jsx` | Announcement handout | 2-column (Fixed/Events) |
| Event Reports | `generateEventReportsPDFClient.js` | Multi-tab event reports | Variable |

---

## 2. Shared Infrastructure

### Brand Constants (`pdfUtils.js`)
```
BRAND.TEAL   = '#1F8A70'
BRAND.GREEN  = '#8DC63F'
BRAND.LIME   = '#BDC63F'
BRAND.YELLOW = '#D7DF23'
BRAND.BLACK  = '#1A1A1A'
BRAND.RED    = '#DC2626'
BRAND.BLUE   = '#2563EB'
BRAND.PURPLE = '#7C3AED'
BRAND.GRAY   = '#6B7280'
BRAND.LIGHT_GRAY = '#D1D5DB'
```

### Logo (`pdfLogoData.js`)
- Base64-encoded PDV logo, loaded once per session
- `getLogoDataUrl()` returns data URL for pdfmake image nodes

### Font Setup
- pdfmake default fonts (Roboto) via `pdfmake/build/vfs_fonts`
- Font VFS initialized on first import (with guard against double-init)

### PDF Caching (`pdfCacheManager.js`)
- localStorage-based, keyed by content hash
- 48-hour TTL
- Scale metadata stored with cache (cache invalidates if heuristic changes)
- Wrapped in safeLocalStorage for crash-proof operation

---

## 3. Heuristic Scaling

All generators use content-density heuristics to calculate a `globalScale` factor (typically 0.40–1.25) that scales all font sizes, margins, and line heights proportionally.

### Algorithm Pattern
1. **Count content units** — each content element (header, role, song, note, action) contributes weighted "line units"
2. **Compare to target capacity** — a constant representing comfortable single-page content (40–50 units)
3. **Calculate scale** — `TARGET / maxLoad`, clamped to [min, max] range
4. **Apply uniformly** — every `fontSize` in the document is `baseSize * globalScale`

### Per-Generator Details

| Generator | Target | Scale Range | Special Logic |
|-----------|--------|-------------|---------------|
| Custom Service | 50 units | 0.40 – 1.00 | Single column, simple count |
| Weekly Service | 50 units/column | 0.40 – 1.00 | Measures DENSER column |
| Announcements | 40 units/column | 0.55 – 1.25 | Separate fixed vs dynamic columns |

### What Counts as a Unit
- Segment header: 2.0–2.5 units
- Role line (presenter/leader/preacher): 1.1 units
- Song entry: 1.1 units per song
- Note field: 1.2 + chars/75 units
- Action entry: 1.0 unit per action
- Box overhead (songs, notes, actions): 1.5 units per box
- Inter-segment spacing: 1.0 unit

---

## 4. Document Structure (Common Pattern)

All PDFs follow this layout:
1. **Brand header bar** — gradient canvas rectangle (12px)
2. **Logo + Title** — 3-column layout (logo | spacer | title+date | spacer | spacer)
3. **Team info** — centered text with role labels
4. **Divider** — green accent line
5. **Content** — segments/announcements (varies by generator)
6. **Footer** — gradient bar + "¡ATRÉVETE A CAMBIAR!" centered

---

## 5. Weekly-Specific Divergence

Per PDF_SYNC_PROTOCOL (2025):
- Weekly services use `seg.sub_assignments[]` for sub-role rendering
- Custom services use `seg.sub_asignaciones[]` (different structure)
- **Do NOT cross-apply** sub-assignment logic between generators
- Colors, fonts, and presenter hierarchy (Presenter → Leader → Preacher) are shared

---

## 6. Print Settings

Users can override heuristic scaling via Print Settings modal:
- `print_settings_page1.globalScale` — overrides heuristic for program page
- `print_settings_page2.globalScale` — overrides heuristic for announcements page
- Margins, bodyFontScale, titleFontScale also configurable
- Settings persisted on Service entity

---

## 7. Error Handling

- PDF generation is wrapped in try/catch with toast notifications
- Cache failures are logged but non-blocking (falls through to regeneration)
- Font VFS initialization failures are guarded with conditional checks
- Large content (>100 units) triggers aggressive scaling rather than multi-page overflow

---

## 8. Future Considerations

- **Server-side PDF** — `functions/generateEventReportsPdf` exists for event reports (uses jsPDF on Deno, candidates for pdfmake migration)
- **Multi-page support** — Current heuristic targets single-page; multi-page would require overflow detection
- **Custom fonts** — pdfmake supports VFS font embedding; could add Anton/Bebas Neue for brand headers