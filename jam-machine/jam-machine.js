/* jam-machine/jam-machine.js: the Jam Machine's screen (spec: specs/jam-machine.md).
 * The rules are in ./jam.js, the styles in ./styles.js, the sound in ./band.js.
 * This file: the style menu, the key (− and + transpose the song), sections
 * (Verse, Chorus...), the chords (tap to change, right-click to lock, hold and
 * drag to move), New chords, Play, Advanced (the key and mode for New chords,
 * bars, speed), Sounds (chord sound, drum kit, parts), Copy, Save and Open
 * (.omt files), settings, windows and keyboard shortcuts.
 * The chords are never stored on the site: only settings are.
 */
import { startAudio, createRack, INSTRUMENTS } from '../shared/sound.js';
import { clampBpm, createTapTempo, tempoMarking } from '../shared/transport.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { accidentalHtml, prettyName } from '../shared/ui/accidentals.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, REPO_URL, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { STYLES, STYLE_IDS, MAX_BARS, MAX_SECTIONS, SECTION_TYPES, chordLabel, chordNotes, keyName, randomKey, newProgression, nextChord, suggestions, changeMode, moveChord, sameChord, toFile, fromFile, nextSectionType, sectionNumbers, duplicateSection, moveSection } from './jam.js';
import { createBand } from './band.js';
import { JAM_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'jam-machine.settings.v1';
const PARTS = ['chords', 'drums', 'bass'];
const PART_KEYS = { chords: 'partChords', drums: 'partDrums', bass: 'partBass' };
const INST_KEYS = { piano: 'instPiano', epiano: 'instEpiano', esynth: 'instEsynth', pad: 'instPad', organ: 'instOrgan', harp: 'instHarp', dreamy: 'instDreamy' };

try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }

// --- SETTINGS (never the chords: those are people's work, kept only in a saved file) ---
function readSettings() {
  const s = loadSettings(SETTINGS_KEY);
  const parts = {};
  for (const p of PARTS) {
    const x = s.parts && s.parts[p];
    parts[p] = { on: x && typeof x.on === 'boolean' ? x.on : true, vol: x && Number.isInteger(x.vol) && x.vol >= 0 && x.vol <= 100 ? x.vol : 80 };
  }
  return {
    style: STYLE_IDS.includes(s.style) ? s.style : 'pop',
    instrument: INSTRUMENTS.includes(s.instrument) ? s.instrument : 'piano',
    kit: ['acoustic', 'synth'].includes(s.kit) ? s.kit : 'acoustic',
    parts,
    countIn: s.countIn === true,
    advOpen: s.advOpen === true,
    solfege: typeof s.solfege === 'boolean' ? s.solfege : null,   // null: follows the language
  };
}
const settings = readSettings();
Object.assign(settings, loadLook(loadSettings(SETTINGS_KEY)));   // theme and language: the hub's one choice
const save = () => saveSettings(SETTINGS_KEY, { style: settings.style, instrument: settings.instrument, kit: settings.kit, parts: settings.parts, countIn: settings.countIn, advOpen: settings.advOpen, solfege: settings.solfege });
const solfege = () => (settings.solfege === null ? settings.lang !== 'en' : settings.solfege);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, JAM_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, repo: REPO_URL },
});
const { t } = i18n;
const tf = (key, vars) => t(key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

// --- THE JAM (in memory only): a song of sections, each with its chords ---
// newKey: the key and mode New chords uses (null = random).
const jam = { style: settings.style, key: null, newKey: { tonic: null, mode: null }, bpm: STYLES[settings.style].bpm, sections: [], cur: 0 };
jam.key = randomKey(jam.style);
jam.sections = [{ type: 'verse', chords: newProgression({ style: jam.style, key: jam.key, length: STYLES[jam.style].bars }) }];
const section = () => jam.sections[jam.cur];
const chords = () => section().chords;
const setChords = (list) => { section().chords = list; };
const songChords = () => jam.sections.flatMap((x) => x.chords);
const sectionName = (i) => { const n = sectionNumbers(jam.sections)[i]; return t('sec_' + jam.sections[i].type) + (n ? ' ' + n : ''); };

const label = (c) => chordLabel(c, jam.key, solfege());
const plainName = (c) => { const l = label(c); return prettyName(l.root) + (solfege() && l.suffix ? ' ' : '') + l.suffix; };
// The chord's note big, its kind smaller after it (Am7: A, then m7).
const nameHtml = (c) => { const l = label(c); return accidentalHtml(l.root) + (l.suffix ? `<span class="sfx">${l.suffix.replace('♭', accidentalHtml('b'))}</span>` : ''); };
const numeral = (c) => label(c).numeral.replace(/^b/, '♭').replace(/^#/, '♯');
const keyTitle = () => tf('keyTitle', { key: prettyName(keyName(jam.key, solfege())), mode: t(jam.key.mode === 'maj' ? 'modeMaj' : 'modeMin') });

// --- SOUND ---
let rack = null, rackLoading = null, band = null;
const loadingEl = $('loading'), playBtn = $('play-btn');
function loadRack() {
  if (!rackLoading) {
    rackLoading = createRack()
      .then((r) => { rack = r; band = createBand(rack); band.setVolumes(settings.parts); loadingEl.hidden = true; })
      .catch(() => { rackLoading = null; loadingEl.textContent = t('loadFailed'); loadingEl.hidden = false; });
  }
  return rackLoading;
}
const unlockAudio = () => { if (window.Tone && Tone.context.state !== 'running') startAudio(); };
['pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, true));

let wantPlay = false, playingBar = -1;
const isPlaying = () => !!band && band.playing();
function setPlayBtn(on) {
  playBtn.classList.toggle('busy', on);
  playBtn.querySelector('use').setAttribute('href', on ? '#i-stop' : '#i-play');
  playBtn.querySelector('.play-label').textContent = t(on ? 'stop' : 'play');
}
async function play() {
  wantPlay = true;
  setPlayBtn(true);
  const ready = Tone.context.state === 'running' ? null : startAudio();
  if (ready) await ready;
  if (!rack) {
    loadingEl.textContent = t('loading');
    loadingEl.hidden = false;
    await loadRack();
    if (!rack) { wantPlay = false; setPlayBtn(false); return; }
  }
  if (!wantPlay) return;
  band.start({
    chords: songChords, key: () => jam.key, style: () => jam.style, bpm: () => jam.bpm,
    instrument: () => settings.instrument, kit: () => settings.kit, parts: () => settings.parts, countIn: () => settings.countIn,
    onBar: (i) => { playingBar = i; lightBars(0); renderSections(); },
    onBeat: (b, i) => { playingBar = i; lightBars(b); },
  });
  keepScreenAwake(true);
}
function stop() {
  wantPlay = false;
  if (band) band.stop();
  playingBar = -1;
  setPlayBtn(false);
  lightBars(-1);
  renderSections();
  keepScreenAwake(false);
}
const togglePlay = () => (wantPlay ? stop() : play());

let wakeLock = null;
async function keepScreenAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      const lock = await navigator.wakeLock.request('screen');
      if (!wantPlay) { lock.release(); return; }
      wakeLock = lock;
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantPlay) keepScreenAwake(true); });

// --- SCREEN ---
const styleSelect = $('style-select'), barsEl = $('bars'), advEl = $('advanced'), advBtn = $('adv-btn'), sectionsEl = $('sections');
function renderStyles() {
  styleSelect.innerHTML = STYLE_IDS.map((id) => `<option value="${id}">${t('style_' + id)}</option>`).join('');
  styleSelect.value = jam.style;
}
styleSelect.addEventListener('change', () => setStyle(styleSelect.value));

function renderHead() {
  $('key-title').innerHTML = tf('keyTitle', { key: accidentalHtml(keyName(jam.key, solfege())), mode: t(jam.key.mode === 'maj' ? 'modeMaj' : 'modeMin') });
  $('key-meta').textContent = tf('keyMeta', { bpm: jam.bpm });
  fitNames();
  advBtn.setAttribute('aria-label', `${tf('keyMeta', { bpm: jam.bpm })}. ${t('advanced')}`);
}

