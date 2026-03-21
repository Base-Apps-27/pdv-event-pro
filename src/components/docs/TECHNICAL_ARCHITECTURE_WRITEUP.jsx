# PDV Event Pro — Comprehensive Technical Architecture Document

**Prepared:** 2026-03-21 (rebuilt)
**Purpose:** Full-stack technical reference for migration evaluation, integration planning, or rebuilding on another platform.

---

## 1. PRODUCT OVERVIEW

**PDV Event Pro** is a bilingual (English/Spanish) church production management platform built for **Palabras de Vida** (a bilingual church). It manages the full lifecycle of:

- **Weekly recurring services** (e.g., Sunday 9:30 AM and 11:30 AM services)
- **Multi-day special events** (e.g., conferences, retreats, Congreso)
- **Live operations** during services/events (real-time timing, director console, live chat)
- **Public content submission** (speakers submit sermon notes, arts directors submit production details)
- **Push notifications** for operational staff
- **PDF report generation** for printed service programs

The platform serves ~6 user roles from full admin to view-only volunteers, with granular permission controls.

---

## 2. PLATFORM & RUNTIME

| Layer | Technology |
|-------|-----------|
| **Hosting Platform** | Base44 (Backend-as-a-Service) |
| **Frontend Framework** | React 18 + Vite |
| **Styling** | Tailwind CSS + shadcn/ui component library |
| **State Management** | TanStack React Query v5 (server state), React useState/useContext (local state) |
| **Routing** | React Router v6 (client-side SPA) |
| **Backend Functions** | Deno Deploy (serverless, sandboxed JS — no Node APIs) |
| **Database** | Base44 managed NoSQL (entity-based, JSON schema definitions) |
| **Real-Time** | Base44 entity subscriptions (WebSocket-based) |
| **Authentication** | Base44 built-in auth (email-based invite, platform-managed login) |
| **File Storage** | Base44 file upload (public URLs) + Google Drive (OAuth connector) |
| **Push Notifications** | PushEngage (third-party SaaS, API-driven broadcasts) |
| **AI/LLM** | Base44 InvokeLLM integration (scripture parsing, content extraction) |
| **Scheduled Jobs** | Base44 automations (cron-like, EventBridge under the hood) |
| **Entity Triggers** | Base44 entity automations (on create/update/delete) |
| **PDF Generation** | jsPDF (server-side in Deno functions) + client-side HTML-to-PDF |
| **OAuth Connector** | Google Drive (authorized, file upload scope) |

### Key Platform Constraints
- **No server-side rendering** — React SPA only
- **No Node.js APIs** in backend functions (Deno runtime)
- **No cross-function imports** — each function is independently deployed
- **5-minute minimum** for scheduled automations
- **200KB payload limit** on entity automation triggers
- **No background threads** — functions must complete within request lifecycle
- **File writes only to `/tmp`** in backend functions
- **npm packages must use `npm:package@version` prefix** in Deno functions

---

## 3. DATA MODEL (34 Entities)

### 3.1 Core Program Hierarchy

```
Event (multi-day)
  └── EventDay (one per date)
       └── Session (time block within a day)
            └── Segment (individual program item)
                 ├── SegmentAction (department-specific cues)
                 ├── StreamBlock (livestream overlay/insert)
                 └── sub_assignments (inline array)

Service (weekly recurring)
  ├── Session (time slot: 9:30am, 11:30am)
  │    └── Segment → SegmentAction, StreamBlock
  └── Embedded segment arrays: "9:30am", "11:30am" (legacy)
```

**Key relationships are via string ID references** (not foreign keys — NoSQL). The `session_id`, `event_id`, `service_id` fields on Segment, Session, etc. are string pointers resolved at query time.

