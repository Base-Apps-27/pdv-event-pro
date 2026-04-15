# PDV Event Pro — Entity Reference Guide

**Version:** 2026-02-12

---

## Built-in Entity

### User (platform-managed)
Built-in fields (immutable): `id`, `created_date`, `full_name`, `email`, `role`

Custom fields added:
- `app_role` — Application role (Admin, AdmAsst, LiveManager, EventDayCoordinator, EventDayViewer)
- `display_name` — Editable display name (overrides full_name in UI)
- `custom_permissions` — Array of additional permission keys
- `revoked_permissions` — Array of revoked permission keys
- `ui_language` — Preferred UI language (es/en)

---

## Core Event Hierarchy

### Event
The top-level container for multi-day conferences/retreats.
- **Key fields:** name, slug, year, theme, location, start_date, end_date, status, print_color
- **Status lifecycle:** planning → confirmed → in_progress → completed → archived
- **Template support:** status="template" marks reusable templates
- **Announcement integration:** promote_in_announcements, promotion_start/end_date, announcement_blurb

### EventDay
Groups sessions by date within an event.
- **Key fields:** event_id, date, day_label

### Session
A time block within an event (e.g., "Saturday Morning Session").
- **Key fields:** event_id, service_id, name, date, planned_start/end_time, order
- **Team assignments:** admin_team, coordinators, sound_team, tech_team, ushers_team, translation_team, hospitality_team, photography_team, worship_leader
- **Live control:** live_adjustment_enabled, live_director_user_id/name, live_director_started_at
- **Color coding:** session_color (green/blue/pink/orange/yellow/purple/red)

### Segment
An individual program element within a session (worship set, message, break, etc.).
- **Key fields:** session_id, title, segment_type, order, start_time, duration_min, end_time, presenter
- **Types:** Alabanza, Bienvenida, Ofrenda, Plenaria, Video, Anuncio, Dinámica, Break, TechOnly, Oración, Especial, Cierre, MC, Ministración, Receso, Almuerzo, Artes, Breakout, Panel
- **Worship fields:** number_of_songs, song_1-6_title/lead/key
- **Message fields:** message_title, scripture_references, parsed_verse_data, submitted_content
- **Arts fields:** art_types[], drama/dance song/mic/cue fields
- **Breakout fields:** breakout_rooms[] with room_id, hosts, speakers, topic
- **Panel fields:** panel_moderators, panel_panelists
- **Team notes:** projection_notes, sound_notes, ushers_notes, translation_notes, stage_decor_notes
- **Visibility toggles:** show_in_general, show_in_projection, show_in_sound, show_in_ushers
- **Live timing:** actual_start/end_time, is_live_adjusted, timing_source, live_status, live_hold_status
- **Embedded actions:** segment_actions[] with label, department, timing, offset_min, is_prep, notes

---

## Weekly/Custom Services

### Service
Represents a recurring or one-off service.
- **Key fields:** name, day_of_week, date, time, location, status
- **Weekly segments:** Embedded in `9:30am` and `11:30am` arrays (each segment has type, title, duration, data{}, songs[], actions[], sub_assignments[])
- **Custom segments:** Embedded in `segments` array
- **Team assignments:** coordinators, ujieres, sound, luces, fotografia (objects with time-slot keys)
- **Print settings:** print_settings_page1/page2 (globalScale, margins, fontScales)
- **Blueprint:** status="blueprint" marks the template for weekly services

---

## Announcements

### AnnouncementItem
Individual announcement content.
- **Key fields:** title, content, instructions, priority, date_of_occurrence, category
- **Categories:** General, Event, Ministry, Urgent
- **Targeting:** target_service_types[], target_event_ids[]
- **Flags:** is_active, has_video, emphasize

### AnnouncementSeries
Ordered collection of announcements with dynamic event inclusion.
- **Key fields:** name, fixed_announcement_ids[], include_dynamic_events, max_dynamic_events
- **Sorting:** sort_strategy (FixedFirst/DynamicFirst)

---

## Live Operations

### LiveTimeAdjustment
Time offset applied to a service or session.
- **Key fields:** date, adjustment_type, offset_minutes, authorized_by
- **Types:** time_slot (weekly), global (custom), session (event)

### LiveDirectorActionLog
Audit trail for Live Director Console actions.
- **Key fields:** session_id, segment_id, action_type, performed_by_user_id
- **Actions:** toggle_live_mode, acquire/release_lock, place/finalize_hold, mark_ended, set_time, apply_cascade, skip/shift_segment, allocate_time, undo

### LiveOperationsMessage
Real-time chat messages for live coordination.
- **Key fields:** context_type (event/service), context_id, message, image_url, created_by_name
- **Features:** is_pinned, is_archived, is_director_ping, reactions[], edited_at

---

## Support Entities

### Person — Member directory (first_name, last_name, email, phone, network, etc.)
### SuggestionItem — Autocomplete cache (type, value, use_count)
### Room — Physical spaces (name, capacity, has_projection/sound_system/translation_feed)
### Permission — RBAC definitions (key, resource, action, category)
### RoleTemplate — Role presets (name, default_permissions[])
### SegmentTemplate — Reusable segment configs (type, default duration/notes/visibility)
### EditActionLog — Change audit trail (entity_type, entity_id, action_type, field_changes)
### TimeAdjustmentLog — Time change audit (date, service_id, previous/new_offset)
### SpeakerSubmissionVersion — Versioned speaker content (segment_id, content, parsed_data_snapshot)
### PublicFormIdempotency — Prevents duplicate form submissions
### PreSessionDetails — Pre-session logistics (registration_desk_open_time, facility_notes)
### HospitalityTask — Session-level hospitality tasks

---

## Internal-Only Entities (Never in User UI)

### Decision — Architectural decision records
### AttemptLog — Technical approach audit trail

---

## Asset/Media Entities

### Asset — Generic assets (countdown videos, backgrounds)
### SlidePack / SlidePackAsset — Projection slide collections
### MusicProfile — Ambient music configurations
### TranslationConfig — Translation settings
### CrewCallBlock / CrewCallSession — Crew scheduling