# PDV Event Pro — Comprehensive Security & Code Review

**Date:** 2026-03-12
**Scope:** Full codebase (43 backend functions, ~180 frontend files, config, utilities)
**Reviewed by:** Automated deep audit

---

## Issue Summary Table

| # | Severity | Category | File | Issue |
|---|----------|----------|------|-------|
| 1 | **CRITICAL** | Auth Bypass | `src/lib/app-params.js:41` | Auth token passed via URL query string |
| 2 | **CRITICAL** | Auth Bypass | `src/pages/PublicCountdownDisplay.jsx:36-41` | Override params bypass authorization |
| 3 | **CRITICAL** | Placeholder | `functions/deleteUserAccount.ts` | Account deletion is a no-op placeholder |
| 4 | **HIGH** | XSS | `src/lib/VisualEditAgent.jsx:242,534` | `postMessage('*')` — wildcard origin |
| 5 | **HIGH** | XSS | `src/components/service/weekly/EmptyDayPrompt.jsx:166` | `dangerouslySetInnerHTML` without DOMPurify |
| 6 | **HIGH** | Info Leak | `functions/sendEmailWithPDF.ts:60` | SendGrid error details returned to client |
| 7 | **HIGH** | Info Leak | `functions/uploadToDrive.ts:86` | Drive API error status leaked to client |
| 8 | **HIGH** | Injection | `functions/uploadToDrive.ts:33-34` | Unsanitized `eventName` in Drive query |
| 9 | **HIGH** | CORS | Multiple functions | `Access-Control-Allow-Origin: *` on 9 endpoints |
| 10 | **HIGH** | Auth | `src/pages/DevTools.jsx` | Admin surface protected only client-side |
| 11 | **MEDIUM** | Rate Limit | `functions/submit*.ts` | In-memory rate limiting resets on cold start |
| 12 | **MEDIUM** | Race | `functions/submit*.ts:32-48` | TOCTOU race in rate limiting check-then-act |
| 13 | **MEDIUM** | Race | `functions/storePushSubscription.ts:31-44` | Filter-then-create dedup race condition |
| 14 | **MEDIUM** | Config | `functions/sendEmailWithPDF.ts:33` | Hardcoded sender email address |
| 15 | **MEDIUM** | Info Leak | `src/components/utils/ErrorBoundary.jsx:34-38` | Stack traces logged and shown in production |
| 16 | **MEDIUM** | Validation | `functions/getArtsFormData.ts` | No request body size limit on GET endpoints |
| 17 | **MEDIUM** | Auth | `functions/updateLiveSegmentTiming.ts:42-43` | Permission check doesn't use role hierarchy |
| 18 | **MEDIUM** | Pagination | `functions/getSegmentsBySessionIds.ts` | No total result limit, only session ID limit |
| 19 | **LOW** | Code Quality | `functions/parseScriptureShared.ts` + 3 files | BIBLE_BOOKS dictionary duplicated 4x |
| 20 | **LOW** | Dead Code | `functions/serve*.ts` (3 files) | Deprecated redirect functions still deployed |
| 21 | **LOW** | Info Leak | `src/pages/PublicProgramView.jsx:361` | Supabase project ID exposed in image URL |
| 22 | **LOW** | Validation | `functions/submitWeeklyServiceContent.ts:62-73` | Weak URL validation (prefix check only) |
| 23 | **LOW** | Secrets | `functions/generateVAPIDKeys.ts:52` | VAPID private key logged to console |

---

## Detailed Findings

### CRITICAL-1: Auth Token Passed via URL Query String

**File:** `src/lib/app-params.js:41`
**Category:** Authentication

```javascript
token: getAppParamValue("access_token", { removeFromUrl: true }),
```

The access token is read from `?access_token=...` URL query parameter. While `removeFromUrl: true` calls `history.replaceState()` afterward, the token is exposed:

- In browser history before `replaceState` fires
- In HTTP `Referer` headers sent to third-party resources (images, scripts, analytics)
- In web server access logs
- In any browser extension that reads URLs

Additionally, at line 22-24, **any URL parameter is blindly stored in localStorage** with no validation:
```javascript
if (searchParam) {
    storage.setItem(storageKey, searchParam);  // No validation!
    return searchParam;
}
```

An attacker could inject `?server_url=https://evil.com` to redirect all API calls to a malicious server, stealing user data.

**Fix:** Use fragment-based tokens (`#access_token=...`) which are never sent in HTTP headers, or switch to HTTP-only secure cookies. Validate `server_url` against an allowlist.

---

### CRITICAL-2: Override Parameters Bypass Authorization

**File:** `src/pages/PublicCountdownDisplay.jsx:36-41`
**Also:** `src/pages/PublicProgramView.jsx:68-77`

```javascript
const override_service_id = searchParams.get('override_service_id');
const override_event_id = searchParams.get('override_event_id');
const mockTimeParam = searchParams.get('mock_time');
```

