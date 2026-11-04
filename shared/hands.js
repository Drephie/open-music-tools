/* shared/hands.js: reading fingers from MediaPipe hand points (Chordigits).
 * Pure functions: no DOM, no camera.
 *
 * Points: the 21 { x, y, z } of one hand from MediaPipe's HandLandmarker
 * `worldLandmarks` (metres, the same scale on every axis, so turning the
 * hand, its distance and the picture's shape change nothing; the picture
 * `landmarks` use different x and y scales). 0 wrist; thumb 1-4;
 * index 5-8; middle 9-12; ring 13-16; little 17-20 (base knuckle, middle
 * joint, last joint, tip).
 *
 *   readFingers(points, prev) -> { thumb, index, middle, ring, little }
 *     true = raised. prev (the last reading of this hand) gives each finger
 *     a margin before it flips, so a half-bent finger doesn't flicker.
 *     A finger is raised when its tip is clearly farther from the wrist than
 *     its middle joint. The thumb is raised when its tip reaches past the
 *     index knuckle, sideways (open hand, 🤙) or up (thumbs-up).
 *   countFingers(fingers) -> 0..5  the thumb counts only with two or more
 *     other fingers (thumb + 2 = 3, open hand = 5): a thumb that pops out
 *     beside one finger, or a fist, was misread too often (Drephie's test).
 *   chordNumber(fingers, points, sixSeven = 'rock') -> 0..7  the number hand
 *     1-5 = countFingers; 0 = fist.
 *     'rock': 🤙 (thumb and little only) = 6; 🤘 (index and little, middle and
 *     ring down, thumb either way) = 7.
 *     'asl' (American Sign Language): thumb touching the little finger's tip
 *     with index, middle, ring up = 6; thumb touching the ring finger's tip
 *     with index, middle, little up = 7.
 *   handTilt(points, prev = 0) -> 1 | 0 | -1  the hand's sideways lean from
 *     upright (wrist to middle knuckle; leaning towards the camera doesn't
 *     count): 1 = fingers towards the picture's +x side (the person's left,
 *     facing the camera), -1 the other way. Past 35° counts as leaning, back
 *     under 20° as upright again.
 *   heightBand(y, prev = 0) -> 1 | 0 | -1  where a hand is up the picture:
 *     y is the picture `landmarks` y (0 top, 1 bottom) of the middle knuckle;
 *     top third 1, bottom third -1, with a margin before it changes back.
 *   createSteady({ holdMs = 200, stopMs = 120, lostMs = 250 })
 *     -> { update(reading, nowMs) -> steady, reset(), value }
 *     A reading (a number, or null for no hand) becomes the steady value
 *     once it has stayed the same for holdMs (stopMs for 0, a fist). A hand
 *     out of view turns null only after lostMs, so a dropped camera frame
 *     doesn't stop a chord.
 *
 * Tests: tests/hands.html (tests/hands-cases.js), also from the terminal.
 */

const FINGERS = { index: [5, 6, 8], middle: [9, 10, 12], ring: [13, 14, 16], little: [17, 18, 20] };
// Tip-to-wrist / middle-joint-to-wrist: straight about 1.3, relaxed 1.24,
// half-bent 1.02, curled 0.6-0.8.
const RAISE = 1.15, LOWER = 1.08;
// Thumb tip past the index knuckle, in palm lengths, [to raise, to lower]:
// sideways (open hand), or up (thumbs-up only reaches about 0.2 above it).
const THUMB_SIDE = [0.25, 0.15], THUMB_UP = [0.15, 0.08];
const TOUCH = 0.35;                         // thumb tip to finger tip, in palm lengths

const sub = (a, b) => [a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dist = (a, b) => len(sub(a, b));

export function readFingers(p, prev = null) {
  const out = {};
  for (const [name, [, mid, tip]] of Object.entries(FINGERS)) {
    const r = dist(p[tip], p[0]) / (dist(p[mid], p[0]) || 1e-9);
    out[name] = r > (prev && prev[name] ? LOWER : RAISE);
  }
  // Hand frame: up = wrist to middle knuckle; side = little to index knuckle,
  // made square to up (points to the thumb's side on either hand, palm or back).
  const palm = dist(p[9], p[0]) || 1e-9;
  const up = sub(p[9], p[0]).map((v) => v / palm);
  let side = sub(p[5], p[17]);
  const k = dot(side, up);
  side = side.map((v, i) => v - k * up[i]);
  const sl = len(side) || 1e-9;
  side = side.map((v) => v / sl);
  const t = sub(p[4], p[5]);
  const i = prev && prev.thumb ? 1 : 0;
  out.thumb = dot(t, side) / palm > THUMB_SIDE[i] || dot(t, up) / palm > THUMB_UP[i];
  return out;
}

export function countFingers(f) {
  const n = f.index + f.middle + f.ring + f.little;
  return n >= 2 ? n + f.thumb : n;
}

export function chordNumber(f, p, sixSeven = 'rock') {
  if (sixSeven === 'asl') {
    const touch = (tip) => dist(p[4], p[tip]) / (dist(p[9], p[0]) || 1e-9) < TOUCH;
    if (!f.thumb && f.index && f.middle && f.ring && !f.little && touch(20)) return 6;
    if (!f.thumb && f.index && f.middle && !f.ring && f.little && touch(16)) return 7;
  } else {
    if (f.thumb && f.little && !f.index && !f.middle && !f.ring) return 6;
    if (f.index && f.little && !f.middle && !f.ring) return 7;
  }
  return countFingers(f);
}

export function handTilt(p, prev = 0) {
  const [dx, dy, dz] = sub(p[9], p[0]);
  // Sideways lean only: leaning towards the camera (y into z) doesn't count.
  const deg = Math.atan2(dx, Math.hypot(dy, dz)) * 180 / Math.PI;
  return Math.abs(deg) > (Math.sign(deg) === prev ? 20 : 35) ? Math.sign(deg) : 0;
}

export function heightBand(y, prev = 0) {
  if (y < (prev === 1 ? 0.36 : 0.3)) return 1;
  if (y > (prev === -1 ? 0.64 : 0.7)) return -1;
  return 0;
}

export function createSteady({ holdMs = 200, stopMs = 120, lostMs = 250 } = {}) {
  let value = null, pending, since = 0, seen = -Infinity;
  return {
    update(reading, now) {
      if (reading == null) {
        pending = undefined;
        if (value != null && now - seen >= lostMs) value = null;
        return value;
      }
      seen = now;
      if (reading === value) { pending = undefined; return value; }
      if (reading !== pending) { pending = reading; since = now; }
      if (now - since >= (reading === 0 ? stopMs : holdMs)) { value = reading; pending = undefined; }
      return value;
    },
    reset() { value = null; pending = undefined; seen = -Infinity; },
    get value() { return value; },
  };
}
