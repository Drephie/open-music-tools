/* ear-trainer/course.js: the Ear Trainer's course (Beta; spec: specs/ear-trainer-course.md).
 * Pure functions: no DOM, no Tone, no storage. Notes are MIDI numbers (C4 = 60).
 *
 *   SECTIONS         [{ id, units: [{ id, learn, lessons }] }]: 8 sections,
 *                    40 units; each unit has 3 lessons (meet, practise, mix),
 *                    each section ends with a checkpoint lesson. learn: the
 *                    Learn card { demos: [{ label, events }] } (its title and
 *                    text are strings 'u_<unit id>' and 'u_<unit id>_t').
 *   LESSONS          every lesson in path order: { id, index, section, unit,
 *                    type: 'meet' | 'practise' | 'mix' | 'check', pools }
 *                    pools: [{ w, kind, ... }] (what its questions are made of)
 *   LESSON_LENGTH    8 questions
 *   KINDS            'which' (ex, answers, play, range, mode, focus): as the
 *                    first version; 'hl' higher or lower; 'sd' same or different;
 *                    'step' step or leap; 'pick' (ex, target, others, play):
 *                    two sounds, which one is the target; 'melody' (answers,
 *                    length, mode): tap the steps in order; 'prog' (patterns):
 *                    which is the last chord; 'keymode': major or minor key
 *   makeCourseQuestion(pool, { prev, random, answer })
 *     -> { kind, ex, choices, answer, events, ...(the which question's fields) }
 *     choices: what the buttons are (answer values); for 'melody' the answer is
 *     a list of steps, entered one tap at a time
 *   isRight(question, entered)   entered: a choice, or for 'melody' the list
 *   createRun(lesson | pools, { random })   one lesson being played:
 *     run.next(prev) -> the next question, or null when done; run.answer(q, ok)
 *     run.firstRight, run.asked (first tries), run.redo (wrong ones to repeat),
 *     run.done(); a wrong question comes back at the end until it is right
 *   starsForRun(firstRight, total)   3 (7-8 of 8), 2 (5-6), 1 (less)
 *   lessonOpenIn(stars, i)   i is the first lesson, or the one before has stars,
 *                            or it is a checkpoint (those can always be tried)
 *   nextLessonIn(stars)      the first open lesson without stars (or the last)
 *   checkpointSkip(stars, i, stars) a passed checkpoint (7 of 8 at first try)
 *                            gives its stars to every lesson of its section
 *                            that has none
 *   migrateStars(old)        old: { intervals, chords, degrees } star lists of the
 *                            first version -> course stars (one per lesson)
 *   dayKey(date)             'YYYY-MM-DD' in local time; daysBetween(a, b)
 *   recordDay(streak, today) -> new streak { last, count, rest } after a lesson
 *                            today; one missed day is forgiven once a week
 *   streakNow(streak, today) the count to show (0 when it has broken)
 *   addToGoal(goal, today)   -> { day, done } with one more lesson today
 *   goalToday(goal, today)   lessons done today
 *   GOALS                    [1, 2, 3, 5] (2 by default)
 *   noteMistake(list, q, yours)  -> the list with this mix-up (which questions
 *                            only), newest first, at most 30
 *   reviewPools(list)        -> pools for a review lesson (null if under 3)
 *   noteReviewRight(list, q) -> the list after a right review answer: a mix-up
 *                            leaves after 2
 *   REVIEW_MIN               3
 */
import {
  ANSWERS, makeQuestion, eventsLength, cadence, homeChord, scaleSteps, degreePlaces,
} from './questions.js';

export const LESSON_LENGTH = 8;
export const GOALS = [1, 2, 3, 5];
export const REVIEW_MIN = 3;
const MAX_MISTAKES = 30;

const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];
const pickInt = (lo, hi, random) => lo + Math.floor(random() * (hi - lo + 1));
const ALL_IV = ANSWERS.intervals;
const UP_SIX = [2, 3, 4, 5, 7, 12];
const ALL_DEG = ANSWERS.degrees;

// --- Making the pools (what a lesson's questions are made of) ---
const which = (ex, answers, extra = {}) => ({ kind: 'which', ex, answers, w: 1, ...extra });
const pickOne = (ex, target, others, extra = {}) => ({ kind: 'pick', ex, target, others, w: 1, ...extra });
const w = (weight, pool) => ({ ...pool, w: weight });

