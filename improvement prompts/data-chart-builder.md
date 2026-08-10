# Improvement Prompts — Data Table → Chart Builder

**Tool file:** `Tools/data-chart-builder.html`
**Support folder:** none — single file

**Current description (from README):** Paste a table from a spreadsheet or lab notebook, pick the columns, and get a bar, line, pie, or scatter chart with quick descriptive stats — download as PNG or SVG.

---

## Status

**2026-08-10 — implementation round.** Of the five Quick Wins scoped for
this round, two ("chart titles and axis labels that print" and "show the
trendline you already compute") turned out to **already exist** — verified
in the source (`chartTitleEl()`, `drawYAxisLabel()`, and the R²/equation
line in `drawScatterChart()` all predate this round) rather than rebuilt.
The other three — colorblind-safe palette + grayscale mode, error bars, and
a printed blank worksheet (pulled up from Major Features since time
allowed) — shipped new this round. Everything is additive: existing saved
settings/datasets are unaffected, since none of this touches
`localStorage` shapes.

What shipped, in order of the Quick Wins list:

- **Chart titles and axis labels that print** — **already existed.**
  `chart-title` and `y-axis-label` inputs, `chartTitleEl()`, and
  `drawYAxisLabel()` were already wired into every chart type before this
  round. Nothing built.
- **Colorblind-safe default palette, plus a grayscale/print-safe mode** —
  the default series palette (`PALETTE_HEX`, and the matching `--seriesN`
  CSS variables) became the Okabe–Ito colorblind-safe categorical set. A
  new "Grayscale / print-safe colors" checkbox swaps every series to a
  lightness-ramped grayscale array instead (`GRAYSCALE_HEX`, via a new
  `paletteColor(i)` used everywhere a series/box color used to read
  `PALETTE_HEX` directly), and line charts additionally vary dash pattern
  per series in that mode (`DASH_PATTERNS`) so two overlapping gray lines
  of similar lightness stay distinguishable.
- **Show the trendline you already compute** — **already existed.**
  `linearRegression()` already returned `r2`, and `drawScatterChart()`
  already rendered the line plus an `eq` string reading
  `y = mx + b  (R² = ...)`. Nothing built.
- **Error bars** — a "± value column" picker (`renderErrorBarConfig()`)
  appears per checked value column when "Error bars" is checked, listing
  the other numeric columns to pair as an uncertainty value. Bar and line
  charts both draw a capped vertical error bar (`errorBarSvg()`) at each
  bar/point using the paired column's value, honoring the same sort order
  as the series itself.
- **Printed worksheet output** (pulled up from Major Features) — a "Print
  blank worksheet" button builds the current bar/line chart's axes, title,
  and category/axis labels with **no bars, lines, points, or values** —
  just the frame a student plots onto by hand — plus a Name/Date header
  line, and prints it via the same `#print-area`/`body.printing` pattern
  used elsewhere on the site. Scoped to bar and line charts only (the two
  with a category axis `drawAxes()` already knows how to draw); picking
  pie/scatter/box shows a message instead of a broken print. The
  "print the data table with a blank grid" half of this idea (see Major
  Features below) was not attempted.

Verified with a headless jsdom pass: pasting data, checking error-bar
columns, toggling grayscale, and clicking "Print blank worksheet" all
produce the expected SVG content (error-bar strokes present, grayscale hex
present in fills, the blank-worksheet SVG contains axes/gridlines/category
labels and genuinely no bar/line/point marks), and switching to Pie before
printing shows the graceful decline message instead of printing garbage.

Not attempted this round, and explicitly out of scope per the task: **copy
chart to clipboard**, **bigger/print layout preset**, and **undo/confirm on
Delete dataset** (all Quick Wins in the backlog below), and everything else
under Major Features / Moonshot.

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

- **Done — already existed.** **Chart titles and axis labels that print.** The single most common reason a
  student chart gets marked down. *(Predates this round — verified, not
  rebuilt.)*
- **Done —** **Colour-blind-safe default palette** and a grayscale/print-safe mode (P6).
  Classroom printers are black and white; two blue bars are one bar.
  *(Okabe–Ito palette by default; a "Grayscale / print-safe colors" toggle
  swaps to a lightness ramp plus per-series line-dash patterns.)*
- **Done — already existed.** **Show the trendline you already compute.** `linearRegression` exists;
  surfacing R² and the equation makes this immediately useful for a science
  lab write-up. *(Predates this round — the R²/equation line was already on
  the scatter chart. Verified, not rebuilt.)*
- **Done —** **Error bars** — the other thing a lab chart needs and no free tool makes
  easy. *(A per-series "± value column" picker; capped error bars drawn on
  bar and line charts.)*
- **Skipped — deferred.** **Copy chart to clipboard as an image**, so it can go straight into a slide
  or a doc without a download step. *(Not part of this round's scoped
  list.)*
- **Skipped — deferred.** **Bigger/print layout preset.** Charts get projected; a projector preset
  (thick lines, large type) and a print preset would both get used. *(Not
  part of this round's scoped list.)*
- **Skipped — deferred.** **Undo / confirm on Delete dataset** (P11). *(Not part of this round's
  scoped list.)*

## Major Features

- **Partially done — pulled up into this round.** **Printed worksheet output** (teacher-generated handout, not a
  student-operated mode). Print the chart with a blank axis for
  students to complete, or print the data table with a blank grid — turning a
  charting tool into a worksheet generator, which is the classroom shape of
  this need (P6). *(Shipped the blank-axes-chart half, for bar and line
  charts only. The "print the data table with a blank grid" half was not
  attempted — a natural next step, and would also extend worksheet mode to
  pie/scatter/box.)*
- **Skipped — deferred.** **Histogram and frequency table.** `grade-distribution-visualizer.html`
  already builds histograms; that logic belongs here, with the grade tool
  consuming it (P7). Right now two tools bucket numbers independently.
  *(Not attempted this round — Grade Distribution Visualizer got its own
  independent round of improvements in parallel, including its own
  zero-bucket histogram work; no shared engine was built. See that tool's
  improvement file.)*
- **Skipped — deferred.** **Two-variable analysis.** Scatter with trendline exists; correlation
  coefficient, residuals, and "is this linear?" prompts would make it a real
  data-literacy tool for a middle school science or math class. *(Not
  attempted this round.)*
- **Skipped — deferred.** **Templates by subject.** A lab data template (trial, measurement, average),
  a survey template, a grade template — each with the right chart type and
  stats preselected (P15). *(Not attempted this round.)*
- **Skipped — deferred.** **Chart annotation.** Arrows, labels, a shaded region, a "line of best fit"
  callout — the difference between a chart and a chart that makes an argument.
  *(Not attempted this round.)*
- **Skipped — deferred.** **Multiple charts on one printed page**, for a lab report or a comparison.
  *(Not attempted this round.)*
- **Skipped — deferred.** **XLSX import** (P13). Currently CSV-ish paste only; `final_grade_checker.html`
  and `review-game-board.html` already vendor SheetJS and could share it.
  *(Not attempted this round.)*

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
