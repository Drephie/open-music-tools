/* shared/pitch-worklet.js: the pitch detector. Pure code (no DOM, no Web Audio),
 * plus the AudioWorklet processor that runs it on the audio thread. The
 * processor is registered only when this file is loaded with
 * audioWorklet.addModule (shared/pitch.js does that); importing it anywhere
 * else (the main thread, tests, JavaScriptCore) just gives the functions.
 *
 *   createPitchStream({ sampleRate, minFreq = 40, maxFreq = 2000, hopMs = 20, onFrame, ...gate })
 *     Feed it audio as it comes; it calls onFrame every hopMs with
 *       { time, freq, clarity, rms }
 *     time     seconds since the first sample pushed, at the newest sample analysed
 *     freq     Hz, or 0 when no note is sounding (silence, noise, too quiet)
 *     clarity  0..1, how clearly periodic the sound is (1 = a pure tone)
 *     rms      the loudness of the window, 0..1 (0.1 is -20 dBFS)
 *     stream.push(samples)   a Float32Array at sampleRate, any length
 *     stream.samplesIn       samples pushed so far
 *     stream.reset()         forget the room noise and any note (e.g. after a pause)
 *     stream.windowSeconds   how much sound each analysis looks at
 *   The sound is high-passed (rumble), low-passed and, above 32 kHz, decimated to
 *   about 24 kHz, then analysed over a window of 2.5 periods of minFreq.
 *
 *   createDetector({ sampleRate, minFreq, maxFreq, windowSize })
 *     .analyse(frame) -> { freq, clarity, rms } for one window of samples
 *     (freq 0 = no clear pitch). McLeod's pitch method: the normalized square
 *     difference function (NSDF) through an FFT autocorrelation; the first
 *     peak within PEAK_THRESHOLD of the highest is the period (this avoids
 *     octave errors), refined by parabolic interpolation, and for short
 *     periods (high notes) measured again k periods later and divided by k.
 *     Tested: steady notes E1..B6 within 0.1 cent; a note shows 20-45 ms
 *     after it starts; never a note in silence or noise.
 *
 *   createGate({ minRms, startClarity, keepClarity, startOverFloor, keepOverFloor,
 *                confirmFrames, confirmCents, maxMisses })
 *     .next({ freq, clarity, rms }) -> freq or 0. Decides whether a note is
 *     sounding: it learns the room's noise level from frames with no pitch,
 *     needs confirmFrames frames that agree within confirmCents to start a
 *     note (so a click or a word doesn't flash a note), then lets the note
 *     get softer and breathier (keep* thresholds) until maxMisses frames in a
 *     row fail. Defaults in GATE_DEFAULTS.
 *
 * Tests: tests/pitch.html and tests/tools/run-pitch-test.js (synthetic tones,
 * harmonics, noise, quiet signals and silence with known answers).
 */

export const PEAK_THRESHOLD = 0.9;

export const GATE_DEFAULTS = {
  minRms: 0.002,         // -54 dBFS: quieter than this is never a note
  startClarity: 0.6,     // a new note must be clearly pitched...
  keepClarity: 0.4,      // ...a note already sounding may get breathier
  startOverFloor: 2.5,   // and this many times louder than the room's noise
  keepOverFloor: 1.5,
  confirmFrames: 2,
  confirmCents: 50,
  maxMisses: 4,          // frames in a row without pitch before a note ends
};

// --- FFT (radix 2, in place, forward) ---
function makeFft(n) {
  const bits = Math.round(Math.log2(n));
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
  return (re, im) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tre = re[l] * cos[k] + im[l] * sin[k];
          const tim = im[l] * cos[k] - re[l] * sin[k];
          re[l] = re[j] - tre; im[l] = im[j] - tim;
          re[j] += tre; im[j] += tim;
        }
      }
    }
  };
}