// --- Sounds of the Learn cards (fixed, around middle C) ---
const ivDemo = (semis, play = 'up', low = 60) => {
  if (play === 'together') return [{ at: 0, notes: [low, low + semis], dur: 1.8 }];
  const [a, b] = play === 'down' ? [low + semis, low] : [low, low + semis];
  return [{ at: 0, notes: [a], dur: 0.9 }, { at: 0.9, notes: [b], dur: 1.4 }];
};
const CHORD_STEPS = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7],
  7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9] };
const chordDemo = (id, root = 55) => [{ at: 0, notes: CHORD_STEPS[id].map((i) => root + i), dur: 2 }];
const degreeDemo = (degrees, mode = 'major', T = 60) => {
  const ev = cadence(T, mode);
  degrees.forEach((d, i) => ev.push({ at: 3.0 + i * 0.7, notes: [T + scaleSteps(mode)[d - 1]], dur: i === degrees.length - 1 ? 1.3 : 0.65 }));
  return ev;
};
const iv = (a) => ({ ref: ['iv', a] }), ch = (a) => ({ ref: ['c', a] }), dg = (a) => ({ ref: ['d', a] });
const label = (key) => ({ key });

// The chords of a key around home T (I, IV, V, vi; i, iv in minor), with a bass note.
export function progChord(T, n) {
  const V = { 1: [T - 12, T, T + 4, T + 7], 4: [T - 7, T, T + 5, T + 9], 5: [T - 5, T - 1, T + 2, T + 7], 6: [T - 3, T, T + 4, T + 9] };
  return V[n];
}
const progEvents = (T, pattern) => pattern.map((n, i) => ({ at: i * 0.85, notes: progChord(T, n), dur: i === pattern.length - 1 ? 1.4 : 0.8 }));

// --- THE COURSE ---
// unit(id, learn demos, [meet pools], [practise pools], [mix pools])
const unit = (id, demos, meet, practise, mix) => ({ id, learn: { demos }, pools: { meet, practise, mix } });

const HL = (gapLo, gapHi) => ({ kind: 'hl', gapLo, gapHi, w: 1 });
const SD = (gapLo, gapHi) => ({ kind: 'sd', gapLo, gapHi, w: 1 });
const STEP = (leapLo) => ({ kind: 'step', leapLo, w: 1 });

// Interval units going up: the new answers, what they are practised against,
// and every interval known by then (for the Mix lesson).
const UP_UNITS = [
  ['iv4_7', [4, 7], [4, 7]],
  ['iv12', [12], [7, 12]],
  ['iv5', [5], [5, 7]],
  ['iv2', [2], [2, 4]],
  ['iv3', [3], [3, 4]],
  ['iv9', [9], [7, 9, 12]],
  ['iv8', [8], [8, 9]],
  ['iv10_11', [10, 11], [10, 11, 12]],
  ['iv1_6', [1, 6], [1, 2, 6, 7]],
];
const sortIv = (list) => ALL_IV.filter((a) => list.includes(a));
function upUnits() {
  let known = [1, 2];   // the half and whole step from Sound basics
  return UP_UNITS.map(([id, fresh, practise]) => {
    known = sortIv([...known, ...fresh]);
    const contrast = practise.filter((a) => !fresh.includes(a));
    const meetPick = fresh.length > 1
      ? pickOne('intervals', fresh[0], [fresh[1]])
      : pickOne('intervals', fresh[0], contrast.length ? contrast : [7]);
    return unit(id,
      [...fresh.map((a) => ({ label: iv(a), events: ivDemo(a) })), ...contrast.slice(0, 2).map((a) => ({ label: iv(a), events: ivDemo(a) }))],
      [meetPick, which('intervals', sortIv(practise.length > 2 ? [...fresh, contrast[0]] : practise))],
      [which('intervals', sortIv(practise), { focus: fresh })],
      [which('intervals', known.length > 6 ? sortIv([...fresh, ...pickRecent(known, fresh, 5)]) : known, { focus: fresh })]);
  });
}
// Up to n answers learned before, the latest first (so a Mix stays a sensible size).
function pickRecent(known, fresh, n) {
  const before = known.filter((a) => !fresh.includes(a));
  return before.slice(-n);
}