const keySelect = $('key-select'), modeSeg = $('mode-seg');
function renderAdvanced() {
  advEl.hidden = !settings.advOpen;
  document.querySelector('.jm').classList.toggle('adv-open', settings.advOpen);
  advBtn.setAttribute('aria-expanded', String(settings.advOpen));
  const opts = [`<option value="random">${t('random')}</option>`];
  for (let tonic = 0; tonic < 12; tonic++) opts.push(`<option value="${tonic}">${prettyName(keyName({ tonic, mode: jam.newKey.mode || jam.key.mode }, solfege()))}</option>`);
  keySelect.innerHTML = opts.join('');
  keySelect.value = jam.newKey.tonic === null ? 'random' : String(jam.newKey.tonic);
  const mode = jam.newKey.mode || 'random';
  [...modeSeg.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  $('bars-num').textContent = chords().length;
  $('divide-btn').hidden = jam.sections.length > 1;
  renderSpeed();
}
function renderSpeed() {
  $('bpm').textContent = jam.bpm;
  $('tempo-word').textContent = 'BPM · ' + tempoMarking(jam.bpm);
  renderHead();
}

function renderBars() {
  barsEl.innerHTML = '';
  barsEl.classList.toggle('many', chords().length > 4);
  chords().forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bar' + (c.lock ? ' locked' : '');
    b.dataset.i = i;
    const name = plainName(c);
    b.innerHTML = `<span class="bar-num" aria-hidden="true">${i + 1}</span>${c.lock ? '<svg class="bar-lock" aria-hidden="true"><use href="#i-lock"/></svg>' : ''}<span class="bar-name${name.length > 7 ? ' long' : ''}">${nameHtml(c)}</span><span class="bar-deg">${numeral(c)}</span><span class="beats" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
    b.setAttribute('aria-label', tf('barAria', { n: i + 1, name }) + ` (${numeral(c)})` + (c.lock ? ', ' + t('lockedAria') : ''));
    barsEl.appendChild(b);
  });
  $('add-bar').hidden = chords().length >= MAX_BARS;
  $('bars-num').textContent = chords().length;
  lightBars(isPlaying() ? 0 : -1);
  fitNames();
}

// --- SECTIONS: a row of names; tap one to see its chords, tap it again for its window ---
// The bar playing, as a section and a bar in it.
function playingAt() {
  if (playingBar < 0) return null;
  let i = playingBar;
  for (let k = 0; k < jam.sections.length; k++) {
    if (i < jam.sections[k].chords.length) return { section: k, bar: i };
    i -= jam.sections[k].chords.length;
  }
  return null;
}
function renderSections() {
  sectionsEl.hidden = jam.sections.length < 2;
  if (sectionsEl.hidden) return;
  const at = isPlaying() ? playingAt() : null;
  sectionsEl.innerHTML = '';
  jam.sections.forEach((x, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sec' + (at && at.section === i ? ' playing' : '');
    b.textContent = sectionName(i);
    b.setAttribute('aria-pressed', String(i === jam.cur));
    if (at && at.section === i) b.setAttribute('aria-description', t('secPlaying'));
    b.addEventListener('click', () => {
      if (i === jam.cur) { openSection(b); return; }
      jam.cur = i;
      renderAll();
    });
    sectionsEl.appendChild(b);
  });
  if (jam.sections.length < MAX_SECTIONS) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'sec add-sec';
    add.setAttribute('aria-label', t('addSection'));
    add.innerHTML = '<svg aria-hidden="true"><use href="#i-plus"/></svg>';
    add.addEventListener('click', () => addSection());
    sectionsEl.appendChild(add);
  }
}
function addSection(type = nextSectionType(section().type)) {
  const length = STYLES[jam.style].bars === 12 ? 12 : 4;
  jam.sections.splice(jam.cur + 1, 0, { type, chords: newProgression({ style: jam.style, key: jam.key, length }) });
  jam.cur++;
  renderAll();
}
$('divide-btn').addEventListener('click', () => addSection());

const sectionModal = $('section-modal'), typeList = $('type-list');
function renderSectionModal() {
  $('section-title').textContent = sectionName(jam.cur);
  typeList.innerHTML = '';
  for (const type of SECTION_TYPES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.innerHTML = `<b></b>`;
    b.querySelector('b').textContent = t('sec_' + type);
    b.setAttribute('aria-pressed', String(section().type === type));
    b.addEventListener('click', () => { section().type = type; renderSectionModal(); renderSections(); });
    typeList.appendChild(b);
  }
  $('earlier-btn').disabled = jam.cur === 0;
  $('later-btn').disabled = jam.cur === jam.sections.length - 1;
  $('dup-btn').disabled = jam.sections.length >= MAX_SECTIONS;
}
function openSection(opener) { renderSectionModal(); modals.open(sectionModal, opener); }
$('dup-btn').addEventListener('click', () => { jam.sections = duplicateSection(jam.sections, jam.cur); jam.cur++; modals.hideAll(); renderAll(); });
$('del-btn').addEventListener('click', () => {
  jam.sections.splice(jam.cur, 1);
  jam.cur = Math.min(jam.cur, jam.sections.length - 1);
  modals.hideAll();
  renderAll();
});
const moveSec = (by) => { const to = jam.cur + by; jam.sections = moveSection(jam.sections, jam.cur, by); jam.cur = Math.max(0, Math.min(jam.sections.length - 1, to)); renderSectionModal(); renderSections(); };
$('earlier-btn').addEventListener('click', () => moveSec(-1));
$('later-btn').addEventListener('click', () => moveSec(1));
// A chord name that doesn't fit its box gets smaller (Dmaj7 in a wide theme font).
function fitNames() {
  shapeBeats();
  [...barsEl.querySelectorAll('.bar-name'), $('key-title')].forEach((el) => {
    el.style.fontSize = '';
    for (let size = parseFloat(getComputedStyle(el).fontSize); el.scrollWidth > el.clientWidth + 1 && size > 12; ) {
      size *= 0.92;
      el.style.fontSize = size + 'px';
    }
  });
}
window.addEventListener('resize', fitNames);

// In a theme with fully round boxes (Soft Pink: circles and pills) the four beat
// lines follow the curve of the box's bottom instead of a straight line that
// the round edge would cut off. Other themes keep the straight lines.
const SVG_NS = 'http://www.w3.org/2000/svg';
function shapeBeats() {
  barsEl.querySelectorAll('.bar').forEach((bar) => {
    const beats = bar.querySelector('.beats');
    const w = bar.clientWidth, h = bar.clientHeight;
    const R = Math.min(parseFloat(getComputedStyle(bar).borderBottomLeftRadius) || 0, w / 2, h / 2);
    const round = R >= Math.min(w, h) / 2 - 1;
    if (!round) {
      if (beats.classList.contains('arc')) { beats.classList.remove('arc'); beats.innerHTML = '<i></i><i></i><i></i><i></i>'; }
      return;
    }
    // The bottom of the box, 7 px inside its edge: an arc on the left, a straight part (pills), an arc on the right.
    const ri = R - 7, cy = h - R, a = (50 * Math.PI) / 180;
    const pt = (cx, ang) => `${(cx + ri * Math.cos(ang)).toFixed(2)} ${(cy + ri * Math.sin(ang)).toFixed(2)}`;
    const d = `M${pt(R, Math.PI / 2 + a)} A${ri} ${ri} 0 0 0 ${pt(R, Math.PI / 2)} L${pt(w - R, Math.PI / 2)} A${ri} ${ri} 0 0 0 ${pt(w - R, Math.PI / 2 - a)}`;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    beats.classList.add('arc');
    beats.replaceChildren(svg);
    const probe = document.createElementNS(SVG_NS, 'path');
    probe.setAttribute('d', d);
    svg.appendChild(probe);
    const len = probe.getTotalLength(), q = len / 4, gap = Math.min(9, q * 0.3);   // round line ends add 2 px each side
    probe.remove();
    for (let k = 0; k < 4; k++) {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('stroke-dasharray', `${q - gap} ${len}`);
      p.setAttribute('stroke-dashoffset', String(-(k * q + gap / 2)));
      svg.appendChild(p);
    }
  });
  lightBars(isPlaying() ? lastBeat : -1);
}
// Fit again once a theme's font has loaded (it can be wider than the stand-in) or the boxes change size.
if (document.fonts) { document.fonts.ready.then(fitNames); document.fonts.addEventListener('loadingdone', fitNames); }
let fitWidth = 0;
if (window.ResizeObserver) new ResizeObserver(() => { if (barsEl.clientWidth !== fitWidth) { fitWidth = barsEl.clientWidth; fitNames(); } }).observe(barsEl);
// The bar playing is filled; its beat lines light up one by one.
let lastBeat = -1;
function lightBars(beat) {
  lastBeat = beat;
  const at = beat >= 0 ? playingAt() : null;
  [...barsEl.children].forEach((b, i) => {
    const on = !!at && at.section === jam.cur && i === at.bar;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    b.querySelectorAll('.beats > i, .beats path').forEach((d, j) => d.classList.toggle('lit', on && j <= beat));
  });
}

function renderAll() {
  renderAdvanced();
  renderSections();
  renderBars();
}
function render() {
  renderStyles();
  renderAll();
  renderMixers();
}

// --- NEW CHORDS, STYLES ---
// New chords: only the section on screen. One section and nothing locked: a new key too
// (random, or the Key for New chords). Several sections: they keep one key, which only
// changes when a Key or Major/Minor for New chords is picked.
function setSongKey(key) {
  if (key.mode !== jam.key.mode) jam.sections.forEach((x) => { x.chords = changeMode(x.chords, key.mode); });
  jam.key = key;
}
function newChords(length = chords().length) {
  const anyLock = chords().some((c, i) => i < length && c.lock);
  const opts = { key: { tonic: jam.newKey.tonic ?? jam.key.tonic, mode: jam.newKey.mode ?? jam.key.mode }, keyFixed: jam.newKey.tonic !== null, modeFixed: jam.newKey.mode !== null };
  if (jam.sections.length === 1 && !anyLock) jam.key = randomKey(jam.style, Math.random, opts);
  else if (!anyLock) setSongKey(opts.key);
  setChords(newProgression({ style: jam.style, key: jam.key, length, prog: chords() }));
  renderAll();
}
function setStyle(id) {
  if (id === jam.style) return;
  const was = jam.style;
  jam.style = id;
  jam.bpm = STYLES[id].bpm;
  settings.style = id;
  save();
  let length = chords().length;
  if (STYLES[id].bars === 12) length = 12;
  else if (STYLES[was].bars === 12 && length === 12) length = Math.max(4, ...chords().map((c, i) => (c.lock ? i + 1 : 0)));
  renderSpeed();
  newChords(length);
}
$('new-btn').addEventListener('click', () => newChords());
function addBar() {
  if (chords().length >= MAX_BARS) return;
  chords().push(nextChord(jam.style, jam.key, chords()[chords().length - 1]));
  renderBars();
}
function removeBar() {
  if (chords().length <= 1) return;
  chords().pop();
  renderBars();
}
$('add-bar').addEventListener('click', addBar);

// Holding − or + keeps going, faster and faster; a tap or a key press is one step.
function holdRepeat(btn, step) {
  let timer = null, held = false;
  const stopIt = () => { clearTimeout(timer); timer = null; };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    held = true;
    step();
    let delay = 420;
    const go = () => { timer = setTimeout(() => { step(); delay = Math.max(45, delay * 0.82); go(); }, delay); };
    go();
  });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((ev) => btn.addEventListener(ev, stopIt));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('click', () => { if (held) { held = false; return; } step(); });
}
holdRepeat($('more-bars'), addBar);
holdRepeat($('fewer-bars'), removeBar);

// --- THE KEY AT THE TOP: − and + move the whole song a half step ---
const transpose = (by) => { jam.key = { ...jam.key, tonic: (jam.key.tonic + by + 12) % 12 }; renderHead(); renderBars(); if (modals.current() === chordModal) renderChordModal(); };
$('key-down').addEventListener('click', () => transpose(-1));
$('key-up').addEventListener('click', () => transpose(1));

// --- ADVANCED: key, major or minor, speed ---
advBtn.addEventListener('click', () => { settings.advOpen = !settings.advOpen; save(); renderAdvanced(); });
// Key and Major/Minor for New chords: they wait for the next New chords.
keySelect.addEventListener('change', () => { jam.newKey.tonic = keySelect.value === 'random' ? null : +keySelect.value; });
[...modeSeg.children].forEach((b) => b.addEventListener('click', () => {
  jam.newKey.mode = b.dataset.mode === 'random' ? null : b.dataset.mode;
  renderAdvanced();
  setupCustomSelects();
}));
const setBpm = (v) => { jam.bpm = clampBpm(v); renderSpeed(); };
holdRepeat($('slower'), () => setBpm(jam.bpm - 1));
holdRepeat($('faster'), () => setBpm(jam.bpm + 1));
const tapTempo = createTapTempo();
$('tap').addEventListener('pointerdown', () => { const bpm = tapTempo.tap(); if (bpm) setBpm(bpm); });
$('tap').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); const bpm = tapTempo.tap(); if (bpm) setBpm(bpm); } });

// --- SOUNDS: chord sound, and each part on or off with its volume ---
function renderMixers() {
  document.querySelectorAll('.mixer').forEach((mixer, n) => {
    const id = 'inst-select-' + n;
    mixer.innerHTML = `<div class="control-group"><label for="${id}">${t('chordSound')}</label><div class="custom-select"><select id="${id}">${INSTRUMENTS.map((i) => `<option value="${i}">${t(INST_KEYS[i])}</option>`).join('')}</select></div></div>` +
      `<div class="control-group"><span class="group-label" id="kit-label-${n}">${t('kit')}</span><div class="seg kit-seg" role="group" aria-labelledby="kit-label-${n}"><button type="button" data-kit="acoustic">${t('kitAcoustic')}</button><button type="button" data-kit="synth">${t('kitSynth')}</button></div></div>` +
      PARTS.map((p) => {
        const x = settings.parts[p], name = t(PART_KEYS[p]);
        return `<div class="mix-row${x.on ? '' : ' off'}" data-part="${p}"><span class="mix-name" aria-hidden="true">${name}</span><button class="switch" role="switch" aria-checked="${x.on}" aria-label="${tf('onAria', { part: name })}"></button><input type="range" class="range" min="0" max="100" step="1" value="${x.vol}" style="--fill:${x.vol}%" aria-label="${tf('volAria', { part: name })}"><span class="pct" aria-hidden="true">${x.vol}%</span></div>`;
      }).join('');
    const sel = mixer.querySelector('select');
    sel.value = settings.instrument;
    sel.addEventListener('change', () => { settings.instrument = sel.value; save(); syncMixers(); });
    mixer.querySelectorAll('.kit-seg button').forEach((b) => b.addEventListener('click', () => { settings.kit = b.dataset.kit; save(); syncMixers(); }));
    mixer.querySelectorAll('.mix-row').forEach((row) => {
      const p = row.dataset.part, sw = row.querySelector('.switch'), range = row.querySelector('.range');
      sw.addEventListener('click', () => { settings.parts[p].on = !settings.parts[p].on; partsChanged(); });
      range.addEventListener('input', () => { settings.parts[p].vol = +range.value; if (!settings.parts[p].on && +range.value > 0) settings.parts[p].on = true; partsChanged(); });
    });
  });
  syncMixers();
  setupCustomSelects();
}
// Both mixers (window and computer panel) show the same; the band hears it at once.
function syncMixers() {
  document.querySelectorAll('.mixer').forEach((mixer) => {
    const sel = mixer.querySelector('select');
    if (sel.value !== settings.instrument) { sel.value = settings.instrument; setupCustomSelects(); }
    mixer.querySelectorAll('.kit-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kit === settings.kit)));
    mixer.querySelectorAll('.mix-row').forEach((row) => {
      const x = settings.parts[row.dataset.part], range = row.querySelector('.range');
      row.classList.toggle('off', !x.on);
      row.querySelector('.switch').setAttribute('aria-checked', String(x.on));
      if (+range.value !== x.vol) range.value = x.vol;
      range.style.setProperty('--fill', x.vol + '%');
      row.querySelector('.pct').textContent = x.vol + '%';
    });
  });
}
function partsChanged() {
  save();
  syncMixers();
  if (band) band.setVolumes(settings.parts);
}

// --- CHANGE A CHORD ---
const chordModal = $('chord-modal'), fitList = $('fit-list'), moreList = $('more-list'), lockBtn = $('lock-btn');
let editing = -1;
function renderChordModal() {
  const c = chords()[editing];
  if (!c) return;
  $('chord-title').innerHTML = tf('changeTitle', { n: editing + 1, name: nameHtml(c) });
  const { fit, more } = suggestions(jam.style, jam.key);
  const fill = (el, list) => {
    el.innerHTML = '';
    for (const s of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.innerHTML = `<b>${nameHtml(s)}</b><small>${numeral(s)}</small>`;
      b.setAttribute('aria-label', `${plainName(s)} (${numeral(s)})`);
      b.setAttribute('aria-pressed', String(sameChord(s, c, jam.key.mode)));
      b.addEventListener('click', () => pickChord(s));
      el.appendChild(b);
    }
  };
  fill(fitList, fit);
  fill(moreList, more);
  lockBtn.querySelector('use').setAttribute('href', c.lock ? '#i-unlock' : '#i-lock');
  lockBtn.querySelector('span').textContent = t(c.lock ? 'unlock' : 'lock');
  lockBtn.setAttribute('aria-pressed', String(!!c.lock));
  $('remove-btn').disabled = chords().length <= 1;
}
function openChord(i, opener) {
  editing = i;
  renderChordModal();
  modals.open(chordModal, opener);
}
function pickChord(s) {
  const old = chords()[editing];
  chords()[editing] = { ...s, lock: !!old.lock };
  renderChordModal();
  renderBars();
  if (!isPlaying() && rack) band.preview(chordNotes(chords()[editing], jam.key), settings.instrument);   // hear the choice
}
lockBtn.addEventListener('click', () => {
  const c = chords()[editing];
  if (!c) return;
  c.lock = !c.lock;
  renderChordModal();
  renderBars();
});
$('remove-btn').addEventListener('click', () => {
  if (chords().length <= 1) return;
  chords().splice(editing, 1);
  modals.hideAll();
  renderBars();
});

// --- DRAG TO MOVE: a mouse drags at once; a finger holds 0.3 s first, so a swipe still scrolls ---
let drag = null, noClickUntil = 0;
barsEl.addEventListener('pointerdown', (e) => {
  const bar = e.target.closest('.bar');
  if (!bar || e.button > 0) return;
  drag = { from: +bar.dataset.i, id: e.pointerId, x: e.clientX, y: e.clientY, bar, active: false, over: -1, mouse: e.pointerType === 'mouse' };
  if (!drag.mouse) { drag.timer = setTimeout(() => lift(e.clientX, e.clientY), 300); }
});
function lift(x, y) {
  if (!drag || drag.active) return;
  if (chords()[drag.from].lock) { drag = null; noClickUntil = performance.now() + 500; return; }   // locked chords stay put
  drag.active = true;
  const r = drag.bar.getBoundingClientRect();
  const ghost = drag.bar.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.classList.remove('dragging', 'on');
  ghost.style.width = r.width + 'px';
  ghost.style.height = r.height + 'px';
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  drag.bar.classList.add('dragging');
  document.body.classList.add('drag-on');
  moveGhost(x, y);
  try { navigator.vibrate && navigator.vibrate(10); } catch { /* not supported */ }
}
function moveGhost(x, y) {
  drag.ghost.style.left = x + 'px';
  drag.ghost.style.top = y + 'px';
  const el = document.elementFromPoint(x, y);
  const over = el && el.closest ? el.closest('#bars .bar') : null;
  drag.over = over ? +over.dataset.i : drag.over;
  [...barsEl.children].forEach((b, i) => b.classList.toggle('drop', i === drag.over && i !== drag.from));
}
window.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.active) { moveGhost(e.clientX, e.clientY); return; }
  if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
    if (drag.mouse) lift(e.clientX, e.clientY);
    else { clearTimeout(drag.timer); drag = null; }   // a swipe: let the page scroll
  }
});
function endDrag(commit) {
  if (!drag) return;
  clearTimeout(drag.timer);
  if (drag.active) {
    drag.ghost.remove();
    document.body.classList.remove('drag-on');
    noClickUntil = performance.now() + 400;
    if (commit && drag.over >= 0 && drag.over !== drag.from) setChords(moveChord(chords(), drag.from, drag.over));
    drag = null;
    renderBars();
    return;
  }
  drag = null;
}
window.addEventListener('pointerup', () => endDrag(true));
window.addEventListener('pointercancel', () => endDrag(false));
barsEl.addEventListener('touchmove', (e) => { if (drag && drag.active) e.preventDefault(); }, { passive: false });
// Right-click (a mouse) locks or unlocks a chord; a finger's long press is for dragging.
let lastPointer = 'mouse';
barsEl.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; }, true);
barsEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const bar = e.target.closest('.bar');
  if (!bar || lastPointer !== 'mouse') return;
  endDrag(false);
  const c = chords()[+bar.dataset.i];
  c.lock = !c.lock;
  renderBars();
});
barsEl.addEventListener('click', (e) => {
  const bar = e.target.closest('.bar');
  if (!bar || performance.now() < noClickUntil) return;
  openChord(+bar.dataset.i, bar);
});
// Keyboard: Alt + arrow moves the focused chord.
barsEl.addEventListener('keydown', (e) => {
  const bar = e.target.closest('.bar');
  if (!bar || !e.altKey || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  const from = +bar.dataset.i, to = from + (e.key === 'ArrowLeft' ? -1 : 1);
  setChords(moveChord(chords(), from, to));
  renderBars();
  const now = [...barsEl.children][Math.max(0, Math.min(chords().length - 1, to))];
  if (now) now.focus();
});

// --- COPY, SAVE, OPEN ---
const toastEl = $('toast');
let toastTimer = null;
function toast(text) {
  toastEl.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.textContent = ''; }, 2500);
}
$('copy-btn').addEventListener('click', async () => {
  const parts = jam.sections.length < 2 ? [chords().map(plainName).join(' ')] : jam.sections.map((x, i) => `${sectionName(i)}: ${x.chords.map(plainName).join(' ')}`);
  const line = [t('style_' + jam.style), keyTitle(), tf('keyMeta', { bpm: jam.bpm }), ...parts].join(' · ');
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
  toast(t(ok ? 'copied' : 'copyFailed'));
});
$('save-btn').addEventListener('click', () => {
  const text = toFile({ ...jam, sound: { instrument: settings.instrument, kit: settings.kit, ...settings.parts } });
  const keyPart = keyName(jam.key, false).replace('#', 'sharp') + '-' + (jam.key.mode === 'maj' ? 'major' : 'minor');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
  a.download = `jam-${jam.style}-${keyPart}.omt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
});
const fileInput = $('file-input');
$('open-btn').addEventListener('click', () => fileInput.click());
$('file-btn').addEventListener('click', (e) => modals.open(fileModal, e.currentTarget));
fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  let s = null;
  try { s = file.size < 200000 ? fromFile(await file.text(), INSTRUMENTS) : null; } catch { s = null; }
  if (!s) { toast(t('badFile')); return; }
  Object.assign(jam, { style: s.style, key: s.key, newKey: s.newKey, bpm: s.bpm, sections: s.sections, cur: 0 });
  settings.style = s.style;
  settings.instrument = s.sound.instrument;
  settings.kit = s.sound.kit;
  for (const p of PARTS) settings.parts[p] = { ...s.sound[p] };
  save();
  if (band) band.setVolumes(settings.parts);
  modals.hideAll();
  render();
  toast(t('opened'));
});