### 3.2 Entity Catalog

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| **Event** | Multi-day events (conferences, retreats) | name, slug, year, start_date, end_date, status (planning→confirmed→in_progress→completed→archived), print_color, promotion fields |
| **EventDay** | Single day within an event | event_id, date, day_of_week, translation settings |
| **Session** | Time block (AM/PM slot) | event_id OR service_id, event_day_id, room_id, date, planned_start_time, planned_end_time, team assignments (10+ team fields), session_color, live director fields |
| **Segment** | Individual program item (worship, sermon, etc.) | session_id, service_id, segment_type (19 types), title, presenter, timing fields, department notes (8 note fields), visibility toggles (5), worship song fields (6 songs × 3 fields), arts fields (50+ for dance/drama/spoken word/painting), submission fields, segment_actions (inline array) |
| **SegmentAction** | Department cue within a segment | segment_id, label, department (13 depts), time_hint, details |
| **StreamBlock** | Livestream overlay/insert block | session_id, block_type (link/insert/replace/offline), anchor_segment_id, timing, stream_actions array |
| **Service** | Weekly recurring service definition | name, day_of_week, date, time, status, embedded "9:30am"/"11:30am" segment arrays (legacy), team assignments, announcement selections, PDF print settings |
| **ServiceSchedule** | Recurring schedule template | name, day_of_week, sessions array (with blueprint_id references), is_active |
| **SegmentTemplate** | Reusable segment preset | name, segment_type, default values for duration, notes, visibility |
| **Room** | Physical venue room | name, location, equipment flags (projection, sound, translation), capacity |
| **Person** | People directory (volunteers, staff) | first_name, last_name, demographics, church involvement fields, contact info |
| **Asset** | Media assets (images, videos, countdowns) | name, type (StillImage/Video/Countdown/QRSlide/BackgroundLoop), file_link, tags |
| **SlidePack** | Pre-service slide collection | name, description |
| **SlidePackAsset** | Join table: SlidePack ↔ Asset | slide_pack_id, asset_id, order |
| **MusicProfile** | Pre-service music preset | name, style, volume_guideline, playlist_link |
| **TranslationConfig** | Translation settings per EventDay | event_day_id, mode, source/target language, translator |
| **CrewCallBlock** | Team arrival time blocks | event_day_id, team_type, start_time, end_time |
| **CrewCallSession** | Join: CrewCallBlock ↔ Session | crew_call_block_id, session_id |
| **PreSessionDetails** | Pre-session logistics | session_id, music_profile_id, slide_pack_id, registration/library times, notes |
| **HospitalityTask** | Catering/setup tasks per session | session_id, category (Breakfast/Lunch/etc.), time_hint, description |
| **AnnouncementItem** | Individual announcement | title, content, instructions, priority, date_of_occurrence, target filters |
| **AnnouncementSeries** | Ordered announcement group | name, fixed_announcement_ids, dynamic event inclusion settings |
| **ActiveProgramCache** | Pre-computed program snapshot | cache_key, program_type, program_id, program_snapshot (full JSON), admin_override fields, refresh metadata |
| **LiveTimeAdjustment** | Time offset for live services | date, adjustment_type, offset_minutes, authorized_by |
| **LiveOperationsMessage** | Real-time ops chat | context_type/id, message, image_url, is_pinned, is_director_ping, reactions array, edit/delete tracking |
| **SessionFeedback** | Post-session feedback notes | session_id, department, category (5 types), feedback_text, follow_up_status |
| **PushSubscription** | Web push subscriber records | user_email, endpoint, auth_key, p256dh_key, is_active |
| **NotificationLog** | Dedup log for push sends | dedup_key, notification_type, sent_at, program_date |
| **PublicFormIdempotency** | Prevents duplicate form submissions | idempotency_key, form_type, status, response_payload |
| **SpeakerSubmissionVersion** | Versioned speaker content submissions | segment_id, content, presentation_url, processing_status, device_info |
| **ArtsSubmissionLog** | Arts form change audit trail | segment_id, event_id, submitter info, data_snapshot, fields_changed |
| **SuggestionItem** | Autocomplete suggestions (names, songs) | type (8 categories), value, use_count |
| **EditActionLog** | Full edit audit trail | entity_type, entity_id, action_type, field_changes, previous/new state |
| **LiveDirectorActionLog** | Director console audit | session_id, action_type (14 types), cascade details, drift/time-bank |
| **TimeAdjustmentLog** | Time change audit | date, service_id, previous/new offset, who authorized |

### 3.3 Meta/System Entities

| Entity | Purpose |
|--------|---------|
| **User** | Extended with: app_role (7 roles), custom_permissions[], revoked_permissions[], access_expires_at, ui_language, pinned_nav_items, chat_last_seen |
| **Permission** | Permission definitions (key, resource, action, bilingual labels, hierarchy_level) |
| **RoleTemplate** | Role → default_permissions[] mapping (7 system roles) |
| **Decision** | Architecture decision records (title, rationale, context, category) |
| **AttemptLog** | Failed/blocked approach records (approach, outcome, details, category) |
| **DependencyNode** | System artifact registry (type, module, inputs, outputs, risk_level) |
| **DependencyEdge** | Relationship map between nodes (relationship_type, coupling_level, failure_mode) |

---

## 4. PERMISSION & AUTHORIZATION MODEL

### 4.1 Role Hierarchy (7 roles)

| Role | Access Level |
|------|-------------|
| **Admin** | Full system access, user management, all features |
| **AdmAsst** | Dashboard + editing, no user management or dangerous operations |
| **LiveManager** | Live operations focus: Live View, Director Console, chat |
| **EventDayCoordinator** | Event day operations: Live View, MyProgram, limited editing |
| **EventDayViewer** | Read-only: MyProgram view only |
| **Guest** | Temporary access with optional expiry date |
| **Deactivated** | All access revoked |

