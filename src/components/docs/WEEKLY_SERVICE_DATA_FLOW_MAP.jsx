/* eslint-disable */
// # Weekly Service Data Flow Map
**Critical Diagnostic**: Save loop between "another admin editing" ↔ "saving"  
**Date**: 2026-02-23  
**Status**: PRODUCTION INCIDENT

---

## 🔴 CRITICAL BUG IDENTIFIED: Save Loop Race Condition

**Symptom**: Editor bounces between "Otro administrador actualizó" and "Guardando" with no actual edits.

**Root Cause**: Multi-admin subscription window (6s) overlaps with own-save guard window (5.5s) + 5s debounced save timer.

### Timeline of Save Loop:
```
T+0.0s: User types → serviceData changes
T+5.0s: Debounced save fires → ownSaveInProgressRef = true
T+5.1s: syncWeeklyToSessions starts (entities update)
T+5.5s: Entity updates emit subscription events
T+6.0s: ownSaveInProgressRef = false (guard window expires)
T+6.5s: Subscription debounce fires → sees own save as "external"
        → setExternalChangeAvailable(true) OR auto-reload
T+6.6s: If hasUnsavedChanges=false, auto-reload fires
        → queryClient.invalidateQueries → re-fetch data
        → setServiceData with fresh entity data
        → triggers 5s save timer again
        → LOOP REPEATS
```

**Code Location**: `pages/WeeklyServiceManager.jsx` lines 562-598

```javascript
// BUG: Guard window too short
ownSaveInProgressRef.current = true;
// ... save happens ...
setTimeout(() => { ownSaveInProgressRef.current = false; }, 5500); // ❌ TOO SHORT

// Subscription debounce is 6000ms
externalDebounce.timer = setTimeout(() => {
  if (ownSaveInProgressRef.current) return; // ❌ Already false by now!
  
  if (!hasUnsavedChangesRef.current) {
    // ❌ This auto-reload triggers another save
    localStateInitializedRef.current = false;
    queryClient.invalidateQueries({ queryKey: ['weeklyService', selectedDate] });
    toast.info('Programa actualizado por otro administrador');
  } else {
    setExternalChangeAvailable(true);
  }
}, 6000);
```

---

## 📊 Complete Data Flow Pipeline

### LAYER 1: Editor → Entity Storage

