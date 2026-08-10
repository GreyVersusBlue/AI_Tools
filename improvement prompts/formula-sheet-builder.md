# Improvement Prompts — Formula Reference Sheet Builder

**Tool file:** `Tools/formula-sheet-builder.html`
**Support folder:** `Tools/formula-sheet-builder/` — `fsb-store.js`, `fsb-templates.js`

**Current description (from README):** Five topic templates (geometry, linear equations, quadratics, basic statistics) or start blank, customize and reorder the list, print a one-page reference sheet. Saves multiple named sheets.

---

## Status

**2026-08-10 — implementation round.** Shipped four of this round's five
scoped Quick Wins (formula picker, auto-fit-to-one-page, worked example,
variable key) plus verified the fifth already existed. Storage stayed
additive — every formula item gained `workedExample` (string) and
`variables` (array of `{symbol, meaning}`), both defaulted through a new
`normalizeItem()` applied on load, template-load, picker-add, and JSON
import, so sheets saved before this round load with empty examples/keys
rather than erroring.

What shipped, in order of the Quick Wins list:

- **Formula picker** — a "Browse formula library" button opens a modal
  listing every item from all five shipped templates (`fsb-templates.js`),
  grouped by topic, each with a "+ Add" button that appends just that one
  item to the current sheet (`renderFormulaPicker`, `data-add-tmpl`/
  `data-add-idx`). This makes the existing template content browsable
  without forcing an all-or-nothing "Load template" replace.
- **Auto-fit to one page** — `applyAutoFit()` measures the rendered
  `.sheet`'s actual height against 11in (1056px at 96px/in) and shrinks a
  CSS custom property (`--fs-scale`, applied to font sizes and spacing via
  `calc()`) in steps until it fits or hits a minimum readable 60% floor,
  showing "Auto-shrunk to N%" or a hard warning if it still doesn't fit even
  at the floor. The print button reuses the same `lastFitScale` the preview
  landed on, so print always matches what was on screen.
- **Worked example** and **variable key** — both shipped together as an
  expandable per-item editor (a &#9998; button toggles an `item-edit-panel`
  under that row) rather than crowding the quick add-form: a single
  worked-example text field, and a repeatable symbol/meaning variable-key
  list with its own add/remove. Both print on the sheet under the formula
  (`.fvars`, `.fexample`) and show in the editor list too.
- **Confirm on "Load template"** — checked first, and it **already
  existed** (a `confirm()` was already gating the replace before this
  round). Only the message text changed, to spell out that the current
  sheet's contents are what's at risk.

Not attempted this round, and explicitly out of scope per the task: **real
math rendering** (KaTeX or a hand-rolled renderer) and **print at half-sheet
/ index-card size** (both Quick Wins in the backlog below), and everything
under Major Features / Moonshot except the browsable-library sliver the
picker delivers.

## What it does today

- Topic templates (`fsb-templates.js`) or start blank
- Add / edit / reorder formula items; 1, 2, or 3 column layout
- Optional per-item image, downscaled on import (`readAndDownscaleImage`)
- Multiple named sheets (`gvb-formula-sheet:list` / `:data:*`), JSON
  import/export
- Print a one-page reference sheet

## Quick Wins

- **Skipped — deferred.** **Real math rendering.** Formulas are currently text. Even a small
  local subset renderer — superscripts, subscripts, fractions, radicals,
  Greek letters — would transform how the output looks. A vendored KaTeX
  build would be the complete answer and stays within the offline rule (P5)
  as long as it's bundled, not CDN-loaded. *(Not part of this round's scoped
  list — a genuinely separate effort; see Open Questions for the
  KaTeX-vs-hand-rolled tradeoff, still unresolved.)*
- **Done —** **A formula picker** rather than typing: browse a shipped library by topic
  and click to add. The templates prove the content exists; it just isn't
  browsable. *(A modal listing every item from all five shipped templates,
  grouped by topic, each with its own "+ Add" that appends just that item.)*
- **Done —** **Auto-fit to one page.** The promise is "a one-page reference sheet"; the
  tool should shrink type and adjust columns until it actually fits, and warn
  when it can't. *(A `--fs-scale` CSS variable shrunk in steps against the
  rendered sheet's measured height, down to a 60% floor, with a visible
  "auto-shrunk to N%" note or a hard warning if it still won't fit; print
  reuses the same scale the preview landed on.)*
- **Done —** **Worked example under each formula**, optional, since that is what makes a
  reference sheet usable by a struggling student. *(An expandable per-item
  editor panel, opened via a &#9998; button on each formula row.)*
- **Done —** **Variable key** ("r = radius") as a structured field rather than prose.
  *(Shipped in the same expandable panel as the worked example: a repeatable
  symbol/meaning list, printed under the formula.)*
- **Skipped — deferred.** **Print at half-sheet or index-card size** for a taped-to-the-desk version.
  *(Not part of this round's scoped list — the sheet is still fixed at
  8.5×11in; a natural next Quick Win alongside the column-count control that
  already exists.)*
- **Done — already existed.** **Confirm on "Load template (replaces current list)"** (P11) — it silently
  discards work. *(The `confirm()` gate was already there before this round;
  only the message text changed, to spell out that the current sheet's
  contents are what's at risk.)*

## Major Features

- **Skipped — deferred.** **Printed scaffolding variants of the same sheet** (teacher-generated, given
  out on paper — not a student-operated feature). A blank version where the
  student fills in the formulas, a partially-blank version, and a full
  version — generated from one source. This is the standard scaffolding
  progression and it's three print modes over the same data. *(Not attempted
  this round.)*
- **Skipped — deferred.** **Allowed-on-the-test sheet.** Mark which formulas are permitted on an
  assessment and print exactly that subset with a header saying so — the most
  common real reason this sheet gets made. *(Not attempted this round.)*
- **Partially done.** **A shipped library worth having.** Middle and high school math, physics,
  chemistry, plus unit conversions and geometry area/volume. The
  `IDEAS_BACKLOG.md` entry for a Unit Conversion Chart Builder is really a
  request for this library to exist. *(The formula picker above makes the
  existing five math templates browsable, but no new subject content was
  added — the library itself is exactly as big as it was.)*
- **Skipped — deferred.** **Interactive mode for the projector.** Tap a formula to see it solved for
  each variable, or plug in numbers and see the result, at a size the room
  can read — a teacher-driven demonstration surface rather than a static
  sheet. *(Not attempted this round.)*
- **Skipped — deferred.** **Subject packs beyond math**: chemistry (polyatomic ions, solubility
  rules), physics (kinematics, circuits), grammar (parts of speech reference),
  world language (verb endings). The engine is subject-agnostic; only the
  content is math today. *(Not attempted this round — the picker and the
  new per-item fields make this cheaper whenever someone does take it on,
  since the display/print machinery no longer needs to change, only the
  content.)*

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
