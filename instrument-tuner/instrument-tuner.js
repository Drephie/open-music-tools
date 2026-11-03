/* instrument-tuner/instrument-tuner.js: the Instrument Tuner (spec:
 * specs/instrument-tuner.md). The microphone and the pitch come from
 * shared/pitch.js; the tunings and string matching are ./tunings.js; the
 * vibrating strings are ./strings-view.js; this file is the screen: the
 * tuning list, the note, the words, the line, the string circles, the
 * settings, windows and keyboard.
 */
import { startPitch, createPitchSmoother, nearestNote, WAVEFORM_SIZE } from '../shared/pitch.js';
import { commonNoteName } from '../shared/theory.js';
import { waveShape } from '../shared/wave.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { accidentalHtml, prettyName } from '../shared/ui/accidentals.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, REPO_URL, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { TUNINGS, tuningById, stringsOf, stringName, rangeOf, matchString, createTunedMarks } from './tunings.js';
import { createStringsView } from './strings-view.js';
import { TUNER_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'instrument-tuner.settings.v1';
// In tune within ±5 cents, or ±2 in Hard mode (Drephie's choice).
const tolerance = () => (settings.hard ? 2 : 5);
const ERROR_KEYS = { insecure: 'errInsecure', unsupported: 'errUnsupported', denied: 'errDenied', 'no-mic': 'errNoMic', busy: 'errBusy', ended: 'errEnded' };
const LOCK_SVG = '<svg class="lock" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="5.5" width="8" height="6" rx="1.2" fill="currentColor"/></svg>';

// --- SETTINGS (remembered in this browser only; nothing played is kept) ---
function readSettings() {
  const s = loadSettings(SETTINGS_KEY);
  return {
    tuning: tuningById(s.tuning).id,
    solfege: typeof s.solfege === 'boolean' ? s.solfege : null,   // null: follows the language
    hard: s.hard === true,
  };
}
const settings = readSettings();
// Theme and language are one choice for the whole hub.
Object.assign(settings, loadLook(loadSettings(SETTINGS_KEY)));
const save = () => saveSettings(SETTINGS_KEY, settings);
const solfege = () => (settings.solfege === null ? settings.lang !== 'en' : settings.solfege);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, TUNER_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, repo: REPO_URL },
});
const { t } = i18n;

const tunerEl = document.querySelector('.tuner'), headEl = document.querySelector('.head'), stageEl = $('stage');
const noteEl = $('note'), nameEl = $('note-name'), octEl = $('note-oct'), promptEl = $('prompt'), sayEl = $('say'), dotEl = $('dot'), statusEl = $('status');
const listenBtn = $('listen-btn'), listenLabel = $('listen-label'), btnsEl = $('string-btns');
const tuningSelect = $('tuning-select'), themeSelect = $('theme-select'), langSelect = $('lang-select'), namesSeg = $('names-seg'), toleranceSeg = $('tolerance-seg');
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), supportModal = $('support-modal');

// --- THE TUNING ---
let tuning = tuningById(settings.tuning), strings = stringsOf(tuning);
let lock = null;            // the string tapped to stay on, or null (automatic)
let match = null;           // { index, cents } of the shown pitch, or null
let marks = createTunedMarks(strings.length, { tolerance: tolerance() });

// --- LISTENING ---
let listener = null, wanted = false, errorKey = null;
// Calm, and the reading stays a second after the string fades.
const smoother = createPitchSmoother({ speed: 'calm', holdMs: 1000 });
let shown = null;          // { freq } from the smoother, or null
let rms = 0, marksChanged = false;

function onFrame(frame) {
  rms = frame.rms;
  shown = smoother.push(frame);
  match = shown ? matchString(shown.freq, tuning, { prev: match ? match.index : null, lock }) : null;
  // Only a string that is sounding counts for its mark (not the held reading).
  if (marks.push(frame.time, match && frame.freq > 0 ? match.index : null, match ? match.cents : 0)) marksChanged = true;
}

