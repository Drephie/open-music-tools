/* tests/ear-trainer-course-cases.js: checks of ear-trainer/course.js (the
 * course, Beta), shared by tests/ear-trainer.html and
 * tests/tools/run-ear-trainer-test.js.
 *
 *   checkCourse(c, theory) -> [{ section, checked, failed, examples }]
 *   c: the course module; theory: shared/theory.js
 *
 * Every lesson's questions are made many times (seeded, so a failure repeats)
 * and checked against what they claim: intervals and chords through nameNotes,
 * steps against the key the opening chords set, higher/lower, same/different,
 * step/leap, melodies and progressions by their notes. Then lesson runs, the
 * path, the move from the first version's stars, the streak days, the daily
 * goal and the review of mix-ups.
 */
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
const STEPS = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const J = JSON.stringify;

export function checkCourse(c, theory) {
  const rows = [];
  const random = seeded(777);

  // --- The course's shape ---
  const shape = section('course: 8 sections, 40 units of 3 lessons, a checkpoint per section, every unit a Learn card');
  shape.check(c.SECTIONS.length === 8, () => `${c.SECTIONS.length} sections`);
  const units = c.SECTIONS.reduce((n, s) => n + s.units.length, 0);
  shape.check(units === 40 && c.LESSONS.length === 40 * 3 + 8, () => `${units} units, ${c.LESSONS.length} lessons`);
  const ids = new Set();
  c.LESSONS.forEach((l, i) => {
    shape.check(l.index === i && !ids.has(l.id) && l.pools.length > 0 && ['meet', 'practise', 'mix', 'check'].includes(l.type), () => `lesson ${i} ${l.id}`);
    ids.add(l.id);
  });
  c.SECTIONS.forEach((s) => {
    shape.check(c.LESSONS.filter((l) => l.section === c.SECTIONS.indexOf(s) && l.type === 'check').length === 1, () => `${s.id}: checkpoints`);
    s.units.forEach((u) => shape.check(u.learn.demos.length >= 1 && u.learn.demos.every((d) => d.events.length && (d.label.key || d.label.ref)),
      () => `${u.id}: learn demos`));
  });
  rows.push(shape);

  // --- Every question of every lesson ---
  const rowFor = {};
  const row = (k, name) => (rowFor[k] ||= section(name));
  const range = section('course questions: every note in a singable piano range (E2..G5)');
  const majorRoots = (events, T, mode) => {
    const named = events.slice(0, 4).map((e) => theory.nameNotes(e.notes));
    const want = mode === 'minor' ? ['min', 'min', 'maj', 'min'] : ['maj', 'maj', 'maj', 'maj'];
    return named.every((n, i) => n.kind === 'chord' && n.form.id === want[i])
      && J(named.map((n) => pc(n.notes.find((x) => x.name === n.root).midi))) === J([pc(T), pc(T + 5), pc(T + 7), pc(T)]);
  };
  const checkQ = (qn, where) => {
    const all = qn.events.flatMap((e) => e.notes);
    range.check(all.every((m) => m >= 40 && m <= 79), () => `${where}: ${all}`);
    const isChoice = qn.kind === 'melody' ? qn.answer.every((d) => qn.choices.includes(d)) : qn.choices.includes(qn.answer);
    row('choice', 'course questions: the answer is one of the buttons, at least 2 buttons').check(isChoice && qn.choices.length >= 2,
      () => `${where}: ${J(qn.answer)} in ${J(qn.choices)}`);
    if (qn.kind === 'which') {
      const r = row('which', 'Which is it?: intervals and chords by nameNotes, steps in the key set by the chords');
      if (qn.ex === 'intervals') {
        const named = theory.nameNotes(qn.notes);
        r.check(qn.notes[1] - qn.notes[0] === qn.answer && named.kind === 'interval' && named.interval === qn.answer, () => `${where}: ${qn.answer} ${qn.notes}`);
      } else if (qn.ex === 'chords') {
        const named = theory.nameNotes(qn.notes);
        r.check(named.kind === 'chord' && named.form.id === qn.answer, () => `${where}: ${qn.answer} ${qn.notes}`);
      } else {
        r.check(majorRoots(qn.events, qn.root, qn.mode) && pc(qn.notes[0] - qn.root) === STEPS[qn.mode][qn.answer - 1],
          () => `${where}: ${qn.mode} home ${qn.root} step ${qn.answer} note ${qn.notes}`);
      }
    } else if (qn.kind === 'pick') {
      const r = row('pick', 'Pick the one: the target is really first or second, the other is different');
      const [a, b] = qn.parts;
      const t = qn.answer === 'first' ? a : b, o = qn.answer === 'first' ? b : a;
      r.check(t.answer === qn.target && o.answer !== qn.target && qn.events.length === a.events.length + b.events.length
        && qn.events.filter((e) => e.tag === 'second').every((e) => e.at > c.eventsLengthOf(a.events)), () => `${where}: ${J(qn.answer)} ${t.answer} ${o.answer}`);
    } else if (qn.kind === 'hl') {
      row('hl', 'Higher or lower: the second note really is').check((qn.notes[1] > qn.notes[0]) === (qn.answer === 'higher') && qn.notes[0] !== qn.notes[1], () => `${where}: ${qn.answer} ${qn.notes}`);
    } else if (qn.kind === 'sd') {
      row('sd', 'Same or different: the notes really are').check((qn.notes[1] === qn.notes[0]) === (qn.answer === 'same'), () => `${where}: ${qn.answer} ${qn.notes}`);
    } else if (qn.kind === 'step') {
      const gap = Math.abs(qn.notes[1] - qn.notes[0]);
      row('step', 'Step or leap: 1-2 half steps is a step, 3 or more a leap').check(gap > 0 && (gap <= 2) === (qn.answer === 'step'), () => `${where}: ${qn.answer} ${qn.notes}`);
    } else if (qn.kind === 'keymode') {
      row('keymode', 'Major or minor key: the chords are those of that key').check(majorRoots(qn.events, qn.root, qn.answer), () => `${where}: ${qn.answer}`);
    } else if (qn.kind === 'melody') {
      const notes = qn.events.slice(4).map((e) => e.notes[0]);
      row('melody', 'Melodies: the key is set, each note is the step asked, no step twice in a row').check(majorRoots(qn.events, qn.root, qn.mode)
        && notes.length === qn.answer.length && notes.every((n, i) => pc(n - qn.root) === STEPS[qn.mode][qn.answer[i] - 1] && (i === 0 || qn.answer[i] !== qn.answer[i - 1])),
      () => `${where}: ${qn.mode} ${J(qn.answer)} ${notes}`);
    } else if (qn.kind === 'prog') {
      const named = qn.events.map((e) => theory.nameNotes(e.notes.slice(1)));
      const OFF = { 1: 0, 4: 5, 5: 7, 6: 9 };
      const ok = qn.pattern[0] === 1 && qn.pattern[qn.pattern.length - 1] === qn.answer && named.every((n, i) => n.kind === 'chord'
        && n.form.id === (qn.pattern[i] === 6 ? 'min' : 'maj') && pc(n.notes.find((x) => x.name === n.root).midi) === pc(qn.root + OFF[qn.pattern[i]])
        && pc(qn.events[i].notes[0]) === pc(qn.root + OFF[qn.pattern[i]]));
      row('prog', 'Progressions: starts at home, each chord is the number it claims, the last is the answer').check(ok, () => `${where}: ${J(qn.pattern)} ${named.map((n) => n.name)}`);
    }
  };
  c.LESSONS.forEach((l) => {
    for (let k = 0; k < 40; k++) {
      const run = c.createRun(l, { random });
      let qn = null, n = 0;
      while ((qn = run.next(qn)) && n < 30) { checkQ(qn, `${l.id} #${k}.${n}`); run.answer(qn, random() < 0.7); n++; }
    }
  });
  rows.push(...Object.values(rowFor), range);

  // --- Lesson runs ---
  const runs = section('lessons: 8 questions, wrong ones come back until right, stars from first tries');
  for (let k = 0; k < 200; k++) {
    const l = c.LESSONS[Math.floor(random() * c.LESSONS.length)];
    const run = c.createRun(l, { random });
    let qn = null, firsts = 0, wrong = [], count = 0, firstRight = 0;
    while ((qn = run.next(qn))) {
      const isFirst = count < 8;
      const ok = random() < 0.6;
      if (isFirst) { firsts++; if (ok) firstRight++; }
      else runs.check(J(qn.answer) === J(wrong[0]), () => `${l.id}: repeat ${J(qn.answer)}, want ${J(wrong[0])}`);
      if (!isFirst) wrong.shift();
      if (!ok) wrong.push(qn.answer);
      run.answer(qn, ok);
      count++;
      if (count > 200) break;
    }
    runs.check(firsts === 8 && run.firstRight === firstRight && run.done() && wrong.length === 0, () => `${l.id}: ${firsts} first tries, ${count} asked`);
  }
  [[8, 3], [7, 3], [6, 2], [5, 2], [4, 1], [0, 1]].forEach(([r, s]) => runs.check(c.starsForRun(r) === s, () => `${r} of 8: ${c.starsForRun(r)}, want ${s}`));
  const meet = c.LESSONS.find((l) => l.type === 'meet' && l.pools.length === 2 && l.pools[0].kind === 'pick');
  const mr = c.createRun(meet, { random });
  const kinds = [];
  for (let i = 0; i < 8; i++) { const qn = mr.next(); kinds.push(qn.kind); mr.answer(qn, true); }
  runs.check(J(kinds) === J(['pick', 'which', 'pick', 'which', 'pick', 'which', 'pick', 'which']), () => `meet: ${kinds}`);
  rows.push(runs);

  // --- The path ---
  const path = section('path: lessons open one by one, checkpoints any time, a passed checkpoint fills its section');
  const none = c.LESSONS.map(() => 0);
  path.check(c.lessonOpenIn(none, 0) && !c.lessonOpenIn(none, 1) && c.nextLessonIn(none) === 0, () => 'start');
  const firstCheck = c.LESSONS.findIndex((l) => l.type === 'check');
  path.check(c.lessonOpenIn(none, firstCheck) && firstCheck === 12, () => `first checkpoint at ${firstCheck}`);
  const two = none.slice(); two[0] = 2; two[1] = 1;
  path.check(c.lessonOpenIn(two, 2) && !c.lessonOpenIn(two, 3) && c.nextLessonIn(two) === 2, () => 'two done');
  const skipped = c.checkpointSkip(none, firstCheck, 3);
  path.check(skipped.slice(0, 13).every((s) => s === 3) && skipped[13] === 0 && c.nextLessonIn(skipped) === 13, () => `skip: ${skipped.slice(0, 15)}`);
  const kept = two.slice(); kept[0] = 3;
  path.check(c.checkpointSkip(kept, firstCheck, 2)[0] === 3 && c.checkpointSkip(kept, firstCheck, 2)[1] === 1, () => 'skip keeps stars earned');
  rows.push(path);

  // --- From the first version's stars ---
  const mig = section("first version's stars move to the matching units");
  const empty = c.migrateStars({});
  mig.check(empty.length === c.LESSONS.length && empty.every((s) => s === 0), () => 'nothing to move');
  mig.check(c.migrateStars(null).every((s) => s === 0) && c.migrateStars({ intervals: 'x' }).every((s) => s === 0), () => 'junk');
  const one = c.migrateStars({ intervals: [2] });
  const at = (id) => c.LESSONS.findIndex((l) => l.id === id);
  mig.check(one[at('iv4_7.meet')] === 2 && one[at('iv4_7.mix')] === 2 && one[at('iv12.meet')] === 0 && one.slice(0, 13).every((s) => s === 3),
    () => `intervals lesson 1: ${one.slice(0, 20)}`);
  const full = c.migrateStars({ intervals: Array(16).fill(3), chords: Array(12).fill(1), degrees: Array(8).fill(2) });
  const secOf = (id) => c.LESSONS.filter((l) => l.section === c.SECTIONS.findIndex((s) => s.id === id)).map((l) => full[l.index]);
  mig.check(secOf('up').every((s) => s === 3) && secOf('down').every((s) => s === 3) && secOf('chords').every((s) => s === 1) && secOf('degrees').every((s) => s === 2)
    && secOf('melody').every((s) => s === 0), () => `everything: up ${secOf('up')} chords ${secOf('chords')} degrees ${secOf('degrees')}`);
  mig.check(c.nextLessonIn(full) === c.LESSONS.findIndex((l) => c.SECTIONS[l.section].id === 'melody'), () => `next after everything: ${c.nextLessonIn(full)}`);
  rows.push(mig);

  // --- Days ---
  const days = section('streak days and the daily goal, one missed day forgiven once a week');
  days.check(c.dayKey(new Date(2026, 0, 5)) === '2026-01-05' && c.daysBetween('2026-02-28', '2026-03-01') === 1 && c.daysBetween('2026-12-31', '2027-01-01') === 1
    && c.daysBetween('2028-02-28', '2028-03-01') === 2, () => 'dayKey, daysBetween');
  let s = c.recordDay(null, '2026-11-01');
  days.check(s.count === 1 && c.streakNow(s, '2026-11-01') === 1 && c.streakNow(s, '2026-11-02') === 1, () => J(s));
  s = c.recordDay(s, '2026-11-01');
  days.check(s.count === 1, () => 'twice the same day');
  s = c.recordDay(s, '2026-11-02');
  days.check(s.count === 2, () => J(s));
  days.check(c.streakNow(s, '2026-11-04') === 2 && c.streakNow(s, '2026-11-05') === 0, () => 'missed one day: still there; two: broken');
  s = c.recordDay(s, '2026-11-04');   // missed the 3rd: forgiven
  days.check(s.count === 3 && s.rest === '2026-11-04', () => J(s));
  s = c.recordDay(s, '2026-11-06');   // missed the 5th: only 2 days after a rest, not forgiven
  days.check(s.count === 1 && c.streakNow(s, '2026-11-06') === 1, () => J(s));
  days.check(c.streakNow({ last: '2026-11-04', count: 3, rest: '2026-11-04' }, '2026-11-06') === 0, () => 'second miss in a week breaks it');
  let s2 = { last: '2026-11-10', count: 9, rest: '2026-11-03' };
  s2 = c.recordDay(s2, '2026-11-12');
  days.check(s2.count === 10, () => 'a week later the rest day is free again');
  days.check(c.streakNow({ last: 'junk', count: 4 }, '2026-11-01') === 0 && c.recordDay({ last: 'junk' }, '2026-11-01').count === 1, () => 'junk');
  let g = c.addToGoal(null, '2026-11-01');
  g = c.addToGoal(g, '2026-11-01');
  days.check(c.goalToday(g, '2026-11-01') === 2 && c.goalToday(g, '2026-11-02') === 0 && c.addToGoal(g, '2026-11-02').done === 1, () => J(g));
  days.check(J(c.GOALS) === '[1,2,3,5]', () => 'goals');
  rows.push(days);

  // --- Review of mix-ups ---
  const rev = section('review: mix-ups noted, a lesson of them from 3, gone after 2 right');
  const lesson = c.LESSONS.find((l) => l.id === 'iv5.practise');
  let list = [];
  const qs = [];
  for (let k = 0; k < 60 && qs.length < 3; k++) {
    const qn = c.makeCourseQuestion(lesson.pools[0], { random });
    const wrong = qn.choices.find((x) => x !== qn.answer);
    if (qs.some((x) => x.answer === qn.answer)) continue;
    qs.push(qn);
    list = c.noteMistake(list, qn, wrong);
  }
  rev.check(list.length === 2 || list.length === 3, () => `noted ${list.length}`);
  list = c.noteMistake(list, qs[0], qs[0].answer);
  const hl = c.makeCourseQuestion({ kind: 'hl', gapLo: 3, gapHi: 5 }, { random });
  rev.check(c.noteMistake(list, hl, 'x') === list || c.noteMistake(list, hl, 'x').length === list.length, () => 'only Which is it? questions are noted');
  const chq = c.makeCourseQuestion({ kind: 'which', ex: 'chords', answers: ['maj', 'min', 'dim'] }, { random, answer: 'min' });
  list = c.noteMistake(list, chq, 'maj');
  list = c.noteMistake(list, chq, 'maj');
  rev.check(list.length >= 3 && list[0].a === 'min' && list[0].b === 'maj' && list.filter((m) => m.ex === 'chords').length === 1, () => J(list));
  const pools = c.reviewPools(list);
  rev.check(pools && pools.every((p) => p.answers.length === 2 && p.answers.includes(p.review.a) && p.answers.includes(p.review.b)), () => J(pools));
  rev.check(c.reviewPools(list.slice(0, 2)) === null, () => 'under 3: no review');
  const rq = c.makeCourseQuestion(pools[0], { random, answer: 'min' });
  let after = c.noteReviewRight(list, rq);
  rev.check(after.length === list.length && after[0].ok === 1, () => J(after[0]));
  after = c.noteReviewRight(after, c.makeCourseQuestion(pools[0], { random, answer: 'min' }));
  rev.check(after.length === list.length - 1 && !after.some((m) => m.ex === 'chords'), () => 'gone after 2 right');
  let many = [];
  for (let k = 0; k < 50; k++) many = c.noteMistake(many, c.makeCourseQuestion({ kind: 'which', ex: 'intervals', answers: c.ANSWERS_ALL_IV }, { random, answer: 1 + (k % 12) }), 1 + ((k + 3) % 12));
  rev.check(many.length <= 30, () => `${many.length} kept`);
  rows.push(rev);

  return rows.map(({ check, ...r }) => r);
}
