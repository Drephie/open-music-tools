/* tests/pitch-cases.js: known-answer checks for the pitch engine
 * (shared/pitch-worklet.js and shared/pitch.js). Every signal is made here,
 * so its pitch is known exactly: sines, harmonic tones (bright, voice-like,
 * a strong 2nd harmonic, a missing fundamental), noise at known levels,
 * quiet notes, vibrato, note changes, silence and noise with no note.
 * The signals go through createPitchStream exactly as the AudioWorklet feeds
 * it: 128 samples at a time.
 *
 *   checkPitch(core, main, now) -> rows [{ section, checked, failed, stats, examples }]
 *     core = shared/pitch-worklet.js, main = shared/pitch.js, now() = ms clock
 *
 * Used by tests/pitch.html and tests/tools/run-pitch-test.js.
 */

const NOTES = { E1: 41.2034, A1: 55, C2: 65.4064, E2: 82.4069, A2: 110, C3: 130.813, D3: 146.832, G3: 195.998,
  C4: 261.626, E4: 329.628, F4: 349.228, A4: 440, B4: 493.883, C5: 523.251, D5: 587.330, E5: 659.255, G5: 783.991,
  A5: 880, C6: 1046.50, E6: 1318.51, G6: 1567.98, B6: 1975.53 };

const cents = (f, ref) => 1200 * Math.log2(f / ref);
const dbToRms = (db) => Math.pow(10, db / 20);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand) {
  const u = Math.max(1e-12, rand()), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Harmonic amplitudes of each test shape, for fundamental f.
function amps(shape, f) {
  const out = [];
  const top = shape === 'sine' ? 1 : Math.min(40, Math.floor(8000 / f));
  for (let n = 1; n <= top; n++) {
    const h = n * f;
    let a;
    if (shape === 'sine') a = 1;
    else if (shape === 'bright') a = 1 / n;
    else if (shape === 'strong2') a = [0.3, 1, 0.5, 0.25, 0.12][n - 1] || 0;
    else if (shape === 'nofund') a = n === 1 ? 0 : 1 / n;
    else {
      // 'voice': a source falling 6 dB per octave through the formants of "ah".
      const res = (F, B) => (F * F) / Math.sqrt((F * F - h * h) ** 2 + (B * h) ** 2);
      a = (1 / n) * (res(730, 90) + res(1090, 110) + 0.5 * res(2440, 170));
    }
    out.push(a);
  }
  return out;
}

// A tone of `seconds` at `rmsDb` dBFS. freq is Hz or a function of time.
function tone(sr, seconds, { freq, shape = 'sine', rmsDb = -20, seed = 1, vibratoCents = 0, vibratoHz = 5.5 }) {
  const rand = rng(seed);
  const n = Math.round(sr * seconds);
  const out = new Float32Array(n);
  const f0 = typeof freq === 'function' ? freq(0) : freq;
  const a = amps(shape, f0);
  const phase = a.map(() => rand() * 2 * Math.PI);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let f = typeof freq === 'function' ? freq(t) : freq;
    if (vibratoCents) f *= Math.pow(2, vibratoCents / 1200 * Math.sin(2 * Math.PI * vibratoHz * t));
    let s = 0;
    for (let k = 0; k < a.length; k++) {
      if (a[k]) s += a[k] * Math.sin(phase[k]);
      phase[k] += 2 * Math.PI * (k + 1) * f / sr;
    }
    out[i] = s;
  }
  return scaleTo(out, rmsDb);
}

function noise(sr, seconds, rmsDb, seed = 7, color = 'white') {
  const rand = rng(seed);
  const out = new Float32Array(Math.round(sr * seconds));
  let brown = 0;
  for (let i = 0; i < out.length; i++) {
    const w = gauss(rand);
    if (color === 'brown') { brown = 0.995 * brown + w; out[i] = brown; } else out[i] = w;
  }
  return scaleTo(out, rmsDb);
}

function scaleTo(x, rmsDb) {
  let e = 0;
  for (let i = 0; i < x.length; i++) e += x[i] * x[i];
  const k = dbToRms(rmsDb) / Math.sqrt(e / x.length || 1);
  for (let i = 0; i < x.length; i++) x[i] *= k;
  return x;
}

const concat = (...parts) => {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const mix = (a, b) => { const out = new Float32Array(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] || 0); return out; };

