# Jam Machine: spec

**Status:** approved by Drephie, 2026-11-19; built the same day (Beta). Also *(Claude's picks)*: picking a chord in the Change window plays it; on a computer Alt + arrow moves the focused chord. Mock-up: `specs/mockups/jam-machine.html`.
Items marked *(Claude's pick)* weren't answered: say if you want them changed.

## What it is for

A backing band to play and sing over: pick a style, get a chord progression (the chords of a song, in order, that loop), change it until you like it, and press Play. For practising songs, writing your own, or jamming on any instrument.

## What it does

- **A small band:** the chords in a rhythm that fits the style, a drum beat, and a bass line on each chord's main note (its root). Drums and bass are made by the sound engine itself: no new samples, no outside sites.
- **8 styles**, each with its own typical progressions, chord rhythm, drum beat, bass line and starting speed: **Pop** (100 BPM, e.g. C G Am F), **Ballad** (70), **Rock** (120), **Blues** (80, swung, the 12-bar blues), **Jazz** (120, swung, 7th chords like Dm7 G7 Cmaj7), **Bossa nova** (130), **Reggae** (75, chords on the off-beats), **Lo-fi** (80, swung, soft 7th chords). *(Speeds: Claude's pick.)*
- **New chords** (a dice button) makes a new progression in the style. The chords are suggested by rules from each style's usual progressions, never made up by AI; you choose.
- **Lock** a chord you like: it stays when you press New chords.
- **Drag to reorder:** press and drag a chord to a new place (mouse too). Locked chords can't be dragged and keep their place; the others move around them *(Drephie)*.
- **Tap a chord** to change it: the chords that fit the key come first, the style's most likely ones on top, then "More chords" (chords borrowed from the other mode, like B♭ in C major). The same window has Lock and Remove.
- **Length:** 4 bars to start, one chord per bar. **+ Add a bar** at the end adds a chord that fits after the one before it; as many as you want, up to 64 *(the limit: Claude's pick)*. Choosing Blues makes 12 bars.
- **Key:** a new random key and major or minor with every New chords *(Drephie: most people just press New chords until a key and progression work for them)*. Key, Major/Minor and speed are under **Advanced** (closed at first) *(where: Claude's pick)*. Changing the key there keeps the progression: the same chords move to the new key (C G Am F becomes D A Bm G). Changing Major/Minor keeps the same steps of the key too (I V vi IV becomes i v VI iv) *(Claude's pick)*. While a key is picked by hand, New chords keeps it; "Random" goes back to a new key each time. While any chord is locked, New chords keeps the key too, so the locked chords really stay *(Claude's pick)*.
- **Speed:** each style starts at its own speed; under Advanced, change it with − and + (40 to 240 BPM) or **Tap** it.
- It **loops** until you press Stop. Changes made while it plays are heard from the next bar *(Claude's pick)*.
- **Smooth chords:** each chord moves as little as possible from the one before (as in Choordination), so it sounds like a player, not jumps.
- **Copy chords:** copies one line, e.g. "Pop · C major · 100 BPM · C G Am F".
- **Save to a file / Open a file:** saves the whole jam (style, key, speed, chords and locks, sounds and volumes) as one **.omt** file (Open Music Tools) on your device. Open it later in the Jam Machine to get it back exactly. The file never leaves your device.

## Second round (Drephie, 2026-11-19, after trying it)

These win over anything above.
- **Style** is a dropdown (Pop first), not 8 buttons.
- **Key at the top** ("D major") with **− and +** beside it: they move the whole song a half step (transpose). Under Advanced, **Key for New chords** and **Major or minor for New chords** (Random, or one you pick) only decide the key of the next New chords; they don't change the chords already there.
- **Right-click a chord** (mouse) locks or unlocks it.
- **Holding − or +** keeps changing the speed (and the number of bars).
- **Advanced** also has **Bars** (− 4 +) for the section you're on, and **Divide into sections**.
- **Sections** (Intro, Verse, Pre-chorus, Chorus, Bridge, Outro): a row of section names above the chords; tap one to see and change its chords. New chords and Bars change only that section. The song plays every section top to bottom, then loops; the section playing is marked. Tap the section you're on again for its window: name, **Duplicate** (a copy right after it, e.g. Verse 2, changed on its own), move earlier or later, delete. "+" adds a section. With two or more sections, New chords keeps the song's key unless a Key for New chords is picked *(Claude's pick: so the sections stay in one key)*.
- **Drums:** a choice in Sounds between **Acoustic kit** (real recorded drums: Virtuosity Drums by Versilian Studios and Karoryfer Samples, CC0, credited in About; 6 hits, 430 KB, our own files) and **Synth drums** (the made-up ones). Acoustic kit first *(Claude's pick)*.
- Copy chords and the .omt file keep the sections.

## Third round (Drephie, 2026-11-19)

- **Time signature** under Advanced: 4/4, 3/4 or 6/8; each style starts in its usual one (4/4 for all 8). 3/4 plays a waltz feel and 6/8 a rocking 8th-note feel in the style's colour. In 6/8 the speed counts the two big beats of a bar *(Claude's pick)*.
- **Chord length:** each chord's window has Length (− 4 beats +), 1 to 16 beats; a whole bar unless changed. The beat lines under a chord show its length. The drums keep their bars whatever the chords do.
- **Sections** can be dragged to change the song's order (hold a name on a phone).
- Synth drums in Jazz fixed (the ride and the hi-hat now have their own synths).
- Bigger chords: four or fewer show as two big cards a row on phones and big cards on computers; stronger labels.

## Not in this version

Two chords in one bar, or one chord over two bars; downloading as audio or MIDI; a keyboard or guitar shapes for the chords; your own drum patterns; more styles (Funk, Gospel, Folk, Waltz); melodies (never made by the tool).

## Controls

Style (8, Pop first); New chords; Play/Stop; each chord (tap: change, Lock, Remove; drag: move); + Add a bar.
**Advanced** (closed at first): Key (Random, then 12 keys); Major/Minor (Random, Major, Minor); speed − / + / Tap (the style's speed).
**Sounds** window: chord sound (piano, e-piano, synth, pad, organ, harp, dreamy; piano first), and for Chords, Drums and Bass an on/off switch and a volume (0 to 100%, all at 80%) *(Claude's pick)*.
**Settings:** theme, language, note names (C D E or Do Re Mi), count-in (one bar of drum sticks before it starts, off) *(Claude's pick)*.
Copy chords, Save to a file, Open a file: three small buttons by the key's name.

## Layout

**Phone, upright,** one screen at 375 × 667 with 4 to 8 bars; more bars, or Advanced open with more than 4, scroll a little. Mock-up: `specs/mockups/jam-machine.html`.
Header (house, Jam Machine, About, Settings) · the 8 styles as buttons, 4 per row · the key and speed as text ("C major · 100 BPM") with three small buttons: Copy chords, Save to a file, Open a file · the chords, 4 per row: a big name (Am), its number in the key under it (vi), the bar number in the corner, a lock mark when locked; the one playing is filled, with 4 beat lines that light up · **Add a bar** (a dashed row) · New chords and Sounds side by side · **Play** full width (the main button, turns into Stop) · **Advanced** (a row that opens): Key, Major/Minor, speed − 100 + Tap with the tempo word (Andante).
**Computer:** two columns: styles, Advanced and the Sounds mixer always open on the left; the chords, New chords and Play on the right. Keys: Space = Play/Stop, N = New chords *(Claude's pick)*.

## Wording (English)

Jam Machine (same name in Spanish and Italian); Style; Advanced; Key; Random; Major; Minor; Speed; Tap; Play; Stop; New chords; Add a bar; Change chord; Chords that fit; More chords; Lock this chord; Unlock; Remove; Sounds; Chords; Drums; Bass; Chord sound; Volume; Count-in; Copy chords; Copied!; Save to a file; Open a file; "This file isn't a Jam Machine file."

## Remembered

In this browser: the chord sound, the parts' switches and volumes, count-in, the last style, Advanced open or closed. The chords themselves are **not** kept on the site (nothing you make is stored there): a new progression comes up each visit, and Save to a file keeps one.

## Built on

- `shared/theory.js` (keys, chord names and numbers, smooth chords), `shared/sound.js` (chord sounds), `shared/transport.js` (speed, tap tempo, count-in), `shared/ui/` (page, windows, dropdowns, translations).
- New, in the tool: the styles (progressions, rhythms, beats, bass lines) and the rules (New chords, locks, suggestions, the .omt file) in a module with no sound, tested by `tests/jam-machine.html` (and `jsc`); the drum and bass voices.

## Privacy and credits

Nothing is recorded or uploaded; no microphone. Saved files stay on your device. Salamander Grand Piano by Alexander Holm (CC BY 3.0), credited in About. Drums and bass are made in the browser: nothing to credit.

## How we check it

**Claude:** the test page: every style's progressions in all 24 keys fit the key and are spelled right, locks survive New chords, Add/Remove, the .omt file comes back exactly and broken files are refused. In the browser: 7 themes, 3 languages, 375 × 667, 390 × 664 and desktop; the notes land on the beats and loop cleanly (checked by listening in code, since Claude can't hear); no part clips at full volume.
**Drephie, by ear on the phone:** each style sounds like itself (rhythm, swing, drums, bass); the drums and bass sound good enough (or we look for free drum samples); the balance at 80%; changes landing at the next bar; Save and Open on the phone.