async function startListening() {
  if (wanted) return;
  wanted = true;
  errorKey = null;
  showButton();
  render(true);
  let l;
  try {
    // No await before this: the sound system must start inside the tap.
    l = await startPitch({
      onFrame, ...rangeOf(tuning), waveform: true,
      onEnd: () => { stopListening(); errorKey = 'ended'; render(true); },
    });
  } catch (err) {
    wanted = false;
    errorKey = ERROR_KEYS[err.reason] || 'errFailed';
    showButton();
    render(true);
    return;
  }
  if (!wanted) { l.stop(); return; }   // Stop was tapped while the browser was asking
  listener = l;
  smoother.reset();
  shown = match = null;
  keepScreenAwake(true);
  render(true);
  run();
}

function stopListening() {
  wanted = false;
  if (listener) { listener.stop(); listener = null; }
  shown = match = null;
  rms = 0;
  smoother.reset();
  keepScreenAwake(false);
  showButton();
  render(true);
  run();   // lets the strings settle
}

const toggle = () => (wanted ? stopListening() : startListening());

function showButton() {
  listenBtn.classList.toggle('on', wanted);
  listenBtn.setAttribute('aria-pressed', String(wanted));
  listenLabel.textContent = t(wanted ? 'stop' : 'start');
}

// Listening stops when the page stays hidden for a second (another app,
// another tab), so the microphone sign goes off. A glance at the
// notifications doesn't stop it.
let hiddenTimer = 0;
document.addEventListener('visibilitychange', () => {
  clearTimeout(hiddenTimer);
  if (document.visibilityState === 'hidden' && wanted) hiddenTimer = setTimeout(stopListening, 1000);
});
window.addEventListener('pagehide', () => { if (wanted) stopListening(); });

// Keep the phone screen on while listening (where the browser allows it).
let wakeLock = null;
async function keepScreenAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch { wakeLock = null; }
}

// --- THE TUNING LIST AND THE STRING CIRCLES ---
const tuningLabel = (tu) => (tu.tuning ? `${t(`inst_${tu.inst}`)} · ${t(`tun_${tu.tuning}`)}` : t(`inst_${tu.inst}`));
function fillTunings() {
  tuningSelect.innerHTML = TUNINGS.map((tu) => `<option value="${tu.id}">${tuningLabel(tu)}</option>`).join('');
  tuningSelect.value = tuning.id;
}

let buttons = [];
function buildButtons() {
  btnsEl.innerHTML = strings.map((s, i) => `<button type="button" class="string-btn" data-i="${i}" aria-pressed="false"><span class="name"></span>${LOCK_SVG}</button>`).join('');
  buttons = [...btnsEl.children];
  buttons.forEach((b, i) => b.addEventListener('click', () => {
    lock = lock === i ? null : i;
    match = null;
    smoother.reset();
    showStrings();
    render(true);
    if (!wanted) startListening();
  }));
  labelButtons();
  showStrings();
}

function labelButtons() {
  buttons.forEach((b, i) => {
    const name = stringName(strings[i], solfege());
    b.querySelector('.name').innerHTML = accidentalHtml(name);
    b.setAttribute('aria-label', t('stringAria').replace('{note}', `${prettyName(name)} ${strings[i].octave}`));
  });
}

let lastActive = -2;
function showStrings(active = lastActive) {
  lastActive = active;
  buttons.forEach((b, i) => {
    b.classList.toggle('active', i === active);
    b.classList.toggle('tuned', marks.marks[i]);
    b.setAttribute('aria-pressed', String(lock === i));
  });
}

function setTuning(id) {
  tuning = tuningById(id);
  strings = stringsOf(tuning);
  settings.tuning = tuning.id;
  lock = null;
  shown = match = null;
  smoother.reset();
  marks = createTunedMarks(strings.length, { tolerance: tolerance() });
  if (listener) listener.setRange(rangeOf(tuning).minFreq, rangeOf(tuning).maxFreq);
  tunerEl.classList.toggle('chromatic', !strings.length);
  buildButtons();
  measure();
  render(true);
  run();
}

// --- THE SCREEN ---
let midi = null, cents = 0, glow = 0, level = 0;
let lastText = { name: null, oct: null, prompt: null, say: null, at: null, note: null, tune: null, idle: null, all: null };
let lastSpoken = '', lastSpokenAt = 0;

