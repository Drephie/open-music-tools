/* Command-line version of tests/ear-trainer.html. Uses macOS's built-in
 * JavaScriptCore shell (no Node). From the repo root:
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-ear-trainer-test.js
 *
 * Prints one line per check and exits non-zero on failure.
 */
import * as theory from '../../shared/theory.js';
import * as questions from '../../ear-trainer/questions.js';
import { checkQuestions } from '../ear-trainer-cases.js';

let failed = 0;
for (const row of checkQuestions(questions, theory)) {
  print(`${row.failed ? 'FAIL' : 'pass'}  ${row.section}: ${row.checked} checked, ${row.failed} failed`);
  row.examples.forEach(e => print('      ' + e));
  if (row.failed) failed++;
}
print(failed ? `FAIL: ${failed} checks failed` : 'PASS');
if (failed) quit(1);
