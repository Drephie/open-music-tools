/* Command-line version of tests/theory.html, minus the Tone.js frequency check.
 * Uses macOS's built-in JavaScriptCore shell (no Node). From the repo root:
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-theory-test.js
 *
 * Prints one line per check and exits non-zero on failure.
 */
import * as theory from '../../shared/theory.js';
import { buildSnapshot, compareSnapshots } from '../theory-cases.js';
import { checkVoicing } from '../voicing-cases.js';
import { checkNaming } from '../naming-cases.js';

const expected = JSON.parse(readFile('tests/fixtures/theory-snapshot.json'));
const api = {
  modifiers: expected.modifiers,
  keyRootName: theory.keyRootName,
  chordNames: (mode, solfege) => theory.keyChordNames(theory.parseKey(mode), solfege),
  chord: (spec) => theory.getChordInfo({
    key: theory.parseKey(spec.mode),
    degree: spec.root,
    modifiers: theory.pickModifiers(spec.list, spec.typeIdx, spec.dualMod, spec.modPair),
    octave: spec.octave,
    solfege: spec.notation === 'solfeggio',
  }),
};

let failed = 0;
const sameList = JSON.stringify(theory.CHORD_MODIFIERS) === JSON.stringify(expected.modifiers);
print(`${sameList ? 'pass' : 'FAIL'}  CHORD_MODIFIERS`);
if (!sameList) failed++;
for (const row of compareSnapshots(expected, buildSnapshot(api))) {
  print(`${row.failed ? 'FAIL' : 'pass'}  ${row.section}: ${row.checked} compared, ${row.failed} different`);
  row.examples.forEach(e => print('      ' + e));
  if (row.failed) failed++;
}
for (const row of [...checkVoicing(theory), ...checkNaming(theory)]) {
  print(`${row.failed ? 'FAIL' : 'pass'}  ${row.section}: ${row.checked} checked, ${row.failed} failed`);
  row.examples.forEach(e => print('      ' + e));
  if (row.failed) failed++;
}
print(failed ? `FAIL: ${failed} checks failed` : 'PASS');
if (failed) quit(1);
