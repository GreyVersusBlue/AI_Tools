# Improvement Prompts — Rubric Builder

**Tool file:** `Tools/rubric-builder.html`
**Support folder:** `Tools/rubric-builder/` — `rb-store.js`, `rb-templates.js`

**Current description (from README):** Build a grading rubric from a template or from scratch — editable criteria and performance levels, live point totals, print a clean landscape table. Saves multiple named rubrics.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Build from a template (`rb-templates.js`) or from scratch; add/remove/reorder
  criteria and performance levels; live total points
  (`totalPossiblePoints`, `maxLevelPoints`)
- Multiple saved rubrics (`gvb-rubric-builder:list` / `:data:*`), JSON
  import/export
- **Scoring mode** — pick a student, score them against the rubric, see earned
  points live (`renderScoreMode`, `earnedPoints`, `renderScoreTotals`), saved
  per student (`gvb-rubric-builder:scores:*`)
- Print the blank rubric or **this student's scored rubric**
- Shareable by `state-link.js` URL; student name autocomplete
  (`populateStudentDatalist`)

## Quick Wins

- **Load a roster** (P2). Scoring mode has a student datalist but no access to
  `np_rosters`, so the class list is typed in again.
- **Comment box per criterion and an overall comment** on the scored rubric.
  The comment is what the student reads; the numbers are what the gradebook
  reads.
- **Class-wide scoring view** — a grid of students × criteria you can fill in
  from one screen, rather than one student at a time. This is the difference
  between grading a set of 28 in an hour and in three.
- **Comment bank.** The same six comments get written thirty times; a
  clickable bank per criterion would save real hours.
- **Half points / partial credit** between levels.
- **Weighted criteria** (writing 40%, mechanics 10%) rather than raw point
  sums.
- **Export scores as CSV** for the gradebook — currently the scores are
  trapped in this tool.

## Major Features

- **Student-facing rubric.** A print or link (P3) version in student-friendly
  language, ideally with an "I can" phrasing per level, plus a self-assessment
  column students fill in before submitting. Self-assessment against the rubric
  is one of the highest-effect-size practices there is and needs exactly this
  artifact.
- **Peer review mode.** The same rubric, reduced, as a peer feedback form —
  which `IDEAS_BACKLOG.md` lists as a separate tool and which is a print mode
  here.
- **Feed the grade tools** (P7). Rubric scores should flow into
  `final_grade_checker.html` and `grade-distribution-visualizer.html` instead
  of being retyped.
- **Rubric analytics.** Across a class, which criterion did students score
  lowest on? That's the reteaching signal, computable from data already
  stored.
- **Single-point rubrics and checklists** as alternative formats — a
  single-point rubric (one column of criteria, blanks either side for
  "concerns" and "advanced") is increasingly the preferred format and is a
  small variation of the existing structure.
- **Standards alignment.** Tag criteria to standards, and report by standard
  rather than by assignment — the shape standards-based grading needs.

## Moonshot / North Star

**One rubric, the whole assessment cycle.** Build it once; students see it in
their own language and self-assess against it; peers use a reduced version to
give feedback; the teacher grades a class of 28 from one grid with a comment
bank; each student gets a printed scored rubric with real comments; the class
data shows which criterion to reteach; and the scores flow into the gradebook
tools without being typed twice.

## Platform themes that matter here

- **P2 (shared roster)** — the clearest gap; scoring mode needs it most.
- **P7 (cross-tool)** — scores should feed the grade tools; the peer-review
  backlog item belongs here.
- **P3 (share links)** — already adopts `state-link.js`; the student-facing
  rubric is the natural use.
- **P6 (print quality)** — a landscape rubric table that doesn't split rows
  across pages is a real layout problem.

## Open Questions

- Where should scored student data live — here, or in a shared assessment
  store that the grade tools also read? Keeping it here is simpler; sharing it
  is what makes the handoff work.
- Is standards-based reporting something this district needs, or is
  points-based the only realistic model?
