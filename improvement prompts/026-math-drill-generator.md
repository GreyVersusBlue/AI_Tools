# Improvement Prompts — 026 — Math Fact Drill Sheet Generator

**Tool file:** `Tools/026-math-drill-generator.html`
**Support folder:** `Tools/math-drill-generator/` — `mdg-generate.js`, `mdg-store.js`, `mdg-templates.js`, `test/`

**Current description (from README):** Randomized addition/subtraction/multiplication/division/mixed drill sheets with a matching answer key — a fresh sheet every time you generate.

---

## Status

**2026-08-10 — Round 5 (PR #56): five Quick Wins shipped.** All changes were
additive to `settings` (new fields default sensibly for old saved settings)
and to `MathDrillGenerate.generateProblems()`, which now takes an optional
third `options` argument instead of changing its existing signature.

- **Done — Vertical (stacked) format.** A Format dropdown (Horizontal /
  Vertical) renders each problem as a right-aligned two-row table with a rule
  and a blank answer line; division gets an actual long-division bracket
  (blank quotient line over a bracketed dividend/divisor), not just a stacked
  fraction. Reuses the existing `columns` setting, capped at 4 in vertical
  mode since stacked problems are wider.
- **Done — Font size control.** Small/Medium/Large, applied via a CSS class
  on the problems/answers containers rather than inline sizing, so print and
  preview stay in sync.
- **Done — Avoid trivial and repeated problems.** `mdg-generate.js` gained
  `isTrivial()` (filters ×0/×1/÷1/+0-style facts) wired to a checkbox; the
  existing per-sheet dedup (`seen` map) was untouched, just now composed with
  the triviality filter in the same generation attempt loop.
- **Done — Seeded generation.** `mdg-generate.js` gained a `makeRng(seed)`
  (mulberry32) and every `randInt`/`pick` call now threads a `rng` function
  instead of calling `Math.random()` directly. A "Lock seed" checkbox keeps
  reusing the same seed across "Generate" clicks (so a sheet can be reprinted
  identically for a make-up test), and the seed is shown read-only and
  travels through settings export/import. Multiple versions/leveled sets use
  `seed + index` so each version is still distinct but the whole set is
  reproducible together.
- **Done — Problems-per-page.** An optional numeric field splits the
  worksheet (not the answer key, which stays teacher-facing and single-page)
  into multiple `.sheet` pages with "(page X of Y)" in the title and correct
  continuous numbering, using `page-break-after` the same way multi-version
  sheets already did.

Verified with a headless Chromium smoke test (vertical format + avoid-trivial
+ locked seed + 10-per-page all together, checking the generated markup and
seed reproducibility) — no console errors, seed-lock confirmed byte-identical
across two "Generate" clicks.

**Where a future round should pick up:** everything under Major Features
below is untouched — targeted practice from missed facts, fluency history,
word problems, "find the mistake" mode, and the self-checking formats
(riddle/colour-by-answer/maze) are all still open. The Open Questions below
are unresolved by this round.

## Pass 2 — Round 2 update — 2026-08-11 (session `mxpfjs`)

Both remaining open Quick Wins shipped, fully wired end-to-end (no orphaned
functions or CSS):

- **Answer key on same sheet, in a corner.** A "same-sheet-key" checkbox adds
  a compact bordered `.same-sheet-key` box to the worksheet itself, right
  after the sheet meta/fluency header and before the problems grid. It's
  computed per page (not per sheet), so it works correctly with
  problems-per-page pagination — each page's box only lists the answers for
  the problems actually on that page, numbered to match. It's independent of
  vertical vs. horizontal format since it's driven off `p.answer`, not the
  problem layout. A second control ("Also keep the separate answer key
  page" / "Replace it — corner box only") lets the teacher choose whether
  `buildPrintArea()` still emits the separate teacher-facing answer-key page
  alongside it, satisfying "instead of, or in addition to."
- **Same problems, reordered per version (anti-copying).** `mdg-generate.js`
  gained `shuffleWithRng()` (seeded Fisher-Yates) and `reorderVersions(
  problems, count, seed)`, which takes one already-generated problem list and
  returns `count` copies of it reordered — a transform, not a new generation
  mode. Wired via a "Same problems, reordered per version" checkbox: when
  checked with more than one version, `generate()` produces the base list
  once and calls `reorderVersions()` instead of generating `versions`
  independent random sheets. Version A keeps the original order; later
  versions are independently reshuffled from the seed. Each version's answer
  key numbering is derived from that version's own (reordered) problem
  array, so it always matches.

**Testing performed:** `node --check` on all three support modules and the
extracted inline `<script>` block (all pass). Headless Chromium smoke test
(`/opt/pw-browsers/chromium`) via `file://`, covering: same-sheet key +
vertical format + 8-per-page pagination across a 3-page worksheet (box
present on every page, numbering matches, corner-key answers byte-match the
separate answer key); "replace" mode confirmed to drop the separate
answer-key page from the built print area; reordered-versions mode with 3
versions confirmed to share the exact same (problem → answer) pairing set
while differing in order, with per-version answer keys matching each
version's own order. Zero console errors throughout.

**Where a future round should pick up:** everything under Major Features
below remains untouched — targeted practice from missed facts, fluency
history/tracking, word problems, "find the mistake" mode, and the
self-checking formats (riddle/colour-by-answer/maze) are all still open, as
are both Open Questions below. All Quick Wins are now Done.

Ideas below are deliberately ambitious and are **not** scoped to a single
session.

**2026-08-12 — Round 5 (backlog rank 3: more operation types).** Five new
templates take this from a K-5 fact-fluency tool to one that covers the 6-8
band it is filed under: **Integer Operations (+ − ×)**, **Decimal Operations
(+ − ×)**, **Fraction Addition & Subtraction**, **Percent of a Number**, and
**Order of Operations**.

The thing that made this more than five more `TEMPLATES` entries: the original
four are all `number symbol number`, so the renderer read the operands
straight off the problem. None of the new five are that shape — a fraction has
no single numeric operand, "20% of 60" has no operator symbol, and an
order-of-operations problem is one expression rather than two operands. Rather
than five special cases in the renderer, a problem may now carry `aText` /
`bText` / `answerText` (or `expr` for a whole expression), which the renderer
prefers when present. The four fact drills set none of those and go down
exactly the path they always did.

`vertical: false` is the other half of that: stacked column layout is a
whole-number convention, and there is no sensible way to stack `(3 + 4) × 5`,
so the new types are written across even when the sheet is set to vertical.

Every type is built to keep the answer key clean, which is the actual
constraint on a drill sheet:

- **Fractions** are proper, subtraction is ordered so nothing goes negative,
  and answers are reduced and written as mixed numbers.
- **Decimals** are computed in tenths and divided at the end, so no answer
  arrives as `4.300000000000001`. Multiplication pairs a decimal with a whole
  number so the result stays at one place.
- **Percents** use a base that is a multiple of 20, so every percent on the
  list lands on a whole number — the drill is about the percent, not about
  long division.
- **Order of operations** builds its division case from the quotient, so it
  always comes out even.

**One real bug, caught by the suite rather than by eye:** the `b × c − a`
shape drew `a` from a fixed 1-12, so `2 × 2 − 9` produced −5 on a sheet whose
other four types are all non-negative. `a` is now drawn from below the product.

**A rough edge left in place:** the operand-range panel is still shown for
fractions, percents and order of operations, which generate from their own
fixed pools and ignore it. Integers use the range as a magnitude bound and
decimals as the whole-number part, so it means something for two of the five.
Hiding or relabelling the panel per template is the fix, and it is UI work
rather than generator work.

Verified with two suites, both wired into `npm run test:math-drill`:

- `Tools/math-drill-generator/test/drill-math.test.mjs` — pure Node, no
  browser, **3812 assertions**. It generates 200 problems per type against a
  seeded RNG and re-derives every answer independently of the generator
  (order-of-operations expressions are re-evaluated from their printed text,
  which is the precedence rule the problem is testing). An answer key that is
  wrong is worse than a layout that is ugly.
- `Tools/math-drill-generator/test/smoke-new-types.mjs` — 50 assertions in a
  browser, proving the arithmetic reaches the paper: the failure it catches is
  a worksheet printing "undefined + undefined" while the answer key is
  perfect.

**Next round should pick up** the range panel edge above, then exponents and
one-step equations — the same display-text mechanism now carries them without
touching the renderer.

## Status — 2026-08-13 — self-checking output formats (backlog: "Self-checking sheet formats")

**Shipped and verified.** Riddle-answer, colour-by-answer, and maze are three
new OUTPUT FORMATS — a new "Self-checking format" dropdown next to Format —
that transform how an already-generated problem set prints. They don't add a
new problem type and don't touch `MathDrillGenerate.generateProblems()`; all
three are pure functions of a `{ answer, answerText }` problem list in a new
module, `Tools/math-drill-generator/mdg-selfcheck.js`, so every existing
template (the four fact drills, fact families, mixed, integers, decimals,
fractions, percent, order of operations) gets all three formats for free.
Each format has a worksheet rendering and an answer-key rendering, wired
into `worksheetHtml()`/`answersHtml()` in the tool's inline script.

- **Riddle-answer.** A built-in bank of 15 short classroom riddles
  (`RIDDLES` in `mdg-selfcheck.js`). Each **distinct** answer value in the
  set (not each problem — basic fact drills often have far fewer distinct
  answers than problems, e.g. addition on 1-12 has ~23 distinct sums for
  what might be 30 problems) is assigned one letter of the punchline, in
  order of first appearance, so the decoder table (value -> letter) is
  always a clean function even when many problems share an answer. The
  riddle with a distinct-letter count that fits the available distinct
  answers, and a total length closest to the problem count, is picked; if
  nothing in the bank fits (a tiny or very narrow-range set), the bank's
  simplest riddle is **truncated** to as many letters as the set can
  support and a note says so on the sheet. The worksheet prints the
  punchline as blanks (each blank labelled with the *value* it needs, not
  the letter) plus the decoder key (value = letter); the answer key prints
  the solved punchline. Self-checking comes from the lookup step: an answer
  that isn't in the decoder key means an arithmetic mistake, the same way a
  commercial riddle worksheet works.
- **Colour-by-answer.** Five hand-authored pixel-grid pictures (heart,
  star, house, arrow, smiley — `COLOR_PATTERNS`) and an 8-colour named
  palette (`PALETTE`). The picture whose filled-cell count is closest to
  the problem count is picked; filled cells are numbered and cycle through
  the problem list with `%` (so a picture bigger than the problem count
  reuses problems, and one smaller than the count leaves the excess
  problems out of the picture — they're still on the plain worksheet).
  Colour is assigned per **distinct** answer value, cycling the palette, so
  the same answer always colours the same cell colour everywhere. The
  worksheet prints numbered, uncoloured cells plus a colour-name legend —
  explicitly kept black-and-white-photocopy-safe per the assignment; the
  answer key prints the same grid with the cells actually filled in colour
  (`-webkit-print-color-adjust: exact` so it survives printing too) for a
  fast visual check.
- **Maze.** A real generated maze — recursive-backtracker on a small grid
  (6x6 to 10x9 depending on problem count), not a linear illusion of
  branching. Empirical measurement (documented in `mdg-selfcheck.js`) found
  that a perfect maze's *corner-to-corner* path branches surprisingly
  rarely (~1-2 junctions on a 6x6), so the solution path is instead the
  **tree's diameter** (the two cells farthest apart, found by the standard
  double-BFS trick), which roughly doubles the junction count for the same
  grid size, and `buildMaze()` keeps the best of 6 generated candidates.
  Even so, a typical maze only gates something like 3-10 problems out of a
  30-problem set — the rest print afterward as a "Bonus problems" list on
  the same page rather than silently disappearing. Each junction is one
  problem from the set; its answer is the "continue" choice, and the
  junction's other open doors carry decoy values (other problems' real
  answers, or a numeric perturbation if the set doesn't have enough
  distinct alternatives) — 2-3 choices per junction as the assignment
  specified. The maze replaces the plain problem list entirely (it doesn't
  get appended after it, unlike the other two formats) since the maze *is*
  the delivery mechanism for its problems. Walls render as plain CSS
  borders on a grid of cells (open side = no border, so adjoining open
  cells visually merge) — deliberately not SVG or absolutely-positioned
  wall segments, to stay simple and printable. **Accepted limitation,
  stated directly in the module's header comment:** a student who traces
  which printed choice bubble sits nearer the exit instead of doing the
  arithmetic can shortcut the maze, the same way tracing a printed maze's
  walls instead of solving it always could — this format doesn't try to
  defeat that, only to add real friction.
- All three **ignore "problems per page"** and always print as one page —
  a deliberate simplification stated in the UI hint text, not a bug; a
  self-checking sheet is meant to be one activity, not paginated fragments.
  All three also **suppress the "answer key on same sheet, in a corner"**
  checkbox's box, since a corner box listing every plain answer would
  trivially spoil the puzzle these formats exist to be. Riddle and
  colour-by-answer still honour Format/Font size/pagination for the *plain
  problem section* they're appended to; maze ignores Format entirely (its
  junction problems always print across, like fractions/percent/ooo
  already do) since there's no way to stack a problem inside a maze cell.
