# PDV Event Pro - Comprehensive Feature & Code Quality Review

**Date:** 2026-02-12
**Scope:** Full application review covering architecture, features, code quality, security, and recommendations

---

## 1. Executive Summary

PDV Event Pro is a bilingual (ES/EN) church event and service management platform built with React 18, Vite, React Query, Radix/shadcn UI, and the Base44 SDK backend. It manages the full lifecycle of events and weekly services: planning, segment editing, live coordination, PDF generation, and public display.

The app is **functional and feature-rich** with 37+ pages, 25 entities, 5 RBAC roles, real-time live operations, and client-side PDF generation. The architecture shows intentional phase-based improvement (Phases 1-7 referenced in comments), and the codebase has clear separation of concerns. However, there are notable areas where security, performance, maintainability, and UX can be improved.

**Overall Assessment: 7/10** - Solid foundation with real production usage, but meaningful gaps in security hardening, component decomposition, error handling completeness, and testing.

---

## 2. Feature-by-Feature Assessment

### 2.1 Dashboard (`src/pages/Dashboard.jsx`)
**Rating: 7/10**

**What works well:**
- Clean hero section with brand gradient
- Smart timezone-aware date calculation (America/New_York via `Intl.DateTimeFormat`)
- Quick action cards for the three main workflows (weekly services, custom services, events)
- Localized date formatting with date-fns locale support
- Proper staleTime on queries (5 min)

**Issues & improvements needed:**
- **Session count is computed in the render loop** (lines 231-236): `sessions.filter(s => s.event_id === event.id)` is called twice per event card (once for count check, once for display). Should use `useMemo` to pre-compute a map of `eventId -> sessionCount`.
- **Fetches ALL sessions globally** (line 35): `base44.entities.Session.list()` loads every session in the system just to count sessions per event. This doesn't scale. Should use a grouped query or fetch session counts per event.
- **No empty state differentiation**: When loading completes with zero events, the UI doesn't distinguish between "you have no events" and "there was an error fetching events."
- **`gradientStyle` is duplicated** across Dashboard, Layout, WeeklyServiceManager, Events, and PublicProgramView. Should be a shared constant.
- **No event search or filtering**: As the event list grows, users have no way to search or filter.

---

### 2.2 Events Management (`src/pages/Events.jsx`)
**Rating: 7/10**

**What works well:**
- Full CRUD with create, edit, duplicate, and delete
- Permission-gated actions (`hasPermission` checks)
- Template selector for creating from templates
- Field origin tracking (manual vs auto-generated)
- Separated dialog components (DeleteEventDialog, DuplicateEventDialog, TemplateSelectorDialog)

**Issues & improvements needed:**
- **Missing `onError` on create/update mutations** (lines 58-74): If event creation fails, the user gets no feedback. Only the delete mutation has error handling.
- **User fetch duplicated** (lines 41-47): The `fetchUser` pattern via `base44.auth.me()` is repeated in almost every page component. This should be a shared hook or pulled from AuthContext.
- **No pagination or virtual scrolling**: All events are loaded at once. Will not scale well beyond ~100 events.
- **No sorting or filtering UI**: Events are sorted by year from the API, but users can't sort by status, date, or name.

---

### 2.3 Event Detail & Session Management (`src/pages/EventDetail.jsx`, `src/components/event/SessionManager.jsx`)
**Rating: 7.5/10**

**What works well:**
- Deep hierarchical model: Event -> Sessions -> Segments with clear data flow
- Session-level team assignments (admin, sound, tech, ushers, translation, hospitality, photography)
- Edit action logging with audit trail
- Drag-and-drop segment reordering
- Session color coding for visual organization

**Issues & improvements needed:**
- **SessionManager is 987 lines**: This is the primary complexity hub and should be decomposed further into session CRUD, segment list, and team assignment sub-components.
- **SDK mutation concern** (EventDetail.jsx line 77): A comment warns about the SDK mutating returned objects. This is worked around with `JSON.parse(JSON.stringify())` deep clones, which is fragile and slow for large objects. Should use `structuredClone()` or a library.

---