const CHORD_UNITS = [
  ['ch_maj_min', ['maj', 'min'], ['maj', 'min']],
  ['ch_dim', ['dim'], ['maj', 'min', 'dim']],
  ['ch_aug', ['aug'], ['maj', 'aug']],
  ['ch_sus', ['sus2', 'sus4'], ['sus2', 'sus4', 'maj']],
  ['ch_7_maj7', ['7', 'maj7'], ['7', 'maj7']],
  ['ch_m7', ['m7'], ['7', 'maj7', 'm7']],
  ['ch_dim7', ['m7b5', 'dim7'], ['m7b5', 'dim7', 'm7']],
];
const sortCh = (list) => ANSWERS.chords.filter((a) => list.includes(a));
function chordUnits() {
  let known = [];
  return CHORD_UNITS.map(([id, fresh, practise]) => {
    known = sortCh([...known, ...fresh]);
    const contrast = practise.filter((a) => !fresh.includes(a));
    const meetPick = fresh.length > 1 ? pickOne('chords', fresh[0], [fresh[1]]) : pickOne('chords', fresh[0], contrast);
    return unit(id,
      [...fresh, ...contrast.slice(0, 2)].map((a) => ({ label: ch(a), events: chordDemo(a) })),
      [meetPick, which('chords', sortCh(fresh.length > 1 ? fresh : [fresh[0], contrast[0]]))],
      [which('chords', sortCh(practise), { focus: fresh })],
      [which('chords', known.length > 6 ? sortCh([...fresh, ...pickRecent(known, fresh, 5)]) : known, { focus: fresh })]);
  });
}

const DEGREE_UNITS = [
  ['dg1_5', [1, 5], [1, 5], 'octave'],
  ['dg3', [3], [1, 3, 5], 'octave'],
  ['dg2', [2], [1, 2, 3], 'octave'],
  ['dg4', [4], [3, 4, 5], 'octave'],
  ['dg6_7', [6, 7], [5, 6, 7, 1], 'top'],
];
function degreeUnits(mode = 'major') {
  let known = [];
  const units = DEGREE_UNITS.map(([id, fresh, practise, range]) => {
    known = ALL_DEG.filter((a) => known.includes(a) || fresh.includes(a));
    const meet = ALL_DEG.filter((a) => fresh.includes(a) || a === practise.find((p) => !fresh.includes(p)));
    return unit(id,
      [{ label: label('demoKey'), events: degreeDemo([], mode) }, ...fresh.map((a) => ({ label: dg(a), events: degreeDemo([a], mode) }))],
      [which('degrees', meet, { range: range === 'top' ? 'top' : 'octave', mode })],
      [which('degrees', ALL_DEG.filter((a) => practise.includes(a)), { range, mode, focus: fresh })],
      [which('degrees', range === 'top' ? [1, ...known.filter((a) => a >= 3)] : known, { range: range === 'top' ? 'top' : 'octave', mode, focus: fresh })]);
  });
  // The 5 below home and the 5 above: the same step, lower and higher.
  const at = (notes) => [...cadence(60, mode), ...notes.map((n, i) => ({ at: 3.0 + i * 0.7, notes: [n], dur: 1.0 }))];
  units.push(unit('dg_all', [{ label: label('demoLower'), events: at([55]) }, { label: label('demoHigher'), events: at([67]) }],
    [which('degrees', ALL_DEG, { mode })],
    [which('degrees', ALL_DEG, { mode, range: 'octave' })],
    [which('degrees', ALL_DEG, { mode, range: 'wide' })]));
  return units;
}

const melody = (answers, length, extra = {}) => ({ kind: 'melody', answers, length, w: 1, mode: 'major', ...extra });
const PROG_ENDS_145 = [[1, 4, 5, 1], [1, 4, 1, 5], [1, 5, 1, 4], [1, 5, 4, 1], [1, 4, 5, 4]];
const PROG_POP = [[1, 5, 6, 4], [1, 6, 4, 5], [1, 4, 6, 5], [1, 5, 4, 6], [1, 6, 5, 1], [1, 4, 5, 6]];
const prog = (patterns, choices) => ({ kind: 'prog', patterns, choices, w: 1 });