// --- DETECTOR: McLeod pitch method on one window ---
export function createDetector({ sampleRate, minFreq = 40, maxFreq = 2000, windowSize }) {
  const maxLag = Math.min(Math.ceil(sampleRate / minFreq) + 2, windowSize - 2);
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  let size = 2;
  while (size < windowSize + maxLag) size <<= 1;
  const fft = makeFft(size);
  const re = new Float64Array(size), im = new Float64Array(size);
  const nsdf = new Float64Array(maxLag + 2);
  const peaks = [];

  function analyse(x) {
    const w = windowSize;
    let energy = 0;
    for (let i = 0; i < w; i++) energy += x[i] * x[i];
    const rms = Math.sqrt(energy / w);
    if (rms < 1e-6) return { freq: 0, clarity: 0, rms };

    // Autocorrelation r(t) = IFFT(|FFT(x)|²); the power spectrum is real and
    // even, so a second forward FFT gives the same result times `size`.
    re.fill(0); im.fill(0);
    for (let i = 0; i < w; i++) re[i] = x[i];
    fft(re, im);
    for (let k = 0; k < size; k++) { re[k] = re[k] * re[k] + im[k] * im[k]; im[k] = 0; }
    fft(re, im);

    // NSDF n(t) = 2 r(t) / m(t), m(t) = sum of x[j]² + x[j+t]² over the overlap.
    let m = 2 * energy;
    nsdf[0] = 1;
    for (let t = 1; t <= maxLag + 1; t++) {
      m -= x[t - 1] * x[t - 1] + x[w - t] * x[w - t];
      nsdf[t] = m > 1e-12 ? (2 * re[t] / size) / m : 0;
    }

    // Key maxima: the highest point of each positive lobe after the first
    // dip below zero.
    peaks.length = 0;
    let t = 1;
    while (t <= maxLag && nsdf[t] > 0) t++;
    let best = -1, bestV = -Infinity, inLobe = false;
    for (; t <= maxLag; t++) {
      if (nsdf[t] > 0) {
        inLobe = true;
        if (nsdf[t] > bestV) { bestV = nsdf[t]; best = t; }
      } else if (inLobe) {
        peaks.push(best);
        inLobe = false; best = -1; bestV = -Infinity;
      }
    }
    if (inLobe && best > 0 && best < maxLag) peaks.push(best);
    if (!peaks.length) return { freq: 0, clarity: 0, rms };

    let top = 0;
    for (const p of peaks) if (nsdf[p] > top) top = nsdf[p];
    let lag = -1;
    for (const p of peaks) if (nsdf[p] >= PEAK_THRESHOLD * top) { lag = p; break; }
    // A pitch above maxFreq: say nothing rather than an octave below it.
    if (lag < minLag) return { freq: 0, clarity: top, rms };

    const first = interpolate(lag);
    let period = first.at;
    // High notes have short periods, where the parabola is a little off. The
    // peak k periods later is just as sharp, so measure there and divide by k.
    const k = Math.floor(Math.min(maxLag - 1, windowSize >> 1) / period);
    if (k >= 2) {
      const guess = Math.round(k * period);
      let p = guess;
      for (let j = guess - 2; j <= guess + 2; j++) if (nsdf[j] > nsdf[p]) p = j;
      if (p > guess - 2 && p < guess + 2 && nsdf[p] >= 0.9 * first.value) period = interpolate(p).at / k;
    }
    return { freq: sampleRate / period, clarity: first.value, rms };
  }

  // Parabola through a peak and its neighbours.
  function interpolate(t) {
    const a = nsdf[t - 1], b = nsdf[t], c = nsdf[t + 1];
    const den = a - 2 * b + c;
    const shift = den < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den)) : 0;
    return { at: t + shift, value: Math.min(1, b - 0.25 * (a - c) * shift) };
  }

  return { analyse, windowSize, maxLag, minLag, fftSize: size };
}

// --- GATE: is a note sounding? ---
export function createGate(options = {}) {
  const o = { ...GATE_DEFAULTS, ...options };
  let floor = o.minRms / o.startOverFloor;   // the room's noise level, learned
  let tracking = false, misses = 0;
  const recent = [];

  function next({ freq, clarity, rms }) {
    const overFloor = tracking ? o.keepOverFloor : o.startOverFloor;
    const loudEnough = rms >= Math.max(o.minRms, floor * overFloor);
    const clear = freq > 0 && clarity >= (tracking ? o.keepClarity : o.startClarity);
    if (!(loudEnough && clear)) {
      if (!tracking) {
        if (clarity < o.keepClarity) {
          // Learn the room from sound with no clear pitch (but not from loud
          // bangs): quickly when it gets quieter, slowly when louder.
          if (rms < 0.05) floor += (rms < floor ? 0.15 : 0.03) * (rms - floor);
        } else {
          // A clear note held back only by the room level: the room may have
          // just gone quiet (a fan stopped), so let the level fall.
          floor = Math.max(o.minRms / o.startOverFloor, floor * 0.95);
        }
      }
      if (tracking && ++misses > o.maxMisses) { tracking = false; misses = 0; }
      recent.length = 0;
      return 0;
    }
    misses = 0;
    if (tracking) return freq;
    recent.push(freq);
    if (recent.length > o.confirmFrames) recent.shift();
    if (recent.length < o.confirmFrames) return 0;
    let lo = Infinity, hi = 0;
    for (const f of recent) { if (f < lo) lo = f; if (f > hi) hi = f; }
    if (1200 * Math.log2(hi / lo) > o.confirmCents) return 0;
    tracking = true;
    recent.length = 0;
    return freq;
  }

  function reset() { tracking = false; misses = 0; recent.length = 0; floor = o.minRms / o.startOverFloor; }
  return { next, reset, get floor() { return floor; }, get tracking() { return tracking; } };
}

