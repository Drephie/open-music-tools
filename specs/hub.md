# Home page (hub): spec

**Status:** approved by Drephie, 2026-10-24 (after one change: every tool a square card of the same size, the planned ones greyed out with descriptions, and the page may scroll).
Items marked *(Claude's pick)* weren't asked: say if you want them changed.

## What it is for

The front door of the hub: one page at the site's main address that shows every tool, so anyone can find a tool and open it in one tap. It also shows what is coming next.

## What it does

- **Your logo at the top**, cleaned up from your sketch (version A: a circle with two black piano keys hanging from a curved top and three lines between the white keys), in one color that follows the theme: light blue in Liquid Glass, cyan in Y2K, pink in Soft Pink, white in Monochrome, green in Retro CRT. The browser-tab icon is the same logo in your sketch's blue on black *(Claude's pick)*.
- Under it, the name **Open Music Tools** (still the placeholder, kept in one place so it is easy to change), one line "Free music tools to learn, practise and make your own music." and, smaller, "Everything runs on your device: nothing is uploaded, no ads, no trackers."
- **The tool selector:** every tool is a **square card of the same size**: a small drawing in the theme's colors, the name, and a short plain description. The name always fits inside its card (long names go on two lines, or get a little smaller; all names share one size).
  - First the **4 finished tools**, which open when you tap them. Order *(Claude's pick)*: Piano, Ear Trainer, Metronome, Choordination.
  - Then, under the heading **"Coming soon"**, the **7 planned tools as greyed-out cards** with their descriptions (we adjust them as each tool takes shape): Tuner, Pitch Detector, Pitch Training, BPM Finder, Chord Finder, Practice Player, Jam Machine (the order of the plan). They don't open anything or react to taps *(Claude's pick)*. When a tool is finished, its card lights up and moves up with the others.
  - The home page **may scroll** on a phone (Drephie, at approval: many tools are coming).
- **One theme and one language for the whole hub.** Choosing them on the home page, or in any tool, changes them everywhere, Choordination included (today it always starts in Liquid Glass and English). What you already chose in the Metronome, Piano or Ear Trainer is kept: the first tool you open after the change passes its choice on to the others. Going back to a page you had open shows the new choice there too.
- **A home button in every tool**: a round house button at the left of the title bar of the Metronome, Piano and Ear Trainer, and a "Home" button in Choordination's menu. On a sideways phone the Piano's house sits with its (i) and ⚙ buttons *(at build time, if there's room; otherwise in its Settings)*.
- **No Patreon pop-up on the home page** *(Claude's pick)*: people only pass through it, so the window that opens after 30 s untouched stays in the tools. The footer link and the About window have the Patreon button.

## Not in this version

A search box or tool categories (not needed for 11 tools); news or a changelog; a "last used tool" shortcut; install and offline (Phase 6); the final name, domain and repository link (open decisions in the roadmap).

## Layout

**Phone, upright.** The page scrolls (the one page in the hub that may). About (i) and Settings (⚙) sit in the top right corner, beside the logo. Cards two per row.

```
                        (i) (⚙)
            ( logo )
        OPEN MUSIC TOOLS
  Free music tools to learn, practise
     and make your own music.
  Everything runs on your device: …
┌──────────────┐ ┌──────────────┐
│ [keys]       │ │ [ear]        │
│ PIANO        │ │ EAR TRAINER  │
│ Play, and see│ │ Lessons and a│
│ the name of  │ │ game to train│
│ the chord    │ │ your ear     │
└──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐
│ METRONOME    │ │ CHOORDINATION│
└──────────────┘ └──────────────┘
COMING SOON
┌──────────────┐ ┌──────────────┐
│░TUNER░░░░░░░░│ │░PITCH░░░░░░░░│
│░(greyed)░░░░░│ │░DETECTOR░░░░░│
└──────────────┘ └──────────────┘
   … Pitch Training, BPM Finder, Chord Finder,
     Practice Player, Jam Machine …
Support on Patreon      Designed by @drephie
```

**Computer:** the same in a centered column, four cards per row (fewer on a narrow window). Keyboard: Tab goes through the finished cards, Enter opens one.

**Settings (⚙):** Theme and Language, with a small note "Used by every tool". **About (i):** the hub text (free and open source, by Drephie, the tools help you make your own music, no AI-made music, the privacy line) and the Patreon button.

## Wording (English)

Descriptions *(Claude's picks; you check the words)*: Piano "Play, and see the name of the chord"; Ear Trainer "Lessons and a game to train your ear"; Metronome "A steady click to practise with, and tap tempo"; Choordination "Play chords with your hands, using your camera. Nothing leaves your device." Coming soon: Tuner "Tune your voice or instrument: see if a note is too high or too low"; Pitch Detector "See the note you sing, live, and how your pitch moves"; Pitch Training "Singing exercises that show how in tune you are"; BPM Finder "Find the speed (BPM) of a song you own"; Chord Finder "Find the key and the chords of a song you own"; Practice Player "Slow a song down without changing its pitch, and loop a part"; Jam Machine "Chord progressions in many styles to play and sing over". Coming soon; Home (the house button). Spanish and Italian come at build time, with the tool names already used (Metrónomo/Metronomo, Oído musical/Orecchio musicale).

## Remembered

Only the theme and the language, now shared by every tool, in this browser. Nothing else is saved, and nothing is stored about which tools you open.

## Built on

- `shared/ui/` page parts, themes, translations, dropdowns and windows. `page.js` gains the shared theme and language (with the move of what each tool saved), and its header describes it; the hub strings gain "Home". Each tool reads and saves the shared choice.
- The hub service worker (`/sw.js`): the home page's files are added and the version bumped.

## Privacy and credits

Nothing is recorded or uploaded; the page makes no sound and uses no camera. The logo is yours; the small drawings are drawn for the hub (no third-party icons or fonts beyond the themes' Google Fonts).

## How we check it

**Claude:** 5 themes, 3 languages, phones 375 × 667 and 390 × 664, and a computer; every name inside its card; keyboard only; every card opens its tool and every tool's house button comes back; theme and language chosen on the home page show in every tool and back again (also with the browser's back button); what each tool had saved is kept; Choordination still loads and its menu works; `tests/theory.html` and `tests/transport.html` pass.

**Drephie, on the phone:** the logo; the cards and scrolling; each card opens its tool and the house brings you back; change the theme and language in one tool and see the others follow; the wording in all three languages.
