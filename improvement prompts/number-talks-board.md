# Improvement Prompts — Number Talks / Mental Math Routine Board

**Tool file:** `Tools/number-talks-board.html`
**Support folder:** none — single file

**Current description (from README):** A bank of number-talk prompts that reveal one expression at a time on a projector display, plus a lightweight strategy-sharing board.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Prompt bank by category, plus custom prompts saved to **"my bank"**
  (`gvb-number-talks:myBank`)
- **Reveal next expression / reveal all** — the defining interaction of a
  number string routine
- **Computes the answer itself** — a real expression parser
  (`tokenizeExpr`, `parseExpression`, `parseTerm`, `parseFactor`) with a
  teacher-only "show answer"
- **Strategy cards** added live during discussion, on a shared board
- Session save/export (`buildSessionExportText`, `exportSession`), string
  history (`gvb-number-talks:stringHistory`), clear board / clear log
- Print a handout of the number talk

## Quick Wins

- **Attribute strategies to students.** "Maya's way" is how number talks
  actually work, and a name field on a strategy card (optionally pulled from
  `np_rosters`, P2) would make the board match the classroom practice.
- **Bigger projector rendering and fullscreen** (P1). This is a projector tool
  without a projector mode.
- **Draw on a strategy card.** Number talk strategies are frequently
  visual — a number line, an array, a decomposition tree. A minimal drawing
  surface would capture what typing can't.
- **Turn-and-talk timer** built into the reveal flow (P7 — the timer exists).
- **A "wait time" pause** between reveal and discussion, since the routine
  depends on silent think time.
- **Save a whole session as a printable record** — the board, the strategies,
  and who contributed — which the export partly does but not as a handout.
- **Undo on Clear board** (P11) — it destroys a live discussion.

## Major Features

- **A real number string library.** Number talks work because the strings are
  deliberately sequenced (each problem sets up the next). A shipped library
  organized by strategy — making tens, doubling and halving, compensation,
  partial products, fraction equivalence — with the pedagogical intent stated
  for each, would be more valuable than any UI change. This is content work,
  not code work, and it's what separates a good number talk from a random set
  of problems.
- **Generate strings from a strategy.** Given "compensation" and a grade band,
  produce a fresh, correctly-sequenced string. The expression parser already
  proves the tool can reason about arithmetic.
- **Dot images / visual number talks.** Quick-image routines (dot cards, ten
  frames, arrays) shown briefly then hidden — a different and equally common
  form of the routine, and one that needs generated images rather than
  expressions.
- **Strategy library that persists across the year.** The class's own named
  strategies accumulate into a wall reference — printable as posters, which is
  exactly what a number-talks classroom has on its walls.
- **Student-device strategy submission** (P9), so quiet students contribute
  without speaking.
- **Convergence with the other prompt-bank tools** (P7) —
  `exit-ticket-generator.html` and `writing-prompt-generator.html` have the
  same bank/display/handout architecture in three separate implementations.

## Moonshot / North Star

**The routine, with the pedagogy built in.** Not a random-problem projector,
but a sequenced library of number strings that each teach something specific,
a board that captures the class's strategies in their own words with their
names on them, a growing wall of the class's methods, and a printable record
of what the class figured out — for a teacher who wants to run number talks
well but doesn't have a math coach.

## Platform themes that matter here

- **P1 (projector mode)** — this is a projector-first tool with no fullscreen
  or dark mode.
- **P7 (cross-tool)** — shares an architecture with two other prompt-bank
  tools and needs the timer.
- **P2 (shared roster)** — strategy attribution.
- **P15 (first run)** — the shipped content library is the product here.

## Open Questions

- How much curated content is Devon willing to author or curate? The library
  is the highest-value work here and it is writing, not programming.
- Should the expression parser be extracted to `_shared/` — the graph paper
  and math drill tools could both use it?
