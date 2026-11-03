/* vocal-tuner/vocal-tuner.js: the Vocal Tuner (spec: specs/vocal-tuner.md).
 * The microphone and the pitch come from shared/pitch.js; the wave ball is
 * ./ball.js; this file is the screen: the note, the words, the line, the
 * settings, windows and keyboard.
 */
import { startPitch, createPitchSmoother, nearestNote, WAVEFORM_SIZE } from '../shared/pitch.js';
import { commonNoteName } from '../shared/theory.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, REPO_URL, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { waveShape } from '../shared/wave.js';
import { accidentalHtml, prettyName } from '../shared/ui/accidentals.js';
import { createWaveBall, RING_POINTS } from './ball.js';
import { TUNER_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'vocal-tuner.settings.v1';
// In tune within ±10 cents, or ±5 in Hard mode (Drephie, after the phone test).
const tolerance = () => (settings.hard ? 5 : 10);
const MIN_FREQ = 55, MAX_FREQ = 2000;   // La1 to about Si6
const RING_EVERY = 0.065;               // seconds between new rings of the ball
const ERROR_KEYS = { insecure: 'errInsecure', unsupported: 'errUnsupported', denied: 'errDenied', 'no-mic': 'errNoMic', busy: 'errBusy', ended: 'errEnded' };

// --- SETTINGS (remembered in this browser only; nothing sung is kept) ---
function readSettings() {
  const s = loadSettings(SETTINGS_KEY);
  return {
    solfege: typeof s.solfege === 'boolean' ? s.solfege : null,   // null: follows the language
    speed: s.speed === 'quick' ? 'quick' : 'calm',
    hard: s.hard === true,
  };
}
const settings = readSettings();
// Theme and language are one choice for the whole hub; what this tool saved before is passed on.
Object.assign(settings, loadLook(loadSettings(SETTINGS_KEY)));
const save = () => saveSettings(SETTINGS_KEY, settings);
const solfege = () => (settings.solfege === null ? settings.lang !== 'en' : settings.solfege);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, TUNER_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, repo: REPO_URL },
});
const { t } = i18n;

const tunerEl = document.querySelector('.tuner'), stageEl = document.querySelector('.stage');
const noteEl = $('note'), nameEl = $('note-name'), octEl = $('note-oct'), promptEl = $('prompt'), sayEl = $('say'), dotEl = $('dot'), statusEl = $('status');
const listenBtn = $('listen-btn'), listenLabel = $('listen-label');
const themeSelect = $('theme-select'), langSelect = $('lang-select'), namesSeg = $('names-seg'), movementSeg = $('movement-seg'), toleranceSeg = $('tolerance-seg');
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), supportModal = $('support-modal');

// --- LISTENING ---
let listener = null, wanted = false, errorKey = null;
let smoother = createPitchSmoother({ speed: settings.speed });
let shown = null;          // { freq } from the smoother, or null
let rms = 0;

function onFrame(frame) {
  rms = frame.rms;
  shown = smoother.push(frame);
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
      onFrame, minFreq: MIN_FREQ, maxFreq: MAX_FREQ, waveform: true,
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
  shown = null;
  keepScreenAwake(true);
  render(true);
  run();
}

function stopListening() {
  wanted = false;
  if (listener) { listener.stop(); listener = null; }
  shown = null;
  rms = 0;
  smoother.reset();
  keepScreenAwake(false);
  showButton();
  render(true);
  run();   // lets the ball settle back to rest
}

const toggle = () => (wanted ? stopListening() : startListening());

function showButton() {
  listenBtn.classList.toggle('on', wanted);
  listenBtn.setAttribute('aria-pressed', String(wanted));
  listenLabel.textContent = t(wanted ? 'stop' : 'start');
}

// Listening stops when the page stays hidden for a second (another app,
// another tab), so the microphone sign goes off; Start listening again on
// return. A glance at the notifications doesn't stop it.
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

// --- THE SCREEN ---
// Sharp and flat drawn, not typed (shared/ui/accidentals.js).
const prettyHtml = accidentalHtml;

