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
