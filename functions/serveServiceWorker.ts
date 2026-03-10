/**
 * Serves the service worker script
 * Called by Layout via fetch('/api/functions/serveServiceWorker')
 * 2026-03-10: Created to support VAPID-based Web Push registration
 */
Deno.serve(async (req) => {
  // CORS for service worker registration
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const swCode = `
/**
 * Service Worker for PDV Event Pro
 * Handles push notifications and background message delivery
 * 2026-03-10: Generated from backend function
 */

// Handle incoming push messages
self.addEventListener('push', (event) => {
  console.log('[SW:PUSH] Event received');
  
  let data = {};
  try {
    if (event.data) {
      data = event.data.json ? event.data.json() : { body: event.data.text() };
    }
  } catch (error) {
    console.error('[SW:PUSH_PARSE]', error);
    data = { body: 'Nueva notificación / New notification' };
  }

  const title = data.title || 'Palabras de Vida';
  const options = {
    body: data.body || '',
    icon: '/pdv-icon.png',
    badge: '/pdv-badge.png',
    tag: data.tag || 'pdv-notification',
    requireInteraction: data.requireInteraction || false,
    data: data.meta || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW:CLICK] Notification clicked');
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url === urlToOpen && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Activate immediately (claim all clients)
self.addEventListener('activate', (event) => {
  console.log('[SW:ACTIVATE]');
  event.waitUntil(clients.claim());
});
`;

  return new Response(swCode, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
});