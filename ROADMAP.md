# Roadmap

**Status (2026-10-30):** Phase 0 and the Phase 1 engine split are done: `shared/` holds theory, sound, transport and ui, and Choordination runs on them. After Drephie's hand test, Choordination lost the YOLO sign and the loop station, and gained smooth chords (Chord Style setting), a "Record my voice" switch and a headphones tip. Phase 2 has started: the **Metronome** is done (`metronome/`, spec in `specs/metronome.md`); Drephie tested it on a phone: it works with the silent switch on, fits the screen, and the volume curve sounds right. The **Piano** is done (`piano/`, spec in `specs/piano.md`), built from Drephie's Diapason prototype; Drephie tested it on an iPhone. The **Ear Trainer** is done (`ear-trainer/`, spec in `specs/ear-trainer.md`): intervals, chords and scale degrees, with lessons that unlock one by one, a streak game with 3 lives and free practice; Drephie tested it on a phone (2026-10-24): all good (sounds, questions, game and wording). The **hub home page** is done (`index.html` and `hub/`, spec `specs/hub.md`): Drephie's logo (cleaned up from a sketch), a square card for every tool with the planned ones greyed out, one theme and language for the whole hub, and a house button in every tool; Drephie tested it on a phone (2026-10-24): all good. **Phase 3 has started** (Drephie chose it over the launch preparation, 2026-10-24): the **pitch engine** is done (`shared/pitch.js`, tested by `tests/pitch.html`), and the **Vocal Tuner** is built (`vocal-tuner/`, spec `specs/vocal-tuner.md`). Drephie's first phone test (2026-10-30, over https on the home Wi-Fi with `.claude/serve-https.py`) asked for changes, now made: in tune within ±10 cents with a Hard mode at ±5, no empty screen before you sing (a resting ball with "Sing a note"), and an in-tune ring that also shows in Monochrome. Drephie's second phone test (2026-10-30): all good. At the spec questions Drephie split the Tuner into two tools: the Vocal Tuner and the Instrument Tuner. The **Instrument Tuner** is built (`instrument-tuner/`, spec `specs/instrument-tuner.md`, 2026-10-30): guitar (six tunings), bass 4 and 5 strings, ukulele (three tunings), violin, viola, cello and any note, with vibrating strings, automatic string finding and tap to stay. Drephie's phone test (2026-10-30, home Wi-Fi https; the phone's visit and microphone start confirmed in the server log): all good. The **Pitch Detector** is built (`pitch-detector/`, spec `specs/pitch-detector.md`, 2026-10-30): the line of your voice over time, sideways, with the view fitted to the notes on screen (Drephie), with piano keys down the side to tap and hear a note, pause and look back over 2 minutes, a key to highlight, and a microphone sensitivity setting for noisy places. Drephie's phone test (2026-10-30, on a train): passed, after two changes (octave slips on held notes, the sensitivity setting); some background sound still came through on the train. Next: Pitch Training; the first public launch and the Choordination changes are still open.

## Tools in scope

| Tool | What it is | Builds on |
|---|---|---|
| **Choordination** | Hand-tracking chord instrument (exists; changes pending) | theory, sound, transport |
| **Digital Piano** | Touch-first piano with good sound that names the chord you play (done 2026-10-23 as **Piano**, `piano/`; spec `specs/piano.md`). MIDI keyboard input postponed by Drephie | theory, sound |
| **Metronome** | Metronome and tap tempo (done 2026-10-23; spec `specs/metronome.md`) | transport |
| **Vocal Tuner** | Sing a note: its name, how many cents low or high, in tune within ±10 cents (±5 in Hard mode), and a 3D ball of your voice's wave that is round in tune and chaotic when off (done 2026-10-30, `vocal-tuner/`; spec `specs/vocal-tuner.md`; Drephie's phone test: all good) | pitch, theory |
| **Instrument Tuner** | Pick an instrument and tuning, play a string: which string, how far off, "tighten" or "loosen", in tune within 5 cents (2 in Hard mode). Guitar (standard, drop D, half step down, DADGAD, open G, open D), bass 4 and 5 strings, ukulele (standard, low G, baritone), violin, viola, cello, and any note. The strings are drawn down the screen and the one you play vibrates with your sound; strings are found automatically, or tap one to stay on it (done 2026-10-30, `instrument-tuner/`; spec `specs/instrument-tuner.md`; Drephie's phone test: all good; split from the Tuner by Drephie, 2026-10-24) | pitch, theory |
| **Pitch Detector** | One voice: the note and its cents at the top, and the line of the pitch over time (sideways, the view fitted to the lowest and highest notes on screen, one colour), with piano keys to tap and hear a note, pause and look back, a key to highlight, and microphone sensitivity; for lessons (done 2026-10-30, `pitch-detector/`; spec `specs/pitch-detector.md`; Drephie's phone test: passed) | pitch, theory, sound |
| **Pitch Training** | Singing exercises (scales and more) scored live; teachers make exercises and share them by link | pitch, theory, transport |
| **Ear Trainer** | Intervals, chord qualities, scale degrees (done 2026-10-24 as `ear-trainer/`; spec `specs/ear-trainer.md`): lessons, a streak game, free practice | theory, sound |
| **BPM Finder** | Tempo of an audio file you own, plus tap tempo; always shows half- and double-time alternatives | analysis |
| **Chord Finder** | Key, chords and key changes of an audio file you own, using existing open-source analysis; built to be easy to correct | analysis, theory |
| **Practice Player** | Slow a song down without changing pitch and loop sections; transposing comes later | analysis (beat grid) |
| **Jam Machine** | Chord progressions by style that you can re-roll and edit, with BPM, key and open-source instruments | theory, sound, transport |

## Parked or dropped (don't propose these again without asking)

- **Vochoorder** (vocoder and harmonizer): parked. Too heavy and not a priority. The prototype stays in the original folder.
- **Harmony Creator**: parked as too complex for now.
- **Lyrics finder**: dropped.
- **Polyphonic pitch detection**: dropped.
- **Vocal range finder**: dropped. The lowest or highest note someone can sing doesn't show what they can sustain in phrases or on every vowel, so it misleads.
- **Songwriting notebook**: dropped. Storing people's work creates data-loss liability.
- **Sight-singing generator**: dropped. It needs prior knowledge, and the hub is for everyone.
- **Interactive circle of fifths**: dropped as not beginner-friendly.
- **Building a chord recognizer from scratch**: no. Use existing open-source analysis.

## Shared engines (`shared/`)

Each module starts with a header comment describing its API: read that, not the implementation.

- `theory.js` (done): note spelling, keys, chords, chord naming, and `nameNotes` (names any set of notes: note, interval, chord with slash and other names; Diapason's ~40 shapes; the fewest sharps and flats). Pure functions; tested by `tests/theory.html` (`tests/naming-cases.js`).
- `sound.js` (done): the instrument rack (Salamander piano, e-piano, synth, pad, organ, harp), effects chain, master volume, 20 ms look-ahead.
- `transport.js` (done): metronome clicks (strong/normal/soft, volume to 200%), the metronome loop (strong/normal/silent beats, in-between clicks, beats per bar changeable while playing), count-in, tap tempo, BPM clamp, Italian tempo names. Used by the Metronome; Choordination no longer uses it. Tested by `tests/transport.html`.
- `ui/` (done): `themes.css` (the five themes' variables, plus `--bg-page` and the yellow-to-red warning pair), `i18n.js` (`t`, interpolation, `data-i18n`), `strings.js` (hub-wide strings), `select.js`/`select.css` (custom dropdowns), `modal.js` (dialogs), `page.css`/`page.js` (the page of a tool with no camera: header, About and Settings windows, footer with the support link, the Patreon window after 30 s idle (5 s wait, every 40 min at most), buttons, sliders, theme frames, saved settings, computer-only text; built with the Metronome). Dropdown lists open upward when there is no room below; `setSelectRoom` measures that room on a page drawn turned (the Piano). `themes.css` has piano-key colors (`--key-*`) and, for the Ear Trainer, right/wrong answer colors (`--color-good`, `--color-bad`, with text colors) and `--color-star` in every theme, and for the Vocal Tuner `--color-tune-line` and `--color-tune` (its ball's lines and the in-tune accent: not green, which vanishes in Retro CRT). The interval names (`iv0`..`iv12`) are hub strings, shared by the Piano and the Ear Trainer. `page.js` holds the **hub-wide theme and language** (`loadLook`, `saveLook`, `watchLook`, saved as `open-music-tools.look.v1`; a tool's own old choice is passed on the first time), and `page.css` the house button (`.home-btn`) left of a tool's title.
- `offline.js` (done): registers the hub's one service worker, `/sw.js` at the root. Offline and install are designed at the end for the whole suite (Phase 6); until then this worker stays as it is. It fetches our own files from the network first, so it never serves stale code during development.
- Choordination keeps its own header, About window and support links: they are markup tied to its stage. New tools use `ui/page.css` instead.
- `pitch.js` (done 2026-10-24; `setRange` and plucked-string tests added for the Instrument Tuner, 2026-10-30): microphone to note. `startPitch` asks for the microphone (echo cancellation, noise suppression and automatic gain off) and runs the detector in an AudioWorklet (`pitch-worklet.js`; a ScriptProcessor fallback for old browsers): McLeod's pitch method through an FFT, an adaptive noise gate, a frame every 20 ms with pitch, clarity and loudness; `createPitchSmoother` (Calm / Quick), `nearestNote`, and the latest sound wave for drawing. Nothing is recorded or uploaded. Tested with made-up tones whose pitch is known (`tests/pitch.html`, also from the terminal): held notes from E1 to B6 within 0.1 cent, a note shows 20-45 ms after it starts, noise 10 dB below a voice changes nothing, silence and noise never show a note, through the real AudioWorklet too. `theory.js` gained `commonNoteName` (one name per note with no key: C# Eb F# Ab Bb). Plucked strings (tests/pitch.html) are read within half a cent from 0.3 s, from a 5-string bass's low B (31 Hz, `setRange(24, 230)`) to a violin's E; real strings read a little sharp just after the pluck (their harmonics are slightly sharp) and settle as they ring.
- `wave.js` (2026-10-30): `waveShape`, whole periods of the latest sound for drawing (the Vocal Tuner's ball, the Instrument Tuner's strings). `ui/accidentals.js` (2026-10-30): drawn ♯ and ♭ (`accidentalHtml`, `prettyName`) for big note names; both moved from the Vocal Tuner.
- `analysis.js`: new; wraps Essentia.js for key, BPM, beats and chords

## Phases

0. **Setup (done):** hub repo, Choordination copied in, install paths fixed, Salamander credit, CLAUDE.md, this file.
1. **Engines (done 2026-10-23):** split Choordination into `shared/` (theory, sound, transport, ui) with one service worker. Choordination behaves exactly as before. Theory tests are in `tests/theory.html`. **Next: the Choordination changes.**
2. **Tools on existing engines:** Metronome (done 2026-10-23; Drephie approved it, including the Spanish and Italian wording), Piano (done 2026-10-23), Ear Trainer (done 2026-10-24; Drephie's phone test: all good), hub landing page (done 2026-10-24: `index.html` and `hub/`; Drephie's phone test: all good), then the first public launch.
3. **Pitch:** pitch engine (done 2026-10-24), Vocal Tuner (done: built 2026-10-24, changed after Drephie's first phone test; second phone test 2026-10-30: all good), Instrument Tuner (done 2026-10-30; Drephie's phone test: all good), Pitch Detector (done 2026-10-30; Drephie's phone test: passed), then Pitch Training.
4. **Analysis:** an Essentia.js trial on the test songs, then BPM Finder, Practice Player and Chord Finder.
5. **Jam Machine.**
6. **Offline and install for the whole suite** (last): what works offline, one install or one per tool, update flow. Drephie tests install and offline in real Chrome then.

After Phase 1, phases 2 to 5 don't depend on each other.

## Choordination change candidates (Drephie picks)

Removed after Drephie's hand test (2026-10-23): the YOLO sign (didn't work) and the loop station (too complicated, not useful). Don't bring them back without asking.

- Done: smooth chords (Chord Style, on by default): the root in the bass and the chord above in the closest inversion to the previous one; the note list shows the notes above the bass. `voiceChord` in `shared/theory.js`.
- Done: voice in keyboard and touch recordings ("Record my voice" switch, on by default).
- Done: "7th (Auto)" follows the key (V in major and VII in minor are dominant 7ths; before, every major chord got a maj7).
- m7♭5 as its own modifier; 11ths and 13ths; slash chords and bass notes
- Web MIDI output to control a DAW
- Drephie's own list

## Piano: later ideas (not in the first version)

MIDI keyboard input (Chrome, Edge and Firefox; not possible on iPhone, iPad or Safari), record and download, a key setting with scale dots, softer and louder by touch. Drephie picks.

## Ear Trainer: later ideas (not in the first version)

Minor keys for scale degrees, chord inversions, intervals wider than an octave, a small keyboard showing the notes, song reminders for intervals, the next question playing by itself, other sounds than the piano, singing the answer (needs the Phase 3 pitch engine), teacher-made lessons shared by link. Drephie picks.

## Vocal Tuner: later ideas (not in the first version)

A note to tune to (Drephie: no sound in the first version), changing A from 440, the exact pitch in Hz, transposing instruments. Drephie picks.

## Instrument Tuner: later ideas (not in the first version)

Playing each string's note to tune by ear (Drephie: later), changing A from 440, your own tunings, more instruments (7-string guitar, banjo, 12-string). Drephie picks.

## Pitch Detector: later ideas (not in the first version)

Telling deliberate singing from background sound by more than loudness (on a train some still came through), saving the graph as a picture, in-tune colours on the line, a held note to sing against (a drone, with headphones), zooming by hand, changing A from 440. Target notes and exercises belong to Pitch Training. Drephie picks.

## Metronome: later ideas (not in the first version)

Silent bars practice (the click drops out for a bar), a speed trainer that slowly speeds up, a practice timer. Drephie picks.

## Open decisions

- Is Choordination already live at an address that must keep working?
- **License.** Essentia.js is AGPL-3.0, so tools using it must be AGPL too. The simplest choice is AGPL-3.0 for the whole hub. Needed before the repo goes public.
- Hub name (`open-music-tools` is a placeholder) and domain. The home page shows the placeholder "Open Music Tools" (`title` and `aboutTitle` in `hub/strings.js`, and `<title>` in `index.html`).
- Funding: Patreon, versus "minimal ads", versus Choordination's promise of "No ads, no trackers, ever".
- `REPO_URL` in `choordination/index.html` still points at a placeholder.
- A hub-wide privacy line for future tools (e.g. "Everything runs on your device"). Choordination's privacy text mentions its camera, so it stayed in Choordination; the wording for the hub is Drephie's. The Metronome's About window uses one Drephie approved with its spec: "Everything runs in your browser: no sound is recorded, nothing is uploaded, and there are no ads or trackers." The home page uses "Everything runs on your device: nothing is uploaded, no ads, no trackers." (approved with `specs/hub.md`).
- The Metronome's About text names the hub "Open Music Tools" (the placeholder name) and has no repository link yet: update both once the name and repo are decided.
- Done (2026-10-24): theme and language are one choice for the whole hub, Choordination included (it used to start in Liquid Glass and English every time).
- Middle C is Do4 in the Piano (as in Drephie's Diapason); some Italian and Spanish books call it Do3. Ask Drephie if it ever matters.
- Drephie's prototype MaySuite (`~/Desktop/index.html`, outside the repo) has Diapason (the Piano's model) and Intonazione, a pitch monitor (McLeod/NSDF pitch with an adaptive gate, a waveform display, tap the note to hear a reference): Drephie offered it as inspiration for the Phase 3 Pitch Detector. It names Drephie's studio and logos, so don't copy it into the public repo without asking.
- Test songs for Phase 4: 5 to 10 songs Drephie owns with known chords and BPM, including one with a difficult key change.

## Found in the hub phone test (2026-10-24), not yet looked at

- **Piano:** with the iPhone's silent switch on, the first sound comes about 10 seconds late, then it plays normally. The Piano sets up sound like the Metronome, which works with the switch on, so this needs its own look on Drephie's phone.
- **Choordination on the phone link:** asking for the camera fails and Retry doesn't help. Expected on the plain `http://192.168.1.42:8000` test link (phones only allow the camera on `https` or on the computer itself); it should work once the hub is live on `https`. Choordination could say so instead of offering a Retry that can't work.

## Custom skills to create along the way

- `tool-spec` (done, `.claude/skills/tool-spec/`): the one-page spec Drephie approves before any code; specs live in `specs/`.
- `new-tool` (done, `.claude/skills/new-tool/`): building a tool after its spec is approved, with the Metronome as the example (files, shared page parts, strings, phone fit, sound tests, `APP_SHELL`, browser checks, Drephie's phone test). Since the home page: the house button, the shared theme and language, and the tool's card on the home page.
- `release-check`: before the first launch