Any user can view any service or event content by crafting URLs:
```
/PublicCountdownDisplay?override_service_id=<any_id>&override_event_id=<any_id>
```

No authorization check validates whether the user should access the overridden resource. The `mock_time` parameter also allows arbitrary timeline manipulation with no permission check.

**Fix:** Remove override parameters from production builds, or gate them behind an admin permission check:
```javascript
const canOverride = user && hasPermission(user, 'manage_users');
const override_service_id = canOverride ? searchParams.get('override_service_id') : null;
```

---

### CRITICAL-3: Account Deletion is a No-Op Placeholder

**File:** `functions/deleteUserAccount.ts`

The entire function is a documented placeholder that **returns `{ success: true }` without actually deleting anything**. The UI (`AccountDeletionSection.jsx`) presumably calls this and tells the user their account was deleted.

This violates GDPR, CCPA, and App Store compliance requirements. Users believe their data was deleted when it was not.

**Fix:** Implement actual deletion logic or return an honest response like `{ status: 'pending_manual_review' }`.

---

### HIGH-4: postMessage with Wildcard Origin

**File:** `src/lib/VisualEditAgent.jsx:242, 534`

```javascript
window.parent.postMessage(elementData, '*');
window.parent.postMessage({ type: 'visual-edit-agent-ready' }, '*');
```

The wildcard `'*'` target origin means any parent frame can receive messages containing DOM structure, CSS classes, and element content. The codebase acknowledges this is a platform constraint (see `AUDIT_REMEDIATION_COMPLETE.jsx:53`), but it remains a real risk if the app is ever embedded by a malicious parent.

**Fix:** If the parent origin is known, specify it. If this is a platform limitation, document the accepted risk formally.

---

### HIGH-5: dangerouslySetInnerHTML Without Sanitization

**File:** `src/components/service/weekly/EmptyDayPrompt.jsx:166-171`

```jsx
dangerouslySetInnerHTML={{
    __html: t('empty.blueprintWillUse')
        .replace('{name}', blueprintData.name || 'Blueprint')
        .replace('{count}', (blueprintData.segments || []).length)
}}
```

`blueprintData.name` comes from user-created data and is inserted directly into an HTML string without sanitization. If a blueprint name contains `<img onerror=alert(1)>`, it executes JavaScript.

Other `dangerouslySetInnerHTML` uses in the codebase properly use `sanitizeHtml()` (DOMPurify), but this instance does not.

**Also at:** `src/components/service/v2/segments/FieldRenderer.jsx:114` — uses `t('field.versesReadOnly')` which is a translation string (safe if translations are trusted, but fragile pattern).

**Fix:**
```jsx
import { sanitizeHtml } from '@/components/utils/sanitizeHtml';
// ...
dangerouslySetInnerHTML={{
    __html: sanitizeHtml(
        t('empty.blueprintWillUse')
            .replace('{name}', blueprintData.name || 'Blueprint')
            .replace('{count}', (blueprintData.segments || []).length)
    )
}}
```

---

### HIGH-6 & HIGH-7: API Error Details Leaked to Client

**File:** `functions/sendEmailWithPDF.ts:60`
```javascript
return Response.json({ error: 'Failed to send email', details: error }, { status: 500 });
```

**File:** `functions/uploadToDrive.ts:86`
```javascript
return Response.json({ error: `Drive init failed: ${initRes.status}` }, { status: 502 });
```

**Also:** `functions/generateServiceProgramPdf.ts:69,86`, `functions/deleteUserAccount.ts:39`

Third-party API error responses may contain internal details (API keys in error messages, internal hostnames, stack traces). These should be logged server-side only.

**Fix:** Return generic error messages to clients. Log detailed errors server-side:
```javascript
console.error('SendGrid error:', error);
return Response.json({ error: 'Email delivery failed' }, { status: 502 });
```

---

### HIGH-8: Unsanitized Input in Google Drive Query

**File:** `functions/uploadToDrive.ts:33-34`

```javascript
let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
```

The `name` parameter is derived from user-controlled `eventName`. A name like `test' or name!='` could manipulate the Drive query. While Google's API likely escapes this, it's a defense-in-depth failure.

**Fix:** Escape single quotes in the folder name:
```javascript
const safeName = name.replace(/'/g, "\\'");
let q = `name='${safeName}' and ...`;
```

---

### HIGH-9: Wildcard CORS on 9 Endpoints

**Files:** `submitArtsSegment.ts`, `submitSpeakerContent.ts`, `submitWeeklyServiceContent.ts`, `getArtsFormData.ts`, `getSpeakerFormData.ts`, `getSpeakerOptions.ts`, `getWeeklyFormData.ts`, `getArtsChangeHistory.ts`, `updateLiveSegmentTiming.ts`

