# Improvement Prompts — 062 — Geography Bee / Map Skills Quiz Generator

**Tool file:** `Tools/062-geography-bee-quiz-generator.html` (everything still
inline in the one file — no support folder for the tool itself).
**Test folder:** `Tools/geography-bee-quiz-generator/test/` (test-only,
added 2026-08-14; the tool's own code has no separate module files).

**Current description (from README):** A 90-question built-in bank across capitals, landmarks, and map-reading skills, filterable by category, projected one at a time or printed as a quiz with an answer key &mdash; short answer or multiple choice, with auto-generated same-category distractors and a seeded, reprintable quiz version.

---

## Status

**2026-08-14 — SS demo round: multiple-choice quiz mode shipped (backlog
rank 29), session `mee9kj`.** The headline feature from
`prompts/social-studies-demo/062-geography-bee-mc.md`, done in full:

- A quiz-format setting (**Short answer** / **Multiple choice**) next to the
  category filter, persisted in `gbq_settings_v1` and applied immediately on
  change — no separate "apply" step, unlike the category filter.
- For each question, 3 distractors are sampled from OTHER questions'
  answers in the *same category*, drawn only from `filteredQuestions()` —
  i.e. whatever the teacher can currently see (hidden built-ins excluded,
  active category filter honored). Case-insensitive dedupe, never repeats
  the correct answer, shuffled option order. When a category has fewer than
  1 usable distractor left (checked live, not assumed), the question falls
  back to short answer rather than crashing or padding with a wrong-category
  answer — verified with a bank artificially thinned down to one visible
  question.
- Projector display: A&ndash;D options render under the question as soon as
  it's shown (this is a multiple-choice quiz, so the choices aren't a
  secret); Reveal highlights the correct option in green and adds a
  "Correct answer: B) Tokyo"-style line for anyone too far back to see the
  highlight. Prev/Next/Shuffle all still work as before and regenerate a
  fresh option set (Math.random-seeded — no reproducibility requirement on
  the live display, only on the printed paper below).
- Printed quiz: lettered options print under each question; the key states
  the letter and the answer text ("3. B &mdash; Tokyo"), and is guaranteed
  to match what's on the paper because both are built from one pass over a
  single seeded rng stream (recomputing distractors a second time for the
  key, from a fresh rng call, would silently desync the two — the
  implementation computes each question's options exactly once and reuses
  them for both the problem and the key).
- **Determinism**: a small mulberry32 PRNG (copied from the Blank Map
  Generator's worksheet-versions pattern, the repo's existing precedent for
  this) is seeded from a teacher-facing "Quiz version" number. Same version
  + same filter/count/bank state always regenerates the identical paper —
  useful for reprinting a lost copy or handing two class periods the same
  quiz. A "New version" button bumps the number and rebuilds for a fresh mix.
- **Built-in bank grown from 30 to 90** (scope-coupled to the headline per
  the prompt file — distractor quality depends on pool size): 30 per
  category, kept balanced, `bi30`&ndash;`bi89` appended after the untouched
  original `bi0`&ndash;`bi29`. The additions deliberately pull in more of
  Europe/Southeast Asia/the Middle East/South America than the original set
  had, without tipping the whole bank US/Europe-only (capitals: Germany,
  Spain, India, Indonesia, Nigeria, Argentina, Turkey, Thailand, Vietnam,
  the Philippines, and more; landmarks: Petra, Angkor Wat, Ha Long Bay,
  Victoria Falls, the Gobi Desert, Iguazu Falls, Table Mountain, and more;
  map skills: cardinal/intermediate directions, absolute vs. relative
  location, physical/political/topographic map types, the Tropics,
  International Date Line, parallels/meridians, and more). Every answer was
  checked against known geography, not generated and trusted.
- New smoke test `Tools/geography-bee-quiz-generator/test/smoke-multiple-choice.mjs`
  (`npm run test:geo-bee`, appended to the end of the root `test` chain) —
  29 checks covering distractor uniqueness/same-category sourcing (via a
  new test-only `window.__gbqTestHooks` following this repo's existing
  `window.__` convention), hidden-built-in exclusion from both rotation and
  MC pools, same-seed-same-quiz, key-matches-paper, the thin-pool fallback,
  format persistence across reload, and bank balance (30/30/30). Verified
  headless: zero console errors, zero offsite requests.

Cut from this round: nothing — the full headline plus every listed
Supporting item shipped. **Where the next round should pick up:** the Blank
Map Generator integration is still the single highest-value Major Feature
and the Open Questions below are still genuinely open — this round
deliberately didn't guess at an answer, per its own scope file's Non-goals.
A timed bee mode and region/continent tagging also remain unbuilt.

