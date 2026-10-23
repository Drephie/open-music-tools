/* shared/transport.js: metronome and tempo on Tone.Transport (Tone.js global).
 *
 *   clampBpm(v)       40..240; NaN -> 100
 *   CLICK_SOUNDS      ['click', 'beep', 'wood', 'hat']
 *   createClicks()    the four metronome sounds, routed straight to the
 *                     speakers (not through a rack's master volume, so they
 *                     are heard but stay out of recordings)
 *     clicks.play(sound, time, level = 'normal')
 *       level 'strong' (higher/louder, for accents), 'normal', or 'soft' (for
 *       in-between clicks). Unknown sounds play 'click'.
 *     clicks.setVolume(gain)   0..2 (the Metronome's 0..200%). 1 = the loudest
 *       clean level (strong clicks peak near 0.8). Below 1 the level follows
 *       hearing (gain², so 0.5 sounds about half as loud); 0 = silent. Above 1
 *       the clicks are pushed up to +12 dB into a soft limiter: fuller and
 *       louder, a little rougher, and never past 0.95, so nothing clips.
 *     clicks.dispose()
 *   startMetronome(clicks, { enabled, sound, beatsPerBar, accents, subdivision, onBeat })
 *     A Tone.Loop on Tone.Transport from 0, 12 steps per quarter-note beat so
 *     in-between clicks follow tempo changes (returned; call .dispose() to
 *     remove it). Every option is read again on each beat or in-between
 *     click, so changes apply from the next one:
 *       enabled()      false = no sound (beats are still counted and reported)
 *       sound()        one of CLICK_SOUNDS
 *       beatsPerBar    a number or a function (default 4). When it shrinks
 *                      below the current beat, the next beat starts a new bar.
 *       accents()      one level per beat: 'strong' | 'normal' | 'silent';
 *                      missing entries are 'normal'. Default: beat 1 strong.
 *       subdivision()  clicks per beat, 1..4 (default 1). The in-between clicks
 *                      play 'soft', also after a silent beat.
 *       onBeat(beat, time, level)   for each beat (0 = downbeat) at its audio
 *                      time, ahead of time: draw with Tone.Draw.schedule(fn, time).
 *     Bars are counted from the Transport position, so stopping the Transport
 *     (which rewinds it to 0) and starting again begins a new bar.
 *     Start, stop and set the tempo with Tone.Transport itself
 *     (Tone.Transport.bpm.value = clampBpm(x)).
 *   countIn(clicks, sound, startTime, beats = 4)
 *     schedules one bar of clicks at the current tempo from startTime and
 *     returns the time the bar after it starts (start the Transport there).
 *   beatAt(time, beatsPerBar = 4), currentBeat(beatsPerBar = 4)
 *     beat index within the bar (0 = downbeat) at a time / right now, counted
 *     from Transport position 0 with a fixed bar length.
 *   createTapTempo({ resetAfterMs = 2500, maxTaps = 5 })
 *     .tap(nowMs = performance.now()) -> BPM averaged over the last taps
 *     (clamped), or null until there are two taps. A pause longer than
 *     resetAfterMs starts over. .reset()
 *   TEMPO_MARKINGS, tempoMarking(bpm)
 *     the Italian tempo word for a speed: Largo 40-59, Larghetto 60-65,
 *     Adagio 66-75, Andante 76-107, Moderato 108-119, Allegro 120-167,
 *     Presto 168-199, Prestissimo 200-240 (bpm is clamped first).
 */

export const clampBpm = (v) => Math.max(40, Math.min(240, isNaN(v) ? 100 : v));

export const CLICK_SOUNDS = ['click', 'beep', 'wood', 'hat'];

const BASE_DB = -2;     // the clean maximum (was -8 dB before 2026-10-23: too quiet on phones)
const BOOST_DB = 12;   // how far 200% pushes into the limiter
const XMAX = 4;        // the largest signal the limiter is built for (10^(12/20))
const KNEE = 0.7, CEILING = 0.95;
// Straight up to KNEE, then a smooth bend that never reaches CEILING.
const softLimit = (x) => {
  const a = Math.abs(x);
  return a <= KNEE ? x : Math.sign(x) * (KNEE + (CEILING - KNEE) * Math.tanh((a - KNEE) / (CEILING - KNEE)));
};

