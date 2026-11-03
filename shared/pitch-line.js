/* shared/pitch-line.js: the line of the voice over time, and the names on
 * the piano keys, for the tools that draw a voice on a graph (the Pitch
 * Detector, Pitch Training; specs/pitch-detector.md). Moved from
 * pitch-detector/trace.js for Pitch Training. Pure: no DOM, no Web Audio.
 * Tested by tests/pitch-detector.html and tests/tools/run-pitch-detector-test.js.
 *
 *   createTrace({ seconds = 120, rate = 50 })
 *     The last `seconds` of pitch, about `rate` points a second (a frame every 20 ms).
 *     .push(time, midi)  time in seconds on any steady clock, rising; midi with a
 *                        fraction (69.12 = A4 + 12 cents), or NaN for no note
 *                        (silence, paused, a piano note playing). A point
 *                        more than 2.5 half steps from both the last point
 *                        kept and the next one is a stray (a frame or two at
 *                        a sudden note change, a lone octave glitch): it
 *                        becomes the last point kept, so a note change draws
 *                        as a clean step. Slides, scoops and vibrato move less
 *                        than that between frames. Each point appears one
 *                        frame late.
 *                        Octave slips: within a phrase, a point within 3/4 of a
 *                        half step of an octave (or two) from the recent line is
 *                        drawn in the line's octave; if it stays more than half
 *                        a second it was a real leap, and those points are
 *                        redrawn where they were sung (and the phrase's start
 *                        too, when it was shorter: then the start was the slip).
 *     .break(time)       a break in the line (same as push(time, NaN))
 *     .size, .oldest, .newest   point count and the first and last times (NaN when empty)
 *     .latest            the newest point's pitch (NaN in a break): the octave the line is in
 *     .forEach(t0, t1, fn)      fn(time, midi) for the points from t0 to t1, oldest
 *                               first, with one point either side so a line
 *                               can be drawn to the edges
 *     .average(t0, t1)          the mean pitch of the notes between t0 and t1, or NaN
 *     .extent(t0, t1)           { min, max } pitch of the notes between t0 and t1, or null
 *     .clear()
 *
 *   SENSITIVITY  { low, normal, high }: the quietest sound (dBFS: the loudness of a
 *     frame's rms, 0 is full scale) that counts as singing. Low is for noisy
 *     places (sing close to the phone); high draws whatever the pitch engine
 *     hears (its own floor is -54 dBFS).
 *   createLoudnessGate()
 *     .next(freq, rms, minDb) -> freq, or 0 when the sound is quieter than minDb.
 *     A note that has started keeps going down to KEEP_DB under minDb, so its
 *     fading end isn't cut. .reset()
 *   levelDb(rms)  the loudness in dBFS (-Infinity for silence)
 *
 *   fitView(min, max, { minSpan = 7, lowest = 33, highest = 95 })
 *     -> { low, high }: the graph's bottom and top (MIDI) for notes from min to
 *     max (Drephie: the lowest and highest notes on screen, with a margin, set
 *     the view, so a two-octave jump still fits whole and a narrow phrase gets
 *     the most detail). The margin is 1.5 half steps or a tenth of the range,
 *     whichever is more; the view is at least minSpan half steps and stays
 *     within lowest..highest (plus the margin) where it can.
 *
 *   laneNames(key, solfege)  -> 12 names by pitch class (0 = C), null where a lane
 *     has no name. key: 'none' (the white keys: C D E F G A B or Do Re Mi) or a
 *     shared/theory.js key ('<root>_maj' / '<root>_min'): its scale's notes,
 *     spelled as the key spells them ('Bb' in F major, 'A#' in B major).
 *     Names use ASCII # and b (shared/ui/accidentals.js draws them).
 *   KEY_CHOICES  ['none', '0_maj', ..., '11_maj', '0_min', ..., '11_min']
 *   keyLabel(value, solfege) -> { root, type } ('Bb', 'maj') for the list, or null for 'none'
 */
import { parseKey, keyRootName, tonicLetterIdx, spellOnLetter, MAJOR_SCALE_STEPS, MINOR_SCALE_STEPS, LETTER_PC, LETTERS, SOLFEGE_OF } from './theory.js';

const JUMP = 2.5;          // half steps between neighbouring points that still count as one movement
const OCTAVE_NEAR = 0.75;  // half steps: a point this near an octave from the line is an octave slip...
const OCTAVE_HOLD = 0.5;   // ...unless it stays this many seconds (then it was a real leap)

