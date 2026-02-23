# Entity Separation Plan — Weekly Service Architecture

> **Branch**: `claude/entity-separation-architecture-6lwnE`
> **Goal**: Eliminate the monolithic JSON blob on the Service entity. Make Session/Segment
> entities the single source of truth for weekly services. Every keystroke writes directly
> to the entity it belongs to — no more 5-second debounce → bulk-delete-and-recreate cycle.

---

## Current Architecture (What We're Replacing)

```
User types in input
  → setServiceData(prev => {...})          // updates giant in-memory blob
  → 5s debounce timer resets
  → timer fires → saveServiceMutation.mutate()
    → extractServiceMetadata()             // strips entity-managed fields from blob
    → syncWeeklyToSessions()               // DELETE all old segments, CREATE all new ones
      → Session.update/create (per slot)
      → Segment.bulkCreate (all parents)
      → Segment.bulkCreate (all children)
      → Segment.delete (old IDs)
    → Service.update(metadata + full JSON blob)
  → onSuccess → invalidateQueries → subscriptions fire → other tabs reload
```

**Problems**: Subscription storms (~4 refreshActiveProgram calls per save), stale overwrites
in multi-admin, 5s input lag, entire program re-synced on every field change.

## Target Architecture

```
User types in input
  → setServiceData(prev => {...})          // optimistic local update (instant UI)
  → 300ms debounce per field
  → Segment.update(entityId, { [column]: value })   // single entity write
  → React Query invalidation (scoped to that segment)
  → NO Service blob write, NO bulk delete/recreate
```

---

## Files Inventory — What Changes and What Doesn't

### FILES THAT CHANGE (Weekly Service Editor Stack)

| File | Lines | Change Type | Description |
|------|-------|-------------|-------------|
| `src/pages/WeeklyServiceManager.jsx` | ~1236 | Heavy rewrite | Remove blob save pipeline, remove syncWeeklyToSessions, remove extractServiceMetadata, simplify initialization |
| `src/components/service/weekly/useWeeklyServiceHandlers.jsx` | ~574 | Heavy rewrite | Handlers call entity CRUD directly instead of mutating blob |
| `src/components/service/WeeklyServiceInputs.jsx` | ~187 | Moderate rewrite | Input components get debounced entity mutation |
| `src/components/service/ServiceTimeSlotColumn.jsx` | ~560 | Moderate refactor | Remove dead pushFn code, receive segments from props/query |
| `src/components/service/weeklySessionSync.jsx` | ~696 | DELETE entirely | Replaced by direct entity CRUD |
| `src/components/service/weekly/SundaySlotColumns.jsx` | ~138 | Minor props change | Pass session IDs instead of blob |

### FILES THAT DON'T CHANGE (Read-Only Consumers)

These all read from **entities** (Session/Segment queries or ActiveProgramCache) already:

| File | Why No Change |
|------|--------------|
| `functions/refreshActiveProgram.ts` | Reads Session/Segment entities directly. Has JSON fallback for pre-migration data — keep as-is. |
| `src/components/myprogram/useActiveProgramCache.jsx` | Reads from ActiveProgramCache entity (pre-computed by refreshActiveProgram). |
| `src/components/utils/normalizeProgram.jsx` | Normalizes data from ActiveProgramCache. Entity-sourced segments pass through unchanged. |
| `src/components/service/PublicProgramSegment.jsx` | Reads `_resolved_sub_assignments` from entities or falls back to `sub_assignments` config. |
| `src/components/service/SegmentTimeline.jsx` | Same dual-path as PublicProgramSegment. |
| `src/pages/PublicProgramView.jsx` | Reads from ActiveProgramCache. No direct blob access. |
| `src/pages/PublicCountdownDisplay.jsx` | Reads from ActiveProgramCache. |
| `src/components/service/weekly/WeekdayServicePanel.jsx` | Already reads Session/Segment entities with JSON fallback. |
| `src/pages/DirectorConsole.jsx` | Queries Segment entities by session_id. |
| `src/pages/SessionDetail.jsx` | Queries Segment entities by session_id. |
| `src/components/service/SessionColumn.jsx` | Reads Segment entities. |
| `src/components/utils/segmentDataUtils.jsx` | Pure utility functions — no data source dependency. |
| `src/components/service/weekly/BlueprintSegmentEditor.jsx` | Blueprint editor — writes to blueprint Service entity only. |
| `src/components/service/weekly/BlueprintEditor.jsx` | Same — blueprint scope only. |
| `src/components/service/weekly/useServiceSchedules.jsx` | Reads ServiceSchedule entities. No weekly service interaction. |
| `src/components/service/customSessionSync.jsx` | Custom service scope — reads entities, returns JSON shape. Untouched. |
| PDF generation (`generateWeeklyProgramPDF`, `generateAnnouncementsPDF`) | Receives data as arguments from handlers. Data shape doesn't change. |
| `src/pages/MessageProcessing.jsx` | Reads Segment entities by submission_status. |
| `src/pages/TestDashboard.jsx` | Lists all entities. Read-only. |

