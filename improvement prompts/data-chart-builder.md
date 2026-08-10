# Improvement Prompts — Data Table → Chart Builder

**Tool file:** `Tools/data-chart-builder.html`
**Support folder:** none — single file

**Current description (from README):** Paste a table from a spreadsheet or lab notebook, pick the columns, and get a bar, line, pie, or scatter chart with quick descriptive stats — download as PNG or SVG.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Paste or load a table; tolerant parsing (`splitLine`, `parseTable`,
  `detectNumericColumns`) with a live preview
- Chart types: **bar, line, pie, scatter, box plot** (`buildBoxData`,
  `quartiles`) — the README undersells this
- Column selection, multi-series (`getCheckedValueCols`), legend, axis labels
- Descriptive stats (`medianOf`, `quartiles`, `linearRegression` — there's a
  trendline in here)
- Download **PNG and SVG**; saved datasets (`data-chart-builder-datasets`) and
  remembered settings

## Quick Wins

- **Chart titles and axis labels that print.** The single most common reason a
  student chart gets marked down.
- **Colour-blind-safe default palette** and a grayscale/print-safe mode (P6).
  Classroom printers are black and white; two blue bars are one bar.
- **Show the trendline you already compute.** `linearRegression` exists;
  surfacing R² and the equation makes this immediately useful for a science
  lab write-up.
- **Error bars** — the other thing a lab chart needs and no free tool makes
  easy.
- **Copy chart to clipboard as an image**, so it can go straight into a slide
  or a doc without a download step.
- **Bigger/print layout preset.** Charts get projected; a projector preset
  (thick lines, large type) and a print preset would both get used.
- **Undo / confirm on Delete dataset** (P11).

## Major Features

- **Printed worksheet output** (teacher-generated handout, not a
  student-operated mode). Print the chart with a blank axis for
  students to complete, or print the data table with a blank grid — turning a
  charting tool into a worksheet generator, which is the classroom shape of
  this need (P6).
- **Histogram and frequency table.** `grade-distribution-visualizer.html`
  already builds histograms; that logic belongs here, with the grade tool
  consuming it (P7). Right now two tools bucket numbers independently.
- **Two-variable analysis.** Scatter with trendline exists; correlation
  coefficient, residuals, and "is this linear?" prompts would make it a real
  data-literacy tool for a middle school science or math class.
- **Templates by subject.** A lab data template (trial, measurement, average),
  a survey template, a grade template — each with the right chart type and
  stats preselected (P15).
- **Chart annotation.** Arrows, labels, a shaded region, a "line of best fit"
  callout — the difference between a chart and a chart that makes an argument.
- **Multiple charts on one printed page**, for a lab report or a comparison.
- **XLSX import** (P13). Currently CSV-ish paste only; `final_grade_checker.html`
  and `review-game-board.html` already vendor SheetJS and could share it.

## Moonshot / North Star

**The classroom's data-literacy workbench.** Paste anything — lab results, a
class survey, census data, a table off a website — and move fluidly between
seeing it, questioning it, annotating it, and printing it as either a finished
figure or a student worksheet. Every chart is exportable, every stat is
explained in words a 12-year-old can read, and nothing is uploaded anywhere.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-operated charting.** Students pasting their own lab data into the
  tool on their own devices. The tool is for the teacher building figures and
  worksheets; a student needing to chart lab data should be doing it in
  whatever the class already uses.

## Platform themes that matter here

- **P7 (cross-tool)** — should become the site's charting engine; Grade
  Distribution and Behavior Trends both want it.
- **P6 (print quality)** — grayscale-safe output is a correctness issue, not
  a polish issue.
- **P13 (import surfaces)** — XLSX parity with the two tools that already have
  it.
- **P4 (accessibility)** — charts need a text/table alternative and shouldn't
  encode meaning in colour alone.

## Open Questions

- Is the audience here the teacher (making a figure for a handout) or the
  student (analyzing their own lab data)? The two want fairly different UIs
  and it's worth choosing a primary.
- Should this absorb the histogram work in Grade Distribution Visualizer, or
  stay separate and be called by it?
