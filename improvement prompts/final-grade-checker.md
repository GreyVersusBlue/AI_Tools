# Improvement Prompts — Final Grade Checker

**Tool file:** `Tools/final_grade_checker.html`
**Support folder:** `Tools/final-grade-checker/`

**Current description (from README):** Enter grades by hand or paste a TAC export, and check the math automatically.

---

## Status

**2026-08-10 — implementation round.** Shipped all five Quick Wins scoped
for this round: the opt-in settings persistence, "show the arithmetic",
per-student printable slips, weighted categories, and an explicit rounding
rule. Every `calcFinals`/`getLetter`/`qpToFinalLetter` call in
`grade-math.mjs` now takes an optional `opts` argument (`boundary`,
`precision`, `weights`); calling any of them with no `opts` (or `{}`) is
byte-for-byte identical to the pre-round behavior, and all 144 existing
tests still pass unmodified — 57 new lines of tests were added for the new
`opts` paths, not to replace anything.

What shipped, in order of the Quick Wins list:

- **Opt-in "remember these settings"** — a new "Grading Settings" panel
  (rounding boundary, rounding precision, custom weights, show-work toggle)
  is session-only by default, matching the tool's deliberate no-storage
  stance (see the now-resolved Open Question below). Only when a teacher
  explicitly checks "Remember these settings" does
  `final-grade-checker:settings-v1` get written to `localStorage` — and it
  only ever holds those four settings, never a student's name or grades.
  Unchecking it removes what was saved.
- **Show the arithmetic** — `arithmeticLines()` spells out the Quality
  Points computation, the Percentage Average computation, and which method
  won and why, from the exact same `calcFinals()` result already driving
  the on-screen numbers (so it can never disagree with them). Toggled by
  "Show the arithmetic on every student card" in Grading Settings, and
  reused verbatim by the printable slips below.
- **Per-student printable slips** — "Print Student Slips" builds one slip
  per student (current grade + the same arithmetic, or — for a student
  missing exactly one quarter — what they'd need on that quarter to reach a
  teacher-chosen target letter, reusing the same backward-algebra as the
  "What Do I Need" tab). A student missing more than one quarter gets an
  honest "no single number to solve for yet" instead of a wrong-looking
  guess.
- **Weighted categories** — an optional custom weight per quarter (default:
  equal 25% each, reproducing the original math exactly) threaded through
  `calcFinals`, the "What Do I Need" solver, and the per-student slips, so
  a district's actual weighting doesn't silently disagree with a
  points-based assumption.
- **Rounding rules made explicit** — a "round up at exactly .5" vs. "strict,
  no credit for .5" boundary choice, plus an optional "round the average
  before checking the cutoff" precision setting (none / whole / tenth). The
  county rule already documented in the tool (round-at-.5, no pre-rounding)
  stays the unchanged default; the alternatives are opt-in and visible, so a
  "the math is wrong" conversation now has a setting to point at instead of
  a hidden assumption.

Not attempted this round, and explicitly out of scope per the task:
**column mapping on import** (Quick Win, left for a future round) and
everything under Major Features / Moonshot (missing-work triage, scenario
modelling, grade-window awareness, handoff to Grade Distribution
Visualizer, rubric-scored input, progress reports).

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

- **Done —** **Keep the deliberate no-storage default, but offer an explicit "hold this
  in the browser until I clear it" opt-in.** Losing a pasted gradebook to an
  accidental refresh mid-conference is a real cost; making persistence a
  visible, one-click-to-erase choice respects both concerns. *(A "Remember
  these settings" checkbox in the new Grading Settings panel — persists only
  the rounding/weight/show-work settings, never a student's name or grades,
  and student data is still never written to storage anywhere in this file.)*
- **Done —** **Show the arithmetic.** The tool checks the math; showing *how* it got the
  number turns it into something a teacher can hand a student who is arguing
  about a grade. *(A toggleable arithmetic block on every card, using the
  exact same computed result already shown on screen.)*
- **Done —** **Print a per-student slip** — current grade, what's missing, what they'd
  need. This is the artifact for a grade conference, and the tool already has
  every number on it. *(One slip per student in one print pass; a
  teacher-chosen target letter drives the "what's needed" line for anyone
  missing exactly one quarter.)*
- **Done —** **Weighted categories.** Most gradebooks weight (tests 40%, homework 20%);
  a checker that assumes points-based will silently disagree with the
  gradebook it's checking. *(An optional per-quarter weight, default equal
  25% each — every downstream calculation, including "What Do I Need" and
  the printable slips, honors it.)*
- **Done —** **Rounding rules made explicit** — 89.5 up or not, and does the district
  round once or twice. This is where "the math is wrong" arguments actually
  come from. *(A boundary choice — round-at-.5 (default, matches the county
  rule already documented) vs. strict — plus an optional pre-cutoff rounding
  precision, both visible settings instead of hidden assumptions.)*
- **Skipped — deferred.** **Column mapping on import** rather than positional assumptions (P13), so a
  gradebook export that changes column order doesn't fail quietly. *(Not
  part of this round's scoped list — a natural next Quick Win.)*

## Major Features

- **Skipped — deferred.** **Missing-work triage.** Import the gradebook, and get: who has zeros, whose
  grade would move a letter if they turned in one thing, and a printable
  per-student list. This is the highest-value thing that can be computed from
  a gradebook export and no gradebook does it well. *(Not attempted this
  round — out of this round's scope, though the per-student slip's "missing
  quarters" line is a small piece of the same idea.)*
- **Skipped — deferred.** **Scenario modelling.** "If everyone's lowest test is dropped", "if I curve
  by 4 points", "if this assignment is worth 50 instead of 100" — recomputed
  across the class instantly, with a before/after distribution. *(Not
  attempted this round.)*
- **Skipped — deferred.** **Grade-window awareness** (P7). If `school-calendar-visualizer.html`
  knows when the quarter ends, "remaining quarter" stops being a manual input.
  *(Not attempted this round.)*
- **Skipped — deferred.** **Hand off to Grade Distribution Visualizer** (P7). These two tools consume
  the same paste and compute overlapping statistics; one should call the
  other rather than both parsing independently. *(Not attempted this round —
  Grade Distribution Visualizer got its own round of independent
  improvements in parallel; no shared engine was built. See that tool's
  improvement file.)*
- **Skipped — deferred.** **Rubric-scored input** (P7). `rubric-builder.html` already scores students
  against a rubric; those scores should be able to flow here. *(Not
  attempted this round.)*
- **Skipped — deferred.** **Progress reports.** A printable per-student progress sheet for mid-quarter
  mailing, generated for the whole class in one pass. *(Not attempted this
  round — the per-student slip is a step toward this but isn't framed as a
  progress-report mailing.)*

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

- **Resolved 2026-08-10.** Is the no-`localStorage` behaviour deliberate policy (student grades never
  touch disk) or incidental? It reads as deliberate and should be written down
  either way, because it is the kind of thing a future agent will helpfully
  undo. — Treated as deliberate this round: the new Grading Settings panel is
  the only thing in this file that ever writes to `localStorage`, and only
  the rounding/weight/show-work settings — never a student's name or grades,
  and only once the teacher explicitly opts in. Any future change to this
  file should keep that line intact.
- What gradebook does the district actually export from, and can a shipped
  parser for its exact format replace the generic one? *(Still open — not
  investigated this round.)*