- **Seeded/reproducible**, consistent with the tool's existing "Lock seed"
  promise: `buildMaze()` takes the sheet's own `settings.seed`, so locking
  the seed reproduces the identical maze too. Riddle and colour-by-answer
  selection needed no RNG at all — both are fully deterministic
  (order-of-first-appearance + best-fit search), which was a deliberate
  design choice over introducing randomness that would then need seeding.

**Testing performed**, added to the two existing suites already wired into
`npm run test:math-drill` (package.json is off-limits for this round per the
assignment boundaries, so no new top-level test file was created — new
assertions were added into the two files already in the chain instead):

- `Tools/math-drill-generator/test/drill-math.test.mjs` gained a
  "Self-checking formats" section (**106 new assertions**, 3812 -> 3918
  total): riddle decoder round-trips correctly for every letter position,
  the decoder is a clean function (no value maps to two letters), every
  decoder value is a real answer from the set; colour-by-answer legend
  matches what's actually painted on every filled cell; maze paths are
  contiguous walks, every junction has exactly one correct choice and no
  duplicate-valued choices, every problem ends up as a junction or a bonus
  problem, seeding is reproducible and different seeds differ, and all
  three formats return `null` rather than throwing on an empty problem set.
- `Tools/math-drill-generator/test/smoke-new-types.mjs` gained a browser
  section (**22 new assertions**, 50 -> 72 total): the picker offers all
  three formats; riddle/colour-by-answer worksheets keep the plain problem
  list and add their section, with no "undefined"/"NaN" anywhere; maze
  worksheets have zero `.problems` elements (confirming the replacement,
  not an addition); each answer key reveals its solution (solved
  punchline, filled colour cells, underlined correct maze choices, shaded
  solved path); and the printed sheet carries the maze section through the
  same way it already carried the plain problems.
