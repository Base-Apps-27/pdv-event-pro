/* eslint-disable */
// # DECISION: 5-Persona Audit Full Remediation Plan
# Date: 2026-03-01
# Status: APPROVED — Implementation paused pending active issues
# Decision ID: D-AUDIT-5P-001
# Category: architecture, security, ui_ux, code_quality, growth

## Context
A comprehensive adversarial audit was performed from 5 expert personas (CTO, Senior Developer,
Security Expert, UI/UX Pro, Growth Optimizer). 33 findings identified. 0 of the 33 had been
addressed by the previous remediation round (which covered a different set of findings).

This decision logs the complete remediation plan with exact fixes, effort estimates, priority
tiers, and execution order. Implementation is paused — will resume after active issues are cleared.

---

## PERSONA 1: CTO — Architecture & System Integrity (6 findings)

### CTO-1: Quadruplicated Verse Parsing Logic
- **Finding:** BIBLE_BOOKS + parseScriptureReferences duplicated in 4 files: VerseParserDialog,
  submitWeeklyServiceContent, processNewSubmissionVersion, processPendingSubmissions
- **Risk:** One drift = bilingual verse mismatches for all users
- **Fix:** Create `functions/parseScriptureShared.js` as a backend function. The 3 backend
  functions call it via `base44.functions.invoke('parseScriptureShared', { text })`. Frontend
  `VerseParserDialog` keeps its own copy (cannot call backend synchronously during typing).
  Add a VERSION_HASH comment at the top of all 4 copies so drift is detectable during review.
- **Effort:** Medium (2h)
- **Surfaces:** 4 functions, 1 component
- **Priority:** P2

### CTO-2: No Concurrency Guard on refreshActiveProgram
- **Finding:** Comment says "Added concurrency guard" but NO actual guard exists. Two entity
  automations firing within 200ms will both rebuild cache simultaneously.
- **Risk:** Write conflicts on ActiveProgramCache, wasted API calls
- **Fix:** Use ActiveProgramCache itself as a soft lock. Add `refresh_in_progress` boolean field
  to ActiveProgramCache entity. At function start: read cache, if `refresh_in_progress` is true
  AND `last_refresh_at` < 30s ago, return early (skip). Set `refresh_in_progress=true` at start,
  clear at end. 30s TTL prevents stale locks from blocking future refreshes.
- **Effort:** Low (1h)
- **Surfaces:** 1 function (refreshActiveProgram), 1 entity (ActiveProgramCache schema)
- **Priority:** P2
- **Schema change:** Additive only — new boolean field, no destructive changes

### CTO-3: Frontend Writes to ActiveProgramCache (Data Integrity Risk)
- **Finding:** PublicProgramView L238-279 writes directly to ActiveProgramCache entity from
  frontend JS. Any authenticated user (even EventDayViewer) can write cache entries.
- **Risk:** Data poisoning — malicious/buggy client corrupts cache for all users including TV Display
- **Fix:** Remove `base44.entities.ActiveProgramCache.update()` call from PublicProgramView.
  Replace with `base44.functions.invoke('refreshActiveProgram', { warmCacheKey })` which runs
  as service role with proper authority. Frontend becomes read-only for cache.
- **Effort:** Low (30m)
- **Surfaces:** 1 page (PublicProgramView), 1 function (refreshActiveProgram)
- **Priority:** P1 (security-adjacent)
- **Shared with:** SEC-5

### CTO-4: getPublicProgramData Duplicates refreshActiveProgram (~400 lines)
- **Finding:** Both functions contain identical session sorting, child segment resolution,
  break injection, and pre-session detail injection code.
- **Risk:** Changes to one will not propagate to the other — divergence guaranteed over time
- **Fix:** Refactor getPublicProgramData to be a thin read layer: reads from ActiveProgramCache
  and returns the snapshot. Remove all snapshot-building logic from it. If cache is stale/missing,
  it calls refreshActiveProgram internally via `base44.functions.invoke()`. Single source of
  truth for snapshot building = refreshActiveProgram only.
- **Effort:** Medium (2h)
- **Surfaces:** 2 functions (getPublicProgramData, refreshActiveProgram)
- **Priority:** P2
- **Sequencing:** CTO-3 should be done first (establishes pattern of backend-only cache writes)

