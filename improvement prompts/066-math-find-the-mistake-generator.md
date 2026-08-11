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

**2026-08-11 — Round 2 (session `9iiyas`).** Shipped three of the four
Quick Wins below. Added an 8-category topic taxonomy (order of operations,
one-step equations, two-step equations, fractions, exponents, percents,
negative numbers, plus an `other` bucket for the 2 built-ins that didn't
cleanly fit a named topic — decimal multiplication and rectangle area) and
a filter panel that scopes both projector shuffling and worksheet
generation to only the checked categories; custom problems pick a category
on add. Projector-mode reveal is now two separate steps — first click shows
only the corrected work, second click adds the explanation — while
worksheet/answer-key mode is unchanged and still shows both together in one
pass, since it isn't a live reveal. Built-in problems can now be disabled
(not deleted) per-item from the bank list, persisted to a new
`mftm_disabled_builtins_v1` key, and excluded from both projector and
worksheet while disabled. Grade-band scoping (the fourth Quick Win) is not
yet started. Verified with headless Playwright — category filtering scoped
both modes correctly, reveal order was work-then-explanation, worksheet/key
stayed combined, disabling persisted across reload and could be
re-enabled — no console errors.

**Worth a second look next round:** the 2-problem `other` category was a
judgment call since the task's seven named topics didn't cleanly cover
decimal multiplication or rectangle area — a stricter category mapping
(or a ninth named category) might be worth reconsidering.

## What it does today

- 15 built-in worked-mistake problems across a spread of math topics, each
  tagged with one of 8 categories
- A category filter panel scoping both projector shuffle and worksheet
  generation
- Projector mode: shuffle, two-stage reveal (corrected work, then a
  separate explanation reveal)
- Worksheet mode: randomized subset + matching answer key (explanation +
  fix shown together, unaffected by the two-stage projector reveal)
- Per-built-in disable/enable without deleting, persisted across reload
- Custom problem bank layered on top of the built-ins, each with its own
  category

## Quick Wins

- **Grade-band scoping** for the built-in bank, similar to Math Fact Drill
  Sheet Generator's grade-band ranges — several built-ins (fractions,
  two-step equations) skew middle-school while others (basic order of
  operations) work for elementary too. (Carried over from last round — not
  yet started.)

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
