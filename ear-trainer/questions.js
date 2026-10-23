/* ear-trainer/questions.js: what the Ear Trainer asks (spec: specs/ear-trainer.md).
 * Pure functions: no DOM, no Tone. Notes are MIDI numbers (C4 = 60).
 *
 *   EXERCISES        ['intervals', 'chords', 'degrees'] (the three tabs)
 *   ANSWERS[ex]      every answer of an exercise, in button order:
 *                    intervals: semitones 1..12 (12 = octave); chords: CHORD_FORMS
 *                    ids (shared/theory.js); degrees: steps 1..7 of a major key
 *   LESSONS[ex]      [{ answers, play, range, title }] in path order.
 *                    play: how it sounds (intervals 'up' | 'down' | 'together' |
 *                    'mixed'; chords 'together' | 'up' (one by one) | 'mixed');
 *                    range (degrees): 'octave' (home up to the 7th), 'top' (1 is
 *                    the high home note), 'wide' (from the 4th below home to the
 *                    octave above); title: a string key, or null to name the
 *                    lesson by its answers
 *   PLAYS[ex], DEGREE_RANGES   the choices free practice offers
 *   LESSON_GOAL      10 right answers finish a lesson; LIVES = 3 in the game
 *   starsFor(mistakes)       3 (0 or 1 mistake), 2 (2 to 4), 1 (5 or more)
 *   lessonOpen(stars, i)     lesson i is open when it is the first, or the one
 *                            before it has stars (stars: one number per lesson)
 *   gameStage(ex, score)     { answers, play, range } of the streak game after
 *                            `score` right answers: 2 answers, one more every
 *                            GAME_STEP (5); once all are in, intervals go up and
 *                            down, then also together, and degrees go wide
 *   makeQuestion(ex, { answers, play, range }, { prev, answer, random })
 *     -> { ex, answer, play, root, notes, events }
 *     answer: one of answers (or `answer`, to introduce a new one), picked
 *     again once when it equals prev.answer, so repeats are rarer; prev: the
 *     last question, whose start note or key is also not reused; random: () ->
 *     [0, 1) (Math.random). play: resolved ('mixed' becomes one way).
 *     root: the first note heard (intervals), the chord's root (chords) or home
 *     (degrees). notes: the notes asked about, low to high (the degree note
 *     alone). events: [{ at, notes, dur }] in seconds from the start.
 *   compareEvents(question, yours) -> events: `yours` built on the same start
 *     (same first note, root or key), then the right one; each event has a
 *     tag, 'yours' or 'right'
 *   eventsLength(events)     seconds until the last note ends
 */
import { CHORD_FORMS, MAJOR_SCALE_STEPS } from '../shared/theory.js';

export const EXERCISES = ['intervals', 'chords', 'degrees'];
const span = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const ANSWERS = {
  intervals: span(1, 12),
  chords: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4', '7', 'maj7', 'm7', 'm7b5', 'dim7'],
  degrees: span(1, 7),
};
export const PLAYS = { intervals: ['up', 'down', 'together', 'mixed'], chords: ['together', 'up', 'mixed'], degrees: [] };
export const DEGREE_RANGES = ['octave', 'wide'];
export const LESSON_GOAL = 10;
export const LIVES = 3;
export const GAME_STEP = 5;

const DEFAULT_PLAY = { intervals: 'up', chords: 'together', degrees: null };
const CHORD_IV = Object.fromEntries(CHORD_FORMS.map((f) => [f.id, f.intervals]));
const sortAnswers = (ex, list) => ANSWERS[ex].filter((a) => list.includes(a));

