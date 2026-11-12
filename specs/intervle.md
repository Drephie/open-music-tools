# Intervle: spec

**Status:** approved by Drephie, 2026-11-12. Name: Intervle (Drephie). Alpha: Rouge theme only, card on the home page marked Alpha.
Items marked *(Claude's pick)* weren't answered: say if you want them changed.

## What it is for

A daily ear puzzle, like a word-of-the-day game but for music: three short puzzles a day, the same for everyone, for a few minutes of ear practice and a streak to keep.

## What it does

- **Three puzzles every day**, one per mode, each with **3 tries**. No clues yet: a wrong try just fades that answer, so you can't pick it again.
  - **Easy:** two notes, the second always **above** the first. Name the distance between them (the **interval**): "Major 3rd", with "4 half steps" small under it (a half step is one piano key to the very next).
  - **Medium:** you're told the first note ("This is Do") and hear it, then a second note **above or below**, within an octave. Name the second note.
  - **Hard:** you're told a note and hear it, then a chord built on it (that note is the chord's lowest note, the **root**). The chord can sit **above or below** where the note was played: same root, other octave *(Claude's pick)*. Name the chord: **sus2, sus4, 7, maj7, m7, 6, 9** (add9 left out: too close to 9).
- **Play** button plays the puzzle; replay as often as you like *(Claude's pick)*. Grand piano. Intervals: one note then the other. Chords: one by one going up, then together *(Claude's pick)*.
- **The day's puzzle** follows the player's own clock: a new one at their midnight. Each day has a number: **#1 is five days before the game goes up**, so five past games are there from the start.
- **A year of puzzles:** a fixed list of 365 puzzles per mode, written once and kept in the tool, so day 40 is the same for everyone. Mixed so it doesn't repeat the same answer two days in a row, and every answer comes up about as often. After day 365 the list starts again from #1, shifted to new notes *(Claude's pick)*.
- **Past games:** a list of every day since #1, with your result for each. Play any of them; past days don't count for the streak.
- **Streak:** one per mode, the days in a row you solved today's puzzle. Your best streak is kept.
- **Answers:** big buttons. Tried wrong answers fade. On a computer you can also type: "m3", "maj 3", "5" (half steps), "E", "Mi", "sus4", "maj7"; Enter answers.
- **Result:** after a mode, "Right in 2 tries" or "The answer was: Perfect 4th", with **Hear it again**. After all three, the day's summary and a **Copy result** button that copies one line, e.g. "Intervle #12 · Easy 1/3 · Medium 2/3 · Hard X" *(Claude's pick)*. Nothing is sent anywhere.
- Note names follow the hub setting (Do Re Mi or C D E), spelled with flats or sharps as is easiest to read.

## Not in this version

Clues after a wrong try; other themes (coming soon, after the alpha); other sounds; chord inversions; intervals wider than an octave; a leaderboard or anything online; sharing as a picture; reminders.

## Controls

Mode tabs (Easy, Medium, Hard); Play; the answer buttons (Easy 12, Medium 12, Hard 7); Hear it again; Copy result; Past games. Settings: language, note names; theme shows Rouge and "More themes coming soon".

## Layout

**Phone, upright,** one screen at 375 × 667.
Header (house, Intervle, About, Settings) · "#12 · Thursday 12 November" · three tabs with ✓ or ✗ once done · the question line ("How far apart are the two notes?" / "This is Do. Which note comes next?" / "This is Do. Which chord is built on it?") · big **Play** · three dots for the tries · answer buttons, 3 or 4 per row · result line · **Past games** and streaks at the bottom.
**Computer:** the same in a centered column. Keys: Space = Play, 1 to 9, 0, -, = for the buttons, or type the answer.

## Wording (English)

Intervle (same name in Spanish and Italian); Easy, Medium, Hard; Play; tries left; Right!; Not quite; The answer was…; Streak, Best; Past games; Copy result; Copied!; More themes coming soon. Interval names as in the Ear Trainer.

## Remembered

In this browser only: your result for each day played, the streaks and best streaks, the last mode. Clearing the browser's data starts it over.

## Built on

- `shared/sound.js` (piano), `shared/theory.js` (interval and chord shapes, note names), `shared/ui/` (page, windows, translations); no change expected.
- The year of puzzles is a list file in the tool, checked by a new `tests/intervle.html` (and `jsc`): every puzzle's notes are what it claims, Medium stays within an octave, Hard roots are lowest, no answer twice in a row, the day number from any date.

## Privacy and credits

Nothing is recorded or uploaded; no microphone. Salamander Grand Piano by Alexander Holm (CC BY 3.0), credited in About.

## How we check it

**Claude:** Rouge, 3 languages, phone 375 × 667 and desktop; keyboard and typing; the day number around midnight and month ends; past games; streaks after a reload; the test page.
**Drephie, by ear on the phone:** gap between the two notes; whether chords one by one then together sound clear; whether sus2/sus4 and 6/9 are fair in Hard; the wording in all three languages.