function buildSections() {
  return [
    { id: 'basics', units: [
      unit('hl', [{ label: label('demoHigher'), events: ivDemo(7) }, { label: label('demoLower'), events: ivDemo(7, 'down') }],
        [HL(7, 12)], [HL(3, 12)], [HL(1, 12)]),
      unit('sd', [{ label: label('demoSame'), events: ivDemo(0) }, { label: label('demoDifferent'), events: ivDemo(2) }],
        [SD(5, 12)], [SD(2, 12)], [SD(1, 12), w(0.5, HL(1, 12))]),
      unit('step', [{ label: label('demoStep'), events: ivDemo(2) }, { label: label('demoLeap'), events: ivDemo(7) }],
        [STEP(5)], [STEP(3)], [STEP(3), w(0.5, SD(1, 12)), w(0.5, HL(1, 12))]),
      unit('half', [{ label: iv(1), events: ivDemo(1) }, { label: iv(2), events: ivDemo(2) }],
        [pickOne('intervals', 1, [2]), which('intervals', [1, 2])],
        [which('intervals', [1, 2], { play: 'updown' })],
        [which('intervals', [1, 2], { play: 'updown' }), w(0.5, STEP(3))]),
    ], check: [HL(1, 12), SD(1, 12), STEP(3), which('intervals', [1, 2], { play: 'updown' })] },
    { id: 'up', units: upUnits(), check: [which('intervals', ALL_IV)] },
    { id: 'down', units: [
      unit('down', [{ label: iv(4), events: ivDemo(4, 'down') }, { label: iv(7), events: ivDemo(7, 'down') }, { label: iv(12), events: ivDemo(12, 'down') }],
        [which('intervals', [4, 7, 12], { play: 'down' })], [which('intervals', UP_SIX, { play: 'down' })], [which('intervals', ALL_IV, { play: 'down' })]),
      unit('together', [{ label: iv(4), events: ivDemo(4, 'together') }, { label: iv(7), events: ivDemo(7, 'together') }, { label: iv(12), events: ivDemo(12, 'together') }],
        [which('intervals', [4, 7, 12], { play: 'together' })], [which('intervals', [3, 4, 5, 7, 12], { play: 'together' })], [which('intervals', ALL_IV, { play: 'together' })]),
      unit('mixed', [{ label: label('demoUp'), events: ivDemo(5) }, { label: label('demoDown'), events: ivDemo(5, 'down') }, { label: label('demoTogether'), events: ivDemo(5, 'together') }],
        [which('intervals', UP_SIX, { play: 'mixed' })], [which('intervals', ALL_IV, { play: 'updown' })], [which('intervals', ALL_IV, { play: 'mixed' })]),
    ], check: [which('intervals', ALL_IV, { play: 'mixed' })] },
    { id: 'chords', units: chordUnits(), check: [which('chords', ANSWERS.chords)] },
    { id: 'degrees', units: degreeUnits(), check: [which('degrees', ALL_DEG, { range: 'wide' })] },
    { id: 'melody', units: [
      unit('mel2', [{ label: label('demoMelody'), events: degreeDemo([1, 2, 3]) }, { label: label('demoMelody'), events: degreeDemo([3, 1]) }],
        [melody([1, 2, 3], 2)], [melody([1, 2, 3], 2), w(0.5, which('degrees', [1, 2, 3]))], [melody([1, 2, 3, 4, 5], 2)]),
      unit('mel3', [{ label: label('demoMelody'), events: degreeDemo([1, 3, 5]) }, { label: label('demoMelody'), events: degreeDemo([5, 4, 3]) }],
        [melody([1, 2, 3], 3)], [melody([1, 2, 3, 4, 5], 3)], [melody([1, 2, 3, 4, 5], 3), w(0.5, which('degrees', [1, 2, 3, 4, 5]))]),
      unit('mel7', [{ label: label('demoMelody'), events: degreeDemo([5, 6, 7]) }, { label: label('demoMelody'), events: degreeDemo([1, 7, 6]) }],
        [melody([5, 6, 7], 2)], [melody(ALL_DEG, 3)], [melody(ALL_DEG, 3), w(0.5, which('degrees', ALL_DEG))]),
    ], check: [melody(ALL_DEG, 3)] },
    { id: 'prog', units: [
      unit('prog45', [{ label: label('demoI_IV'), events: progEvents(60, [1, 4]) }, { label: label('demoI_V'), events: progEvents(60, [1, 5]) }],
        [prog([[1, 4], [1, 5]], [4, 5])], [prog([[1, 4], [1, 5], [1, 4, 1, 4], [1, 5, 1, 5]], [4, 5])], [prog([[1, 4, 5], [1, 5, 4]], [4, 5])]),
      unit('prog6', [{ label: label('demoI_vi'), events: progEvents(60, [1, 6]) }, { label: label('demoI_IV'), events: progEvents(60, [1, 4]) }],
        [prog([[1, 6], [1, 4]], [4, 6])], [prog([[1, 4], [1, 5], [1, 6]], [4, 5, 6])], [prog([[1, 5, 6], [1, 4, 6], [1, 6, 4], [1, 6, 5]], [4, 5, 6])]),
      unit('prog145', [{ label: label('demoProg'), events: progEvents(60, [1, 4, 5, 1]) }, { label: label('demoProg'), events: progEvents(60, [1, 5, 1, 4]) }],
        [prog([[1, 4, 5, 1], [1, 4, 1, 5]], [1, 5])], [prog(PROG_ENDS_145, [1, 4, 5])], [prog(PROG_ENDS_145, [1, 4, 5, 6])]),
      unit('progpop', [{ label: label('demoProg'), events: progEvents(60, [1, 5, 6, 4]) }, { label: label('demoProg'), events: progEvents(60, [1, 6, 4, 5]) }],
        [prog([[1, 5, 6, 4], [1, 6, 4, 5]], [4, 5])], [prog(PROG_POP, [1, 4, 5, 6])], [prog([...PROG_POP, ...PROG_ENDS_145], [1, 4, 5, 6])]),
    ], check: [prog([...PROG_POP, ...PROG_ENDS_145], [1, 4, 5, 6])] },
    { id: 'minor', units: [
      unit('keymode', [{ label: label('demoMajor'), events: cadence(60) }, { label: label('demoMinor'), events: cadence(60, 'minor') }],
        [{ kind: 'keymode', w: 1 }], [{ kind: 'keymode', w: 1 }], [{ kind: 'keymode', w: 1 }, w(0.5, which('chords', ['maj', 'min']))]),
      unit('mi135', [{ label: label('demoMinor'), events: degreeDemo([1, 3, 5], 'minor') }, { label: dg(3), events: degreeDemo([3], 'minor') }],
        [which('degrees', [1, 3], { mode: 'minor' })], [which('degrees', [1, 3, 5], { mode: 'minor' })], [which('degrees', [1, 3, 5], { mode: 'minor' }), w(0.5, { kind: 'keymode', w: 1 })]),
      unit('mi1_5', [{ label: label('demoMinor'), events: degreeDemo([1, 2, 3, 4, 5], 'minor') }],
        [which('degrees', [1, 2, 3], { mode: 'minor' })], [which('degrees', [3, 4, 5], { mode: 'minor' })], [which('degrees', [1, 2, 3, 4, 5], { mode: 'minor' })]),
      unit('mi_all', [{ label: label('demoMinor'), events: degreeDemo([5, 6, 7], 'minor') }, { label: dg(6), events: degreeDemo([6], 'minor') }],
        [which('degrees', [5, 6, 7], { mode: 'minor' })], [which('degrees', ALL_DEG, { mode: 'minor' })], [melody([1, 2, 3, 4, 5], 3, { mode: 'minor' }), which('degrees', ALL_DEG, { mode: 'minor' })]),
    ], check: [{ kind: 'keymode', w: 0.5 }, which('degrees', ALL_DEG, { mode: 'minor' }), melody(ALL_DEG, 3, { mode: 'minor' })] },
  ];
}

