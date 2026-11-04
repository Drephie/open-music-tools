# Open Music Tools

Free, open-source music tools that help you learn music and make your own: **https://openmusictools.org**

Made by [Drephie](https://instagram.com/drephie), a singer and vocal coach. The tools never make music for you: no AI-generated music, lyrics or melodies.

## The tools

- **Piano**: play, and see the name of the chord
- **Ear Trainer**: lessons and a game to train your ear (intervals, chords, scale degrees)
- **Metronome**: a steady click to practise with, and tap tempo
- **Vocal Tuner**: sing a note and see if it is too low, too high or in tune
- **Instrument Tuner**: guitar, bass, ukulele, violin, viola and cello, string by string
- **Pitch Detector**: the line your voice draws as you sing
- **Pitch Training**: warm-ups to hear, sing back and see the notes you sang in tune
- **Choordination**: play chords with your hands in front of the camera
- **Chordigits**: count chords on your fingers in front of the camera, tilt for major or minor

Coming later: BPM Finder, Chord Finder, Practice Player and Jam Machine.

## Privacy

Everything runs on your device: nothing is uploaded, no ads, no trackers. The microphone and camera are only used while a tool is on, and what they hear and see is processed on your device and never uploaded. Settings (theme, language, lesson progress) stay in your browser.

## Running it yourself

There is no build step. From this folder run `python3 -m http.server 8000` and open http://localhost:8000/. The microphone, camera and offline mode need `https` or `localhost`.

The tests run in the browser: open the pages in `tests/` (for example http://localhost:8000/tests/theory.html).

## License

The code is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0): you may use, change and share it, and if you put a changed copy online, you share your changes too.

Other people's work used here, under their own licenses:

- Piano sound: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- [Tone.js](https://tonejs.github.io/) 14.8.49, MIT License
- [MediaPipe](https://ai.google.dev/edge/mediapipe) tasks-vision 0.10.3 and its hand and face models, Apache License 2.0
- Fonts: Familjen Grotesk, Rajdhani, Sora, Roundo, Nunito, Archivo, Azeret Mono, JetBrains Mono, Literata, Epilogue, Red Hat Display and Asap, from Fontshare's open-source shelf, SIL Open Font License 1.1 (`shared/fonts/`)

## Support

The tools are free and have no ads. If they help you, you can support them on [Patreon](https://patreon.com/drephie).