const lesson = (ex) => (answers, extra = {}) => ({
  answers: sortAnswers(ex, answers), play: DEFAULT_PLAY[ex], range: ex === 'degrees' ? 'octave' : null, title: null, ...extra,
});
const iv = lesson('intervals'), ch = lesson('chords'), dg = lesson('degrees');
const SIX = [2, 3, 4, 5, 7, 12], ALL_IV = ANSWERS.intervals, ALL_DEG = ANSWERS.degrees;
export const LESSONS = {
  intervals: [
    iv([4, 7]), iv([7, 12]), iv([5, 7]), iv([2, 4]), iv([3, 4]),
    iv(SIX, { title: 'lsReview6' }),
    iv([7, 9, 12]), iv([8, 9]), iv([10, 11, 12]), iv([1, 2]), iv([5, 6, 7]),
    iv(ALL_IV, { title: 'lsAllUp' }),
    iv(SIX, { play: 'down', title: 'lsDown6' }),
    iv(ALL_IV, { play: 'down', title: 'lsAllDown' }),
    iv([3, 4, 5, 7, 12], { play: 'together', title: 'lsTogether5' }),
    iv(ALL_IV, { play: 'mixed', title: 'lsAllMixed' }),
  ],
  chords: [
    ch(['maj', 'min']), ch(['maj', 'min', 'dim']), ch(['maj', 'aug']), ch(['maj', 'min', 'dim', 'aug']),
    ch(['sus2', 'sus4']), ch(['maj', 'min', 'sus4']),
    ch(['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'], { title: 'lsTriads' }),
    ch(['7', 'maj7']), ch(['7', 'm7']), ch(['7', 'maj7', 'm7']), ch(['m7b5', 'dim7']),
    ch(['7', 'maj7', 'm7', 'm7b5', 'dim7'], { title: 'lsSevenths' }),
  ],
  degrees: [
    dg([1, 5]), dg([1, 3, 5]), dg([1, 2, 3]), dg([3, 4, 5]), dg([1, 2, 3, 4, 5]),
    dg([5, 6, 7, 1], { range: 'top', title: 'lsTop' }),
    dg(ALL_DEG, { title: 'lsAll7' }),
    dg(ALL_DEG, { range: 'wide', title: 'lsAll7Wide' }),
  ],
};

export const starsFor = (mistakes) => (mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1);
export const lessonOpen = (stars, i) => i === 0 || (stars[i - 1] || 0) > 0;

// The order the streak game brings answers in: very different ones first.
const GAME_ORDER = {
  intervals: [4, 7, 12, 5, 2, 3, 9, 8, 10, 11, 1, 6],
  chords: ['maj', 'min', 'dim', 'aug', 'sus4', 'sus2', '7', 'maj7', 'm7', 'm7b5', 'dim7'],
  degrees: [1, 5, 3, 2, 4, 6, 7],
};
export function gameStage(ex, score) {
  const order = GAME_ORDER[ex];
  const answers = sortAnswers(ex, order.slice(0, Math.min(order.length, 2 + Math.floor(score / GAME_STEP))));
  const after = score - (order.length - 2) * GAME_STEP;   // right answers since the last one came in
  let play = DEFAULT_PLAY[ex], range = ex === 'degrees' ? 'octave' : null;
  if (ex === 'intervals' && after >= 2 * GAME_STEP) play = 'mixed';
  else if (ex === 'intervals' && after >= GAME_STEP) play = 'updown';
  if (ex === 'degrees' && after >= GAME_STEP) range = 'wide';
  return { answers, play, range };
}

const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];
// A random whole number in [lo, hi], not `avoid` (when there is a choice).
const pickNote = (lo, hi, avoid, random) => {
  let n = lo + Math.floor(random() * (hi - lo + 1));
  if (n === avoid) n = n + 1 > hi ? lo : n + 1;
  return n;
};

