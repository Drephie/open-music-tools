/* Every string in English, Spanish and Italian. For the home page and each tool
 * with its own strings.js (Choordination keeps its strings inside its page and
 * is checked by tests/release-check.html instead):
 *   - es and it have every key en has, and no key en lacks
 *   - every data-i18n and data-i18n-aria key in the page's HTML exists in en
 * Uses macOS's built-in JavaScriptCore shell (no Node). From the repo root:
 *
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-strings-check.js
 *
 * Prints one line per check and exits non-zero on failure.
 */
import { HUB_STRINGS } from '../../shared/ui/strings.js';
import { HUB_PAGE_STRINGS } from '../../hub/strings.js';
import { METRONOME_STRINGS } from '../../metronome/strings.js';
import { PIANO_STRINGS } from '../../piano/strings.js';
import { EAR_STRINGS } from '../../ear-trainer/strings.js';
import { TUNER_STRINGS as VOCAL_STRINGS } from '../../vocal-tuner/strings.js';
import { TUNER_STRINGS as INSTRUMENT_STRINGS } from '../../instrument-tuner/strings.js';
import { DETECTOR_STRINGS } from '../../pitch-detector/strings.js';
import { TRAINING_STRINGS } from '../../pitch-training/strings.js';

const PAGES = [
  ['index.html', HUB_PAGE_STRINGS],
  ['metronome/index.html', METRONOME_STRINGS],
  ['piano/index.html', PIANO_STRINGS],
  ['ear-trainer/index.html', EAR_STRINGS],
  ['vocal-tuner/index.html', VOCAL_STRINGS],
  ['instrument-tuner/index.html', INSTRUMENT_STRINGS],
  ['pitch-detector/index.html', DETECTOR_STRINGS],
  ['pitch-training/index.html', TRAINING_STRINGS],
];

let failed = 0;
function report(name, problems) {
  print(`${problems.length ? 'FAIL' : 'pass'}  ${name}${problems.length ? ': ' + problems.slice(0, 12).join(', ') + (problems.length > 12 ? ` … (${problems.length})` : '') : ''}`);
  if (problems.length) failed++;
}

function sameKeys(name, dict) {
  const en = Object.keys(dict.en);
  for (const lang of ['es', 'it']) {
    const other = Object.keys(dict[lang] || {});
    const missing = en.filter((k) => !other.includes(k)).map((k) => `${lang} lacks ${k}`);
    const extra = other.filter((k) => !en.includes(k)).map((k) => `${lang} has extra ${k}`);
    report(`${name} ${lang}`, [...missing, ...extra]);
  }
}

sameKeys('shared/ui/strings.js', HUB_STRINGS);
for (const [page, dict] of PAGES) {
  sameKeys(page.replace('index.html', 'strings.js').replace(/^strings\.js$/, 'hub/strings.js'), dict);
  const html = readFile(page);
  const used = new Set([...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]));
  const known = { ...HUB_STRINGS.en, ...dict.en };
  report(`${page} keys`, [...used].filter((k) => !(k in known)).map((k) => `no string ${k}`));
}

print(failed ? `\n${failed} check(s) failed` : '\nall string checks pass');
if (failed) throw new Error(`${failed} string check(s) failed`);
