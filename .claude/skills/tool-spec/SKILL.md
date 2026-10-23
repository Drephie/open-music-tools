---
name: tool-spec
description: Write the one-page plan (spec) for a new Open Music Tools tool and get Drephie's approval before any code. Use at the start of every new tool in ROADMAP.md, or when Drephie asks to plan or redesign a tool.
---

# Tool spec

Every new tool starts with a one-page spec that Drephie approves. No tool code before the approval.

Drephie is a singer and vocal coach, not a developer. Write and ask in plain words, and explain any technical or music-theory term the first time it appears (for example "subdivisions: soft clicks between the beats").

## 1. Read first

- `CLAUDE.md` (principles, conventions) and the tool's row and phase in `ROADMAP.md`, including "Parked or dropped" so nothing dropped comes back.
- The API header comments of the `shared/` modules the tool will use (not their implementations).
- Earlier specs in `specs/` for the shape and the level of detail.

## 2. Ask the open choices

Use AskUserQuestion, up to 4 questions per round, usually 2 rounds. Each question:
- is about what the person using the tool sees, hears or does, never about code;
- gives 2 to 4 concrete options, the recommended one first with "(Recommended)";
- uses examples a singer knows (a waltz is 3 beats, "1-and-2-and").

Typical choices: the main controls and their ranges, what is on by default, what you see while it runs, extras for the first version versus later, what is remembered next time (settings in `localStorage` only, never people's work), footer and About window.

When Drephie answers "no preference", pick, and mark those picks in the spec so they can be changed at approval.

## 3. Write the spec

Save it as `specs/<tool>.md`. One page: about 80 lines, short sentences, no code. Sections:

1. **Status**: draft, or approved with the date.
2. **What it is for**: one or two sentences, who uses it and when.
3. **What it does**: the first version's features.
4. **Not in this version**: what was left out or postponed, so it isn't built by accident.
5. **Controls**: each control with its range and default.
6. **Layout**: phone (portrait, about 375 px wide) and desktop, top to bottom. Touch-first, then mouse and keyboard (shortcuts if any).
7. **Wording**: the main labels in English. Spanish and Italian come at build time; every string goes through i18n.
8. **Remembered**: what is saved in the browser and what starts fresh.
9. **Built on**: the shared modules it uses, and any change to them (the module's API header gets updated with it).
10. **Privacy and credits**: what stays on the device (everything) and any third-party sound, sample, font or model with its license.
11. **How we check it**: what Claude verifies in the browser (5 themes, 3 languages, phone width, `tests/theory.html`), and the listening checklist for Drephie, because Claude can't hear.

## 4. Get approval

- Show the spec, plus a small visual mock-up of the phone and desktop layouts when the layout is new.
- Ask for approval with AskUserQuestion: approve, or say what to change. Revise until approved.
- Set the status to "Approved (date)", commit the spec on its own, then start building.