let midi = null, cents = 0, glow = 0, level = 0;
let lastText = { name: null, oct: null, prompt: null, say: null, at: null, note: null, tune: null, idle: null };
let lastSpoken = '', lastSpokenAt = 0;

// Text and classes change only when they need to; called every frame.
function render(force = false) {
  if (shown) {
    const n = nearestNote(shown.freq, 440, midi);
    midi = n.midi;
    cents = n.cents;
  } else midi = null;
  const c = Math.round(cents);
  const hasNote = midi !== null;
  const inTune = hasNote && Math.abs(c) <= tolerance();

  // No note: a prompt inside the ball; a problem with the microphone: the words under it.
  let name = '', oct = '', say = '', prompt = '';
  if (errorKey) say = t(errorKey);
  else if (!wanted) prompt = t('idle');
  else if (!listener) prompt = t('waiting');
  else if (!hasNote) prompt = t('sing');
  else {
    const n = commonNoteName(midi, solfege());
    name = n.name;
    oct = String(n.octave);
    say = inTune ? t('inTune') : t(c < 0 ? (c === -1 ? 'low1' : 'low') : (c === 1 ? 'high1' : 'high')).replace('{n}', Math.abs(c));
  }
  if (force || name !== lastText.name) { nameEl.innerHTML = prettyHtml(name); lastText.name = name; }
  if (force || oct !== lastText.oct) { octEl.textContent = oct; lastText.oct = oct; }
  if (force || prompt !== lastText.prompt) { promptEl.textContent = prompt; lastText.prompt = prompt; }
  if (force || say !== lastText.say) { sayEl.textContent = say; lastText.say = say; }
  if (force || !wanted !== lastText.idle) { tunerEl.classList.toggle('idle', !wanted); lastText.idle = !wanted; }
  sayEl.classList.toggle('mic-msg', !!errorKey);
  const at = hasNote ? 50 + Math.max(-50, Math.min(50, cents)) : 50;
  if (force || Math.abs(at - lastText.at) > 0.05) { dotEl.style.setProperty('--at', `${at}%`); lastText.at = at; }
  if (force || hasNote !== lastText.note) { tunerEl.classList.toggle('has-note', hasNote); lastText.note = hasNote; }
  if (force || inTune !== lastText.tune) { tunerEl.classList.toggle('in-tune', inTune); lastText.tune = inTune; }

  // Screen readers: the note and the words, at most once a second.
  const spoken = hasNote ? `${prettyName(name)} ${oct}: ${say}` : say || prompt;
  const now = performance.now();
  if (spoken !== lastSpoken && (now - lastSpokenAt > 1000 || !hasNote)) {
    statusEl.textContent = spoken;
    lastSpoken = spoken;
    lastSpokenAt = now;
  }
  return { hasNote, inTune };
}

// --- THE WAVE BALL ---
const canvas = $('ball');
const ball = createWaveBall(canvas);
const wave = new Float32Array(WAVEFORM_SIZE), ringShape = new Float32Array(RING_POINTS);
let centre = { x: 0, y: 0, r: 100 };

function measure() {
  ball.resize();
  const box = canvas.getBoundingClientRect(), st = stageEl.getBoundingClientRect();
  centre = { x: st.left - box.left + st.width / 2, y: st.top - box.top + st.height / 2, r: Math.min(st.width, st.height) * 0.42 };
  promptEl.style.setProperty('--prompt-w', `${Math.round(ball.restRadius(centre.r) * 1.75)}px`);
  fitTitle();
  fitNote();
}

// The title on one line, a little smaller in a long language and a wide font,
// but never below 18 px: then it wraps onto two lines instead.
const titleEl = document.querySelector('.tool-title');
function fitTitle() {
  titleEl.classList.remove('two-lines');
  titleEl.style.removeProperty('font-size');
  let size = parseFloat(getComputedStyle(titleEl).fontSize);
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
  ball.setColors(cs.getPropertyValue('--color-tune-line'), cs.getPropertyValue('--color-tune'));
}

