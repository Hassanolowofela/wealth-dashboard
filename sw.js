/* ==========================================================================
   Service worker - makes the dashboard installable and fully offline.

   Bump CACHE when you change any app file, or browsers will keep serving the
   old copy. The app reads this same version to show "update available".
   ========================================================================== */
'use strict';

const VERSION = '1.4.0';
const CACHE = 'hwd-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './charts.js',
  './advisor.js',
  './credit.js',
  './docparse.js',
  './extract.js',
  './views.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/icon-180.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll fails the whole install if any single file 404s, so tolerate gaps
      .then(c => Promise.allSettled(ASSETS.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch third-party requests

  // HTML: network first, so a deployed update is picked up on the next online load
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // everything else: serve from cache immediately, refresh in the background
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'version') {
    e.source && e.source.postMessage({ type: 'version', version: VERSION });
  }
  if (e.data === 'skipWaiting') self.skipWaiting();
});
