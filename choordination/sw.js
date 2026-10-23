/* Choordination service worker.
 * Caches the app shell plus heavyweight CDN assets (MediaPipe WASM + .task
 * models, Tone.js, Google Fonts, Salamander piano samples) so repeat visits
 * load instantly and work offline once primed.
 */
const CACHE_NAME = 'choordination-v1';
const APP_SHELL = ['./', './choordination.html', './manifest.json', './favicon.svg'];
const RUNTIME_HOSTS = [
  'cdnjs.cloudflare.com',   // Tone.js
  'cdn.jsdelivr.net',       // MediaPipe tasks-vision bundle + WASM
  'storage.googleapis.com', // hand_landmarker.task, face_landmarker.task
  'tonejs.github.io',       // Salamander piano samples
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => { /* shell caching is best-effort (e.g. odd hosting paths) */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !RUNTIME_HOSTS.includes(url.hostname)) return;

  if (sameOrigin || req.mode === 'navigate') {
    // App shell: network-first so updates land, cache fallback for offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Immutable CDN assets: cache-first.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
