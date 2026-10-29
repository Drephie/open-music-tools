/* instrument-tuner/tunings.js: the Instrument Tuner's tunings and how a pitch
 * is matched to a string (spec: specs/instrument-tuner.md). Pure functions:
 * no DOM, no Web Audio. Tested by tests/instrument-tuner.html and
 * tests/tools/run-instrument-tuner-test.js.
 *
 *   TUNINGS  [{ id, inst, tuning, notes }] in menu order. inst and tuning are
 *     string keys (tuning null: the instrument has one tuning); notes are the
 *     strings in the order they sit on the instrument (thickest first for
 *     guitar and bass), spelled as the tuning spells them: 'E2', 'Db3', 'F#3'.
 *     The id 'chromatic' has no strings (any note).
 *   tuningById(id)  the tuning, or the first (guitar standard) for an unknown id
 *   stringsOf(tuning) -> [{ note, midi, letter, pc, octave }]  letter 0..6 (C..B)
 *   stringName(s, solfege) -> 'Db', 'Reb', 'F#'  (ASCII # and b, for theory.js)
 *   rangeOf(tuning) -> { minFreq, maxFreq } in Hz for shared/pitch.js: from about
 *     six half steps below the lowest string (a very slack string is still
 *     heard) to a bit over an octave above the highest (its 12th-fret harmonic)
 *
 *   matchString(freq, tuning, { a4 = 440, prev = null, lock = null })
 *     -> { index, cents, harmonic } or null (no strings)
 *     cents: how far the pitch is from that string (negative = low).
 *     lock = a string index: always that string ("tap to stay"); a pitch about an
 *       octave above it is its 12th-fret harmonic (harmonic: true).
 *     Otherwise the nearest string. A pitch more than a half step from every
 *     string but within half a half step of the octave above one is that
 *     string's harmonic. prev (the string shown last) is kept unless another
 *     string is nearer by more than STICK_CENTS, so a pitch halfway between
 *     two strings doesn't flicker between them.
 *
 *   createTunedMarks(count, { tolerance })
 *     The filled circles. .push(time, index, cents) for each reading (index null
 *     for no note) -> true when a mark changed. A string is marked after it has
 *     stayed within tolerance for MARK_SECONDS, and unmarked after it has stayed
 *     more than max(10, 2 * tolerance) cents off for UNMARK_SECONDS (a string
 *     reads a little sharp just after the pluck, so a short slip doesn't count).
 *     .marks (booleans), .all (every string marked), .setTolerance(c), .clear()
 */
import { LETTERS, LETTER_PC, spellOnLetter } from '../shared/theory.js';

export const STICK_CENTS = 60;
export const MARK_SECONDS = 0.5;
export const UNMARK_SECONDS = 1;

