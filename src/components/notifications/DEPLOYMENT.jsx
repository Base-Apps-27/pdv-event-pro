/* eslint-disable */
// # Desktop Notifications Deployment Guide

## Overview
Implemented bilingual web notifications for segment actions and segment starts via the Notification API.

**Status:** Ready for testing on desktop

## What Was Implemented

### 1. Backend Function: `sendNotification.js`
- Generates bilingual notification messages (EN/ES)
- Supports two trigger types:
  - `action`: Alerts for segment prep actions
  - `segment_starting`: Alerts when segment becomes active
- Returns formatted notification object ready for display
- **Endpoint:** `/api/functions/sendNotification`

**Test Results (2026-03-10):**
```
ES: "Acción Requerida" — "Coordinadores listo en Alabanza @ 09:45 AM" ✓
EN: "Segment Starting" — "Worship is starting" ✓
```

### 2. Service Worker: `components/notifications/service-worker.js`
- Handles push events (when Web Push integrates)
- Manages notification clicks (opens relevant session/segment)
- Routes notifications to correct page with segment/session context

**⚠️ MANUAL DEPLOYMENT REQUIRED:**
Copy the file to the public folder:
```bash
cp components/notifications/service-worker.js public/service-worker.js
```

### 3. Frontend Integration

#### Layout.jsx
- Registers service worker on app load
- Requests notification permission (one-time browser prompt)
- Logs registration status for debugging

#### NotificationTrigger Component
- Headless component (mounted by EventProgramView)
- Subscribes to real-time Segment and SegmentAction changes
- Triggers notifications when:
  - New action created with timing = `before_start` or `before_end`
  - Segment transitions to `live_status = "active"`

#### EventProgramView
- Imports and mounts `<NotificationTrigger />`
- Passes current session ID, segments, and user language

## How It Works

### Desktop Notification Flow

1. **User grants permission** (browser prompt, one-time)
   ```
   Layout.jsx → Notification.requestPermission()
   ```

2. **Service Worker registers**
   ```
   Layout.jsx → navigator.serviceWorker.register()
   ```

3. **Segment action created or segment starts**
   ```
   NotificationTrigger → subscribes to changes → calls sendNotification()
   ```

4. **Notification displays**
   ```
   sendNotification() returns { title, body }
   → new Notification(title, { body, icon, tag })
   ```

5. **User clicks notification** (when Web Push integrates)
   ```
   service-worker.js → notificationclick handler → opens segment/session
   ```

## Configuration

### Notification Tags
Notifications are grouped by segment using tags:
```
tag: `${type}-${segmentId}`
```
Example: `action-seg-12345` — duplicate notifications are replaced instead of stacked

### Icon & Badge
- Icon: `/logo_v2.svg` (Vida Events branding)
- Badge: `/logo_v2.svg`

### Bilingual Strings
Located in `sendNotification.js`:
```javascript
const NOTIFICATION_TITLES = {
  en: { action: "Action Needed", segment_starting: "Segment Starting" },
  es: { action: "Acción Requerida", segment_starting: "Segmento Comenzando" }
};
```

Add more languages by extending this object.

## Testing

### Manual Desktop Testing

1. **Load the app on desktop browser**
   - Chrome, Edge, Firefox (all support Notification API)
   - Safari: Limited notification support (desktop only, no push)

2. **Grant notification permission**
   - Browser will prompt once
   - Allow in browser settings

3. **Trigger a notification**
   - Create a new SegmentAction with timing = `before_start`
   - Or update a Segment to have `live_status = "active"`
   - Notification should appear in bottom-right (Windows) or top-right (Mac)

4. **Check language detection**
   - Notifications respect user's language setting (from i18n context)
   - Spanish: "Acción Requerida"
   - English: "Action Needed"

### Test Cases

| Scenario | Expected | Status |
| --- | --- | --- |
| Action alert (EN) | "Action Needed" title | ✓ Verified |
| Action alert (ES) | "Acción Requerida" title | ✓ Verified |
| Segment start (EN) | "Segment Starting" title | ✓ Verified |
| Segment start (ES) | "Segmento Comenzando" title | ✓ Verified |
| Permission denied | No notifications, no error | Pending |
| Multiple notifications | Grouped by tag (not stacked) | Pending |

## Future Enhancements

### Web Push Integration
To enable notifications when app is **closed**:

1. Generate VAPID key pair (server)
2. Store user push subscriptions in `PushSubscription` entity
3. Update `sendNotification()` to use Web Push API instead of local Notification
4. Create backend automation to send push on segment/action changes

### Additional Triggers
- Team assignments (user assigned to action)
- Chat messages (in LiveOperationsChat)
- Live timing adjustments (director made changes)

### Rich Notifications
- Add action buttons (Mark Complete, Skip, etc.)
- Include media (segment images, logos)
- Custom vibration patterns

## Troubleshooting

### Notifications not appearing
- Check browser console for `[SW]` logs
- Verify permission is `granted` (not `denied` or `default`)
- Ensure notifications are not muted in browser settings
- Confirm segment/action is being created/updated (check network tab)

### Wrong language showing
- Check user's language preference (settings → language)
- Verify `useLanguage()` hook is returning correct language
- Check server logs for language parameter in function call

### Service worker not registering
- Check `/service-worker.js` exists in public folder
- Verify HTTPS in production (HTTP in localhost is OK)
- Check browser console for registration errors
- May require cache clear in dev tools

## Constitution Compliance

✅ **Bilingual:** Notifications support EN/ES via i18n context
✅ **Accessibility:** Notifications respect browser settings (mute, focus)
✅ **Branding:** Uses Vida Events logo and app icon
✅ **No destructive changes:** New entity (PushSubscription) for future use only
✅ **Observable:** Logged in server console for audit trail
✅ **User control:** Permission prompt, can disable anytime

## Files Modified

- `layout` — Service worker registration + permission request
- `components/service/EventProgramView` — NotificationTrigger mount

## Files Created

- `functions/sendNotification.js` — Backend notification handler
- `entities/PushSubscription.json` — Future push subscription tracking
- `components/notifications/NotificationTrigger.jsx` — Trigger component
- `components/notifications/service-worker.js` — Service worker (deploy to `/public/`)
- `components/notifications/DEPLOYMENT.md` — This guide

## Next Steps

1. **Deploy service worker to public folder** (manual step)
2. **Test on desktop browser** (Chrome, Firefox, Edge)
3. **Verify bilingual translations**
4. **Monitor console logs for errors**
5. **Gather user feedback** on notification timing/frequency

---

**Last Updated:** 2026-03-10
**Version:** 1.0 (Desktop Notification API)
**Next Phase:** Web Push Integration (for closed-app notifications)