```
┌─────────────────────────────────────────────────────────────┐
│ WeeklyServiceManager.jsx (Editor)                           │
│ Lines: 1-700+                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ State: serviceData = {                                      │
│   "9:30am": [segments...],    ← In-memory UI state         │
│   "11:30am": [segments...],                                 │
│   coordinators: { "9:30am": "Juan", "11:30am": "Maria" },  │
│   pre_service_notes: { "9:30am": "...", ... },             │
│   selected_announcements: ["id1", "id2"],                   │
│   receso_notes: { "9:30am": "Coffee break notes" }         │
│ }                                                           │
│                                                             │
│ Input Change:                                               │
│   updateSegmentField(slot, idx, field, value)               │
│   → setServiceData(prev => ... mutate field ...)           │
│   → 5s debounced timer starts                               │
│                                                             │
│ Timer Expires (T+5s):                                       │
│   saveServiceMutation.mutate({                              │
│     ...serviceData,                                         │
│     selected_announcements,                                 │
│     print_settings_page1,                                   │
│     print_settings_page2,                                   │
│     day_of_week: "Sunday",                                  │
│     name: "Domingo - 2026-02-23",                          │
│     status: "active",                                       │
│     service_type: "weekly"                                  │
│   })                                                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ extractServiceMetadata() - Line ~420                        │
│ Strips entity-managed fields from Service payload           │
├─────────────────────────────────────────────────────────────┤
│ REMOVES:                                                    │
│   - coordinators           → goes to Session entities      │
│   - ujieres                → goes to Session entities      │
│   - sound/luces/fotografia → goes to Session entities      │
│   - pre_service_notes      → goes to PreSessionDetails     │
│   - "9:30am" / "11:30am"   → goes to Segment entities      │
│   - _fromEntities, _slotNames, _sessionIds (internal)      │
│                                                             │
│ KEEPS (Service entity metadata only):                       │
│   - date, status, service_type                              │
│   - selected_announcements                                  │
│   - receso_notes (break between slots, NOT pre-service)    │
│   - print_settings_page1/page2                              │
│   - day_of_week, name                                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ syncWeeklyToSessions() - weeklySessionSync.jsx             │
│ Lines: 165-299                                              │
├─────────────────────────────────────────────────────────────┤
│ FOR EACH TIME SLOT ("9:30am", "11:30am"):                  │
│                                                             │
│ 1. Find/Create Session:                                     │
│    Session.filter({ service_id, name: "9:30am" })          │
│    OR Session.create({                                      │
│      service_id, name, date, planned_start_time,           │
│      coordinators, ushers_team, sound_team,                │
│      tech_team, photography_team                            │
│    })                                                       │
│                                                             │
│ 2. Update PreSessionDetails:                                │
│    PreSessionDetails.create/update({                        │
│      session_id,                                            │
│      general_notes: pre_service_notes["9:30am"]            │
│    })                                                       │
│                                                             │
│ 3. Build Segment Entities:                                  │
│    FOR EACH segment in serviceData["9:30am"]:               │
│      Segment.create({                                       │
│        session_id,                                          │
│        order: i,                                            │
│        title: seg.title,                                    │
│        segment_type: normalizeType(seg.type),               │
│        start_time: "09:30",                                 │
│        end_time: "09:45",                                   │
│        duration_min: 15,                                    │
│        presenter: resolvePresenter(seg),                    │
│        translator_name: seg.data.translator,                │
│        scripture_references: seg.data.verse,                │
│        parsed_verse_data: seg.data.parsed_verse_data,       │
│        message_title: seg.data.title,                       │
│        song_1_title, song_1_lead, song_1_key,              │
│        song_2_title, ... (up to song_6_*)                   │
│        number_of_songs: 4,                                  │
│        segment_actions: seg.actions,                        │
│        ui_fields: seg.fields,                               │
│        ui_sub_assignments: seg.sub_assignments,             │
│        coordinator_notes, projection_notes,                 │
│        sound_notes, ushers_notes, ...                       │
│      })                                                     │
│                                                             │
│ 4. Child Segments (Ministración):                           │
│    If seg.type === "worship" && sub_assignments.length:    │
│      Segment.create({                                       │
│        parent_segment_id: alabanza_segment.id,              │
│        title: "Ministración de Sanidad",                    │
│        presenter: seg.data.ministry_leader,                 │
│        ...                                                  │
│      })                                                     │
│                                                             │
│ 5. Delete old segments (create-before-delete pattern)       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Database State After Save                                   │
├─────────────────────────────────────────────────────────────┤
│ Service {                                                   │
│   id: "abc123",                                             │
│   date: "2026-02-23",                                       │
│   status: "active",                                         │
│   service_type: "weekly",                                   │
│   selected_announcements: ["ann1", "ann2"],                 │
│   receso_notes: { "9:30am": "Coffee at 11:00" },           │
│   print_settings_page1: {...},                              │
│   // NO "9:30am" or "11:30am" arrays                       │
│ }                                                           │
│                                                             │
│ Session {                                                   │
│   id: "sess1",                                              │
│   service_id: "abc123",                                     │
│   name: "9:30am",                                           │
│   coordinators: "Juan Perez",                               │
│   ushers_team: "Maria Lopez, ...",                          │
│   sound_team: "Tech Team A",                                │
│   ...                                                       │
│ }                                                           │
│                                                             │
│ PreSessionDetails {                                         │
│   session_id: "sess1",                                      │
│   general_notes: "Doors open at 9:00am"                    │
│ }                                                           │
│                                                             │
│ Segment {                                                   │
│   id: "seg1",                                               │
│   session_id: "sess1",                                      │
│   order: 1,                                                 │
│   title: "Tiempo de Alabanza",                             │
│   segment_type: "Alabanza",                                 │
│   presenter: "Worship Leader Name",                         │
│   translator_name: "Translator Name",                       │
│   song_1_title: "Song Title",                               │
│   song_1_lead: "Lead Singer",                               │
│   song_1_key: "G",                                          │
│   number_of_songs: 4,                                       │
│   scripture_references: "",                                 │
│   parsed_verse_data: null,                                  │
│   segment_actions: [                                        │
│     {                                                       │
│       label: "Start countdown",                             │
│       timing: "before_start",                               │
│       offset_min: 5,                                        │
│       department: "Projection"                              │
│     }                                                       │
│   ],                                                        │
│   ui_fields: ["leader", "songs", "ministry_leader"],       │
│   ui_sub_assignments: [                                     │
│     {                                                       │
│       label: "Ministración de Sanidad",                     │
│       person_field_name: "ministry_leader",                 │
│       duration_min: 5                                       │
│     }                                                       │
│   ],                                                        │
│   coordinator_notes: "Prepare stage",                       │
│   projection_notes: "Load slides",                          │
│   ...                                                       │
│ }                                                           │
│                                                             │
│ Segment (child) {                                           │
│   id: "seg1-child",                                         │
│   parent_segment_id: "seg1",                                │
│   session_id: "sess1",                                      │
│   order: 1,                                                 │
│   title: "Ministración de Sanidad y Milagros",             │
│   segment_type: "Ministración",                             │
│   presenter: "Ministry Leader Name",                        │
│   duration_min: 5,                                          │
│   show_in_general: false  ← ❗ NOT shown in displays       │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘

```

