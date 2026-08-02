// Bump this on every deploy that changes the shell — old caches are deleted on activate.
const CACHE_NAME = 'matchday-shell-v1';
const SHELL_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle same-origin app-shell requests; live Sheet data and third-party CDN scripts always go straight to the network.
  if(req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if(req.mode === 'navigate' || req.url.endsWith('/index.html')){
    // Network-first for the HTML shell so a fresh deploy is picked up immediately; cache is only an offline fallback.
    event.respondWith(
      fetch(req)
        .then(res => { caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  if(SHELL_ASSETS.some(asset => req.url.endsWith(asset.replace('./','')))){
    // Cache-first for static assets (icons/manifest), refreshed in the background.
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req)
          .then(res => { caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone())); return res; })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
