I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" at `C:\Users\devon\OneDrive\Documents\GitHub\AI_Tools`
(GitHub Pages site, custom domain via `CNAME`). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Each tool's entry point is one `.html` file directly under `Tools/` (e.g.
  `Tools/final_grade_checker.html`, `Tools/Name Picker.html`).
- Supporting JS/assets for a tool live in a matching subfolder, e.g.
  `Tools/name-picker/` holds `np-store.js`, `np-pick.js`, fonts, and tests for
  `Tools/Name Picker.html`. Follow that pattern if the tool needs more than
  inline script.
- Shared dark-mode/theme tokens live in `_shared/theme.css` and
  `_shared/theme-toggle.js` — load these so the new tool matches the rest of
  the site visually instead of inventing its own palette.
- There's already a `Tools/docx-merger.html` tool in this repo that merges Word
  docs client-side — look at how it handles `.docx` generation/reading in the
  browser (likely via a JS library bundled locally, not a CDN-only dependency)
  and reuse that approach rather than introducing a new docx library if one is
  already vendored.
- Update the root `README.md` tools table and `index.html` landing page to link
  the new tool once it's built.

## The tool: Sub Plan Builder

Goal: cut down the time it takes me to write substitute teacher plans for a
missed day.

I'm going to paste or attach a few real sub plans I've written by hand in this
chat right after this prompt. Read them carefully first — don't design the tool
until you've seen them. I want us to find a middle ground between "fully
freeform text box" and "rigid form with fields I don't actually use" — base the
structure on what's actually consistent across my real examples (recurring
sections, tone, level of detail, what info a substitute actually needs) rather
than guessing at a generic template.

Requirements I already know I want, but let the examples refine these:
- Input should be quick to fill out for a teacher in a hurry (dropdowns/text
  fields for the parts that repeat every time: date, class periods, general
  schedule, where materials are, emergency procedures/contacts, seating chart
  reminder, behavior expectations) plus freeform space for the actual lesson
  instructions, since those change every time.
- Whatever I fill in should be able to persist in the browser (localStorage)
  between sessions, since a lot of the boilerplate (schedule, room number,
  emergency contacts) doesn't change day to day and I don't want to retype it
  every time.
- Output needs to export as a Word document (.docx) that's ready to print or
  email, formatted cleanly — not just a plain text dump.
- No student names or other sensitive data should be required or hard-coded;
  keep whatever FERPA-relevant fields optional and clearly local-only.

Ask me clarifying questions if the examples don't make something obvious.