// Text and classes change only when they need to; called every frame.
function render(force = false) {
  let name = '', oct = '', say = '', prompt = '', hasNote = false, active = -1;
  const chromatic = !strings.length;
  if (shown && chromatic) {
    const n = nearestNote(shown.freq, 440, midi);
    midi = n.midi;
    cents = n.cents;
    hasNote = true;
  } else if (shown && match) {
    midi = strings[match.index].midi;
    cents = match.cents;
    active = match.index;
    hasNote = true;
  } else midi = null;
  const c = Math.round(cents);
  const inTune = hasNote && Math.abs(c) <= tolerance();
  const allTuned = !chromatic && marks.all && (!hasNote || inTune);

  if (errorKey) say = t(errorKey);
  else if (!wanted) prompt = t('idle');
  else if (!listener) prompt = t('waiting');
  else if (!hasNote) {
    if (allTuned) say = t('allTuned');
    else if (chromatic) prompt = t('playNote');
    else if (lock !== null) prompt = t('playString').replace('{note}', prettyName(stringName(strings[lock], solfege())));
    else prompt = t('play');
  } else {
    if (chromatic) {
      const n = commonNoteName(midi, solfege());
      name = n.name;
      oct = String(n.octave);
    } else {
      name = stringName(strings[active], solfege());
      oct = String(strings[active].octave);
    }
    // Strings say which way to turn the peg; any note just says how far.
    const k = chromatic ? 'plain' : '';
    const key = (base) => (k ? k + base[0].toUpperCase() + base.slice(1) : base);
    if (inTune) say = allTuned ? t('allTuned') : t(chromatic ? 'inTuneNote' : 'inTune');
    else if (Math.abs(c) > 50) say = t(key(c < 0 ? 'muchLow' : 'muchHigh'));
    else say = t(key(c < 0 ? (c === -1 ? 'low1' : 'low') : (c === 1 ? 'high1' : 'high'))).replace('{n}', Math.abs(c));
  }
  if (lock !== null && active < 0 && wanted) active = lock;
  if (force || name !== lastText.name) { nameEl.innerHTML = accidentalHtml(name); lastText.name = name; }
  if (force || oct !== lastText.oct) { octEl.textContent = oct; lastText.oct = oct; }
  if (force || prompt !== lastText.prompt) { promptEl.textContent = prompt; lastText.prompt = prompt; }
  if (force || say !== lastText.say) { sayEl.textContent = say; lastText.say = say; }
  if (force || !wanted !== lastText.idle) { tunerEl.classList.toggle('idle', !wanted); lastText.idle = !wanted; }
  sayEl.classList.toggle('mic-msg', !!errorKey);
  const at = hasNote ? 50 + Math.max(-50, Math.min(50, cents)) : 50;
  if (force || Math.abs(at - lastText.at) > 0.05) { dotEl.style.setProperty('--at', `${at}%`); lastText.at = at; }
  if (force || hasNote !== lastText.note) { tunerEl.classList.toggle('has-note', hasNote); lastText.note = hasNote; }
  if (force || inTune !== lastText.tune) { tunerEl.classList.toggle('in-tune', inTune); lastText.tune = inTune; }
  if (force || allTuned !== lastText.all) { tunerEl.classList.toggle('all-tuned', allTuned); lastText.all = allTuned; }
  if (force || marksChanged || active !== lastActive) { marksChanged = false; showStrings(active); }

  // Screen readers: the note and the words, at most once a second.
  const spoken = hasNote ? `${prettyName(name)} ${oct}: ${say}` : say || prompt;
  const now = performance.now();
  if (spoken !== lastSpoken && (now - lastSpokenAt > 1000 || !hasNote)) {
    statusEl.textContent = spoken;
    lastSpoken = spoken;
    lastSpokenAt = now;
  }
  return { hasNote, inTune, active };
}

// --- THE STRINGS ---
const canvas = $('strings');
const view = createStringsView(canvas);
const wave = new Float32Array(WAVEFORM_SIZE), shape = new Float32Array(160);
let geometry = [];

