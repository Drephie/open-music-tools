# Roadmap

**Status (2026-10-23):** Phase 0 and the Phase 1 engine split are done: `shared/` holds theory, sound, transport and ui, and Choordination runs on them. After Drephie's hand test, Choordination lost the YOLO sign and the loop station, and gained smooth chords (Chord Style setting), a "Record my voice" switch and a headphones tip. Phase 2 has started: the **Metronome** is built (`metronome/`, spec in `specs/metronome.md`) and waits for Drephie's listening check. Next: Drephie listens to the Metronome and the Choordination changes, then the next Phase 2 tool (or the remaining Choordination changes below).

## Tools in scope

| Tool | What it is | Builds on |
|---|---|---|
| **Choordination** | Hand-tracking chord instrument (exists; changes pending) | theory, sound, transport |
| **Digital Piano** | Touch-first piano with good sound that names the chord you play; MIDI keyboard input | theory, sound |
| **Metronome** | Metronome and tap tempo (built 2026-10-23; spec `specs/metronome.md`) | transport |
| **Tuner** | Chromatic tuner | pitch |
| **Pitch Detector** | One voice: the live note plus a pitch-over-time graph for lessons | pitch |
| **Pitch Training** | Singing exercises (scales and more) scored live; teachers make exercises and share them by link | pitch, theory, transport |
| **Ear Trainer** | Intervals, chord qualities, scale degrees | theory, sound |
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

- `theory.js` (done): note spelling, keys, chords, chord naming. Pure functions; tested by `tests/theory.html`.
- `sound.js` (done): the instrument rack (Salamander piano, e-piano, synth, pad, organ, harp), effects chain, master volume, 20 ms look-ahead.
- `transport.js` (done): metronome clicks (strong/normal/soft, volume to 200%), the metronome loop (strong/normal/silent beats, in-between clicks, beats per bar changeable while playing), count-in, tap tempo, BPM clamp, Italian tempo names. Used by the Metronome; Choordination no longer uses it. Tested by `tests/transport.html`.
- `ui/` (done): `themes.css` (the five themes' variables, plus `--bg-page` and the yellow-to-red warning pair), `i18n.js` (`t`, interpolation, `data-i18n`), `strings.js` (hub-wide strings), `select.js`/`select.css` (custom dropdowns), `modal.js` (dialogs), `page.css`/`page.js` (the page of a tool with no camera: header, About and Settings windows, footer with the support link, the Patreon window after 30 s idle (5 s wait, every 40 min at most), buttons, sliders, theme frames, saved settings, computer-only text; built with the Metronome). Dropdown lists open upward when there is no room below.
- `offline.js` (done): registers the hub's one service worker, `/sw.js` at the root. Offline and install are designed at the end for the whole suite (Phase 6); until then this worker stays as it is. It fetches our own files from the network first, so it never serves stale code during development.
- Choordination keeps its own header, About window and support links: they are markup tied to its stage. New tools use `ui/page.css` instead.
- `pitch.js`: new; microphone to note, running in an AudioWorklet
- `analysis.js`: new; wraps Essentia.js for key, BPM, beats and chords

## Phases

0. **Setup (done):** hub repo, Choordination copied in, install paths fixed, Salamander credit, CLAUDE.md, this file.
1. **Engines (done 2026-10-23):** split Choordination into `shared/` (theory, sound, transport, ui) with one service worker. Choordination behaves exactly as before. Theory tests are in `tests/theory.html`. **Next: the Choordination changes.**
2. **Tools on existing engines:** Metronome (built 2026-10-23, waiting for Drephie's listening check), Digital Piano, Ear Trainer, hub landing page, then the first public launch.
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

## Metronome: later ideas (not in the first version)

Silent bars practice (the click drops out for a bar), a speed trainer that slowly speeds up, a practice timer. Drephie picks.

## Open decisions

- Is Choordination already live at an address that must keep working?
- **License.** Essentia.js is AGPL-3.0, so tools using it must be AGPL too. The simplest choice is AGPL-3.0 for the whole hub. Needed before the repo goes public.
- Hub name (`open-music-tools` is a placeholder) and domain.
- Funding: Patreon, versus "minimal ads", versus Choordination's promise of "No ads, no trackers, ever".
- `REPO_URL` in `choordination/index.html` still points at a placeholder.
- A hub-wide privacy line for future tools (e.g. "Everything runs on your device"). Choordination's privacy text mentions its camera, so it stayed in Choordination; the wording for the hub is Drephie's. The Metronome's About window uses one Drephie approved with its spec: "Everything runs in your browser: no sound is recorded, nothing is uploaded, and there are no ads or trackers."
- The Metronome's About text names the hub "Open Music Tools" (the placeholder name) and has no repository link yet: update both once the name and repo are decided.
- Theme and language are remembered per tool (the Metronome remembers both; Choordination neither). Sharing them across the hub comes with the landing page.
- Test songs for Phase 4: 5 to 10 songs Drephie owns with known chords and BPM, including one with a difficult key change.

## Custom skills to create along the way

- `tool-spec` (done, `.claude/skills/tool-spec/`): the one-page spec Drephie approves before any code; specs live in `specs/`.
- `new-tool`: next, now that the Metronome works (folder layout, page parts, strings, `APP_SHELL`, tests, checks).
- `release-check`: before the first launch
