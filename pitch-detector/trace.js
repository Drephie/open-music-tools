/* pitch-detector/trace.js: the line of the voice over time, and the names on
 * the piano keys (spec: specs/pitch-detector.md). Pure: no DOM, no Web Audio.
 * Tested by tests/pitch-detector.html and tests/tools/run-pitch-detector-test.js.
 *
 *   createTrace({ seconds = 120, rate = 50 })
 *     The last `seconds` of pitch, about `rate` points a second (a frame every 20 ms).
 *     .push(time, midi)  time in seconds on any steady clock, rising; midi with a
 *                        fraction (69.12 = A4 + 12 cents), or NaN for no note
 *                        (silence, paused, a piano note playing). A single
 *                        point more than a half step away from both of its
 *                        neighbours, while they agree, is a glitch: it becomes
 *                        their mean. So each point appears one frame late.
 *     .break(time)       a break in the line (same as push(time, NaN))
 *     .size, .oldest, .newest   point count and the first and last times (NaN when empty)
 *     .forEach(t0, t1, fn)      fn(time, midi) for the points from t0 to t1, oldest
 *                               first, with one point either side so a line
 *                               can be drawn to the edges
 *     .average(t0, t1)          the mean pitch of the notes between t0 and t1, or NaN
 *     .clear()
 *
 *   laneNames(key, solfege)  -> 12 names by pitch class (0 = C), null where a lane
 *     has no name. key: 'none' (the white keys: C D E F G A B or Do Re Mi) or a
 *     shared/theory.js key ('<root>_maj' / '<root>_min'): its scale's notes,
 *     spelled as the key spells them ('Bb' in F major, 'A#' in B major).
 *     Names use ASCII # and b (shared/ui/accidentals.js draws them).
 *   KEY_CHOICES  ['none', '0_maj', ..., '11_maj', '0_min', ..., '11_min']
 *   keyLabel(value, solfege) -> { root, type } ('Bb', 'maj') for the list, or null for 'none'
 */
import { parseKey, keyRootName, tonicLetterIdx, spellOnLetter, MAJOR_SCALE_STEPS, MINOR_SCALE_STEPS, LETTER_PC, LETTERS, SOLFEGE_OF } from '../shared/theory.js';

export function createTrace({ seconds = 120, rate = 50 } = {}) {
  const cap = Math.ceil(seconds * rate * 1.25) + 8;
  const times = new Float64Array(cap), pitch = new Float32Array(cap);
  let start = 0, size = 0;
  let pend = null, prev = NaN;   // the point waiting one frame, and the one before it

  function store(t, m) {
    if (size === cap) { start = (start + 1) % cap; size--; }
    const i = (start + size) % cap;
    times[i] = t; pitch[i] = m;
    size++;
    // Forget what is older than `seconds`.
    while (size > 1 && times[start] < t - seconds) { start = (start + 1) % cap; size--; }
  }

  function push(t, m) {
    if (pend) {
      let v = pend.m;
      // A lone glitch: far from both neighbours, which agree with each other.
      if (!Number.isNaN(v) && !Number.isNaN(prev) && !Number.isNaN(m) &&
          Math.abs(v - prev) > 0.5 && Math.abs(v - m) > 0.5 && Math.abs(prev - m) <= 0.5) v = (prev + m) / 2;
      store(pend.t, v);
      prev = pend.m;
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

  return {
    push,
    break: (t) => push(t, NaN),
    forEach,
    average,
    get size() { return size; },
    get oldest() { return size ? times[start] : NaN; },
    get newest() { return size ? times[at(size - 1)] : NaN; },
    clear() { start = size = 0; pend = null; prev = NaN; },
  };
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
