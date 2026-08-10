# Improvement Prompts — 012 — Graph Paper & Number Line Generator

**Tool file:** `Tools/graph-paper-generator.html`
**Support folder:** `Tools/graph-paper-generator/` — `gpg-render.js`, `gpg-store.js`

**Current description (from README):** Printable graph paper (fill-the-page or exact grid size), number lines (single or several per page), and coordinate planes (four-quadrant or first-quadrant), all sized true-to-scale for printing.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

### Round 3 (2026-08-10) — shipped

- **Labelled gridlines** for square graph paper: an opt-in "Number the
  gridlines" checkbox with a "label every Nth line" interval, numbering
  columns along the bottom and rows along the left edge (row 0 at the
  bottom, increasing upward — matches how a plotted grid reads). Labels
  stay full ink even in ink-saving mode; a small reserve band keeps them off
  the physical page margin.
- **Header block** (title + optional Name/Date fill-in line) shared across
  all four modes — graph paper, number line, coordinate plane, isometric.
  Implemented once in `gpg-render.js` (`headerBlockHeight`/`headerSvg`) and
  threaded through every render call rather than reimplemented per mode.
- **Ink-saving mode**: a "lighter gridlines" toggle. Implemented by giving
  the SVG root a `color="#1a1a1a"` attribute and having every line/dot/text
  element paint with `fill/stroke="currentColor"`, then wrapping the
  fadeable content (not the header, which stays full-ink for legibility) in
  a `<g color="...">` override — one wrap per render function instead of
  touching every element's own color attribute.
- **Multiple coordinate planes per page** (1/2/4/6, `PLANE_LAYOUTS`) — the
  "four quadrants on one worksheet" format called out as the most common
  actual use. Refactored the single-plane math in `renderCoordinatePlane`
  into `onePlaneSvg(opts, originX, originY, w, h)` so it renders into an
  arbitrary sub-rectangle; the multi-copy path just tiles that helper across
  a grid the same way the graph-paper contact-sheet logic in
  `image-to-pdf.html` tiles images. Axis-label font size shrinks
  automatically when a cell is narrow.

All four changes are additive to `gpg-render.js`'s existing opts shape — old
callers with no `header`/`faded`/`labelAxes`/`copies` fields get identical
output to before (verified in Node by calling all three render functions
with old-style and new-style opts and diffing/checking for `NaN` in the
output), and visually in a headless Chromium run of the actual tool for both
the labelled/header/faded square-grid case and the 4-plane case.

### Challenges

- No test harness exists for this tool (no `Tools/graph-paper-generator/test/`
  the way `Tools/schedule` has one). Verified correctness by calling
  `GraphPaperRender.*` directly in Node (checked returned `cols`/`rows`/
  `copies` and scanned the SVG string for `NaN`) and by a headless Playwright
  screenshot of the live tool. Worth adding a small Node smoke test near
  `gpg-render.js` in a future round since it's pure functions with no DOM
  dependency — cheap to test properly.
- `renderCoordinatePlane`'s return value used to include `xTicks`/`yTicks`;
  multi-plane made a single tick count meaningless so it now returns
  `copies` instead. Confirmed nothing in `graph-paper-generator.html` reads
  those fields (only `.svg` is consumed) before removing them.
- The axis-label reserve band (0.22in) is a fixed constant rather than
  computed from the actual label text width; at very large custom grids
  (many digits) it's plausible a long row number could still nudge close to
  the reserved margin. Not observed in testing at realistic sizes.

### Where the next round should pick up

- **Worksheet mode** (Major Feature: a problem printed above each small
  plane, with an answer key) is the natural next step now that multi-plane
  layout exists — the tiling and answer-key machinery are the hard parts and
  are now half-built.
- More grid types (hex, polar, log/semi-log, Cornell notes, handwriting
  lines, storyboard, music staff) are still open and are independent of
  everything shipped this round.
- Pre-plotted content (a line/curve/point set drawn onto the grid before
  printing) is still open and is the highest-value Major Feature remaining.

## What it does today

- Grid types: square, dot grid, **isometric** (line and dot), with sizes in
  real units (1/4", 1/2", 1 cm) or custom squares-per-inch
- Number lines — single or several per page, with configurable range
- Coordinate planes: four-quadrant or first-quadrant
- Portrait / landscape; true-to-scale printing (`gridSizeInches`,
  `isoSizeInches`)
- Named presets (`gvb-graph-paper:list` / `:data:*`), PNG download, print

## Quick Wins

- **Done —** **Labelled axes and gridline numbering** as an option — a coordinate plane
  students can actually plot on without counting squares. *(Shipped Round 3
  as "Number the gridlines" — an opt-in labelled-Nth-line option for square
  graph paper.)*
- **Done —** **A title/name/date header block** on the sheet. *(Shipped Round 3, shared
  across all four modes via `gpg-render.js`'s `headerBlockHeight`/`headerSvg`.)*
- **Print-margin verification.** "True to scale" is the tool's core promise
  and it depends on the browser not scaling to fit; a printed calibration
  ruler on a test page would let a teacher confirm it once per printer.
- **More grid types**: hexagonal, polar, log/semi-log, engineering (5 squares
  per inch), Cornell-notes ruling, handwriting lines with a dashed midline,
  storyboard boxes, music staff.
- **Done —** **Multiple small planes per page** (four coordinate planes on one sheet) —
  the most common actual worksheet format, and only number lines support
  per-page multiples today. *(Shipped Round 3 as `PLANE_LAYOUTS` — 1/2/4/6
  planes per page.)*
- **Done —** **Faded / light-grey gridlines** so student pencil work stands out, and an
  ink-saving mode. *(Shipped Round 3 as the "lighter gridlines" ink-saving
  toggle.)*

## Major Features

- **Pre-plotted content.** Draw a line, a parabola, a set of points, or a
  shape onto the grid before printing — so the tool produces worksheets, not
  just paper. A small expression parser (the one in
  `number-talks-board.html` already tokenizes and evaluates arithmetic) could
  plot `y = 2x + 3` directly.
- **Worksheet mode.** N small coordinate planes on a page, each with a
  different problem printed above it, plus an answer key with the correct
  graph drawn. This turns a paper generator into a graphing-worksheet
  generator, which is a much bigger deal.
- **Isometric and dot paper for other subjects** — technical drawing, 3D
  volume nets, perspective grids for art.
- **Graph paper with a data table beside it**, for science labs — the exact
  page a lab handout needs and nobody generates.
- **A grid the student can also use on screen** via a share link (P3) — plot
  points on a device, print the result.

## Moonshot / North Star

**Any grid, any scale, any subject — with the problem already on it.** Not
just blank paper, but the exact printable page a lesson needs: four labelled
planes with four problems, an isometric net for a volume unit, a semi-log
plot for a science lab, or a number line marked with the fractions today's
lesson is about — with an answer key, true to scale, on one sheet.

## Platform themes that matter here

- **P6 (print quality)** — scale fidelity is this tool's entire value
  proposition and depends on print settings the tool can't control; a
  calibration affordance would be a real contribution.
- **P7 (cross-tool)** — plotting would pull in expression parsing that already
  exists on the site; answer keys are a shared pattern.
- **P15 (first run)** — presets exist, but a gallery of "common sheets" would
  land better than a form.

## Open Questions

- Is the audience "give me paper" or "give me a worksheet"? The tool is
  excellent at the first; the second is where most of the remaining value is,
  and it's a meaningfully different product.
- Should pre-plotted graphing live here, or in a separate graphing tool that
  reuses this renderer?
