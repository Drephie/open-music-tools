/* tests/pitch-detector-cases.js: known-answer checks for the Pitch Detector's
 * line and key names (pitch-detector/trace.js), and an end-to-end check:
 * voice-like tones made here (so their pitch is known) through the pitch
 * engine into the line, as the tool does it.
 *
 *   checkDetector(trace, core) -> rows [{ section, checked, failed, stats, examples }]
 *     trace = pitch-detector/trace.js, core = shared/pitch-worklet.js (without
 *     it, the end-to-end check is left out)
 *
 * Used by tests/pitch-detector.html and tests/tools/run-pitch-detector-test.js.
 */
import { TEST_SIGNALS } from './pitch-cases.js';

const { NOTES, tone, noise, concat } = TEST_SIGNALS;
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const toMidi = (f) => 69 + 12 * Math.log2(f / 440);

export function checkDetector(T, core = null) {
  const rows = [];
  const row = (section) => { const r = { section, checked: 0, failed: 0, stats: '', examples: [] }; rows.push(r); return r; };
  const fail = (r, msg) => { r.failed++; if (r.examples.length < 8) r.examples.push(msg); };

  // 1. The names on the piano keys.
  {
    const r = row('Names on the piano keys: the white keys with no key; with a key, its scale spelled as the key spells it (B♭ in F major, A♯ in B major, E♯ in F♯ major, C♭ in E♭ minor), in letters and Do Re Mi');
    const show = (names) => names.map((n, pc) => (n ? `${pc}:${n}` : '')).filter(Boolean).join(' ');
    const cases = [
      ['none', false, '0:C 2:D 4:E 5:F 7:G 9:A 11:B'],
      ['none', true, '0:Do 2:Re 4:Mi 5:Fa 7:Sol 9:La 11:Si'],
      ['0_maj', false, '0:C 2:D 4:E 5:F 7:G 9:A 11:B'],
      ['9_min', false, '0:C 2:D 4:E 5:F 7:G 9:A 11:B'],
      ['5_maj', false, '0:C 2:D 4:E 5:F 7:G 9:A 10:Bb'],
      ['5_maj', true, '0:Do 2:Re 4:Mi 5:Fa 7:Sol 9:La 10:Sib'],
      ['11_maj', false, '1:C# 3:D# 4:E 6:F# 8:G# 10:A# 11:B'],
      ['6_maj', false, '1:C# 3:D# 5:E# 6:F# 8:G# 10:A# 11:B'],
      ['3_min', false, '1:Db 3:Eb 5:F 6:Gb 8:Ab 10:Bb 11:Cb'],
      ['7_maj', false, '0:C 2:D 4:E 6:F# 7:G 9:A 11:B'],
      ['4_min', true, '0:Do 2:Re 4:Mi 6:Fa# 7:Sol 9:La 11:Si'],
    ];
    for (const [key, sol, want] of cases) {
      const got = show(T.laneNames(key, sol));
      r.checked++;
      if (got !== want) fail(r, `${key}${sol ? ' (Do Re Mi)' : ''}: ${got}, expected ${want}`);
    }
    for (const key of T.KEY_CHOICES.slice(1)) {
      r.checked++;
      if (T.laneNames(key, false).filter(Boolean).length !== 7) fail(r, `${key}: not 7 names`);
    }
  }

  // 2. The key list.
  {
    const r = row('The key list: None, then the 12 major and 12 minor keys, named as they are written (B♭ major, F♯ major, E♭ minor)');
    r.checked++;
    if (T.KEY_CHOICES.length !== 25 || T.KEY_CHOICES[0] !== 'none') fail(r, `KEY_CHOICES has ${T.KEY_CHOICES.length}`);
    const cases = [['none', false, null], ['10_maj', false, 'Bb maj'], ['6_maj', false, 'F# maj'], ['3_min', false, 'Eb min'], ['1_maj', true, 'Reb maj'], ['9_min', true, 'La min']];
    for (const [v, sol, want] of cases) {
      const k = T.keyLabel(v, sol);
      const got = k ? `${k.root} ${k.type}` : null;
      r.checked++;
      if (got !== want) fail(r, `keyLabel(${v}): ${got}, expected ${want}`);
    }
  }

  // 3. The line: glitches, breaks, steps, and the last 2 minutes.
  {
    const r = row('The line: strays (a lone octave glitch, one or two wrong frames at a note change) are smoothed away, a real step and a break are kept, and only the last 2 minutes stay');
    const tr = T.createTrace({ seconds: 120 });
    let t = 0;
    const feed = (seconds, m) => { for (const end = t + seconds; t < end - 1e-9; t += 0.02) tr.push(t, typeof m === 'function' ? m(t) : m); };
    feed(1, 69);
    tr.push(t, 81); t += 0.02;          // one frame an octave up
    feed(1, 69);
    feed(0.2, NaN);                      // a breath
    feed(0.5, 57);                       // A3, then a jump to C4 with one wrong frame between
    tr.push(t, 40); t += 0.02;
    feed(0.5, 60);
    tr.push(t, 46); t += 0.02;           // then to F4 with two wrong frames (as seen in the browser)
    tr.push(t, 58.04); t += 0.02;
    feed(0.5, 65);
    feed(0.2, NaN);
    feed(1, 71);                         // a real step to B4
    feed(0.02, 71.5);                    // keeps the last point out of the wait
    const pts = [];
    tr.forEach(-1, 1e9, (time, m) => pts.push([time, m]));
    r.checked += 6;
    if (pts.some(([, m]) => m > 75)) fail(r, 'the octave glitch is still in the line');
    if (pts.some(([, m]) => m < 56)) fail(r, 'the wrong frame at the jump from A3 to C4 is still in the line');
    if (pts.some(([time, m]) => time > 3.4 && time < 3.5 && m < 59.5)) fail(r, 'the two wrong frames at the jump from C4 to F4 are still in the line');
    if (!pts.some(([, m]) => Number.isNaN(m))) fail(r, 'the breath is not a break');
    const b4 = pts.find(([time, m]) => Math.abs(m - 71) < 0.01);
    if (!b4 || b4[0] > 3.99 + 0.03) fail(r, `the step to B4 shows at ${b4 ? fmt(b4[0]) : 'never'} s (it starts at 3.98 s)`);
    if (Math.abs(tr.average(0, 0.9) - 69) > 1e-4 || !Number.isNaN(tr.average(2.05, 2.2))) fail(r, `average: ${fmt(tr.average(0, 0.9), 4)} and ${tr.average(2.05, 2.2)} (a break)`);
    // forEach gives one point either side of the window.
    const win = [];
    tr.forEach(0.5, 0.6, (time) => win.push(time));
    r.checked++;
    if (!(win[0] < 0.5 && win[win.length - 1] > 0.6)) fail(r, `forEach(0.5, 0.6) gave ${fmt(win[0])}..${fmt(win[win.length - 1])}`);
    // 150 s in: only the last 120 s are kept.
    feed(150, 64);
    r.checked++;
    if (!(tr.newest - tr.oldest <= 120.001 && tr.newest - tr.oldest > 119.9)) fail(r, `kept ${fmt(tr.newest - tr.oldest)} s`);
    tr.clear();
    r.checked++;
    if (tr.size !== 0 || !Number.isNaN(tr.oldest)) fail(r, 'clear()');
    r.stats = `${pts.length} points for 5 s; then 150 s pushed, the last 120 s kept`;
  }

  // 3a. Octave slips (Drephie's phone test: the line swung between octaves on a held note).
  {
    const r = row('Octave slips: a held note misread an octave up or down, for one frame or many (up to half a second, even flipping back and forth), stays in its octave; a real leap that stays is redrawn where it was sung; a phrase whose start was misread is moved; a slide between octaves is drawn as it happens');
    const run = (steps) => {
      const tr = T.createTrace();
      let t = 0;
      for (const [seconds, m] of steps) for (const end = t + seconds; t < end - 1e-9; t += 0.02) tr.push(t, typeof m === 'function' ? m(t) : m);
      tr.push(t, NaN); tr.push(t + 0.02, NaN);
      const pts = [];
      tr.forEach(-1, 1e9, (time, m) => { if (!Number.isNaN(m)) pts.push([time, m]); });
      return { tr, pts };
    };
    // A held A3 with slips: 1, 3, 10 and 24 frames, up and down, and a stretch flipping every frame.
    const flip = (t) => 57 + (Math.round(t / 0.02) % 2 ? 12 : 0);
    const held = run([[0.5, 57], [0.02, 69], [0.4, 57], [0.06, 45], [0.4, 57], [0.2, 69], [0.4, 57], [0.48, 69], [0.4, 57], [0.3, flip], [0.4, 57], [0.3, (t) => 57 + 0.3 * Math.sin(t * 35)], [0.2, (t) => 69 + 0.3 * Math.sin(t * 35)], [0.3, 57]]);
    const off = held.pts.filter(([, m]) => Math.abs(m - 57) > 0.5);
    r.checked++;
    if (off.length) fail(r, `held A3 with slips: ${off.length} points left the octave, e.g. ${fmt(off[0][1])} at ${fmt(off[0][0])} s`);
    // A real leap: A3 for a second, then A4 for a second, with no slide.
    const leap = run([[1, 57], [1, 69]]);
    const wrong = leap.pts.filter(([time, m]) => (time < 0.99 ? Math.abs(m - 57) > 0.01 : time > 1.01 && Math.abs(m - 69) > 0.01));
    r.checked++;
    if (wrong.length) fail(r, `real leap A3 to A4: ${wrong.length} points in the wrong octave, e.g. ${fmt(wrong[0][1])} at ${fmt(wrong[0][0])} s`);
    // The phrase starts with 4 misread frames an octave up, then a second of the real note.
    const start = run([[0.08, 69], [1, 57]]);
    r.checked++;
    if (start.pts.some(([, m]) => Math.abs(m - 57) > 0.01)) fail(r, `misread start: ${start.pts.filter(([, m]) => Math.abs(m - 57) > 0.01).length} points left at the wrong octave`);
    // A quick slide up an octave (0.15 s), then held: drawn at once, no waiting.
    const slide = run([[0.5, 57], [0.15, (t) => 57 + 12 * (t - 0.5) / 0.15], [0.5, 69]]);
    const lateTop = slide.pts.filter(([time, m]) => time > 0.68 && time < 0.9 && Math.abs(m - 69) > 0.3);
    r.checked++;
    if (lateTop.length) fail(r, `slide up an octave: ${lateTop.length} points after it held back, e.g. ${fmt(lateTop[0][1])}`);
    // A melody with a major seventh and a minor ninth (one half step from an octave): never folded.
    const mel = run([[0.4, 57], [0.4, 68], [0.4, 57], [0.4, 70]]);
    r.checked++;
    if (!mel.pts.some(([, m]) => Math.abs(m - 68) < 0.01) || !mel.pts.some(([, m]) => Math.abs(m - 70) < 0.01)) fail(r, 'a major seventh or a minor ninth was folded');
    // latest follows the line's octave.
    const tr = T.createTrace();
    for (let t = 0; t < 0.5; t += 0.02) tr.push(t, 57);
    for (let t = 0.5; t < 0.6; t += 0.02) tr.push(t, 69);
    r.checked++;
    if (Math.abs(tr.latest - 57) > 0.01) fail(r, `latest during a slip: ${fmt(tr.latest)}, expected 57`);
  }

  // 3b. The view fits the notes on screen (Drephie).
  {
    const r = row('The view fits the notes on screen: lowest and highest with a margin, a two-octave jump whole, a single note at least 7 half steps tall, kept within the tool\'s range');
    const cases = [
      // [min, max, expected low, expected high]
      [60, 64, 58.5, 65.5],          // a third: 1.5 margin each side
      [57, 81, 54.6, 83.4],          // two octaves: a tenth (2.4) each side
      [69, 69.4, 65.7, 72.7],        // one note with vibrato: 7 half steps around it
      [33, 36, 31.5, 38.5],          // the very bottom
      [94, 95, 89.5, 96.5],          // the very top: slides down to stay within range
    ];
    for (const [mn, mx, lo, hi] of cases) {
      const v = T.fitView(mn, mx);
      r.checked++;
      if (Math.abs(v.low - lo) > 1e-6 || Math.abs(v.high - hi) > 1e-6) fail(r, `fitView(${mn}, ${mx}) = ${fmt(v.low)}..${fmt(v.high)}, expected ${lo}..${hi}`);
    }
    // extent: the notes between two times, breaks ignored.
    const tr = T.createTrace();
    let t = 0;
    const feed = (seconds, m) => { for (const end = t + seconds; t < end - 1e-9; t += 0.02) tr.push(t, m); };
    feed(1, 57); feed(0.3, NaN); feed(1, 69); feed(1, 81); feed(0.02, NaN);
    const all = tr.extent(0, 10), late = tr.extent(1.4, 2.2), none = tr.extent(1.05, 1.25);
    r.checked += 3;
    if (!all || all.min !== 57 || all.max !== 81) fail(r, `extent of everything: ${all && `${all.min}..${all.max}`}, expected 57..81`);
    if (!late || late.min !== 69 || late.max !== 69) fail(r, `extent 1.4..2.2 s: ${late && `${late.min}..${late.max}`}, expected 69..69`);
    if (none !== null) fail(r, 'extent over a break should be null');
  }

  // 4. End to end: voice-like tones through the pitch engine into the line.
  if (core) {
    const r = row('Voice-like tones through the pitch engine into the line: a held note within 1 cent, vibrato kept (not smoothed away), a slide followed, sudden note changes with nothing in between, silence and noise draw nothing');
    const sr = 48000;
    const run = (signal) => {
      const tr = T.createTrace();
      const stream = core.createPitchStream({ sampleRate: sr, minFreq: 50, maxFreq: 2000, onFrame: (f) => tr.push(f.time, f.freq ? toMidi(f.freq) : NaN) });
      for (let i = 0; i < signal.length; i += 128) stream.push(signal.subarray(i, i + 128));
      tr.push(signal.length / sr + 1, NaN);
      const pts = [];
      tr.forEach(-1, 1e9, (time, m) => pts.push([time, m]));
      return pts;
    };
    // A held A3.
    const held = run(tone(sr, 1.5, { freq: NOTES.A2 * 2, shape: 'voice', rmsDb: -25, seed: 3 })).filter(([t, m]) => t > 0.2 && !Number.isNaN(m));
    const heldErr = Math.max(...held.map(([, m]) => Math.abs(m - 57) * 100));
    r.checked++;
    if (!(heldErr < 1)) fail(r, `held A3: off by up to ${fmt(heldErr)} cents`);
    // Vibrato ±40 cents at 5.5 a second: the line swings about 80 cents.
    const vib = run(tone(sr, 2, { freq: NOTES.A4, shape: 'voice', rmsDb: -25, vibratoCents: 40, seed: 8 })).filter(([t, m]) => t > 0.3 && !Number.isNaN(m)).map(([, m]) => (m - 69) * 100);
    const swing = Math.max(...vib) - Math.min(...vib);
    r.checked++;
    if (!(swing > 70 && swing < 90)) fail(r, `vibrato: the line swings ${fmt(swing)} cents (the voice swings 80)`);
    // A wide, fast vibrato (±100 cents, 6.5 a second): still kept, not flattened.
    const wide = run(tone(sr, 2, { freq: NOTES.A4, shape: 'voice', rmsDb: -25, vibratoCents: 100, vibratoHz: 6.5, seed: 8 })).filter(([t, m]) => t > 0.3 && !Number.isNaN(m)).map(([, m]) => (m - 69) * 100);
    const wideSwing = Math.max(...wide) - Math.min(...wide);
    r.checked++;
    if (!(wideSwing > 170)) fail(r, `wide vibrato: the line swings ${fmt(wideSwing)} cents (the voice swings 200)`);
    // A slide from C4 up to G4 over a second, then held.
    const slide = run(tone(sr, 2, { freq: (t) => NOTES.C4 * Math.pow(2, Math.min(1, Math.max(0, t - 0.3)) * 7 / 12), shape: 'voice', rmsDb: -25, seed: 5 })).filter(([, m]) => !Number.isNaN(m));
    let backwards = 0;
    for (let i = 1; i < slide.length; i++) if (slide[i][1] < slide[i - 1][1] - 0.05) backwards++;
    const end = slide.filter(([t]) => t > 1.6).map(([, m]) => Math.abs(m - 67) * 100);
    r.checked += 2;
    if (backwards) fail(r, `slide: the line goes back down ${backwards} times`);
    if (!(Math.max(...end) < 2)) fail(r, `slide: ends ${fmt(Math.max(...end))} cents from G4`);
    // Sudden note changes, up and down, small and large: nothing outside the two notes.
    let strays = 0;
    for (const [a, b] of [[220, 261.63], [261.63, 220], [220, 440], [440, 220], [196, 329.63], [330, 165], [NOTES.E2, NOTES.A2], [NOTES.C5, NOTES.G5]]) {
      const pts = run(tone(sr, 1, { freq: (t) => (t < 0.5 ? a : b), shape: 'voice', rmsDb: -25, seed: 3 }));
      const lo = Math.min(toMidi(a), toMidi(b)) - 0.5, hi = Math.max(toMidi(a), toMidi(b)) + 0.5;
      const out = pts.filter(([, m]) => !Number.isNaN(m) && (m < lo || m > hi));
      strays += out.length;
      r.checked++;
      if (out.length) fail(r, `jump ${fmt(a, 0)} to ${fmt(b, 0)} Hz: ${out.length} points outside the two notes, e.g. ${fmt(out[0][1], 1)}`);
    }
    // Silence, then room noise: only breaks.
    const quiet = run(concat(new Float32Array(sr), noise(sr, 2, -40, 9)));
    r.checked++;
    if (quiet.some(([, m]) => !Number.isNaN(m))) fail(r, 'silence or noise drew a line');
    r.stats = `held A3 within ${fmt(heldErr, 3)} cents; vibrato swings ${fmt(swing, 1)} cents in the line (80 in the voice), a wide one ${fmt(wideSwing, 0)} (200); slide ends within ${fmt(Math.max(...end), 2)} cents; 8 sudden jumps, ${strays} stray points; ${quiet.length} points of silence and noise, no line`;
  }

  return rows;
}
