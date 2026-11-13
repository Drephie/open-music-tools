/* intervle/intervle.js: Intervle, the daily ear puzzle (spec: specs/intervle.md).
 * The rules and the year of puzzles are in ./game.js; this file is the screen:
 * the day, the three modes, answers (buttons and typing), streaks, past games,
 * settings, windows and keyboard shortcuts. Alpha: Rouge theme only.
 */
import { startAudio, createRack } from '../shared/sound.js';
import { midiToFreq, commonNoteName } from '../shared/theory.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, REPO_URL, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { MODES, ANSWERS, TYPES, TRIES, dayNumber, dateOf, puzzle, parseAnswer, status } from './game.js';
import { INTERVLE_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'intervle.settings.v1';
const THEME = 'rouge';   // Alpha: Rouge only (Drephie, 2026-11-12); more themes after the alpha
const ANSWER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }

// --- SETTINGS: note names, last mode and each day's tries (game results, not people's work) ---
function readSettings() {
  const s = loadSettings(SETTINGS_KEY);
  const results = {};
  const saved = s.results && typeof s.results === 'object' ? s.results : {};
  for (const [n, day] of Object.entries(saved)) {
    if (!/^\d+$/.test(n) || !day || typeof day !== 'object') continue;
    for (const mode of MODES) {
      const r = day[mode];
      if (!r || !Array.isArray(r.a)) continue;
      const a = r.a.filter((x) => ANSWERS[mode].includes(x)).slice(0, TRIES);
      if (a.length) (results[n] ||= {})[mode] = { a, l: r.l === 1 ? 1 : 0 };
    }
  }
  return {
    mode: MODES.includes(s.mode) ? s.mode : 'easy',
    solfege: typeof s.solfege === 'boolean' ? s.solfege : null,   // null: follows the language
    results,
  };
}
const settings = readSettings();
settings.lang = loadLook(loadSettings(SETTINGS_KEY)).lang;
const save = () => saveSettings(SETTINGS_KEY, { mode: settings.mode, solfege: settings.solfege, results: settings.results });
const solfege = () => (settings.solfege === null ? settings.lang !== 'en' : settings.solfege);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, INTERVLE_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, repo: REPO_URL },
});
const { t } = i18n;
const tf = (key, vars) => t(key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pretty = (name) => name.replace(/#/g, '♯').replace(/([A-Za-z])b/g, '$1♭');
const noteName = (midi) => pretty(commonNoteName(midi, solfege()).name);

// --- THE DAY ---
let today = dayNumber(new Date());
let day = today;
const tries = (n, mode) => settings.results[n]?.[mode]?.a || [];
const resultOf = (n, mode) => status(tries(n, mode), puzzle(mode, n).answer);

function answerName(mode, a) {
  if (mode === 'easy') return cap(t('iv' + a));
  if (mode === 'medium') return noteName(60 + a);
  const [pc, type] = a.split(':');   // 'F♯m7', 'Fa♯m7'; 'La sus4' with a space after a Do Re Mi name
  return noteName(60 + +pc) + (solfege() && /^(s|ma)/.test(type) ? ' ' : '') + t('ch_' + type);
}
function answerSub(mode, a) {
  if (mode === 'easy') return a === 1 ? t('halfStep1') : tf('halfSteps', { n: a });
  if (mode === 'hard') return t('chw_' + a.split(':')[1]);
  return '';
}

// Streak: days in a row solved on their own day, up to today (or yesterday while today is still open).
function liveWon(n, mode) { const r = settings.results[n]?.[mode]; return !!r && r.l === 1 && resultOf(n, mode) === 'won'; }
function streak(mode) {
  let n = today;
  if (!liveWon(n, mode)) { if (resultOf(n, mode) === 'lost') return 0; n--; }
  let s = 0;
  while (n >= 1 && liveWon(n, mode)) { s++; n--; }
  return s;
}
function bestStreak(mode) {
  let best = 0, run = 0;
  for (let n = 1; n <= today; n++) { run = liveWon(n, mode) ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

// --- SOUND: the grand piano; notes go on the Transport so Play can restart them ---
let rack = null, rackLoading = null, soundEnd = 0, endTimer = null;
const loadingEl = $('loading'), playBtn = $('play-btn');
function loadRack() {
  if (!rackLoading) {
    rackLoading = createRack()
      .then((r) => { rack = r; loadingEl.hidden = true; })
      .catch(() => { rackLoading = null; loadingEl.textContent = t('loadFailed'); loadingEl.hidden = false; });
  }
  return rackLoading;
}
const unlockAudio = () => { if (Tone.context.state !== 'running') startAudio(); };
['pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, true));

let playToken = 0, dotTimers = [];
const dotsEl = $('note-dots');
function showDots(count, lit) {
  dotsEl.innerHTML = Array.from({ length: count }, (_, i) => `<span class="dot${i === lit ? ' on' : ''}${i < lit ? ' was' : ''}"></span>`).join('');
}
function stopSound() {
  Tone.Transport.cancel(0);
  if (rack) rack.instruments.piano.releaseAll(Tone.now());
  clearTimeout(endTimer);
  dotTimers.forEach(clearTimeout);
  dotTimers = [];
  soundEnd = 0;
  setBusy(false);
}
// While it plays (or gets ready), Play becomes Stop.
function setBusy(on) {
  playBtn.classList.toggle('busy', on);
  playBtn.querySelector('use').setAttribute('href', on ? '#i-stop' : '#i-play');
  playBtn.querySelector('.play-label').textContent = t(on ? 'stop' : 'play');
}
function stopPlay() {
  playToken++;   // a Play still waiting for the piano never starts
  stopSound();
  showDots(puzzle(settings.mode, day).events.length, -1);
}
// The sound is switched on first (Tone.start() runs at once, inside the tap) and the
// piano loaded; only then are the notes scheduled, so the first Play is never lost.
async function playEvents(events) {
  const token = ++playToken;
  stopSound();
  const ready = Tone.context.state === 'running' ? null : startAudio();
  setBusy(true);
  if (ready) await ready;
  if (token !== playToken) return;
  if (!rack) {
    loadingEl.textContent = t('loading');
    loadingEl.hidden = false;
    await loadRack();
    if (!rack || token !== playToken) return;
  }
  const piano = rack.instruments.piano;
  if (Tone.Transport.state !== 'started') Tone.Transport.start();
  const start = Tone.Transport.seconds + 0.1;
  for (const e of events) {
    const freqs = e.notes.map(midiToFreq);
    Tone.Transport.schedule((time) => piano.triggerAttackRelease(freqs, e.dur, time), start + e.at);
  }
  // One dot per sound, lit while it plays (timers, not Tone.Draw, which drops late frames).
  events.forEach((e, i) => dotTimers.push(setTimeout(() => showDots(events.length, i), (0.1 + e.at) * 1000)));
  const length = 0.1 + Math.max(...events.map((e) => e.at + e.dur));
  soundEnd = Tone.now() + length;
  endTimer = setTimeout(() => { setBusy(false); showDots(events.length, -1); }, length * 1000);
}
const isPlaying = () => Tone.now() < soundEnd;
const playPuzzle = () => (playBtn.classList.contains('busy') ? stopPlay() : playEvents(puzzle(settings.mode, day).events));

// --- SCREEN ---
const tabs = [...document.querySelectorAll('.tab')];
const answersEl = $('answers'), typeBox = $('type-box'), triesEl = $('tries');
const fbMain = $('fb-main'), fbDetail = $('fb-detail'), copyBtn = $('copy-btn'), copiedEl = $('copied');
const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const dateText = (n, opts) => dateOf(n).toLocaleDateString(settings.lang, opts);

function render() {
  const mode = settings.mode, p = puzzle(mode, day), tr = tries(day, mode), st = status(tr, p.answer);
  $('day-num').textContent = '#' + day;
  $('day-date').textContent = dateText(day, { weekday: 'long', day: 'numeric', month: 'long' });
  if (!isPlaying()) showDots(p.events.length, -1);
  $('today-btn').hidden = day === today;
  tabs.forEach((b) => {
    const on = b.dataset.mode === mode, r = resultOf(day, b.dataset.mode);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    b.querySelector('.tab-mark').innerHTML = r === 'won' ? icon('check') : r === 'lost' ? icon('cross') : '';
    b.dataset.result = r;
  });
  $('panel').setAttribute('aria-labelledby', 'tab-' + mode);
  $('prompt').textContent = mode === 'easy' ? t('askEasy') : tf(mode === 'medium' ? 'askMedium' : 'askHard', { note: noteName(p.ref) });

  const left = TRIES - tr.length;
  triesEl.innerHTML = Array.from({ length: TRIES }, (_, i) => `<span class="try${i >= tr.length ? '' : tr[i] === p.answer ? ' good' : ' used'}"></span>`).join('');
  triesEl.setAttribute('aria-label', tf('triesAria', { n: st === 'open' ? left : 0 }));

  answersEl.dataset.mode = mode;
  answersEl.innerHTML = '';
  if (pickFor !== day + mode) { pick.root = pick.type = null; pickFor = day + mode; }
  if (mode === 'hard') renderChordTiles(p, st);
  else ANSWERS[mode].forEach((a, i) => {
    const tried = tr.includes(a), good = st !== 'open' && a === p.answer;
    const b = tile(answerName(mode, a), answerSub(mode, a), ANSWER_KEYS[i]);
    b.answer = a;
    if (a === justAnswered) b.classList.add('flip');
    if (good) b.classList.add('good');
    else if (tried) b.classList.add('bad');
    if (st !== 'open' || tried) b.classList.add('after');
    b.disabled = tried && !good;
    b.addEventListener('click', () => answer(a));
    answersEl.appendChild(b);
  });
  typeBox.disabled = st !== 'open';
  typeBox.placeholder = t('typeHint');

  fbMain.className = 'fb-main' + (st === 'won' ? ' good' : st === 'lost' || tr.length ? ' bad' : '');
  if (st === 'won') {
    fbMain.textContent = tr.length === 1 ? t('right1') : tf('rightN', { n: tr.length });
    fbDetail.textContent = answerName(mode, p.answer) + (answerSub(mode, p.answer) ? ': ' + answerSub(mode, p.answer) : '');
  } else if (st === 'lost') {
    fbMain.textContent = t('lost');
    fbDetail.textContent = tf('answerWas', { name: answerName(mode, p.answer) });
  } else {
    fbMain.textContent = tr.length ? t('wrong') + ': ' + answerName(mode, tr[tr.length - 1]) : '';
    fbDetail.textContent = tf('triesAria', { n: left });
  }
  copyBtn.hidden = MODES.some((m) => resultOf(day, m) === 'open');

  const st0 = streak(mode), best = tf('bestStreak', { n: bestStreak(mode) });
  $('streak').innerHTML = `<svg class="flame" aria-hidden="true"><use href="#i-flame"/></svg><span class="streak-num">${st0}</span>`;
  $('streak').setAttribute('aria-label', tf('streak', { name: t(mode), n: st0 }) + ', ' + best);
  $('streak').title = best;
  showMatch();
}

function answer(a) {
  const mode = settings.mode, p = puzzle(mode, day), tr = tries(day, mode);
  if (status(tr, p.answer) !== 'open' || tr.includes(a)) return;
  const r = ((settings.results[day] ||= {})[mode] ||= { a: [], l: day === today ? 1 : 0 });
  r.a.push(a);
  save();
  typeBox.value = '';
  justAnswered = a;
  render();
  justAnswered = null;
}

let justAnswered = null;   // the tile just tapped turns over once

function tile(name, sub, key) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'answer';
  b.innerHTML = `${key ? `<span class="answer-key computer-only" aria-hidden="true">${key}</span>` : ''}<span class="answer-name"></span>${sub ? '<span class="answer-sub"></span>' : ''}`;
  b.querySelector('.answer-name').textContent = name;
  if (sub) b.querySelector('.answer-sub').textContent = sub;
  return b;
}

// Hard: pick the chord's note and its type (either first); the answer is sent once both are picked.
const pick = { root: null, type: null };
let pickFor = '';
function renderChordTiles(p, st) {
  const good = p.answer.split(':');
  const group = (field, label, values, name) => {
    const g = document.createElement('div');
    g.className = 'tile-group ' + field;
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', t(label));
    values.forEach((v) => {
      const b = tile(name(v), '');
      b.dataset[field] = v;
      if (st !== 'open') b.classList.add('after');
      if (st !== 'open' && String(v) === good[field === 'root' ? 0 : 1]) b.classList.add('good', ...(justAnswered ? ['flip'] : []));
      if (field === 'type') b.title = t('chw_' + v);
      b.setAttribute('aria-pressed', String(pick[field] === v));
      b.addEventListener('click', () => pickPart(field, v));
      g.appendChild(b);
    });
    answersEl.appendChild(g);
  };
  group('root', 'rootAria', ANSWERS.medium, (pc) => noteName(60 + pc));
  group('type', 'typeGroupAria', TYPES, (type) => t('ch_' + type));
}
function pickPart(field, v) {
  if (resultOf(day, 'hard') !== 'open') return;
  pick[field] = pick[field] === v ? null : v;
  if (pick.root !== null && pick.type !== null) {
    const a = `${pick.root}:${pick.type}`;
    pick.type = null;
    if (!tries(day, 'hard').includes(a)) { pick.root = null; answer(a); return; }
  }
  render();
}

// --- TYPING (computers): the button that matches lights up; Enter answers ---
function typedNames() {
  const mode = settings.mode, names = {};
  if (mode === 'easy') for (const a of ANSWERS.easy) names[a] = [t('iv' + a)];
  return names;
}
const typed = () => parseAnswer(settings.mode, typeBox.value, typedNames());
function showMatch() {
  const a = typed(), hard = settings.mode === 'hard';
  const [root, type] = hard && a !== null ? a.split(':') : [];
  answersEl.querySelectorAll('.answer').forEach((b) => b.classList.toggle('match', a !== null && !b.disabled &&
    (hard ? b.dataset.root === root || b.dataset.type === type : b.answer === a)));
}
typeBox.addEventListener('input', showMatch);
typeBox.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const a = typed();
  if (a !== null) answer(a);
});

tabs.forEach((b) => b.addEventListener('click', () => { stopPlay(); settings.mode = b.dataset.mode; save(); render(); }));
document.querySelector('.tabs').addEventListener('keydown', (e) => {
  const i = MODES.indexOf(settings.mode), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  tabs[(i + d + MODES.length) % MODES.length].click();
  tabs[MODES.indexOf(settings.mode)].focus();
});
playBtn.addEventListener('click', playPuzzle);
$('today-btn').addEventListener('click', () => { stopPlay(); day = today; render(); });

// --- COPY RESULT: one line on the clipboard; nothing is sent anywhere ---
copyBtn.addEventListener('click', async () => {
  const parts = MODES.map((m) => {
    const r = resultOf(day, m);
    return `${t(m)} ${r === 'won' ? tries(day, m).length : 'X'}/${TRIES}`;
  });
  const line = `Intervle #${day} · ${parts.join(' · ')}`;
  let ok = false;
  try { await navigator.clipboard.writeText(line); ok = true; } catch { /* no clipboard API on plain http */ }
  if (!ok) {   // the older way, which also works on the http test link
    const ta = document.createElement('textarea');
    ta.value = line;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch { /* not allowed */ }
    ta.remove();
  }
  copiedEl.textContent = t(ok ? 'copied' : 'copyFailed');
  setTimeout(() => { copiedEl.textContent = ''; }, 2500);
});

// --- PAST GAMES ---
const pastModal = $('past-modal'), pastList = $('past-list');
function renderPast() {
  pastList.innerHTML = '';
  for (let n = today; n >= 1; n--) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'past-row' + (n === day ? ' current' : '');
    const marks = MODES.map((m) => { const r = resultOf(n, m); return `<span class="past-mark" data-result="${r}">${r === 'won' ? icon('check') : r === 'lost' ? icon('cross') : ''}</span>`; }).join('');
    b.innerHTML = `<span class="past-num">#${n}</span><span class="past-date"></span><span class="past-marks" aria-hidden="true">${marks}</span>`;
    b.querySelector('.past-date').textContent = dateText(n, { weekday: 'short', day: 'numeric', month: 'short' });
    b.setAttribute('aria-label', `#${n}, ${dateText(n, { weekday: 'long', day: 'numeric', month: 'long' })}: ` +
      MODES.map((m) => `${t(m)} ${({ won: '✓', lost: '✗', open: t('notPlayed') })[resultOf(n, m)]}`).join(', '));
    b.addEventListener('click', () => { stopPlay(); day = n; modals.hideAll(false); render(); });
    li.appendChild(b);
    pastList.appendChild(li);
  }
}
$('past-btn').addEventListener('click', (e) => { renderPast(); modals.open(pastModal, e.currentTarget); });

// A new day while the page is open (or coming back to it the next morning).
function checkDay() {
  const now = dayNumber(new Date());
  if (now === today) return;
  if (day === today) day = now;
  today = now;
  render();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
window.addEventListener('focus', checkDay);
setInterval(checkDay, 60000);

// --- SETTINGS, ABOUT AND PATREON WINDOWS ---
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), supportModal = $('support-modal');
const modals = createModalManager({
  modals: [settingsModal, aboutModal, pastModal, supportModal],
  escapeAction: (m) => (m === supportModal && support.locked() ? 'ignore' : 'hide'),
});
closeOnBackdrop(modals);
document.querySelectorAll('.modal-header .close-btn').forEach((b) => b.addEventListener('click', () => modals.hideAll()));
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: isPlaying });
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));

