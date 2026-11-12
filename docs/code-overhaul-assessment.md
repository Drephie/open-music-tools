# Does the code need an overhaul?

Assessment of 2026-11-12, read-only (no code was changed). For Drephie and for future Claude sessions.

## The short answer

**No overhaul.** The code is in good shape for something built by a dozen separate sessions: every tool already uses the shared engines (theory, sound, pitch, themes, translations, dropdowns, windows, saved settings, the one service worker), the conventions are followed almost everywhere, all automatic tests pass, and the release check catches the most common slips (a file missing from the offline list, an outside address, a missing translation).

What has grown is **copy-paste between tools**: about 50 to 100 lines of the same "page wiring" sit in every tool, and the two camera tools share a lot of copied code. Each copy is small, but a fix to one has to be repeated in up to nine places, and future sessions will copy them again into every new tool. That is worth fixing with **small, one-tool-at-a-time moves into `shared/`**, not a rewrite. Choordination's single big page is the one place where a split would really save time and money.

## Findings, most costly first

### 1. The same page wiring is copied into every tool (costs every future change)

Each of these is written out again in each tool's main file, with small differences between copies:

| Piece | Where it is copied |
|---|---|
| Theme and language menus: fill the lists, save on change, follow another tab (`watchLook`), `applyLanguage` | `metronome/metronome.js:300-357`, `vocal-tuner/vocal-tuner.js:314-387`, `instrument-tuner/instrument-tuner.js:413-481`, `pitch-detector/pitch-detector.js:422-445`, the same in `piano/`, `ear-trainer/`, `pitch-training/`, `chordigits/`, `hub/hub.js` |
| Keep the screen awake (`keepScreenAwake`, about 20 lines with the re-take on return) | `metronome/metronome.js:117`, `piano/piano.js:230`, `vocal-tuner/vocal-tuner.js:133`, `instrument-tuner/instrument-tuner.js:145`, `pitch-detector/pitch-detector.js:189`, `pitch-training/pitch-training.js:337` |
| iPhone sound mode (`navigator.audioSession`, so sound plays with the silent switch on) | one line in `metronome.js:21`, `piano.js:33`, `ear-trainer.js:28`, `chordigits.js:19`; a `setAudioSession` function in `pitch-detector.js:91`, `pitch-training.js:103` |
| Microphone start and stop (the "start number" that throws away a late microphone, error messages, stop 1 s after the page is hidden) | `vocal-tuner.js:68-127`, `instrument-tuner.js:80-139`, `pitch-detector.js:99-153`, `pitch-training.js:242-331` |
| "Start the sound inside the tap" (`unlockAudio`, `ensureAudio`, `loadRack`) | `piano.js:86-105`, `ear-trainer.js:114-123`, `pitch-detector.js:208-217`, `pitch-training.js:81-100`, `metronome.js:63` |
| Reading saved settings with defaults (`readSettings`) and `solfege()` | every tool, first 60 lines |
| Small helpers: `pretty` (♯ ♭), `fill` (put values in a string), `toMidi`, `fitTitle`, `readColors` | `piano.js:77`, `ear-trainer.js:67-71`, `pitch-training.js:34,68`, `pitch-detector.js:29,321`, `vocal-tuner.js:221-234`, `instrument-tuner.js:315-329`; `shared/ui/accidentals.js` and `shared/ui/pitch-graph.js:46` already have a `pretty` of their own |
| Camera start, recording (sound, screen, "Record my voice"), eyebrow sustain | `choordination/index.html:1346-1496, 1641-1792` and `chordigits/chordigits.js` (ROADMAP already flags this) |
| Choordination's own settings storage, own Patreon window and own strings | `choordination/index.html:1022` (settings), `1497` (Patreon, not `createSupportPrompt`), `787-1020` (strings) |

The page *layout* (header, windows, footer) is already shared through `shared/ui/page.css` everywhere except Choordination, which keeps its own on purpose (ROADMAP).

**Why it matters:** the iPhone sound mode, the screen lock and the microphone start are exactly the things that break on phones. Today a fix found in one tool silently stays missing in the others.

### 2. Choordination is one 2,600-line file (costs every Choordination session)

