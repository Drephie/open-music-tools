/* shared/camera-look.js: your own look for the camera picture in the camera
 * tools (Choordination, Chordigits): brightness, contrast, saturation, hue and
 * noise, on top of the theme's colours. One choice for both tools, saved in
 * localStorage under CAMERA_LOOK_KEY (a setting, not people's work).
 *
 *   mountCameraLook(container, t)  draws the five sliders and a Reset button
 *     into container (again on a language change: it redraws), applies the
 *     saved look, and saves each change. Strings (shared/ui/strings.js):
 *     camLook, camBrightness, camContrast, camSaturation, camHue, camNoise,
 *     camReset.
 *
 * It sets these on <body>; the tool's CSS uses them on the camera picture:
 *   --cam-brightness, --cam-contrast, --cam-saturation (numbers, 1 = as is),
 *   --cam-hue (an angle), --cam-noise (0..1, the opacity of the tool's noise
 *   layer), and the class "cam-noise-on" while there is any noise.
 */

export const CAMERA_LOOK_KEY = 'open-music-tools.camera-look.v1';
// [key, string, min, max, default, unit shown]
const SLIDERS = [
  ['brightness', 'camBrightness', 50, 150, 100, '%'],
  ['contrast', 'camContrast', 50, 150, 100, '%'],
  ['saturation', 'camSaturation', 0, 200, 100, '%'],
  ['hue', 'camHue', -180, 180, 0, '°'],
  ['noise', 'camNoise', 0, 100, 0, '%'],
];

function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CAMERA_LOOK_KEY)) || {}; } catch { /* storage unavailable */ }
  const look = {};
  for (const [k, , min, max, def] of SLIDERS) {
    const v = Number(saved[k]);
    look[k] = Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : def;
  }
  return look;
}
function apply(look) {
  const s = document.body.style;
  s.setProperty('--cam-brightness', look.brightness / 100);
  s.setProperty('--cam-contrast', look.contrast / 100);
  s.setProperty('--cam-saturation', look.saturation / 100);
  s.setProperty('--cam-hue', `${look.hue}deg`);
  s.setProperty('--cam-noise', look.noise / 100);
  document.body.classList.toggle('cam-noise-on', look.noise > 0);
}

export function mountCameraLook(container, t) {
  const look = load();
  apply(look);
  container.innerHTML = `<p class="cam-look-title">${t('camLook')}</p>` + SLIDERS.map(([k, label, min, max]) =>
    `<div class="cam-look-row"><label for="cam-look-${k}">${t(label)}</label><output id="cam-look-${k}-out" for="cam-look-${k}"></output>`
    + `<input id="cam-look-${k}" class="range" type="range" min="${min}" max="${max}" step="1" value="${look[k]}" data-k="${k}"></div>`).join('')
    + `<button type="button" class="cam-look-reset">${t('camReset')}</button>`;
  const show = () => {
    for (const [k, , min, max, , unit] of SLIDERS) {
      const input = container.querySelector(`#cam-look-${k}`);
      input.value = look[k];
      input.style.setProperty('--fill', `${((look[k] - min) / (max - min)) * 100}%`);
      container.querySelector(`#cam-look-${k}-out`).textContent = `${look[k] > 0 && k === 'hue' ? '+' : ''}${look[k]}${unit}`;
    }
  };
  const save = () => { try { localStorage.setItem(CAMERA_LOOK_KEY, JSON.stringify(look)); } catch { /* storage unavailable */ } };
  container.oninput = (e) => {
    if (!e.target.dataset.k) return;
    look[e.target.dataset.k] = Number(e.target.value);
    apply(look); show(); save();
  };
  container.querySelector('.cam-look-reset').onclick = () => {
    for (const [k, , , , def] of SLIDERS) look[k] = def;
    apply(look); show(); save();
  };
  show();
}