### 4.2 Permission Mechanics

- Roles have default permission sets defined in **RoleTemplate** entities
- Users can have **custom_permissions[]** (additive grants) and **revoked_permissions[]** (subtractive overrides)
- **Hierarchical permission inheritance**: `manage` > `delete` > `create` > `edit` > `view` — granting a higher level implies all lower levels
- **Access expiry**: `access_expires_at` field auto-deactivates users after a date
- Permission checks happen client-side via `hasPermission(user, key)` utility (no server-side middleware — platform constraint)

### 4.3 Permission Keys (partial list)

`view_events`, `edit_events`, `create_events`, `manage_events`, `view_services`, `edit_services`, `view_segments`, `edit_segments`, `view_people`, `edit_people`, `access_live_view`, `manage_live_director`, `view_reports`, `manage_users`, `manage_roles`, `manage_announcements`, etc.

---

## 5. PAGE INVENTORY (42 Pages)

### 5.1 Admin/Dashboard Pages (require authentication)

| Page | Purpose |
|------|---------|
| **Dashboard** | Landing page — overview cards, quick actions |
| **Events** | Event list/grid with CRUD |
| **EventDetail** | Single event editor — days, sessions, segments |
| **SessionDetail** | Segment editor with two-column form, drag-and-drop reorder |
| **Services** | Weekly service list |
| **ServiceDetail** | Legacy single-service editor |
| **WeeklyServiceManager** | Primary weekly service editor (V2 entity-centric approach) |
| **WeeklyServiceReport** | Print-ready weekly service program |
| **CustomServicesManager** | Non-Sunday service management |
| **CustomEditorV2** | Editor for custom (non-weekly) services |
| **ServiceBlueprints** | Service template management |
| **ServiceAnnouncementBuilder** | Announcement composition for services |
| **AnnouncementsReport** | Announcement viewer/printer |
| **Reports** | Departmental reports (General, Projection, Sound, Ushers, Livestream, Hospitality, Detailed, Arts) |
| **DirectorConsole** | Live Director real-time control panel |
| **People** | People directory CRUD |
| **Rooms** | Room management |
| **Teams** | Team management |
| **Templates** | Segment template library |
| **Calendar** | Calendar view of events/services |
| **UserManagement** | User invitation, role assignment |
| **RolePermissionManager** | Role template and permission editor |
| **Profile** | Current user settings (language, nav pins, account deletion) |
| **MessageProcessing** | Speaker submission processing queue |
| **ArtsSubmissions** | Arts submission review/administration |
| **ActivityLog** | Edit history viewer |
| **ScheduleImporter** | AI-powered schedule import from files |

### 5.2 Live/Display Pages

| Page | Purpose |
|------|---------|
| **PublicProgramView** | Real-time program display (Live View) — requires auth |
| **PublicCountdownDisplay** | TV display mode — large countdown timer, auto-advances segments |
| **MyProgram** | Volunteer-facing program view (department-filtered) |

### 5.3 Public Form Pages (no auth required)

| Page | Purpose |
|------|---------|
| **PublicSpeakerForm** | Speakers submit sermon notes/verses/slides |
| **PublicArtsForm** | Arts directors submit production details (dance, drama, video, etc.) |
| **PublicWeeklyForm** | Pastors submit weekly sermon content |

### 5.4 Dev/Internal Pages

| Page | Purpose |
|------|---------|
| **BuildMemory** | Decision log + attempt log viewer |
| **DependencyTracker** | System dependency graph visualizer |
| **DevTools** | Developer utilities |
| **SchemaGuide** | Entity schema reference |
| **FeedbackReview** | Post-session feedback review |
| **PushNotifications** | Push notification admin panel |

### 5.5 Report Sub-Views (loaded within Reports page)

GeneralProgram, DetailedProgram, ProjectionView, SoundView, UshersView — each renders a department-specific read-only program view optimized for that team's needs.

---

## 6. BACKEND FUNCTIONS (39 Functions)

### 6.1 Core Program Functions

| Function | Purpose |
|----------|---------|
| **refreshActiveProgram** | Builds/caches the full program snapshot for today's active event or service. Triggered by entity automations on Service, Session, Segment, PreSessionDetails, Event, EventDay, StreamBlock changes. Also callable manually. Writes to ActiveProgramCache entity. |
| **buildProgramSnapshot** | Pure computation: assembles full program data from entity queries. Called by refreshActiveProgram. |
| **getPublicProgramData** | Returns cached program snapshot for Live View / TV Display consumers. |
| **getSortedSessions** | Returns sessions sorted by planned_start_time for a given event/service. |
| **getSegmentsBySessionIds** | Batch-fetches segments for multiple sessions. |

### 6.2 Weekly Service Functions

