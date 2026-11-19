/* jam-machine/band.js: the Jam Machine's band (spec: specs/jam-machine.md).
 * Uses the Tone.js global (14.8.49) and a rack from shared/sound.js for the
 * chords; the drums and the bass are made here from Tone's own synths (no
 * samples, nothing fetched).
 *
 *   const band = createBand(rack)
 *   band.start(source, { onBar, onBeat })
 *     source: functions read again at every bar, so a change is heard from
 *     the next bar: chords(), key(), style(), bpm(), instrument(),
 *     parts() -> { chords|drums|bass: { on, vol 0..100 } }, countIn()
 *     onBar(index, time): a new bar starts (index into chords(); -1 = the
 *     count-in bar); onBeat(beat 0..3, index, time). Both at audio time:
 *     draw with Tone.Draw.schedule(fn, time).
 *   band.stop()      silence at once (held notes released)
 *   band.setVolumes(parts)  the volumes at once (also while stopped)
 *   band.preview(chordNotes, instrument)  one chord, to hear a choice
 *   band.playing()   true between start and stop
 *   band.barEvents(styleId, snapshot) -> [{ part, step, at, dur, ... }]
 *     what one bar plays (for tests: at and dur in beats, swing included)
 *
 * Levels: 80% is each part's normal level; a part's volume follows hearing
 * (gain²). A last limiter at -1 dB on Tone.Destination keeps the three parts
 * together from ever clipping.
 */
import { midiToFreq } from '../shared/theory.js';
import { STYLES } from './styles.js';
import { chordNotes } from './jam.js';

const BASS_NOTE = { r: 0, 8: 12 };

// Everything one bar plays, in beats from the bar's start (swing included).
export function barEvents(styleId, snap) {
  const st = STYLES[styleId], out = [];
  const at = (step) => step / 4 + (st.swing && step % 4 === 2 ? st.swing / 6 : 0);
  const dur = (step, len) => at(step + len) - at(step);
  if (snap.countIn) {
    for (const s of [0, 4, 8, 12]) out.push({ part: 'drums', voice: 'rim', step: s, at: at(s), vel: 0.7 });
    return out;
  }
  const { parts, notes, next } = snap;
  if (parts.drums.on) for (const [voice, hits] of Object.entries(st.drums)) for (const [s, v] of hits) out.push({ part: 'drums', voice, step: s, at: at(s), vel: v });
  if (parts.chords.on) {
    if (st.comp.arp) {
      st.comp.steps.forEach(([s, v], k) => out.push({ part: 'chords', step: s, at: at(s), dur: Math.min(dur(s, 4), 4 - at(s)), vel: v, midis: [notes.upper[k % notes.upper.length]] }));
    } else {
      for (const [s, len, v] of st.comp) out.push({ part: 'chords', step: s, at: at(s), dur: dur(s, len) * 0.92, vel: v, midis: notes.upper });
    }
  }
  if (parts.bass.on) {
    for (const [s, len, n, v] of st.bass) {
      let midi = notes.bass + (BASS_NOTE[n] ?? 0);
      if (n === '5') midi = notes.bass + (notes.fifth ?? 7);
      if (n === '3') midi = notes.bass + (notes.third ?? 4);
      if (n === '6') midi = notes.bass + 9;
      if (n === 'b7') midi = notes.bass + (notes.seventh ?? 10);
      if (n === 'a') { const target = next ? next.bass : notes.bass; midi = target === notes.bass ? notes.bass + 7 : target + (target > notes.bass ? -1 : 1); }
      out.push({ part: 'bass', step: s, at: at(s), dur: dur(s, len) * 0.9, vel: v, midi });
    }
  }
  return out;
}

