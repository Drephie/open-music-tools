---
name: release-check
description: Check Open Music Tools before every release (each time Drephie publishes to openmusictools.org): all tests, every page in 5 themes × 3 languages at phone sizes, no trackers or ads, credits and licenses, the service worker's cache name and file list, https-only features, then record the result and hand Drephie the publishing steps. Use before any push that goes online, or when Drephie asks "can we publish?".
---

# Release check

The site is published from `main` with GitHub Pages at https://openmusictools.org; the code is public at https://github.com/Drephie/open-music-tools (AGPL-3.0). Nothing goes online until Drephie pushes. Read `CLAUDE.md` first. Every step below must pass, or Drephie decides in plain words what to do about what failed.

## 1. Terminal

```
bash tests/tools/release-check.sh
```

It runs, and prints one line each:

- the JavaScriptCore tests (`tests/tools/run-*-test.js`) and `run-strings-check.js` (es and it have every key en has; every `data-i18n` key in the pages exists);
- **service worker**: every file that goes online is in `APP_SHELL` and every `APP_SHELL` entry exists; `CACHE_NAME` changed since the last `release-*` tag if any cached file changed;
- **no trackers, no ads, https only**: no tracker or ad code; only known outside addresses (loaded from: cdnjs.cloudflare.com, cdn.jsdelivr.net, storage.googleapis.com, tonejs.github.io; links only: Patreon, Instagram, GitHub, archive.org, creativecommons.org); nothing over plain `http://`; every outside `<script src>` has an SRI hash; no font service;
- **credits and licenses**: `LICENSE` (AGPL-3.0), `CNAME` and `.nojekyll`; the Salamander piano credited (CC BY 3.0) in every tool that plays it; an OFL license next to every font; README credits;
- **links**: every local `href` and `src` in the pages exists;
- **personal details**: no computer folder names in the files, every commit uses Drephie's private GitHub address, no `.DS_Store`.

A new outside address is not a mistake to silence: ask Drephie first (CLAUDE.md), then add it to the script's list, to the Privacy note (`aboutPrivacy` in `hub/strings.js`, en/es/it) and to the README.

## 2. Browser

Start the `hub` server (`hub-8001` when another session has port 8000). The pane caches files: `fetch(url, { cache: 'reload' })` the changed files first.

- Open each test page and wait for its summary: `tests/theory.html`, `tests/transport.html`, `tests/ear-trainer.html`, `tests/pitch.html`, `tests/instrument-tuner.html`, `tests/pitch-detector.html`, `tests/pitch-training.html`. All pass. (The transport test measures timing: if it fails with the pane hidden, run it again with the pane shown.)
- Open `tests/release-check.html`: the home page and every tool at 375 × 667 and 390 × 664, in the 5 themes and 3 languages (270 loads, about 6 minutes; the pane must stay open). It checks sideways scrolling, controls and text sticking out of the screen (or below it on a page that can't scroll), text cut off, missing strings, the theme and language applied, and script errors, and puts back everything the browser had saved. Read the result with `window.RELEASE_CHECK` (`problems`, `perPage`). Narrow a re-run with `?pages=piano/&themes=retro&langs=it&sizes=375x667`.
- Look with your own eyes, because the check can't judge looks: screenshot the home page and every changed tool at 375 × 667 (`resize_window`) in Retro CRT with Italian (the largest font and the longest words) and in Soft Pink, plus one computer-width screenshot of the home page. Open the About and Settings windows of changed tools.
- Take a look at what the page loads: `read_network_requests` on the home page and one tool shows only localhost and the known outside addresses.

## 3. By hand

- **Credits**: any sound, sample, font or model added since the last release has its license checked and is credited where its license asks (About window and README).
- **Privacy**: the home page line ("Everything runs on your device: nothing is uploaded, no ads, no trackers.") and the Privacy note in its About window are still true: no new outside address, nothing uploaded, settings only in `localStorage`.
- **https-only features**: the microphone (tuners, Pitch Detector, Pitch Training), the camera (Choordination), AudioWorklet (the pitch engine), the service worker and screen wake lock only work on https or localhost. GitHub Pages serves https; "Enforce HTTPS" must stay on in the repository's Settings → Pages.
- **Beta tags**: the home page's "Beta" tags (`.beta-badge`) still match what Drephie wants (Choordination and Pitch Training at the first launch).
- **Drephie's phone**: every tool changed since the last release passed Drephie's phone test (recorded in `ROADMAP.md`). If not, run the `hub-https` server and ask for one first.

## 4. Record and publish

1. Write the result in `ROADMAP.md` under "Releases": the date, `CACHE_NAME`, what was checked and what failed or was accepted. Commit.
2. Tag the commit: `git tag release-YYYY-MM-DD` (the next release's cache-name check compares with it).
3. Drephie publishes: in GitHub Desktop, **Push origin** (tags go along). GitHub Pages updates in about a minute.
4. Check the live site: `curl -s https://openmusictools.org/sw.js | grep CACHE_NAME` shows the new name, and https://openmusictools.org opens in the built-in browser with no console errors. Phones pick up the new version on their next visit (the service worker fetches our files from the network first).