### 2.4 Weekly Service Manager (`src/pages/WeeklyServiceManager.jsx`)
**Rating: 8/10**

**What works well:**
- Well-decomposed: handlers extracted to `useWeeklyServiceHandlers`, dialogs to `WeeklyServiceDialogs`, blueprint to `weeklyBlueprint.js`
- Auto-save with 1-second debounce
- Concurrent editing detection via `useStaleGuard`
- Local backup recovery from localStorage with user prompt
- Blueprint system allows resetting to template defaults
- Date picker restricted to Sundays only
- Copy functionality between 9:30am and 11:30am time slots

**Issues & improvements needed:**
- **27 useState declarations in one component** (lines 67-104): Even after Phase 3A extraction, the orchestrator has too much state. Consider grouping related state into reducers or state objects.
- **Auto-save is last-write-wins** (line 425 comment): Acknowledged by design, but could cause data loss when two users edit simultaneously. The stale guard only protects manual saves.
- **`mergeSegmentsWithBlueprint` is complex** (lines 243-301): This 60-line function in a useEffect handles segment/blueprint merging with multiple fallback strategies. It should be extracted to a pure utility function with unit tests.
- **Hardcoded Spanish strings** (lines 329, 434, 472): Despite having i18n, some strings like "Servicios Dominicales" and "Fecha del Domingo" are hardcoded in Spanish.

---

### 2.5 Custom Service Builder (`src/pages/CustomServiceBuilder.jsx`)
**Rating: 7/10**

**What works well:**
- Flexible segment editor for non-weekly services
- Reuses many of the same components as the weekly builder
- Print and PDF support

**Issues & improvements needed:**
- **~600+ lines**: Could benefit from the same decomposition treatment the weekly manager received in Phase 3A.
- **Shares concept but not code with WeeklyServiceManager**: The two builders have overlapping but divergent segment handling. A unified segment editing abstraction would reduce maintenance burden.

---

### 2.6 Public Program View (`src/pages/PublicProgramView.jsx`)
**Rating: 6.5/10**

**What works well:**
- Serves as both authenticated live view and public-facing schedule
- Switches between service view and event view
- Real-time current time tracking (1-second interval)
- Integration with live operations chat
- Verse modal, time adjustment modal, and history modal

**Issues & improvements needed:**
- **1,078 lines**: The largest page component. Handles too many responsibilities: view type switching, event/service selection, modals, live updates, verse parsing, time adjustments, and chat.
- **`new URLSearchParams(window.location.search)` on every render** (line 48): Should use `useSearchParams` from React Router instead.
- **1-second interval for current time** (line 88): This causes the entire component tree to re-render every second. Should be isolated to a small `<Clock>` component or use `requestAnimationFrame` for countdown-only rendering.
- **URL params read outside React lifecycle**: `preloadedSlug`, `preloadedEventId`, etc. are read once on mount but not reactive to URL changes.

---

### 2.7 Director Console (`src/pages/DirectorConsole.jsx`)
**Rating: 7.5/10**

**What works well:**
- Live segment control with hold/finalize/cascade actions
- Director timeline visualization
- Drift indicator for timing deviations
- Ping feed for real-time event coordination
- Proper WebSocket subscription for live updates

**Issues & improvements needed:**
- **TODO items in DirectorHoldPanel** (lines 139, 141): `next_major_break_end_time` and `time_bank_min` are stubbed with null/0. These are important for live directing.
- **Direct DOM manipulation** (line 377): Uses `document.getElementById` for scroll navigation instead of React refs.

---

### 2.8 Reports System (`src/pages/Reports.jsx`, `src/components/report/`)
**Rating: 7/10**

**What works well:**
- Multiple specialized report views: Detailed, General, Projection, Sound, Ushers, Hospitality
- Each report shows only the fields relevant to that team
- Print-friendly layouts

**Issues & improvements needed:**
- **No report export to CSV/Excel**: Only PDF export exists. Team coordinators often want spreadsheet data.
- **No date range filtering**: Reports are per-event, not across events.
- **No aggregate statistics**: No charts or summary views across multiple events/services.

