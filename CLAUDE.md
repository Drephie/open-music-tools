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

- `choordination/`: the hand-tracking chord instrument. One file, `index.html` (about 3,400 lines, roughly 50k tokens), with its own `manifest.json` and `sw.js` scoped to its folder.
- Planned: `shared/` engines and one folder per tool (see ROADMAP.md).
- `~/CLAUDE/choordination/` is the original folder, kept as an archive. Never edit it. Vochoorder (parked) only lives there.

## Tech

- **No build step and no npm** (Node isn't installed). Plain HTML, CSS and JavaScript; ES modules for shared code.
- Libraries come from CDNs with pinned versions: Tone.js 14.8.49 (cdnjs, with SRI) and MediaPipe tasks-vision 0.10.3 (jsDelivr).
- Run locally from the repo root with `python3 -m http.server 8000`, then open http://localhost:8000/choordination/. ES modules, camera, microphone and service workers don't work from `file://`.
- When you change a file that a service worker caches, bump that worker's `CACHE_NAME`.

## Conventions

- **Colors and fonts only through the theme CSS variables** (`:root` and `body[data-theme="…"]`), so every theme works in every tool.
- **Every user-facing string goes through the i18n dictionary** in English, Spanish and Italian (`data-i18n` attributes and `t()`). `{repo}` and `{patreon}` are interpolated, and missing keys fall back to English.
- **Check the license of every third-party sound, sample, font or model before adding it**, and credit it in the tool's About window when the license asks (e.g. the Salamander piano, CC BY 3.0).
- **Spell notes correctly for the key** (Choordination's `spellOnLetter`), and support both letter names and solfège.

## Working here

- One tool per session.
- Don't read all of `choordination/index.html`; grep for the part you need. (It gets split into modules in Phase 1.)
- **Claude can't hear.** For anything about sound, timing or feel, ask Drephie to listen and say exactly what to check. Verify pitch and analysis code against test signals whose answers are known.
- Test in the built-in browser, including at phone width.
- Commit after each working step, in small commits.
