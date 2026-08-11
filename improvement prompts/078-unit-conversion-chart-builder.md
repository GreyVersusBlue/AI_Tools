# Improvement Prompts — 078 — Unit Conversion Reference Chart Builder

**Tool file:** `Tools/078-unit-conversion-chart-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Check off customary, metric, cross-system, temperature, and time unit sets, add custom lines, and print a one-page conversion reference chart.

---

## Status

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: ten checkbox-selectable unit-set templates (length/weight/
volume each split into customary, metric, and cross-system, plus
temperature and time), a live chart preview grouped by category, a way to
add a custom line to any group (existing or new), and a two-column print
layout. Selections and custom lines autosave to a single localStorage key
(`ucb_chart_v1`). Verified with a headless Chromium smoke test (default
selection, toggling a template, adding a custom line) — no console errors.

This intentionally does not do unit *math* (converting an actual number the
teacher types in) — it's a reference chart, not a calculator, matching the
backlog description.

**2026-08-11 — Round 1 (session `h4rwxn`).** Shipped two of the Quick Wins
below. Per-line delete for template-sourced lines: every line in the chart
preview now has a &times; button (not just custom lines) — clicking it
hides just that instance via a new `state.hidden[templateKey][lineIndex]`
map, checked in `activeGroups()` before a template's line is included.
Unchecking then re-checking a template's own checkbox clears its hidden
entries, so "start over with the full template" is one click rather than a
dead end. Column-count control: a new "Print layout" card lets a teacher
pick 1/2/3 columns, applied to the print sheet via an inline
`grid-template-columns` set on `#printGroups` right before `window.print()`
(the on-screen preview stays a single list, matching the existing design —
only the print view was ever columned). Both settings persist in the
existing `ucb_chart_v1` localStorage blob (`state.hidden`, `state.columns`).
Verified with a headless Playwright test: hide a line and confirm the row
count drops by one, uncheck/recheck the template and confirm it's back,
switch to 3 columns and confirm both the DOM style and the post-reload
`<select>` value reflect it.

Multiple named saved charts, group/line reordering, and JSON export/import
remain unbuilt — all three are the "match Formula Sheet Builder's pattern"
items and are naturally a matched set for a future round, since it's the
same underlying save-model change (single object &rarr; named collection)
that unlocks reordering and export together.

## What it does today

- 10 templates across length/weight/volume (each x3: customary, metric,
  cross-system) plus temperature and time
- Checkbox-driven chart assembly, grouped by category with a print-safe
  two-column layout
- Custom lines can be added to any existing group or a brand-new one
- Any individual line — template-sourced or custom — can be removed from
  the chart without dropping its whole group/template
- Print column count (1/2/3) is chooser-controlled and persists across
  visits

## Quick Wins

- **Multiple named saved charts**, matching Formula Sheet Builder's pattern
  — right now there's exactly one chart per browser, so a "Grade 5 metric
  only" chart and a "full reference" chart can't coexist.
- **Reorder groups and lines** (up/down buttons, matching Formula Sheet
  Builder's item reordering) — right now group and line order is fixed by
  template/insertion order.
- **JSON export/import**, the same convention Formula Sheet Builder and
  Rubric Builder use, so a chart can be shared between two teachers' Ideas
  Backlog-graduated setups.

## Major Features

- **Area and speed unit sets** (sq ft/sq m/acres/hectares;
  mph/km per h/m per s) — common in both math and science classes and
  currently absent.
- **A tiny built-in calculator** next to each conversion line ("type a
  number, see it converted") as an optional toggle — turns the reference
  chart into something a struggling student can actually use mid-problem,
  not just read.
- **Grade-band presets** — one click selects the right unit sets for
  "elementary" vs "middle school", instead of checking boxes individually
  every time.
- **Print as a bookmark/half-sheet** in addition to the full-page chart, for
  taping inside a math notebook rather than posting on a wall.

## Moonshot / North Star

**The conversion chart a student actually keeps in their binder, sized and
scoped for exactly their unit, with a quick-calc built in for the facts they
haven't memorized yet.** Grade-band presets get a teacher to a useful chart
in one click; the optional calculator turns "reference" into "tool"; and
saved named charts mean a chart built once for fifth-grade metric doesn't
need rebuilding for sixth-grade customary-to-metric next period.

## Platform themes that matter here

- **P6 (print quality)** — column-count control and a half-sheet layout are
  both pure print-format work.
- **P15 (first run)** — grade-band presets would remove almost all the
  clicking from a first visit.
- **P7 (cross-tool)** — shares its whole "checkbox templates → editable
  grouped list → print" shape with Formula Sheet Builder; multiple named
  saves and JSON export/import would bring it fully in line.

## Open Questions

- Is a built-in mini-calculator in scope for a tool the backlog explicitly
  frames as a static reference chart, or does that belong as a separate
  "Unit Converter" tool entirely (there's already a unit-conversion-adjacent
  idea gap on the backlog for an actual calculator)?
- Grade-band presets: worth hard-coding which templates map to "elementary"
  vs "middle" here, or is that better solved by just letting saved-chart
  names double as presets (a teacher builds their own "5th grade" chart
  once and reuses it)?
