/* tests/hands-cases.js: known-answer checks for shared/hands.js (Chordigits'
 * finger reading) and theory.js's chordNumeral. No camera: hands are made
 * here from joint angles, so each one's right answer is known, then turned,
 * tilted, mirrored (the other hand), moved, scaled and jittered the way
 * MediaPipe's world points can be.
 *
 *   checkHands(hands, theory) -> rows [{ section, checked, failed, stats, examples }]
 *     hands = shared/hands.js, theory = shared/theory.js
 *   makeHand(shape), place(points, view)  the made-up hands (also for feeding
 *     Chordigits in the browser)
 *
 * Used by tests/hands.html and tests/tools/run-hands-test.js.
 */

const RAD = Math.PI / 180;

// --- Made-up hands -------------------------------------------------------
// Hand frame, in palm lengths (wrist to middle knuckle = 1): x to the thumb's
// side, y along the fingers, z out of the palm (fingers curl towards +z).
const KNUCKLE = { index: [0.32, 0.92], middle: [0.08, 1.0], ring: [-0.14, 0.95], little: [-0.33, 0.85] };
const BONES = { index: [0.42, 0.25, 0.20], middle: [0.47, 0.30, 0.21], ring: [0.44, 0.29, 0.21], little: [0.34, 0.20, 0.18] };
const SPREAD = { index: 8, middle: 0, ring: -6, little: -14 };
const BASE = { index: 5, middle: 9, ring: 13, little: 17 };
// Bend at the base knuckle, middle joint and last joint, in degrees.
const POSE = { up: [5, 8, 5], relaxed: [15, 25, 15], loose: [60, 80, 40], down: [85, 100, 60] };
// Thumb tip positions; the thumb's other joints are drawn in between.
const THUMB = {
  out: [0.88, 0.85, 0.06],      // open hand, 🤙
  up: [0.44, 1.12, 0.22],       // thumbs-up
  tucked: [0.38, 0.70, 0.08],   // straight along the side of the palm
  across: [0.0, 0.78, 0.35],    // folded across the palm
  overIndex: [0.30, 0.95, 0.42],// fist, thumb over the curled index
  holdLittle: [-0.2, 0.72, 0.35], // holding the little finger down (showing 3)
};

function fingerPoints(name, bend) {
  const [kx, ky] = KNUCKLE[name], a = SPREAD[name] * RAD;
  const pts = [[kx, ky, 0]];
  let th = 0;
  BONES[name].forEach((l, i) => {
    th += bend[i] * RAD;
    const p = pts[i];
    pts.push([p[0] + l * Math.sin(a) * Math.cos(th), p[1] + l * Math.cos(a) * Math.cos(th), p[2] + l * Math.sin(th)]);
  });
  return pts;
}

// shape: { thumb: THUMB key or [x, y, z] or { touch: finger }, index: POSE key or [a, b, c], ... }
export function makeHand(shape) {
  const p = new Array(21);
  p[0] = [0, 0, 0];
  for (const name of Object.keys(BASE)) {
    const bend = typeof shape[name] === 'string' ? POSE[shape[name]] : shape[name];
    fingerPoints(name, bend).forEach((q, i) => { p[BASE[name] + i] = q; });
  }
  const t = shape.thumb;
  const tip = t.touch ? p[BASE[t.touch] + 3].map((v, i) => v + [0.03, 0.02, -0.02][i]) : (typeof t === 'string' ? THUMB[t] : t);
  const cmc = [0.25, 0.2, 0.05];
  const lerp = (f, bulge) => cmc.map((v, i) => v + (tip[i] - v) * f + (i === 0 ? bulge : 0));
  p[1] = cmc; p[2] = lerp(0.42, 0.1); p[3] = lerp(0.74, 0.06); p[4] = tip;
  return p;
}

