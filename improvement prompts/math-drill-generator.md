# Improvement Prompts — Math Fact Drill Sheet Generator

**Tool file:** `Tools/math-drill-generator.html`
**Support folder:** `Tools/math-drill-generator/` — `mdg-generate.js`, `mdg-store.js`, `mdg-templates.js`

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

Ideas below are deliberately ambitious and are **not** scoped to a single
session.

## What it does today

- Operation templates (`mdg-templates.js`) with configurable number ranges
  (`clampRange`, `readRangeInputs`, "reset range to template default")
- Generates a randomized worksheet plus a **matching answer key**
- **Version tabs** (`renderVersionTabs`) — multiple versions from one setting
- Worksheet / Answer key preview tabs; **print both pages**
- Settings import/export (`exportSettings`, `importSettingsFromFile`,
  `isPlausibleSettings`)
- **Fluency header** (`fluencyHeaderHtml`) — name/date/score/time

## Quick Wins

- **More operation types.** Fractions (add/subtract/multiply/divide),
  decimals, percents, integers with negatives, order of operations, exponents,
  one-step equations. `IDEAS_BACKLOG.md` lists a
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
- **Answer key on the same sheet, in a corner**, as an option — for
  self-checking stations.
- **Done —** **Seeded generation.** Save a seed so an identical sheet can be reprinted
  next year or for a make-up test, which "a fresh sheet every time" currently
  prevents. *(Mulberry32 seeded RNG; "Lock seed" checkbox + visible seed
  field, carried through settings export/import.)*
- **Multiple versions with the same problems in a different order** — the
  anti-copying pattern for a quiz, distinct from the existing version tabs.

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
- **Self-checking formats**: a riddle whose answer is spelled by correct
  answers, a colour-by-answer grid, a maze. These are the formats students
  actually engage with and they're all mechanical transformations of a
  problem set.
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
