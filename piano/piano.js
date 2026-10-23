/* piano/piano.js: the Piano (spec: specs/piano.md), built from Drephie's
 * Diapason prototype. Sound comes from shared/sound.js and chord names from
 * shared/theory.js; this file is the screen: the 88 keys and their scroll
 * bar, the chord name, the controls, the sideways layout on upright phones,
 * settings, windows and computer keys.
 */
import { startAudio, createRack, INSTRUMENTS } from '../shared/sound.js';
import { nameNotes, midiToFreq, INTERVAL_SHORT, SHARP_LETTERS, SHARP_SOLFEGE } from '../shared/theory.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects, setSelectRoom } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, browserLanguage, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { PIANO_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const LOW = 21, HIGH = 108;   // A0 to C8: the 88 keys
const IS_BLACK = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const MODES = ['hold', 'ring', 'drone'];
const SOUND_KEYS = { piano: 'sndPiano', epiano: 'sndEpiano', esynth: 'sndEsynth', pad: 'sndPad', organ: 'sndOrgan', harp: 'sndHarp' };
// Key sizes, biggest first: the width a white key aims for. The keys then
// fill the width exactly, so a sideways phone shows about 7 to 17 of them.
const KEY_WIDTHS = [92, 80, 71, 64, 58, 53, 49, 45, 42, 38];
const DEFAULT_KEY_SIZE = 5;   // about 12 white keys on a sideways phone: C to the G above the next C
// Computer keys (by position, so any keyboard layout works): an octave from C.
const KEYMAP = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12 };
const SETTINGS_KEY = 'piano.settings.v1';

// On iPhone, play even when the silent switch is on (Safari 16.4+; ignored elsewhere).
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }

// --- SETTINGS (remembered in this browser only) ---
function readSettings() {
  const s = loadSettings(SETTINGS_KEY);
  const int = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : def; };
  return {
    instrument: INSTRUMENTS.includes(s.instrument) ? s.instrument : 'piano',
    mode: MODES.includes(s.mode) ? s.mode : 'hold',
    names: typeof s.names === 'boolean' ? s.names : true,
    solfege: typeof s.solfege === 'boolean' ? s.solfege : null,   // null: follows the language
    keySize: int(s.keySize, 0, KEY_WIDTHS.length - 1, DEFAULT_KEY_SIZE),
    firstWhite: int(s.firstWhite, 0, 51, -1),   // the leftmost white key on screen; -1: around middle C
    volume: int(s.volume, 0, 100, 100),
    flip: s.flip === true,
    theme: THEMES.some(([v]) => v === s.theme) ? s.theme : 'liquid',
    lang: LANGUAGES.includes(s.lang) ? s.lang : browserLanguage(),
  };
}
const settings = readSettings();
const save = () => saveSettings(SETTINGS_KEY, settings);
// Do Re Mi in Spanish and Italian, C D E in English, until the Do/C switch is used.
const solfege = () => (settings.solfege === null ? settings.lang !== 'en' : settings.solfege);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, PIANO_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL },
});
const { t } = i18n;

const stage = $('stage');
const kb = $('kb'), keysWrap = $('keys-wrap'), track = $('track'), thumb = $('thumb');
const readout = $('readout'), rootEl = $('chord-root'), qualEl = $('chord-qual');
const wordsEl = $('chord-words'), notesEl = $('chord-notes'), alsoEl = $('chord-also');
const soundSelect = $('sound-select'), modeSeg = $('mode-seg'), namesBtn = $('names-btn'), solfegeBtn = $('solfege-btn');
const loadingEl = $('loading');
const themeSelect = $('theme-select'), langSelect = $('lang-select');
const volSlider = $('volume-slider'), volOut = $('volume-out');
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), supportModal = $('support-modal');