---

### LAYER 2: Entities → Display Cache (Backend Functions)

```
┌─────────────────────────────────────────────────────────────┐
│ Entity Change Events (real-time)                            │
│ Triggered by: syncWeeklyToSessions entity creates/updates   │
├─────────────────────────────────────────────────────────────┤
│ Entity Automations:                                         │
│   - Service create/update → refreshActiveProgram            │
│   - Session create/update → refreshActiveProgram            │
│   - Segment create/update → (no direct automation)          │
│                                                             │
│ ❗ FAN-OUT STORM:                                           │
│   Each save creates 1 Service + 2 Sessions + ~20 Segments   │
│   = ~4 refreshActiveProgram calls per save                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ functions/refreshActiveProgram.js                           │
│ Lines: 1-450+                                               │
├─────────────────────────────────────────────────────────────┤
│ 1. Detect active program (ET timezone):                     │
│    today_ET = current date in America/New_York              │
│    activeService = Service.filter({ date: today_ET,         │
│                      status: "active" })                    │
│    OR activeEvent = Event with today in date range          │
│                                                             │
│ 2. Load program data:                                       │
│    IF weekly service:                                       │
│      sessions = Session.filter({ service_id })              │
│      FOR EACH session:                                      │
│        segments = Segment.filter({                          │
│          session_id,                                        │
│          parent_segment_id: null  ← ❗ Filters children     │
│        })                                                   │
│        .filter(s => s.show_in_general !== false)            │
│                                                             │
│      preSessionDetails = PreSessionDetails.filter({         │
│        session_id                                           │
│      })                                                     │
│                                                             │
│      Build program object:                                  │
│      {                                                      │
│        program_type: "service",                             │
│        program_id: service.id,                              │
│        program_name: "Domingo - 2026-02-23",               │
│        program_date: "2026-02-23",                          │
│        sessions: [                                          │
│          {                                                  │
│            id: session.id,                                  │
│            name: "9:30am",                                  │
│            segments: [                                      │
│              {                                              │
│                id: "seg1",                                  │
│                title: "Tiempo de Alabanza",                 │
│                segment_type: "Alabanza",                    │
│                start_time: "09:30",                         │
│                end_time: "09:45",                           │
│                duration_min: 15,                            │
│                presenter: "Worship Leader",                 │
│                translator_name: "Translator",               │
│                songs: [                                     │
│                  {title: "...", lead: "...", key: "..."}   │
│                ],                                           │
│                scripture_references: "",                    │
│                parsed_verse_data: null,                     │
│                actions: [                                   │
│                  {                                          │
│                    label: "Start countdown",                │
│                    timing: "before_start",                  │
│                    offset_min: 5,                           │
│                    department: "Projection",                │
│                    notes: ""                                │
│                  }                                          │
│                ],                                           │
│                coordinator_notes: "",                       │
│                projection_notes: "",                        │
│                ...                                          │
│              }                                              │
│            ],                                               │
│            coordinators: "Juan Perez",                      │
│            pre_service_notes: "Doors open at 9:00"         │
│          }                                                  │
│        ],                                                   │
│        receso_notes: { "9:30am": "Coffee break" }          │
│      }                                                      │
│                                                             │
│    LEGACY JSON FALLBACK:                                    │
│      IF sessions.length === 0:                              │
│        Read service["9:30am"], service["11:30am"] arrays    │
│        (for pre-entity-lift services)                       │
│                                                             │
│ 3. Write to ActiveProgramCache:                             │
│    ActiveProgramCache.update/create({                       │
│      cache_key: "current_display",                          │
│      program_type: "service",                               │
│      program_id: service.id,                                │
│      program_snapshot: { ...program },                      │
│      detected_date: today_ET,                               │
│      last_refresh_trigger: "service_change",                │
│      last_refresh_at: now                                   │
│    })                                                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ ActiveProgramCache Entity (cached display data)             │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   cache_key: "current_display",                             │
│   program_type: "service",                                  │
│   program_id: "abc123",                                     │
│   program_snapshot: {                                       │
│     // Full normalized program structure from above         │
│   },                                                        │
│   detected_date: "2026-02-23",                              │
│   last_refresh_trigger: "service_change",                   │
│   last_refresh_at: "2026-02-23T10:15:00Z"                  │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

### LAYER 3: Display Cache → Frontend Displays

#### Display A: TV / Countdown Display

```
┌─────────────────────────────────────────────────────────────┐
│ pages/PublicCountdownDisplay.jsx                            │
│ Lines: 1-400+                                               │
├─────────────────────────────────────────────────────────────┤
│ 1. Fetch cached data:                                       │
│    useActiveProgramCache() hook                             │
│    → reads ActiveProgramCache via queryKey                  │
│                                                             │
│ 2. Normalize program data:                                  │
│    import { normalizeProgramData }                          │
│      from "@/components/utils/normalizeProgram"             │
│                                                             │
│    normalizedProgram = normalizeProgramData(programData)    │
│                                                             │
│    ❗ THIS IS THE ONLY DISPLAY USING NORMALIZER             │
│                                                             │
│ 3. Extract display fields:                                  │
│    currentSegment = normalizedProgram.sessions[0]           │
│                       .segments[currentIndex]               │
│                                                             │
│    FIELDS USED:                                             │
│      - title                                                │
│      - segment_type                                         │
│      - presenter                                            │
│      - translator_name                                      │
│      - start_time                                           │
│      - end_time                                             │
│      - actions[] ← ❗ FOR COORDINATOR PANEL                 │
│                                                             │
│ 4. Coordinator Actions Display:                             │
│    <CoordinatorActionsDisplay                               │
│      segment={currentSegment}                               │
│      nextSegment={nextSegment}                              │
│    />                                                       │
│                                                             │
│    Component reads:                                         │
│      segment.actions = [                                    │
│        {                                                    │
│          label: "Start countdown",                          │
│          timing: "before_start",  ← ❗ TIMING ENUM          │
│          offset_min: 5,                                     │
│          absolute_time: null,                               │
│          department: "Projection",                          │
│          notes: ""                                          │
│        }                                                    │
│      ]                                                      │
│                                                             │
│    Calculates action time:                                  │
│      IF timing === "before_start":                          │
│        actionTime = segment.start_time - offset_min         │
│      IF timing === "after_start":                           │
│        actionTime = segment.start_time + offset_min         │
│      IF timing === "before_end":                            │
│        actionTime = segment.end_time - offset_min           │
│      IF timing === "absolute":                              │
│        actionTime = absolute_time                           │
│                                                             │
│ 5. Layout (Bento Grid):                                     │
│    grid-cols-1 lg:grid-cols-[1.2fr_1.8fr]                  │
│      xl:grid-cols-[1fr_1.5fr_1fr]                          │
│                                                             │
│    Left Column: CoordinatorActionsDisplay                   │
│    Center: Countdown / Current segment                      │
│    Right: Next segment preview                              │
│                                                             │
│ ❗ BUG: Coordinator panel overflow (actions off-screen)     │
│    Root cause: Recent font-size increase + action count     │
│    Fix needed: Add max-height + overflow-y-auto             │
└─────────────────────────────────────────────────────────────┘
```

#### Display B: Public Program View (Live View)

```
┌─────────────────────────────────────────────────────────────┐
│ pages/PublicProgramView.jsx                                 │
│ Lines: 1-600+                                               │
├─────────────────────────────────────────────────────────────┤
│ 1. Fetch program data:                                      │
│    OPTION 1 (preferred): ActiveProgramCache                 │
│      const { data } = useActiveProgramCache()               │
│                                                             │
│    OPTION 2 (explicit date): getPublicProgramData function  │
│      const { data } = useQuery({                            │
│        queryKey: ['publicProgramData-explicit', date],      │
│        queryFn: () => base44.functions.invoke(              │
│          'getPublicProgramData', { date }                   │
│        )                                                    │
│      })                                                     │
│                                                             │
│ 2. ❗ NO NORMALIZATION:                                     │
│    Uses raw data from cache/function                        │
│                                                             │
│ 3. Display fields:                                          │
│    FOR EACH session IN program.sessions:                    │
│      <PublicProgramSegment                                  │
│        segment={segment}                                    │
│        showDetails={department === segment.dept}            │
│      />                                                     │
│                                                             │
│    Fields read directly:                                    │
│      - segment.title                                        │
│      - segment.segment_type                                 │
│      - segment.presenter                                    │
│      - segment.translator_name                              │
│      - segment.start_time                                   │
│      - segment.duration_min                                 │
│      - segment.coordinator_notes                            │
│      - segment.projection_notes                             │
│      - segment.sound_notes                                  │
│      - segment.ushers_notes                                 │
│      - segment.actions[]  ← ❗ RAW FROM ENTITY              │
│                                                             │
│ 4. Coordinator Actions (if displayed):                      │
│    Uses same CoordinatorActionsDisplay component            │
│    BUT receives UNNORMALIZED actions from entity            │
│                                                             │
│    ❗ POTENTIAL BUG:                                        │
│      If segment.actions has legacy format (no timing enum), │
│      CoordinatorActionsDisplay may misinterpret times       │
└─────────────────────────────────────────────────────────────┘
```

#### Display C: PDF Generation

```
┌─────────────────────────────────────────────────────────────┐
│ components/service/generateWeeklyProgramPDF.js              │
│ Lines: 1-800+                                               │
├─────────────────────────────────────────────────────────────┤
│ 1. Input: serviceData (same as editor state)                │
│                                                             │
│ 2. ❗ NO NORMALIZATION:                                     │
│    Reads directly from serviceData object                   │
│                                                             │
│ 3. Field access:                                            │
│    FOR EACH slot IN ["9:30am", "11:30am"]:                 │
│      segments = serviceData[slot]                           │
│                                                             │
│      FOR EACH segment:                                      │
│        FIELDS:                                              │
│          - segment.title                                    │
│          - segment.type (weekly format, not normalized)     │
│          - segment.data.leader (worship)                    │
│          - segment.data.preacher (message)                  │
│          - segment.data.presenter (other)                   │
│          - segment.data.translator                          │
│          - segment.songs[] (array format)                   │
│          - segment.data.verse                               │
│          - segment.data.title (message title)               │
│          - segment.duration                                 │
│          - segment.actions[]                                │
│                                                             │
│ 4. Action time calculation:                                 │
│    Uses pdfUtils.js helpers                                 │
│                                                             │
│    ❗ DIFFERENT LOGIC than CoordinatorActionsDisplay:       │
│      calculateActionTime(action, segmentStart, segmentEnd)  │
│                                                             │
│      May interpret action.timing differently                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Field Mapping Reference

