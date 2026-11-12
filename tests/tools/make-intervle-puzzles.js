/* Writes intervle/puzzles.js, Intervle's year of puzzles (365 per mode).
 * Run once (and again only to make a new list; it changes every day's puzzle):
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tests/tools/make-intervle-puzzles.js > intervle/puzzles.js
 *
 * Every answer comes up about as often (shuffled rounds of all the answers),
 * never twice in a row. A fixed seed, so the same list comes out each time.
 */
let seed = 20261107;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
function rounds(answers, count) {
  const out = [];
  while (out.length < count) {
    let r;
    do { r = answers.slice(); for (let i = r.length - 1; i > 0; i--) { const j = int(0, i); [r[i], r[j]] = [r[j], r[i]]; } }
    while (out.length && r[0] === out[out.length - 1]);
    out.push(...r);
  }
  return out.slice(0, count);
}
const N = 365;
const easy = rounds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], N).map((s) => [int(53, 67), s]);              // low note F3..G4, up to 12 above
// Medium is balanced by the note to name: the second note is the nearest one with that name above or below.
const medium = rounds([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], N).map((pc) => {
  const f = int(55, 67), up = ((pc - f) % 12 + 12) % 12 || 12;   // first note G3..G4
  return [f, rnd() < 0.5 ? up : up - 12 || -12];
});
const hard = rounds(['sus2', 'sus4', '7', 'maj7', 'm7', '6', '9'], N).map((c) => [int(55, 64), c, rnd() < 0.5 ? -1 : 0]); // told note G3..E4; chord there or an octave below
const rows = (list) => list.map((r) => '  ' + JSON.stringify(r)).join(',\n');
print(`/* intervle/puzzles.js: Intervle's year of puzzles, one row per day from #1.
 * Made by tests/tools/make-intervle-puzzles.js (don't edit by hand; checked by tests/intervle.html).
 * EASY [low note (MIDI), half steps up]. MEDIUM [first note, half steps (+ up, - down)].
 * HARD [told note, chord, 0 = chord built on it, -1 = an octave below].
 */
export const EASY = [
${rows(easy)},
];
export const MEDIUM = [
${rows(medium)},
];
export const HARD = [
${rows(hard)},
];`);