// --- NOTE NAMES ---
// Theory spells with '#' and 'b'; the screen shows ♯ and ♭.
const ACC_RE = /(^|\/)(Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#+|b+)?/g;
const pretty = (name) => name.replace(ACC_RE, (_, pre, l, acc = '') => pre + l + acc.replace(/#/g, '♯').replace(/b/g, '♭'));
// Same, with the sharps and flats raised and smaller (the big chord name).
const prettyHtml = (name) => name.replace(ACC_RE, (_, pre, l, acc = '') =>
  pre + l + (acc ? `<span class="acc">${acc.replace(/#/g, '♯').replace(/b/g, '♭')}</span>` : ''));
const octaveOf = (m) => Math.floor(m / 12) - 1;
const sharpName = (m, solf = solfege()) => pretty((solf ? SHARP_SOLFEGE : SHARP_LETTERS)[m % 12]);

// --- SOUND ---
let rack = null, rackLoading = null;
function loadRack() {
  if (!rackLoading) {
    rackLoading = createRack()
      .then((r) => { rack = r; rack.setVolume(settings.volume); loadingEl.hidden = true; })
      .catch(() => { rackLoading = null; loadingEl.textContent = t('loadFailed'); loadingEl.hidden = false; });
  }
  return rackLoading;
}
function ensureAudio() {
  if (Tone.context.state !== 'running') startAudio();   // Tone.start() runs at once, inside the tap
  if (!rack) {
    if (!rackLoading) loadingEl.textContent = t('loading');
    loadingEl.hidden = false;
    loadRack();
  }
}
// Browsers allow sound only after a tap, and for a finger they count the
// lift, not the touch: keys play on touch-down, so the first lift (anywhere)
// unlocks the sound too. A note struck before that sounds when it unlocks.
const unlockAudio = () => { if (Tone.context.state !== 'running') startAudio(); };
['pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, true));

// What is sounding: midi -> { inst, drone, timer }. Keys held down count per
// source (each finger, mouse and computer key), so two fingers on one key
// need both lifted.
const sounding = new Map();
const sources = new Map();   // source id -> midi
const holds = new Map();     // midi -> number of sources holding it
let pedal = false;           // Space held: released keys keep ringing (Hold mode)

// Ring: the note fades out gradually by itself from the moment it is struck,
// like a piano note dying away, and its key's light fades with it. Low notes
// fade more slowly: about 4 s at C2, 2.4 s at C4, 1.5 s at C6.
const ringSeconds = (m) => 0.6 + 1.4 * Math.sqrt(440 / midiToFreq(m));
// How long each sound keeps its attack before the fade (the Pad swells in slowly).
const RING_HOLD = { piano: 0, epiano: 0.05, esynth: 0.05, pad: 0.45, organ: 0.06, harp: 0.02 };

function startNote(m, { ring = false, drone = false } = {}) {
  stopNote(m);
  const inst = rack ? rack.instruments[settings.instrument] : null;
  const f = midiToFreq(m);
  const hold = ring ? RING_HOLD[settings.instrument] ?? 0.05 : 0, fade = ring ? ringSeconds(m) : 0;
  const sampler = inst instanceof Tone.Sampler;
  if (inst) {
    // The Sampler fixes a note's fade when the note starts.
    const release = sampler ? inst.release : 0;
    if (sampler && ring) inst.release = fade;
    inst.triggerAttack(f, Tone.immediate());
    if (sampler && ring) inst.release = release;
  }
  const v = { inst, drone, ring, timers: [] };
  if (ring) {
    v.timers.push(setTimeout(() => {
      if (sounding.get(m) !== v || !inst) return;
      if (sampler) { inst.triggerRelease(f, Tone.immediate()); return; }
      // A synth's fade is its release: lengthen it for this one note only.
      const release = inst.get().envelope.release;
      inst.set({ envelope: { release: fade } });
      inst.triggerRelease(f, Tone.immediate());
      inst.set({ envelope: { release } });
    }, hold * 1000));
    v.timers.push(setTimeout(() => {
      if (sounding.get(m) !== v) return;
      sounding.delete(m);   // faded out
      paintKeys();
      scheduleRender();
    }, (hold + fade) * 1000));
  }
  sounding.set(m, v);
  // The key's light fades with the sound (restarted when the key is struck again).
  const el = keyEls.get(m);
  el.classList.remove('ring');
  if (ring) {
    el.style.setProperty('--ring', `${hold + fade}s`);
    void el.offsetWidth;
    el.classList.add('ring');
  }
}
function stopNote(m) {
  const v = sounding.get(m);
  if (!v) return;
  v.timers.forEach(clearTimeout);
  sounding.delete(m);
  if (v.inst) v.inst.triggerRelease(midiToFreq(m), Tone.immediate());
}
// Stops every sound (changing the mode or the sound does this).
function stopAll() {
  for (const m of [...sounding.keys()]) stopNote(m);
  if (rack) Object.values(rack.instruments).forEach((inst) => inst.releaseAll(Tone.immediate()));
  paintKeys();
  keepScreenAwake(false);
}

function pressKey(source, m) {
  if (m < LOW || m > HIGH) return;
  ensureAudio();
  if (sources.has(source)) releaseKey(source);
  sources.set(source, m);
  holds.set(m, (holds.get(m) || 0) + 1);
  if (settings.mode === 'drone') {
    if (sounding.get(m)?.drone) stopNote(m);
    else startNote(m, { drone: true });
    keepScreenAwake([...sounding.values()].some((v) => v.drone));
  } else {
    startNote(m, { ring: settings.mode === 'ring' });
  }
  paintKeys();
  clearTimeout(renderTimer);
  render(true);
}
function releaseKey(source) {
  const m = sources.get(source);
  if (m === undefined) return;
  sources.delete(source);
  const left = (holds.get(m) || 1) - 1;
  if (left > 0) { holds.set(m, left); return; }
  holds.delete(m);
  if (settings.mode === 'hold' && !pedal) stopNote(m);
  paintKeys();
  scheduleRender();
}
function setPedal(down) {
  pedal = down;
  if (down || settings.mode !== 'hold') return;
  for (const m of [...sounding.keys()]) if (!holds.has(m)) stopNote(m);
  paintKeys();
  scheduleRender();
}
// Lifts every finger and key (the page lost focus or was hidden); drones stay.
function releaseEverything() {
  for (const source of [...sources.keys()]) releaseKey(source);
  pointerKeys.clear();
  setPedal(false);
}
window.addEventListener('blur', releaseEverything);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') releaseEverything();
  else if ([...sounding.values()].some((v) => v.drone)) keepScreenAwake(true);
});

// Keep the phone screen on while a drone sounds (where the browser allows it).
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

// --- KEYS ---
const keyEls = new Map();      // midi -> element
const whiteIndex = new Map();  // midi -> white keys to its left
let whites = 0;
for (let m = LOW; m <= HIGH; m++) {
  const el = document.createElement('div');
  el.className = 'key ' + (IS_BLACK[m % 12] ? 'black' : 'white');
  if (m === 60) el.classList.add('middle-c');
  el.dataset.midi = m;
  el.innerHTML = '<span class="kletter computer-only"></span><span class="kname"></span>';
  whiteIndex.set(m, whites);
  if (!IS_BLACK[m % 12]) whites++;
  keyEls.set(m, el);
}
// White keys first, so the black ones sit on top.
for (const black of [0, 1]) for (const [m, el] of keyEls) if (IS_BLACK[m % 12] === black) kb.appendChild(el);

let spelled = new Map();   // midi -> name as the current chord spells it
function labelKeys() {
  for (const [m, el] of keyEls) {
    const lit = sounding.has(m) || holds.has(m);
    const name = lit && spelled.has(m) ? spelled.get(m) : sharpName(m);
    el.querySelector('.kname').textContent = settings.names ? name + (m % 12 === 0 && !(lit && spelled.has(m)) ? octaveOf(m) : '') : '';
  }
}
function paintKeys() {
  for (const [m, el] of keyEls) {
    const v = sounding.get(m);
    el.classList.toggle('drone', !!(v && v.drone));
    el.classList.toggle('ring', !!(v && v.ring));
    el.classList.toggle('on', (!!v && !v.drone && !v.ring) || (holds.has(m) && settings.mode === 'hold'));
  }
  labelKeys();
}
// Small letters on the keys the computer keys play (computers only, via CSS).
let kbdBase = 60;
function letterKeys() {
  for (const el of keyEls.values()) el.querySelector('.kletter').textContent = '';
  for (const [code, i] of Object.entries(KEYMAP)) {
    const el = keyEls.get(kbdBase + i);
    if (el) el.querySelector('.kletter').textContent = code.slice(3);
  }
}

// Key sizes and scrolling. The keys fill the width exactly; scrolling follows
// the finger smoothly and settles on a whole key, so no half key is left at
// the edge. pos: white keys scrolled past the left edge.
let W = 54, visible = 12, pos = 0, fitted = false;
const keysOut = $('keys-out');
function fitKeys() {
  const avail = keysWrap.clientWidth;
  if (!avail) return;
  const center = pos + visible / 2;
  visible = Math.max(5, Math.round(avail / KEY_WIDTHS[settings.keySize]));
  W = avail / visible;
  keysOut.textContent = visible;
  const BW = W * 0.62;
  for (const [m, el] of keyEls) {
    const x = whiteIndex.get(m) * W;
    if (IS_BLACK[m % 12]) { el.style.left = `${x - BW / 2}px`; el.style.width = `${BW}px`; }
    else { el.style.left = `${x}px`; el.style.width = `${W - 1.5}px`; }
  }
  kb.style.width = `${whites * W}px`;
  kb.style.setProperty('--kw', `${W}px`);
  if (settings.firstWhite < 0) {
    // First visit: start on middle C (C4 to the G above C5 on a phone), centred on wider screens.
    scrollKeys(whiteIndex.get(60) - Math.max(0, Math.floor((visible - 12) / 2)), { remember: false });
  } else if (fitted) {
    scrollKeys(center - visible / 2);   // keep the middle of the view where it was
  } else {
    scrollKeys(settings.firstWhite, { remember: false });
  }
  fitted = true;
  placeTicks();
}
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const EASE = '0.28s cubic-bezier(0.2, 0.7, 0.2, 1)';
// glide: animate there (taps on the bar, octave steps, settling after a drag).
// settle: end on a whole key and remember it; while dragging it stays false.
function scrollKeys(p, { glide = false, settle = true, remember = settle } = {}) {
  pos = Math.max(0, Math.min(settle ? Math.round(p) : p, whites - visible));
  const anim = glide && !reduceMotion.matches;
  kb.style.transition = anim ? `transform ${EASE}` : 'none';
  thumb.style.transition = anim ? `left ${EASE}` : 'none';
  kb.style.transform = `translateX(${-pos * W}px)`;
  drawThumb();
  if (remember && settings.firstWhite !== pos) { settings.firstWhite = pos; save(); }
}
function setKeySize(i) {
  settings.keySize = Math.max(0, Math.min(KEY_WIDTHS.length - 1, i));
  $('keys-fewer').disabled = settings.keySize === 0;
  $('keys-more').disabled = settings.keySize === KEY_WIDTHS.length - 1;
  fitKeys();
  save();
}

// The scroll bar: C1 to C7 marked, the thumb shows what is on screen.
const ticks = [];
for (let o = 1; o <= 7; o++) {
  const el = document.createElement('div');
  el.className = 'tick';
  track.appendChild(el);
  ticks.push({ el, midi: (o + 1) * 12, o });
}
function placeTicks() {
  for (const tk of ticks) tk.el.style.left = `${(whiteIndex.get(tk.midi) + 0.5) / whites * 100}%`;
}
function labelTicks() {
  for (const tk of ticks) tk.el.textContent = (solfege() ? 'Do' : 'C') + tk.o;
}
function drawThumb() {
  thumb.style.left = `${pos / whites * 100}%`;
  thumb.style.width = `${visible / whites * 100}%`;
  const mid = pos + visible / 2;
  let here = ticks[0];
  for (const tk of ticks) {
    const x = whiteIndex.get(tk.midi);
    tk.el.classList.toggle('here', x >= pos - 0.5 && x < pos + visible - 0.5);
    if (Math.abs(x + 3.5 - mid) < Math.abs(whiteIndex.get(here.midi) + 3.5 - mid)) here = tk;
  }
  track.setAttribute('aria-valuenow', here.o);
  track.setAttribute('aria-valuetext', (solfege() ? 'Do' : 'C') + here.o);
}
// Touching the bar glides there; dragging follows the finger; letting go settles.
let scrubbing = null;
function scrubTarget(e) {
  const p = toLocal(e.clientX, e.clientY), r = localRect(track);
  const frac = Math.max(0, Math.min(1, (p.x - r.left) / (r.right - r.left)));
  return frac * whites - visible / 2;
}
track.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  scrubbing = e.pointerId;
  try { track.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  scrollKeys(scrubTarget(e), { glide: true });
});
track.addEventListener('pointermove', (e) => { if (scrubbing === e.pointerId) scrollKeys(scrubTarget(e), { settle: false }); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => track.addEventListener(ev, (e) => {
  if (scrubbing !== e.pointerId) return;
  scrubbing = null;
  scrollKeys(pos, { glide: true });
}));
track.addEventListener('keydown', (e) => {
  const step = { ArrowLeft: -7, ArrowRight: 7, PageUp: -7, PageDown: 7, Home: -99, End: 99 }[e.key];
  if (step === undefined) return;
  e.preventDefault();
  scrollKeys(pos + step, { glide: true });
});
// Mouse wheel or trackpad: sideways (or up and down) moves along the keyboard.
let wheelTimer = null;
function onWheel(e) {
  e.preventDefault();
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  scrollKeys(pos + d / W, { settle: false });
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => scrollKeys(pos, { glide: true }), 160);
}
keysWrap.addEventListener('wheel', onWheel, { passive: false });
track.addEventListener('wheel', onWheel, { passive: false });

// Fingers and mouse: every pointer plays its own key; sliding plays each key
// it crosses (not in Drone, where a tap starts or stops a key).
const pointerKeys = new Map();   // pointerId -> midi
const keyAt = (x, y) => {
  const el = document.elementFromPoint(x, y);
  const key = el && el.closest && el.closest('.key');
  return key ? Number(key.dataset.midi) : null;
};
keysWrap.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const m = keyAt(e.clientX, e.clientY);
  if (m === null) return;
  e.preventDefault();
  try { keysWrap.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  pointerKeys.set(e.pointerId, m);
  pressKey('p' + e.pointerId, m);
});
keysWrap.addEventListener('pointermove', (e) => {
  const prev = pointerKeys.get(e.pointerId);
  if (prev === undefined || settings.mode === 'drone') return;
  const m = keyAt(e.clientX, e.clientY);
  if (m === null || m === prev) return;
  pointerKeys.set(e.pointerId, m);
  pressKey('p' + e.pointerId, m);   // lets go of the key it left
});
function lift(e) {
  if (!pointerKeys.has(e.pointerId)) return;
  pointerKeys.delete(e.pointerId);
  releaseKey('p' + e.pointerId);
}
window.addEventListener('pointerup', lift);
window.addEventListener('pointercancel', lift);
keysWrap.addEventListener('contextmenu', (e) => e.preventDefault());
// No zoom gestures on the keys (iPhone Safari).
document.addEventListener('gesturestart', (e) => e.preventDefault());

