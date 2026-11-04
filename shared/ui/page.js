/* shared/ui/page.js: helpers for the page of a hub tool (see page.css).
 *
 *   THEMES          [[value, HUB_STRINGS key], …] for the seven themes in themes.css,
 *                   in menu order: Rouge (the default), Liquid Glass, then A to Z
 *   LANGUAGE_NAMES  { en: 'English', es: 'Español', it: 'Italiano' } (always
 *                   shown in their own language)
 *   PATREON_URL, DESIGNER_URL   for {patreon} in strings and the footer links
 *   TIKTOK_URL                  Drephie's TikTok, for {tiktok} in About texts
 *   REPO_URL                    the public code, for {repo} in strings
 *   loadSettings(key)           the object saved under key in localStorage, or {}
 *   saveSettings(key, data)     saves it; silently does nothing when storage is
 *                               unavailable (private mode, blocked storage)
 *   applyTheme(theme)           sets <body data-theme>, the browser bar's colour
 *                               (meta theme-color) to the theme's page colour, and
 *                               the tab's icon to the theme's colours (themeFavicon)
 *   themeFavicon()              recolours the page's favicon.svg (its dark ground,
 *                               white and light blue) with the theme's page colour,
 *                               --color-left and --color-right
 *
 * The theme and language are one choice for the whole hub (the home page and
 * every tool), saved in localStorage under LOOK_KEY:
 *   loadLook(saved)   { theme, lang } for this page. A value the hub has not
 *                     saved yet comes from `saved` (the tool's own settings
 *                     from before the hub shared them: { theme, lang }), and
 *                     is then passed on to the hub; else 'rouge' and
 *                     English (Drephie, 2026-11-04).
 *   saveLook(changes) saves { theme } and/or { lang } for every tool
 *   watchLook(apply)  calls apply({ theme, lang }) when another tab changes
 *                     them, and when the browser's Back or Forward button
 *                     brings this page back from its memory (it may show an
 *                     older choice). apply must do nothing if nothing changed.
 *   closeOnBackdrop(modals)     a tap outside the open window closes it, and only
 *                               that: the page under the finger doesn't get the tap
 *                               (modals: a shared/ui/modal.js manager)
 *   createSupportPrompt({ dialog, modals, t, isBusy, storageKey, useMs, quietMs, everyMs })
 *     The Patreon window, shown only at a natural pause: the tool has been in
 *     use (isBusy() true, e.g. a metronome playing, a lesson running) for useMs
 *     in all (default 45 s), something just ended (isBusy() turned false), and
 *     nothing was touched for quietMs since (default 3 s). It never takes a tap
 *     or a key, its × and Escape work at once, and its Continue button
 *     (.support-continue) gets the focus. It opens at most once every everyMs
 *     (default 40 min, remembered in localStorage under storageKey, shared by
 *     the hub's tools by default) and never over another open window or on a
 *     hidden page. Markup: a .modal-overlay dialog managed by `modals` around a
 *     .centered-modal card. Strings: supportContinue. Returns { locked() }
 *     (always false now; kept so callers can still pass
 *     escapeAction: (m) => (m === dialog && prompt.locked() ? 'ignore' : 'hide').
 *
 * Only settings go in localStorage, never people's work (see CLAUDE.md).
 */

export const THEMES = [
  ['rouge', 'themeRouge'], ['liquid', 'themeLiquid'], ['bw', 'themeBw'], ['retro', 'themeRetro'], ['snap', 'themeSnap'],
  ['pink', 'themePink'], ['y2k', 'themeY2k'],
];
export const LANGUAGE_NAMES = { en: 'English', es: 'Español', it: 'Italiano' };
export const PATREON_URL = 'https://patreon.com/drephie';
export const DESIGNER_URL = 'https://instagram.com/drephie';
export const TIKTOK_URL = 'https://www.tiktok.com/@itsnotdre';
export const REPO_URL = 'https://github.com/Drephie/open-music-tools';


