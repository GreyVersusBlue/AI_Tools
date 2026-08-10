# Improvement Prompts — Final Grade Checker

**Tool file:** `Tools/final_grade_checker.html`
**Support folder:** `Tools/final-grade-checker/`

**Current description (from README):** Enter grades by hand or paste a TAC export, and check the math automatically.

---

## Status

Reviewed — structural read of the source. This tool has the strongest import
and export pipeline on the site. Ideas below are deliberately ambitious and
**not** scoped to a single session.

## What it does today

- Two entry paths: **manual student cards** (add/remove/clear) and **file
  import** — CSV *and* XLSX via SheetJS, with drag-drop, header-row detection
  (`stripHeaderRow`), and warnings (`showWarnings`)
- **"What do I need on the final?"** and **"What do I need on the remaining
  quarter?"** solvers (`computeNeed`, `classifyRequired`,
  `qpCutoffForLetter`, `pctCutoffForLetter`)
- **Borderline detection** (`borderlineInfo`, `borderlineLabel`) — flags
  students sitting on a letter-grade edge
- Exports: **Excel**, **PDF** (jsPDF), **Share PDF** (Web Share API), print
- Loads `_shared/theme.css` and `_shared/a11y.js`; lazy-loads libraries
  (`loadLibs`, `withLibs`)
- Notably: **stores nothing** in `localStorage` — deliberately ephemeral

## Quick Wins

- **Keep the deliberate no-storage default, but offer an explicit "hold this
  in the browser until I clear it" opt-in.** Losing a pasted gradebook to an
  accidental refresh mid-conference is a real cost; making persistence a
  visible, one-click-to-erase choice respects both concerns.
- **Show the arithmetic.** The tool checks the math; showing *how* it got the
  number turns it into something a teacher can hand a student who is arguing
  about a grade.
- **Print a per-student slip** — current grade, what's missing, what they'd
  need. This is the artifact for a grade conference, and the tool already has
  every number on it.
- **Weighted categories.** Most gradebooks weight (tests 40%, homework 20%);
  a checker that assumes points-based will silently disagree with the
  gradebook it's checking.
- **Rounding rules made explicit** — 89.5 up or not, and does the district
  round once or twice. This is where "the math is wrong" arguments actually
  come from.
- **Column mapping on import** rather than positional assumptions (P13), so a
  gradebook export that changes column order doesn't fail quietly.

## Major Features

- **Missing-work triage.** Import the gradebook, and get: who has zeros, whose
  grade would move a letter if they turned in one thing, and a printable
  per-student list. This is the highest-value thing that can be computed from
  a gradebook export and no gradebook does it well.
- **Scenario modelling.** "If everyone's lowest test is dropped", "if I curve
  by 4 points", "if this assignment is worth 50 instead of 100" — recomputed
  across the class instantly, with a before/after distribution.
- **Grade-window awareness** (P7). If `school-calendar-visualizer.html`
  knows when the quarter ends, "remaining quarter" stops being a manual input.
- **Hand off to Grade Distribution Visualizer** (P7). These two tools consume
  the same paste and compute overlapping statistics; one should call the
  other rather than both parsing independently.
- **Rubric-scored input** (P7). `rubric-builder.html` already scores students
  against a rubric; those scores should be able to flow here.
- **Progress reports.** A printable per-student progress sheet for mid-quarter
  mailing, generated for the whole class in one pass.

## Moonshot / North Star

**The five minutes before grades are due, made safe.** Paste the export and
immediately see: whose grade is wrong, who is one assignment from a different
letter, who is borderline and needs a decision, what the distribution looks
like, and what each of those students would need — with a printable slip for
each conversation, an audit trail of the arithmetic, and nothing stored
anywhere unless the teacher explicitly asks for it.

## Platform themes that matter here

- **P13 (import surfaces)** — this tool sets the standard; its CSV/XLSX
  pipeline should be extracted for the rest of the site.
- **P7 (cross-tool)** — overlaps Grade Distribution Visualizer substantially.
- **P8 (privacy/storage)** — the no-storage stance is a deliberate design
  decision and should be documented as such before anyone "fixes" it.
- **P6 (print quality)** — per-student slips are the natural output.

## Open Questions

- Is the no-`localStorage` behaviour deliberate policy (student grades never
  touch disk) or incidental? It reads as deliberate and should be written down
  either way, because it is the kind of thing a future agent will helpfully
  undo.
- What gradebook does the district actually export from, and can a shipped
  parser for its exact format replace the generic one?
