/* shared/wave.js: a sound wave cut to whole periods, for drawing it (the Vocal
 * Tuner's wave ball, the Instrument Tuner's vibrating string). Pure: no DOM.
 *
 *   waveShape(samples, sampleRate, freq, out)
 *     Fills out (a Float32Array of any length) with a whole number of periods
 *     (1 to 4) of the newest sound in samples (from shared/pitch.js
 *     listener.readWaveform), starting on a rising zero crossing, scaled to
 *     -1..1. So the shape repeats seamlessly: a ring closes smoothly, and
 *     reading it in a loop from a moving offset makes the wave travel. freq 0
 *     (no note): the newest stretch as it is. Returns out.
 */
export function waveShape(samples, sampleRate, freq, out) {
  const n = samples.length, points = out.length;
  let start, span;
  if (freq > 0) {
    const period = sampleRate / freq;
    const periods = Math.max(1, Math.min(4, Math.floor((n - period) / period)));
    span = periods * period;
    start = Math.floor(n - span - 1);
    // Back to the nearest rising zero crossing (within one period).
    for (let i = start; i > Math.max(1, start - period); i--) {
      if (samples[i - 1] < 0 && samples[i] >= 0) { start = i; break; }
    }
  } else {
    span = Math.min(n - 1, 1024);
    start = n - 1 - span;
  }
  let peak = 0;
  for (let i = 0; i < points; i++) {
    const x = start + (i / points) * span;
    const j = Math.floor(x), f = x - j;
    const v = samples[j] * (1 - f) + samples[Math.min(n - 1, j + 1)] * f;
    out[i] = v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  const k = peak > 1e-5 ? 1 / peak : 0;
  for (let i = 0; i < points; i++) out[i] *= k;
  return out;
}
