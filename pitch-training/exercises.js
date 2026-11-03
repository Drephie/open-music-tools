/* pitch-training/exercises.js: the exercises, the voice types and the rounds of
 * a warm-up (spec: specs/pitch-training.md). Pure: no DOM, no Web Audio.
 * Tested by tests/pitch-training.html and tests/tools/run-pitch-training-test.js.
 *
 *   EXERCISES  [{ id, kind, parts: [[from, to, beats], …] }] in list order. from
 *     and to are steps of the major scale (1 = the starting note, 8 the octave
 *     above); a part with from ≠ to is a slide. kind: 'scale' | 'arpeggio' |
 *     'interval' | 'slide'.
 *   exerciseById(id)  the exercise, or the first one for an unknown id
 *   digits(ex)        '1 2 3 4 5 4 3 2 1', or '1 ↗ 5 ↘ 1' for a slide: for the list
 *   span(ex)          half steps from its lowest to its highest note
 *
 *   VOICES  { soprano: 60, mezzo: 57, alto: 55, tenor: 48, baritone: 45, bass: 41 }
 *           a comfortable starting note (MIDI) for each voice type
 *   SPEEDS  { slow: 60, medium: 80, fast: 100 } beats a minute; one note is one beat
 *   FAR_CHOICES  [3, 5, 7, 12] half steps up before coming back down
 *   LOWEST, HIGHEST  36 and 93: every note sung stays within Do2..La6, where the
 *           pitch engine hears well
 *   startRange(ex, far) -> { min, max }  the starting notes for which every round
 *           stays within LOWEST..HIGHEST
 *   clampStart(midi, ex, far)
 *   roundStarts(start, far) -> [start, start+1, …, start+far, …, start]
 *           (2·far + 1 rounds: up a half step at a time, then back down)
 *
 *   buildRound(ex, start, bpm) -> { parts: [{ m0, m1, t0, t1, i }], beats, seconds }
 *     the pattern on a starting note: MIDI from m0 to m1 (equal for a held note),
 *     times in seconds from its first note
 *   roundPlan(ex, start, bpm, hearing) -> one round's timeline, in seconds from
 *     its start. hearing: 'listen' (the piano plays the pattern, then you sing it
 *     back) or 'along' (headphones: the piano plays while you sing).
 *     { parts, beat, demo, countIn, sing, result, end, sounds }
 *       demo     when the piano plays the pattern (null in 'along')
 *       countIn  the first of COUNT_IN count-in clicks
 *       sing     when the first note is to be sung (the parts' t0 count from here)
 *       result   when the pattern sung ends (plus the LATE allowance, it is scored)
 *       end      the next round starts here (RESULT_BEATS after result)
 *       sounds   [{ time, kind, … }] in time order:
 *                { kind: 'note', midi, dur }  the piano
 *                { kind: 'glide', points: [[time, midi], …], dur }  a soft gliding
 *                    tone that moves straight between the points (slides: a piano
 *                    can't glide; the whole pattern is played by it)
 *                { kind: 'click', level: 'strong' | 'normal' }  a click on every beat
 *                    of the demo, and the count-in (its first one strong)
 *       In 'along' the count-in also sounds the first note on the piano, for two beats.
 *   COUNT_IN = 4, RESULT_BEATS = 4
 *
 *   keyNames(start, solfege) -> 12 names by pitch class: the round's major key
 *     spelled as the key spells it (Fa# in Re major), null off the scale
 *   startName(midi, solfege) -> { name, octave }  a starting note as its key spells it
 *     (Reb4, not Do#4: it starts Reb major). Names use ASCII # and b.
 */
import { laneNames } from '../shared/pitch-line.js';
import { keyRootName } from '../shared/theory.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const semis = (step) => MAJOR[step - 1];

