/* pitch-detector/pitch-detector.js: the Pitch Detector (spec:
 * specs/pitch-detector.md). The microphone and the pitch come from
 * shared/pitch.js; the line and the keys' names are ./trace.js; the graph is
 * drawn by ./graph-view.js; the piano is shared/sound.js. This file is the
 * screen: the note at the top, fitting the view to the notes on screen, pause and looking back,
 * tapping a key to hear it, the settings, windows and keyboard.
 */
import { startPitch, createPitchSmoother, nearestNote } from '../shared/pitch.js';
import { commonNoteName, midiToFreq, parseKey, MAJOR_SCALE_STEPS, MINOR_SCALE_STEPS } from '../shared/theory.js';
import { startAudio, createRack } from '../shared/sound.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { accidentalHtml, prettyName } from '../shared/ui/accidentals.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { createTrace, laneNames, fitView, KEY_CHOICES, keyLabel } from './trace.js';
import { createGraphView } from './graph-view.js';
import { DETECTOR_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'pitch-detector.settings.v1';
const MIN_FREQ = 50, MAX_FREQ = 2000;      // a little under La1 to above Si6
const LOWEST = 33, HIGHEST = 95;            // the notes the graph can show (La1..Si6)
const REF_SECONDS = 2;                      // a tapped key sounds this long
const REF_QUIET = 0.35;                     // and the line waits this much longer (the room's echo)
const ERROR_KEYS = { insecure: 'errInsecure', unsupported: 'errUnsupported', denied: 'errDenied', 'no-mic': 'errNoMic', busy: 'errBusy', ended: 'errEnded' };
const toMidi = (f) => 69 + 12 * Math.log2(f / 440);
const nowS = () => performance.now() / 1000;

// --- SETTINGS (remembered in this browser only; nothing sung is kept) ---
function readSettings() {
  const s = loadSettings(SETTINGS_KEY);
  return {
    solfege: typeof s.solfege === 'boolean' ? s.solfege : null,   // null: follows the language
    key: KEY_CHOICES.includes(s.key) ? s.key : 'none',
  };
}
const settings = readSettings();
// Theme and language are one choice for the whole hub.
Object.assign(settings, loadLook(loadSettings(SETTINGS_KEY)));
const save = () => saveSettings(SETTINGS_KEY, settings);
const solfege = () => (settings.solfege === null ? settings.lang !== 'en' : settings.solfege);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, DETECTOR_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL },
});
const { t } = i18n;

const detectorEl = document.querySelector('.detector'), readoutEl = document.querySelector('.readout');
const noteEl = $('note'), nameEl = $('note-name'), octEl = $('note-oct'), centsEl = $('cents'), promptEl = $('prompt'), statusEl = $('status');
const listenBtn = $('listen-btn'), listenLabel = $('listen-label'), pauseBtn = $('pause-btn');
const graphEl = $('graph'), canvas = $('graph-canvas');
const themeSelect = $('theme-select'), langSelect = $('lang-select'), keySelect = $('key-select'), namesSeg = $('names-seg');
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), supportModal = $('support-modal');

// --- THE LINE ---
// Times are on the page's clock (performance.now, in seconds). Frames carry the
// microphone's clock: `offset` maps one to the other (the smallest delay seen).
const trace = createTrace({ seconds: 120 });
let refs = [];               // { midi, t0, t1 }: notes heard from the piano
let quietUntil = 0;          // the line waits while a tapped key sounds
let paused = false, viewEnd = 0, frozenAt = 0;   // looking back: the right edge, and how far forward it can go
let offset = Infinity;

// --- LISTENING ---
let listener = null, wanted = false, errorKey = null;
const smoother = createPitchSmoother({ speed: 'calm' });
let shown = null;            // { freq } for the note at the top, or null

function onFrame(frame) {
  offset = Math.min(offset, nowS() - frame.time);
  const time = frame.time + offset;
  if (paused) return;
  if (time < quietUntil) { trace.break(time); shown = smoother.push({ ...frame, freq: 0 }); return; }
  trace.push(time, frame.freq > 0 ? toMidi(frame.freq) : NaN);
  shown = smoother.push(frame);
}

function setAudioSession(type) {
  try { if (navigator.audioSession) navigator.audioSession.type = type; } catch { /* not supported */ }
}
// The piano also plays with the iPhone's silent switch on; while listening, the session also records.
setAudioSession('playback');

