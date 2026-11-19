/* jam-machine/styles.js: the eight styles of the Jam Machine (spec: specs/jam-machine.md).
 * Data only: no sound, no DOM. Read by jam.js (the rules) and band.js (the sound).
 *
 * STYLES[id] = {
 *   bpm         starting speed
 *   swing       0 = straight; 1 = full triplet swing (the off-beat 8th lands
 *               two thirds into the beat). Patterns of swung styles use only
 *               8th-note steps (even steps), so nothing falls between.
 *   majorChance how often New chords picks a major key (0..1)
 *   sevenths    true: the style's own chords are 7th chords (Cmaj7, Dm7, G7)
 *   bars        12 for the Blues (every progression is 12 bars), else 4
 *   major, minor  progressions in that mode, as chord numbers, one per bar:
 *               I ii iii IV V vi vii° in major (i ii° III iv v VI VII in
 *               minor), counted on the mode's own scale. Upper case = major
 *               chord, lower case = minor; a leading b or # moves the root a
 *               half step (bVII in C major = B♭). After the number: 7 (a 7th:
 *               G7 on a major chord, Dm7 on a minor one), maj7, ø7 (m7♭5),
 *               ° (dim), sus2, sus4, 6, 9, add9.
 *   drums       { kick, snare, hat, rim }: lists of [step, velocity 0..1],
 *               step 0..15 = 16th notes of a 4/4 bar
 *   comp        how the chords play: [step, length in steps, velocity];
 *               { arp: true } plays the chord's notes one by one instead
 *   bass        [step, length in steps, note, velocity]; note: 'r' root,
 *               '5' fifth, '8' root an octave up, '3' the chord's third,
 *               '6' the major sixth above the root, 'b7' its 7th,
 *               'a' a half step from the next bar's root (walking bass)
 * }
 */
export const STYLE_IDS = ['pop', 'ballad', 'rock', 'blues', 'jazz', 'bossa', 'reggae', 'lofi'];

const eighths = (v, off = v * 0.6) => [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, s % 4 ? off : v]);

