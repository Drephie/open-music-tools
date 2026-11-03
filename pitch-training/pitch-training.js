/* pitch-training/pitch-training.js: Pitch Training (spec:
 * specs/pitch-training.md). The exercises and rounds are ./exercises.js and
 * the scoring ./score.js; the microphone is shared/pitch.js, the voice's line
 * shared/pitch-line.js, the graph shared/ui/pitch-graph.js; the piano is
 * shared/sound.js and the clicks shared/transport.js. This file is the
 * screen: the controls, running the rounds (sounds scheduled a moment ahead on
 * the audio clock, everything else on the page's clock), the status line, the
 * two views, the settings, windows and keyboard.
 */
import { startPitch } from '../shared/pitch.js';
import { midiToFreq } from '../shared/theory.js';
import { startAudio, createRack } from '../shared/sound.js';
import { createClicks } from '../shared/transport.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { accidentalHtml, prettyName } from '../shared/ui/accidentals.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, REPO_URL, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { createTrace, fitView, SENSITIVITY, createLoudnessGate, levelDb } from '../shared/pitch-line.js';
import { createGraphView } from '../shared/ui/pitch-graph.js';
import { EXERCISES, exerciseById, digits, VOICES, SPEEDS, FAR_CHOICES, clampStart, startRange, roundStarts, roundPlan, keyNames, startName } from './exercises.js';
import { TOLERANCE, LATE, judgeRound, judgePart, prepare, fillOf } from './score.js';
import { TRAINING_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'pitch-training.settings.v1';
const MIN_FREQ = 50, MAX_FREQ = 2000;      // a little under La1 to above Si6
const VIEW_LOW = 33, VIEW_HIGH = 95;        // the notes the graph can show (La1..Si6)
const AHEAD = 0.12;                         // sounds are handed to the audio clock this far ahead (s)
const LEAD = 0.5;                           // the first round starts this long after Start is ready
const ERROR_KEYS = { insecure: 'errInsecure', unsupported: 'errUnsupported', denied: 'errDenied', 'no-mic': 'errNoMic', busy: 'errBusy', ended: 'errEnded' };
const toMidi = (f) => 69 + 12 * Math.log2(f / 440);
const nowS = () => performance.now() / 1000;
const pcOf = (m) => ((Math.round(m) % 12) + 12) % 12;

// --- SETTINGS (remembered in this browser only; nothing sung and no score is kept) ---
function readSettings() {
  const s = loadSettings(SETTINGS_KEY);
  const ex = exerciseById(s.ex).id;
  const far = FAR_CHOICES.includes(s.far) ? s.far : 5;
  const voice = Object.hasOwn(VOICES, s.voice) ? s.voice : 'soprano';
  return {
    ex, voice, far,
    start: clampStart(Number.isFinite(s.start) ? s.start : VOICES[voice], exerciseById(ex), far),
    speed: Object.hasOwn(SPEEDS, s.speed) ? s.speed : 'medium',
    hearing: s.hearing === 'along' ? 'along' : 'listen',
    view: s.view === 'scroll' ? 'scroll' : 'whole',
    precise: s.precise === true,
    solfege: typeof s.solfege === 'boolean' ? s.solfege : null,   // null: follows the language
    sens: Object.hasOwn(SENSITIVITY, s.sens) ? s.sens : 'normal',
  };
}
const settings = readSettings();
// Theme and language are one choice for the whole hub.
Object.assign(settings, loadLook(loadSettings(SETTINGS_KEY)));
const save = () => saveSettings(SETTINGS_KEY, settings);
const solfege = () => (settings.solfege === null ? settings.lang !== 'en' : settings.solfege);
const tol = () => (settings.precise ? TOLERANCE.precise : TOLERANCE.normal);

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, TRAINING_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, repo: REPO_URL },
});
const { t } = i18n;
const fill = (key, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), t(key));