| Function | Purpose |
|----------|---------|
| **ensureRecurringServices** | Scheduled job: creates Service entities for upcoming weeks based on ServiceSchedule definitions. |
| **ensureNextSundayService** | Ensures next Sunday's service exists with hydrated sessions and segments from blueprints. |
| **getWeeklyFormData** | JSON API: returns service data for PublicWeeklyForm. |
| **submitWeeklyServiceContent** | Processes weekly form submissions (idempotent). |
| **serveWeeklyServiceSubmission** | Legacy SSR endpoint (deprecated, replaced by React page). |

### 6.3 Speaker Submission Pipeline

| Function | Purpose |
|----------|---------|
| **getSpeakerFormData** | JSON API: returns event data and segment options for PublicSpeakerForm. |
| **getSpeakerOptions** | Returns available segments for speaker dropdown. |
| **submitSpeakerContent** | Processes speaker form submission → creates SpeakerSubmissionVersion → sets Segment.submission_status to "pending". |
| **processNewSubmissionVersion** | Triggered by entity automation on SpeakerSubmissionVersion create. Parses scripture references via LLM, writes parsed data to Segment. |
| **processPendingSubmissions** | Batch processor for pending submissions. |
| **processSegmentSubmission** | Processes individual segment submission (verse parsing via InvokeLLM). |
| **watchdogPendingSubmissions** | Scheduled safety net: re-queues stuck pending submissions (hourly). |
| **parseScriptureShared** | LLM-powered scripture reference parser (extracts book, chapter, verse from free text). |
| **serveSpeakerSubmission** | Legacy SSR endpoint (deprecated). |

### 6.4 Arts Form Pipeline

| Function | Purpose |
|----------|---------|
| **getArtsFormData** | JSON API: returns event + arts segment data for PublicArtsForm. |
| **submitArtsSegment** | Processes arts form submission, writes to Segment + ArtsSubmissionLog. |
| **getArtsChangeHistory** | Returns change history for an event's arts submissions. |
| **serveArtsSubmission** | Legacy SSR endpoint (deprecated). |

### 6.5 Live Operations

| Function | Purpose |
|----------|---------|
| **updateLiveTiming** | Applies live time adjustments during services. |
| **updateLiveSegmentTiming** | Updates individual segment actual times during live director mode. |
| **generateCascadeProposal** | AI-powered: given a timing overrun, proposes how to redistribute time across remaining segments. |

### 6.6 Notification Functions

| Function | Purpose |
|----------|---------|
| **checkUpcomingNotifications** | Scheduled (5-min): scans today's sessions for upcoming starts and segment actions, sends PushEngage broadcasts with dedup. |
| **sendNotification** | Entity-triggered notification sender (currently disabled). |
| **sendChatNotification** | Sends push notification for @Director pings in live chat. |
| **testPushBroadcast** | Admin diagnostic: sends test push notification. |
| **pushNotificationAdmin** | Admin API for PushEngage configuration. |

### 6.7 PDF & Reports

| Function | Purpose |
|----------|---------|
| **generateServiceProgramPdf** | Server-side PDF generation for weekly service programs (jsPDF). |
| **generateEventReportsPdf** | Server-side PDF generation for event reports. |
| **sendEmailWithPDF** | Sends PDF as email attachment via SendGrid. |

### 6.8 Utility Functions

| Function | Purpose |
|----------|---------|
| **fetchUrlMetadata** | Fetches URL metadata (title, thumbnail) for link previews. |
| **refreshSuggestions** | Rebuilds autocomplete suggestion index from existing data. |
| **completeExpiredEvents** | Nightly job: transitions past events from in_progress to completed. |
| **archiveLiveOperationsMessages** | Cleans up old chat messages. |
| **deleteUserAccount** | Account deletion with data cleanup. |
| **uploadToDrive** | Uploads files to Google Drive via OAuth connector. |
| **migrateSegmentUrls** | One-time migration utility. |
| **diagnoseWeeklyServiceActions** | Diagnostic tool for debugging service action issues. |
| **auditServiceActions** | Audits service action configuration. |

---

## 7. AUTOMATIONS (12 Total)

### 7.1 Scheduled Automations

| Name | Schedule | Function | Status |
|------|----------|----------|--------|
| Auto-complete Expired Events | Daily 12:30 AM ET | completeExpiredEvents | ✅ Active |
| Ensure Recurring Services | Daily 3:00 AM ET | ensureRecurringServices | ✅ Active |
| Refresh Active Program (Midnight) | Daily midnight ET | refreshActiveProgram | ✅ Active |
| Check Upcoming Notifications | Every 5 min | checkUpcomingNotifications | ❌ Disabled |
| Watchdog: Stuck Pending Submissions | Every 1 hour | watchdogPendingSubmissions | ✅ Active |

### 7.2 Entity Automations

