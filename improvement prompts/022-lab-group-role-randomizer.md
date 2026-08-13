# Improvement Prompts — 022 — Lab Group & Role Randomizer

**Tool file:** `Tools/022-lab-group-role-randomizer.html`
**Support folder:** `Tools/lab-group-role-randomizer/` — test suite only; the
tool itself is still one self-contained file.

**Current description (from README):** Randomize lab groups and assign roles (recorder, materials, safety, etc.) — remembers who's had which role so nobody's stuck as Recorder every lab.

---

## Status

Reviewed — structural read of the source, before Round 4 (PR #55, see below)
shipped undo, printed role descriptions, station/equipment assignment, and
checkout tracking. Ideas below are deliberately ambitious and are **not**
scoped to a single session; items confirmed shipped are tagged **Done**
below.

**2026-08-12 — Round 5 (backlog rank 1: group size from equipment count).** A
third grouping mode, **Equipment on hand**, sits beside "Number of groups" and
"Students per group". The teacher lists what is actually in the room — item and
how many — and the **scarcest item sets the group count**.

That last part is the whole reason this is a new mode rather than a relabel.
"Seven microscopes" on its own is just "seven groups", which the count mode
already did. The thing neither existing mode can express is a constraint made
of *more than one number*: seven microscopes and five hot plates is a
five-group lab, not a seven-group one, and getting that wrong is discovered at
the bench. A live readout names the item that bound the count, shows the
resulting group sizes against the real roster, and counts the now-spare units
of everything else — so a teacher can see *why* they got five and go find two
more hot plates if they want seven.

Two smaller things fell out of it:

- **"Use this equipment as the stations"** builds one station row per group,
  each carrying the item list, so the checkout sheet and the table tents
  already know what each bench is holding without the gear being typed twice.
  It confirms before replacing stations that are already there.
- **A class smaller than the equipment** is called out rather than silently
  producing empty benches — three students against five hot plates says so and
  makes three groups.

Rosters saved before this mode have no `equipment` array; `normalizeRosterData`
gives them an empty one, and the other two modes are byte-for-byte unchanged.

Worth knowing for the next round: **the mode radios are `display: none`** — the
`.toggle-group` CSS styles their labels instead — so anything driving this UI
programmatically has to click `label[for="mode-…"]`, not the input. The suite
learned that the hard way.

Verified with a new 32-assertion headless Chromium suite,
`Tools/lab-group-role-randomizer/test/smoke-equipment-mode.mjs`
(`npm run test:lab-groups`): the scarcest item winning and being named, the
count reaching the real shuffle (not just the readout), spare-equipment and
too-few-students reporting, the confirm on station building, persistence
across a reload, both original modes still behaving, and an old roster
opening — no console errors.

**Next round should pick up** the deferred "lock a group and reshuffle the
rest", and the backlog's own row about gating groups on a returned lab safety
contract — which would compose neatly with this mode, since both are about
what the room can actually support today.

**2026-08-13 — Round 6 (gate groups on the safety contract).** Picked up the
"Integration with the safety contract" Major Feature named above. A new
"2 · Safety Contract Gate (optional)" card reads `lsct_sections_v1`
(read-only — 013's own storage is never written to) and checks the roster
against whichever class the teacher picks there, exactly matching 013's own
"fully signed" definition. Off by default; when on, **Flag** mode badges
unsigned students in place on-screen, on the printed group sheet, and on
table tents, while **Exclude** mode removes them from the roster before
`makeGroups` runs — composing with Round 5's equipment mode exactly as
predicted above, since an excluded student also shrinks the scarcest-item
group count. A missing/unreadable class degrades to a warning rather than a
crash or a silent no-op. Full detail, data-model notes, and the test suite
run are in the Round 6 update below.

## What it does today

- Split a roster into groups three ways — by group count, by group size, or
  by the equipment on hand, where the scarcest listed item sets the count;
  loads `np_rosters`
- Build the station list straight from the equipment list
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
- **Done — Round 6.** **Integration with the safety contract** (P7).
  `013-lab-safety-contract-tracker.html` knows who has signed; this tool should
  refuse to assign an unsigned student to a lab, or at least flag it.
  *(Read-only "Safety Contract Gate" card: Flag badges unsigned students in
  place, Exclude removes them from the roster before groups are formed and
  refuses the shuffle rather than producing an empty lab.)*
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

## Round 6 update — 2026-08-13 (safety-contract gate)

Shipped the last remaining Major Feature on this file: **gating groups on
the safety contract** (backlog rank — "Read `lsct_sections_v1` and flag or
exclude students who have not returned a signed lab safety contract").
Still a single file — the read side of `013-lab-safety-contract-tracker.html`'s
storage needed no support module, same as the Roster Hub (`np_rosters`)
reuse already in this tool.

**What shipped:**

- A new "2 · Safety Contract Gate (optional)" card, off by default so it
  changes nothing for a roster that never touches it. Turning it on reveals
  a class picker populated from `lsct_sections_v1`'s keys (read-only —
  nothing here ever writes to that key) and a **Flag / Exclude** toggle:
  - **Flag** (the default) leaves every student in their group and adds a
    small "No contract" badge next to an unsigned name — on the on-screen
    group cards, the printed group sheet (same markup, print stylesheet
    already covers it), and the printed table tents.
  - **Exclude** removes unsigned students from the roster *before* groups
    are formed, the same point in the pipeline where "equipment on hand"
    mode's scarcest-item count is applied — so an excluded student also
    correctly shrinks the group count under that mode, composing the two
    features the way the prior round's note predicted. A post-shuffle
    banner (reusing the existing keep-apart/station-shortage warning box)
    names who was left out and why; if excluding would leave nobody to
    group, the shuffle is refused with a message telling the teacher to
    either sign contracts or switch to Flag mode instead of silently
    producing an empty or partial lab.
  - A live readout under the picker previews who's missing a contract
    *before* the teacher shuffles, not just after.
- **A student counts as signed only if every required document for that
  class is signed** — the same "fully signed" definition
  `013-lab-safety-contract-tracker.html` itself uses (`isFullySigned`),
  reimplemented read-only here as `isSignedForSection`. A student with no
  contract record at all for the picked class (never entered there, or a
  name that doesn't match) defaults to **unsigned**, mirroring 013's own
  `getDoc()` helper — a missing entry is never assumed to mean signed. The
  pre-multi-document `{signed: bool}` shape 013 migrates old sections from
  on load is also read directly here (without needing 013's own migration
  to have run), so a class saved before that tool's multi-document support
  still gates correctly.
- **Flagging is live, not a shuffle-time snapshot.** `currentSafetyStatus()`
  re-reads `lsct_sections_v1` from `localStorage` on every render, so
  signing a student off in the tracker (in another tab, or after switching
  back from it) clears their badge here immediately — no reshuffle needed.
  Exclusion can't be live in the same way since it actually changes who's
  in a group; that decision is necessarily fixed at shuffle time, same as
  every other input to `makeGroups`.
- **Name matching is exact-string only**, same caveat already documented for
  the `np_rosters` Roster Hub reuse: `lsct_sections_v1` is a completely
  separate roster namespace from this tool's own roster, so "Aiden Smith"
  here and "Aiden  Smith" (double space) or "A. Smith" there won't match.
  No fuzzy matching was attempted.
- **Missing or corrupt tracker data degrades to a clear warning, not a
  crash or a silent no-op.** A class name picked here that doesn't exist in
  `lsct_sections_v1` (never created there, renamed, or the whole key is
  missing/unparseable) shows "No class named … was found" in the readout
  and, if a shuffle is run anyway, a warning banner saying the gate could
  not be applied that round — the full roster is grouped rather than
  guessing. The picked class name is preserved in the dropdown (as
  "<name> (not found)") rather than silently reverting to blank, so the
  teacher can see *what* went looking and didn't find anything.

**Data model / compatibility notes:**

- `state.safetyGate = { enabled: bool, section: string, mode: 'flag'|'exclude' }`,
  new this round. `normalizeRosterData` defaults it to
  `{ enabled: false, section: '', mode: 'flag' }` for any roster saved or
  imported before this round, so existing rosters open exactly as before —
  gate off, nothing flagged or excluded, until a teacher opts in.
- `state.lastExcludedForSafety`: array of names left out of the most recent
  shuffle by exclude mode, kept only so the post-shuffle warning can name
  them; restored by Undo alongside `lastGroups`/`history`/`checkoutLog`/
  `absent` for the same reason undo already bundles those — an undo that
  reverted the grouping but not who'd been excluded from it would be a
  half-revert.
- No changes to `lastGroups`, `history`, `checkoutLog`, `stations`, or
  `equipment` shapes. Equipment-on-hand mode's group-count math is
  unchanged — it only now sees a possibly-smaller roster when exclude mode
  has already filtered it, which is the intended composition, not a special
  case in that mode's own code.

**Testing performed:** `node --check` on the extracted inline script. A new
36-assertion headless Chromium suite,
`Tools/lab-group-role-randomizer/test/smoke-safety-gate.mjs`
(not yet wired into `package.json` — see "Known limitations" below):
the gate defaulting off and its options staying collapsed; the class picker
listing every `lsct_sections_v1` key; the live readout correctly identifying
exactly which of six seeded students are missing a signed contract,
including two with **no contract record at all** (proving the
default-unsigned path, not just the explicit-`false` path); flag mode
badging precisely the unsigned students on-screen and leaving the signed
ones alone; a contract signed in the tracker after a shuffle clearing that
student's badge on the very next render with no reshuffle; exclude mode
correctly shrinking the actual grouped roster and naming who was left out
in the warning banner; the legacy pre-multi-document `{signed: bool}` shape
read correctly via a second seeded class; excluding an entire tiny roster
being refused with a clear message rather than producing an empty result;
a class removed from (or never in) `lsct_sections_v1`, and separately
corrupt JSON under that key, both degrading to the same "No class named…"
message rather than a crash; gate settings (`enabled`, `section`, `mode`)
surviving a reload; and turning the gate off clearing all badges
immediately. Zero console/page errors across the run. Also re-ran the
pre-existing `smoke-equipment-mode.mjs` (32 assertions, still green — the
new card was inserted without touching that mode's markup or logic beyond
renumbering the surrounding card titles) and `Tools/board-check/check-dedupe.mjs`
(clean).

**Known limitations / left out of scope:**

- The new test file is **not yet wired into `package.json`'s
  `test:lab-groups` script** — per this round's file-boundary rules,
  `package.json` wiring is left to the orchestrating session's integration
  pass. Run it directly in the meantime:
  `node Tools/lab-group-role-randomizer/test/smoke-safety-gate.mjs`.
- When a class has more than one required document, "signed" here means
  *every* document is signed (matching 013's own `isFullySigned`) — there's
  no per-document gating (e.g., "flag only if the chemical-handling form
  specifically is missing"). Most classes in 013 only define one document,
  so this is expected to be the common case in practice, but a class with
  several distinct documents can't gate on a subset of them from here.
  013's own `getDoc(name, docId)` would need to be exposed per-document if
  a future round wants that.
- Exact-name matching only, as noted above and already true of the
  `np_rosters` reuse — no Levenshtein/fuzzy matching, no case-insensitive
  fallback. A roster typed slightly differently between the two tools will
  under- or over-flag.
- The equipment checkout sheet and role-history/fairness-grid reports were
  deliberately left unbadged — they're about equipment and role fairness,
  not attendance eligibility, and adding a contract column there felt like
  scope creep on reports that already have a settled, printed format.
- Still open, unchanged from prior rounds: lock-a-group-or-role-and-reshuffle,
  multi-day lab persistence, and the cross-tool shared grouping engine (P7).
