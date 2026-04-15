/* eslint-disable */
// # Rendering Pipeline Analysis: Weekly vs Custom Services in Live View

**Date:** 2026-01-23  
**Purpose:** Map the rendering flow for both service types to identify gaps and define alignment strategy  
**Status:** In Progress (Diagnostic)

---

## Part A: Weekly Service Rendering Pipeline

### Entry Point: `PublicProgramView.jsx` (Lines 344-410)

**Data Flow:**
```
1. User selects service (selectedServiceId set)
2. useQuery fetches raw service: rawServiceData = Service entity
3. useMemo: calculateTimedSegments() PROCESSES rawServiceData
   - Iterates: rawServiceData["9:30am"] and rawServiceData["11:30am"] arrays
   - For each segment: calculates start_time + end_time if missing
   - Returns: actualServiceData with populated times
4. actualServiceData passed to ServiceProgramView
```

**Key Transformation in `calculateTimedSegments()` (Lines 350-392):**
```javascript
// INPUT: segment from rawServiceData["9:30am"] or ["11:30am"]
const startTime = `${startH}:${startM}`;  // Calculated if missing
const endTime = `${endH}:${endM}`;        // Calculated based on duration
return {
  ...seg,
  start_time: seg.start_time || startTime,    // Prefer existing, fall back to calculated
  end_time: seg.end_time || endTime           // Same for end time
};
```

---

### Intermediate: `ServiceProgramView.jsx` (Lines 86-360)

**Logic:**
1. **Detects service type:** `isWeeklyService = ["9:30am"] && length > 0`
2. **Applies live adjustments** (Lines 63-68):
   ```javascript
   if (adjusted["9:30am"]) {
     adjusted["9:30am"] = applyTimeOffset(adjusted["9:30am"], "9:30am");
   }
   if (adjusted["11:30am"]) {
     adjusted["11:30am"] = applyTimeOffset(adjusted["11:30am"], "11:30am");
   }
   ```
   **Problem:** Custom services (segments array) are NOT adjusted (Line 69-71 is empty)

3. **Renders two parallel columns** (Lines 197-359):
   - 9:30am section: Title + team info + segments
   - 11:30am section: Title + team info + segments
   - Receso (break) divider

4. **For each segment, renders** `PublicProgramSegment`:
   - Props: segment, isCurrent, isUpcoming, viewMode="simple", alwaysExpanded=true
   - All segment details shown (expanded by default for services)

---

### Terminal: `PublicProgramSegment.jsx` (Lines 29-340)

**Rendering Order (Always Visible for Services):**
1. **Header** (always visible):
   - Current/upcoming badges
   - Time display (start–end, duration)
   - Title + segment type badge
   - Presenter/leader/preacher/translator (role-specific)
   - Scripture references (with verse modal button)

2. **Details Block** (Lines 221-339, shown when `alwaysExpanded=true` for services):
   - Prep actions (before-start tasks)
   - During actions (in-segment cues)
   - Team notes (coordinator, projection, sound, ushers, translation, stage/decor)
   - Songs (for worship only)
   - Message title (for message segments)
   - General description/details

**Data Sources** (prioritized via `getSegmentData(field)`):
- Check `segment.data[field]` first (canonical location)
- Fall back to `segment[field]` (root, for legacy/simple data)

---

## Part B: Custom Service Rendering Pipeline

### Entry Point: `PublicProgramView.jsx` (Lines 402-407)

**Data Flow:**
```
1. User selects service (selectedServiceId set)
2. useQuery fetches raw service: rawServiceData = Service entity
3. useMemo: calculateTimedSegments() PROCESSES rawServiceData
   - **ONLY checks** ["9:30am"] and ["11:30am"] arrays
   - **THEN checks** segments array (Lines 403-407)
   - For custom service: uses serviceTime = newData.time || "10:00"
   - Calculates times: newData.segments = calculateTimedSegments(segments, "10:00")
4. actualServiceData passed to ServiceProgramView
```

**Code (Lines 403-407):**
```javascript
// Calculate times for Custom Services (segments array)
if (newData.segments && newData.segments.length > 0) {
  // Use service time as start, default to 10:00 if missing
  const serviceTime = newData.time || "10:00"; 
  newData.segments = calculateTimedSegments(newData.segments, serviceTime);
}
```

✅ **Custom services GET time calculation** (same as weekly)

---

### Intermediate: `ServiceProgramView.jsx` (Lines 102-171)

