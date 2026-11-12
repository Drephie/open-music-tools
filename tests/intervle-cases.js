/* tests/intervle-cases.js: checks for intervle/game.js and its year of puzzles,
 * shared by tests/intervle.html and tests/tools/run-intervle-test.js.
 * checkGame(game, theory) -> [{ section, checked, failed, examples }]
 */
export function checkGame(game, theory) {
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
  const days = Array.from({ length: 365 * 3 }, (_, i) => i + 1);
  const { CHORDS, puzzle } = game;

  check('Easy: two notes, the second above, the answer is the distance', days, (n) => {
    const p = puzzle('easy', n), [a, b] = p.events.map((e) => e.notes[0]);
    if (b - a !== p.answer || p.answer < 1 || p.answer > 12) return `#${n}: ${a} ${b} answer ${p.answer}`;
    const named = theory.nameNotes([a, b], false);
    if (!named || named.kind !== 'interval') return `#${n}: nameNotes says ${named && named.kind}`;
    if (a < 36 || b > 90) return `#${n}: out of range ${a} ${b}`;
  });
  check('Medium: second note within an octave, above or below; answer is its note', days, (n) => {
    const p = puzzle('medium', n), [a, b] = p.events.map((e) => e.notes[0]);
    const d = Math.abs(b - a);
    if (a !== p.ref || d < 1 || d > 12 || ((b % 12) + 12) % 12 !== p.answer) return `#${n}: ${a} ${b} answer ${p.answer}`;
  });
  check('Hard: the told note is the root, the lowest note; the chord is the answer', days, (n) => {
    const p = puzzle('hard', n), chord = p.events[p.events.length - 1].notes;
    const root = Math.min(...chord);
    if ((root - p.ref) % 12 !== 0 || (root !== p.ref && root !== p.ref - 12)) return `#${n}: ref ${p.ref} root ${root}`;
    if (chord.map((m) => m - root).join() !== CHORDS[p.answer].join()) return `#${n}: ${chord} is not ${p.answer}`;
    const one = p.events.slice(1, -1).map((e) => e.notes[0]).join();
    if (one !== chord.join()) return `#${n}: one by one ${one}, together ${chord}`;
  });
  for (const mode of game.MODES) {
    const list = days.slice(0, 365).map((n) => puzzle(mode, n).answer);
    check(`${mode}: no answer twice in a row, every answer about as often`, [list], (l) => {
      for (let i = 1; i < l.length; i++) if (l[i] === l[i - 1]) return `#${i + 1} repeats ${l[i]}`;
      const counts = game.ANSWERS[mode].map((a) => l.filter((x) => x === a).length);
      if (Math.max(...counts) - Math.min(...counts) > 1) return `counts ${counts}`;
    });
    check(`${mode}: the second year is in other notes`, days.slice(0, 365), (n) => {
      const a = puzzle(mode, n), b = puzzle(mode, n + 365);
      if (a.answer !== b.answer && mode !== 'medium') return `#${n}: answer changed`;
      if (a.events[0].notes[0] === b.events[0].notes[0]) return `#${n}: same note`;
    });
  }
  check('Day numbers from local dates', [
    [new Date(2026, 10, 7), 1], [new Date(2026, 10, 12, 23, 59), 6], [new Date(2026, 10, 13, 0, 0), 7],
    [new Date(2026, 10, 30), 24], [new Date(2026, 11, 1), 25], [new Date(2027, 2, 28, 12), 142],
    [new Date(2027, 2, 29), 143], [new Date(2027, 10, 7), 366], [new Date(2026, 10, 6), 0],
  ], ([d, want]) => {
    const n = game.dayNumber(d);
    if (n !== want) return `${d.toDateString()}: ${n}, want ${want}`;
    if (n >= 1 && game.dayNumber(game.dateOf(n)) !== n) return `dateOf(${n}) round trip`;
  });
  check('Typed answers', [
    ['easy', '4', 4], ['easy', 'm3', 3], ['easy', 'M3', 4], ['easy', 'maj 3', 4], ['easy', 'P5', 7], ['easy', 'minor 7th', 10],
    ['easy', 'tritone', 6], ['easy', 'octave', 12], ['easy', 'p4', 5], ['easy', '13', null], ['easy', 'm5', null], ['easy', 'terza maggiore', 4, { 4: ['Terza maggiore'] }],
    ['medium', 'E', 4], ['medium', 'Mi', 4], ['medium', 'eb', 3], ['medium', 'Re#', 3], ['medium', 'C♯', 1], ['medium', 'Sib', 10], ['medium', 'Cb', 11], ['medium', 'H', null],
    ['hard', 'sus4', 'sus4'], ['hard', 'SUS 2', 'sus2'], ['hard', '7', '7'], ['hard', 'dom7', '7'], ['hard', 'maj7', 'maj7'], ['hard', 'min7', 'm7'], ['hard', '6th', '6'], ['hard', '9', '9'], ['hard', 'add9', null],
  ], ([mode, text, want, names]) => {
    const got = game.parseAnswer(mode, text, names);
    if (got !== want) return `${mode} "${text}": ${got}, want ${want}`;
  });
  check('Tries', [[[], 4, 'open'], [[3, 4], 4, 'won'], [[1, 2, 3], 4, 'lost'], [[1, 2, 4], 4, 'won']], ([tries, a, want]) => {
    const s = game.status(tries, a);
    if (s !== want) return `${tries}: ${s}, want ${want}`;
  });
  return out;
}
