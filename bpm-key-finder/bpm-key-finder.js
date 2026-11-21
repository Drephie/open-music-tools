/* bpm-key-finder/bpm-key-finder.js: the BPM & Key Finder (spec:
 * specs/bpm-key-finder.md). The listening is shared/analysis.js (Essentia.js
 * in a worker); its rules are shared/analysis-rules.js. This file is the
 * screen: giving it a song (file, microphone, another tab), the answers,
 * ½ / ×2, playing the song with clicks, Tap, settings and windows.
 * The song and its results are never stored: only the settings are.
 */
import { decodeFile, toMono, analyse, listen, canListenToTab } from '../shared/analysis.js';
import { keyLabel, evenBeats, scaleBeats, formatTime } from '../shared/analysis-rules.js';
import { CLICK_SOUNDS, createClicks, tempoMarking, clampBpm } from '../shared/transport.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { accidentalHtml, prettyName } from '../shared/ui/accidentals.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, REPO_URL, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { FINDER_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'bpm-key-finder.settings.v1';
const LISTEN_SECONDS = 30, EARLY_STOP = 15, TAPS_NEEDED = 4;

try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }

// --- SETTINGS (never the song or its results) ---
function readSettings() {
  const s = loadSettings(SETTINGS_KEY);
  const vol = Math.round(Number(s.volume));
  return {
    clicks: typeof s.clicks === 'boolean' ? s.clicks : true,
    sound: CLICK_SOUNDS.includes(s.sound) ? s.sound : 'wood',
    volume: Number.isFinite(vol) && vol >= 0 && vol <= 200 ? vol : 100,
    names: s.names === 'solfege' ? 'solfege' : s.names === 'letters' ? 'letters' : null,
  };
}
const settings = readSettings();
Object.assign(settings, loadLook(loadSettings(SETTINGS_KEY)));
// Note names follow the language at first (Do Re Mi in Spanish and Italian).
if (!settings.names) settings.names = settings.lang === 'en' ? 'letters' : 'solfege';
const save = () => saveSettings(SETTINGS_KEY, settings);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, FINDER_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, repo: REPO_URL },
});
const { t, tf } = i18n;

const views = { start: $('start-view'), busy: $('busy-view'), result: $('result-view') };
const playBtn = $('play-btn'), playLabel = $('play-label'), tapBtn = $('tap-btn');
const posSlider = $('pos-slider'), timesEl = $('times'), beatDot = $('beat-dot');
const halfBtn = $('half-btn'), doubleBtn = $('double-btn');
const clicksSwitch = $('clicks-switch'), soundSelect = $('sound-select');
const volSlider = $('volume-slider'), volOut = $('volume-out'), volNote = $('volume-note'), volBox = document.querySelector('.volume');
const themeSelect = $('theme-select'), langSelect = $('lang-select'), namesSelect = $('names-select');
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), supportModal = $('support-modal');

function show(view) {
  for (const [name, el] of Object.entries(views)) el.hidden = name !== view;
  if (view !== 'result') stopPlaying();
}

// --- THE SONG ---
// song: { title, buffer, seconds, result }; beat: what the clicks follow.
let song = null, job = 0, listener = null, busy = false;
let factor = 1, tapped = null;

function baseBpm() { return tapped ? 60 / tapped.period : song.result.beat.bpm; }
function shownBpm() { return baseBpm() * factor; }
function currentBeats() {
  if (!song || !song.result.beat) return [];
  if (tapped) return evenBeats(tapped.start, tapped.period / factor, song.seconds);
  return scaleBeats(song.result.beat.beats, factor);
}

function setBusy(titleKey, { progress = null, tip = '', live = false } = {}) {
  $('busy-title').textContent = t(titleKey);
  $('busy-bar').style.width = progress === null ? '' : `${Math.round(progress * 100)}%`;
  $('busy-bar').parentElement.classList.toggle('waiting', progress === null);
  $('busy-tip').textContent = tip;
  $('level-row').hidden = !live;
  $('stop-early-btn').hidden = !live;
  $('stop-early-btn').disabled = true;
}

function startError(key) {
  const el = $('start-error');
  el.textContent = t(key);
  el.hidden = false;
  show('start');
}