export function loadSettings(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
export function saveSettings(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

export function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const bar = document.querySelector('meta[name="theme-color"]');
  const page = getComputedStyle(document.body).getPropertyValue('--bg-page').trim();
  if (bar && page) bar.setAttribute('content', page);
  themeFavicon();
}
// The favicons are drawn in a dark ground (#0f1419 and kin), white and light blue.
const FAVICON_COLOURS = /#(0f1419|0b0d12|1a2433|080b10|ffffff|f3f5f8|8ad4ff|3b78e7)\b/gi;
const faviconRole = { '0f1419': '--bg-page', '0b0d12': '--bg-page', '1a2433': '--bg-page', '080b10': '--bg-page', ffffff: '--color-left', f3f5f8: '--color-left', '8ad4ff': '--color-right', '3b78e7': '--color-right' };
let faviconSvg;
export async function themeFavicon() {
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  if (faviconSvg === undefined) faviconSvg = fetch(link.getAttribute('href')).then((r) => r.text()).catch(() => '');
  const svg = await faviconSvg;
  if (!svg) return;
  const cs = getComputedStyle(document.body);
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svg.replace(FAVICON_COLOURS, (_, hex) => cs.getPropertyValue(faviconRole[hex.toLowerCase()]).trim() || `#${hex}`));
}

export const LOOK_KEY = 'open-music-tools.look.v1';
const validTheme = (v) => THEMES.some(([value]) => value === v);
const validLang = (v) => Object.keys(LANGUAGE_NAMES).includes(v);

export function loadLook(saved = {}) {
  const hub = loadSettings(LOOK_KEY);
  const passOn = {};
  if (!validTheme(hub.theme) && validTheme(saved.theme)) passOn.theme = saved.theme;
  if (!validLang(hub.lang) && validLang(saved.lang)) passOn.lang = saved.lang;
  if (Object.keys(passOn).length) saveLook(passOn);
  return {
    theme: validTheme(hub.theme) ? hub.theme : passOn.theme || 'rouge',
    lang: validLang(hub.lang) ? hub.lang : passOn.lang || 'en',
  };
}
export function saveLook(changes) {
  saveSettings(LOOK_KEY, { ...loadSettings(LOOK_KEY), ...changes });
}
export function watchLook(apply) {
  window.addEventListener('storage', (e) => { if (e.key === LOOK_KEY || e.key === null) apply(loadLook()); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) apply(loadLook()); });
}

export function createSupportPrompt({
  dialog, modals, t, isBusy = () => false, storageKey = 'open-music-tools.supportPrompt',
  useMs = 45 * 1000, quietMs = 3000, everyMs = 40 * 60 * 1000,
}) {
  const continueBtn = dialog.querySelector('.support-continue');
  const closeBtn = dialog.querySelector('.support-close');

  const lastShown = () => { try { return Number(localStorage.getItem(storageKey)) || 0; } catch { return 0; } };
  const markShown = (now) => { try { localStorage.setItem(storageKey, String(now)); } catch { /* storage unavailable */ } };

  function show(now) {
    markShown(now);
    modals.open(dialog, null);
    continueBtn.disabled = false;
    continueBtn.textContent = t('supportContinue');
    closeBtn.hidden = false;
    continueBtn.focus({ preventScroll: true });
  }
  const close = () => {
    modals.hideAll();
    if (dialog.contains(document.activeElement)) document.activeElement.blur();   // it opened from no button
  };
  continueBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  // A natural pause: the tool was really used (busy for useMs in all), something
  // just ended (busy, then not), and nothing has been touched for quietMs since.
  let used = 0, wasBusy = false, endedAt = 0, lastInput = Date.now(), lastTick = Date.now();
  const touched = () => { lastInput = Date.now(); };
  ['pointerdown', 'keydown', 'wheel'].forEach((ev) => window.addEventListener(ev, touched, { capture: true, passive: true }));
  setInterval(() => {
    const now = Date.now(), busy = isBusy();
    if (busy) { used += now - lastTick; endedAt = 0; } else if (wasBusy) endedAt = now;
    wasBusy = busy;
    lastTick = now;
    if (!endedAt || used < useMs || now - Math.max(endedAt, lastInput) < quietMs) return;
    if (document.hidden || modals.current()) return;
    if (lastShown() && now - lastShown() < everyMs) return;
    endedAt = 0;
    used = 0;
    show(now);
  }, 1000);
  return { locked: () => false };
}

export function closeOnBackdrop(modals) {
  // Caught first (window, capture phase), so a piano key, a beat dot or Start
  // under the finger isn't pressed too; the click that follows is dropped.
  let dropClick = false;
  window.addEventListener('pointerdown', (e) => {
    dropClick = false;
    const open = modals.current();
    if (!open || open.style.display !== 'flex' || open.contains(e.target)) return;
    modals.hideAll();
    e.preventDefault();
    e.stopImmediatePropagation();
    dropClick = true;
  }, true);
  window.addEventListener('click', (e) => {
    if (!dropClick) return;
    dropClick = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
}
