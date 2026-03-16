/**
 * Service Worker for PDV Event Pro — Merged with PushEngage SDK
 * Served statically from /service-worker.js (Vite public/ directory)
 *
 * 2026-03-16: MERGED ARCHITECTURE
 * ─────────────────────────────────
 * PushEngage SDK is loaded via importScripts. This lets PE own:
 *   - Push event decryption & notification rendering (rich content)
 *   - Subscription lifecycle & analytics
 *
 * Our custom code handles ONLY:
 *   - notificationclick → deep-link to PublicProgramView with session/segment context
 *
 * CRITICAL: Do NOT add a custom 'push' event listener here.
 * PushEngage payloads are encrypted/proprietary. A custom push listener
 * intercepts them, fails to parse, and shows generic fallback text.
 * See: PUSH_NOTIFICATION_INVESTIGATION doc + AttemptLog entries.
 *
 * PushEngage Dashboard Setting:
 *   "Enable the service worker registration from PushEngage" = OFF
 *   (We register this SW ourselves via PushEngageLoader component)
 */

// ── Load PushEngage SDK service worker ──
// This gives PE control over push event handling, notification display,
// impression tracking, and click analytics.
try {
  importScripts('https://clientcdn.pushengage.com/sdks/service-worker.js');
} catch (e) {
  console.error('[SW] Failed to load PushEngage SW:', e);
}

// ── Custom notificationclick handler ──
// Deep-links to PublicProgramView with session/segment context.
// PE's own click handler runs first (for analytics); ours adds app routing.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const { sessionId, segmentId } = notifData;

  let targetUrl = '/PublicProgramView';
  if (sessionId) {
    targetUrl += `?session=${sessionId}`;
  }
  if (segmentId) {
    targetUrl += `${sessionId ? '&' : '?'}segment=${segmentId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/PublicProgramView') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Lifecycle: activate immediately ──
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
