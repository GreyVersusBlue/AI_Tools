# Improvement Prompts — 059 — Scientific Method / Experiment Design Planner

**Tool file:** `Tools/059-experiment-design-planner.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** A guided pre-lab worksheet — testable question, If/then/because hypothesis, variables, materials, and procedure — printable as a fillable planning packet.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog — the explicit planning-stage companion to Lab Report
Template Builder (built earlier in this round). Unlike that tool, this one
ships as a single guided worksheet with no subject-flavored starter
templates: a testable-question prompt, a structured If/then/because
hypothesis (three separate fields instead of one free-text box, matching
how the scientific method actually decomposes a hypothesis), independent/
dependent/controlled-variable fields (controlled variables as an editable
list, since there are usually several), an editable materials list, and an
editable procedure list. Autosaves to `localStorage`
(`edp_planner_v1`). Verified with a headless Chromium smoke test (fill
every field, print, reload and confirm persistence) — no console errors.

**2026-08-11 — Round 2 (session `kq3g3h`).** Shipped two Quick Wins.

- **Done — Reorder list items.** Controlled variables, materials, and
  procedure steps each gained up/down buttons per row (disabled at the
  top/bottom edge of their own list), so fixing step order no longer
  requires deleting and re-adding items. Reuses the existing per-list
  `bindList()`/`renderList()` plumbing rather than adding new state shape.
- **Done — Independent/dependent variable sanity hint.** A warning line
  appears under the Variables card whenever the independent and dependent
  variable fields are the same text (case-insensitive, trimmed) — a
  concrete "you probably mixed these up" catch aimed at the exact mistake
  the prompt file called out. Recomputed on every keystroke in either
  field and also on load, so a saved-then-reopened plan with the mistake
  still already in it shows the hint immediately rather than only after
  the next edit.
- **Bug fix, found while touching the print handler:** the print view's
  fallback placeholders for empty fields (`'&hellip;'`, `'&mdash;'`) were
  HTML entities passed through `escapeHtml()`, which escapes `&` and so
  turned them into the literal visible text `&hellip;`/`&mdash;` on the
  printed page instead of an ellipsis/dash — any blank field printed with
  broken-looking placeholder text. Fixed by using the actual Unicode
  characters (`…`, `—`) as the fallback values instead of entities, since
  those pass through `escapeHtml()` unchanged.
- Verified with a headless Chromium smoke test: added and reordered
  materials, confirmed the sanity hint shows/hides correctly as the two
  variable fields are edited, reloaded and confirmed both the reorder and
  the (correctly absent) hint state persisted, and exercised the print
  handler without errors.

Not started this round: multiple named saved plans, the Lab Report
Template Builder hand-off (still the single highest-value item per the
Moonshot section), the subject hint/example toggle, and peer-review mode.
The Open Questions about a possible planning+reporting merge and where a
peer-review checklist should live are both still unresolved — nothing this
round narrows either decision.

**Where the next round should pick up:** multiple named saved plans is the
next Quick Win and is a prerequisite for the Lab Report Template Builder
hand-off to make sense (a hand-off from a single flat plan is fine today,
but once a teacher has several saved plans, the hand-off needs to name
which one).

## What it does today

- Testable question prompt
- Structured If/then/because hypothesis (3 separate fields)
- Independent/dependent variables + an editable controlled-variables list,
  with a sanity hint if the two variable fields match
- Editable materials and procedure lists, each reorderable via up/down
- Print: a fillable one-page planning packet

## Quick Wins

- **Reorder list items** (controlled variables, materials, procedure
  steps) via up/down buttons, matching the pattern used elsewhere in this
  toolkit — currently delete-and-re-add is the only reordering option.
- **A "does this variable make sense" sanity hint** — e.g. flag if the
  independent and dependent variable fields are identical, a common
  student mistake this guided worksheet could catch before printing.
- **Multiple named saved plans**, matching the multi-save convention used
  by most builder tools in this round — one flat plan per browser right
  now, so back-to-back labs overwrite each other's planning.
- **A subject hint/example toggle**, showing a filled-in example (like
  Lab Report Template Builder's subject templates) as a reference without
  actually populating the student's own fields.

## Major Features

- **Direct hand-off to Lab Report Template Builder**: export this plan's
  question/hypothesis/materials/procedure and pre-fill a new Lab Report
  Template Builder session with it, so a student's planning work carries
  straight into their post-lab report instead of being retyped. This is
  the single highest-value integration opportunity in this entire round,
  since both tools already exist and are explicitly described as
  companions.
- **A "peer review my plan" mode**: swap plans with a partner before
  running the experiment, with a simple checklist ("is the hypothesis
  testable? are the variables clearly separated?") — reuses this
  toolkit's Peer Feedback / Editing Checklist Generator pattern applied
  to lab planning instead of writing.
- **JSON export/import** for sharing a planning template between science
  teachers on the same team.
- **Safety flag integration**: pull relevant hazard symbols from Science
  Safety Symbol & Equipment Label Maker based on materials entered (e.g.
  typing "acid" surfaces the corrosive hazard reminder) — turns the
  planning stage into a safety checkpoint, not just a logistics form.

## Moonshot / North Star

**A planning worksheet whose output becomes the report's input, whose
materials list flags its own safety hazards, and whose hypothesis gets a
sanity check before a single measurement is taken.** The direct hand-off
to Lab Report Template Builder is the obvious next step given both tools
already exist in this same toolkit — closing that loop turns "two
separate forms a student fills out" into one continuous, connected
scientific-method workflow.

## Platform themes that matter here

- **P7 (cross-tool)** — the Lab Report Template Builder hand-off and
  Science Safety Symbol & Equipment Label Maker integration are both
  direct, high-value opportunities given all three tools now exist in this
  toolkit.
- **P15 (first run)** — a subject-example toggle reduces "what does a
  good hypothesis even look like" friction for a student using this for
  the first time.

## Open Questions

- Should the Lab Report Template Builder hand-off be a one-way export
  (copy planning data into a new report session) or should the two tools
  eventually merge into one multi-stage tool (plan &rarr; run &rarr;
  report) sharing a single saved record? A hand-off is much less work;
  a merged tool is more coherent but a bigger rebuild of both.
- Is a "peer review my plan" checklist worth building as a feature of
  this tool, or does it belong as a template option within Peer Feedback
  / Editing Checklist Generator (which already supports arbitrary
  checklist categories) instead of duplicating checklist-building logic
  here?