// Where each string runs: from the top of the strings' area to its bottom, above its circle.
function measure() {
  view.resize();
  const box = canvas.getBoundingClientRect(), st = stageEl.getBoundingClientRect();
  const top = st.top - box.top + 4, bottom = st.bottom - box.top - 4;
  const scale = window.innerWidth > 700 ? 1.25 : 1;
  const widthOf = (m) => scale * Math.max(1, Math.min(3.4, 3.4 - (m - 28) * 0.055));
  geometry = strings.length
    ? buttons.map((b, i) => { const r = b.getBoundingClientRect(); return { x: r.left - box.left + r.width / 2, top, bottom, width: widthOf(strings[i].midi), tuned: false }; })
    : [{ x: st.left - box.left + st.width / 2, top, bottom, width: widthOf(52), tuned: false }];
  fitTitle();
  fitNote();
}

// The title on one line, smaller in a long language and a wide font; when
// that would make it tiny ("Accordatore per strumenti"), on two lines.
const titleEl = document.querySelector('.tool-title');
function fitTitle() {
  titleEl.classList.remove('two-lines');
  titleEl.style.removeProperty('font-size');
  let size = parseFloat(getComputedStyle(titleEl).fontSize);
  // Never below 18 px on one line: a long title wraps onto two lines instead.
  while (size > 18 && titleEl.scrollWidth > titleEl.clientWidth) titleEl.style.fontSize = `${(size -= 0.5)}px`;
  if (titleEl.scrollWidth <= titleEl.clientWidth) return;
  titleEl.classList.add('two-lines');
  titleEl.style.removeProperty('font-size');
  size = parseFloat(getComputedStyle(titleEl).fontSize);
  const tooBig = () => titleEl.scrollWidth > titleEl.clientWidth || titleEl.getBoundingClientRect().height > 2.5 * size * 1.2;
  while (size > 11 && tooBig()) titleEl.style.fontSize = `${(size -= 0.5)}px`;
}

function readColors() {
  const cs = getComputedStyle(document.body);
  view.setColors(cs.getPropertyValue('--color-tune-line'), cs.getPropertyValue('--color-tune'));
}

// The note's size: the widest name this tuning can show (with its octave) must fit.
function fitNote() {
  noteEl.style.removeProperty('--note-size');
  const probe = noteEl.cloneNode(false);
  probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px';
  headEl.appendChild(probe);
  const names = strings.length
    ? strings.map((s) => [stringName(s, solfege()), s.octave])
    : Array.from({ length: 12 }, (_, k) => [commonNoteName(60 + k, solfege()).name, 4]);
  let widest = 0;
  for (const [n, o] of names) {
    probe.innerHTML = `${accidentalHtml(n)}<span class="oct">${o}</span>`;
    widest = Math.max(widest, probe.getBoundingClientRect().width);
  }
  const size = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  const room = headEl.clientWidth * 0.9;
  if (room > 0 && widest > room) noteEl.style.setProperty('--note-size', `${Math.floor(size * room / widest)}px`);
}

let frameId = 0, lastTime = 0;
function run() {
  if (!frameId) { lastTime = performance.now(); frameId = requestAnimationFrame(tick); }
}

function tick(now) {
  frameId = 0;
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  const { hasNote, inTune, active } = render();

  // Loudness: -60 dBFS is still, -20 dBFS a full swing. Grows fast, settles slowly.
  const target = listener && rms > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(rms) + 60) / 40)) : 0;
  level += (target - level) * Math.min(1, dt * (target > level ? 12 : 4));
  glow += ((inTune ? 1 : 0) - glow) * Math.min(1, dt * 6);

  const sounding = hasNote && level > 0.02;
  if (sounding && listener) {
    listener.readWaveform(wave);
    waveShape(wave, listener.sampleRate, shown.freq, shape);
  }
  geometry.forEach((g, i) => { g.tuned = !!marks.marks[i]; });
  view.draw(dt, {
    strings: geometry,
    active: sounding ? (strings.length ? active : 0) : -1,
    shape: sounding ? shape : null,
    amp: level,
    chaos: hasNote ? Math.max(0, Math.min(1, (Math.abs(cents) - tolerance()) / 30)) : 0,
    glow,
    tremble: listener ? level * (hasNote ? 0.4 : 1) : 0,
    presence: wanted ? 0.5 : 0.32,
  });

  // Keeps drawing while listening or settling (the browser pauses this while the page is hidden).
  if (listener || level > 0.005 || glow > 0.01) frameId = requestAnimationFrame(tick);
}

