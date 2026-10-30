# Pitch Detector: spec

**Status:** approved by Drephie, 2026-10-30. Drephie's choices from the questions and an animated prototype: time flows sideways, the view follows the voice (later: fits the notes on screen), a one-colour line, the note and its cents shown plainly at the top, and three extras: pause and look back, highlight a key, and tap a piano key to hear a short piano note.
**Built 2026-10-30**, with one change by Drephie while building: the view fits the notes on screen instead of following the voice at a fixed size. Drephie's phone test is still to do.
Items marked *(Claude's pick)* weren't asked: say if you want them changed. *(At build time)* marks details settled while building.

## What it is for

Lessons: sing, and see the line your pitch draws over time, so a singer can see what the ear hears: scooping into notes, vibrato, a long note that sags, a slide that overshoots. For singers and teachers of any level, no theory needed. The Vocal Tuner answers "is this note in tune?"; the Pitch Detector shows how the pitch moves.

## What it does

- **Start listening** (the slim button at the bottom, as in the tuners): the first time, the browser asks for the microphone. It stops by itself when you leave the page for a second.
- **The graph**, filling the middle of the screen: high notes up, low notes down; **time flows sideways**, with the newest sound at the right edge and about **6 seconds** on an upright phone (more on a computer or with the phone turned) *(Claude's pick)*. **Piano keys down the left edge** name the notes (Do Re Mi or C D E, with the octave on every Do), the black keys' lanes are faintly shaded, and a line marks every Do.
- **The line of your voice**, in one colour (the theme's accent), showing every wobble (your vibrato), with a break wherever you breathe. A dot at the right edge is where you are now. Nothing is judged: no colours for in tune (Drephie's choice). At a sudden jump to a new note the microphone can mishear a frame or two in between; those are left out, so a note change draws as a clean step *(at build time)*. **Octave slips** (Drephie's phone test: the line swung between octaves on a held note): the pitch reading can jump exactly an octave for a moment, which a voice can't do by accident, so within a phrase such a jump is drawn in the line's octave; if it stays more than half a second it was a real leap, and the line is redrawn where it was sung. Slides between octaves are drawn as they happen, and the note at the top keeps the line's octave *(after the phone test)*.
- **The piano keys look like a keyboard in every theme**: white keys in the theme's lighter colour, black keys in its darker one, each outlined; long names (Sol♯) get smaller to fit their key *(at build time)*.
- **The view fits what you sang** (Drephie, at build time: the usual graphs don't follow the real range): the lowest and highest notes on screen, plus a margin (at least a half step and a half), are the bottom and top of the graph, so the line always uses the whole height. A narrow phrase is shown in close detail, and a jump of two octaves within the seconds on screen still fits whole. The view opens up at once for a jump and closes in slowly, so it never jitters; a single held note shows about 7 half steps. When the lanes get thin, only the Do's (C's) keep their names.
- **At the top, the note you sing** and a plain number: **La**₄ · −12 cents (a cent is a hundredth of a half step: minus is low, plus is high). It moves calmly, like the Vocal Tuner's; nothing changes colour.
- **Pause** (a round button beside Stop) *(Claude's pick of the place)*: the graph freezes; **drag it sideways to look back** over the last 2 minutes *(Claude's pick)*; tap play to go live again (the pause shows as a break in the line). After Stop, the graph stays too and can be dragged. It is gone when you leave the page: nothing is kept.
- **Highlight a key** (Settings; None at the start): pick a key, for example C major or A minor, and its scale's notes get brighter lanes; the piano keys then name those notes as the key spells them (B♭ in F major, A♯ in B major) *(Claude's pick)*.
- **Tap a piano key to hear it:** a short piano note (about 2 seconds; the Piano's grand piano). While it sounds the graph doesn't draw (the microphone would hear the phone), the top says "Listen…", and a faint bar marks the note you heard, so you can see the target and then your answer *(Claude's pick: the bar)*. It works before you start listening and while paused too (then only the note plays). While listening, the phone's sound is set up to play and record at once; otherwise the piano also plays with an iPhone's silent switch on *(at build time; to check on the phone)*.
- **Microphone sensitivity** (Settings; Drephie after the phone test, on a train): Low (noisy places: only singing close to the phone), Normal (the start) or High (quiet rooms: everything the microphone hears). Sounds quieter than the chosen level aren't drawn; a note that has started keeps its fading end. A bar in Settings shows what the microphone hears now, with a mark where the chosen level starts, so you can see your singing above it and the room below it. Steady noise (a train's rumble) was already ignored; this keeps out quieter sounds that have a pitch (other voices, announcements) *(levels: −38, −48 dBFS and the engine's own −54; to be checked on the phone)*.
- **Range:** from La1 (55 Hz) to Si6, as the Vocal Tuner. **A = 440 Hz.**
- **When it hears nothing**, the line breaks and the top says "Sing a note"; before listening, "Tap to start, then sing" (tapping the graph starts it too); after Stop, "Stopped: drag to look back" *(at build time)*. The screen is never empty: the keys and lanes are always there. A microphone message may take a few lines at the top; the graph gives way *(at build time)*.
- **If the microphone can't start**, the same plain messages as the tuners.
- Keeps the phone screen awake while listening. **Keyboard on computers** *(Claude's pick)*: Space starts and stops, P pauses and plays, ← → look back while paused.
- **Patreon window** as in the other tools; listening counts as use.

## Not in this version

Saving the graph as a picture (Drephie: not now); in-tune colours on the line; recording or playing back your voice; target notes or exercises (that is Pitch Training); a held note to sing against (a drone needs headphones: later); more than one voice; changing A from 440; zooming by hand; offline and install (Phase 6).

## Layout

**Phone, upright** *(Claude's pick)*. Everything fits one screen of 375 × 667 and 390 × 664, in every theme and language. No boxes or panels.

```
 ⌂  Pitch Detector          (i) (⚙)

          La ₄ · −12 cents
 ┌──┬──────────────────────────────┐
 │Si│                              │
 │La│               ╭~~~~~~~~──    │   the line of your voice,
 │▬ │       ╭───~~~~╯              ●   newest at the right
 │Sol      │                       │
 │▬ │ ─────╯                       │
 │Fa│                              │
 │Mi│                              │
 └──┴──────────────────────────────┘
        ( Stop )  (❙❙)
 Support on Patreon   Designed by @drephie
```

**Computer:** the same, wider, so more seconds fit.
**Settings (⚙):** Theme, Language, Note names (Do Re Mi / C D E; follows the language until you choose), Highlight a key (None, then the 12 major and 12 minor keys), Microphone sensitivity (Low / Normal / High, with the level bar).
**About (i):** the short hub text, how to read the graph in one sentence, the privacy line, the piano's credit, the Patreon button, the keyboard tips on computers only. "A = 440 Hz" was left out of About to keep it on one phone screen *(at build time)*.

## Wording (English)

Pitch Detector (Spanish "Detector de tono", Italian "Rilevatore di intonazione", as on the home page); Start listening, Stop, Pause, Play; Tap to start, then sing; Sing a note; {note} · {n} cents; Paused: drag to look back; Highlight a key: None. Spanish and Italian come at build time.

## How well it draws (measured with made-up voices, since Claude can't hear)

Through the pitch engine into the line: a held note within a hundredth of a cent; a vibrato of ±40 cents drawn as a swing of 75 cents (a very wide, fast one of ±100 cents at 6.5 a second as 176: the microphone's short listening window evens out the fastest wobbles a little); a slide followed smoothly; 8 sudden note changes, up and down, small and large, with nothing drawn in between; silence and room noise draw nothing. The line keeps the last 2 minutes. Real voices and phone microphones still need your ears (see the checklist).

## Remembered

In this browser only: note names, the highlighted key, the microphone sensitivity, theme and language (the last two for the whole hub). Nothing you sing is kept: the graph lives only on the screen.

## Built on

- `shared/pitch.js`: the microphone to a note (`startPitch`, the calm smoother for the note at the top; the line uses every frame, with only strays left out, so vibrato shows). The line and the keys' names are `pitch-detector/trace.js`, tested by `tests/pitch-detector.html` (also from the terminal) *(at build time)*.
- `shared/theory.js`: note names and the keys' spelling (`commonNoteName`, `spellOnLetter`, the keys).
- `shared/sound.js` and Tone.js 14.8.49: the piano for the notes you tap (the first Phase 3 tool that makes sound).
- `shared/ui/` for the page, windows, dropdowns, themes and translations; the drawn ♯ and ♭ (`accidentals.js`).
- **Home page:** the greyed "Pitch Detector" card becomes live, after the Instrument Tuner. The hub service worker (`/sw.js`).

## Privacy and credits

"The microphone's sound is analysed on your device as it comes in, then thrown away: nothing is recorded, kept or uploaded." The piano is the Salamander Grand Piano by Alexander Holm (CC BY 3.0), credited in About, as in the Piano.

## How we check it

**Claude:** the pitch engine tests; in the browser, test tones in place of the microphone (held notes, a slow slide, steps, vibrato, a scoop, silence, noise): the line, the breaks, the following view, pause and looking back, the key highlight and its spelling, a tapped key (the note played, logged, and the graph not drawing meanwhile); 5 themes, 3 languages, 375 × 667, 390 × 664 and desktop; keyboard only; settings after a reload.

**Drephie, on the phone** (home Wi-Fi https link): sing a scale, a long note with and without vibrato, a scoop and a slide: does the line match what you hear? Does the view follow you smoothly? Pause, drag back and go live again; highlight a key; tap a key: is the piano loud enough while the microphone is on (iPhones may play more quietly while listening), and does the graph leave it out? The Spanish and Italian wording.