---

## Execution Phases

### Phase 1: Create `useSegmentMutation` Hook

**New file**: `src/components/service/weekly/useSegmentMutation.jsx`

This is the core primitive that replaces the blob save pipeline. Every input component
will use this hook to write directly to a Segment entity.

```javascript
// Conceptual API
const { mutateField, mutateTeam, mutateSongs, mutatePreServiceNotes } = useSegmentMutation();

// Usage in an input:
mutateField(entityId, "presenter", "Sarah Manzano");
// → 300ms debounce (per entityId+field)
// → Segment.update(entityId, { presenter: "Sarah Manzano" })
// → invalidate segment query
```

**Implementation details:**

1. **Field-level debounce**: Each `entityId + fieldName` pair gets its own 300ms timer.
   Typing "S-a-r-a-h" fires 5 setServiceData calls (instant UI) but only 1 entity write
   (after 300ms idle). This replaces the single 5s global debounce.

2. **Field mapping**: The hook contains the `data key → entity column` map:
   ```
   leader      → { column: "presenter" }
   presenter   → { column: "presenter" }
   preacher    → { column: "presenter" }
   verse       → { column: "scripture_references" }
   translator  → { column: "translator_name" }
   title (field) → { column: "message_title" }    // the "title" in AVAILABLE_FIELDS
   coordinator_notes → { column: "coordinator_notes" }  // 1:1
   // ... etc
   ```

3. **Song mutation**: Special handler — converts songs array to `song_N_title/lead/key`
   flat fields, writes as a single `Segment.update(entityId, { song_1_title, song_1_lead, ... })`.

4. **Team mutation**: Writes to Session entity (not Segment):
   `Session.update(sessionId, { coordinator_name: value })`.

5. **Pre-service notes mutation**: Writes to PreSessionDetails entity:
   `PreSessionDetails.update(detailsId, { general_notes: value })`.

6. **Sub-assignment person mutation**: Creates/updates/deletes child Ministración segments:
   - Non-empty value + no child exists → `Segment.create({ parent_segment_id, presenter, ... })`
   - Non-empty value + child exists → `Segment.update(childId, { presenter: value })`
   - Empty value + child exists → `Segment.update(childId, { presenter: "" })`

7. **Duration mutation**: `Segment.update(entityId, { duration_min: value })`.
   Also recalculates `start_time/end_time` for subsequent segments in the same session
   and calls `Session.update(sessionId, { planned_end_time })`.

**What this hook does NOT do:**
- It does NOT call syncWeeklyToSessions
- It does NOT write to the Service entity blob
- It does NOT trigger bulk delete/recreate
- It does NOT invalidate the full service query (only the specific segment/session)

---

### Phase 2: Rewire `WeeklyServiceInputs.jsx`

**Current**: All inputs read from `ServiceDataContext` (the blob) and write via
`updateSegmentField` → `setServiceData` (blob mutation). No entity writes.

**New**: All inputs still read from `ServiceDataContext` for optimistic UI, but ALSO
trigger the entity mutation via `useSegmentMutation`.

Changes per component:

| Component | Current Write | New Write |
|-----------|--------------|-----------|
| `SegmentAutocomplete` | `updateSegmentField(service, idx, field, value)` | Same + `mutateField(segment._entityId, field, value)` |
| `SegmentTextInput` | `updateSegmentField(service, idx, field, value)` | Same + `mutateField(segment._entityId, field, value)` |
| `SegmentTextarea` | `updateSegmentField(service, idx, field, value)` | Same + `mutateField(segment._entityId, field, value)` |
| `SongInputRow` | `updateSegmentField(service, idx, "songs", ...)` | Same + `mutateSongs(segment._entityId, songs)` |
| `TeamInput` | `updateTeamField(field, service, value)` | Same + `mutateTeam(sessionId, field, value)` |
| `PreServiceNotesInput` | `setServiceData` (blob) | Same + `mutatePreServiceNotes(detailsId, value)` |
| `RecesoNotesInput` | `setServiceData` (blob) | Same + `Service.update(serviceId, { receso_notes: {...} })` |