| Name | Entity | Events | Function | Status |
|------|--------|--------|----------|--------|
| Cache Refresh on Service Change | Service | create, update | refreshActiveProgram | ✅ Active |
| Cache Refresh on Session Changes | Session | create, update | refreshActiveProgram | ✅ Active |
| Cache Refresh on Segment Changes | Segment | create, update, delete | refreshActiveProgram | ✅ Active |
| Cache Refresh on PreSessionDetails | PreSessionDetails | create, update | refreshActiveProgram | ✅ Active |
| Cache Refresh on Event Change | Event | create, update | refreshActiveProgram | ✅ Active |
| Cache Refresh on EventDay Change | EventDay | create, update | refreshActiveProgram | ✅ Active |
| Cache Refresh on StreamBlock Change | StreamBlock | create, update, delete | refreshActiveProgram | ✅ Active |
| Process New Submission Version | SpeakerSubmissionVersion | create | processNewSubmissionVersion | ✅ Active |
| Send Notification on Segment Start | Segment | update | sendNotification | ❌ Disabled |
| Send Notification on Action Create | SegmentAction | create | sendNotification | ❌ Disabled |
| Process Segment Submission | Segment | update | processSegmentSubmission | ❌ Disabled |

---

## 8. INTEGRATIONS & EXTERNAL SERVICES

### 8.1 OAuth Connectors

| Service | Scopes | Purpose |
|---------|--------|---------|
| **Google Drive** | drive.file, userinfo.email | File uploads (presentation slides, speaker notes) |

### 8.2 API Keys (Secrets)

| Secret | Service | Purpose |
|--------|---------|---------|
| PUSHENGAGE_API_KEY | PushEngage | Push notification broadcasts |
| VAPID_SUBJECT | Web Push | VAPID identification |
| VAPID_PRIVATE_KEY | Web Push | VAPID signing |
| VAPID_PUBLIC_KEY | Web Push | VAPID client subscription |
| SENDGRID_API_KEY | SendGrid | Transactional email with PDF attachments |

### 8.3 Built-in Integrations (Base44)

| Integration | Usage |
|-------------|-------|
| **InvokeLLM** | Scripture parsing (extracting book/chapter/verse from free text), schedule import (AI parsing of uploaded event schedules), cascade proposal generation |
| **UploadFile** | File uploads for speaker presentations, arts media, chat images |
| **SendEmail** | Transactional notifications |
| **ExtractDataFromUploadedFile** | Schedule import (parsing CSV/Excel/PDF into structured data) |
| **GenerateImage** | Not actively used |

---

## 9. REAL-TIME ARCHITECTURE

### 9.1 ActiveProgramCache Pattern

The core real-time display system uses a **cache-then-subscribe** pattern:

1. **Entity automations** fire on any change to Service, Session, Segment, PreSessionDetails, Event, EventDay, StreamBlock
2. Each triggers `refreshActiveProgram` which rebuilds the full program snapshot
3. The snapshot is stored in **ActiveProgramCache** (single entity record, `cache_key: "current_display"`)
4. Frontend consumers (Live View, TV Display, MyProgram) subscribe to ActiveProgramCache via `base44.entities.ActiveProgramCache.subscribe()`
5. On update, frontend re-renders with the new snapshot — **no polling needed**

### 9.2 Live Chat (LiveOperationsMessage)

- Messages stored as entities with `context_type` (event/service) and `context_id`
- Real-time delivery via `base44.entities.LiveOperationsMessage.subscribe()`
- Features: pinning, reactions (thumbs up/down), edit/delete with audit trail, @Director pings, image attachments, typing indicators

### 9.3 Live Director Mode

- One user holds the "director lock" per session (`Session.live_director_user_id`)
- Director can: place holds on segments, finalize timing, skip/shift segments, apply cascade timing redistributions
- All actions logged in **LiveDirectorActionLog** with full before/after state snapshots
- Segment timing updates flow through entity writes → automation → cache refresh → subscriber update

---

## 10. PUBLIC FORM ARCHITECTURE

### 10.1 Speaker Submission Flow

```
PublicSpeakerForm (React page, no auth)
  → getSpeakerFormData (fetch available segments)
  → User fills form
  → submitSpeakerContent (backend function)
    → Creates SpeakerSubmissionVersion entity
    → Sets Segment.submission_status = "pending"
  → Entity automation fires on SpeakerSubmissionVersion create
    → processNewSubmissionVersion
      → Calls InvokeLLM to parse scripture references
      → Writes parsed_verse_data back to Segment
      → Updates submission_status = "processed"
  → Watchdog (hourly): catches any stuck "pending" submissions
```

### 10.2 Arts Submission Flow

