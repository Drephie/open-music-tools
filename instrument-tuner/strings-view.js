/* instrument-tuner/strings-view.js: the vibrating strings (spec:
 * specs/instrument-tuner.md), drawn on a canvas. The string you play swings
 * with your sound's real wave travelling along it: smooth and in the accent
 * colour when in tune, jittery when off. The others rest, and tremble
 * faintly while the microphone hears any sound.
 *
 *   const view = createStringsView(canvas)
 *   view.setColors(line, tune)   CSS colours (hex or rgb[a]): strings, and in tune
 *   view.resize()                after the canvas changed size
 *   view.draw(dt, { strings, active, shape, amp, chaos, glow, tremble, presence })
 *     strings   [{ x, top, bottom, width, tuned }] in the canvas's CSS px; width
 *               is the line width, tuned draws it in the accent colour
 *     active    index of the string that sounds, or -1
 *     shape     Float32Array of whole periods, -1..1 (shared/wave.js waveShape),
 *               or null (then the active string swings as a smooth curve)
 *     amp       0..1 how far it swings; chaos 0 (smooth) .. 1 (jittery);
 *     glow      0..1 in tune (accent colour and a soft halo)
 *     tremble   0..1 the faint trembling of every string (sound heard)
 *     presence  0..1 how visible resting strings are (more while listening)
 *   view.moving()   false when motion is reduced (one still frame is enough)
 */

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

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// A looped wave averaged over 2r + 1 points, twice (rounds off its corners), back to -1..1.
let soft = new Float32Array(0), tmp = new Float32Array(0);
function soften(wave, r) {
  const n = wave.length;
  if (r < 1) return wave;
  if (soft.length !== n) { soft = new Float32Array(n); tmp = new Float32Array(n); }
  let src = wave;
  for (const dst of [tmp, soft]) {
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[(i + k + n) % n];
      dst[i] = sum / (2 * r + 1);
    }
    src = dst;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(soft[i]));
  if (peak > 1e-5) for (let i = 0; i < n; i++) soft[i] /= peak;
  return soft;
}

export function createStringsView(canvas) {
  const ctx = canvas.getContext('2d');
  const calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  let line = [255, 255, 255], tune = [138, 212, 255];
  let w = 0, h = 0, dpr = 1, clock = 0, travel = 0, seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
  }

  function setColors(lineColor, tuneColor) { line = parseColor(lineColor); tune = parseColor(tuneColor); }

  function draw(dt, { strings = [], active = -1, shape = null, amp = 0, chaos = 0, glow = 0, tremble = 0, presence = 0.5 }) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const still = calm.matches;
    if (!still) { clock += dt; travel = (travel + dt * 0.7) % 1; }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // How far a string may swing: well short of its neighbours.
    let gap = Infinity;
    for (let i = 1; i < strings.length; i++) gap = Math.min(gap, Math.abs(strings[i].x - strings[i - 1].x));
    const reach = Math.min(gap === Infinity ? 44 : gap * 0.42, 26);

    strings.forEach((s, i) => {
      const len = s.bottom - s.top;
      if (len <= 0) return;
      const steps = Math.max(24, Math.round(len / 3));
      if (i !== active || amp < 0.01) {
        // At rest: a faint tremble while there is sound.
        const shake = still ? 0 : tremble * 1.3;
        ctx.strokeStyle = s.tuned ? rgba(tune, 0.8) : rgba(line, presence);
        ctx.lineWidth = s.width;
        ctx.beginPath();
        for (let j = 0; j <= steps; j++) {
          const u = j / steps;
          const dx = shake * Math.sin(Math.PI * u) * Math.sin(u * 9 + clock * (13 + i * 3));
          if (j) ctx.lineTo(s.x + dx, s.top + u * len); else ctx.moveTo(s.x + dx, s.top + u * len);
        }
        ctx.stroke();
        return;
      }

      // The string that sounds: the wave along it, fixed at both ends,
      // softened a little, and more as it comes into tune.
      const swing = reach * Math.min(1, amp);
      const col = line.map((v, k) => Math.round(v + (tune[k] - v) * glow));
      const pts = new Float32Array(steps + 1);
      if (shape) shape = soften(shape, Math.round(shape.length * (0.01 + 0.025 * glow)));
      const n = shape ? shape.length : 0;
      for (let j = 0; j <= steps; j++) {
        const u = j / steps, env = Math.sin(Math.PI * u);
        let v;
        if (n) {
          const x = ((u + travel) % 1) * n, k = Math.floor(x), f = x - k;
          v = shape[k % n] * (1 - f) + shape[(k + 1) % n] * f;
        } else v = Math.sin(2 * Math.PI * (u * 2 + travel));
        // Off the note: slow wobbles and grit on top of the wave.
        v += chaos * (0.9 * Math.sin(u * Math.PI * 3 + clock * 9) * Math.sin(clock * 5 + u * 7) + (rand() - 0.5) * 0.8);
        pts[j] = v * env * swing;
      }
      for (const [alpha, width] of [[0.06 + 0.22 * glow, s.width + 6 * glow], [1, s.width + 0.4]]) {
        ctx.strokeStyle = rgba(col, alpha);
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let j = 0; j <= steps; j++) {
          const y = s.top + (j / steps) * len;
          if (j) ctx.lineTo(s.x + pts[j], y); else ctx.moveTo(s.x + pts[j], y);
        }
        ctx.stroke();
      }
    });
  }

  resize();
  return { draw, resize, setColors, moving: () => !calm.matches };
}
