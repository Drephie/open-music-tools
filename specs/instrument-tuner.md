# Instrument Tuner: spec

**Status:** approved by Drephie, 2026-10-30. Drephie's choices from the questions and two animated prototypes: the vibrating strings look, all four instrument groups, automatic string finding with tap to stay, in tune within 5 cents (Hard mode 2), no sound, and "tighten / loosen" in the words. **Built 2026-10-30**; Drephie's phone test is still to do.
Items marked *(Claude's pick)* weren't asked: say if you want them changed. *(At build time)* marks details settled while building.

## What it is for

Tuning an instrument string by string: pick the instrument and tuning, play a string, and see which string it is, how far off, and which way to turn the peg. For players of any level, no theory needed. The sister of the **Vocal Tuner** (any sung note), split from the first Tuner by Drephie (2026-10-24).

## What it does

- **Pick the instrument and tuning** from one list under the title *(Claude's pick: one list, always on the screen, because switching tunings is common)*:
  - **Guitar:** Standard (E A D G B E), Drop D (D A D G B E), Half step down (E♭ A♭ D♭ G♭ B♭ E♭), DADGAD, Open G (D G D G B D), Open D (D A D F♯ A D).
  - **Bass:** 4 strings (E A D G), 5 strings (B E A D G).
  - **Ukulele:** Standard (G C E A), Low G, Baritone (D G B E).
  - **Violin** (G D A E, also mandolin), **Viola** (C G D A), **Cello** (C G D A, an octave below the viola).
  - **Any note (chromatic):** no strings; it names whatever note you play, for any instrument or tuning not on the list.
- **Start listening** (the slim button at the bottom, as in the Vocal Tuner): the first time, the browser asks for the microphone. It stops by itself when you leave the page for a second.
- **The strings**, drawn down the middle of the screen in the order they sit on the instrument (thickest on the left for guitar and bass), thicker for lower strings *(Claude's pick)*. The string you play **vibrates with your sound's real wave**: smooth and in the accent colour when in tune, jittery when off. While it listens, the other strings tremble faintly with any sound the microphone hears, so you can see it is listening *(Claude's pick)*. Any note (chromatic) shows one string.
- **Which string:** found **automatically** (the string nearest to what you play). If a string is so far off that it is taken for its neighbour, **tap that string's circle to stay on it** (a small lock shows); tap again to go back to automatic.
- **The note** of that string, big, above the strings, with its octave small beside it (**E** ₂). Notes are spelled as the tuning spells them (D♭, not C♯, in half step down), in Do Re Mi or C D E (see Settings). Any note (chromatic) uses one name per note, as in the Vocal Tuner: C♯ E♭ F♯ A♭ B♭.
- **One line of words** with the way to go: "12 cents low · tighten", "8 cents high · loosen", **In tune**; more than half a step away: "Much too low · tighten" (a cent is a hundredth of a half step). Any note (chromatic) says only how far ("12 cents low"), since the instrument may have no strings, and its Italian In tune is "Intonato" (a string is "Accordata") *(at build time)*.
- **The thin line with a dot**, as in the Vocal Tuner: ends half a step away, the in-tune zone in the middle lights up when you are in it.
- **In tune means within 5 cents**, or **2 cents in Hard mode** (Settings). Then the note, the words, the dot and the string light up in the theme's accent colour (never green). In Monochrome they are grey until in tune, then bright white, as in the Vocal Tuner.
- **Tuned strings are marked:** a string's circle fills once it has stayed in tune for half a second, and empties if it is heard off again. When every string is filled, the words say **All strings in tune** *(Claude's pick)*. A short slip doesn't empty a circle: only a second clearly off (more than 10 cents, or twice the in-tune range) does, because a string reads a little sharp just after it is plucked *(at build time)*.
- **The 12th-fret harmonic** (the note an octave above an open string) counts for that string *(Claude's pick; it tested well with made-up sounds)*.
- **A = 440 Hz**, always, as in the Vocal Tuner. The reading moves calmly (no Calm/Quick choice: open strings have no vibrato) and stays a second after the string fades *(Claude's pick)*.
- **Before listening** the strings are shown at rest with "Tap to start, then play"; tapping the strings starts listening too. Listening with nothing heard: "Play a string". The screen is never empty.
- **If the microphone can't start**, the same plain messages as the Vocal Tuner (blocked, not https, no microphone, in use by another app).
- Keeps the phone screen awake while listening. **Keyboard on computers** *(Claude's pick)*: Space starts and stops; the string circles are buttons (Tab, then Enter, to stay on one).
- **Patreon window** as in the other tools; listening counts as use, so it never interrupts tuning.

## Not in this version

Playing the strings' notes to tune by ear (Drephie: later); changing A from 440; your own tunings; more instruments (7-string guitar, banjo, 12-string); a pitch graph (the Pitch Detector); recording; offline and install (Phase 6).

## Layout

**Phone, upright** *(Claude's pick)*. Everything fits one screen of 375 × 667 and 390 × 664, in every theme and language. No boxes or panels.

```
 ⌂  Instrument Tuner        (i) (⚙)
        ( Guitar · Standard ⌄ )

               E ₂
     ┊  ⌇  ┊  ┊  ┊  ┊      the strings; the one you play
     ┊  ⌇  ┊  ┊  ┊  ┊      vibrates with your sound
     ┊  ⌇  ┊  ┊  ┊  ┊
    (E)(A)(D)(G)(B)(E)     tap one to stay on it
       12 cents low · tighten
      ───────●─━┿━───────
          ( Stop )
 Support on Patreon   Designed by @drephie
```

**Computer:** the same, centred, with taller strings.
The Spanish and Italian titles take two lines on phones in the wide fonts (Liquid Glass, Y2K, Monochrome, Soft Pink) *(at build time)*.
**Settings (⚙):** Theme, Language, Note names (Do Re Mi / C D E; follows the language until you choose), In tune within: 5 cents / 2 cents (hard).
**About (i):** the short hub text, the privacy line, the Patreon button, the keyboard tip on computers only.

## Wording (English)

Instrument Tuner (Spanish "Afinador de instrumentos", Italian "Accordatore per strumenti", as on the home page); Start listening, Stop; Tap to start, then play; Play a string; {n} cents low · tighten, {n} cents high · loosen, Much too low · tighten, Much too high · loosen, In tune, All strings in tune. Spanish and Italian come at build time.

## How well it hears (measured with made-up string sounds, since Claude can't hear)

Plucked strings that fade, from a 5-string bass's low B to a violin's E, also through a phone-like microphone that hears little of the lowest notes: within half a cent once the string has rung 0.3 seconds, found 70 to 125 thousandths of a second after the pluck, never an octave off. Every string of every tuning, in tune and 30 cents off, is found and named right. **Real strings read a little sharp just after the pluck** (their upper harmonics are slightly sharp) and settle as they ring: a guitar's low E about 3 cents sharp at half a second, under 1.5 at one second; a bass's low E about 12 cents at half a second, 3 at two seconds; the 5-string low B about 20, then 6. Let a low string ring for a moment before turning the peg. Real instruments and phone microphones still need your ears (see the checklist).

## Remembered

In this browser only: the instrument and tuning, note names, Hard mode, theme and language (the last two for the whole hub). Nothing you play is kept; the tuned marks start fresh each visit.

## Built on

- `shared/pitch.js`: the microphone to a note, with the range set by the instrument (down to 5-string bass's low B, about 31 Hz). New: `setRange`, so changing the instrument while listening doesn't ask for the microphone again *(at build time)*. `nearestNote` and the smoother. Tests: plucked strings in `tests/pitch.html`; the tunings and string finding in `tests/instrument-tuner.html` (both also from the terminal).
- `shared/theory.js` for the note names; `shared/ui/` for the page, windows, dropdowns, themes and translations. The Vocal Tuner's drawn ♯ and ♭ move to `shared/ui/accidentals.js`, and its wave cutting to `shared/wave.js`, so both tuners use them. No Tone.js: it makes no sound.
- **Home page:** the greyed "Instrument Tuner" card becomes live, after the Vocal Tuner. The hub service worker (`/sw.js`).

## Privacy and credits

"The microphone's sound is analysed on your device as it comes in, then thrown away: nothing is recorded, kept or uploaded." No third-party sounds, samples, fonts or models.

## How we check it

**Claude:** made-up string sounds whose pitch is known (a plucked tone that fades, with harmonics, and phone-like weak low notes) through the engine; in the browser, test tones in place of the microphone: every string of every tuning, in tune, low, high, very far off, a string taken for its neighbour, tap to stay, the 12th-fret harmonic, silence and noise; 5 themes, 3 languages, 375 × 667, 390 × 664 and desktop; keyboard only; settings after a reload.

**Drephie, on the phone** (home Wi-Fi https link): tune a real guitar string by string (does it find each string, and do "tighten / loosen" and In tune agree with your ear?); a string tuned far off on purpose, then tap to stay; drop D and one open tuning; a bass or a ukulele if you have one; a quiet room stays still; the Spanish and Italian wording.
