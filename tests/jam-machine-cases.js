/* tests/jam-machine-cases.js: checks for jam-machine/jam.js and its styles,
 * shared by tests/jam-machine.html and tests/tools/run-jam-machine-test.js.
 * checkJam(jam) -> [{ section, checked, failed, examples }]
 */
export function checkJam(jam) {
  const out = [];
  const check = (section, items, fn) => {
    const row = { section, checked: 0, failed: 0, examples: [] };
    for (const it of items) {
      row.checked++;
      let err;
      try { err = fn(it); } catch (e) { err = String(e); }
      if (err) { row.failed++; if (row.examples.length < 5) row.examples.push(err); }
    }
    out.push(row);
  };
  const { STYLES, STYLE_IDS, parseNumeral, chordLabel, chordNotes, resolve, MAJOR, MINOR } = jam;
  const mod12 = (n) => ((n % 12) + 12) % 12;
  const KEYS = [];
  for (let tonic = 0; tonic < 12; tonic++) for (const mode of ['maj', 'min']) KEYS.push({ tonic, mode });
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const rootPc = (name) => mod12(LETTER_PC[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0));
  const templates = [];
  for (const id of STYLE_IDS) for (const mode of ['maj', 'min']) {
    for (const line of STYLES[id][mode === 'min' ? 'minor' : 'major']) templates.push({ id, mode, line });
  }
  const toks = templates.flatMap((t) => t.line.split(' ').map((tok) => ({ ...t, tok })));

  check('Every style: 4-bar progressions (12 for the Blues), both modes', templates, ({ id, mode, line }) => {
    const n = line.split(' ').map((tok) => parseNumeral(tok, mode)).length;
    if (n !== STYLES[id].bars) return `${id} ${mode}: "${line}" has ${n} bars`;
  });
  check('Every chord number reads back as written', toks, ({ mode, tok }) => {
    const num = chordLabel(parseNumeral(tok, mode), { tonic: 0, mode }, false).numeral;
    if (num !== tok) return `${mode} ${tok} reads ${num}`;
  });
  check('Every chord of every style, in all 24 keys: spelled on its letter, one sharp or flat at most, the right notes', toks.flatMap((t) => KEYS.filter((k) => k.mode === t.mode).map((key) => ({ ...t, key }))), ({ tok, key }) => {
    const c = parseNumeral(tok, key.mode), r = resolve(c, key.mode), { name } = chordLabel(c, key, false);
    if (/^[A-G](##|bb|#b|b#)/.test(name)) return `${tok} in ${key.tonic}${key.mode}: ${name}`;
    if (rootPc(name) !== mod12(key.tonic + r.semi)) return `${tok} in ${key.tonic}${key.mode}: ${name} is not on ${mod12(key.tonic + r.semi)}`;
    const n = chordNotes(c, key, null);
    const want = [...new Set(n.pcs)].sort().join(), got = [...new Set(n.upper.map(mod12))].sort().join();
    if (want !== got) return `${tok} in ${key.tonic}${key.mode}: notes ${got}, want ${want}`;
    if (n.bass < 33 || n.bass > 44 || mod12(n.bass) !== n.root) return `${tok}: bass ${n.bass}`;
    if (Math.min(...n.upper) < 48 || Math.max(...n.upper) > 84) return `${tok}: chord ${n.upper}`;
  });
  check('Do Re Mi names, and no double flats (♭VI in D♭ is A)', [[{ tonic: 9, mode: 'min' }, 'i7', 'La m7'], [{ tonic: 1, mode: 'maj' }, 'bVII', 'Dob'], [{ tonic: 6, mode: 'maj' }, 'vi', 'Re# m'], [{ tonic: 0, mode: 'maj' }, 'Vsus4', 'Sol sus4'], [{ tonic: 1, mode: 'maj' }, 'bVI', 'La']], ([key, tok, want]) => {
    const got = chordLabel(parseNumeral(tok, key.mode), key, true).name;
    if (got !== want) return `${tok}: ${got}, want ${want}`;
  });
  check('Changing the key keeps the progression (same numbers, every chord moved)', KEYS, (key) => {
    const prog = 'I V vi IV bVII ii7 V7 Imaj7'.split(' ').map((t) => parseNumeral(t, 'maj'));
    const a = { tonic: 0, mode: 'maj' }, b = { tonic: key.tonic, mode: 'maj' };
    for (const c of prog) {
      const x = chordLabel(c, a, false), y = chordLabel(c, b, false);
      if (x.numeral !== y.numeral || mod12(rootPc(y.name) - rootPc(x.name)) !== key.tonic) return `${x.name} -> ${y.name}`;
    }
  });
  check('Changing Major/Minor keeps the steps', [['I V vi IV', 'i v VI iv'], ['Imaj7 vi7 ii7 V7', 'i7 VImaj7 iiø7 v7'], ['I bVII IV I', 'i VII iv i'], ['i VI III VII', 'I vi iii vii°']], ([from, want]) => {
    const fromMode = /^[iv]/.test(from) ? 'min' : 'maj', toMode = fromMode === 'maj' ? 'min' : 'maj';
    const got = jam.changeMode(from.split(' ').map((t) => parseNumeral(t, fromMode)), toMode).map((c) => chordLabel(c, { tonic: 0, mode: toMode }, false).numeral).join(' ');
    if (got !== want) return `${from}: ${got}, want ${want}`;
  });
  check('Fixed chords keep their notes when Major/Minor changes', ['III7', 'bVII', 'II7', 'Isus4'], (tok) => {
    const c = parseNumeral(tok, 'maj'), d = jam.changeMode([c], 'min')[0];
    const a = chordLabel(c, { tonic: 0, mode: 'maj' }, false).name, b = chordLabel(d, { tonic: 0, mode: 'min' }, false).name;
    if (a !== b) return `${tok}: ${a} became ${b}`;
  });

  const seeds = Array.from({ length: 300 }, (_, i) => i + 1);
  check('New chords: the right length, locked chords stay, never the same with nothing locked', seeds, (seed) => {
    const rng = jam.rngFrom(seed), style = STYLE_IDS[seed % 8], key = jam.randomKey(style, rng);
    const length = STYLES[style].bars === 12 ? 12 : [1, 3, 4, 5, 8, 13, 64][seed % 7];
    const prog = jam.newProgression({ style, key, length, rng });
    if (prog.length !== length) return `${style}: ${prog.length} bars, want ${length}`;
    const again = jam.newProgression({ style, key, length, prog, rng });
    if (length >= 4 && again.every((c, i) => jam.sameChord(c, prog[i], key.mode))) return `${style} seed ${seed}: same progression twice`;
    const locked = again.map((c, i) => ({ ...c, lock: rng() < 0.3 || i === 0 }));
    const third = jam.newProgression({ style, key, length, prog: locked, rng });
    for (let i = 0; i < length; i++) if (locked[i].lock && JSON.stringify(third[i]) !== JSON.stringify(locked[i])) return `${style}: lock at ${i} lost`;
  });
  check('A locked chord that fits a progression brings that progression back', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (seed) => {
    const rng = jam.rngFrom(seed), key = { tonic: 0, mode: 'maj' };
    const prog = 'I V vi IV'.split(' ').map((t, i) => ({ ...parseNumeral(t, 'maj'), lock: i < 3 }));
    const got = jam.newProgression({ style: 'pop', key, length: 4, prog, rng }).map((c) => chordLabel(c, key, false).numeral).join(' ');
    if (!got.startsWith('I V vi')) return got;
  });
  check('Shorter or longer than the style: filled from its progressions, cut at the length', seeds.slice(0, 50), (seed) => {
    const rng = jam.rngFrom(seed), key = jam.randomKey('pop', rng), prog = jam.newProgression({ style: 'blues', key, length: 5, rng });
    if (prog.length !== 5 || prog.some((c) => !c || !Number.isInteger(c.step))) return `blues in 5 bars: ${JSON.stringify(prog)}`;
  });
  check('New key: never the same note; a picked key or mode stays', seeds, (seed) => {
    const rng = jam.rngFrom(seed), key = { tonic: seed % 12, mode: seed % 2 ? 'maj' : 'min' }, style = STYLE_IDS[seed % 8];
    if (jam.randomKey(style, rng, { key }).tonic === key.tonic) return 'same note';
    if (jam.randomKey(style, rng, { key, keyFixed: true }).tonic !== key.tonic) return 'picked key changed';
    if (jam.randomKey(style, rng, { key, modeFixed: true }).mode !== key.mode) return 'picked mode changed';
  });
  check('Major or minor about as often as each style says', STYLE_IDS, (style) => {
    const rng = jam.rngFrom(99);
    let maj = 0;
    for (let i = 0; i < 4000; i++) if (jam.randomKey(style, rng).mode === 'maj') maj++;
    if (Math.abs(maj / 4000 - STYLES[style].majorChance) > 0.03) return `${style}: ${maj / 40}% major`;
  });
  check('Add a bar: a chord that follows the one before in the style', STYLE_IDS, (style) => {
    const rng = jam.rngFrom(7), key = { tonic: 2, mode: 'maj' };
    for (let i = 0; i < 50; i++) {
      const c = jam.nextChord(style, key, parseNumeral(STYLES[style].major[0].split(' ')[0], 'maj'), rng);
      if (!c || c.lock || !Number.isInteger(c.step)) return JSON.stringify(c);
    }
  });
  check('Chords that fit: the key\'s 7, then more, no chord twice', KEYS.flatMap((key) => STYLE_IDS.map((style) => ({ key, style }))), ({ key, style }) => {
    const { fit, more } = jam.suggestions(style, key);
    const names = [...fit, ...more].map((c) => chordLabel(c, key, false).name);
    if (fit.length !== 7 || new Set(names).size !== names.length || more.length < 3) return `${style}: ${names.join(' ')}`;
    if (names.some((n) => /^[A-G](##|bb)/.test(n))) return `${style}: ${names.join(' ')}`;
  });

  const prog8 = 'I V vi IV ii iii V I'.split(' ').map((t) => parseNumeral(t, 'maj'));
  const moves = [];
  for (let from = 0; from < 8; from++) for (let to = 0; to < 8; to++) for (const locks of [[], [2], [0, 7], [3, 4], [1, 5, 6]]) moves.push({ from, to, locks });
  check('Dragging: locked chords keep their place, the moved chord lands, no chord lost', moves, ({ from, to, locks }) => {
    const prog = prog8.map((c, i) => ({ ...c, lock: locks.includes(i) }));
    const got = jam.moveChord(prog, from, to);
    if (got.length !== 8) return 'length';
    for (const i of locks) if (got[i] !== prog[i]) return `lock at ${i} moved`;
    if ([...got].sort((a, b) => prog.indexOf(a) - prog.indexOf(b)).some((c, i) => c !== prog[i])) return 'a chord was lost or doubled';
    if (locks.includes(from)) { if (got.some((c, i) => c !== prog[i])) return 'a locked chord was dragged'; return; }
    if (!locks.includes(to) && got[to] !== prog[from]) return `from ${from} to ${to} locks ${locks}: landed at ${got.indexOf(prog[from])}`;
    const free = prog.map((c, i) => i).filter((i) => !locks.includes(i));
    const order = (list) => free.map((i) => list[i]).filter((c) => c !== prog[from]);
    if (order(got).some((c, k) => c !== order(prog)[k])) return 'the other chords changed order';
  });

  const instruments = ['piano', 'epiano', 'esynth', 'pad', 'organ', 'harp', 'dreamy'];
  check('Save and Open give back exactly the same jam', seeds.slice(0, 100), (seed) => {
    const rng = jam.rngFrom(seed), style = STYLE_IDS[seed % 8], key = jam.randomKey(style, rng);
    const chords = jam.newProgression({ style, key, length: 1 + (seed % 20), rng }).map((c) => ({ ...c, lock: rng() < 0.4 }));
    chords.push({ step: 6, semi: 10, q: 'maj', lock: true });
    const sections = [{ type: jam.SECTION_TYPES[seed % 6], chords }];
    if (seed % 2) sections.push({ type: 'chorus', chords: chords.slice(0, 3).map((c) => ({ ...c, lock: false })) });
    const s = { style, key, newKey: { tonic: seed % 3 ? null : seed % 12, mode: seed % 5 ? null : 'min' }, bpm: 40 + (seed % 201), sections,
      sound: { instrument: instruments[seed % 7], kit: seed % 4 ? 'acoustic' : 'synth', chords: { on: true, vol: seed % 101 }, drums: { on: seed % 2 === 0, vol: 80 }, bass: { on: false, vol: 0 } } };
    const back = jam.fromFile(jam.toFile(s), instruments);
    if (JSON.stringify(back) !== JSON.stringify(s)) return `seed ${seed}: ${JSON.stringify(back)}`;
  });
  const good = JSON.parse(jam.toFile({ style: 'pop', key: { tonic: 0, mode: 'maj' }, newKey: { tonic: null, mode: null }, bpm: 100, sections: [{ type: 'verse', chords: [{ step: 0, q: 'T' }] }], sound: { instrument: 'piano', kit: 'acoustic', chords: { on: true, vol: 80 }, drums: { on: true, vol: 80 }, bass: { on: true, vol: 80 } } }));
  const sec = (chords) => ({ ...good, sections: [{ type: 'verse', chords }] });
  const bad = [
    'not a file', '', '{}', '[]', 'null',
    { ...good, tool: 'intervle' }, { ...good, version: 3 }, { ...good, style: 'polka' }, { ...good, bpm: 300 }, { ...good, bpm: '100' },
    { ...good, key: { tonic: 12, mode: 'maj' } }, { ...good, key: { tonic: 0, mode: 'dorian' } }, sec([]), { ...good, sections: [] },
    sec([{ step: 7, q: 'T' }]), sec([{ step: 0, q: 'xyz', semi: 0 }]), sec([{ step: 0, q: 'maj' }]),
    sec(Array(65).fill({ step: 0, q: 'T' })), sec([{ step: 0, q: 'toString', semi: 0 }]), { ...good, sections: [{ type: 'solo', chords: [{ step: 0, q: 'T' }] }] },
    { ...good, sections: Array(25).fill({ type: 'verse', chords: [{ step: 0, q: 'T' }] }) }, { ...good, version: 1 },
  ];
  check('Broken or other files are refused', bad, (b) => {
    if (jam.fromFile(typeof b === 'string' ? b : JSON.stringify(b), instruments) !== null) return `accepted ${JSON.stringify(b).slice(0, 80)}`;
  });
  check('A file with odd sounds still opens, with the usual sounds', [{ ...good, sound: { instrument: 'banjo', kit: 'tabla', drums: { on: 'yes', vol: 500 } } }, { ...good, sound: undefined }], (f) => {
    const s = jam.fromFile(JSON.stringify(f), instruments);
    if (!s || s.sound.instrument !== 'piano' || s.sound.kit !== 'acoustic' || s.sound.drums.vol !== 80 || s.sound.drums.on !== true || s.sound.bass.vol !== 80) return JSON.stringify(s && s.sound);
  });
  check('A first-version file (one list of chords) opens as one Verse', [1], () => {
    const v1 = { format: 'open-music-tools', tool: 'jam-machine', version: 1, style: 'rock', key: { tonic: 4, mode: 'min' }, keyFixed: true, bpm: 90, chords: [{ step: 0, q: 'T', lock: true }, { step: 6, semi: 10, q: 'maj' }], sound: { instrument: 'organ' } };
    const s = jam.fromFile(JSON.stringify(v1), instruments);
    if (!s || s.newKey.tonic !== 4 || s.newKey.mode !== null || s.sections.length !== 1 || s.sections[0].type !== 'verse' || s.sections[0].chords.length !== 2 || !s.sections[0].chords[0].lock) return JSON.stringify(s);
  });
  check('Sections: numbers when a part comes twice, duplicate, move', [1], () => {
    const v = { type: 'verse', chords: [{ step: 0, q: 'T' }] }, c = { type: 'chorus', chords: [{ step: 3, q: 'T' }] };
    if (jam.sectionNumbers([v, c, v, { type: 'bridge', chords: [] }]).join() !== '1,,2,') return 'numbers ' + jam.sectionNumbers([v, c, v]);
    const d = jam.duplicateSection([v, c], 0);
    if (d.length !== 3 || d[1].type !== 'verse' || d[1].chords === v.chords || d[1].chords[0] === v.chords[0]) return 'duplicate is not a copy';
    d[1].chords[0].step = 5;
    if (v.chords[0].step !== 0) return 'changing the copy changed the original';
    const m = jam.moveSection([v, c], 0, 1);
    if (m[0] !== c || m[1] !== v || jam.moveSection([v, c], 0, -1)[0] !== v) return 'move';
    if (jam.nextSectionType('verse') !== 'chorus' || jam.nextSectionType('intro') !== 'verse') return 'next type';
  });

  const pattern = [];
  for (const id of STYLE_IDS) {
    const st = STYLES[id];
    for (const [part, hits] of Object.entries(st.drums)) hits.forEach((h) => pattern.push({ id, part, step: h[0], len: 1, vel: h[1], swing: st.swing }));
    const comp = st.comp.arp ? st.comp.steps.map(([s, v]) => [s, 2, v]) : st.comp;
    comp.forEach((h) => pattern.push({ id, part: 'comp', step: h[0], len: h[1], vel: h[2], swing: st.swing }));
    st.bass.forEach((h) => pattern.push({ id, part: 'bass', step: h[0], len: h[1], vel: h[3], note: h[2], swing: st.swing }));
  }
  check('Band patterns: inside the bar, swung styles on 8th notes only, notes the bass knows', pattern, (h) => {
    if (!Number.isInteger(h.step) || h.step < 0 || h.step > 15 || !(h.len > 0) || h.step + h.len > 16 || !(h.vel > 0 && h.vel <= 1)) return `${h.id} ${h.part} ${h.step} ${h.len} ${h.vel}`;
    if (h.swing && h.step % 2) return `${h.id} ${h.part}: step ${h.step} falls between swung 8ths`;
    if (h.note && !['r', '5', '8', '3', '6', 'b7', 'a'].includes(h.note)) return `${h.id}: bass note ${h.note}`;
  });
  check('Speeds as in the spec', [['pop', 100], ['ballad', 70], ['rock', 120], ['blues', 80], ['jazz', 120], ['bossa', 130], ['reggae', 75], ['lofi', 80]], ([id, bpm]) => {
    if (STYLES[id].bpm !== bpm) return `${id}: ${STYLES[id].bpm}`;
  });
  return out;
}
