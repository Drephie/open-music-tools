/* Tests for theory.voiceChord (smooth chords: root in the bass, the chord
 * above moves as little as possible). Used by tests/theory.html and
 * tests/tools/run-theory-test.js.
 *
 * checkVoicing(theory) -> rows { section, checked, failed, examples }
 *   - known answers: progressions worked out by hand
 *   - invariants over every key, octave, modifier and pair of degrees
 */
import { MODES, rootsOf } from './theory-cases.js';

// [mode, octave, [degree, modifier] per chord, expected [bass, ...upper] per chord, upper names]
const KNOWN = [
  ['0_maj', 0, [[0, 'Triad'], [3, 'Triad'], [4, 'Triad'], [0, 'Triad']],
    [[36, 48, 52, 55], [41, 48, 53, 57], [43, 47, 50, 55], [36, 48, 52, 55]],
    ['C E G', 'C F A', 'B D G', 'C E G']],
  // ii-V-I in D major: Em7 - A7 - Dmaj7
  ['2_maj', 0, [[1, 'Min7'], [4, 'Dom7'], [0, 'Maj7']],
    [[40, 52, 55, 59, 62], [45, 52, 55, 57, 61], [38, 54, 57, 61, 62]],
    ['E G B D', 'E G A C#', 'F# A C# D']],
  ['9_min', 0, [[0, 'Triad'], [3, 'Triad'], [4, 'Triad'], [0, 'Triad']],
    [[45, 57, 60, 64], [50, 57, 62, 65], [52, 55, 59, 64], [45, 57, 60, 64]],
    ['A C E', 'A D F', 'G B E', 'A C E']],
  // Same C-F-G-C one octave lower (Mellow): everything moves down 12.
  ['0_maj', -1, [[0, 'Triad'], [3, 'Triad'], [4, 'Triad'], [0, 'Triad']],
    [[24, 36, 40, 43], [29, 36, 41, 45], [31, 35, 38, 43], [24, 36, 40, 43]],
    ['C E G', 'C F A', 'B D G', 'C E G']],
  // A first Cadd9 (root position C3 E3 G3 D4) becomes the nearest close-position
  // inversion, keeping the 9th on top: C2 | E3 G3 C4 D4
  ['0_maj', 0, [[0, 'Add9']], [[36, 52, 55, 60, 62]], ['E G C D']],
];

export function checkVoicing(theory) {
  const rows = [];
  const row = (section) => { const r = { section, checked: 0, failed: 0, examples: [] }; rows.push(r); return r; };
  const fail = (r, msg) => { r.failed++; if (r.examples.length < 10) r.examples.push(msg); };
  const info = (mode, degree, mod, octave, solfege = false) => theory.getChordInfo({
    key: theory.parseKey(mode), degree, modifiers: [mod], octave, solfege,
  });

  const known = row('voicing: known progressions');
  for (const [mode, octave, chords, expected, names] of KNOWN) {
    const tonicMidi = theory.keyTonicMidi(theory.parseKey(mode), octave);
    let prevUpper = null;
    chords.forEach(([d, mod], i) => {
      const v = theory.voiceChord(info(mode, d, mod, octave), { prevUpper, tonicMidi });
      prevUpper = v.upper;
      known.checked++;
      const got = `${v.midiNotes.join(' ')} / ${v.noteNames.join(' ')}`;
      const want = `${expected[i].join(' ')} / ${names[i]}`;
      if (got !== want) fail(known, `${mode} oct ${octave} chord ${i + 1} (${v.name}): expected ${want}, got ${got}`);
    });
  }

  const inv = row('voicing: invariants (all keys, octaves, modifiers, degree pairs)');
  for (const mode of MODES) {
    const key = theory.parseKey(mode);
    for (const octave of [-1, 0, 1]) {
      const tonicMidi = theory.keyTonicMidi(key, octave);
      for (const mod of theory.CHORD_MODIFIERS) {
        for (let from = 0; from < rootsOf(mode); from++) {
          const prevUpper = theory.voiceChord(info(mode, from, mod, octave), { prevUpper: null, tonicMidi }).upper;
          for (let to = 0; to < rootsOf(mode); to++) {
            const base = info(mode, to, mod, octave, to % 2 === 1);
            const v = theory.voiceChord(base, { prevUpper, tonicMidi });
            const where = `${mode} oct ${octave} ${mod} ${from}->${to}`;
            const up = v.upper;
            inv.checked++;
            const pcsOf = (arr) => [...new Set(arr.map(theory.pc))].sort((a, b) => a - b).join(',');
            const nameOf = {};
            base.midiNotes.forEach((m, i) => { nameOf[theory.pc(m)] = base.noteNames[i]; });
            const problems = [];
            if (v.bass !== base.midiNotes[0] - 12) problems.push('bass is not the root an octave down');
            if (!up.every(n => n > v.bass)) problems.push('a note is not above the bass');
            if (pcsOf(up) !== pcsOf(base.midiNotes) || up.length !== new Set(base.midiNotes.map(theory.pc)).size) problems.push('upper notes are not the chord tones');
            if (!up.every((n, i) => i === 0 || n > up[i - 1]) || up[up.length - 1] - up[0] >= 12) problems.push('upper notes are not one close-position inversion');
            const inWindow = (lo) => up[0] >= lo && up[0] <= lo + 12;
            if (!inWindow(tonicMidi - 5) && !inWindow(tonicMidi + 7)) problems.push('upper chord left its register');
            if (v.midiNotes.join() !== [v.bass, ...up].join()) problems.push('midiNotes are not bass + upper');
            if (!v.freqs.every((f, i) => f === theory.midiToFreq(v.midiNotes[i]))) problems.push('freqs do not match midiNotes');
            if (v.noteNames.join() !== up.map(m => nameOf[theory.pc(m)]).join()) problems.push('note names are not the upper notes, spelled as in the chord');
            if (v.name !== base.name) problems.push('chord name changed');
            const again = theory.voiceChord(base, { prevUpper: up, tonicMidi });
            if (again.upper.join() !== up.join()) problems.push('holding the chord re-voices it');
            if (problems.length) fail(inv, `${where}: ${problems.join('; ')} (${v.midiNotes.join(' ')})`);
          }
        }
      }
    }
  }
  return rows;
}
