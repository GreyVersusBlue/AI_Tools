I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" (GitHub Pages site, custom domain via `CNAME`,
publicly known as AsPerMyLessonPlan.com). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Repo-wide conventions are documented in `CLAUDE.md` at the repo root — read
  it first, and treat it as the authority if anything below conflicts with it.
  The rules that matter most when generating a new tool:
  - Third-party libraries come from `_shared/vendor/<name>/` — one canonical
    copy site-wide. Use the copy that's there; if the library isn't vendored
    yet, add it there, never as a per-tool copy and never from a CDN.
  - If the tool's subfolder needs a folder for remaining tool-specific
    vendored files, name it `lib/`, never `libs/`.
  - Link the shared boilerplate instead of inlining it: `_shared/theme.css`,
    `_shared/theme-toggle.js`, `_shared/a11y.css` + `_shared/a11y.js`, and
    `_shared/sw-register.js` for service-worker registration (see CLAUDE.md
    if that file doesn't exist yet).
  - Every file the tool adds must go into `PRECACHE_URLS` in `sw.js` with
    `CACHE_VERSION` bumped, or the tool silently breaks offline.
- Each tool's entry point is one `.html` file directly under `Tools/` (e.g.
  `Tools/036-final_grade_checker.html`, `Tools/007-Name Picker.html`).
- Supporting JS/assets for a tool live in a matching subfolder, e.g.
  `Tools/name-picker/` holds `np-store.js`, `np-pick.js`, fonts, and tests for
  `Tools/007-Name Picker.html`. Follow that pattern if the tool needs more than
  inline script.
- Shared save/load helper: `assets/js/gvb-save.js` for localStorage persistence
  (used by Name Picker, Seating Chart Generator).
- Vendor third-party libraries locally in `_shared/vendor/` — no CDN-only
  dependencies (school network can't be relied on).
- Update the root `README.md` tools table and `index.html` landing page (plus
  `index.html`'s DEV NOTES items 4/5/6 — memo/rev dates, changelog entry,
  record counts) to link the new tool once it's built. Also remove its
  `.row.soon` placeholder from `index.html`, and its entry from
  `IDEAS_BACKLOG.md` and `ideas-backlog.html`.

## The tool: Bracket / Tournament Generator

Goal: generate a single-elimination bracket for classroom review games or PE
tournaments — type in a list of names/teams, get a bracket you can run on a
projector and advance as rounds finish.

Requirements:
- Input: a simple list (one per line, or comma-separated) of contestant/team
  names. Support byes automatically when the count isn't a power of 2.
- Option to seed randomly (shuffle the input order) or seed in the order
  entered.
- Render the full bracket tree, readable on a projector. Clicking/tapping a
  matchup lets you pick the winner, which advances them to the next round —
  this should work live during class, not just print a static bracket.
- Persist bracket state (current round, picks so far) via localStorage so a
  refresh or reopening the tab doesn't lose progress mid-tournament.
- Printable/exportable view of the bracket (blank, for posting on a board) in
  addition to the interactive on-screen version.
- Should work for both a big single tournament (whole class) and smaller
  parallel brackets (e.g. multiple groups running their own bracket at once) —
  use your judgment on whether that's one tool instance per bracket or a
  bracket-switcher within the same tool; flag your choice.

Ask me clarifying questions about anything ambiguous before building.