`choordination/index.html` holds 300 lines of CSS (lines 23-328), 350 lines of HTML, 230 lines of strings in three languages (787-1020) and about 1,600 lines of code in one script (682-2606) with 30 sections: recorder, camera, face and hand tracking, the drawing engine, the on-screen edit mode, touch mode and so on. A session can't read it whole without spending a lot, and grepping misses connections between sections. Its strings are also outside the terminal strings check (they are checked only by the browser page `tests/release-check.html`).

A sensible split, in this order (each step a separate commit, the page behaving the same after each):

1. CSS to `choordination/choordination.css`.
2. Strings to `choordination/strings.js` (then the terminal strings check can cover it).
3. The code into modules next to it: `recorder.js`, `vision.js` (camera, MediaPipe, brow calibration, zones), `draw.js` (drawing engine and theme cache), `edit-mode.js`, `touch.js`, with `choordination.js` keeping the state, start-up and wiring. The recorder and camera start then become the shared pieces Chordigits uses too (finding 1).

The other big files are fine: `piano.js` and `pitch-training.js` (737 lines each), `chordigits.js` (641) and `ear-trainer.js` (617) are long but organised; they shrink by themselves once finding 1 is done.

### 3. Risks for people using the site

- **Slow or patchy phone signal.** The service worker always asks the network first and waits as long as the network takes (`sw.js`, the `fetch` handler). On a weak train signal a page can hang for many seconds before falling back to the saved copy. A time limit (for example 3 s, then the saved copy) would fix it. Drephie should test it on a phone with bad signal and in airplane mode.
- **Updates.** Good: a new version installs only if every file downloads, old caches are removed, the big CDN files are kept across versions, and pages always get the newest files when online, so nobody stays stuck on an old version. Small gap: when a new version arrives while a tool is open, files the tool loads later (for example `shared/pitch-worklet.js`, loaded when you tap Start) come from the new version while the page is still the old one. Rare and fixed by a reload, but possible right after a release. Forgetting to bump `CACHE_NAME` is harmless for online users (the network comes first); it only affects what works offline.
- **MediaPipe is loaded without a fingerprint check.** Tone.js has an SRI hash, but the MediaPipe bundle is loaded from jsDelivr by code (`chordigits/chordigits.js:220`, `choordination/index.html:1637`), where a hash can't be checked, and the release check's SRI test doesn't see it. The version is pinned, so the risk is small; copying the bundle into the repo would remove it (Drephie decides: it adds a few MB to the repo).
- **iPhone Safari sound after an interruption.** No tool watches for the sound system being paused by the phone (a call, Siri, locking the screen: Safari's "interrupted" state). The piano, Ear Trainer and Pitch tools restart it on the next tap (`Tone.context.state !== 'running'`), which covers most cases; a metronome left running during a call will stay silent until Stop and Start. Worth one shared "resume on return" helper, tested by Drephie on an iPhone with a call or Siri.
- **Microphone and memory.** Handled well: `shared/pitch.js:100-190` stops the microphone, closes its sound system and disconnects everything, the microphone tools stop 1 s after the page is hidden, and late microphones are stopped. I found no obvious leaks, but nothing measures memory over a long session (see "Not checked").
- **One release-check failure today:** the "private GitHub address" check fails because an older saved version carries a different address. Not a code problem; Drephie may want to look at it before the next release.

### 4. Conventions: a few exceptions

- **Colours outside the theme variables:** shadows in plain black (`piano/piano.css:90-185`, `hub/hub.css:18,128`), per-theme frame colours in `chordigits/chordigits.css:51-54` and `choordination/index.html:41-43` (written per theme, so acceptable), the Patreon glow `rgba(255,66,77,…)` and the browser-bar colour `#0f1419` in `choordination/index.html:14,229`, canvas greys in `choordination/index.html:2130-2131`. The flags in `hub/hub.js:80-82` are meant to be real colours. None of these break a theme today; the Choordination ones are the only ones worth tidying.
- **Three languages:** complete for every tool with a `strings.js` (checked automatically), but **Chordigits is missing from the terminal strings check** (`tests/tools/run-strings-check.js`), and Choordination is checked only in the browser.
- **No outside services:** passes (release check). **Touch-first:** every tool has touch paths; I did not measure button sizes.

### 5. Tests

**Covered well (automatic, in the terminal too):** note naming and chord theory, smooth chords, Ear Trainer questions, the pitch engine against made-up tones and plucked strings, Instrument Tuner string finding, the Pitch Detector's line, Pitch Training's exercises and scoring, Chordigits' finger reading, every translation key, and the release check (offline list, outside addresses, licences, links). The metronome's timing has a browser test (`tests/transport.html`).

**No test:**
- the service worker (install, update, offline fallback);
- the shared page wiring: saving settings, theme and language shared across tabs, the Patreon window's timing;
- Choordination's and Chordigits' recording, camera start and the no-camera fallback;
- `shared/sound.js` (only Drephie's ears can test sound; a test could still check every instrument loads and the volume chain is connected);
- Chordigits' and Choordination's strings in the terminal check;
- anything at phone width: layouts are checked by hand in the browser each session.

## Plan

Targeted fixes, in this order. Each step is one small commit that leaves everything working. "Check" says what to verify afterwards; **Phone** means Drephie tests on a real phone before it is published.

| # | Step | Size | Check afterwards |
|---|---|---|---|
| 1 | Add Chordigits to `run-strings-check.js` | S | release check passes |
| 2 | Move the small helpers (`pretty`, `fill`, `toMidi`) into `shared/` (`ui/accidentals.js`, `ui/i18n.js`, `theory.js`) and use them everywhere | S | all terminal tests; open each tool, note names show ♯ and ♭ |
| 3 | `shared/ui/look-menus.js`: one function for the theme and language menus, `watchLook` and `applyLanguage`; move **one tool per commit**, Metronome first | M | in each tool: change theme and language, reload, change them in a second tab; all three languages |
| 4 | `shared/device.js`: `keepScreenAwake` and the iPhone sound mode; one tool per commit | S | **Phone:** screen stays on while playing or listening; sound with the silent switch on |
| 5 | `shared/listen.js`: the microphone start and stop wrapper around `startPitch` (start number, errors, stop when hidden); one tool per commit | M | **Phone:** each microphone tool starts, stops, survives Start-Stop-Start fast, stops when you switch app, shows the "denied" message |
| 6 | Service worker: a 3-second network limit before using the saved copy | S | **Phone:** airplane mode, weak signal; a new version still arrives online. Bump `CACHE_NAME` |
| 7 | Choordination: CSS to its own file, then strings to `strings.js` (two commits) | S + S | page looks the same in all seven themes and three languages; strings check covers it |
| 8 | Choordination: code into modules (recorder, vision, drawing, edit mode, touch), one module per commit | L | **Phone and camera:** Drephie plays chords by hand, records with and without voice, uses the edit mode and touch pads |
| 9 | Recorder and camera start into `shared/` and used by both camera tools (after step 8) | M | **Phone and camera:** both tools, recording with voice, the no-camera fallback |
| 10 | Shared "resume the sound after an interruption" helper | S | **iPhone:** start the metronome, trigger Siri or a call, come back |

Steps 1-4 and 6-7 are cheap and safe and pay for themselves at the next tool. Steps 8-9 are the biggest and only worth it if more Choordination or Chordigits work is coming (it is, per ROADMAP).

**Don't touch without Drephie listening or testing on a real phone:** `shared/sound.js` (instrument levels, effects, Dreamy glide), `shared/transport.js` (metronome timing), the thresholds in `shared/pitch.js`, `pitch-worklet.js` and `pitch-line.js`, the hand thresholds in `shared/hands.js`, the order of "start the sound first, inside the tap" in every tool, the microphone options (echo cancelling and noise cleaning off), camera start and recording, and `sw.js`. Moving code without changing it still needs the phone test for these, because a missed line shows only on a device.

## What I did not check

- I ran the terminal tests and release check (all tests pass; one personal-details check fails, see 3) but **not the browser test pages**, and nothing on a phone or in Safari.
- I read the shared modules' headers, `sw.js`, `offline.js`, `page.js` and the parts of each tool listed above, not every line of every file. Choordination was read through its section headings and greps only.
- I did not measure memory or CPU over a long session, button sizes, or accessibility (screen readers, contrast).
- I did not read the specs in `specs/` or compare tools against them.
