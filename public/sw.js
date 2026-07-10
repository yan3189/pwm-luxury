// ========== FILE: public/sw.js ==========
const CACHE_NAME = 'pwm-v2.2'; // Ganti versi setiap ada update besar
const urlsToCache = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  // Force waiting service worker to become active
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Jika yang diminta adalah halaman utama atau index.html, gunakan strategi Network-First
  if (url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache dengan versi terbaru dari network
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)) // Jika offline, baru ambil dari cache
    );
  } else {
    // Untuk aset lainnya, jalankan strategi bawaan Anda semula
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  }
});

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
  // Take control of all clients immediately
  event.waitUntil(clients.claim());
});