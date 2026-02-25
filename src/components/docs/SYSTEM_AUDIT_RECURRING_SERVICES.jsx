# System Audit: Recurring Service Lifecycle

**Date:** 2026-02-25
**Auditor:** Base44 AI (Senior Technical Decision-Maker)
**Scope:** Create → Blueprint → Hydrate → Edit → Reset → Public Form cycles

---

## 1. ENTITY MAP (Source of Truth)

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| **ServiceSchedule** | Config: which days have services, with what sessions | `day_of_week`, `sessions[]` (name, order, blueprint_id) |
| **Service** | Per-date service record (also used for blueprints when status='blueprint') | `date`, `day_of_week`, `status`, `service_type`, `segments` (canonical blueprint array) |
| **Session** | Per-time-slot entity within a Service | `service_id`, `name` (slot name), `date`, team fields |
| **Segment** | Per-block entity within a Session | `session_id`, `service_id`, `order`, `segment_type`, `ui_fields`, `ui_sub_assignments`, all content fields |
| **PreSessionDetails** | Pre-service notes per Session | `session_id`, `general_notes` |
| **PublicFormIdempotency** | Idempotency tracking for public form submissions | `idempotency_key`, `status` |
| **SpeakerSubmissionVersion** | Audit trail for speaker submissions | `segment_id` (composite), `content`, `processing_status` |

---

## 2. LIFECYCLE PHASES (Current State)

### PHASE 1: CREATION

**Trigger:** User clicks "Crear Servicio" in EmptyDayPrompt  
**OR** ensureRecurringServices scheduled job runs nightly

#### Path A: Manual (EmptyDayPrompt.jsx)
1. Creates Service entity (metadata only, no segment JSON blobs)
2. For each slotName from ServiceSchedule.sessions:
   - Creates Session entity (`service_id`, `name`, `date`, `order`)
   - For each segment in blueprint.segments:
     - Normalizes type → Segment entity enum
     - Creates Segment entity with `ui_fields`, `ui_sub_assignments`
3. Calls `onServiceCreated()` → invalidates query → DayServiceEditor loads

**FINDING:** This flow creates Sessions sequentially (for-loop with `await`). If it fails mid-loop (e.g., rate limit at session 2 of 2), the Service entity exists with partial Sessions. **No rollback.**

#### Path B: Automated (ensureRecurringServices.js)
1. Checks if Service exists for next occurrence date
2. Creates Service entity with LEGACY JSON blob format (`servicePayload[slotName] = cloneSegments(...)`)
3. Does NOT create Session or Segment entities

**CRITICAL FINDING:** The auto-creation job writes segment data as JSON blobs on the Service entity (`servicePayload["9:30am"] = [...]`). But DayServiceEditor's queryFn uses STRICT MODE — it ignores JSON blobs and only loads from Session/Segment entities via `loadWeeklyFromSessions()`. This means:
- ensureRecurringServices creates a Service with data
- DayServiceEditor loads it, finds no Sessions, gets empty segments
- User sees an empty service (or one requiring reset)
- The JSON blob data is effectively orphaned

**This is the #1 systemic bug:** The creation job and the editor disagree on where data lives.

### PHASE 2: HYDRATION (DayServiceEditor init)

**Trigger:** DayServiceEditor mounts with a date + dayOfWeek

1. Query: `Service.filter({ date })` → find matching weekly service
2. `loadWeeklyFromSessions(base44, service.id, blueprint)`:
   - Batch-loads Sessions for the service
   - Batch-loads Segments for all sessions
   - Batch-loads PreSessionDetails
   - Transforms each Segment entity → weekly JSON format via `segmentEntityToWeeklyJSON()`
3. Returns `{ ...service, ...entityData, _fromEntities: true }`
4. DayServiceEditor's `useEffect` runs `mergeSegmentsWithBlueprint()`:
   - If segment has `_entityId` + `fields`: keep as-is (entity-backed)
   - If segment lacks fields: merge from blueprint by type matching
   - Hardcoded fallback sub_assignments for worship/message types
5. Sets `serviceData` in local state

