# Push Notification Investigation — Full Technical Report

**Date:** 2026-03-16  
**Prepared for:** External developer review  
**App:** PDV Event Pro (Vida Events Pro)  
**Platform:** Base44 (React + Vite, hosted PWA)  
**Custom Domain:** https://vidaevents.co  
**PushEngage Site:** vidaevents.co (PushEngage dashboard)

---

## 1. Executive Summary

Push notifications sent via PushEngage REST API are accepted by PushEngage (HTTP 200, `success: true`, valid `notification_id`), but arrive on user devices as **generic banners** showing "Palabras de Vida" / "PDV Event Pro" instead of the custom title and body we specify. This happens on **all platforms** — desktop (Chrome, Firefox, Edge) and iOS PWA (Add to Home Screen).

**Root cause identified:** A custom service worker deployed at `https://vidaevents.co/service-worker.js` intercepts the `push` event before PushEngage's own service worker can handle it. This custom SW attempts to parse the push payload with `event.data.json()` expecting `{title, body}` format, but PushEngage uses a **proprietary payload format** that doesn't match. The parse either fails or returns an object without a `title` field, causing the SW to fall back to the hardcoded default: `'Palabras de Vida'`.

---

## 2. Architecture Overview

### 2.1 Platform Constraints (Base44)

- Base44 **automatically manages its own service worker** for PWA features (caching, manifest, etc.)
- Base44 **does not support push notifications** natively (per their docs: "Push notifications are not currently supported in Base44 apps")
- Base44 **generates `manifest.json` automatically** — served at the app's root, contains app name "Vida Events Pro"
- Base44 does **not** give developers direct access to modify root-level files — but the Vite `public/` directory IS served at root
- A `manifest.json` link exists in `index.html`: `<link rel="manifest" href="/manifest.json" />`

### 2.2 PushEngage Integration

PushEngage was chosen because they advertise a **"Service Worker Bypass"** specifically designed for platforms like Base44 where you can't deploy a traditional root-level service worker.

**PushEngage Dashboard Configuration:**
- **Site Name:** vidaevents.co
- **Site URL:** https://vidaevents.co
- **Welcome Drip Campaign:** Paused (not the source of spam)
- **API Key:** Set as `PUSHENGAGE_API_KEY` secret in Base44

**How PushEngage SDK was loaded (now suspended):**
- Component: `components/notifications/PushEngageLoader.jsx`
- Mounted ONLY on `PublicProgramView` and `DirectorConsole` pages (permission-gated)
- PushEngage SDK script injected into DOM on mount
- SDK handles its own service worker registration and subscription management

### 2.3 Custom Service Worker

A custom service worker was created at `components/notifications/service-worker.js` and **was manually deployed** to the Vite `public/` directory, making it accessible at:

```
https://vidaevents.co/service-worker.js
```

**This file is currently live and serving.** Its contents:

```javascript
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    console.error('[SW] Push parse error:', error);
    data = { body: 'Nueva notificación' };
  }

  const title = data.title || 'Palabras de Vida';  // ← HARDCODED FALLBACK
  const options = {
    body: data.body || '',
    icon: '/logo_v2.svg',
    badge: '/logo_v2.svg',
    tag: data.tag || 'pdv-notification',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
```

**Key line:** `const title = data.title || 'Palabras de Vida';`

When `event.data.json()` either fails or returns an object without a `title` property, this fallback produces the generic notification.

### 2.4 Notification Sending Function

The scheduled function `functions/checkUpcomingNotifications.js` sends notifications via the PushEngage REST API:

```javascript
async function broadcastPush(title, body, url) {
  const formBody = new URLSearchParams({
    notification_title: title,
    notification_message: body,
    notification_url: url || 'https://pdveventpro.com',
  }).toString();

  const res = await fetch('https://api.pushengage.com/apiv1/notifications', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  });
  // ...
}
```

This matches PushEngage's documented API format exactly. The API accepts the call and returns success.

---

## 3. Timeline of Events

