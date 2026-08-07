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
- Reuse jsPDF (already vendored) if a PDF export is worth adding; a print
  stylesheet may be simpler for a one-page worksheet — use your judgment.
- Update the root `README.md` tools table and `index.html` landing page (plus
  `index.html`'s DEV NOTES items 4/5/6) to link the new tool once it's built.
  Also remove its `.row.soon` placeholder from `index.html`, and its entry
  from `IDEAS_BACKLOG.md` and `ideas-backlog.html`.

## The tool: Math Fact Drill Sheet Generator

Goal: generate a randomized, printable timed-drill worksheet (math facts —
addition/subtraction/multiplication/division) with an answer key, instead of
reusing the same three worksheets all year.

Requirements:
- Operation selector (add/subtract/multiply/divide, or mixed) and a
  configurable number range for each operand (e.g. "multiplication facts,
  factors 1-12").
- Configurable problem count per sheet and page layout (e.g. columns of
  problems to fill a page cleanly for printing).
- Every "Generate" produces a freshly randomized sheet — no duplicate
  worksheets across a class without regenerating.
- Auto-generated **answer key** as a second printable page (or toggle-able
  view), matching the exact problems generated (store/reuse the same
  generated set, don't regenerate separately or the answers won't match).
- Print-friendly via an @media print stylesheet, sized to fill a standard
  letter page.
- **Future direction (design for this, don't necessarily build it all now)**:
  I want to eventually add different *templates* for different question types
  beyond basic facts (e.g. a fractions template, a word-problem template,
  an order-of-operations template) that could be quickly imported/selected
  rather than typed from scratch each time. Propose a template/config
  structure (e.g. a plain JS object or JSON per template describing operation
  type, ranges, and problem format) that makes adding a new template later a
  matter of adding one config entry, not rewriting the generator. Ship with
  just the basic-facts template for now unless you think a couple more are
  cheap to include.

Ask me clarifying questions about default ranges/layout and the
template-structure design before building.
