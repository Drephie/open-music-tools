/* Command-line version of tests/jam-machine.html. Uses macOS's built-in
 * JavaScriptCore shell (no Node). From the repo root:
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-jam-machine-test.js
 *
 * Prints one line per check and exits non-zero on failure.
 */

import * as jam from '../../jam-machine/jam.js';
import * as band from '../../jam-machine/band.js';
import { checkJam } from '../jam-machine-cases.js';

let failed = 0;
for (const row of checkJam(jam, band)) {
  print(`${row.failed ? 'FAIL' : 'pass'}  ${row.section}: ${row.checked} checked, ${row.failed} failed`);
  row.examples.forEach(e => print('      ' + e));
  if (row.failed) failed++;
}
print(failed ? `FAIL: ${failed} checks failed` : 'PASS');
if (failed) quit(1);
