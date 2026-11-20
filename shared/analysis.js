/* shared/analysis.js: a song's beats, BPM and key, on the device (spec:
 * specs/bpm-key-finder.md). The measuring runs in a background worker
 * (./analysis-worker.js, Essentia.js 0.1.3 from ./vendor/essentia/, AGPL-3.0),
 * loaded only on the first analyse(); the rules are in ./analysis-rules.js.
 * Nothing is uploaded or kept.
 *
 *   await decodeFile(file) -> AudioBuffer   any song or video the browser can
 *       play. Throws Error('decode') when it can't.
 *   toMono(audioBuffer) -> Promise<Float32Array> at 44100 Hz (both channels mixed)
 *   await analyse(samples, { onProgress(0..1), solfege }) -> result
 *     samples: mono 44100 Hz (toMono). result:
 *       { seconds, reason: null | 'silent' | 'short',
 *         beat: null | { bpm, beats: [s], half, double, range: { low, high, changes } },
 *         key: null | { key, alt, strength, changes: [{ time, key }] } }
 *       measured: { confidence, strengths } as Essentia gave them (for tests)
 *     reason 'silent' or 'short' (under MIN_SECONDS): beat and key are null
 *     and nothing is measured.
 *   listen(source, { seconds = 30, onLevel(0..1), onTime(s) }) -> listener
 *     source 'mic' (the microphone, with echo cancelling, noise cleaning and
 *     automatic volume off) or 'tab' (getDisplayMedia: the person picks a tab
 *     and ticks "Share tab audio"). Records until seconds or stop().
 *       listener.done: Promise<AudioBuffer>, rejects with Error(reason):
 *         'unsupported' (no way to listen in this browser), 'denied'
 *         (permission refused or picking cancelled), 'no-audio' (a tab shared
 *         without its sound), 'too-short' (stopped before 3 s)
 *       listener.stop()  stop now and keep what was heard
 *       listener.cancel()  stop and keep nothing (done rejects 'cancelled')
 *     Every track (microphone, the shared tab) is stopped when it ends.
 *   canListenToTab()  true where tab sharing with sound is offered (Chrome and
 *     Edge on computers): getDisplayMedia exists and the screen isn't a touch one
 */
import { SAMPLE_RATE, MIN_SECONDS, soundLevel, isSilent, parseKey, halfDouble, tempoRange, readBeat, readKey, keyChanges, keyAgreement } from './analysis-rules.js';

let worker = null, nextId = 1;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./analysis-worker.js', import.meta.url));
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) return;
    if (data.progress !== undefined) { if (p.onProgress) p.onProgress(data.progress); return; }
    pending.delete(data.id);
    if (data.error) p.reject(new Error(data.error)); else p.resolve(data.result);
  };
  worker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || 'worker')); pending.clear(); worker = null; };
  return worker;
}

export async function decodeFile(file) {
  const data = await file.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    return await new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(data, resolve, () => reject(new Error('decode')));
      if (p && p.catch) p.catch(() => reject(new Error('decode')));
    });
  } finally {
    if (ctx.close) ctx.close().catch(() => {});
  }
}

export async function toMono(buffer) {
  const length = Math.max(1, Math.ceil(buffer.duration * SAMPLE_RATE));
  const off = new OfflineAudioContext(1, length, SAMPLE_RATE);
  const src = off.createBufferSource();
  src.buffer = buffer; src.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0);
}

export async function analyse(samples, { onProgress } = {}) {
  const seconds = samples.length / SAMPLE_RATE;
  if (seconds < MIN_SECONDS) return { seconds, reason: 'short', beat: null, key: null };
  if (isSilent(soundLevel(samples))) return { seconds, reason: 'silent', beat: null, key: null };
  const id = nextId++;
  const raw = await new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    const copy = samples.slice();
    getWorker().postMessage({ id, samples: copy }, [copy.buffer]);
  });
  if (onProgress) onProgress(1);
  const found = readBeat({ bpm: raw.bpm, confidence: raw.confidence, beats: raw.beats, seconds });
  const beat = found ? { bpm: raw.bpm, beats: found.beats, ...halfDouble(raw.bpm), range: tempoRange(raw.bpm, raw.intervals) } : null;
  const profiles = raw.profiles.map((p) => ({ key: parseKey(p.key, p.scale), strength: p.strength }));
  const windows = raw.windows.map((w) => ({ time: w.time, key: w.strength >= 0.3 ? parseKey(w.key, w.scale) : null, strength: w.strength }));
  const k = readKey(profiles, windows, raw.notes);
  const key = k ? { ...k, changes: keyChanges(windows, k.key) } : null;
  return { seconds, reason: null, beat, key, measured: { confidence: raw.confidence, strengths: raw.profiles.map((p) => p.strength), agree: k ? keyAgreement(windows, k.key) : null, notes: raw.notes } };
}

export const canListenToTab = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
  && !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

export function listen(source, { seconds = 30, onLevel, onTime } = {}) {
  let stream = null, recorder = null, timer = null, ctx = null, cancelled = false, started = 0;
  const chunks = [];
  const stopTracks = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); if (ctx) ctx.close().catch(() => {}); clearInterval(timer); };
  const done = (async () => {
    const md = navigator.mediaDevices;
    if (!md || (source === 'mic' ? !md.getUserMedia : !md.getDisplayMedia) || typeof MediaRecorder === 'undefined') throw new Error('unsupported');
    try {
      stream = source === 'mic'
        ? await md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        : await md.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, preferCurrentTab: false, selfBrowserSurface: 'exclude', systemAudio: 'include' });
    } catch (e) {
      throw new Error(e && e.name === 'NotFoundError' ? 'unsupported' : 'denied');
    }
    if (cancelled) { stopTracks(); throw new Error('cancelled'); }
    const audio = stream.getAudioTracks();
    if (!audio.length) { stopTracks(); throw new Error('no-audio'); }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
    const analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    ctx.createMediaStreamSource(new MediaStream(audio)).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    recorder = new MediaRecorder(new MediaStream(audio));
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
    // A tab whose sharing is ended from the browser's own bar stops the recording.
    audio[0].addEventListener('ended', () => { if (recorder.state === 'recording') recorder.stop(); });
    recorder.start(1000);
    started = performance.now();
    timer = setInterval(() => {
      const t = (performance.now() - started) / 1000;
      analyser.getFloatTimeDomainData(buf);
      let peak = 0; for (const x of buf) peak = Math.max(peak, Math.abs(x));
      if (onLevel) onLevel(Math.min(1, peak * 1.5));
      if (onTime) onTime(Math.min(seconds, t));
      if (t >= seconds && recorder.state === 'recording') recorder.stop();
    }, 100);
    await stopped;
    const heard = (performance.now() - started) / 1000;
    stopTracks();
    if (cancelled) throw new Error('cancelled');
    if (heard < 3) throw new Error('too-short');
    const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || '' });
    return decodeFile(blob);
  })();
  done.catch(() => {});
  return {
    done,
    stop() { if (recorder && recorder.state === 'recording') recorder.stop(); },
    cancel() { cancelled = true; if (recorder && recorder.state === 'recording') recorder.stop(); else stopTracks(); },
  };
}