export const EXERCISES = [
  { id: 'five', kind: 'scale', parts: [[1, 1, 1], [2, 2, 1], [3, 3, 1], [4, 4, 1], [5, 5, 1], [4, 4, 1], [3, 3, 1], [2, 2, 1], [1, 1, 2]] },
  { id: 'scale', kind: 'scale', parts: [1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2].map((s) => [s, s, 1]).concat([[1, 1, 2]]) },
  { id: 'arp', kind: 'arpeggio', parts: [[1, 1, 1], [3, 3, 1], [5, 5, 1], [3, 3, 1], [1, 1, 2]] },
  { id: 'arp8', kind: 'arpeggio', parts: [[1, 1, 1], [3, 3, 1], [5, 5, 1], [8, 8, 1], [5, 5, 1], [3, 3, 1], [1, 1, 2]] },
  { id: 'third', kind: 'interval', parts: [[1, 1, 2], [3, 3, 2], [1, 1, 2]] },
  { id: 'fifth', kind: 'interval', parts: [[1, 1, 2], [5, 5, 2], [1, 1, 2]] },
  { id: 'octave', kind: 'interval', parts: [[1, 1, 2], [8, 8, 2], [1, 1, 2]] },
  { id: 'slide5', kind: 'slide', parts: [[1, 1, 1], [1, 5, 2], [5, 5, 1], [5, 1, 2], [1, 1, 1]] },
  { id: 'slide8', kind: 'slide', parts: [[1, 1, 1], [1, 8, 2], [8, 8, 1], [8, 1, 2], [1, 1, 1]] },
];

export const exerciseById = (id) => EXERCISES.find((e) => e.id === id) || EXERCISES[0];

export function digits(ex) {
  if (ex.kind !== 'slide') return ex.parts.map((p) => p[0]).join(' ');
  const out = [String(ex.parts[0][0])];
  for (const [a, b] of ex.parts) if (a !== b) out.push(b > a ? '↗' : '↘', String(b));
  return out.join(' ');
}

export function span(ex) {
  const all = ex.parts.flatMap(([a, b]) => [semis(a), semis(b)]);
  return Math.max(...all) - Math.min(...all);
}

export const VOICES = { soprano: 60, mezzo: 57, alto: 55, tenor: 48, baritone: 45, bass: 41 };
export const SPEEDS = { slow: 60, medium: 80, fast: 100 };
export const FAR_CHOICES = [3, 5, 7, 12];
export const LOWEST = 36, HIGHEST = 93;
export const COUNT_IN = 4, RESULT_BEATS = 4;

export const startRange = (ex, far) => ({ min: LOWEST, max: HIGHEST - span(ex) - far });
export function clampStart(midi, ex, far) {
  const { min, max } = startRange(ex, far);
  return Math.max(min, Math.min(max, Math.round(midi)));
}

export function roundStarts(start, far) {
  const up = Array.from({ length: far + 1 }, (_, i) => start + i);
  return up.concat(up.slice(0, -1).reverse());
}

export function buildRound(ex, start, bpm) {
  const beat = 60 / bpm;
  let b = 0;
  const parts = ex.parts.map(([from, to, n], i) => {
    const p = { m0: start + semis(from), m1: start + semis(to), t0: b * beat, t1: (b + n) * beat, i };
    b += n;
    return p;
  });
  return { parts, beats: b, seconds: b * beat };
}

export function roundPlan(ex, start, bpm, hearing = 'listen') {
  const { parts, beats, seconds } = buildRound(ex, start, bpm);
  const beat = 60 / bpm;
  const along = hearing === 'along';
  const demo = along ? null : 0;
  const countIn = along ? 0 : seconds;
  const sing = countIn + COUNT_IN * beat;
  const result = sing + seconds;
  const end = result + RESULT_BEATS * beat;
  const sounds = [];
  const play = (at) => {
    if (ex.kind === 'slide') {
      const points = [[at + parts[0].t0, parts[0].m0], ...parts.map((p) => [at + p.t1, p.m1])];
      sounds.push({ time: at, kind: 'glide', points, dur: seconds });
    } else {
      for (const p of parts) sounds.push({ time: at + p.t0, kind: 'note', midi: p.m0, dur: p.t1 - p.t0 });
    }
  };
  if (!along) {
    play(demo);
    for (let i = 0; i < beats; i++) sounds.push({ time: demo + i * beat, kind: 'click', level: 'normal' });
  } else {
    sounds.push({ time: countIn, kind: 'note', midi: parts[0].m0, dur: 2 * beat });
    play(sing);
  }
  for (let i = 0; i < COUNT_IN; i++) sounds.push({ time: countIn + i * beat, kind: 'click', level: i ? 'normal' : 'strong' });
  sounds.sort((a, b) => a.time - b.time);
  return { parts, beat, demo, countIn, sing, result, end, sounds };
}

export const keyNames = (start, solfege) => laneNames(`${((start % 12) + 12) % 12}_maj`, solfege);

export function startName(midi, solfege) {
  return { name: keyRootName(((midi % 12) + 12) % 12, 'maj', solfege), octave: Math.floor(midi / 12) - 1 };
}
