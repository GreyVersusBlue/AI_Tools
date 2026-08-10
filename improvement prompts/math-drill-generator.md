# Improvement Prompts — Math Fact Drill Sheet Generator

**Tool file:** `Tools/math-drill-generator.html`
**Support folder:** `Tools/math-drill-generator/` — `mdg-generate.js`, `mdg-store.js`, `mdg-templates.js`

**Current description (from README):** Randomized addition/subtraction/multiplication/division/mixed drill sheets with a matching answer key — a fresh sheet every time you generate.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

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
- **Vertical (stacked) format** as well as horizontal — required for
  multi-digit addition and long division practice, and currently missing.
- **Problems-per-page and font size** as explicit controls, so the same
  settings can produce a 20-problem sheet for a struggling student and a
  60-problem sheet for a timed drill.
- **Avoid trivial and repeated problems.** Filter out `n × 1` and `n × 0` if
  wanted, and don't emit the same problem twice on one sheet.
- **Answer key on the same sheet, in a corner**, as an option — for
  self-checking stations.
- **Seeded generation.** Save a seed so an identical sheet can be reprinted
  next year or for a make-up test, which "a fresh sheet every time" currently
  prevents.
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