const statusEl = document.querySelector('.status'), mainEl = $('status-main'), subEl = $('status-sub'), dotEl = $('beat-dot'), srEl = $('sr-status');
const goBtn = $('go-btn'), goLabel = $('go-label');
const exSelect = $('ex-select'), voiceSelect = $('voice-select'), speedSeg = $('speed-seg');
const startDown = $('start-down'), startUp = $('start-up'), startNote = $('start-note'), startNameEl = $('start-name'), startOctEl = $('start-oct');
const canvas = $('graph-canvas');
const themeSelect = $('theme-select'), langSelect = $('lang-select');
const namesSeg = $('names-seg'), hearSeg = $('hear-seg'), viewSeg = $('view-seg'), tolSeg = $('tol-seg'), farSeg = $('far-seg'), sensSeg = $('sens-seg'), levelEl = $('level');
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), supportModal = $('support-modal');

// --- SOUND: the piano, the clicks and the gliding tone for slides ---
let rack = null, rackLoading = null, clicks = null, glide = null, pianoMsg = null;
function loadRack() {
  if (!rackLoading) {
    rackLoading = createRack()
      .then((r) => {
        rack = r;
        clicks = createClicks();
        clicks.setVolume(0.8);
        // A piano can't glide: slides are played by a soft tone that can.
        glide = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.06, decay: 0.1, sustain: 0.9, release: 0.25 } }).connect(r.master);
        glide.volume.value = -6;
        if (pianoMsg === 'loadFailed') pianoMsg = null;
        render(true);
        return r;
      })
      .catch((err) => { rackLoading = null; pianoMsg = 'loadFailed'; render(true); throw err; });
  }
  return rackLoading;
}
// Browsers allow sound only after a tap (for a finger: its lift), a click or a key.
const unlockAudio = () => { if (Tone.context.state !== 'running') startAudio(); };
['pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, true));

function setAudioSession(type) {
  try { if (navigator.audioSession) navigator.audioSession.type = type; } catch { /* not supported */ }
}
// The piano also plays with the iPhone's silent switch on; while listening, the session also records.
setAudioSession('playback');

// How late the speakers are: sounds are started this much early, so they are
// heard when the screen shows them.
function outLatency() {
  const c = Tone.context.rawContext;
  return Math.min(0.3, Math.max(0, (c && (c.outputLatency || c.baseLatency)) || 0));
}

function playSound(s, lat) {
  const at = Tone.immediate() + Math.max(0, s.at - lat - nowS());
  if (s.kind === 'click') clicks.play('click', at, s.level);
  else if (s.kind === 'note') rack.instruments.piano.triggerAttackRelease(midiToFreq(s.midi), Math.max(0.3, s.dur * 0.92), at);
  else if (s.kind === 'glide') {
    const [first, ...rest] = s.points;
    glide.triggerAttack(midiToFreq(first[1]), at);
    for (const [pt, m] of rest) glide.frequency.exponentialRampToValueAtTime(midiToFreq(m), at + (pt - s.at));
    glide.triggerRelease(at + s.dur);
  }
}

function silence() {
  if (!rack) return;
  const now = Tone.immediate();
  rack.instruments.piano.releaseAll(now);
  glide.frequency.cancelScheduledValues(now);
  glide.triggerRelease(now);
}

// A single note: the starting note, or a piano key on the graph.
let pendingNote = null, pressed = null, pressedUntil = 0;
function playNote(midi) {
  unlockAudio();
  if (!rack) {
    pendingNote = midi;
    pianoMsg = 'loading';
    render(true);
    loadRack().then(() => { if (pendingNote === midi) { pendingNote = null; pianoMsg = null; playNote(midi); } }).catch(() => {});
    return;
  }
  rack.instruments.piano.releaseAll(Tone.immediate());
  rack.instruments.piano.triggerAttackRelease(midiToFreq(midi), 1.6, Tone.immediate());
  pressed = midi;
  pressedUntil = nowS() + 1.6;
  render(true);
  requestDraw();
}

// --- THE MICROPHONE AND THE LINE ---
// Times are on the page's clock (performance.now, in seconds). Frames carry the
// microphone's clock: `offset` maps one to the other (the smallest delay seen),
// and half the analysis window is taken off (a frame describes the sound in its window).
const trace = createTrace({ seconds: 120 });
const loudness = createLoudnessGate();
let listener = null, wanted = false, errorKey = null, offset = Infinity, rms = 0;

function onFrame(frame) {
  offset = Math.min(offset, nowS() - frame.time);
  const time = frame.time + offset - (listener ? listener.windowSeconds / 2 : 0.025);
  rms = frame.rms;
  const freq = loudness.next(frame.freq, frame.rms, SENSITIVITY[settings.sens]);
  // Only the singing is drawn and scored: from just before a round's first
  // note to its last note's end (plus the time a late singer may take).
  const r = run && roundAt(time);
  const singing = r && time >= r.t0 + r.plan.sing - 0.3 && time <= r.t0 + r.plan.result + LATE + 0.1;
  trace.push(time, singing && freq > 0 ? toMidi(freq) : NaN);
}

// --- RUNNING THE ROUNDS ---
// run: { ex, rounds: [{ i, start, plan, t0, result, live, fill, octave }], sounds, next, end, good, total }
let run = null, lastRun = null, timer = 0;

function makeRun(t0) {
  const ex = exerciseById(settings.ex), bpm = SPEEDS[settings.speed];
  let at = t0;
  const sounds = [];
  const rounds = roundStarts(settings.start, settings.far).map((start, i) => {
    const plan = roundPlan(ex, start, bpm, settings.hearing);
    const r = { i, start, plan, t0: at, result: null, live: [], fill: null, octave: 0, liveAt: 0 };
    for (const s of plan.sounds) {
      const abs = { ...s, at: at + s.time };
      if (s.points) abs.points = s.points.map(([pt, m]) => [at + pt, m]);
      sounds.push(abs);
    }
    at += plan.end;
    return r;
  });
  return { ex, rounds, sounds, next: 0, end: at, good: 0, total: 0, stopped: false };
}

function roundAt(time) {
  const rs = run.rounds;
  return rs.find((r) => time < r.t0 + r.plan.end) || rs[rs.length - 1];
}

function phaseAt(now) {
  if (!run) return null;
  const r = roundAt(now), p = r.plan, k = now - r.t0;
  let phase;
  if (p.demo !== null && k < p.countIn) phase = 'listen';
  else if (k < p.sing) phase = 'count';
  else if (!r.result) phase = 'sing';
  else phase = 'result';
  return { r, k, phase };
}

function pointsOf(r) {
  const s = r.t0 + r.plan.sing, last = r.t0 + r.plan.result + LATE + 0.15, pts = [];
  trace.forEach(s - 0.5, last, (time, m) => { if (time >= s - 0.5 && time <= last) pts.push([time - s, m]); });
  return pts;
}

function judge(r) {
  r.result = judgeRound(r.plan.parts, pointsOf(r), tol());
  r.octave = r.result.octave;
  run.good += r.result.good;
  run.total += r.result.total;
  announce(`${fill('inTune', { n: r.result.good, total: r.result.total })}. ${tipText(r)}`);
}

// Every 25 ms while running: hand the next sounds to the audio clock, score
// the rounds that have ended, and finish after the last one.
function tick() {
  if (!run) return;
  const now = nowS(), lat = outLatency();
  while (run.next < run.sounds.length && run.sounds[run.next].at - lat < now + AHEAD) playSound(run.sounds[run.next++], lat);
  for (const r of run.rounds) if (!r.result && now > r.t0 + r.plan.result + LATE + 0.05) judge(r);
  if (now >= run.end) stopRun(true);
}

// Each start has a number: a microphone that arrives for an older start (Start,
// Stop, Start again while the browser is asking) is stopped, never left running.
let startId = 0;
async function startRun() {
  if (wanted) return;
  wanted = true;
  const id = ++startId;
  errorKey = null;
  lastRun = null;
  startAudio();                 // inside the tap: the sound system may start
  setAudioSession('play-and-record');
  showButtons();
  render(true);
  let l;
  try {
    // No await before this: the microphone's sound system must start inside the tap.
    l = await startPitch({
      onFrame, minFreq: MIN_FREQ, maxFreq: MAX_FREQ,
      onEnd: () => { stopRun(); errorKey = 'errEnded'; render(true); },
    });
  } catch (err) {
    if (id !== startId) return;
    wanted = false;
    errorKey = ERROR_KEYS[err.reason] || 'errFailed';
    setAudioSession('playback');
    showButtons();
    render(true);
    return;
  }
  if (!wanted || id !== startId) { l.stop(); return; }   // Stop (or Stop and Start) was tapped while the browser was asking
  listener = l;
  offset = Infinity;
  loudness.reset();
  keepScreenAwake(true);
  if (!rack) {
    pianoMsg = 'loading';
    render(true);
    try { await loadRack(); } catch { stopRun(); return; }
    pianoMsg = null;
    if (!wanted || id !== startId) return;
  }
  trace.break(nowS());
  run = makeRun(nowS() + LEAD);
  lastSpoken = '';
  timer = setInterval(tick, 25);
  tick();
  render(true);
  requestDraw();
}

function stopRun(finished = false) {
  wanted = false;
  clearInterval(timer);
  timer = 0;
  if (run) {
    if (finished) for (const r of run.rounds) if (!r.result) judge(r);
    run.stopped = !finished;
    lastRun = run;
    run = null;
  }
  silence();
  if (listener) { listener.stop(); listener = null; }
  trace.break(nowS());
  setAudioSession('playback');
  keepScreenAwake(false);
  if (pianoMsg === 'loading') pianoMsg = null;
  showButtons();
  render(true);
  if (lastRun && finished) announce(fill('done', { n: lastRun.good, total: lastRun.total }));
  requestDraw();
}

const toggle = () => (wanted ? stopRun() : startRun());

function showButtons() {
  goBtn.classList.toggle('on', wanted);
  goBtn.setAttribute('aria-pressed', String(wanted));
  goLabel.textContent = t(wanted ? 'stop' : 'start');
}

// Listening stops when the page stays hidden for a second (another app,
// another tab), so the microphone sign goes off.
let hiddenTimer = 0;
document.addEventListener('visibilitychange', () => {
  clearTimeout(hiddenTimer);
  if (document.visibilityState === 'hidden' && wanted) hiddenTimer = setTimeout(() => stopRun(), 1000);
});
window.addEventListener('pagehide', () => { if (wanted) stopRun(); });

// Keep the phone screen on while running (where the browser allows it).
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

// --- THE STATUS LINE ---
function noteName(r, m) { return prettyName(keyNames(r.start, solfege())[pcOf(m)] || ''); }

function tipText(r) {
  const tip = r.result.tip;
  if (tip.kind === 'all') return t('tipAll');
  if (tip.kind === 'nothing') return t('tipNothing');
  if (tip.kind === 'quiet') return t('tipQuiet');
  if (tip.kind === 'mixed') return t('tipMixed');
  if (tip.kind === 'most') return t(tip.dir === 'low' ? 'tipMostLow' : 'tipMostHigh');
  const p = r.plan.parts[tip.part];
  const note = p.m0 !== p.m1 ? t(p.m1 > p.m0 ? 'slideUp' : 'slideDown') : noteName(r, p.m0);
  const key = tip.dir === 'low' ? (tip.far ? 'tipOneLowFar' : 'tipOneLow') : (tip.far ? 'tipOneHighFar' : 'tipOneHigh');
  return fill(key, { note });
}

function octaveText(k) {
  if (!k) return '';
  const n = Math.abs(k);
  return n === 1 ? t(k < 0 ? 'octLower' : 'octHigher') : fill(k < 0 ? 'octsLower' : 'octsHigher', { n });
}

const roundsText = () => fill('idleSub', { n: 2 * settings.far + 1, far: settings.far });
const startLabel = (midi) => { const n = startName(midi, solfege()); return { name: n.name, octave: n.octave, text: `${prettyName(n.name)}${n.octave}` }; };

let last = { main: null, sub: null, dot: null, msg: null };
let lastSpoken = '';
function announce(text) { if (text && text !== lastSpoken) { srEl.textContent = text; lastSpoken = text; } }

// Text changes only when it needs to; called every frame and on every change.
function render(force = false) {
  const now = nowS();
  let main = '', sub = '', dot = null, msg = false, spoken = '';
  const ph = phaseAt(now);
  if (errorKey) { main = t(errorKey); msg = true; }
  else if (pianoMsg === 'loadFailed') { main = t('loadFailed'); msg = true; }
  else if (wanted && !listener) main = t('waiting');
  else if (pianoMsg === 'loading') main = t('loading');
  else if (ph) {
    const { r, k, phase } = ph, total = run.rounds.length, round = fill('roundOf', { n: r.i + 1, total });
    const beat = r.plan.beat;
    if (phase === 'listen') { main = t('listen'); sub = `${round} · ${fill('fromNote', { note: startLabel(r.start).text })}`; spoken = main; }
    else if (phase === 'count') {
      const n = Math.max(0, Math.min(3, Math.floor((k - r.plan.countIn) / beat)));
      main = t('yourTurn');
      sub = `<span class="count">${[1, 2, 3, 4].map((i) => `<i class="${i === n + 1 ? 'on' : ''}">${i}</i>`).join('')}</span>`;
      dot = 1 - 0.75 * Math.min(1, (((k - r.plan.countIn) / beat) % 1) * 2.5);
      spoken = main;
    } else if (phase === 'sing') {
      main = t('sing');
      const oct = octaveText(r.octave);
      sub = oct ? `${round} · ${oct}` : round;
      dot = k < r.plan.result ? 1 - 0.75 * Math.min(1, (((k - r.plan.sing) / beat) % 1) * 2.5) : 0.25;
    } else {
      main = fill('inTune', { n: r.result.good, total: r.result.total });
      const oct = octaveText(r.result.octave);
      sub = tipText(r) + (oct ? ` · ${oct}` : '');
    }
  } else if (lastRun && !lastRun.stopped) { main = fill('done', { n: lastRun.good, total: lastRun.total }); sub = t('doneSub'); }
  else if (lastRun) { main = t('stopped'); sub = lastRun.total ? fill('inTune', { n: lastRun.good, total: lastRun.total }) : roundsText(); }
  else { main = t('idle'); sub = roundsText(); }

  if (force || main !== last.main) { mainEl.textContent = main; last.main = main; }
  if (force || sub !== last.sub) { subEl.innerHTML = sub; subEl.hidden = !sub; last.sub = sub; }
  const dotOn = dot !== null;
  if (force || dotOn !== (last.dot !== null)) dotEl.hidden = !dotOn;
  if (dotOn) dotEl.style.opacity = dot.toFixed(2);
  last.dot = dot;
  if (force || msg !== last.msg) { statusEl.classList.toggle('msg', msg); last.msg = msg; }
  if (spoken) announce(spoken);
  else if (msg || !ph) announce(main);
}

// --- THE GRAPH ---
const view = createGraphView(canvas);
let low = 57, high = 70;

function readLook() {
  const cs = getComputedStyle(document.body);
  view.setLook({
    text: cs.getPropertyValue('--color-text'), accent: cs.getPropertyValue('--color-tune'), line: cs.getPropertyValue('--color-tune-line'),
    page: cs.getPropertyValue('--bg-page'), font: cs.getPropertyValue('--font-main'),
    keys: { white: cs.getPropertyValue('--key-white'), whiteText: cs.getPropertyValue('--key-white-text'), black: cs.getPropertyValue('--key-black'), blackText: cs.getPropertyValue('--key-black-text') },
  });
}

// The round on screen when nothing runs: the last one sung, or the first one of the exercise as set.
function idleRound() {
  if (lastRun) {
    const sung = lastRun.rounds.filter((r) => r.result);
    if (sung.length) return sung[sung.length - 1];
  }
  const plan = roundPlan(exerciseById(settings.ex), settings.start, SPEEDS[settings.speed], settings.hearing);
  return { i: 0, start: settings.start, plan, t0: 0, result: null, live: [], fill: null, octave: 0 };
}

// While a round is sung: the stretches in tune so far, and each note's state once it is over.
function updateLive(r, now) {
  if (now - r.liveAt < 0.1) return;
  r.liveAt = now;
  const { octave, points } = prepare(r.plan.parts, pointsOf(r));
  r.octave = octave;
  const k = now - r.t0 - r.plan.sing;
  r.fill = r.plan.parts.map((p) => (p.t0 <= k ? fillOf(p, points, tol()) : null));
  r.plan.parts.forEach((p, i) => { if (!r.live[i] && k > p.t1 + LATE + 0.05) r.live[i] = judgePart(p, points, tol()); });
}

// How a note looks. copy: 'demo' (the piano's notes in the scrolling view),
// 'sing' (yours there), or none (the whole-exercise view, which shows both in turn).
function stateOf(r, i, ph, copy) {
  const p = r.plan.parts[i];
  const sounding = ph && ph.r === r && ph.phase === 'listen' && ph.k - r.plan.demo >= p.t0 && ph.k - r.plan.demo < p.t1;
  if (copy === 'demo') return sounding ? 'sound' : 'idle';
  const res = r.result ? r.result.results[i] : r.live[i];
  if (res) return res.state === 'in' ? 'in' : res.state === 'close' ? 'close' : 'turn';
  if (copy === 'sing') return 'turn';
  if (!ph || ph.r !== r) return 'idle';
  if (ph.phase === 'listen') return sounding ? 'sound' : 'idle';
  return 'turn';
}

const targetOf = (r, i, state, shift = 0, fillOn = true) => {
  const p = r.plan.parts[i];
  return { m0: p.m0, m1: p.m1, t0: p.t0 + shift, t1: p.t1 + shift, state, fill: fillOn && r.fill && r.fill[i] ? r.fill[i].map(([a, b]) => [a + shift, b + shift]) : null };
};

let frameId = 0, lastTime = 0;
function requestDraw() {
  if (!frameId) { lastTime = performance.now(); frameId = requestAnimationFrame(frame); }
}

function frame(nowMs) {
  frameId = 0;
  const dt = Math.min(0.1, (nowMs - lastTime) / 1000);
  lastTime = nowMs;
  const now = nowS(), ph = phaseAt(now);
  render();
  if (pressed !== null && now > pressedUntil) pressed = null;

  let r, targets, start, end, cursor = null, shift = 0, dot = false;
  if (ph && ph.phase === 'sing') updateLive(ph.r, now);
  if (!ph || settings.view === 'whole') {
    // The whole exercise: one round's pattern across the graph, swept once while
    // the piano plays it and once while you sing.
    r = ph ? ph.r : idleRound();
    const D = r.plan.parts[r.plan.parts.length - 1].t1, pad = 0.35 * r.plan.beat;
    start = -pad; end = D + pad;
    shift = r.t0 + r.plan.sing;
    targets = r.plan.parts.map((_, i) => targetOf(r, i, stateOf(r, i, ph)));
    if (ph && ph.phase === 'listen') cursor = ph.k - r.plan.demo;
    else if (ph && ph.phase === 'sing' && ph.k < r.plan.result) { cursor = ph.k - r.plan.sing; dot = true; }
  } else {
    // Scrolling: the notes slide from the right toward a fixed line, both the
    // piano's (listen, then sing) and yours.
    r = ph.r;
    const span = view.layout.seconds;
    start = now - 0.3 * span; end = start + span; cursor = now;
    targets = [];
    for (const q of run.rounds) {
      if (q.t0 > end || q.t0 + q.plan.end < start - 1) continue;
      if (q.plan.demo !== null) q.plan.parts.forEach((_, i) => targets.push(targetOf(q, i, stateOf(q, i, ph, 'demo'), q.t0 + q.plan.demo, false)));
      q.plan.parts.forEach((_, i) => targets.push(targetOf(q, i, stateOf(q, i, ph, 'sing'), q.t0 + q.plan.sing)));
    }
    dot = ph.phase === 'sing';
  }

  // The view fits the notes on screen, with a margin; it moves up and down with the rounds.
  let min = Infinity, max = -Infinity;
  for (const tg of targets) if (tg.t1 > start && tg.t0 < end) { min = Math.min(min, tg.m0, tg.m1); max = Math.max(max, tg.m0, tg.m1); }
  let moving = false;
  if (min <= max) {
    const fit = fitView(min, max, { lowest: VIEW_LOW, highest: VIEW_HIGH });
    low += (fit.low - low) * Math.min(1, dt * 6);
    high += (fit.high - high) * Math.min(1, dt * 6);
    moving = Math.abs(fit.low - low) > 0.01 || Math.abs(fit.high - high) > 0.01;
  }

  // The voice's line, moved into the notes' octave (any octave counts).
  // A round not sung yet shows no line.
  const k = r.result ? r.result.octave : r.octave;
  const line = !ph && !r.result ? { forEach() {} } : k ? { forEach: (a, b, fn) => trace.forEach(a, b, (time, m) => fn(time, m - 12 * k)) } : trace;
  const pcs = [...new Set(r.plan.parts.flatMap((p) => [pcOf(p.m0), pcOf(p.m1)]))];
  const names = keyNames(r.start, solfege());
  view.draw({ trace: line, start, end, low, high, names, cName: keyNames(60, solfege())[0], keyPcs: pcs, pressed, dot, targets, cursor, traceShift: shift });
  const metering = showLevel(dt);
  if (run || moving || metering || pressed !== null) frameId = requestAnimationFrame(frame);
}

// A piano key on the graph plays its note when nothing runs.
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
  if (!wanted && view.onKeys(x)) playNote(Math.round(view.midiAt(y)));
});

