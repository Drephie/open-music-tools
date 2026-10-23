/* shared/theory.js: notes, keys and chords. Pure functions: no DOM, no Tone.
 *
 * Pitch classes are 0..11 (C=0). Letters are indexed 0..6 (C D E F G A B).
 * `solfege` = true spells with Do Re Mi..., otherwise C D E... Accidentals are
 * plain ASCII '#' and 'b' (chord suffixes may contain '♭', as in m7♭5).
 *
 * Keys
 *   parseKey('chromatic' | '<root 0..11>_maj' | '<root>_min')
 *     -> { chromatic: true } | { chromatic: false, rootIdx, scaleType: 'maj'|'min' }
 *   keyRootName(rootIdx, scaleType, solfege)  'F#' / 'Gb' as the key signature spells it
 *   keyUsesSharps(rootIdx, scaleType), tonicLetterIdx(rootIdx, scaleType)
 *   keyChordNames(key, solfege)  chord labels of the key's degrees
 *     ('C','Dm',...,'Bdim'), or the 12 chromatic roots (flats)
 *
 * Spelling
 *   spellOnLetter(letterIdx, targetPc, solfege)  spells a pitch class on a given
 *     letter: (3, 6) -> 'F#', (4, 6) -> 'Gb'. Letter indices wrap around.
 *   accSym(acc), pc(n), ivLetterOffset(semitones), pcLetterIdx(pc)
 *
 * Chords
 *   CHORD_MODIFIERS  the 16 modifier ids, in menu order
 *   modifierIntervals(mod, third, fifth, seventh)  semitones above the root
 *   modifierSuffix(mod, third, fifth, seventh)     'm', 'maj7', 'sus4', ...
 *     'Triad', '7th' and 'Add9' use the key's own third/fifth/seventh on that
 *     degree (so '7th' on V in major, or VII in minor, is a dominant 7th).
 *   pickModifiers(list, typeIdx, dualMod, modPair) -> [mod1, mod2 | null]
 *     modPair = [i, j] picks two to blend; dualMod adds the next one. Both
 *     are optional. Indices are clamped to the list.
 *   getChordInfo({ key, degree, modifiers, octave = 0, solfege = false })
 *     -> { freqs, midiNotes, name, noteNames }
 *     degree is 0..6 in a key, 0..11 in chromatic (clamped). Degree 0 of C
 *     major at octave 0 is MIDI 48 (C3). Two different modifiers blend:
 *     name 'C' + 'maj+sus4'.
 *   midiToFreq(n)  equal temperament, A4 = 440 Hz (same numbers as Tone.js)
 *   MIDI_BASE, MAJOR_SCALE_STEPS, MINOR_SCALE_STEPS, DIATONIC_QUALITIES
 *
 * Smooth chords (root in the bass, the chord above moves as little as possible)
 *   voiceChord(info, { prevUpper, tonicMidi }) -> { ...info, bass, upper }
 *     info comes from getChordInfo. bass = the root an octave below root
 *     position; upper = the close-position inversion nearest to prevUpper
 *     (the previous chord's `upper`; null starts from root position), with
 *     its lowest note in [tonicMidi - 5, tonicMidi + 7] and above the bass.
 *     midiNotes/freqs are bass first, then upper low to high; noteNames are
 *     the upper notes only, low to high (the bass root is implied by the
 *     name, which is unchanged). Keep `upper` and pass it to the next call.
 *     Example, C major: C (C2 | C3 E3 G3) -> F (F2 | C3 F3 A3) -> G (G2 | B2 D3 G3).
 *   keyTonicMidi(key, octave)  the tonicMidi anchor for a key and octave
 *   closeVoicings(pcs, lo, hi), voicingDistance(a, b)  the building blocks
 *     (9ths fold into the octave: a first Cadd9 is voiced E3 G3 C4 D4)
 *
 * Tests: tests/theory.html checks getChordInfo against a snapshot of the
 * original Choordination code, and voiceChord against known answers.
 */

