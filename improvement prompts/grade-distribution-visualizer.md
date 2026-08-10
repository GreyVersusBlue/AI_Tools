# Improvement Prompts — Grade Distribution Visualizer

**Tool file:** `Tools/grade-distribution-visualizer.html`
**Support folder:** none — single file

**Current description (from README):** Paste a gradebook export and get class-wide stats, an editable letter-grade breakdown, and a score histogram — a companion to the Final Grade Checker.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Paste scores; per-assignment saved sets (`gvb-grade-distribution:list` /
  `:current`)
- Class stats (mean, median, spread) and **outlier detection**
  (`computeOutliers`)
- **Editable letter-grade cutoffs** (`readCutoffs`) with a stacked bar
  breakdown (`buildStackedBarSvg`)
- **Score histogram** with configurable bucket width (`buildBuckets`,
  `buildHistogramSvg`)
- **Comparison mode** (`renderComparison`, `refreshCompareOptions`) — compare
  one assignment against another
- SVG-native rendering with **PNG and SVG download**; print

## Quick Wins

- **Name the assignment on every export and print.** A histogram with no title
  is a histogram you can't file.
- **Show n, and show how many were excluded** (blanks, non-numeric, zeros) —
  a distribution that silently drops ungraded students is misleading in
  exactly the direction that matters.
- **Zeros as a separate visual category.** A class with six zeros and a
  reasonable curve looks bimodal; distinguishing "didn't do it" from "did
  badly" is the most useful single distinction in classroom grade data.
- **Grayscale/print-safe and colour-blind-safe palette** (P6) for the stacked
  bar and histogram.
- **Cutoff presets** (district scale, 10-point scale, custom) rather than
  typing four numbers each time.
- **Copy the chart to clipboard** for pasting into a PLC document or an email.
- **Undo / confirm on Delete assignment** (P11).

## Major Features

- **Section comparison, not just assignment comparison.** "How did 3rd period
  do versus 6th?" is the question teachers actually ask, and it's a small
  extension of the existing compare mode.
- **Trend across a quarter.** Several assignments over time, as a small
  multiple or a box plot per assignment — which is the shape a department or
  PLC conversation takes.
- **Item analysis.** Given per-question scores rather than totals: which
  questions did the class miss most, and which distractors pulled. This is the
  single most valuable thing a teacher can learn from a test and there is no
  free local tool that does it.
- **Share the charting engine** (P7). `data-chart-builder.html` already draws
  bar/line/pie/scatter/box and computes quartiles; this tool draws histograms
  and stacked bars. One of them should own charting.
- **Direct handoff from Final Grade Checker** (P7) — same paste, same parsing,
  currently done twice.
- **A printable "what this says" summary.** Plain-language observations —
  "the class median is 78; six students scored below 60; the distribution is
  left-skewed" — for a PLC binder or a reflection, generated rather than
  written.
- **Reflection mode for students.** Show the distribution anonymously with the
  student's own score marked, as a printed slip. Powerful, and requires care
  to do without shaming anyone.

## Moonshot / North Star

**Understand an assessment in ninety seconds, and know what to do next.**
Paste the scores, see the shape, see which questions failed, see which
students the shape is hiding, compare against your other sections and against
the last test, and print both a PLC-ready summary and a small-group reteach
list — locally, privately, with no gradebook integration required.

## Platform themes that matter here

- **P7 (cross-tool)** — should share parsing with Final Grade Checker and
  charting with Data Chart Builder; three tools currently overlap here.
- **P6 (print quality)** — colour-encoded grade bands print as identical grays.
- **P13 (import surfaces)** — no XLSX support, though a sibling tool has it.
- **P4 (accessibility)** — a chart-only tool needs a table alternative.

## Open Questions

- Should this merge into Final Grade Checker as a tab, given they consume the
  same input and are described in the README as companions?
- Is per-question item analysis realistic given what the gradebook exports, or
  would it require a separate paste from the assessment platform?
