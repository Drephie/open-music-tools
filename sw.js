/* Open Music Tools service worker: one worker for the whole hub (scope: the
 * folder this file is in). Tools register it with shared/offline.js.
 *
 * Caches the app shells (shared/ and each tool) plus heavyweight CDN assets
 * (Tone.js, MediaPipe WASM + .task models, Google Fonts, Salamander piano
 * samples) so repeat visits load instantly and work offline once primed.
 * Same-origin files are network-first, so updates land on the next online
 * visit; CDN files are pinned versions, so they are cache-first.
 *
 * Bump CACHE_NAME whenever a cached file changes. Add each new tool's files
 * to APP_SHELL.
 */
const CACHE_NAME = 'open-music-tools-v7';
const APP_SHELL = [
  'shared/theory.js',
  'shared/sound.js',
  'shared/transport.js',
  'shared/offline.js',
  'shared/ui/themes.css',
  'shared/ui/select.css',
  'shared/ui/select.js',
  'shared/ui/modal.js',
  'shared/ui/i18n.js',
  'shared/ui/strings.js',
  'shared/ui/page.css',
  'shared/ui/page.js',
  'choordination/',
  'choordination/index.html',
  'choordination/manifest.json',
  'choordination/favicon.svg',
  'metronome/',
  'metronome/index.html',
  'metronome/metronome.css',
  'metronome/metronome.js',
  'metronome/strings.js',
  'metronome/favicon.svg',
];
// Only our own caches are ever deleted: the hub may share its origin with other sites.
const OWN_CACHE = (k) => k.startsWith('open-music-tools-') || k.startsWith('choordination-');
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
      .then((keys) => Promise.all(keys.filter((k) => OWN_CACHE(k) && k !== CACHE_NAME).map((k) => caches.delete(k))))
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
