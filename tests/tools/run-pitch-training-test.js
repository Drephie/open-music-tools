/* Command-line version of tests/pitch-training.html. Uses macOS's built-in
 * JavaScriptCore shell (no Node). From the repo root:
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-pitch-training-test.js
 *
 * Prints one line per check and exits non-zero on failure.
 */
import * as ex from '../../pitch-training/exercises.js';
import * as score from '../../pitch-training/score.js';
import * as line from '../../shared/pitch-line.js';
import * as core from '../../shared/pitch-worklet.js';
import { checkTraining } from '../pitch-training-cases.js';

let failed = 0;
for (const row of checkTraining(ex, score, line, core)) {
  print(`${row.failed ? 'FAIL' : 'pass'}  ${row.section}: ${row.checked} checked, ${row.failed} failed`);
  if (row.stats) print('      ' + row.stats);
  row.examples.forEach((e) => print('      ! ' + e));
  if (row.failed) failed++;
}
print(failed ? `FAIL: ${failed} checks failed` : 'PASS');
if (failed) quit(1);
