# Pre-Event Comprehensive Audit (2026-03-09)
## Coordinator + Admin Systems | All Pages, Fields, Workflows, Scenarios

**Event Date:** Days Away  
**Audit Scope:** Every coordinator/admin page load, field interaction, data flow  
**Risk Tolerance:** Zero failures allowed  
**Audit Status:** LIVE CHECKLIST

---

## PART 1: CRITICAL PAGES & WORKFLOWS

### 1.1 Dashboard (pages/Dashboard)
- [ ] **Page loads without errors**
  - [ ] Auth check passes (user logged in)
  - [ ] No console errors
  - [ ] Sidebar renders
  - [ ] No broken images/icons
- [ ] **Stats cards display correctly**
  - [ ] Event count accurate
  - [ ] Service count accurate
  - [ ] User count accurate
  - [ ] Numbers update in real-time (if subscribed)
- [ ] **Navigation works**
  - [ ] All sidebar links navigate correctly
  - [ ] Current page highlighted
  - [ ] Mobile menu works (hamburger)
- [ ] **Responsive design**
  - [ ] Desktop (1920px): layout correct
  - [ ] Tablet (768px): sidebar collapses
  - [ ] Mobile (375px): touch targets ≥48px, readable text

---

### 1.2 Events Page (pages/Events)
- [ ] **List loads**
  - [ ] Events appear
  - [ ] Pagination works (if >20 events)
  - [ ] Search/filter works
  - [ ] Sort by year/name works
- [ ] **Create Event**
  - [ ] "New Event" button visible
  - [ ] Dialog opens without freezing
  - [ ] Form fields validate (name required, year is number)
  - [ ] Submit creates event, redirects to EventDetail
  - [ ] Toast shows success/error
- [ ] **Edit Event**
  - [ ] Click event row → EventDetail page loads
  - [ ] All event fields display correctly
  - [ ] Edit dialog opens
  - [ ] Changes persist
- [ ] **Delete Event**
  - [ ] Delete button appears (admin only)
  - [ ] Confirmation dialog required
  - [ ] Event removed from list after delete
- [ ] **Error scenarios**
  - [ ] Network down: show offline banner, don't crash
  - [ ] No events exist: show empty state, not blank page
  - [ ] Permission denied: show error, not blank

---

### 1.3 EventDetail (pages/EventDetail)
- [ ] **Event loads**
  - [ ] Event name, year, theme display
  - [ ] Breadcrumb "Events > {Name}" renders
  - [ ] Event metadata (status, origin) shows
- [ ] **Tabs work**
  - [ ] Info tab: event details, edit button works
  - [ ] Sessions tab: sessions list loads (see 1.4)
  - [ ] Calendar tab: visual calendar renders without lag
- [ ] **Action buttons**
  - [ ] "Reports" button: navigates to Reports page with eventId
  - [ ] "Edit" button: opens edit dialog
  - [ ] "History" button: shows edit history modal
  - [ ] "AI Assistant" button: opens helper (if enabled)
  - [ ] "More Actions" dropdown: TV Display, Speaker Form, Arts Form links work
- [ ] **Mobile view**
  - [ ] Action buttons stack vertically on mobile
  - [ ] Dropdown menu fits within viewport
- [ ] **Stale event recovery**
  - [ ] If user returns to old tab (event deleted): show 404 → auto-redirect to Events list

---

### 1.4 SessionManager (inside EventDetail Sessions tab)
- [ ] **Sessions list loads**
  - [ ] All sessions for event appear
  - [ ] Sorted by date → planned_start_time (DECISION-004 canonical sort)
  - [ ] Session cards show: date, time, room, name
- [ ] **Create Session**
  - [ ] "New Session" button works
  - [ ] Dialog opens (date picker, time picker, etc.)
  - [ ] Date validation: no past dates (or allow?)
  - [ ] Time validation: HH:MM format required
  - [ ] Submit creates session, reloads list
- [ ] **Edit Session**
  - [ ] Click session card → edit dialog opens
  - [ ] All fields editable: name, date, time, room, etc.
  - [ ] Changes persist immediately
  - [ ] No "unsaved changes" warning if field shows "Saving..."
- [ ] **Delete Session**
  - [ ] Delete button appears
  - [ ] Confirmation required
  - [ ] Session removed from list
  - [ ] Segment counts update (if displayed)
- [ ] **Segment management**
  - [ ] Click session → expand segments list
  - [ ] Add segment button works
  - [ ] Segment list sorts by order field
  - [ ] Edit/delete segment within session works
