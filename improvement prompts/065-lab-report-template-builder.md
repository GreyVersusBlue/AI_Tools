# Improvement Prompts — 065 — Lab Report Template Builder

**Tool file:** `Tools/065-lab-report-template-builder.html`
**Support folder:** `Tools/lab-report-template-builder/` — test suite only; the
tool itself is still one self-contained file.

**Current description (from README):** Build a reusable lab report template — hypothesis, materials, procedure, a configurable data table, and conclusion prompts — from a subject-flavored starter or from scratch, and print a fillable packet for each lab.

---

## Status

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: four starter templates (Generic, Chemistry Reaction,
Biology Observation, Physics Measurement) each pre-filling an objective,
hypothesis prompt, materials checklist, procedure steps, data table columns,
observations prompt, and conclusion questions — every one of those is fully
editable and reorderable-by-delete-and-readd. The data table's row count and
column set are both configurable. Print produces one fillable packet (blank
lines under every prompt, checklist boxes for materials, a blank data grid
sized to the configured rows/columns). Single current template autosaved to
`localStorage` (`lrt_template_v1`). Verified with a headless Chromium smoke
test (template swap with confirm-dialog accepted, add a material, print) —
no console errors.

**2026-08-11 — Round 2 (session `9iiyas`).** Shipped all four Quick Wins
below. Up/down reorder buttons now sit on every list row (materials,
procedure, data-table columns, conclusion questions); procedure numbering,
as predicted last round, needed no separate fix since it's already derived
from array order at render time. Multiple named saved templates now exist,
storage-shaped to match Formula Sheet Builder / Rubric Builder
(`lrt_list_v1` name list, `lrt_data_v1:<name>` per-template blob,
`lrt_current_v1` pointer) — the old single-template key `lrt_template_v1`
is migrated once into a "My Template" entry on first load and then removed,
so nothing already saved was lost; verified this doesn't re-migrate or
duplicate on a second reload. A print preview modal reuses the exact same
`packetHtml()` output and print CSS classes as the real print, so there's
no second renderer to drift out of sync with the first. Verified with two
headless-Playwright passes: reorder + numbering, save-as/switch/persist
across reload for two distinct templates, old-key migration (including
no-duplicate-on-repeat-reload), and preview reflecting live edits — no
console errors.

**Known tradeoff, flagged for a future round rather than fixed now:**
renaming a template to a name that collides with an existing one silently
overwrites that entry — this mirrors the same accepted tradeoff in Formula
Sheet Builder / Rubric Builder rather than diverging from the toolkit's
existing convention, but collision protection would be a reasonable
follow-up if a reviewer wants it.

**2026-08-12 — Round 3 (backlog rank 4: typed data-table columns).** A data
column is no longer just a name. Each one now declares a **kind** — Number or
Text — and an optional **units** label, and both print under the column name
in the packet header, so a student can see the expected format before writing
anything in the cell. Numeric columns also right-align header and body cells,
so a column of measurements lines up on its digits the way a data table is
supposed to. The four subject starters ship with their columns already typed
(Trial → number, Time → number in sec, and so on).

A deliberate restraint: **only "number" is printed, never "text".** A blank
cell already reads as "write something here", so annotating every text column
would be noise on the page for no information. Units print for either kind.

Two things that bit, both worth remembering:

- **A `<select>` fires `input` as well as `change`.** The columns list shares
  one delegated `input` handler with the other three lists, whose single
  unlabelled input has always meant "the item's text" — so the kind dropdown
  fell straight through it and wrote the literal string "number" into the
  column's name. Fields now carry `data-field`, and anything that is not
  `text` exits the text path. Caught by the suite, not by eye.
- **Old templates must not be re-typed under the teacher.** Columns saved
  before this round are plain `{id, text}`; `loadTemplateByName` fills them in
  as explicit Text with empty units and writes that back. That prints the
  exact header they had before — including a hand-written `Mass (g)` that
  stays a name rather than being parsed into a units field. Guessing units out
  of existing column names was considered and rejected: it would silently
  rewrite a teacher's headers on a heuristic.

