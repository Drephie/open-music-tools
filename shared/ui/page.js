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

export function closeOnBackdrop(modals) {
  document.addEventListener('pointerdown', (e) => {
    const open = modals.current();
    if (open && open.style.display === 'flex' && !open.contains(e.target)) modals.hideAll();
  });
}