**2026-08-12 — Backlog round: bulk import a custom bank shipped (backlog
rank, then #5).** Identical shape to the same-day feature in
`053-cultural-trivia-card-generator.html` (built together, shared smoke
test): a "Bulk import a custom bank" card on the bank tab takes
`question | answer | category` lines, tab- or pipe-separated (no comma
splitting — geography questions are full of commas), extra pipe fields
folding into the answer. The optional category token is tolerant
(`capital…`, `landmark…`, `map skills`/`map`/`mapskills`); lines without
one use the Category picker above the form. Imports append to
`gbq_custom_v1` without touching built-ins, hidden built-ins, or existing
custom questions; the note reports added/skipped counts and quotes
unparseable lines; the textarea clears only on success. Verified with a
headless Chromium test: pipe and tab lines with/without category tokens,
comma-in-question survival, skip reporting, persistence, and bank-count
growth — zero console errors. **Where the next round should pick up:**
multiple-choice quiz mode (its own backlog row) and more built-ins per
category are the open items.

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

**2026-08-11 — Round 2 (session `kq3g3h`).** Shipped two Quick Wins.

- **Done — Settings persistence.** The category filter and the printable-
  quiz question count now persist to `localStorage` (`gbq_settings_v1`)
  and restore on load, matching sibling generators. Saved on "Apply
  filter" and on "Build quiz" rather than on every keystroke/selection
  change, so a half-typed count doesn't get persisted mid-edit.
- **Done — Hide/disable individual built-ins.** Each built-in question got
  a stable id (`bi0`&ndash;`bi29`); the Question Bank tab gained a
  Hide/Show toggle per built-in row (built-ins still can't be deleted,
  only hidden) alongside the existing per-custom-question Delete. Hidden
  built-ins are excluded from the projector display, shuffle order, and
  printable quiz pools, but still listed (grayed out, marked "hidden") in
  the bank itself so a teacher can find and re-enable one. The bank-count
  header now reads "N active of M" once anything is hidden, instead of
  just a flat count that no longer matched what's actually in rotation.
- Verified with a headless Chromium smoke test: filtered to Capitals,
  built a 5-question quiz, hid the "capital of France" built-in, confirmed
  it no longer appears anywhere in the projector rotation, reloaded and
  confirmed both the filter/count settings and the hidden state persisted.

Not started this round: more built-in questions per category, multiple-
choice mode, the Blank Map Generator integration (still the single
highest-value item per the Moonshot section), timed bee mode, region/
continent tagging, and bulk import. Both Open Questions (map-jump
integration depth; whether a timed bee mode is worth building) remain
unresolved.

**Where the next round should pick up:** bulk import (pasted list →
custom bank) is the next Quick Win and is pure content-entry tooling, no
architecture change — reuses the pattern already proven in Staff
Directory Builder and Review Game Board. The Blank Map Generator
integration is the highest-value Major Feature but needs an explicit
decision from the Open Questions first (jump-to-location vs a simple
link) before implementation.

## What it does today

- 90 built-in questions, 3 categories (Capitals, Landmarks, Map Skills),
  30 each, world-balanced
- Category filter applies across all three views, and persists across
  page loads along with the printable-quiz question count
- **Quiz format**: Short answer or Multiple choice, persisted, applied to
  both the projector display and the printed quiz
- Projector mode: shuffle, reveal (in MC mode, reveal highlights the
  correct A&ndash;D option and states it in text)
- Print: randomized quiz subset + matching answer key, either short-answer
  blanks or lettered MC options with a letter+text key; a "Quiz version"
  number reseeds the same reproducible paper on demand
- Custom question bank layered on the built-ins; individual built-ins can
  be hidden/shown without deleting them
- **Bulk import** (tab/pipe lines, optional tolerant category token) that
  appends to the custom bank

## Quick Wins

- ~~**More built-in questions per category**~~ — **done, 2026-08-14** (SS
  demo round; grown 30 &rarr; 90, see Status).
- ~~**Multiple-choice mode**~~ — **done, 2026-08-14** (SS demo round,
  headline feature; see Status).
- ~~**Settings persistence**~~ — **done, 2026-08-11** (Round 2; see
  Status).
- ~~**Hide/disable individual built-ins**~~ — **done, 2026-08-11** (Round
  2; see Status).

No Quick Wins remain open as of this round. A future round should look to
Major Features below, or find a genuinely new gap.

## Major Features

- **Direct integration with Blank Map Generator**, which the backlog
  explicitly names as this tool's companion — e.g. a landmark or capital
  question could link to (or auto-open) the relevant location on a Blank
  Map Generator map, turning a text quiz into a map-and-quiz combined
  activity. Still unbuilt; still blocked on the Open Question below.
- **A timed "bee" mode**: sudden-death elimination format with a visible
  countdown per question, matching how an actual geography bee competition
  runs (as opposed to the current self-paced practice format).
- **Region/continent tagging** beyond the current three categories, so a
  teacher covering "South America" specifically can filter to just that
  region's capitals and landmarks instead of the whole world.
- ~~**Bulk import a custom bank** from a pasted list~~ — **done,
  2026-08-12** (backlog round; see Status).
- ~~**Multiple-choice quiz mode**~~ — **done, 2026-08-14** (SS demo round;
  see Status).

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