export const SECTIONS = buildSections();
export const LESSONS = [];
SECTIONS.forEach((sec, si) => {
  sec.units.forEach((u, ui) => {
    ['meet', 'practise', 'mix'].forEach((type) => {
      LESSONS.push({ id: `${u.id}.${type}`, index: LESSONS.length, section: si, unit: ui, type, pools: u.pools[type] });
    });
  });
  LESSONS.push({ id: `${sec.id}.check`, index: LESSONS.length, section: si, unit: -1, type: 'check', pools: sec.check });
});

// --- QUESTIONS ---
const WHICH_PLAY = { intervals: 'up', chords: 'together', degrees: null };
function pickWeighted(pools, random) {
  const total = pools.reduce((s, p) => s + (p.w || 1), 0);
  let r = random() * total;
  for (const p of pools) { r -= p.w || 1; if (r < 0) return p; }
  return pools[pools.length - 1];
}

// Two notes: low F3..G4 region; `first` may be the higher one.
function twoNotes(gap, up, random) {
  const low = pickInt(53, 67, random);
  return up ? [low, low + gap] : [low + gap, low];
}
const twoEvents = ([a, b]) => [{ at: 0, notes: [a], dur: 0.9 }, { at: 1.0, notes: [b], dur: 1.3 }];

export function makeCourseQuestion(pool, { prev = null, random = Math.random, answer = null } = {}) {
  const kind = pool.kind;
  if (kind === 'which') {
    const opts = { answers: pool.answers, play: pool.play || WHICH_PLAY[pool.ex], range: pool.range || 'octave', mode: pool.mode || 'major' };
    let a = answer;
    // The new answers come up about half the time.
    const focus = (pool.focus || []).filter((x) => pool.answers.includes(x));
    if (a === null && focus.length && pool.answers.length > focus.length && random() < 0.45) a = pick(focus, random);
    const q = makeQuestion(pool.ex, opts, { prev: prev && prev.kind === 'which' ? prev : null, answer: a, random });
    return { ...q, kind, choices: pool.answers, pool };
  }
  if (kind === 'pick') {
    const target = pool.target, other = pick(pool.others, random);
    const targetFirst = answer === null ? random() < 0.5 : answer === 'first';
    const opts = { answers: [target, other], play: pool.play || WHICH_PLAY[pool.ex] };
    const qa = makeQuestion(pool.ex, opts, { answer: targetFirst ? target : other, random });
    const qb = makeQuestion(pool.ex, opts, { answer: targetFirst ? other : target, prev: qa, random });
    const gap = eventsLength(qa.events) + 0.7;
    return {
      kind, ex: pool.ex, choices: ['first', 'second'], answer: targetFirst ? 'first' : 'second', target, other, pool,
      parts: [qa, qb], events: [...qa.events.map((e) => ({ ...e, tag: 'first' })), ...qb.events.map((e) => ({ ...e, at: e.at + gap, tag: 'second' }))],
    };
  }
  if (kind === 'hl') {
    const up = answer === null ? random() < 0.5 : answer === 'higher';
    const notes = twoNotes(pickInt(pool.gapLo, pool.gapHi, random), up, random);
    return { kind, choices: ['higher', 'lower'], answer: up ? 'higher' : 'lower', notes, events: twoEvents(notes), pool };
  }
  if (kind === 'sd') {
    const same = answer === null ? random() < 0.4 : answer === 'same';
    const notes = same ? (() => { const n = pickInt(53, 72, random); return [n, n]; })() : twoNotes(pickInt(pool.gapLo, pool.gapHi, random), random() < 0.5, random);
    return { kind, choices: ['same', 'different'], answer: same ? 'same' : 'different', notes, events: twoEvents(notes), pool };
  }
  if (kind === 'step') {
    const isStep = answer === null ? random() < 0.5 : answer === 'step';
    const gap = isStep ? pickInt(1, 2, random) : pickInt(pool.leapLo, 12, random);
    const notes = twoNotes(gap, random() < 0.5, random);
    return { kind, choices: ['step', 'leap'], answer: isStep ? 'step' : 'leap', notes, events: twoEvents(notes), pool };
  }
  if (kind === 'keymode') {
    const mode = answer === null ? (random() < 0.5 ? 'major' : 'minor') : answer;
    const T = pickInt(55, 66, random);
    return { kind, choices: ['major', 'minor'], answer: mode, root: T, events: cadence(T, mode), pool };
  }
  if (kind === 'melody') {
    const mode = pool.mode || 'major';
    const T = pickInt(55, 66, random);
    let steps = answer;
    if (!steps) {
      steps = [];
      for (let i = 0; i < pool.length; i++) {
        let d = pick(pool.answers, random);
        if (i > 0 && d === steps[i - 1]) d = pick(pool.answers.filter((x) => x !== d), random);
        steps.push(d);
      }
    }
    const notes = steps.map((d) => T + scaleSteps(mode)[d - 1]);
    const events = [...cadence(T, mode), ...notes.map((n, i) => ({ at: 3.0 + i * 0.7, notes: [n], dur: i === notes.length - 1 ? 1.3 : 0.65 }))];
    return { kind, choices: pool.answers, answer: steps, mode, root: T, notes, events, pool };
  }
  if (kind === 'prog') {
    let pattern = answer ? null : pick(pool.patterns, random);
    if (answer) pattern = pick(pool.patterns.filter((p) => p[p.length - 1] === answer), random) || pool.patterns[0];
    const T = pickInt(55, 64, random);
    const last = pattern[pattern.length - 1];
    const choices = pool.choices.includes(last) ? pool.choices : [...pool.choices, last].sort((a, b) => a - b);
    return { kind, choices, answer: last, pattern, root: T, events: progEvents(T, pattern), pool };
  }
  throw new Error('unknown kind ' + kind);
}

