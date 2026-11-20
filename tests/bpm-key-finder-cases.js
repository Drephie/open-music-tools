/* tests/bpm-key-finder-cases.js: checks for shared/analysis-rules.js (the BPM &
 * Key Finder's answers), shared by tests/bpm-key-finder.html and
 * tests/tools/run-bpm-key-finder-test.js.
 * checkRules(rules) -> [{ section, checked, failed, examples }]
 * The real songs (the trial's 12 free ones and Drephie's 5) are checked by
 * tests/bpm-key-finder.html only, when they are on this computer.
 */
export function checkRules(R) {
  const out = [];
  const check = (section, items, fn) => {
    const row = { section, checked: 0, failed: 0, examples: [] };
    for (const it of items) {
      row.checked++;
      let err;
      try { err = fn(it); } catch (e) { err = String(e); }
      if (err) { row.failed++; if (row.examples.length < 5) row.examples.push(err); }
    }
    out.push(row);
  };
  const K = (s) => { const [t, m] = s.split(' '); return R.parseKey(t, m === 'minor' ? 'minor' : 'major'); };
  const name = (k) => k ? `${R.keyLabel(k).root} ${k.mode === 'maj' ? 'major' : 'minor'}` : 'none';

  check('Essentia key names read as keys (24 keys, sharps and flats)', [
    ['C', 'major', 0, 'maj'], ['C#', 'minor', 1, 'min'], ['Db', 'major', 1, 'maj'], ['Eb', 'minor', 3, 'min'], ['F#', 'major', 6, 'maj'],
    ['Ab', 'minor', 8, 'min'], ['Bb', 'major', 10, 'maj'], ['B', 'minor', 11, 'min'], ['X', 'major', null], ['C', 'dorian', null],
  ], ([n, s, t, m]) => {
    const k = R.parseKey(n, s);
    if (t === null) return k === null ? null : `${n} ${s}: expected none`;
    return k && k.tonic === t && k.mode === m ? null : `${n} ${s} -> ${JSON.stringify(k)}`;
  });

  check('Key names spelled for the key', [
    ['Db major', 'Db'], ['C# minor', 'C#'], ['F# major', 'F#'], ['Eb minor', 'Eb'], ['Ab major', 'Ab'], ['G# minor', 'G#'], ['Bb major', 'Bb'], ['A minor', 'A'],
  ], ([k, root]) => (R.keyLabel(K(k)).root === root ? null : `${k}: ${R.keyLabel(K(k)).root}`));
  check('Key names in Do Re Mi', [['Db major', 'Reb'], ['F# minor', 'Fa#'], ['B major', 'Si']],
    ([k, root]) => (R.keyLabel(K(k), true).root === root ? null : `${k}: ${R.keyLabel(K(k), true).root}`));

  check('Relative keys (C major and A minor have the same notes)', [['C major', 'A minor'], ['A minor', 'C major'], ['F# major', 'D# minor'], ['Bb minor', 'Db major']],
    ([a, b]) => (R.sameKey(R.relativeOf(K(a)), K(b)) ? null : `${a} -> ${name(R.relativeOf(K(a)))}`));

  check('½ and ×2', [[123, 61.5, 246], [117.3, 58.5, 234], [156.3, 78, 312], [151.6, 76, 304], [100, 50, 200], [145.6, 73, 292], [72, 36, 144]],
    ([b, h, d]) => { const r = R.halfDouble(b); return r.half === h && r.double === d ? null : `${b}: ${r.half} / ${r.double}`; });

  // Beats at a steady 120 with a little wobble, one read at double speed: no change.
  const steady = Array.from({ length: 200 }, (_, i) => 0.5 + (i % 7 - 3) * 0.004).concat([0.25, 0.25]);
  const speeding = Array.from({ length: 200 }, (_, i) => 60 / (92 + 12 * i / 199));
  check('Tempo range: a steady song, a song that speeds up', [
    [120, steady, false], [98, speeding, true], [76, speeding.map((s) => s / 2).concat(speeding), true],
  ], ([bpm, iv, changes]) => { const r = R.tempoRange(bpm, iv); return r.changes === changes ? null : `${bpm}: ${JSON.stringify(r)}`; });
  check('Tempo range of a song from 92 to 104 reads about 93 to 103', [0], () => {
    const r = R.tempoRange(98, speeding); return r.low >= 92 && r.low <= 95 && r.high >= 101 && r.high <= 104 ? null : JSON.stringify(r);
  });

  const beats = (n, p = 0.5) => Array.from({ length: n }, (_, i) => i * p);
  check('Beat found or not', [
    [{ bpm: 120, confidence: 3, beats: beats(60) }, true], [{ bpm: 120, confidence: 0.2, beats: beats(60) }, false], [{ bpm: 110, confidence: 0.65, beats: beats(60) }, false], [{ bpm: 108, confidence: 0.98, beats: beats(60) }, true],
    [{ bpm: 0, confidence: 0, beats: [] }, false], [{ bpm: 120, confidence: 3, beats: beats(5) }, false], [{ bpm: 400, confidence: 3, beats: beats(60) }, false],
  ], ([x, ok]) => (!!R.readBeat(x) === ok ? null : `${JSON.stringify(x).slice(0, 60)}: ${!ok ? 'found' : 'not found'}`));

  const P = (keys, s = 0.8) => keys.map((k) => ({ key: K(k), strength: s }));
  const W = (keys, hop = 4) => keys.map((k, i) => ({ time: i * hop, key: k ? K(k) : null, strength: 0.7 }));
  check('Key, and what else it might be (Drephie\'s songs 1 to 5)', [
    [P(['B major', 'F# major', 'B major']), [], 'B major', 'F# major'],
    [P(['F# minor', 'F# minor', 'F# minor']), W(['C# major', 'C# minor', ...Array(12).fill('F# minor')]), 'F# minor', 'none'],
    [P(['D major', 'D major', 'D major']), W(Array(14).fill('D major')), 'D major', 'none'],
    [P(['A minor', 'A minor', 'C major']), [], 'A minor', 'C major'],
    [P(['C major', 'C major', 'C major']), W(['C major', 'G major', 'G major', 'G major', 'G major', 'C major', 'C major', 'C major']), 'C major', 'G major'],
  ], ([p, w, key, alt]) => { const r = R.readKey(p, w); return r && name(r.key) === key && name(r.alt) === alt ? null : `${key}: ${r ? name(r.key) + ' / ' + name(r.alt) : 'none'}`; });
  check('No key when nothing is clear (silence, a drum loop, noise)', [[P(['C major', 'C major', 'A minor'], 0.1), 1], [[], 1], [[{ key: null, strength: 0 }], 1],
    [P(['A minor', 'A minor', 'A minor'], 0.73), 0.98], [P(['F major', 'F major', 'C minor'], 0.83), 0.33]],
    ([p, notes]) => (R.readKey(p, [], notes) === null ? null : `found ${name(R.readKey(p, [], notes).key)}`));

  check('Key changes: a long stretch in a new key counts, wobbles and relatives don\'t', [
    [W([...Array(10).fill('C major'), ...Array(12).fill('D major')]), 'C major', ['40 D major']],
    [W([...Array(10).fill('C major'), 'F major', 'G major', 'F major', ...Array(10).fill('C major')]), 'C major', []],
    [W([...Array(8).fill('C major'), ...Array(12).fill('A minor')]), 'C major', []],
    [W(['F# major', 'B major', 'B major', 'B major', 'F# major', 'B minor', 'F# major', 'B major', 'B major']), 'B major', []],
    [W([...Array(10).fill('C major'), ...Array(10).fill('D major'), ...Array(10).fill('C major')]), 'C major', ['40 D major', '80 C major']],
    [W([...Array(10).fill('C major'), ...Array(5).fill('D major'), null, ...Array(5).fill('D major')]), 'C major', []],
  ], ([w, main, want]) => {
    const got = R.keyChanges(w, K(main)).map((c) => `${c.time} ${name(c.key)}`);
    return got.join(',') === want.join(',') ? null : `${main}: ${got.join(', ') || 'none'} (want ${want.join(', ') || 'none'})`;
  });

  check('Silence', [[new Float32Array(44100), true], [Float32Array.from({ length: 44100 }, () => (Math.random() - 0.5) * 0.002), true],
    [Float32Array.from({ length: 44100 }, (_, i) => 0.3 * Math.sin(i / 10)), false]],
  ([s, silent]) => (R.isSilent(R.soundLevel(s)) === silent ? null : `${silent ? 'not silent' : 'silent'}: ${JSON.stringify(R.soundLevel(s))}`));

  check('Tapped beats and ½ / ×2 beats', [
    () => { const b = R.evenBeats(10.2, 0.5, 12); return b[0] === 0.2 && b.includes(10.2) && b[b.length - 1] <= 12 ? null : b.slice(0, 3).join(' '); },
    () => { const b = R.scaleBeats([0, 1, 2, 3, 4], 0.5); return b.join() === '0,2,4' ? null : b.join(); },
    () => { const b = R.scaleBeats([0, 1, 2], 2); return b.join() === '0,0.5,1,1.5,2' ? null : b.join(); },
    () => (R.formatTime(102.7) === '1:42' && R.formatTime(5) === '0:05' ? null : R.formatTime(102.7)),
  ], (fn) => fn());
  return out;
}