// Turn (roll in the picture, yaw left-right, pitch back-forward), mirror
// (left hand), scale to metres, move, and jitter each point.
export function place(p, { roll = 0, yaw = 0, pitch = 0, mirror = false, palm = 0.085, jitter = 0, rand }) {
  const [cr, sr, cy, sy, cp, sp] = [roll, yaw, pitch].flatMap((d) => [Math.cos(d * RAD), Math.sin(d * RAD)]);
  const off = [0.02, -0.01, 0.4];
  return p.map(([x, y, z]) => {
    if (mirror) x = -x;
    [x, y] = [x * cr - y * sr, x * sr + y * cr];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    const j = () => (rand() * 2 - 1) * jitter;
    return { x: (x + j()) * palm + off[0], y: (y + j()) * palm + off[1], z: (z + j()) * palm + off[2] };
  });
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Every way a hand is shown, with its number in each 6-and-7 style and its
// count for the chord-type hand.
const DOWN = { index: 'down', middle: 'down', ring: 'down', little: 'down' };
const SHAPES = [
  ['fist, thumb over the index', { ...DOWN, thumb: 'overIndex' }, 0, 0, 0],
  ['fist, thumb across', { ...DOWN, thumb: 'across' }, 0, 0, 0],
  ['loose fist', { index: 'loose', middle: 'loose', ring: 'loose', little: 'loose', thumb: 'overIndex' }, 0, 0, 0],
  ['1: index', { ...DOWN, index: 'up', thumb: 'across' }, 1, 1, 1],
  ['1: thumbs-up', { ...DOWN, thumb: 'up' }, 1, 1, 1],
  ['1: little finger', { ...DOWN, little: 'up', thumb: 'across' }, 1, 1, 1],
  ['2: index and middle', { ...DOWN, index: 'up', middle: 'up', thumb: 'holdLittle' }, 2, 2, 2],
  ['2: thumb and index', { ...DOWN, index: 'up', thumb: 'out' }, 2, 2, 2],
  // Sign-language 6 looks like this 3 (the spec tells people to show 3 another way then).
  ['3: index, middle, ring', { ...DOWN, index: 'up', middle: 'up', ring: 'up', thumb: 'holdLittle' }, 3, 6, 3],
  ['3: thumb, index, middle', { ...DOWN, index: 'up', middle: 'up', thumb: 'out' }, 3, 3, 3],
  ['4: thumb across', { index: 'up', middle: 'up', ring: 'up', little: 'up', thumb: 'across' }, 4, 4, 4],
  ['4: thumb along the palm', { index: 'up', middle: 'up', ring: 'up', little: 'up', thumb: 'tucked' }, 4, 4, 4],
  ['5: open hand', { index: 'up', middle: 'up', ring: 'up', little: 'up', thumb: 'out' }, 5, 5, 5],
  ['5: relaxed open hand', { index: 'relaxed', middle: 'relaxed', ring: 'relaxed', little: 'relaxed', thumb: 'out' }, 5, 5, 5],
  ['🤙', { ...DOWN, little: 'up', thumb: 'out' }, 6, 2, 2],
  ['🤘 thumb in', { ...DOWN, index: 'up', little: 'up', thumb: 'across' }, 7, 2, 2],
  ['🤘 thumb out', { ...DOWN, index: 'up', little: 'up', thumb: 'out' }, 7, 3, 3],
  ['sign-language 6', { index: 'up', middle: 'up', ring: 'up', little: [50, 75, 35], thumb: { touch: 'little' } }, 3, 6, 3],
  ['sign-language 7', { index: 'up', middle: 'up', ring: [50, 75, 35], little: 'up', thumb: { touch: 'ring' } }, 3, 7, 3],
];

const VIEWS = [];
for (const roll of [-35, 0, 35, 90, -90]) for (const yaw of [-40, 0, 40]) for (const pitch of [-30, 0, 30]) for (const mirror of [false, true]) {
  VIEWS.push({ roll, yaw, pitch, mirror });
}

export function checkHands(H, T) {
  const rows = [];
  const row = (section) => { const r = { section, checked: 0, failed: 0, stats: '', examples: [] }; rows.push(r); return r; };
  const fail = (r, msg) => { r.failed++; if (r.examples.length < 8) r.examples.push(msg); };
  const rand = lcg(12345);
  const viewName = (v) => `roll ${v.roll}° yaw ${v.yaw}° pitch ${v.pitch}°${v.mirror ? ' left hand' : ''}`;

  // 1. Every shape, every view, near and far, with jitter.
  {
    const r = row(`Every hand shape (${SHAPES.length}) turned, tilted, either hand, near and far, with jitter: the number (🤙/🤘 and sign language) and the count`);
    for (const [name, shape, rock, asl, count] of SHAPES) {
      const base = makeHand(shape);
      for (const v of VIEWS) for (const palm of [0.07, 0.1]) {
        const p = place(base, { ...v, palm, jitter: 0.02, rand });
        const f = H.readFingers(p);
        const got = [H.chordNumber(f, p, 'rock'), H.chordNumber(f, p, 'asl'), H.countFingers(f)];
        r.checked++;
        if (got.join() !== [rock, asl, count].join()) fail(r, `${name}, ${viewName(v)}: read ${got.join('/')}, expected ${rock}/${asl}/${count}`);
      }
    }
  }

  // 2. A finger halfway between up and down keeps what it was: no flicker.
  {
    const r = row('Half-bent finger: stays raised after up, stays down after down, while it wobbles in between');
    const ratio = (bend) => {
      const p = makeHand({ ...DOWN, index: bend, thumb: 'across' });
      const d = (a, b) => Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1], p[a][2] - p[b][2]);
      return d(8, 0) / d(6, 0);
    };
    // Find bends (between up and down) whose tip-to-joint ratios are 1.10 and 1.13.
    const bendFor = (target) => {
      let lo = 0, hi = 1;
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2;
        if (ratio(POSE.up.map((u, j) => u + (POSE.down[j] - u) * m)) > target) lo = m; else hi = m;
      }
      return POSE.up.map((u, j) => u + (POSE.down[j] - u) * lo);
    };
    const wobble = [bendFor(1.10), bendFor(1.13)];
    for (const start of ['up', 'down']) {
      let prev = H.readFingers(place(makeHand({ ...DOWN, index: start, thumb: 'across' }), { rand }));
      for (let i = 0; i < 20; i++) {
        prev = H.readFingers(place(makeHand({ ...DOWN, index: wobble[i % 2], thumb: 'across' }), { roll: 20, rand }), prev);
        r.checked++;
        if (prev.index !== (start === 'up')) { fail(r, `from ${start}, wobble ${i}: index ${prev.index ? 'up' : 'down'}`); break; }
      }
    }
    r.stats = `wobble between tip/joint ratios 1.10 and 1.13 (raise above 1.15, lower below 1.08)`;
  }

  // 3. The steadiness hold.
  {
    const r = row('Steady count: a new count after 0.2 s, a fist after 0.12 s, nothing from counts passed on the way, from flicker or from a dropped frame');
    const run = (frames, opts) => {
      const s = H.createSteady(opts);
      const seen = [];
      frames.forEach(([reading], i) => {
        const v = s.update(reading, i * 33);
        if (seen[seen.length - 1] !== v) seen.push(v);
      });
      return seen;
    };
    const hold = (reading, ms) => Array.from({ length: Math.round(ms / 33) }, () => [reading]);
    const cases = [
      ['hold 4 for 0.3 s', [...hold(4, 300)], [null, 4]],
      ['hold 4 for 0.15 s: not yet', [...hold(4, 150)], [null]],
      ['1, then to 4 passing 2 and 3', [...hold(1, 400), ...hold(2, 66), ...hold(3, 66), ...hold(4, 400)], [null, 1, 4]],
      ['3 and 4 flickering every frame', [...hold(3, 400), ...Array.from({ length: 30 }, (_, i) => [i % 2 ? 3 : 4])], [null, 3]],
      ['fist after 0.15 s stops', [...hold(4, 400), ...hold(0, 150)], [null, 4, 0]],
      ['close and open again replays', [...hold(4, 400), ...hold(0, 200), ...hold(4, 400)], [null, 4, 0, 4]],
      ['hand lost for 0.1 s: keeps playing', [...hold(5, 400), ...hold(null, 100), ...hold(5, 200)], [null, 5]],
      ['hand lost for 0.4 s: stops', [...hold(5, 400), ...hold(null, 400)], [null, 5, null]],
    ];
    for (const [name, frames, want] of cases) {
      const got = run(frames);
      r.checked++;
      if (got.join() !== want.join()) fail(r, `${name}: ${got.join(' → ')}, expected ${want.join(' → ')}`);
    }
  }

  // 4. Tilt: upright, leaning left or right, whatever the hand shows.
  {
    const r = row('Tilt: upright (within 15°) reads 0, leaning 50° or more reads +1 or -1 by side, even turned 30° or leaning 30° towards the camera, either hand, any fingers; no flip-flop between 24° and 29° (the hand itself leans about 5°)');
    const shapes = [SHAPES[0][1], SHAPES[12][1], SHAPES[3][1], SHAPES[6][1]]; // fist, open, 1, 2
    for (const shape of shapes) for (const mirror of [false, true]) for (const yaw of [-30, 0, 30]) for (const pitch of [-30, 0, 30]) {
      for (const [roll, want] of [[0, 0], [15, 0], [-15, 0], [-50, 1], [-70, 1], [50, -1], [70, -1]]) {
        const p = place(makeHand(shape), { roll, yaw, pitch, mirror, jitter: 0.02, rand });
        const got = H.handTilt(p);
        r.checked++;
        if (got !== want) fail(r, `roll ${roll}° yaw ${yaw}° pitch ${pitch}°${mirror ? ' left hand' : ''}: ${got}, expected ${want}`);
      }
    }
    for (const [start, startWant] of [[0, 0], [-50, 1]]) {
      let prev = H.handTilt(place(makeHand(shapes[1]), { roll: start, rand }));
      for (let i = 0; i < 12; i++) {
        prev = H.handTilt(place(makeHand(shapes[1]), { roll: i % 2 ? -24 : -29, rand }), prev);
        r.checked++;
        if (prev !== startWant) { fail(r, `from roll ${start}°, wobble ${i}: ${prev}`); break; }
      }
    }
  }

  // 5. Height of the hand in the picture.
  {
    const r = row('Height: top third +1, bottom third -1, middle 0; a hand near a border keeps its band');
    const cases = [[0.1, 0, 1], [0.29, 0, 1], [0.33, 0, 0], [0.33, 1, 1], [0.37, 1, 0], [0.5, 1, 0], [0.5, -1, 0], [0.68, 0, 0], [0.68, -1, -1], [0.72, 0, -1], [0.62, -1, 0], [0.95, 1, -1], [0.05, -1, 1]];
    for (const [y, prev, want] of cases) {
      r.checked++;
      const got = H.heightBand(y, prev);
      if (got !== want) fail(r, `y ${y} after ${prev}: ${got}, expected ${want}`);
    }
  }

  // 6. Theory-style numbers.
  {
    const r = row('Chord numbers: I ii iii IV V vi vii° in major, i ii° III iv v VI VII in minor, and with chord types (V7, II, iiø7, IVsus4)');
    const num = (keyValue, degree, mod) => {
      const info = T.getChordInfo({ key: T.parseKey(keyValue), degree, modifiers: [mod, null] });
      return T.chordNumeral(degree, info.suffix);
    };
    const want = [
      ['0_maj', 'Triad', 'I ii iii IV V vi vii°'],
      ['9_min', 'Triad', 'i ii° III iv v VI VII'],
      ['0_maj', '7th', 'Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7'],
      ['9_min', '7th', 'i7 iiø7 IIImaj7 iv7 v7 VImaj7 VII7'],
      ['0_maj', 'Maj', 'I II III IV V VI VII'],
      ['0_maj', 'Min', 'i ii iii iv v vi vii'],
      ['0_maj', 'Sus4', 'Isus4 IIsus4 IIIsus4 IVsus4 Vsus4 VIsus4 VIIsus4'],
      ['0_maj', 'Add9', 'Iadd9 iiadd9 iiiadd9 IVadd9 Vadd9 viadd9 viiadd9'],
      ['0_maj', 'Dom7', 'I7 II7 III7 IV7 V7 VI7 VII7'],
      ['0_maj', 'MajAdd9', 'Iadd9 IIadd9 IIIadd9 IVadd9 Vadd9 VIadd9 VIIadd9'],
      ['0_maj', 'MinAdd9', 'iadd9 iiadd9 iiiadd9 ivadd9 vadd9 viadd9 viiadd9'],
    ];
    for (const [key, mod, line] of want) {
      const got = [0, 1, 2, 3, 4, 5, 6].map((d) => num(key, d, mod)).join(' ');
      r.checked++;
      if (got !== line) fail(r, `${key} ${mod}: "${got}", expected "${line}"`);
    }
  }
  return rows;
}
