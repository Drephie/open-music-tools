/* tests/ear-trainer-cases.js: checks of ear-trainer/questions.js, shared by
 * tests/ear-trainer.html and tests/tools/run-ear-trainer-test.js.
 *
 *   checkQuestions(q, theory) -> [{ section, checked, failed, examples }]
 *   q: the questions module; theory: shared/theory.js
 *
 * Every generated question is checked against shared/theory.js's nameNotes,
 * which names notes on its own: an interval question's two notes must really
 * be that interval, a chord question's notes that chord in root position, and
 * a scale-degree note that step of the key the I–IV–V–I chords set.
 * Questions use a seeded random generator, so a failure repeats.
 */

// mulberry32: a small seeded random generator.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function section(name) {
  const row = { section: name, checked: 0, failed: 0, examples: [] };
  row.check = (ok, msg) => {
    row.checked++;
    if (!ok) { row.failed++; if (row.examples.length < 8) row.examples.push(msg()); }
  };
  return row;
}

const pc = (n) => ((n % 12) + 12) % 12;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export function checkQuestions(q, theory) {
  const rows = [];
  const random = seeded(12345);

  // --- The lesson lists ---
  const lists = section('lessons: valid answers, at least 2, in button order, no repeats');
  for (const ex of q.EXERCISES) {
    q.LESSONS[ex].forEach((l, i) => {
      const valid = l.answers.every((a) => q.ANSWERS[ex].includes(a));
      const ordered = l.answers.every((a, j) => j === 0 || q.ANSWERS[ex].indexOf(a) > q.ANSWERS[ex].indexOf(l.answers[j - 1]));
      lists.check(valid && ordered && l.answers.length >= 2, () => `${ex} lesson ${i + 1}: ${l.answers}`);
    });
  }
  lists.check(q.LESSONS.intervals.length === 16 && q.LESSONS.chords.length === 12 && q.LESSONS.degrees.length === 8,
    () => `lesson counts ${q.EXERCISES.map((ex) => q.LESSONS[ex].length)}, want 16 12 8`);
  rows.push(lists);

  // --- Every question of every lesson and practice choice ---
  const ivRow = section('intervals: the notes are the interval asked, played as asked');
  const chRow = section('chords: the notes are that chord, in root position');
  const dgRow = section('scale degrees: I–IV–V–I sets the key, the note is that step');
  const rangeRow = section('notes stay in a singable piano range (E2..G5)');
  const checkOne = (ex, opts, qn, where) => {
    const all = qn.events.flatMap((e) => e.notes);
    rangeRow.check(all.every((m) => m >= 40 && m <= 79) && qn.notes.every((m) => m >= 40 && m <= 79),
      () => `${where}: ${all}`);
    if (!opts.answers.includes(qn.answer)) {
      (ex === 'intervals' ? ivRow : ex === 'chords' ? chRow : dgRow).check(false, () => `${where}: answer ${qn.answer} not in ${opts.answers}`);
      return;
    }
    if (ex === 'intervals') {
      const [low, high] = qn.notes;
      const named = theory.nameNotes([low, high]);
      const wantPlay = opts.play === 'mixed' ? ['up', 'down', 'together'] : opts.play === 'updown' ? ['up', 'down'] : [opts.play];
      const first = qn.events[0].notes;
      const order = qn.play === 'together' ? qn.events.length === 1 && first.length === 2
        : qn.events.length === 2 && first[0] === (qn.play === 'down' ? high : low) && qn.events[1].notes[0] === (qn.play === 'down' ? low : high);
      ivRow.check(high - low === qn.answer && named.kind === 'interval' && named.interval === (qn.answer === 12 ? 12 : qn.answer)
        && wantPlay.includes(qn.play) && order && qn.root === (qn.play === 'down' ? high : low),
        () => `${where}: answer ${qn.answer} play ${qn.play}, notes ${qn.notes}, named ${named.kind} ${named.interval}`);
    } else if (ex === 'chords') {
      const named = theory.nameNotes(qn.notes);
      const heard = [...new Set(qn.events.flatMap((e) => e.notes))].sort((a, b) => a - b);
      chRow.check(named.kind === 'chord' && named.form.id === qn.answer && named.bass === null && qn.notes[0] === qn.root
        && JSON.stringify(heard) === JSON.stringify(qn.notes),
        () => `${where}: answer ${qn.answer}, notes ${qn.notes}, named ${named.name || named.kind}`);
    } else {
      const T = qn.root;
      const chords = qn.events.slice(0, 4).map((e) => theory.nameNotes(e.notes));
      const roots = chords.map((c) => c.kind === 'chord' && c.form.id === 'maj' ? pc(c.notes.find((n) => n.name === c.root).midi) : -1);
      const note = qn.notes[0];
      const placeOk = qn.range === 'top' ? (qn.answer === 1 ? note === T + 12 : note > T && note < T + 12)
        : qn.range === 'wide' ? note >= T - 7 && note <= T + 12 : note >= T && note < T + 12;
      dgRow.check(JSON.stringify(roots) === JSON.stringify([pc(T), pc(T + 5), pc(T + 7), pc(T)])
        && pc(note - T) === MAJOR[qn.answer - 1] && placeOk && qn.events.length === 5 && qn.events[4].notes[0] === note,
        () => `${where}: home ${T}, answer ${qn.answer}, note ${note}, range ${qn.range}, chords ${chords.map((c) => c.name)}`);
    }
  };
  for (const ex of q.EXERCISES) {
    const optionSets = q.LESSONS[ex].map((l, i) => [`${ex} lesson ${i + 1}`, l]);
    if (ex === 'intervals') q.PLAYS.intervals.forEach((p) => optionSets.push([`practice ${p}`, { answers: q.ANSWERS.intervals, play: p }]));
    if (ex === 'chords') q.PLAYS.chords.forEach((p) => optionSets.push([`practice ${p}`, { answers: q.ANSWERS.chords, play: p }]));
    if (ex === 'degrees') q.DEGREE_RANGES.forEach((r) => optionSets.push([`practice ${r}`, { answers: q.ANSWERS.degrees, range: r }]));
    for (const [where, opts] of optionSets) {
      let prev = null;
      for (let k = 0; k < 150; k++) {
        const qn = q.makeQuestion(ex, opts, { prev, random });
        checkOne(ex, opts, qn, `${where} #${k}`);
        prev = qn;
      }
    }
  }
  rows.push(ivRow, chRow, dgRow, rangeRow);

  // --- Repeats ---
  const rep = section('no question repeats the last one exactly; same answer twice in a row is rarer');
  for (const ex of q.EXERCISES) {
    const opts = q.LESSONS[ex][0];   // 2 answers: the case where repeats matter most
    let prev = null, sameAnswer = 0;
    const N = 2000;
    for (let k = 0; k < N; k++) {
      const qn = q.makeQuestion(ex, opts, { prev, random });
      if (prev) {
        rep.check(!(qn.answer === prev.answer && qn.notes[0] === prev.notes[0] && qn.root === prev.root),
          () => `${ex} #${k}: same as the last (${qn.answer}, ${qn.notes})`);
        if (qn.answer === prev.answer) sameAnswer++;
      }
      prev = qn;
    }
    rep.check(sameAnswer / N < 0.32, () => `${ex}: same answer twice in a row ${(100 * sameAnswer / N).toFixed(1)}% (want about 25%)`);
  }
  rows.push(rep);

  // --- Compare ---
  const cmp = section('compare: your answer on the same start, then the right one');
  for (const ex of q.EXERCISES) {
    const opts = { answers: q.ANSWERS[ex], play: ex === 'intervals' ? 'mixed' : ex === 'chords' ? 'mixed' : null, range: 'wide' };
    for (let k = 0; k < 300; k++) {
      const qn = q.makeQuestion(ex, opts, { random });
      const yours = q.ANSWERS[ex][Math.floor(random() * q.ANSWERS[ex].length)];
      const ev = q.compareEvents(qn, yours);
      const mine = ev.filter((e) => e.tag === 'yours'), right = ev.filter((e) => e.tag === 'right');
      const mineEnd = q.eventsLength(mine);
      let ok = mine.length > 0 && right.length > 0 && right.every((e) => e.at >= mineEnd);
      if (ex === 'intervals') {
        const notes = mine.flatMap((e) => e.notes);
        const first = mine[0].notes[0];
        ok = ok && Math.abs(Math.max(...notes) - Math.min(...notes)) === yours && first === (qn.play === 'together' ? Math.min(...notes) : qn.root)
          && JSON.stringify(right.map((e) => e.notes)) === JSON.stringify(qn.events.map((e) => e.notes));
      } else if (ex === 'chords') {
        const notes = [...new Set(mine.flatMap((e) => e.notes))].sort((a, b) => a - b);
        const named = theory.nameNotes(notes);
        ok = ok && named.kind === 'chord' && named.form.id === yours && notes[0] === qn.root;
      } else {
        const myNote = mine[1].notes[0], rightNote = right[1].notes[0];
        ok = ok && pc(myNote - qn.root) === MAJOR[yours - 1] && rightNote === qn.notes[0]
          && JSON.stringify(mine[0].notes) === JSON.stringify([qn.root - 12, qn.root, qn.root + 4, qn.root + 7]);
      }
      cmp.check(ok, () => `${ex}: question ${qn.answer} ${qn.play || qn.range} ${qn.notes}, yours ${yours}: ${JSON.stringify(ev)}`);
    }
  }
  rows.push(cmp);

  // --- The streak game ---
  const game = section('streak game: starts with 2 answers, one more every 5, then harder');
  for (const ex of q.EXERCISES) {
    let last = null;
    for (let score = 0; score <= 120; score++) {
      const st = q.gameStage(ex, score);
      const n = Math.min(q.ANSWERS[ex].length, 2 + Math.floor(score / q.GAME_STEP));
      game.check(st.answers.length === n && st.answers.every((a) => q.ANSWERS[ex].includes(a))
        && (!last || last.answers.every((a) => st.answers.includes(a))),
        () => `${ex} at ${score}: ${st.answers}`);
      last = st;
    }
  }
  const at = (ex, s) => q.gameStage(ex, s);
  game.check(JSON.stringify(at('intervals', 0).answers) === '[4,7]' && at('intervals', 0).play === 'up', () => `intervals start ${JSON.stringify(at('intervals', 0))}`);
  game.check(at('intervals', 54).play === 'up' && at('intervals', 55).play === 'updown' && at('intervals', 60).play === 'mixed', () => 'intervals: up, then up and down at 55, mixed at 60');
  game.check(at('degrees', 29).range === 'octave' && at('degrees', 30).range === 'wide', () => 'degrees: wide from 30');
  game.check(JSON.stringify(at('chords', 0).answers) === '["maj","min"]' && at('chords', 45).answers.length === 11, () => 'chords: major and minor first, all 11 at 45');
  rows.push(game);

  // --- Stars and unlocking ---
  const stars = section('stars by mistakes, lessons open one by one');
  [[0, 3], [1, 3], [2, 2], [4, 2], [5, 1], [12, 1]].forEach(([m, s]) => stars.check(q.starsFor(m) === s, () => `${m} mistakes: ${q.starsFor(m)} stars, want ${s}`));
  stars.check(q.lessonOpen([], 0) && !q.lessonOpen([], 1) && q.lessonOpen([2], 1) && !q.lessonOpen([2, 0], 2) && q.lessonOpen([3, 1], 2),
    () => 'lessonOpen');
  rows.push(stars);

  return rows.map(({ check, ...r }) => r);
}
