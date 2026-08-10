I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" at `C:\Users\devon\OneDrive\Documents\GitHub\AI_Tools`
(GitHub Pages site, custom domain via `CNAME`). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Each tool's entry point is one `.html` file directly under `Tools/` (e.g.
  `Tools/036-final_grade_checker.html`, `Tools/007-Name Picker.html`).
- Supporting JS/assets for a tool live in a matching subfolder, e.g.
  `Tools/name-picker/` holds `np-store.js`, `np-pick.js`, fonts, and tests for
  `Tools/007-Name Picker.html`. Follow that pattern here — this tool clearly needs
  more than inline script given the persistence requirement below.
- There's already a tool pair in this repo, `Tools/035-schedule-visualizer.html`
  and `Tools/034-schedule-browser.html`, where the visualizer is the authoring tool
  and the browser is the read-only published output. Look at that pair first —
  the school calendar visualizer I want is conceptually similar (a
  build-it-yourself visual layout tool over school-year data) and may share
  useful patterns for layout, publishing, or data structure even though the
  content (calendar vs. room/teacher map) is different.
- Shared dark-mode/theme tokens live in `_shared/theme.css` and
  `_shared/theme-toggle.js` — load these so the new tool matches the rest of
  the site visually instead of inventing its own palette.
- Update the root `README.md` tools table and `index.html` landing page to link
  the new tool once it's built.

## The tool: School Calendar Visualizer

Goal: a better way to see and plan against my school year than a flat list —
something I can build once from a template and reuse, that shows the shape of
the year at a glance (marking periods, holidays, half days, testing windows,
grading periods, etc.) so I can lay curriculum pacing against it.

I'm going to give you my expected school calendar (dates for the school year —
start/end, holidays, half days, breaks, etc.) in this chat. Wait for that data
before finalizing the visual design, but you can start on structure/scaffolding
now.

Requirements:
- Start from a **template**: a reusable base structure for a school year
  calendar (months, weeks, day cells) that I can customize with my actual
  dates rather than building a calendar from scratch each year.
- Let me mark/tag days or ranges with types (holiday, half day, no school,
  teacher workday, grading period boundary, testing window, etc.) and pick a
  visual treatment (color/pattern) per type — should be legible printed in
  black and white too, not color-only.
- Must **persist between browser sessions** via localStorage — this is
  explicitly the pain point with what I have now (a flat list that doesn't
  stick around or visualize well). Follow the storage patterns already used in
  this repo (see `Tools/name-picker/np-store.js` for how they version/store
  data and handle a blocked-storage fallback).
- Some kind of print or export view (PDF via browser print, or an image
  export) so I can post a clean version somewhere physical or share it with
  colleagues, even though the working/editing view can stay interactive-only.
- No student data of any kind touches this tool — it's schedule/calendar
  structure only.

Ask me clarifying questions about the level of detail (e.g. do I want to lay
individual lesson/unit blocks onto it, or just mark the calendar structure
itself) before committing to a data model, since that changes how complex the
underlying storage needs to be.