---

### 2.9 PDF Generation System (`src/components/service/generateProgramPDF.jsx`, `pdf/`)
**Rating: 7.5/10**

**What works well:**
- Client-side PDF generation with pdfmake
- Brand-aware theme system (colors, fonts, logos)
- Multiple layout types per segment type
- Configurable print settings (margins, font scales)
- PDF caching in localStorage

**Issues & improvements needed:**
- **Bundle size**: pdfmake is ~2MB uncompressed. Should be dynamically imported.
- **PDF cache in localStorage** has no expiry or cleanup routine (identified in tech debt doc).
- **Three PDF libraries in dependencies**: pdfmake, jspdf, and @react-pdf/renderer. Should consolidate to one.

---

### 2.10 Live Operations & Real-Time Features
**Rating: 7.5/10**

**What works well:**
- WebSocket subscriptions via Base44 SDK for real-time updates
- Live operations chat with typing indicators and read markers
- Live time adjustments with audit trail
- Segment status tracking (pending, active, completed)
- Director console for live event control

**Issues & improvements needed:**
- **LiveOperationsChat is 1,011 lines**: Needs decomposition into message list, input, typing indicator, and connection management sub-components.
- **Subscription cleanup audit needed**: The tech debt doc flags this. Verify all `subscribe()` calls return cleanup functions that are properly called.
- **No offline resilience**: If connection drops mid-event, there's no queuing or retry for chat messages.
- **No presence indicators**: Users can't see who else is currently viewing/editing.

---

### 2.11 People/Team Management (`src/pages/People.jsx`)
**Rating: 6/10**

**What works well:**
- Person directory with role/department assignments
- Autocomplete suggestions

**Issues & improvements needed:**
- **Minimal feature set**: No person profiles, no availability tracking, no schedule view per person.
- **No conflict detection**: When assigning people to segments, there's no check if they're already assigned elsewhere at the same time.
- **No contact information management**: No phone/email fields visible for coordination.

---

### 2.12 Rooms Management (`src/pages/Rooms.jsx`)
**Rating: 6/10**

**What works well:**
- Room directory with tech specs

**Issues & improvements needed:**
- **No room availability/conflict detection**: When assigning rooms to breakout sessions, there's no conflict check.
- **No room capacity tracking**: Would be useful for event planning.
- **No floor plan or visual room layout**.

---

### 2.13 Authentication & Authorization (`src/lib/AuthContext.jsx`, `src/components/utils/permissions.jsx`)
**Rating: 8/10**

**What works well:**
- Hierarchical permission system (view < edit < create < delete < manage)
- 5 well-defined role templates with clear boundaries
- Custom permissions per user that override role defaults
- Permission-gated sidebar navigation
- Public routes properly excluded from auth checks

**Issues & improvements needed:**
- **User fetched independently in every page** instead of using AuthContext. Layout.jsx fetches user, but pages like Events.jsx, WeeklyServiceManager.jsx, People.jsx etc. all call `base44.auth.me()` separately. This causes redundant API calls and inconsistent auth state.
- **No null checks on error response parsing** (AuthContext.jsx): `appError.data.extra_data.reason` can throw if the error shape differs.
- **No token refresh mechanism**: If the token expires mid-session, the user gets a hard redirect instead of a graceful re-auth flow.

---

### 2.14 Internationalization (`src/components/utils/i18n.jsx`)
**Rating: 7.5/10**

**What works well:**
- ~1,000+ translation keys covering most UI text
- Context-based `useLanguage()` hook
- Fallback to English if key missing
- Language preference persisted

**Issues & improvements needed:**
- **Hardcoded Spanish strings still exist**: Multiple components have untranslated text (e.g., "Servicios Dominicales", "Cargando...", "Error al guardar").
- **No pluralization support**: All translations are singular forms.
- **Translation file is 1,038 lines in a single JSX file**: Should be split into separate JSON files per locale for maintainability and potential future integration with translation management tools.

---

### 2.15 Schedule Importer (`src/pages/ScheduleImporter.jsx`)
**Rating: 7/10**