export function createTrace({ seconds = 120, rate = 50 } = {}) {
  const cap = Math.ceil(seconds * rate * 1.25) + 8;
  const times = new Float64Array(cap), pitch = new Float32Array(cap);
  let start = 0, size = 0;
  let pend = null, kept = NaN;   // the point waiting one frame, and the last point kept

  let total = 0;                 // points stored so far: point n sits at ring index posOf(n)
  function store(t, m) {
    if (size === cap) { start = (start + 1) % cap; size--; }
    const i = (start + size) % cap;
    times[i] = t; pitch[i] = m;
    size++;
    total++;
    // Forget what is older than `seconds`.
    while (size > 1 && times[start] < t - seconds) { start = (start + 1) % cap; size--; }
  }
  const posOf = (n) => (n < total - size ? -1 : (start + n - (total - size)) % cap);

  // The octave guard. A voice can't jump exactly an octave in one frame and
  // stay there by accident, but a detector can read a held note an octave off
  // for a moment. Within a phrase, a point within OCTAVE_NEAR of an octave (or
  // two) from the recent line is read as that slip and drawn in the line's
  // octave. If it stays more than OCTAVE_HOLD seconds, it was a real leap: those
  // points are redrawn where they were sung, and if the phrase so far was
  // shorter than the leap, its start is moved too (the start was the slip).
  // Slides and scoops between octaves pass through other pitches, so they are
  // drawn as they happen.
  let recent = [], run = [], runK = 0, phraseStart = 0;
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  function keep(t, m) {
    if (Number.isNaN(m)) { recent = []; run = []; store(t, m); phraseStart = total; return; }
    if (!recent.length) phraseStart = total;
    const d = m - (recent.length ? median(recent) : m), k = Math.round(d / 12);
    let out = m;
    if (k !== 0 && Math.abs(d - 12 * k) < OCTAVE_NEAR) {
      if (run.length && k !== runK) run = [];
      runK = k;
      out = m - 12 * k;
      run.push({ n: total, t, raw: m });
    } else run = [];
    store(t, out);
    recent.push(out);
    if (recent.length > 9) recent.shift();
    if (run.length && t - run[0].t >= OCTAVE_HOLD) {
      for (const p of run) { const i = posOf(p.n); if (i >= 0) pitch[i] = p.raw; }
      if (run[0].n - phraseStart < run.length) {
        for (let n = phraseStart; n < run[0].n; n++) { const i = posOf(n); if (i >= 0 && !Number.isNaN(pitch[i])) pitch[i] += 12 * runK; }
      }
      recent = run.slice(-9).map((p) => p.raw);
      run = [];
    }
  }

  // A point is kept when it is near the last point kept or the next one: a
  // voice moves on smoothly or lands on a new note and stays. Strays that are
  // near neither (often a frame or two at a sudden note change, or a lone
  // octave glitch) become the last point kept, so the line steps cleanly.
  const near = (a, b) => !Number.isNaN(a) && Math.abs(a - b) <= JUMP;
  function push(t, m) {
    if (pend) {
      const v = pend.m;
      const out = Number.isNaN(v) || near(kept, v) || near(m, v) ? v : kept;
      keep(pend.t, out);
      kept = out;
    }
    pend = { t, m };
  }

  const at = (k) => (start + k) % cap;
  function forEach(t0, t1, fn) {
    if (!size) return;
    let lo = 0, hi = size - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (times[at(mid)] < t0) lo = mid + 1; else hi = mid; }
    for (let k = Math.max(0, lo - 1); k < size; k++) {
      const i = at(k);
      fn(times[i], pitch[i]);
      if (times[i] > t1) break;
    }
  }

  function average(t0, t1) {
    let sum = 0, n = 0;
    forEach(t0, t1, (t, m) => { if (t >= t0 && t <= t1 && !Number.isNaN(m)) { sum += m; n++; } });
    return n ? sum / n : NaN;
  }

  function extent(t0, t1) {
    let min = Infinity, max = -Infinity;
    forEach(t0, t1, (t, m) => { if (t >= t0 && t <= t1 && !Number.isNaN(m)) { if (m < min) min = m; if (m > max) max = m; } });
    return min <= max ? { min, max } : null;
  }

  return {
    push,
    break: (t) => push(t, NaN),
    forEach,
    average,
    extent,
    get size() { return size; },
    get oldest() { return size ? times[start] : NaN; },
    get newest() { return size ? times[at(size - 1)] : NaN; },
    get latest() { return size ? pitch[at(size - 1)] : NaN; },
    clear() { start = size = total = 0; pend = null; kept = NaN; recent = []; run = []; },
  };
}

export const SENSITIVITY = { low: -38, normal: -48, high: -Infinity };
const KEEP_DB = 6;
export const levelDb = (rms) => (rms > 0 ? 20 * Math.log10(rms) : -Infinity);

export function createLoudnessGate() {
  let on = false;
  return {
    next(freq, rms, minDb) {
      const db = levelDb(rms);
      on = freq > 0 && rms > 0 && (db >= minDb || (on && db >= minDb - KEEP_DB));
      return on ? freq : 0;
    },
    reset() { on = false; },
  };
}

export function fitView(min, max, { minSpan = 7, lowest = 33, highest = 95 } = {}) {
  const margin = Math.max(1.5, (max - min) * 0.1);
  let low = min - margin, high = max + margin;
  if (high - low < minSpan) {
    const mid = (low + high) / 2;
    low = mid - minSpan / 2;
    high = mid + minSpan / 2;
  }
  // Slide back inside the range of notes the tool shows, keeping the span.
  const floor = lowest - 1.5, ceil = highest + 1.5;
  if (low < floor) { high += floor - low; low = floor; }
  if (high > ceil) { low -= high - ceil; high = ceil; }
  return { low: Math.max(low, floor), high };
}

export const KEY_CHOICES = ['none', ...Array.from({ length: 12 }, (_, r) => `${r}_maj`), ...Array.from({ length: 12 }, (_, r) => `${r}_min`)];

export function keyLabel(value, solfege) {
  if (!value || value === 'none') return null;
  const k = parseKey(value);
  return { root: keyRootName(k.rootIdx, k.scaleType, solfege), type: k.scaleType };
}

export function laneNames(key, solfege) {
  const names = new Array(12).fill(null);
  if (!key || key === 'none') {
    LETTERS.forEach((l, i) => { names[LETTER_PC[i]] = solfege ? SOLFEGE_OF[l] : l; });
    return names;
  }
  const k = parseKey(key);
  const steps = k.scaleType === 'min' ? MINOR_SCALE_STEPS : MAJOR_SCALE_STEPS;
  const tonic = tonicLetterIdx(k.rootIdx, k.scaleType);
  steps.forEach((s, i) => {
    const pc = (k.rootIdx + s) % 12;
    names[pc] = spellOnLetter(tonic + i, pc, solfege);
  });
  return names;
}
