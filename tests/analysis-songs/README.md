# Test songs for the analysis trial (not published)

The audio files here are ignored by git (see `.gitignore`); only this note is kept.

- **GuitarSet** clips (Xi, Bittner, Pauwels, Ye, Bello: "GuitarSet: a dataset for guitar transcription", ISMIR 2018; CC BY 4.0, https://zenodo.org/records/3371780): six `*_comp_mic.wav` accompaniment takes, read out of `audio_mono-mic.zip` and `annotation.zip`. Their chords, key and tempo, from the `.jams` annotations, are in `guitarset.json`. The tempo is in each file's name (the players played with a click).
- **Band songs** recorded from the Jam Machine's own band by `tests/analysis-trial/make-band-songs.html` (with `tests/tools/song-server.py`, launch config `song-server`): exact chords, key (one key change) and BPM in `band.json`.

The trial page is `tests/analysis-trial/index.html`.