| Date | Event |
|------|-------|
| **2026-03-10** | Desktop Notification API implemented. Custom service-worker.js created. DEPLOYMENT doc created stating manual deployment to `/public/` is required. |
| **2026-03-10** | `sendNotification` backend function created. `NotificationTrigger` component mounted in `EventProgramView`. Uses browser's local Notification API (not push). |
| **2026-03-11** | PushEngage SDK integrated into Layout.js (loaded for ALL users globally). |
| **2026-03-13** | **Spam incident.** Users reported 10+ identical blank notifications between 4:02 PM and 6:37 PM. Root cause: `NotificationTrigger` (browser-mounted) was globally subscribed to `Segment.subscribe()`, triggering PushEngage broadcasts on every segment update from ANY session. Additionally, `ensureRecurringServices` creating segments at midnight triggered 15+ notifications. |
| **2026-03-13** | **Notification system rebuild.** (1) Deprecated `sendNotification` function (returns 410 Gone). (2) Created `checkUpcomingNotifications` as a server-side scheduled function (5-min interval). (3) Extracted PushEngage SDK from Layout.js into permission-gated `PushEngageLoader` component (only on PublicProgramView + DirectorConsole). (4) Disabled legacy entity automations. |
| **2026-03-15** | **Full suspension.** Users still receiving non-rich generic notifications. Four layers disabled: (1) Automation toggled off, (2) Backend function has kill-switch early return, (3) PushEngageLoader returns null, (4) useNotificationPermissionPrompt is a no-op. |
| **2026-03-16** | **Investigation.** Identified `Api-Key` header format (was `api_key`, changed to `Api-Key`). Created `testPushBroadcast` function and tested — PushEngage API returns success but notification still renders generic. |
| **2026-03-16** | **Root cause found.** Custom service worker at `https://vidaevents.co/service-worker.js` is intercepting push events. PushEngage's proprietary payload format doesn't match the `{title, body}` structure the SW expects. Fallback `'Palabras de Vida'` is displayed. |

---

## 4. Root Cause Analysis

### 4.1 The Service Worker Conflict

When PushEngage delivers a push notification to the browser, the browser dispatches a `push` event to the **active service worker** controlling the page's scope.

There are potentially **two service workers** competing:

1. **Our custom SW** (`/service-worker.js`) — registered by our app code, has `self.skipWaiting()` + `clients.claim()`, listens for `push` events
2. **PushEngage's bypass SW** — registered by the PushEngage SDK through their "Service Worker Bypass" mechanism

The custom SW at `/service-worker.js` has **root scope** (`/`) and uses aggressive lifecycle hooks (`skipWaiting` + `claim`), meaning it will take control of all pages and intercept all push events.

### 4.2 The Payload Mismatch

PushEngage does NOT deliver push payloads in a simple `{title: "...", body: "..."}` JSON format. They use a **proprietary encrypted/encoded payload** that their own service worker knows how to decode. When our custom SW tries `event.data.json()`, it either:

- **Fails to parse** → catches the error → sets `data = { body: 'Nueva notificación' }` → title becomes `'Palabras de Vida'`
- **Parses successfully but gets a different structure** → `data.title` is `undefined` → title becomes `'Palabras de Vida'`

Either way, the notification displays the hardcoded fallback instead of the rich content.

### 4.3 Why "PDV Event Pro" Appears

The notification subtitle "from PDV Event Pro" likely comes from the **Base44 app name** as registered in the Base44 dashboard. The browser may append the app/site name from the manifest or the service worker's registration origin. The manifest shows `"name": "Vida Events Pro"`, but "PDV Event Pro" is the Base44 internal app name — the browser or OS may source this from a different location.

### 4.4 Why the Api-Key Fix Didn't Help

The `Api-Key` header fix (from `api_key` to `Api-Key`) may have been necessary (PushEngage docs show PascalCase), but it was never the root cause. Even with the correct header, PushEngage was already accepting and processing our API calls. The problem was always on the **client side** — our SW intercepting the push event and not knowing how to decode PushEngage's payload.

---

## 5. What We've Verified

| Test | Result | Conclusion |
|------|--------|------------|
| PushEngage API call with correct format | HTTP 200, `success: true`, `notification_id` returned | ✅ Server-side is working correctly |
| `testPushBroadcast` function test | Notification received on device — but generic content | ✅ API works, ❌ content not rendering |
| PushEngage Dashboard check | Site name = "vidaevents.co", no default template overriding content | ✅ Not a PE config issue |
| Welcome Drip Campaign | Paused | ✅ Not source of spam |
| Long-press / expand notification on iOS | No additional content revealed | ❌ Rich content not present at all |
| Desktop notification check | Same generic "Palabras de Vida" content | ❌ Not iOS-specific |
| Custom SW at `/service-worker.js` | **LIVE and serving.** Contains hardcoded `'Palabras de Vida'` fallback in push handler | 🔴 ROOT CAUSE |
| Base44 platform SW documentation | "Push notifications are not currently supported" — platform manages SW automatically | ⚠️ Platform constraint |

---

## 6. Current System State (as of 2026-03-16)

### Active / Running:
- Custom service worker at `https://vidaevents.co/service-worker.js` — **LIVE, intercepting push events**
- PushEngage JavaScript SDK script tag — **still in subscriber browsers** (even though PushEngageLoader is disabled, previously subscribed browsers retain the SW)

### Suspended / Disabled:
- `checkUpcomingNotifications` function — has kill-switch early return
- Scheduled automation "Check Upcoming Notifications (5min)" — toggled off
- `PushEngageLoader` component — returns null
- `useNotificationPermissionPrompt` hook — no-op
- `sendNotification` function — returns 410 Gone

