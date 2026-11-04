/* chordigits/chordigits.js: count chords on your fingers in front of the camera.
 * The number hand shows I to VII (shared/hands.js) and its height the octave;
 * the other hand's tilt picks major or minor and its fingers the colour.
 * Without the camera, the numbers and choices are buttons and keys.
 * Spec: specs/chordigits.md. */
import { parseKey, keyRootName, keyChordNames, getChordInfo, voiceChord, keyTonicMidi, chordNumeral } from '../shared/theory.js';
import { readFingers, countFingers, chordNumber, handTilt, heightBand, createSteady } from '../shared/hands.js';
import { startAudio, createRack, INSTRUMENTS } from '../shared/sound.js';
import { LANGUAGES, mergeStrings, createI18n } from '../shared/ui/i18n.js';
import { HUB_STRINGS } from '../shared/ui/strings.js';
import { setupCustomSelects } from '../shared/ui/select.js';
import { createModalManager } from '../shared/ui/modal.js';
import { THEMES, LANGUAGE_NAMES, PATREON_URL, DESIGNER_URL, TIKTOK_URL, REPO_URL, loadSettings, saveSettings, applyTheme, closeOnBackdrop, createSupportPrompt, loadLook, saveLook, watchLook } from '../shared/ui/page.js';
import { registerHubWorker } from '../shared/offline.js';
import { mountCameraLook } from '../shared/camera-look.js';
import { CHORDIGITS_STRINGS } from './strings.js';

const $ = (id) => document.getElementById(id);
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }

// --- SETTINGS (only these are remembered; the rest starts fresh) ---
const SETTINGS_KEY = 'chordigits.settings.v2';
const saved = loadSettings(SETTINGS_KEY);
const pick = (v, list, def) => (list.includes(v) ? v : def);
const settings = {
  sound: pick(saved.sound, INSTRUMENTS, 'dreamy'),
  glide: saved.glide !== false,
  hand: pick(saved.hand, ['right', 'left'], 'right'),
  sixSeven: pick(saved.sixSeven, ['rock', 'asl'], 'rock'),
  key: '0_maj', notation: 'letter', volume: 100, octave: 0, style: 'smooth', brow: true,
};
Object.assign(settings, loadLook({}));
const save = () => saveSettings(SETTINGS_KEY, { sound: settings.sound, glide: settings.glide, hand: settings.hand, sixSeven: settings.sixSeven, seenHow: true });

const i18n = createI18n({
  strings: mergeStrings(HUB_STRINGS, CHORDIGITS_STRINGS),
  getLang: () => settings.lang,
  vars: { patreon: PATREON_URL, instagram: DESIGNER_URL, tiktok: TIKTOK_URL, repo: REPO_URL },
});
const { t } = i18n;

const IS_MOBILE = matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints || 0) > 0 && Math.min(screen.width, screen.height) <= 900;
if (IS_MOBILE) document.body.classList.add('mobile-mode');

const video = $('webcam'), canvas = $('overlay'), ctx = canvas.getContext('2d');
const numbersEl = $('numbers'), chordEl = $('chord'), chordName = $('chord-name'), chordSub = $('chord-sub'), chordLive = $('chord-live');
const statusEl = $('status'), startMsg = $('start-msg'), howList = $('how-list');
const startCard = $('start-card'), recordBtn = $('record-btn'), recTime = $('rec-time');
const settingsModal = $('settings-modal'), aboutModal = $('about-modal'), recModal = $('rec-modal'), supportModal = $('support-modal'), howModal = $('how-modal');
const themeSelect = $('theme-select'), langSelect = $('lang-select'), keySelect = $('key-select'), notationSelect = $('notation-select');
const soundSelect = $('sound-select'), glideSelect = $('glide-select'), volumeSlider = $('volume-slider'), octaveSelect = $('octave-select');
const styleSelect = $('style-select'), handSelect = $('hand-select'), sixSelect = $('six-select'), browSelect = $('brow-select');

// --- THE CHORD: number (degree), major/minor (quality) and colour ---
// quality 0 = as in the key, 1 = major, -1 = minor; colour 0 plain, 1 7th, 2 sus4, 3 add9.
const KINDS = { 0: ['Triad', '7th', 'Sus4', 'Add9'], 1: ['Maj', 'Dom7', 'Sus4', 'MajAdd9'], [-1]: ['Min', 'Min7', 'Sus4', 'MinAdd9'] };
const COLOR_OF_COUNT = [0, 1, 2, 3, 0, 0]; // fist or 4-5 fingers: plain
let key = parseKey(settings.key), names = [], numerals = [];
let degree = 0, quality = 0, color = 0, handOctave = 0;
let lastUpper = null;