async function useBuffer(buffer, title, my) {
  setBusy('loadingEngine', { progress: 0 });
  const samples = await toMono(buffer);
  if (my !== job) return;
  let first = true;
  const result = await analyse(samples, {
    onProgress: (p) => { if (my !== job) return; if (first) { first = false; $('busy-title').textContent = t('listening'); } $('busy-bar').style.width = `${Math.round(p * 100)}%`; },
  });
  if (my !== job) return;
  if (player) { player.dispose(); player = null; }
  song = { title, buffer, seconds: buffer.duration, result };
  factor = 1; tapped = null; position = 0;
  busy = false;
  showResult();
  show('result');
  $('result-view').querySelector('.answer').focus?.();
}

async function openFile(file) {
  if (!file) return;
  const my = ++job;
  busy = true;
  $('start-error').hidden = true;
  show('busy');
  setBusy('reading');
  let buffer;
  try { buffer = await decodeFile(file); } catch { if (my === job) { busy = false; startError('badFile'); } return; }
  try { await useBuffer(buffer, file.name, my); } catch (e) { console.error(e); if (my === job) { busy = false; startError('failed'); } }
}

async function startListening(source) {
  const my = ++job;
  busy = true;
  $('start-error').hidden = true;
  show('busy');
  setBusy('listening', { progress: 0, tip: t(source === 'mic' ? 'micTip' : 'tabTip'), live: true });
  $('busy-title').textContent = tf('listeningFor', { s: 0, total: LISTEN_SECONDS });
  listener = listen(source, {
    seconds: LISTEN_SECONDS,
    onLevel: (v) => { $('level-bar').style.width = `${Math.round(v * 100)}%`; },
    onTime: (s) => {
      if (my !== job) return;
      $('busy-title').textContent = tf('listeningFor', { s: Math.floor(s), total: LISTEN_SECONDS });
      $('busy-bar').style.width = `${Math.round(s / LISTEN_SECONDS * 100)}%`;
      $('stop-early-btn').disabled = s < EARLY_STOP;
    },
  });
  let buffer;
  try {
    buffer = await listener.done;
  } catch (e) {
    listener = null;
    if (my !== job) return;
    busy = false;
    const reason = e && e.message;
    if (reason === 'cancelled') { show('start'); return; }
    startError({ denied: source === 'mic' ? 'micDenied' : 'tabDenied', 'no-audio': 'tabNoAudio', unsupported: 'unsupported', 'too-short': 'heardTooLittle' }[reason] || 'failed');
    return;
  }
  listener = null;
  if (my !== job) return;
  $('level-row').hidden = true; $('stop-early-btn').hidden = true;
  try { await useBuffer(buffer, tf('whatWasHeard', { source: t(source === 'mic' ? 'sourceMic' : 'sourceTab') }), my); } catch (e) { console.error(e); if (my === job) { busy = false; startError('failed'); } }
}

function cancelBusy() {
  job++;
  busy = false;
  if (listener) { listener.cancel(); listener = null; }
  show('start');
}

// --- THE ANSWERS ---
function keyText(key) {
  const { root } = keyLabel(key, settings.names === 'solfege');
  return { root, mode: t(key.mode === 'maj' ? 'major' : 'minor') };
}
function keyHtml(key) { const k = keyText(key); return `${accidentalHtml(k.root)} ${k.mode}`; }
function keyPlain(key) { const k = keyText(key); return `${prettyName(k.root)} ${k.mode}`; }

function showResult() {
  const r = song.result;
  $('file-name').textContent = song.title;
  $('file-name').title = song.title;
  const notice = $('result-notice');
  const nothing = r.reason || (!r.beat && !r.key);
  notice.hidden = !nothing;
  notice.textContent = r.reason === 'short' ? t('tooShort') : nothing ? t('nothingFound') : '';
  document.querySelector('.answers').hidden = !!r.reason;
  $('player-box').hidden = !!r.reason;
  showBpm();
  // The key
  $('key-found').hidden = !r.key;
  $('key-none').hidden = !!r.key || !!r.reason;
  if (r.key) {
    const k = keyText(r.key.key);
    $('key-root').innerHTML = accidentalHtml(k.root);
    $('key-mode').textContent = k.mode;
    $('key-found').setAttribute('aria-label', keyPlain(r.key.key));
    $('key-alt').hidden = !r.key.alt;
    if (r.key.alt) $('key-alt').innerHTML = tf('orKey', { key: keyHtml(r.key.alt) });
    $('key-changes').hidden = !r.key.changes.length;
    $('key-changes').innerHTML = r.key.changes.slice(0, 3).map((c) => tf('keyChange', { key: keyHtml(c.key), time: formatTime(c.time) })).join('<br>');
  }
  updatePosition();
}