### Weekly Service Editor → Entities

| Editor State | Entity | Field Name |
|--------------|--------|------------|
| `serviceData["9:30am"][0].title` | Segment | `title` |
| `serviceData["9:30am"][0].type` | Segment | `segment_type` (normalized) |
| `serviceData["9:30am"][0].data.leader` | Segment | `presenter` (worship) |
| `serviceData["9:30am"][0].data.preacher` | Segment | `presenter` (message) |
| `serviceData["9:30am"][0].data.presenter` | Segment | `presenter` (other) |
| `serviceData["9:30am"][0].data.translator` | Segment | `translator_name` |
| `serviceData["9:30am"][0].songs[0].title` | Segment | `song_1_title` |
| `serviceData["9:30am"][0].songs[0].lead` | Segment | `song_1_lead` |
| `serviceData["9:30am"][0].songs[0].key` | Segment | `song_1_key` |
| `serviceData["9:30am"][0].data.verse` | Segment | `scripture_references` |
| `serviceData["9:30am"][0].data.parsed_verse_data` | Segment | `parsed_verse_data` |
| `serviceData["9:30am"][0].data.title` | Segment | `message_title` |
| `serviceData["9:30am"][0].duration` | Segment | `duration_min` |
| `serviceData["9:30am"][0].actions[]` | Segment | `segment_actions` |
| `serviceData["9:30am"][0].fields` | Segment | `ui_fields` |
| `serviceData["9:30am"][0].sub_assignments` | Segment | `ui_sub_assignments` |
| `serviceData.coordinators["9:30am"]` | Session | `coordinators` |
| `serviceData.ujieres["9:30am"]` | Session | `ushers_team` |
| `serviceData.sound["9:30am"]` | Session | `sound_team` |
| `serviceData.luces["9:30am"]` | Session | `tech_team` |
| `serviceData.fotografia["9:30am"]` | Session | `photography_team` |
| `serviceData.pre_service_notes["9:30am"]` | PreSessionDetails | `general_notes` |
| `serviceData.selected_announcements` | Service | `selected_announcements` |
| `serviceData.receso_notes["9:30am"]` | Service | `receso_notes` |