### CTO-5: submitSpeakerContent Unreachable idempotencyKey in catch
- **Finding:** Line 146: `if (idempotencyKey)` in catch block references variable destructured
  inside try block's `body = await req.json()`. If req.json() throws, idempotencyKey is undefined.
- **Risk:** Catch block silently skips cleanup — idempotency records left in bad state
- **Fix:** Declare `let idempotencyKey` at function scope before try block. Assign inside try
  after successful req.json() parse. Catch block then has access for cleanup.
- **Effort:** Trivial (10m)
- **Surfaces:** 1 function (submitSpeakerContent)
- **Priority:** P0

### CTO-6: No Health Check / Circuit Breaker
- **Finding:** All backend functions retry on 429 but have no circuit breaker pattern.
- **Risk:** Sustained outage could exhaust function timeout limits
- **Disposition:** ACCEPT AS-IS. Deno Deploy functions are stateless — no persistent state for
  circuit breakers. Existing `withRetry` with 429 backoff is the best available pattern.
- **Effort:** None
- **Priority:** ACCEPTED

---

## PERSONA 2: Senior Developer — Code Quality (7 findings)

### DEV-1: PublicProgramView is 1063 Lines
- **Finding:** Single React component with auth, cache, subscriptions, timing, modals, selectors,
  and two sub-views. Violates component decomposition principles.
- **Risk:** Debugging extremely difficult, high regression risk on any change
- **Fix:** Decompose into 5 focused components:
  1. `PublicProgramShell` — auth + layout + header
  2. `ProgramSelectorBar` — dropdown selectors + force display
  3. `ServiceProgramSection` — service program rendering
  4. `EventProgramSection` — event program rendering
  5. `ProgramCacheManager` — custom hook for cache reads/subscriptions
  Main page becomes ~150 lines of orchestration.
- **Effort:** High (4h)
- **Surfaces:** 1 page → 5 new components
- **Priority:** P3

### DEV-2: Hardcoded Spanish Strings (No i18n on Admin Pages)
- **Finding:** WeeklyServiceManager, MessageProcessing, and 5 other admin pages have ~252
  hardcoded Spanish strings with no i18n support.
- **Risk:** Violates bilingual Constitution requirement. English-speaking team members cannot
  use admin interfaces.
- **Fix:** Add missing keys to i18n translation dictionaries in `components/utils/i18n.jsx`.
  Replace hardcoded strings in each page with `t('key')` calls. Batch by page (~30 min each).
- **Effort:** High (4h)
- **Surfaces:** 7 pages, 1 util (i18n.jsx)
- **Priority:** P4

### DEV-3: MessageProcessing Hard Cap 100 Submissions
- **Finding:** `list('-created_date', 100)` is a hard cap. Older versions silently disappear.
  No pagination, no user feedback.
- **Risk:** Silent data loss in diagnostics view beyond 100 submissions
- **Fix:** Replace with `.filter({ segment_id: { $in: segmentIds } }, '-created_date', 200)`
  scoped to segments being viewed. Add warning banner if `count === limit`.
- **Effort:** Low (30m)
- **Surfaces:** 1 page (MessageProcessing)
- **Priority:** P2

### DEV-4: Date Arithmetic Inconsistencies (Local vs ET)
- **Finding:** Dashboard uses `Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })`.
  PublicProgramView uses `new Date().setHours(0,0,0,0)` which is LOCAL timezone. Mixed approaches.
- **Risk:** Bugs when server/client timezone differs. Wrong dates displayed.
- **Fix:** Create canonical `getTodayET()` helper in `timeFormat.jsx` returning `YYYY-MM-DD`
  in America/New_York. Replace all `new Date()` date-comparison code with this helper.
- **Effort:** Medium (1.5h)
- **Surfaces:** 1 util (timeFormat), 3-4 pages
- **Priority:** P1

### DEV-5: WeeklyServiceManager Date Picker Sunday-Locked
- **Finding:** `disabled={(date) => date.getDay() !== 0}` blocks all non-Sunday dates.
  System supports Wednesday, Saturday, other weekday services via ServiceSchedule.
