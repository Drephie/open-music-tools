# Vocal Tuner: spec

**Status:** approved by Drephie, 2026-10-24, after two rounds of changes (a calmer screen, one name per note, and the 3D wave ball, tried in animated prototypes). Built the same day. **Changes after Drephie's first phone test (2026-10-30)**, marked *(phone test)*: in tune within ±10 cents with a Hard mode at ±5; a resting ball and a "Sing a note" prompt instead of an empty screen; a ring around the ball when in tune, visible in Monochrome too. Second phone test: waiting.
Items marked *(Claude's pick)* weren't asked: say if you want them changed. *(At build time)* marks details settled while building.

## What it is for

A quick, calm check of the note you sing: which note it is, and whether you are a little too low or too high. For singers of any level, no theory needed. Drephie, 2026-10-24: the Tuner becomes **two tools**, this **Vocal Tuner** (any note) and later an **Instrument Tuner** (guitar tunings and other instruments, its own session). The Pitch Detector stays a separate tool too: the live note plus a graph of how your pitch moves, for lessons.

## What it does

- **Start listening** (a slim button at the bottom): the first time, the browser asks to use the microphone. While it listens the button reads **Stop**. Listening stops by itself when you leave the page or switch apps, so the phone's microphone sign goes off; tap Start again when you are back *(Claude's pick)*. A quick glance at the notifications doesn't stop it: only a second away does *(at build time)*.
- **The note you sing**, big, in the middle, in Do Re Mi or C D E (see Settings), with its octave as a small number beside it: **La** ₄ (middle C is Do4, as in the Piano). **One name per note**, with the real ♯ and ♭ signs, the names singers use most: Do♯, Mi♭, Fa♯, La♭, Si♭ (Drephie, at approval). The signs are drawn, because the themes' fonts have none of their own *(at build time)*. The title gets a little smaller on phones when it would need two lines (Spanish and Italian) *(at build time)*.
- **One line of plain words** under it: "12 cents low", "8 cents high" or **In tune** (a cent is a hundredth of a half step, the step from one piano key to the very next).
- **A thin line with a dot** (Drephie's sliding bar, made lighter): a small notch marks the middle; the dot slides left when you are low and right when you are high; the ends are half a step away (50 cents). A slightly thicker stretch around the middle shows how wide "in tune" is, and lights up when you are in it *(phone test)*.
- **In tune means within ±10 cents**, or **±5 cents in Hard mode** (a choice in Settings) *(phone test: it was always ±5)*. Then the note, the words, the dot and the ball light up in the **theme's accent colour**, not green (Drephie, at approval: green disappears in Retro CRT and looks wrong elsewhere): light blue in Liquid Glass, pink in Y2K, hot pink in Soft Pink, bright white in Monochrome, amber in Retro CRT *(Claude's pick of the accents)*, and **a ring appears around the ball** *(phone test)*. Monochrome has no colour, so there the note, words and ball are grey when off and turn bright white, with the ring, when in tune *(phone test)*.
- **A = 440 Hz**, always (Drephie's choice).
- **How it moves** (a choice in Settings, Drephie's choice): **Calm** (the start: smooth, ignores tiny wobbles, settles in about a quarter of a second) or **Quick** (follows every wobble at once, so you see your vibrato).
- **The wave ball** (Drephie's design, from the prototypes): behind the note, a 3D ball made of rings of your voice's real sound wave, slowly turning.
  - **At rest** (before you start, and in silence) it is a calm wireframe ball at about half size that breathes slowly, so the screen is never empty *(phone test: it used to shrink to a dot)*. It **grows** as you sing louder and settles back in silence; it reacts to any sound the microphone hears, so you can see it is listening before a note shows.
  - New rings start at its middle and drift to the top and bottom. Their wave changes with your vowel and your voice.
  - **In tune it becomes round and smooth**, in the accent colour; **the further off you are, the more chaotic it looks** (bumpier, wobblier rings). It also tilts a little toward low or high.
- **When it hears nothing**: the note, words and dot clear (Drephie's choice), and **"Sing a note"** shows inside the resting ball *(phone test)*. Before listening it says "Tap to start, then sing", and tapping the ball starts listening too *(phone test)*. A note stays a quarter of a second after you stop, so it doesn't flicker.
- **Range:** from La1 (55 Hz, a very low bass) to Si6 (about 2000 Hz, far above a soprano's top C) *(Claude's pick)*.
- **If the microphone can't start**, a plain message says why and what to do: it was blocked (allow it for this site in the browser's settings), the page isn't secure (it needs an https address), no microphone was found, or another app is using it.
- Keeps the phone screen awake while it listens *(Claude's pick)*. **Keyboard on computers** *(Claude's pick)*: Space = start/stop listening.
- **Patreon window**, as in the other tools; while it listens, the page counts as in use, so it never interrupts practice.

## How well it hears (measured with made-up test sounds, since Claude can't hear)

The new pitch engine (`shared/pitch.js`) was checked against tones whose pitch is known exactly: a held note is read within a tenth of a cent, from the lowest bass to the top of the range, also with a voice-like sound and with room noise 10 dB below the voice; a note shows about 25 to 45 thousandths of a second after you start it; silence and noise never show a note. Real voices and real phone microphones still need your ears and your phone (see the checklist).

## Not in this version

Playing a note to tune to (Drephie: no sound in this version); instrument strings and tunings (the Instrument Tuner, its own tool); changing A from 440; the exact pitch in Hz (left out to keep the screen calm); a graph of your pitch over time (the Pitch Detector); recording; transposing instruments; offline and install (Phase 6).

## Layout

**Phone, upright** *(Claude's pick)*. Everything fits one screen of 375 × 667 and 390 × 664, in every theme and language. No boxes or panels: the ball fills the middle of the screen.

```
 ⌂  Vocal Tuner             (i) (⚙)

          ·  ~~~~~~~  ·
        ~~   ~~~~~~~   ~~      the wave ball, behind
       ~~      La ₄     ~~     the note, grows with
        ~~   ~~~~~~~   ~~      your voice
          ·  ~~~~~~~  ·

           12 cents low
      ───────●─━┿━───────      ━ the in-tune zone

          ( Stop )
 Support on Patreon   Designed by @drephie
```

**Computer:** the same, centred, with a bigger ball.
**Settings (⚙):** Theme, Language, Note names (Do Re Mi / C D E; follows the language until you choose, as in the Piano), In tune within: 10 cents / 5 cents (hard) *(phone test)*, Movement: Calm / Quick (shows vibrato).
**About (i):** the short hub text, the privacy line (below), the Patreon button, the keyboard tip on computers only.

## Wording (English)

Vocal Tuner (Spanish "Afinador vocal", Italian "Accordatore vocale" *(Claude's pick)*); Start listening, Stop; Sing a note; {n} cents low, {n} cents high, In tune; Movement: Calm, Quick (shows vibrato). Spanish and Italian come at build time.

## Remembered

In this browser only: note names, Hard mode, Calm or Quick, theme and language (the last two for the whole hub). Nothing you sing is kept.

## Built on

- `shared/pitch.js` (new, Phase 3): the microphone to a note, with the detector running in an AudioWorklet (a part of the browser's sound system that works away from the screen, so the display stays smooth). It also hands the tool the latest sound wave for the ball. Tested by `tests/pitch.html` and its terminal version. The Instrument Tuner, Pitch Detector and Pitch Training will use it too.
- `shared/theory.js` for the note numbers; `shared/ui/` for the page, windows, dropdowns, themes and translations. `themes.css` gets two colours in every theme for the ball: its lines, and the in-tune accent. No Tone.js: the Vocal Tuner makes no sound.
- **Home page:** the "Tuner" card becomes **Vocal Tuner** (live, after the Metronome *(Claude's pick)*), and a greyed **Instrument Tuner** card joins "Coming soon". The hub service worker (`/sw.js`).

## Privacy and credits

"The microphone's sound is analysed on your device as it comes in, then thrown away: nothing is recorded, kept or uploaded." No third-party sounds, samples, fonts or models.

## How we check it

**Claude:** the engine test page; in the browser, test tones played to the Tuner instead of a microphone (in tune, 12 cents low, 30 cents high, a slow slide, a vibrato, silence, noise); 5 themes, 3 languages, 375 × 667, 390 × 664 and desktop; keyboard only; the microphone-blocked message; settings after a reload.

**Drephie, on the phone** (the microphone needs an https address, e.g. the Netlify test copy): sing a held La, then slowly slide up and down; do the note, the dot and "In tune" agree with your ear? Calm and Quick, with and without vibrato; a very low and a very high note; whether a quiet room stays clear; the ball (growing, round in tune, chaotic when off); talking near the phone (it shouldn't flash notes); the Spanish and Italian wording.
