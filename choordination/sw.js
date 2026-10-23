/* Retired: Choordination's own service worker (scope: this folder), used
 * until Phase 1. The hub now has one worker at its root (../sw.js).
 *
 * A browser that still has the old worker installed fetches this file on its
 * next update check. It then installs, deletes the old Choordination caches
 * and unregisters itself, so the root worker takes over from the next page
 * load. The page also unregisters it (shared/offline.js). Keep this file
 * until old installs are unlikely to remain.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('choordination-')).map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
  );
});