### Entities → Display (via normalizeProgram)

| Entity Field | Normalized Field | Notes |
|--------------|------------------|-------|
| `Segment.segment_type` | `segment.segment_type` | Already normalized |
| `Segment.presenter` | `segment.presenter` | Direct |
| `Segment.translator_name` | `segment.translator_name` | Direct |
| `Segment.song_1_title` | `segment.songs[0].title` | Flattened to array |
| `Segment.song_1_lead` | `segment.songs[0].lead` | Flattened to array |
| `Segment.song_1_key` | `segment.songs[0].key` | Flattened to array |
| `Segment.scripture_references` | `segment.scripture_references` | Direct |
| `Segment.parsed_verse_data` | `segment.parsed_verse_data` | Direct |
| `Segment.segment_actions[]` | `segment.actions[]` | ❗ Must have `timing` enum |
| `Segment.ui_fields` | `segment.fields` | (internal) |
| `Segment.ui_sub_assignments` | `segment.sub_assignments` | (internal) |
| `Session.coordinators` | `session.coordinators` | Direct |
| `PreSessionDetails.general_notes` | `session.pre_service_notes` | Renamed |

---

## 🐛 Known Data Flow Issues

### Issue 1: Save Loop (CRITICAL)
- **Location**: WeeklyServiceManager.jsx lines 562-598
- **Cause**: Own-save guard window (5.5s) shorter than subscription debounce (6s)
- **Fix**: Extend guard to 8s OR disable auto-reload on own saves