- **Risk:** Users managing non-Sunday services cannot use date picker — must use day tabs
- **Fix:** Change disabled callback to check against active ServiceSchedule day_of_week values.
  If schedules exist for Wednesday+Sunday, allow both. Fallback: if no schedules, allow all days.
- **Effort:** Low (30m)
- **Surfaces:** 1 page (WeeklyServiceManager), reads ServiceSchedule entity
- **Priority:** P2
- **Shared with:** UX-5

### DEV-6: Dashboard format(new Date(date)) Timezone Bug
- **Finding:** `format(new Date(event.start_date), 'MMMM d, yyyy')` — `new Date('2026-03-01')`
  creates UTC midnight. `format()` uses local timezone. On EST: renders Feb 28 instead of Mar 1.
- **Risk:** Wrong event dates displayed on Dashboard
- **Fix:** Parse YYYY-MM-DD string directly (split on `-`) instead of routing through
  `new Date()`. Or use the canonical `getTodayET()` family formatter from DEV-4.
- **Effort:** Trivial (15m)
- **Surfaces:** 1 page (Dashboard)
- **Priority:** P0

### DEV-7: Stale useEffect Dependency Warnings
- **Finding:** WeeklyServiceManager useEffect references variables omitted from deps array.
  Auto-select logic only runs on announcements change, not initial mount.
- **Risk:** Subtle bugs on initial render — announcements may not auto-select
- **Fix:** Add missing deps. If intent is "run once on data change," use `useRef(false)` guard.
- **Effort:** Trivial (15m)
- **Surfaces:** 1 page (WeeklyServiceManager)
- **Priority:** P0

---

## PERSONA 3: Security Expert (6 findings)

### SEC-1: Public Form Data Endpoints Have No Auth
- **Finding:** getSpeakerFormData, getArtsFormData, getWeeklyFormData use asServiceRole with
  no authentication. Exposes internal event names, session names, segment details, presenter
  names, room configurations to any anonymous HTTP caller.
