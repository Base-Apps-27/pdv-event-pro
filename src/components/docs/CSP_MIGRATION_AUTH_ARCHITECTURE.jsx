# CSP Migration: Auth Architecture for Public React Pages

## For: Base44 AI Developers working on PDV Event Pro

---

## The Problem

Base44's CDN/proxy layer injects a restrictive Content Security Policy (CSP) on responses
from backend functions (`/api/functions/*`). This CSP blocks `'unsafe-inline'` scripts,
which breaks SSR HTML forms that embed `<script>` tags (100% of our public forms).

We cannot override these headers — they are injected AFTER the function returns its response.

## The Solution

Move public form rendering from SSR HTML functions → React pages.

React pages run inside the trusted app shell (`index.html`), which already has a permissive
CSP established by the platform. The React bundle, Tailwind, and all our scripts execute
within that trusted context. No inline scripts needed.

## Auth Architecture

### Platform Setting: "Public — No Auth Required"

This Base44 app is configured as a **public app** at the platform level. This means:
- The React app shell (`index.html`) loads for ALL visitors, authenticated or not
- React pages render for everyone — **the platform does not gate page access**
- Backend functions (`/api/functions/*`) also receive requests without auth

### How We Enforce Auth (App-Level, Not Platform-Level)

Authentication is enforced **in our Layout.js**, not by the platform. Here's the flow:

```
Visitor hits any page URL
  → Platform serves React app shell (always, because Public mode)
  → React Router renders Layout.js
  → Layout.js checks: Is this a public page?
     YES → Render page immediately, no auth needed
     NO  → Check base44.auth.isAuthenticated()
            → If not authenticated: base44.auth.redirectToLogin()
            → If authenticated: check permissions, render page
```

### The Public Page Allowlist (Layout.js)

Layout maintains an explicit allowlist of public routes:

```javascript
const isPublicPage = useMemo(() => {
    const path = location.pathname;
    const publicExactRoutes = [
        createPageUrl('PublicCountdownDisplay'),
        createPageUrl('PublicSpeakerForm'),
        // ... add new public pages here
    ];
    if (publicExactRoutes.includes(path)) return true;
    const publicPrefixes = ['/print/', '/public/'];
    if (publicPrefixes.some(prefix => path.startsWith(prefix))) return true;
    return false;
}, [location.pathname]);
```

**To make a new page public:** Add its route to `publicExactRoutes` or use a public prefix.

**If you forget:** The page will redirect unauthenticated visitors to login — a safe default.

### Backend Function Auth for Public Forms

The public React pages call backend functions for:
1. **Data fetching** (e.g., `getSpeakerFormData`) — reads event/segment data
2. **Data submission** (e.g., `submitSpeakerContent`, `submitArtsSegment`) — writes data

These functions use `base44.asServiceRole` for all entity operations because:
- There is no authenticated user (anonymous visitors)
- The service role has full read/write access
- The function itself is the trust boundary

**Security measures on submission functions:**
- **Rate limiting** — IP-based, 5-10 requests/minute
- **Field whitelisting** — Only specific fields can be written (arts form)
- **Composite ID validation** — Weekly form validates the segment_id format
- **Idempotency keys** — Prevents duplicate submissions (weekly form)
- **No raw content on entities** — Submitted text goes to audit trail only; only parsed/processed data reaches the Segment entity

### How Frontend Calls Backend

From React pages, we use the Base44 SDK:

```javascript
import { base44 } from '@/api/base44Client';

// Data fetch (GET-like)
const response = await base44.functions.invoke('getSpeakerFormData', { event_id: '...' });

// Data submit (POST-like)
const response = await base44.functions.invoke('submitSpeakerContent', { segment_id: '...', content: '...' });
```

The SDK handles auth headers automatically. For unauthenticated users, it still sends the
request — the backend function just won't find a user via `base44.auth.me()`, which is fine
because our public functions don't call `base44.auth.me()` (they use `asServiceRole` directly).

**IMPORTANT:** The old SSR forms used raw `fetch()` to call submission endpoints because they
ran outside the React app shell. The new React pages MUST use `base44.functions.invoke()`
instead — it's more reliable and handles the Base44 request context correctly.

## Migration Pattern

For each SSR HTML form → React page migration:

### Step 1: Create a JSON Data API Function
- Extract the data-fetching logic from the old `serve*` function
- Return JSON instead of HTML
- Use `base44.asServiceRole` for all entity reads
- Example: `serveArtsSubmission` → `getArtsFormData`

### Step 2: Create React Components
- Header component (reusable across forms — `SpeakerFormHeader` pattern)
- Form component with all field logic, validation, status calculation
- Keep the same visual design (brand gradient, Bebas Neue headers, etc.)

### Step 3: Create the React Page
- Flat file in `pages/` (e.g., `pages/PublicArtsForm.js`)
- Fetches data via `base44.functions.invoke('getArtsFormData', ...)`
- Submits via `base44.functions.invoke('submitArtsSegment', ...)`
- No auth checks needed — Layout handles public routing

### Step 4: Register as Public Route
- Add to `isPublicPage` allowlist in Layout.js
- Both exact path forms: `createPageUrl('PublicArtsForm')` and `'/PublicArtsForm'`

### Step 5: Update Links
- EventDetail dropdown: change `href` from `/api/functions/serve*` to `createPageUrl('PublicArtsForm')`
- Any other references in the codebase

### Step 6: Preserve Old Functions
- Do NOT delete the old `serve*` functions immediately
- They serve as documentation and fallback reference
- Mark them with a deprecation comment

## Forms to Migrate

| Form | Old SSR Function | New React Page | Data API | Submission API | Status |
|------|-----------------|----------------|----------|---------------|--------|
| Speaker (Event) | `serveSpeakerSubmission` | `PublicSpeakerForm` | `getSpeakerFormData` | `submitSpeakerContent` | ✅ Done |
| Arts | `serveArtsSubmission` | `PublicArtsForm` | `getArtsFormData` | `submitArtsSegment` | 🔲 Next |
| Weekly Service | `serveWeeklyServiceSubmission` | `PublicWeeklyForm` | `getWeeklyFormData` | `submitWeeklyServiceContent` | 🔲 Planned |

## Key Constraints

1. **No user context in public functions** — Never call `base44.auth.me()` in public form backends
2. **Service role for all reads/writes** — Public forms are anonymous
3. **Rate limiting is mandatory** — All submission endpoints must have IP-based rate limiting
4. **Field whitelisting** — Submission endpoints must only write expected fields
5. **Layout is the auth gate** — The platform doesn't enforce page-level auth; our Layout does
6. **React pages inherit the app's CSP** — No inline script issues
7. **Old SSR functions preserved** — Not deleted, just deprecated