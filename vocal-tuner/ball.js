/* vocal-tuner/ball.js: the wave ball (spec: specs/vocal-tuner.md). A 3D ball of
 * rings drawn on a canvas; each ring is a snapshot of the voice's sound wave.
 * New rings start at the equator and drift to the poles. The ball grows with
 * loudness from a dot, is round and in the accent colour when in tune, and
 * gets more chaotic the further off the note is.
 *
 *   const ball = createWaveBall(canvas)
 *   ball.setColors(line, tune)   CSS colours (hex or rgb[a]) of the rings, off and in tune
 *   ball.pushRing(shape, chaos, tune)
 *     shape: Float32Array(RING_POINTS), -1..1 (ringFromWave), or null for silence;
 *     chaos 0 (round) .. 1 (wild); tune 0..1 (how much of the accent colour)
 *   ball.draw(dt, { level, lean, cx, cy, maxR })
 *     level 0..1 (size), lean -1..1 (tilts toward low / high), centre and
 *     full-size radius in CSS px
 *   ball.resize()   after the canvas changed size
 *   ringFromWave(samples, sampleRate, freq, out)
 *     a whole number of periods of the newest sound, starting on a rising zero
 *     crossing so the ring closes smoothly, scaled to -1..1 (freq 0: the
 *     newest stretch as it is)
 */

export const RING_POINTS = 96;
const RINGS = 13;

export function ringFromWave(samples, sampleRate, freq, out) {
  const n = samples.length;
  let start, span;
  if (freq > 0) {
    const period = sampleRate / freq;
    const periods = Math.max(1, Math.min(4, Math.floor((n - period) / period)));
    span = periods * period;
    start = Math.floor(n - span - 1);
    // Back to the nearest rising zero crossing (within one period).
    for (let i = start; i > Math.max(1, start - period); i--) {
      if (samples[i - 1] < 0 && samples[i] >= 0) { start = i; break; }
    }
  } else {
    span = Math.min(n - 1, 1024);
    start = n - 1 - span;
  }
  let peak = 0;
  for (let i = 0; i < RING_POINTS; i++) {
    const x = start + (i / RING_POINTS) * span;
    const j = Math.floor(x), f = x - j;
    const v = samples[j] * (1 - f) + samples[Math.min(n - 1, j + 1)] * f;
    out[i] = v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  const k = peak > 1e-5 ? 1 / peak : 0;
  for (let i = 0; i < RING_POINTS; i++) out[i] *= k;
  return out;
}

function parseColor(c) {
  c = (c || '').trim();
  let m = c.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16));
  m = c.match(/^#([0-9a-f]{6})/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = c.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (m) return [m[1], m[2], m[3]].map(Number);
  return [255, 255, 255];
}

export function createWaveBall(canvas) {
  const ctx = canvas.getContext('2d');
  const rings = [];
  const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  let line = [255, 255, 255], tune = [138, 212, 255];
  let w = 0, h = 0, dpr = 1, spin = 0, tilt = 0, seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
  }

  function setColors(lineColor, tuneColor) { line = parseColor(lineColor); tune = parseColor(tuneColor); }

  // Each ring keeps the state it was born with: its wave (made bumpier and
  // jittered by chaos), its colour, and a small random wobble out of its plane.
  function pushRing(shape, chaos = 0, tuneAmount = 0) {
    const pts = new Float32Array(RING_POINTS);
    const bump = 0.035 + 0.22 * chaos;
    // Chaos: a few slow random swells around the ring, plus a little grit.
    const swells = [2, 3, 5, 7].map((m) => ({ m, a: (rand() - 0.5) * 0.3 * chaos, p: rand() * 2 * Math.PI }));
    for (let i = 0; i < RING_POINTS; i++) {
      const a = 2 * Math.PI * i / RING_POINTS;
      let v = (shape ? shape[i] : 0) * bump + (rand() - 0.5) * 0.05 * chaos;
      for (const s of swells) v += s.a * Math.sin(s.m * a + s.p);
      pts[i] = v;
    }
    rings.unshift({
      pts, tune: tuneAmount,
      wobX: (rand() - 0.5) * 0.7 * chaos, wobZ: (rand() - 0.5) * 0.7 * chaos, turn: rand() * 2 * Math.PI * chaos,
    });
    if (rings.length > RINGS) rings.pop();
  }

  function draw(dt, { level = 0, lean = 0, cx = w / 2, cy = h / 2, maxR = Math.min(w, h) * 0.42 }) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const R = 4 + level * (maxR - 4);
    const focal = maxR * 3.2;
    if (!calm.matches) spin += dt * (0.35 + level * 0.5);
    tilt += (lean - tilt) * Math.min(1, dt * 5);
    const ct = Math.cos(0.38 + tilt * 0.5), st = Math.sin(0.38 + tilt * 0.5);
    const cl = Math.cos(tilt * 0.6), sl = Math.sin(tilt * 0.6);
    const alpha = Math.min(1, 0.3 + level * 1.4);

    for (let k = rings.length - 1; k >= 0; k--) {
      const ring = rings[k];
      const fade = 1 - k / RINGS;
      const col = line.map((v, i) => Math.round(v + (tune[i] - v) * ring.tune));
      ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      for (const side of k === 0 ? [1] : [1, -1]) {
        const lat = side * (k / RINGS) * (Math.PI / 2) * 0.96;
        const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
        const flat = 1 - Math.abs(lat) / 1.7;
        const spinK = spin + ring.turn, cs = Math.cos(spinK), ss = Math.sin(spinK);
        const front = new Path2D(), back = new Path2D();
        let prev = null;
        for (let j = 0; j <= RING_POINTS; j++) {
          const a = 2 * Math.PI * j / RING_POINTS;
          const r = R * (1 + ring.pts[j % RING_POINTS] * flat * Math.min(1, level * 1.5 + 0.2));
          // On the ring, then the ring's own wobble, the spin, the tilt toward the viewer, the lean.
          let x = r * cosLat * Math.cos(a), y = r * sinLat, z = r * cosLat * Math.sin(a);
          let y1 = y + ring.wobX * z, z1 = z - ring.wobX * y;
          let x1 = x + ring.wobZ * y1; y1 -= ring.wobZ * x;
          const x2 = x1 * cs + z1 * ss, z2 = -x1 * ss + z1 * cs;
          const y3 = y1 * ct - z2 * st, z3 = y1 * st + z2 * ct;
          const x4 = x2 * cl - y3 * sl, y4 = x2 * sl + y3 * cl;
          const p = focal / (focal + z3);
          const pt = [cx + x4 * p, cy + y4 * p, z3];
          if (prev) {
            const path = prev[2] + pt[2] < 0 ? front : back;
            path.moveTo(prev[0], prev[1]);
            path.lineTo(pt[0], pt[1]);
          }
          prev = pt;
        }
        ctx.globalAlpha = 0.22 * (0.25 + 0.75 * fade) * alpha;
        ctx.lineWidth = 0.8;
        ctx.stroke(back);
        ctx.globalAlpha = 0.9 * (0.25 + 0.75 * fade) * alpha;
        ctx.lineWidth = k < 3 ? 1.5 : 1.1;
        ctx.stroke(front);
      }
    }
    ctx.globalAlpha = 1;
  }

  resize();
  return { pushRing, draw, resize, setColors };
}
