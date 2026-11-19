/* jam-machine/jam.js: the Jam Machine's rules (spec: specs/jam-machine.md).
 * No sound, no DOM: tested by tests/jam-machine.html (and jsc).
 *
 * A key is { tonic: 0..11 (C = 0), mode: 'maj' | 'min' }.
 * A chord is { step, q, semi?, lock? }, counted from the key, so the same
 * chords move with the key (C G Am F in C is D A Bm G in D):
 *   step  0..6, the scale step its letter is on (I = 0, V = 4)
 *   q     'T' = the key's own chord on that step (C, Dm, Em... in C major),
 *         'S' = the key's own 7th chord there (Cmaj7, Dm7, G7...); or a
 *         quality from QUALITIES ('maj', 'min', '7', 'sus4'...) with
 *   semi  its root, half steps above the key's note (B♭ in C = 10)
 *   lock  true: kept by New chords and by dragging
 *   beats how long it lasts, in beats (1..16); none = one bar
 * 'T' and 'S' chords follow a change of Major/Minor (I V vi IV becomes
 * i v VI iv); the others keep their notes.
 *
 *   STYLE_IDS, STYLES (./styles.js), QUALITIES, MAX_BARS (64 per section), MAX_SECTIONS (24), MAJOR, MINOR
 *   parseNumeral(token, mode) -> chord   ('bVII', 'ii7', 'Imaj7', 'iiø7'...)
 *   resolve(chord, mode) -> { step, semi, quality }
 *   chordLabel(chord, key, solfege) -> { name: 'F#m7' | 'Fa# m7', root: 'F#', suffix: 'm7', numeral: 'vi7' }
 *     (plain # and b; the screen draws ♯ and ♭)
 *   chordNotes(chord, key, prevUpper) -> { pcs, upper, bass, root, third, fifth, seventh }
 *     upper: MIDI notes for the chord sound, near the key's note around
 *     G3..F#4 and as close as possible to prevUpper (smooth chords);
 *     bass: the root between A1 and G#2; third/fifth/seventh in half steps
 *     above the root (seventh null for triads)
 *   keyName(key, solfege) -> 'Eb' | 'Mib'
 *   randomKey(style, rng, { key, keyFixed, modeFixed }) -> key
 *     a new note (never the same as key.tonic) unless keyFixed; major or
 *     minor by the style's majorChance unless modeFixed
 *   newProgression({ style, key, length, prog, rng }) -> chords
 *     length bars from the style's progressions in key.mode; locked chords of
 *     prog stay where they are and the progressions that agree with them win;
 *     with nothing locked it is never the same as prog
 *   nextChord(style, key, prev, rng) -> a chord that often follows prev in
 *     the style (for Add a bar)
 *   suggestions(style, key) -> { fit: [7 chords], more: [chords] }
 *     fit: the key's own chords (7th chords in Jazz, Bossa nova and Lo-fi),
 *     the style's most used first; more: borrowed chords (B♭ in C major)
 *   changeMode(prog, mode) -> chords for the same steps in the other mode
 *   moveChord(prog, from, to) -> chords; locked ones keep their place, the
 *     others move around them (dragging)
 *   sameChord(a, b, mode) -> true when they sound the same
 *   SECTION_TYPES  'intro', 'verse', 'prechorus', 'chorus', 'bridge', 'outro'
 *   A song is a list of sections { type, chords }, played top to bottom.
 *   nextSectionType(type) -> the usual next part (verse -> chorus...)
 *   sectionNumbers(sections) -> [n | null]: 1, 2... when a type comes more
 *     than once (Verse 1, Chorus, Verse 2), else null
 *   duplicateSection(sections, i) -> a copy of section i right after it
 *   moveSection(sections, i, by) -> section i moved by -1 or +1
 *   toFile(state) -> text; fromFile(text, instruments) -> state | null
 *   chordBeats(chord, meter) -> its length in beats ('4/4', '3/4', '6/8')
 *     the .omt file (Open Music Tools), version 2: { style, key, newKey,
 *     bpm, meter, sections: [{ type, chords }], sound: { instrument,
 *     kit: 'acoustic' | 'synth', chords|drums|bass: { on, vol } } }.
 *     newKey { tonic: 0..11 | null, mode: 'maj' | 'min' | null }: the key and
 *     mode New chords uses (null = random). A version 1 file (one list of
 *     chords, keyFixed/modeFixed) opens as one Verse.
 *   rngFrom(seed) -> a repeatable random function (tests)
 */