- Manual verification via headless-Chromium screenshots in both screen and
  `emulateMedia('print')` modes for all three formats, worksheet and
  answer key: confirmed no horizontal overflow (`scrollWidth === clientWidth`
  on every `.sheet`), confirmed content that runs long (the maze sheet
  runs to about 1.75 printed pages at 30 problems) flows onto a second
  physical page instead of clipping — no `overflow: hidden` was added
  anywhere in the new CSS, per the standing print-clipping warning in
  CLAUDE.md, and `.sheet` keeps its existing `min-height` (not a fixed
  `height`) so it's free to grow.

**New file, needs central `sw.js` precaching** (not done here — `sw.js` is
in this round's do-not-touch list; the session responsible for `sw.js`
should add this and bump `CACHE_VERSION`):
`Tools/math-drill-generator/mdg-selfcheck.js`.

**Where a future round should pick up:** the maze's "3-10 junctions out of
30 problems" ratio is inherent to how sparsely a perfect maze branches, not
a bug — a future round wanting to gate *more* of a large problem set with
one maze would need either a bigger grid (print-real-estate tradeoff) or a
maze variant that deliberately adds loops/extra walls removed (an
"imperfect" maze) to manufacture more junctions per cell. The riddle bank
is only 15 riddles; more variety, or a topic-themed sub-bank per subject,
would extend it cheaply since `pickRiddle()`'s best-fit search doesn't care
how many entries are in `RIDDLES`. Colour-by-answer's five pictures are
simple hand-authored pixel art (recognizable but not elaborate, as the
assignment allowed) — more pictures, or an actual small SVG/procedural
shape library, is future scope. Everything else under Major Features below
remains untouched.