// --- NOTE SPELLING (key-signature aware) ---
// Real-world key names follow the circle of fifths: sharp keys are spelled
// with sharps (D, A, E, B, F#; E/B/F#/C#/G# minor) and flat keys with flats
// (F, Bb, Eb, Ab, Db; C/D/F/G/Bb/Eb minor). Chord roots use proper letter
// stacking so every degree gets a distinct letter (e.g. D major → D E F# G
// A B C#, not Gb/Db), and chord tones are spelled from that root.
export const SHARP_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_LETTERS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const SHARP_SOLFEGE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
export const FLAT_SOLFEGE  = ['Do', 'Reb', 'Re', 'Mib', 'Mi', 'Fa', 'Solb', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
export const SOLFEGE_OF = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
// Whether each key (by chromatic root 0=C..11=B) is spelled with sharps.
export const KEY_SHARP = {
  maj: [false, false, true, false, true, false, true, true, false, true, false, true],
  min: [false, true, false, false, true, false, true, false, true, true, false, true],
};
export const keyUsesSharps = (rootIdx, type) => KEY_SHARP[type][rootIdx];
export const keyRootName = (rootIdx, type, solfege) =>
  (keyUsesSharps(rootIdx, type) ? (solfege ? SHARP_SOLFEGE : SHARP_LETTERS) : (solfege ? FLAT_SOLFEGE : FLAT_LETTERS))[rootIdx];

export function accSym(acc) { return acc === 0 ? '' : acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc); }
// Spell a pitch class onto a specific letter (index 0..6), choosing the
// accidental that turns that letter into the target pitch.
export function spellOnLetter(letterIdx, targetPc, solfege) {
  letterIdx = ((letterIdx % 7) + 7) % 7;
  let acc = (((targetPc - LETTER_PC[letterIdx]) % 12) + 12) % 12;
  if (acc > 6) acc -= 12;
  return (solfege ? SOLFEGE_OF[LETTERS[letterIdx]] : LETTERS[letterIdx]) + accSym(acc);
}
export const tonicLetterIdx = (rootIdx, type) => LETTERS.indexOf(keyRootName(rootIdx, type, false)[0]);

// --- KEYS AND DEGREES ---
export const MIDI_BASE = 48; // C3
export const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_SCALE_STEPS = [0, 2, 3, 5, 7, 8, 10];
export const DIATONIC_QUALITIES = {
  maj: ['Major', 'Minor', 'Minor', 'Major', 'Major', 'Minor', 'Dim'],
  min: ['Minor', 'Dim', 'Major', 'Minor', 'Minor', 'Major', 'Major']
};

export function parseKey(value) {
  if (value === 'chromatic') return { chromatic: true };
  const parts = value.split('_');
  return { chromatic: false, rootIdx: parseInt(parts[0], 10), scaleType: parts[1] };
}

export function keyChordNames(key, solfege) {
  // No key context in chromatic mode → conventional flats.
  if (key.chromatic) return (solfege ? FLAT_SOLFEGE : FLAT_LETTERS).slice();
  const scaleSteps = key.scaleType === 'maj' ? MAJOR_SCALE_STEPS : MINOR_SCALE_STEPS;
  const qualities = DIATONIC_QUALITIES[key.scaleType];
  const tonicLet = tonicLetterIdx(key.rootIdx, key.scaleType);
  return scaleSteps.map((step, idx) => {
    // Each degree walks one letter further, so every chord root is spelled
    // with a distinct letter and the correct accidental for this key.
    const rootNote = spellOnLetter(tonicLet + idx, (key.rootIdx + step) % 12, solfege);
    const quality = qualities[idx];
    if (quality === 'Minor') return rootNote + 'm';
    if (quality === 'Dim') return rootNote + 'dim';
    return rootNote;
  });
}

// --- CHORD MODIFIERS ---
export const CHORD_MODIFIERS = ['Triad', 'Maj', 'Min', 'Dim', 'Aug', '7th', 'Maj7', 'Min7', 'Dom7', 'Dim7',
  'Sus2', 'Sus4', '6', 'Add9', 'Maj9', 'Min9'];