```
PublicArtsForm (React page, no auth)
  → Gate form (name + email, no account needed)
  → getArtsFormData (fetch event + arts segments)
  → Accordion UI per segment (dance, drama, video, spoken word, painting)
  → submitArtsSegment (per-segment save)
    → Writes directly to Segment entity (arts fields)
    → Creates ArtsSubmissionLog entry (audit)
```

### 10.3 Weekly Form Flow

```
PublicWeeklyForm (React page, no auth)
  → getWeeklyFormData (fetch current week's service data)
  → User selects which service segment to submit for
  → submitWeeklyServiceContent
    → Creates SpeakerSubmissionVersion
    → Same processing pipeline as speaker form
```

### 10.4 Idempotency

All public forms use `PublicFormIdempotency` entity with a client-generated UUID to prevent duplicate submissions on retry.

---

## 11. PDF GENERATION

Two approaches coexist:

1. **Server-side (jsPDF in Deno functions)**: `generateServiceProgramPdf`, `generateEventReportsPdf` — produces PDF binary returned as Response with Content-Type: application/pdf
2. **Client-side**: `generateWeeklyProgramPDF`, `generateAnnouncementsPDF`, `generateEventReportsPDFClient` — uses jsPDF in the browser with custom cell/table builders

PDF features include:
- Brand gradient header bars
- Color-coded segment types
- Multiple page layouts (service program page 1, announcements page 2)
- Configurable print settings per page (margins, font scales, global scale)
- Department-specific report formats (projection, sound, ushers, livestream, hospitality, general, detailed, arts)

---

## 12. INTERNATIONALIZATION (i18n)

- **Two languages**: English (en) and Spanish (es), with Spanish as default
- **Translation system**: Custom context-based provider (`LanguageProvider` / `useLanguage` hook)
- **Translation files**: `components/utils/i18n/en.js` and `components/utils/i18n/es.js` — key-value dictionaries
- **User preference**: Stored on `User.ui_language`, persisted to localStorage
- **Public forms**: Separate `PublicFormLangProvider` with a floating toggle button
- **All segment types, department names, role labels**: bilingual

---

## 13. NAVIGATION & LAYOUT

### 13.1 Layout System

- Global layout wraps all authenticated pages (`Layout.jsx`)
- **Desktop**: 72px icon-rail sidebar (left) with tooltip labels
- **Mobile**: Bottom tab bar (5 tabs) with customizable pinned items
- **Public pages**: No nav shell (or minimal for authenticated admins viewing public pages)
- **Permission-gated navigation**: Menu items shown/hidden based on user permissions
- Animated page transitions via Framer Motion

### 13.2 Nav Pin System

Users can customize their bottom tab bar by pinning up to 3 secondary nav items (stored in `User.pinned_nav_items`).

---

## 14. SEGMENT TYPE SYSTEM

The `Segment.segment_type` enum defines 19 program element types:

| Type | Description | Key Fields |
|------|-------------|------------|
| Alabanza | Worship music | song fields (up to 6 songs with title/lead/key) |
| Bienvenida | Welcome/greeting | presenter |
| Ofrenda | Offering | presenter |
| Plenaria | Main sermon/plenary | message_title, scripture_references, parsed_verse_data, submission fields |
| Video | Video playback | video_name, video_url, video_length_sec |
| Anuncio | Announcement | announcement_title, announcement_description |
| Dinámica | Interactive activity | presenter |
| Break | Short break | major_break flag |
| TechOnly | Technical cue (not shown to public) | — |
| Oración | Prayer | presenter |
| Especial | Special item | presenter |
| Cierre | Closing | presenter |
| MC | Master of Ceremonies | presenter |
| Ministración | Ministry time | presenter |
| Receso | Extended break/recess | — |
| Almuerzo | Lunch break | — |
| Artes | Arts performance | 50+ fields for dance, drama, spoken word, painting, video |
| Breakout | Breakout sessions | breakout_rooms array with room-level details |
| Panel | Panel discussion | panel_moderators, panel_panelists |

Each type has configurable visibility per department view (`show_in_general`, `show_in_projection`, `show_in_sound`, `show_in_ushers`, `show_in_livestream`).

---

## 15. KEY ARCHITECTURAL PATTERNS

### 15.1 Blueprint/Template System

- **ServiceSchedule** defines recurring service patterns (day of week, session slots)
- Each session slot can reference a **blueprint Service** (status: "blueprint") containing template segments
- When a new week's service is auto-created, segments are cloned from the blueprint with `origin: "template"` and `field_origins` tracking which fields came from the template vs. manual edits

### 15.2 Origin Tracking

All clonable entities (Event, Session, Segment, SegmentAction, HospitalityTask, PreSessionDetails) carry:
- `origin`: "manual" | "template" | "duplicate"
- `field_origins`: `{ fieldName: "template" | "manual" }` — tracks per-field provenance