Columns keep the generic reorder/delete wiring — the richer row reuses the
same `data-up` / `data-down` / `data-del` attributes, so `bindListEvents`
drives it unchanged.

Verified with a new 22-assertion headless Chromium suite,
`Tools/lab-report-template-builder/test/smoke-typed-columns.mjs`
(`npm run test:lab-report`), asserting against the print-preview markup (which
is the real print renderer): starter column kinds, the header annotations, the
alignment class on both header and body cells, the three fields staying
separate, reorder/delete carrying kind and units, persistence across a reload,
and the legacy-template upgrade — no console errors.

**Next round should pick up** the pre-lab/post-lab packet split from the
backlog, and the rename-collision tradeoff flagged in round 2.

## What it does today

- 4 subject-flavored starter templates, each covering every section, with
  their data columns already typed
- Fully editable: title, objective, hypothesis prompt, materials,
  procedure, data table columns + row count, observations prompt,
  conclusion questions
- Data columns declare a kind (Number or Text) and an optional units label;
  the printed header carries both, and numeric columns right-align
- Reorder any list item (materials, procedure, columns, conclusion
  questions) via up/down buttons
- Multiple named saved templates, switchable from a dropdown, with
  automatic one-time migration from the old single-template format
- A print preview modal before committing to `window.print()`
- One-click print of a complete fillable packet matching the current
  template exactly

## Quick Wins

All four from the previous round shipped this round — see Status above.
Nothing queued here right now; the next round should look at Major
Features below.

## Major Features

- **JSON export/import**, so a built lab template can be shared between
  teachers on the same team/PLC, or backed up before a school year ends.
- **A pre/post-lab split**: a shorter "planning" packet (hypothesis,
  materials, procedure only) for the day before the lab, and a "report"
  packet (data, observations, conclusion) for after — instead of one packet
  covering both, which the backlog idea explicitly calls out as this tool's
  planning-stage sibling ("Scientific Method / Experiment Design Planner"
  is a separate backlog idea that overlaps here).
- **Safety symbol integration**: pull relevant hazard icons into the
  Materials section automatically based on keywords (matches the backlog's
  separate Science Safety Symbol & Equipment Label Maker idea — could share
  an icon set rather than duplicating one).
- **A data table with real column types** (numeric vs. text vs. units row)
  instead of a fully blank grid, so students see the expected unit/format
  before they start recording data.

## Moonshot / North Star

**One lab template that carries a class from the planning packet through
the completed report, reusable across sections and years, with safety
information built in rather than bolted on separately.** Multiple named
saves mean every unit's lab template survives to next year without
rebuilding; a pre/post split matches how labs are actually run across two
class periods; and shared safety-icon data means updating a hazard doesn't
mean updating two different tools.

## Platform themes that matter here

- **P7 (cross-tool)** — direct overlap with the backlog's Scientific
  Method / Experiment Design Planner and Science Safety Symbol & Equipment
  Label Maker ideas; worth deciding whether those become modes here or
  stay separate tools before either gets built.
- **P6 (print quality)** — a print preview matters more here than on most
  tools in this toolkit, since a bad data-table row count or column width
  wastes a page of the packet, not just a line.
- **P15 (first run)** — named saved templates would make "start of next
  year" nearly instant if it's the same lab.

## Open Questions

- Should the Scientific Method / Experiment Design Planner backlog idea be
  built as a "planning packet" export mode on this same tool (reusing the
  hypothesis/materials/procedure sections), or does it deserve its own
  entry point since a planning worksheet's audience (pre-lab) differs from
  a report packet's (post-lab)?
- Is per-column data typing (numeric/text/unit) worth the added UI
  complexity, or does a plain blank grid stay the right default given most
  data tables in a middle-school lab are simple enough not to need it?
