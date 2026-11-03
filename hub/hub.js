/* hub/hub.js: the home page (spec: specs/hub.md): the tool cards, the About
 * and Settings windows, and the theme and language that every tool shares
 * (loadLook/saveLook in shared/ui/page.js). No Patreon window here: people
 * only pass through this page.
 */
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, REPO_URL, applyTheme, closeOnBackdrop, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { HUB_PAGE_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const look = loadLook();

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, HUB_PAGE_STRINGS),
  getLang: () => look.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, repo: REPO_URL },
});
const { t } = i18n;

const main = document.querySelector('.hub-main');
const themeSelect = $('theme-select'), langSelect = $('lang-select');
const settingsModal = $('settings-modal'), aboutModal = $('about-modal');

// --- CARDS: every name fits its card, every card the same size ---
// Names share one size: the largest at which no word sticks out of its card.
// Then every card gets the height of the tallest, if any needs more than a square.
function fitCards() {
  const names = [...main.querySelectorAll('.tool-name')];
  const cards = [...main.querySelectorAll('.tool-card')];
  main.style.removeProperty('--name-size');
  main.style.setProperty('--card-h', '0px');
  let size = parseFloat(getComputedStyle(names[0]).fontSize);
  const fits = () => names.every((n) => n.scrollWidth <= n.clientWidth + 0.5);
  while (size > 10 && !fits()) {
    size -= 0.5;
    main.style.setProperty('--name-size', `${size}px`);
  }
  const needed = (c) => c.scrollHeight + c.offsetHeight - c.clientHeight;   // plus the borders
  main.style.setProperty('--card-h', `${Math.ceil(Math.max(...cards.map(needed)))}px`);
}
let fitQueued = false;
function queueFit() {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => { fitQueued = false; fitCards(); });
}
new ResizeObserver(queueFit).observe(main);
// A theme's font loads the first time it is used: measure again once it has.
if (document.fonts) {
  document.fonts.ready.then(queueFit);
  document.fonts.addEventListener('loadingdone', queueFit);
}

// --- SETTINGS AND ABOUT WINDOWS ---
const modals = createModalManager({ modals: [settingsModal, aboutModal] });
closeOnBackdrop(modals);
document.querySelectorAll('.modal-header .close-btn').forEach((b) => b.addEventListener('click', () => modals.hideAll()));
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));

themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
themeSelect.addEventListener('change', () => { setTheme(themeSelect.value); saveLook({ theme: look.theme }); });
langSelect.addEventListener('change', () => { setLanguage(langSelect.value); saveLook({ lang: look.lang }); });

function setTheme(theme) {
  look.theme = theme;
  themeSelect.value = theme;
  applyTheme(theme);
  queueFit();
}
function setLanguage(lang) {
  look.lang = lang;
  langSelect.value = lang;
  i18n.apply();
  document.title = t('title');
  setupCustomSelects();   // labels and option texts changed
  queueFit();
}

// Chosen in a tool open in another tab, or before coming Back to this page.
watchLook((next) => {
  if (next.theme !== look.theme) { setTheme(next.theme); setupCustomSelects(); }
  if (next.lang !== look.lang) setLanguage(next.lang);
});

// --- START ---
setTheme(look.theme);
setLanguage(look.lang);
registerHubWorker('./');