- [ ] **Error scenarios**
  - [ ] Duplicate session name: show validation error
  - [ ] Session in past: allow or warn?
  - [ ] Network timeout on save: show error toast, keep form open
  - [ ] Permission denied: show read-only UI

---

### 1.5 Weekly Service Manager (pages/WeeklyServiceManager)
- [ ] **Page loads**
  - [ ] Week selector shows (prev/next buttons, date range)
  - [ ] Day tabs appear (Mon-Sun)
  - [ ] Schedules load (Monday 9:30am, 11:30am, etc.)
- [ ] **Day navigation**
  - [ ] Click day tab → switches to that day's editor
  - [ ] Current day highlighted
  - [ ] All 7 days accessible
- [ ] **WeeklyEditorV2 loads (see 1.6)**
  - [ ] Per day
- [ ] **Announcements section** (if present)
  - [ ] Announcement selector loads
  - [ ] Add announcement works
  - [ ] Remove announcement works
  - [ ] Changes persist
- [ ] **Print settings**
  - [ ] Page scaling sliders work (Page 1, Page 2)
  - [ ] Font size controls work
  - [ ] Margins adjust
- [ ] **PDF generation**
  - [ ] "Print Program" button works
  - [ ] "Print Announcements" button works
  - [ ] PDFs contain correct data
  - [ ] No content cut off

---

### 1.6 WeeklyEditorV2 (component, inside WeeklyServiceManager)
**This is CRITICAL — lives and dies here.**

- [ ] **Empty day prompt** (if no service exists)
  - [ ] Shows clear message: "No service for this day"
  - [ ] "Create Service" button works
  - [ ] Creates Service entity + Session entities + Segments from blueprint
  - [ ] After creation, editor loads with full structure
- [ ] **Service loads**
  - [ ] Service entity found by (date, day_of_week)
  - [ ] Sessions load: 9:30am, 11:30am (or whatever configured)
  - [ ] Segments load per session
  - [ ] Child segments (Ministración under parent) load
- [ ] **Column rendering** (SlotColumnContainer)
  - [ ] 9:30am column renders with all segments
  - [ ] 11:30am column renders with all segments
  - [ ] Segments sorted by `order` field
  - [ ] No duplicate segments
  - [ ] No orphaned child segments
- [ ] **Segment fields** (per segment_type)
  - [ ] **Alabanza (Worship)**
    - [ ] `number_of_songs` field works (1-6)
    - [ ] Song fields (song_1_title, song_1_lead, song_1_key, etc.) render correctly
    - [ ] Song title editable
    - [ ] Song lead editable
    - [ ] Song key editable
  - [ ] **Plenaria (Message)**
    - [ ] `message_title` field works
    - [ ] `presenter` field works
    - [ ] `scripture_references` field works (with verse parser)
    - [ ] Verse parser dialog opens/closes correctly
    - [ ] Parsed verses save and display
  - [ ] **Video**
    - [ ] `video_name` field works
    - [ ] `video_length_sec` field works
    - [ ] `video_url` field works (URL validation?)
  - [ ] **Oración (Prayer), Cierre (Closing), etc.**
    - [ ] Duration field works
    - [ ] Presenter field works
- [ ] **Sub-assignments** (Ministración children)
  - [ ] Sub-assignment row renders under parent
  - [ ] Edit presenter name works
  - [ ] Save persists to child Segment entity
  - [ ] Create new child (if none exists) works
  - [ ] Delete child works
- [ ] **Duration field**
  - [ ] Click duration → edit field appears
  - [ ] Update duration → saves to `duration_min`
  - [ ] End time auto-calculates (start_time + duration_min)
- [ ] **Add segment (special segment dialog)**
  - [ ] "+" button opens dialog
  - [ ] Dialog has: title, duration, presenter, translator fields
  - [ ] Add button creates segment, reloads editor
  - [ ] Translation fields work (requires_translation, translation_mode, translator_name)
- [ ] **Reorder segments**
  - [ ] Drag segment to new position
  - [ ] Order field updates
  - [ ] Segments re-sort correctly
  - [ ] Persistence works (no accidental rollback)
- [ ] **Copy segment content**
  - [ ] "Copy to next slot" button works (9:30 → 11:30)
  - [ ] Content (presenter, scripture, songs, etc.) copies
  - [ ] Order field does NOT copy (next slot gets its own order)