## What it does today

- Operation templates (`mdg-templates.js`) with configurable number ranges
  (`clampRange`, `readRangeInputs`, "reset range to template default") —
  the four fact drills, fact-family drills per digit, mixed operations, plus
  integers, decimals, fractions, percent of a number, and order of operations
- Generates a randomized worksheet plus a **matching answer key**
- **Version tabs** (`renderVersionTabs`) — multiple versions from one setting
- Worksheet / Answer key preview tabs; **print both pages**
- Settings import/export (`exportSettings`, `importSettingsFromFile`,
  `isPlausibleSettings`)
- **Fluency header** (`fluencyHeaderHtml`) — name/date/score/time
- **Self-checking output formats** (`mdg-selfcheck.js`) — riddle-answer,
  colour-by-answer, and maze, any already-generated problem set rendered as
  a self-checking puzzle instead of (or, for riddle/colour-by-answer, in
  addition to) the plain worksheet, each with its own answer key

## Quick Wins

- **Mostly done — More operation types** (2026-08-12): fractions
  (add/subtract), decimals, percents, integers with negatives, and order of
  operations all shipped. Fraction multiply/divide, exponents and one-step
  equations are still open, and now need only a generator case each.
  Originally worded as: `IDEAS_BACKLOG.md` lists a
  fraction–decimal–percent drill as a separate tool; it belongs here.
