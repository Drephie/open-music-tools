/* intervle/game.js: Intervle's rules (spec: specs/intervle.md). Pure: no DOM, no Tone.
 *
 *   MODES      ['easy', 'medium', 'hard']
 *   CHORDS     { sus2: [0,2,7], ... }  Hard's chords, semitones above the root
 *   ANSWERS    { easy: 1..12 (half steps), medium: 0..11 (pitch class), hard: chord ids }
 *   TRIES      3
 *   START      [2026, 10, 7]: puzzle #1 (local date, month 0-based)
 *   dayNumber(date)  the puzzle number of a local date (1 = START; < 1 before it)
 *   dateOf(n)        the local Date of puzzle n
 *   puzzle(mode, n) -> { answer, events: [{ at, dur, notes: [midi] }], ref }
 *     ref is the told note's MIDI (Medium, Hard). After the 365-day list it
 *     starts again, shifted to other notes.
 *   parseAnswer(mode, text, names) -> answer or null. Typed answers: half steps or
 *     "m3", "maj 3", "P5"... (easy), "E", "Mi", "Eb", "Re#" (medium), "sus4", "maj7"...
 *     (hard). names: extra { answer: [words] } from the page (translated names).
 *   status(tries, answer) -> 'open' | 'won' | 'lost'
 */
import { EASY, MEDIUM, HARD } from './puzzles.js';

export const MODES = ['easy', 'medium', 'hard'];
export const CHORDS = {
  sus2: [0, 2, 7], sus4: [0, 5, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10], 6: [0, 4, 7, 9], 9: [0, 4, 7, 10, 14],
};
export const ANSWERS = {
  easy: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  medium: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  hard: ['sus2', 'sus4', '7', 'maj7', 'm7', '6', '9'],
};
export const TRIES = 3;
export const START = [2026, 10, 7];

const DAY = 86400000;
const utc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());   // DST-proof day count
export const dayNumber = (date) => Math.round((utc(date) - Date.UTC(...START)) / DAY) + 1;
export const dateOf = (n) => new Date(START[0], START[1], START[2] + n - 1);

export function puzzle(mode, n) {
  const list = { easy: EASY, medium: MEDIUM, hard: HARD }[mode];
  const i = (n - 1) % list.length, cycle = Math.floor((n - 1) / list.length);
  const shift = cycle ? ((cycle * 7) % 12) - 6 : 0;   // -6..+5: every round of the list in new notes
  const [note, b, c] = list[i];
  const ref = note + shift;
  if (mode === 'easy') {
    return { answer: b, events: [{ at: 0, dur: 1, notes: [ref] }, { at: 1.1, dur: 1.4, notes: [ref + b] }] };
  }
  if (mode === 'medium') {
    return { answer: (ref + b + 120) % 12, ref, events: [{ at: 0, dur: 1, notes: [ref] }, { at: 1.1, dur: 1.4, notes: [ref + b] }] };
  }
  const root = ref + c * 12;
  const notes = CHORDS[b].map((s) => root + s);
  const events = [{ at: 0, dur: 1, notes: [ref] }];
  notes.forEach((m, k) => events.push({ at: 1.3 + k * 0.45, dur: 0.6, notes: [m] }));
  events.push({ at: 1.5 + notes.length * 0.45, dur: 2.2, notes });
  return { answer: b, ref, events };
}

const LETTERS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
const QUALITY = { m: [1, 3, 8, 10], min: [1, 3, 8, 10], minor: [1, 3, 8, 10], M: [2, 4, 9, 11], maj: [2, 4, 9, 11], major: [2, 4, 9, 11], p: [5, 7, 12], perf: [5, 7, 12], perfect: [5, 7, 12] };
const DEGREE = { 2: [1, 2], 3: [3, 4], 4: [5], 5: [7], 6: [8, 9], 7: [10, 11], 8: [12] };
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s.]+/g, ' ').trim();

export function parseAnswer(mode, text, names = {}) {
  const raw = String(text).trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  if (!raw) return null;
  const n = norm(raw);
  for (const a of ANSWERS[mode]) if ((names[a] || []).some((w) => norm(w) === n)) return a;
  if (mode === 'easy') {
    if (/^\d+$/.test(n)) return ANSWERS.easy.includes(+n) ? +n : null;
    if (n === 'tritone' || n === 'tt') return 6;
    if (n === 'octave' || n === 'p8' || n === '8ve') return 12;
    const m = raw.replace(/\s+/g, ' ').trim().match(/^(M|m|P|p|[a-z]+)\s?(\d)(st|nd|rd|th)?$/i);
    if (!m) return null;
    const q = m[1] === 'M' || m[1] === 'm' || m[1] === 'P' ? m[1] : m[1].toLowerCase();
    const list = QUALITY[q === 'P' ? 'p' : q], deg = DEGREE[m[2]];
    if (!list || !deg) return null;
    const hit = deg.filter((s) => list.includes(s));
    return hit.length === 1 ? hit[0] : null;
  }
  if (mode === 'medium') {
    const m = n.match(/^(do|re|mi|fa|sol|la|si|[a-g])\s?(#{1,2}|b{1,2})?$/);
    if (!m) return null;
    const acc = (m[2] || '');
    return (LETTERS[m[1]] + (acc[0] === '#' ? acc.length : -acc.length) + 12) % 12;
  }
  const h = n.replace(/\s/g, '').replace(/^dom(inant)?/, '').replace(/^(min|minor|-)7$/, 'm7').replace(/^(major|ma|Δ)7$/i, 'maj7').replace(/th$/, '');
  return ANSWERS.hard.includes(h) ? h : null;
}

export function status(tries, answer) {
  if (tries.some((a) => a === answer)) return 'won';
  return tries.length >= TRIES ? 'lost' : 'open';
}