### Issue 2: Action Time Calculation Divergence
- **Affected**: CoordinatorActionsDisplay, PDF generation
- **Cause**: Different timing calculation logic in each consumer
- **Fix**: Centralize in normalizeProgram.js, ensure all consumers use it

### Issue 3: Normalization Not Universal
- **Affected**: PublicProgramView, PDF generation
- **Cause**: normalizeProgram.js only wired to PublicCountdownDisplay
- **Fix**: Wire to all display consumers

### Issue 4: TV Display Coordinator Panel Overflow
- **Location**: PublicCountdownDisplay.jsx bento grid
- **Cause**: Font size increase + no max-height on actions container
- **Fix**: Add `max-h-[600px] overflow-y-auto` to coordinator panel

---

## 🔧 Recommended Fixes (Priority Order)

### 1. Fix Save Loop (IMMEDIATE)
```javascript
// WeeklyServiceManager.jsx line ~475
setTimeout(() => { ownSaveInProgressRef.current = false; }, 8000); // Was 5500
```

### 2. Fix TV Display Overflow (HIGH)
```javascript
// PublicCountdownDisplay.jsx
<div className="max-h-[600px] overflow-y-auto">
  <CoordinatorActionsDisplay ... />
</div>
```

### 3. Centralize Action Time Calculation (HIGH)
- Move timing logic to normalizeProgram.js
- Export `calculateActionTime()` utility
- Use in all consumers

### 4. Wire Normalization to All Displays (MEDIUM)
- PublicProgramView: wrap data in `normalizeProgramData()`
- PDF: wrap data in `normalizeProgramData()`
- Ensure consistent field access

---

## 📋 Testing Checklist

- [ ] Save loop: Wait 30s after typing, verify no auto-reload
- [ ] TV display: Verify coordinator actions visible (no overflow)
- [ ] Live View: Verify action times match segment start/end
- [ ] PDF: Verify action times match other displays
- [ ] Multi-admin: Two browsers, verify external change banner works
- [ ] Legacy services: Verify JSON fallback still works

---

**Status**: INCIDENT ANALYSIS COMPLETE  
**Next Step**: Apply Fix #1 (save loop) immediately