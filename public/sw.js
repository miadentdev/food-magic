const cacheName = 'ontrack-v1.0.3';
const applicationShellFiles = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];
const staticAssetPattern = /\.(?:avif|bmp|css|eot|gif|ico|jpe?g|js|mjs|otf|png|svg|ttf|txt|webmanifest|webp|woff2?)$/i;

self.addEventListener('install', (installEvent) => {
  installEvent.waitUntil(
    caches.open(cacheName)
      .then((applicationCache) => applicationCache.addAll(applicationShellFiles))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (activateEvent) => {
  activateEvent.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name.startsWith('ontrack-') && name !== cacheName)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

function cacheLatestIndex(response) {
  if (response.ok) {
    caches.open(cacheName).then((applicationCache) =>
      applicationCache.put('/index.html', response.clone()),
    );
  }
  return response;
}

function networkFirstNavigation(request) {
  return fetch(request, { cache: 'no-store' })
    .then(cacheLatestIndex)
    .catch(() => caches.match('/index.html'));
}

function cacheFirstStaticAsset(request) {
  return caches.match(request).then((cachedResponse) => {
    if (cachedResponse) return cachedResponse;

    return fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        caches.open(cacheName).then((applicationCache) =>
          applicationCache.put(request, networkResponse.clone()),
        );
      }
      return networkResponse;
    });
  });
}

self.addEventListener('fetch', (fetchEvent) => {
  const { request } = fetchEvent;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || url.pathname === '/index.html') {
    fetchEvent.respondWith(networkFirstNavigation(request));
    return;
  }

  if (staticAssetPattern.test(url.pathname)) {
    fetchEvent.respondWith(cacheFirstStaticAsset(request));
  }
});