- **Risk:** Information disclosure — full internal program structure exposed publicly
- **Fix:** (1) Require valid segment_id or event_slug parameter (don't dump all data).
  (2) Add entity-based rate limiting (write RateLimit records per IP+endpoint, check count).
  (3) Strip internal IDs from response — return only display-necessary fields.
  Consider: new `RateLimit` entity or reuse `PublicFormIdempotency` for rate tracking.
- **Effort:** Medium (2h)
- **Surfaces:** 3 functions, 1 entity (new or reuse PublicFormIdempotency)
- **Priority:** P1

### SEC-2: No CSRF Protection on Public Forms
- **Finding:** React forms submit to backend functions with CORS `*`. Any website can construct
  submissions targeting these endpoints. Honeypot is only protection.
- **Risk:** Cross-site form submission attacks
- **Fix:** Anti-CSRF token pattern: data endpoints generate a short-lived token stored in
  PublicFormIdempotency entity. Submission functions validate token exists and hasn't expired.
  Also tighten CORS from `*` to app's actual domain(s).
- **Effort:** Medium (1.5h)
- **Surfaces:** 3 data functions, 3 submission functions
- **Priority:** P4

### SEC-3: Rate Limiter is In-Memory (Stateless on Deno Deploy)
- **Finding:** `rateLimiter = new Map()` resets on every cold start (~60s). Provides effectively
  zero rate limiting in production.
- **Risk:** No protection against submission flooding
- **Fix:** Replace in-memory Map() with entity-based rate limiting. On each submission, query
  PublicFormIdempotency records filtered by IP + last 60 seconds. If count > threshold, reject.
  Entity already exists — just needs a query pattern.
- **Effort:** Low (45m)
- **Surfaces:** 3 submission functions, 1 entity (PublicFormIdempotency)
- **Priority:** P1
- **Shared with:** SEC-4

### SEC-4: submitWeeklyServiceContent / submitArtsSegment Same Rate Limiter Issue
- **Finding:** Same in-memory Map() pattern as submitSpeakerContent
- **Fix:** Same fix as SEC-3 — apply entity-based rate limiter to all 3 submission functions
- **Effort:** Included in SEC-3
- **Priority:** P1

### SEC-5: Frontend Writes to ActiveProgramCache (Data Poisoning)
- **Finding:** Any authenticated user can write arbitrary program_snapshot data to cache,
  read by ALL other users including TV Display.
- **Fix:** Same as CTO-3 — remove frontend write, route through backend function.
- **Effort:** Included in CTO-3
- **Priority:** P1

### SEC-6: No Input Sanitization on Arts Form URLs
- **Finding:** submitArtsSegment receives freeform URLs with no validation. Malicious URLs
  could be injected and displayed to projection/sound teams.
- **Risk:** XSS/injection via stored malicious URLs rendered on team displays
- **Fix:** Add URL validation: check `https?://` pattern, reject `javascript:`, `data:`,
  `file:` schemes. Apply `escapeHtml()` treatment. Store sanitized values only.
- **Effort:** Low (30m)
- **Surfaces:** 1 function (submitArtsSegment)
- **Priority:** P1

---

## PERSONA 4: UI/UX Expert (7 findings)

### UX-1: Three Distinct Public Form Design Languages
- **Finding:** SpeakerFormHeader, WeeklyFormHeader, ArtsFormHeader each have different spacing,
  typography, and interaction patterns.
- **Risk:** Inconsistent user experience, brand dilution
- **Fix:** Create `components/publicforms/PublicFormShell.jsx` — shared wrapper with consistent
  header, brand gradient, language toggle slot, loading/error states, responsive container.
  Refactor 3 headers to use it as a parent, keeping unique content as children.
- **Effort:** Medium (2h)
- **Surfaces:** 1 new component, 3 headers, 3 pages
- **Priority:** P3

### UX-2: Inconsistent Loading States
- **Finding:** Dashboard: Loader2 spinner. PublicSpeakerForm: custom CSS spinner.
  PublicProgramView: LiveViewSkeleton. No unified loading component.
- **Risk:** Visual inconsistency, brand dilution
- **Fix:** Create `components/ui/LoadingSpinner.jsx` with size variants (sm, md, lg, fullPage).
  Replace all spinner patterns across the app.
- **Effort:** Low (1h)
- **Surfaces:** 1 new component, ~10 pages
- **Priority:** P3

### UX-3: MessageProcessing Zero Mobile Optimization
- **Finding:** 3-column grid doesn't adapt well. No touch targets. Header doesn't wrap.
  Tabs fixed at 400px overflow on 320px screens.
- **Risk:** Unusable on mobile devices
- **Fix:** Responsive breakpoints: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. Header
  `flex-wrap`. Remove fixed max-w on tabs → `w-full max-w-sm`. Touch-friendly padding `p-4`.
- **Effort:** Low (30m)
- **Surfaces:** 1 page (MessageProcessing)
- **Priority:** P3

### UX-4: Dashboard Inconsistent Click Targets
- **Finding:** Live Program card is fully clickable (onClick). Event cards require specific
  "View Details" button click. Mixed affordance.
- **Risk:** User confusion on interaction model
- **Fix:** Make event cards fully clickable (wrap in Link or add onClick + cursor-pointer).
  Keep "View Details" button as visual affordance but make entire card the target.
- **Effort:** Trivial (15m)
- **Surfaces:** 1 page (Dashboard)
- **Priority:** P4

### UX-5: WeeklyServiceManager Sunday-Locked Calendar
- **Fix:** Same as DEV-5. Merged.
- **Priority:** P2

### UX-6: No Empty State Guidance on MyProgram
- **Finding:** MyProgramStandby shows when no program detected but offers no actionable guidance.
- **Risk:** Users stuck with no next step
- **Fix:** Update MyProgramStandby with bilingual actionable text:
  "No hay programa activo. / No active program."
  "Contacta a tu administrador para crear un servicio. / Contact your admin to create a service."
  Add branded icon/illustration.
- **Effort:** Trivial (15m)
- **Surfaces:** 1 component (MyProgramStandby)
- **Priority:** P0

### UX-7: PublicProgramView Selector Hard-Truncates at 25 Chars
- **Finding:** JS `substring(0,25)` loses critical event identification. Breaks accessibility.
- **Risk:** Screen readers lose full name. Users can't distinguish similar events.
- **Fix:** Replace JS truncation with CSS `truncate` class (text-overflow: ellipsis).
  Full text remains in DOM for screen readers and tooltips.
- **Effort:** Trivial (10m)
- **Surfaces:** 1 page (PublicProgramView)
- **Priority:** P0

---

## PERSONA 5: Growth & Optimization (7 findings)

### GRO-1: No Analytics on Core Admin Workflows
- **Finding:** Only Arts form has analytics.track(). Dashboard views, service edits, event
  creation, live timing, message processing — none tracked.
- **Risk:** Impossible to know feature adoption or user drop-off points
- **Fix:** Add `base44.analytics.track()` to key admin actions: service save, event create/edit,
  segment edit, live timing adjustment, message processing, PDF generation. ~15 track points.
- **Effort:** Medium (2h)
- **Surfaces:** 6-8 pages
- **Priority:** P3

### GRO-2: No Onboarding Flow
- **Finding:** New users land on Dashboard with no guidance, tutorial, or empty-state walkthrough.
- **Risk:** First-time users lost without pre-existing knowledge
- **Fix:** Create `components/dashboard/OnboardingChecklist.jsx` shown when user has few logins
  or no events/services exist. Checklist: Create event → Add sessions → Add segments → Invite team.
  Dismissible, persisted on user entity (`onboarding_dismissed: true`).
- **Effort:** Medium (2h)
- **Surfaces:** 1 new component, 1 page (Dashboard), User entity (additive field)
- **Priority:** P4
- **Schema change:** Additive only — new field on User entity

### GRO-3: No Error Recovery UX
- **Finding:** Failed API calls show unhelpful messages. No retry buttons, no contact info,
  no fallback content.
- **Risk:** Users stuck on error screens with no recourse
- **Fix:** Create `components/ui/ErrorCard.jsx` with bilingual message + retry button.
  Pattern: `{error && <ErrorCard message={t('error.loadFailed')} onRetry={refetch} />}`
  Apply to PublicProgramView, PublicSpeakerForm, PublicWeeklyForm, PublicArtsForm, MyProgram.
- **Effort:** Low (1h)
- **Surfaces:** 1 new component, 5 pages
- **Priority:** P3

### GRO-4: Cache Invalidation Over-Broad
- **Finding:** refreshActiveProgram rebuilds ALL warm cache entries on any Segment/Session/
  SegmentAction change regardless of which program they belong to.
- **Risk:** 5 cached programs × 50 segment changes during editing = potentially 250 rebuilds
- **Fix:** When processing entity change triggers, check if changed entity's event_id or
  service_id matches cached program's program_id. Only rebuild matching warm caches.
- **Effort:** Medium (1.5h)
- **Surfaces:** 1 function (refreshActiveProgram)
- **Priority:** P2

### GRO-5: No Offline Support
- **Finding:** MyProgram and Live View used during live services where WiFi may be unreliable.
  No service worker, no local caching, no offline fallback.
- **Disposition:** PARTIALLY ACCEPT. Base44 has no service worker support.
- **Best available fix:** Show "Offline — last updated X" banner when fetch fails. Cache
  last-known data in safeLocalStorage. Increase polling tolerance (don't error on first failure).
- **Effort:** Low (1h) for banner and localStorage fallback
- **Surfaces:** 2-3 components (MyProgram, PublicProgramView, PublicCountdownDisplay)
- **Priority:** P3 (partial), ACCEPTED (full offline)

### GRO-6: WeeklyServiceManager Hardcoded Fallback Sessions
- **Finding:** Empty ServiceSchedule for Sunday defaults to `['9:30am', '11:30am']`. Single-church
  assumption prevents platform reuse.
- **Risk:** Any other organization cannot use this platform without code changes
- **Fix:** Replace hardcoded fallback with ServiceSchedule entity read. If no schedule exists,
  show empty state prompting user to create one via ServiceScheduleManager.
- **Effort:** Low (30m)
- **Surfaces:** 1 page (WeeklyServiceManager)
- **Priority:** P2

### GRO-7: No Multi-Tenant Architecture
- **Finding:** Everything is single-org. Entity queries have no org_id scoping.
- **Disposition:** ACCEPT AS-IS. Multi-tenancy would require complete architectural overhaul
  beyond platform capabilities. Documented as known growth ceiling.
- **Future path:** Add org_id to every entity + filter every query + org-aware permissions.
- **Effort:** None (document only)
- **Priority:** ACCEPTED

---

## EXECUTION PRIORITY TIERS

### P0 — Do Now (~1h total, trivial fixes, zero risk)
| ID | Fix | Effort |
|----|-----|--------|
| CTO-5 | Move idempotencyKey declaration to function scope | 10m |
| DEV-6 | Fix Dashboard date timezone bug | 15m |
| DEV-7 | Fix WeeklyServiceManager useEffect deps | 15m |
| UX-6 | Add empty state guidance to MyProgramStandby | 15m |
| UX-7 | Replace JS truncation with CSS truncate | 10m |

### P1 — This Week (~5h, security hardening for live production)
| ID | Fix | Effort |
|----|-----|--------|
| SEC-3/4 | Entity-based rate limiting (all 3 submission functions) | 45m |
| SEC-6 | URL validation in submitArtsSegment | 30m |
| CTO-3/SEC-5 | Remove frontend cache writes, route through backend | 30m |
| SEC-1 | Harden public form data endpoints | 2h |
| DEV-4 | Canonical getTodayET() helper + replace date math | 1.5h |

### P2 — Next Sprint (~8h, architecture integrity + data correctness)
| ID | Fix | Effort |
|----|-----|--------|
| CTO-1 | Extract shared verse parsing function | 2h |
| CTO-2 | Concurrency guard on refreshActiveProgram | 1h |
| CTO-4 | Deduplicate getPublicProgramData | 2h |
| DEV-3 | Fix MessageProcessing 100 cap | 30m |
| DEV-5/UX-5 | Unlock date picker for non-Sunday services | 30m |
| GRO-4 | Scope cache invalidation to affected program | 1.5h |
| GRO-6 | Remove hardcoded fallback sessions | 30m |

### P3 — Scheduled (~10h, UX consistency + observability)
| ID | Fix | Effort |
|----|-----|--------|
| DEV-1 | Decompose PublicProgramView (1063 lines → 5 components) | 4h |
| UX-1 | Shared PublicFormShell component | 2h |
| UX-2 | Unified LoadingSpinner component | 1h |
| UX-3 | MessageProcessing mobile optimization | 30m |
| GRO-1 | Analytics tracking on admin workflows | 2h |
| GRO-3 | ErrorCard component + apply to 5 pages | 1h |
| GRO-5 | Offline banner + localStorage fallback (partial) | 1h |

### P4 — Backlog (~9h, polish + long-term quality)
| ID | Fix | Effort |
|----|-----|--------|
| DEV-2 | i18n for 7 admin pages (~252 strings) | 4h |
| SEC-2 | CSRF token pattern for public forms | 1.5h |
| GRO-2 | Onboarding checklist component | 2h |
| UX-4 | Dashboard clickable event cards | 15m |

### ACCEPTED — No Action
| ID | Finding | Reason |
|----|---------|--------|
| CTO-6 | No circuit breaker | Deno stateless — platform constraint |
| GRO-5 | Full offline support | No service worker in Base44 |
| GRO-7 | No multi-tenancy | Complete rewrite required |

---

## TOTAL EFFORT: ~33 hours across 33 findings
## TOTAL ADDRESSABLE: 30 findings (~33h)
## PERMANENTLY ACCEPTED: 3 findings (platform constraints)

---

## SEQUENCING DEPENDENCIES

1. DEV-4 (getTodayET helper) → DEV-6 (Dashboard date fix uses it)
2. CTO-3 (remove frontend cache write) → CTO-4 (getPublicProgramData refactor)
3. SEC-3 (entity-based rate limiter) → SEC-1 (data endpoint hardening uses same pattern)
4. CTO-2 (concurrency guard) → requires ActiveProgramCache schema addition first
5. GRO-2 (onboarding) → requires User entity additive field first

## ROLLBACK NOTES
- All P0 and P1 fixes are individually reversible via find_replace
- CTO-2 requires schema addition (additive, non-destructive — no rollback needed for schema)
- DEV-1 (decomposition) is a refactor — snapshot current PublicProgramView before starting
- SEC-2 (CSRF) touches 6 functions — coordinate deployment together