/* shared/offline.js: registers the hub's one service worker (sw.js at the hub root).
 *
 *   registerHubWorker(rootUrl = '../')
 *     Call from a tool page at <hub>/<tool>/. rootUrl points from the page to
 *     the hub root. Waits for the page's load event, does nothing on plain
 *     http other than localhost, and never throws (offline caching is a bonus).
 *     It first removes any worker registered for the tool's own folder
 *     (Choordination had one before Phase 1), since a worker with a narrower
 *     scope would keep controlling the tool instead of the hub's.
 */

export function registerHubWorker(rootUrl = '../') {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) return;
  const hubScope = new URL(rootUrl, location.href).href;
  const ownScope = new URL('./', location.href).href;
  const register = () => navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.filter((r) => r.scope === ownScope && ownScope !== hubScope).map((r) => r.unregister())))
    .catch(() => { /* nothing to clean up */ })
    .then(() => navigator.serviceWorker.register(new URL('sw.js', hubScope).href))
    .catch(() => { /* offline cache unavailable */ });
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
