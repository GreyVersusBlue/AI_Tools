# Improvement Prompts — Formula Reference Sheet Builder

**Tool file:** `Tools/formula-sheet-builder.html`
**Support folder:** `Tools/formula-sheet-builder/` — `fsb-store.js`, `fsb-templates.js`

**Current description (from README):** Five topic templates (geometry, linear equations, quadratics, basic statistics) or start blank, customize and reorder the list, print a one-page reference sheet. Saves multiple named sheets.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Topic templates (`fsb-templates.js`) or start blank
- Add / edit / reorder formula items; 1, 2, or 3 column layout
- Optional per-item image, downscaled on import (`readAndDownscaleImage`)
- Multiple named sheets (`gvb-formula-sheet:list` / `:data:*`), JSON
  import/export
- Print a one-page reference sheet

## Quick Wins

- **Real math rendering.** Formulas are currently text. Even a small
  local subset renderer — superscripts, subscripts, fractions, radicals,
  Greek letters — would transform how the output looks. A vendored KaTeX
  build would be the complete answer and stays within the offline rule (P5)
  as long as it's bundled, not CDN-loaded.
- **A formula picker** rather than typing: browse a shipped library by topic
  and click to add. The templates prove the content exists; it just isn't
  browsable.
- **Auto-fit to one page.** The promise is "a one-page reference sheet"; the
  tool should shrink type and adjust columns until it actually fits, and warn
  when it can't.
- **Worked example under each formula**, optional, since that is what makes a
  reference sheet usable by a struggling student.
- **Variable key** ("r = radius") as a structured field rather than prose.
- **Print at half-sheet or index-card size** for a taped-to-the-desk version.
- **Confirm on "Load template (replaces current list)"** (P11) — it silently
  discards work.

## Major Features

- **Printed scaffolding variants of the same sheet** (teacher-generated, given
  out on paper — not a student-operated feature). A blank version where the
  student fills in the formulas, a partially-blank version, and a full
  version — generated from one source. This is the standard scaffolding
  progression and it's three print modes over the same data.
- **Allowed-on-the-test sheet.** Mark which formulas are permitted on an
  assessment and print exactly that subset with a header saying so — the most
  common real reason this sheet gets made.
- **A shipped library worth having.** Middle and high school math, physics,
  chemistry, plus unit conversions and geometry area/volume. The
  `IDEAS_BACKLOG.md` entry for a Unit Conversion Chart Builder is really a
  request for this library to exist.
- **Interactive mode for the projector.** Tap a formula to see it solved for
  each variable, or plug in numbers and see the result, at a size the room
  can read — a teacher-driven demonstration surface rather than a static
  sheet.
- **Subject packs beyond math**: chemistry (polyatomic ions, solubility
  rules), physics (kinematics, circuits), grammar (parts of speech reference),
  world language (verb endings). The engine is subject-agnostic; only the
  content is math today.

## Moonshot / North Star

**Any reference sheet a class needs, properly typeset, in three minutes.**
Browse a real library or type your own, get correct mathematical typesetting,
auto-fit to the page, and print the full version for the wall, the blank
version for the students to build, and the allowed-subset version for the
test — from one source, offline, free.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Interactive reference on a student device** via a share link. The
  projector-driven interactive mode above covers the demonstration case.

## Platform themes that matter here

- **P5 (offline integrity)** — if a math renderer is added, it must be
  vendored, not CDN-loaded.
- **P6 (print quality)** — auto-fit to exactly one page is the core print
  problem here.
- **P12 (storage)** — per-item images base64'd into `localStorage`.
- **P15 (first run)** — templates are good; a browsable library is better.

## Open Questions

- Is vendoring KaTeX (a few hundred KB) acceptable given the site's
  single-file-tool ethos? A minimal hand-rolled renderer covering fractions,
  exponents, roots, and Greek would be much smaller and cover most of what a
  middle school sheet needs.
- Should the formula library be shared with `math-drill-generator.html` and a
  future unit-conversion tool rather than living only here?
