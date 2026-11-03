/* pitch-training/score.js: how a round was sung (spec: specs/pitch-training.md).
 * Only the pitch is scored, never the timing. Pure: no DOM, no Web Audio.
 * Tested by tests/pitch-training.html and tests/tools/run-pitch-training-test.js.
 *
 * Points are [[t, midi], …] in time order: t in seconds on the round's clock
 * (0 = when the first note is to be sung), midi with a fraction, NaN for no
 * note (a breath, silence). They come from the voice's line
 * (shared/pitch-line.js), so strays and octave slips are already taken out.
 * Parts are exercises.js buildRound parts: { m0, m1, t0, t1 }.
 *
 *   TOLERANCE  { normal: 25, precise: 10 }  cents either side that count as in tune
 *   IN_SHARE = 0.6  a note is in tune when this share of it was
 *   CLOSE = 50      cents: a note sung this near (its middle) is close
 *   LATE = 0.25, EARLY = 0.1  seconds a note may be sung late or early and still count
 *   SMOOTH = 0.1    seconds either side averaged, so a vibrato counts by its middle
 *
 *   targetAt(part, t)  the pitch to sing at t (a slide moves straight from m0 to m1)
 *   octaveShift(parts, points) -> k  the singer is k octaves off the notes (a tenor
 *     following a soprano's notes: -1); any octave counts. 0 when unsure.
 *   judgePart(part, points, tol) -> { state, cents, share, shift }
 *     points already moved to the notes' octave and smoothed (see prepare).
 *     The first moment of the note (0.12 s, or a fifth of a short one: the time
 *     to land on it) is left out; the note may be sung up to LATE late or EARLY
 *     early (the best fit counts); on a slide a moment's lead or lag is fine too.
 *     state 'in'     at least IN_SHARE of it within tol
 *           'close'  not in tune, but its middle within CLOSE
 *           'off'    sung, further away
 *           'none'   hardly heard (under a fifth of it)
 *     cents  the median of how far it was (− low, + high), NaN when not heard
 *     share  0..1, shift  the timing that fitted best (s, + late)
 *   prepare(parts, points) -> { octave, points }  folded into the notes' octave and smoothed
 *   fillOf(part, points, tol) -> [[ta, tb], …]  stretches sung in tune, to draw as
 *     they are sung (points from prepare; no timing allowance)
 *   judgeRound(parts, points, tol) -> { results, good, total, octave, tip }
 *     results: one judgePart per part; good: how many are 'in'
 *     tip: { kind, part, dir, far }  one kind tip for the round:
 *       'all'      every note in tune
 *       'nothing'  nothing heard
 *       'quiet'    the notes heard were in tune, some weren't heard
 *       'one'      one note to work on: part (its index), dir 'low' | 'high',
 *                  far (true when more than CLOSE away)
 *       'most'     most notes to work on lean one way: dir
 *       'mixed'    some low, some high
 */
export const TOLERANCE = { normal: 25, precise: 10 };
export const IN_SHARE = 0.6, CLOSE = 50, LATE = 0.25, EARLY = 0.1, SMOOTH = 0.1;
const STEP = 0.02;   // seconds between points (a frame every 20 ms)
const LAND = 0.12;
const GLIDE_SLACK = 0.25;

export function targetAt(p, t) {
  if (p.m0 === p.m1) return p.m0;
  const f = Math.min(1, Math.max(0, (t - p.t0) / (p.t1 - p.t0)));
  return p.m0 + (p.m1 - p.m0) * f;
}

const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

export function octaveShift(parts, points) {
  const votes = new Map();
  let n = 0;
  for (const [t, m] of points) {
    if (Number.isNaN(m)) continue;
    const p = parts.find((q) => t >= q.t0 + 0.05 && t < q.t1 + 0.1);
    if (!p) continue;
    const d = m - targetAt(p, t), k = Math.round(d / 12);
    if (Math.abs(d - 12 * k) > 2) continue;
    votes.set(k, (votes.get(k) || 0) + 1);
    n++;
  }
  if (n < 10) return 0;
  let best = 0, most = 0;
  for (const [k, v] of votes) if (v > most) { most = v; best = k; }
  return most >= 0.6 * n ? best : 0;
}

