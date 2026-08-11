# Improvement Prompts — 037 — Grade Distribution Visualizer

**Tool file:** `Tools/037-grade-distribution-visualizer.html`
**Support folder:** none — single file

**Current description (from README):** Paste a gradebook export and get class-wide stats, an editable letter-grade breakdown, and a score histogram — a companion to the Final Grade Checker.

---

## Status

**2026-08-11 — Pass 2 round.** Shipped **undo on Delete assignment** (P11),
the smaller of the two Quick Wins this file's Pass 1 round left deferred.
The `confirm()` dialog already existed (its wording now mentions the undo
window instead of "This can't be undone"); what was missing was the
undo itself. Copies the exact pattern `018-qr-scavenger-hunt-builder.html`
established for "Undo clear": an in-memory-only snapshot (never
`localStorage`, so it doesn't survive a reload) captured right before
`deleteSet()` runs, a "Undo delete" button that appears for a 15-second
window (`setTimeout`), and a restore path that re-saves the snapshot under
its original name — unless a same-named assignment was created during the
undo window, in which case it restores as `"<name> (restored)"` instead of
silently overwriting the new one. Verified with a headless Playwright pass:
delete → undo brings back the exact same pasted scores; the name-collision
case (deleting the *only* assignment auto-creates a fresh "New Assignment"
with the same default name, then Undo correctly detects the collision and
restores as "New Assignment (restored)") was hit organically by the test
and handled correctly, not just reasoned about. No JS console errors.

Not attempted this round: **copy chart to clipboard**, the other deferred
Quick Win, and everything under Major Features/Moonshot.

**2026-08-10 — implementation round.** Shipped all five Quick Wins scoped
for this round: assignment naming on export/print, n/excluded visibility,
zeros as their own category, a grayscale-/colorblind-safe palette, and
cutoff presets. Storage stayed additive; the palette swap changed the CSS
custom properties (`--gA`..`--gF`) and the JS `LETTER_HEX` constant in
place rather than adding new ones, since every consumer already reads
through those names.

What shipped, in order of the Quick Wins list:

- **Assignment name on every export and print** — `document.title` now
  includes the assignment name (the browser's own "Print to PDF" and the
  tab both name the file/document after `document.title`, not the
  in-page `#printTitle`, so it had to land there too).
- **n and excluded count** — the score parser already tracked a `skipped`
  count (blank/non-numeric lines); it's now shown in the stats table and
  carried into every SVG export (`nCaption()`) as "n = 31 (2 excluded —
  blank/non-numeric)", so a downloaded or printed chart never loses the
  count that decides whether its shape is trustworthy.
- **Zeros as a separate visual category** — `buildBuckets()` now pulls
  exact-zero scores into their own leading pseudo-bucket (`isZero: true`)
  instead of folding them into the lowest range, labeled "0 (not
  submitted)" and given a hatched fill (`zero-bar` / `hatchZero`) distinct
  from the regular histogram bars, both on screen and in the SVG
  downloads. A note explains the split whenever there are any zeros.
- **Grayscale-/colorblind-safe palette** — the letter-grade colors (`--gA`
  through `--gF`, and the matching `LETTER_HEX` used by the SVG exports)
  became a single-hue sequential ramp (ColorBrewer "Blues") instead of
  five different hues, so the five letters stay distinguishable under any
  color-vision deficiency and on a black-and-white printer, where hue
  disappears and only lightness survives. F additionally gets a diagonal
  hatch (`hatchF`) as a second, non-color signal. A new `textColorFor()`
  picks black-or-white label text against whichever step of the ramp it's
  drawn on, since a light-to-dark ramp means some steps are light.
- **Cutoff presets** — a "Cutoff preset" dropdown (Standard 10-point,
  Seven-point scale, Custom) fills in the four cutoff boxes; hand-editing
  any box flips the dropdown to "Custom" so it never silently disagrees
  with what's actually being used to grade. "Standard 10-point" uses the
  same whole-number boundaries Final Grade Checker's default rule is built
  on (before that tool's own .5-rounding) — not a shared engine, just the
  same familiar numbers so the two tools don't visibly disagree by default.

Not attempted this round, and explicitly out of scope per the task: **copy
chart to clipboard** and **undo/confirm on Delete assignment** (both Quick
Wins in the backlog below), and everything under Major Features / Moonshot.

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
- SVG-native rendering with **PNG and SVG download**, **copy-to-clipboard as a
  PNG** (`copyChartImage`, `svgToPngBlob`); print

## Quick Wins

- **Done —** **Name the assignment on every export and print.** A histogram with no title
  is a histogram you can't file. *(`document.title` now includes it, since
  that — not the in-page heading — is what "Print to PDF" and the browser
  tab actually use as the default filename.)*
- **Done —** **Show n, and show how many were excluded** (blanks, non-numeric, zeros) —
  a distribution that silently drops ungraded students is misleading in
  exactly the direction that matters. *(Shown in the stats table and on
  every SVG export via a shared `nCaption()`.)*
