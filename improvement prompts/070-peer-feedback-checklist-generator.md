# Improvement Prompts — 070 — Peer Feedback / Editing Checklist Generator

**Tool file:** `Tools/070-peer-feedback-checklist-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Build a custom peer-review checklist (grammar, structure, argument) from a template or from scratch, tied to a specific writing assignment, and print it as a half-sheet per student.

---

## Status

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: four starter templates (Narrative, Argumentative/Persuasive,
Informative/Expository, General), fully editable categories and checklist
items (add/edit/remove either), an assignment-title field, and a print view
that repeats the checklist as half-sheets (author/reviewer name lines and a
comments area) for a chosen number of copies. Single current checklist
autosaved to `localStorage` (`pfc_checklist_v1`). Verified with a headless
Chromium smoke test (template load with the confirm-replace dialog accepted,
add category, print with a mocked `window.print`) — no console errors.

Nothing below has been started.

## What it does today

- 4 templates, each with 3 categories and pre-filled checklist items
- Fully editable: rename/add/remove categories, edit/add/remove items
- Print N copies as half-sheets, each with blank author/reviewer name lines
  and a comments area

## Quick Wins

- **Reorder categories and items** (up/down buttons, matching Formula Sheet
  Builder / Rubric Builder's existing pattern) — order is currently fixed
  by template/insertion order.
- **A short rating option per item** (yes/no/somewhat, or a 1&ndash;3 scale)
  instead of a bare checkbox, so feedback captures degree, not just
  presence.
- **Print layout QA**: the half-sheet print CSS currently caps each block at
  a fixed height (`47vh`) and hides overflow — a checklist with many
  categories/items risks getting visually cut off. Should switch to a
  measured two-per-page layout or explicitly warn when a checklist is too
  long for a half-sheet.
- **A "duplicate template as starting point" option** — right now loading
  a template always fully replaces the current checklist; cloning it into
  an editable copy under a new name would let a teacher build variations
  faster.

## Major Features

- **Multiple named saved checklists**, matching the multi-save convention
  in Formula Sheet Builder and Rubric Builder — right now there's exactly
  one checklist per browser, so "Narrative Draft 1" and "Persuasive Essay"
  checklists can't both be kept ready at once.
- **JSON export/import** for sharing a built checklist between teachers or
  across the same PLC/grade-level team.
- **Roster-driven half-sheets**: pull a class roster (Name Picker/Class
  Roster Hub's shared storage) and pre-fill the Author name on each
  half-sheet instead of leaving it blank for hand-writing — saves a step for
  every single student, every single time.
- **Digital fill-in mode** via a share link (this toolkit's P3 pattern) —
  peer feedback collected on a device instead of paper, useful for a 1:1
  classroom.

## Moonshot / North Star

**A peer-feedback checklist that's pre-filled with the right names, sized
to fit a real half-sheet without surprises, and reusable across every
section that gets the same assignment.** Roster integration removes the
"write your partner's name" step at scale; multiple named saves mean the
narrative unit's checklist and the argumentative unit's checklist coexist
without overwriting each other; and a verified print layout means what's
on screen is exactly what comes out of the printer.

## Platform themes that matter here

- **P7 (cross-tool)** — roster integration (Name Picker/Class Roster Hub)
  and the multi-save pattern (Formula Sheet Builder, Rubric Builder) are
  both proven elsewhere in the toolkit and would bring this tool to parity.
- **P6 (print quality)** — the half-sheet height-cap risk is the most
  urgent print-quality gap of anything shipped in this round.
- **P3 (share links)** — a digital fill-in mode, later.

## Open Questions

- Should the half-sheet print layout guarantee "however much content fits,
  fits" (dynamically shrink font/spacing) or should the tool warn/refuse
  past some category+item count instead? The former is more robust; the
  latter is simpler to implement correctly.
- Is roster-driven pre-fill worth the complexity of pairing students (who's
  the author vs. the reviewer for each half-sheet), or is a blank
  hand-written name line — which supports any pairing arrangement a teacher
  chooses live — actually the more flexible default to keep?
