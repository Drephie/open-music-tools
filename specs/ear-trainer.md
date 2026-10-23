# Ear Trainer: spec

**Status:** approved by Drephie, 2026-10-23. Built the same day; waiting for Drephie's phone test.
Items marked *(Claude's pick)* weren't asked: say if you want them changed. *(At build time)* marks details settled while building.

## What it is for

Learn to recognise what you hear, for anyone, no theory needed: the distance between two notes (an **interval**, like Do–Mi), the kind of chord (its **quality**: major sounds bright, minor darker), and which step of the key a note is (its **scale degree**: "the 5th"). Short focused lessons, plus a game for when you want a challenge.

## What it does

- **Three tabs:** Intervals, Chords, Scale degrees. Each tab has its own lessons, its own streak game and its own free practice.
- **Lessons**, each focused on one thing (e.g. "Minor 3rd or major 3rd?"), shown as a path of numbered circles. They **unlock one by one**: finishing a lesson opens the next, like Duolingo. A lesson goes on **until you have 10 right**; mistakes just make it longer. A bar shows how many right so far. At the end, stars: 3 for no mistake or one, 2 for 2 to 4, 1 for 5 or more *(Claude's pick)*. You can redo a lesson; its best stars are kept.
- **Streak game**, one per tab: **3 lives**. It starts with 2 easy answers and adds one every 5 right answers; once all are in, intervals also mix up, down and together. A wrong answer costs a life and plays the right one. Your score is how many you get right before the lives run out; your **best score** for each tab is kept, with a "New best!" when you beat it.
- **Free practice**: tick exactly the answers you want (at least 2), and how they are played; endless questions, no stars or lives, just "7 right of 9" for this visit *(Claude's pick)*. For a teacher's homework ("only 4ths and 5ths this week").
- **Each question:** it plays by itself, then you tap an answer. **Hear again** replays it as often as you like.
  - Right: your button turns green, and the name shows in plain words, e.g. "Major 3rd: 4 half steps" (a half step is the smallest step on the piano, from one key to the very next, black or white).
  - Wrong: your button turns red, the right one green, with both names. **Compare** plays yours, then the right one. In a lesson the question doesn't count; in the game you lose a life.
  - Then **Next**.
- **How notes are played:** intervals go **up** (low note, then high note) in the first lessons; later lessons go down and together (both at once). Free practice has the choice: Up, Down, Together or Mixed. Chords play together (in free practice also "one by one, going up"). Scale degrees: first the key is played as four chords (I–IV–V–I, the usual "this is home" ending), then one note *(Claude's pick)*. Each question is in a new random key and register, so you can't just compare with the last one *(Claude's pick)*.
- **Grand piano sound only** (the sampled Salamander piano).
- **Scale degrees are named with numbers 1 to 7** (1 = home, the key's first note). Major keys only in this version.
- The notes are shown small under the answer, e.g. "Do4 → Mi4" for an interval or "Do · Mi · Sol" for a chord, in Do Re Mi in Italian and Spanish and C D E in English, with a switch in Settings, like the Piano *(Claude's pick; scale degrees show only the number, as you chose)*.
- **Gamified look** *(Claude's pick)*: the lesson path with stars and locks, the next lesson glowing, hearts for lives, a flame with the score, a short burst of sparkles in the theme's colors when a lesson ends or a best is beaten. No extra sounds (no "ding"), so nothing gets in the way of listening.
- **Keyboard on computers** *(Claude's pick)*: Space = hear again, 1 to 9 and 0 = the answer buttons (numbered on computers only; - and = for the 11th and 12th interval), Enter = Next, Escape = back to the lessons.
- **In the streak game** *(at build time)*: when an answer comes in, the line under the buttons says "New answer: Octave" and its button gets a star; after a mistake the question plays again while the right button glows green.
- **Patreon window**, as in the Metronome and Piano; while a question plays, the page counts as in use.

## The lessons (going up unless said)

**Intervals (16):** 1 major 3rd, perfect 5th · 2 perfect 5th, octave · 3 perfect 4th, perfect 5th · 4 major 2nd, major 3rd · 5 minor 3rd, major 3rd · 6 review: M2 m3 M3 P4 P5 octave · 7 major 6th, perfect 5th, octave · 8 minor 6th, major 6th · 9 minor 7th, major 7th, octave · 10 minor 2nd, major 2nd · 11 tritone, perfect 4th, perfect 5th · 12 all 12 · 13 going down: M2 m3 M3 P4 P5 octave · 14 all 12 going down · 15 together: m3 M3 P4 P5 octave · 16 all 12: up, down and together.
**Chords (12):** 1 major, minor · 2 major, minor, diminished · 3 major, augmented · 4 all four of those · 5 sus2, sus4 (suspended: the middle note moved, so it sounds open) · 6 major, minor, sus4 · 7 all six 3-note chords · 8 dominant 7th, major 7th · 9 dominant 7th, minor 7th · 10 those three · 11 half-diminished, diminished 7th · 12 all five 4-note (7th) chords.
**Scale degrees (8):** 1 the 1 and 5 · 2 1, 3, 5 (the home chord) · 3 1, 2, 3 · 4 3, 4, 5 · 5 1 to 5 · 6 5, 6, 7, high 1 · 7 all seven · 8 all seven, lower and higher.
Chords also get a few plain words each in the answer, e.g. "Minor: darker; a minor 3rd, then a major 3rd" *(Claude's pick; you check the words)*.

## Not in this version

Minor keys for scale degrees; chord inversions; intervals wider than an octave; a small keyboard; song reminders; the next question playing by itself; other sounds than the piano; singing the answer (needs the pitch engine, Phase 3); teacher-made lessons shared by link; offline and install (Phase 6).

## Layout

**Phone, upright** *(Claude's pick: no keyboard to show, so no need for sideways)*. Everything fits one screen of 375 × 667 and 390 × 664, in every theme and language.
- **Lessons screen:** header (Ear Trainer, About (i), Settings (⚙)); the three tabs; the lesson path (numbered circles, 4 per row, stars under finished ones, a lock on locked ones); under it the chosen lesson's name and **Start**; two cards side by side: **Streak game** (flame, "Best 23") and **Free practice**; footer.
- **Question screen** (lessons, game and practice): on phones the title bar is hidden, as in the mock-up, so the question has the whole screen *(at build time)*; top bar with × (back) and the bar "4 / 10" (in the game: hearts and the flame with the score); "Which interval is it?"; a big **Hear again**; the answer buttons (2 or 3 per row); the answer line; **Compare** and **Next**.
- **End of a lesson:** stars, "Lesson 5 done!", **Next lesson** and **Back**. **End of a game:** score, best, **Play again** and **Back**.
- **Free practice window:** the answers to tick, how they are played, **Start**.
- **Computer:** the same in a centered column, answer buttons up to 4 per row.
- **Settings (⚙):** Theme, Language, Note names (Do Re Mi / C D E), Start the lessons over (asks first) *(Claude's pick)*.
- **About (i):** the short hub text, what intervals, chords and scale degrees are, the Salamander credit, the Patreon button, keyboard tips on computers only.

## Wording (English)

Ear Trainer (Spanish "Oído musical", Italian "Orecchio musicale", short enough for a phone's title bar; *at build time*); Intervals, Chords, Scale degrees; Lessons, Start, Streak game, Best, Free practice; Which interval is it? / Which chord is it? / Which step of the key is it?; Hear again, Compare, Next; Right!, Not quite; New best!; Play again. Interval names as in the Piano (minor 2nd … octave, tritone). Spanish and Italian come at build time.

## Remembered

In this browser only: which lessons are open and their stars, the best game score for each tab, the free-practice ticks and choices, the last tab, note names, theme and language. Clearing the browser's data starts it over. No scores of single visits are kept.

## Built on

- `shared/sound.js`: the grand piano and its volume, unchanged.
- `shared/theory.js`: chord shapes, the major scale and `nameNotes` to spell the notes shown; no change expected.
- `shared/ui/`: page parts, windows, dropdowns, translations. The interval names and chord words the Piano already has move into the hub's shared strings, so both tools use the same words.
- The questions are made by a small module of the tool, tested in a new `tests/ear-trainer.html`: every question's notes really are the interval, chord or step it claims.
- The hub service worker (`/sw.js`).

## Privacy and credits

Nothing is recorded or uploaded; there is no microphone. Piano sound: Salamander Grand Piano by Alexander Holm (CC BY 3.0), loaded from the Tone.js site and credited in About.

## How we check it

**Claude:** 5 themes, 3 languages, phones 375 × 667 and 390 × 664, desktop; keyboard only; every window, tab and screen; lesson unlocking, stars, lives and best score; settings and progress after a reload; the question test page, `tests/theory.html` and `tests/transport.html`; the Piano still loads.

**Drephie, by ear on the phone:** the piano in questions (length of the notes, the gap between them); whether the I–IV–V–I chords make the key clear; whether lesson 1 of each tab is easy enough and the order fair; how fast the streak game gets harder; Compare; the chord words; the Spanish and Italian wording.
