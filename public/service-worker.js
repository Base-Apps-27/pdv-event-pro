/**
 * Service Worker for PDV Event Pro — Push Notifications
 * Served statically from /service-worker.js (Vite public/ directory)
 */

// Handle incoming push messages
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

  const title = data.title || 'Palabras de Vida';
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

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Claim clients immediately on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
