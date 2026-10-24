/* Tests for theory.nameNotes (the Piano's chord name). Used by
 * tests/theory.html and tests/tools/run-theory-test.js.
 *
 * checkNaming(theory) -> rows { section, checked, failed, examples }
 *   - known answers: chords, inversions, spellings, intervals, single notes
 *   - invariants: every shape on every root, in root position, names itself
 */

// [MIDI notes, solfege, expected name (or kind), expected notes, alts that must be listed]
const KNOWN = [
  [[60, 64, 67], false, 'C', 'C4 E4 G4'],
  [[64, 67, 72], false, 'C/E', 'E4 G4 C5'],
  [[67, 72, 76], false, 'C/G', 'G4 C5 E5'],
  [[57, 60, 64, 67], false, 'Am7', 'A3 C4 E4 G4', ['C6/A']],
  [[60, 64, 67, 69], false, 'C6', 'C4 E4 G4 A4', ['Am7/C']],
  [[53, 57, 60, 64], false, 'Fmaj7', 'F3 A3 C4 E4'],
  [[57, 60, 64, 65], false, 'Fmaj7/A', 'A3 C4 E4 F4'],
  [[55, 59, 62, 65], false, 'G7', 'G3 B3 D4 F4'],
  [[59, 62, 65, 67], false, 'G7/B', 'B3 D4 F4 G4'],
  [[59, 62, 65, 69], false, 'Bm7♭5', 'B3 D4 F4 A4', ['Dm6/B']],
  [[71, 74, 77], false, 'Bdim', 'B4 D5 F5'],
  [[62, 65, 68, 71], false, 'Ddim7', 'D4 F4 Ab4 B4'],
  [[60, 64, 68], false, 'Caug', 'C4 E4 G#4'],
  [[60, 62, 67], false, 'Csus2', 'C4 D4 G4', ['Gsus4/C']],
  [[60, 65, 67], false, 'Csus4', 'C4 F4 G4', ['Fsus2/C']],
  [[60, 64, 67, 71, 74], false, 'Cmaj9', 'C4 E4 G4 B4 D5'],
  [[60, 63, 67, 70, 74], false, 'Cm9', 'C4 Eb4 G4 Bb4 D5'],
  [[60, 64, 67, 70, 75], false, 'C7♯9', 'C4 E4 G4 Bb4 D#5'],
  [[60, 64, 67, 70, 80], false, 'C7♭13', 'C4 E4 G4 Bb4 Ab5'],
  [[48, 64, 67, 72], false, 'C', 'C3 E4 G4 C5'],
  // Black-key roots: the fewest sharps and flats, ties to the key signature.
  [[61, 64, 68], false, 'C#m', 'C#4 E4 G#4'],
  [[61, 65, 68], false, 'Db', 'Db4 F4 Ab4'],
  [[63, 66, 70], false, 'Ebm', 'Eb4 Gb4 Bb4'],
  [[63, 67, 70], false, 'Eb', 'Eb4 G4 Bb4'],
  [[66, 70, 73], false, 'F#', 'F#4 A#4 C#5'],
  [[66, 69, 73], false, 'F#m', 'F#4 A4 C#5'],
  [[68, 72, 75], false, 'Ab', 'Ab4 C5 Eb5'],
  [[68, 71, 75], false, 'G#m', 'G#4 B4 D#5'],
  [[70, 73, 77], false, 'Bbm', 'Bb4 Db5 F5'],
  [[70, 74, 77, 80], false, 'Bb7', 'Bb4 D5 F5 Ab5'],
  [[68, 72, 75, 78], false, 'Ab7', 'Ab4 C5 Eb5 Gb5'],
  [[61, 65, 68, 71], false, 'Db7', 'Db4 F4 Ab4 Cb5'],   // 3 and 3 accidentals: the key signature (Db)
  [[61, 65, 68, 71, 75], false, 'Db9', 'Db4 F4 Ab4 Cb5 Eb5'],
  [[61, 65, 68, 71, 76], false, 'Db7♯9', 'Db4 F4 Ab4 Cb5 E5'],
  [[63, 66, 69], false, 'D#dim', 'D#4 F#4 A4'],
  [[70, 73, 76], false, 'A#dim', 'A#4 C#5 E5'],
  [[64, 68, 71], false, 'E', 'E4 G#4 B4'],
  // Solfège
  [[57, 60, 64, 67], true, 'La m7', 'La3 Do4 Mi4 Sol4', ['Do 6/La']],
  [[64, 67, 72], true, 'Do/Mi', 'Mi4 Sol4 Do5'],
  [[70, 74, 77, 80], true, 'Sib 7', 'Sib4 Re5 Fa5 Lab5'],
  [[60, 64, 67], true, 'Do', 'Do4 Mi4 Sol4'],
  // Intervals (two pitch classes), octaves, single notes, no name
  [[60, 64], false, 'interval 4', 'C4 E4'],
  [[61, 64], false, 'interval 3', 'C#4 E4'],
  [[61, 65], false, 'interval 4', 'Db4 F4'],
  [[64, 72], false, 'interval 8', 'E4 C5'],
  [[60, 68], false, 'interval 8', 'C4 Ab4'],
  [[60, 66], false, 'interval 6', 'C4 F#4'],
  [[48, 52, 60], false, 'interval 4', 'C3 E3 C4'],
  [[60, 72], false, 'interval 12', 'C4 C5'],
  [[60], false, 'note', 'C4'],
  [[61], false, 'note Db', 'C#4'],
  [[70], true, 'note Sib', 'La#4'],
  [[21], false, 'note', 'A0'],
  [[108], false, 'note', 'C8'],
  [[60, 61, 62], false, 'none', 'C4 C#4 D4'],
  [[60, 62, 64, 65, 67, 69, 71], false, 'none', 'C4 D4 E4 F4 G4 A4 B4'],
  [[67, 60, 64, 60], false, 'C', 'C4 E4 G4'],
];

