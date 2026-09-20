const cacheName = 'ontrack-v1.0.2';
const applicationShellFiles = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (installEvent) => {
  installEvent.waitUntil(
    caches.open(cacheName).then((applicationCache) =>
      applicationCache.addAll(applicationShellFiles),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (activateEvent) => {
  activateEvent.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (fetchEvent) => {
  if (fetchEvent.request.method !== 'GET') return;

  fetchEvent.respondWith(
    caches.match(fetchEvent.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(fetchEvent.request)
        .then((networkResponse) => {
          if (new URL(fetchEvent.request.url).origin === location.origin) {
            caches.open(cacheName).then((applicationCache) =>
              applicationCache.put(fetchEvent.request, networkResponse.clone()),
            );
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'));
    }),
  );
});