export function isRight(q, entered) {
  if (q.kind === 'melody') return Array.isArray(entered) && entered.length === q.answer.length && entered.every((d, i) => d === q.answer[i]);
  return entered === q.answer;
}

// The pitch class a melody step or progression chord stands for, for tests.
export const melodyStepNote = (q, i) => q.root + scaleSteps(q.mode)[q.answer[i] - 1];
export { homeChord, degreePlaces, eventsLength as eventsLengthOf };
export const ANSWERS_ALL_IV = ANSWERS.intervals;

// --- ONE LESSON BEING PLAYED ---
export function createRun(lessonOrPools, { random = Math.random, length = LESSON_LENGTH } = {}) {
  const pools = Array.isArray(lessonOrPools) ? lessonOrPools : lessonOrPools.pools;
  // Meet lessons alternate their pools (a Pick the one, then a Which is it?).
  const alternate = !Array.isArray(lessonOrPools) && lessonOrPools.type === 'meet' && pools.length > 1;
  const run = {
    asked: 0, firstRight: 0, redo: [], total: length, current: null,
    next(prev = null) {
      if (run.asked < length) {
        const pool = alternate ? pools[run.asked % pools.length] : pickWeighted(pools, random);
        run.current = { q: makeCourseQuestion(pool, { prev, random }), first: true };
      } else if (run.redo.length) {
        const q0 = run.redo.shift();
        run.current = { q: makeCourseQuestion(q0.pool, { prev, random, answer: q0.answer }), first: false };
      } else {
        run.current = null;
        return null;
      }
      return run.current.q;
    },
    answer(q, ok) {
      if (!run.current || run.current.q !== q) return;
      if (run.current.first) { run.asked++; if (ok) run.firstRight++; }
      if (!ok) run.redo.push(q);
      run.current.answered = true;
    },
    done: () => run.asked >= length && run.redo.length === 0 && (!run.current || run.current.answered),
    // Shown on the bar: first tries asked, plus the ones put right since.
    progress: () => run.asked,
  };
  return run;
}
export const starsForRun = (firstRight, total = LESSON_LENGTH) => {
  const missed = total - firstRight;
  return missed <= 1 ? 3 : missed <= 3 ? 2 : 1;
};
export const CHECK_PASS = 7;

