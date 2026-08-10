# Improvement Prompts — 050 — Government/Civics Simulation Role Card Generator

**Tool file:** `Tools/civics-role-card-generator.html`
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

Nothing below has been started.

## What it does today

- 3 starter templates (Mock Trial, Debate, Legislative Simulation) + blank
- Fully editable: role name, position, talking points (add/remove)
- Print: 2-per-page role card grid

## Quick Wins

- **Reorder roles and talking points** via up/down buttons, matching the
  pattern used elsewhere in this toolkit — order is currently fixed by
  insertion order.
- **A "duplicate this role" button**, useful for a large mock trial with
  several witnesses who share most of the same talking-point structure but
  need different names/facts.
- **Assign a student name to each role** (an optional field) so the
  printed card doubles as the physical hand-out with the assigned
  student's name already on it, instead of a teacher writing it in by
  hand.
- **A "how many copies" field per role** for roles multiple students share
  (e.g. several jurors, several witnesses) — right now printing one role
  produces exactly one card regardless of how many students play that
  role.

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
- **P6 (print quality)** — a per-role copy count is the most immediately
  useful print-layout gap given how often simulations have multiple
  students sharing one role.
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