// Folded into the notes' octave, then averaged over SMOOTH either side within
// each stretch of singing (not across breaths).
export function prepare(parts, points) {
  const octave = octaveShift(parts, points);
  const raw = points.map(([t, m]) => [t, m - 12 * octave]);
  const out = new Array(raw.length);
  let lo = 0, hi = 0, sum = 0, cnt = 0, runStart = 0;
  for (let i = 0; i < raw.length; i++) {
    const [t, m] = raw[i];
    if (Number.isNaN(m)) { out[i] = [t, NaN]; runStart = i + 1; continue; }
    // The stretch of singing around i: from runStart to the next break.
    if (lo < runStart) { lo = hi = runStart; sum = cnt = 0; }
    while (hi < raw.length && !Number.isNaN(raw[hi][1]) && raw[hi][0] <= t + SMOOTH + 1e-9) { sum += raw[hi][1]; cnt++; hi++; }
    while (raw[lo][0] < t - SMOOTH - 1e-9) { sum -= raw[lo][1]; cnt--; lo++; }
    out[i] = [t, sum / cnt];
  }
  return { octave, points: out };
}

function inTune(p, t, shift, m, tol) {
  const tau = t - shift;
  let lo, hi;
  if (p.m0 === p.m1) lo = hi = p.m0;
  else {
    const a = targetAt(p, Math.max(p.t0, tau - GLIDE_SLACK)), b = targetAt(p, Math.min(p.t1, tau + GLIDE_SLACK));
    lo = Math.min(a, b); hi = Math.max(a, b);
  }
  return m >= lo - tol / 100 && m <= hi + tol / 100;
}

export function judgePart(p, points, tol) {
  const land = Math.min(LAND, (p.t1 - p.t0) * 0.2);
  const expected = Math.max(1, (p.t1 - p.t0 - land) / STEP);
  let best = null;
  for (let s = -EARLY; s <= LATE + 1e-9; s += STEP) {
    const a = p.t0 + land + s, b = p.t1 + s;
    let good = 0, heard = 0;
    const cents = [];
    for (const [t, m] of points) {
      if (t < a - 1e-9) continue;
      if (t >= b - 1e-9) break;
      if (Number.isNaN(m)) continue;
      heard++;
      if (inTune(p, t, s, m, tol)) good++;
      cents.push((m - targetAt(p, t - s)) * 100);
    }
    const share = Math.min(1, good / expected);
    // The best fit wins; among equal ones, the timing nearest the beat (so a
    // note left out doesn't borrow the next one).
    if (!best || share > best.share + 1e-9 || (Math.abs(share - best.share) <= 1e-9 && Math.abs(s) < Math.abs(best.shift))) {
      best = { share, heard, shift: s, cents };
    }
  }
  const cents = median(best.cents);
  let state;
  if (best.share >= IN_SHARE) state = 'in';
  else if (best.heard < 0.2 * expected) state = 'none';
  else if (Math.abs(cents) <= CLOSE) state = 'close';
  else state = 'off';
  return { state, cents: best.heard ? cents : NaN, share: best.share, shift: Math.round(best.shift * 100) / 100 };
}

export function fillOf(p, points, tol) {
  const spans = [];
  let open = null;
  for (const [t, m] of points) {
    if (t < p.t0 - 1e-9) continue;
    if (t >= p.t1) break;
    const ok = !Number.isNaN(m) && inTune(p, t, 0, m, tol);
    if (ok) { if (open) open[1] = t + STEP; else open = [t, t + STEP]; }
    else if (open) { spans.push(open); open = null; }
  }
  if (open) spans.push(open);
  return spans;
}

export function judgeRound(parts, points, tol) {
  const { octave, points: pts } = prepare(parts, points);
  const results = parts.map((p) => judgePart(p, pts, tol));
  const good = results.filter((r) => r.state === 'in').length;
  return { results, good, total: parts.length, octave, tip: tipFor(results) };
}

function tipFor(results) {
  if (results.every((r) => r.state === 'in')) return { kind: 'all' };
  if (results.every((r) => r.state === 'none')) return { kind: 'nothing' };
  const work = results.map((r, i) => ({ ...r, i })).filter((r) => r.state === 'close' || r.state === 'off');
  if (!work.length) return { kind: 'quiet' };
  if (work.length === 1) {
    const r = work[0];
    return { kind: 'one', part: r.i, dir: r.cents < 0 ? 'low' : 'high', far: Math.abs(r.cents) > CLOSE };
  }
  const low = work.filter((r) => r.cents < 0).length, high = work.length - low;
  if (low >= (2 / 3) * work.length) return { kind: 'most', dir: 'low' };
  if (high >= (2 / 3) * work.length) return { kind: 'most', dir: 'high' };
  return { kind: 'mixed' };
}
