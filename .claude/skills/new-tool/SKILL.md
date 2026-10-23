---
name: new-tool
description: Build a new Open Music Tools tool after its spec is approved: folder layout, shared page parts, strings, settings, Patreon window, service worker, tests, browser checks and Drephie's phone test. Use when starting the code of any new tool in ROADMAP.md (after the tool-spec skill), or when adding a tool page to the hub.
---

# New tool

The Metronome (`metronome/`) is the working example: copy its structure, not its music code. Read `CLAUDE.md` first; one tool per session.

## 0. Before code

- The tool's spec in `specs/<tool>.md` is approved by Drephie (the `tool-spec` skill). No code before that.
- Read the API header of every `shared/` module you will use (not the implementation). If the tool needs an engine change, change the module and its header together, and add or extend a test page in `tests/`.

## 1. Files

`<tool>/index.html`, `<tool>.css`, `<tool>.js` (ES module), `strings.js` (en/es/it), `favicon.svg`. Start from the Metronome's files:

- **Head:** Tone.js 14.8.49 from cdnjs with its SRI hash (only if the tool makes sound), the Google Fonts link from `shared/ui/themes.css`, then `themes.css`, `select.css`, `page.css`, then the tool's CSS.
- **Body:** `<body data-theme="liquid">`, `#theme-frame`, `.page` with `.tool-header` (title, About and Settings icon buttons), `<main>` with `.panel`s, `.tool-footer` (Support on Patreon, Designed by @drephie).
- **Windows** (all from `shared/ui/page.css`/`page.js`; see the Metronome's markup):
  - Settings: `.centered-modal.has-dropdowns` with Theme and Language. Their lists must show on top of the window.
  - About: a short text (name linked to Instagram via `{instagram}`), a `.btn.patreon-btn`, keyboard tips in `.computer-only`.
  - Patreon window: `.modal-overlay` with `.support-card`, `.support-close`, `.support-continue`.

## 2. JavaScript wiring (copy from `metronome/metronome.js`)

- Settings: `loadSettings('<tool>.settings.v1')`, validate every field (range, list membership) with a default, `saveSettings` on every change. Theme and language are remembered; language defaults to `browserLanguage()`. Never store people's work.
- i18n: `createI18n({ strings: mergeStrings(HUB_STRINGS, TOOL_STRINGS), getLang, vars: { patreon: PATREON_URL, instagram: DESIGNER_URL } })`. On language change: `apply()`, update `document.title` and any text set in JS, then `setupCustomSelects()`.
- Windows: `createModalManager({ modals: [settings, about, support], escapeAction: (m) => (m === support && prompt.locked() ? 'ignore' : 'hide') })`, `closeOnBackdrop(modals)`, close buttons in `.modal-header`.
- Patreon window: `createSupportPrompt({ dialog, modals, t, isBusy })`. `isBusy()` is true while the tool is in use without touches (playing, listening), so it never interrupts practice.
- Keyboard: shortcuts only when no window is open and focus is not in a text field or dropdown; Enter still presses a focused button.
- `registerHubWorker('../')` last.

## 3. Strings

Every visible string and every `aria-label` goes through i18n, in English, Spanish and Italian. Tool strings stay in the tool; strings every tool needs go in `shared/ui/strings.js`. Plain words, no assumed theory: explain a term in brackets ("In-between clicks (1-and)"). Spell notes for the key (`spellOnLetter`). Drephie checks the Spanish and Italian.

## 4. Look and layout

- Colors and fonts only through theme variables (`themes.css`; add a variable there if one is missing, in every theme). The only brand color is `--color-patreon`.
- **Phone: the whole tool fits one screen** of 375 × 667 and 390 × 664 (iPhone with Safari's bars), in every theme and language, with the longest option selected. Sizes that can grow use `dvh` (`clamp(min, Ndvh, max)`), and line heights are pinned on phones (Baloo 2 in Soft Pink has very tall ones). To measure: set `.page`'s `min-height` to 0 and read its height.
- Touch targets at least 44 px (38–40 px only when a row must fit). Press actions that need exact timing (tap tempo, pads) react on `pointerdown`.
- Dropdowns are the shared custom selects; they open upward by themselves when there is no room below.

## 5. Sound (tools that play)

- `await Tone.start()` first thing in the tap or click handler. Set `navigator.audioSession.type = 'playback'` at load (iPhone silent switch); keep the screen awake while playing (`navigator.wakeLock`, https only).
- Light the screen in time with `Tone.Draw.schedule(fn, time)`.
- Claude can't hear: test timing by calling loop callbacks at known times on a Transport started far in the future, and levels by rendering with `Tone.Offline` and measuring peaks and energy. Noise sounds start at a random point: take the worst of many renders. Nothing may peak above 1.0 at the loudest setting. Note: `Tone.Transport` stays bound to the original context, so `Tone.Offline` can render sounds but not the Transport.

## 6. Hub files

Add every new file to `APP_SHELL` in `/sw.js` and bump `CACHE_NAME` whenever a cached file changes. Update `ROADMAP.md` (status, shared engines, open decisions), and the spec when Drephie changes something.

## 7. Checks in the built-in browser

- Start the `hub` server from `.claude/launch.json` (`hub-8001` when port 8000 is taken by another session). The pane caches files: `fetch(url, { cache: 'reload' })` each changed file, then reload.
- All 5 themes, all 3 languages, phone sizes (`resize_window` 375 × 667 and 390 × 664) and desktop, keyboard only, every window and dropdown, settings remembered after reload. Wait for theme transitions (about 0.5 s) before judging colors.
- `tests/theory.html` and `tests/transport.html` pass. If a shared file changed, Choordination still loads and its dropdowns work.
- The built-in browser slows its audio clock while its pane is hidden and reports a mouse and no touch, so phone-only and timing behaviour need the methods above, or Drephie's phone.
- Don't overwrite Drephie's saved settings or the Patreon window's last-shown time (`open-music-tools.supportPrompt`) without putting them back.

## 8. Drephie's test

- Phone link on the same Wi-Fi: `ipconfig getifaddr en0`, then `http://<address>:8000/<tool>/`, shown as a QR code. On this plain http link, screen wake lock and offline don't work. If the phone can't connect, Drephie allows Python in the macOS firewall (Drephie's setting, not Claude's).
- Give a short listening or hand checklist that says exactly what to check, then record the results in `ROADMAP.md`.

## 9. Commits

Small commits on main after each working step: engine change with its tests, shared page parts, the tool, docs. Commit only your own files.