import { spellOnLetter, keyRootName, tonicLetterIdx, voiceChord } from '../shared/theory.js';
import { STYLES, STYLE_IDS, METERS, METER_IDS } from './styles.js';

export { STYLES, STYLE_IDS, METERS, METER_IDS };
export { patternFor, styleMeter } from './styles.js';
export const MAX_BEATS = 16;
export const chordBeats = (chord, meter) => chord.beats || (METERS[meter] || METERS['4/4']).beats;
export const MAX_BARS = 64;
export const MAX_SECTIONS = 24;
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const MINOR = [0, 2, 3, 5, 7, 8, 10];
const scale = (mode) => (mode === 'min' ? MINOR : MAJOR);
const mod12 = (n) => ((n % 12) + 12) % 12;

export const QUALITIES = {
  maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9],
  sus2: [0, 2, 7], sus4: [0, 5, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14],
};
const SUFFIX = { maj: '', min: 'm', dim: 'dim', aug: '+', 7: '7', maj7: 'maj7', m7: 'm7', m7b5: 'm7♭5', dim7: 'dim7', sus2: 'sus2', sus4: 'sus4', 6: '6', m6: 'm6', 9: '9', m9: 'm9', add9: 'add9' };
const NUM_SUFFIX = { maj: '', min: '', dim: '°', aug: '+', 7: '7', maj7: 'maj7', m7: '7', m7b5: 'ø7', dim7: '°7', sus2: 'sus2', sus4: 'sus4', 6: '6', m6: '6', 9: '9', m9: '9', add9: 'add9' };
const LOWER = new Set(['min', 'dim', 'm7', 'm7b5', 'dim7', 'm6', 'm9']);
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// The key's own chord on a step: a triad, or a 7th chord.
function diatonic(mode, step, seventh) {
  const sc = scale(mode), up = (k) => mod12(sc[(step + k) % 7] - sc[step]);
  const third = up(2), fifth = up(4), sev = up(6);
  const triad = third === 4 ? (fifth === 8 ? 'aug' : 'maj') : fifth === 6 ? 'dim' : 'min';
  if (!seventh) return triad;
  if (triad === 'maj') return sev === 11 ? 'maj7' : '7';
  if (triad === 'min') return 'm7';
  return sev === 10 ? 'm7b5' : 'dim7';
}

// A chord as a step and a quality; the key's own chords become 'T' or 'S'.
function makeChord(step, semi, quality, mode) {
  semi = mod12(semi);
  if (semi === scale(mode)[step]) {
    if (quality === diatonic(mode, step, false)) return { step, q: 'T' };
    if (quality === diatonic(mode, step, true)) return { step, q: 'S' };
  }
  return { step, semi, q: quality };
}

export function resolve(chord, mode) {
  if (chord.q === 'T' || chord.q === 'S') return { step: chord.step, semi: scale(mode)[chord.step], quality: diatonic(mode, chord.step, chord.q === 'S') };
  return { step: chord.step, semi: mod12(chord.semi), quality: chord.q };
}

