# Improvement Prompts — 022 — Lab Group & Role Randomizer

**Tool file:** `Tools/022-lab-group-role-randomizer.html`
**Support folder:** none — single file

**Current description (from README):** Randomize lab groups and assign roles (recorder, materials, safety, etc.) — remembers who's had which role so nobody's stuck as Recorder every lab.

---

## Status

Reviewed — structural read of the source, before Round 4 (PR #55, see below)
shipped undo, printed role descriptions, station/equipment assignment, and
checkout tracking. Ideas below are deliberately ambitious and are **not**
scoped to a single session; items confirmed shipped are tagged **Done**
below.

## What it does today

- Split a roster into groups (by count or size); loads `np_rosters`
- **Editable role list**; roles assigned per group with a **recency memory**
  (`roleRecencyScore`, `recordHistory`) so roles rotate fairly — the tool's
  best idea
- **Keep Apart** constraints (`resolveKeepApart`, `findApartViolations`)
- **Print table tents** (`tentsHtml`, `tentPanelHtml`) — the best physical
  output of any grouping tool on the site
- Print the group sheet and the **role history**; reset role history
- Multiple saved rosters (`lgrr_rosters` / `lgrr_current`), JSON import/export

## Quick Wins

- **Done — Round 4.** **Role cards with the job description on them.** A tent that says "Recorder"
  is a label; a tent that says "Recorder — write down every measurement, read
  it back to the group before moving on" is instruction. Let each role carry
  a short description that prints. *(Roles grew an optional description
  field, printed under the role name on table tents only.)*
- **Skipped — deferred, Round 4.** **Lock a group or a role and reshuffle the rest.**
- **Done — Pass 2, Round 2.** **Absent handling** — reassign a missing student's role in one tap rather
  than regenerating the lab. *(Checkbox next to each student's name in the
  group view; checking it removes them from tents/print and hands their
  vacated role to a present groupmate, round-robin, without a reshuffle.)*
- **Done — Pass 2, Round 2.** **Show the fairness data.** The recency memory is the selling point and is
  currently invisible; a small "roles you've had" grid per student, printable,
  makes it credible to students who claim unfairness. *(New "Print fairness
  grid" button — comprehensive per-student x per-role count table, distinct
  from the pre-existing "Print role history" report; see update below for why
  a separate output was worth adding.)*
- **Group size that matches the equipment.** "I have 7 microscopes" is the
  real constraint, not "make groups of 4".
- **Done — Round 4.** **Undo the last shuffle** (P11). *(Single-level undo restores groups,
  role history, and the checkout log together.)*
- **Names on the tent in a size readable from the front of the room.**

## Major Features

- **Done — partial, Round 4.** **Lab-specific structure.** A lab has stations, equipment, and safety
  requirements — not just groups. Assigning groups *to stations*, tracking
  which group has used which station, and printing a rotation schedule is the
  natural next layer, and `021-pe-tournament-stations.html` already has a rotation
  engine (P7). *(Shipped station + equipment assignment, round-robin cycled
  onto groups on shuffle; a multi-day rotation schedule across sessions is
  still unbuilt — the model resets stations on every reshuffle.)*
- **Done — Round 4.** **Equipment and materials checkout.** Which group has which microscope,
  which balance, which probe — and a printable check-in sheet at the end of
  the period. This is a genuine, unserved need in a science classroom. *(Per-group
  checked-out/returned toggle with timestamps, plus a "Print equipment
  checkout sheet" button.)*
- **Integration with the safety contract** (P7).
  `013-lab-safety-contract-tracker.html` knows who has signed; this tool should
  refuse to assign an unsigned student to a lab, or at least flag it.
- **Skipped — deferred, Round 4.** **One grouping engine** (P7). This tool, `002-group-team-generator.html`,
  `027-novel-study-circles-manager.html`, and Name Picker all implement group
  formation, and two of them implement role rotation with recency memory. The
  logic should be shared. *(Necessarily touches other tools; left for a
  dedicated cross-tool round.)*
- **Multi-day lab projects.** A lab that runs three days needs the same groups
  with rotating roles across sessions — which is exactly what
  `027-novel-study-circles-manager.html` does for reading circles, in a different
  tool.
- **Lab report handoff** (P7). The groups and roles should flow into a lab
  report template (already on `IDEAS_BACKLOG.md`) with the group's names
  pre-filled.

## Moonshot / North Star

**The whole lab period, organized on one sheet.** Groups formed fairly with
memory of who has worked with whom and who has done which job, assigned to
stations with the right equipment, checked against the safety contract,
printed as table tents with the role's actual instructions on them plus a
materials checkout sheet and a rotation schedule — in the two minutes before
the bell.

## Platform themes that matter here

- **P7 (cross-tool)** — the strongest case on the site for a shared grouping
  and role-rotation engine, plus real links to the safety tracker and the
  rotation timer.
- **P2 (shared roster)** — reads `np_rosters`; role history needs stable IDs
  to survive roster edits.
- **P6 (print quality)** — table tents are a specific and well-solved print
  format here worth generalizing.
- **P11 (undo)** — reshuffles are destructive.

## Open Questions

- Should this remain a separate tool from Group/Team Generator, or become a
  "lab mode" of one grouping tool? The distinctive parts (roles, stations,
  equipment, safety) are real, but the group formation is duplicated.
- **Resolved 2026-08-10 (Round 4, PR #55).** Is station/equipment tracking
  within scope, or does it want its own tool? — Built directly into this
  tool: station/equipment assignment per group plus checkout/return tracking,
  both described below.

## Round 4 update — 2026-08-10 (PR #55)

Implemented four of the highest-value ideas from Quick Wins and Major
Features in one pass, still as a single file (no support folder needed —
the additions were data-model and rendering changes, not new subsystems).

**What shipped:**

- **Undo the last shuffle** (P11, Quick Win). A one-level undo: before each
  shuffle the previous `lastGroups`, `history`, and `checkoutLog` are
  snapshotted into a module-level `undoSnapshot` variable (deliberately kept
  out of `state`/localStorage — undo is a same-session convenience, not
  saved data). Clicking Undo restores all three together, which matters
  because a shuffle also mutates the role-recency history — an undo that
  only restored the visible groups but left the fairness memory pointing at
  the discarded shuffle would quietly corrupt the tool's best feature.
  Verified via Playwright that history and group assignment both roll back
  bit-for-bit. The undo button disables itself after use and on any roster
  switch/new/import (a snapshot from a different roster's shuffle would be
  meaningless).
- **Role descriptions that print on tents** (Quick Win). Roles changed shape
  from `string[]` to `{name, description}[]`. The role editor now has a
  second, optional input per role for a short description ("what this role
  does"); it prints under the role name on table tents only (kept off the
  on-screen group cards and the role-history report to avoid clutter there).
  Old saved/exported rosters with plain-string roles are migrated
  transparently on load (`normalizeRoles`).
- **Station/equipment assignment per group** (Major Feature). A new
  "Stations & Equipment" card (optional, empty by default) lets a teacher
  list stations with an equipment note (e.g. "Station 1 / Microscope A,
  slides"). On shuffle, if any stations are defined, they're shuffled and
  cycled onto the groups round-robin — every station gets used as evenly as
  possible, and if there are fewer stations than groups a warning banner
  says so (mirrors the existing keep-apart violation banner). Station +
  equipment show on the group cards, the printed group sheet, and the table
  tents.
- **Equipment checkout/return tracking** (Major Feature). Each group with a
  station gets an inline "Mark checked out" / "Mark returned" control with a
  timestamp, tracked in `state.checkoutLog` (parallel array to
  `lastGroups`, reset on every reshuffle since a new shuffle means new
  group/station pairings). A new "Print equipment checkout sheet" button
  produces a table (Group / Station / Equipment / Checked out / Returned)
  using recorded times where available and blank lines for manual sign-off
  otherwise — usable either as a live digital log or a paper backup.

**Data model / compatibility notes:**

- `lastGroups` changed from `array of arrays of {name, role}` to
  `array of {station, members}`. `normalizeLastGroups` migrates the old
  shape (a bare array is wrapped as `{station: null, members: array}`) so
  rosters saved before this round, or JSON files exported before this
  round, still load and shuffle correctly. Verified by hand-seeding
  `localStorage` with an old-shape roster and confirming it renders and
  reshuffles without errors.
- Exported/imported JSON now includes `stations` and `checkoutLog`; import
  of a pre-this-round file works via the same normalization path used for
  localStorage.

**Deliberately skipped this round** (left for next time, per the file's own
scoping): lock-a-group-or-role-and-reshuffle-the-rest, absent-student
one-tap reassignment, the printable "roles you've had" fairness grid per
student (the role-history report already exists and is close, but a
per-student printable grid is a distinct, smaller quick win worth its own
pass), safety-contract integration, and the cross-tool shared
grouping/role-rotation engine (P7) — all real, all bigger cross-cutting
changes than one round should absorb, especially the shared-engine idea
which necessarily touches other tools this round's constraints forbade
touching.

**Where to pick up next:** the station/equipment and checkout-log data
model is intentionally simple (one station per group, one checkout cycle
per shuffle) — a multi-day lab that keeps the same station across sessions,
or a checkout log that persists across reshuffles within a period, would
need a different persistence key than "reset on every shuffle." The role
recency memory itself was not touched beyond swapping its role-identifier
source from `string[]` to `{name}[]`.map(name) — the underlying algorithm,
scoring, and history array are unchanged and still the tool's strongest
idea.

**Testing performed:** `node --check` on the extracted inline script (no
support-folder `.js` files were added). Playwright + headless Chromium
(`/opt/pw-browsers/chromium-1194`) driving the page via `file://`, with no
console/page errors across all scenarios: fresh roster shuffle with
stations, role descriptions, and keep-apart pairs; checkout/return button
toggling; two consecutive shuffles followed by undo verified byte-for-byte
equal to the pre-second-shuffle group assignment and role history; table
tent print output containing the station/equipment and role description;
checkout sheet print output containing the equipment text; and a
hand-seeded legacy-shape roster (string roles, array-of-arrays
`lastGroups`) loading, rendering, and reshuffling without errors.

## Pass 2 — Round 2 update — 2026-08-11 (session `mxpfjs`)

Implemented both remaining Quick Wins flagged as still-open in this file:
absent handling and the printable per-student fairness grid. No other tool
files were touched.

**What shipped:**

- **Absent handling.** Every student row in the group view now has a
  checkbox next to their name (`data-absent-name`). Checking it marks that
  student absent for the *current* shuffle only — it does not remove them
  from the roster or rewrite anything already recorded in role history.
  The redistribution itself is a pure, render-time computation
  (`computeEffectiveMembers`), not a data mutation: it reads
  `group.members` and `state.absent` fresh every render and derives each
  present member's *effective* role, so checking the box back off instantly
  and exactly restores the original assignment with no extra bookkeeping or
  stored "who covered for whom" history. Vacated roles are handed out
  round-robin across the group's present members (a cursor keeps advancing
  even when a slot is reused, so multiple absences in one group spread
  across present members rather than stacking on whoever happens to be
  first); a member who picks up a second role shows both, joined as
  "Role A + Role B". Absent students are excluded entirely from the printed
  group sheet (a `.absent-row { display:none }` print rule) and from table
  tents (filtered out in `tentPanelHtml` before building the tent list) —
  the checkbox and the live on-screen row stay visible so the mark can be
  toggled back. A combined "A + B" role prints without a role description
  on tents (only a member's own single, uncombined role looks up a
  description) to avoid printing a description that only covers half of
  what they're now doing.
- **Printable fairness grid.** A new "Print fairness grid" button, separate
  from the pre-existing "Print role history" button. The existing report
  (`historyTableHtml`) only lists students and roles that already have at
  least one history entry — a student just added to the roster, or a role
  nobody's been assigned yet, silently disappears instead of showing as a
  real, checkable zero, which undercuts exactly the use case ("show a
  student who claims unfairness the data") this quick win is for. The new
  `fairnessGridHtml` is deliberately comprehensive: every current roster
  name (from the names textarea, even with zero history) x every
  currently-defined role (from the role editor, even with a zero count) —
  plus any legacy role names still present in old history entries so
  renamed/removed roles don't silently drop data. It's a read-only view
  over the same `state.history` that `roleRecencyScore` and
  `recordHistory` already maintain; no new data is tracked, and marking a
  student absent has no effect on this report (history is written at
  shuffle time, before any absence is marked, which is correct — the
  assignment happened, the fairness ledger should reflect that regardless
  of a same-day absence). The pre-existing "Print role history" report was
  left untouched for anyone already relying on its exact format.

**Data model / compatibility notes:**

- `state.absent`: a new array of student names, absent on the *current*
  shuffle. Reset to `[]` inside `shuffleAll()` on every reshuffle (a new
  shuffle is a new day's attendance) and included in the undo
  snapshot/restore alongside `lastGroups`/`history`/`checkoutLog` so Undo
  reverts absence marks together with the grouping they belonged to.
  `normalizeRosterData` defaults missing/non-array `absent` to `[]`, so
  rosters saved or exported before this round — which have no `absent`
  key at all — load exactly as before. Exported JSON now includes
  `absent`; import of a pre-this-round file works via the same
  normalization path.
- No schema change was needed for the fairness grid — it's computed from
  `state.history` and `state.roles`, both already present.

**Testing performed:** `node --check` on the extracted inline script.
Playwright + headless Chromium (`/opt/pw-browsers/chromium`, launched with
an explicit `executablePath`, no `playwright install`) driving the page via
`file://`: shuffled an 8-name roster into 2 groups; marked a
role-holding student absent and confirmed on-screen that (a) their row is
struck through and shows "Absent", (b) another present groupmate's role
text updated to include the vacated role, both derived live from the DOM,
not hard-coded; unmarked them and confirmed the original single-role
assignment came back exactly; re-marked them absent and confirmed the
generated table-tent HTML (captured via a `window.print` stub, since
headless Chromium's `print()` returns immediately rather than blocking
like a real browser) no longer contains their name; clicked "Print
fairness grid" after several shuffles and cross-checked a printed student's
row total against the same student's role counts computed independently
from `localStorage`'s `lgrr_rosters` — the printed number matched the real
history data exactly, not a placeholder. Zero console/page errors across
the whole run. No test scripts were left in the repository.

**Where to pick up next:** the still-open items are unchanged from Round 4's
list — lock-a-group-or-role-and-reshuffle-the-rest, safety-contract
integration, group-size-matches-equipment-count, and the cross-tool shared
grouping/role-rotation engine (P7). One new, smaller idea surfaced by this
round: the "A + B" combined-role text for a student covering an absent
groupmate's job is plain string concatenation with no printed description
and no distinct visual treatment beyond the text itself — if a future round
wants covering roles to be more visually distinct (e.g., a small "(covering
for Name)" note) that's a display-only follow-up, not a data model change,
since `computeEffectiveMembers` already has everything needed to know who
originally held the role.
