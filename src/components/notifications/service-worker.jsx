/* eslint-disable no-undef */
/**
 * Service Worker for Vida Events Pro — Merged with PushEngage
 * DEPLOY TO: /public/service-worker.js manually
 *
 * 2026-03-16: MERGED PushEngage service worker via importScripts.
 *   PushEngage's SW handles push event parsing (proprietary payload format),
 *   notification display, click analytics, and subscription lifecycle.
 *   Our custom push listener was REMOVED because it intercepted push events
 *   before PushEngage could process them, causing generic "Palabras de Vida"
 *   fallback notifications. See: components/docs/PUSH_NOTIFICATION_INVESTIGATION.md
 *
 * 2026-03-16: PushEngage dashboard setting "Enable the service worker registration
 *   from PushEngage" must be turned OFF after deploying this merged file.
 *   PushEngage docs: https://www.pushengage.com/documentation/how-to-merge-service-worker-with-existing-one-on-your-site/
 *
 * SEQUENCE:
 *   1. importScripts loads PushEngage's push handler (handles push events)
 *   2. Our notificationclick listener adds deep-link routing to session/segment
 *   3. install/activate ensure immediate takeover
 *
 * ROLLBACK: Remove the importScripts line, restore the old push listener,
 *   and re-enable PE's registration toggle in their dashboard.
 */

// PushEngage's service worker — handles push payload decryption, notification
// rendering, view/click analytics. This is the one-line merge per PE docs.
// appId: 968eaa2b-cba4-4999-b736-393668e20d9b (vidaevents.co)
importScripts("https://clientcdn.pushengage.com/sdks/service-worker.js");

// NOTE: We intentionally do NOT add our own 'push' event listener.
// PushEngage's importScripts above registers its own push handler that
// understands their proprietary payload format. Adding a second push listener
// would cause duplicate notifications or intercept before PE can process.

// Custom click routing — deep-links notification taps to the relevant
// session/segment in PublicProgramView. PushEngage handles its own click
// analytics via its SW, but this adds our app-specific navigation.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // PushEngage notifications store data differently than our custom ones.
  // Safely extract our custom routing data if present.
  const notifData = event.notification.data || {};
  const sessionId = notifData.sessionId;
  const segmentId = notifData.segmentId;

  // Only apply custom routing if our data fields are present.
  // Otherwise, let PushEngage's default click handler (notification_url) work.
  if (!sessionId && !segmentId) return;

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
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Immediate activation — take control from any previous SW version
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});