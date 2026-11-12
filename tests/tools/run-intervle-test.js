/* Command-line version of tests/intervle.html. Uses macOS's built-in
 * JavaScriptCore shell (no Node). From the repo root:
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-intervle-test.js
 *
 * Prints one line per check and exits non-zero on failure.
 */
import * as theory from '../../shared/theory.js';
import * as game from '../../intervle/game.js';
import { checkGame } from '../intervle-cases.js';

let failed = 0;
for (const row of checkGame(game, theory)) {
  print(`${row.failed ? 'FAIL' : 'pass'}  ${row.section}: ${row.checked} checked, ${row.failed} failed`);
  row.examples.forEach(e => print('      ' + e));
  if (row.failed) failed++;
}
print(failed ? `FAIL: ${failed} checks failed` : 'PASS');
if (failed) quit(1);
