# Legal, privacy and accessibility audit

Date: 2026-11-14. Every statement below was checked against the code in this repository, unless it says **not verified**. This is a technical review, **not legal advice**: the points under "Confirm with a lawyer" need a person qualified in your country.

## 1. What Drephie must fill in (placeholders)

All in **`legal/details.js`** (one file; the pages show missing items as marked `[BRACKETS]` until then):

| Placeholder | What to write |
|---|---|
| `legalName` | filled in: Andrea Nicoli |
| `country` | where you live / the company is based |
| `email` | a public contact address (also used for privacy questions) |
| `taxInfo` | tax or company number if you have one (e.g. VAT number), otherwise leave empty |
| `governingLaw` | whose law the Terms follow, e.g. "Spain" or "Italy" |
| `updated` | the date the texts were last changed (set to 2026-11-14) |

The pages are only fully accurate for your country once these are known (see section 6). The "who runs this site" and "law and contact" parts depend on them.

## 2. What applies to this site, and what doesn't

| Requested item | Applies? | What was done and why |
|---|---|---|
| Privacy policy | **Yes** | `privacy/`, en/es/it. Because visitors' IP addresses reach outside servers (section 3), a privacy notice is needed even though you collect nothing. |
| Cookie policy | **Yes, as a section** | No cookies exist, but `localStorage` and the browser cache are used. Covered inside the Privacy page ("Cookies" and "What your browser remembers"), not a separate page. |
| Cookie consent banner | **No** | No cookies, no tracking, no ads. The only storage keeps the user's own settings (see section 3). **Confirm with a lawyer** (section 6). No banner was added. |
| Terms and conditions | **Yes** | `terms/`, en/es/it: free "as is" tools, on-device processing, microphone/camera, AGPL-3.0, credits, liability. |
| Refund policy | **No** | Nothing is sold. The Terms say everything is free and that Patreon handles Patreon payments and refunds. |
| Form consent | **No** | There is no `<form>`, no text field that sends anything, no account, no newsletter. (Text boxes exist only inside tools, e.g. a typed answer in Intervle, and stay on the device.) |
| Only collecting necessary data | **Met** | Nothing is collected or sent. |
| Analytics tracking check | **Met** | None. `tests/tools/release-check.sh` also scans for tracker and ad code on every release. |
| Third-party embeds | **None** | No iframe, embed, video or social widget. Only links (Patreon, Instagram, TikTok, GitHub, archive.org, Creative Commons, gnu.org) that load only when tapped. |
| Fake reviews | **None found** | No reviews, testimonials, ratings or statistics anywhere (section 5). |
| Unsupported claims | **Checked** | Section 5. |
| Business details | **Placeholders** | Section 1. Nothing invented. |
| Image copyright | **Fine, with notes** | Section 4. There are no photographs; all graphics are Drephie's own SVG artwork. |
| Accessibility | **Mostly met** | Section 7. |
| Local laws | **Summarised** | Section 6. |

## 3. What the site really does (from the code)

### Stored in the browser (`localStorage`; no cookies anywhere)
Searched all code for `document.cookie`, `sessionStorage` and `indexedDB`: **none are used**. `localStorage` keys:

| Key | Content | Used by |
|---|---|---|
| `open-music-tools.look.v1` | theme and language | all pages |
| `open-music-tools.camera-look.v1` | camera picture sliders | Choordination, Chordigits |
| `open-music-tools.supportPrompt` | time the Patreon reminder was last shown | all tools with the reminder |
| `<tool>.settings.v1` / `chordigits.settings.v2` | that tool's settings (volume, tempo, instrument, note names…); Ear Trainer: stars and best scores; Intervle: each day's tries and streaks | each tool |

Also: the **service worker** (`sw.js`) keeps copies of the site's files and of the CDN files in the browser's Cache Storage, so tools work offline. Nothing personal is in there.