export function parseNumeral(token, mode) {
  const m = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(token);
  if (!m) throw new Error('Bad chord number: ' + token);
  const upper = m[2] === m[2].toUpperCase(), step = ROMAN.indexOf(m[2].toUpperCase());
  const semi = scale(mode)[step] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0);
  const quality = {
    '': upper ? 'maj' : 'min', '°': 'dim', '+': 'aug', 7: upper ? '7' : 'm7', maj7: 'maj7', 'ø7': 'm7b5', '°7': 'dim7',
    sus2: 'sus2', sus4: 'sus4', 6: upper ? '6' : 'm6', 9: upper ? '9' : 'm9', add9: 'add9',
  }[m[3]];
  if (!quality) throw new Error('Bad chord ending: ' + token);
  return makeChord(step, semi, quality, mode);
}

export const keyName = (key, solfege) => keyRootName(key.tonic, key.mode, solfege);

export function chordLabel(chord, key, solfege) {
  const r = resolve(chord, key.mode);
  // On its step's letter (B♭ for ♭VII in C); a double sharp or flat moves to the next letter (A, not B𝄫).
  const letter = tonicLetterIdx(key.tonic, key.mode) + r.step;
  const root = [0, -1, 1].map((d) => spellOnLetter(letter + d, key.tonic + r.semi, solfege)).find((n) => !/(##|bb)$/.test(n));
  const suffix = SUFFIX[r.quality];
  const shift = mod12(r.semi - scale(key.mode)[r.step]);
  const roman = LOWER.has(r.quality) ? ROMAN[r.step].toLowerCase() : ROMAN[r.step];
  return {
    root, suffix,
    name: root + (solfege && suffix ? ' ' : '') + suffix,   // 'La m7', as theory.js names chords
    numeral: (shift === 11 ? 'b' : shift === 1 ? '#' : '') + roman + NUM_SUFFIX[r.quality],
  };
}

export function chordNotes(chord, key, prevUpper = null) {
  const r = resolve(chord, key.mode), shape = QUALITIES[r.quality];
  const anchor = 55 + mod12(key.tonic - 7);             // the key's note, G3..F#4
  const rootMidi = anchor + r.semi;
  const info = { midiNotes: shape.map((s) => rootMidi + s), noteNames: shape.map(String) };
  const { upper } = voiceChord(info, { prevUpper, tonicMidi: anchor });
  const has = (...ivs) => ivs.find((i) => shape.includes(i)) ?? null;
  return {
    pcs: shape.map((s) => mod12(key.tonic + r.semi + s)),
    upper,
    bass: 33 + mod12(key.tonic + r.semi - 9),            // A1..G#2
    root: mod12(key.tonic + r.semi), third: has(4, 3, 5, 2), fifth: has(7, 6, 8), seventh: has(10, 11, 9),
  };
}

export function sameChord(a, b, mode) {
  const x = resolve(a, mode), y = resolve(b, mode);
  return x.semi === y.semi && x.quality === y.quality;
}

// --- RANDOM ---
export function rngFrom(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];

export function randomKey(style, rng = Math.random, { key = null, keyFixed = false, modeFixed = false } = {}) {
  let tonic = key ? key.tonic : 0;
  if (!keyFixed || !key) { const others = [...Array(12).keys()].filter((n) => !key || n !== key.tonic); tonic = pick(others, rng); }
  const mode = modeFixed && key ? key.mode : rng() < STYLES[style].majorChance ? 'maj' : 'min';
  return { tonic, mode };
}

// --- PROGRESSIONS ---
const templates = (style, mode) => STYLES[style][mode === 'min' ? 'minor' : 'major'].map((line) => line.split(' ').map((tok) => parseNumeral(tok, mode)));

export function newProgression({ style, key, length, prog = [], rng = Math.random }) {
  length = Math.max(1, Math.min(MAX_BARS, length | 0));
  const list = templates(style, key.mode);
  const locked = (i) => prog[i] && prog[i].lock;
  const anyLock = prog.some((c, i) => i < length && c && c.lock);
  for (let attempt = 0; ; attempt++) {
    const out = [];
    for (let start = 0; start < length; ) {
      // The progression that agrees with the most locked chords here wins; ties by chance.
      const score = (t) => t.reduce((s, c, k) => s + (start + k < length && locked(start + k) && sameChord(c, prog[start + k], key.mode) ? 1 : 0), 0);
      const best = Math.max(...list.map(score));
      const t = pick(list.filter((x) => score(x) === best), rng);
      for (let k = 0; k < t.length && start + k < length; k++) out.push({ ...t[k], lock: false });
      start += t.length;
    }
    prog.forEach((c, i) => { if (i < length && c && c.lock) out[i] = { ...c }; });
    const same = out.length === prog.length && out.every((c, i) => sameChord(c, prog[i], key.mode));
    if (anyLock || !same || attempt >= 8) return out;
  }
}

export function nextChord(style, key, prev, rng = Math.random) {
  const list = templates(style, key.mode), follows = [];
  if (prev) for (const t of list) t.forEach((c, k) => { if (sameChord(c, prev, key.mode)) follows.push(t[(k + 1) % t.length]); });
  return { ...(follows.length ? pick(follows, rng) : pick(list, rng)[0]), lock: false };
}

const BORROWED = {
  maj: ['bVII', 'bVI', 'bIII', 'iv', 'II7', 'III7', 'Isus4', 'Vsus4', 'I7'],
  min: ['V', 'V7', 'IV', 'bII', 'I', 'isus4', 'Vsus4'],
};
export function suggestions(style, key) {
  const st = STYLES[style], list = templates(style, key.mode).flat();
  const uses = (c) => list.filter((x) => sameChord(x, c, key.mode)).length;
  const fit = [0, 1, 2, 3, 4, 5, 6].map((step) => ({ step, q: st.sevenths ? 'S' : 'T' }))
    .map((c, i) => ({ c, i, n: uses(c) })).sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.c);
  const more = [];
  const add = (c) => { if (![...fit, ...more].some((x) => sameChord(x, c, key.mode))) more.push(c); };
  list.forEach(add);
  BORROWED[key.mode].forEach((tok) => add(parseNumeral(tok, key.mode)));
  return { fit, more };
}

export function changeMode(prog, mode) {
  return prog.map((c) => {
    if (c.q === 'T' || c.q === 'S') return { ...c };
    return { ...makeChord(c.step, c.semi, c.q, mode), lock: !!c.lock };
  });
}

export function moveChord(prog, from, to) {
  if (!prog[from] || prog[from].lock || from === to) return prog.slice();
  const free = prog.map((c, i) => (c.lock ? -1 : i)).filter((i) => i >= 0);
  to = Math.max(0, Math.min(prog.length - 1, to));
  // A locked target: the nearest free place, on the side the chord came from.
  const toK = free.reduce((best, i, k) => {
    const d = Math.abs(i - to) - (Math.sign(from - to) === Math.sign(i - to) ? 0.5 : 0);
    return d < best.d ? { k, d } : best;
  }, { k: 0, d: Infinity }).k;
  const items = free.map((i) => prog[i]);
  const [moved] = items.splice(free.indexOf(from), 1);
  items.splice(toK, 0, moved);
  const out = prog.slice();
  free.forEach((i, k) => { out[i] = items[k]; });
  return out;
}

// --- SECTIONS ---
export const SECTION_TYPES = ['intro', 'verse', 'prechorus', 'chorus', 'bridge', 'outro'];
const NEXT = { intro: 'verse', verse: 'chorus', prechorus: 'chorus', chorus: 'verse', bridge: 'chorus', outro: 'verse' };
export const nextSectionType = (type) => NEXT[type] || 'verse';
export function sectionNumbers(sections) {
  const seen = {};
  return sections.map((x) => {
    if (sections.filter((y) => y.type === x.type).length < 2) return null;
    seen[x.type] = (seen[x.type] || 0) + 1;
    return seen[x.type];
  });
}
const copyChords = (chords) => chords.map((c) => ({ ...c }));
export function duplicateSection(sections, i) {
  const out = sections.slice();
  out.splice(i + 1, 0, { type: sections[i].type, chords: copyChords(sections[i].chords) });
  return out;
}
export function moveSection(sections, i, by) {
  const j = i + by;
  if (j < 0 || j >= sections.length) return sections.slice();
  const out = sections.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// --- THE .omt FILE ---
const PARTS = ['chords', 'drums', 'bass'];
const KITS = ['acoustic', 'synth'];
const chordOut = (c) => ({ ...(c.q === 'T' || c.q === 'S' ? { step: c.step, q: c.q } : { step: c.step, semi: c.semi, q: c.q }), lock: !!c.lock, ...(c.beats ? { beats: c.beats } : {}) });
export function toFile(s) {
  return JSON.stringify({
    format: 'open-music-tools', tool: 'jam-machine', version: 2,
    style: s.style, key: { tonic: s.key.tonic, mode: s.key.mode }, newKey: { tonic: s.newKey.tonic, mode: s.newKey.mode }, bpm: s.bpm, meter: s.meter,
    sections: s.sections.map((x) => ({ type: x.type, chords: x.chords.map(chordOut) })),
    sound: { instrument: s.sound.instrument, kit: s.sound.kit, ...Object.fromEntries(PARTS.map((p) => [p, { on: !!s.sound[p].on, vol: s.sound[p].vol }])) },
  }, null, 1);
}

export function fromFile(text, instruments) {
  let d;
  try { d = JSON.parse(text); } catch { return null; }
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!d || d.format !== 'open-music-tools' || d.tool !== 'jam-machine' || !int(d.version, 1, 2)) return null;
  if (!STYLE_IDS.includes(d.style) || !d.key || !int(d.key.tonic, 0, 11) || !['maj', 'min'].includes(d.key.mode) || !int(d.bpm, 40, 240)) return null;
  const readChords = (list) => {
    if (!Array.isArray(list) || list.length < 1 || list.length > MAX_BARS) return null;
    const chords = [];
    for (const c of list) {
      if (!c || !int(c.step, 0, 6)) return null;
      let x;
      if (c.q === 'T' || c.q === 'S') x = { step: c.step, q: c.q, lock: c.lock === true };
      else if (Object.hasOwn(QUALITIES, c.q) && int(c.semi, 0, 11)) x = { step: c.step, semi: c.semi, q: c.q, lock: c.lock === true };
      else return null;
      if (c.beats !== undefined) { if (!int(c.beats, 1, MAX_BEATS)) return null; x.beats = c.beats; }
      chords.push(x);
    }
    return chords;
  };
  let sections;
  if (d.version === 1) {
    const chords = readChords(d.chords);
    if (!chords) return null;
    sections = [{ type: 'verse', chords }];
  } else {
    if (!Array.isArray(d.sections) || d.sections.length < 1 || d.sections.length > MAX_SECTIONS) return null;
    sections = [];
    for (const x of d.sections) {
      const chords = x && SECTION_TYPES.includes(x.type) ? readChords(x.chords) : null;
      if (!chords) return null;
      sections.push({ type: x.type, chords });
    }
  }
  const s = d.sound || {};
  const sound = { instrument: instruments.includes(s.instrument) ? s.instrument : instruments[0], kit: KITS.includes(s.kit) ? s.kit : 'acoustic' };
  for (const p of PARTS) {
    const x = s[p] || {};
    sound[p] = { on: x.on !== false, vol: int(x.vol, 0, 100) ? x.vol : 80 };
  }
  const nk = d.newKey || {};
  const newKey = d.version === 1
    ? { tonic: d.keyFixed === true ? d.key.tonic : null, mode: d.modeFixed === true ? d.key.mode : null }
    : { tonic: int(nk.tonic, 0, 11) ? nk.tonic : null, mode: ['maj', 'min'].includes(nk.mode) ? nk.mode : null };
  const meter = METER_IDS.includes(d.meter) ? d.meter : '4/4';
  return { style: d.style, key: { tonic: d.key.tonic, mode: d.key.mode }, newKey, bpm: d.bpm, meter, sections, sound };
}