**Key principle**: `setServiceData` still runs immediately for optimistic UI. The entity
mutation runs on its own 300ms debounce. If the entity write fails, the next full load
will restore the correct value (eventual consistency, not transactional).

**UpdatersContext expansion**: Add `useSegmentMutation` return values to the context so
`ServiceTimeSlotColumn` can access them for duration changes and song add/remove.

---

### Phase 3: Rewire `useWeeklyServiceHandlers.jsx`

**Handlers that change:**

| Handler | Current Behavior | New Behavior |
|---------|-----------------|--------------|
| `updateSegmentField` | Mutates blob via setServiceData | Still mutates blob (optimistic) + calls mutateField (entity) |
| `updateTeamField` | Mutates blob | Still mutates blob + calls mutateTeam |
| `addSpecialSegment` | Mutates blob, called requestImmediateSync (dead) | Mutates blob + `Segment.create()` + `setServiceData` to inject `_entityId` |
| `removeSpecialSegment` | Mutates blob | Mutates blob + `Segment.delete(entityId)` |
| `handleMoveSegment` | Swaps in blob | Swaps in blob + `Segment.update(id1, {order: n2})`, `Segment.update(id2, {order: n1})` |
| `copySegmentToNextSlot` | Clones in blob | Clones in blob + `Segment.create()` in target session |
| `copyAllToNextSlot` | Clones all in blob | Multiple `Segment.create()` + `Session.update` + `PreSessionDetails.update` |
| `copyTeamToNextSlot` | Clones in blob | `Session.update(targetSessionId, { team fields })` |
| `copyPreServiceNotesToNextSlot` | Clones in blob | `PreSessionDetails.update(targetId, { general_notes })` |
| `executeResetToBlueprint` | Resets blob from blueprint | Delete all Segments in target session(s), create new ones from blueprint, update serviceData |
| `handleSaveParsedVerses` | Mutates blob | Mutates blob + `Segment.update(entityId, { parsed_verse_data, scripture_references })` |

**Handlers that DON'T change** (they don't touch service data):
- `handleAnnouncementSubmit`, `openAnnouncementEdit`, `optimizeAnnouncementWithAI`,
  `moveAnnouncementPriority` — all announcement-scoped
- `handleSavePrintSettings` — print settings only
- `handleDownloadProgramPDF`, `handleDownloadAnnouncementsPDF` — read-only consumers
- `calculateServiceTimes` — pure calculation from serviceData

**Copy operations — content-only strategy preserved**:
Lines 120-143 define the copy strategy: preserve target structure (type, title, duration,
fields, sub_assignments, actions, _entityId, _sessionId), copy only content (data, songs).
In entity-first mode, copy creates NEW entities in the target session with the source
content. The `cloneSegmentWithoutEntityRefs` helper (lines 146-154) is still used but
now the clone gets a fresh _entityId from `Segment.create()`.

---

### Phase 4: Simplify `WeeklyServiceManager.jsx`

This is the biggest change by line count but conceptually straightforward — delete the
blob save pipeline.

**DELETE these pieces (~500 lines):**

| What | Lines | Replacement |
|------|-------|-------------|
| `extractServiceMetadata()` | 69-93 | Not needed — no blob to strip |
| `saveServiceMutation` | 383-457 | Not needed — each field writes its own entity |
| `hasUnsavedChanges` / `lastSavedData` state | 141-143 | Not needed — writes are immediate |
| `lastSavedDataRef` / `hasUnsavedChangesRef` | 369-372 | Not needed |
| `flushRef` / unmount flush effect | 835-863 | Not needed — no pending blob |
| `beforeunload` handler | 866-884 | Not needed |
| `ownSaveInProgressRef` | 367 | Not needed — no subscription guard needed |
| `entitySyncInProgressRef` | 364 | Not needed |
| 5s debounce auto-save effect | 924-933 | Not needed — replaced by per-field 300ms debounce |
| localStorage backup effect | 807-814 | Not needed — entities are the backup |
| Track unsaved changes effect | 799-802 | Not needed |
| `showStaleWarning` / `staleInfo` state | 169-170 | Simplified — entity-level conflict detection |
| `externalChangeAvailable` state | 368 | Simplified — React Query handles staleness |

**SIMPLIFY these pieces (~200 lines):**