window.addEventListener('resize', () => { measure(); requestDraw(); });
document.fonts?.ready.then(() => { measure(); requestDraw(); });

function measure() {
  view.resize();
  fitTitle();
}

// The title on one line, smaller in a long language and a wide font; when
// that would make it tiny, on two lines.
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

// --- THE CONTROLS ON THE SCREEN ---
// Changing the exercise, voice, starting note or speed stops a running warm-up.
function changed() {
  if (wanted) stopRun();
  lastRun = null;
  save();
  showChoices();
  render(true);
  requestDraw();
}

function fillExercises() {
  exSelect.innerHTML = EXERCISES.map((e) => `<option value="${e.id}">${t(`ex_${e.id}`)} · ${digits(e)}</option>`).join('');
  exSelect.value = settings.ex;
  voiceSelect.innerHTML = Object.keys(VOICES).map((v) => `<option value="${v}">${t(`voice_${v}`)}</option>`).join('');
  voiceSelect.value = settings.voice;
}
exSelect.addEventListener('change', () => {
  settings.ex = exSelect.value;
  settings.start = clampStart(settings.start, exerciseById(settings.ex), settings.far);
  changed();
});
voiceSelect.addEventListener('change', () => {
  settings.voice = voiceSelect.value;
  settings.start = clampStart(VOICES[settings.voice], exerciseById(settings.ex), settings.far);
  changed();
});
function moveStart(by) {
  const next = clampStart(settings.start + by, exerciseById(settings.ex), settings.far);
  if (next === settings.start) return;
  settings.start = next;
  changed();
  playNote(settings.start);
}
startDown.addEventListener('click', () => moveStart(-1));
startUp.addEventListener('click', () => moveStart(1));
startNote.addEventListener('click', () => { if (!wanted) playNote(settings.start); });
[...speedSeg.children].forEach((b) => b.addEventListener('click', () => { settings.speed = b.dataset.speed; changed(); }));

