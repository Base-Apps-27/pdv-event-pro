# SERVICE SEGMENT ENTITY LIFT — COMPLETE EXECUTION PLAN

> **Goal**: Weekly services currently store segments as embedded JSON under `"9:30am"` and `"11:30am"` keys on the Service entity. This lift creates proper Session + Segment entities from this data, matching the pattern already used by Events and Custom Services. Users notice zero UX changes.

> **Key discovery**: `refreshActiveProgram.ts` (line 378-393) and `getPublicProgramData.ts` (line 404-407) **already prefer Session/Segment entities** when they exist, falling back to JSON only when no Sessions are found. Creating entities for weekly services automatically activates these code paths.

---

## TABLE OF CONTENTS

1. [Architecture Decision](#1-architecture-decision)
2. [Entity Model](#2-entity-model)
3. [New Files to Create](#3-new-files-to-create)
4. [Files to Modify — CORE (7 files)](#4-files-to-modify--core)
5. [Files to Modify — ENRICHMENT (5 files)](#5-files-to-modify--enrichment)
6. [Files That Need NO Changes (confirmed)](#6-files-that-need-no-changes)
7. [Migration Script](#7-migration-script)
8. [Execution Order & Dependency Graph](#8-execution-order--dependency-graph)
9. [Verification Protocol](#9-verification-protocol)
10. [Rollback Plan](#10-rollback-plan)
11. [Field Mapping Reference](#11-field-mapping-reference)

---

## 1. ARCHITECTURE DECISION

### Strategy: "Dual-Write with Entity-Prefer Reads"

```
WRITE PATH (on every save):
  WeeklyServiceManager UI state (JSON format)
    ├─► Service entity (JSON arrays — KEPT for backward compat during transition)
    └─► Session + Segment entities (NEW — created by syncWeeklyToSessions)

READ PATH (on load):
  WeeklyServiceManager
    ├─► TRY: Load from Session + Segment entities → transform to JSON format for UI
    └─► FALLBACK: Load from Service JSON (pre-migration data)

BACKEND READ PATH:
  refreshActiveProgram / getPublicProgramData
    ├─► TRY: Session.filter({ service_id }) → entity path (ALREADY EXISTS in code)
    └─► FALLBACK: Service["9:30am"]/["11:30am"] → JSON path (ALREADY EXISTS in code)
```

### Why dual-write:
- Zero-risk deployment: if entity sync fails, JSON is still intact
- All display surfaces that read from cache (TV, MyProgram, Reports) work immediately
- Speaker submission pipeline can be migrated independently
- Dual-write can be removed later once all paths verified

### What stays on Service entity (permanent):
- `id`, `date`, `name`, `status`, `day_of_week`
- `selected_announcements` (array of AnnouncementItem IDs)
- `print_settings_page1`, `print_settings_page2`
- `receso_notes` (break notes — shared metadata)
- `blueprint_id` (reference to template)

### What moves to Session entities (per time slot):
| Weekly Service JSON field | Session entity field |
|---------------------------|---------------------|
| `coordinators["9:30am"]` | `Session.coordinators` |
| `ujieres["9:30am"]` | `Session.ushers_team` |
| `sound["9:30am"]` | `Session.sound_team` |
| `luces["9:30am"]` | `Session.tech_team` |
| `fotografia["9:30am"]` | `Session.photography_team` |
| `pre_service_notes["9:30am"]` | `Session.pre_service_notes` (new field on Session, or store via PreSessionDetails.general_notes) |

### What moves to Segment entities (per segment):
See [Field Mapping Reference](#11-field-mapping-reference) for complete field-by-field mapping.

---

## 2. ENTITY MODEL

### Session Entity — Fields used for weekly services

```
Session {
  id:                     auto-generated
  service_id:             FK → Service.id (REQUIRED for weekly)
  event_id:               null (weekly services don't have events)
  name:                   "9:30am" | "11:30am" (matches legacy slot key)
  date:                   YYYY-MM-DD (from Service.date)
  planned_start_time:     "09:30" | "11:30"
  planned_end_time:       calculated from last segment
  location:               from Service.location (if exists)
  order:                  1 (9:30am) | 2 (11:30am)
  status:                 "confirmed"
  session_color:          "green" (9:30am) | "blue" (11:30am)

  // Team fields (moved from Service.coordinators["9:30am"] etc.)
  coordinators:           string
  ushers_team:            string
  sound_team:             string
  tech_team:              string  (was "luces")
  photography_team:       string  (was "fotografia")

  // Live control (initialized to defaults)
  live_adjustment_enabled:   false
  live_director_user_id:     null
  live_director_user_name:   null
}
```

### Segment Entity — Fields used for weekly services

All fields already exist on the Segment entity (defined in ENTITY_REFERENCE.md.jsx). No schema changes needed. See [Field Mapping Reference](#11-field-mapping-reference) for the exact mapping from weekly JSON to entity fields.

### No new entities needed. No schema changes needed.

---

## 3. NEW FILES TO CREATE

### File 1: `src/components/service/weeklySessionSync.jsx`

**Purpose**: Bidirectional sync between weekly service JSON format and Session/Segment entities.

**Functions to implement**:

#### `syncWeeklyToSessions(base44, serviceResult, serviceData)`
Creates/updates Session + Segment entities from the weekly service JSON state.

```
INPUT:
  serviceResult = { id, date, name, location, ... }  (saved Service entity)
  serviceData = {
    "9:30am": [segments...],
    "11:30am": [segments...],
    coordinators: { "9:30am": "...", "11:30am": "..." },
    ujieres: { "9:30am": "...", ... },
    sound: { "9:30am": "...", ... },
    luces: { "9:30am": "...", ... },
    fotografia: { "9:30am": "...", ... },
    pre_service_notes: { "9:30am": "...", ... },
  }

ALGORITHM:
  for each slot in ["9:30am", "11:30am"]:
    1. Session.filter({ service_id, name: slot })
    2. If exists: update team fields, date, planned_start_time
       If not: create Session with all fields
    3. Delete all existing Segments for this session (same pattern as sessionSync.jsx)
    4. Create new Segments from serviceData[slot] array
       - Use the EXACT same field mapping as sessionSync.jsx lines 83-110
       - Handle sub_asignaciones (Alabanza with Ministración children)
       - Calculate start_time/end_time from cumulative duration
       - Map "9:30am" → base time 09:30, "11:30am" → base time 11:30
    5. bulkCreate parent segments, then children with parent_segment_id

OUTPUT: void (fire-and-forget, errors logged but don't block save)
```

**CRITICAL**: Reuse the segment mapping logic from `sessionSync.jsx` lines 59-148. Do NOT duplicate — extract a shared `mapWeeklySegmentToEntity(segData, sessionId, serviceId, order, startTimeStr, endTimeStr)` helper, or copy the logic verbatim.

#### `loadWeeklyFromSessions(base44, serviceId, blueprint)`
Loads Session + Segment entities and transforms back to weekly service JSON format for UI consumption.

```
INPUT:
  serviceId = string (Service entity ID)
  blueprint = { "9:30am": [...], "11:30am": [...] } (for fields/sub_assignments metadata)

ALGORITHM:
  1. sessions = Session.filter({ service_id: serviceId })
  2. If sessions.length === 0: return null (signal to caller: use JSON fallback)
  3. For each session:
     a. segments = Segment.filter({ session_id: session.id }, 'order')
     b. Transform each Segment entity → weekly JSON format (see Field Mapping Reference)
     c. Merge with blueprint to restore `fields`, `sub_assignments`, `actions` metadata
  4. Build serviceData object:
     {
       "9:30am": transformedSegments for session.name === "9:30am",
       "11:30am": transformedSegments for session.name === "11:30am",
       coordinators: { "9:30am": session.coordinators, "11:30am": ... },
       ujieres: { "9:30am": session.ushers_team, ... },
       sound: { "9:30am": session.sound_team, ... },
       luces: { "9:30am": session.tech_team, ... },
       fotografia: { "9:30am": session.photography_team, ... },
       pre_service_notes: { "9:30am": session.pre_service_notes || "", ... },
     }
  5. Return serviceData

OUTPUT: serviceData object in weekly JSON format, or null if no sessions exist
```

**CRITICAL**: The output format MUST be identical to what `existingData` looks like when loaded from Service entity today. Every child component (ServiceTimeSlotColumn, WeeklyServiceInputs, SpecialSegmentDialog, etc.) expects this exact shape.

#### `segmentEntityToWeeklyJSON(segment, childSegments)`
Converts a single Segment entity back to weekly JSON format.

```
INPUT: Segment entity object + array of child segments (for sub_asignaciones)

OUTPUT:
{
  title: segment.title,
  type: segment.segment_type,
  duration: segment.duration_min,
  data: {
    presenter: segment.presenter,
    leader: segment.presenter,  // backward compat for worship
    preacher: segment.presenter, // backward compat for message
    songs: reconstructSongsArray(segment),  // song_N_* → [{title, lead, key}]
    message_title: segment.message_title,
    title: segment.message_title,  // data.title for messages
    verse: segment.scripture_references,
    parsed_verse_data: segment.parsed_verse_data,
    translator: segment.translator_name,
    submitted_content: segment.submitted_content,
    description_details: segment.description_details,
    presentation_url: segment.presentation_url,
    content_is_slides_only: segment.content_is_slides_only,
    coordinator_notes: segment.coordinator_notes,
    projection_notes: segment.projection_notes,
    sound_notes: segment.sound_notes,
    ushers_notes: segment.ushers_notes,
    translation_notes: segment.translation_notes,
    stage_decor_notes: segment.stage_decor_notes,
    actions: segment.segment_actions || [],
  },
  // Root-level duplicates (some components read from root):
  message_title: segment.message_title,
  submitted_content: segment.submitted_content,
  parsed_verse_data: segment.parsed_verse_data,
  scripture_references: segment.scripture_references,
  presentation_url: segment.presentation_url,
  notes_url: segment.notes_url,
  content_is_slides_only: segment.content_is_slides_only,
  submission_status: segment.submission_status,
  projection_notes: segment.projection_notes,
  actions: segment.segment_actions || [],
  requires_translation: segment.requires_translation,
  default_translator_source: segment.default_translator_source || "manual",
  // sub_asignaciones from child segments:
  sub_asignaciones: childSegments.map(child => ({
    title: child.title,
    presenter: child.presenter,
    duration: child.duration_min,
    label: child.title,
    person_field_name: 'ministry_leader',
    duration_min: child.duration_min,
  })),
  // Preserve entity metadata for efficient updates:
  _entityId: segment.id,
  _sessionId: segment.session_id,
}
```

#### `reconstructSongsArray(segment)`
Converts flat `song_N_title/lead/key` fields back to array format.

```
const songs = [];
for (let i = 1; i <= 6; i++) {
  const title = segment[`song_${i}_title`];
  if (title) {
    songs.push({
      title,
      lead: segment[`song_${i}_lead`] || "",
      key: segment[`song_${i}_key`] || "",
    });
  }
}
return songs;
```

---

## 4. FILES TO MODIFY — CORE

### File 1: `src/pages/WeeklyServiceManager.jsx`

**Location**: Lines 114-133 (existingData query) and lines 238-350 (useEffect init)

**Change A — Add Session/Segment query** (after line 133):
```javascript
// NEW: Fetch Sessions + Segments for this service (entity-first load)
const { data: sessionEntities } = useQuery({
  queryKey: ['weeklyServiceSessions', existingData?.id],
  queryFn: async () => {
    if (!existingData?.id) return null;
    return await loadWeeklyFromSessions(base44, existingData.id, blueprintData || WEEKLY_BLUEPRINT);
  },
  enabled: !!existingData?.id,
});
```

**Change B — Update useEffect init** (lines 238-350):
In the `if (existingData)` branch, BEFORE the existing merge logic:
```javascript
useEffect(() => {
  if (existingData) {
    // NEW: Prefer entity-loaded data if available
    let baseData;
    if (sessionEntities) {
      // Entity-sourced: merge with existing Service metadata
      baseData = {
        ...existingData,  // Keep Service-level fields (id, date, status, announcements, print_settings)
        ...sessionEntities,  // Override with entity-sourced segment/team data
      };
    } else {
      // Fallback: use JSON from Service entity (pre-migration or sync failure)
      baseData = existingData;
    }

    // Then continue with existing mergeSegmentsWithBlueprint logic using baseData
    const loadedData = {
      ...baseData,
      "9:30am": mergeSegmentsWithBlueprint(baseData["9:30am"] || [], "9:30am"),
      "11:30am": mergeSegmentsWithBlueprint(baseData["11:30am"] || [], "11:30am"),
      // ... rest of existing merge logic unchanged
    };
    // ... rest unchanged
  }
}, [existingData, sessionEntities, ...]);  // Add sessionEntities to deps
```

**Import to add**:
```javascript
import { loadWeeklyFromSessions } from "@/components/service/weeklySessionSync";
```

### File 2: `src/components/service/weekly/useWeeklyServiceHandlers.jsx`

**Location**: Lines 127-157 (debouncedSave function)

**Change — Add entity sync after successful save**:

The current `saveServiceMutation.mutate(dataToSave, { onSettled })` needs an `onSuccess` callback to trigger sync.

However, looking at the architecture: `saveServiceMutation` is defined in WeeklyServiceManager.jsx (lines 168-186), not in this file. The handlers file only calls `saveServiceMutation.mutate()`.

**Option A (preferred)**: Add sync in WeeklyServiceManager.jsx's `saveServiceMutation.onSuccess`:
```javascript
// In WeeklyServiceManager.jsx, line 176-182:
onSuccess: (result) => {
  queryClient.invalidateQueries(['weeklyService', selectedDate]);
  setLastSaveTimestamp(new Date().toISOString());
  setHasUnsavedChanges(false);
  // ... existing backup logic ...

  // NEW: Sync to Session/Segment entities (fire-and-forget)
  const currentData = serviceDataRef.current || serviceData;
  syncWeeklyToSessions(base44, result, currentData).catch(err => {
    console.error("[WEEKLY_SYNC] Entity sync failed (non-blocking):", err);
  });
},
```

**BUT**: `serviceDataRef` is in useWeeklyServiceHandlers, not WeeklyServiceManager. So we need to pass it or use a different approach.

**Option B (cleaner)**: Wire sync into useWeeklyServiceHandlers.jsx's debouncedSave:

```javascript
// In useWeeklyServiceHandlers.jsx, replace the saveServiceMutation.mutate call:
saveServiceMutation.mutate(dataToSave, {
  onSettled: () => {
    setSavingField(null);
  },
  // NEW: Sync entities on successful save
  onSuccess: (result) => {
    syncWeeklyToSessions(base44, result, serviceDataRef.current).catch(err => {
      console.error("[WEEKLY_SYNC] Entity sync failed:", err);
    });
  },
});
```

**IMPORTANT**: There are MULTIPLE places `saveServiceMutation.mutate()` is called in this file (lines 151, 340, 382, 409, 439). ALL of them need the `onSuccess` sync callback. Search for every `saveServiceMutation.mutate(` and add the sync.

**Locations of all saveServiceMutation.mutate calls**:
1. Line 151 — debouncedSave (main save path)
2. Line 340 — executeResetToBlueprint
3. Line 382 — handleClearServiceData
4. Line 409 — another save path
5. Line 439 — another save path

**Import to add**:
```javascript
import { syncWeeklyToSessions } from "@/components/service/weeklySessionSync";
```

### File 3: `functions/refreshActiveProgram.ts`

**Location**: Lines 369-498 (service snapshot builder, inside `buildProgramSnapshot`)

**Current behavior**: Lines 378-393 already fetch Sessions + Segments when they exist. Lines 394-454 fall back to JSON processing with calculated times, break injection, and pre_service_notes.

**The problem**: The entity path (lines 378-393) doesn't do the enrichment that the JSON path does:
- No break segment injection between services
- No pre_service_notes injection
- No team field propagation
- No session_id tagging (the JSON path tags with `slot-9-30` / `slot-11-30`)

**Changes needed**:

After line 393 (`segments = allSegs.filter(...)`), add enrichment:

```typescript
if (directSessions.length > 0) {
  sessions = directSessions.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Bulk fetch segments for all sessions
  const allSegs = [];
  for (const s of sessions) {
    const segs = await withRetry(() =>
      base44.asServiceRole.entities.Segment.filter({ session_id: s.id })
    );
    allSegs.push(...segs);
  }
  segments = allSegs
    .filter(s => s.show_in_general !== false)
    .sort((a, b) => {
      const aSession = sessions.findIndex(s => s.id === a.session_id);
      const bSession = sessions.findIndex(s => s.id === b.session_id);
      if (aSession !== bSession) return aSession - bSession;
      return (a.order || 0) - (b.order || 0);
    });

  // NEW: Inject break segment between sessions (matching JSON path logic)
  if (sessions.length >= 2) {
    const firstSessionSegs = segments.filter(s => s.session_id === sessions[0].id);
    const secondSessionSegs = segments.filter(s => s.session_id === sessions[1].id);
    if (firstSessionSegs.length > 0 && secondSessionSegs.length > 0) {
      const lastSeg = firstSessionSegs[firstSessionSegs.length - 1];
      const firstNextSeg = secondSessionSegs[0];
      if (lastSeg.end_time && firstNextSeg.start_time && lastSeg.end_time < firstNextSeg.start_time) {
        // Same break injection logic as JSON path (lines 425-451)
        const [endH, endM] = lastSeg.end_time.split(':').map(Number);
        const [startH, startM] = firstNextSeg.start_time.split(':').map(Number);
        const diffMin = (startH * 60 + startM) - (endH * 60 + endM);
        if (diffMin > 0) {
          const notes = targetProgram.receso_notes?.["11:00am"] || targetProgram.receso_notes?.["11:00"] || "";
          const breakSegment = {
            id: 'generated-break-inter-service',
            start_time: lastSeg.end_time,
            end_time: firstNextSeg.start_time,
            duration_min: diffMin,
            title: 'Receso',
            segment_type: 'Receso',
            session_id: 'slot-break',
            description: notes,
            actions: [
              { id: 'break-reset', label: 'STAGE RESET', department: 'Stage & Decor', timing: 'after_start', offset_min: 0, order: 1 },
              { id: 'break-sound', label: 'AUDIO CHECK', department: 'Sound', timing: 'after_start', offset_min: 10, order: 2 },
            ],
          };
          // Insert break between the two session's segments
          const insertIdx = segments.findIndex(s => s.session_id === sessions[1].id);
          segments.splice(insertIdx, 0, breakSegment);
        }
      }
    }
  }

  // NEW: Inject pre_service_notes from Session entities (or Service fallback)
  for (const session of sessions) {
    const preNotes = session.pre_service_notes || targetProgram.pre_service_notes?.[session.name] || "";
    if (!preNotes) continue;
    const sessionSegs = segments.filter(s => s.session_id === session.id);
    if (sessionSegs.length === 0) continue;
    sessionSegs.sort((a, b) => {
      const [ah, am] = (a.start_time || "00:00").split(':').map(Number);
      const [bh, bm] = (b.start_time || "00:00").split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    });
    const firstSeg = sessionSegs[0];
    if (!firstSeg.actions) firstSeg.actions = [];
    const actionId = `pre-note-${session.name}-${targetProgram.id}`;
    if (!firstSeg.actions.find(a => a.id === actionId)) {
      firstSeg.actions.push({
        id: actionId, label: 'GENERAL NOTES', department: 'Coordinador',
        timing: 'before_start', offset_min: 30, notes: preNotes, order: -99,
      });
    }
  }
}
```

**Also**: Remove the `slot-9-30`/`slot-11-30` synthetic session_id pattern from the JSON fallback — the entity path uses real session IDs. Display surfaces that match on `slot-9-30` need to match on actual session_id instead. (See normalizeProgram.jsx changes.)

### File 4: `functions/getPublicProgramData.ts`

**Location**: Lines 395-690 (service data processing)

**Current behavior**: Lines 404-407 already check for `directSessions` linked to service. Lines 427-463 fall back to JSON `"9:30am"`/`"11:30am"` processing.

**Changes needed**: Same enrichment as refreshActiveProgram — add break injection and pre_service_notes injection to the entity path. The logic is identical.

**Pattern**: Copy the enrichment block from refreshActiveProgram.ts into getPublicProgramData.ts's entity path (after `directSessions` fetch).

### File 5: `functions/submitWeeklyServiceContent.ts`

**Location**: Lines 190-333 (composite ID parsing and Service JSON update)

**Current flow**:
1. Parse composite ID: `weekly_service|serviceId|timeSlot|segmentIdx|message`
2. Fetch Service entity
3. Read `service[timeSlot][segmentIdx]`
4. Update the segment in the JSON array
5. Write back: `Service.update(serviceId, { [timeSlot]: currentArray })`

**New flow (dual-write)**:
1. Parse composite ID (KEEP same format for backward compat)
2. Fetch Service entity
3. **NEW**: Find Session by service_id + name matching timeSlot
4. **NEW**: Find Segment by session_id + order matching segmentIdx + 1 (0-indexed → 1-indexed)
5. **NEW**: Update Segment entity directly: `Segment.update(segmentId, { submitted_content, parsed_verse_data, ... })`
6. **KEEP**: Also update Service JSON (dual-write for transition safety)
7. For "apply_to_both": find other Session, find matching Plenaria Segment, update both

```typescript
// NEW: After line 203 (service fetch), add entity resolution:
const sessions = await base44.asServiceRole.entities.Session.filter({
  service_id: serviceId
});
const targetSession = sessions.find(s => s.name === timeSlot);
let targetSegmentEntity = null;

if (targetSession) {
  const sessionSegments = await base44.asServiceRole.entities.Segment.filter(
    { session_id: targetSession.id }, 'order'
  );
  targetSegmentEntity = sessionSegments[segmentIdx]; // 0-indexed position matches order-1
}

// Line ~277: After building updatedSegment, also update entity:
if (targetSegmentEntity) {
  await base44.asServiceRole.entities.Segment.update(targetSegmentEntity.id, {
    submitted_content: content,
    parsed_verse_data: parsedData,
    submission_status: 'processed',
    scripture_references: scriptureReferences,
    presentation_url: presentation_url || "",
    notes_url: notes_url || "",
    content_is_slides_only: !!content_is_slides_only,
    projection_notes: projectionNotes,
    message_title: (title && title.trim() !== "") ? title.trim() : targetSegmentEntity.message_title,
  });
}

// Line ~284: For apply_to_both, also update other session's entity:
if (apply_to_both_services && timeSlot === '9:30am' && sessions.length > 1) {
  const otherSession = sessions.find(s => s.name === '11:30am');
  if (otherSession) {
    const otherSegments = await base44.asServiceRole.entities.Segment.filter(
      { session_id: otherSession.id }, 'order'
    );
    const otherTarget = otherSegments.find(seg => {
      const t = (seg.segment_type || '').toLowerCase();
      return ['plenaria', 'message', 'predica', 'mensaje'].includes(t);
    });
    if (otherTarget) {
      await base44.asServiceRole.entities.Segment.update(otherTarget.id, {
        submitted_content: content,
        parsed_verse_data: parsedData,
        submission_status: 'processed',
        scripture_references: scriptureReferences,
        presentation_url: presentation_url || "",
        notes_url: notes_url || "",
        content_is_slides_only: !!content_is_slides_only,
        message_title: (title && title.trim() !== "") ? title.trim() : otherTarget.message_title,
      });
    }
  }
}
```

**KEEP the existing Service JSON update (lines 221-333) for dual-write**. Remove later.

### File 6: `functions/serveWeeklyServiceSubmission.ts`

**Location**: Lines 34-76 (service data fetching and option building)

**Current flow**:
1. Fetch Service for upcoming Sunday
2. Read `service["9:30am"]` and `service["11:30am"]`
3. Find message-type segments
4. Build composite ID: `weekly_service|serviceId|slot|idx|message`

**New flow**:
```typescript
// Replace lines 41-71 with:
if (validServices.length > 0) {
  const service = validServices[0];

  // NEW: Try entity-first approach
  const sessions = await base44.asServiceRole.entities.Session.filter({
    service_id: service.id
  });

  if (sessions.length > 0) {
    // Entity path: read from Session + Segment entities
    for (const session of sessions.sort((a, b) => (a.order || 0) - (b.order || 0))) {
      const segments = await base44.asServiceRole.entities.Segment.filter(
        { session_id: session.id }, 'order'
      );
      segments.forEach((seg, idx) => {
        const type = (seg.segment_type || "").toLowerCase();
        if (['plenaria', 'message', 'predica', 'mensaje'].includes(type)) {
          // KEEP SAME composite ID format for backward compat
          const compositeId = `weekly_service|${service.id}|${session.name}|${idx}|message`;
          const presenter = seg.presenter || "Sin asignar";
          options.push({
            id: compositeId,
            label: `${session.name} - ${presenter}`,
            group: formattedDate,
            title: seg.message_title || "",
          });
        }
      });
    }
  } else {
    // Fallback: JSON path (pre-migration services)
    const processTimeSlot = (slot) => { /* existing logic */ };
    processTimeSlot("9:30am");
    processTimeSlot("11:30am");
  }
}
```

### File 7: `functions/processNewSubmissionVersion.ts`

**Location**: Composite ID parsing section

**Change**: Add entity-aware resolution alongside existing JSON resolution.

```typescript
// After parsing composite ID parts:
const [_, serviceId, timeSlot, segmentIdxStr, type] = parts;

// NEW: Try entity resolution first
const sessions = await base44.asServiceRole.entities.Session.filter({
  service_id: serviceId
});
const targetSession = sessions.find(s => s.name === timeSlot);
if (targetSession) {
  const segments = await base44.asServiceRole.entities.Segment.filter(
    { session_id: targetSession.id }, 'order'
  );
  const targetSeg = segments[parseInt(segmentIdxStr)];
  if (targetSeg) {
    // Update entity with parsed verse data
    await base44.asServiceRole.entities.Segment.update(targetSeg.id, {
      parsed_verse_data: parsedData,
      scripture_references: scriptureReferences,
    });
  }
}

// KEEP existing Service JSON update for dual-write
```

---

## 5. FILES TO MODIFY — ENRICHMENT

These files need updates to work correctly with entity-sourced data but are lower priority.

### File 8: `src/components/utils/normalizeProgram.jsx`

**Current behavior**: Detects weekly services by checking for `program["9:30am"]` or `slot-9-30` session IDs.

**Change**: Add detection for entity-sourced weekly services. When sessions come from entities, session_id is a real ID (not `slot-9-30`). The normalization should check:
```javascript
// Current detection:
if (program["9:30am"] || sessionId === "slot-9-30") { ... }

// Updated detection:
if (program["9:30am"] || sessionId === "slot-9-30" || session?.name === "9:30am") { ... }
```

The key is: segments from the entity path have real session IDs. The normalizer needs to look up the Session entity to determine if it's a "9:30am" or "11:30am" session. The sessions are included in the cache snapshot, so this lookup is local.

### File 9: `src/components/myprogram/normalizeSession.jsx`

**Current behavior**: `normalizeServiceSegments()` and `processSlot()` process `"9:30am"` and `"11:30am"` keys.

**Change**: When the program snapshot comes from entities (sessions array exists), use sessions instead of slot keys:
```javascript
// Add at the top of normalizeServiceSegments:
if (serviceData.sessions && serviceData.sessions.length > 0) {
  // Entity path: sessions are real Session entities
  return serviceData.sessions.flatMap(session => {
    const sessionSegments = serviceData.segments
      .filter(seg => seg.session_id === session.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    return sessionSegments.map(seg => ({
      // ... same normalization as existing processSlot logic
      session_label: session.name, // "9:30am" or "11:30am"
    }));
  });
}
// Fallback: existing processSlot("9:30am") / processSlot("11:30am") logic
```

### File 10: `src/components/utils/segmentNormalization.jsx`

**Current behavior**: Generates stable IDs using `timeSlot` tag for segment identification.

**Change**: When segments have real entity IDs, use those instead of generated IDs:
```javascript
// In the ID generation logic:
if (segment.id && !segment.id.startsWith('generated-')) {
  return segment.id; // Real entity ID — already stable
}
// Fallback: existing generated ID logic
```

### File 11: `src/components/utils/liveAdjustmentHelpers.jsx`

**Current behavior**: Matches adjustments by `adj.time_slot === timeSlot`.

**Change**: Also match by `adj.session_id === segment.session_id` when available:
```javascript
// Updated matching:
const matchesSlot = adj.time_slot
  ? adj.time_slot === timeSlot
  : adj.session_id === segment.session_id;
```

### File 12: `src/pages/MessageProcessing.jsx`

**Current behavior**: Iterates both Service JSON slots to find message segments.

**Change**: Add entity-first path:
```javascript
// When loading message segments for display:
const sessions = await base44.entities.Session.filter({ service_id: serviceId });
if (sessions.length > 0) {
  for (const session of sessions) {
    const segments = await base44.entities.Segment.filter({ session_id: session.id });
    const messageSegs = segments.filter(s =>
      ['Plenaria', 'Message'].includes(s.segment_type)
    );
    // Display messageSegs with session.name as the time slot label
  }
} else {
  // Fallback: existing JSON iteration
}
```

---

## 6. FILES THAT NEED NO CHANGES

### Confirmed: receive pre-formatted props from WeeklyServiceManager
These components receive `serviceData` or slot segments as props. Since `loadWeeklyFromSessions` returns the identical JSON shape, no changes needed.

| File | Why no change |
|------|--------------|
| `ServiceTimeSlotColumn.jsx` | Receives `segments` array and `timeSlot` as props |
| `WeeklyServicePrintView.jsx` | Receives `serviceData` as prop |
| `WeeklyServiceReport.jsx` | Receives `serviceData` as prop |
| `WeeklyServiceDialogs.jsx` | Receives handlers and state as props |
| `WeeklyServiceInputs.jsx` | Reads from ServiceDataContext (set by parent) |
| `SpecialSegmentDialog.jsx` | Receives `timeSlot` and handlers as props |
| `WeeklyServicePrintCSS.jsx` | CSS only |
| `WeeklyAnnouncementSection.jsx` | Deals with announcements, not segments |
| `PrintSettingsModal.jsx` | Print scale preview, receives props |
| `TimeAdjustmentHistoryModal.jsx` | Reads from LiveTimeAdjustment entity |

### Confirmed: read from ActiveProgramCache (built by refreshActiveProgram)
These surfaces consume the cache snapshot. Once refreshActiveProgram enriches the entity path, they work automatically.

| File | Why no change |
|------|--------------|
| `ServiceProgramView.jsx` | Reads from cache snapshot |
| `PublicProgramView.jsx` | Reads from getPublicProgramData / cache |
| `MyProgram.jsx` | Uses normalizeSession.jsx (changed in enrichment) |
| `MyProgramTimeline.jsx` | Reads normalized data |

### Confirmed: operate on Service-level or unrelated data
| File | Why no change |
|------|--------------|
| `weeklyBlueprint.jsx` | Static template constant, stays as JSON |
| `ServiceTemplatesTab.jsx` | Template editor works with blueprint JSON |
| `generateWeeklyProgramPDF.jsx` | Receives `serviceData` as parameter |
| `generateAnnouncementsPDF.jsx` | Receives formatted data |
| `generateProgramPDF.jsx` | Custom services only |
| `serviceTimeMath.jsx` | Pure time calculation utilities |
| `liveViewCapabilities.jsx` | Static config object |
| `useOverflowDetection.jsx` | DOM measurement, not data-dependent |
| `sessionSync.jsx` | Custom service sync — unchanged |
| `useStaleGuard.jsx` | Uses `updated_date` which still exists |

### Lower priority: diagnostics and admin tools
| File | Note |
|------|------|
| `auditServiceActions.ts` | Can be updated later — reads JSON today |
| `diagnoseWeeklyServiceActions.ts` | Diagnostic tool — update when convenient |
| `processPendingSubmissions.ts` | Safety net — update to also check entities |
| `segmentNormalization.test.jsx` | Update test data after implementation |
| `pdfScalingTest.jsx` | Test fixture — update when convenient |
| `ENTITY_REFERENCE.md.jsx` | Documentation — update after implementation |
| `README_ARCHITECTURE.md.jsx` | Documentation — update after implementation |
| `PDF_SYNC_PROTOCOL.md.jsx` | Documentation — update after implementation |

---

## 7. MIGRATION SCRIPT

### One-time migration function: `migrateWeeklyServicesToEntities`

Create as a cloud function or run from admin dashboard.

```
ALGORITHM:
  1. allServices = Service.list()
  2. weeklyServices = allServices.filter(s =>
       (s["9:30am"]?.length > 0 || s["11:30am"]?.length > 0) &&
       s.status === 'active'
     )
  3. For each weeklyService:
     a. Check if Sessions already exist:
        existingSessions = Session.filter({ service_id: weeklyService.id })
     b. If existingSessions.length > 0: SKIP (already migrated)
     c. Call syncWeeklyToSessions(base44, weeklyService, weeklyService)
     d. Log: "Migrated service ${weeklyService.id} (${weeklyService.date})"
  4. Report: { total, migrated, skipped, failed }

EXECUTION:
  - Run during maintenance window (no active users)
  - Takes ~2-5 seconds per service (API rate limits)
  - For 52 weeks of history: ~52 services × 3 seconds = ~3 minutes
  - Run with service role permissions (no user auth needed)

VERIFICATION:
  - After migration, for each service:
    sessions = Session.filter({ service_id })
    assert sessions.length === 2 (one per slot)
    for each session:
      segments = Segment.filter({ session_id })
      assert segments.length === service[session.name].length
      for each segment:
        assert segment.title === service[session.name][idx].title
        assert segment.segment_type === service[session.name][idx].type
```

---

## 8. EXECUTION ORDER & DEPENDENCY GRAPH

```
PHASE 1: FOUNDATION (sequential — must go first)
  ┌──────────────────────────────────────────────────┐
  │ 1. Create weeklySessionSync.jsx                   │
  │ 2. Wire into WeeklyServiceManager.jsx (load path) │
  │ 3. Wire into useWeeklyServiceHandlers.jsx (save)  │
  │ 4. Wire into WeeklyServiceManager.jsx (onSuccess) │
  └──────────────────────────────────────────────────┘
            │
            ▼
PHASE 2: PARALLEL WORK (all independent)
  ┌─────────────────────┐  ┌───────────────────────────┐  ┌──────────────────────┐
  │ BATCH A: Backend     │  │ BATCH B: Speaker Pipeline │  │ BATCH C: Enrichment   │
  │                      │  │                           │  │                       │
  │ 5. refreshActive-   │  │ 7. serveWeeklyService-   │  │ 9. normalizeProgram  │
  │    Program.ts        │  │    Submission.ts          │  │ 10. normalizeSession │
  │ 6. getPublicProgram-│  │ 8. submitWeeklyService-  │  │ 11. segmentNormal-   │
  │    Data.ts           │  │    Content.ts             │  │     ization           │
  │                      │  │ 8b. processNewSubmission-│  │ 12. liveAdjustment-  │
  │                      │  │     Version.ts            │  │     Helpers            │
  │                      │  │                           │  │ 13. MessageProcessing│
  └─────────────────────┘  └───────────────────────────┘  └──────────────────────┘
            │                          │                             │
            ▼                          ▼                             ▼
PHASE 3: MIGRATION (after all code deployed)
  ┌──────────────────────────────────────────────────┐
  │ 14. Run migration script on all existing services │
  │ 15. Verify entity counts match JSON counts        │
  └──────────────────────────────────────────────────┘
            │
            ▼
PHASE 4: VERIFICATION
  ┌──────────────────────────────────────────────────┐
  │ 16. Run verification protocol (Section 9)         │
  │ 17. Spot-check all display surfaces               │
  └──────────────────────────────────────────────────┘
```

### Dependency rules:
- Phase 1 MUST complete before anything else
- Phase 2 batches A, B, C can run in parallel (different developers)
- Phase 3 runs after all Phase 2 code is deployed
- Phase 4 is final validation

### What blocks what:
- `weeklySessionSync.jsx` blocks everything (it's the core)
- `WeeklyServiceManager.jsx` load change blocks nothing else
- Backend function changes are independent of each other
- Enrichment changes are independent of backend changes
- Migration script depends on `syncWeeklyToSessions()` being complete

---

## 9. VERIFICATION PROTOCOL

### V1: Entity creation verification
```
1. Open WeeklyServiceManager for next Sunday
2. Make any edit (change a presenter name)
3. Wait for auto-save (800ms debounce)
4. Check database:
   - Session.filter({ service_id: <id> }) → should return 2 sessions
   - Segment.filter({ session_id: <session1.id> }) → should match "9:30am" count
   - Segment.filter({ session_id: <session2.id> }) → should match "11:30am" count
```

### V2: Load path verification
```
1. Reload WeeklyServiceManager
2. Verify all segments display correctly (titles, durations, presenters)
3. Verify team fields populate (coordinators, sound, etc.)
4. Verify special segments (Alabanza with sub_asignaciones) display correctly
5. Verify submitted content (verses, presentation URLs) appear
```

### V3: Display surface verification
```
1. Open ServiceProgramView → verify segments render with correct times
2. Open PublicProgramView → verify public program shows all segments
3. Open MyProgram → verify both time slots show as session pills
4. Open Reports → verify department notes appear
5. Generate PDF → verify it matches previous output
6. Check TV display → verify countdown/timeline correct
```

### V4: Speaker submission verification
```
1. Open speaker submission form (serveWeeklyServiceSubmission URL)
2. Verify message segments appear with correct presenter names
3. Submit test content
4. Verify content appears on:
   a. Segment entity (submitted_content field)
   b. Service JSON (dual-write backward compat)
   c. WeeklyServiceManager UI (reload and check)
5. Test "apply to both services" checkbox
```

### V5: Live Director verification
```
1. Open LiveDirectorPanel for a weekly service session
2. Verify segments appear with planned times
3. Toggle live mode → verify ownership claim
4. Mark a segment ended → verify cascade to next segment
5. Verify adjustments persist after page reload
```

### V6: Migration verification
```
1. Pick 3 existing services with different dates
2. For each: compare Session/Segment entity data against Service JSON
3. Verify:
   - Session.name matches slot key
   - Session.coordinators matches service.coordinators[slot]
   - Segment count matches service[slot].length
   - Segment.title matches service[slot][idx].title
   - Segment.presenter matches service[slot][idx].data.presenter
   - Segment.scripture_references matches service[slot][idx].scripture_references
```

---

## 10. ROLLBACK PLAN

### If issues found after deployment:

**Level 1: Disable entity reads (instant)**
In `WeeklyServiceManager.jsx`, change the entity query to always return null:
```javascript
const { data: sessionEntities } = useQuery({
  queryKey: ['weeklyServiceSessions', existingData?.id],
  queryFn: async () => null, // ROLLBACK: disabled entity loading
  enabled: false,
});
```

This immediately falls back to JSON reads everywhere. Entity writes continue (harmless).

**Level 2: Disable entity writes (instant)**
Comment out all `syncWeeklyToSessions()` calls in `useWeeklyServiceHandlers.jsx`.

**Level 3: Full rollback (5 minutes)**
Revert the branch. Service JSON is still intact (dual-write means we never deleted it). All surfaces revert to JSON reads.

### Data safety guarantee:
- Service JSON is NEVER deleted or modified by the entity sync
- Entities are additive-only (created/updated alongside JSON)
- Worst case: orphaned Session/Segment entities (harmless, can be cleaned up)

---

## 11. FIELD MAPPING REFERENCE

### Weekly JSON Segment → Segment Entity (for syncWeeklyToSessions)

| Weekly JSON field | Segment entity field | Notes |
|-------------------|---------------------|-------|
| `title` | `title` | Direct |
| `type` | `segment_type` | Direct (values match: "Bienvenida", "Alabanza", etc.) |
| `duration` | `duration_min` | Direct |
| *calculated* | `start_time` | Cumulative from session start |
| *calculated* | `end_time` | start_time + duration |
| *calculated* | `order` | 1-indexed position in array |
| `data.presenter` | `presenter` | `getSegmentData(seg, 'presenter')` |
| `data.leader` | `presenter` | For Alabanza type (worship leader) |
| `data.preacher` | `presenter` | For Plenaria type |
| `data.translator` | `translator_name` | |
| `data.songs[]` | `song_1_title`, `song_1_lead`, `song_1_key` (x6) | Flatten array to individual fields |
| `data.message_title` or `message_title` | `message_title` | Check both root and data |
| `data.verse` or `scripture_references` | `scripture_references` | Check both |
| `data.parsed_verse_data` or `parsed_verse_data` | `parsed_verse_data` | Check both |
| `data.submitted_content` or `submitted_content` | `submitted_content` | Check both |
| `data.description_details` | `description_details` | |
| `data.presentation_url` or `presentation_url` | `presentation_url` | Check both |
| `notes_url` | `notes_url` | |
| `content_is_slides_only` | `content_is_slides_only` | |
| `data.coordinator_notes` | `coordinator_notes` | |
| `data.projection_notes` or `projection_notes` | `projection_notes` | Check both |
| `data.sound_notes` | `sound_notes` | |
| `data.ushers_notes` | `ushers_notes` | |
| `data.translation_notes` | `translation_notes` | |
| `data.stage_decor_notes` | `stage_decor_notes` | |
| `data.actions` or `actions` | `segment_actions` | Check both; actions array of {label, department, timing, offset_min, is_prep, notes, is_required} |
| `requires_translation` | `requires_translation` | Boolean |
| `submission_status` | `submission_status` | "processed" or null |
| — | `show_in_general` | Always `true` |
| — | `session_id` | FK to parent Session |
| — | `service_id` | FK to parent Service |

### Weekly JSON Segment `sub_asignaciones` → Child Segment Entities

| Sub-assignment field | Child Segment entity field | Notes |
|---------------------|---------------------------|-------|
| `title` or `label` | `title` | |
| `person_field_name` → resolved value | `presenter` | Need to resolve from segment data |
| `duration_min` | `duration_min` | |
| — | `segment_type` | Always `"Ministración"` |
| — | `parent_segment_id` | FK to parent Alabanza Segment |

### Service team fields → Session entity

| Service JSON field | Session entity field |
|-------------------|---------------------|
| `coordinators["9:30am"]` | `Session(name="9:30am").coordinators` |
| `ujieres["9:30am"]` | `Session(name="9:30am").ushers_team` |
| `sound["9:30am"]` | `Session(name="9:30am").sound_team` |
| `luces["9:30am"]` | `Session(name="9:30am").tech_team` |
| `fotografia["9:30am"]` | `Session(name="9:30am").photography_team` |
| `pre_service_notes["9:30am"]` | `Session(name="9:30am").pre_service_notes` * |

\* `pre_service_notes` is not a standard Session field. Options:
1. Store on Session entity as custom field (if platform allows arbitrary fields)
2. Store via `PreSessionDetails` entity with `general_notes` field
3. Keep on Service entity and read from there (simplest, least change)

**Recommendation**: Option 3 for now — keep `pre_service_notes` on Service entity. The backend enrichment code already reads it from `targetProgram.pre_service_notes`. Move to PreSessionDetails in a follow-up.

---

## SUMMARY: SCOPE OF WORK

| Category | Files | Effort |
|----------|-------|--------|
| New files | 1 (`weeklySessionSync.jsx`) | Medium — ~200 lines, core sync logic |
| Core modifications | 7 files | Medium — focused changes, clear patterns |
| Enrichment modifications | 5 files | Light — add entity detection alongside existing logic |
| Migration script | 1 function | Light — iterate services, call sync |
| No changes needed | 22+ files | — |
| Deferred (diagnostics, docs) | 8 files | Low priority — update when convenient |

**Total files to touch**: 13 (1 new + 7 core + 5 enrichment)
**Total files unaffected**: 22+
**Risk level**: Low (dual-write, instant rollback, zero UX change)
