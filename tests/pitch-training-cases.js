/* tests/pitch-training-cases.js: known-answer checks for Pitch Training's
 * exercises and rounds (pitch-training/exercises.js) and its scoring
 * (pitch-training/score.js): made-up singing whose pitch and timing are known
 * (in tune, low, late, early, an octave lower, scoops, vibrato, slides,
 * silence), and voice-like tones made here through the pitch engine and the
 * voice's line into the score, as the tool does it.
 *
 *   checkTraining(ex, score, line, core) -> rows [{ section, checked, failed, stats, examples }]
 *     ex = pitch-training/exercises.js, score = pitch-training/score.js,
 *     line = shared/pitch-line.js, core = shared/pitch-worklet.js (without the
 *     last two, the end-to-end check is left out)
 *
 * Used by tests/pitch-training.html and tests/tools/run-pitch-training-test.js.
 */
import { TEST_SIGNALS } from './pitch-cases.js';

const { tone, noise, concat } = TEST_SIGNALS;
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

export function checkTraining(E, S, line = null, core = null) {
  const rows = [];
  const row = (section) => { const r = { section, checked: 0, failed: 0, stats: '', examples: [] }; rows.push(r); return r; };
  const fail = (r, msg) => { r.failed++; if (r.examples.length < 8) r.examples.push(msg); };
  const check = (r, ok, msg) => { r.checked++; if (!ok) fail(r, msg); };

  // 1. The exercises.
  {
    const r = row('The exercises: nine patterns in list order, their numbers for the list (1 2 3 4 5 4 3 2 1, 1 ↗ 5 ↘ 1), their span, and their notes and times at a speed');
    const want = {
      five: ['1 2 3 4 5 4 3 2 1', 7, 10], scale: ['1 2 3 4 5 6 7 8 7 6 5 4 3 2 1', 12, 16], arp: ['1 3 5 3 1', 7, 6], arp8: ['1 3 5 8 5 3 1', 12, 8],
      third: ['1 3 1', 4, 6], fifth: ['1 5 1', 7, 6], octave: ['1 8 1', 12, 6], slide5: ['1 ↗ 5 ↘ 1', 7, 7], slide8: ['1 ↗ 8 ↘ 1', 12, 7],
    };
    check(r, E.EXERCISES.map((e) => e.id).join() === Object.keys(want).join(), `order: ${E.EXERCISES.map((e) => e.id).join()}`);
    for (const [id, [dg, sp, beats]] of Object.entries(want)) {
      const ex = E.exerciseById(id);
      check(r, E.digits(ex) === dg, `${id}: digits ${E.digits(ex)}, expected ${dg}`);
      check(r, E.span(ex) === sp, `${id}: span ${E.span(ex)}, expected ${sp}`);
      check(r, E.buildRound(ex, 60, 80).beats === beats, `${id}: ${E.buildRound(ex, 60, 80).beats} beats, expected ${beats}`);
    }
    check(r, E.exerciseById('nonsense').id === 'five', 'an unknown id should give the first exercise');
    // The five-note scale on Re4 at 80: D E F# G A G F# E D, a beat (0.75 s) each, the last two beats.
    const five = E.buildRound(E.exerciseById('five'), 62, 80);
    check(r, five.parts.map((p) => p.m0).join() === '62,64,66,67,69,67,66,64,62', `five-note scale on Re4: ${five.parts.map((p) => p.m0).join()}`);
    check(r, five.parts.every((p, i) => near(p.t0, i * 0.75) && near(p.t1, i === 8 ? 7.5 : (i + 1) * 0.75) && p.m0 === p.m1), 'five-note scale times at 80 beats a minute');
    check(r, near(five.seconds, 7.5), `five-note scale lasts ${five.seconds} s, expected 7.5`);
    // The slide to the octave on Do3 at 60: hold Do3 1 s, glide to Do4 over 2 s, hold 1 s, glide down 2 s, hold 1 s.
    const sl = E.buildRound(E.exerciseById('slide8'), 48, 60);
    const shape = sl.parts.map((p) => `${p.m0}-${p.m1}@${fmt(p.t0, 0)}-${fmt(p.t1, 0)}`).join(' ');
    check(r, shape === '48-48@0-1 48-60@1-3 60-60@3-4 60-48@4-6 48-48@6-7', `slide to the octave: ${shape}`);
  }

  // 2. Voice types, starting notes and rounds.
  {
    const r = row('Voice types, starting notes and rounds: each voice type\'s note fits every exercise; the starting note stays where every round is within Do2..La6; rounds go up a half step at a time, then back down');
    const v = E.VOICES;
    check(r, v.soprano === 60 && v.mezzo === 57 && v.alto === 55 && v.tenor === 48 && v.baritone === 45 && v.bass === 41, `voices: ${JSON.stringify(v)}`);
    for (const ex of E.EXERCISES) for (const far of E.FAR_CHOICES) for (const [voice, note] of Object.entries(v)) {
      const { min, max } = E.startRange(ex, far);
      check(r, note >= min && note <= max, `${voice} (${note}) is outside ${ex.id} with ${far} up (${min}..${max})`);
    }
    const sr = E.startRange(E.exerciseById('slide8'), 12);
    check(r, sr.min === 36 && sr.max === 69, `slide to the octave, 12 up: ${sr.min}..${sr.max}, expected 36..69`);
    check(r, E.clampStart(30, E.exerciseById('five'), 5) === 36 && E.clampStart(90, E.exerciseById('five'), 5) === 81 && E.clampStart(60.4, E.exerciseById('five'), 5) === 60, 'clampStart');
    const rounds = E.roundStarts(60, 5);
    check(r, rounds.join() === '60,61,62,63,64,65,64,63,62,61,60', `rounds from 60, 5 up: ${rounds.join()}`);
    check(r, E.roundStarts(48, 12).length === 25 && E.roundStarts(48, 3).length === 7, 'round counts for 12 and 3 up');
    check(r, E.SPEEDS.slow === 60 && E.SPEEDS.medium === 80 && E.SPEEDS.fast === 100, 'speeds');
  }

  // 3. Names.
  {
    const r = row('Names: the keys named as the round\'s key spells them (Fa♯ in Re major, Si♭ in Fa major, Re♭ major not Do♯), and the starting note likewise');
    const show = (names) => names.filter(Boolean).join(' ');
    check(r, show(E.keyNames(62, true)) === 'Do# Re Mi Fa# Sol La Si', `Re major: ${show(E.keyNames(62, true))}`);
    check(r, show(E.keyNames(65, false)) === 'C D E F G A Bb', `F major: ${show(E.keyNames(65, false))}`);
    check(r, show(E.keyNames(49, false)) === 'C Db Eb F Gb Ab Bb', `Db major: ${show(E.keyNames(49, false))}`);
    const names = [[61, false, 'Db4'], [66, true, 'Fa#4'], [60, true, 'Do4'], [41, false, 'F2'], [70, true, 'Sib4'], [71, false, 'B4']];
    for (const [m, sol, want] of names) {
      const n = E.startName(m, sol);
      check(r, `${n.name}${n.octave}` === want, `startName(${m}): ${n.name}${n.octave}, expected ${want}`);
    }
  }

  // 4. A round's timeline and what it plays.
  {
    const r = row('A round\'s timeline: listen, then sing (the piano plays the pattern with a click on every beat, a count-in of four with the first strong, then you sing); sing along (the count-in sounds the first note, the piano plays while you sing); slides played by a gliding tone');
    const five = E.exerciseById('five');
    const L = E.roundPlan(five, 60, 80, 'listen');
    check(r, L.demo === 0 && near(L.countIn, 7.5) && near(L.sing, 10.5) && near(L.result, 18) && near(L.end, 21), `listen: demo ${L.demo}, count-in ${L.countIn}, sing ${L.sing}, result ${L.result}, end ${L.end}`);
    const notes = L.sounds.filter((s) => s.kind === 'note'), clicks = L.sounds.filter((s) => s.kind === 'click');
    check(r, notes.map((n) => `${n.midi}@${fmt(n.time)}`).join(' ') === '60@0.00 62@0.75 64@1.50 65@2.25 67@3.00 65@3.75 64@4.50 62@5.25 60@6.00', `listen notes: ${notes.map((n) => `${n.midi}@${fmt(n.time)}`).join(' ')}`);
    check(r, near(notes[8].dur, 1.5), `the last note lasts ${notes[8].dur} s, expected 1.5`);
    check(r, clicks.length === 14 && clicks.slice(0, 10).every((c, i) => near(c.time, i * 0.75) && c.level === 'normal'), `demo clicks: ${clicks.slice(0, 10).map((c) => fmt(c.time)).join(' ')}`);
    check(r, clicks.slice(10).map((c) => `${fmt(c.time)}${c.level === 'strong' ? '!' : ''}`).join(' ') === '7.50! 8.25 9.00 9.75', `count-in: ${clicks.slice(10).map((c) => `${fmt(c.time)}${c.level === 'strong' ? '!' : ''}`).join(' ')}`);
    check(r, L.sounds.every((s, i) => i === 0 || s.time >= L.sounds[i - 1].time), 'sounds are in time order');
    check(r, !L.sounds.some((s) => s.time >= L.sing - 1e-9), 'nothing sounds while you sing back (listen, then sing)');
    const A = E.roundPlan(five, 60, 100, 'along');
    const an = A.sounds.filter((s) => s.kind === 'note');
    check(r, A.demo === null && A.countIn === 0 && near(A.sing, 2.4) && near(A.result, 8.4) && near(A.end, 10.8), `along: count-in ${A.countIn}, sing ${A.sing}, result ${A.result}, end ${A.end}`);
    check(r, an[0].midi === 60 && an[0].time === 0 && near(an[0].dur, 1.2), `along: the count-in's note ${an[0].midi} at ${an[0].time} for ${an[0].dur} s`);
    check(r, an.slice(1).every((n, i) => near(n.time, 2.4 + i * 0.6)) && an.length === 10, 'along: the piano plays the pattern while you sing');
    check(r, A.sounds.filter((s) => s.kind === 'click').length === 4, 'along: clicks only for the count-in');
    const G = E.roundPlan(E.exerciseById('slide5'), 55, 60, 'listen');
    const gl = G.sounds.filter((s) => s.kind === 'glide');
    check(r, gl.length === 1 && !G.sounds.some((s) => s.kind === 'note'), 'a slide is played by one glide, no piano notes');
    check(r, gl[0] && gl[0].points.map(([t, m]) => `${m}@${t}`).join(' ') === '55@0 55@1 62@3 62@4 55@6 55@7', `glide points: ${gl[0] && gl[0].points.map(([t, m]) => `${m}@${t}`).join(' ')}`);
  }

  // 5. Scoring made-up singing.
  {
    const r = row('Scoring made-up singing: in tune, 30 cents low (one note and all), 20 cents low (normal and precise), late by 0.2 and 0.5 s but not a whole beat, early by 0.08 s, an octave lower, a scoop into every note, a wide vibrato, silence, notes left out, a slide followed (late, or curved as people sing it) and one not followed, a wrong note');
    const five = E.buildRound(E.exerciseById('five'), 60, 80).parts;
    const slide = E.buildRound(E.exerciseById('slide5'), 60, 80).parts;
    // Singing that follows the parts `lag` seconds late, legato, from just before to just after.
    const sing = (parts, { lag = 0, off = () => 0, octave = 0, scoop = 0, vib = 0, skip = [], hold = false, curve = false } = {}) => {
      const pts = [], end = parts[parts.length - 1].t1;
      for (let t = -0.5; t < end + 0.6; t += 0.02) {
        const u = t - lag;
        const p = parts.find((q) => u >= q.t0 && u < q.t1);
        if (!p || skip.includes(p.i)) { pts.push([t, NaN]); continue; }
        let m = hold && p.m0 !== p.m1 ? p.m0 : S.targetAt(p, u);
        // A glide sung as people do: slow at both ends, fast in the middle.
        if (curve && p.m0 !== p.m1) { const f = (u - p.t0) / (p.t1 - p.t0); m = p.m0 + (p.m1 - p.m0) * f * f * (3 - 2 * f); }
        if (scoop && u - p.t0 < 0.1) m -= scoop / 100 * (1 - (u - p.t0) / 0.1);
        m += off(p.i) / 100 + 12 * octave + (vib / 100) * Math.sin(2 * Math.PI * 5.5 * t);
        pts.push([t, m]);
      }
      return pts;
    };
    const N = S.TOLERANCE.normal, P = S.TOLERANCE.precise;
    const states = (res) => res.results.map((x) => x.state[0]).join('');
    let res = S.judgeRound(five, sing(five), N);
    check(r, res.good === 9 && res.tip.kind === 'all', `in tune: ${states(res)}, tip ${res.tip.kind}`);
    res = S.judgeRound(five, sing(five, { off: (i) => (i === 4 ? -30 : 0) }), N);
    check(r, states(res) === 'iiiiciiii' && res.tip.kind === 'one' && res.tip.part === 4 && res.tip.dir === 'low' && !res.tip.far, `the top note 30 cents low: ${states(res)}, tip ${JSON.stringify(res.tip)}`);
    check(r, Math.abs(res.results[4].cents + 30) < 2, `the top note's cents: ${fmt(res.results[4].cents)}, expected -30`);
    res = S.judgeRound(five, sing(five, { off: () => -30 }), N);
    check(r, res.good === 0 && res.tip.kind === 'most' && res.tip.dir === 'low', `every note 30 cents low: ${states(res)}, tip ${JSON.stringify(res.tip)}`);
    res = S.judgeRound(five, sing(five, { off: () => -20 }), N);
    check(r, res.good === 9, `20 cents low, normal: ${states(res)}`);
    res = S.judgeRound(five, sing(five, { off: () => -20 }), P);
    check(r, res.good === 0 && res.results.every((x) => x.state === 'close'), `20 cents low, precise: ${states(res)}`);
    res = S.judgeRound(five, sing(five, { off: () => 8 }), P);
    check(r, res.good === 9, `8 cents high, precise: ${states(res)}`);
    res = S.judgeRound(five, sing(five, { lag: 0.2 }), N);
    check(r, res.good === 9 && res.results.every((x) => x.shift >= 0.06), `late by 0.2 s: ${states(res)}, fitted ${res.results.map((x) => x.shift).join(' ')} s late`);
    res = S.judgeRound(five, sing(five, { lag: -0.08 }), N);
    check(r, res.good === 9, `early by 0.08 s: ${states(res)}`);
    res = S.judgeRound(five, sing(five, { lag: 0.5 }), N);
    check(r, res.good === 9, `late by two thirds of a beat (0.5 s) still counts: ${states(res)}`);
    res = S.judgeRound(five, sing(five, { lag: 0.75 }), N);
    check(r, res.good <= 1, `a whole beat late (each note sung over the next one's time) should not count: ${states(res)}`);
    res = S.judgeRound(five, sing(five, { octave: -1 }), N);
    check(r, res.good === 9 && res.octave === -1, `an octave lower: ${states(res)}, octave ${res.octave}`);
    res = S.judgeRound(five, sing(five, { octave: 1, off: (i) => (i === 2 ? 35 : 0) }), N);
    check(r, res.octave === 1 && states(res) === 'iicii' + 'iiii' && res.tip.dir === 'high', `an octave higher, the third note 35 cents high: ${states(res)}, octave ${res.octave}`);
    res = S.judgeRound(five, sing(five, { scoop: 60 }), N);
    check(r, res.good === 9, `a scoop from 60 cents below into every note: ${states(res)}`);
    res = S.judgeRound(five, sing(five, { vib: 50 }), N);
    check(r, res.good === 9, `a wide vibrato (±50 cents) counts by its middle: ${states(res)}`);
    res = S.judgeRound(five, sing(five, { vib: 50, off: () => -30 }), N);
    check(r, res.good === 0, `the same vibrato 30 cents low: ${states(res)}`);
    res = S.judgeRound(five, five.length ? sing(five, { skip: [0, 1, 2, 3, 4, 5, 6, 7, 8] }) : [], N);
    check(r, res.good === 0 && res.tip.kind === 'nothing' && res.results.every((x) => x.state === 'none'), `silence: ${states(res)}, tip ${res.tip.kind}`);
    res = S.judgeRound(five, sing(five, { skip: [3, 4] }), N);
    check(r, states(res) === 'iiinniiii' && res.tip.kind === 'quiet', `two notes left out: ${states(res)}, tip ${res.tip.kind}`);
    res = S.judgeRound(five, sing(five, { off: (i) => (i === 2 ? -200 : 0) }), N);
    check(r, states(res) === 'iioiiiiii' && res.tip.kind === 'one' && res.tip.far, `a whole step low on the third note: ${states(res)}, tip ${JSON.stringify(res.tip)}`);
    res = S.judgeRound(five, sing(five, { off: (i) => (i === 1 ? -35 : i === 6 ? 35 : 0) }), N);
    check(r, res.tip.kind === 'mixed', `one low, one high: tip ${JSON.stringify(res.tip)}`);
    res = S.judgeRound(slide, sing(slide, { lag: 0.15 }), N);
    check(r, res.good === 5, `a slide followed a little late: ${states(res)}`);
    res = S.judgeRound(slide, sing(slide, { curve: true }), N);
    check(r, res.good === 5, `a slide sung slowly at both ends and fast in the middle: ${states(res)}`);
    res = S.judgeRound(slide, sing(slide, { hold: true }), N);
    check(r, res.results[1].state !== 'in' && res.results[3].state !== 'in' && res.results[0].state === 'in', `a slide not followed (the start held through the glides): ${states(res)}`);
    // The fill drawn while singing.
    const prep = S.prepare(five, sing(five, { off: (i) => (i === 4 ? -30 : 0) }));
    const f0 = S.fillOf(five[0], prep.points, N), f4 = S.fillOf(five[4], prep.points, N);
    const covered = f0.reduce((a, [x, y]) => a + (y - x), 0);
    check(r, covered > 0.6 && f4.length === 0, `fill: the first note ${fmt(covered)} s of 0.75 filled, the low top note ${f4.length} stretches`);
  }

  // 6. End to end: voice-like tones through the pitch engine and the line.
  if (line && core) {
    const r = row('Voice-like tones through the pitch engine and the voice\'s line into the score: a five-note scale sung in tune with vibrato and a little late, the top note 35 cents low, an octave lower, a slide, and room noise');
    const sr = 48000, lead = 0.6;
    const toHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const run = (parts, { lag = 0.08, off = () => 0, octave = 0, vib = 0 } = {}) => {
      const end = parts[parts.length - 1].t1;
      // The voice starts `lag` after the first note's time, and sings the pattern from there.
      const freq = (u) => {
        const p = parts.find((q) => u >= q.t0 && u < q.t1) || parts[parts.length - 1];
        return toHz(S.targetAt(p, u) + off(p.i) / 100 + 12 * octave);
      };
      const voice = tone(sr, end + 0.3, { freq, shape: 'voice', rmsDb: -24, vibratoCents: vib, seed: 4 });
      const signal = concat(new Float32Array(Math.round(sr * (lead + lag))), voice, new Float32Array(sr / 2));
      const tr = line.createTrace();
      let win = 0;
      const stream = core.createPitchStream({ sampleRate: sr, minFreq: 50, maxFreq: 2000, onFrame: (f) => tr.push(f.time - win / 2, f.freq ? 69 + 12 * Math.log2(f.freq / 440) : NaN) });
      win = stream.windowSeconds;
      for (let i = 0; i < signal.length; i += 128) stream.push(signal.subarray(i, i + 128));
      tr.push(signal.length / sr + 1, NaN); tr.push(signal.length / sr + 1.02, NaN);
      const pts = [];
      tr.forEach(lead - 0.5, lead + end + 1, (t, m) => pts.push([t - lead, m]));
      return S.judgeRound(parts, pts, S.TOLERANCE.normal);
    };
    const five = E.buildRound(E.exerciseById('five'), 57, 80).parts;
    const states = (res) => res.results.map((x) => x.state[0]).join('');
    let res = run(five, { vib: 40 });
    const a = res;
    check(r, res.good === 9, `in tune, vibrato ±40, 0.08 s late: ${states(res)}`);
    res = run(five, { off: (i) => (i === 4 ? -35 : 0) });
    const b = res;
    check(r, states(res) === 'iiiiciiii' && res.tip.kind === 'one' && res.tip.dir === 'low', `the top note 35 cents low: ${states(res)}, tip ${JSON.stringify(res.tip)}`);
    check(r, Math.abs(res.results[4].cents + 35) < 3, `the top note measured ${fmt(res.results[4].cents, 1)} cents, expected -35`);
    res = run(E.buildRound(E.exerciseById('five'), 60, 80).parts, { octave: -1 });
    check(r, res.good === 9 && res.octave === -1, `an octave lower: ${states(res)}, octave ${res.octave}`);
    res = run(E.buildRound(E.exerciseById('slide5'), 57, 80).parts, { lag: 0.12 });
    const c = res;
    check(r, res.good === 5, `slide to the fifth, a little late: ${states(res)}`);
    // Room noise only: nothing heard.
    const tr = line.createTrace();
    const stream = core.createPitchStream({ sampleRate: sr, minFreq: 50, maxFreq: 2000, onFrame: (f) => tr.push(f.time, f.freq ? 69 + 12 * Math.log2(f.freq / 440) : NaN) });
    const nz = noise(sr, 8, -40, 5);
    for (let i = 0; i < nz.length; i += 128) stream.push(nz.subarray(i, i + 128));
    tr.push(9, NaN); tr.push(9.02, NaN);
    const pts = [];
    tr.forEach(0, 9, (t, m) => pts.push([t - lead, m]));
    res = S.judgeRound(five, pts, S.TOLERANCE.normal);
    check(r, res.tip.kind === 'nothing', `room noise: ${states(res)}, tip ${res.tip.kind}`);
    r.stats = `in tune: ${a.good}/9, timing fitted ${a.results.map((x) => x.shift).join(' ')} s; top note low: measured ${fmt(b.results[4].cents, 1)} cents; slide: ${c.good}/5`;
  }

  return rows;
}