**Logic:**
1. **Detects service type:** `isCustomService = segments && segments.length > 0`
2. **Applies live adjustments** (Lines 69-71):
   ```javascript
   if (adjusted.segments) {
     // For custom services, we might need a general offset - for now, leave unchanged
   }
   ```
   ❌ **Custom services DO NOT apply live time adjustments** (code is a stub comment)

3. **Renders single column** (Lines 113-168):
   - Service name
   - Team info (simplified: tries to extract from time-slot keys, which may be wrong)
   - All segments

4. **For each segment, renders** `PublicProgramSegment`:
   - Same props as weekly: segment, isCurrent, isUpcoming, viewMode="simple", alwaysExpanded=true

---

### Terminal: `PublicProgramSegment.jsx` (Lines 29-340)

**Same rendering as weekly** (Lines 56-77 determine what to display based on `getData(field)`)

**BUT:** Segment data structure is different:

| Field | Weekly Service Source | Custom Service Source | Status |
|-------|----------------------|----------------------|--------|
| `presenter` | `segment.data.presenter` OR `segment.presenter` | `segment.presenter` OR `segment.data.presenter` | ✅ Handled |
| `songs` | `segment.songs` (array) | `segment.songs` (array) | ✅ Handled |
| `start_time` | Calculated in PublicProgramView | Calculated in PublicProgramView | ✅ Handled |
| `sub_asignaciones` | **NOT IN WEEKLY** | `segment.sub_asignaciones[]` | ❌ **NOT RENDERED** |
| `description_details` | `segment.data.description_details` | `segment.description_details` | ✅ Likely handled |
| `coordinator_notes` | `segment.data.coordinator_notes` | `segment.coordinator_notes` | ✅ Likely handled |

---

## Part C: Data Structure Comparison

### Weekly Service Segment (from DB or JSON)
```javascript
{
  id: "seg-123",
  segment_type: "Alabanza",
  title: "Equipo de A&A",
  start_time: "09:30" OR null (calculated),
  end_time: "10:00" OR null (calculated),
  duration_min: 30,
  
  // Canonical (data object)
  data: {
    leader: "Lauren Estrella",
    presenter: null,
    preacher: null,
    translator: "Melodie Espinal",
    songs: [{title: "...", lead: "...", key: "..."}, ...],
    coordinator_notes: "...",
    projection_notes: "...",
    // ... more notes
  },
  
  // Legacy fallback (root level)
  leader: null,  // May be at root too
  
  // No sub_asignaciones
}
```

### Custom Service Segment (from JSON in Service.segments)
```javascript
{
  _uiId: "uuid-xxxx",
  type: "Alabanza",
  title: "Equipo de A&A",
  duration: 30,
  
  // Flat structure (root level)
  presenter: "P. Ruben Fabeiro",
  translator: "Melodie Espinal",
  songs: [{title: "...", lead: "...", key: "..."}, ...],
  coordinator_notes: "...",
  projection_notes: "...",
  
  // CUSTOM FEATURE: Sub-asignaciones (not in weekly)
  sub_asignaciones: [
    {
      _uiId: "uuid-yyyy",
      title: "Ministración de Sanidad",
      presenter: "P. Luis Luna",
      duration: 5
    }
  ],
  
  // Optional data object (not always present)
  data: { /* could have duplicate data here */ }
}
```

---

## Part D: Gap Analysis

### ✅ What Works (Custom → Weekly Parity)
- Time calculations (start/end)
- Presenter/leader/preacher display
- Songs rendering
- Translator display
- Coordinator/projection/sound/ushers notes
- Description/details

### ❌ What's Missing (Custom ≠ Weekly)

| Gap | Custom Service | Weekly Service | Impact |
|-----|----------------|----------------|--------|
| **Sub-asignaciones rendering** | Has data, NOT rendered | N/A | ❌ Critical — sub-asignaciones invisible in live view |
| **Live time adjustments** | NOT applied | Applied per time slot | ⚠ Moderate — custom services can't adjust live timing |
| **Team info extraction** | Tries time-slot keys (wrong) | Has dedicated keys | ⚠ Low–moderate — may show wrong team info |
| **Data structure normalization** | Mixed root/data object | Canonical `data` object | ⚠ Low — `getData()` fallback handles it |

---

## Part E: Root Cause of Sub-Asignaciones Invisibility

**Chain of Events:**
1. Custom service builder stores sub-asignaciones in segment: `segment.sub_asignaciones = [{...}, {...}]`
2. PublicProgramView calculates times: sub-asignaciones still in segment ✓
3. ServiceProgramView doesn't special-case custom services for display: still in segment ✓
4. **PublicProgramSegment** — checks for specific fields but NEVER looks for `sub_asignaciones`:
   ```javascript
   // Lines 298-337: "Additional Details" section
   // Checks: songs, messageTitle, description_details
   // DOES NOT check: sub_asignaciones
   ```
