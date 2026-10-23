# Roadmap

**Status (2026-10-24):** Phase 0 and the Phase 1 engine split are done: `shared/` holds theory, sound, transport and ui, and Choordination runs on them. After Drephie's hand test, Choordination lost the YOLO sign and the loop station, and gained smooth chords (Chord Style setting), a "Record my voice" switch and a headphones tip. Phase 2 has started: the **Metronome** is done (`metronome/`, spec in `specs/metronome.md`); Drephie tested it on a phone: it works with the silent switch on, fits the screen, and the volume curve sounds right. The **Piano** is done (`piano/`, spec in `specs/piano.md`), built from Drephie's Diapason prototype; Drephie tested it on an iPhone. The **Ear Trainer** is done (`ear-trainer/`, spec in `specs/ear-trainer.md`): intervals, chords and scale degrees, with lessons that unlock one by one, a streak game with 3 lives and free practice; Drephie tested it on a phone (2026-10-24): all good (sounds, questions, game and wording). The **hub home page** is done (`index.html` and `hub/`, spec `specs/hub.md`): Drephie's logo (cleaned up from a sketch), a square card for every tool with the planned ones greyed out, one theme and language for the whole hub, and a house button in every tool; Drephie tested it on a phone (2026-10-24): all good. Next: the first public launch (see "Open decisions"), Drephie listens to the Choordination changes, then the next Phase 2 tool (or the remaining Choordination changes below).

## Tools in scope

| Tool | What it is | Builds on |
|---|---|---|
| **Choordination** | Hand-tracking chord instrument (exists; changes pending) | theory, sound, transport |
| **Digital Piano** | Touch-first piano with good sound that names the chord you play (done 2026-10-23 as **Piano**, `piano/`; spec `specs/piano.md`). MIDI keyboard input postponed by Drephie | theory, sound |
| **Metronome** | Metronome and tap tempo (done 2026-10-23; spec `specs/metronome.md`) | transport |
| **Tuner** | Chromatic tuner | pitch |
| **Pitch Detector** | One voice: the live note plus a pitch-over-time graph for lessons | pitch |
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
- `ui/` (done): `themes.css` (the five themes' variables, plus `--bg-page` and the yellow-to-red warning pair), `i18n.js` (`t`, interpolation, `data-i18n`), `strings.js` (hub-wide strings), `select.js`/`select.css` (custom dropdowns), `modal.js` (dialogs), `page.css`/`page.js` (the page of a tool with no camera: header, About and Settings windows, footer with the support link, the Patreon window after 30 s idle (5 s wait, every 40 min at most), buttons, sliders, theme frames, saved settings, computer-only text; built with the Metronome). Dropdown lists open upward when there is no room below; `setSelectRoom` measures that room on a page drawn turned (the Piano). `themes.css` has piano-key colors (`--key-*`) and, for the Ear Trainer, right/wrong answer colors (`--color-good`, `--color-bad`, with text colors) and `--color-star` in every theme. The interval names (`iv0`..`iv12`) are hub strings, shared by the Piano and the Ear Trainer. `page.js` holds the **hub-wide theme and language** (`loadLook`, `saveLook`, `watchLook`, saved as `open-music-tools.look.v1`; a tool's own old choice is passed on the first time), and `page.css` the house button (`.home-btn`) left of a tool's title.
- `offline.js` (done): registers the hub's one service worker, `/sw.js` at the root. Offline and install are designed at the end for the whole suite (Phase 6); until then this worker stays as it is. It fetches our own files from the network first, so it never serves stale code during development.
- Choordination keeps its own header, About window and support links: they are markup tied to its stage. New tools use `ui/page.css` instead.
- `pitch.js`: new; microphone to note, running in an AudioWorklet
- `analysis.js`: new; wraps Essentia.js for key, BPM, beats and chords

## Phases

0. **Setup (done):** hub repo, Choordination copied in, install paths fixed, Salamander credit, CLAUDE.md, this file.
1. **Engines (done 2026-10-23):** split Choordination into `shared/` (theory, sound, transport, ui) with one service worker. Choordination behaves exactly as before. Theory tests are in `tests/theory.html`. **Next: the Choordination changes.**
2. **Tools on existing engines:** Metronome (done 2026-10-23; Drephie approved it, including the Spanish and Italian wording), Piano (done 2026-10-23), Ear Trainer (done 2026-10-24; Drephie's phone test: all good), hub landing page (done 2026-10-24: `index.html` and `hub/`; Drephie's phone test: all good), then the first public launch.
3. **Pitch:** pitch engine, then Tuner, Pitch Detector and Pitch Training.
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