// --- THE PATH ---
export const lessonOpenIn = (stars, i) => i === 0 || (stars[i - 1] || 0) > 0 || (stars[i] || 0) > 0 || LESSONS[i].type === 'check';
export function nextLessonIn(stars) {
  for (let i = 0; i < LESSONS.length; i++) if (!stars[i] && (i === 0 || stars[i - 1] > 0)) return i;
  const i = stars.findIndex((s) => !s);
  return i === -1 ? LESSONS.length - 1 : i;
}
export function checkpointSkip(stars, i, got) {
  const out = stars.slice();
  const sec = LESSONS[i].section;
  LESSONS.forEach((l, j) => { if (l.section === sec && !out[j]) out[j] = got; });
  out[i] = Math.max(out[i] || 0, got);
  return out;
}

// --- FROM THE FIRST VERSION'S LESSONS ---
// For each old lesson (by index): the course units it covers, as 'section/unit id'.
const OLD_TO_UNITS = {
  intervals: [['iv4_7'], ['iv12'], ['iv5'], ['iv2'], ['iv3'], [], ['iv9'], ['iv8'], ['iv10_11'], [], ['iv1_6'], ['up.check'], ['down'], [], ['together'], ['mixed', 'down.check']],
  chords: [['ch_maj_min'], ['ch_dim'], ['ch_aug'], [], ['ch_sus'], [], [], ['ch_7_maj7'], ['ch_m7'], [], ['ch_dim7'], ['chords.check']],
  degrees: [['dg1_5'], ['dg3'], ['dg2'], ['dg4'], [], ['dg6_7'], ['dg_all'], ['degrees.check']],
};
export function migrateStars(old) {
  const stars = LESSONS.map(() => 0);
  let any = false;
  for (const ex of Object.keys(OLD_TO_UNITS)) {
    const list = Array.isArray(old && old[ex]) ? old[ex] : [];
    OLD_TO_UNITS[ex].forEach((ids, i) => {
      const s = Math.max(0, Math.min(3, Math.round(Number(list[i]) || 0)));
      if (!s) return;
      any = true;
      for (const id of ids) {
        LESSONS.forEach((l, j) => {
          const match = id.endsWith('.check') ? l.id === id : l.id.startsWith(id + '.');
          if (match) stars[j] = Math.max(stars[j], s);
        });
      }
    });
  }
  if (any) LESSONS.forEach((l, j) => { if (l.section === 0) stars[j] = Math.max(stars[j], 3); });
  return stars;
}

