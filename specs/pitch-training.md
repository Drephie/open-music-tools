# Pitch Training: spec

**Status:** approved by Drephie, 2026-11-03, with Claude's picks as written. Drephie's choices from the questions and an animated prototype: both views (the whole exercise, or scrolling), both ways of hearing (listen then sing, or sing along with headphones), all four kinds of exercise, each one played over a beat and then repeated by the singer, rounds that go up a half step at a time and come back down, a count-in before you sing, a voice type with a starting note to fine-tune, two levels of scoring, and teacher-made exercises later.
Items marked *(Claude's pick)* weren't asked or weren't answered: say if you want them changed.

## What it is for

Warm-ups and pitch practice: the piano plays a short pattern over a beat, you sing it back, and the screen shows your voice over the notes and how many you sang in tune. Round after round it moves a half step higher, then comes back down, like warming up at the piano with a teacher. For singers of any level, no music reading needed.

## What it does

- **Pick an exercise** from a list on the screen. The numbers are the steps of the scale (1 is the starting note, 8 the octave above):
  - Scales: **Five-note scale** 1 2 3 4 5 4 3 2 1; **Major scale** 1 to 8 and back.
  - Arpeggios (the notes of a chord, one after another): **1 3 5 3 1**; **1 3 5 8 5 3 1**.
  - Intervals (jumps), each note two beats: **Third** 1 3 1; **Fifth** 1 5 1; **Octave** 1 8 1.
  - Slides (sirens): **Slide to the fifth** and **Slide to the octave**: hold 1, glide up, hold the top, glide down, hold 1.
  Each note lasts one beat and the last note two *(Claude's pick of the patterns and lengths)*.
- **How a round goes** (Listen, then sing; the start):
  1. **Listen:** the piano plays the pattern, with a click on every beat. The notes light up as they sound. A piano can't glide, so slides are played by a soft gliding tone *(Claude's pick)*.
  2. **Count-in:** one bar of four clicks; the screen counts 1 2 3 4.
  3. **Your turn:** silence while you sing it back; the beat shows on screen (a dot that pulses on every beat, and the sweeping line or the scroll). Your voice draws its line over the notes, and **a note fills in as you sing it in tune**.
  4. **The round's score**, for a moment: "8 of 9 in tune" and one kind tip, then the next round starts by itself *(Claude's pick)*.