- [ ] **Copy all to slot**
  - [ ] "Copy all segments from 9:30am to 11:30am" works
  - [ ] All segments + sub-assignments copy
  - [ ] Order renumbered for destination slot
- [ ] **Reset to blueprint**
  - [ ] "Reset" button appears (if blueprint exists)
  - [ ] Confirmation dialog required
  - [ ] Can reset per-session (9:30am only) or all sessions
  - [ ] Segments recreated from blueprint
  - [ ] Old segments removed
  - [ ] Sub-assignments restored
- [ ] **Verse parser**
  - [ ] Click verse parser icon → dialog opens
  - [ ] Paste content → regex + LLM parse verses
  - [ ] Verses display in two-column format (EN | ES)
  - [ ] Save button persists to `scripture_references` + `parsed_verse_data`
- [ ] **PDF generation**
  - [ ] "Print Program" button generates PDF
  - [ ] PDF shows both time slots
  - [ ] Segment details, presenter names, songs, scripture all included
  - [ ] Announcements PDF includes announcement text
- [ ] **Real-time sync**
  - [ ] If another admin edits same day: changes appear within 2 min (2-min poll)
  - [ ] No "another admin is editing" banner needed (removed per DECISION-003)
  - [ ] Stale cache detected + user notified (if >10 min old)
- [ ] **Error scenarios**
  - [ ] Network timeout on segment save: toast error, form stays open, dirty state preserved
  - [ ] Segment creation fails: show error, no duplicate segment created
  - [ ] Blueprint missing but button clicked: show error (blueprint not found)
  - [ ] Validation fails (negative duration, invalid type): show field error, don't save
- [ ] **Bilingual**
  - [ ] All field labels in English + Spanish
  - [ ] Language toggle works (top-right)
  - [ ] Spanish text doesn't overflow fields
- [ ] **Mobile responsiveness**
  - [ ] Columns stack vertically on mobile (<768px)
  - [ ] Segment cards readable on mobile
  - [ ] Edit fields work on mobile keyboard
  - [ ] Touch targets ≥48px

---

### 1.7 Reports (pages/Reports)
- [ ] **Page loads**
  - [ ] Event selector dropdown works
  - [ ] Default: most recent event auto-selected
  - [ ] Event selection persists in URL (?eventId=xxx)
- [ ] **Report tabs**
  - [ ] Detailed, General, Projection, Sound, Ushers, Hospitality, Livestream, Arts
  - [ ] Each tab shows relevant data for selected event
  - [ ] Tab switching doesn't reload page (instant)
- [ ] **Print/Export buttons**
  - [ ] "Print Current" → browser print dialog
  - [ ] "Print All" → renders all 8 reports, print dialog
  - [ ] "Export PDF (Current)" → downloads PDF
  - [ ] "Export PDF (All)" → downloads all 8 PDFs in sequence
  - [ ] "Export Arts PDF" → downloads arts-specific report
- [ ] **Data accuracy per report type**
  - [ ] **Detailed Program:** All sessions, segments, team assignments, notes
  - [ ] **General Program:** Session overview, segment list, timing
  - [ ] **Projection Report:** Projection notes, Scripture references, slide packs
  - [ ] **Sound Report:** Sound notes, song lists, technical specs
  - [ ] **Ushers Report:** Ushers notes, timing, logistics
  - [ ] **Hospitality Report:** Hospitality tasks, meal times, setup notes
  - [ ] **Livestream Report:** Livestream notes, StreamBlocks, technical setup
  - [ ] **Arts Report:** Art segments (dance, drama, video, spoken word), details
- [ ] **Session sort in reports**
  - [ ] Sessions sorted: date (ASC) → planned_start_time (ASC) → order (tiebreaker)
  - [ ] Matches EventDetail session sort (DECISION-004)
  - [ ] No duplicate sessions due to stale `order` field
- [ ] **Error scenarios**
  - [ ] No events exist: show empty state
  - [ ] Network timeout loading sessions: show error banner
  - [ ] PDF generation fails: show error toast, don't crash
  - [ ] Permission denied: show read-only UI

---

### 1.8 PublicProgramView (pages/PublicProgramView) [Coordinator View]
- [ ] **Page loads**
  - [ ] Service/event auto-detected or selector allows manual selection
  - [ ] Program data fresh-fetches (not cache snapshot per DECISION-006)
  - [ ] No stale data displayed