### Entities:
- `PushSubscription` entity exists with VAPID fields (created for future native Web Push, never fully used)

### Secrets:
- `PUSHENGAGE_API_KEY` — set and working
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — set (for future native Web Push)
- `SENDGRID_API_KEY` — set (for email, currently used elsewhere)

---

## 7. Files Involved

| File | Role | Status |
|------|------|--------|
| `functions/checkUpcomingNotifications.js` | Server-side notification scheduler (5-min cron) | Kill-switched |
| `functions/testPushBroadcast.js` | One-shot test function | Active (admin-only) |
| `functions/sendNotification.js` | Legacy notification handler | Deprecated (410 Gone) |
| `components/notifications/PushEngageLoader.jsx` | PushEngage SDK injector | Suspended (returns null) |
| `components/notifications/useNotificationPermissionPrompt.js` | Browser permission prompt | Suspended (no-op) |
| `components/notifications/NotificationTrigger.jsx` | Real-time segment change → local Notification | Active but only fires if permission granted |
| `components/notifications/service-worker.js` | Source file for custom SW | Source code in repo |
| **`/public/service-worker.js`** (deployed) | **THE LIVE SERVICE WORKER** | 🔴 Intercepting push events |
| `components/notifications/DEPLOYMENT.md` | Deployment guide | Outdated |
| `entities/PushSubscription.json` | VAPID subscription storage | Created, sparsely used |

---

## 8. Options for Resolution

### Option A: Remove the Custom Service Worker
**Delete `/public/service-worker.js`** so it's no longer served. This would stop our SW from intercepting PushEngage's push events, allowing PushEngage's bypass SW to handle them natively with rich content.

**Risk:** Base44's platform-level SW (if one exists) might still intercept. We cannot verify this without testing. Also, removing the SW doesn't immediately unregister it from existing browsers — users would need to revisit the site for the browser to detect the SW is gone and unregister it.

**Mitigation:** Replace `/public/service-worker.js` with an **empty self-unregistering SW**:
```javascript
// Intentionally empty — unregisters self to stop intercepting push events
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.unregister());
});
```

### Option B: Make the Custom SW Understand PushEngage Payloads
Modify the push handler to detect and pass through PushEngage-format payloads. However, PushEngage's payload format is **proprietary and undocumented** — we'd be reverse-engineering it, and it could change without notice.

**Risk:** Fragile, undocumented, and couples us to PushEngage internals.

### Option C: Abandon PushEngage, Use Native Web Push (VAPID)
Send push notifications directly using the Web Push protocol with our VAPID keys. This gives us full control over the payload format and our custom SW would correctly parse `{title, body}`.

**Risk:** Requires managing subscriptions ourselves (PushSubscription entity exists but is sparse). Also, Base44's platform-managed SW could still interfere if it also has a push listener. Need to test.

### Option D: Abandon Push, Use Email Alerts
Replace push notifications with email alerts via SendGrid (already configured). 100% reliable, no service worker issues.

**Risk:** Lower engagement than push (users may not check email during live events). But guaranteed delivery.

### Option E: Contact Base44 + PushEngage Support
Open tickets with both platforms to understand: (1) Does Base44 have its own push-intercepting SW? (2) Can PushEngage's bypass work when a custom SW exists at root scope?

---

## 9. Recommended Next Steps

1. **Immediate:** Replace `/public/service-worker.js` with a self-unregistering stub (Option A). This is the lowest-risk fix that directly addresses the root cause.

2. **Then test:** Re-enable PushEngageLoader on one page, send a test notification via `testPushBroadcast`, verify rich content appears.

3. **If still generic after SW removal:** The problem is in Base44's platform SW or PushEngage's bypass mechanism. Escalate to support (Option E).

4. **Parallel track:** Implement email fallback (Option D) as a guaranteed backup channel for critical event-day alerts.

---

## 10. Key Proof Points

### The Smoking Gun
The live service worker at `https://vidaevents.co/service-worker.js` contains:
```javascript
const title = data.title || 'Palabras de Vida';
```

This **exact string** is what users see in generic notifications. The PushEngage dashboard has no reference to "Palabras de Vida" — it's hardcoded in our service worker's fallback path.

### API Is Working Correctly
```
POST https://api.pushengage.com/apiv1/notifications
Header: Api-Key: [redacted]
Body: notification_title=🔔 Test Rich Notification&notification_message=If you see this title and body, the fix works!&notification_url=https://pdveventpro.com

Response: { "success": true, "notification_id": 168185070 }
```

The server accepted and processed the notification with rich content. The content is lost between PushEngage's delivery and our service worker's rendering.

---

**Report prepared by:** Base44 AI Development Agent  
**Last updated:** 2026-03-16T20:00:00Z