// Before listening, the strings start it too.
stageEl.addEventListener('click', () => { if (!wanted) startListening(); });
headEl.addEventListener('click', () => { if (!wanted) startListening(); });

window.addEventListener('resize', () => { measure(); run(); });
document.fonts?.ready.then(() => { measure(); run(); });

// --- SETTINGS, ABOUT AND PATREON WINDOWS ---
const modals = createModalManager({
  modals: [settingsModal, aboutModal, supportModal],
  escapeAction: (m) => (m === supportModal && support.locked() ? 'ignore' : 'hide'),
});
closeOnBackdrop(modals);
document.querySelectorAll('.modal-header .close-btn').forEach((b) => b.addEventListener('click', () => modals.hideAll()));
// After 30 s untouched, coming back opens the Patreon window (at most every 40 min).
// Listening counts as use, so it never interrupts tuning.
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: () => !!listener });
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));
listenBtn.addEventListener('click', toggle);
tuningSelect.addEventListener('change', () => { setTuning(tuningSelect.value); save(); });

themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
function setTheme(theme) {
  settings.theme = theme;
  applyTheme(theme);
  readColors();
  measure();   // the theme's font changes the sizes
  run();
}
themeSelect.addEventListener('change', () => { setTheme(themeSelect.value); save(); saveLook({ theme: settings.theme }); });
langSelect.addEventListener('change', () => { settings.lang = langSelect.value; applyLanguage(); save(); saveLook({ lang: settings.lang }); });
// Chosen on the home page or in another tool, in another tab or before coming Back here.
watchLook((look) => {
  if (look.theme !== settings.theme) { themeSelect.value = look.theme; setTheme(look.theme); setupCustomSelects(); }
  if (look.lang !== settings.lang) { settings.lang = langSelect.value = look.lang; applyLanguage(); }
});

function showChoices() {
  [...namesSeg.children].forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.names === 'solfege') === solfege())));
  [...toleranceSeg.children].forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.hard === 'true') === settings.hard)));
  tunerEl.style.setProperty('--tol', `${tolerance()}%`);   // the line spans ±50 cents, so 1 cent is 1%
}
[...namesSeg.children].forEach((b) => b.addEventListener('click', () => {
  settings.solfege = b.dataset.names === 'solfege';
  save();
  showChoices();
  labelButtons();
  fitNote();
  render(true);
}));
[...toleranceSeg.children].forEach((b) => b.addEventListener('click', () => {
  settings.hard = b.dataset.hard === 'true';
  marks.setTolerance(tolerance());
  save();
  showChoices();
}));

function applyLanguage() {
  i18n.apply();
  document.title = t('title');
  fillTunings();
  showButton();
  showChoices();
  labelButtons();
  fitTitle();
  fitNote();
  render(true);
  setupCustomSelects();   // labels and option texts changed
}

// --- KEYBOARD: Space starts and stops listening ---
let spaceHandled = false;
document.addEventListener('keydown', (e) => {
  if (e.key !== ' ' || modals.current() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement;
  if (el && el.closest && el.closest('.custom-select, .seg')) return;
  e.preventDefault();   // Space is start/stop everywhere; Enter still presses a focused button
  spaceHandled = true;
  if (!e.repeat) toggle();
});
// Some browsers press a focused button on Space's keyup: stop that too.
document.addEventListener('keyup', (e) => {
  if (e.key === ' ' && spaceHandled) { e.preventDefault(); spaceHandled = false; }
});

// --- START ---
applyTheme(settings.theme);
themeSelect.value = settings.theme;
langSelect.value = settings.lang;
readColors();
tunerEl.classList.toggle('chromatic', !strings.length);
buildButtons();
applyLanguage();
measure();
run();
registerHubWorker('../');
