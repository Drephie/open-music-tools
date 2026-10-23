/* shared/ui/page.js: helpers for the page of a hub tool (see page.css).
 *
 *   THEMES          [[value, HUB_STRINGS key], …] for the five themes in themes.css
 *   LANGUAGE_NAMES  { en: 'English', es: 'Español', it: 'Italiano' } (always
 *                   shown in their own language)
 *   PATREON_URL, DESIGNER_URL   for {patreon} in strings and the footer links
 *   browserLanguage()           'es' or 'it' when the browser prefers it, else 'en'
 *   loadSettings(key)           the object saved under key in localStorage, or {}
 *   saveSettings(key, data)     saves it; silently does nothing when storage is
 *                               unavailable (private mode, blocked storage)
 *   applyTheme(theme)           sets <body data-theme>
 *   closeOnBackdrop(modals)     a click outside the open window closes it
 *                               (modals: a shared/ui/modal.js manager)
 *   createSupportPrompt({ dialog, modals, t, isBusy, storageKey, idleMs, everyMs, waitSeconds })
 *     The Patreon window. When the page has been left untouched for idleMs
 *     (default 30 s) and the person comes back (a tap, click or key), it opens
 *     instead of that action. It opens at most once every everyMs (default
 *     40 min, remembered in localStorage under storageKey, shared by the hub's
 *     tools by default) and never over another open window. Its Continue button
 *     (.support-continue) counts down waitSeconds (default 5) before it works,
 *     and its × (.support-close) appears then. isBusy() true counts as use
 *     (e.g. a metronome playing). Markup: a .modal-overlay dialog managed by
 *     `modals` around a .centered-modal card. Strings: supportWait ({s}),
 *     supportContinue. Returns { locked() }: pass
 *     escapeAction: (m) => (m === dialog && prompt.locked() ? 'ignore' : 'hide').
 *
 * Only settings go in localStorage, never people's work (see CLAUDE.md).
 */

export const THEMES = [
  ['liquid', 'themeLiquid'], ['y2k', 'themeY2k'], ['pink', 'themePink'], ['bw', 'themeBw'], ['retro', 'themeRetro'],
];
export const LANGUAGE_NAMES = { en: 'English', es: 'Español', it: 'Italiano' };
export const PATREON_URL = 'https://patreon.com/drephie';
export const DESIGNER_URL = 'https://instagram.com/drephie';

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
}

export function createSupportPrompt({
  dialog, modals, t, isBusy = () => false, storageKey = 'open-music-tools.supportPrompt',
  idleMs = 30 * 1000, everyMs = 40 * 60 * 1000, waitSeconds = 5,
}) {
  const continueBtn = dialog.querySelector('.support-continue');
  const closeBtn = dialog.querySelector('.support-close');
  let lastActivity = Date.now();
  let lockedNow = false, timer = null, swallowClickUntil = 0;

  const lastShown = () => { try { return Number(localStorage.getItem(storageKey)) || 0; } catch { return 0; } };
  const markShown = (now) => { try { localStorage.setItem(storageKey, String(now)); } catch { /* storage unavailable */ } };

  function show(now) {
    markShown(now);
    modals.open(dialog, null);
    lockedNow = true;
    closeBtn.hidden = true;
    continueBtn.disabled = true;
    let left = waitSeconds;
    const paint = () => { continueBtn.textContent = t('supportWait').replace('{s}', left); };
    paint();
    clearInterval(timer);
    timer = setInterval(() => {
      if (--left > 0) return paint();
      clearInterval(timer);
      lockedNow = false;
      continueBtn.disabled = false;
      continueBtn.textContent = t('supportContinue');
      closeBtn.hidden = false;
    }, 1000);
  }
  const close = () => {
    if (lockedNow) return;
    modals.hideAll();
    if (dialog.contains(document.activeElement)) document.activeElement.blur();   // it opened from no button
  };
  continueBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  // The tap, click or key that ends an idle stretch opens the window instead of acting.
  function onUse(e) {
    const now = Date.now();
    const idle = now - lastActivity >= idleMs;
    lastActivity = now;
    if (!idle || isBusy() || modals.current()) return;
    if (lastShown() && now - lastShown() < everyMs) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    swallowClickUntil = now + 1500;   // and the click that follows a tap
    show(now);
  }
  window.addEventListener('pointerdown', onUse, true);
  window.addEventListener('keydown', onUse, true);
  window.addEventListener('wheel', () => { lastActivity = Date.now(); }, { capture: true, passive: true });
  window.addEventListener('click', (e) => {
    if (Date.now() < swallowClickUntil && !dialog.contains(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); }
    swallowClickUntil = 0;
  }, true);
  return { locked: () => lockedNow };
}

export function closeOnBackdrop(modals) {
  document.addEventListener('pointerdown', (e) => {
    const open = modals.current();
    if (open && open.style.display === 'flex' && !open.contains(e.target)) modals.hideAll();
  });
}