### 15.3 Cache Refresh Pattern (ActiveProgramCache)

- Single source of truth for "what's showing right now"
- Supports admin override (`admin_override_type`, `admin_override_id`) to force-display a specific event/service
- Auto-detects current program based on date/time
- Concurrency guard (`refresh_in_progress` flag with 30s TTL)
- Includes pre-computed `selector_options` for dropdown menus

### 15.4 Live Director Cascade

When a segment runs over/under time:
1. Director marks actual end time
2. System calculates drift (cumulative minutes over/under)
3. `generateCascadeProposal` (LLM-powered) suggests time redistribution options
4. Director selects an option
5. System applies cascading time changes to remaining segments
6. All actions logged in LiveDirectorActionLog

---

## 16. NPM DEPENDENCIES (Frontend)

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.2.0 | UI framework |
| react-dom | ^18.2.0 | DOM rendering |
| react-router-dom | ^6.26.0 | Client-side routing |
| @tanstack/react-query | ^5.84.1 | Server state management |
| tailwindcss-animate | ^1.0.7 | Animation utilities |
| framer-motion | ^11.16.4 | Page transitions, animations |
| lucide-react | ^0.475.0 | Icon library |
| date-fns | ^3.6.0 | Date formatting/manipulation |
| moment | ^2.30.1 | Date formatting (legacy usage) |
| lodash | ^4.17.21 | Utility functions |
| react-markdown | ^9.0.1 | Markdown rendering |
| react-quill | ^2.0.0 | Rich text editor |
| react-hook-form | ^7.54.2 | Form state management |
| @hello-pangea/dnd | ^17.0.0 | Drag and drop |
| recharts | ^2.15.4 | Charts/data visualization |
| jspdf | ^4.0.0 | PDF generation |
| html2canvas | ^1.4.1 | HTML to canvas (for screenshots) |
| three | ^0.171.0 | 3D rendering (minimal usage) |
| react-leaflet | ^4.2.1 | Map components |
| canvas-confetti | ^1.9.4 | Celebration effects |
| sonner | ^2.0.1 | Toast notifications |
| zod | ^3.24.2 | Schema validation |
| @hookform/resolvers | ^4.1.2 | Zod + react-hook-form bridge |
| cmdk | ^1.0.0 | Command palette |
| vaul | ^1.1.2 | Drawer component |
| embla-carousel-react | ^8.5.2 | Carousel |
| input-otp | ^1.4.2 | OTP input |
| react-resizable-panels | ^2.1.7 | Resizable panel layouts |
| react-hot-toast | ^2.6.0 | Toast (legacy, being replaced by sonner) |
| next-themes | ^0.4.4 | Theme management (disabled — app forced to light mode) |
| class-variance-authority | ^0.7.1 | Component variant styling |
| clsx | ^2.1.1 | Conditional classnames |
| tailwind-merge | ^3.0.2 | Tailwind class dedup |
| react-day-picker | ^8.10.1 | Date picker |

**shadcn/ui components** (all pre-installed): accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toggle, toggle-group, tooltip.

### Backend Function Dependencies (Deno)

| Package | Purpose |
|---------|---------|
| npm:@base44/sdk@0.8.21 | Platform SDK (entities, auth, integrations, connectors) |
| npm:jspdf@4.0.0 | Server-side PDF generation |
| npm:openai | LLM calls (via Base44 InvokeLLM, not direct) |

---

## 17. BRANDING & DESIGN SYSTEM

### 17.1 Brand Colors

| Token | Value | Usage |
|-------|-------|-------|
| --brand-charcoal | #1A1A1A | Dark backgrounds, headers |
| --brand-teal | #1F8A70 | Primary brand color |
| --brand-green | #8DC63F | Secondary brand color |
| --brand-lime | #BDC63F | Accent |
| --brand-yellow | #D7DF23 | Accent, gradient end |

### 17.2 Brand Gradient

```css
.brand-gradient { background: linear-gradient(90deg, #0F5C4D 0%, #4A7C2F 50%, #7A8C1A 100%); }
```

### 17.3 Typography

| Element | Font | Notes |
|---------|------|-------|
| h1, h2 | Anton | Uppercase, tracking 0.05em |
| h3-h6 | Bebas Neue | Uppercase, tracking 0.02em |
| Body | Inter | Variable weights 400-800 |

### 17.4 Design Constraints

- **Light mode only** — dark mode explicitly disabled (backgrounds, gradients, color-coding designed for light)
- Background: `#F0F1F3`
- Cards: white with 1.5px border
- Mobile-first responsive design
- Print-optimized CSS for PDF/program printouts

---

## 18. SECURITY CONSIDERATIONS