const themeSelect = $('theme-select'), langSelect = $('lang-select'), namesSeg = $('names-seg');
themeSelect.innerHTML = `<option value="${THEME}" data-i18n="themeRouge"></option>`;
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
langSelect.addEventListener('change', () => { settings.lang = langSelect.value; saveLook({ lang: settings.lang }); applyLanguage(); });
// Language chosen elsewhere in the hub; the hub's theme is left alone (Rouge only here).
watchLook((look) => { if (look.lang !== settings.lang) { settings.lang = langSelect.value = look.lang; applyLanguage(); } });

function renderNames() {
  [...namesSeg.children].forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.names === 'solfege') === solfege())));
}
[...namesSeg.children].forEach((b) => b.addEventListener('click', () => {
  settings.solfege = b.dataset.names === 'solfege';
  save();
  renderNames();
  render();
}));

function applyLanguage() {
  i18n.apply();
  document.title = t('title');
  renderNames();
  render();
  setBusy(playBtn.classList.contains('busy'));
  if (!loadingEl.hidden) loadingEl.textContent = t(rackLoading ? 'loading' : 'loadFailed');
  if (modals.current() === pastModal) renderPast();
  setupCustomSelects();
}

// --- KEYBOARD: Space plays, 1–9 0 - = answer (typing goes to the answer box) ---
document.addEventListener('keydown', (e) => {
  if (modals.current() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement;
  if (el === typeBox || (el && el.closest && el.closest('.custom-select'))) return;
  if (e.key === ' ') { e.preventDefault(); if (!e.repeat) playPuzzle(); return; }
  const i = settings.mode === 'hard' ? -1 : ANSWER_KEYS.indexOf(e.key);   // Hard has two rows: type instead
  const btn = i >= 0 ? answersEl.children[i] : null;
  if (btn && !e.repeat) { e.preventDefault(); answer(btn.answer); }
});

// --- START ---
applyTheme(THEME);
themeSelect.value = THEME;
langSelect.value = settings.lang;
applyLanguage();
loadRack();
registerHubWorker('../');