function describe(r) {
  if (!r) return 'null';
  if (r.kind === 'chord') return r.name;
  if (r.kind === 'interval') return `interval ${r.interval}`;
  if (r.kind === 'note') return r.enharmonic ? `note ${r.enharmonic}` : 'note';
  return r.kind;
}

export function checkNaming(theory) {
  const rows = [];
  const row = (section) => { const r = { section, checked: 0, failed: 0, examples: [] }; rows.push(r); return r; };
  const fail = (r, msg) => { r.failed++; if (r.examples.length < 10) r.examples.push(msg); };

  const known = row('naming: known chords, spellings, intervals and notes');
  for (const [midis, solfege, want, wantNotes, wantAlts = []] of KNOWN) {
    known.checked++;
    const r = theory.nameNotes(midis, solfege);
    const got = describe(r);
    const notes = r ? r.notes.map(n => n.name + n.octave).join(' ') : '';
    const missing = wantAlts.filter(a => !(r && r.alts || []).includes(a));
    if (got !== want || notes !== wantNotes || missing.length) {
      fail(known, `${midis.join(' ')}${solfege ? ' (solfege)' : ''}: expected ${want} [${wantNotes}]` +
        `${wantAlts.length ? ' also ' + wantAlts.join(', ') : ''}, got ${got} [${notes}]` +
        `${r && r.alts && r.alts.length ? ' also ' + r.alts.join(', ') : ''}`);
    }
  }

  const shapes = row('naming: every shape is unique');
  const sets = new Set();
  for (const f of theory.CHORD_FORMS) {
    shapes.checked++;
    const k = f.intervals.join(',');
    if (sets.has(k)) fail(shapes, `${f.id}: same notes as another shape`);
    sets.add(k);
  }

  // Every shape on every root, root position from C4 up: named as itself, with
  // each note on its own letter and at most a double sharp or flat.
  const inv = row('naming: every shape on every root names itself');
  for (const f of theory.CHORD_FORMS) {
    for (let root = 0; root < 12; root++) {
      inv.checked++;
      const midis = f.intervals.map(i => 60 + root + i);
      const r = theory.nameNotes(midis, false);
      const letters = r && r.notes.map(n => n.name[0]);
      const problems = [];
      if (!r || r.kind !== 'chord') problems.push(`kind ${r && r.kind}`);
      else {
        if (r.form.id !== f.id) problems.push(`named ${r.name} (${r.form.id})`);
        if (r.bass) problems.push(`slash ${r.name}`);
        if (new Set(letters).size !== letters.length) problems.push(`letters ${r.notes.map(n => n.name).join(' ')}`);
        if (r.notes.some(n => Math.abs(n.acc) > 2)) problems.push('triple accidental');
        if (r.notes.some(n => (n.octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11]['CDEFGAB'.indexOf(n.name[0])] + n.acc !== n.midi)) problems.push('octave');
      }
      if (problems.length) fail(inv, `${f.id} on ${root}: ${problems.join(', ')}`);
    }
  }
  // One name per note with no key (the tuners): C# Eb F# Ab Bb.
  const common = row('commonNoteName: one name per note, C# Eb F# Ab Bb, octaves from C4 = 60');
  const want = [[60, false, 'C4'], [61, false, 'C#4'], [63, false, 'Eb4'], [66, false, 'F#4'], [68, false, 'Ab4'], [70, false, 'Bb4'],
    [71, false, 'B4'], [72, false, 'C5'], [33, false, 'A1'], [57, true, 'La3'], [61, true, 'Do#4'], [63, true, 'Mib4'],
    [68, true, 'Lab4'], [70, true, 'Sib4'], [66, true, 'Fa#4'], [67, true, 'Sol4'], [95, true, 'Si6']];
  for (const [midi, solfege, expect] of want) {
    common.checked++;
    const n = theory.commonNoteName(midi, solfege);
    if (n.name + n.octave !== expect) fail(common, `${midi}${solfege ? ' (solfege)' : ''}: expected ${expect}, got ${n.name}${n.octave}`);
  }
  return rows;
}