export function modifierIntervals(mod, baseThird, baseFifth, baseSeventh) {
  switch (mod) {
    case 'Triad': return [0, baseThird, baseFifth];
    case 'Maj': return [0, 4, 7];
    case 'Min': return [0, 3, 7];
    case 'Dim': return [0, 3, 6];
    case 'Aug': return [0, 4, 8];
    case '7th': return [0, baseThird, baseFifth, baseSeventh];
    case 'Maj7': return [0, 4, 7, 11];
    case 'Min7': return [0, 3, 7, 10];
    case 'Dom7': return [0, 4, 7, 10];
    case 'Dim7': return [0, 3, 6, 9];
    case 'Sus2': return [0, 2, 7];
    case 'Sus4': return [0, 5, 7];
    case '6': return [0, 4, 7, 9];
    case 'Add9': return [0, baseThird, baseFifth, 14];
    case 'Maj9': return [0, 4, 7, 11, 14];
    case 'Min9': return [0, 3, 7, 10, 14];
    default: return [0, baseThird, baseFifth];
  }
}
export function modifierSuffix(mod, baseThird, baseFifth, baseSeventh) {
  switch (mod) {
    case 'Triad': if (baseThird === 3 && baseFifth === 6) return 'dim'; return baseThird === 3 ? 'm' : '';
    case 'Maj': return '';
    case 'Min': return 'm';
    case 'Dim': return 'dim';
    case 'Aug': return 'aug';
    case '7th':
      if (baseThird === 4 && baseSeventh === 11) return 'maj7';
      if (baseThird === 3 && baseFifth === 6) return 'm7♭5';
      return baseThird === 3 ? 'm7' : '7';
    case 'Maj7': return 'maj7';
    case 'Min7': return 'm7';
    case 'Dom7': return '7';
    case 'Dim7': return 'dim7';
    case 'Sus2': return 'sus2';
    case 'Sus4': return 'sus4';
    case '6': return '6';
    case 'Add9': return baseThird === 3 ? 'm(add9)' : 'add9';
    case 'Maj9': return 'maj9';
    case 'Min9': return 'm9';
    default: return '';
  }
}

export function pickModifiers(list, typeIdx, dualMod, modPair) {
  const clampMod = i => Math.max(0, Math.min(list.length - 1, i));
  if (modPair) return [list[clampMod(modPair[0])], list[clampMod(modPair[1])]];
  return [list[clampMod(typeIdx)], dualMod ? list[(clampMod(typeIdx) + 1) % list.length] : null];
}

// Chord-tone letter offsets: how many scale letters a semitone interval is
// above the root (stacked-thirds spelling). e.g. a major 3rd (4) is the 3rd
// letter → offset 2, a 5th (7) → offset 4. 9ths fold to a 2nd letter.
const IV_LETTER = [0, 1, 1, 2, 2, 3, 4, 4, 4, 5, 6, 6];
export const ivLetterOffset = (iv) => IV_LETTER[((iv % 12) + 12) % 12];
export const pc = (n) => ((n % 12) + 12) % 12;
export const pcLetterIdx = (p) => LETTERS.indexOf(FLAT_LETTERS[p][0]);

// Bit-for-bit what Tone.Frequency(n, 'midi').toFrequency() returns in Tone.js
// 14.8.49: mtof, then toSeconds() and toFrequency() each take a reciprocal,
// which changes the last digit for some notes. tests/theory.html checks this.
export const midiToFreq = (n) => 1 / (1 / (440 * Math.pow(2, (n - 69) / 12)));

// One source of truth for what a chord means musically: frequencies for
// Tone, note numbers, and correctly-spelled names.
export function getChordInfo({ key, degree = 0, modifiers = [], octave = 0, solfege = false }) {
  const [modifier1, modifier2 = null] = modifiers;
  let baseThird = 4, baseFifth = 7, baseSeventh = 10;
  let rootMidi, rootLetterIdx;
  if (key.chromatic) {
    const noteIdx = Math.max(0, Math.min(11, degree));
    rootMidi = MIDI_BASE + noteIdx;
    rootLetterIdx = pcLetterIdx(pc(rootMidi));
  } else {
    const noteIdx = Math.max(0, Math.min(6, degree));
    const scaleSteps = key.scaleType === 'maj' ? MAJOR_SCALE_STEPS : MINOR_SCALE_STEPS;
    rootMidi = MIDI_BASE + key.rootIdx + scaleSteps[noteIdx];
    rootLetterIdx = (tonicLetterIdx(key.rootIdx, key.scaleType) + noteIdx) % 7;
    const dq = DIATONIC_QUALITIES[key.scaleType][noteIdx];
    baseThird = (dq === 'Minor' || dq === 'Dim') ? 3 : 4;
    baseFifth = (dq === 'Dim') ? 6 : 7;
    // The key's own seventh, seven scale steps up: maj7 on I and IV, a
    // dominant 7th on V (VII in minor), m7 or m7♭5 on the others.
    baseSeventh = scaleSteps[(noteIdx + 6) % 7] + (noteIdx + 6 >= 7 ? 12 : 0) - scaleSteps[noteIdx];
  }
  rootMidi += octave * 12;

  const intervals = new Set();
  [modifier1, modifier2].forEach(mod => {
    if (!mod) return;
    modifierIntervals(mod, baseThird, baseFifth, baseSeventh).forEach(v => intervals.add(v));
  });
  const sorted = [...intervals].sort((a, b) => a - b);
  const midiNotes = sorted.map(iv => rootMidi + iv);
  const freqs = midiNotes.map(midiToFreq);
  const noteNames = sorted.map(iv => spellOnLetter(rootLetterIdx + ivLetterOffset(iv), pc(rootMidi + iv), solfege));

  const rootName = spellOnLetter(rootLetterIdx, pc(rootMidi), solfege);
  const sep = solfege ? ' ' : '';
  let suffix = modifierSuffix(modifier1, baseThird, baseFifth, baseSeventh);
  if (modifier2 && modifier2 !== modifier1) {
    suffix = (suffix || 'maj') + '+' + (modifierSuffix(modifier2, baseThird, baseFifth, baseSeventh) || 'maj');
  }
  return { freqs, midiNotes, name: rootName + sep + suffix, noteNames };
}

