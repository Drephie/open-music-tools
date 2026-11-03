/* shared/ui/page.js: helpers for the page of a hub tool (see page.css).
 *
 *   THEMES          [[value, HUB_STRINGS key], …] for the seven themes in themes.css
 *   LANGUAGE_NAMES  { en: 'English', es: 'Español', it: 'Italiano' } (always
 *                   shown in their own language)
 *   PATREON_URL, DESIGNER_URL   for {patreon} in strings and the footer links
 *   REPO_URL                    the public code, for {repo} in strings
 *   browserLanguage()           'es' or 'it' when the browser prefers it, else 'en'
 *   loadSettings(key)           the object saved under key in localStorage, or {}
 *   saveSettings(key, data)     saves it; silently does nothing when storage is
 *                               unavailable (private mode, blocked storage)
 *   applyTheme(theme)           sets <body data-theme>, and the browser bar's colour
 *                               (meta theme-color) to the theme's page colour
 *
 * The theme and language are one choice for the whole hub (the home page and
 * every tool), saved in localStorage under LOOK_KEY:
 *   loadLook(saved)   { theme, lang } for this page. A value the hub has not
 *                     saved yet comes from `saved` (the tool's own settings
 *                     from before the hub shared them: { theme, lang }), and
 *                     is then passed on to the hub; else 'liquid' and
 *                     browserLanguage().
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
  ['liquid', 'themeLiquid'], ['y2k', 'themeY2k'], ['pink', 'themePink'], ['bw', 'themeBw'], ['retro', 'themeRetro'],
  ['rouge', 'themeRouge'], ['snap', 'themeSnap'],
];
export const LANGUAGE_NAMES = { en: 'English', es: 'Español', it: 'Italiano' };
export const PATREON_URL = 'https://patreon.com/drephie';
export const DESIGNER_URL = 'https://instagram.com/drephie';
export const REPO_URL = 'https://github.com/Drephie/open-music-tools';

export function browserLanguage() {
  for (const tag of navigator.languages || [navigator.language || 'en']) {
    const lang = String(tag).slice(0, 2).toLowerCase();
    if (lang === 'es' || lang === 'it') return lang;
    if (lang === 'en') return 'en';
  }
  return 'en';
}

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
    theme: validTheme(hub.theme) ? hub.theme : passOn.theme || 'liquid',
    lang: validLang(hub.lang) ? hub.lang : passOn.lang || browserLanguage(),
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