- **Sing along (headphones)**, a choice in Settings: one bar of count-in while the piano sounds the first note, then the piano plays the pattern while you sing it. Through the phone's speaker the microphone would hear the piano, so this needs headphones (wired ones are best: Bluetooth headphones play late).
- **Rounds go up, then back down:** each round starts a half step higher, for 3, 5, 7 or 12 half steps (Settings; 5 at the start *(Claude's pick)*), then comes back down to where you began: 11 rounds with 5. **Stop** at any time. At the end, a short summary of every round ("Well done: 82 of 99 notes in tune"). Nothing is kept afterwards.
- **Two views** (Settings): **the whole exercise** (the start): the whole pattern on screen, with a thin line sweeping across it, once while the piano plays and once while you sing; or **scrolling**: the notes slide in from the right toward a fixed line, so you see the next few coming.
- **The graph** is the Pitch Detector's: piano keys down the left edge (tap one to hear it when no exercise is running), one lane per half step, high notes up. The notes to sing are bars on their lanes (sloped bands for slides). The keys are named as the round's key spells them (Fa♯ in Re major), and the lanes of the exercise's notes are faintly brighter. The view fits the round's notes with a margin and glides up as the rounds go up.
- **Your voice's line** is the Pitch Detector's (its stray and octave guards included), in the theme's line colour; the notes fill in the theme's accent colour.
- **Starting note:** pick a **voice type**, which sets a comfortable starting note *(Claude's pick of the notes: Soprano Do4, Mezzo La3, Alto Sol3, Tenor Do3, Baritone La2, Bass Fa2)*; then move it a half step at a time with − and +, and tap the note to hear it. It stops where an exercise would go beyond the notes the tool hears.
- **Speed:** Slow, Medium (the start) or Fast: 60, 80 or 100 beats a minute *(Claude's pick)*.
- **Scoring:** only the pitch is scored, not the timing. A note counts as **in tune** when most of it (60%) is within **25 cents** (a cent is a hundredth of a half step), or **10 cents in Precise** (Settings). The first moment of each note (the time it takes to land on it) is left out, and singing up to a quarter of a second late still counts. A slide counts in parts (the start, the way up, the top, the way down, the end); being a little early or late on a glide is fine. A note sung in tune fills; a note close to it (within 50 cents) gets an outline; the others stay as they were. **Nothing is ever red or called wrong.**
- **Any octave counts** *(Claude's pick)*: a tenor following a soprano's notes an octave lower is in tune, and the line is drawn over the bars, with a small note "an octave lower".
- **Tips** after each round, one at a time: "All in tune!"; "Sol was a little low"; "Most notes were a little high"; "Nothing heard: sing a little louder, or closer to the phone".
- **Microphone sensitivity** (Settings), with the level bar, as in the Pitch Detector.
- **If the microphone can't start**, the same plain messages as the other tools. The exercise stops when you leave the page for a second; the phone screen stays awake while it runs. **Keyboard on computers** *(Claude's pick)*: Space starts and stops, ↑ and ↓ move the starting note.
- **Patreon window** as in the other tools; a running exercise counts as use.

## Not in this version

Teacher-made exercises and sharing them by link (Drephie: later); clicks while you sing (Drephie: count-in only); minor scales and other patterns; vowels or words to sing on; scoring the timing; recording or playing back your voice; a vocal range test (dropped); music notation or sight-singing (dropped); keeping scores from day to day; changing A from 440; offline and install (Phase 6).

## Layout

**Phone, upright.** Everything fits one screen of 375 × 667 and 390 × 664, in every theme and language.

```
 ⌂  Pitch Training            (i) (⚙)
 [ Five-note scale  1 2 3 4 5 4 3 2 1  ▾ ]
 [ Soprano ▾ ]       [ − ]  Do4  [ + ]
 [  Slow  |  Medium  |  Fast  ]
        Your turn  ·  Round 3 of 11   ●
 ┌──┬──────────────────────────────┐
 │Sol           ▬▬                 │
 │Fa         ▬▬    ▬▬              │   the notes to sing (bars),
 │Mi      ▬▬   ╭~~~   ▬▬           │   your line over them,
 │Re   ▬▬  ╭──╯         ▬▬         │   the sweeping line
 │Do ▬▬ ──╯     │          ▬▬▬▬    │
 └──┴──────────────────────────────┘
             ( ■ Stop )
 Support on Patreon   Designed by @drephie
```

**Computer:** the same, wider. **Settings (⚙):** Theme, Language, Note names (Do Re Mi / C D E), Hearing (Listen, then sing / Sing along with headphones), View (Whole exercise / Scrolling), In tune within (25 cents / 10 cents, Precise), How far up (3 / 5 / 7 / 12 half steps), Microphone sensitivity. **About (i):** the short hub text, how a round goes in one sentence, the privacy line, the piano's credit, the Patreon button, the keyboard tips on computers only.

## Wording (English)

Pitch Training (Spanish "Ejercicios de afinación", Italian "Esercizi di intonazione", as on the home page); Start, Stop; Listen…; Your turn; Sing; Round {n} of {total}; {n} of {total} in tune; an octave lower; Well done: {n} of {total} notes in tune. Spanish and Italian come at build time.

## Remembered

In this browser only: the exercise, voice type, starting note, speed, hearing, view, Precise, how far up, note names, microphone sensitivity, theme and language (the last two for the whole hub). Nothing you sing and no score is kept.

## Built on

- `shared/pitch.js`: the microphone to a note.
- The Pitch Detector's line and graph, moved to `shared/` so both tools use them: the line (strays, octave slips, the loudness gate and sensitivity, fitting the view, the keys' names) and the graph (gaining the notes to sing, the sweeping line and the scrolling view). The Pitch Detector keeps working as it is.
- New in the tool, pure and tested with made-up voices whose pitch is known (`tests/pitch-training.html`, also from the terminal): the exercises and rounds, and the scoring and tips.
- `shared/sound.js` (the piano) and Tone.js 14.8.49; `shared/transport.js` for the clicks; `shared/theory.js` for spelling; `shared/ui/` for the page, windows, dropdowns, themes and translations.
- **Home page:** the greyed "Pitch Training" card becomes live, after the Pitch Detector. The hub service worker (`/sw.js`).

## Privacy and credits

"The microphone's sound is analysed on your device as it comes in, then thrown away: nothing is recorded, kept or uploaded." The piano is the Salamander Grand Piano by Alexander Holm (CC BY 3.0), credited in About.

## How we check it

**Claude:** the tests with made-up voices: in tune, 30 cents low, late by a fifth of a second, an octave lower, a scoop into every note, vibrato, silence, a slide followed and one not followed; the notes, clicks and count-in logged against the bars; in the browser with test tones in place of the microphone: both views, both ways of hearing, rounds up and down, the summary; 5 themes, 3 languages, 375 × 667, 390 × 664 and desktop; keyboard only; settings after a reload.

**Drephie, on the phone:** a five-note scale, an arpeggio, an interval and a slide, in both views: do the fills and the tips match what you hear? Is the piano loud enough while the microphone is on, and is the line left out while it plays? Do the count-in and the beat feel right at each speed? Sing along with headphones. Your voice type's starting note. The Spanish and Italian wording.