function intervalEvents(low, high, play) {
  if (play === 'together') return [{ at: 0, notes: [low, high], dur: 1.8 }];
  const [a, b] = play === 'down' ? [high, low] : [low, high];
  return [{ at: 0, notes: [a], dur: 0.9 }, { at: 0.9, notes: [b], dur: 1.4 }];
}
function chordEvents(notes, play) {
  if (play !== 'up') return [{ at: 0, notes, dur: 2 }];
  const gap = 0.45, n = notes.length;   // one by one, each note held to the end
  return notes.map((m, i) => ({ at: i * gap, notes: [m], dur: (n - 1 - i) * gap + 1.6 }));
}
// The key as four chords, I–IV–V–I, around home (T): C E G, C F A, B D G, C E G
// over a bass note.
const homeChord = (T) => [T - 12, T, T + 4, T + 7];
function cadence(T) {
  return [
    { at: 0, notes: homeChord(T), dur: 0.55 },
    { at: 0.6, notes: [T - 7, T, T + 5, T + 9], dur: 0.55 },
    { at: 1.2, notes: [T - 5, T - 1, T + 2, T + 7], dur: 0.55 },
    { at: 1.8, notes: homeChord(T), dur: 1.1 },
  ];
}
// Where a degree is played: 'octave' T..T+11, 'top' with 1 as T+12, 'wide' in [T-7, T+12].
function degreePlaces(T, degree, range) {
  const n = T + MAJOR_SCALE_STEPS[degree - 1];
  if (range === 'top') return [degree === 1 ? T + 12 : n];
  if (range === 'wide') return [n - 12, n, n + 12].filter((m) => m >= T - 7 && m <= T + 12);
  return [n];
}
const resolvePlay = (play, random) =>
  play === 'mixed' ? pick(['up', 'down', 'together'], random) : play === 'updown' ? pick(['up', 'down'], random) : play;

export function makeQuestion(ex, opts, { prev = null, answer = null, random = Math.random } = {}) {
  const answers = opts.answers;
  let a = answer;
  if (a === null || a === undefined) {
    a = pick(answers, random);
    if (prev && prev.ex === ex && a === prev.answer && answers.length > 1) a = pick(answers, random);
  }
  const same = prev && prev.ex === ex;
  const lastRoot = same ? prev.root : null;

  if (ex === 'intervals') {
    const play = resolvePlay(opts.play || 'up', random);
    // Low note F3..G4, so the top is at most G5.
    const low = pickNote(53, 67, same ? prev.notes[0] : null, random);
    const high = low + a;
    return { ex, answer: a, play, root: play === 'down' ? high : low, notes: [low, high], events: intervalEvents(low, high, play) };
  }
  if (ex === 'chords') {
    let play = resolvePlay(opts.play || 'together', random);
    if (play !== 'up') play = 'together';
    const root = pickNote(48, 60, lastRoot, random);   // C3..C4
    const notes = CHORD_IV[a].map((i) => root + i);
    return { ex, answer: a, play, root, notes, events: chordEvents(notes, play) };
  }
  // Scale degrees: home somewhere from G3 to F#4, a new key each time.
  const T = pickNote(55, 66, lastRoot, random);
  const note = pick(degreePlaces(T, a, opts.range || 'octave'), random);
  return {
    ex, answer: a, play: null, range: opts.range || 'octave', root: T, notes: [note],
    events: [...cadence(T), { at: 3.0, notes: [note], dur: 1.5 }],
  };
}

const shift = (events, by, tag) => events.map((e) => ({ ...e, at: e.at + by, tag }));
export const eventsLength = (events) => events.reduce((end, e) => Math.max(end, e.at + e.dur), 0);

export function compareEvents(q, yours) {
  let mine, right;
  if (q.ex === 'intervals') {
    const [low, high] = q.play === 'down' ? [q.root - yours, q.root] : [q.root, q.root + yours];
    mine = intervalEvents(low, high, q.play);
    right = q.events;
  } else if (q.ex === 'chords') {
    mine = chordEvents(CHORD_IV[yours].map((i) => q.root + i), q.play);
    right = q.events;
  } else {
    // Home chord, then the note; your step in the question's range, nearest the right one.
    const target = q.notes[0];
    const place = degreePlaces(q.root, yours, q.range).reduce((best, m) => (Math.abs(m - target) < Math.abs(best - target) ? m : best));
    const withHome = (m) => [{ at: 0, notes: homeChord(q.root), dur: 0.8 }, { at: 1.0, notes: [m], dur: 1.3 }];
    mine = withHome(place);
    right = withHome(target);
  }
  return [...shift(mine, 0, 'yours'), ...shift(right, eventsLength(mine) + 0.5, 'right')];
}
