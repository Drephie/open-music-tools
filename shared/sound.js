/* shared/sound.js: the instrument rack. Uses the Tone.js global (14.8.49).
 *
 *   await startAudio()   Tone.start() plus a 20 ms scheduling look-ahead.
 *                        Call it from a user gesture (click, tap, key).
 *   const rack = await createRack({ onSamplesLoading })
 *     Builds the chain and waits for the piano samples. onSamplesLoading()
 *     is called just before that wait (to show a loading message).
 *     rack.instruments  { piano, epiano, esynth, pad, organ, harp }: Tone
 *                       instruments; play with triggerAttack(freqs, time),
 *                       triggerRelease(freqs, time), releaseAll(time).
 *     rack.master       the final Tone.Volume (connect recorders to it)
 *     rack.setVolume(percent)  0..125; 0 mutes. Strings are parsed; junk -> 100.
 *     rack.dispose()
 *     If building fails, everything built so far is disposed and the error
 *     is rethrown, so calling createRack again is safe.
 *   INSTRUMENTS   the rack's ids in menu order
 *   LOOK_AHEAD    0.02 (seconds)
 *
 * Chain: instruments -> Reverb -> Compressor -> Limiter -> master Volume ->
 * speakers. The -3 dB limiter ceiling leaves headroom for the +1.9 dB max
 * master volume (125%), so full volume can never clip the output.
 * The piano is the Salamander Grand Piano (Alexander Holm, CC BY 3.0):
 * credit it in any tool that uses the rack.
 */

export const INSTRUMENTS = ['piano', 'epiano', 'esynth', 'pad', 'organ', 'harp'];

// Tone's default 100 ms scheduling look-ahead makes gestures feel laggy;
// 20 ms keeps scheduling stable while making pinch->sound near-instant.
export const LOOK_AHEAD = 0.02;

export async function startAudio() {
  await Tone.start();
  Tone.getContext().lookAhead = LOOK_AHEAD;
}

export async function createRack({ onSamplesLoading } = {}) {
  let instruments = {};
  let masterVolume = null, limiter = null, compressor = null, reverb = null;
  let padFilter = null, synthFilter = null, organVibrato = null;

  const rack = {
    get instruments() { return instruments; },
    get master() { return masterVolume; },
    setVolume(value) {
      if (!masterVolume) return;
      let pct = parseInt(value, 10);
      if (isNaN(pct)) pct = 100;
      pct = Math.max(0, Math.min(125, pct));
      if (pct === 0) {
        masterVolume.mute = true;
      } else {
        masterVolume.mute = false;
        masterVolume.volume.value = Tone.gainToDb(pct / 100);
      }
    },
    dispose() {
      [...Object.values(instruments), padFilter, synthFilter, organVibrato, reverb, compressor, limiter, masterVolume].forEach(n => {
        try { if (n) n.dispose(); } catch { /* already disposed */ }
      });
      instruments = {};
      masterVolume = limiter = compressor = reverb = padFilter = synthFilter = organVibrato = null;
    },
  };

  try {
    masterVolume = new Tone.Volume(0).toDestination();
    limiter = new Tone.Limiter(-3).connect(masterVolume);
    compressor = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.005, release: 0.25 }).connect(limiter);
    reverb = new Tone.Reverb({ decay: 2.2, preDelay: 0.02, wet: 0.28 }).connect(compressor);
    await reverb.ready;

    padFilter = new Tone.Filter(2400, 'lowpass').connect(reverb);
    synthFilter = new Tone.Filter(1700, 'lowpass').connect(reverb);

    // Salamander grand, sampled every 3 semitones across C2-C6 (17 files, ~2 MB).
    const pianoUrls = {};
    for (const oct of [2, 3, 4, 5]) {
      pianoUrls['C' + oct] = 'C' + oct + '.mp3';
      pianoUrls['D#' + oct] = 'Ds' + oct + '.mp3';
      pianoUrls['F#' + oct] = 'Fs' + oct + '.mp3';
      pianoUrls['A' + oct] = 'A' + oct + '.mp3';
    }
    pianoUrls['C6'] = 'C6.mp3';

    instruments = {
      piano: new Tone.Sampler({
        urls: pianoUrls,
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
        release: 1.2
      }).connect(reverb),
      // Rhodes-style FM electric piano
      epiano: new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 12,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.004, decay: 1.4, sustain: 0.35, release: 0.8 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.05, release: 0.4 }
      }).connect(reverb),
      esynth: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
        envelope: { attack: 0.015, decay: 0.35, sustain: 0.5, release: 0.7 }
      }).connect(synthFilter),
      pad: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsine', count: 3, spread: 24 },
        envelope: { attack: 0.5, decay: 0.6, sustain: 0.8, release: 2.4 }
      }).connect(padFilter),
      // Drawbar-style additive organ with gentle vibrato
      organ: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'custom', partials: [1, 0.7, 0.45, 0.3, 0.15, 0.1] },
        envelope: { attack: 0.04, decay: 0.2, sustain: 0.9, release: 0.35 }
      }).connect(organVibrato = new Tone.Vibrato(5.5, 0.08).connect(reverb)),
      // Plucked FM harp: bell-like attack, no sustain, long shimmering tail
      harp: new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 1.8, sustain: 0, release: 1.6 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 }
      }).connect(reverb)
    };
    // Level-match the rack
    instruments.piano.volume.value = -1;
    instruments.epiano.volume.value = -7;
    instruments.esynth.volume.value = -14;
    instruments.pad.volume.value = -9;
    instruments.organ.volume.value = -12;
    instruments.harp.volume.value = -6;

    if (onSamplesLoading) onSamplesLoading();
    await Tone.loaded();
  } catch (err) {
    rack.dispose();
    throw err;
  }
  return rack;
}
