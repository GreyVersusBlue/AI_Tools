# Improvement Prompts — 050 — Government/Civics Simulation Role Card Generator

**Tool file:** `Tools/050-civics-role-card-generator.html`
**Support folder:** `Tools/civics-role-card-generator/` — test suite only; the
tool itself is still one self-contained file.

**Current description (from README):** Three starter templates (Mock Trial, Debate, Legislative Simulation) or build from scratch, each role with an editable position, talking points, and an optional case-file that prints as a companion packet, as a card grid.

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

**2026-08-14 — SS demo round (session `tjkd6u`), headline: per-role case file
packets (backlog rank 17).** Each role now carries an optional long-form
**Case file** textarea, right below Position. Printing appends one companion
packet page per printed copy of any role with case-file text, after the full
card grid: headed with the role name and — when a student is assigned to
that copy — that student's name (reusing the same `r.students[c]` lookup the
cards use). Each packet is forced onto its own fresh page
(`page-break-inside: avoid` plus `page-break-before: always`, and a
`min-height` rather than a fixed height, per the assignment note about that
combination silently clipping print output). All three starter templates
ship sample case-file text so the feature demos from the defaults: the mock
trial gets a locker-search fact pattern (shared by the Judge and both
attorney roles; the Witness gets a separate personal statement; the
Juror gets none, since real jurors shouldn't see outside case facts before a
trial), the debate gets a cell-phones-at-lunch resolution with a briefing per
role, and the legislative sim gets a recess-extension bill with a briefing
per role. That answers this file's open question about case files vs. talking
points (see Open Questions below): case-file content is different enough
from talking points (private background vs. public speaking points) to earn
its own field.

Two supporting items also shipped. **Share link + QR** (P3, copied from
`028-primary-source-analysis-generator.html`'s pattern): a role set is pure
text, so it travels intact through `state-link.js` — role, position, copies,
talking points, and case-file text all round-trip. Since multi-save (the
next supporting item) didn't ship this round, an incoming link can't be
filed away under its own name — it asks with a confirm dialog before
replacing whatever's on screen, and declining leaves the existing roles
untouched. **The smoke suite gained a sibling file**,
`Tools/civics-role-card-generator/test/smoke-case-file-packets.mjs`
(`npm run test:civics-case-files`, 27 assertions): packet count matches
copies, packets carry the right names in the right order, whitespace-only
case-file text prints no packet, typed case-file text survives a reload, and
the share link round-trips a full role set through both the accept and
decline paths of the confirm dialog — no console errors.

**Cut per the assignment's own cut rule:** multiple named saved simulations
(item 2 of the supporting list) — the tool still holds one flat role set per
browser. No new `localStorage` key was introduced this round (case-file text
lives inside the existing `crcg_roles_v1` blob), so `009-backup-restore.html`
needed no changes. Multi-save is still the right next step — see "Where the
next round should pick up" below.

## What it does today

- 3 starter templates (Mock Trial, Debate, Legislative Simulation) + blank,
  each shipping realistic per-role copy counts and (except the blank) sample
  case-file text so the packet feature demos out of the box
- Fully editable: role name, position, talking points (add/remove), and an
  optional long-form case file
- **Per-role copies count** — print N cards for a role N students share
- **Duplicate-role button** for cloning a role as a starting point
- **Reorder roles and talking points** via up/down buttons
- Assign a saved class list (`np_rosters`) across the role slots, optionally
  shuffled, growing the biggest role so nobody is left without a card
- Print: 2-per-page role card grid, respecting each role's copy count, each
  card carrying its assigned student's name or a blank name line, followed by
  one **case-file companion packet per printed copy** of any role that has
  case-file text, each starting on its own page
- **Share link + QR code** — round-trips a full role set (state-link.js),
  asking with a confirm dialog before replacing roles already on screen

## Quick Wins

- ~~Reorder roles and talking points~~ — **shipped 2026-08-11 (Round 2).**
- ~~**Assign a student name to each role**~~ — **shipped 2026-08-12
  (Round 3)**, driven off a saved class list rather than a per-role text
  field; see the Round 3 note above.
- ~~**Facts/case-file attachments per role**~~ — **shipped 2026-08-14 (SS
  demo round)** as the round's headline; see above.

## Major Features

- **Multiple named saved simulations**, matching the multi-save convention
  used by most builder tools in this round — one flat role set per
  browser right now, so a mock trial and a debate can't both stay ready at
  once. This is the one supporting item the 2026-08-14 round explicitly cut
  (per its own cut rule) to ship the case-file packet headline and the share
  link cleanly; the assignment file's suggested shape is the
  `crcg:list` / `crcg:data:<name>` / `crcg:current` triple-key pattern the
  trading card maker uses, migrating the existing `crcg_roles_v1` blob in as
  the first named simulation, with the new keys registered in
  `009-backup-restore.html` `KNOWN_GROUPS`.
- **A scoring/rubric companion** tied to each role type, reusing Rubric
  Builder's existing pattern — a judge/moderator role naturally pairs with
  a scoring rubric for the simulation.
- **JSON export/import**, for sharing a built simulation with another
  social studies teacher as a file rather than a link — the share link
  shipped 2026-08-14 covers the common case, but a file still travels better
  by email attachment than a URL some mail clients truncate.

## Moonshot / North Star

**A full simulation kit generator — roles, private case-file details,
assigned student names, and a scoring rubric — built from one screen and
handed out ready to run.** Assigned names and per-role fact sheets turn a
generic role-card set into the actual materials a mock trial or
legislative simulation needs; a paired rubric closes the loop from
"here's your role" to "here's how you'll be assessed."

## Platform themes that matter here

- **P7 (cross-tool)** — the rubric pairing (Rubric Builder) is a direct
  opportunity; the assigned-student-name field already loads from Name
  Picker/Class Roster Hub (shipped Round 3), and the share link reuses
  028's state-link.js/QR pattern (shipped 2026-08-14).
- **P6 (print quality)** — **fixed in Round 1**: per-role copy count now
  drives the print step.
- **P15 (first run)** — the 3 starter templates already cover the most
  common classroom simulation types named in the backlog; more templates
  (e.g. a UN Security Council simulation, a constitutional convention) are
  natural low-effort additions.

## Open Questions

*(Both prior Open Questions are resolved: assigned-student-name pulls from a
saved roster — shipped 2026-08-12, Round 3 — and case-file content earned
its own distinct field rather than folding into talking points — shipped
2026-08-14.)*

- When multiple named saved simulations land, should switching simulations
  also swap the assigned-roster selection (so a debate and a mock trial can
  each remember their own class list), or should the roster assignment stay
  a one-at-a-time action independent of which simulation is loaded?

## Where the next round should pick up

Multiple named saved simulations is the one remaining Quick Win/Major
Feature and the clearest next step — the assignment file already names the
shape (the `crcg:` triple-key pattern, migrating `crcg_roles_v1` in as the
first named save, registering the new keys in `009-backup-restore.html`).
After that, the Open Question above should get answered before building the
roster-per-simulation behavior, since it changes the shape of the feature.
The file hasn't cleared its Major Features/Moonshot sections either, so it
stays out of `stable tools/` for now.
