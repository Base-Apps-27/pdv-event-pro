# PDV Event Pro — Architecture Overview

**Version:** 2026-02-12  
**Platform:** Base44 (React + Tailwind + TypeScript runtime)  
**Runtime:** Browser SPA (no SSR, no Node APIs in frontend)

---

## 1. System Purpose

PDV Event Pro is a bilingual (EN/ES) church event and service management platform. It handles:

- **Weekly Sunday Services** — 2 time-slot (9:30 AM / 11:30 AM) program planning with auto-save
- **Special Events** — Multi-day conferences with sessions, segments, breakout rooms, and live director control
- **PDF Generation** — Branded program/announcement PDFs via pdfmake (client-side)
- **Live Operations** — Real-time chat, live timing adjustments, director console with hold/cascade
- **Public Program View** — Anonymous-accessible program display with countdown and notifications

---

## 2. File Structure

```
entities/          → JSON schemas (data model definitions)
pages/             → Top-level route components (FLAT, no subfolders)
components/        → Reusable UI components (subfolders allowed)
  ├── docs/        → Architecture documentation (this file)
  ├── event/       → Event-specific components (calendar, edit, duplicate)
  ├── session/     → Session/segment form components
  ├── service/     → Service builders, PDF generators, live view
  ├── report/      → Report view components (detailed, projection, sound, etc.)
  ├── live/        → Live operations chat, typing indicator
  ├── director/    → Director console components (timeline, drift, hold)
  ├── announcements/ → Announcement management
  ├── print/       → Print CSS and settings
  ├── shared/      → Cross-cutting components (AnimatedSortableItem)
  ├── testing/     → In-browser test framework and test suites
  ├── ui/          → shadcn/ui primitives (button, card, badge, etc.)
  └── utils/       → Utilities (i18n, permissions, timeFormat, queryKeys, etc.)
functions/         → Backend Deno Deploy handlers (external API integration)
agents/            → AI agent configurations
Layout.js          → App shell with sidebar navigation
globals.css        → Brand colors, fonts, print styles
```

---

## 3. Entity Architecture

### Core Hierarchy
```
Event (1) ──→ EventDay (N) ──→ (date grouping)
Event (1) ──→ Session (N)  ──→ Segment (N)
                               └── SegmentAction (embedded array)
                               └── Breakout rooms (embedded array)
```

### Weekly Services (Flat Structure)
```
Service (1) ──→ Embedded segments in "9:30am" / "11:30am" arrays
             ──→ Team assignments (coordinators, ujieres, sound, luces, fotografia)
             ──→ Selected announcements (ID references)
```

### Custom Services (Hybrid)
```
Service (1) ──→ Embedded segments[] array
             ──→ Synced to Session + Segment entities via sessionSync.js
```

### Support Entities
- **AnnouncementItem** / **AnnouncementSeries** — announcement content + scheduling
- **Person** — member directory for events
- **SuggestionItem** — autocomplete cache for names/titles
- **Room** — physical spaces with tech capabilities
- **Permission** / **RoleTemplate** — RBAC definitions
- **EditActionLog** — audit trail for entity changes
- **LiveTimeAdjustment** / **TimeAdjustmentLog** — live timing changes
- **LiveDirectorActionLog** — director console audit trail
- **LiveOperationsMessage** — real-time operations chat
- **SpeakerSubmissionVersion** — versioned speaker content submissions
- **Decision** / **AttemptLog** — project memory (internal, never in UI)

---

## 4. Authentication & Authorization

- **Auth:** Managed by Base44 platform (login/logout handled externally)
- **Public routes:** `PublicProgramView`, `PublicCountdownDisplay` — no auth required
- **Private routes:** All others — redirected to login if unauthenticated
- **RBAC:** Permission-based via `components/utils/permissions.js`
  - Roles: Admin, AdmAsst, LiveManager, EventDayCoordinator, EventDayViewer
  - Custom permission grants/revokes per user
  - Layout sidebar hides nav items based on permissions

---

## 5. Data Flow Patterns

### Read: React Query
- All data fetching uses `@tanstack/react-query`
- Query keys centralized in `components/utils/queryKeys.js`
- Segment invalidation uses predicate-based matching (catches all key patterns)
- Phase 7: staleTime added to reduce redundant refetches (5-10 min depending on entity)

### Write: Base44 SDK
- `base44.entities.EntityName.create/update/delete()`
- Mutations invalidate relevant query keys on success
- WeeklyServiceManager uses auto-save with 3-second debounce
- Phase 5: Optimistic locking via `useStaleGuard` hook (compares `updated_date`)

### Real-time: Subscriptions
- `base44.entities.EntityName.subscribe()` for live updates
- Used in LiveOperationsChat, PublicProgramView

---

## 6. PDF Generation Architecture

**Single library:** `pdfmake` (client-side, no server round-trips)

Three generators share brand constants from `pdfUtils.js`:
1. **generateProgramPDFWithAutoFit** — Custom service programs (with caching)
2. **generateWeeklyProgramPDF** — 2-column Sunday service programs
3. **generateAnnouncementsPDF** — 2-column announcement layouts

All use heuristic content-density scaling to auto-fit content on a single page.

See `components/docs/PDF_GENERATION_ARCHITECTURE.md` for details.

---

## 7. Internationalization (i18n)

- **Dictionary:** `components/utils/i18n.jsx` (~1000 keys, ES + EN)
- **Hook:** `useLanguage()` returns `{ language, setLanguage, t }`
- **Persistence:** localStorage + user profile (`ui_language` field)
- **Coverage:** All user-facing pages internationalized (Phase 6)
- **Convention:** Use `t('key')` for dictionary keys, `language === 'es' ? ... : ...` for inline ternaries

---

## 8. Performance Optimizations (Phase 7)

- **React.memo:** Applied to high-frequency UI primitives (Card, Badge, Button)
- **Query staleTime:** 5-10 min on stable entities (events, rooms, templates, people)
- **PDF caching:** localStorage-based with 48h TTL and content hash keys
- **Lazy loading:** Infrastructure created (`components/utils/lazyPages.js`) — deferred pending bundle analysis

---

## 9. Testing Strategy

- **In-browser test runner:** `components/testing/TestRunner.js` (describe/it/expect)
- **Unit test suites:** 9 suites covering utilities (timeFormat, permissions, segmentData, etc.)
- **Automated health checks:** API connectivity, schema integrity, data integrity, auth
- **Manual QA checklist:** 12 scenarios with step-by-step instructions
- **Test dashboard:** `pages/TestDashboard` — unified view of all test types

---

## 10. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| pdfmake over jsPDF/@react-pdf | Better table support, brand theming, no server needed |
| Embedded segments in Service | Weekly services need atomic save (all segments in one record) |
| Session/Segment entities for events | Events need per-segment CRUD, reordering, live timing |
| Optimistic locking over pessimistic | Simpler, no orphan locks, acceptable for collaborative editing |
| In-browser tests over Vitest | Base44 runtime blocks Vitest; this is the approved alternative |
| safeLocalStorage wrapper | Prevents crashes from QuotaExceeded/SecurityError in private browsing |

---

## 11. Backend Functions

All in `functions/` directory. Key functions:
- **updateLiveSegmentTiming** — Live director timing mutations
- **getPublicProgramData** — Public program data API
- **processNewSubmissionVersion** — Speaker content processing
- **refreshSuggestions** — Autocomplete cache refresh
- **sendChatNotification** — Live ops chat notifications
- **generateEventReportsPdf** — Server-side event PDF generation
- **fetchUrlMetadata** — URL metadata extraction for resource links