# PDV Event Pro — Entity Relationship Diagram

```mermaid
erDiagram
    User {
        string id PK
        string email
        string full_name
        string role
        array custom_permissions
    }

    Service {
        string id PK
        string name
        date date
        string service_type
        string status
        string origin
        json receso_notes
    }

    Event {
        string id PK
        string name
        date start_date
        date end_date
        string status
    }

    EventDay {
        string id PK
        string event_id FK
        date date
        string name
        int order
    }

    Session {
        string id PK
        string service_id FK
        string event_id FK
        date date
        int order
        string name
        string planned_start_time
        string planned_end_time
        string coordinator_name
        string sound_technician
        string ushers_leader
        boolean live_adjustment_enabled
        string live_director_user_id FK
        string live_director_user_name
        datetime live_director_started_at
    }

    Segment {
        string id PK
        string session_id FK
        string service_id FK
        string parent_segment_id FK
        int order
        string title
        string segment_type
        string start_time
        string end_time
        int duration_min
        string presenter
        string translator_name
        boolean requires_translation
        string message_title
        string scripture_references
        json parsed_verse_data
        text description_details
        string presentation_url
        string notes_url
        boolean content_is_slides_only
        boolean show_in_general
        int number_of_songs
        string song_1_title
        string song_2_title
        string song_3_title
        string song_4_title
        string song_5_title
        string song_6_title
        text projection_notes
        text sound_notes
        text ushers_notes
        text translation_notes
        text stage_decor_notes
        text coordinator_notes
        boolean has_video
        json segment_actions
        json ui_fields
        json ui_sub_assignments
    }

    SegmentAction {
        string id PK
        string segment_id FK
        string label
        string department
        string timing
        int offset_min
        int order
        text notes
    }

    PreSessionDetails {
        string id PK
        string session_id FK
        text general_notes
        string registration_desk_open_time
        string library_open_time
        text facility_notes
    }

    StreamBlock {
        string id PK
        string session_id FK
        int order
    }

    HospitalityTask {
        string id PK
        string session_id FK
    }

    AnnouncementItem {
        string id PK
        string service_id FK
        string event_id FK
        string status
        int priority
    }

    LiveTimeAdjustment {
        string id PK
        string service_id FK
        date date
        string status
    }

    LiveDirectorActionLog {
        string id PK
        string session_id FK
        string segment_id FK
        string performed_by_user_id FK
        string action_type
        string performed_by_user_name
        json previous_state
        json new_state
        boolean is_undone
        text notes
    }

    SpeakerSubmissionVersion {
        string id PK
        string segment_id FK
        string submission_status
        text content
        boolean content_is_slides_only
    }

    ArtsSubmissionLog {
        string id PK
        string segment_id FK
        string submission_status
    }

    PushSubscription {
        string id PK
        string user_id FK
        json subscription_data
    }

    ActiveProgramCache {
        string id PK
        string cache_key
        string program_type
        string program_id
        string program_name
        date program_date
        date detected_date
        json program_snapshot
        json selector_options
        string last_refresh_trigger
        datetime last_refresh_at
        boolean refresh_in_progress
        string admin_override_type
        string admin_override_id
        string admin_override_by
        datetime admin_override_at
    }

    ServiceSchedule {
        string id PK
        string name
    }

    Room {
        string id PK
        string name
        int capacity
    }

    SuggestionItem {
        string id PK
    }

    PublicFormIdempotency {
        string id PK
        string idempotency_key
        string form_type
    }

    %% Service hierarchy
    Service ||--o{ Session : "has"
    Service ||--o{ Segment : "has"
    Service ||--o{ AnnouncementItem : "has"
    Service ||--o{ LiveTimeAdjustment : "tracks"

    %% Event hierarchy
    Event ||--o{ EventDay : "has"
    Event ||--o{ Session : "has"
    Event ||--o{ AnnouncementItem : "has"

    %% Session children
    Session ||--o{ Segment : "contains"
    Session ||--o{ PreSessionDetails : "has"
    Session ||--o{ StreamBlock : "has"
    Session ||--o{ HospitalityTask : "has"
    Session ||--o{ LiveDirectorActionLog : "logs"

    %% Segment hierarchy (self-referential)
    Segment ||--o{ Segment : "sub-assigns"
    Segment ||--o{ SegmentAction : "triggers"
    Segment ||--o{ SpeakerSubmissionVersion : "receives"
    Segment ||--o{ ArtsSubmissionLog : "tracks"

    %% Live director
    Session }o--|| User : "directed by"
    LiveDirectorActionLog }o--|| User : "performed by"
    LiveDirectorActionLog }o--o| Segment : "affects"

    %% User subscriptions
    User ||--o{ PushSubscription : "subscribes"
```

## Relationship Summary

| Relationship | Type | Description |
|---|---|---|
| Service → Session | One-to-Many | A service has multiple time-slot sessions |
| Service → Segment | One-to-Many | Segments are scoped to a service |
| Service → AnnouncementItem | One-to-Many | Announcements displayed in a service |
| Service → LiveTimeAdjustment | One-to-Many | Real-time timing adjustments |
| Event → EventDay | One-to-Many | Multi-day events composed of days |
| Event → Session | One-to-Many | Event sessions (alternative to service sessions) |
| Event → AnnouncementItem | One-to-Many | Announcements for events |
| Session → Segment | One-to-Many | Program items within a session |
| Session → PreSessionDetails | One-to-Many | Setup details before session |
| Session → StreamBlock | One-to-Many | Video/stream management blocks |
| Session → HospitalityTask | One-to-Many | Operational tasks per session |
| Session → LiveDirectorActionLog | One-to-Many | Audit trail of director actions |
| Segment → Segment | Self-referential | Sub-assignments (child segments) |
| Segment → SegmentAction | One-to-Many | Tasks triggered by a segment |
| Segment → SpeakerSubmissionVersion | One-to-Many | Versioned speaker content |
| Segment → ArtsSubmissionLog | One-to-Many | Arts/media submission tracking |
| User → PushSubscription | One-to-Many | Browser push notification subscriptions |
| User → Session | One-to-Many | Live director ownership of session |
| User → LiveDirectorActionLog | One-to-Many | Actions performed by user |

## Notable Design Notes

- **Dual-parent Sessions**: A `Session` can belong to either a `Service` OR an `Event` (nullable FKs)
- **Denormalized Songs**: `Segment` stores up to 6 songs as flat fields (`song_1_title`…`song_6_title`) rather than a separate Song entity
- **Embedded JSON**: `Segment` embeds `segment_actions`, `ui_fields`, and `ui_sub_assignments` as JSON columns alongside the normalized `SegmentAction` entity
- **Cache Layer**: `ActiveProgramCache` pre-computes full program snapshots for fast display loading — not a source-of-truth entity
- **Self-Referential Segments**: `parent_segment_id` enables nested sub-assignments (e.g., Ministración items under a parent segment)
