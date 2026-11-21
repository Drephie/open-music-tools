# Ear Trainer, the course: spec

**Status:** approved by Drephie, 2026-11-22, **as a Beta you turn on in Settings** ("Try the new course (Beta)"). The current lessons stay the main Ear Trainer until the course is out of Beta. The redesign of the Ear Trainer (first version: `specs/ear-trainer.md`).
Drephie's choices (2026-11-22): one course plus practice tabs; 8-question lessons with no fail; a daily streak and daily goal; a review of your mistakes; Learn cards, Meet the sound, higher/lower, same/different and Pick the one; chord progressions, minor keys and short melodies; a soft chime you can switch off. *(Claude's pick)* marks what wasn't asked: say if you want it changed.

## What it is for

The same tool, now a small course in the style of Duolingo: many short steps that teach the ear and the theory together, from "is it higher or lower?" up to the chords of pop songs. A few minutes a day, with a reason to come back tomorrow.

## What it does

- **One course: 8 sections, 40 units, about 130 lessons** (today: 36). Each unit introduces **one new thing**. It has 3 lessons:
  1. **Meet**: a **Learn card** first (one or two sentences with sound buttons to tap, e.g. "A major 3rd: Do–Mi. ▶"), then easy questions, half of them **Pick the one** (two sounds play: "Which one is the major 3rd?").
  2. **Practise**: the new thing against the one or two it is most easily mixed up with.
  3. **Mix**: the new thing among everything learned so far, mistakes you made earlier first.
  
  Each section ends with a **Checkpoint** (a trophy on the path): 8 questions from the whole section.