function keyContext() {
  key = parseKey(settings.key);
  const solfege = settings.notation === 'solfege';
  names = keyChordNames(key, solfege);
  numerals = key.chromatic ? names.map(() => '') : names.map((_, d) => chordNumeral(d, getChordInfo({ key, degree: d, modifiers: ['Triad', null] }).suffix));
  if (degree >= names.length) degree = 0;
  lastUpper = null;
  buildNumbers();
}
function chordNow() {
  const octave = Math.max(-1, Math.min(2, settings.octave + handOctave));
  const info = getChordInfo({ key, degree, modifiers: [KINDS[quality][color], null], octave, solfege: settings.notation === 'solfege' });
  info.numeral = key.chromatic ? '' : chordNumeral(degree, info.suffix);
  return settings.style === 'smooth' ? voiceChord(info, { prevUpper: lastUpper, tonicMidi: keyTonicMidi(key, octave) }) : info;
}

// --- SOUND ---
let rack = null, rackLoading = null, recorder = null, streamDest = null;
function loadRack() {
  if (!rackLoading) {
    rackLoading = createRack().then((r) => {
      rack = r;
      rack.setVolume(settings.volume);
      recorder = new Tone.Recorder();
      rack.master.connect(recorder);
      streamDest = Tone.getContext().rawContext.createMediaStreamDestination();
      rack.master.connect(streamDest);
      if (statusKey === 'loadingSound') status(null);
    }).catch((err) => { rackLoading = null; console.warn('Chordigits: sound', err); showMsg('errAudio'); });
  }
  return rackLoading;
}
// Browsers allow sound only after a tap (for a finger, the lift): any tap or key unlocks it.
const unlockAudio = () => { if (window.Tone && Tone.context.state !== 'running') startAudio(); };
['pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, true));

let sounding = null;        // the chord playing now: { freqs, label, ... }
let sustainKey = false, sustainBrow = false, sustained = false; // sustained: a stopped chord still ringing
const sustain = () => sustainKey || sustainBrow;
const gliding = () => settings.glide && settings.sound === 'dreamy';
function releaseAll() {
  if (!rack) return;
  const now = Tone.immediate();
  rack.releaseGlide(now);
  for (const inst of Object.values(rack.instruments)) inst.releaseAll(now);
}
function play() {
  if (!rack) { loadRack(); status('loadingSound'); return; } // the sounds are still loading
  const info = chordNow();
  if (sounding && sounding.freqs.join() === info.freqs.join()) return;
  if (info.upper) lastUpper = info.upper;
  sounding = info;
  showChord(info);
  const now = Tone.immediate();
  if (gliding()) rack.glideTo(info.freqs, now);
  else {
    if (!sustain()) releaseAll();
    rack.instruments[settings.sound].triggerAttack(info.freqs, now);
  }
}
function stop() {
  if (!sounding) return;
  sounding = null;
  if (sustain()) sustained = true; else releaseAll();
  showChord(null);
}

// --- WHAT YOU SEE ---
function showChord(info) {
  if (info) {
    chordEl.hidden = false;
    chordEl.classList.remove('fading');
    chordName.textContent = info.name;
    chordSub.textContent = [info.numeral, info.noteNames.join(' · ')].filter(Boolean).join('  ·  ');
    chordLive.textContent = `${t('playing')}: ${info.name}`;
  } else {
    chordEl.classList.add('fading');
    chordLive.textContent = '';
  }
  lightUp();
}
function lightUp() {
  [...numbersEl.children].forEach((b, i) => b.classList.toggle('on', !!sounding && i === degree));
  document.querySelectorAll('#qualities .chip').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.q) === quality)));
  document.querySelectorAll('#colors .chip').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.c) === color)));
}
function buildNumbers() {
  numbersEl.classList.toggle('chromatic', key.chromatic);
  numbersEl.innerHTML = names.map((n, i) => `<button class="btn num-btn" data-d="${i}">${numerals[i] ? `<b>${numerals[i]}</b><span>${n}</span>` : `<b>${n}</b>`}</button>`).join('');
  lightUp();
}
function howToPlay() {
  const right = settings.hand === 'right';
  const lines = [
    `<strong>${t(right ? 'rightHand' : 'leftHand')}:</strong> ${t(settings.sixSeven === 'asl' ? 'howNumberAsl' : 'howNumber')}`,
    `<strong>${t(right ? 'leftHand' : 'rightHand')}:</strong> ${t('howKind')}`,
    t('howPlay'),
  ];
  if (settings.brow) lines.push(t('howSustain'));
  howList.innerHTML = lines.map((l) => `<li>${l}</li>`).join('');
}
let msgKey = null;
// The no-camera card shows only when the camera or hand tracking fails.
function showMsg(k) { msgKey = k; startCard.hidden = !k; startMsg.textContent = k ? t(k) : ''; }

