/* Shared case list for the theory snapshot.
 *
 * Both sides use this file, so they walk the cases in the same order:
 *   - tests/tools/make-theory-snapshot.js runs it against the ORIGINAL
 *     Choordination code and writes tests/fixtures/theory-snapshot.json;
 *   - tests/theory.html runs it against shared/theory.js and compares.
 *
 * buildSnapshot(api) takes an adapter:
 *   api.modifiers               ordered modifier ids (the full list)
 *   api.keyRootName(i, type, solfege)
 *   api.chordNames(mode, solfege)   the 7 (or 12) chord labels of a key
 *   api.chord(spec)             -> { name, noteNames, midiNotes }
 *     spec = { mode, notation, octave, root, list, typeIdx, dualMod, modPair }
 */

export const NOTATIONS = ['letter', 'solfeggio'];
export const OCTAVES = [-1, 0, 1];
export const MODES = ['chromatic',
  ...Array.from({ length: 12 }, (_, i) => `${i}_maj`),
  ...Array.from({ length: 12 }, (_, i) => `${i}_min`)];
export const rootsOf = (mode) => (mode === 'chromatic' ? 12 : 7);

// FNV-1a over UTF-16 code units: a compact digest for the big pair sweep.
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Compares two snapshots leaf by leaf. Returns one row per section:
// { section, checked, failed, examples: ['path: expected … got …'] }.
export const SECTIONS = ['modifiers', 'octaves', 'keyNames', 'chordNames', 'chords', 'pairs', 'selection'];
export function compareSnapshots(expected, actual, maxExamples = 10) {
  return SECTIONS.map(section => {
    const row = { section, checked: 0, failed: 0, examples: [] };
    const walk = (exp, act, path) => {
      if (exp && typeof exp === 'object') {
        const keys = new Set([...Object.keys(exp), ...Object.keys(act && typeof act === 'object' ? act : {})]);
        for (const k of keys) walk(exp[k], act && typeof act === 'object' ? act[k] : undefined, `${path}.${k}`);
        return;
      }
      row.checked++;
      if (exp !== act) {
        row.failed++;
        if (row.examples.length < maxExamples) row.examples.push(`${path}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`);
      }
    };
    walk(expected[section], actual[section], section);
    return row;
  });
}

const line = (info) => `${info.name}|${info.noteNames.join(' ')}|${info.midiNotes.join(' ')}`;

export function buildSnapshot(api) {
  const mods = api.modifiers;
  const snap = { modifiers: mods.slice(), octaves: OCTAVES, keyNames: {}, chordNames: {}, chords: {}, pairs: {}, selection: [] };

  for (const notation of NOTATIONS) {
    const solfege = notation === 'solfeggio';
    snap.keyNames[notation] = {};
    for (const type of ['maj', 'min']) {
      snap.keyNames[notation][type] = Array.from({ length: 12 }, (_, i) => api.keyRootName(i, type, solfege));
    }
  }

  for (const mode of MODES) {
    snap.chordNames[mode] = {};
    for (const notation of NOTATIONS) snap.chordNames[mode][notation] = api.chordNames(mode, notation === 'solfeggio');

    // Every root x single modifier: names per notation (checked at every
    // octave, so they must not depend on it) and MIDI notes per octave.
    const entry = { midi: {} };
    for (const notation of NOTATIONS) {
      const rows = [];
      for (let root = 0; root < rootsOf(mode); root++) {
        const row = [];
        for (let m = 0; m < mods.length; m++) {
          let first = null;
          for (const octave of OCTAVES) {
            const info = api.chord({ mode, notation, octave, root, list: mods, typeIdx: m, dualMod: false, modPair: null });
            const names = `${info.name}|${info.noteNames.join(' ')}`;
            if (first === null) first = names;
            else if (names !== first) throw new Error(`names depend on octave: ${mode} ${notation} ${root} ${mods[m]}`);
            if (notation === NOTATIONS[0]) {
              (entry.midi[octave] ||= [])[root] ||= [];
              entry.midi[octave][root][m] = info.midiNotes.join(' ');
            }
          }
          row.push(first);
        }
        rows.push(row);
      }
      entry[notation] = rows;
    }
    snap.chords[mode] = entry;

    // Every ordered pair of modifiers (the YOLO sign) and every dual-modifier
    // step, at octave 0, folded into one digest per mode and notation.
    snap.pairs[mode] = {};
    for (const notation of NOTATIONS) {
      let text = '';
      for (let root = 0; root < rootsOf(mode); root++) {
        for (let a = 0; a < mods.length; a++) {
          for (let b = 0; b < mods.length; b++) {
            text += line(api.chord({ mode, notation, octave: 0, root, list: mods, typeIdx: 0, dualMod: false, modPair: [a, b] })) + '\n';
          }
          text += line(api.chord({ mode, notation, octave: 0, root, list: mods, typeIdx: a, dualMod: true, modPair: null })) + '\n';
        }
      }
      snap.pairs[mode][notation] = fnv1a(text);
    }
  }

  // How the modifier is picked from a shorter list, including out-of-range
  // indices (clamped) and the dual-modifier wrap-around.
  const lists = [['Triad'], ['Triad', '7th', 'Sus4', 'Add9'], mods];
  const pairsToTry = [null, [0, 1], [3, 0], [-2, 25], [2, 2]];
  for (const mode of ['0_maj', '9_min', 'chromatic']) {
    for (const root of [-1, 0, 4, 20]) {
      for (const list of lists) {
        for (const typeIdx of [-1, 0, 1, 3, 15, 20]) {
          for (const dualMod of [false, true]) {
            for (const modPair of pairsToTry) {
              if (modPair && (typeIdx !== 0 || dualMod)) continue; // a pair ignores both
              const spec = { mode, notation: 'letter', octave: 1, root, list, typeIdx, dualMod, modPair };
              snap.selection.push({ ...spec, list: list.join(','), modPair: modPair ? modPair.join(',') : '', out: line(api.chord(spec)) });
            }
          }
        }
      }
    }
  }
  return snap;
}