| What | Lines | Simplification |
|------|-------|---------------|
| Multi-admin subscription effect | 745-787 | Remove ownSaveInProgressRef guards. Entity subscriptions can trigger React Query invalidation directly. No 5.5s/6s timing dance. |
| Initialization effect | 516-739 | Remove blob diffing and lastSavedData capture. Still need: load entities → build serviceData → merge with blueprint for new services. |
| `ServiceDataContext.Provider` | 951 | Still needed for optimistic reads |
| `UpdatersContext.Provider` | 952 | Expanded with mutation functions |

**KEEP these pieces unchanged:**

| What | Lines | Why |
|------|-------|-----|
| `selectedDate` state + date picker | 128-137 | UI state |
| Blueprint query | 181-188 | Still needed for new service creation |
| Week services query | 191-235 | Still needed for date navigation |
| Existing data query | 263-322 | Still needed to load service for date |
| Announcement queries + mutations | 324-354, 460-493 | Separate domain, untouched |
| Announcement UI state | 150-158 | Separate domain |
| Print settings state + UI | 159-162 | Separate domain |
| Verse parser state + UI | 163-164 | Separate domain |
| Special segment dialog state | 146-149 | UI state |
| `showResetConfirm` state | 165 | UI state |
| Auto-select announcements effect | 887-893 | Announcement domain |
| Filter ghost announcements effect | 896-902 | Announcement domain |
| Sync announcements to serviceData effect | 905-910 | Still writes to serviceData for display |
| `activeDay` state + weekday tabs | 174 | UI state |
| Entire render JSX | 936-1236 | Structure unchanged, just fewer props |

**NEW additions (~100 lines):**

1. **Session + Segment queries per service**: Replace the single `existingData` blob query
   with entity queries that React Query manages:
   ```javascript
   const { data: sessions } = useQuery({
     queryKey: ['serviceSessions', serviceId],
     queryFn: () => base44.entities.Session.filter({ service_id: serviceId }),
     enabled: !!serviceId,
   });

   const { data: allSegments } = useQuery({
     queryKey: ['serviceSegments', serviceId],
     queryFn: async () => {
       const results = await Promise.all(
         sessions.map(s => base44.entities.Segment.filter({ session_id: s.id }, 'order'))
       );
       return results.flat();
     },
     enabled: sessions?.length > 0,
   });
   ```

2. **Entity-to-serviceData transformation**: Still need to build the in-memory `serviceData`
   object from entities for the optimistic UI layer. This uses the same logic as the current
   `loadWeeklyFromSessions` but lives inline (or in a small utility) rather than in the
   700-line weeklySessionSync.jsx.

3. **Service creation flow**: When no service exists for the selected date, create the
   Service entity + Session entities + Segment entities from blueprint. This replaces the
   current "seed from blueprint → save blob → sync to entities" with direct entity creation.

---

### Phase 5: Clean Up `ServiceTimeSlotColumn.jsx`

**Remove:**
- Dead `pushFn` code (lines 82, 100-102, 120-122) — never provided via context
- `debouncedSave` prop and all calls to it — no longer needed

**Modify:**
- Duration change (lines 523-533, 337-347): Instead of `setServiceData` + `debouncedSave`,
  call `setServiceData` (optimistic) + `mutateField(entityId, "duration", value)` (entity).
- Song add/remove (lines 85-123): Instead of `setServiceData` + dead `pushFn`,
  call `setServiceData` (optimistic) + `mutateSongs(entityId, songs)` (entity).

**Keep unchanged:**
- All rendering logic (segment cards, team section, receso, pre-service)
- All `segment.fields?.includes()` checks
- All sub_assignment rendering
- Copy/move button wiring (these call handlers which are already entity-aware from Phase 3)

---

### Phase 6: Delete `weeklySessionSync.jsx`

After Phases 1-5, nothing imports from this file. Delete it entirely.

**Functions deleted:**
- `syncWeeklyToSessions` — replaced by per-field entity writes
- `loadWeeklyFromSessions` — replaced by React Query entity queries + inline transform
- `segmentEntityToWeeklyJSON` — simplified into Phase 4's entity-to-serviceData transform
- `buildSubAsignaciones` — replaced by child segment CRUD in useSegmentMutation
- `flattenSongs` — moved to useSegmentMutation as a private helper
- `resolvePresenter` — moved to useSegmentMutation as a private helper
- `findMatchingBlueprintSegment` — no longer needed (ui_fields on entities)
- `normalizeSegmentType` — kept if needed, or inlined
- `DEFAULT_TIME_SLOTS` — replaced by useServiceSchedules

**Note**: The `TYPE_MAP` constant (lines 43-61) may still be needed for blueprint seeding
(creating new segments from blueprint types). If so, extract it to a shared constants file.