// --- CHORD NAME ---
let renderTimer = null;
// Lifting a chord's fingers one by one shouldn't flash the in-between names.
const scheduleRender = () => { clearTimeout(renderTimer); renderTimer = setTimeout(() => render(false), 150); };
let lastResult = null;
function render(flash) {
  const midis = [...new Set([...sounding.keys(), ...holds.keys()])];
  if (midis.length) lastResult = nameNotes(midis, solfege());
  else if (!lastResult) lastResult = nameNotes([60], solfege());
  else if (flash === null) lastResult = nameNotes(lastResult.notes.map((n) => n.midi), solfege());   // names re-spelled (Do/C)
  showResult(lastResult);
  spelled = new Map(midis.length && lastResult.kind !== 'note' ? lastResult.notes.map((n) => [n.midi, pretty(n.name)]) : []);
  labelKeys();
  if (flash) {
    readout.classList.add('lit');
    requestAnimationFrame(() => requestAnimationFrame(() => readout.classList.remove('lit')));
  }
}
function showResult(r) {
  const notes = r.notes.map((n) => pretty(n.name) + n.octave).join(' · ');
  let big = '', qual = '', words = '', also = '';
  if (r.kind === 'note') {
    const n = r.notes[0];
    big = prettyHtml(n.name);
    qual = String(n.octave);
    words = `${sharpName(n.midi, !solfege())}${n.octave} · ${midiToFreq(n.midi).toFixed(1)} Hz`;
    if (r.enharmonic) also = `${t('also')}: ${pretty(r.enharmonic)}${n.octave}`;
  } else if (r.kind === 'interval') {
    big = INTERVAL_SHORT[r.interval];
    words = t('iv' + r.interval);
  } else if (r.kind === 'chord') {
    big = prettyHtml(r.root);
    qual = (solfege() && r.form.suffix ? ' ' : '') + r.form.suffix + (r.bass ? '/' + prettyHtml(r.bass) : '');
    words = `${pretty(r.root)} ${t('q_' + r.form.id)}` + (r.bass ? ', ' + t('inBass').replace('{note}', pretty(r.bass)) : '');
    also = r.alts.length ? `${t('also')}: ${r.alts.map(pretty).join(' · ')}` : '';
  } else {
    big = '—';
    words = t('noName');
  }
  rootEl.innerHTML = big;
  qualEl.innerHTML = qual;
  wordsEl.textContent = words;
  notesEl.textContent = r.kind === 'note' ? '' : notes;
  alsoEl.textContent = also;
  notesEl.hidden = !notesEl.textContent;
  alsoEl.hidden = !also;
  fitBig();
}
// The big name shrinks to fit its space (long names like C♯m7♭5/G).
function fitBig() {
  const big = rootEl.parentElement;
  big.style.fontSize = '';
  const room = readout.clientWidth * (document.body.classList.contains('compact') ? 0.62 : 0.7);
  if (big.scrollWidth > room && room > 0) {
    const base = parseFloat(getComputedStyle(big).fontSize);
    big.style.fontSize = `${Math.max(18, Math.floor(base * room / big.scrollWidth))}px`;
  }
}
document.fonts?.ready.then(fitBig);