export const TUNINGS = [
  { id: 'guitar-standard', inst: 'guitar', tuning: 'standard', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'guitar-drop-d', inst: 'guitar', tuning: 'dropD', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'guitar-half-down', inst: 'guitar', tuning: 'halfDown', notes: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'] },
  { id: 'guitar-dadgad', inst: 'guitar', tuning: 'dadgad', notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
  { id: 'guitar-open-g', inst: 'guitar', tuning: 'openG', notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
  { id: 'guitar-open-d', inst: 'guitar', tuning: 'openD', notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'] },
  { id: 'bass-4', inst: 'bass', tuning: 'bass4', notes: ['E1', 'A1', 'D2', 'G2'] },
  { id: 'bass-5', inst: 'bass', tuning: 'bass5', notes: ['B0', 'E1', 'A1', 'D2', 'G2'] },
  { id: 'ukulele', inst: 'ukulele', tuning: 'standard', notes: ['G4', 'C4', 'E4', 'A4'] },
  { id: 'ukulele-low-g', inst: 'ukulele', tuning: 'lowG', notes: ['G3', 'C4', 'E4', 'A4'] },
  { id: 'ukulele-baritone', inst: 'ukulele', tuning: 'baritone', notes: ['D3', 'G3', 'B3', 'E4'] },
  { id: 'violin', inst: 'violin', tuning: null, notes: ['G3', 'D4', 'A4', 'E5'] },
  { id: 'viola', inst: 'viola', tuning: null, notes: ['C3', 'G3', 'D4', 'A4'] },
  { id: 'cello', inst: 'cello', tuning: null, notes: ['C2', 'G2', 'D3', 'A3'] },
  { id: 'chromatic', inst: 'chromatic', tuning: null, notes: [] },
];

export const tuningById = (id) => TUNINGS.find((t) => t.id === id) || TUNINGS[0];

function parseNote(note) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  const letter = LETTERS.indexOf(m[1]);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = Number(m[3]);
  const midi = (octave + 1) * 12 + LETTER_PC[letter] + acc;
  return { note, midi, letter, pc: ((midi % 12) + 12) % 12, octave };
}

const parsed = new Map();
export function stringsOf(tuning) {
  if (!parsed.has(tuning.id)) parsed.set(tuning.id, tuning.notes.map(parseNote));
  return parsed.get(tuning.id);
}

export const stringName = (s, solfege) => spellOnLetter(s.letter, s.pc, solfege);

const midiToFreq = (midi, a4 = 440) => a4 * Math.pow(2, (midi - 69) / 12);

export function rangeOf(tuning) {
  const midis = stringsOf(tuning).map((s) => s.midi);
  if (!midis.length) return { minFreq: 35, maxFreq: 2000 };
  return {
    minFreq: Math.round(midiToFreq(Math.min(...midis)) * 0.7 * 10) / 10,
    maxFreq: Math.round(midiToFreq(Math.max(...midis)) * 2.3),
  };
}

export function matchString(freq, tuning, { a4 = 440, prev = null, lock = null } = {}) {
  const strings = stringsOf(tuning);
  if (!strings.length || !(freq > 0)) return null;
  const midi = 69 + 12 * Math.log2(freq / a4);
  const off = (i) => (midi - strings[i].midi) * 100;

  if (lock !== null && strings[lock]) {
    const c = off(lock);
    // About an octave above the string: its 12th-fret harmonic.
    return c > 650 ? { index: lock, cents: c - 1200, harmonic: true } : { index: lock, cents: c, harmonic: false };
  }

  let best = 0;
  for (let i = 1; i < strings.length; i++) if (Math.abs(off(i)) < Math.abs(off(best))) best = i;
  if (Math.abs(off(best)) > 100) {
    let h = -1;
    for (let i = 0; i < strings.length; i++) {
      if (Math.abs(off(i) - 1200) <= 50 && (h < 0 || Math.abs(off(i) - 1200) < Math.abs(off(h) - 1200))) h = i;
    }
    if (h >= 0) return { index: h, cents: off(h) - 1200, harmonic: true };
  }
  if (prev !== null && strings[prev] && prev !== best && Math.abs(off(prev)) <= Math.abs(off(best)) + STICK_CENTS) best = prev;
  return { index: best, cents: off(best), harmonic: false };
}

export function createTunedMarks(count, { tolerance = 5 } = {}) {
  let marks = new Array(count).fill(false);
  let tol = tolerance, current = null, goodSince = null, badSince = null;

  function push(time, index, cents) {
    if (index === null || index === undefined || index !== current) {
      current = index ?? null;
      goodSince = badSince = null;
    }
    if (current === null) return false;
    const a = Math.abs(cents);
    if (a <= tol) { badSince = null; goodSince ??= time; } else goodSince = null;
    if (a > Math.max(10, 2 * tol)) badSince ??= time; else badSince = null;
    if (!marks[current] && goodSince !== null && time - goodSince >= MARK_SECONDS) { marks[current] = true; return true; }
    if (marks[current] && badSince !== null && time - badSince >= UNMARK_SECONDS) { marks[current] = false; return true; }
    return false;
  }

  return {
    push,
    get marks() { return marks; },
    get all() { return marks.length > 0 && marks.every(Boolean); },
    setTolerance(c) { tol = c; },
    clear() { marks = new Array(count).fill(false); current = goodSince = badSince = null; },
  };
}