All set `Access-Control-Allow-Origin: *`. For public form endpoints (no auth), this is acceptable. But `updateLiveSegmentTiming.ts` **requires authentication** and should not use wildcard CORS — it allows any origin to make credentialed requests.

**Fix:** For authenticated endpoints, set the origin to the known app domain:
```javascript
'Access-Control-Allow-Origin': req.headers.get('origin') || 'https://your-app.com'
```

---

### HIGH-10: Admin DevTools — Client-Side Only Authorization

**File:** `src/pages/DevTools.jsx:18-34`

```jsx
const isAdmin = user && hasPermission(user, "manage_users");
if (!isAdmin) return <Shield ... />;
```

The admin check is purely client-side. The actual admin pages (SchemaGuide, DependencyTracker, ActivityLog) are bundled into the JavaScript and could be accessed by modifying the client code or calling the underlying data APIs directly.

**Fix:** Ensure all data fetched by DevTools pages requires server-side permission validation.

---

### MEDIUM-11: Ephemeral In-Memory Rate Limiting

**Files:** `submitArtsSegment.ts`, `submitSpeakerContent.ts`, `submitWeeklyServiceContent.ts`, `getSpeakerOptions.ts`

Rate limiting uses a `Map()` that resets on every cold start (~60s idle on Deno Deploy). An attacker can burst requests, wait for cold start, and repeat indefinitely.

**Fix:** Implement persistent rate limiting (e.g., entity-based counters with TTL, or use a Rate Limit entity):
```typescript
// Layer 2: Check entity-based rate limit
const recentSubmissions = await base44.asServiceRole.entities.RateLimit.filter({
    ip: clientIp, created_date_gte: new Date(Date.now() - 60000).toISOString()
});
```

---

### MEDIUM-12: TOCTOU Race in Rate Limiting

**Files:** All rate-limited functions

```javascript
const attempts = rateLimiter.get(clientIp).filter(t => now - t < windowMs);
if (attempts.length >= maxAttempts) { return 429; }  // CHECK
attempts.push(now);                                    // ACT
```

Between the check and act, concurrent requests can all pass the check simultaneously.

**Fix:** Use atomic increment patterns or accept this as a known limitation of in-memory rate limiting (document and mitigate with Layer 2).

---

### MEDIUM-14: Hardcoded Sender Email

**File:** `functions/sendEmailWithPDF.ts:33`

```javascript
from: { email: 'danny.sena@ccpvida.org', name: 'Palabras de Vida' },
```

Hardcoded production email. Should be an environment variable for portability and to avoid exposing personal email in source control.

---

## Architecture Observations

### Positive Security Patterns
- DOMPurify sanitization used consistently for announcement HTML rendering
- SSRF protection in `fetchUrlMetadata.ts` with comprehensive private IP blocking
- Honeypot fields on public forms for bot mitigation
- HTML escaping in email templates (`sendChatNotification.ts`)
- Body size limits (100KB) on submission endpoints
- Proper auth checks on most authenticated endpoints
- Permission hierarchy system is well-designed and correctly implemented

### Systemic Issues Worth Addressing

1. **Client-side authorization pattern:** Multiple pages check permissions client-side only (DevTools, UserManagement bulk ops, override parameters). The platform's entity SDK may enforce some server-side checks, but sensitive operations should not rely solely on client-side gates.

2. **Inconsistent error handling:** Some functions return detailed third-party errors (`details: error`), others return generic messages. Standardize on generic client-facing errors with server-side detailed logging.

3. **Code duplication in functions/:** The `BIBLE_BOOKS` dictionary is duplicated across 4 files. Rate limiting boilerplate is copy-pasted across 4 endpoints. Extract shared modules.

4. **No CSP headers:** The application doesn't set Content-Security-Policy headers, which would mitigate XSS impact even if injection occurs.

---

## Top 3 Most Urgent Fixes

### 1. Remove/secure URL parameter injection vector (`app-params.js`)
The `server_url` parameter can redirect all API calls to an attacker-controlled server. The `access_token` in URL leaks via Referer headers. This is the highest-impact vulnerability because it enables complete account takeover via a single crafted link.

### 2. Sanitize `dangerouslySetInnerHTML` in `EmptyDayPrompt.jsx`
This is a straightforward stored XSS via blueprint names. Any user who can create a blueprint can inject JavaScript that executes for all users who view the weekly service editor. Fix is a one-line import of the existing `sanitizeHtml` utility.

### 3. Implement actual account deletion (`deleteUserAccount.ts`)
This is a compliance violation (GDPR/CCPA/App Store) that returns false success to users. Either implement real deletion or change the response to be honest about the pending state.

---

## Dependency Notes

- All major dependencies are recent versions (React 18, Vite 6, etc.)
- `lodash@4.17.21` is the latest and includes prototype pollution fixes
- `dompurify@3.2.4` is current — good
- No known critical CVEs in the dependency tree at review time
- `pdfmake@0.2.13` is current

---

*End of security audit report.*