// --- LAYOUT: sideways on phones ---
// An upright phone shows the page turned (as after turning the phone to the
// left); "flip" turns it the other way. Sideways phones and computers just
// fit the window.
let turned = false, stageW = 0, stageH = 0, turnMatrix = null;
const coarse = matchMedia('(pointer: coarse)');
function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  const phone = coarse.matches && Math.min(w, h) < 600;
  turned = phone && h > w;
  stageW = turned ? h : w;
  stageH = turned ? w : h;
  const body = document.body.classList;
  body.toggle('turned', turned);
  body.toggle('flipped', turned && settings.flip);
  body.toggle('phone', phone);
  body.toggle('compact', stageH <= 480);
  body.toggle('narrow', stageW < 640 && stageH > 480);
  stage.style.width = `${stageW}px`;
  stage.style.height = `${stageH}px`;
  turnMatrix = turned ? new DOMMatrixReadOnly(getComputedStyle(stage).transform) : null;
  fitKeys();
  fitBig();
}
// Screen point -> point on the (possibly turned) stage.
function toLocal(x, y) {
  if (!turnMatrix) return { x, y };
  const p = turnMatrix.inverse().transformPoint(new DOMPoint(x, y));
  return { x: p.x, y: p.y };
}
function localRect(el) {
  const r = el.getBoundingClientRect();
  const a = toLocal(r.left, r.top), b = toLocal(r.right, r.bottom);
  return { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) };
}
// Dropdown lists open up or down by the room on the stage, not on the screen.
setSelectRoom((trigger) => {
  const r = localRect(trigger);
  return { above: r.top, below: stageH - r.bottom };
});
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 250));
coarse.addEventListener?.('change', layout);