### Every outside request the pages make
| Host | What | Which pages | Receives |
|---|---|---|---|
| GitHub Pages (openmusictools.org) | all pages, code, fonts | all | IP and browser details (our host; GitHub may keep its own logs: **not verified**) |
| `cdnjs.cloudflare.com` | Tone.js 14.8.49 (with SRI hash) | all tools that make sound (not the two tuners) | IP, browser details |
| `tonejs.github.io` | Salamander piano samples | tools that play piano | IP, browser details |
| `cdn.jsdelivr.net` | MediaPipe tasks-vision 0.10.3 (code and WASM) | Choordination, Chordigits | IP, browser details |
| `storage.googleapis.com` | `hand_landmarker.task`, `face_landmarker.task` | Choordination, Chordigits | IP, browser details |

No fonts come from outside (fonts are our own files in `shared/fonts/`). Patreon, Instagram, TikTok, GitHub, archive.org and Creative Commons are plain links that load nothing until tapped. The page `fetch` calls are only for own files (`shared/ui/page.js` loads the page's own favicon; `sw.js` handles cache) and for Choordination's head-start prefetch of the MediaPipe files and the two models from the hosts above while the welcome window is read (`choordination/index.html`, around line 2648; skipped with Data Saver, on touch-only or keyboard modes).

**Could they be self-hosted?** (Proposal only; nothing changed, per `CLAUDE.md`.)
- Tone.js (MIT): yes, easy: one file. It would remove cdnjs.
- MediaPipe code and WASM (Apache-2.0): yes.
- The two `.task` models (Apache-2.0): yes.
- Salamander samples (CC BY 3.0): yes, but they are the largest set of files (sizes not measured), so the repository gets heavy.
- Doing all of it would leave **only GitHub Pages** seeing visitors' IP addresses and would let the Privacy page say so, which is simpler for GDPR (no third-party transfers beyond the host). Decision for Drephie.

### Camera and microphone: does anything leave the device?
- `getUserMedia` / `getDisplayMedia` appear only in `shared/pitch.js`, `choordination/index.html` and `chordigits/chordigits.js`.
- There is **no** `fetch` with a body, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, form, upload or `<iframe>` anywhere (searched all non-test code). The only `fetch` calls are GET requests for files (listed above).
- Recordings (Choordination, Chordigits) are `MediaRecorder` blobs turned into a download with `URL.createObjectURL`, started only by the user's button. Nothing is sent.
- The microphone is requested with echo cancellation, noise suppression and automatic gain off (`shared/pitch.js`); that is a quality setting, not a privacy one.
- **Not verified in a real camera session:** the built-in browser blocks camera and microphone, so this was checked by reading the code and the network list, not by a live run with permissions granted. Worth one check by Drephie with the browser's network panel open while using Choordination.

### Does anything else exist?
Accounts, sign-in, payments, a shop, forms, newsletters, comments, reviews, ads, analytics: **none** (searched for `<form`, `<textarea`, `type="file"`, and tracker names; the release check also scans for them).

## 4. Images, icons, fonts, sounds and models

| Asset | Licence | Credited? |
|---|---|---|
| Logos, favicons and card artwork (all SVG, drawn in the repo) | Drephie's own work. The `LICENSE` AGPL covers the code; the Terms say the name and logo artwork belong to Drephie | n/a |
| No photographs, no raster images, no icon fonts | n/a | n/a |
| Salamander Grand Piano (samples, loaded from tonejs.github.io) | CC BY 3.0, Alexander Holm | Yes: in every tool that plays it (About window), in the README and the Terms |
| Tone.js 14.8.49 (cdnjs) | MIT | README and Terms |
| MediaPipe tasks-vision 0.10.3 and the hand and face models | Apache-2.0 | README and Terms. (Models are Google's; the README says Apache-2.0 but I could not re-check Google's model card online: **not verified**.) |
| 12 fonts (Familjen Grotesk, Rajdhani, Sora, Roundo, Nunito, Archivo, Azeret Mono, JetBrains Mono, Literata, Epilogue, Red Hat Display, Asap) | SIL OFL 1.1, from Fontshare's open-source shelf; an `OFL-*.txt` sits beside each font | README, Terms (generally) |
| The clicks and tones (metronome, tuners, synths) | Generated in code by Tone.js, no sound files | n/a |

**Not verified:** that each Fontshare font is really OFL upstream as the repo's `OFL-*.txt` files claim (the licence texts were copied by an earlier session; Fontshare publishes some fonts under its own "ITF Free Font License" instead). **Drephie or a lawyer should re-check each font's page on fontshare.com once.** If one is not OFL, replace it before launch.

## 5. Claims, reviews, statistics

Searched all pages and strings (en, es, it) for reviews, testimonials, numbers of users, "best", "most accurate", "100%", "secure", "guarantee": **none of the first four exist.** What remains:

- "Everything runs on your device: nothing is uploaded, no ads, no trackers." (home page, About, README): **true for what you do** (verified, section 3). The About window's Privacy note already admits that outside servers see the IP address. No change needed.
- "Nothing leaves your device" on the Choordination and Chordigits cards: true for camera and microphone data. Strictly, file requests go out; the Privacy page now says so. Left as is, because it is about the camera and microphone and is accurate.
- "100% on-device" (Choordination's social-sharing description): true for processing. Left.
- Tuner and pitch readings: the tools never promise accuracy; the Terms now say readings can be wrong (noise, poor microphone).
- "Best" / "bestStreak" strings: personal best scores, not marketing claims.
- No health or hearing claims. The Terms state the tools are not a medical or professional service.

Nothing was removed because nothing false was found.

## 6. Laws that probably apply (not legal advice)

| Law | What it means here |
|---|---|
| **EU GDPR** (and UK GDPR) | IP addresses are personal data, so outside servers (and GitHub Pages) process them. You as owner receive no personal data, so you have very little to do: a short privacy notice (done), and no data to access or delete. The CDN providers are their own controllers. Using US companies means transfers outside the EU; they publish their own safeguards. Self-hosting (section 3) would remove most of this. A German court (Munich, 2022) ordered a site operator to pay damages for loading Google Fonts from Google's servers, which is why this matters to some visitors. |
| **ePrivacy Directive** (EU "cookie law"); **Italy**: Garante guidelines on cookies (2021) and art. 122 Codice Privacy; **Spain**: LSSI art. 22.2 and the AEPD cookie guide | Consent is not needed for storage that is strictly necessary or only to keep the user's own choices, but you must inform people (done on the Privacy page). **Confirm:** that the "last time the Patreon reminder was shown" stamp and the saved game scores count as exempt. The stamp is the weakest case; if a lawyer says it needs consent, move it to `sessionStorage` (resets when the tab closes, no consent needed) or drop the 40-minute spacing. |
| **EU Accessibility Act** (Directive 2019/882, in force 28 June 2025; Italy D.Lgs. 82/2022, Spain Ley 11/2023) | Covers certain consumer **products and services** supplied for money (e-commerce, banking, e-books, etc.). A free, non-commercial music tool site without sales is **not clearly in scope**, and micro-enterprises are exempt from the service rules. Accessibility is done anyway (section 7). **Confirm** whether Patreon support makes you a commercial provider in your country. |
| **WCAG 2.1 AA** | The standard used for the check in section 7; no law forces it on this site as far as I can tell. |
| **Children's privacy** (EU GDPR art. 8; US COPPA; UK Children's Code) | These apply when you collect personal data or target children. You collect none, and the tools ask for no details. The Privacy page says so. The site isn't aimed at children by design, but ear training may attract them: **confirm**. |
| **US (CCPA/CPRA, other state laws)** | Apply to businesses that sell or share personal data above thresholds. Not applicable: no data is collected. |
| **Consumer law** (EU 14-day withdrawal right, UK Consumer Rights Act) | Applies to sales. There are none. Patreon sells the memberships and handles refunds. |
| **Copyright and open-source licences** | The Salamander piano needs credit (done in every tool, README and Terms). Tone.js (MIT) and MediaPipe (Apache-2.0) need their licence notice if their code is **redistributed**; today they come from CDNs, so the README credit is enough. If you ever self-host them, add their LICENSE files. AGPL-3.0 for your own code is correct, but it also asks that a modified copy run as a network service offers its source: the Terms link the repository. Your own logo and art are not covered by "the code" under the AGPL unless you say so: the Terms reserve them to Drephie, **confirm that is what you want**. |
| **Business and tax law** | Possible duties to publish a seller identity (Italy/Spain "impressum"-style rules, EU e-commerce directive art. 5) apply to providers of paid services; with donations only, rules differ by country. The placeholders are there so the page can show your details if required. **Confirm.** |
| **Recording other people** | Choordination and Chordigits can record the screen and voice. Laws about recording others vary; the Terms put the responsibility on the user. |

### Confirm with a lawyer or your data protection authority
1. Whether the saved settings, scores and the Patreon reminder timestamp need consent in your country.
2. Whether being funded on Patreon makes the site "commercial" (EU Accessibility Act, seller-identity rules, tax).
3. Whether to self-host Tone.js, MediaPipe, models and piano samples (privacy simplification).
4. The Terms' limitation of liability and governing law, for your country.
5. The font licences (section 4).
6. Whether your country needs registration or a specific wording for a website owner (Italy: P.IVA if earning; Spain: LSSI data).

## 7. Accessibility check

Method: an automated audit script ran in the built-in browser at 390 px wide over **13 pages × 7 themes** (English), plus Spanish and Italian samples: text contrast (WCAG 2.1 AA: 4.5:1 normal, 3:1 large), accessible names for every button, link, input and slider, image alt text, one `<h1>`, `<html lang>` matches the chosen language, target sizes. Code was read for focus styles, live regions and reduced motion.

**Passed**
- Contrast: every visible text passes in every theme (the audit computes real backgrounds, also with opacity), **except** the small keyboard-hint digits in Intervle's answer buttons in the Retrosnap and Soft Pink themes (3.2:1 and 3.6:1, because of `opacity: 0.55`). **Fixed** (opacity 0.85).
- Names: no control without an accessible name; icon-only buttons all have `aria-label` from the string files in all three languages. No `<img>` elements exist (artwork is SVG with `aria-hidden`).
- Language: `<html lang>` follows the chosen language on every page (`i18n.apply()`).
- Focus: a visible 2 px outline (`--color-right`) for buttons, links, sliders, selects, and tool-specific controls; the Metronome BPM box shows focus with a coloured underline instead of an outline.
- Live regions: Piano chord readout, tuner/Pitch Detector/Pitch Training status (visually hidden, `aria-live="polite"`), Intervle and Ear Trainer feedback, Chordigits and Choordination chord announcements.
- Reduced motion: honoured in the hub, shared page styles, Piano, Metronome, Ear Trainer, Intervle, Choordination, Chordigits, the Vocal Tuner ball and the Instrument Tuner strings.
- Touch targets: every button is at least 44 px (page.css). Exceptions below. Footer links look small but have an enlarged tap area (`.tool-footer a::after`).

**Not changed: design decisions for Drephie**
- Small touch targets (under 44 px, but over 24 px, the WCAG 2.2 minimum): Piano's Hold, Ring and Drone buttons (about 42 px tall), Intervle's Easy/Medium/Hard tabs (40 px tall), Chordigits' title button (30 px), Choordination's name (24 px). They pass WCAG 2.1 AA (which has no size rule), not Apple's 44 px guideline.
- Choordination and Chordigits are camera instruments; their keyboard and button alternatives exist, but the **hand-tracking itself can't be used with a screen reader or without a camera and hands**. That is inherent to the tools.
- Pitch Detector, Pitch Training, Piano keys and canvases are visual instruments. They have text alternatives for status, not for the drawn lines.
- **Not verified:** keyboard-only operation was checked by reading the focus CSS and tab order in the markup, not by walking through every tool with the keyboard on a real screen reader (VoiceOver/NVDA). A real screen-reader pass would be the next step.
- Screenshots at desktop width were not re-checked in every theme beyond the automated audit; the release check (`tests/release-check.html`) covers phone sizes.

## 8. Other risks noticed

- **Recording screens and voices of others** (section 6).
- **GitHub account**: the site depends on GitHub Pages staying free and on `Drephie/open-music-tools` being public (needed for AGPL). Not a legal risk, but a continuity one.
- **Third-party CDNs could change or disappear** (Tone.js is pinned and has an SRI hash; jsDelivr, Google model files and the Salamander host are not hash-checked). Self-hosting fixes this too.
- **Beta tags and "as is"**: Choordination, Chordigits, Pitch Training and Intervle are Beta. The Terms say tools can be wrong.
- **Contact address**: until the placeholders are filled, people cannot reach you about privacy. Do this before launch.