// --- DAYS: the streak and the daily goal ---
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);
const validDay = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);

// streak: { last: day of the last lesson, count, rest: day a missed day was forgiven }
export function recordDay(streak, today) {
  const s = streak && validDay(streak.last) ? streak : { last: null, count: 0, rest: null };
  if (!s.last) return { last: today, count: 1, rest: null };
  const gap = daysBetween(s.last, today);
  if (gap <= 0) return { ...s };
  if (gap === 1) return { ...s, last: today, count: s.count + 1 };
  if (gap === 2 && restFree(s, today)) return { last: today, count: s.count + 1, rest: today };
  return { last: today, count: 1, rest: s.rest };
}
const restFree = (s, today) => !validDay(s.rest) || daysBetween(s.rest, today) >= 7;
export function streakNow(streak, today) {
  if (!streak || !validDay(streak.last)) return 0;
  const gap = daysBetween(streak.last, today);
  if (gap <= 1) return streak.count;
  if (gap === 2 && restFree(streak, today)) return streak.count;
  return 0;
}
export const goalToday = (goal, today) => (goal && goal.day === today ? goal.done : 0);
export const addToGoal = (goal, today) => ({ day: today, done: goalToday(goal, today) + 1 });

// --- MIX-UPS, FOR THE REVIEW ---
// One entry per mix-up: { ex, a: the right answer, b: the one heard, play, range, mode, ok }
const sameMix = (m, n) => m.ex === n.ex && m.a === n.a && m.b === n.b && m.play === n.play && m.mode === n.mode;
export function noteMistake(list, q, yours) {
  if (!q || q.kind !== 'which' || yours === q.answer) return list || [];
  const entry = { ex: q.ex, a: q.answer, b: yours, play: q.ex === 'intervals' ? (q.pool.play || 'up') : q.ex === 'chords' ? 'together' : null,
    range: q.ex === 'degrees' ? (q.range || 'octave') : null, mode: q.ex === 'degrees' ? (q.mode || 'major') : null, ok: 0 };
  return [entry, ...(list || []).filter((m) => !sameMix(m, entry))].slice(0, MAX_MISTAKES);
}
export function reviewPools(list) {
  if (!list || list.length < REVIEW_MIN) return null;
  return list.slice(0, 12).map((m) => {
    const answers = ANSWERS[m.ex].filter((x) => x === m.a || x === m.b);
    return { kind: 'which', ex: m.ex, answers, play: m.play || undefined, range: m.range || undefined, mode: m.mode || undefined, focus: [m.a], w: 1, review: m };
  });
}
export function noteReviewRight(list, q) {
  if (!q || !q.pool || !q.pool.review) return list;
  const m = q.pool.review;
  if (q.answer !== m.a) return list;
  return list.map((x) => (sameMix(x, m) ? { ...x, ok: x.ok + 1 } : x)).filter((x) => x.ok < 2);
}
