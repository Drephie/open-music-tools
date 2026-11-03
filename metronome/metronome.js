/* metronome/metronome.js: the Metronome (spec: specs/metronome.md).
 * Sound and timing come from shared/transport.js; this file is the screen:
 * tempo controls, beat dots, settings, windows and keyboard shortcuts.
 */
import { clampBpm, CLICK_SOUNDS, createClicks, startMetronome, createTapTempo, tempoMarking } from '../shared/transport.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, REPO_URL, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { METRONOME_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const MAX_BEATS = 12;
const LEVELS = ['strong', 'normal', 'silent'];
const LEVEL_KEYS = { strong: 'levelStrong', normal: 'levelNormal', silent: 'levelSilent' };
const SETTINGS_KEY = 'metronome.settings.v1';

// On iPhone, play even when the silent switch is on (Safari 16.4+; ignored elsewhere).
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }

// --- SETTINGS (everything is remembered in this browser only) ---
function readSettings() {
  const s = loadSettings(SETTINGS_KEY);
  const int = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : def; };
  return {
    bpm: clampBpm(int(s.bpm, 40, 240, 100)),
    beatsPerBar: int(s.beatsPerBar, 1, MAX_BEATS, 4),
    // Kept for all 12 beats, so fewer-then-more beats brings a pattern back.
    accents: Array.from({ length: MAX_BEATS }, (_, i) =>
      (Array.isArray(s.accents) && LEVELS.includes(s.accents[i]) ? s.accents[i] : i === 0 ? 'strong' : 'normal')),
    subdivision: int(s.subdivision, 1, 4, 1),
    sound: CLICK_SOUNDS.includes(s.sound) ? s.sound : 'click',
    volume: int(s.volume, 0, 200, 100),
  };
}
const settings = readSettings();
// Theme and language are one choice for the whole hub; what this tool saved before is passed on.
Object.assign(settings, loadLook(loadSettings(SETTINGS_KEY)));
const save = () => saveSettings(SETTINGS_KEY, settings);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, METRONOME_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, repo: REPO_URL },
});
const { t } = i18n;

const dotsEl = $('beat-dots');
const bpmInput = $('bpm-input'), bpmSlider = $('bpm-slider');
const tempoWord = document.querySelector('.tempo-word'), tempoMeaning = document.querySelector('.tempo-meaning');
const tapBtn = $('tap-btn'), startBtn = $('start-btn'), startLabel = $('start-label');
const bpbOut = $('bpb-out');
const subdivSelect = $('subdiv-select'), soundSelect = $('sound-select');
const volSlider = $('volume-slider'), volOut = $('volume-out'), volNote = $('volume-note'), volBox = document.querySelector('.volume');
const themeSelect = $('theme-select'), langSelect = $('lang-select');
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), supportModal = $('support-modal');

// --- SOUND ---
let clicks = null, loop = null, playing = false;

async function ensureAudio() {
  await Tone.start();   // first thing: must run inside the tap or click
  if (!clicks) {
    clicks = createClicks();
    clicks.setVolume(settings.volume / 100);
  }
}

async function start() {
  playing = true;
  showPlaying();
  await ensureAudio();
  if (!playing) return;   // stopped while the audio was starting
  if (!loop) {
    loop = startMetronome(clicks, {
      sound: () => settings.sound,
      beatsPerBar: () => settings.beatsPerBar,
      accents: () => settings.accents,
      subdivision: () => settings.subdivision,
      onBeat: (beat, time) => Tone.Draw.schedule(() => lightBeat(beat), time),
    });
  }
  Tone.Transport.stop();   // rewinds to 0, so every start begins a bar
  Tone.Transport.bpm.value = settings.bpm;
  Tone.Transport.start('+0.05');
}

function stop() {
  playing = false;
  Tone.Transport.stop();
  Tone.Draw.cancel(0);
  lightBeat(-1);
  showPlaying();
}

const toggle = () => (playing ? stop() : start());

function showPlaying() {
  startBtn.classList.toggle('playing', playing);
  startBtn.setAttribute('aria-pressed', String(playing));
  startLabel.textContent = t(playing ? 'stop' : 'start');
  keepScreenAwake(playing);
}

// One click to hear a sound or a beat level while stopped.
async function preview(level) {
  if (playing || level === 'silent') return;
  await ensureAudio();
  clicks.play(settings.sound, Tone.now() + 0.02, level);
}

// Keep the phone screen on while playing (where the browser allows it).
let wakeLock = null;
let wakeWanted = false;
async function keepScreenAwake(on) {
  wakeWanted = on;
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      const lock = await navigator.wakeLock.request('screen');
      // Stopped while the browser was granting it: let the screen sleep after all.
      if (!wakeWanted) { lock.release(); return; }
      wakeLock = lock;
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch { wakeLock = null; }
}
// The browser drops the lock when the page is hidden; take it again on return.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && playing) keepScreenAwake(true);
});

