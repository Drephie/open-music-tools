# Piano: spec

**Status:** approved by Drephie, 2026-10-23.
Built from Drephie's prototype Diapason (MaySuite): same design, with the hub's sounds, themes and languages. Items marked *(Claude's pick)* weren't asked: say if you want them changed.

## What it is for

A piano in the browser for anyone: play notes and chords, hear a real grand piano, and see the name of what you play. A singer can also leave a note or chord sounding (a drone) to sing against.

## What it does

- **88 keys** (A0 to C8), a part of them on screen. Drag the **scroll bar** at the bottom (marked C1 to C7) to move along. Starts on middle C.
- **Always sideways on phones.** A phone held upright shows the piano sideways by itself, as it looks after turning the phone to the left (no "turn your phone" screen). With auto-rotate on, the phone turns the page itself and both sideways directions work. With rotation lock on, holding the phone the other way turns the piano around by itself where the page may read the motion sensor (Android); iPhone would ask a one-time "Allow motion" question for that, so there a **turn-around button** (⟲) flips it instead *(Claude's pick)*. On computers and tablets the layout fits the window.
- **Key size:** − and + on the bar, from about 7 big to about 17 small white keys across a sideways phone; starts at 12, an octave and a fifth (C to the G above the next C; Drephie, 2026-10-23: 10 was too few). A key is the same size on every screen, so a computer shows more keys.
- **Up to 7 notes at once, or more:** every finger plays its own key, and sliding a finger plays each key it crosses. iPhones track at most 5 fingers at once (iPads more); Ring and Drone let you go past that.
- **Three ways a key sounds** (Diapason's Short, Hold and Latch, renamed). Changing it stops every sound.
  - **Hold** (default): sounds while you hold the key.
  - **Ring:** rings out by itself after you lift, like a piano with the sustain pedal down. Low notes ring longer (about 8 s at C2, 4.5 s at C4, under 3 s at C6, as in Diapason).
  - **Drone:** tap a key to start it, tap again to stop. Drone keys get a dot. Grand Piano and Harp fade by themselves; Pad and Organ hold.
- **Six sounds**, in a dropdown: Grand Piano (the sampled Salamander), Electric Piano, Synth, Pad, Organ, Harp.
- **Chord name** (top left, as in Diapason), for every note that is sounding:
  - one note: its name big with the octave (Do 4), then its other name and pitch (C4 · 261.6 Hz);
  - two notes: the interval, short and in words ("M3", "major 3rd"), and the two notes;
  - three or more: the chord (Cmaj7), plain words ("C major seventh"; "C major, E in the bass" for C/E), the notes (C4 · E4 · G4 · B4), and **Also** with other names for the same notes. Notes with no chord name show "—" and the notes.
  - It lights up when you play and fades over 1.5 s; the last one stays until you play again.
  - Spelled for the chord: B♭ in B♭m, A♯ in F♯. Each chord takes the spelling with the fewest sharps and flats (C♯m, not D♭m; A♭, not G♯).
  - About 40 chord types from Diapason's list: major, minor, diminished, augmented, sus, 6ths, 7ths, 9ths, 11ths, 13ths, add9 and the altered ones.
- **Note names on the keys**, two switches on the bar: **Names** on/off and **Do / C**. Starts on Do Re Mi in Italian and Spanish, C D E in English. Black keys show the sharp name (Do♯), or while pressed the chord's spelling (Re♭). C keys show their octave (Do4); middle C has a mark.
- **Computer keys, on computers only:** A W S E D F T G Y H U J K play an octave from C (small letters on those keys show which), Z and X move it down or up an octave, and holding Space lets notes ring *(Claude's pick)*. Phones and tablets show none of this.
- **Patreon window**, as in the Metronome. While any note sounds (held, ringing or drone) the page counts as in use, so the window never interrupts.

## Not in this version

MIDI keyboard input (Drephie, 2026-10-23: computer keys only; MIDI wouldn't work on iPhone anyway), recording and download, a key setting with scale dots, softer and louder by touch, the pitch monitor (Phase 3, from Diapason's Intonazione), offline and install (Phase 6).

## Layout

**Sideways phone (about 667 × 375), top to bottom; nothing scrolls the page:**
1. Bar: the chord name big on the left, its lines beside it. On the right, two rows: [Sound ▾] [− Keys +] (i) (⚙), and [Hold | Ring | Drone] [Names] [Do]. No title on phones, to give the keys room (like Diapason; *Claude's pick*).
2. The keys, filling the rest.
3. The scroll bar, with "Patreon" and "@drephie" small at its two ends *(Claude's pick)*.

**Computer:** title, About and Settings at the top; the chord name bigger; the controls in one row; the keys as tall as fits (up to about 300 px); scroll bar; footer.

**Settings (⚙):** Theme, Language, Volume (0–100%, starts at 100%) *(Claude's pick)*.
**About (i):** short text as in the Metronome, the Salamander credit, the Patreon button, keyboard tips on computers only.

## Wording (English)

Hold, Ring, Drone; Names; Do / C; Sound; Keys; Also; Interval. About: "Free, open-source music tools by Drephie. No ads, no trackers, nothing uploaded: everything runs in your browser. Piano sound: Salamander Grand Piano by Alexander Holm (CC BY 3.0)." Spanish and Italian come at build time, using Diapason's Italian where it fits (Tieni, Bordone, Nomi).

## Remembered

In this browser only: sound, Hold/Ring/Drone, names on/off, Do/C, key size, where you scrolled, volume, the turn-around, theme and language. Drone notes don't come back after a reload.

## Built on

- `shared/sound.js`: the six sounds and the volume, unchanged. The samples start loading when the page opens, so the first note is ready.
- `shared/theory.js`: gets a chord namer (Diapason's list with the spelling rule above), tested in `tests/theory.html`.
- `shared/ui/`: page parts, windows, dropdowns, translations. Two additions: dropdowns that open the right way when the page is drawn sideways, and piano-key colors for each theme in `themes.css`.
- The hub service worker (`/sw.js`).

## Privacy and credits

Nothing is recorded or uploaded, and there is no microphone. The piano samples (Salamander Grand Piano by Alexander Holm, CC BY 3.0) load from the Tone.js site and are credited in About. The other five sounds are made in the browser.

## How we check it

**Claude:** 5 themes, 3 languages; sideways phones (667 × 375, 844 × 390), upright phones drawn sideways (375 × 667, 390 × 664), and desktop; keyboard only; every window and dropdown; chord names against a list of known chords; `tests/theory.html` and `tests/transport.html`.

**Drephie, by ear and hand on the iPhone:** each of the six sounds low, middle and high; the delay between touching a key and hearing it; 5 fingers at once and sliding; Hold, Ring and Drone; the names of a few chords you know; upright phone shown sideways, then turned both ways; key size; the Spanish and Italian wording.
