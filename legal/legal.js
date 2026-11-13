/* legal/legal.js: the Privacy and cookies page and the Terms page (plain
 * documents). Both pages share it: theme and language are the hub-wide choice
 * (page.js), the texts are in legal/strings.js, and the owner's details come
 * from legal/details.js (details not filled in yet show marked, in [brackets]).
 */
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, TIKTOK_URL, REPO_URL, applyTheme, closeOnBackdrop, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { LEGAL_STRINGS } from './strings.js';
import { LEGAL_DETAILS } from './details.js';

const $ = (id) => document.getElementById(id);
const look = loadLook();
const page = document.body.dataset.page;   // 'privacy' or 'terms'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isTodo = (v) => /^\[.*\]$/.test(v);
const details = Object.fromEntries(Object.entries(LEGAL_DETAILS).map(([k, v]) => [k, isTodo(v) ? `<span class="todo">${esc(v)}</span>` : esc(v)]));
const anyTodo = Object.values(LEGAL_DETAILS).some(isTodo);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, LEGAL_STRINGS),
  getLang: () => look.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, tiktok: TIKTOK_URL, repo: REPO_URL, ...details },
});
const { t, interp } = i18n;

const settingsModal = $('settings-modal');
const modals = createModalManager({ modals: [settingsModal] });
closeOnBackdrop(modals);
document.querySelectorAll('.modal-header .close-btn').forEach((b) => b.addEventListener('click', () => modals.hideAll()));
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));

const themeSelect = $('theme-select'), langSelect = $('lang-select');
themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
themeSelect.addEventListener('change', () => { setTheme(themeSelect.value); saveLook({ theme: look.theme }); });
langSelect.addEventListener('change', () => { setLanguage(langSelect.value); saveLook({ lang: look.lang }); });

function setTheme(theme) { look.theme = theme; themeSelect.value = theme; applyTheme(theme); }
function setLanguage(lang) {
  look.lang = lang;
  langSelect.value = lang;
  i18n.apply();
  document.title = `${t(page === 'terms' ? 'tTitle' : 'pTitle')} – Open Music Tools`;
  $('updated').textContent = t('legalUpdated').replace('{updated}', LEGAL_DETAILS.updated);
  $('todo-note').hidden = !anyTodo;
  setupCustomSelects();
}
watchLook((next) => {
  if (next.theme !== look.theme) { setTheme(next.theme); setupCustomSelects(); }
  if (next.lang !== look.lang) setLanguage(next.lang);
});

setTheme(look.theme);
setLanguage(look.lang);
registerHubWorker('../');
