/* Command-line version of tests/pitch.html (without the AudioWorklet part,
 * which needs a browser). Uses macOS's built-in JavaScriptCore shell (no
 * Node). From the repo root:
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-pitch-test.js
 *
 * Prints one line per check, with the accuracy and speed found, and exits
 * non-zero on failure.
 */
import * as core from '../../shared/pitch-worklet.js';
import * as main from '../../shared/pitch.js';
import { checkPitch } from '../pitch-cases.js';

const now = typeof preciseTime === 'function' ? () => preciseTime() * 1000 : () => Date.now();
let failed = 0;
for (const row of checkPitch(core, main, now)) {
  print(`${row.failed ? 'FAIL' : 'pass'}  ${row.section}: ${row.checked} checked, ${row.failed} failed`);
  if (row.stats) print('      ' + row.stats);
  row.examples.forEach((e) => print('      ! ' + e));
  if (row.failed) failed++;
}
print(failed ? `FAIL: ${failed} checks failed` : 'PASS');
if (failed) quit(1);
