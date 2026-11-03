/* shared/ui/pitch-graph.js: the graph of a voice over time, drawn on a canvas
 * (the Pitch Detector, Pitch Training; moved from pitch-detector/graph-view.js).
 * Piano keys down the left edge name the notes; lanes run across, one per half
 * step (black keys' lanes faintly shaded, a line under every C, a highlighted
 * key's notes brighter); the voice's line runs from left (older) to right
 * (newer), in one colour, with breaks.
 *
 *   const view = createGraphView(canvas)
 *   view.setLook({ text, accent, page, font, line, keys })   CSS colours and the
 *                            label font; line: the voice's colour (default: accent);
 *                            keys: { white, whiteText, black, blackText }, the theme's
 *                            piano-key colours (--key-*), as on the Piano (default:
 *                            the lighter and darker of text and page)
 *   view.resize()            after the canvas changed size
 *   view.layout -> { keysWidth, lane, seconds, pxPerSecond, left, right }
 *     lane: px per half step and pxPerSecond (at the last draw); seconds: the
 *     time that fits at 50 px a second; left, right: x of the lanes' ends (CSS px)
 *   view.draw({ trace, end, start, low, high, names, cName, keyPcs, refs, pressed, dot,
 *               targets, cursor, traceShift })
 *     trace    shared/pitch-line.js createTrace
 *     end      the time at the right edge (the trace's clock)
 *     start    the time at the left edge; without it, end − layout.seconds (50 px a second)
 *     low, high  the pitches (MIDI with a fraction) at the bottom and top edges
 *              (pitch-line.js fitView). Keys are named while lanes are at least
 *              14 px tall; thinner, only the C's (Do's) keep their names.
 *     names    12 names by pitch class or null (pitch-line.js laneNames), '#'/'b' ASCII
 *     cName    the name of C (C or Do), for the thin-lane labels
 *     keyPcs   pitch classes to brighten (a key's scale, an exercise's notes), or null
 *     refs     [{ midi, t0, t1 }] notes heard from the piano: faint bars
 *     pressed  the MIDI of a key that sounds now (lit), or null
 *     dot      true: a dot at the line's newest point
 *     targets  [{ m0, m1, t0, t1, state, fill }] notes to sing (Pitch Training):
 *              a bar on its lane from t0 to t1, a sloped band when m0 ≠ m1 (a
 *              slide). state: 'idle' (faint), 'sound' (playing now: bright),
 *              'turn' (to sing: outlined), 'in' (sung in tune: the accent),
 *              'close' (an accent outline). fill: [[ta, tb], …] stretches sung
 *              in tune so far, drawn in the accent.
 *     cursor   a time marked with a thin upright line (a sweep), or null
 *     traceShift  the trace's time t is drawn at t − traceShift, and only from
 *              start + traceShift to end + traceShift (Pitch Training draws the
 *              singing over the pattern the piano played earlier); default 0
 *   view.midiAt(y)        the pitch at a height in the canvas (CSS px)
 *   view.onKeys(x)        true when x is on the piano keys
 */
const BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];
const pretty = (n) => n.replace(/#$/, '♯').replace(/b$/, '♭');

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
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

export function createGraphView(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let text = [255, 255, 255], accent = [138, 212, 255], line = null, page = [15, 20, 25], font = 'sans-serif', keys = null;
  let low = 55, high = 69;
  const layout = { keysWidth: 44, lane: 24, seconds: 6, pxPerSecond: 50, left: 48, right: 300 };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    // 50 px a second: about 6 seconds on a phone, more on a computer.
    layout.keysWidth = w > 600 ? 52 : 44;
    layout.pxPerSecond = 50;
    layout.seconds = Math.max(1, (w - layout.keysWidth - 4) / layout.pxPerSecond);
    layout.left = layout.keysWidth + 4;
    layout.right = w;
  }

  function setLook(look) {
    text = parseColor(look.text); accent = parseColor(look.accent); page = parseColor(look.page);
    line = look.line ? parseColor(look.line) : null;
    font = look.font || font;
    keys = look.keys && look.keys.white ? Object.fromEntries(Object.entries(look.keys).map(([k, v]) => [k, parseColor(v)])) : null;
  }

  const yOf = (m) => (high - m) * layout.lane;

  // A note to sing: a rounded bar, or a band along a slide.
  function targetPath(x1, x2, y1, y2, th) {
    ctx.beginPath();
    if (Math.abs(y1 - y2) < 0.01) {
      const bw = Math.max(2, x2 - x1), r = Math.min(5, th / 2, bw / 2), y = y1 - th / 2;
      ctx.moveTo(x1 + r, y);
      ctx.arcTo(x1 + bw, y, x1 + bw, y + th, r);
      ctx.arcTo(x1 + bw, y + th, x1, y + th, r);
      ctx.arcTo(x1, y + th, x1, y, r);
      ctx.arcTo(x1, y, x1 + bw, y, r);
    } else {
      ctx.moveTo(x1, y1 - th / 2);
      ctx.lineTo(x2, y2 - th / 2);
      ctx.lineTo(x2, y2 + th / 2);
      ctx.lineTo(x1, y1 + th / 2);
    }
    ctx.closePath();
  }

  function drawTargets(targets, xOf, lane) {
    const th = Math.max(4, lane * 0.62);
    const pitchAt = (tg, t) => tg.m0 + (tg.m1 - tg.m0) * Math.min(1, Math.max(0, (t - tg.t0) / (tg.t1 - tg.t0)));
    for (const tg of targets) {
      const x1 = xOf(tg.t0) + 1, x2 = xOf(tg.t1) - 1.5;
      if (x2 < layout.left || x1 > layout.right) continue;
      targetPath(x1, x2, yOf(tg.m0), yOf(tg.m1), th);
      if (tg.state === 'sound') { ctx.fillStyle = rgba(text, 0.62); ctx.fill(); }
      else if (tg.state === 'in') { ctx.fillStyle = rgba(accent, 1); ctx.fill(); }
      else if (tg.state === 'close') { ctx.fillStyle = rgba(accent, 0.2); ctx.fill(); ctx.strokeStyle = rgba(accent, 1); ctx.lineWidth = 1.5; ctx.stroke(); }
      else if (tg.state === 'turn') { ctx.fillStyle = rgba(text, 0.08); ctx.fill(); ctx.strokeStyle = rgba(text, 0.5); ctx.lineWidth = 1; ctx.stroke(); }
      else { ctx.fillStyle = rgba(text, 0.22); ctx.fill(); }
      // Stretches sung in tune so far: slices of the bar in the accent.
      if (tg.fill && tg.fill.length && tg.state !== 'in') {
        ctx.fillStyle = rgba(accent, 1);
        for (const [ta, tb] of tg.fill) {
          const a = Math.max(tg.t0, ta), b = Math.min(tg.t1, tb);
          if (b <= a) continue;
          const xa = Math.max(x1, xOf(a)), xb = Math.min(x2, xOf(b) + 0.5);
          if (xb <= xa) continue;
          targetPath(xa, xb, yOf(pitchAt(tg, a)), yOf(pitchAt(tg, b)), th - 2);
          ctx.fill();
        }
      }
    }
  }

  function draw({ trace, end, start, low: l, high: hh, names, cName = 'C', keyPcs = null, refs = [], pressed = null, dot = false, targets = null, cursor = null, traceShift = 0 }) {
    low = l; high = hh;
    layout.lane = h / Math.max(1, high - low);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { keysWidth: kw, lane } = layout;
    const gx = layout.left, gr = layout.right;
    if (start === undefined || start === null) start = end - layout.seconds;
    const pps = (gr - gx) / Math.max(0.001, end - start);
    layout.pxPerSecond = pps;
    const xOf = (t) => gx + (t - start) * pps;
    const lo = Math.floor(low) - 1, hi = Math.ceil(high) + 1;
    const allNames = lane >= 14;
    const labelSize = Math.max(9, Math.min(12, lane * 0.45));

    // Lanes, the line under every C, and the piano keys with their names.
    for (let n = lo; n <= hi; n++) {
      const y = yOf(n), pc = ((n % 12) + 12) % 12;
      const inKey = keyPcs && keyPcs.includes(pc);
      if (inKey) { ctx.fillStyle = rgba(accent, 0.11); ctx.fillRect(gx, y - lane / 2, gr - gx, lane); }
      else if (BLACK[pc]) { ctx.fillStyle = rgba(text, 0.045); ctx.fillRect(gx, y - lane / 2, gr - gx, lane); }
      if (pc === 0) { ctx.fillStyle = rgba(text, 0.22); ctx.fillRect(gx, y + lane / 2 - 0.5, gr - gx, 1); }
      // Like a real keyboard in every theme: the theme's piano-key colours (or, without
      // them, white keys in the lighter of the text and page colours, black in the darker).
      const black = BLACK[pc], kWidth = black ? kw * 0.72 : kw;
      const [light, dark] = keys ? [keys.white, keys.black] : luma(text) > luma(page) ? [text, page] : [page, text];
      ctx.fillStyle = n === pressed ? rgba(accent, 1) : black ? rgba(dark, 1) : rgba(light, keys ? 1 : 0.7);
      ctx.fillRect(0, y - lane / 2 + 0.5, kWidth, lane - 1);
      // An outline, so keys stand out on a light page too.
      if (n !== pressed && lane > 4) { ctx.strokeStyle = black ? rgba(light, 0.45) : rgba(dark, 0.2); ctx.lineWidth = 1; ctx.strokeRect(0.5, y - lane / 2 + 1, kWidth - 1, lane - 2); }
      // Thin lanes: only the C's, named even when the key has no C (B♯ is still a C key).
      const name = allNames ? names && names[pc] : pc === 0 ? cName : null;
      if (name) {
        // The name fits on its key: smaller when it is long (Sol♯ on a black key).
        const label = pretty(name) + (pc === 0 ? String(Math.floor(n / 12) - 1) : '');
        let size = labelSize;
        ctx.font = `700 ${size}px ${font}`;
        while (size > 7 && ctx.measureText(label).width > kWidth - 5) ctx.font = `700 ${(size -= 0.5)}px ${font}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = n === pressed ? rgba(page, 1) : keys ? rgba(black ? keys.blackText : keys.whiteText, 1) : black ? rgba(light, 0.95) : rgba(dark, 0.95);
        ctx.fillText(label, kWidth - 3, y + 0.5);
      }
    }

    // The notes heard from the piano: faint bars on their lanes.
    for (const r of refs) {
      const x1 = Math.max(gx, xOf(r.t0)), x2 = Math.min(gr, xOf(r.t1));
      if (x2 <= x1) continue;
      ctx.fillStyle = rgba(text, 0.17);
      ctx.fillRect(x1, yOf(r.midi) - lane * 0.32, x2 - x1, lane * 0.64);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, 0, gr - gx, h);
    ctx.clip();
    if (targets) drawTargets(targets, xOf, lane);
    if (cursor !== null && cursor >= start && cursor <= end) {
      ctx.fillStyle = rgba(text, 0.55);
      ctx.fillRect(xOf(cursor) - 0.75, 0, 1.5, h);
    }

    // The voice: one line, with breaks.
    const lineColor = line || accent;
    ctx.strokeStyle = rgba(lineColor, 1);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false, last = null;
    trace.forEach(start + traceShift - 0.5, end + traceShift, (t, m) => {
      if (Number.isNaN(m) || t - traceShift > end) { pen = false; if (Number.isNaN(m)) last = null; return; }
      const x = xOf(t - traceShift), y = yOf(m);
      if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      pen = true;
      last = [x, y];
    });
    ctx.stroke();
    ctx.restore();
    if (dot && last) {
      ctx.fillStyle = rgba(lineColor, 1);
      ctx.beginPath();
      ctx.arc(last[0], last[1], 4.5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  resize();
  return {
    resize, setLook, draw, layout,
    midiAt: (y) => high - y / layout.lane,
    onKeys: (x) => x <= layout.keysWidth + 2,
  };
}
