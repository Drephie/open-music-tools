# Chordigits: spec

**Status:** redesign approved by Drephie, 2026-11-04. Drephie's camera test (2026-11-04): the design works; the thumb misfired on I and II, so it now counts only with two or more other fingers; Drephie's re-test: it works. The first version (approved 2026-11-04) was Choordination with a new way to play; Drephie found it looked like Choordination and the donuts useless. This version takes ideas from Eric Wei's Gesture Synth (tilt for major or minor, hand height for the octave, a soft gliding synth) without copying it, and looks like the hub's other tools. Items marked *(Claude's pick)* weren't asked: say if you want them changed.

## What it is for

Play the chords of a song with your hands in front of the camera: one hand counts the chord's number in the key (I to VII), the other tilts for major or minor and adds colour. For singers who accompany themselves, and for learning how chords are numbered in a key.

## What it does

- **Number hand** (right; left with "Left-handed"): how many fingers you hold up is the chord's number in the key. 1 to 5 fingers: I to V, counted any way; the thumb counts only with two or more other fingers (thumb + 2 = III, open hand = V), so a thumb that pops out beside one finger doesn't turn I into II *(after Drephie's camera test, 2026-11-04)*. **🤙** (thumb and little finger) is VI, **🤘** (index and little finger) is VII. A fist, or no hand, is silence. Setting **Six and seven**: or sign language (thumb touches the little finger = VI, the ring finger = VII).
- **Height of the number hand = octave:** hand in the top third of the picture plays an octave higher, the bottom third an octave lower.
- **Other hand, tilt = major or minor:**
  - upright: the chord as the key has it (in C: C, Dm, Em, F, G, Am, B°);
  - tilted to your left: major (D in C); tilted to your right: minor (Fm in C).
  - no hand: as upright.
- **Other hand, fingers = colour:** fist or open hand: the plain chord; 1 finger: 7th; 2: sus4; 3: add9. With tilt: tilted right + 1 finger = minor 7th (Dm7); tilted left + 1 finger = 7th (D7); upright + 1 finger = the key's own 7th (G7 on V, Cmaj7 on I).
- **Playing:** hold the fingers still for about a fifth of a second and the chord sounds; it rings while you hold it. A new chord only once both hands are still. A fist or taking the hand away stops it; close and open to repeat.
- **Dreamy, the new sound** (the default here; also added to the Piano's and Choordination's sound lists): a soft synth, each note three slightly detuned copies of a warm wave, a slow fade-in, a long fade-out, a soft filter and some reverb (our own, built on Gesture Synth's idea). **Glide** (on by default, Dreamy only): each chord slides smoothly into the next. The other sounds stay: piano, electric piano, synth, pad, organ, harp.
- **Without the camera:** tap and hold a number to play it; tap major / minor / as in the key, and plain / 7th / sus4 / add9. Keyboard: 1–7 hold to play, Q W E for as in the key / major / minor, A S D F for plain / 7th / sus4 / add9, Space to sustain *(Claude's pick: holding a number plays, like a keyboard instrument)*. Chromatic (12 notes) only without the camera.
- **Kept from Choordination:** key menu with correct spelling and Do Re Mi, Chord Style (Smooth: the root stays in the bass and the notes above move as little as possible; or Stacked), octave, volume, eyebrow sustain (on, switchable off), recording (audio only or screen + audio, "Record my voice", headphones tip), Salamander credit, Patreon window.

## Not in this version

Choordination's donuts, watermark and Menu button; the "Kinds of chord" list (the tilt and colour fingers replace it); head-tilt one-hand modes; ♭ and ♯ chords by hand height (Drephie didn't pick it); Gesture Synth's tutorial songs, strings and horns.

## Look and layout

Full-screen camera, as in Gesture Synth, in the hub's themes and fonts, with the parts of our other tools on top:
- **Top:** "CHORDIGITS" big, in capitals, on the left, as Choordination's name (Drephie: it shows in the videos people post); on the right the home, record, How to play (?), About and Settings buttons *(Drephie, 2026-11-04: home on the right, a bigger name, no camera button)*.
- **Centre top:** the chord name big in the theme's title font, its number (V7) and notes under it.
- **Next to each hand:** what the camera reads (the number by one hand, ↑ or ↓ for the octave; major / minor / colour by the other).
- **Bottom:** a bar with the seven numbers (I ii iii IV V vi vii°, each with its chord name), lit while playing, and two small rows of choices: as in the key / major / minor, and plain / 7th / sus4 / add9, lit by the hands or tapped. Patreon and @drephie links small under it.
- **The camera starts at once** *(Drephie, 2026-11-04)*. Only if it or the hand tracking fails, a card says what happened, with "Play without the camera" (main button) and "Retry". How to play opens by itself on the first visit, then from the ? button. Until a first tap or key, a line says to tap for sound (browsers start sound only then).
- **Each theme's look on the camera, as in Choordination** *(Drephie, 2026-11-04)*: the picture faded into the page colour and coloured by the theme (Rouge red, Retro CRT green, Monochrome grey, Retrosnap sepia…), inside the theme's frame (Rouge's dark red vignette, Retrosnap's instant-photo border, Monochrome's black bars). Support on Patreon and @drephie sit free in the bottom corners, with no bar.
- **The chord's wave** *(Drephie, 2026-11-04)*: a glowing line across the screen, behind the hands, in the theme's colour: the shape of the notes playing, gliding to the next chord, a calm line when nothing plays (still with reduce motion). The same wave is the art on its home page card.
- **Camera picture** (Settings, shared with Choordination): brightness, contrast, saturation, hue and noise sliders over the theme's colours, and Reset the picture *(Drephie, 2026-11-04)*.
- Phones: sideways, as now (a "turn your phone" screen when upright).

**Settings:** Theme and Language; Musical key; Notation; Sound; Glide; Volume; Octave; Chord style; Hand layout; Six and seven; Eyebrow sustain.

## Wording (English)

How to play: "Right hand: how many fingers = the chord's number. 🤙 is VI, 🤘 is VII. Higher or lower = octave. A fist stops." "Left hand: tilt left for major, right for minor, upright for the key's own chord. 1 finger adds a 7th, 2 a sus4, 3 an add9." "Hold still for a moment to play." Spanish and Italian at build time; Drephie checks them.

## Remembered

Theme and language (hub-wide), sound, glide, six and seven, hand layout *(Claude's pick)*. The rest starts fresh.

## Built on

Its own page on `shared/ui/page.css` and `page.js` (no longer a copy of Choordination's page). `shared/hands.js` (fingers, plus tilt and height, tested), `shared/theory.js` (two more chord kinds: major add9 and minor add9), `shared/sound.js` (Dreamy and glide), MediaPipe hand and face tracking 0.10.3.

## Privacy and credits

Camera and microphone stay on the device. Salamander Grand Piano (CC BY 3.0), MediaPipe (Apache 2.0), Tone.js (MIT). About thanks Eric Wei's Gesture Synth for the ideas *(Claude's pick)*.

## How we check it

**Claude:** tilt, height and fingers on made-up hands; Dreamy's level against the other sounds (no clipping); tap and keyboard play; 7 themes × 3 languages × phone sizes; all test pages.
**Drephie, with the camera and ears:** a hand checklist (counts, 🤙 🤘, tilt both ways, height, colour fingers, both hands at once) and the Dreamy sound with and without glide.