5. **Result:** Sub-asignaciones data exists but is never rendered

---

## Part F: Strategy Options to Bridge the Gap

### Option 1: Extend PublicProgramSegment
**Approach:** Add sub-asignaciones rendering to the "Additional Details" section  
**Pros:**
- Minimal change (single component)
- Reuses existing styling patterns (boxes with labels)
- No data flow changes needed
- Sub-asignaciones only render if present (safe fallback)

**Cons:**
- PublicProgramSegment becomes slightly more specialized (weekly-only vs custom-only fields)
- Future custom-only features will require similar updates

**Rendering location:** After songs (Lines 317), before message title (Lines 320)

### Option 2: Normalize Custom Services to Session/Segment Entities
**Approach:** When custom service is saved, sync to Session/Segment DB records (like weekly services)  
**Pros:**
- True data parity; both service types would flow through identical rendering
- Live admin controls, live time adjustments would work automatically
- Future features apply equally to both

**Cons:**
- Requires schema migration and complex sync logic
- Breaking change if existing custom services lose sub-asignaciones on re-save
- High risk + effort

### Option 3: Create CustomServiceProgramView
**Approach:** Split rendering; keep weekly in ServiceProgramView, create dedicated CustomServiceProgramView  
**Pros:**
- Clean separation; no risk to weekly rendering
- Can add custom-only features without affecting weekly logic

**Cons:**
- Code duplication (90% identical rendering logic)
- Harder to sync improvements between the two
- Violates DRY principle

### Option 4: Create a Shared Segment Renderer
**Approach:** Extract common segment rendering logic to a shared utility; both weekly and custom call it  
**Pros:**
- True centralization; improvements apply to both
- Cleaner code organization

**Cons:**
- Requires refactoring PublicProgramSegment significantly
- Medium effort; could introduce bugs in rendering order

---

## Part G: Recommended Path Forward

**Best option:** **Option 1 (Extend PublicProgramSegment) + Document Future Alignment**

**Rationale:**
- Unblocks custom service live view rendering immediately
- Minimal risk; no data migrations
- Maintains existing rendering logic for weekly services
- Sets precedent: custom-only features render alongside shared features

**Then, optionally:**
- Monitor if custom services need live time adjustments or other weekly-parity features
- If demand grows, escalate to Option 2 (full sync to Session/Segment)
- Document in PDF_SYNC_PROTOCOL.md that rendering features are now tracked independently from PDF features

---

## Part H: Implementation Checklist (Option 1)

**What to change:**
1. `PublicProgramSegment.jsx` (Lines 298–317):
   - Add sub-asignaciones rendering block
   - Use purple styling (match PDF: #FAF5FF background, #5B21B6 text)
   - Show presenter name + duration

2. `ServiceProgramView.jsx` (Lines 69–71):
   - Optionally: add TODO comment about future live time adjustment support

3. `RENDERING_PIPELINE_ANALYSIS.md` (this file):
   - Mark as "Decision: Rendering Parity for Custom Services"
   - Document why Option 1 was chosen
   - Track future feature requests

**Testing:**
- Create custom service with sub-asignaciones
- Render in PublicProgramView
- Verify sub-asignaciones appear with correct styling
- Verify weekly services unchanged

---

## Part I: Future Alignment Roadmap

**If custom services need more weekly-parity features:**
1. Live time adjustments per time slot (requires DB sync)
2. Session-level grouping (instead of flat segments array)
3. Crew call blocks, pre-session details, hospitality tasks
4. Entity-based actions, room assignments, translations

**Decision gate:** When 3+ custom features would improve from weekly-style handling → escalate to Option 2 (full Session/Segment sync)

---

## Appendix: Code Locations Reference

| Component | Role | Relevant Lines |
|-----------|------|-----------------|
| PublicProgramView | Entry point, detects service type, calculates times | 343–410 (time calc) |
| ServiceProgramView | Detects custom vs weekly, applies adjustments, routes to segments | 86–99 (detect), 102–171 (custom), 174–361 (weekly) |
| PublicProgramSegment | Renders segment details | 220–339 (details block) |
| CustomServiceBuilder | Creates custom service data | segments array, sub_asignaciones |
| generateProgramPDF | Custom service PDF rendering | sub-asignaciones handled (line 191–215) |