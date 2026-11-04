/* Command-line version of tests/hands.html. Uses macOS's built-in
 * JavaScriptCore shell (no Node). From the repo root:
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-hands-test.js
 *
 * Prints one line per check and exits non-zero on failure.
 */
import * as hands from '../../shared/hands.js';
import * as theory from '../../shared/theory.js';
import { checkHands } from '../hands-cases.js';

let failed = 0;
for (const row of checkHands(hands, theory)) {
  print(`${row.failed ? 'FAIL' : 'pass'}  ${row.section}: ${row.checked} checked, ${row.failed} failed`);
  if (row.stats) print('      ' + row.stats);
  row.examples.forEach((e) => print('      ! ' + e));
  if (row.failed) failed++;
}
print(failed ? `FAIL: ${failed} checks failed` : 'PASS');
if (failed) quit(1);