// With rotation lock on, a phone held the other way round shows the piano
// upside down: the motion sensor turns it back where the browser offers it
// without asking (Android); elsewhere the turn-around button does.
window.addEventListener('devicemotion', (e) => {
  const g = e.accelerationIncludingGravity;
  if (!turned || !g || g.x === null || Math.abs(g.x) < 6 || Math.abs(g.x) < Math.abs(g.y)) return;
  const flip = g.x < 0;
  if (flip !== settings.flip) setFlip(flip);
});
function setFlip(on) {
  settings.flip = on;
  save();
  layout();
}
$('flip-btn').addEventListener('click', () => setFlip(!settings.flip));

// --- CONTROLS ---
soundSelect.addEventListener('change', () => {
  stopAll();
  settings.instrument = soundSelect.value;
  save();
});
function setMode(mode) {
  stopAll();
  settings.mode = mode;
  for (const b of modeSeg.children) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  save();
}
modeSeg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) setMode(b.dataset.mode);
});
namesBtn.addEventListener('click', () => {
  settings.names = !settings.names;
  namesBtn.setAttribute('aria-pressed', String(settings.names));
  labelKeys();
  save();
});
solfegeBtn.addEventListener('click', () => {
  settings.solfege = !solfege();
  save();
  showNotation();
});
function showNotation() {
  solfegeBtn.textContent = solfege() ? 'Do' : 'C';
  solfegeBtn.setAttribute('aria-pressed', String(solfege()));
  labelTicks();
  drawThumb();
  render(null);
}
$('keys-fewer').addEventListener('click', () => setKeySize(settings.keySize - 1));
$('keys-more').addEventListener('click', () => setKeySize(settings.keySize + 1));