// --- SETTINGS, ABOUT, SOUNDS AND PATREON WINDOWS ---
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), soundsModal = $('sounds-modal'), supportModal = $('support-modal'), fileModal = $('file-modal');
const modals = createModalManager({
  modals: [settingsModal, aboutModal, soundsModal, chordModal, sectionModal, fileModal, supportModal],
  escapeAction: (m) => (m === supportModal && support.locked() ? 'ignore' : 'hide'),
});
closeOnBackdrop(modals);
document.querySelectorAll('.modal-header .close-btn').forEach((b) => b.addEventListener('click', () => modals.hideAll()));
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: isPlaying });
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));
$('sounds-btn').addEventListener('click', (e) => modals.open(soundsModal, e.currentTarget));

const themeSelect = $('theme-select'), langSelect = $('lang-select'), namesSeg = $('names-seg'), countInSwitch = $('countin-switch');
themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
themeSelect.addEventListener('change', () => { settings.theme = themeSelect.value; applyTheme(settings.theme); saveLook({ theme: settings.theme }); fitNames(); });
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
langSelect.addEventListener('change', () => { settings.lang = langSelect.value; saveLook({ lang: settings.lang }); applyLanguage(); });
watchLook((look) => {
  if (look.theme !== settings.theme) { settings.theme = themeSelect.value = look.theme; applyTheme(look.theme); setupCustomSelects(); fitNames(); }
  if (look.lang !== settings.lang) { settings.lang = langSelect.value = look.lang; applyLanguage(); }
});
function renderSettings() {
  [...namesSeg.children].forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.names === 'solfege') === solfege())));
  countInSwitch.setAttribute('aria-checked', String(settings.countIn));
}
[...namesSeg.children].forEach((b) => b.addEventListener('click', () => {
  settings.solfege = b.dataset.names === 'solfege';
  save();
  renderSettings();
  render();
}));
countInSwitch.addEventListener('click', () => { settings.countIn = !settings.countIn; save(); renderSettings(); });

function applyLanguage() {
  i18n.apply();
  document.title = t('title');
  renderSettings();
  render();
  setPlayBtn(wantPlay);
  if (!loadingEl.hidden) loadingEl.textContent = t(rackLoading ? 'loading' : 'loadFailed');
  if (modals.current() === chordModal) renderChordModal();
  if (modals.current() === sectionModal) renderSectionModal();
  setupCustomSelects();
}

// --- KEYBOARD: Space plays or stops, N gives new chords ---
document.addEventListener('keydown', (e) => {
  if (modals.current() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const el = document.activeElement;
  if (el && el.closest && (el.closest('.custom-select') || el.matches('input, textarea'))) return;
  if (e.key === ' ' && !(el && el.matches && el.matches('button:not(#play-btn)'))) { e.preventDefault(); togglePlay(); return; }
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); newChords(); }
});
playBtn.addEventListener('click', togglePlay);

// --- START ---
applyTheme(settings.theme);
themeSelect.value = settings.theme;
langSelect.value = settings.lang;
applyLanguage();
if (window.Tone) loadRack(); else window.addEventListener('load', loadRack, { once: true });
registerHubWorker('../');
