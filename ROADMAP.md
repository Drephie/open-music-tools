# Roadmap

**Status (2026-10-23):** Phase 0 (setup) is done. Next is Phase 1.

## Tools in scope

| Tool | What it is | Builds on |
|---|---|---|
| **Choordination** | Hand-tracking chord instrument (exists; changes pending) | theory, sound, transport |
| **Digital Piano** | Touch-first piano with good sound that names the chord you play; MIDI keyboard input | theory, sound |
| **Metronome** | Metronome and tap tempo | transport |
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

## Shared engines (planned, in `shared/`)

- `theory.js`: note spelling, chords, keys, chord naming (extracted from Choordination)
- `sound.js`: the instrument rack (extracted from Choordination)
- `transport.js`: metronome and timing (extracted from Choordination's looper)
- `ui/`: themes, i18n, header, About and support links (extracted from Choordination)
- `pitch.js`: new; microphone to note, running in an AudioWorklet
- `analysis.js`: new; wraps Essentia.js for key, BPM, beats and chords

## Phases

0. **Setup (done):** hub repo, Choordination copied in, install paths fixed, Salamander credit, CLAUDE.md, this file.
1. **Engines:** split Choordination into `shared/` (theory, sound, transport, ui) with one service worker. Choordination must behave exactly as before. Theory tests go in a browser test page. Then the Choordination changes.
2. **Tools on existing engines:** Metronome, Digital Piano, Ear Trainer, hub landing page, then the first public launch.
3. **Pitch:** pitch engine, then Tuner, Pitch Detector and Pitch Training.
4. **Analysis:** an Essentia.js trial on the test songs, then BPM Finder, Practice Player and Chord Finder.
5. **Jam Machine.**

After Phase 1, phases 2 to 5 don't depend on each other.

## Choordination change candidates (Drephie picks)

- Smooth voice leading (closest inversion) instead of always playing root position
- m7♭5 as its own modifier; 11ths and 13ths; slash chords and bass notes
- Web MIDI output to control a DAW
- Drephie's own list

## Open decisions

- Is Choordination already live at an address that must keep working?
- **License.** Essentia.js is AGPL-3.0, so tools using it must be AGPL too. The simplest choice is AGPL-3.0 for the whole hub. Needed before the repo goes public.
- Hub name (`open-music-tools` is a placeholder) and domain.
- Funding: Patreon, versus "minimal ads", versus Choordination's promise of "No ads, no trackers, ever".
- `REPO_URL` in `choordination/index.html` still points at a placeholder.
- Test songs for Phase 4: 5 to 10 songs Drephie owns with known chords and BPM, including one with a difficult key change.

## Custom skills to create along the way

- `tool-spec`: before the first new tool (Phase 2)
- `new-tool`: after Metronome works
- `release-check`: before the first launch
