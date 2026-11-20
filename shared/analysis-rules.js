/* shared/analysis-rules.js: the rules that turn what Essentia.js measured into
 * answers people read (spec: specs/bpm-key-finder.md). Pure: no sound, no
 * DOM, no worker. Tested by tests/bpm-key-finder.html (and jsc).
 * A key here is { tonic: 0..11 (C = 0), mode: 'maj' | 'min' }.
 *
 *   SAMPLE_RATE      44100, the rate the analysis works at
 *   MIN_SECONDS      10: shorter sound is "too short"
 *   soundLevel(samples) -> { peak, rms }
 *   isSilent(level)  true when there is nothing to listen to (peak under
 *                    0.003, about -50 dB, or rms under 0.0005)
 *   parseKey(name, scale) -> key | null   Essentia's 'C#', 'Eb'... and
 *                    'major' / 'minor'
 *   sameKey(a, b), relativeOf(key)  (C major <-> A minor)
 *   keyLabel(key, solfege) -> 'F# minor' style parts { root: 'F#', mode }
 *                    (spelled for the key: Db major, C# minor)
 *   halfDouble(bpm) -> { half, double } of the BPM rounded to a whole number
 *                    (156.3 -> 78 and 312; 123 -> 61.5 and 246)
 *   tempoRange(bpm, intervals) -> { low, high, changes }
 *     intervals: seconds between found beats. Each beat's speed is folded by
 *     octaves (×2, ÷2) next to bpm, so a beat read at double speed for a
 *     moment isn't a change; low/high are the 10th and 90th percentiles,
 *     whole BPM. changes: the spread is more than 9.5% of bpm and at least
 *     8 BPM (steady songs spread up to 9%).
 *   readBeat({ bpm, confidence, beats, seconds }) -> null | { bpm, beats }
 *     null (no beat) when the BPM is outside 30..300, fewer than 8 beats were
 *     found, or the confidence (Essentia's 0..5.3) is under 0.9 (noise read
 *     0.4 to 0.72; the trial songs 0.98 and more).
 *   readKey(profiles, windows, notes = 1) -> null | { key, alt, strength }
 *     profiles: [{ key, strength }] from three ways of reading the key (the
 *     first one wins ties); windows: [{ time, key, strength }] along the
 *     song; notes: how clearly the sound has notes (0..1, the worker's
 *     measure). null (no key) when notes is under 0.5 (noise) or the best
 *     strength is under 0.76 (a drum loop read 0.73, noise up to 0.83 but
 *     with few notes; every trial song 0.81 or more). key: the
 *     majority; alt: the one they disagreed on, else, when the windows
 *     mostly (35%+) say another key, that one; else null.
 *   keyAgreement(windows, key) -> 0..1, the share of windows that say the key,
 *     its relative, or a key a 5th above or below (or their relatives): near
 *     1 in songs, about 0.25 in noise
 *   keyChanges(windows, main, { hop, minRun }) -> [{ time, key }]
 *     windows in time order; a change is a run of at least minRun seconds
 *     (default 32) of one key that isn't the current one or its relative.
 *     Short wobbles (under minRun) don't count. time = the run's first window.
 *   evenBeats(start, period, seconds) -> beats every period seconds through
 *     0..seconds, through start (for tapped beats)
 *   scaleBeats(beats, factor) -> beats for ½ (every other beat) or ×2 (a beat
 *     between each); factor 1 returns them as they are
 *   formatTime(seconds) -> 'm:ss'
 */
import { keyRootName } from './theory.js';

export const SAMPLE_RATE = 44100;
export const MIN_SECONDS = 10;

const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const mod12 = (n) => ((n % 12) + 12) % 12;

export function soundLevel(samples) {
  let peak = 0, sum = 0;
  for (let i = 0; i < samples.length; i++) { const x = Math.abs(samples[i]); if (x > peak) peak = x; sum += x * x; }
  return { peak, rms: samples.length ? Math.sqrt(sum / samples.length) : 0 };
}
export const isSilent = ({ peak, rms }) => peak < 0.003 || rms < 0.0005;

