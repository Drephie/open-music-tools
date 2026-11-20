/* Command-line version of tests/bpm-key-finder.html (the rules only; the real
 * songs need a browser). Uses macOS's built-in JavaScriptCore shell (no Node).
 * From the repo root:
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-bpm-key-finder-test.js
 *
 * Prints one line per check and exits non-zero on failure.
 */

import * as rules from '../../shared/analysis-rules.js';
import { checkRules } from '../bpm-key-finder-cases.js';

let failed = 0;
for (const row of checkRules(rules)) {
  print(`${row.failed ? 'FAIL' : 'pass'}  ${row.section}: ${row.checked} checked, ${row.failed} failed`);
  row.examples.forEach(e => print('      ' + e));
  if (row.failed) failed++;
}
print(failed ? `FAIL: ${failed} checks failed` : 'PASS');
if (failed) quit(1);