// --- BEAT DOTS ---
let litIndex = -1;
function lightBeat(beat) {
  const dots = dotsEl.children;
  if (dots[litIndex]) dots[litIndex].classList.remove('lit');
  litIndex = beat;
  const dot = dots[beat];
  if (dot) {
    void dot.offsetWidth;   // restart the pop animation when the same dot lights again
    dot.classList.add('lit');
  }
}

function renderDots() {
  const n = settings.beatsPerBar;
  dotsEl.style.setProperty('--cols', n <= 6 ? n : Math.ceil(n / 2));
  dotsEl.classList.toggle('two-rows', n > 6);
  while (dotsEl.children.length > n) dotsEl.lastElementChild.remove();
  while (dotsEl.children.length < n) {
    const i = dotsEl.children.length;
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'beat-dot';
    dot.addEventListener('click', () => cycleAccent(i));
    dotsEl.appendChild(dot);
  }
  [...dotsEl.children].forEach((dot, i) => {
    const level = settings.accents[i];
    dot.dataset.level = level;
    dot.setAttribute('aria-label', t('beatAria').replace('{n}', i + 1).replace('{level}', t(LEVEL_KEYS[level])));
  });
}

function cycleAccent(i) {
  const level = LEVELS[(LEVELS.indexOf(settings.accents[i]) + 1) % LEVELS.length];
  settings.accents[i] = level;
  renderDots();
  save();
  preview(level);
}

function setBeatsPerBar(n) {
  settings.beatsPerBar = Math.max(1, Math.min(MAX_BEATS, n));
  bpbOut.textContent = settings.beatsPerBar;
  renderDots();
  save();
}

// --- TEMPO ---
function setTempo(v) {
  settings.bpm = clampBpm(Math.round(v));
  if (playing) Tone.Transport.bpm.value = settings.bpm;
  if (document.activeElement !== bpmInput) { bpmInput.value = settings.bpm; fitBpmInput(); }
  bpmSlider.value = settings.bpm;
  bpmSlider.style.setProperty('--fill', `calc(12px + (100% - 24px) * ${(settings.bpm - 40) / 200})`);
  showTempoName();
  save();
}

function showTempoName() {
  const word = tempoMarking(settings.bpm);
  tempoWord.textContent = word;
  tempoMeaning.textContent = t('t' + word);
  bpmSlider.setAttribute('aria-valuetext', `${settings.bpm} ${t('bpmUnit')}, ${word}`);
}

// The number is as wide as its digits, so "BPM" can sit right next to it on phones.
// Measured in the current font, so it follows theme, screen size and font loading.
const measure = document.createElement('canvas').getContext('2d');
function fitBpmInput() {
  const cs = getComputedStyle(bpmInput);
  measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  bpmInput.style.width = `${Math.ceil(measure.measureText(bpmInput.value || '00').width) + 6}px`;
  // A theme's font loads the first time it is used: measure again once it has.
  if (document.fonts && !document.fonts.check(measure.font)) document.fonts.load(measure.font).then(fitBpmInput, () => {});
}
bpmInput.addEventListener('input', fitBpmInput);
window.addEventListener('resize', fitBpmInput);
document.fonts?.ready.then(fitBpmInput);
bpmInput.addEventListener('focus', () => bpmInput.select());
bpmInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') bpmInput.blur(); });
bpmInput.addEventListener('change', () => {
  const v = parseInt(bpmInput.value, 10);
  if (isNaN(v)) bpmInput.value = settings.bpm;
  else { setTempo(v); bpmInput.value = settings.bpm; }
  fitBpmInput();
});
bpmInput.addEventListener('blur', () => { bpmInput.value = settings.bpm; fitBpmInput(); });
bpmSlider.addEventListener('input', () => setTempo(Number(bpmSlider.value)));

// − / + buttons: one step per press, and holding keeps stepping.
function holdToRepeat(btn, step) {
  let timer = null;
  const stopRepeat = () => { clearTimeout(timer); timer = null; };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();   // no focus or text selection from a mouse press
    stopRepeat();
    step();
    const again = (delay) => { timer = setTimeout(() => { step(); again(70); }, delay); };
    again(400);
    btn.setPointerCapture?.(e.pointerId);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, stopRepeat));
  btn.addEventListener('click', (e) => { if (e.detail === 0) step(); });   // Enter / Space on a focused button
}
holdToRepeat($('slower-btn'), () => setTempo(settings.bpm - 1));
holdToRepeat($('faster-btn'), () => setTempo(settings.bpm + 1));
holdToRepeat($('bpb-down'), () => setBeatsPerBar(settings.beatsPerBar - 1));
holdToRepeat($('bpb-up'), () => setBeatsPerBar(settings.beatsPerBar + 1));

