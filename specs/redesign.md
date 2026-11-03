# Redesign: fonts, themes and layout

**Status:** approved by Drephie (2026-11-03): seven themes, JetBrains Mono for Retro CRT. Build carefully for space: nothing cut off, nothing wider than the screen. Preview of the seven themes with their real fonts: https://claude.ai/artifact/N2KCL1WwdMSB9r9AZo2chh (private to Drephie).

## What it is for

Drephie finds the fonts sterile, the palettes boring and the layout sloppy. This replaces the look of the whole hub (home page and every tool) before the first public launch. Nothing about what the tools do changes, and no wording changes.

## Fonts

- All from Fontshare's **Open Source** shelf (SIL Open Font License 1.1), served from our own site (`shared/fonts/`), unchanged files, each with its `OFL-*.txt`.
- Not Fontshare's own "Closed Source" fonts (ITF Free Font License): section 02 forbids making the files available through a "repository" or "publicly accessible servers", and our code is a public GitHub repository.
- Not the faces Impeccable lists as default AI picks (Lora, Crimson, Space Grotesk, Outfit, Plus Jakarta Sans).
- Each theme gets a title font (`--font-display`, also big numbers) and a reading font (`--font-main`). Monochrome adds a number font (`--font-num`).
- Labels in sentence case; capital titles only in Y2K and Retro CRT.

| Theme | Titles | Text | Colours |
|---|---|---|---|
| Liquid Glass (refined) | Familjen Grotesk | Familjen Grotesk | night blue, ice-blue accent |
| Y2K (refined) | Rajdhani | Sora | midnight, cyan, bubblegum pink, chrome title |
| Soft Pink (recoloured) | Roundo | Nunito | Drephie's palette: F7D7EC, E987CF, D83BA8, 8E1F6A, 461132 |
| Monochrome (refined) | Archivo | Archivo, numbers Azeret Mono | black and white |
| Retro CRT (refined) | JetBrains Mono | JetBrains Mono | green phosphor, amber |
| **Rouge** (new, spooky) | Literata | Epilogue | Drephie's palette: C52233, A51C30, A7333F, 74121D, 580C1F, bone-white text |
| **Retrosnap** (new, instant photo) | Red Hat Display (Kalam until Drephie found it dated, 2026-11-03) | Asap | Drephie's palette: 004777, A30000, FF7700, EFD28D, 00AFB5 |

Retrosnap is our own name; no camera brand is named or imitated. Every text colour is checked for contrast (4.5:1 for text, 3:1 for big text and controls).

## Layout rules (Apple's layout guidance, for the web)

- Most important first: the main control near the top. Related controls grouped in one panel.
- One spacing scale (4, 8, 12, 16, 24, 32 px) and one radius scale per theme, as variables in `themes.css`.
- Side margins 16 px on phones, 24 px on computers, plus the safe areas (`env(safe-area-inset-*)`).
- Touch targets at least 44 × 44 px.
- Adapt to the space, not the device: one column when narrow; wide windows may show more side by side (Pitch Training's and the Pitch Detector's settings beside the graph). Every tool works the same at every size.
- Ready for long words and big text: rows wrap or stack, long dropdown names end in "…". No sideways scrolling, in any language.
- On computers no important control at the very bottom of the window.
- Thinner theme frames (Monochrome's 60 px bands go).

## Order of work (one commit per step)

1. `shared/fonts/` (12 fonts in, the old 5 out) and `themes.css` (7 themes, new variables, spacing and radius).
2. `shared/ui/page.css`, `select.css`, modal: header, panels, buttons, rows, dropdowns, windows.
3. Theme names Rouge and Retrosnap in en/es/it (`shared/ui/strings.js`) and in every theme picker; `tests/release-check.html` and `release-check.sh` learn the 7 themes.
4. Home page, then Metronome, Piano, Ear Trainer, Vocal Tuner, Instrument Tuner, Pitch Detector, Pitch Training.
5. Choordination: colours, fonts and decorations for the new themes. A deeper layout change of its camera stage: a session of its own later.
6. The two known bugs (Pitch Training's dropdown in Spanish and Italian, Choordination's watermark), checked again with the new fonts.
7. `sw.js`: new font files in `APP_SHELL` (not published yet, so no cache bump needed). README and About credits name the new fonts.

## How we check it

- `tests/release-check.html` in 7 themes × 3 languages at 375 × 667 and 390 × 664: no overflow, no cut-off text, no missing strings. `bash tests/tools/release-check.sh` passes.
- A screenshot of each tool at phone size in each new theme for Drephie.
- At the end, the Impeccable skill grades the result (critique and audit).
- Drephie's phone test on the live site: the look in each theme, and nothing hard to read in sunlight.

## Open choices for Drephie

1. Keep all five current themes (refined) plus Rouge and Retrosnap, seven in all? (Recommended.)
2. Retro CRT: JetBrains Mono (from Fontshare, recommended), or keep the pixel font VT323 as the one exception?
