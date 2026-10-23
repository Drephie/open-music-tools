/* shared/transport.js: metronome and tempo on Tone.Transport (Tone.js global).
 *
 *   clampBpm(v)       40..240; NaN -> 100
 *   CLICK_SOUNDS      ['click', 'beep', 'wood', 'hat']
 *   createClicks()    the four metronome sounds at -8 dB, routed straight to
 *                     the speakers (not through a rack's master volume, so
 *                     they are heard but stay out of recordings)
 *     clicks.play(sound, time, accent)   unknown sounds play 'click'
 *     clicks.dispose()
 *   startMetronome(clicks, { enabled, sound, beatsPerBar = 4 })
 *     A Tone.Loop on every quarter note of Tone.Transport from 0 (returned;
 *     call .dispose() to remove it). enabled() and sound() are read on each
 *     beat; the first beat of each bar is accented. Start, stop and set the
 *     tempo with Tone.Transport itself (Tone.Transport.bpm.value = clampBpm(x)).
 *   countIn(clicks, sound, startTime, beats = 4)
 *     schedules one bar of clicks at the current tempo from startTime and
 *     returns the time the bar after it starts (start the Transport there).
 *   beatAt(time, beatsPerBar = 4), currentBeat(beatsPerBar = 4)
 *     beat index within the bar (0 = downbeat) at a time / right now.
 *   createTapTempo({ resetAfterMs = 2500, maxTaps = 5 })
 *     .tap(nowMs = performance.now()) -> BPM averaged over the last taps
 *     (clamped), or null until there are two taps. A pause longer than
 *     resetAfterMs starts over. .reset()
 */

export const clampBpm = (v) => Math.max(40, Math.min(240, isNaN(v) ? 100 : v));

export const CLICK_SOUNDS = ['click', 'beep', 'wood', 'hat'];

export function createClicks() {
  const metVol = new Tone.Volume(-8).toDestination();
  const hatFilter = new Tone.Filter(8000, 'highpass').connect(metVol);
  const metSynths = {
    click: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 } }).connect(metVol),
    beep: new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 } }).connect(metVol),
    wood: new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.06, sustain: 0 } }).connect(metVol),
    hat: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(hatFilter),
  };
  return {
    play(sound, time, accent) {
      switch (sound) {
        case 'beep': metSynths.beep.triggerAttackRelease(accent ? 'E6' : 'A5', 0.05, time); break;
        case 'wood': metSynths.wood.triggerAttackRelease(accent ? 'A4' : 'E4', 0.05, time); break;
        case 'hat': metSynths.hat.triggerAttackRelease(0.03, time, accent ? 0.9 : 0.5); break;
        default: metSynths.click.triggerAttackRelease(0.02, time, accent ? 1 : 0.55);
      }
    },
    dispose() {
      [...Object.values(metSynths), hatFilter, metVol].forEach(n => {
        try { if (n) n.dispose(); } catch { /* already disposed */ }
      });
    },
  };
}

export const beatAt = (time, beatsPerBar = 4) =>
  Math.floor(Tone.Transport.getTicksAtTime(time) / Tone.Transport.PPQ) % beatsPerBar;
export const currentBeat = (beatsPerBar = 4) =>
  Math.floor(Tone.Transport.ticks / Tone.Transport.PPQ) % beatsPerBar;

export function startMetronome(clicks, { enabled = () => true, sound = () => 'click', beatsPerBar = 4 } = {}) {
  const metTick = (time) => {
    if (!enabled()) return;
    clicks.play(sound(), time, beatAt(time, beatsPerBar) === 0);
  };
  return new Tone.Loop(metTick, '4n').start(0);
}

export function countIn(clicks, sound, startTime, beats = 4) {
  const beatSec = 60 / Tone.Transport.bpm.value;
  for (let k = 0; k < beats; k++) clicks.play(sound, startTime + k * beatSec, k === 0);
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