---

### Phase 7: Backfill Migration + Cleanup

1. **Backfill `ui_fields` and `ui_sub_assignments`**: Query all Segment entities where
   these are null/empty. Match against the blueprint by type + position. Populate.
   This eliminates the need for `findMatchingBlueprintSegment` fallback.

2. **Stop writing JSON blob to Service entity**: The Service entity's time-slot arrays
   (`"9:30am"`, `"11:30am"`) become unused. Don't delete them yet (backward compatibility
   for `refreshActiveProgram` JSON fallback), but stop writing to them.

3. **Remove JSON fallback from `refreshActiveProgram.ts`**: Once all services have entity
   segments, the JSON fallback path (lines 511-585) can be removed. This is the final
   cleanup — do it after confirming all production services have entities.

4. **Remove `receso_notes` from Service entity**: Move to a per-service-pair entity or
   keep on Service (it's small). Low priority.

---

## Risk Mitigation

### Multi-Admin Conflict

**Current**: 5.5s/6s subscription timing dance with ownSaveInProgressRef.

**New**: Each field write is atomic to one entity column. Two admins editing different
segments simultaneously write to different Segment entities — no conflict. Two admins
editing the SAME field on the SAME segment: last write wins (300ms debounce), which is
the same behavior as the current system but with 300ms granularity instead of 5s.

React Query's `staleTime` + subscription-based invalidation ensures both admins see
each other's changes within seconds.

### Subscription Storms

**Current**: One save triggers Service.update + 2 Session.updates + N Segment creates/deletes
→ refreshActiveProgram fires 3+ times.

**New**: One keystroke triggers ONE Segment.update. refreshActiveProgram is only triggered
by Service/Session changes (not Segment — disabled by Decision). So typing in a segment
field triggers ZERO refreshActiveProgram calls. Only structural changes (add/remove segment,
change session times) trigger a cache refresh.

### Data Integrity During Transition

**Risk**: Users on old code write blob, users on new code write entities.

**Mitigation**: Deploy as a single release. The blob write path is removed entirely —
there's no gradual migration. The initialization path still reads from entities (which
the current code already populates), so existing data works immediately.

### Blueprint Compatibility

All 8 AVAILABLE_FIELDS have verified entity column mappings. Sub_assignment
`person_field_name` values (arbitrary strings) survive via `ui_sub_assignments` JSON
column + child Ministración entity `presenter` column. No data loss possible for any
blueprint configuration.

---

## Execution Order

```
Phase 1: useSegmentMutation hook (NEW FILE — no existing code breaks)
Phase 2: WeeklyServiceInputs.jsx (ADD entity writes alongside existing blob writes)
Phase 3: useWeeklyServiceHandlers.jsx (ADD entity CRUD alongside existing blob mutations)
  ↑ At this point, BOTH paths write: blob + entities. System is fully functional.
  ↓ Below this point, we remove the blob path.
Phase 4: WeeklyServiceManager.jsx (REMOVE blob save pipeline, simplify initialization)
Phase 5: ServiceTimeSlotColumn.jsx (REMOVE dead code, wire entity mutations)
Phase 6: Delete weeklySessionSync.jsx
Phase 7: Backfill + cleanup (can happen anytime after Phase 4)
```

Phases 1-3 are **additive** — they add entity writes without removing anything. The system
works with both paths active. Phases 4-6 are **subtractive** — they remove the blob path.
Phase 7 is cleanup.

Each phase is independently deployable and testable.

---

## Testing Checklist

After each phase, verify:

- [ ] Create new service for a date with no existing service → segments appear from blueprint
- [ ] Edit leader field → value persists after page reload
- [ ] Edit song title/lead/key → persists
- [ ] Edit sub_assignment person → child Ministración entity created/updated
- [ ] Edit team fields (coordinators, sound, etc.) → Session entity updated
- [ ] Edit pre-service notes → PreSessionDetails entity updated
- [ ] Add special segment → new Segment entity created
- [ ] Remove special segment → Segment entity deleted
- [ ] Move segment up/down → order values swapped on entities
- [ ] Copy segment to next slot → new Segment in target session
- [ ] Copy all to next slot → all entities cloned
- [ ] Reset to blueprint → old segments deleted, new ones from blueprint
- [ ] Two browser tabs editing simultaneously → no data loss
- [ ] TV display (PublicProgramView) shows current data
- [ ] PDF generation works
- [ ] Page reload restores all data from entities
- [ ] Announcements section unaffected
- [ ] Weekday service panels unaffected