function showBpm() {
  const r = song.result;
  $('bpm-found').hidden = !r.beat;
  $('bpm-none').hidden = !!r.beat || !!r.reason;
  tapBtn.disabled = !!r.reason;
  if (!r.beat && !tapped) {
    $('metronome-link').hidden = true;
    return;
  }
  $('bpm-found').hidden = false; $('bpm-none').hidden = true;
  const bpm = shownBpm(), base = baseBpm();
  const whole = Math.round(bpm);
  $('bpm-num').textContent = whole;
  const word = tempoMarking(clampBpm(whole));
  document.querySelector('.tempo-word').textContent = word;
  document.querySelector('.tempo-meaning').textContent = t('t' + word);
  const halfOf = Math.round(base) / 2, doubleOf = Math.round(base) * 2;
  // ½ and ×2 of the found speed; the one in use reads as pressed, and pressing it again goes back.
  halfBtn.innerHTML = `½ <span class="alt-num">${halfOf}</span>`;
  doubleBtn.innerHTML = `×2 <span class="alt-num">${doubleOf}</span>`;
  halfBtn.setAttribute('aria-pressed', String(factor === 0.5));
  doubleBtn.setAttribute('aria-pressed', String(factor === 2));
  halfBtn.setAttribute('aria-label', factor === 0.5 ? tf('backAria', { n: Math.round(base) }) : tf('halfAria', { n: halfOf }));
  doubleBtn.setAttribute('aria-label', factor === 2 ? tf('backAria', { n: Math.round(base) }) : tf('doubleAria', { n: doubleOf }));
  const range = r.beat && r.beat.range;
  const note = $('tempo-note');
  if (tapped) { note.hidden = false; note.textContent = t('tapped'); }
  else if (range && range.changes) { note.hidden = false; note.textContent = tf('tempoChanges', { low: Math.round(range.low * factor), high: Math.round(range.high * factor) }); }
  else note.hidden = true;
  const link = $('metronome-link');
  link.hidden = false;
  link.href = `../metronome/?bpm=${clampBpm(whole)}`;
}

function setFactor(f) {
  factor = factor === f ? 1 : f;
  showBpm();
  if (playing) rescheduleFrom(currentTime());
}
halfBtn.addEventListener('click', () => setFactor(0.5));
doubleBtn.addEventListener('click', () => setFactor(2));

// --- PLAYING WITH CLICKS ---
let player = null, clicks = null, playing = false, position = 0;
let startedAt = 0, startedFrom = 0, scheduler = null, nextBeat = 0, endTimer = null;

async function ensureAudio() {
  await Tone.start();
  if (!clicks) { clicks = createClicks(); clicks.setVolume(settings.volume / 100); }
}
function currentTime() {
  if (!playing) return position;
  return Math.min(song.seconds, startedFrom + (Tone.now() - startedAt));
}

function rescheduleFrom(time) {
  const beats = currentBeats();
  nextBeat = beats.findIndex((b) => b >= time - 0.001);
  if (nextBeat < 0) nextBeat = beats.length;
}

function schedule() {
  const beats = currentBeats();
  const now = currentTime(), ahead = now + 0.35;
  while (nextBeat < beats.length && beats[nextBeat] <= ahead) {
    const at = startedAt + (beats[nextBeat] - startedFrom);
    if (at >= Tone.now() - 0.01) {
      if (settings.clicks) clicks.play(settings.sound, Math.max(at, Tone.now()), 'normal');
      Tone.Draw.schedule(flashBeat, at);
    }
    nextBeat++;
  }
  updatePosition();
}