export function createClicks() {
  // synths -> metVol (clean maximum) -> fader (0..1) -> driveIn (boost, scaled into
  // the shaper's -1..1 input) -> soft limiter -> speakers
  const shaper = new Tone.WaveShaper((u) => softLimit(u * XMAX), 8193).toDestination();
  // No oversampling: its smoothing filter overshoots on noise clicks (peaks up to 1.24).
  shaper.oversample = 'none';
  const driveIn = new Tone.Gain(1 / XMAX).connect(shaper);
  const fader = new Tone.Gain(1).connect(driveIn);
  const metVol = new Tone.Volume(BASE_DB).connect(fader);
  const hatFilter = new Tone.Filter(8000, 'highpass').connect(metVol);
  const metSynths = {
    click: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 } }).connect(metVol),
    beep: new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 } }).connect(metVol),
    wood: new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.06, sustain: 0 } }).connect(metVol),
    hat: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(hatFilter),
  };
  return {
    play(sound, time, level = 'normal') {
      const strong = level === 'strong', soft = level === 'soft';
      switch (sound) {
        case 'beep': metSynths.beep.triggerAttackRelease(strong ? 'E6' : 'A5', 0.05, time, soft ? 0.55 : 1); break;
        case 'wood': metSynths.wood.triggerAttackRelease(strong ? 'A4' : 'E4', 0.05, time, soft ? 0.55 : 1); break;
        // The hi-hat's filtered noise peaks higher, so it sits lower to stay clean at 100%.
        case 'hat': metSynths.hat.triggerAttackRelease(0.03, time, strong ? 0.6 : soft ? 0.2 : 0.35); break;
        default: metSynths.click.triggerAttackRelease(0.02, time, strong ? 1 : soft ? 0.3 : 0.55);
      }
    },
    setVolume(gain) {
      const g = Math.max(0, Math.min(2, Number(gain) || 0));
      fader.gain.value = g >= 1 ? 1 : g * g;
      driveIn.gain.value = (g > 1 ? Math.pow(10, ((g - 1) * BOOST_DB) / 20) : 1) / XMAX;
    },
    dispose() {
      [...Object.values(metSynths), hatFilter, metVol, fader, driveIn, shaper].forEach(n => {
        try { if (n) n.dispose(); } catch { /* already disposed */ }
      });
    },
  };
}

export const beatAt = (time, beatsPerBar = 4) =>
  Math.floor(Tone.Transport.getTicksAtTime(time) / Tone.Transport.PPQ) % beatsPerBar;
export const currentBeat = (beatsPerBar = 4) =>
  Math.floor(Tone.Transport.ticks / Tone.Transport.PPQ) % beatsPerBar;

export function startMetronome(clicks, {
  enabled = () => true, sound = () => 'click', beatsPerBar = 4,
  accents = () => ['strong'], subdivision = () => 1, onBeat = null,
} = {}) {
  const STEPS = 12;          // per beat: divisible by 1, 2, 3 and 4
  let barStart = 0;          // Transport beat number where the current bar began
  let lastBeat = Infinity;   // so the first beat (or a rewind) starts a bar
  const metTick = (time) => {
    const step = Math.round(Tone.Transport.getTicksAtTime(time) / (Tone.Transport.PPQ / STEPS));
    const inBeat = step % STEPS;
    if (inBeat !== 0) {
      const sub = Math.max(1, Math.min(4, Math.round(subdivision()) || 1));
      if (inBeat % (STEPS / sub) === 0 && enabled()) clicks.play(sound(), time, 'soft');
      return;
    }
    const total = step / STEPS;
    const bpb = Math.max(1, Math.round(typeof beatsPerBar === 'function' ? beatsPerBar() : beatsPerBar) || 1);
    if (total <= lastBeat || total - barStart >= bpb) barStart = total;
    lastBeat = total;
    const beat = total - barStart;
    const level = accents()[beat] || 'normal';
    if (level !== 'silent' && enabled()) clicks.play(sound(), time, level);
    if (onBeat) onBeat(beat, time, level);
  };
  return new Tone.Loop(metTick, `${Tone.Transport.PPQ / STEPS}i`).start(0);
}

export function countIn(clicks, sound, startTime, beats = 4) {
  const beatSec = 60 / Tone.Transport.bpm.value;
  for (let k = 0; k < beats; k++) clicks.play(sound, startTime + k * beatSec, k === 0 ? 'strong' : 'normal');
  return startTime + beats * beatSec;
}

export function createTapTempo({ resetAfterMs = 2500, maxTaps = 5 } = {}) {
  const tapTimes = [];
  return {
    tap(nowMs = performance.now()) {
      if (tapTimes.length && nowMs - tapTimes[tapTimes.length - 1] > resetAfterMs) tapTimes.length = 0;
      tapTimes.push(nowMs);
      if (tapTimes.length > maxTaps) tapTimes.shift();
      if (tapTimes.length < 2) return null;
      const gaps = [];
      for (let i = 1; i < tapTimes.length; i++) gaps.push(tapTimes[i] - tapTimes[i - 1]);
      return clampBpm(Math.round(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)));
    },
    reset() { tapTimes.length = 0; },
  };
}

export const TEMPO_MARKINGS = [
  ['Largo', 40], ['Larghetto', 60], ['Adagio', 66], ['Andante', 76],
  ['Moderato', 108], ['Allegro', 120], ['Presto', 168], ['Prestissimo', 200],
];
export function tempoMarking(bpm) {
  const v = clampBpm(bpm);
  let name = TEMPO_MARKINGS[0][0];
  for (const [n, from] of TEMPO_MARKINGS) if (v >= from) name = n;
  return name;
}
