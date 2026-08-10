# Improvement Prompts — Lab Report Template Builder

**Tool file:** `Tools/lab-report-template-builder.html`
**Support folder:** none yet — everything is inline in the one file.

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

Nothing below has been started.

## What it does today

- 4 subject-flavored starter templates, each covering every section
- Fully editable: title, objective, hypothesis prompt, materials,
  procedure, data table columns + row count, observations prompt,
  conclusion questions
- One-click print of a complete fillable packet matching the current
  template exactly

## Quick Wins

- **Reorder items within each list** (materials, procedure, columns,
  conclusion questions) via up/down buttons, matching Formula Sheet
  Builder / Rubric Builder's existing pattern — right now the only way to
  reorder is delete-and-re-add at the end.
- **Multiple named saved templates**, the same convention Formula Sheet
  Builder and Rubric Builder already use — right now there's exactly one
  lab template per browser, so "Acid-Base Lab" and "Pendulum Lab" can't
  both be kept ready between class periods.
- **A print preview** before committing to the print dialog — right now
  "Print packet" goes straight to `window.print()` with no chance to
  sanity-check the packet's layout first.
- **Procedure step numbering that survives reordering** is already correct
  (numbers are rendered from array order at print time, not stored) — worth
  noting so a future reorder feature doesn't accidentally break it.

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
