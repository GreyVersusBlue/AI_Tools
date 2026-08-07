I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" (GitHub Pages site, custom domain via `CNAME`,
publicly known as AsPerMyLessonPlan.com). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Each tool's entry point is one `.html` file directly under `Tools/`.
- Supporting JS/assets for a tool live in a matching subfolder if needed.
- Reuse jsPDF (already vendored) or a print stylesheet for output.
- Update the root `README.md` tools table and `index.html` landing page (plus
  `index.html`'s DEV NOTES items 4/5/6) to link the new tool once it's built.
  Also remove its `.row.soon` placeholder from `index.html`, and its entry
  from `IDEAS_BACKLOG.md` and `ideas-backlog.html`.

## The tool: Vocabulary Flashcard & Word Wall Generator

Goal: turn a word list into printable flashcards or word-wall cards instead
of hand-formatting them in a document every unit.

Requirements:
- Input: a list of term + definition pairs (paste in a simple format like
  "term: definition" per line, or a small form-based table editor — pick
  whichever is faster to use and build).
- Two output modes:
  - **Flashcards**: term on one side, definition on the other, sized to print
    and cut out (e.g. index-card sized, multiple per page with cut lines).
    Since this is print-only (no physical double-sided printing guarantee),
    lay out fronts and backs on separate pages/sections in a way that lines
    up if printed double-sided, and note that in the UI.
  - **Word wall cards**: single-sided, larger, bold term (readable from across
    the room when posted on a wall), with the definition optional/smaller.
- Configurable card size/count-per-page for both modes.
- Persist word lists via localStorage so a saved unit's vocab list can be
  reopened and reused/edited later, same pattern as Sub Plan Builder's saved
  boilerplate.
- Print-friendly via an @media print stylesheet.

Ask me clarifying questions about card sizing/layout before building.
