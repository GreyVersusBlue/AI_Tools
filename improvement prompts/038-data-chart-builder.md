# Improvement Prompts — 038 — Data Table → Chart Builder

**Tool file:** `Tools/038-data-chart-builder.html`
**Support folder:** `Tools/data-chart-builder/test/smoke-xlsx.mjs`
(`npm run test:chart-builder`). The page itself is a single file.

**Current description (from README):** Paste a table from a spreadsheet or lab notebook, pick the columns, and get a bar, line, pie, or scatter chart with quick descriptive stats — download as PNG or SVG.

---

## Status

**2026-08-11 — Round 2 (session `m3r8ro`).** Shipped **spreadsheet file
import** (backlog rank 14, platform theme P13). The tool took a paste, a .csv
or a .tsv; every sibling tool that handles tabular data also reads .xlsx, and a
teacher with a lab-data workbook was opening it, selecting, copying, and coming
back.

- `.xlsx` / `.xlsm` / `.xls` now drop onto the same box and go through the same
  file picker, with SheetJS lazy-loaded from the shared vendored build only
  when a workbook actually turns up — the common paste path still costs nothing.
- **A workbook is converted to the tab-separated text the tool already parses**,
  not to a second internal representation. One parser, one set of rules about
  headers and numbers, nothing to keep in sync — and the chart, the stats and
  the saved-dataset feature all work on an imported workbook without knowing
  it came from one.
- **Two silent corruptions the conversion has to avoid**, both asserted:
  a cell containing a tab (a pasted note inside a data table) would otherwise
  become two columns, so tabs and newlines inside a cell become spaces; and a
  stray formatted cell far to the right of the data would otherwise become an
  empty series, so trailing all-empty columns are trimmed by measuring the real
  width of every row.
- **A multi-sheet workbook gets a sheet picker** rather than silently taking
  the first sheet. The workbook is held in memory so switching sheets does not
  re-read the file, and the picker disappears again when a .csv is loaded.
- If SheetJS cannot load, the message points at a .csv export of the same
  sheet, which needs nothing.
- **Verified** by `Tools/data-chart-builder/test/smoke-xlsx.mjs` (25 checks).
  The .xlsx fixtures are built inside the page with the tool's own vendored
  SheetJS, so the suite reads a real workbook rather than a hand-rolled zip.

**2026-08-11 — Pass 2 round.** Shipped **undo on Delete dataset** (P11), one
of the three Quick Wins this file's Pass 1 round left deferred — the same
scoped item and the same in-memory-15-second-undo pattern (copied from
`018-qr-scavenger-hunt-builder.html`'s "Undo clear") landed independently
in `037-grade-distribution-visualizer.html` this same round; see that
file's own Status for the fuller writeup of the pattern. Here the saved
value is just a raw pasted-text string (`data-chart-builder-datasets` maps
name → text, no cutoffs/weights to carry), so the restore is simpler: an
"Undo delete" button appears for 15s after a delete, and clicking it
re-saves the text under its original name — or `"<name> (restored)"` if a
same-named dataset was saved during the undo window. Verified with a
headless Playwright pass: save → delete → undo round-trips the exact
pasted text back into the saved-datasets list with zero JS console errors.

Not attempted this round: **copy chart to clipboard** and **bigger/print
layout preset**, the other two deferred Quick Wins, and everything under
Major Features/Moonshot.

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

- Paste or load a table — .csv, .tsv, or an **.xlsx workbook** (SheetJS,
  lazy-loaded; multi-sheet workbooks get a sheet picker) — with tolerant
  parsing (`splitLine`, `parseTable`, `detectNumericColumns`) and a live
  preview
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
- **Done — 2026-08-11.** **Undo / confirm on Delete dataset** (P11). *(Confirm already existed;
  added a 15-second in-memory undo — see Status.)*

## Major Features

- **Partially done — pulled up into this round.** **Printed worksheet output** (teacher-generated handout, not a
  student-operated mode). Print the chart with a blank axis for
  students to complete, or print the data table with a blank grid — turning a
  charting tool into a worksheet generator, which is the classroom shape of
  this need (P6). *(Shipped the blank-axes-chart half, for bar and line
  charts only. The "print the data table with a blank grid" half was not
  attempted — a natural next step, and would also extend worksheet mode to
  pie/scatter/box.)*
- **Skipped — deferred.** **Histogram and frequency table.** `037-grade-distribution-visualizer.html`
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
- **Skipped — deferred.** **XLSX import** (P13). Currently CSV-ish paste only; `036-final_grade_checker.html`
  and `030-review-game-board.html` already vendor SheetJS and could share it.
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
