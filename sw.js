/* Open Music Tools service worker: one worker for the whole hub (scope: the
 * folder this file is in). Tools register it with shared/offline.js.
 *
 * Caches the app shells (shared/ and each tool) plus heavyweight CDN assets
 * (Tone.js, MediaPipe WASM + .task models, Salamander piano samples) so
 * repeat visits load instantly and work offline once primed. The fonts are
 * our own files (shared/fonts/).
 * Same-origin files are network-first (past the browser's own short-lived
 * copies), so updates land on the next online visit; they are stored without
 * their ?query, so a shared link with tracking bits still opens offline.
 * CDN files are pinned versions, so they are cache-first, in their own cache
 * (CDN_CACHE) that survives CACHE_NAME bumps: about 20 MB not downloaded again
 * at each release. If the app shell can't be fully cached, the new worker
 * doesn't install and the old one keeps working.
 *
 * Bump CACHE_NAME whenever a cached file changes. Add each new tool's files
 * to APP_SHELL. Bump CDN_CACHE only when a pinned CDN version changes.
 */
const CACHE_NAME = 'open-music-tools-v29';
const CDN_CACHE = 'open-music-tools-cdn-v1';
const APP_SHELL = [
  './',
  'index.html',
  'hub/hub.css',
  'hub/hub.js',
  'hub/strings.js',
  'hub/favicon.svg',
  'shared/theory.js',
  'shared/sound.js',
  'shared/transport.js',
  'shared/offline.js',
  'shared/pitch.js',
  'shared/pitch-worklet.js',
  'shared/wave.js',
  'shared/hands.js',
  'shared/camera-look.js',
  'shared/ui/themes.css',
  'shared/ui/select.css',
  'shared/ui/select.js',
  'shared/ui/modal.js',
  'shared/ui/i18n.js',
  'shared/ui/strings.js',
  'shared/ui/page.css',
  'shared/ui/page.js',
  'shared/ui/accidentals.js',
  'shared/ui/camera-look.css',
  'shared/fonts/fonts.css',
  'shared/fonts/archivo.woff2',
  'shared/fonts/asap.woff2',
  'shared/fonts/azeret-mono.woff2',
  'shared/fonts/epilogue.woff2',
  'shared/fonts/familjen-grotesk.woff2',
  'shared/fonts/jetbrains-mono.woff2',
  'shared/fonts/literata.woff2',
  'shared/fonts/nunito.woff2',
  'shared/fonts/rajdhani.woff2',
  'shared/fonts/red-hat-display.woff2',
  'shared/fonts/roundo.woff2',
  'shared/fonts/sora.woff2',
  'choordination/',
  'choordination/index.html',
  'choordination/manifest.json',
  'choordination/favicon.svg',
  'chordigits/',
  'chordigits/index.html',
  'chordigits/chordigits.css',
  'chordigits/chordigits.js',
  'chordigits/strings.js',
  'chordigits/manifest.json',
  'chordigits/favicon.svg',
  'metronome/',
  'metronome/index.html',
  'metronome/metronome.css',
  'metronome/metronome.js',
  'metronome/strings.js',
  'metronome/favicon.svg',
  'piano/',
  'piano/index.html',
  'piano/piano.css',
  'piano/piano.js',
  'piano/strings.js',
  'piano/favicon.svg',
  'ear-trainer/',
  'ear-trainer/index.html',
  'ear-trainer/ear-trainer.css',
  'ear-trainer/ear-trainer.js',
  'ear-trainer/questions.js',
  'ear-trainer/strings.js',
  'ear-trainer/favicon.svg',
  'vocal-tuner/',
  'vocal-tuner/index.html',
  'vocal-tuner/vocal-tuner.css',
  'vocal-tuner/vocal-tuner.js',
  'vocal-tuner/ball.js',
  'vocal-tuner/strings.js',
  'vocal-tuner/favicon.svg',
  'instrument-tuner/',
  'instrument-tuner/index.html',
  'instrument-tuner/instrument-tuner.css',
  'instrument-tuner/instrument-tuner.js',
  'instrument-tuner/tunings.js',
  'instrument-tuner/strings-view.js',
  'instrument-tuner/strings.js',
  'instrument-tuner/favicon.svg',
  'pitch-detector/',
  'pitch-detector/index.html',
  'pitch-detector/pitch-detector.css',
  'pitch-detector/pitch-detector.js',
  'shared/pitch-line.js',
  'shared/ui/pitch-graph.js',
  'pitch-detector/strings.js',
  'pitch-detector/favicon.svg',
  'pitch-training/',
  'pitch-training/index.html',
  'pitch-training/pitch-training.css',
  'pitch-training/pitch-training.js',
  'pitch-training/exercises.js',
  'pitch-training/score.js',
  'pitch-training/strings.js',
  'pitch-training/favicon.svg',
];
// Only our own caches are ever deleted: the hub may share its origin with other sites.
const OWN_CACHE = (k) => k.startsWith('open-music-tools-') || k.startsWith('choordination-');
const RUNTIME_HOSTS = [
  'cdnjs.cloudflare.com',   // Tone.js
  'cdn.jsdelivr.net',       // MediaPipe tasks-vision bundle + WASM
  'storage.googleapis.com', // hand_landmarker.task, face_landmarker.task
  'tonejs.github.io'        // Salamander piano samples
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // 'reload': the files themselves, not the browser's copies from the last visit.
      .then((cache) => cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => OWN_CACHE(k) && k !== CACHE_NAME && k !== CDN_CACHE).map((k) => caches.delete(k))))
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
    // A page is a navigation request, which can't be copied with other options.
    const fresh = req.mode === 'navigate' ? req : new Request(req, { cache: 'no-cache' });
    const key = sameOrigin ? url.origin + url.pathname : req;   // without ?utm=… and the like
    const keep = !sameOrigin || !url.pathname.includes('/tests/');
    event.respondWith(
      fetch(fresh)
        .then((res) => {
          if (res && res.ok && keep) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key, { ignoreSearch: true }))
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
          caches.open(CDN_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