export function parseKey(name, scale) {
  const m = /^([A-G])([#b]?)$/.exec(String(name || '').trim());
  if (!m || (scale !== 'major' && scale !== 'minor')) return null;
  return { tonic: mod12(NOTE_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)), mode: scale === 'major' ? 'maj' : 'min' };
}
export const sameKey = (a, b) => !!a && !!b && a.tonic === b.tonic && a.mode === b.mode;
export const relativeOf = (k) => (k.mode === 'maj' ? { tonic: mod12(k.tonic + 9), mode: 'min' } : { tonic: mod12(k.tonic + 3), mode: 'maj' });
const keyId = (k) => k.tonic + k.mode;

export function keyLabel(key, solfege = false) {
  return { root: keyRootName(key.tonic, key.mode, solfege), mode: key.mode };
}

export function halfDouble(bpm) {
  const whole = Math.round(bpm);
  return { half: whole / 2, double: whole * 2 };
}

export function tempoRange(bpm, intervals) {
  const speeds = [];
  for (const s of intervals || []) {
    if (!(s > 0)) continue;
    let b = 60 / s;
    while (b > bpm * Math.SQRT2) b /= 2;
    while (b < bpm / Math.SQRT2) b *= 2;
    speeds.push(b);
  }
  if (speeds.length < 4) return { low: Math.round(bpm), high: Math.round(bpm), changes: false };
  speeds.sort((a, b) => a - b);
  const q = (p) => speeds[Math.round(p * (speeds.length - 1))];
  const low = Math.round(q(0.1)), high = Math.round(q(0.9));
  return { low, high, changes: high - low >= 8 && (high - low) / bpm > 0.095 };
}

export function readBeat({ bpm, confidence, beats, seconds }) {
  if (!(bpm >= 30 && bpm <= 300) || !beats || beats.length < 8 || !(confidence >= 0.9)) return null;
  return { bpm, beats: beats.filter((t) => t >= 0 && (!seconds || t <= seconds)) };
}

export function readKey(profiles, windows = [], notes = 1) {
  const valid = profiles.filter((p) => p && p.key);
  if (!valid.length) return null;
  const strength = Math.max(...valid.map((p) => p.strength || 0));
  if (strength < 0.76 || !(notes >= 0.5)) return null;
  const votes = new Map();
  valid.forEach((p, i) => {
    const id = keyId(p.key), v = votes.get(id) || { key: p.key, n: 0, first: i };
    v.n++; votes.set(id, v);
  });
  const ranked = [...votes.values()].sort((a, b) => b.n - a.n || a.first - b.first);
  const key = ranked[0].key;
  let alt = ranked[1] ? ranked[1].key : null;
  if (!alt && windows.length) {
    const count = new Map();
    for (const w of windows) if (w.key && !sameKey(w.key, key)) { const v = count.get(keyId(w.key)) || { key: w.key, n: 0 }; v.n++; count.set(keyId(w.key), v); }
    const best = [...count.values()].sort((a, b) => b.n - a.n)[0];
    if (best && best.n / windows.length >= 0.35) alt = best.key;
  }
  return { key, alt, strength };
}

export function keyAgreement(windows, key) {
  const near = [key, relativeOf(key)];
  for (const d of [5, 7]) { const k = { tonic: mod12(key.tonic + d), mode: key.mode }; near.push(k, relativeOf(k)); }
  const counted = windows.filter((w) => w.key);
  if (!counted.length) return 0;
  return counted.filter((w) => near.some((k) => sameKey(k, w.key))).length / counted.length;
}

export function keyChanges(windows, main, { hop = 4, minRun = 32 } = {}) {
  const out = [];
  let current = main, i = 0;
  const near = (a, b) => sameKey(a, b) || sameKey(relativeOf(a), b);
  while (i < windows.length) {
    const k = windows[i].key;
    if (!k || near(k, current)) { i++; continue; }
    let j = i;
    while (j + 1 < windows.length && windows[j + 1].key && near(windows[j + 1].key, k)) j++;
    const length = windows[j].time - windows[i].time + hop;
    if (length >= minRun) {
      // The run's own key: the one most of its windows say (not its relative).
      const n = windows.slice(i, j + 1).filter((w) => sameKey(w.key, k)).length;
      const runKey = n * 2 >= j - i + 1 ? k : relativeOf(k);
      out.push({ time: windows[i].time, key: runKey });
      current = runKey;
    }
    i = j + 1;
  }
  return out;
}

export function evenBeats(start, period, seconds) {
  if (!(period > 0)) return [];
  const out = [];
  let t = start - Math.floor(start / period) * period;
  for (; t <= seconds + 1e-9; t += period) out.push(+t.toFixed(4));
  return out;
}

export function scaleBeats(beats, factor) {
  if (factor === 0.5) return beats.filter((_, i) => i % 2 === 0);
  if (factor === 2) {
    const out = [];
    beats.forEach((t, i) => { out.push(t); if (i + 1 < beats.length) out.push(+((t + beats[i + 1]) / 2).toFixed(4)); });
    return out;
  }
  return beats.slice();
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