function setVolume(v) {
  settings.volume = v;
  if (rack) rack.setVolume(v);
  volSlider.style.setProperty('--fill', `calc(12px + (100% - 24px) * ${v / 100})`);
  volOut.textContent = `${v}%`;
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
// A sounding note (held, ringing or a drone) counts as use, so it never interrupts.
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: () => sounding.size > 0 || holds.size > 0 });
document.querySelectorAll('.settings-btn').forEach((b) => b.addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget)));
document.querySelectorAll('.about-btn').forEach((b) => b.addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget)));

themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
soundSelect.innerHTML = INSTRUMENTS.map((id) => `<option value="${id}" data-i18n="${SOUND_KEYS[id]}"></option>`).join('');
themeSelect.addEventListener('change', () => { settings.theme = themeSelect.value; applyTheme(settings.theme); save(); setTimeout(fitBig, 500); });
langSelect.addEventListener('change', () => { settings.lang = langSelect.value; applyLanguage(); save(); });

function applyLanguage() {
  i18n.apply();
  document.title = t('title');
  if (!loadingEl.hidden) loadingEl.textContent = t(rackLoading ? 'loading' : 'loadFailed');
  showNotation();   // Do/C may follow the language
  setupCustomSelects();   // labels and option texts changed
  fitBig();
}

