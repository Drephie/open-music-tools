# Open Music Tools (working name)

Free, open-source music tools that build musical literacy and help people make their own music. Tools only, never AI-made music. Owner: Drephie, singer and vocal coach (@drephie).

**Read [ROADMAP.md](ROADMAP.md) at the start of every session.** It holds the tool list, the phases, what was dropped and why, and the open decisions.

## Principles

- **Everything runs on the user's device.** Never upload audio, video or files, and never process them on a server.
- **No AI-generated music, lyrics or melodies.** Algorithms that suggest (e.g. Jam Machine's chord progressions) are fine; the person makes the music.
- **No trackers and no third-party ad networks.** Choordination's welcome screen promises "No ads, no trackers, ever". How the hub is funded is an open decision in ROADMAP.md, so don't add any ads or analytics without asking.
- **Don't store people's creative work on the site** (data-loss liability). Settings in `localStorage` are fine, and so are files the user downloads.
- **For everyone.** Beginner-friendly wording, no assumed theory knowledge.
- **Touch-first**, but everything also works with mouse and keyboard.

## Layout

- `shared/`: engines every tool imports (theory, sound, transport, offline, `ui/`). Each module's header comment is its API: read the header, not the implementation.
- `choordination/`: the hand-tracking chord instrument. `index.html` (about 2,800 lines, roughly 40k tokens) with its own `manifest.json`. Its `sw.js` is a retired worker that only removes itself from old installs.
- `index.html` at the root and `hub/`: the home page (a card for every tool; planned tools greyed out). When a tool is finished, move its card up there.
- `sw.js` at the root: the one service worker for the whole hub.
- `tests/`: browser test pages (`theory.html`) and their fixtures.
- One folder per new tool (see ROADMAP.md), e.g. `metronome/`. New tools build their page on `shared/ui/page.css` and `page.js`.
- `specs/`: the one-page spec of each new tool, approved by Drephie before any code (the `tool-spec` skill).
- `~/CLAUDE/choordination/` is the original folder, kept as an archive. Never edit it. Vochoorder (parked) only lives there.

## Tech

- **No build step and no npm** (Node isn't installed). Plain HTML, CSS and JavaScript; ES modules for shared code.
- Libraries come from CDNs with pinned versions: Tone.js 14.8.49 (cdnjs, with SRI) and MediaPipe tasks-vision 0.10.3 (jsDelivr).
- Run locally from the repo root with `python3 -m http.server 8000`, then open http://localhost:8000/ (the home page) or a tool, e.g. http://localhost:8000/choordination/. ES modules, camera, microphone and service workers don't work from `file://`.
- When you change a file the service worker caches, bump `CACHE_NAME` in `/sw.js`; list each new tool's files in its `APP_SHELL`.
- Tests run in the browser: open http://localhost:8000/tests/theory.html, http://localhost:8000/tests/transport.html (metronome timing, levels and volume) and http://localhost:8000/tests/ear-trainer.html (every Ear Trainer question checked against `nameNotes`) and http://localhost:8000/tests/pitch.html (the pitch engine against made-up tones, plucked strings, noise and silence, also through the real AudioWorklet) and http://localhost:8000/tests/instrument-tuner.html (the Instrument Tuner's tunings and string finding, also with plucked strings through the pitch engine) and http://localhost:8000/tests/pitch-detector.html (the Pitch Detector's line and the keys' names for every key, also with voices through the pitch engine) and http://localhost:8000/tests/pitch-training.html (Pitch Training's exercises, rounds and scoring, with made-up singing and voices through the pitch engine). The theory, Ear Trainer, pitch, Instrument Tuner, Pitch Detector and Pitch Training checks also run from the terminal with macOS's built-in JavaScriptCore: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/tools/run-theory-test.js` (and `run-ear-trainer-test.js`, `run-pitch-test.js`, `run-instrument-tuner-test.js`, `run-pitch-detector-test.js`, `run-pitch-training-test.js`).

## Conventions

- **Colors and fonts only through the theme CSS variables** (`shared/ui/themes.css`: `:root` and `body[data-theme="…"]`), so every theme works in every tool.
- **Every user-facing string goes through the i18n dictionary** in English, Spanish and Italian (`data-i18n` attributes and `t()`, from `shared/ui/i18n.js`). `{repo}` and `{patreon}` are interpolated, and missing keys fall back to English. Strings every tool uses live in `shared/ui/strings.js`; a tool's own strings stay in the tool.
- **Check the license of every third-party sound, sample, font or model before adding it**, and credit it in the tool's About window when the license asks (e.g. the Salamander piano, CC BY 3.0).
- **Spell notes correctly for the key** (`spellOnLetter` in `shared/theory.js`), and support both letter names and solfège.

## Working here

- One tool per session.
- Don't read all of `choordination/index.html`; grep for the part you need.
- **Claude can't hear.** For anything about sound, timing or feel, ask Drephie to listen and say exactly what to check. Verify pitch and analysis code against test signals whose answers are known.
- Test in the built-in browser, including at phone width.
- Commit after each working step, in small commits.
