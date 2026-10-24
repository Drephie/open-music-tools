/* shared/pitch.js: microphone to note. The detector runs in an AudioWorklet
 * (shared/pitch-worklet.js) on the audio thread; nothing is recorded, kept or
 * uploaded: the sound is analysed as it comes and thrown away.
 *
 *   const listener = await startPitch({ onFrame, onEnd, minFreq, maxFreq, hopMs, context, source })
 *     Call it from a tap or click (it creates and resumes the AudioContext
 *     before its first await, as iPhones require). Asks for the microphone with
 *     echo cancellation, noise suppression and automatic gain off (they bend
 *     pitch and loudness).
 *     onFrame({ time, freq, clarity, rms })  about every hopMs (default 20 ms):
 *       freq in Hz, 0 when no note is sounding; time in the context's seconds;
 *       clarity 0..1; rms 0..1 (loudness, also during silence and noise). See
 *       shared/pitch-worklet.js createPitchStream.
 *     onEnd(reason)  the microphone stopped by itself ('ended': unplugged,
 *       permission taken back, another app took it). Not called by stop().
 *     minFreq, maxFreq  the range of notes to find (default 40..2000 Hz; the
 *       window, and so the delay before a note shows, is 2.5 periods of minFreq)
 *     context  an AudioContext to use instead of a new one (it is not closed by stop)
 *     source   an AudioNode in that context to listen to instead of the
 *              microphone (tests and test signals)
 *     Rejects with an Error whose .reason is one of PITCH_ERRORS:
 *       'insecure'     the page is not https (or localhost): no microphone
 *       'unsupported'  the browser has no microphone access
 *       'denied'       the person or the browser said no
 *       'no-mic'       no microphone found
 *       'busy'         the microphone is in use by another app
 *       'failed'       anything else
 *     listener.stop()        stops the microphone (the browser's mic sign goes
 *                            off) and closes its own AudioContext
 *     listener.reset()       forgets the room's noise level and the current note
 *     listener.context, listener.worklet (false = the ScriptProcessor fallback,
 *     for browsers without AudioWorklet), listener.windowSeconds
 *
 *   createPitchSmoother({ speed = 'calm', holdMs })
 *     What a display shows, from the frames: .push(frame) -> { freq, clarity }
 *     or null when nothing has sounded for holdMs. 'calm': the median of the
 *     last 5 pitched frames, eased with a 70 ms time constant (settles within
 *     a cent in about a quarter of a second); 'quick': the median of 3, 20 ms
 *     (shows vibrato). A jump of more than half a semitone (a new note) is
 *     shown at once. holdMs defaults to 250 (calm) or 150 (quick). .reset()
 *
 *   freqToMidi(freq, a4 = 440)  MIDI number with a fraction (A4 = 69)
 *   midiToFreq(midi, a4 = 440)
 *   nearestNote(freq, a4 = 440, prevMidi = null, stickCents = 8)
 *     -> { midi, cents }: the nearest note and how far from it, -50..+50
 *     cents (a cent is 1/100 of a half step). With prevMidi, that note is kept
 *     until the pitch is more than 50 + stickCents cents away, so a pitch on
 *     the border doesn't flicker between two names.
 *
 * Tests: tests/pitch.html (also through the real worklet, rendered offline)
 * and tests/tools/run-pitch-test.js.
 */

import { createPitchStream } from './pitch-worklet.js';

export const PITCH_ERRORS = ['insecure', 'unsupported', 'denied', 'no-mic', 'busy', 'failed'];

const loadedContexts = new WeakSet();

function pitchError(reason, cause) {
  const err = new Error(`Microphone: ${reason}`);
  err.reason = reason;
  err.cause = cause;
  return err;
}

function micErrorReason(err) {
  switch (err && err.name) {
    case 'NotAllowedError': case 'SecurityError': case 'PermissionDeniedError': return 'denied';
    case 'NotFoundError': case 'DevicesNotFoundError': case 'OverconstrainedError': return 'no-mic';
    case 'NotReadableError': case 'TrackStartError': case 'AbortError': return 'busy';
    default: return 'failed';
  }
}

