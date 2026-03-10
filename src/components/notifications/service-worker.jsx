/**
 * Service Worker for PDV Event Pro
 * DEPLOY TO: /public/service-worker.js manually
 * 
 * Handles notification events and click routing.
 * 2026-03-10: Desktop notification support (Web Notification API)
 */

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW:PUSH] No data');
    return;
  }

  let notificationData = {};
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: 'Notification',
      body: event.data.text(),
    };
  }

  const { title, body, tag, data = {} } = notificationData;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      badge: '/logo_v2.svg',
      icon: '/logo_v2.svg',
      data,
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { sessionId, segmentId } = event.notification.data;

  let targetUrl = '/PublicProgramView';
  if (sessionId) {
    targetUrl += `?session=${sessionId}`;
  }
  if (segmentId) {
    targetUrl += `${sessionId ? '&' : '?'}segment=${segmentId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});