**What works well:**
- AI-powered schedule import from text/spreadsheet data
- LLM integration for parsing unstructured schedule data
- Review step before committing imported data

**Issues & improvements needed:**
- **735 lines**: Should be decomposed.
- **LLM response parsing** (lines ~456-462): JSON parsing from LLM output without robust error handling for malformed responses.
- **No import history or undo**: Once imported, there's no way to roll back.

---

## 3. Cross-Cutting Quality Issues

### 3.1 Security Vulnerabilities

| Severity | Issue | Location |
|----------|-------|----------|
| **HIGH** | XSS via regex-based HTML sanitization (bypassable) | `WeeklyAnnouncementSection.jsx:233`, `AnnouncementListSelector.jsx:131,186`, `PrintSettingsModal.jsx:193` |
| **HIGH** | Direct `innerHTML` assignment from user content | `StaticAnnouncementForm.jsx:22,33` |
| **MEDIUM** | Auth tokens stored in localStorage (accessible via XSS) | `app-params.js` |
| **LOW** | Console statements in production code | Multiple files |

**Recommendation:** Install and use `DOMPurify` for all HTML sanitization. Replace all `dangerouslySetInnerHTML` with regex-based filters with DOMPurify.

### 3.2 Performance Issues

| Issue | Impact | Location |
|-------|--------|----------|
| 1-second `setInterval` causing full tree re-renders | High CPU on live views | `PublicProgramView.jsx:88`, `DirectorConsole.jsx:91` |
| Global session fetch on Dashboard | Unnecessary data transfer | `Dashboard.jsx:35` |
| pdfmake loaded eagerly (~2MB) | Slow initial bundle | `generateProgramPDF.jsx` |
| JSON.stringify for change detection | O(n) on every render cycle | `WeeklyServiceManager.jsx:386,429` |
| Three PDF libraries in bundle | Redundant bundle weight | `package.json` |
| No `React.memo` on list item components | Unnecessary re-renders on large lists | Multiple segment lists |

### 3.3 Architecture Issues

| Issue | Impact |
|-------|--------|
| **Duplicated user fetch** in every page via `base44.auth.me()` | Redundant API calls, inconsistent auth state. Should use AuthContext or a shared `useCurrentUser()` hook. |
| **`gradientStyle` duplicated** in 5+ components | Maintenance burden. Should be a shared constant or CSS class. |
| **No shared hook for common patterns** | Each page reinvents user fetch, event fetch, permission checks. |
| **Mixed form patterns** | Some forms use React Hook Form + Zod, others use raw useState. Should standardize. |
| **27 components over 500 lines** | Hard to maintain, test, and review. Decomposition needed. |

### 3.4 Testing

| Issue | Impact |
|-------|--------|
| **No unit tests** | Cannot verify business logic in isolation |
| **No integration tests** | Cannot verify component interactions |
| **In-browser test runner only** | Not CI/CD compatible |
| **No test coverage metrics** | No visibility into tested vs untested code |

The existing `TestDashboard` and `testing/` directory provide a manual in-browser test framework, but this is insufficient for a production application of this complexity.

---

## 4. Prioritized Recommendations

### P0 - Critical (Security & Data Integrity)

1. **Fix XSS vulnerabilities**: Replace all regex-based HTML sanitization with DOMPurify across `WeeklyAnnouncementSection`, `AnnouncementListSelector`, `PrintSettingsModal`, and `StaticAnnouncementForm`.

2. **Add `onError` handlers to ALL mutations**: Currently ~50% of mutations silently swallow errors. Users need feedback when operations fail. Audit every `useMutation` call and add toast-based error handling.

3. **Consolidate user authentication into a shared hook**: Create `useCurrentUser()` that reads from AuthContext instead of calling `base44.auth.me()` in every page. This eliminates ~15 redundant auth API calls per navigation.

### P1 - High Priority (Performance & UX)

4. **Isolate timer re-renders**: The 1-second `setInterval` in `PublicProgramView` and `DirectorConsole` should update a small isolated `<Clock>` component, not trigger re-renders of the entire page tree.