async function startListening() {
  if (wanted) return;
  wanted = true;
  errorKey = null;
  paused = false;
  showButtons();
  render(true);
  setAudioSession('play-and-record');
  let l;
  try {
    // No await before this: the sound system must start inside the tap.
    l = await startPitch({
      onFrame, minFreq: MIN_FREQ, maxFreq: MAX_FREQ,
      onEnd: () => { stopListening(); errorKey = 'ended'; render(true); },
    });
  } catch (err) {
    wanted = false;
    errorKey = ERROR_KEYS[err.reason] || 'errFailed';
    setAudioSession('playback');
    showButtons();
    render(true);
    return;
  }
  if (!wanted) { l.stop(); return; }   // Stop was tapped while the browser was asking
  listener = l;
  offset = Infinity;
  smoother.reset();
  shown = null;
  trace.break(nowS());
  keepScreenAwake(true);
  render(true);
  run();
}

function stopListening() {
  wanted = false;
  if (listener) { listener.stop(); listener = null; }
  setAudioSession('playback');
  trace.break(nowS());
  if (!paused) frozenAt = viewEnd = nowS();
  paused = false;
  shown = null;
  smoother.reset();
  keepScreenAwake(false);
  showButtons();
  render(true);
  run();
}

const toggle = () => (wanted ? stopListening() : startListening());

function setPaused(on) {
  if (!listener || on === paused) return;
  paused = on;
  if (on) frozenAt = viewEnd = nowS();
  trace.break(nowS());
  smoother.reset();
  shown = null;
  showButtons();
  render(true);
  run();
}

function showButtons() {
  listenBtn.classList.toggle('on', wanted);
  listenBtn.setAttribute('aria-pressed', String(wanted));
  listenLabel.textContent = t(wanted ? 'stop' : 'start');
  pauseBtn.hidden = !wanted;
  pauseBtn.setAttribute('aria-pressed', String(paused));
  pauseBtn.setAttribute('aria-label', t(paused ? 'resume' : 'pause'));
}

// Listening stops when the page stays hidden for a second (another app,
// another tab), so the microphone sign goes off.
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