// Feed a signal 128 samples at a time, as the AudioWorklet does.
function run(core, sr, signal, opts = {}) {
  const frames = [];
  const stream = core.createPitchStream({ sampleRate: sr, ...opts, onFrame: (f) => frames.push(f) });
  for (let i = 0; i < signal.length; i += 128) stream.push(signal.subarray(i, Math.min(signal.length, i + 128)));
  return { frames, stream };
}

const median = (a) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const pct = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));

// Errors of a note that starts at time 0: frames in its first 50 ms (after the
// window has filled) are the onset; later ones must be steady.
function steadyErrors(frames, ref, windowSeconds) {
  const steady = [], onset = [];
  let missing = 0;
  for (const fr of frames) {
    const steadyNow = fr.time >= windowSeconds + 0.05;
    if (!fr.freq) { if (steadyNow) missing++; continue; }
    (steadyNow ? steady : onset).push(Math.abs(cents(fr.freq, ref)));
  }
  if (!steady.length) steady.push(Infinity);
  if (!onset.length) onset.push(0);
  return { steady, onset, missing };
}

export function checkPitch(core, main, now = () => Date.now()) {
  const rows = [];
  const row = (section) => { const r = { section, checked: 0, failed: 0, stats: '', examples: [] }; rows.push(r); return r; };
  const fail = (r, msg) => { r.failed++; if (r.examples.length < 6) r.examples.push(msg); };

  // 1. Sines over the whole range, in tune and off by known amounts.
  for (const sr of [48000, 44100]) {
    const r = row(`Pure tones (sines) at ${sr} Hz, E1 to B6, in tune and -23 / +17 cents off: every frame within 1 cent once the note has sounded 50 ms`);
    const errs = [], onset = [];
    for (const [name, f] of Object.entries(NOTES)) {
      for (const off of [-23, 0, 17]) {
        const ref = f * Math.pow(2, off / 1200);
        const { frames, stream } = run(core, sr, tone(sr, 0.4, { freq: ref, seed: Math.round(f) }));
        const label = `${name}${off ? (off > 0 ? '+' : '') + off : ''}`;
        r.checked++;
        const res = steadyErrors(frames, ref, stream.windowSeconds);
        errs.push(...res.steady); onset.push(...res.onset);
        if (res.missing) fail(r, `${label}: ${res.missing} frames found no note`);
        if (Math.max(...res.steady) > 1) fail(r, `${label}: off by up to ${fmt(Math.max(...res.steady))} cents`);
      }
    }
    r.stats = `steady: average error ${fmt(errs.reduce((s, e) => s + e, 0) / errs.length, 3)} cents, worst ${fmt(Math.max(...errs), 3)} cents; first 50 ms of a note: worst ${fmt(Math.max(...onset), 2)} cents`;
  }

  // 2. Harmonic tones: no octave errors, accurate.
  {
    const r = row('Harmonic tones (bright, voice-like "ah", strong 2nd harmonic, missing fundamental), E1 to C6: within 1 cent once the note has sounded 50 ms, never an octave off');
    const errs = [], onset = [];
    for (const shape of ['bright', 'voice', 'strong2', 'nofund']) {
      for (const name of ['E1', 'A1', 'E2', 'A2', 'D3', 'G3', 'C4', 'F4', 'A4', 'D5', 'G5', 'C6']) {
        const f = NOTES[name];
        const { frames, stream } = run(core, 48000, tone(48000, 0.4, { freq: f, shape, seed: 3 }));
        r.checked++;
        const res = steadyErrors(frames, f, stream.windowSeconds);
        errs.push(...res.steady); onset.push(...res.onset);
        const worst = Math.max(...res.steady, ...res.onset);
        if (res.missing) fail(r, `${shape} ${name}: ${res.missing} frames found no note`);
        if (Math.max(...res.steady) > 1 || worst > 600) fail(r, `${shape} ${name}: off by up to ${fmt(worst)} cents${worst > 600 ? ' (octave error)' : ''}`);
      }
    }
    r.stats = `steady: average error ${fmt(errs.reduce((s, e) => s + e, 0) / errs.length, 3)} cents, worst ${fmt(Math.max(...errs), 3)} cents; first 50 ms of a note: worst ${fmt(Math.max(...onset), 2)} cents`;
  }

  // 3. Voice-like tones in noise (the room noise comes first, then the note).
  {
    const r = row('Voice-like notes in white noise (1 s of noise first): at 20 and 10 dB above the noise, a note in 95% of frames, median error under 2 cents');
    const stats = [];
    for (const snr of [20, 10, 5]) {
      const errs = [];
      let voicedCount = 0, total = 0;
      for (const name of ['A2', 'C4', 'A4', 'E5']) {
        const f = NOTES[name];
        const sr = 48000;
        const sig = concat(noise(sr, 1, -40, 11), mix(tone(sr, 1, { freq: f, shape: 'voice', rmsDb: -40 + snr, seed: 5 }), noise(sr, 1, -40, 12)));
        const { frames } = run(core, sr, sig);
        const inNote = frames.filter((fr) => fr.time > 1.15);
        const voiced = inNote.filter((fr) => fr.freq > 0);
        total += inNote.length; voicedCount += voiced.length;
        voiced.forEach((fr) => errs.push(Math.abs(cents(fr.freq, f))));
        const falseBefore = frames.filter((fr) => fr.time < 1 && fr.freq > 0).length;
        r.checked++;
        if (falseBefore) fail(r, `${snr} dB ${name}: ${falseBefore} frames of noise alone were called a note`);
      }
      const share = voicedCount / total;
      stats.push(`${snr} dB: note in ${fmt(100 * share, 0)}% of frames, median ${fmt(median(errs))} cents, 95% within ${fmt(pct(errs, 0.95))} cents`);
      if (snr >= 10) {
        r.checked++;
        if (share < 0.95) fail(r, `${snr} dB: a note in only ${fmt(100 * share, 0)}% of frames`);
        if (median(errs) > 2) fail(r, `${snr} dB: median error ${fmt(median(errs))} cents`);
      }
    }
    r.stats = stats.join('; ');
  }

  // 4. Quiet notes: found down to -50 dBFS, ignored below the -54 dBFS floor.
  {
    const r = row('Quiet notes after quiet room noise (-70 dBFS): found at -30, -40, -50 dBFS; ignored at -60 dBFS');
    const stats = [];
    for (const db of [-30, -40, -50, -60]) {
      const sr = 48000;
      const sig = concat(noise(sr, 0.5, -70, 21), mix(tone(sr, 1, { freq: NOTES.G3, shape: 'voice', rmsDb: db, seed: 2 }), noise(sr, 1, -70, 22)));
      const { frames } = run(core, sr, sig);
      const inNote = frames.filter((fr) => fr.time > 0.65);
      const share = inNote.filter((fr) => fr.freq > 0).length / inNote.length;
      stats.push(`${db} dBFS: ${fmt(100 * share, 0)}%`);
      r.checked++;
      if (db > -54 && share < 0.95) fail(r, `${db} dBFS: a note in only ${fmt(100 * share, 0)}% of frames`);
      if (db < -54 && share > 0) fail(r, `${db} dBFS: a note in ${fmt(100 * share, 0)}% of frames (should be silence)`);
    }
    r.stats = 'frames with a note: ' + stats.join(', ');
  }

  // 4b. Loud noise stops while a softer note goes on (a fan switched off mid-note).
  {
    const r = row('Loud noise (-25 dBFS) that stops while a softer note (-32 dBFS) goes on: the note shows within 1.5 s and stays');
    const sr = 48000;
    const note = tone(sr, 4, { freq: NOTES.C4, shape: 'voice', rmsDb: -32, seed: 9 });
    const loud = concat(noise(sr, 1.5, -25, 51), new Float32Array(sr * 2.5));
    const { frames } = run(core, sr, mix(note, loud));
    const first = frames.find((fr) => fr.time > 1.5 && fr.freq > 0);
    const ms = first ? (first.time - 1.5) * 1000 : Infinity;
    const after = frames.filter((fr) => fr.time > 3);
    const share = after.filter((fr) => fr.freq > 0 && Math.abs(cents(fr.freq, NOTES.C4)) < 2).length / after.length;
    r.checked += 2;
    if (ms > 1500) fail(r, `the note showed ${fmt(ms, 0)} ms after the noise stopped`);
    if (share < 0.98) fail(r, `then a note in only ${fmt(100 * share, 0)}% of frames`);
    r.stats = `shown ${fmt(ms, 0)} ms after the noise stopped, then in ${fmt(100 * share, 0)}% of frames`;
  }

  // 5. No note at all: silence and noise must never show a note.
  {
    const r = row('Silence and noise with no note (digital silence; white noise at -60, -40, -20 dBFS; rumbling brown noise): never a note');
    const sr = 48000;
    const cases = [
      ['silence', new Float32Array(sr * 2)],
      ['white -60', noise(sr, 3, -60, 31)], ['white -40', noise(sr, 3, -40, 32)], ['white -20', noise(sr, 3, -20, 33)],
      ['brown -30', noise(sr, 3, -30, 34, 'brown')], ['brown -15', noise(sr, 3, -15, 35, 'brown')],
    ];
    let frames = 0;
    for (const [name, sig] of cases) {
      for (const minFreq of [40, 55]) {
        const out = run(core, sr, sig, { minFreq }).frames;
        frames += out.length;
        const bad = out.filter((fr) => fr.freq > 0);
        r.checked++;
        if (bad.length) fail(r, `${name} (min ${minFreq} Hz): ${bad.length} frames called a note, e.g. ${fmt(bad[0].freq, 1)} Hz`);
      }
    }
    r.stats = `${frames} frames of silence and noise`;
  }

  // 6. How fast a note is found, after quiet room noise.
  {
    const r = row('How fast a note is found (voice-like, -25 dBFS, after quiet room noise): under 120 ms');
    const stats = [];
    for (const minFreq of [40, 55]) {
      const times = [];
      for (const name of ['E2', 'A2', 'C4', 'A4', 'A5']) {
        const f = NOTES[name];
        const sr = 48000;
        const sig = concat(noise(sr, 0.5, -65, 41), mix(tone(sr, 0.6, { freq: f, shape: 'voice', rmsDb: -25, seed: 4 }), noise(sr, 0.6, -65, 42)));
        const { frames } = run(core, sr, sig, { minFreq });
        const first = frames.find((fr) => fr.time > 0.5 && fr.freq > 0 && Math.abs(cents(fr.freq, f)) <= 10);
        const ms = first ? (first.time - 0.5) * 1000 : Infinity;
        times.push(`${name} ${fmt(ms, 0)}`);
        r.checked++;
        if (ms > 120) fail(r, `${name} (min ${minFreq} Hz): found after ${fmt(ms, 0)} ms`);
        const wrong = frames.filter((fr) => fr.freq > 0 && Math.abs(cents(fr.freq, f)) > 10);
        if (wrong.length) fail(r, `${name} (min ${minFreq} Hz): ${wrong.length} frames showed a wrong note, e.g. ${fmt(wrong[0].freq, 1)} Hz`);
      }
      stats.push(`lowest note ${minFreq} Hz (window ${fmt(run(core, 48000, new Float32Array(0), { minFreq }).stream.windowSeconds * 1000, 0)} ms): ${times.join(', ')} ms`);
    }
    r.stats = stats.join('; ');
  }

  // 7. Changing note without a gap (legato), and vibrato.
  {
    const r = row('Legato note change A4 to B4: the new note shows within 80 ms; vibrato (A4 ±40 cents, 5.5 per second) is followed and never lost');
    const sr = 48000;
    const sig = concat(tone(sr, 0.5, { freq: (t) => (t < 0.25 ? NOTES.A4 : NOTES.B4), shape: 'voice', rmsDb: -25, seed: 6 }));
    const { frames } = run(core, sr, sig);
    const after = frames.find((fr) => fr.time > 0.25 && fr.freq > 0 && Math.abs(cents(fr.freq, NOTES.B4)) <= 10);
    const ms = after ? (after.time - 0.25) * 1000 : Infinity;
    r.checked++;
    if (ms > 80) fail(r, `B4 shown after ${fmt(ms, 0)} ms`);
    const v = run(core, sr, tone(sr, 2, { freq: NOTES.A4, shape: 'voice', rmsDb: -25, vibratoCents: 40, seed: 8 })).frames;
    const vv = v.filter((fr) => fr.freq > 0);
    const errs = vv.map((fr) => {
      // The window is centred about half a window before the frame's time.
      const tc = fr.time - 0.5 * 2.5 / 40;
      const expect = NOTES.A4 * Math.pow(2, 40 / 1200 * Math.sin(2 * Math.PI * 5.5 * tc));
      return Math.abs(cents(fr.freq, expect));
    });
    const mean = vv.reduce((s, fr) => s + cents(fr.freq, NOTES.A4), 0) / vv.length;
    r.checked++;
    if (vv.length < v.length - 2) fail(r, `vibrato lost in ${v.length - vv.length} frames`);
    if (Math.abs(mean) > 3) fail(r, `vibrato average ${fmt(mean)} cents from A4`);
    r.stats = `B4 shown after ${fmt(ms, 0)} ms; vibrato: average ${fmt(mean)} cents from A4, follows the wave within ${fmt(pct(errs, 0.95), 1)} cents (95%)`;
  }

  // 8. The display smoother.
  {
    const r = row('Display smoother: calm settles in about a quarter second, quick in under 0.1 s; a single octave glitch is ignored; a new note shows at once; silence clears after the hold');
    const stepTime = (speed) => {
      const s = main.createPitchSmoother({ speed });
      let t = 0, settled = null;
      for (; t < 1; t += 0.02) s.push({ time: t, freq: 440, clarity: 0.95 });
      const target = 440 * Math.pow(2, 25 / 1200);
      for (; t < 2; t += 0.02) {
        const out = s.push({ time: t, freq: target, clarity: 0.95 });
        if (settled === null && out && Math.abs(cents(out.freq, target)) <= 1) settled = t - 1;
      }
      return settled;
    };
    const calm = stepTime('calm'), quick = stepTime('quick');
    r.checked += 2;
    if (!(calm > 0.15 && calm < 0.35)) fail(r, `calm took ${fmt(calm)} s to come within 1 cent of a 25-cent step`);
    if (!(quick < 0.1)) fail(r, `quick took ${fmt(quick)} s`);

    const s = main.createPitchSmoother({ speed: 'calm' });
    let t = 0, worst = 0;
    for (; t < 1; t += 0.02) {
      const out = s.push({ time: t, freq: Math.abs(t - 0.5) < 0.01 ? 880 : 440, clarity: 0.9 });
      if (out) worst = Math.max(worst, Math.abs(cents(out.freq, 440)));
    }
    r.checked++;
    if (worst > 1) fail(r, `one 880 Hz frame moved the calm display by ${fmt(worst)} cents`);
    let jump = null;
    for (; t < 1.5; t += 0.02) {
      const out = s.push({ time: t, freq: NOTES.C5, clarity: 0.9 });
      if (jump === null && out && Math.abs(cents(out.freq, NOTES.C5)) <= 1) jump = t - 1;
    }
    r.checked++;
    if (!(jump <= 0.06)) fail(r, `a new note (A4 to C5) took ${fmt(jump)} s to show`);
    let cleared = null;
    for (; t < 2.5; t += 0.02) {
      const out = s.push({ time: t, freq: 0, clarity: 0 });
      if (cleared === null && out === null) cleared = t - 1.5;
    }
    r.checked++;
    if (!(cleared >= 0.24 && cleared <= 0.3)) fail(r, `silence cleared the display after ${fmt(cleared)} s (hold 0.25 s)`);
    r.stats = `calm ${fmt(calm)} s, quick ${fmt(quick)} s, new note ${fmt(jump)} s, cleared after ${fmt(cleared)} s of silence`;
  }

  // 9. Note names.
  {
    const r = row('nearestNote: MIDI number and cents, A = 440 or 442, and a border pitch keeps its note');
    const cases = [
      [[440], 69, 0], [[466.164], 70, 0], [[452], 69, 46.6], [[261.626], 60, 0], [[27.5], 21, 0],
      [[442, 442], 69, 0], [[440, 442], 69, -7.85],
      [[440 * Math.pow(2, 55 / 1200), 440, 69], 69, 55], [[440 * Math.pow(2, 55 / 1200)], 70, -45],
      [[440 * Math.pow(2, 60 / 1200), 440, 69], 70, -40],
    ];
    for (const [args, midi, c] of cases) {
      const out = main.nearestNote(...args);
      r.checked++;
      if (out.midi !== midi || Math.abs(out.cents - c) > 0.1) fail(r, `nearestNote(${args.map((a) => fmt(a, 3)).join(', ')}) = ${out.midi} ${fmt(out.cents)}, expected ${midi} ${c}`);
    }
  }

  // 10. Speed: the share of one processor core the detector needs in real time.
  {
    const r = row('Speed: the detector needs under 10% of one processor core in real time');
    const sr = 48000;
    const sig = tone(sr, 3, { freq: NOTES.A2, shape: 'voice', rmsDb: -25 });
    const stats = [];
    for (const minFreq of [40, 55]) {
      run(core, sr, sig.subarray(0, sr), { minFreq });   // warm up the JIT
      const t0 = now();
      const { frames } = run(core, sr, sig, { minFreq });
      const ms = now() - t0;
      const load = ms / 3000;
      stats.push(`min ${minFreq} Hz: ${fmt(ms / frames.length, 3)} ms per frame, ${fmt(100 * load, 1)}% of a core`);
      r.checked++;
      if (load > 0.1) fail(r, `min ${minFreq} Hz: ${fmt(100 * load, 1)}% of a core`);
    }
    r.stats = stats.join('; ');
  }

  return rows;
}

export const TEST_SIGNALS = { NOTES, tone, noise, concat, mix, cents };
