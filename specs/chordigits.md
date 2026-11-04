# Chordigits: spec

**Status:** approved by Drephie, 2026-11-04.
A second hand-tracking chord instrument, built from Choordination: same look, sounds, settings, recording and windows; only the name and the way you play change. How it looks different from Choordination comes later (Drephie). Items marked *(Claude's pick)* weren't asked: say if you want them changed.

## What it is for

Play the chords of a song by counting them on your fingers, the way bands call chords with the number system: one hand shows the chord's number in the key (I to VII), the other hand can change it to major, minor, a 7th and so on. For singers who accompany themselves, and for learning how chords are numbered in a key.

## What it does

- **Number hand** (your right hand; the left with Hand Layout "Left-Handed"): how many fingers you hold up is the chord's number in the key. Any fingers count, thumb included, so you can count your own way.
  - 1 to 5 fingers: I to V (an open hand is V).
  - **VI: 🤙** thumb and little finger out, the other three folded.
  - **VII: 🤘** index and little finger up, middle and ring folded; the thumb tucked in or sticking out.
  - Any other two fingers are II.
  - **Fist**, or no hand in view: silence.
  - Setting **Six and seven**: "🤙 and 🤘" (default) or "Sign language" (as in American Sign Language: thumb touches the little finger = VI, thumb touches the ring finger = VII, the other three fingers up). With sign language, show III without the thumb holding the little finger, or it reads as VI.
- **Chord-type hand** (the other hand): how many fingers it shows.
  - Fist, or no hand in view: the chord as the key has it (in C major: C, Dm, Em, F, G, Am, B°). So one hand alone plays the whole key.
  - 1 finger: major. 2: minor. 3: 7th (the key's own kind: G7 on V in C). 4: sus4. 5: add9.
  - The list is Choordination's **Chord Modifiers** window: tick other types and the fingers follow the ticked order (fist = the first, 5 fingers = the sixth). Ticked: Triad (Auto), Major, Minor, 7th (Auto), Sus4, Add9.
- **Playing:** hold a count still for about a fifth of a second and the chord sounds; it rings while you keep holding it. Change fingers for the next chord (the same short hold, so passing through other counts on the way plays nothing). A fist or taking the hand away stops it. To play the same chord again, close the hand and open it again.
- **Next to each hand**, what the camera reads: the number (IV) by the number hand, the count by the type hand *(Claude's pick: so you can see what it understood)*.
- **Numbers on screen, theory style:** capitals for major, small for minor, ° for diminished: I ii iii IV V vi vii° in a major key, i ii° III iv v VI VII in a minor key. When the type hand changes the chord, the number changes with it (II for D major in C, V7 for G7).
- **Kept from Choordination, unchanged:** the key menu with correct spelling and Do Re Mi; the six sounds; Volume; Octave; Chord Style (Smooth: the lowest note is always the chord's root, and the notes above it move as little as possible from one chord to the next; or Stacked); the chord name and its notes at the top; eyebrow sustain (raise your eyebrows to let chords ring), on by default and switchable off, and Space to sustain; the two on-screen panels (Donut, Pill or Grid, movable and resizable), which now show the numbers and chord types, the current ones lit; Hand Layout; recording (audio only or screen + audio, "Record my voice", the headphones tip); welcome and How to play windows; About with the Salamander piano credit; Patreon window; theme and language shared with the hub; the "turn your phone" screen.
- **Keyboard mode** as in Choordination: 1–7 pick the number, Q–I the chord type, Enter (or a click) plays, Space sustains.
- **Touch pads** as in Choordination: number pads (with the chord name) and chord-type pads, SUSTAIN latch.
- **Chromatic** (all 12 notes) stays in the key menu for keyboard and touch modes, up to 0, - and = as in Choordination. Fingers only count inside a key, so choosing two-hand mode while on Chromatic goes back to C major *(Claude's pick)*.

## Not in this version

Choordination's one-hand + head-tilt modes and "Hands-Free (Coming Soon)" (Drephie: two-hand mode for now). Picking a chord by where your hand is (Choordination's way). Flat chords like ♭VII (only through Chromatic). A new look (later). Offline and install (Phase 6).

## Controls

As in Choordination's Settings, in the same order: Language, Notation, Musical Key, Chord Style, Chord Modifiers…, Instrument, Volume, Octave, Accessibility (Two-Handed Mode, Keyboard Only, Touch Pads), **Six and seven** (new), Left Shape, Right Shape, Hand Layout, Eyebrow Sustain, Theme, Home, Move and resize the controls…

## Layout

Choordination's page: the camera picture fills the screen, the two panels left and right, the chord name at the top, the menu buttons top right, the watermark (CHORDIGITS) and footer links at the bottom. Phones: sideways, as Choordination.

## Wording (English)

Title "Chordigits". How to play, two hands: "Right hand: how many fingers = the chord's number in the key (I to VII). 🤙 is VI, 🤘 is VII. A fist stops." "Left hand: changes the chord. Fist: the key's own chord. 1 finger: major, 2: minor, 3: 7th, 4: sus4, 5: add9." "Hold your fingers still for a moment to play." Spanish and Italian come at build time; Drephie checks them.

## Remembered

As in Choordination: theme and language (hub-wide), panel shapes and placement; plus Six and seven *(Claude's pick)*. Everything else starts fresh.

## Built on

- A copy of Choordination's page (its own folder, `chordigits/`). Choordination itself doesn't change.
- New `shared/hands.js`: reads raised fingers, 🤙, 🤘 and the sign-language 6 and 7 from the camera's hand points, with a short steadiness hold so the count doesn't flicker. Pure code, tested without a camera.
- `shared/theory.js` (keys, spelling, chords, smooth chords), `shared/sound.js`, `shared/ui/*`, the hub service worker. MediaPipe hand and face tracking 0.10.3, as in Choordination.

## Privacy and credits

Camera and microphone stay on the device, as in Choordination; nothing is uploaded. Credits as in Choordination: Salamander Grand Piano (CC BY 3.0), MediaPipe (Apache 2.0), Tone.js (MIT).

## How we check it

**Claude:** finger reading tested on made-up hands with known answers (`tests/hands.html`, also from the terminal): every count, 🤙, 🤘, sign-language 6 and 7, hands turned, tilted, near and far, half-bent fingers, and no flicker between counts. Keyboard and touch modes in 7 themes, 3 languages, phone width and desktop; all existing test pages still pass.

**Drephie, with the camera:** a hand-test checklist (each count on each hand, 🤙 and 🤘, the switch to sign language, changing chords quickly, fist to stop, eyebrow sustain, left-handed layout, a few songs' progressions), and listening to the chords in a few keys.
