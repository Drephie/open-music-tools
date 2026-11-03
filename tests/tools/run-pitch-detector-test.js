/* Command-line version of tests/pitch-detector.html. Uses macOS's built-in
 * JavaScriptCore shell (no Node). From the repo root:
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-pitch-detector-test.js
 *
 * Prints one line per check and exits non-zero on failure.
 */
import * as trace from '../../shared/pitch-line.js';
import * as core from '../../shared/pitch-worklet.js';
import { checkDetector } from '../pitch-detector-cases.js';

let failed = 0;
for (const row of checkDetector(trace, core)) {
  print(`${row.failed ? 'FAIL' : 'pass'}  ${row.section}: ${row.checked} checked, ${row.failed} failed`);
  if (row.stats) print('      ' + row.stats);
  row.examples.forEach((e) => print('      ! ' + e));
  if (row.failed) failed++;
}
print(failed ? `FAIL: ${failed} checks failed` : 'PASS');
if (failed) quit(1);
