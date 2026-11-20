# BPM & Key Finder: spec

**Status:** approved by Drephie, 2026-11-20 ("build", after the trial on her five songs: BPM 3 exact and 2 at double, ½ fixes both; keys 5 of 5).
Items marked *(Claude's pick)* were not asked: say if you want them changed.

## What it is for

Find the speed (BPM: beats per minute, how many beats you would tap in a minute) and the key of a song, check the speed by ear with clicks over the song, then practise at that speed. One tool instead of a BPM Finder and a Key Finder (Drephie).

## What it does

- **Three ways to give it a song** (nothing ever leaves the device):
  - **Choose a file:** a song or a video from the phone or computer (MP3, M4A, WAV, MP4, MOV, a screen recording…). On a computer you can also drop it on the page.
  - **Listen to another tab** (computers with Chrome or Edge only; hidden elsewhere): pick the YouTube (or any) tab and tick "Share tab audio"; it listens for 30 seconds while the song plays there.
  - **Listen with the microphone:** play the song on any device or speaker; it listens for 30 seconds. Less exact than a file (room sound).
  - A YouTube link can't be read on the device (Drephie asked; every way needs a server in between), so the page says: "YouTube? Use Listen to another tab on a computer, or record your screen on a phone and choose the recording."
- **Listening:** "Listening to the song…" with a progress bar (a file), or a 30-second countdown (tab and microphone, with a Stop early button after 15 s). A 4-minute song took about 9 seconds on a computer in the trial.
- **The BPM:** a big number with the tempo word under it as in the Metronome ("Andante: at a walking pace"), and **½ 61** and **×2 246** buttons: tap one and it becomes the big number (and the clicks follow); tap again to go back. When the tempo moves a lot: "The tempo changes in this song (about 108 to 152)".
- **The key:** e.g. **A minor**, with the note names in the hub's letters or Do Re Mi. When unsure (the ways of reading it disagree): "or C major" under it. When it changes for a long stretch: "Changes to D major at 1:40".
- **Not found:** a silent or too-quiet file, or only noise: "Couldn't find a beat or a key: is the sound on? Try another part of the song." Only drums: the BPM, and "Couldn't find a key (no notes, only drums?)". Under 10 seconds: "Too short: give it at least 10 seconds."
- **Play with clicks:** Play / Pause, a bar showing where you are (tap or drag it), a click on each beat found and a dot that flashes with it. Clicks on or off, click sound and click volume. For the tab and microphone, it plays back what it heard.
- **Tap to fix it:** tap with the beat while it plays; after 4 taps the number and the clicks follow your taps.
- **Open in Metronome:** opens the Metronome at this BPM. **Another song:** back to the start.
- Keyboard *(Claude's pick)*: Space = play/pause, T = tap, O = choose a file. In About on computers only.
- Patreon window as in the other tools (never while listening or playing).

## Not in this version

Chords (Chord Finder: the trial found them 69% of the time). Slowing down or looping (Practice Player). A tempo graph. Strong clicks on bar starts (beats are found, not bars). Looking songs up by name in an outside database (Drephie: no).

## Controls

| Control | Range | Default |
|---|---|---|
| Source | file, another tab, microphone | |
| ½ / ×2 | the found BPM halved or doubled | the found BPM |
| Play / Pause, position | the whole song | paused at the start |
| Clicks | on / off | on |
| Click sound *(Claude's pick)* | Click, Beep, Wood, Hi-hat | Wood |
| Click volume | 0 to 200% (as the Metronome) | 100% |
| Note names | C D E / Do Re Mi | the hub's choice |

## Layout

**Phone (375 × 667 and up):** header (house, "BPM & Key Finder", About, Settings). Before a song: one panel with **Choose a song** (main button), **Listen with the microphone** and, on computers, **Listen to another tab**; the "nothing is uploaded" line and the YouTube tip. After: the file name, then side by side the BPM (with ½ and ×2 under it) and the key; then the player (beat dot, position bar, times, **Play** and **Tap**), Clicks, Click sound and Click volume, **Open in Metronome** and **Another song**. The page may scroll after a song (it shows more than the Metronome).
**Computer:** the answers on the left, the player and click settings on the right.

## Wording (English)

Choose a song · Listen with the microphone · Listen to another tab · Nothing is uploaded: the song stays on your device · Listening… · BPM · Key · or {key} · Changes to {key} at {time} · The tempo changes in this song (about {low} to {high}) · Couldn't find a beat or a key · Play · Pause · Tap · Clicks · Click sound · Click volume · Open in Metronome · Another song. Spanish and Italian at build time.

## Remembered

In this browser only: clicks on/off, click sound, click volume, theme, language and note names. Never the song or its results.

## Built on

- New `shared/analysis.js` (with `analysis-worker.js` and the pure rules in `analysis-rules.js`): decodes the sound and finds the beats, BPM and key with Essentia.js in a background worker, so the page never freezes. For the Practice Player and Chord Finder later.
- **Essentia.js 0.1.3** (Music Technology Group, Universitat Pompeu Fabra; AGPL-3.0 like the hub): our own copy in `shared/vendor/essentia/` with its license (Drephie), loaded only when a song is given.
- `shared/transport.js` (clicks, tap tempo, tempo words), `shared/theory.js` (key names), `shared/ui/`.
- The Metronome opens at a BPM from its address (`?bpm=96`).

## Privacy and credits

Everything stays on the device: files, tab sound and microphone are read by the browser and never uploaded or kept. The microphone and tab sharing stop as soon as the 30 seconds end. Credit in About: Essentia.js (AGPL-3.0).

## How we check it

**Claude:** the rules (½/×2, tempo range, key or "or…", key changes, not found) in `tests/bpm-key-finder.html` and from the terminal; the trial songs (12 free ones and Drephie's 5, kept off git) in the trial page; silence, noise and a drums-only test; a stand-in microphone and tab; 7 themes, 3 languages, 375 × 667, 390 × 664 and computer with a measured check for overlaps, round edges (Soft Pink) and sideways scroll.
**Drephie, on her phone:** her five songs as files (and one screen recording), the microphone with a song on another speaker, ½ / ×2 on songs 3 and 4, clicks on the beat all through, Tap, Open in Metronome; on the computer, Listen to another tab with YouTube.