- **A lesson is always 8 questions** (1–2 minutes). No fail: a wrong answer shows the right one (Compare, as today), then comes back at the end of the lesson until you get it right. **Stars from first tries:** 3 for 8 of 8 or 7 of 8, 2 for 5–6, 1 for less *(Claude's pick)*. Best stars are kept; any lesson can be redone.
- **Kinds of question:** Which is it? (as today); **Higher or lower?**; **Same or different?**; **Pick the one**; for melodies, **tap the steps in order** (1, 3, 2); for progressions, **which chord comes next?** (I, IV, V or vi).
- **Skip ahead** *(Claude's pick)*: a section's Checkpoint can be taken at any time. 7 of 8 right at the first try and the whole section counts as done, so musicians aren't held back.
- **Daily streak:** a flame with the number of days in a row with at least one lesson. **One rest day a week**: one missed day doesn't break it *(Claude's pick)*.
- **Daily goal:** a ring that fills. 1, 2, 3 or 5 lessons a day, **2 by default** *(Claude's pick)*. A review, a streak game or 8 free-practice answers count as a lesson too.
- **Practise my mistakes:** the tool remembers the answers you mix up (e.g. 4th heard as 5th, the last 30). Once there are 3, a **Review** button gives a lesson of 8 of them. An answer leaves the list after you get it right twice.
- **End of a lesson:** a celebration screen with sparkles in the theme's colours: the stars, "7 of 8 at first try", the streak flame ("Day 5!"), the goal ring and **Continue**. A finished unit or section gets a bigger celebration.
- **Combo** *(Claude's pick)*: "3 in a row!" under the answer after 3, 5 and 8 right in a row.
- **Sounds:** a soft chime for right and a low soft tap for wrong, played after the answer, from the hub's own sounds (no new files). On by default, with a switch in Settings.
- **Practice tabs: Intervals, Chords, Scale steps**, each with its **streak game** (3 lives) and **free practice**, as today.

## The course (going up unless said)

1. **Sound basics:** higher or lower · same or different · step or leap (next-door note or a jump) · half step or whole step.
2. **Intervals going up:** major 3rd and 5th · octave · 4th · major 2nd · minor 3rd · major 6th · minor 6th · minor and major 7th · minor 2nd and the tritone (6 half steps).
3. **Intervals going down and together:** going down · both notes at once · all mixed.
4. **Chords:** major and minor (built from the 3rds you know: major = major 3rd + minor 3rd) · diminished · augmented · sus2 and sus4 · dominant 7th and major 7th · minor 7th · half-diminished and diminished 7th.
5. **Keys and scale steps (major):** home and the 5 (what the I–IV–V–I chords tell you) · 1 3 5 · 1 2 3 · 3 4 5 · 5 6 7 and high 1 · all seven, lower and higher.
6. **Short melodies:** 2 notes on 1–3 · 3 notes on 1–5 · 3 notes on all seven (tap the steps in order).
7. **Chord progressions:** home, then IV or V · adding vi (the minor chord on 6) · I–IV–V–I and friends · the four-chord pop pattern (I–V–vi–IV).
8. **Minor keys:** major or minor key? · minor 1 3 5 · minor 1 to 5 · all seven, and minor melodies.

## Not in this version

Hearts or failing a lesson; points (XP) and leaderboards; building an interval on a small keyboard; singing the answer; chord inversions; intervals wider than an octave; reminders or notifications; accounts or sharing progress between devices.

## Layout

**Phone, upright, 375 × 667:**
- **Header** as today. With the Beta on, under it **two tabs: Course | Practice**; with it off, the Ear Trainer is exactly as today.
- **Course:** a thin bar that stays on top: the flame with the streak, the goal ring ("1 / 2"), and **Review** when there are mistakes to review. Then the path, scrolling: each section a coloured band with its name, the unit's lessons as round buttons winding left and right, stars under the finished ones, faint circles for the locked ones, the next one glowing with **Start** beside it, a trophy for the Checkpoint. It opens scrolled to your next lesson.
- **Practice:** the three topics (Intervals, Chords, Scale steps), each with the Streak game ("Best 23") and Free practice cards; Review on top when there is something to review.
- **Lesson screen:** as today (× back, the bar "3 / 8", the question, Hear again, the answers, Compare, Next). A Learn card is its own screen before the first question: title, the sentence, the sound buttons, **Got it**.
- **Computer:** the same in a centred column. Keyboard as today, plus Enter = Got it / Continue.
- **Settings:** Theme, Language, Note names, **Try the new course (Beta)** (off by default), **Daily goal**, **Sounds for right and wrong**, Start over (asks first).

## Wording (English, main labels)

Course, Practice, Start, Got it, Continue, Review, Practise my mistakes, Checkpoint, Skip ahead?, Day {n}!, Goal reached!, {n} in a row!, Higher or lower?, Same or different?, Which one is the {name}?, Tap the steps in order, Which chord comes next?, Unit done!, Section done!. Section names as above. Claude writes the Learn cards, section and unit names in en/es/it (about 50 short texts), using the 2026-11-22 terms (semitono, sfida a filotto, menor séptima / minore settima); Drephie checks them.

## Remembered

In this browser only: lesson stars, streak days (the date of the last day and the count), today's goal progress, the daily goal, the mistake list (only which answer was heard as which), the best game scores, free-practice choices, chime on or off, Beta on or off, note names, theme and language. **Existing players keep their stars** (the old lessons keep them as they are; the course reads them too): each old lesson's stars go to the units with the same answers, earlier units open, and Sound basics counts as done for anyone who had any star *(Claude's pick)*. Old best scores stay.

## Built on

`shared/sound.js` (the piano for questions, the harp or electric piano for the chime; unchanged), `shared/theory.js` (chords, the major scale, the natural minor scale if missing; header updated), `shared/ui/`, the tool's own `questions.js` (new question kinds and the course list), `/sw.js` (cache bumped).

## Privacy and credits

Nothing recorded or uploaded, no microphone, no account. Piano: Salamander Grand Piano, CC BY 3.0, as today. No new outside sounds.

## How we check it

**Claude:** `tests/ear-trainer.html` and the `jsc` runner check every new question kind and every course lesson against `nameNotes`, the stars, the end-of-lesson repeats, streak days across dates, the rest day, the goal, the mistake list and the migration from old stars; 7 themes, 3 languages, 375 × 667 and 390 × 664, computer; keyboard only.
**Drephie, by ear on the phone:** the chime (soft enough? at the right moment?); higher/lower and same/different at the first steps; whether Pick the one is clear; melodies and progressions (speed, clear key); whether the order of the course feels fair; the Learn cards' wording in all three languages.
