// ========== FILE: public/sw.js ==========
// Service Worker untuk PWM Luxury – PWA + Push Notification
// DS001: Gabungan dari PWA caching dan push event

const CACHE_NAME = 'pwm-v2.3'; // increment version

const urlsToCache = ['/', '/index.html', '/manifest.json'];

// ---------- INSTALL ----------
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// ---------- FETCH ----------
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
  }
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  event.waitUntil(clients.claim());
});

// ============================================================
// DS001: PUSH EVENT LISTENER
// ============================================================
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: 'PWM Luxury',
      body: event.data?.text() || 'Ada notifikasi baru',
      data: {}
    };
  }

  const options = {
    body: payload.body || payload.message,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    sound: '/sounds/notification.mp3', // jika file ada
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'PWM Luxury', options)
  );
});

// ============================================================
// DS001: KLIK NOTIFIKASI – ARAHKAN KE HALAMAN ORDER
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data;
  let url = '/';
  if (data && data.order_id) {
    if (data.type && data.type.startsWith('delivery_')) {
      url = `/member/orders/${data.order_id}`;
    } else {
      url = `/admin/order/${data.order_id}`; // pastikan route admin order detail sesuai
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.host) && 'focus' in client) {
          client.focus();
          client.postMessage({ action: 'navigate', url });
          return;
        }
      }
      clients.openWindow(url);
    })
  );
});