export async function startPitch({ onFrame, onEnd, minFreq = 40, maxFreq = 2000, hopMs = 20, context, source, forceFallback = false } = {}) {
  if (!source) {
    if (typeof window !== 'undefined' && window.isSecureContext === false) throw pitchError('insecure');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw pitchError('unsupported');
  }
  const ownContext = !context;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (ownContext && !AC) throw pitchError('unsupported');
  const ctx = context || new AC({ latencyHint: 'interactive' });
  // Resume inside the tap, before any await (iPhones need that).
  const isOffline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  if (!isOffline && ctx.state === 'suspended') ctx.resume().catch(() => {});

  let stream = null;
  const cleanup = () => {
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    if (ownContext) ctx.close().catch(() => {});
  };
  try {
    if (!source) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
    }
  } catch (err) {
    cleanup();
    throw pitchError(micErrorReason(err), err);
  }

  let node = null, worklet = false, input = null, mute = null, resetDetector = () => {};
  let ended = false;
  const deliver = (frame) => { if (!ended && onFrame) onFrame(frame); };
  const options = { minFreq, maxFreq, hopMs };
  try {
    input = source || ctx.createMediaStreamSource(stream);
    if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined' && !forceFallback) {
      try {
        if (!loadedContexts.has(ctx)) {
          await ctx.audioWorklet.addModule(new URL('./pitch-worklet.js', import.meta.url).href);
          loadedContexts.add(ctx);
        }
        node = new AudioWorkletNode(ctx, 'pitch-detector', {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: options,
        });
        node.port.onmessage = (e) => deliver(e.data);
        resetDetector = () => node.port.postMessage('reset');
        worklet = true;
      } catch { node = null; }
    }
    // Fallback for browsers without AudioWorklet: the same detector on the main thread.
    if (!node) {
      let base = 0;
      const ps = createPitchStream({
        ...options, sampleRate: ctx.sampleRate,
        onFrame: (f) => deliver({ time: base + f.time, freq: f.freq, clarity: f.clarity, rms: f.rms }),
      });
      node = ctx.createScriptProcessor(1024, 1, 1);
      // playbackTime is when this block's output would be heard, about two
      // blocks after its input arrived.
      const delay = 2048 / ctx.sampleRate;
      node.onaudioprocess = (e) => {
        base = e.playbackTime - delay - ps.samplesIn / ctx.sampleRate;
        ps.push(e.inputBuffer.getChannelData(0));
      };
      resetDetector = () => ps.reset();
    }
    // Nothing is heard: the node feeds a silent gain so the browser keeps it running.
    mute = ctx.createGain();
    mute.gain.value = 0;
    input.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
  } catch (err) {
    cleanup();
    throw pitchError('failed', err);
  }

  if (stream) {
    stream.getAudioTracks().forEach((tr) => tr.addEventListener('ended', () => {
      if (ended) return;
      stop();
      if (onEnd) onEnd('ended');
    }));
  }

  function stop() {
    if (ended) return;
    ended = true;
    try {
      if (worklet) node.port.postMessage('stop');
      else node.onaudioprocess = null;
      input.disconnect(node);
      node.disconnect();
      mute.disconnect();
    } catch { /* already disconnected */ }
    cleanup();
  }

  return {
    stop,
    reset: () => resetDetector(),
    context: ctx,
    worklet,
    windowSeconds: createPitchStream({ ...options, sampleRate: ctx.sampleRate, onFrame() {} }).windowSeconds,
  };
}

// --- WHAT A DISPLAY SHOWS ---
export function createPitchSmoother({ speed = 'calm', holdMs } = {}) {
  const calm = speed !== 'quick';
  const size = calm ? 5 : 3;
  const tau = calm ? 0.07 : 0.02;
  const hold = (holdMs ?? (calm ? 250 : 150)) / 1000;
  const recent = [];
  let value = null, clarity = 0, lastTime = null, lastPitched = -Infinity;

  function push({ time, freq, clarity: c }) {
    const dt = lastTime === null ? 0 : Math.max(0, time - lastTime);
    lastTime = time;
    if (freq > 0) {
      lastPitched = time;
      recent.push(freqToMidi(freq));
      if (recent.length > size) recent.shift();
      const sorted = recent.slice().sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      if (value === null || Math.abs(median - value) > 0.5) value = median;
      else value += (median - value) * (1 - Math.exp(-dt / tau));
      clarity = c;
    } else if (time - lastPitched > hold) {
      value = null;
      recent.length = 0;
    }
    return value === null ? null : { freq: midiToFreq(value), clarity };
  }

  function reset() { value = null; recent.length = 0; lastTime = null; lastPitched = -Infinity; }
  return { push, reset };
}

// --- NOTES ---
export function freqToMidi(freq, a4 = 440) { return 69 + 12 * Math.log2(freq / a4); }
export function midiToFreq(midi, a4 = 440) { return a4 * Math.pow(2, (midi - 69) / 12); }

export function nearestNote(freq, a4 = 440, prevMidi = null, stickCents = 8) {
  const m = freqToMidi(freq, a4);
  let midi = Math.round(m);
  if (prevMidi !== null && Math.abs(m - prevMidi) * 100 <= 50 + stickCents) midi = prevMidi;
  return { midi, cents: (m - midi) * 100 };
}
