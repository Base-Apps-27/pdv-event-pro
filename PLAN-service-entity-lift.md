# Service Entity Lift — Migration Plan

## Current State

Services have Session/Segment/PreSessionDetails entities created via bridge functions
(`syncWeeklyToSessions`, `syncToSession`), but the frontend still reads/writes JSON
and uses simplified components. Events get full real-time capabilities; services don't.

---

## Phase 1: Wire Services to the Real StickyOpsDeck

**Goal:** Delete `StickyOpsDeckService.jsx`, make services use `StickyOpsDeck`.

### What changes:

1. **`ServiceProgramView.jsx`** — Replace `StickyOpsDeckService` import with `StickyOpsDeck`.
   Pass the full props contract:
   - `segments` (already passed)
   - `preSessionData` — query `PreSessionDetails` filtered by the active session
   - `sessionDate` (already passed)
   - `currentTime` (already passed)
   - `resolvedStreamActions` — empty array for now (services have no streams yet)
   - `onScrollToStreamBlock` — null/noop for now

2. **`StickyOpsDeckService.jsx`** — Delete entirely after ServiceProgramView is rewired.

3. **`StickyOpsDeck.jsx`** — No changes needed. Its zero-drift contract already handles
   optional `preSessionData` and `resolvedStreamActions` gracefully (defaults to `[]`/`null`).

### Files touched:
- `src/components/service/ServiceProgramView.jsx` (edit)
- `src/components/service/StickyOpsDeckService.jsx` (delete)

---

## Phase 2: Enable Real-Time Sync for Services

**Goal:** Set `realTimeSync: true` for weekly and custom services. Services read from
entities (Session/Segment) via subscriptions instead of JSON.

### What changes:

1. **`liveViewCapabilities.jsx`** — Update:
   - `weekly.realTimeSync` → `true`
   - `weekly.timeAdjustmentMode` → `"session"` (sessions are the entities now)
   - `custom.realTimeSync` → `true`
   - `custom.timeAdjustmentMode` → `"session"`

2. **`ServiceProgramView.jsx`** — Add Base44 entity subscription for the active
   service's sessions/segments (same pattern as `EventProgramView`). On subscription
   event, invalidate React Query cache so UI refreshes.

3. **`WeeklyServiceManager.jsx`** — In the `existingData` query, flip priority:
   - Currently: tries `loadWeeklyFromSessions()` first, falls back to JSON
   - Keep this, but add subscription so external edits (director, live adjustments)
     push updates in real time instead of requiring page reload.

### Files touched:
- `src/components/service/liveViewCapabilities.jsx` (edit)
- `src/components/service/ServiceProgramView.jsx` (edit)
- `src/components/service/WeeklyServiceManager.jsx` (edit — add subscription)

---

## Phase 3: Bridge Function Cleanup

**Goal:** Remove conversion layers that exist only because the UI used to ignore entities.

### What changes:

1. **`weeklySessionSync.jsx`** — Keep `syncWeeklyToSessions()` (still needed for
   write path until UI writes entities directly). Mark `loadWeeklyFromSessions()` for
   deprecation — once the UI reads entities directly via subscriptions, this
   entity→JSON conversion is unnecessary.

2. **`segmentDataUtils.jsx`** — `normalizeSegment()` and `getSegmentData()` remain
   useful as accessor helpers. `normalizeServiceTeams()` can be simplified once team
   data lives on Session entities consistently.

3. **`sessionSync.jsx`** (custom services) — Same treatment: keep write path, deprecate
   read-back conversion.

### Files touched:
- `src/components/service/weeklySessionSync.jsx` (annotate deprecations)
- `src/components/service/sessionSync.jsx` (annotate deprecations)

---

## Phase 4: Add Live Operational Blocks for Services

**Goal:** Give services the same live operational capabilities events have — specifically
the Base44 subscription-driven real-time updates, director-style controls, and
potentially stream block support.

### 4A: PreSessionDetails for Services

Services already create PreSessionDetails via `syncWeeklyToSessions()`. But nobody
reads them on the service side.

1. **`ServiceProgramView.jsx`** — Query `PreSessionDetails` by session ID, pass to
   `StickyOpsDeck` (done in Phase 1).

2. **`WeeklyServiceManager.jsx`** or a new **`ServicePreSessionForm`** — Add UI to
   edit pre-session details (registration desk time, facility notes, etc.) for each
   service time slot. Reuse `PreSessionDetailsForm.jsx` from events.

### 4B: Live Time Adjustments for Services

