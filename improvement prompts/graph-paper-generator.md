# Improvement Prompts — Graph Paper & Number Line Generator

**Tool file:** `Tools/graph-paper-generator.html`
**Support folder:** `Tools/graph-paper-generator/` — `gpg-render.js`, `gpg-store.js`

**Current description (from README):** Printable graph paper (fill-the-page or exact grid size), number lines (single or several per page), and coordinate planes (four-quadrant or first-quadrant), all sized true-to-scale for printing.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Grid types: square, dot grid, **isometric** (line and dot), with sizes in
  real units (1/4", 1/2", 1 cm) or custom squares-per-inch
- Number lines — single or several per page, with configurable range
- Coordinate planes: four-quadrant or first-quadrant
- Portrait / landscape; true-to-scale printing (`gridSizeInches`,
  `isoSizeInches`)
- Named presets (`gvb-graph-paper:list` / `:data:*`), PNG download, print

## Quick Wins

- **Labelled axes and gridline numbering** as an option — a coordinate plane
  students can actually plot on without counting squares.
- **A title/name/date header block** on the sheet.
- **Print-margin verification.** "True to scale" is the tool's core promise
  and it depends on the browser not scaling to fit; a printed calibration
  ruler on a test page would let a teacher confirm it once per printer.
- **More grid types**: hexagonal, polar, log/semi-log, engineering (5 squares
  per inch), Cornell-notes ruling, handwriting lines with a dashed midline,
  storyboard boxes, music staff.
- **Multiple small planes per page** (four coordinate planes on one sheet) —
  the most common actual worksheet format, and only number lines support
  per-page multiples today.
- **Faded / light-grey gridlines** so student pencil work stands out, and an
  ink-saving mode.

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
