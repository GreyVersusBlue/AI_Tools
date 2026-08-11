# Improvement Prompts — 050 — Government/Civics Simulation Role Card Generator

**Tool file:** `Tools/050-civics-role-card-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Three starter templates (Mock Trial, Debate, Legislative Simulation) or build from scratch, each role with an editable position and talking points list, printed as a card grid.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: three starter templates (Mock Trial: judge, prosecution,
defense, witness, juror; Debate: affirmative/negative teams, moderator,
judge; Legislative Simulation: bill sponsor, committee chair, opposing
and supporting legislators) plus a blank/custom option, each role fully
editable (name, position, add/remove talking points), printed as a
2-per-page card grid. Autosaves to `localStorage`
(`crcg_roles_v1`). Verified with a headless Chromium smoke test (default
Mock Trial roles render correctly including an em dash, template swap
with confirm-dialog accepted, print) — no console errors. One bug caught
and fixed before testing: several template `position` fields (and one
talking point) were originally written as JS string literals containing
the HTML entity text `&mdash;`/`&amp;` instead of literal characters —
the same class of entity-in-JS-string bug caught three times already in
this round (Verb Conjugation Reference Poster Generator, Sub Note /
Feedback Slip Generator, Science Fair Project Tracker) — fixed by using
literal em dash and ampersand characters in the source strings.

**2026-08-11 — Round 1 (session `8vo65u`).** Shipped two of the four Quick
Wins. Per-role "Copies" number field (1-40, default 1) next to the role
name — the print step now repeats a role's card that many times, so a
role several students share (jurors, witnesses) doesn't need to be typed
or duplicated N times just to get N cards. Duplicate-role button clones a
role (name, position, all talking points, fresh IDs) and inserts it
directly after the original, for building out similar roles — e.g. a
second witness with mostly-shared talking points — fast. Verified with a
headless Chromium smoke test: duplicated the first Mock Trial role (Judge)
and confirmed the role count went from 5 to 6, set that role's copies to
3, printed, and confirmed the printed card count matched exactly
(6 roles - 1 + 3 copies of the first = 8 total cards) — no console errors.

Assigning a student name per role and reordering roles/talking points
were not built this round — see "Where the next round should pick up"
below.

## What it does today

- 3 starter templates (Mock Trial, Debate, Legislative Simulation) + blank
- Fully editable: role name, position, talking points (add/remove)
- **Per-role copies count** — print N cards for a role N students share
- **Duplicate-role button** for cloning a role as a starting point
- Print: 2-per-page role card grid, respecting each role's copy count

## Quick Wins

- **Reorder roles and talking points** via up/down buttons, matching the
  pattern used elsewhere in this toolkit — order is currently fixed by
  insertion order.
- **Assign a student name to each role** (an optional field) so the
  printed card doubles as the physical hand-out with the assigned
  student's name already on it, instead of a teacher writing it in by
  hand.

## Major Features

- **Multiple named saved simulations**, matching the multi-save convention
  used by most builder tools in this round — one flat role set per
  browser right now, so a mock trial and a debate can't both stay ready at
  once.
- **A scoring/rubric companion** tied to each role type, reusing Rubric
  Builder's existing pattern — a judge/moderator role naturally pairs with
  a scoring rubric for the simulation.
- **Facts/case-file attachments per role** (e.g. a witness's specific
  testimony details, a legislator's district information) as a longer
  free-text field beyond just talking points — real mock trials and
  simulations usually give each role private background information the
  talking points alone don't capture.
- **JSON export/import**, for sharing a built simulation with another
  social studies teacher.

## Moonshot / North Star

**A full simulation kit generator — roles, private case-file details,
assigned student names, and a scoring rubric — built from one screen and
handed out ready to run.** Assigned names and per-role fact sheets turn a
generic role-card set into the actual materials a mock trial or
legislative simulation needs; a paired rubric closes the loop from
"here's your role" to "here's how you'll be assessed."

## Platform themes that matter here

- **P7 (cross-tool)** — the rubric pairing (Rubric Builder) and the
  assigned-student-name field (potentially loading from Name
  Picker/Class Roster Hub) are both direct opportunities.
- **P6 (print quality)** — **fixed in Round 1**: per-role copy count now
  drives the print step.
- **P15 (first run)** — the 3 starter templates already cover the most
  common classroom simulation types named in the backlog; more templates
  (e.g. a UN Security Council simulation, a constitutional convention) are
  natural low-effort additions.

## Open Questions

- Should assigned-student-name pull from a shared roster (Name Picker /
  Class Roster Hub) or stay a simple manual text field per role, given a
  simulation's role assignment (who plays what) is usually a deliberate
  teacher choice rather than a random draw?
- Is per-role case-file/fact-sheet content different enough from talking
  points to deserve its own distinct field (risking a busier card), or
  should a teacher just use longer talking points to cover both needs?

## Where the next round should pick up

Reorder roles/talking points is the smallest remaining Quick Win.
Assigned-student-name is the bigger open item — the first Open Question
above (manual field vs. roster pull) should get answered before building
it, since it changes the shape of the feature.
