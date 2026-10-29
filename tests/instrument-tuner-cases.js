/* tests/instrument-tuner-cases.js: known-answer checks for the Instrument
 * Tuner's tunings and string matching (instrument-tuner/tunings.js), and an
 * end-to-end check: plucked strings of every tuning, made here so their pitch
 * is known, through the pitch engine, the display smoother and matchString,
 * as the tool does it.
 *
 *   checkTuner(tunings, core, main) -> rows [{ section, checked, failed, stats, examples }]
 *     tunings = instrument-tuner/tunings.js, core = shared/pitch-worklet.js,
 *     main = shared/pitch.js
 *
 * Used by tests/instrument-tuner.html and tests/tools/run-instrument-tuner-test.js.
 */
import { TEST_SIGNALS } from './pitch-cases.js';

const { pluck, cents } = TEST_SIGNALS;
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const freqOf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const detune = (f, c) => f * Math.pow(2, c / 1200);

// What each tuning must be: MIDI numbers, letter names and Do Re Mi names.
const EXPECTED = {
  'guitar-standard': [[40, 45, 50, 55, 59, 64], 'E A D G B E', 'Mi La Re Sol Si Mi'],
  'guitar-drop-d': [[38, 45, 50, 55, 59, 64], 'D A D G B E', 'Re La Re Sol Si Mi'],
  'guitar-half-down': [[39, 44, 49, 54, 58, 63], 'Eb Ab Db Gb Bb Eb', 'Mib Lab Reb Solb Sib Mib'],
  'guitar-dadgad': [[38, 45, 50, 55, 57, 62], 'D A D G A D', 'Re La Re Sol La Re'],
  'guitar-open-g': [[38, 43, 50, 55, 59, 62], 'D G D G B D', 'Re Sol Re Sol Si Re'],
  'guitar-open-d': [[38, 45, 50, 54, 57, 62], 'D A D F# A D', 'Re La Re Fa# La Re'],
  'bass-4': [[28, 33, 38, 43], 'E A D G', 'Mi La Re Sol'],
  'bass-5': [[23, 28, 33, 38, 43], 'B E A D G', 'Si Mi La Re Sol'],
  ukulele: [[67, 60, 64, 69], 'G C E A', 'Sol Do Mi La'],
  'ukulele-low-g': [[55, 60, 64, 69], 'G C E A', 'Sol Do Mi La'],
  'ukulele-baritone': [[50, 55, 59, 64], 'D G B E', 'Re Sol Si Mi'],
  violin: [[55, 62, 69, 76], 'G D A E', 'Sol Re La Mi'],
  viola: [[48, 55, 62, 69], 'C G D A', 'Do Sol Re La'],
  cello: [[36, 43, 50, 57], 'C G D A', 'Do Sol Re La'],
  chromatic: [[], '', ''],
};

