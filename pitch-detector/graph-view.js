/* pitch-detector/graph-view.js: the graph (spec: specs/pitch-detector.md),
 * drawn on a canvas. Piano keys down the left edge name the notes; lanes run
 * across, one per half step (black keys' lanes faintly shaded, a line under
 * every C, a highlighted key's notes brighter); the voice's line runs from
 * left (older) to right (newest), in one colour, with breaks.
 *
 *   const view = createGraphView(canvas)
 *   view.setLook({ text, accent, page, font })   CSS colours and the label font
 *   view.resize()            after the canvas changed size
 *   view.layout -> { keysWidth, lane, span, seconds, pxPerSecond }
 *     lane: px per half step; span: half steps that fit; seconds: time that fits
 *   view.draw({ trace, end, center, names, keyPcs, refs, pressed, dot })
 *     trace    pitch-detector/trace.js createTrace
 *     end      the time at the right edge (the trace's clock)
 *     center   the pitch (MIDI with a fraction) at the middle
 *     names    12 names by pitch class or null (trace.js laneNames), '#'/'b' ASCII
 *     keyPcs   pitch classes of the highlighted key, or null
 *     refs     [{ midi, t0, t1 }] notes heard from the piano: faint bars
 *     pressed  the MIDI of a key that sounds now (lit), or null
 *     dot      true: a dot at the line's newest point
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
  let text = [255, 255, 255], accent = [138, 212, 255], page = [15, 20, 25], font = 'sans-serif';
  let center = 64;
  const layout = { keysWidth: 34, lane: 24, span: 16, seconds: 6, pxPerSecond: 50 };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    // About 16 half steps on a phone, lanes no thinner than 18 px; 50 px a second.
    layout.keysWidth = w > 600 ? 52 : 44;
    layout.lane = Math.max(18, Math.min(30, h / 16));
    layout.span = h / layout.lane;
    layout.pxPerSecond = 50;
    layout.seconds = Math.max(1, (w - layout.keysWidth - 4) / layout.pxPerSecond);
  }

  function setLook(look) {
    text = parseColor(look.text); accent = parseColor(look.accent); page = parseColor(look.page);
    font = look.font || font;
  }

  const yOf = (m) => h / 2 - (m - center) * layout.lane;

  function draw({ trace, end, center: c, names, keyPcs = null, refs = [], pressed = null, dot = false }) {
    center = c;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { keysWidth: kw, lane } = layout;
    const gx = kw + 4, gr = w;
    const xOf = (t) => gr - (end - t) * layout.pxPerSecond;
    const lo = Math.floor(center - layout.span / 2) - 1, hi = Math.ceil(center + layout.span / 2) + 1;
    const labelSize = Math.max(9, Math.min(12, lane * 0.45));

    // Lanes, the line under every C, and the piano keys with their names.
    for (let n = lo; n <= hi; n++) {
      const y = yOf(n), pc = ((n % 12) + 12) % 12;
      const inKey = keyPcs && keyPcs.includes(pc);
      if (inKey) { ctx.fillStyle = rgba(accent, 0.11); ctx.fillRect(gx, y - lane / 2, gr - gx, lane); }
      else if (BLACK[pc]) { ctx.fillStyle = rgba(text, 0.045); ctx.fillRect(gx, y - lane / 2, gr - gx, lane); }
      if (pc === 0) { ctx.fillStyle = rgba(text, 0.22); ctx.fillRect(gx, y + lane / 2 - 0.5, gr - gx, 1); }
      // Like a real keyboard in every theme: white keys in the lighter of the
      // text and page colours, black keys in the darker one.
      const black = BLACK[pc], kWidth = black ? kw * 0.72 : kw;
      const [light, dark] = luma(text) > luma(page) ? [text, page] : [page, text];
      ctx.fillStyle = n === pressed ? rgba(accent, 1) : black ? rgba(dark, 1) : rgba(light, 0.7);
      ctx.fillRect(0, y - lane / 2 + 0.5, kWidth, lane - 1);
      // An outline, so keys stand out on a light page too.
      if (n !== pressed) { ctx.strokeStyle = black ? rgba(light, 0.45) : rgba(dark, 0.2); ctx.lineWidth = 1; ctx.strokeRect(0.5, y - lane / 2 + 1, kWidth - 1, lane - 2); }
      if (names && names[pc]) {
        // The name fits on its key: smaller when it is long (Sol♯ on a black key).
        const label = pretty(names[pc]) + (pc === 0 ? String(Math.floor(n / 12) - 1) : '');
        let size = labelSize;
        ctx.font = `700 ${size}px ${font}`;
        while (size > 7 && ctx.measureText(label).width > kWidth - 5) ctx.font = `700 ${(size -= 0.5)}px ${font}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = n === pressed ? rgba(page, 1) : black ? rgba(light, 0.95) : rgba(dark, 0.95);
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

    // The voice: one line, with breaks.
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, 0, gr - gx, h);
    ctx.clip();
    ctx.strokeStyle = rgba(accent, 1);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false, last = null;
    trace.forEach(end - layout.seconds - 0.5, end, (t, m) => {
      if (Number.isNaN(m) || t > end) { pen = false; if (Number.isNaN(m)) last = null; return; }
      const x = xOf(t), y = yOf(m);
      if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      pen = true;
      last = [x, y];
    });
    ctx.stroke();
    ctx.restore();
    if (dot && last) {
      ctx.fillStyle = rgba(accent, 1);
      ctx.beginPath();
      ctx.arc(last[0], last[1], 4.5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  resize();
  return {
    resize, setLook, draw, layout,
    midiAt: (y) => center + (h / 2 - y) / layout.lane,
    onKeys: (x) => x <= layout.keysWidth + 2,
  };
}
