# Service Entity Lift — Migration Plan (Revised)

## Architecture: Three Occasion Types

| Type | Engine | Live Control | Editing Surface |
|------|--------|-------------|-----------------|
| **Events** | Full event engine (Session/Segment entities, StreamBlocks) | Director Console (hold/finalize/cascade) | EventDetail → SessionManager → SegmentForm |
| **Weekly Services** | Session/Segment entities via dual-write | Start-time offset only (LiveTimeAdjustmentModal) | WeeklyServiceManager (Sunday: ServiceTimeSlotColumn, Weekdays: WeekdayServicePanel) |
| **One-off Services** | Session/Segment entities via syncToSession | Start-time offset only (LiveTimeAdjustmentModal) | CustomServiceBuilder |

**Key decisions:**
- Director Console is **events only** — services use the offset-based start-time move feature
- `service_type` field on Service entity: `'weekly'` | `'one_off'` (explicit, not inferred from data shape)
- Weekly services recur week-to-week and are planned repetitively
- One-off services are special occasions (graduation, holiday service, etc.)

---

## Current State (as of this revision)

### Completed
- [x] Phase 1: StickyOpsDeck unified (StickyOpsDeckService deleted)
- [x] Entity lift foundation: `syncWeeklyToSessions` (write path) + `loadWeeklyFromSessions` (read path)
- [x] Speaker submission pipeline: entity-first with JSON fallback
- [x] `liveViewCapabilities.jsx`: realTimeSync and timeAdjustmentMode set to session
- [x] `normalizeProgram.jsx`: full normalization pipeline with entity session ID resolution
- [x] `liveAdjustmentHelpers.jsx`: entity-aware session name resolution
- [x] `normalizeSession.jsx`: entity-first path for MyProgram
- [x] `MessageProcessing.jsx`: entity-first path for submission processing
- [x] Director Console: service session support **removed** (events-only)
- [x] `service_type` field: set on all save paths (weekly + one_off)
- [x] Nav: separated "Weekly Services" from "Special Services"
- [x] Query filters: updated to use service_type with legacy structural fallback
- [x] Weekday tabs: replaced stubs with WeekdayServicePanel (loads Session/Segment entities)

### Remaining
- [ ] Migration script: backfill `service_type` on existing services
- [ ] Migration script: create Session/Segment entities for historical services
- [ ] Real-time subscriptions for ServiceProgramView (Phase 2)
- [ ] Bridge cleanup: remove `loadWeeklyFromSessions` once Sunday tab reads entities directly
- [ ] PDF generation: read from entities instead of JSON
- [ ] Diagnostics: update to read from entities
- [ ] Stale guard: integrate with subscription events

---

## Phase 2: Enable Real-Time Sync for Services

**Goal:** Add Base44 entity subscriptions to `ServiceProgramView.jsx` so live timing
adjustments push to all viewers in real time.

1. **`ServiceProgramView.jsx`** — Add subscription to `Segment` entity changes for the
   active service's sessions. On change, invalidate React Query cache.
2. **`WeeklyServiceManager.jsx`** — Add subscription for real-time external edit detection.

---

## Phase 3: Bridge Function Cleanup

**Goal:** Remove the `loadWeeklyFromSessions` entity→JSON conversion layer.

**Prerequisite:** Sunday tab refactored to read Session/Segment entities directly
instead of requiring the JSON shape (`serviceData["9:30am"]`).

1. **`weeklySessionSync.jsx`** — Remove `loadWeeklyFromSessions()` and `segmentEntityToWeeklyJSON()`
2. **`WeeklyServiceManager.jsx`** — Read sessions/segments directly via React Query
3. **`ServiceTimeSlotColumn.jsx`** — Accept Session entity + Segment array instead of JSON slot

---

## Phase 4: Migration Script

**Goal:** Backfill `service_type` and create Session/Segment entities for historical services.

```
Algorithm:
  1. Fetch all Service entities with status='active'
  2. For each service:
     a. If has "9:30am"/"11:30am" arrays and no service_type → set service_type='weekly'
     b. If has "segments" array and no service_type → set service_type='one_off'
     c. If no Sessions exist → call syncWeeklyToSessions (weekly) or syncToSession (one_off)
  3. Verify entity counts match JSON counts
```

---

## Phase 5: Peripheral Updates

| File | Change | Priority |
|------|--------|----------|
| `generateWeeklyProgramPDF.jsx` | Read from entities | Low (JSON still works) |
| `diagnoseWeeklyServiceActions.ts` | Read from entities | Low |
| `auditServiceActions.ts` | Read from entities | Low |
| `ENTITY_REFERENCE.md.jsx` | Document service_type field | Medium |

---

## Risk Notes

- **Zero-drift policy**: StickyOpsDeck changes must be tested across EventProgramView AND ServiceProgramView.
- **Live adjustment guard**: `syncWeeklyToSessions` skips segment recreation when `live_adjustment_enabled = true`.
- **JSON fallback**: Keep JSON read path alive until migration script has run on all services.
- **Director Console**: Events only. Services use LiveTimeAdjustmentModal exclusively.
