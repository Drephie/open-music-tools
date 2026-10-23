# Metronome: spec

**Status:** approved by Drephie, 2026-10-23.
Items marked *(Claude's pick)* were "no preference" answers: say if you want them changed.

## What it is for

A steady click to practise with, for anyone singing or playing. Set the speed, or tap along to a song to find its speed.

## What it does

- Plays a click at 40 to 240 beats per minute (BPM). Starts at 100.
- **Beats per bar**, 1 to 12 (4 for most pop songs, 3 for a waltz). Starts at 4.
- **Beat dots:** one dot per beat. Tap a dot to change that beat: **strong** (higher, louder click), **normal**, or **silent** (no click, the dot still lights up). Beat 1 starts strong. While it plays, the current dot lights up.
- **In-between clicks** (musicians call them subdivisions): off, 2 per beat ("1-and"), 3 per beat ("1-trip-let") or 4 per beat ("1-e-and-a"). Softer than the beats. Off at first. A 6/8 feel is 2 beats with 3 in-between clicks each.
- **Tap tempo:** tap the Tap button along with the music; after 2 taps the speed follows your last 5 taps. A pause of more than 2.5 seconds starts over.
- **Four sounds:** Click, Beep, Wood, Hi-hat. Picking one while stopped plays it once so you hear it.
- **Volume** slider, separate from the phone's volume *(Claude's pick)*: 0 to 200%, starting at 100% (today's level). A mark on the slider shows where 100% is. Above 100% the slider fills with a gradient from yellow (at 100%) to red (at 200%); the thumb, the number with its % and a note "Extra loud" take the color at the current position (orange at 150%, red at 200%) (after Drephie's phone test, 2026-10-23: 100% is now the loudest clean level, 50% sounds about half as loud, and 100–200% makes each click fuller and louder, up to about 8–10 dB more, a little rougher, without ever clipping).
- **Tempo names** *(Claude's pick)*: under the number, the Italian word for that speed with its meaning, e.g. "Andante: walking pace". Largo 40–59, Larghetto 60–65, Adagio 66–75, Andante 76–107, Moderato 108–119, Allegro 120–167, Presto 168–199, Prestissimo 200–240.
- **Keyboard shortcuts** *(Claude's pick)*: Space = start/stop, T = tap, arrow keys = 1 slower/faster (with Shift: 10). The About window lists them only on a computer (a device with a mouse).
- **Patreon window** (Drephie, 2026-10-23): when the page has been untouched for 30 seconds, the next tap, click or key opens a "Support the Metronome" window with a Patreon button instead of doing its action. Continue (and ×) work after a 5-second countdown. After that it comes back at most once every 40 minutes (remembered in the browser, shared by the hub's tools). While the metronome plays, the page counts as in use, so the window never interrupts practice.
- Keeps the phone screen awake while it plays, so the click doesn't stop when the screen would turn off.
- On iPhone, it plays even when the silent switch is on (where the browser allows it).

## Not in this version

Silent bars practice (the click drops out for a bar), a speed trainer that slowly speeds up, a practice timer, sound with a song file, offline and install (designed at the end for the whole hub). Time signatures by name (2/4, 6/8…): beats per bar and in-between clicks cover them in simpler words.

## Controls and layout

**Phone (portrait), top to bottom.** Everything fits on one screen of about 375 × 667 and up (checked in every theme and language, up to 12 beats); the number and the big buttons grow on taller screens.
1. Header: "Metronome" on the left; on the right an About button (i) and a Settings button (gear).
2. Beat dots (two rows when there are more than 6), with the hint "Tap a dot: strong, normal or silent".
3. The tempo: a big number with "BPM" next to it (under it on desktop; tap the number to type a tempo), then the tempo name.
4. Tempo row: − button, slider, + button. Holding − or + keeps changing it.
5. Two big buttons: **Tap** and **Start** (it becomes **Stop** while playing).
6. Beats per bar (− 4 +); In-between clicks and Sound (dropdowns, side by side); Volume (slider, with "Extra loud" on the same line).
7. Footer: "Support on Patreon" and "Designed by @drephie".

**Desktop:** the same parts, bigger, in a centered panel; the settings in point 6 sit to the right of the tempo instead of below it.

**Settings window (gear):** Theme (the five themes) and Language (English, Español, Italiano). Their lists open on top of the window, fully visible.

**About window (i):** "Free, open-source music tools by Drephie (linked to @drephie). No ads, no trackers, nothing uploaded: everything runs in your browser." Then a big Support on Patreon button, and the keyboard tips on computers only (shortened at Drephie's request, 2026-10-23).

## Remembered

Everything is remembered in this browser only: tempo, beats per bar, which beats are strong/normal/silent, in-between clicks, sound, volume, theme and language. On the first visit the language follows the browser (Spanish or Italian, otherwise English). Theme and language are saved for the Metronome only; sharing them across the whole hub comes with the hub landing page.

## Built on

- `shared/transport.js`: the four click sounds, tap tempo, the 40–240 limit. Extended for this tool: strong/normal/silent beats, a soft level for in-between clicks, beats per bar changeable while playing, a volume control, and a signal for the dots to light up in time. Its header is updated with the changes.
- `shared/ui/`: themes, translations (en/es/it), dropdowns, windows. `themes.css` gets two new colors, `--color-warn-start` (yellow) and `--color-warn-end` (red), for "too loud"-type warnings; themes may adjust the shades so they read on their background.
- The hub service worker (`/sw.js`), as for Choordination.

## Privacy and credits

Nothing is recorded or uploaded; there is no microphone. All four sounds are made by Tone.js in the browser (no samples to license).

## How we check it

**Claude checks:** in the built-in browser, all 5 themes, 3 languages, phone and desktop width, keyboard use, that each beat is scheduled at the right time (by calling the beat code directly, since the built-in browser slows its audio clock), and that `tests/theory.html` still passes.

**Drephie listens:** steadiness at 40, 100 and 240 BPM; each of the four sounds (strong, normal, in-between); strong/normal/silent beats; in-between clicks at 2, 3 and 4; tap tempo against a song; the volume slider at 50%, 100% and 200% (does 50% sound about half, is 100% clean and loud, is 200% clearly louder, and are accents still clear there?); that the dots light up with the clicks.
