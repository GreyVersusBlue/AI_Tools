# Improvement Prompts — 066 — Math "Find the Mistake" Warm-Up Generator

**Tool file:** `Tools/066-math-find-the-mistake-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** A worked math solution with one deliberate error, revealed on a projector display or printed as a worksheet with an explanation-and-answer key.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: a 15-problem built-in bank spanning order of operations,
one- and two-step equations, fractions, exponents, percents, and negative
numbers — each entry is a problem statement, a multi-line worked solution
containing one deliberate mistake, the correct worked solution, and a short
explanation of what went wrong. Projector mode shows the mistaken work and
reveals the correct work + explanation together; worksheet mode prints a
randomized subset with blank lines under each problem plus a matching
answer key (explanation + correct work per item). A custom bank lets a
teacher add their own problems on top of the built-ins, following the
Daily Editing / DOL Warm-Up Generator's established reveal/shuffle/tabs
pattern from earlier in this Ideas Backlog work. Custom problems persist in
`localStorage` (`mftm_custom_v1`). Verified with a headless Chromium smoke
test (reveal shows both fix and explanation, next, add a custom problem,
build a worksheet) — no console errors.

Nothing below has been started.

## What it does today

- 15 built-in worked-mistake problems across a spread of math topics
- Projector mode: shuffle, reveal (shows correct work + explanation
  together)
- Worksheet mode: randomized subset + matching answer key
- Custom problem bank layered on top of the built-ins

## Quick Wins

- **Categorize/tag problems by topic** (order of operations, equations,
  fractions, exponents, percents) and let a teacher filter to one category
  — right now every problem is in one undifferentiated pool, mirroring the
  same gap flagged in Daily Editing / DOL Warm-Up Generator's improvement
  prompt for the same reason.
- **Separate the "reveal correct work" and "reveal explanation" into two
  steps** instead of one combined toggle — a teacher might want students to
  identify the mistake themselves (explanation) before seeing the full
  corrected solution.
- **Hide/disable individual built-ins** without deleting them, matching the
  same gap noted for Daily Editing's built-in bank.
- **Grade-band scoping** for the built-in bank, similar to Math Fact Drill
  Sheet Generator's grade-band ranges — several built-ins (fractions,
  two-step equations) skew middle-school while others (basic order of
  operations) work for elementary too.

## Major Features

- **Bulk import a custom bank** from a pasted list (problem | work | fix |
  explain, tab- or `|`-separated), matching the bulk-import pattern already
  proven in Staff Directory Builder and Review Game Board — typing one
  problem at a time in the Add form doesn't scale past a handful.
- **Fraction/decimal/percent overlap with the sibling backlog idea**:
  `IDEAS_BACKLOG.md` separately lists a Fraction&ndash;Decimal&ndash;Percent
  Conversion Drill Generator (building next in this round). Some of this
  tool's fraction/percent mistake-problems could share number-generation
  logic with that tool rather than being hand-authored one at a time.
- **A "student picks the wrong step" interactive mode** — instead of just
  revealing the fix, let a student click on which line of the worked
  solution contains the error before revealing, turning passive viewing
  into an active response (a natural fit for this toolkit's P3 share-link
  on-screen-practice pattern).
- **Difficulty/spiral tracking**: which problems a class has already seen,
  so daily use doesn't repeat the same 15 problems on a loop — the same
  longitudinal gap flagged for Math Fact Drill Sheet Generator and Daily
  Editing / DOL Warm-Up Generator.

## Moonshot / North Star

**A "find the mistake" bank deep and well-tagged enough that a teacher can
pull exactly the error type their class is struggling with, in the format
that gets students actively hunting for the error rather than passively
reading the reveal.** Category filters get the right problem in front of
the right class; an interactive "click the wrong step" mode turns a
one-click reveal into real error-analysis practice; and bulk import means
a teacher's own hand-written trick questions can join the bank in minutes,
not one form submission at a time.

## Platform themes that matter here

- **P7 (cross-tool)** — bulk import (Staff Directory Builder, Review Game
  Board) and the fraction/decimal/percent overlap with this round's next
  tool are both direct opportunities.
- **P3 (share links)** — the "click the wrong step" interactive mode is
  this toolkit's on-screen-practice pattern applied to error analysis.
- **P15 (first run)** — category filters and grade-band scoping both
  reduce "is this even the right content for my class" friction, matching
  the same open item on Daily Editing / DOL Warm-Up Generator.

## Open Questions

- Should the interactive "click the wrong step" mode replace the current
  reveal-everything button, or exist as an alternate mode alongside it?
  Some warm-ups want speed (reveal immediately), others want the class to
  actively hunt first.
- Is sharing number-generation logic with the upcoming
  Fraction&ndash;Decimal&ndash;Percent Conversion Drill Generator worth the
  coupling between two otherwise-independent tools, or is hand-authoring a
  fixed set of mistake-problems (as done here) simpler to reason about and
  maintain even if it means some duplicated effort?
