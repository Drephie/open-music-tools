/* jam-machine/band.js: the Jam Machine's band (spec: specs/jam-machine.md).
 * Uses the Tone.js global (14.8.49) and a rack from shared/sound.js for the
 * chords. Two drum kits: 'acoustic', six recorded hits in ./drums/ (from
 * Virtuosity Drums by Versilian Studios and Karoryfer Samples, CC0; loaded
 * from our own files), and 'synth', made here from Tone's own synths (each
 * drum its own synth, so two drums can sound at the same moment). Until the
 * acoustic kit has loaded, the synth drums play. The bass is a Tone synth.
 *
 *   const band = createBand(rack)
 *   band.start(source)
 *     source: functions read again as the music goes, so a change is heard
 *     from the next chord (chords, sounds) or the next bar (style, time
 *     signature, speed): chords(), key(), style(), meter(), bpm(),
 *     instrument(), kit(), parts() -> { chords|drums|bass: { on, vol } },
 *     countIn(); onChord(index): a chord starts (index into chords(); -1 =
 *     the count-in bar); onBeat(beat, index): each beat of it (0 = its
 *     first). Both are drawn in time with the sound (Tone.Draw).
 *   band.stop()      silence at once (held notes released)
 *   band.setVolumes(parts)  the volumes at once (also while stopped)
 *   band.preview(chordNotes, instrument)  one chord, to hear a choice
 *   band.playing()   true between start and stop
 *
 *   stepEvents(ctx) -> what one 16th-note step plays (pure; for tests)
 *     ctx: { pattern (styles.js patternFor), spb, barStep, stepInChord,
 *     chordSteps, notes, next, parts }. Events: { part, voice?, at, dur?,
 *     vel, midis? | midi? }, at and dur in steps from this step (swing
 *     included). Pattern hits play the chord sounding now, cut off where it
 *     ends; a chord that starts between the pattern's hits is played (and its
 *     root in the bass) right where it starts.
 *
 * Levels: 80% is each part's normal level; a part's volume follows hearing
 * (gain²). A last limiter at -1 dB on Tone.Destination keeps the three parts
 * together from ever clipping.
 */
import { midiToFreq } from '../shared/theory.js';
import { METERS, patternFor } from './styles.js';
import { chordNotes, chordBeats } from './jam.js';

function bassMidi(n, notes, next) {
  const b = notes.bass;
  if (n === '5') return b + (notes.fifth ?? 7);
  if (n === '3') return b + (notes.third ?? 4);
  if (n === '6') return b + 9;
  if (n === 'b7') return b + (notes.seventh ?? 10);
  if (n === '8') return b + 12;
  if (n === 'a') { const target = next ? next.bass : b; return target === b ? b + 7 : target + (target > b ? -1 : 1); }
  return b;
}