- **Done —** **Zeros as a separate visual category.** A class with six zeros and a
  reasonable curve looks bimodal; distinguishing "didn't do it" from "did
  badly" is the most useful single distinction in classroom grade data.
  *(Zeros get their own leading, hatched histogram bucket labeled "0 (not
  submitted)", separate from the lowest score range.)*
- **Done —** **Grayscale/print-safe and colour-blind-safe palette** (P6) for the stacked
  bar and histogram. *(Swapped the five letter-grade hues for a single-hue
  sequential ramp, plus a hatch pattern on F as a second non-color signal.)*
- **Done —** **Cutoff presets** (district scale, 10-point scale, custom) rather than
  typing four numbers each time. *(A dropdown with Standard 10-point and
  Seven-point presets; hand-editing a cutoff box flips it to "Custom".)*
- **Done — 2026-08-11.** **Copy the chart to clipboard** for pasting into a PLC
  document or an email. *(A "Copy image" button on each chart, sharing the
  existing PNG rasteriser, with a download fallback when the clipboard is
  unavailable or blocked — see the copy-chart round below.)*
- **Done — 2026-08-11.** **Undo / confirm on Delete assignment** (P11). *(Confirm already existed;
  added a 15-second in-memory undo, same pattern as the QR Scavenger Hunt
  Builder's "Undo clear" — see Status.)*

## Major Features

- **Skipped — deferred.** **Section comparison, not just assignment comparison.** "How did 3rd period
  do versus 6th?" is the question teachers actually ask, and it's a small
  extension of the existing compare mode. *(Not attempted this round.)*
- **Skipped — deferred.** **Trend across a quarter.** Several assignments over time, as a small
  multiple or a box plot per assignment — which is the shape a department or
  PLC conversation takes. *(Not attempted this round.)*
- **Skipped — deferred.** **Item analysis.** Given per-question scores rather than totals: which
  questions did the class miss most, and which distractors pulled. This is the
  single most valuable thing a teacher can learn from a test and there is no
  free local tool that does it. *(Not attempted this round.)*
- **Skipped — deferred.** **Share the charting engine** (P7). `038-data-chart-builder.html` already draws
  bar/line/pie/scatter/box and computes quartiles; this tool draws histograms
  and stacked bars. One of them should own charting. *(Not attempted this
  round — Data Chart Builder got its own independent round of improvements
  in parallel, including its own grayscale-mode work; no shared engine was
  built. See that tool's improvement file.)*
- **Skipped — deferred.** **Direct handoff from Final Grade Checker** (P7) — same paste, same parsing,
  currently done twice. *(Not attempted this round — Final Grade Checker
  also got its own independent round in parallel; see that tool's file.)*
- **Skipped — deferred.** **A printable "what this says" summary.** Plain-language observations —
  "the class median is 78; six students scored below 60; the distribution is
  left-skewed" — for a PLC binder or a reflection, generated rather than
  written. *(Not attempted this round.)*
- **Skipped — deferred.** **Reflection mode for students.** Show the distribution anonymously with the
  student's own score marked, as a printed slip. Powerful, and requires care
  to do without shaming anyone. *(Not attempted this round.)*

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

## Copy-chart round — 2026-08-11 (backlog rank 1)

Shipped **copy the chart to the clipboard** — the last deferred Quick Win in
this file.

A downloaded PNG is three steps from where it is going: save it, find it in
Downloads, insert it. A PLC agenda or a data-meeting doc wants it pasted. Each
chart's button row gained **📋 Copy image**, which rasterises the same
standalone SVG the PNG download uses and writes it to the clipboard as
`image/png`.

- **The rasteriser is now shared.** `downloadSvgAsPng` was refactored into
  `svgToPngBlob` + a caller, so the image on the clipboard is byte-for-byte the
  image on disk — 2x scale, white background (a transparent chart pasted into a
  dark-themed doc is unreadable).
- **The failure path is the real work.** Clipboard image writes need a secure
  context and are unsupported or permission-gated in some browsers. Both
  failures — no `ClipboardItem` at all, and a rejected `write()` — fall back to
  downloading the PNG and say so in a status line next to the button. A
  "Copy" that silently does nothing is worse than no button.
- The status is an inline message rather than an `alert()`: it is a "did that
  work?" confirmation, not something to dismiss.

New suite `Tools/grade-distribution-visualizer/test/smoke-copy-chart.mjs`
(21 checks) as `npm run test:grade-dist`. It stubs three browsers — working,
no-ClipboardItem, and refusing — and checks the PNG file signature on the blob
that reaches the clipboard, that nothing downloads on the happy path, and that
both failure paths download the *right* chart with an error-styled message.

### Where the next round should pick up

- **Per-question item analysis** (backlog) is the biggest open idea here and is
  untouched.
- Copying is per chart. A "copy both charts plus the stats as one image" would
  suit a PLC agenda better than two pastes, but it needs a composite layout
  that does not exist yet.
