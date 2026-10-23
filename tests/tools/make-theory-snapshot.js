/* Writes tests/fixtures/theory-snapshot.json from the ORIGINAL Choordination
 * theory code (before Phase 1 moved it to shared/theory.js).
 *
 * It slices the "NOTE SPELLING" to "AUDIO ENGINE" part out of the old
 * index.html, runs it verbatim with stub selectors, and walks the cases in
 * tests/theory-cases.js. Uses macOS's built-in JavaScriptCore shell (no Node):
 *
 *   git show 5aaf5ee:choordination/index.html > /tmp/choordination-orig.html
 *   JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
 *   $JSC -m tests/tools/make-theory-snapshot.js -- /tmp/choordination-orig.html > tests/fixtures/theory-snapshot.json
 *
 * Only rerun it on purpose: the snapshot is the definition of "unchanged".
 * Intended behaviour changes made since are listed in PATCHES below and
 * applied to the original source first, so the snapshot keeps describing
 * the current engine while still coming from the original code.
 */
import { buildSnapshot } from '../theory-cases.js';

const html = readFile(arguments[0]);
const start = html.indexOf('// --- NOTE SPELLING');
const end = html.indexOf('// --- AUDIO ENGINE ---');
if (start < 0 || end < start) throw new Error('theory section markers not found');

const PATCHES = [
  // 2026-10-23 (Drephie): "7th (Auto)" follows the key, so V in major and VII
  // in minor are dominant 7ths instead of maj7.
  ["baseSeventh = (dq === 'Major') ? 11 : 10;",
   "baseSeventh = scaleSteps[(noteIdx + 6) % 7] + (noteIdx + 6 >= 7 ? 12 : 0) - scaleSteps[noteIdx];"],
];
let section = html.slice(start, end);
for (const [from, to] of PATCHES) {
  if (section.split(from).length !== 2) throw new Error('patch does not match exactly once: ' + from);
  section = section.replace(from, to);
}

const prelude = `
  const notationSelector = { value: 'letter' }, modeSelector = { value: '0_maj' }, octaveSelector = { value: '0' };
  const modifierCheckboxes = { querySelectorAll: () => [], querySelector: () => null };
  const Tone = { Frequency: () => ({ toFrequency: () => 0 }) };
  function releaseAudio() {} function saveSettings() {} function buildTouchPads() {}
  let currentModifiers = [], savedModifiers = null;
`;
const driver = `
  return {
    modifiers: allAvailableModifiers.map(m => m.id),
    keyRootName,
    chordNames(mode, solfege) {
      notationSelector.value = solfege ? 'solfeggio' : 'letter';
      modeSelector.value = mode;
      updateKeyContext();
      return leftChordNames.slice();
    },
    chord(spec) {
      notationSelector.value = spec.notation;
      modeSelector.value = spec.mode;
      octaveSelector.value = String(spec.octave);
      updateKeyContext();
      currentModifiers = spec.list.slice();
      activeTypeIdx = spec.typeIdx;
      activeNoteIdx = spec.root;
      return getChordInfo(spec.dualMod, spec.modPair);
    },
  };
`;
const api = new Function(prelude + section + driver)();
const snap = { source: 'choordination/index.html at commit 5aaf5ee (before Phase 1), plus the PATCHES in tools/make-theory-snapshot.js', ...buildSnapshot(api) };

// Arrays of plain values stay on one line so the file stays diffable.
function stringify(v, indent = '') {
  if (Array.isArray(v)) {
    if (v.every(x => x === null || typeof x !== 'object')) return JSON.stringify(v);
    return '[\n' + v.map(x => indent + '  ' + stringify(x, indent + '  ')).join(',\n') + '\n' + indent + ']';
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.every(k => v[k] === null || typeof v[k] !== 'object')) return JSON.stringify(v);
    return '{\n' + keys.map(k => indent + '  ' + JSON.stringify(k) + ': ' + stringify(v[k], indent + '  ')).join(',\n') + '\n' + indent + '}';
  }
  return JSON.stringify(v);
}
print(stringify(snap));