function showStart() {
  const n = startLabel(settings.start), range = startRange(exerciseById(settings.ex), settings.far);
  startNameEl.innerHTML = accidentalHtml(n.name);
  startOctEl.textContent = String(n.octave);
  startNote.setAttribute('aria-label', fill('startHear', { note: n.text }));
  startDown.disabled = settings.start <= range.min;
  startUp.disabled = settings.start >= range.max;
}

function showChoices() {
  const press = (seg, key, value) => [...seg.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[key] === value)));
  press(speedSeg, 'speed', settings.speed);
  press(namesSeg, 'names', solfege() ? 'solfege' : 'letters');
  press(hearSeg, 'hear', settings.hearing);
  press(viewSeg, 'view', settings.view);
  press(tolSeg, 'tol', settings.precise ? 'precise' : 'normal');
  press(farSeg, 'far', String(settings.far));
  press(sensSeg, 'sens', settings.sens);
  levelEl.style.setProperty('--mark', `${levelPercent(SENSITIVITY[settings.sens])}%`);
  showStart();
}

// --- SETTINGS, ABOUT AND PATREON WINDOWS ---
const modals = createModalManager({
  modals: [settingsModal, aboutModal, supportModal],
  escapeAction: (m) => (m === supportModal && support.locked() ? 'ignore' : 'hide'),
});
closeOnBackdrop(modals);
document.querySelectorAll('.modal-header .close-btn').forEach((b) => b.addEventListener('click', () => modals.hideAll()));
// After 30 s untouched, coming back opens the Patreon window (at most every 40 min).
// A running warm-up counts as use, so it never interrupts singing.
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: () => wanted });
$('settings-btn').addEventListener('click', (e) => { modals.open(settingsModal, e.currentTarget); requestDraw(); });
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));
goBtn.addEventListener('click', toggle);