5. **Lazy-load PDF generation**: Use `React.lazy()` or dynamic `import()` for pdfmake. Most users don't generate PDFs on every page load. This reduces the initial bundle by ~2MB.

6. **Decompose large components**: Start with `PublicProgramView.jsx` (1,078 lines), `LiveOperationsChat.jsx` (1,011 lines), and `SessionManager.jsx` (987 lines). Extract into focused sub-components.

7. **Add search and filtering to Events page**: As the event list grows, users need to search by name, filter by status, and sort by date.

### P2 - Medium Priority (Maintainability)

8. **Extract shared constants**: `gradientStyle`, `tealStyle`, brand colors, and status color maps are duplicated across 5+ files. Create a `src/constants/brand.js` file.

9. **Standardize form patterns**: Pick one approach (React Hook Form + Zod OR controlled useState) and apply consistently. Currently both patterns coexist, increasing cognitive load.

10. **Add localStorage cleanup routine**: The tech debt doc identifies this. PDF caches and service backups accumulate without expiry. Add a 30-day cleanup on app load.

11. **Consolidate to one PDF library**: Three PDF libraries (pdfmake, jspdf, @react-pdf/renderer) are in dependencies. Pick pdfmake and remove the others.

12. **Complete i18n coverage**: Audit for remaining hardcoded Spanish strings and add them to the translation system.

### P3 - Low Priority (Future Enhancements)

13. **Add person conflict detection**: When assigning people to overlapping segments, warn the user.

14. **Add room availability checking**: Prevent double-booking rooms for breakout sessions.

15. **Add CSV/Excel export for reports**: Team coordinators need spreadsheet data, not just PDFs.

16. **Add proper test infrastructure**: Set up Vitest + React Testing Library for unit/integration tests. Start with critical business logic (normalizeProgram, permissions, segment validation).

17. **Implement dark mode**: The infrastructure exists (`useTheme`, `next-themes`) but is forced to light mode. Complete the dark mode implementation.

18. **Add offline resilience**: Queue chat messages and form saves when connection drops, replay on reconnect.

---

## 5. What's Done Well

Despite the issues, the application demonstrates strong engineering judgment in several areas:

- **Phase-based improvement approach**: The codebase shows disciplined incremental improvement (Phase 1: Stability, Phase 2: Foundation, Phase 3: Decomposition, Phase 5: Concurrent editing, Phase 7: Performance). This is pragmatic and sustainable.
- **Segment normalization adapter** (`normalizeProgram.jsx`): A well-documented canonical translation layer that handles three different data shapes. The extensive header comments explain the "why" clearly.
- **Query key architecture** (`queryKeys.jsx`): Thoughtful design that avoids N+1 queries for segments by using event-level canonical cache keys.
- **Stale guard for concurrent editing** (`useStaleGuard.jsx`): Simple but effective optimistic locking without polling overhead.
- **Safe localStorage wrapper** (`safeLocalStorage.jsx`): Defensive coding that prevents crashes from quota exceeded, private mode, or corrupt data.
- **Hierarchical permission system** (`permissions.jsx`): Clean design where `edit` implies `view`, reducing permission assignment complexity.
- **Bilingual support**: ~1,000+ translation keys is substantial coverage for a domain-specific app.
- **Edit action logging**: Comprehensive audit trail for all entity changes.
- **Local backup recovery**: The weekly service manager's localStorage backup with "restore from browser" prompt is a thoughtful data loss prevention feature.

---

## 6. Summary

PDV Event Pro is a capable, production-grade application that serves its core purpose well: managing church events and weekly services with real-time coordination. The architecture is sound, the feature set is comprehensive, and the phased improvement approach shows engineering discipline.

The highest-impact improvements are:
1. **Security**: Fix XSS vulnerabilities (P0)
2. **Reliability**: Add mutation error handling everywhere (P0)
3. **Performance**: Isolate timer re-renders and lazy-load PDFs (P1)
4. **Maintainability**: Decompose large components and consolidate patterns (P1-P2)
5. **Quality**: Add automated testing infrastructure (P3)

These changes would move the app from a solid 7/10 to an 8.5-9/10.