// --- PLAYING WITHOUT THE CAMERA: hold a number; tap major/minor and colour ---
const held = new Map(); // pointerId -> degree
numbersEl.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.num-btn');
  if (!b) return;
  e.preventDefault();
  try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  held.set(e.pointerId, Number(b.dataset.d));
  degree = Number(b.dataset.d);
  play();
});
const lift = (e) => {
  if (!held.delete(e.pointerId)) return;
  if (held.size) { degree = [...held.values()].pop(); play(); } else stop();
};
['pointerup', 'pointercancel'].forEach((ev) => numbersEl.addEventListener(ev, lift));
const replay = () => { if (sounding) { sounding = null; play(); } else lightUp(); };
$('qualities').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) { quality = Number(b.dataset.q); replay(); } });
$('colors').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) { color = Number(b.dataset.c); replay(); } });

// Keyboard: hold 1-7 (up to 0, - and = in Chromatic), Q W E, A S D F, Space sustains.
const NUM_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
const Q_KEYS = { KeyQ: 0, KeyW: 1, KeyE: -1 }, C_KEYS = { KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3 };
const keysDown = [];
document.addEventListener('keydown', (e) => {
  if (modals.current() || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input, select, textarea, .custom-select')) return;
  if (e.code === 'Space') { e.preventDefault(); sustainKey = true; return; }
  if (e.repeat) return;
  const d = NUM_KEYS.indexOf(e.code);
  if (d >= 0 && d < names.length) { keysDown.push(d); degree = d; play(); return; }
  if (e.code in Q_KEYS) { quality = Q_KEYS[e.code]; replay(); }
  else if (e.code in C_KEYS) { color = C_KEYS[e.code]; replay(); }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') { sustainKey = false; endSustain(); return; }
  const d = NUM_KEYS.indexOf(e.code);
  const i = keysDown.indexOf(d);
  if (i < 0) return;
  keysDown.splice(i, 1);
  if (keysDown.length) { degree = keysDown[keysDown.length - 1]; play(); } else stop();
});
function endSustain() { if (sustained && !sustain() && !sounding) { releaseAll(); sustained = false; } }
// A hidden page or a lost window can't hear the key or finger coming up.
const letGo = () => { keysDown.length = 0; held.clear(); sustainKey = false; stop(); };
window.addEventListener('blur', letGo);
document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(); });

// --- CAMERA AND HAND TRACKING (MediaPipe, on this device) ---
let handLandmarker = null, faceLandmarker = null, stream = null, cameraOn = false, starting = false;
// MediaPipe loads only when the camera starts, so the page works at once without it.
const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';
async function loadTracking() {
  if (handLandmarker) return;
  const { HandLandmarker, FaceLandmarker, FilesetResolver } = await import(`${MEDIAPIPE}/vision_bundle.mjs`);
  const vision = await FilesetResolver.forVisionTasks(`${MEDIAPIPE}/wasm`);
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO', numHands: 2,
  });
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' },
    outputFaceBlendshapes: true, runningMode: 'VIDEO', numFaces: 1,
  });
}
async function startCamera() {
  if (starting || cameraOn) return;
  starting = true;
  loadRack();
  showMsg(null);
  status('loadingTracking');
  // Ask for the camera (and the microphone, for "Record my voice") at once, while the models load.
  // The voice is recorded as it is: the browser's echo cancelling and noise
  // cleaning muted it under the chords, even with headphones (Drephie's test).
  const cam = navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    .catch(() => navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } }));
  cam.catch(() => {}); // handled below, after the models load
  try { await loadTracking(); } catch (err) { console.warn('Chordigits: tracking', err); starting = false; status(null); showMsg('errModels'); return; }
  status('askCamera');
  try { stream = await cam; } catch (err) { console.warn('Chordigits: camera', err); starting = false; status(null); showMsg('errCamera'); return; }
  video.srcObject = stream;
  await new Promise((res) => (video.readyState >= 2 ? res() : video.addEventListener('loadeddata', res, { once: true })));
  starting = false;
  cameraOn = true;
  calib = { done: false, startedAt: 0, samples: [] };
  if (key.chromatic) { settings.key = keySelect.value = '0_maj'; keyContext(); }
  keyOptions();
  document.body.classList.add('camera-on');
  status(null);
  sizeCanvas();
}
let statusKey = null;
function status(k) { statusKey = k; statusEl.textContent = k ? t(k) : ''; }