// --- THE PIANO: tap a key to hear it ---
let rack = null, rackLoading = null, pending = null, pianoMsg = null, pressed = null, pressedUntil = 0;
function loadRack() {
  if (!rackLoading) {
    rackLoading = createRack()
      .then((r) => { rack = r; pianoMsg = null; render(true); })
      .catch(() => { rackLoading = null; pianoMsg = 'loadFailed'; render(true); });
  }
  return rackLoading;
}
// Browsers allow sound only after a tap (for a finger: its lift), a click or a key.
const unlockAudio = () => { if (Tone.context.state !== 'running') startAudio(); };
['pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, true));

function playKey(midi) {
  unlockAudio();
  midi = Math.max(LOWEST, Math.min(HIGHEST, midi));
  pressed = midi;
  pressedUntil = nowS() + REF_SECONDS;
  if (!rack) {
    pending = midi;
    pianoMsg = 'loading';
    loadRack().then(() => { if (rack && pending === midi) { pending = null; playKey(midi); } });
    render(true);
    run();
    return;
  }
  const now = nowS();
  rack.instruments.piano.releaseAll(Tone.immediate());
  rack.instruments.piano.triggerAttackRelease(midiToFreq(midi), REF_SECONDS - 0.3, Tone.immediate());
  if (listener && !paused) {
    refs.push({ midi, t0: now, t1: now + REF_SECONDS });
    quietUntil = now + REF_SECONDS + REF_QUIET;
    trace.break(now);
  }
  render(true);
  run();
}

// --- THE SCREEN ---
let lastText = { name: null, oct: null, cents: null, prompt: null, msg: null, idle: null, looking: null };
let lastSpoken = '', lastSpokenAt = 0, midi = null;

// Text changes only when it needs to; called every frame.
function render(force = false) {
  const now = nowS();
  let name = '', oct = '', cents = '', prompt = '', msg = false;
  const live = listener && !paused;
  if (errorKey) { prompt = t(errorKey); msg = true; }
  else if (pianoMsg) prompt = t(pianoMsg);
  else if (live && now < quietUntil) prompt = t('listen');
  else if (paused) prompt = t('paused');
  else if (!wanted) prompt = trace.size > 1 ? t('stopped') : t('idle');
  else if (!listener) prompt = t('waiting');
  else if (!shown) prompt = t('sing');
  else {
    const n = nearestNote(shown.freq, 440, midi);
    midi = n.midi;
    const c = Math.round(n.cents);
    const nn = commonNoteName(midi, solfege());
    name = nn.name;
    oct = String(nn.octave);
    const sign = c > 0 ? '+' : c < 0 ? '−' : '';
    cents = t(Math.abs(c) === 1 ? 'cents1' : 'cents').replace('{n}', `${sign}${Math.abs(c)}`);
  }
  if (!name) midi = null;
  if (force || name !== lastText.name) { nameEl.innerHTML = accidentalHtml(name); noteEl.hidden = !name; lastText.name = name; }
  if (force || oct !== lastText.oct) { octEl.textContent = oct; lastText.oct = oct; }
  if (force || cents !== lastText.cents) { centsEl.textContent = cents; lastText.cents = cents; }
  if (force || prompt !== lastText.prompt) { promptEl.textContent = prompt; promptEl.hidden = !prompt; lastText.prompt = prompt; }
  if (force || msg !== lastText.msg) { promptEl.classList.toggle('mic-msg', msg); readoutEl.classList.toggle('msg', msg); lastText.msg = msg; }
  const looking = !live && trace.size > 1;
  if (force || looking !== lastText.looking) { detectorEl.classList.toggle('looking', looking); lastText.looking = looking; }

  // Screen readers: the note and the cents, at most once a second.
  const spoken = name ? `${prettyName(name)} ${oct}, ${cents}` : prompt;
  if (spoken !== lastSpoken && (now - lastSpokenAt > 1 || !name)) {
    statusEl.textContent = spoken;
    lastSpoken = spoken;
    lastSpokenAt = now;
  }
}

// --- THE GRAPH ---
const view = createGraphView(canvas);
// The graph's bottom and top (MIDI), eased toward fitView of the notes on screen.
let low = 55, high = 69, names = laneNames(settings.key, solfege()), keyPcs = null;

function readLook() {
  const cs = getComputedStyle(document.body);
  view.setLook({ text: cs.getPropertyValue('--color-text'), accent: cs.getPropertyValue('--color-tune'), page: cs.getPropertyValue('--bg-page'), font: cs.getPropertyValue('--font-main') });
}

function showKey() {
  names = laneNames(settings.key, solfege());
  if (settings.key === 'none') keyPcs = null;
  else {
    const k = parseKey(settings.key);
    keyPcs = (k.scaleType === 'min' ? MINOR_SCALE_STEPS : MAJOR_SCALE_STEPS).map((s) => (k.rootIdx + s) % 12);
  }
}

function measure() {
  view.resize();
  fitTitle();
}

// The title on one line, smaller in a long language and a wide font; when
// that would make it tiny ("Rilevatore di intonazione"), on two lines.
const titleEl = document.querySelector('.tool-title');
function fitTitle() {
  titleEl.classList.remove('two-lines');
  titleEl.style.removeProperty('font-size');
  let size = parseFloat(getComputedStyle(titleEl).fontSize);
  while (size > 13 && titleEl.scrollWidth > titleEl.clientWidth) titleEl.style.fontSize = `${(size -= 0.5)}px`;
  if (titleEl.scrollWidth <= titleEl.clientWidth) return;
  titleEl.classList.add('two-lines');
  titleEl.style.removeProperty('font-size');
  size = parseFloat(getComputedStyle(titleEl).fontSize);
  const tooBig = () => titleEl.scrollWidth > titleEl.clientWidth || titleEl.getBoundingClientRect().height > 2.5 * size * 1.2;
  while (size > 11 && tooBig()) titleEl.style.fontSize = `${(size -= 0.5)}px`;
}

// The time at the graph's right edge: now while live, else where you are looking.
const graphEnd = () => (listener && !paused ? nowS() : viewEnd);
// How far back you can look: until the oldest point reaches the left edge.
function clampView(end) {
  const earliest = Number.isNaN(trace.oldest) ? frozenAt : Math.min(frozenAt, trace.oldest + view.layout.seconds);
  return Math.max(earliest, Math.min(frozenAt, end));
}

let frameId = 0, lastTime = 0;
function run() {
  if (!frameId) { lastTime = performance.now(); frameId = requestAnimationFrame(tick); }
}

function tick(nowMs) {
  frameId = 0;
  const dt = Math.min(0.1, (nowMs - lastTime) / 1000);
  lastTime = nowMs;
  render();
  if (pressed !== null && pending === null && nowS() > pressedUntil) pressed = null;
  const live = listener && !paused;
  const end = graphEnd();

  // The view fits the notes on screen (the line, and the notes heard from the
  // piano) with a margin (Drephie): it opens up at once for a jump, and
  // closes in slowly, so it never jitters.
  const t0 = end - view.layout.seconds;
  refs = refs.filter((r) => r.t1 > trace.oldest || Number.isNaN(trace.oldest));
  const ext = trace.extent(t0, end);
  let min = ext ? ext.min : Infinity, max = ext ? ext.max : -Infinity;
  for (const r of refs) if (r.t1 > t0 && r.t0 < end) { min = Math.min(min, r.midi); max = Math.max(max, r.midi); }
  let moving = false;
  if (min <= max) {
    const fit = fitView(min, max, { lowest: LOWEST, highest: HIGHEST });
    low += (fit.low - low) * Math.min(1, dt * (fit.low < low ? 12 : 1.5));
    high += (fit.high - high) * Math.min(1, dt * (fit.high > high ? 12 : 1.5));
    moving = Math.abs(fit.low - low) > 0.01 || Math.abs(fit.high - high) > 0.01;
  }

  view.draw({ trace, end, low, high, names, cName: laneNames('none', solfege())[0], keyPcs, refs, pressed, dot: live && !!shown });
  // Keep drawing while the line moves, a key is lit, or the view is still fitting.
  if (live || pressed !== null || moving || pianoMsg === 'loading') frameId = requestAnimationFrame(tick);
}

// Taps on the graph: a piano key plays; elsewhere, before listening, starts it;
// paused or stopped, dragging sideways looks back.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (view.onKeys(x)) { playKey(Math.round(view.midiAt(y))); return; }
  drag = { id: e.pointerId, x: e.clientX, end: viewEnd, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (Math.abs(e.clientX - drag.x) > 6) drag.moved = true;
  if (!drag.moved || (listener && !paused)) return;
  viewEnd = clampView(drag.end - (e.clientX - drag.x) / view.layout.pxPerSecond);
  run();
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const tapped = !drag.moved;
  drag = null;
  if (tapped && !wanted && trace.size < 2) startListening();
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { drag = null; });

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
// Listening counts as use, so it never interrupts singing.
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: () => !!listener });
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));
listenBtn.addEventListener('click', toggle);
pauseBtn.addEventListener('click', () => setPaused(!paused));

themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
function fillKeys() {
  keySelect.innerHTML = KEY_CHOICES.map((v) => {
    const k = keyLabel(v, solfege());
    const label = k ? t(k.type === 'min' ? 'keyMinor' : 'keyMajor').replace('{root}', prettyName(k.root)) : t('keyNone');
    return `<option value="${v}">${label}</option>`;
  }).join('');
  keySelect.value = settings.key;
}
function setTheme(theme) {
  settings.theme = theme;
  applyTheme(theme);
  readLook();
  measure();
  run();
}
themeSelect.addEventListener('change', () => { setTheme(themeSelect.value); save(); saveLook({ theme: settings.theme }); });
langSelect.addEventListener('change', () => { settings.lang = langSelect.value; applyLanguage(); save(); saveLook({ lang: settings.lang }); });
keySelect.addEventListener('change', () => { settings.key = keySelect.value; save(); showKey(); run(); });
// Chosen on the home page or in another tool, in another tab or before coming Back here.
watchLook((look) => {
  if (look.theme !== settings.theme) { themeSelect.value = look.theme; setTheme(look.theme); setupCustomSelects(); }
  if (look.lang !== settings.lang) { settings.lang = langSelect.value = look.lang; applyLanguage(); }
});

function showChoices() {
  [...namesSeg.children].forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.names === 'solfege') === solfege())));
}
[...namesSeg.children].forEach((b) => b.addEventListener('click', () => {
  settings.solfege = b.dataset.names === 'solfege';
  save();
  showChoices();
  showKey();
  fillKeys();
  setupCustomSelects();
  render(true);
  run();
}));

function applyLanguage() {
  i18n.apply();
  document.title = t('title');
  fillKeys();
  showKey();
  showButtons();
  showChoices();
  fitTitle();
  render(true);
  setupCustomSelects();   // labels and option texts changed
  run();
}

// --- KEYBOARD: Space starts and stops, P pauses, the arrows look back ---
let spaceHandled = false;
document.addEventListener('keydown', (e) => {
  if (modals.current() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement;
  if (el && el.closest && el.closest('.custom-select, .seg')) return;
  if (e.key === ' ') {
    e.preventDefault();   // Space is start/stop everywhere; Enter still presses a focused button
    spaceHandled = true;
    if (!e.repeat) toggle();
  } else if (e.key === 'p' || e.key === 'P') {
    if (listener) pauseBtn.click();
  } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !(listener && !paused) && trace.size > 1) {
    e.preventDefault();
    viewEnd = clampView(viewEnd + (e.key === 'ArrowLeft' ? -1 : 1));
    run();
  }
});
// Some browsers press a focused button on Space's keyup: stop that too.
document.addEventListener('keyup', (e) => {
  if (e.key === ' ' && spaceHandled) { e.preventDefault(); spaceHandled = false; }
});

// --- START ---
applyTheme(settings.theme);
themeSelect.value = settings.theme;
langSelect.value = settings.lang;
readLook();
applyLanguage();
measure();
frozenAt = viewEnd = nowS();
run();
loadRack();   // the piano samples start loading now, so the first key is ready
registerHubWorker('../');
