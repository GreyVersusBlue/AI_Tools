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
backlog description. Nothing below has been started.

## What it does today

- 10 templates across length/weight/volume (each x3: customary, metric,
  cross-system) plus temperature and time
- Checkbox-driven chart assembly, grouped by category with a print-safe
  two-column layout
- Custom lines can be added to any existing group or a brand-new one

## Quick Wins

- **Multiple named saved charts**, matching Formula Sheet Builder's pattern
  — right now there's exactly one chart per browser, so a "Grade 5 metric
  only" chart and a "full reference" chart can't coexist.
- **Reorder groups and lines** (up/down buttons, matching Formula Sheet
  Builder's item reordering) — right now group and line order is fixed by
  template/insertion order.
- **A one-line delete for template-sourced lines**, not just custom ones —
  currently unchecking the whole template is the only way to drop a single
  built-in line, so "everything from Length (Customary) except the mile
  conversion" isn't possible without going custom.
- **Column-count control** (1, 2, or 3 columns) for the print layout,
  depending on how many unit sets are selected — a 1-set chart looks sparse
  in two columns, a 6-set chart may want three.
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