// --- FILTERS: Butterworth biquads (RBJ cookbook), direct form I ---
function biquad(type, sampleRate, freq) {
  const w = 2 * Math.PI * freq / sampleRate, cw = Math.cos(w), alpha = Math.sin(w) / Math.SQRT2;
  const a0 = 1 + alpha;
  const b1 = (type === 'low' ? 1 - cw : -(1 + cw)) / a0;
  const b0 = (type === 'low' ? (1 - cw) / 2 : (1 + cw) / 2) / a0;
  const a1 = -2 * cw / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return {
    step(x) {
      const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    },
    reset() { x1 = x2 = y1 = y2 = 0; },
  };
}

// --- STREAM: filters, decimation, a sliding window and the gate ---
export function createPitchStream({ sampleRate, minFreq = 40, maxFreq = 2000, hopMs = 20, onFrame, ...gateOptions }) {
  const decimate = Math.max(1, Math.round(sampleRate / 24000));
  const rate = sampleRate / decimate;
  const windowSize = Math.round(2.5 * rate / minFreq);
  const hop = Math.max(32, Math.round(rate * hopMs / 1000));
  const detector = createDetector({ sampleRate: rate, minFreq, maxFreq, windowSize });
  const gate = createGate(gateOptions);
  const highPass = biquad('high', sampleRate, Math.max(20, minFreq * 0.6));
  const lowPass = decimate > 1 ? [biquad('low', sampleRate, rate * 0.42), biquad('low', sampleRate, rate * 0.42)] : [];
  const ring = new Float32Array(windowSize), frame = new Float32Array(windowSize);
  let write = 0, filled = 0, sinceHop = 0, phase = 0, samplesIn = 0;

  function push(samples) {
    for (let i = 0; i < samples.length; i++) {
      let s = highPass.step(samples[i]);
      for (const f of lowPass) s = f.step(s);
      samplesIn++;
      if (++phase < decimate) continue;
      phase = 0;
      ring[write] = s;
      write = (write + 1) % windowSize;
      if (filled < windowSize) filled++;
      if (++sinceHop >= hop && filled === windowSize) {
        sinceHop = 0;
        for (let j = 0; j < windowSize; j++) frame[j] = ring[(write + j) % windowSize];
        const r = detector.analyse(frame);
        onFrame({ time: samplesIn / sampleRate, freq: gate.next(r), clarity: r.clarity, rms: r.rms });
      }
    }
  }

  function reset() { gate.reset(); }
  return {
    push, reset, rate, hop, detector,
    windowSeconds: windowSize / rate,
    get samplesIn() { return samplesIn; },
  };
}

// --- THE AUDIOWORKLET PROCESSOR (only inside audioWorklet.addModule) ---
if (typeof registerProcessor === 'function' && typeof AudioWorkletProcessor === 'function') {
  registerProcessor('pitch-detector', class extends AudioWorkletProcessor {
    constructor(options) {
      super();
      this.opts = (options && options.processorOptions) || {};
      this.alive = true;
      this.mono = null;
      this.base = 0;
      this.makeStream();
      this.port.onmessage = (e) => {
        if (e.data === 'stop') this.alive = false;
        else if (e.data === 'reset') this.stream.reset();
        else if (e.data && e.data.range) { this.opts = { ...this.opts, ...e.data.range }; this.makeStream(); }
      };
    }

    // A new stream for the current range (a new range starts afresh: room level, note, window).
    makeStream() {
      // `sampleRate` and `currentTime` are globals of the worklet scope.
      this.stream = createPitchStream({
        ...this.opts,
        sampleRate,
        onFrame: (f) => this.port.postMessage({ time: this.base + f.time, freq: f.freq, clarity: f.clarity, rms: f.rms }),
      });
    }

    process(inputs) {
      const channels = inputs[0];
      if (channels && channels.length) {
        let samples = channels[0];
        if (channels.length > 1) {
          if (!this.mono || this.mono.length !== samples.length) this.mono = new Float32Array(samples.length);
          for (let i = 0; i < samples.length; i++) {
            let sum = 0;
            for (let c = 0; c < channels.length; c++) sum += channels[c][i];
            this.mono[i] = sum / channels.length;
          }
          samples = this.mono;
        }
        // Context time of the stream's start, so frame times are context times.
        this.base = currentTime - this.stream.samplesIn / sampleRate;
        this.stream.push(samples);
      }
      return this.alive;
    }
  });
}