- [ ] **Live View display**
  - [ ] Current segment highlighted
  - [ ] Next segments listed
  - [ ] Coordinator actions (StickyOpsDeck) show with timing
  - [ ] Team assignments visible
- [ ] **Cache freshness indicator** (CacheStalenessIndicator)
  - [ ] Shows "Data updated 2 min ago"
  - [ ] Admin-only "Refresh" button visible
  - [ ] Color changes: green (fresh) → amber (10-30 min old) → red (≥30 min)
- [ ] **Ping Director feature** (if enabled)
  - [ ] Coordinator can send message to Live Director
  - [ ] Message appears in real-time
  - [ ] No lag >2 sec
- [ ] **Mobile view**
  - [ ] Readable on tablet (portrait)
  - [ ] Readable on phone (portrait)
  - [ ] Touch targets ≥48px

---

### 1.9 MyProgram (pages/MyProgram) [Coordinator Personal View]
- [ ] **Page loads**
  - [ ] Program auto-detected (current day's service)
  - [ ] Department filter works (Sound, Projection, Ushers, etc.)
  - [ ] Session picker works (if multi-session event)
- [ ] **Timeline displays**
  - [ ] Current segment highlighted
  - [ ] Next segment visible
  - [ ] Segment cards show: time, title, presenter, notes
  - [ ] Filtered by department (only show rows for their department)
- [ ] **Pre-session details** (if applicable)
  - [ ] Music profile shows
  - [ ] Slide pack shows
  - [ ] Registration desk open time shows
  - [ ] Facility notes show
- [ ] **Real-time updates**
  - [ ] If segment times updated elsewhere: MyProgram updates within 2 min
  - [ ] Cache staleness badge shows if data >5 min old
- [ ] **Mobile responsiveness**
  - [ ] Portrait: full-width timeline
  - [ ] Landscape: timeline readable
  - [ ] Department picker accessible on mobile

---

### 1.10 DirectorConsole (pages/DirectorConsole) [Live Director]
- [ ] **Page loads**
  - [ ] Session selected via URL param or auto-detected
  - [ ] Live adjustments UI appears
  - [ ] Segment timeline loads
- [ ] **Live timing adjustments**
  - [ ] Click segment → edit actual start/end time
  - [ ] Save → persists, broadcasts to other viewers
  - [ ] Mark segment as "skipped" / "shifted" → updates UI
  - [ ] Timeline recalculates downstream segment times
- [ ] **Coordinator chat**
  - [ ] Chat panel opens
  - [ ] Coordinators can see director's messages
  - [ ] Director can send messages
  - [ ] No lag >2 sec
- [ ] **Hold system** (if implemented)
  - [ ] Director can "hold" a segment
  - [ ] Hold state visible to coordinators
  - [ ] "Release hold" button works
- [ ] **Error scenarios**
  - [ ] Permission check: non-admins redirected
  - [ ] Session not found: show error
  - [ ] Network timeout on timing save: show error, retry option

---

## PART 2: DATA INTEGRITY & FLOWS

### 2.1 Speaker Submission → Display
- [ ] **Form submission (PublicSpeakerForm)**
  - [ ] Form loads without errors
  - [ ] All fields validate (content required if not slides-only)
  - [ ] URL fields reject non-http(s) URLs
  - [ ] Rate limiting allows legitimate submissions (5 per min per segment)
  - [ ] Honeypot field (hidden) works (bot submissions ignored)
  - [ ] Submit button shows loading state
  - [ ] Success toast + redirect
- [ ] **Backend processing (submitSpeakerContent)**
  - [ ] SpeakerSubmissionVersion created (audit trail)
  - [ ] Segment marked `submission_status: pending`
  - [ ] Idempotency key prevents duplicates
  - [ ] Entity automation triggers processNewSubmissionVersion
- [ ] **Verse parsing (processNewSubmissionVersion)**
  - [ ] Regex parses verses (fallback if LLM fails)
  - [ ] LLM extracts bilingual takeaways (EN + ES)
  - [ ] Verses stored as `scripture_references` + `parsed_verse_data`
  - [ ] Message title saved
  - [ ] Presentation URLs saved
- [ ] **Display in editor**
  - [ ] Coordinator opens Weekly/Event editor
  - [ ] Verses appear in segment (within 30 sec)
  - [ ] Takeaways visible (if LLM succeeded)
  - [ ] Slides-only toggle respected
- [ ] **Display in reports**
  - [ ] Reports page shows verses in Projection/Detailed reports
  - [ ] Scripture references formatted (EN | ES)
- [ ] **Error scenarios**
  - [ ] LLM timeout: fall back to regex verses
  - [ ] Cache not refreshed: LiveView shows fresh data anyway (fresh-fetch per DECISION-006)
  - [ ] MyProgram shows old data: within 2 min cache poll
  - [ ] Submission fails on save: idempotency prevents orphaned records

---

### 2.2 Arts Submission → Display
- [ ] **Form submission (PublicArtsForm)**
  - [ ] Form loads
  - [ ] Art type selector works (Dance, Drama, Video, Spoken Word, Painting, Other)
  - [ ] Type-specific fields render (song slots, costume colors, etc.)
  - [ ] Submit → art segment updated in backend
- [ ] **Display in reports**
  - [ ] Arts Report tab shows all art segments
  - [ ] Segment details: type, performers, songs, props, technical specs
  - [ ] Filter by session/day
- [ ] **Display in editor**
  - [ ] Art fields visible in segment card (if arts_type present)
- [ ] **Error scenarios**
  - [ ] Network timeout: form stays open, not cleared
  - [ ] Submission fails: retry option shown

---

### 2.3 Cache Freshness & Sync
- [ ] **ActiveProgramCache updates**
  - [ ] When segment updated: refreshActiveProgram triggers
  - [ ] Cache record refreshed within 30 sec
  - [ ] All subscribers notified (via subscription)
- [ ] **2-min safety net poll**
  - [ ] If subscription silent: 2-min poll catches stale data
  - [ ] TV Display reloads if data >10 min stale (watchdog)
- [ ] **Visibility-based refresh**
  - [ ] User switches to another tab: data stays in cache
  - [ ] User returns to app tab: cache invalidates, fresh fetch
  - [ ] Within 2 sec of tab visibility change
- [ ] **Stale data detection**
  - [ ] If cache >5 min old: warning badge shows on TV/MyProgram
  - [ ] Admin can force refresh (CacheStalenessIndicator button)
  - [ ] Refreshes within 30 sec

---

## PART 3: UI/UX & USER FEEDBACK

### 3.1 Form Feedback
- [ ] **Input validation**
  - [ ] Required fields: show error inline ("This field is required")
  - [ ] Format validation: show error inline ("Invalid email", "Invalid URL")
  - [ ] No silent failures
- [ ] **Save state**
  - [ ] "Saving..." indicator appears
  - [ ] Field disabled during save
  - [ ] Success: field enabled, no error
  - [ ] Error: toast shows error message, field stays open
- [ ] **Unsaved changes warning**
  - [ ] Leave page with unsaved form: warn user
  - [ ] Or: auto-save on blur (debounced)
  - [ ] Clear indication of what will be lost
- [ ] **Toast notifications**
  - [ ] Success: green toast, auto-dismiss 3 sec
  - [ ] Error: red toast, persist until dismissed
  - [ ] Info: blue toast, auto-dismiss 5 sec
  - [ ] No stacking (max 3 toasts visible)

---

### 3.2 Loading States
- [ ] **Page loads**
  - [ ] Spinner visible while loading
  - [ ] No blank white screen
  - [ ] Spinner centered, accessible
  - [ ] Max wait: 3 sec before timeout warning
- [ ] **Component loads**
  - [ ] Skeleton placeholders (not blank)
  - [ ] Text animates in
- [ ] **Data fetches**
  - [ ] "Loading..." text visible
  - [ ] User not confused about what's happening

---

### 3.3 Error Handling
- [ ] **Network timeout**
  - [ ] Show banner: "Network timeout — please check your connection"
  - [ ] Offer "Retry" button
  - [ ] Don't hide the form
- [ ] **Permission denied (403)**
  - [ ] Show error: "You don't have permission to access this"
  - [ ] Offer "Go Back" button
  - [ ] Don't crash
- [ ] **Not found (404)**
  - [ ] Show error: "This resource was not found"
  - [ ] Offer "Go Back" or "Go to Home"
  - [ ] Auto-redirect after 3 sec (if modal/page)
- [ ] **Server error (5xx)**
  - [ ] Show: "Something went wrong — please contact support"
  - [ ] Offer: "Retry" button
  - [ ] Don't lose user's data

---

### 3.4 Bilingual Support
- [ ] **Language toggle**
  - [ ] Top-right corner (Settings or Language dropdown)
  - [ ] English / Spanish options
  - [ ] Selection persists in localStorage
  - [ ] Page re-renders instantly
- [ ] **All user-facing strings**
  - [ ] English version in i18n/en.js
  - [ ] Spanish version in i18n/es.js
  - [ ] No hardcoded text in UI
- [ ] **Spanish text expansion**
  - [ ] Longer Spanish text doesn't overflow buttons/fields
  - [ ] Modal dialogs resize to fit Spanish text
  - [ ] Tables don't cut off headers
- [ ] **Date/time formatting**
  - [ ] Respects locale: 2026-03-09 (ISO) displays as "9 de marzo de 2026" (ES) or "March 9, 2026" (EN)
  - [ ] Times: 14:30 displays as "2:30 PM" (EN) or "14:30" (ES)

---

## PART 4: MOBILE & ACCESSIBILITY

### 4.1 Mobile Responsiveness
- [ ] **Breakpoints tested**
  - [ ] Desktop (1920px): full layout
  - [ ] Tablet (768px): sidebar collapses, stacks content
  - [ ] Mobile (375px): full-width, readable text (≥16px)
- [ ] **Touch targets**
  - [ ] All buttons ≥48x48px
  - [ ] Form inputs ≥44px height
  - [ ] No "fat finger" issues
- [ ] **Horizontal scrolling**
  - [ ] Tables don't require horizontal scroll (or are scrollable without breaking layout)
  - [ ] No horizontal scroll on main page
- [ ] **Keyboard navigation**
  - [ ] Tab order logical (top-left → bottom-right)
  - [ ] Focus indicator visible (outline)
  - [ ] No keyboard traps
  - [ ] Enter key submits forms

---

### 4.2 Accessibility
- [ ] **Screen reader support**
  - [ ] Labels associated with inputs
  - [ ] Buttons have accessible names
  - [ ] Headings hierarchical (h1 → h2 → h3)
  - [ ] Skip links present (skip to main content)
- [ ] **Color contrast**
  - [ ] Text ≥4.5:1 contrast ratio (WCAG AA)
  - [ ] Error red + white ≥4.5:1
  - [ ] Brand colors + white readable
- [ ] **Focus management**
  - [ ] Modal opens: focus moves to first input
  - [ ] Modal closes: focus returns to triggering button
  - [ ] Page navigation: focus moves to main content

---

## PART 5: NETWORK & OFFLINE

### 5.1 Offline Behavior
- [ ] **Offline banner**
  - [ ] Shows when offline (navigator.onLine)
  - [ ] Disappears when online
  - [ ] Clear message: "You're offline — some features unavailable"
- [ ] **Read-only mode**
  - [ ] Can view data (cache has it)
  - [ ] Can't submit forms
  - [ ] Edit buttons show: "Offline — try again when connected"
- [ ] **Data persistence**
  - [ ] Form draft saved to localStorage
  - [ ] On reconnect: can resume edit
  - [ ] On refresh: localStorage accessible

---

### 5.2 Network Failures
- [ ] **Timeout (>10 sec)**
  - [ ] Show: "Request timed out — try again"
  - [ ] Offer: "Retry" button
  - [ ] Don't lose form data
- [ ] **Slow network**
  - [ ] Show: "Slow network — this may take a moment"
  - [ ] Don't timeout prematurely (<30 sec for heavy queries)
- [ ] **Rate limited (429)**
  - [ ] Show: "Too many requests — please wait a moment"
  - [ ] Auto-retry after 60 sec
  - [ ] Don't show error if auto-retry succeeds

---

## PART 6: SPECIFIC FIELD CHECKS

### 6.1 Segment Type Fields (WeeklyEditorV2)
**For each segment_type, verify all fields render and persist:**

- [ ] **Alabanza (Worship)**
  - [ ] `number_of_songs` (1-6): number input, validates range
  - [ ] `song_1_title`, `song_1_lead`, `song_1_key`: text inputs, persist
  - [ ] `song_2_title`, `song_2_lead`, `song_2_key`: repeat
  - [ ] ... up to `song_6_*`
  - [ ] Empty song slots don't render (only show filled slots)

- [ ] **Plenaria (Message)**
  - [ ] `message_title`: text, optional
  - [ ] `presenter`: text, optional
  - [ ] `scripture_references`: text, reads from parsed_verse_data
  - [ ] `parsed_verse_data`: object, displays bilingual verses
  - [ ] Verse parser button opens dialog

- [ ] **Video**
  - [ ] `video_name`: text
  - [ ] `video_length_sec`: number
  - [ ] `video_url`: URL, validates http(s)

- [ ] **Oración (Prayer), Cierre (Closing)**
  - [ ] `presenter`: text
  - [ ] `duration_min`: number
  - [ ] No extra fields

- [ ] **Anuncio (Announcement)**
  - [ ] `announcement_title`: text
  - [ ] `announcement_description`: text

- [ ] **Artes (Arts)**
  - [ ] `art_types`: array of enum (DANCE, DRAMA, VIDEO, SPOKEN_WORD, PAINTING, OTHER)
  - [ ] `arts_type_order`: array, defines art performance sequence
  - [ ] Type-specific fields render based on art type

---

### 6.2 Event Fields
- [ ] **name** (required, string): validates non-empty
- [ ] **year** (required, number): validates year format (2024-2099)
- [ ] **slug** (optional, string): auto-generated from name, editable
- [ ] **theme** (optional, string): displays in EventDetail header
- [ ] **location** (optional, string): displays in info tab
- [ ] **start_date, end_date** (date): validates start ≤ end
- [ ] **status** (enum): planning/confirmed/in_progress/completed/archived/template
- [ ] **print_color** (enum): green/blue/pink/orange/yellow/purple/red/teal/charcoal
- [ ] **promote_in_announcements** (boolean): toggle to include in weekly announcements
- [ ] **promotion_start_date, promotion_end_date** (date): when to show announcement
- [ ] **announcement_blurb** (optional, text): short description for announcement
- [ ] **announcement_has_video** (boolean): video included in announcement
- [ ] **promotion_targets** (array): which service types to target

---

### 6.3 Session Fields
- [ ] **name** (required, string): e.g., "9:30 AM", "Viernes PM"
- [ ] **date** (required, date): session date
- [ ] **planned_start_time** (optional, time): HH:MM format
- [ ] **planned_end_time** (optional, time): auto-calculated or manual?
- [ ] **room_id** (optional, ref): select from Rooms list
- [ ] **order** (number): display order (now deprecated as primary sort, but still stored)
- [ ] **presenter** (optional, string): main presenter for session
- [ ] **admin_team, coordinators, sound_team, lights_team, video_team, tech_team, ushers_team, translation_team, hospitality_team, photography_team** (optional, strings): team assignments

---

## PART 7: CRITICAL WORKFLOWS (End-to-End)

### 7.1 Create Event → Create Sessions → Create Segments → Display in Reports
1. [ ] Navigate to Events page
2. [ ] Click "New Event"
3. [ ] Fill: name="Easter Celebration", year=2026
4. [ ] Submit → redirects to EventDetail
5. [ ] Click "Sessions" tab
6. [ ] Click "New Session"
7. [ ] Fill: name="Morning Service", date=2026-03-29, time=09:00
8. [ ] Submit → session appears in list
9. [ ] Click session → expand segments
10. [ ] Click "Add Segment"
11. [ ] Fill: title="Worship", type="Alabanza", duration=30, songs=3
12. [ ] Fill: song_1 details
13. [ ] Submit → segment created
14. [ ] Navigate to Reports
15. [ ] Select same event
16. [ ] View "Detailed Program" tab
17. [ ] Verify: event name, session, segment all appear
18. [ ] Export PDF → PDF contains correct data

**✅ Success:** If all 18 steps work without errors, workflow is solid.

---

### 7.2 Speaker Submission → Verse Parsing → Live Display
1. [ ] Get speaker form link from EventDetail "More Actions" → "Speaker Form"
2. [ ] Open public form
3. [ ] Find event and segment (message type)
4. [ ] Paste sermon notes with Bible verses (e.g., "Read John 3:16 and Romans 6:9")
5. [ ] Submit
6. [ ] Check segment in editor: `submission_status` should be "pending" within 5 sec
7. [ ] Wait 30 sec for automation: `submission_status` → "processed"
8. [ ] Verify: `scripture_references` populated with bilingual verses
9. [ ] Open Reports → Projection tab
10. [ ] Verify: verses display in two-column format (EN | ES)
11. [ ] Open PublicProgramView (Live View)
12. [ ] Verify: verses visible to coordinator

**✅ Success:** If all 12 steps work and verses appear bilingual, submission flow is solid.

---

### 7.3 Edit Segment → Coordinator Sees Update in MyProgram
1. [ ] Open WeeklyEditorV2
2. [ ] Click segment presenter field
3. [ ] Change name from "John" to "Maria"
4. [ ] Tab out (auto-save)
5. [ ] Toast: "Saved"
6. [ ] Open another browser tab: MyProgram page
7. [ ] Check same segment: presenter still shows "John" (cache)
8. [ ] Wait 2 min OR click app tab → cache invalidates
9. [ ] Verify: presenter updated to "Maria"

**✅ Success:** If update visible within 2 min, cache sync is solid.

---

## PART 8: EDGE CASES & ERROR SCENARIOS

### 8.1 Concurrent Edits
- [ ] **Two admins edit same segment simultaneously**
  - [ ] Admin A: changes presenter to "John"
  - [ ] Admin B: changes presenter to "Maria"
  - [ ] Admin B's save completes first
  - [ ] Admin A's save completes second
  - [ ] Final state: "Maria" (last write wins, acceptable)
  - [ ] No crash, no data loss
  - [ ] Toast shows which saved last

---

### 8.2 Stale Tab Recovery
- [ ] **User opens event in Tab A at 09:00**
  - [ ] Event exists, loads fine
  - [ ] User leaves tab open
  - [ ] At 15:00, event is deleted by another admin
  - [ ] User clicks on Tab A
  - [ ] Page tries to load deleted event
  - [ ] Show error: "Event not found"
  - [ ] Auto-redirect to Events page after 3 sec
  - [ ] No crash

---

### 8.3 Network Interruption During Save
- [ ] **User editing segment, network drops**
  - [ ] User types presenter name: "Pastor David"
  - [ ] Hits Enter to save
  - [ ] Network timeout (backend unreachable)
  - [ ] Show error toast: "Failed to save — try again"
  - [ ] Form still visible, text still in field
  - [ ] "Retry" button offered
  - [ ] User clicks Retry
  - [ ] Network restored
  - [ ] Save succeeds
  - [ ] Toast: "Saved"

---

### 8.4 Missing Required Data
- [ ] **Segment without `ui_fields` set**
  - [ ] Editor loads segment
  - [ ] Show amber warning: "Segment not configured — no fields to display"
  - [ ] Offer "Configure from Blueprint" button
  - [ ] Don't show empty segment card

---

### 8.5 Permission Denied
- [ ] **Non-admin user tries to delete event**
  - [ ] Delete button hidden (permission check)
  - [ ] Or: button enabled but API rejects request (403)
  - [ ] Toast: "You don't have permission"
  - [ ] No crash

---

## PART 9: CHECKLIST COMPLETION

### Before Event Day: Verification Sign-Off
- [ ] All sections above reviewed
- [ ] Critical pages tested (1.1-1.10)
- [ ] Data integrity flows verified (2.1-2.3)
- [ ] UI/UX feedback present (3.1-3.4)
- [ ] Mobile tested (4.1)
- [ ] Accessibility spot-checked (4.2)
- [ ] Offline & network scenarios tested (5.1-5.2)
- [ ] All field types verified (6.1-6.3)
- [ ] End-to-end workflows completed (7.1-7.3)
- [ ] Edge cases & error scenarios tested (8.1-8.5)

### Sign-Off
- **Reviewer:** _______________
- **Date:** _______________
- **Issues Found:** __________
- **Severity:** Critical / High / Medium / Low
- **Resolution:** Fixed / Deferred / Accepted Risk

---

## APPENDIX: Quick Reference

### Critical Paths (Must Work 100%)
1. Speaker form → display in editor within 30 sec
2. Segment save → reflected in reports within 2 min
3. Event deletion → auto-redirect on stale tab
4. Offline → banner shows, no crash
5. Network timeout → error shown, form preserved, retry works

### Acceptable Delays
- Editor save: ≤2 sec
- Report load: ≤3 sec per tab
- PDF generation: ≤10 sec
- Cache refresh: ≤30 sec
- Subscription update: ≤2 min (with safety net poll)

### Red Flags (Stop the Event if Not Fixed)
- [ ] Form data lost on network error
- [ ] Segment appears in one view but not another (>5 min stale)
- [ ] Edit crashes editor or Reports page
- [ ] Delete creates orphaned records
- [ ] Speaker verses don't parse (submission hangs)
- [ ] PDF generation fails or shows blank pages
- [ ] Permission checks missing (non-admin can edit)
- [ ] Offline mode crashes instead of showing banner

---

**Audit Status:** READY FOR TESTING  
**Last Updated:** 2026-03-09  
**Next Review:** 24 hrs before event (2026-03-XX)