// --- COMPUTER KEYS: A W S E D F T G Y H U J K play, Z / X move an octave, Space lets notes ring ---
let spaceHandled = false;
document.addEventListener('keydown', (e) => {
  if (modals.current() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement;
  if (el && el.closest && el.closest('.custom-select')) return;
  if (e.code === 'Space') {
    e.preventDefault();   // Space is the pedal everywhere; Enter still presses a focused button
    spaceHandled = true;
    if (!e.repeat) setPedal(true);
    return;
  }
  if (e.code in KEYMAP) {
    e.preventDefault();
    if (!e.repeat) pressKey('k' + e.code, kbdBase + KEYMAP[e.code]);
    return;
  }
  if (e.code === 'KeyZ' || e.code === 'KeyX') {
    if (e.repeat) return;
    const next = Math.max(24, Math.min(96, kbdBase + (e.code === 'KeyZ' ? -12 : 12)));
    if (next === kbdBase) return;
    kbdBase = next;
    letterKeys();
    // Keep the computer keys' octave on screen.
    const lo = whiteIndex.get(kbdBase), hi = whiteIndex.get(kbdBase + 12);
    if (lo < pos || hi >= pos + visible) scrollKeys(lo - Math.max(0, Math.floor((visible - 8) / 2)), { glide: true });
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    setPedal(false);
    if (spaceHandled) { e.preventDefault(); spaceHandled = false; }   // some browsers press a focused button on keyup
  } else if (e.code in KEYMAP) {
    releaseKey('k' + e.code);
  }
});

// --- START ---
applyTheme(settings.theme);
themeSelect.value = settings.theme;
langSelect.value = settings.lang;
soundSelect.value = settings.instrument;
volSlider.value = settings.volume;
namesBtn.setAttribute('aria-pressed', String(settings.names));
for (const b of modeSeg.children) b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode));
letterKeys();
layout();
setKeySize(settings.keySize);
setVolume(settings.volume);
applyLanguage();
render(false);
paintKeys();
loadRack();   // the piano samples start loading now, so the first note is ready
registerHubWorker('../');