- **Done —** **Vertical (stacked) format** as well as horizontal — required for
  multi-digit addition and long division practice, and currently missing.
  *(Format dropdown; division renders as an actual long-division bracket.)*
- **Done —** **Problems-per-page and font size** as explicit controls, so the same
  settings can produce a 20-problem sheet for a struggling student and a
  60-problem sheet for a timed drill. *(Font size is Small/Medium/Large;
  problems-per-page paginates the worksheet into multiple numbered pages.)*
- **Done —** **Avoid trivial and repeated problems.** Filter out `n × 1` and `n × 0` if
  wanted, and don't emit the same problem twice on one sheet. *(Per-sheet
  dedup already existed; added an "Avoid trivial facts" checkbox.)*
- **Done — Pass 2, Round 2 —** **Answer key on the same sheet, in a corner**, as an
  option — for self-checking stations. *("Answer key on same sheet" checkbox
  prints a compact bordered box, per-page, matching that page's problems and
  numbering; a "Replace it / Also keep the separate page" select controls
  whether the teacher-facing answer-key page still prints alongside it.)*
- **Done —** **Seeded generation.** Save a seed so an identical sheet can be reprinted
  next year or for a make-up test, which "a fresh sheet every time" currently
  prevents. *(Mulberry32 seeded RNG; "Lock seed" checkbox + visible seed
  field, carried through settings export/import.)*
- **Done — Pass 2, Round 2 —** **Multiple versions with the same problems in a
  different order** — the anti-copying pattern for a quiz, distinct from the
  existing version tabs. *("Same problems, reordered per version" checkbox;
  `mdg-generate.js` gained `reorderVersions()`/`shuffleWithRng()`, a
  seeded-shuffle transform over one already-generated problem list rather
  than a new generation mode. Version A keeps the original order; later
  versions are independently reshuffled but the whole problem/answer set —
  and per-version answer key numbering — stays identical across versions.)*

## Major Features

- **Targeted practice from data.** "Generate a sheet of only the facts this
  student missed." Requires a way in — a paste, or a tap-what-they-missed
  grid — and turns a random generator into an intervention tool.
- **Progression / fluency tracking.** A student's drill history over weeks,
  timed scores, and a printable progress chart. Fluency practice is
  fundamentally longitudinal and the tool currently has no memory.
- **Word problems.** `IDEAS_BACKLOG.md` has a word-problem generator as a
  separate idea; a templated version here (same numbers, wrapped in context)
  is a small addition with a big pedagogical difference.
- **"Find the mistake" mode** — also on the backlog — is this generator plus
  a deliberate error and a worked solution. Cheap to add on top of what
  exists.
- **Done — 2026-08-13 —** **Self-checking formats**: a riddle whose answer
  is spelled by correct answers, a colour-by-answer grid, a maze. *(All
  three ship as a "Self-checking format" dropdown — `mdg-selfcheck.js` —
  transforming an already-generated problem set rather than adding a new
  problem type; see the dated Status entry above for the design and
  scoping tradeoffs on the riddle bank and the maze generator.)*
- **On-screen practice mode** with immediate feedback via a share link (P3),
  for a student on a device — with no accounts and nothing stored.

## Moonshot / North Star

**Any arithmetic practice a student needs, in the format that will actually
get done.** Choose the skill or import the misses, choose the shape (plain
drill, riddle, colour-by-answer, word problems, find-the-mistake, on-screen),
choose the difficulty, and print a sheet with an answer key — reproducibly, so
the same sheet can be reprinted, and longitudinally, so the sheet gets harder
as the student improves.

## Platform themes that matter here

- **P6 (print quality)** — problems-per-page and legible sizing are the whole
  output.
- **P15 (first run)** — templates are good; a skill-picker organized by grade
  band would be better.
- **P7 (cross-tool)** — three `IDEAS_BACKLOG.md` entries (word problems,
  find-the-mistake, fraction/decimal/percent) are extensions of this tool
  rather than new tools.
- **P3 (share links)** — an on-screen practice mode.

## Open Questions

- Should the backlog's three math-generator ideas be built here as modes, or
  as separate tools sharing a generator module? Building them here is less
  work and gives one place to look; separate tools are easier to find from the
  landing page.
- Is fluency history worth storing given the site's careful stance on student
  data? It's arguably the most useful and the most sensitive addition.