Events use `LiveTimeAdjustment` entity for per-session timing offsets during live
execution. Services should too.

1. **`LiveStatusCard.jsx`** — Already shared. Verify it works when `contextType`
   is `"service"` (not just `"event"`).

2. **`DirectorConsole.jsx`** — Currently event-only (routes via `?sessionId=`). Extend
   to accept `?serviceSessionId=` for service sessions. The director sees the same
   segment timeline, can adjust timing, send pings.

### 4C: Stream Blocks for Services (Future — Optional)

If services ever need livestream coordination:
1. Create `StreamBlock` entities linked to service sessions
2. Wire `resolveStreamActions()` in `ServiceProgramView`
3. Pass resolved actions to `StickyOpsDeck`

This is **not needed now** — parking for when services go live-streamed.

### Files touched:
- `src/components/service/ServiceProgramView.jsx` (edit — PreSessionDetails query)
- `src/components/service/WeeklyServiceManager.jsx` (edit — add PreSession form)
- `src/components/service/LiveStatusCard.jsx` (verify service context)
- `src/pages/DirectorConsole.jsx` (extend for service sessions)

---

## Phase 5: Weekday Tabs UI with Session-Hour Columns

**Goal:** Implement the weekday tabs layout discussed earlier in this conversation.
Each tab represents a day of the week. Within each tab, session hours (e.g., 9:30am,
11:30am) display as columns with horizontal scrolling.

### What changes:

1. **New layout in `WeeklyServiceManager.jsx`** (or extracted component):
   - Tab bar: Mon–Sun tabs (or filtered to days that have services)
   - Each tab renders `ServiceTimeSlotColumn` instances side-by-side
   - Horizontal scroll container for when columns exceed viewport width
   - Sessions are the columns — read directly from Session entities for the
     selected weekday

2. **`ServiceTimeSlotColumn.jsx`** — Already extracted. May need minor props
   adjustment to accept a generic Session entity instead of hardcoded "9:30am"/"11:30am"
   slot keys.

3. **Navigation** — Tab state persists in URL query param (`?day=sunday`) or
   local state. Default to the upcoming service day.

### Files touched:
- `src/pages/WeeklyServiceManager.jsx` (edit — add tab layout)
- `src/components/service/ServiceTimeSlotColumn.jsx` (edit — generalize props)

---

## Phase 6: Additional Services to Update

Beyond the core components above, these peripheral services need updates to
stay consistent with the entity-first architecture:

### 6A: Speaker Submission Pipeline
- **`functions/submitWeeklyServiceContent.ts`** — Already updated to v3.0 (inline
  verse parsing). No changes needed.
- **`functions/serveWeeklyServiceSubmission.ts`** — Already has entity-first path
  with JSON fallback. No changes needed.

### 6B: PDF Generation
- **`generateWeeklyProgramPDF.jsx`** — Currently reads JSON structure. Once UI
  reads entities directly, PDF generation should also read from entities.
  Lower priority — JSON structure still works as long as `syncWeeklyToSessions`
  keeps entities in sync.

### 6C: Reports
- **`WeeklyServiceReport.jsx`** (page + component) — Uses `getSegmentData()` accessor.
  Will work with either JSON or entity data. No immediate changes.

### 6D: Diagnostics
- **`functions/diagnoseWeeklyServiceActions.ts`** — May need update to read from
  Session/Segment entities instead of JSON. Lower priority.
- **`functions/auditServiceActions.ts`** — Same.

### 6E: Stale Guard (Concurrent Editing)
- **`useStaleGuard.jsx`** — Currently protects Service and Session entities.
  With real-time subscriptions (Phase 2), stale detection should integrate with
  subscription events for faster conflict detection.

---

## Execution Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4A → Phase 4B → Phase 5 → Phase 6
  |          |          |          |           |          |          |
  Wire     Enable     Clean    PreSession  Director   Weekday    Peripheral
  StickyOps  RT Sync   bridges   for svc    for svc    tabs UI    updates
```

Phases 1–3 are the foundation. Phase 4 adds live capabilities. Phase 5 is the
UI upgrade. Phase 6 is cleanup.

---

## Risk Notes

- **Zero-drift policy**: StickyOpsDeck changes must be tested across EventProgramView,
  DirectorConsole, AND ServiceProgramView simultaneously.
- **Live adjustment guard**: `syncWeeklyToSessions` skips segment recreation when
  `live_adjustment_enabled = true`. This is correct — don't clobber live timing.
- **JSON fallback**: Keep JSON read path alive until all services have been
  migrated to entities (some historical services may only have JSON).
