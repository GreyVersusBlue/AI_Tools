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

**2026-08-11 — Round 2 (session `4o6xmy`).** Two of the four Quick Wins
shipped, verified with a headless Chromium smoke test (real interactions,
`window.print` mocked) with zero console errors:

- **Reorder categories and items** via up/down buttons on both the
  category header and each item row.
- **Print layout QA**, addressed as a hybrid of the two options the file's
  own Open Questions posed rather than picking one: an on-screen warning
  banner appears once a checklist's total category+item count crosses a
  threshold ("on the larger side" at 12+, "long for a half-sheet" at 18+),
  *and* the print CSS now scales font-size/spacing down in two steps
  (`.compact`, `.tight`) at those same thresholds so a bigger checklist
  both warns the teacher and is measurably less likely to clip. This is
  still a heuristic (line-count based, not a true rendered-height
  measurement), not the fully "measured" two-per-page layout the Open
  Questions described as the more robust option — that remains open if a
  real-world checklist still clips at the `tight` tier.
- **Also — picked up a concurrent session's fix.** A parallel round on
  Art Critique Worksheet Generator (047) found and fixed the exact same
  `.half-sheet { height: 47vh; overflow: hidden }` print-clipping bug
  there, and flagged this file as having the identical pattern. Ported
  that fix here too (`height` → `min-height`, drop `overflow: hidden`) on
  top of the scaling above — the two are complementary: scaling reduces
  *how often* a checklist needs the overflow to spill, and dropping
  `overflow: hidden` means that when it still does, the content flows
  onto the next printed page instead of vanishing silently.

**Where the next round should pick up:** the per-item rating scale
(yes/no/somewhat) and "duplicate template as a starting point" are the two
Quick Wins still unbuilt — rating scale is probably the higher-value one
since it's a description-level change ("captures degree, not just
presence"), and duplicate-template only matters once multiple named
checklists exist (see Major Features), so consider building them together.

## What it does today

- 4 templates, each with 3 categories and pre-filled checklist items
- Fully editable: rename/add/remove/reorder categories, edit/add/remove/
  reorder items
- An on-screen size warning once a checklist is likely too long for a
  half-sheet, with print text that shrinks in two steps to help it fit
- Print N copies as half-sheets, each with blank author/reviewer name lines
  and a comments area

## Quick Wins

- **Done — Reorder categories and items** (up/down buttons).
- **A short rating option per item** (yes/no/somewhat, or a 1&ndash;3 scale)
  instead of a bare checkbox, so feedback captures degree, not just
  presence. *(Still open.)*
- **Done — Print layout QA** — on-screen size warning plus two-tier print
  font/spacing scaling. *(A true measured-height layout is still the more
  robust option if this heuristic proves insufficient in practice.)*
- **A "duplicate template as starting point" option** — right now loading
  a template always fully replaces the current checklist; cloning it into
  an editable copy under a new name would let a teacher build variations
  faster. *(Still open — most useful once multiple named checklists exist,
  see Major Features.)*

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