**FINDING:** `mergeSegmentsWithBlueprint` has 3 tiers of fallback:
1. Entity has `fields` → use entity
2. Blueprint exists → match by type+position → merge
3. Neither → hardcoded defaults per type

This 3-tier merge makes it extremely difficult to debug which source populated a field. There is no traceability (no logging of which tier was used).

**FINDING:** `loadWeeklyFromSessions` passes `blueprint?.[slotName]` as context, but blueprints use a canonical `segments` array (not slot-keyed). So `blueprintSlot` is always `undefined` for properly structured blueprints. The fallback in `segmentEntityToWeeklyJSON` → `findMatchingBlueprintSegment` receives `null` and returns `null`. Blueprint matching in the READ path is effectively dead code for post-migration data.

### PHASE 3: EDITING (Field Mutations)

**Trigger:** User edits a field in any input component

1. Input component updates local state via `UpdatersContext.updateSegmentField()`
2. Input component calls `UpdatersContext.mutateSegmentField(entityId, field, value)`
3. `useSegmentMutation` maps UI field → entity column via `SEGMENT_FIELD_MAP`
4. Debounces 300ms, then writes `Segment.update(entityId, { column: value })`

**FINDING:** The "leader" field has a special history:
- Blueprint stores `fields: ["leader"]`
- UI renders "Director" label for worship segments
- `SEGMENT_FIELD_MAP` does NOT have a "leader" entry
- So `mutateSegmentField(entityId, "leader", value)` writes to column "leader" (which doesn't exist on Segment entity)
- The value is silently accepted by the DB (schema-less JSON storage) but never read back properly

**WAIT:** Checking SEGMENT_FIELD_MAP more carefully: `leader` is NOT in the map. The fallback is `field === column`, so it writes `{ leader: value }` to Segment. But `segmentEntityToWeeklyJSON` reads `segment.presenter` for the data.presenter field. **This means "leader" field edits are written to a phantom column and never re-hydrated.** This is why the leader field "doesn't stick" across page reloads.

**CORRECTION:** Looking at the conversation history, this was identified and supposedly fixed by mapping leader → presenter. Let me check if that fix is in the current code... No, `SEGMENT_FIELD_MAP` does not have `leader: "presenter"`. **This mapping is missing.**

### PHASE 4: RESET

**Trigger:** User clicks reset button → `executeResetToBlueprint(slotsToReset)`

1. For each slot:
   a. Resolve blueprint (session.blueprint_id → blueprints.find)
   b. Ensure Session exists (create if missing)
   c. `deleteAllSegmentsInSession(sessionId)` — deletes ALL child segments via `Promise.all(segments.map(delete))`
   d. Sequential `for` loop: create new Segment entities from blueprint
   e. Update local state with new `_entityId` values
2. Mark `_fromEntities: true`

**FINDINGS:**

1. **No atomicity:** Steps c and d are not transactional. If step d fails at segment 3 of 4, the session has 3 segments instead of 4. No rollback.

2. **Rate limit risk:** `deleteAllSegmentsInSession` uses `Promise.all` on potentially many segments. If a service has 4 segments × 2 slots = 8 deletes + 8 creates = 16 API calls. Rate limit (429) is likely.

3. **Blueprint resolution uses current blueprint, not the one originally used.** If admin A edits a blueprint while admin B is editing a service, admin B's reset will apply the new blueprint — potentially losing structural changes.

4. **Type normalization is duplicated** in 4 places:
   - `EmptyDayPrompt.handleCreate()`
   - `executeResetToBlueprint()` in useWeeklyServiceHandlers
   - `segmentEntityToWeeklyJSON()` in weeklySessionSync
   - `mergeSegmentsWithBlueprint()` in DayServiceEditor
   Each has its own `typeMap` object with slightly different entries.

### PHASE 5: PUBLIC FORM SUBMISSION

**Trigger:** Speaker submits content via serveWeeklyServiceSubmission form

1. `serveWeeklyServiceSubmission.js` loads upcoming services, discovers message segments
2. Builds composite ID: `weekly_service|{serviceId}|{timeSlot}|{segmentIdx}|message`
3. Speaker submits via `submitWeeklyServiceContent.js`
4. Submit function resolves Segment entity via:
   - `Session.filter({ service_id })` → find session by name
   - `Segment.filter({ session_id })` → find Plenaria by index or type
5. Writes directly to Segment entity: `Segment.update(entity.id, { parsed_verse_data, scripture_references, ... })`

**RISK (confirmed by user):** If a reset deletes segments between form load and submission, the `Segment.update()` call will fail with "entity not found." The idempotency record stays in `processing` state forever.

---

## 3. DUPLICATED TYPE NORMALIZATION MAPS

The following type normalization logic is duplicated with drift risk:

| Location | Keys handled |
|----------|-------------|
| EmptyDayPrompt (line 89-103) | 21 entries, includes mc/artes/breakout/panel/receso/almuerzo |
| executeResetToBlueprint (handlers line ~370) | 21 entries, identical to EmptyDayPrompt |
| segmentEntityToWeeklyJSON (weeklySessionSync line 241-256) | 8 entries (worship/welcome/offering/message only) |
| mergeSegmentsWithBlueprint (DayServiceEditor line 282-289) | 8 entries (worship/welcome/offering/message only) |
| ensureRecurringServices | 0 — uses raw blueprint types, relies on Service JSON blob |

**Finding:** The normalization maps are inconsistent. Structural operations (create/reset) handle 21 types. Read operations (hydrate/merge) handle only 8 types. If a blueprint uses type "mc" or "receso", the read path won't normalize it and blueprint matching fails.

---

## 4. CRITICAL INCONSISTENCY: ensureRecurringServices vs Entity Path

| Aspect | ensureRecurringServices | EmptyDayPrompt |
|--------|------------------------|----------------|
| Creates Service | ✅ | ✅ |
| Creates Sessions | ❌ | ✅ |
| Creates Segments | ❌ (writes JSON blob) | ✅ (individual entities) |
| Creates PreSessionDetails | ❌ | ❌ |
| DayServiceEditor can load | ❌ (no Sessions found) | ✅ |
| Public form can find segments | ❌ (no Session/Segment entities) | ✅ |

**This is the root cause of the fragmentation.** The automated job creates services that the editor and public form cannot use, because they expect Session/Segment entities.

---

## 5. FIELD MAPPING GAPS

Missing from SEGMENT_FIELD_MAP in useSegmentMutation:
- `leader` → should map to `presenter` (worship segments)
- `ministry_leader` → should map to sub-assignment flow (handled separately)

---

## 6. CONCURRENCY RISKS

| Scenario | Current Behavior | Risk |
|----------|-----------------|------|
| Two admins edit different fields of same segment | Both succeed (last-write-wins per field) | Low — different columns |
| Two admins edit same field | Silent overwrite (no conflict detection) | Medium |
| Admin resets while another edits | Segments deleted under active editor | HIGH — editor writes to deleted entities |
| Admin resets while speaker submits via form | Segment.update fails (entity not found) | HIGH — submission lost |
| Auto-create job runs while admin manually creates | Two Service records for same date | Medium — query picks most recent |

---

## 7. RECOMMENDATIONS (Prioritized)

### P0: Fix ensureRecurringServices to create Session/Segment entities (not JSON blobs)
- **Impact:** Fixes the root cause of "empty services after auto-creation"
- **Risk:** Low (additive, doesn't change existing data)
- **Dependencies:** None

### P1: Add `leader` → `presenter` mapping to SEGMENT_FIELD_MAP
- **Impact:** Fixes worship leader field not persisting
- **Risk:** Low (single line change)

### P2: Extract shared `normalizeSegmentType()` function
- **Impact:** Eliminates 4 copies of type normalization
- **Risk:** Low (pure refactor)

### P3: Add reset safeguard — snapshot before delete
- **Impact:** Prevents data loss on partial reset failure
- **Risk:** Low (additive)

### P4: Make reset use bulkCreate instead of sequential creates
- **Impact:** Reduces 429 risk during reset
- **Risk:** Low (API supports it)