1. **Authentication**: Platform-managed (Base44 auth). No custom login pages.
2. **Authorization**: Client-side permission checks only (platform constraint). Backend functions validate `base44.auth.me()` for user identity but cannot enforce fine-grained permissions server-side.
3. **Admin-only functions**: Check `user.role === 'admin'` and return 403 if not.
4. **Public forms**: No auth required. Protected by idempotency keys and honeypot fields (bot protection).
5. **Data isolation**: All data belongs to one organization. No multi-tenancy.
6. **File access**: Public URLs for uploaded files (no private file storage for user content).
7. **Secrets**: Stored in Base44 environment variables, not in code.
8. **CORS/CSP**: Platform-managed. Public forms migrated from SSR to React SPA to bypass CDN-level CSP restrictions.

---

## 19. KNOWN LIMITATIONS & TECHNICAL DEBT

1. **Legacy Service entity**: Carries embedded segment arrays ("9:30am", "11:30am") alongside the entity-based Segment model. Both coexist — the V2 editor writes to Segment entities, but some legacy code still reads from embedded arrays.
2. **No server-side authorization middleware**: Permission checks are client-side only. A malicious authenticated user could theoretically call entity CRUD APIs directly.
3. **Single-org design**: No multi-tenancy. The entire app serves one church.
4. **Entity automation payload limit**: 200KB. Large segment updates may arrive with `payload_too_large: true`, requiring a separate fetch.
5. **Push notifications via PushEngage**: Broadcast-only model (all subscribers receive all notifications). No per-user targeting without PushEngage's audience segmentation.
6. **PDF generation split**: Two parallel approaches (server-side jsPDF and client-side jsPDF) with different formatting. Not fully unified.
7. **Suggestion autocomplete**: Uses a dedicated entity (SuggestionItem) that requires periodic refresh rather than real-time indexing.
8. **Dark mode disabled**: The entire design system is light-mode-only. `colorScheme: 'light'` is forced on public forms to prevent OS dark mode interference.

---

## 20. DATA FLOW SUMMARY

### Weekly Service Lifecycle

```
ServiceSchedule (template)
  → ensureRecurringServices (nightly automation)
    → Creates Service entity for upcoming week
    → Creates Session entities per slot
    → Clones Segment entities from blueprint
    → Clones SegmentAction, PreSessionDetails, HospitalityTask from blueprint
  → Admin edits in WeeklyServiceManager
    → Entity writes → automation → refreshActiveProgram → ActiveProgramCache
  → Speaker submits via PublicSpeakerForm or PublicWeeklyForm
    → SpeakerSubmissionVersion created
    → processNewSubmissionVersion parses scripture
    → Segment updated with parsed content
  → Service day: Live View + TV Display read from ActiveProgramCache
  → Post-service: SessionFeedback submitted
```

### Event Lifecycle

```
Admin creates Event
  → Adds EventDays, Sessions, Segments (manual or from template)
  → Arts directors submit via PublicArtsForm
  → Speakers submit via PublicSpeakerForm
  → Event status: planning → confirmed → in_progress → completed
  → During event: DirectorConsole controls live timing
  → completeExpiredEvents (nightly) auto-closes past events
```

---

## 21. MIGRATION CONSIDERATIONS

### What Would Need Rebuilding

1. **Auth system**: Base44-specific. New platform needs email-based invite + role model.
2. **Entity subscriptions**: Real-time WebSocket layer is platform-provided. Need equivalent pub/sub.
3. **Automation engine**: Scheduled + entity-trigger automations. Need cron jobs + database triggers or webhooks.
4. **File upload/storage**: Currently Base44 managed. Need object storage (S3, etc.).
5. **LLM integration**: Currently via Base44's InvokeLLM wrapper. Need direct OpenAI/Anthropic API integration.
6. **OAuth connector**: Google Drive OAuth currently managed by platform. Need custom OAuth flow.

### What's Portable

1. **React frontend**: Standard React 18 + Tailwind + shadcn/ui. Fully portable.
2. **Data model**: JSON schemas are portable to any NoSQL or even relational DB (with normalization).
3. **Backend logic**: Deno functions are close to standard JS/TS. Would need adapter for Node.js Express or similar.
4. **PDF generation**: jsPDF is platform-agnostic.
5. **i18n dictionaries**: Plain JS objects, easily portable.
6. **Brand design system**: CSS variables + Tailwind config, fully portable.

### Integration Points (if keeping both systems)

If integrating rather than migrating, these are the natural API boundaries:
- **ActiveProgramCache.program_snapshot**: JSON blob containing the full program state. Could be exposed as an API endpoint for external consumption.
- **Entity CRUD via Base44 SDK**: Could be wrapped in REST endpoints for external systems.
- **Webhook triggers**: Entity automations could call external webhooks on data changes.
- **Public form endpoints**: Already JSON API-based, could be called from external frontends.

---

*End of Technical Architecture Document*