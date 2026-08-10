# Improvement Prompts — 062 — Geography Bee / Map Skills Quiz Generator

**Tool file:** `Tools/geography-bee-quiz-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** A 30-question built-in bank across capitals, landmarks, and map-reading skills, filterable by category, projected one at a time or printed as a quiz with an answer key.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from
the Ideas Backlog — closes out the Social Studies section for now. A
30-question built-in bank split evenly across three categories (Capitals,
Landmarks, Map Skills), a category filter that applies to projector
display, print, and bank view alike, shuffle, reveal-answer toggle, a
printable quiz + answer key built from a random subset, and a
teacher-editable custom bank that layers on top of the built-ins —
following the same reveal/shuffle/tabs/custom-bank pattern established
earlier in this round for Daily Editing / DOL Warm-Up Generator and Math
"Find the Mistake" Warm-Up Generator. Custom questions persist in
`localStorage` (`gbq_custom_v1`). Verified with a headless Chromium smoke
test (default question, reveal, category filter, add a custom question,
build a printable quiz) — no console errors.

Nothing below has been started.

## What it does today

- 30 built-in questions, 3 categories (Capitals, Landmarks, Map Skills)
- Category filter applies across all three views
- Projector mode: shuffle, reveal
- Print: randomized quiz subset + matching answer key
- Custom question bank layered on the built-ins

## Quick Wins

- **More built-in questions per category** — 10 each is a reasonable
  starting bank but will repeat noticeably with daily use; doubling or
  tripling is pure content work with no architecture changes, matching the
  same gap flagged on other bank-based generators in this round.
- **Multiple-choice mode** as an alternate display format (auto-generate
  3 wrong options from other entries in the same category) — a geography
  bee traditionally uses fill-in-the-blank/short-answer, but multiple
  choice would make this usable as a quick formative check too.
- **Settings persistence** — category filter and quiz question count both
  reset on every page load, unlike most sibling generators in this
  toolkit.
- **Hide/disable individual built-ins**, matching the same gap flagged on
  Daily Editing / DOL Warm-Up Generator and Math "Find the Mistake"
  Warm-Up Generator's built-in banks.

## Major Features

- **Direct integration with Blank Map Generator**, which the backlog
  explicitly names as this tool's companion — e.g. a landmark or capital
  question could link to (or auto-open) the relevant location on a Blank
  Map Generator map, turning a text quiz into a map-and-quiz combined
  activity.
- **A timed "bee" mode**: sudden-death elimination format with a visible
  countdown per question, matching how an actual geography bee competition
  runs (as opposed to the current self-paced practice format).
- **Region/continent tagging** beyond the current three categories, so a
  teacher covering "South America" specifically can filter to just that
  region's capitals and landmarks instead of the whole world.
- **Bulk import a custom bank** from a pasted list, matching the pattern
  already proven in Staff Directory Builder and Review Game Board.

## Moonshot / North Star

**A geography practice bank deep enough to run an actual competitive bee
(timed, elimination-format, region-filterable) that also connects directly
to Blank Map Generator so a question about a place shows that place.** The
Blank Map Generator integration is the single most on-brief improvement
given the backlog explicitly frames this tool as its "quiz-format
companion" — right now the two tools have no connection beyond a shared
theme.

## Platform themes that matter here

- **P7 (cross-tool)** — the explicit Blank Map Generator pairing is the
  clearest opportunity in this tool; bulk import (Staff Directory Builder,
  Review Game Board) is a second, smaller one.
- **P15 (first run)** — settings persistence is the most obvious first-run
  gap versus sibling generators built earlier in this round.

## Open Questions

- Should Blank Map Generator integration be "click a question, jump to
  that location on a map" (requires passing state between two separate
  tool pages, which this toolkit doesn't currently do anywhere) or a
  lighter-weight "here's a link to look this location up on Blank Map
  Generator" (much simpler, less seamless)?
- Is a timed competitive-bee mode worth building as a mode within this
  tool, or does the self-paced practice format already cover the more
  common classroom use case (individual/small-group practice) well enough
  that a full competition mode is lower priority than more content?