export function checkTuner(T, core, main) {
  const rows = [];
  const row = (section) => { const r = { section, checked: 0, failed: 0, stats: '', examples: [] }; rows.push(r); return r; };
  const fail = (r, msg) => { r.failed++; if (r.examples.length < 8) r.examples.push(msg); };
  const stringed = T.TUNINGS.filter((t) => t.notes.length);

  // 1. The tunings themselves.
  {
    const r = row('Every tuning: the strings\' notes, spelled as the tuning spells them (E♭ A♭ D♭ G♭ B♭ E♭ in half step down, F♯ in open D), in letters and in Do Re Mi');
    r.checked++;
    if (T.TUNINGS.length !== Object.keys(EXPECTED).length) fail(r, `${T.TUNINGS.length} tunings, expected ${Object.keys(EXPECTED).length}`);
    for (const tuning of T.TUNINGS) {
      const want = EXPECTED[tuning.id];
      r.checked++;
      if (!want) { fail(r, `unexpected tuning ${tuning.id}`); continue; }
      const strings = T.stringsOf(tuning);
      const midis = strings.map((s) => s.midi).join(' ');
      const letters = strings.map((s) => T.stringName(s, false)).join(' ');
      const solfege = strings.map((s) => T.stringName(s, true)).join(' ');
      if (midis !== want[0].join(' ')) fail(r, `${tuning.id}: MIDI ${midis}, expected ${want[0].join(' ')}`);
      if (letters !== want[1]) fail(r, `${tuning.id}: "${letters}", expected "${want[1]}"`);
      if (solfege !== want[2]) fail(r, `${tuning.id}: "${solfege}", expected "${want[2]}"`);
      if (strings.some((s, i) => `${T.stringName(s, false)}${s.octave}` !== tuning.notes[i])) fail(r, `${tuning.id}: octave numbers don't match the notes`);
    }
    r.checked++;
    if (T.tuningById('nonsense') !== T.TUNINGS[0] || T.tuningById('cello').id !== 'cello') fail(r, 'tuningById');
  }

  // 2. The range each tuning listens to.
  {
    const r = row('Each tuning\'s range of notes: down to six half steps below its lowest string, up past the 12th-fret harmonic of its highest');
    const stats = [];
    for (const tuning of T.TUNINGS) {
      const { minFreq, maxFreq } = T.rangeOf(tuning);
      const midis = T.stringsOf(tuning).map((s) => s.midi);
      r.checked++;
      if (!midis.length) {
        if (minFreq > 41.2 * 0.9 || maxFreq < 1975) fail(r, `chromatic: ${minFreq}..${maxFreq} Hz should reach from a bass's low E to B6`);
      } else {
        const lo = freqOf(Math.min(...midis)), hi = freqOf(Math.max(...midis));
        if (minFreq > detune(lo, -600)) fail(r, `${tuning.id}: min ${minFreq} Hz, lowest string ${fmt(lo)} Hz`);
        if (maxFreq < detune(2 * hi, 100)) fail(r, `${tuning.id}: max ${maxFreq} Hz, highest string's harmonic ${fmt(2 * hi)} Hz`);
      }
      stats.push(`${tuning.id} ${minFreq}-${maxFreq}`);
    }
    r.stats = stats.join(', ');
  }

  // 3. matchString: every string, in tune and off by up to 45 cents.
  {
    const r = row('Finding the string: every string of every tuning, in tune and up to 45 cents off, is found with the right cents');
    for (const tuning of stringed) {
      const strings = T.stringsOf(tuning);
      strings.forEach((s, i) => {
        for (const c of [-45, -20, -3, 0, 3, 20, 45]) {
          const m = T.matchString(detune(freqOf(s.midi), c), tuning);
          r.checked++;
          if (!m || strings[m.index].midi !== s.midi || Math.abs(m.cents - c) > 0.01 || m.harmonic) fail(r, `${tuning.id} ${s.note} ${c > 0 ? '+' : ''}${c}: got ${m ? `${strings[m.index].note} ${fmt(m.cents)}${m.harmonic ? ' (harmonic)' : ''}` : 'nothing'}`);
        }
      });
    }
    r.checked++;
    if (T.matchString(440, T.tuningById('chromatic')) !== null || T.matchString(0, T.TUNINGS[0]) !== null) fail(r, 'no strings, or no pitch, should give null');
  }

  // 4. The 12th-fret harmonic, tap to stay, and a pitch between two strings.
  {
    const r = row('The 12th-fret harmonic counts for its string; tap to stay keeps the string however far off; a pitch between two strings stays on the one shown');
    const std = T.tuningById('guitar-standard');
    const cases = [
      // [label, freq, options, expected index, expected cents, harmonic]
      ['E2 string\'s harmonic (E3)', 2 * freqOf(40), {}, 0, 0, true],
      ['A2 string\'s harmonic, 10 cents low', detune(2 * freqOf(45), -10), {}, 1, -10, true],
      ['B3 string\'s harmonic (B4) +20', detune(2 * freqOf(59), 20), {}, 4, 20, true],
      ['A2 tuned 3 half steps low (F#2) is taken for E2', detune(freqOf(45), -300), {}, 0, 200, false],
      ['... unless you stay on A2', detune(freqOf(45), -300), { lock: 1 }, 1, -300, false],
      ['staying on A2, its harmonic +5', detune(2 * freqOf(45), 5), { lock: 1 }, 1, 5, true],
      ['staying on E4, 70 cents high', detune(freqOf(64), 70), { lock: 5 }, 5, 70, false],
      ['270 cents above A2 (nearer D3), A2 shown last: stays on A2', detune(freqOf(45), 270), { prev: 1 }, 1, 270, false],
      ['230 cents above A2 (nearer A2), D3 shown last: stays on D3', detune(freqOf(45), 230), { prev: 2 }, 2, -270, false],
      ['230 cents above A2, nothing shown before: A2', detune(freqOf(45), 230), {}, 1, 230, false],
      ['a new string (D3) after A2: D3', freqOf(50), { prev: 1 }, 2, 0, false],
      ['G3 to B3 (only 4 half steps apart)', freqOf(59), { prev: 3 }, 4, 0, false],
    ];
    for (const [label, f, opts, index, c, harmonic] of cases) {
      const m = T.matchString(f, std, opts);
      r.checked++;
      if (!m || m.index !== index || Math.abs(m.cents - c) > 0.01 || m.harmonic !== harmonic) fail(r, `${label}: got ${m ? `string ${m.index} ${fmt(m.cents)}${m.harmonic ? ' (harmonic)' : ''}` : 'nothing'}, expected string ${index} ${c}${harmonic ? ' (harmonic)' : ''}`);
    }
    // In DADGAD the D3 string's harmonic is the D4 string's note: the D4 string.
    const dad = T.tuningById('guitar-dadgad');
    const m = T.matchString(2 * freqOf(50), dad);
    r.checked++;
    if (!m || m.index !== 5 || m.harmonic) fail(r, `DADGAD D3's harmonic: got string ${m && m.index}, expected the D4 string (5)`);
    // A 5-string bass's low B harmonic is B1, which is not near any string: the low B.
    const b5 = T.tuningById('bass-5');
    const b = T.matchString(2 * freqOf(23), b5);
    r.checked++;
    if (!b || b.index !== 0 || !b.harmonic) fail(r, `bass low B's harmonic: got string ${b && b.index}`);
  }

  // 5. The filled circles.
  {
    const r = row('Tuned marks: a string fills after half a second in tune and empties after a second clearly off; a short slip or a sharp pluck doesn\'t count');
    const marks = T.createTunedMarks(3, { tolerance: 5 });
    let t = 0;
    const feed = (seconds, index, c) => { let changed = false; for (const end = t + seconds; t < end - 1e-9; t += 0.02) changed = marks.push(t, index, c) || changed; return changed; };
    const expect = (label, want) => { r.checked++; if (marks.marks.join() !== want.join()) fail(r, `${label}: marks ${marks.marks.join()}, expected ${want.join()}`); };
    feed(0.4, 0, 3); expect('0.4 s in tune', [false, false, false]);
    feed(0.2, 0, 3); expect('0.6 s in tune', [true, false, false]);
    feed(2, 0, 8); expect('then 8 cents off for 2 s (under 10)', [true, false, false]);
    feed(0.8, 0, -15); expect('then 15 cents off for 0.8 s', [true, false, false]);
    feed(0.3, 0, -15); expect('then 15 cents off for 1.1 s', [false, false, false]);
    feed(0.3, 1, 0); feed(0.1, null, 0); feed(0.3, 1, 0); expect('two 0.3 s readings with silence between', [false, false, false]);
    feed(0.3, 2, 2); feed(0.3, 1, 2); expect('0.3 s each on two strings', [false, false, false]);
    feed(0.6, 1, 1); feed(0.6, 2, -4); feed(0.6, 0, 0);
    r.checked++;
    if (!marks.all) fail(r, 'all three tuned: .all should be true');
    marks.setTolerance(2);
    feed(1.2, 0, 4.5); expect('Hard mode (2 cents): 4.5 cents off for 1.2 s keeps the mark', [true, true, true]);
    marks.clear(); feed(1, 0, 3); expect('Hard mode, after clear: 3 cents for 1 s', [false, false, false]);
    feed(0.6, 0, 1.5); expect('Hard mode: 1.5 cents for 0.6 s', [true, false, false]);
  }

  // 6. End to end: plucked strings through the engine, the smoother and matchString.
  {
    const r = row('Plucked strings of every tuning, played in tune, 30 cents low and 25 cents high, through the pitch engine, the calm display and matchString: the right string from 0.4 s on, the cents within 1, and an in-tune string gets its mark');
    let worst = 0, readings = 0, latest = 0;
    const sr = 24000;
    for (const tuning of stringed) {
      const range = T.rangeOf(tuning);
      T.stringsOf(tuning).forEach((s, i) => {
        for (const c of [0, -30, 25]) {
          const f = detune(freqOf(s.midi), c);
          const sig = pluck(sr, 1.6, f, { phone: s.midi < 45 ? 120 : 0, seed: s.midi + 100 * (c + 50) });
          const smoother = main.createPitchSmoother({ speed: 'calm', holdMs: 1000 });
          const marks = T.createTunedMarks(tuning.notes.length, { tolerance: 5 });
          let prev = null, wrong = 0, off = 0, firstRight = null;
          const stream = core.createPitchStream({ sampleRate: sr, ...range, onFrame: (fr) => {
            const shown = smoother.push(fr);
            const m = shown ? T.matchString(shown.freq, tuning, { prev }) : null;
            marks.push(fr.time, m ? m.index : null, m ? m.cents : 0);
            if (m) prev = m.index;
            if (fr.time < 0.4) { if (m && m.index === i && firstRight === null) firstRight = fr.time; return; }
            readings++;
            if (!m || T.stringsOf(tuning)[m.index].midi !== s.midi) wrong++;
            else { off = Math.max(off, Math.abs(m.cents - c)); if (firstRight === null) firstRight = fr.time; }
          } });
          for (let k = 0; k < sig.length; k += 128) stream.push(sig.subarray(k, k + 128));
          r.checked += 3;
          worst = Math.max(worst, off);
          latest = Math.max(latest, firstRight ?? Infinity);
          const label = `${tuning.id} ${s.note} ${c ? (c > 0 ? '+' : '') + c : 'in tune'}`;
          if (wrong) fail(r, `${label}: ${wrong} readings on the wrong string or none`);
          if (off > 1) fail(r, `${label}: cents off by up to ${fmt(off)}`);
          if ((c === 0) !== marks.marks[i]) fail(r, `${label}: mark is ${marks.marks[i]}`);
        }
      });
    }
    r.stats = `${readings} readings after 0.4 s; cents within ${fmt(worst, 3)} of the truth; the string found within ${fmt(latest * 1000, 0)} ms`;
  }

  return rows;
}