// --- SMOOTH CHORDS (root in the bass, the chord above moves as little as possible) ---

// MIDI note of the key's tonic in root position at this octave (C3 in
// chromatic mode): the anchor that keeps smooth chords from drifting.
export const keyTonicMidi = (key, octave = 0) => MIDI_BASE + (key.chromatic ? 0 : key.rootIdx) + octave * 12;

// How far apart two voicings are: every note's distance to the nearest note
// of the other voicing, both ways (works for chords of different sizes).
export function voicingDistance(a, b) {
  const near = (n, set) => Math.min(...set.map(m => Math.abs(n - m)));
  return a.reduce((s, n) => s + near(n, b), 0) + b.reduce((s, n) => s + near(n, a), 0);
}

// Every close-position voicing (all notes within one octave, each inversion)
// of the given pitch classes, listed in ascending order from the root, whose
// lowest note lies in [lo, hi].
export function closeVoicings(pcs, lo, hi) {
  const out = [];
  for (let r = 0; r < pcs.length; r++) {
    const order = [...pcs.slice(r), ...pcs.slice(0, r)];
    for (let bottom = lo; bottom <= hi; bottom++) {
      if (pc(bottom) !== order[0]) continue;
      const v = [bottom];
      for (const p of order.slice(1)) {
        let n = v[v.length - 1] + 1;
        while (pc(n) !== p) n++;
        v.push(n);
      }
      out.push(v);
    }
  }
  return out;
}

// Turns a root-position chord from getChordInfo into a smooth one: the root
// an octave down in the bass, and above it the close-position voicing nearest
// to prevUpper (the upper notes of the chord played before; null for the
// first chord, which then stays as close to root position as it can).
export function voiceChord(info, { prevUpper = null, tonicMidi = MIDI_BASE } = {}) {
  const bass = info.midiNotes[0] - 12;
  const nameOf = {};
  info.midiNotes.forEach((m, i) => { nameOf[pc(m)] = info.noteNames[i]; });
  // Chord tones by pitch above the root, so a 9th folds down to a 2nd and
  // every inversion is close position.
  const rootPc = pc(info.midiNotes[0]);
  const pcs = [...new Set(info.midiNotes.map(pc))].sort((a, b) => pc(a - rootPc) - pc(b - rootPc));
  const ref = prevUpper && prevUpper.length ? prevUpper : info.midiNotes;
  const mean = (v) => v.reduce((s, n) => s + n, 0) / v.length;
  let lo = tonicMidi - 5, hi = tonicMidi + 7;
  let candidates = [];
  // The window always holds every inversion; only the "above the bass" rule
  // can empty it, and then the next octave up is used.
  for (let tries = 0; candidates.length === 0 && tries < 4; tries++, lo += 12, hi += 12) {
    candidates = closeVoicings(pcs, lo, hi).filter(v => v[0] > bass);
  }
  let best = null, bestKey = null;
  for (const v of candidates) {
    const key = [voicingDistance(v, ref), Math.abs(mean(v) - mean(ref)), v[0]];
    if (!best || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
      best = v; bestKey = key;
    }
  }
  const midiNotes = [bass, ...best];
  return {
    ...info,
    midiNotes,
    freqs: midiNotes.map(midiToFreq),
    noteNames: best.map(m => nameOf[pc(m)]),
    bass,
    upper: best,
  };
}