function flashBeat() {
  beatDot.classList.remove('lit');
  void beatDot.offsetWidth;
  beatDot.classList.add('lit');
}

async function play() {
  if (!song || song.result.reason) return;
  playing = true;
  showPlaying();
  await ensureAudio();
  if (!playing) return;
  if (!player) {
    player = new Tone.Player(new Tone.ToneAudioBuffer(song.buffer)).toDestination();
  }
  if (position >= song.seconds - 0.05) position = 0;
  startedAt = Tone.now() + 0.08;
  startedFrom = position;
  player.start(startedAt, startedFrom);
  rescheduleFrom(startedFrom);
  clearInterval(scheduler);
  scheduler = setInterval(schedule, 40);
  clearTimeout(endTimer);
  endTimer = setTimeout(() => { position = song.seconds; stopPlaying(); updatePosition(); }, (song.seconds - startedFrom + 0.1) * 1000);
  keepScreenAwake(true);
}

function stopPlaying() {
  if (playing) position = currentTime();
  playing = false;
  clearInterval(scheduler); scheduler = null;
  clearTimeout(endTimer);
  if (player) { try { player.stop(); } catch { /* not started */ } }
  if (window.Tone) Tone.Draw.cancel(0);
  beatDot.classList.remove('lit');
  showPlaying();
  keepScreenAwake(false);
}
const toggle = () => (playing ? stopPlaying() : play());
playBtn.addEventListener('click', toggle);

function showPlaying() {
  playBtn.classList.toggle('playing', playing);
  playBtn.setAttribute('aria-pressed', String(playing));
  playLabel.textContent = t(playing ? 'pause' : 'play');
}

function updatePosition() {
  if (!song) return;
  const now = currentTime();
  if (document.activeElement !== posSlider || playing) {
    posSlider.max = song.seconds.toFixed(1);
    posSlider.value = now.toFixed(1);
  }
  posSlider.style.setProperty('--fill', `calc(12px + (100% - 24px) * ${song.seconds ? now / song.seconds : 0})`);
  timesEl.textContent = `${formatTime(now)} / ${formatTime(song.seconds)}`;
  posSlider.setAttribute('aria-valuetext', `${formatTime(now)} / ${formatTime(song.seconds)}`);
}
posSlider.addEventListener('input', () => {
  const was = playing;
  if (was) stopPlaying();
  position = Number(posSlider.value);
  updatePosition();
  if (was) play();
});

// Keep the phone screen on while playing (where the browser allows it).
let wakeLock = null, wakeWanted = false;
async function keepScreenAwake(on) {
  wakeWanted = on;
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      const lock = await navigator.wakeLock.request('screen');
      if (!wakeWanted) { lock.release(); return; }
      wakeLock = lock;
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { const lock = wakeLock; wakeLock = null; await lock.release(); }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && playing) keepScreenAwake(true);
  // Leaving the page stops listening, so the phone's microphone sign goes off.
  if (document.visibilityState === 'hidden' && listener) setTimeout(() => { if (document.visibilityState === 'hidden' && listener) listener.stop(); }, 1000);
});

// --- TAP: after 4 taps the speed and the clicks follow your taps ---
let taps = [];
function tap() {
  if (!song || song.result.reason) return;
  tapBtn.classList.remove('tapped'); void tapBtn.offsetWidth; tapBtn.classList.add('tapped');
  const at = playing ? currentTime() : performance.now() / 1000;
  if (taps.length && (at - taps[taps.length - 1] > 2.5 || at < taps[taps.length - 1])) taps = [];
  taps.push(at);
  if (taps.length > 9) taps.shift();
  if (taps.length < TAPS_NEEDED) return;
  const period = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  if (!(period > 60 / 300 && period < 60 / 30)) return;
  factor = 1;
  tapped = { period, start: playing ? taps[taps.length - 1] : (song.result.beat ? song.result.beat.beats[0] || 0 : 0) };
  showBpm();
  if (playing) rescheduleFrom(currentTime());
}
tapBtn.addEventListener('pointerdown', (e) => { if (e.button === 0) { e.preventDefault(); tap(); } });
tapBtn.addEventListener('click', (e) => { if (e.detail === 0) tap(); });

