# Improvement Prompts — 050 — Government/Civics Simulation Role Card Generator

**Tool file:** `Tools/050-civics-role-card-generator.html`
**Support folder:** `Tools/civics-role-card-generator/` — test suite only; the
tool itself is still one self-contained file.

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

**2026-08-11 — Round 2 (session `szyio3`), layered on Round 1 above.**
Shipped the reorder Quick Win this note flagged as the smallest remaining
item: up/down buttons on both roles (in the role-block header, alongside
the existing Copies field and Duplicate button) and talking points
(independently, within each role) — matching the pattern used elsewhere
in the toolkit. Built directly on top of Round 1's copies field and
duplicate-role button (both preserved and re-verified working together)
rather than independently — an earlier attempt to merge this session's
and `8vo65u`'s branches via git's automatic 3-way merge left literal
conflict markers in the middle of `renderRoles()`, so the file was
rebuilt from `8vo65u`'s merged main state with this session's reorder
layer re-applied by hand instead of trusting the auto-merge. Verified
with a headless Chromium pass: moved a role down and confirmed the order
changed, set a role's copy count and moved a talking point, duplicated a
role (confirming Round 1's button still works), printed and confirmed
the card count matched (6 roles, one with 3 copies = 8 cards) — no
console errors.

**2026-08-12 — Round 3 (backlog rank 9: assign students to roles).** The tool
now reads `np_rosters` — the class list Name Picker and Class Roster Hub
already save — and prints each card with its student's name on it. Pick a
class list, optionally shuffle it, and press Assign; a card nobody is assigned
to still prints the blank name line it always did.

Three decisions worth recording:

- **Copies stopped being interchangeable.** The print path used to build one
  card string and repeat it `copies` times. Each copy can now carry a
  different name, so they are built individually. Had that been missed, a
  role's whole stack would have printed one student's name — which is exactly
  what the suite checks.
- **The class is bigger than the simulation, so the simulation grows.** A
  28-student class against a 21-card mock trial leaves seven students out. The
  default is to grow the role that *already has the most copies* — the jury,
  the audience, whichever role was built to scale — rather than adding a copy
  round-robin and ending up with eight judges. The summary line names the role
  it grew and by how much, so nothing happens silently. Untick the box and the
  leftover students are counted out loud instead.
- **That growth rule only works if the templates mean it,** and they didn't:
  every role in every template shipped at `copies: 1`, so "the biggest role"
  was a five-way tie that resolved to whoever was listed first — the judge.
  The templates now carry realistic counts (mock trial: 1 judge, 2+2
  attorneys, 4 witnesses, 12 jurors; debate 3/3/1/3; legislative 1/1/6/6),
  which is a better starting point on its own and is what makes the growth
  rule land where it should.

Roles saved before this round have no `students` array; `load()` gives them an
empty one, which means "nobody assigned" and prints exactly what it used to.

Verified with a new 28-assertion headless Chromium suite,
`Tools/civics-role-card-generator/test/smoke-assign-roster.mjs`
(`npm run test:civics-roles`): 28 students landing on 28 distinct cards, the
growth going to the jury and not the bench, distinct names across one role's
copies, the leftover count with growth off, blank name lines when there are
more cards than students, Clear names, a shuffle preserving the set, and an
old role set printing unchanged — no console errors.

**Next round should pick up** multiple named saved simulations, and per-role
case-file packets (already on the backlog).

## What it does today

- 3 starter templates (Mock Trial, Debate, Legislative Simulation) + blank,
  each shipping realistic per-role copy counts
- Fully editable: role name, position, talking points (add/remove)
- **Per-role copies count** — print N cards for a role N students share
- **Duplicate-role button** for cloning a role as a starting point
- **Reorder roles and talking points** via up/down buttons
- Assign a saved class list (`np_rosters`) across the role slots, optionally
  shuffled, growing the biggest role so nobody is left without a card
- Print: 2-per-page role card grid, respecting each role's copy count, each
  card carrying its assigned student's name or a blank name line

## Quick Wins

- ~~Reorder roles and talking points~~ — **shipped 2026-08-11 (Round 2).**
- ~~**Assign a student name to each role**~~ — **shipped 2026-08-12
  (Round 3)**, driven off a saved class list rather than a per-role text
  field; see the Round 3 note above.

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

Assigned-student-name is the one remaining Quick Win and the bigger open
item — the first Open Question above (manual field vs. roster pull) should
get answered before building it, since it changes the shape of the
feature. The file hasn't cleared its Major Features/Moonshot sections
either, so it stays out of `stable tools/` for now.