export function stepEvents({ pattern, spb, barStep, stepInChord, chordSteps, notes, next, parts }) {
  const out = [];
  const swing = spb === 4 && pattern.swing ? pattern.swing : 0;
  // Swung 8ths: the off-beat 8th (step 2 of each beat) comes later. Positions in steps from the bar's start.
  const pos = (s) => s + (swing && s % 4 === 2 ? (swing * 4) / 6 : 0);
  const at = (s) => pos(s) - barStep;
  const left = chordSteps - stepInChord;   // steps until this chord ends
  const span = (s, len) => Math.min(pos(s + len) - pos(s), left - at(s));
  const starts = stepInChord === 0;

  if (parts.drums.on) for (const [voice, hits] of Object.entries(pattern.drums)) for (const [s, v] of hits) if (s === barStep) out.push({ part: 'drums', voice, at: at(s), vel: v });

  if (parts.chords.on) {
    if (pattern.comp.arp) {
      pattern.comp.steps.forEach(([s, v], k) => {
        if (s === barStep) out.push({ part: 'chords', at: at(s), dur: Math.min(spb * 1.5, left - at(s)), vel: v, midis: [notes.upper[k % notes.upper.length]] });
      });
      if (starts && !pattern.comp.steps.some(([s]) => s === barStep)) out.push({ part: 'chords', at: 0, dur: Math.min(spb, left), vel: 0.6, midis: [notes.upper[0]] });
    } else {
      const hit = pattern.comp.find(([s]) => s === barStep);
      if (hit) out.push({ part: 'chords', at: at(hit[0]), dur: span(hit[0], hit[1]) * 0.92, vel: hit[2], midis: notes.upper });
      else if (starts) out.push({ part: 'chords', at: 0, dur: Math.min(left, spb * 2) * 0.92, vel: 0.65, midis: notes.upper });
    }
  }
  if (parts.bass.on) {
    const hit = pattern.bass.find(([s]) => s === barStep);
    if (hit) out.push({ part: 'bass', at: at(hit[0]), dur: span(hit[0], hit[1]) * 0.9, vel: hit[3], midi: starts ? notes.bass : bassMidi(hit[2], notes, next) });
    else if (starts) out.push({ part: 'bass', at: 0, dur: Math.min(left, spb * 2) * 0.9, vel: 0.8, midi: notes.bass });
  }
  return out.filter((e) => e.dur === undefined || e.dur > 0.2);
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
  const rideFilter = new Tone.Filter(5200, 'bandpass').connect(drumBus);
  const ride = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.32, sustain: 0 } }).connect(rideFilter);
  ride.volume.value = -9;
  const rim = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 } }).connect(drumBus);
  rim.volume.value = -10;

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { type: 'lowpass', rolloff: -24, Q: 1 },
    envelope: { attack: 0.005, decay: 0.25, sustain: 0.55, release: 0.08 },
    filterEnvelope: { attack: 0.004, decay: 0.18, sustain: 0.35, release: 0.1, baseFrequency: 110, octaves: 2.6 },
  }).connect(bassBus);
  bass.volume.value = -8;

  // The acoustic kit: one recorded hit per drum, louder or softer with the velocity.
  const KIT_NOTE = { kick: 'C2', snare: 'D2', rim: 'C#2', hat: 'F#2', open: 'A#2', ride: 'D#3' };
  const KIT_GAIN = { kick: 1, snare: 0.7, rim: 0.55, hat: 0.4, open: 0.35, ride: 0.42 };
  const acoustic = new Tone.Sampler({
    urls: { C2: 'kick.wav', D2: 'snare.wav', 'C#2': 'rim.wav', 'F#2': 'hat.wav', 'A#2': 'hat-open.wav', 'D#3': 'ride.wav' },
    baseUrl: new URL('drums/', import.meta.url).href,
    release: 0.3,
  }).connect(drumBus);
  // A synth can't start twice at the same moment: a second hit is skipped, the music never stops.
  const safe = (fn) => (t, v) => { try { fn(t, v); } catch { /* two hits at once on one synth */ } };
  const hit = {
    kick: safe((t, v) => kick.triggerAttackRelease('C2', 0.3, t, v)),
    snare: safe((t, v) => { snare.triggerAttackRelease(0.15, t, v); snareBody.triggerAttackRelease('G3', 0.08, t, v); }),
    hat: safe((t, v) => hat.triggerAttackRelease(0.03, t, v)),
    open: safe((t, v) => hat.triggerAttackRelease(0.2, t, v)),
    ride: safe((t, v) => ride.triggerAttackRelease(0.3, t, v)),
    rim: safe((t, v) => rim.triggerAttackRelease('C6', 0.04, t, v)),
  };

  const dbOf = (vol) => (vol <= 0 ? -Infinity : 40 * Math.log10(vol / 80));   // gain²: 80% = 0 dB
  function setVolumes(parts) {
    rack.setVolume(Math.min(125, Math.round(parts.chords.vol * 100 / 80)));
    drumBus.volume.value = dbOf(parts.drums.vol);
    bassBus.volume.value = dbOf(parts.bass.vol);
  }

  // The song moves one 16th note at a time. A chord lasts its beats; the drums
  // keep their own bars, so a 2-beat chord doesn't upset the beat.
  let repeatId = null, source = null, bar = null, barStep = 0, counting = false;
  let index = -1, stepInChord = 0, chord = null, prevUpper = null;
  function newBar(time) {
    const meter = METERS[source.meter()] ? source.meter() : '4/4';
    bar = { meter, ...METERS[meter], pattern: patternFor(source.style(), meter), parts: source.parts(), kit: source.kit() };
    // The speed counts beats; Tone counts quarter notes (a 6/8 beat is a dotted quarter).
    Tone.Transport.bpm.setValueAtTime(source.bpm() * bar.spb / 4, time);
  }
  function newChord() {
    const chords = source.chords(), key = source.key();
    index = index + 1 >= chords.length || index < 0 ? 0 : index + 1;
    const notes = chordNotes(chords[index], key, prevUpper);
    prevUpper = notes.upper;
    chord = {
      notes, steps: chordBeats(chords[index], bar.meter) * bar.spb,
      next: chordNotes(chords[(index + 1) % chords.length], key, notes.upper),
      instrument: rack.instruments[source.instrument()] || rack.instruments.piano,
    };
    stepInChord = 0;
  }
  function tick(time) {
    if (barStep === 0) newBar(time);
    const stepTime = 60 / Tone.Transport.bpm.value / 4;
    if (counting) {   // a bar of drum sticks on the beats, then the first chord
      if (barStep % bar.spb === 0) hit.rim(time, 0.7);
    } else {
      if (!chord || stepInChord >= chord.steps) {
        newChord();
        const i = index;
        if (source.onChord) Tone.Draw.schedule(() => source.onChord(i), time);
      }
      if (stepInChord % bar.spb === 0 && source.onBeat) { const i = index, b = stepInChord / bar.spb; Tone.Draw.schedule(() => source.onBeat(b, i), time); }
      const events = stepEvents({ pattern: bar.pattern, spb: bar.spb, barStep, stepInChord, chordSteps: chord.steps, notes: chord.notes, next: chord.next, parts: bar.parts });
      for (const e of events) {
        const t = time + e.at * stepTime;
        if (e.part === 'drums') {
          if (bar.kit === 'acoustic' && acoustic.loaded) acoustic.triggerAttack(KIT_NOTE[e.voice], t, e.vel * KIT_GAIN[e.voice]);
          else hit[e.voice](t, e.vel);
        } else if (e.part === 'bass') bass.triggerAttackRelease(midiToFreq(e.midi), e.dur * stepTime, t, e.vel);
        else chord.instrument.triggerAttackRelease(e.midis.map(midiToFreq), e.dur * stepTime, t, e.vel);
      }
      stepInChord++;
    }
    barStep++;
    if (barStep >= bar.beats * bar.spb) { barStep = 0; counting = false; }
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
    barStep = 0; index = -1; chord = null; prevUpper = null;
    counting = !!src.countIn();
    if (counting && src.onChord) src.onChord(-1);
    setVolumes(src.parts());
    const meter = METERS[src.meter()] || METERS['4/4'];
    Tone.Transport.bpm.value = src.bpm() * meter.spb / 4;
    repeatId = Tone.Transport.scheduleRepeat((time) => { if (source) tick(time); }, '16n', 0);
    Tone.Transport.start('+0.05');
  }

  function preview(notes, instrument) {
    const inst = rack.instruments[instrument] || rack.instruments.piano;
    inst.triggerAttackRelease(notes.upper.map(midiToFreq), 1.2, Tone.now() + 0.02, 0.7);
  }

  return { start, stop, setVolumes, preview, playing: () => source !== null };
}
