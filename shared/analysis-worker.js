/* shared/analysis-worker.js: the background worker of shared/analysis.js.
 * Runs Essentia.js 0.1.3 (our own copy in ./vendor/essentia/, AGPL-3.0) so the
 * page never freezes. Message in: { id, samples: Float32Array, mono, 44100 Hz }.
 * Messages out: { id, progress: 0..1 }, then { id, result } or { id, error }.
 * result: { notes: 0..1 (how clearly there are notes), bpm, confidence, beats: [s], intervals: [s],
 *           profiles: [{ key, scale, strength }] (bgate, edma, temperley),
 *           windows: [{ time, key, scale, strength }] (8 s every 4 s; time = start) }
 */
/* global EssentiaWASM, Essentia, importScripts */
// The web build of Essentia.js expects a page: give it the one thing it reads.
self.document = self.document || { currentScript: null, title: '' };
importScripts('vendor/essentia/essentia-wasm.web.js', 'vendor/essentia/essentia.js-core.umd.min.js');

const SR = 44100;
const ready = EssentiaWASM({ locateFile: (path) => 'vendor/essentia/' + path }).then((module) => new Essentia(module));

function toArray(essentia, vec) {
  const a = essentia.vectorToArray(vec);
  return Array.from(a);
}
function key(essentia, vec, profile) {
  const k = essentia.KeyExtractor(vec, true, 4096, 4096, 12, 3500, 60, 25, 0.2, profile, SR, 0.0001, 440, 'cosine', 'hann');
  return { key: k.key, scale: k.scale, strength: k.strength };
}

self.onmessage = async ({ data }) => {
  const { id, samples } = data;
  const vectors = [];
  try {
    const essentia = await ready;
    const post = (progress) => self.postMessage({ id, progress });
    post(0.05);
    const vec = essentia.arrayToVector(samples); vectors.push(vec);
    const r = essentia.RhythmExtractor2013(vec, 208, 'multifeature', 40);
    const beats = toArray(essentia, r.ticks), intervals = toArray(essentia, r.bpmIntervals);
    for (const v of [r.ticks, r.bpmIntervals, r.estimates]) if (v && v.delete) v.delete();
    post(0.55);
    const profiles = ['bgate', 'edma', 'temperley'].map((p) => key(essentia, vec, p));
    post(0.7);
    const windows = [];
    const win = 8 * SR, hop = 4 * SR;
    for (let s = 0; s + win <= samples.length || (s === 0 && samples.length > 0); s += hop) {
      const w = essentia.arrayToVector(samples.subarray(s, Math.min(samples.length, s + win)));
      windows.push({ time: s / SR, ...key(essentia, w, 'bgate') });
      w.delete();
      if (s + win >= samples.length) break;
      if (windows.length % 8 === 0) post(0.7 + 0.29 * Math.min(1, (s + win) / samples.length));
    }
    // How clearly the sound has notes: the 12 note classes summed over the
    // song (a frame every half second). Noise and drums fill all 12 about
    // evenly; music leaves some low. notes = 1 - lowest / highest of the sums.
    const chroma = new Array(12).fill(0);
    for (let i = 0; i + 4096 <= samples.length; i += SR / 2) {
      const f = essentia.arrayToVector(samples.subarray(i, i + 4096));
      const w = essentia.Windowing(f, true, 4096, 'blackmanharris62', 0, true).frame;
      const sp = essentia.Spectrum(w, 4096).spectrum;
      const pk = essentia.SpectralPeaks(sp, 0.00001, 5000, 60, 40, 'magnitude', SR);
      const h = essentia.HPCP(pk.frequencies, pk.magnitudes, true, 500, 8, 5000, false, 40, false, 'none', 440, SR, 12, 'cosine', 1);
      const v = essentia.vectorToArray(h.hpcp);
      for (let k = 0; k < 12; k++) chroma[k] += v[k] || 0;
      for (const x of [f, w, sp, pk.frequencies, pk.magnitudes, h.hpcp]) x.delete();
    }
    const top = Math.max(...chroma), low = Math.min(...chroma);
    const notes = top > 0 ? 1 - low / top : 0;
    self.postMessage({ id, result: { notes, bpm: r.bpm, confidence: r.confidence, beats, intervals, profiles, windows } });
  } catch (e) {
    self.postMessage({ id, error: String(e && e.message || e) });
  } finally {
    for (const v of vectors) try { v.delete(); } catch { /* already freed */ }
  }
};