// The note's size: the widest name (with an octave) must fit the stage, in this font.
function fitNote() {
  noteEl.style.removeProperty('--note-size');
  const probe = noteEl.cloneNode(false);
  probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px';
  document.body.appendChild(probe);
  let widest = 0;
  for (let m = 60; m < 72; m++) {
    const n = commonNoteName(m, solfege());
    probe.innerHTML = `${prettyHtml(n.name)}<span class="oct">4</span>`;
    widest = Math.max(widest, probe.getBoundingClientRect().width);
  }
  const size = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  const room = Math.min(stageEl.clientWidth * 0.9, centre.r * 2.1);
  if (room > 0 && widest > room) noteEl.style.setProperty('--note-size', `${Math.floor(size * room / widest)}px`);
}

let frameId = 0, lastTime = 0, ringClock = 0;
function run() {
  if (!frameId) { lastTime = performance.now(); frameId = requestAnimationFrame(tick); }
}

function tick(now) {
  frameId = 0;
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  const { hasNote, inTune } = render();

  // Size from loudness: -60 dBFS is the resting ball, -20 dBFS the full ball. Grows fast, shrinks slowly.
  const target = listener && rms > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(rms) + 60) / 40)) : 0;
  level += (target - level) * Math.min(1, dt * (target > level ? 12 : 4));
  glow += ((inTune ? 1 : 0) - glow) * Math.min(1, dt * 6);

  ringClock += dt;
  if (ringClock >= RING_EVERY) {
    ringClock = 0;
    let shape = null;
    if (listener && level > 0.02) {
      listener.readWaveform(wave);
      shape = waveShape(wave, listener.sampleRate, hasNote ? shown.freq : 0, ringShape);
    }
    // Round in tune, wilder the further off; sound with no note (talking, noise) is wild too.
    const chaos = hasNote ? Math.max(0, Math.min(1, (Math.abs(cents) - tolerance()) / 40)) : level > 0.05 ? 0.8 : 0;
    ball.pushRing(shape, chaos, glow);
  }
  ball.draw(dt, {
    level, lean: hasNote ? Math.max(-1, Math.min(1, cents / 50)) : 0, cx: centre.x, cy: centre.y, maxR: centre.r,
    presence: wanted ? 0.55 : 0.35, glow,
  });

  // The resting ball keeps breathing (the browser pauses this while the page is hidden).
  if (listener || level > 0.005 || glow > 0.01 || ball.moving()) frameId = requestAnimationFrame(tick);
}

// Before listening, the ball is a big button too.
stageEl.addEventListener('click', () => { if (!wanted) startListening(); });

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
// Listening counts as use, so it never interrupts someone singing.
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: () => !!listener });
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));
listenBtn.addEventListener('click', toggle);

themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
function setTheme(theme) {
  settings.theme = theme;
  applyTheme(theme);
  readColors();
  measure();   // the theme's font changes the note's width
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
  [...movementSeg.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.speed === settings.speed)));
  [...toleranceSeg.children].forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.hard === 'true') === settings.hard)));
  tunerEl.style.setProperty('--tol', `${tolerance()}%`);   // the line spans ±50 cents, so 1 cent is 1%
}
[...namesSeg.children].forEach((b) => b.addEventListener('click', () => {
  settings.solfege = b.dataset.names === 'solfege';
  save();
  showChoices();
  fitNote();
  render(true);
}));
[...toleranceSeg.children].forEach((b) => b.addEventListener('click', () => {
  settings.hard = b.dataset.hard === 'true';
  save();
  showChoices();
}));
[...movementSeg.children].forEach((b) => b.addEventListener('click', () => {
  settings.speed = b.dataset.speed;
  smoother = createPitchSmoother({ speed: settings.speed });
  save();
  showChoices();
}));

function applyLanguage() {
  i18n.apply();
  document.title = t('title');
  showButton();
  showChoices();
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
applyLanguage();
measure();
run();
registerHubWorker('../');