// --- CLICK SETTINGS ---
function setClicks(on) { settings.clicks = on; clicksSwitch.setAttribute('aria-checked', String(on)); save(); }
clicksSwitch.addEventListener('click', () => setClicks(!settings.clicks));
soundSelect.addEventListener('change', async () => {
  settings.sound = soundSelect.value; save();
  if (!playing) { await ensureAudio(); clicks.play(settings.sound, Tone.now() + 0.02, 'normal'); }
});
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

// --- GIVING IT A SONG ---
const fileInput = $('file-input');
$('choose-btn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { const f = fileInput.files && fileInput.files[0]; fileInput.value = ''; openFile(f); });
$('mic-btn').addEventListener('click', () => startListening('mic'));
$('tab-btn').hidden = !canListenToTab();
$('tab-btn').addEventListener('click', () => startListening('tab'));
$('cancel-btn').addEventListener('click', cancelBusy);
$('stop-early-btn').addEventListener('click', () => { if (listener) listener.stop(); });
$('again-btn').addEventListener('click', () => {
  stopPlaying();
  if (player) { player.dispose(); player = null; }
  song = null; position = 0; taps = [];
  show('start');
  $('choose-btn').focus();
});
// Drop a file anywhere on the start screen (computers).
const dropZone = $('drop-zone');
['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => {
  if (views.start.hidden || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault(); dropZone.classList.add('dropping');
}));
['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, () => dropZone.classList.remove('dropping')));
document.addEventListener('drop', (e) => {
  if (views.start.hidden || !e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  openFile(e.dataTransfer.files[0]);
});

// --- SETTINGS, ABOUT AND PATREON WINDOWS ---
const modals = createModalManager({
  modals: [settingsModal, aboutModal, supportModal],
  escapeAction: (m) => (m === supportModal && support.locked() ? 'ignore' : 'hide'),
});
closeOnBackdrop(modals);
document.querySelectorAll('.modal-header .close-btn').forEach((b) => b.addEventListener('click', () => modals.hideAll()));
// Listening or playing counts as use, so the Patreon window never interrupts it.
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: () => playing || busy });
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));

themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
themeSelect.addEventListener('change', () => { settings.theme = themeSelect.value; applyTheme(settings.theme); save(); saveLook({ theme: settings.theme }); });
langSelect.addEventListener('change', () => { settings.lang = langSelect.value; applyLanguage(); save(); saveLook({ lang: settings.lang }); });
namesSelect.addEventListener('change', () => { settings.names = namesSelect.value; save(); if (song) showResult(); });
watchLook((look) => {
  if (look.theme !== settings.theme) { settings.theme = themeSelect.value = look.theme; applyTheme(look.theme); setupCustomSelects(); }
  if (look.lang !== settings.lang) { settings.lang = langSelect.value = look.lang; applyLanguage(); }
});

function applyLanguage() {
  i18n.apply();
  showPlaying();
  setVolume(settings.volume);
  if (song) showResult();
  setupCustomSelects();
}

// --- KEYBOARD: Space play/pause, T tap, O choose a file ---
let spaceHandled = false;
document.addEventListener('keydown', (e) => {
  if (modals.current() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement;
  const inSelect = !!(el && el.closest && el.closest('.custom-select'));
  if (inSelect || (el && el.tagName === 'INPUT' && el.type !== 'range')) return;
  if (e.key === ' ' && !views.result.hidden) {
    e.preventDefault(); spaceHandled = true;
    if (!e.repeat) toggle();
    return;
  }
  if ((e.key === 't' || e.key === 'T') && !views.result.hidden && !e.repeat) tap();
  if ((e.key === 'o' || e.key === 'O') && views.busy.hidden && !e.repeat) { stopPlaying(); fileInput.click(); }
});
document.addEventListener('keyup', (e) => { if (e.key === ' ' && spaceHandled) { e.preventDefault(); spaceHandled = false; } });

// --- START ---
applyTheme(settings.theme);
themeSelect.value = settings.theme;
langSelect.value = settings.lang;
namesSelect.value = settings.names;
soundSelect.value = settings.sound;
volSlider.value = settings.volume;
setClicks(settings.clicks);
applyLanguage();
show('start');
registerHubWorker('../');
