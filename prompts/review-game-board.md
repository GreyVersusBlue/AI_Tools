I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" (GitHub Pages site, custom domain via `CNAME`,
publicly known as AsPerMyLessonPlan.com). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Each tool's entry point is one `.html` file directly under `Tools/`.
- Supporting JS/assets for a tool live in a matching subfolder, e.g.
  `Tools/final-grade-checker/libs/` bundles jsPDF and xlsx.full.min.js for
  reading spreadsheet exports — that's the existing example of Excel-file
  parsing in this repo, reuse that library/pattern rather than adding a new one.
- Vendor third-party libraries locally under a `libs/`/`lib/` folder — no
  CDN-only dependencies.
- Update the root `README.md` tools table and `index.html` landing page (plus
  `index.html`'s DEV NOTES items 4/5/6 — memo/rev dates, changelog entry,
  record counts) to link the new tool once it's built. Also remove its
  `.row.soon` placeholder from `index.html`, and its entry from
  `IDEAS_BACKLOG.md` and `ideas-backlog.html`.

## The tool: Quiz / Review Game Board

Goal: a simple Jeopardy-style board for projector review games — categories
across the top, point values down each column, click a cell to reveal a
question, click again (or a button) to reveal the answer, and mark it used.

Requirements:
- Manual entry mode: type in categories, point values, and question/answer
  pairs directly in the tool.
- **Excel import**: let me upload an .xlsx template (reuse the xlsx.full.min.js
  library already vendored for Final Grade Checker) to populate the whole
  board at once instead of typing everything by hand. Design a simple template
  layout (e.g. one row per question: category, point value, question, answer)
  and document it in the tool itself (a "download a blank template" link or
  visible example is fine).
- Board should track which cells have been used/answered already this game
  (visually greyed out or checked off) and persist that during the session so
  a projector refresh doesn't reset progress mid-game.
- Simple scorekeeping is a nice-to-have (team names + running point totals you
  can bump up when a team answers correctly) — use your judgment on whether to
  include it now or leave it for a later pass; flag your decision.
- Should be readable from the back of the room, same bar as the Classroom Timer.

Ask me clarifying questions about the Excel template layout and scorekeeping
scope before building.