// Each hand's reading is one number, held steady (createSteady), so a chord
// changes only once both hands are still:
//   number hand: 0 = fist, else chord number + 10 * (height band + 1)
//   other hand:  10 * (tilt + 1) + colour
const numberSteady = createSteady(), typeSteady = createSteady();
let handsPlaying = false, hands = [], lastVideoTime = -1, frameAt = 0, frame = 0;
const memory = { Left: {}, Right: {} };
const face = { present: false, brow: 0 };
let calib = { done: true, startedAt: 0, samples: [] }, browThreshold = 0.5;

function readHands(nowMs) {
  if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  frameAt = nowMs;
  const res = handLandmarker.detectForVideo(video, nowMs);
  const sides = res.handednesses || res.handedness || [];
  hands = (res.landmarks || []).map((lm, i) => {
    // MediaPipe's labels assume a mirrored picture; the camera's isn't.
    const raw = sides[i]?.[0]?.categoryName;
    const side = raw === 'Left' ? 'Right' : raw === 'Right' ? 'Left' : (lm[0].x > 0.5 ? 'Left' : 'Right');
    const world = res.worldLandmarks?.[i];
    if (!world) return { lm, side, code: null };
    const m = memory[side];
    m.fingers = readFingers(world, m.fingers);
    if (side === numberSide()) {
      const n = chordNumber(m.fingers, world, settings.sixSeven);
      m.band = heightBand(lm[9].y, m.band);
      return { lm, side, code: n ? n + 10 * (m.band + 1) : 0 };
    }
    m.tilt = handTilt(world, m.tilt);
    return { lm, side, code: 10 * (m.tilt + 1) + COLOR_OF_COUNT[countFingers(m.fingers)] };
  });
  if (faceLandmarker && settings.brow && ++frame % 2 === 0) readBrows(nowMs);
}
function readBrows(nowMs) {
  const cats = faceLandmarker.detectForVideo(video, nowMs).faceBlendshapes?.[0]?.categories;
  face.present = !!cats;
  face.brow = cats ? cats.find((c) => c.categoryName === 'browInnerUp')?.score || 0 : 0;
  // A relaxed face for 2 s sets where "raised" begins, for this person.
  if (!calib.done && face.present) {
    if (!calib.startedAt) calib.startedAt = Date.now();
    calib.samples.push(face.brow);
    if (Date.now() - calib.startedAt >= 2000 && calib.samples.length >= 8) {
      browThreshold = Math.min(0.7, Math.max(0.35, calib.samples.reduce((a, b) => a + b, 0) / calib.samples.length + 0.25));
      calib.done = true;
    }
  }
}
const numberSide = () => (settings.hand === 'right' ? 'Right' : 'Left');

function tick(nowMs) {
  requestAnimationFrame(tick);
  if (!cameraOn || !handLandmarker) return;
  readHands(nowMs);
  if (hands.length && nowMs - frameAt > 1000) hands = []; // the camera froze: never hold notes on an old picture
  let numberRaw = null, typeRaw = null;
  for (const h of hands) { if (h.side === numberSide()) numberRaw = h.code; else typeRaw = h.code; }
  const numberNow = numberSteady.update(numberRaw, nowMs);
  const typeNow = typeSteady.update(typeRaw, nowMs);
  const settled = (raw, now) => raw == null || raw === now;
  if (!(numberNow > 0)) handsPlaying = false;
  else if (settled(numberRaw, numberNow) && settled(typeRaw, typeNow)) {
    handsPlaying = true;
    degree = Math.min(numberNow % 10, names.length) - 1;
    handOctave = Math.floor(numberNow / 10) - 1;
    const tc = typeNow == null ? 10 : typeNow;
    quality = Math.floor(tc / 10) - 1;
    color = tc % 10;
  }
  if (settings.brow && face.present && calib.done) {
    if (!sustainBrow && face.brow > browThreshold) sustainBrow = true;
    else if (sustainBrow && face.brow < browThreshold - 0.1) sustainBrow = false;
  } else sustainBrow = false;
  endSustain();
  if (handsPlaying) play(); else if (sounding && !held.size && !keysDown.length) stop();
  // Browsers start sound only after a tap or a key: hands alone can't do it.
  const soundOff = !window.Tone || Tone.context.state !== 'running';
  status(soundOff ? 'tapForSound' : !rack && handsPlaying ? 'loadingSound' : !calib.done && settings.brow ? 'calibrating' : sustain() && sounding ? 'sustainOn' : null);
  draw();
}