export const STYLES = {
  pop: {
    bpm: 100, swing: 0, majorChance: 0.7, sevenths: false, bars: 4,
    major: ['I V vi IV', 'vi IV I V', 'I vi IV V', 'I IV vi V', 'IV I V vi', 'I iii IV V', 'I V IV V', 'IV V I vi', 'I IV I V', 'vi V IV V'],
    minor: ['i VI III VII', 'i VII VI VII', 'i iv VI VII', 'VI VII i i', 'i VI VII v', 'i iv VII III', 'i III VII VI'],
    drums: { kick: [[0, 1], [6, 0.7], [8, 0.95]], snare: [[4, 0.9], [12, 0.9]], hat: eighths(0.5) },
    comp: [[0, 6, 0.8], [6, 4, 0.6], [10, 6, 0.65]],
    bass: [[0, 6, 'r', 0.9], [6, 2, 'r', 0.6], [8, 6, 'r', 0.85], [14, 2, '5', 0.6]],
  },
  ballad: {
    bpm: 70, swing: 0, majorChance: 0.6, sevenths: false, bars: 4,
    major: ['I V vi IV', 'I iii IV V', 'I vi ii V', 'IV V iii vi', 'I IV ii V', 'vi IV I V', 'I V IV I', 'I ii IV V', 'IV I ii V'],
    minor: ['i VI III VII', 'i iv VI V', 'i VII VI V', 'i III iv VI', 'VI III VII i', 'i iv VII III'],
    drums: { kick: [[0, 0.8], [10, 0.5]], rim: [[4, 0.6], [12, 0.6]], hat: [[0, 0.35], [4, 0.3], [8, 0.35], [12, 0.3]] },
    comp: { arp: true, steps: [[0, 0.75], [2, 0.5], [4, 0.55], [6, 0.5], [8, 0.65], [10, 0.5], [12, 0.55], [14, 0.5]] },
    bass: [[0, 8, 'r', 0.8], [8, 8, '5', 0.7]],
  },
  rock: {
    bpm: 120, swing: 0, majorChance: 0.6, sevenths: false, bars: 4,
    major: ['I bVII IV I', 'I IV V IV', 'I V IV IV', 'I bIII IV I', 'I IV I V', 'vi IV I V', 'I bVI bVII I', 'I V vi IV', 'IV I V V'],
    minor: ['i VII VI VII', 'i VI VII i', 'i III VII iv', 'i iv VII i', 'i VI III VII', 'i VII iv VI'],
    drums: { kick: [[0, 1], [8, 0.95], [10, 0.8]], snare: [[4, 1], [12, 1]], hat: eighths(0.6, 0.45) },
    comp: [[0, 2, 0.8], [2, 2, 0.6], [4, 2, 0.7], [6, 2, 0.6], [8, 2, 0.8], [10, 2, 0.6], [12, 2, 0.7], [14, 2, 0.6]],
    bass: [[0, 2, 'r', 0.9], [2, 2, 'r', 0.7], [4, 2, 'r', 0.8], [6, 2, 'r', 0.7], [8, 2, 'r', 0.9], [10, 2, 'r', 0.7], [12, 2, 'r', 0.8], [14, 2, 'r', 0.7]],
  },
  blues: {
    bpm: 80, swing: 1, majorChance: 0.75, sevenths: false, bars: 12,
    major: ['I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'I7 IV7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', 'I7 IV7 I7 I7 IV7 IV7 I7 VI7 ii7 V7 I7 V7', 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 V7 I7 I7'],
    minor: ['i7 i7 i7 i7 iv7 iv7 i7 i7 VI7 V7 i7 V7', 'i7 iv7 i7 i7 iv7 iv7 i7 i7 VI7 V7 i7 V7', 'i7 i7 i7 i7 iv7 iv7 i7 i7 V7 V7 i7 i7'],
    drums: { kick: [[0, 0.9], [8, 0.8]], snare: [[4, 0.85], [12, 0.85]], hat: eighths(0.5, 0.35) },
    comp: [[0, 3, 0.7], [6, 2, 0.55], [8, 3, 0.65], [14, 2, 0.55]],
    bass: [[0, 2, 'r', 0.85], [2, 2, 'r', 0.55], [4, 2, '3', 0.75], [6, 2, '3', 0.55], [8, 2, '5', 0.8], [10, 2, '5', 0.55], [12, 2, '6', 0.75], [14, 2, '6', 0.55]],
  },
  jazz: {
    bpm: 120, swing: 1, majorChance: 0.7, sevenths: true, bars: 4,
    major: ['ii7 V7 Imaj7 Imaj7', 'Imaj7 vi7 ii7 V7', 'iii7 vi7 ii7 V7', 'Imaj7 IVmaj7 iii7 vi7', 'ii7 V7 iii7 vi7', 'Imaj7 I7 IVmaj7 iv7', 'Imaj7 VI7 ii7 V7', 'IVmaj7 iv7 iii7 VI7'],
    minor: ['iiø7 V7 i7 i7', 'i7 iv7 iiø7 V7', 'i7 VImaj7 iiø7 V7', 'i7 i7 iv7 V7', 'iv7 VII7 IIImaj7 VImaj7', 'i7 iv7 VII7 IIImaj7'],
    drums: { hat: [[0, 0.55], [4, 0.6], [6, 0.4], [8, 0.55], [12, 0.6], [14, 0.4]], kick: [[0, 0.35], [8, 0.3]], rim: [[4, 0.3], [12, 0.3]] },
    comp: [[0, 3, 0.6], [6, 2, 0.55], [14, 2, 0.45]],
    bass: [[0, 4, 'r', 0.85], [4, 4, '3', 0.7], [8, 4, '5', 0.75], [12, 4, 'a', 0.7]],
  },
  bossa: {
    bpm: 130, swing: 0, majorChance: 0.5, sevenths: true, bars: 4,
    major: ['Imaj7 II7 ii7 V7', 'Imaj7 vi7 ii7 V7', 'ii7 V7 Imaj7 VI7', 'Imaj7 IVmaj7 iii7 VI7', 'Imaj7 Imaj7 ii7 V7', 'IVmaj7 iv7 Imaj7 VI7'],
    minor: ['i7 iv7 i7 V7', 'i7 iv7 VII7 IIImaj7', 'iiø7 V7 i7 i7', 'i7 VImaj7 iiø7 V7', 'i7 i7 iv7 VII7', 'VImaj7 iiø7 V7 i7'],
    drums: { kick: [[0, 0.75], [6, 0.5], [8, 0.75], [14, 0.5]], rim: [[0, 0.5], [6, 0.5], [12, 0.5]], hat: eighths(0.35, 0.25) },
    comp: [[0, 3, 0.65], [6, 3, 0.55], [10, 2, 0.5], [12, 3, 0.55]],
    bass: [[0, 6, 'r', 0.85], [6, 2, '5', 0.6], [8, 6, 'r', 0.8], [14, 2, '5', 0.6]],
  },
  reggae: {
    bpm: 75, swing: 0, majorChance: 0.6, sevenths: false, bars: 4,
    major: ['I IV I V', 'I V vi IV', 'I ii I ii', 'I IV V IV', 'vi IV I V', 'I vi IV V', 'IV V I I'],
    minor: ['i iv i iv', 'i VII i VII', 'i VI VII i', 'i iv VII III', 'i v i v', 'i VII VI VII'],
    drums: { kick: [[8, 0.95]], rim: [[8, 0.8]], hat: eighths(0.4, 0.3) },
    comp: [[4, 1, 0.7], [12, 1, 0.7]],
    bass: [[0, 3, 'r', 0.9], [6, 2, '5', 0.7], [8, 2, '8', 0.65], [10, 4, 'r', 0.8]],
  },
  lofi: {
    bpm: 80, swing: 0.6, majorChance: 0.4, sevenths: true, bars: 4,
    major: ['Imaj7 vi7 ii7 V7', 'IVmaj7 iii7 ii7 Imaj7', 'ii7 V7 Imaj7 vi7', 'IVmaj7 V7 iii7 vi7', 'Imaj7 iii7 IVmaj7 iv7', 'IVmaj7 Imaj7 vi7 V7'],
    minor: ['i7 iv7 VImaj7 V7', 'i7 VImaj7 IIImaj7 VII7', 'iv7 VII7 IIImaj7 VImaj7', 'i7 iv7 VII7 IIImaj7', 'VImaj7 v7 i7 i7', 'i7 IIImaj7 iv7 v7'],
    drums: { kick: [[0, 0.75], [6, 0.5], [10, 0.6]], snare: [[4, 0.55], [12, 0.55]], hat: eighths(0.3, 0.2) },
    comp: [[0, 14, 0.5]],
    bass: [[0, 6, 'r', 0.75], [10, 4, 'r', 0.65]],
  },
};