themeSelect.innerHTML = THEMES.map(([value, key]) => `<option value="${value}" data-i18n="${key}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
farSeg.innerHTML = FAR_CHOICES.map((n) => `<button type="button" data-far="${n}">${n}</button>`).join('');
function setTheme(theme) {
  settings.theme = theme;
  applyTheme(theme);
  readLook();
  measure();
  requestDraw();
}
themeSelect.addEventListener('change', () => { setTheme(themeSelect.value); save(); saveLook({ theme: settings.theme }); });
langSelect.addEventListener('change', () => { settings.lang = langSelect.value; applyLanguage(); save(); saveLook({ lang: settings.lang }); });
// Chosen on the home page or in another tool, in another tab or before coming Back here.
watchLook((look) => {
  if (look.theme !== settings.theme) { themeSelect.value = look.theme; setTheme(look.theme); setupCustomSelects(); }
  if (look.lang !== settings.lang) { settings.lang = langSelect.value = look.lang; applyLanguage(); }
});

// Choices that change how a warm-up runs stop a running one; the others apply at once.
const segChoice = (seg, key, apply, stops) => [...seg.children].forEach((b) => b.addEventListener('click', () => {
  apply(b.dataset[key]);
  if (stops && wanted) stopRun();
  save();
  showChoices();
  render(true);
  requestDraw();
}));
segChoice(namesSeg, 'names', (v) => { settings.solfege = v === 'solfege'; });
segChoice(hearSeg, 'hear', (v) => { settings.hearing = v; }, true);
segChoice(viewSeg, 'view', (v) => { settings.view = v; });
segChoice(tolSeg, 'tol', (v) => { settings.precise = v === 'precise'; });
segChoice(farSeg, 'far', (v) => { settings.far = Number(v); settings.start = clampStart(settings.start, exerciseById(settings.ex), settings.far); }, true);
segChoice(sensSeg, 'sens', (v) => { settings.sens = v; });

// The level bar in Settings: -70..-10 dBFS across.
const levelPercent = (db) => Math.max(0, Math.min(100, (db + 70) / 60 * 100));
let shownLevel = 0;
function showLevel(dt) {
  if (modals.current() !== settingsModal) return false;
  const target = listener ? levelPercent(levelDb(rms)) : 0;
  shownLevel += (target - shownLevel) * Math.min(1, dt * (target > shownLevel ? 20 : 6));
  levelEl.style.setProperty('--level', `${shownLevel.toFixed(1)}%`);
  return !!listener || shownLevel > 0.5;
}

function applyLanguage() {
  i18n.apply();
  document.title = t('title');
  fillExercises();
  showButtons();
  showChoices();
  fitTitle();
  render(true);
  setupCustomSelects();   // labels and option texts changed
  requestDraw();
}

// --- KEYBOARD: Space starts and stops, the up and down arrows move the starting note ---
let spaceHandled = false;
document.addEventListener('keydown', (e) => {
  if (modals.current() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement;
  if (el && el.closest && el.closest('.custom-select, .seg')) return;
  if (e.key === ' ') {
    e.preventDefault();   // Space is start/stop everywhere; Enter still presses a focused button
    spaceHandled = true;
    if (!e.repeat) toggle();
  } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !wanted) {
    e.preventDefault();
    moveStart(e.key === 'ArrowUp' ? 1 : -1);
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
requestDraw();
loadRack().catch(() => {});   // the piano samples start loading now, so Start is ready sooner
registerHubWorker('../');