// --- DRAWING THE HANDS AND WHAT THEY SHOW ---
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
let look = {};
function readLook() {
  const cs = getComputedStyle(document.body);
  const g = (v) => cs.getPropertyValue(v).trim();
  look = { left: g('--color-left'), right: g('--color-right'), text: g('--color-text'), bg: g('--bg-page'), font: g('--font-display'), blur: parseInt(g('--shadow-blur'), 10) || 0 };
}
function sizeCanvas() { canvas.width = innerWidth; canvas.height = innerHeight; }
// The picture fills the window (object-fit: cover) and is mirrored, like a mirror.
function toCanvas(p) {
  const vw = video.videoWidth || 1280, vh = video.videoHeight || 720, W = canvas.width, H = canvas.height;
  const s = Math.max(W / vw, H / vh);
  return { x: W / 2 - (p.x - 0.5) * vw * s, y: H / 2 + (p.y - 0.5) * vh * s };
}
const KIND_WORD = { 0: 'qKey', 1: 'qMaj', [-1]: 'qMin' }, COLOR_WORD = ['cPlain', 'c7', 'cSus', 'cAdd9'];
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const h of hands) {
    const pts = h.lm.map(toCanvas);
    const col = h.side === numberSide() ? look.right : look.left;
    ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = look.blur;
    for (const [a, b] of BONES) { ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke(); }
    ctx.shadowBlur = 0; ctx.fillStyle = look.text;
    for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
    if (h.code == null) continue;
    let text;
    if (h.side === numberSide()) {
      const n = h.code % 10, band = Math.floor(h.code / 10) - 1;
      text = n ? (numerals[n - 1] || String(n)) + (band > 0 ? ' ↑' : band < 0 ? ' ↓' : '') : '✊';
    } else {
      const q = Math.floor(h.code / 10) - 1, c = h.code % 10;
      text = c ? `${t(KIND_WORD[q])} · ${t(COLOR_WORD[c])}` : t(KIND_WORD[q]);
    }
    const big = h.side === numberSide();
    ctx.font = `700 ${big ? 34 : 18}px ${look.font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const x = pts[9].x, y = Math.min(...pts.map((p) => p.y)) - 12, w = ctx.measureText(text).width + 20, hgt = big ? 44 : 30;
    ctx.fillStyle = look.bg; ctx.globalAlpha = 0.72;
    ctx.beginPath(); (ctx.roundRect || ctx.rect).call(ctx, x - w / 2, y - hgt + 4, w, hgt, 10); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = col;
    ctx.fillText(text, x, y);
  }
}

// --- RECORDING (as in Choordination: audio only or screen + audio, your voice mixed in) ---
let isRecording = false, recStart = 0, recTimer = null, recMode = 'audio', recStarting = false;
let screenRecorder = null, screenStream = null, screenChunks = [];
let micSrc = null, micGain = null, micStream = null, micOnly = null;
const fmtTime = (ms) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function updateRecordButton() {
  recTime.textContent = isRecording ? fmtTime(Date.now() - recStart) : '';
  recordBtn.classList.toggle('recording', isRecording);
  recordBtn.setAttribute('aria-label', t(isRecording ? 'recStopAria' : 'recordAria'));
}
async function connectVoice() {
  if (!$('rec-voice').checked) return;
  let s = stream && stream.getAudioTracks().length ? stream : null;
  if (!s) {
    try { s = micOnly = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch (err) { console.warn('Chordigits: microphone', err); $('rec-voice').checked = false; return; }
  }
  // The microphone goes only into the recording, never to the speakers.
  const raw = Tone.getContext().rawContext;
  if (micStream !== s) {
    try { if (micSrc) micSrc.disconnect(); } catch { /* ignore */ }
    micSrc = raw.createMediaStreamSource(s); micGain = raw.createGain(); micSrc.connect(micGain); micStream = s;
  }
  micGain.connect(streamDest);
  Tone.connect(micGain, recorder);
}
function disconnectVoice() {
  try { if (micGain) micGain.disconnect(); } catch { /* ignore */ }
  if (micOnly) { micOnly.getTracks().forEach((tr) => tr.stop()); if (micStream === micOnly) { micSrc = micGain = micStream = null; } micOnly = null; }
}
function wav(buffer) {
  const ch = Math.min(2, buffer.numberOfChannels || 1), rate = buffer.sampleRate, n = buffer.length, size = n * ch * 2;
  const dv = new DataView(new ArrayBuffer(44 + size));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + size, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate * ch * 2, true);
  dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, size, true);
  const data = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c));
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) { const v = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Blob([dv.buffer], { type: 'audio/wav' });
}
function download(blob, ext) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'chordigits-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.' + ext;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const busy = (on) => { $('busy').hidden = !on; };
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
function beginRecording() { isRecording = true; recStart = Date.now(); recTimer = setInterval(updateRecordButton, 500); updateRecordButton(); }
recordBtn.addEventListener('click', async (e) => {
  if (recStarting) return;
  if (isRecording) { stopRecording(); return; }
  await loadRack();
  if (!recorder) return;
  $('rec-screen').hidden = !navigator.mediaDevices?.getDisplayMedia;
  modals.open(recModal, e.currentTarget);
});
$('rec-audio').addEventListener('click', async () => {
  modals.hideAll();
  recStarting = true; await connectVoice(); recStarting = false;
  recMode = 'audio'; recorder.start(); beginRecording();
});
$('rec-screen').addEventListener('click', async () => {
  modals.hideAll();
  let s;
  try { s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false }); } catch { return; }
  recStarting = true; await connectVoice(); recStarting = false;
  recMode = 'screen'; screenStream = s;
  const mixed = new MediaStream([...s.getVideoTracks(), ...streamDest.stream.getAudioTracks()]);
  const mime = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  screenChunks = [];
  screenRecorder = new MediaRecorder(mixed, { videoBitsPerSecond: 8000000, audioBitsPerSecond: 128000, ...(mime ? { mimeType: mime } : {}) });
  screenRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) screenChunks.push(ev.data); };
  screenRecorder.onstop = async () => {
    busy(true); await nextPaint();
    const type = screenRecorder.mimeType || mime || 'video/webm';
    download(new Blob(screenChunks, { type }), type.includes('mp4') ? 'mp4' : 'webm');
    screenChunks = []; screenStream.getTracks().forEach((tr) => tr.stop()); screenStream = screenRecorder = null;
    busy(false);
  };
  s.getVideoTracks()[0].addEventListener('ended', () => { if (isRecording && recMode === 'screen') stopRecording(); });
  screenRecorder.start();
  beginRecording();
});
async function stopRecording() {
  clearInterval(recTimer); isRecording = false; updateRecordButton();
  if (recMode === 'screen') { if (screenRecorder && screenRecorder.state !== 'inactive') screenRecorder.stop(); disconnectVoice(); return; }
  const blob = await recorder.stop();
  disconnectVoice();
  busy(true); await nextPaint();
  try { download(wav(await Tone.getContext().rawContext.decodeAudioData(await blob.arrayBuffer())), 'wav'); }
  catch (err) { console.warn('Chordigits: WAV', err); download(blob, blob.type.includes('mp4') ? 'm4a' : 'webm'); }
  busy(false);
}

// --- WINDOWS ---
const modals = createModalManager({
  modals: [settingsModal, aboutModal, recModal, supportModal, howModal],
  escapeAction: (m) => (m === supportModal && support.locked() ? 'ignore' : 'hide'),
});
closeOnBackdrop(modals);
document.querySelectorAll('.modal-header .close-btn').forEach((b) => b.addEventListener('click', () => modals.hideAll()));
// The Patreon window waits for a pause after playing (never during a chord).
const support = createSupportPrompt({ dialog: supportModal, modals, t, isBusy: () => !!sounding });
$('settings-btn').addEventListener('click', (e) => modals.open(settingsModal, e.currentTarget));
$('about-btn').addEventListener('click', (e) => modals.open(aboutModal, e.currentTarget));
$('start-camera').addEventListener('click', startCamera);
$('no-camera').addEventListener('click', () => { loadRack(); showMsg(null); });
// Open at the top: on a short screen the focused button would scroll the first line away.
const openHow = (opener) => { modals.open(howModal, opener); howModal.scrollTop = 0; };
$('help-btn').addEventListener('click', (e) => openHow(e.currentTarget));
$('how-ok').addEventListener('click', () => modals.hideAll());

// --- SETTINGS WINDOW ---
function keyOptions() {
  const solfege = settings.notation === 'solfege';
  keySelect.innerHTML = `<option value="chromatic"${cameraOn ? ' disabled' : ''}>${t('chromatic')}</option>`
    + ['maj', 'min'].map((type) => Array.from({ length: 12 }, (_, i) => `<option value="${i}_${type}">${keyRootName(i, type, solfege)} ${t(type === 'maj' ? 'major' : 'minor')}</option>`).join('')).join('');
  keySelect.value = settings.key;
  setupCustomSelects();
}
themeSelect.innerHTML = THEMES.map(([value, k]) => `<option value="${value}" data-i18n="${k}"></option>`).join('');
langSelect.innerHTML = LANGUAGES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
soundSelect.innerHTML = INSTRUMENTS.map((id) => `<option value="${id}" data-i18n="inst${id[0].toUpperCase()}${id.slice(1)}"></option>`).join('');
themeSelect.addEventListener('change', () => { settings.theme = themeSelect.value; applyTheme(settings.theme); readLook(); saveLook({ theme: settings.theme }); });
langSelect.addEventListener('change', () => { settings.lang = langSelect.value; applyLanguage(); saveLook({ lang: settings.lang }); });
watchLook((l) => {
  if (l.theme !== settings.theme) { settings.theme = themeSelect.value = l.theme; applyTheme(l.theme); readLook(); setupCustomSelects(); }
  if (l.lang !== settings.lang) { settings.lang = langSelect.value = l.lang; applyLanguage(); }
});
const onChange = (el, fn) => el.addEventListener('change', () => { fn(el.value); });
onChange(keySelect, (v) => { settings.key = v; stop(); keyContext(); });
onChange(notationSelect, (v) => { settings.notation = v; keyContext(); keyOptions(); });
onChange(soundSelect, (v) => { stop(); releaseAll(); settings.sound = v; save(); });
onChange(glideSelect, (v) => { stop(); releaseAll(); settings.glide = v === 'on'; save(); });
volumeSlider.addEventListener('input', () => { settings.volume = Number(volumeSlider.value); volumeSlider.style.setProperty('--fill', `${settings.volume / 1.25}%`); if (rack) rack.setVolume(settings.volume); });
onChange(octaveSelect, (v) => { settings.octave = Number(v); lastUpper = null; stop(); });
onChange(styleSelect, (v) => { settings.style = v; lastUpper = null; stop(); });
onChange(handSelect, (v) => { settings.hand = v; save(); howToPlay(); numberSteady.reset(); typeSteady.reset(); });
onChange(sixSelect, (v) => { settings.sixSeven = v; save(); howToPlay(); });
onChange(browSelect, (v) => { settings.brow = v === 'on'; sustainBrow = false; howToPlay(); });

function applyLanguage() {
  i18n.apply();
  document.title = t('title');
  howToPlay();
  keyContext();
  keyOptions();
  updateRecordButton();
  mountCameraLook($('cam-look'), t);
  if (msgKey) showMsg(msgKey);
  if (statusKey) status(statusKey);
  if (sounding) showChord(sounding);
}

// --- START ---
applyTheme(settings.theme);
readLook();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(readLook);
themeSelect.value = settings.theme;
langSelect.value = settings.lang;
soundSelect.value = settings.sound;
glideSelect.value = settings.glide ? 'on' : 'off';
handSelect.value = settings.hand;
sixSelect.value = settings.sixSeven;
octaveSelect.value = String(settings.octave);
volumeSlider.style.setProperty('--fill', '80%');
applyLanguage();
loadRack();
startCamera(); // the camera is the way to play: it starts at once (no-camera only if it fails)
if (!saved.seenHow) { openHow(); save(); } // How to play, on the first visit only
sizeCanvas();
addEventListener('resize', sizeCanvas);
requestAnimationFrame(tick);
registerHubWorker('../');