// Tap tempo reacts on touch-down, not release, so the timing is exact.
const tapTempo = createTapTempo();
function tap() {
  tapBtn.classList.remove('tapped');
  void tapBtn.offsetWidth;
  tapBtn.classList.add('tapped');
  const bpm = tapTempo.tap();
  if (bpm) setTempo(bpm);
}
tapBtn.addEventListener('pointerdown', (e) => { if (e.button === 0) { e.preventDefault(); tap(); } });
tapBtn.addEventListener('click', (e) => { if (e.detail === 0) tap(); });

startBtn.addEventListener('click', toggle);

// --- SOUND SETTINGS ---
subdivSelect.addEventListener('change', () => { settings.subdivision = Number(subdivSelect.value); save(); });
soundSelect.addEventListener('change', () => { settings.sound = soundSelect.value; save(); preview('normal'); });

// Volume 0–200%. Above 100% the track, thumb, number and note go from yellow
// (just above 100%) to red (200%): the color at the thumb is mixed in CSS.
function setVolume(v) {
  settings.volume = v;
  if (clicks) clicks.setVolume(v / 100);
  const over = Math.max(0, v - 100);
  const at = `calc(12px + (100% - 24px) * ${v / 200})`;
  const warn = `color-mix(in srgb, var(--color-warn-end) ${over}%, var(--color-warn-start))`;
  volSlider.style.setProperty('--range-bg', over
    ? `linear-gradient(90deg, var(--color-left) 0 50%, var(--color-warn-start) 50%, ${warn} ${at}, var(--border-panel) ${at})`
    : `linear-gradient(90deg, var(--color-left) 0 ${at}, var(--border-panel) ${at})`);
  volSlider.style.setProperty('--thumb', over ? warn : 'var(--color-left)');
  volBox.style.setProperty('--vol-color', over ? warn : 'var(--color-text)');
  volOut.textContent = `${v}%`;
  volNote.hidden = !over;
  volSlider.setAttribute('aria-valuetext', over ? `${v}%, ${t('volLoud')}` : `${v}%`);
  save();
}
volSlider.addEventListener('input', () => setVolume(Number(volSlider.value)));

// --- SETTINGS, ABOUT AND PATREON WINDOWS ---
const modals = createModalManager({
  modals: [settingsModal, aboutModal, supportModal],
  escapeAction: (m) => (m === supportModal && support.locked() ? 'ignore' : 'hide'),
});
closeOnBackdrop(modals);
document.querySelectorAll('.modal-header .close-btn').forEach((b) => b.addEventListener('click', () => modals.hideAll()));
// After 30 s untouched, coming back opens the Patreon window (at most every 40 min).
// Playing counts as use, so it never interrupts someone practising.
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: () => playing });
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));

themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
themeSelect.addEventListener('change', () => { settings.theme = themeSelect.value; applyTheme(settings.theme); fitBpmInput(); save(); saveLook({ theme: settings.theme }); });
langSelect.addEventListener('change', () => { settings.lang = langSelect.value; applyLanguage(); save(); saveLook({ lang: settings.lang }); });
// Chosen on the home page or in another tool, in another tab or before coming Back here.
watchLook((look) => {
  if (look.theme !== settings.theme) { settings.theme = themeSelect.value = look.theme; applyTheme(look.theme); fitBpmInput(); setupCustomSelects(); }
  if (look.lang !== settings.lang) { settings.lang = langSelect.value = look.lang; applyLanguage(); }
});

function applyLanguage() {
  i18n.apply();
  document.title = t('title');
  startLabel.textContent = t(playing ? 'stop' : 'start');
  renderDots();
  showTempoName();
  setVolume(settings.volume);
  setupCustomSelects();   // labels and option texts changed
}

// --- KEYBOARD: Space start/stop, T tap, arrows slower/faster (Shift: by 10) ---
let spaceHandled = false;
document.addEventListener('keydown', (e) => {
  if (modals.current() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement;
  const typing = el === bpmInput;
  const inSelect = !!(el && el.closest && el.closest('.custom-select'));
  if (e.key === ' ') {
    if (typing || inSelect) return;
    e.preventDefault();   // Space is start/stop everywhere; Enter still presses a focused button
    spaceHandled = true;
    if (!e.repeat) toggle();
    return;
  }
  if (typing || inSelect || (el && el.type === 'range')) return;
  if (e.key === 't' || e.key === 'T') {
    if (!e.repeat) tap();
    return;
  }
  const step = e.shiftKey ? 10 : 1;
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setTempo(settings.bpm + step); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setTempo(settings.bpm - step); }
});
// Some browsers press a focused button on Space's keyup: stop that too.
document.addEventListener('keyup', (e) => {
  if (e.key === ' ' && spaceHandled) { e.preventDefault(); spaceHandled = false; }
});

// --- START ---
applyTheme(settings.theme);
themeSelect.value = settings.theme;
langSelect.value = settings.lang;
subdivSelect.value = String(settings.subdivision);
soundSelect.value = settings.sound;
volSlider.value = settings.volume;
bpbOut.textContent = settings.beatsPerBar;
setTempo(settings.bpm);
applyLanguage();
registerHubWorker('../');