export function createBand(rack) {
  const limiter = new Tone.Limiter(-1);
  Tone.Destination.chain(limiter);
  const drumBus = new Tone.Volume(0).toDestination();
  const bassBus = new Tone.Volume(0).toDestination();

  const kick = new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 5, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.05 } }).connect(drumBus);
  kick.volume.value = -4;
  const snareFilter = new Tone.Filter(1400, 'highpass').connect(drumBus);
  const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } }).connect(snareFilter);
  snare.volume.value = -12;
  const snareBody = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.02 } }).connect(drumBus);
  snareBody.volume.value = -14;
  const hatFilter = new Tone.Filter(8000, 'highpass').connect(drumBus);
  const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } }).connect(hatFilter);
  hat.volume.value = -16;
  const rim = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 } }).connect(drumBus);
  rim.volume.value = -10;

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { type: 'lowpass', rolloff: -24, Q: 1 },
    envelope: { attack: 0.005, decay: 0.25, sustain: 0.55, release: 0.08 },
    filterEnvelope: { attack: 0.004, decay: 0.18, sustain: 0.35, release: 0.1, baseFrequency: 110, octaves: 2.6 },
  }).connect(bassBus);
  bass.volume.value = -8;

  const hit = {
    kick: (t, v) => kick.triggerAttackRelease('C2', 0.3, t, v),
    snare: (t, v) => { snare.triggerAttackRelease(0.15, t, v); snareBody.triggerAttackRelease('G3', 0.08, t, v); },
    hat: (t, v) => hat.triggerAttackRelease(0.03, t, v),
    rim: (t, v) => rim.triggerAttackRelease('C6', 0.04, t, v),
  };

  const dbOf = (vol) => (vol <= 0 ? -Infinity : 40 * Math.log10(vol / 80));   // gain²: 80% = 0 dB
  function setVolumes(parts) {
    rack.setVolume(Math.min(125, Math.round(parts.chords.vol * 100 / 80)));
    drumBus.volume.value = dbOf(parts.drums.vol);
    bassBus.volume.value = dbOf(parts.bass.vol);
  }

  let repeatId = null, source = null, step = 0, index = -1, snap = null, prevUpper = null, lastInstrument = null;
  function newBar(time) {
    const chords = source.chords(), key = source.key();
    if (step === 0 && source.countIn()) { snap = { countIn: true }; index = -1; return; }   // a bar of sticks, then the first chord
    index = index + 1 >= chords.length || index < 0 ? 0 : index + 1;
    const notes = chordNotes(chords[index], key, prevUpper);
    prevUpper = notes.upper;
    const next = chordNotes(chords[(index + 1) % chords.length], key, notes.upper);
    lastInstrument = source.instrument();
    snap = { style: source.style(), parts: source.parts(), notes, next, instrument: rack.instruments[lastInstrument] || rack.instruments.piano };
    Tone.Transport.bpm.setValueAtTime(source.bpm(), time);
  }
  function tick(time) {
    const s = step % 16;
    if (s === 0) {
      newBar(time);
      const i = index;
      if (source.onBar) Tone.Draw.schedule(() => source.onBar(i), time);
    }
    if (s % 4 === 0 && source.onBeat) { const i = index, b = s / 4; Tone.Draw.schedule(() => source.onBeat(b, i), time); }
    const beat = 60 / Tone.Transport.bpm.value;
    for (const e of barEvents(snap.countIn ? 'pop' : snap.style, snap)) {
      if (e.step !== s) continue;
      const t = time + (e.at - s / 4) * beat;
      if (e.part === 'drums') hit[e.voice](t, e.vel);
      else if (e.part === 'bass') bass.triggerAttackRelease(midiToFreq(e.midi), e.dur * beat, t, e.vel);
      else snap.instrument.triggerAttackRelease(e.midis.map(midiToFreq), e.dur * beat, t, e.vel);
    }
    step++;
  }

  function stop() {
    if (repeatId !== null) Tone.Transport.clear(repeatId);
    repeatId = null;
    Tone.Transport.stop();
    Tone.Draw.cancel(0);
    const now = Tone.now();
    Object.values(rack.instruments).forEach((inst) => { try { inst.releaseAll(now); } catch { /* not playing */ } });
    bass.triggerRelease(now);
    source = null;
  }

  function start(src) {
    stop();
    source = src;
    step = 0; index = -1; prevUpper = null;
    setVolumes(src.parts());
    Tone.Transport.bpm.value = src.bpm();
    repeatId = Tone.Transport.scheduleRepeat((time) => { if (source) tick(time); }, '16n', 0);
    Tone.Transport.start('+0.05');
  }

  function preview(notes, instrument) {
    const inst = rack.instruments[instrument] || rack.instruments.piano;
    inst.triggerAttackRelease(notes.upper.map(midiToFreq), 1.2, Tone.now() + 0.02, 0.7);
  }

  return { start, stop, setVolumes, preview, playing: () => source !== null, barEvents };
}
