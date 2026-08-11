# Improvement Prompts — 002 — Group / Team Generator

**Tool file:** `Tools/002-group-team-generator.html`
**Support folder:** `Tools/group-team-generator/test/smoke-share.mjs`
(`npm run test:groups`). The page itself is a single file.

**Current description (from README):** Split a pasted or Name-Picker roster into random groups by count or size, with optional skill-balancing and "keep these two apart" constraints. Prints a clean group sheet.

---

## Status

### 2026-08-11 — session `m3r8ro`

**Shipped share-a-grouping by link or QR** (backlog rank 15, platform theme P3).
The tool could print a grouping or copy it as text; what it could not do was
hand somebody the arrangement itself. A co-teacher reading a copied-text
version retypes it, and re-running the shuffle on their machine gives a
different answer — which defeats the point of sharing it at all.

- **"🔗 Copy Link" and "▦ QR Code"** join the export row, appearing only once
  there is a grouping to share.
- **What travels is the result, not the recipe** — and that was the design
  decision. The payload carries the group labels and who is in each group.
  It does *not* carry the roster, the keep-apart list, the put-together list,
  the skill numbers, the pairing memory, or the generator settings. A shared
  grouping is a read-only artifact, and nobody wants their keep-apart pairs
  leaving the building with it. Five assertions in the suite exist purely to
  hold that line, driven from a keep-apart pair added through the real control.
- **The receiving page renders it read-only**, over whatever config happened to
  load, and writes nothing: the banner says it is somebody else's arrangement,
  and that reshuffling would use *your* roster rather than theirs. The suite
  checks no shared student name reaches `localStorage`.
- **Labels are reproduced verbatim** by switching the receiving page to the
  `custom` naming mode and feeding it the sender's labels. Without that, a
  browser set to "Table 1, Table 2" would silently relabel somebody else's
  colour-team groups.
- The parameter is consumed on read, so a refresh cannot re-import; a mangled
  link says so rather than opening blank; and an over-large grouping is refused
  by name with a pointer to the link, rather than drawing an unscannable QR.
- **Verified** by `Tools/group-team-generator/test/smoke-share.mjs` (33 checks),
  which opens the link in a second browser context and compares the arrangement
  group by group.

### Pass 2 — Round 1 — 2026-08-10 — session `yjj7k6`

Small, targeted follow-up on the one loose end this tool's own Round-1 notes
called out: *"changing the split-count field while a lock is active has no
effect until the teacher does a fresh 'Make Groups' — this isn't stated
explicitly in the UI; a future round could disable/gray the split fields
while any group is locked, or add a hint."*

Shipped exactly that — `syncSplitLockUI()` disables the "Number of
groups"/"Students per group" radios and the split-value number input
whenever any group is locked, and shows a hint below the input explaining
why: *"Split settings are locked while a group is locked — unlock every
group, or generate fresh groups, to change how many groups or
students-per-group."* Wired into `renderResults` (so it re-evaluates after
every lock toggle, reshuffle, and undo) and into `clearTransientGroupState`
(so a fresh "Make Groups" or switching classes clears it immediately). No
storage shape changed; verified the file's inline scripts still parse and
smoke-tested the page in a headless browser with no console errors.

Nothing else from this tool's open backlog was attempted this round — the
P7 group-engine consolidation, seating-aware grouping, project-team mode,
and group-history visualization are all still open, per the Round-1 notes
below.

### Round 1 (Pass 1) — 2026-08-10 — Quick Wins and the two scoped Major Features implemented.
All seven Quick Wins and the two Major Features called out for this round
(grouping strategies as first-class modes; a printable group sheet) are done.
Roles-in-tool, group history visualization, seating-aware grouping,
project-team mode, and the Moonshot were explicitly skipped per this round's
scope — see the "Skip" note at the end of each of those items below.

What changed, concretely:
- The old single `balance-skill` checkbox became a **Grouping strategy**
  select with four explicit modes (random / balanced / heterogeneous /
  homogeneous), each a distinct algorithm (see `assignRandom`,
  `assignBalanced`, `assignHeterogeneous`, `assignHomogeneous`) rather than
  one boolean. Old saved configs migrate `balance: true` → `strategy:
  'balanced'` automatically.
- Odd-number handling is now an explicit "If the class doesn't divide
  evenly" select (`oddMode`: extra / floater / pair), implemented as a
  post-processing pass (`applyOddHandling`) that pops the overflow beyond
  the smallest unlocked group into a floater list or a standalone bonus
  group — it runs after assignment and before constraint resolution, so
  every strategy gets it for free.
- A **"Why this grouping"** panel (`buildExplanation`/`renderExplanation`)
  surfaces the strategy used, which constraints were honored or broken,
  whether any recent pairing repeated, and how the remainder was handled —
  built directly from the existing `totalScore`/violation-finder machinery,
  not a separate re-implementation.
- **Locking**: each rendered group gets a Lock toggle; Reshuffle (not "Make
  Groups", which is always a clean slate) respects locked groups exactly —
  `resolveConstraints` now takes a `lockedIdx` set and refuses to touch a
  locked group as either the swap source or destination, so a lock is a real
  guarantee, not just a suggestion the local search might override to fix a
  constraint elsewhere. A lock referencing a student who went absent or was
  removed from the roster is detected (`locksAreValid`) and the tool falls
  back to a full reshuffle rather than crashing or silently corrupting state.
- **Absent-today** checkboxes appear once names are parsed; they exclude a
  student from grouping only (roster text and keep-apart/together
  definitions are untouched), persisted as `state.absentNames` and pruned
  automatically when a name is edited out of the roster.
- **Undo** is single-level (`snapshotForUndo`/undo button): it restores not
  just the previous group arrangement but also `pairHistory`/`pairGen`,
  since the pairing-memory mutation is otherwise irreversible and would
  otherwise silently contaminate future shuffles with a shuffle the teacher
  chose to discard.
- **Group naming**: numbered / Table N / color-team / custom-list presets
  (`groupLabel`), used consistently in on-screen rendering, copy-as-text,
  table tents, and group sheets.
- **Table tents**: mirrors `022-lab-group-role-randomizer.html`'s
  `tentPanelHtml`/`tentsHtml` fold-card approach exactly (same print CSS
  structure), adapted to show group names + skill instead of roles.
- **Group sheets**: one page per group (`groupSheetHtml`) with the group
  name, a blank table/station line, the member list, and a lined task/notes
  box — plus a trailing page for floaters if any exist.

Real tradeoffs and things a future round should know about:
- **Heterogeneous vs. balanced are deliberately different algorithms**, not
  just two names for the same snake draft: balanced equalizes group
  *averages* (snake draft over the full sorted list); heterogeneous splits
  the roster into thirds by skill and round-robins each third separately,
  guaranteeing every group draws from the top/middle/bottom rather than just
  landing on similar averages. Worth double-checking with a real teacher
  whether this distinction reads as intended in the UI copy — it's subtle.
- **Locked reshuffle re-derives group count from the previous result**, not
  from the count/size fields, by design (that's what "reshuffle the rest"
  means) — but this means changing the split-count field while a lock is
  active has no effect until the teacher does a fresh "Make Groups". **Fixed
  Pass 2 Round 1** — the split fields now disable and show a hint while any
  group is locked; see the Pass 2 note at the top of Status.
- The **pair-mode bonus group** and **floater list** are recomputed fresh on
  every generation (they are never "locked" as a concept, only regular
  groups can be locked) — this is intentional and matches how a teacher
  would use it, but wasn't stress-tested against many repeated
  lock+reshuffle cycles combined with odd-number remainders; the logic is
  self-correcting by construction (see code comments in `applyOddHandling`)
  but a future round doing heavy interactive QA should specifically hammer
  on lock → reshuffle → lock differently → reshuffle again with an uneven
  roster.
- **Skip — roles in this tool**: per this round's explicit scope, not
  attempted; still belongs as shared-engine cross-tool work (see P7 below).
- **Skip — group history visualization across the year**: not attempted;
  the pairing-memory data (`pairHistory`) still only looks back
  `PAIR_MEMORY_WINDOW` (2) generations by design, it does not accumulate a
  full-year history, so this would need a real design decision about
  whether/how to retain older data before a visualization is meaningful.
- **Skip — seating-aware grouping**: not attempted; depends on Seating Chart
  Generator's data per P7, out of scope here.
- **Skip — project-team mode**: not attempted; a persistent multi-day team
  concept is a different data model than this tool's current
  generate-and-print-per-period design.
- **Skip — Moonshot**: not attempted, as instructed.

## What it does today

- Split by **group count** or **group size**; load a saved `np_rosters` roster
- Exclude **absent students** for today's grouping only, without editing the
  roster text
- **Four explicit grouping strategies** — random, balanced by skill, deliberately
  heterogeneous, and homogeneous by readiness (`assignRandom`, `assignBalanced`,
  `assignHeterogeneous`, `assignHomogeneous`) — plus an explicit choice for how
  an uneven remainder is handled (extra student per group, floaters, or a
  standalone small group)
- **Keep Apart** and **Put Together** constraints with violation reporting
  (`findApartViolations`, `findTogetherViolations`)
- **Share a generated grouping by link or QR** (`_shared/state-link.js`) — the
  arrangement only, never the roster, constraints, skills or pairing memory;
  opens read-only on the other machine and is never saved there
- **Pairing memory** — penalizes recently-paired students
  (`pairRecencyPenalty`, `recordPairHistory`, `findRecentPairViolations`),
  with a reset. This is the tool's best idea.
- A **"Why this grouping" explanation** built from the same scoring
  machinery, plus **locking** a group so Reshuffle only touches the rest,
  and a single-level **Undo** that also rolls back the pairing-memory
  mutation
- **Group naming** (numbered, Table N, color teams, or a custom list),
  carried through to on-screen display, copy-as-text, **printable table
  tents**, and a **printable group sheet** (one page per group with a
  table/station line and a task/notes box)
- Multiple saved class configs (`gtg:list` / `gtg:current`), reshuffle, copy
  as text, print

## Quick Wins

- **Done (2026-08-10) — Show why a grouping was chosen.** The scoring machinery
  (`totalScore`, `totalPairPenalty`) already exists; surfacing "this grouping
  breaks one keep-apart constraint and repeats two pairs" makes the teacher
  trust it or reshuffle deliberately. Implemented as `buildExplanation` /
  `renderExplanation`, shown above the group list on every generate/reshuffle.
- **Done (2026-08-10) — Lock a group and reshuffle the rest** — the most common
  real interaction and currently impossible. Each group card has a Lock
  toggle; `resolveConstraints` now refuses to touch a locked group as either
  swap source or destination.
- **Done (2026-08-10) — Absent students excluded in one tap**, rather than
  edited out of the list. A checklist appears under the roster once names are
  parsed; `state.absentNames` excludes them from grouping only.
- **Done (2026-08-10) — Name the groups** (Table 1, Red Team, or by topic) and
  print them that way. A naming-style select (numbered / Table N / color
  teams / custom list) drives `groupLabel`, used everywhere a group name
  appears.
- **Done (2026-08-10) — Print table tents** — `022-lab-group-role-randomizer.html`
  already generates them (`tentsHtml`, `tentPanelHtml`) and this tool didn't
  (P7). Mirrored the same fold-card structure and print CSS here.
- **Done (2026-08-10) — Odd-number handling as a stated choice**: one group of
  5, or a floater, or a pair — was implicit, now an explicit "If the class
  doesn't divide evenly" select (`applyOddHandling`).
- **Done (2026-08-10) — Undo the last shuffle** (P11). Single-level undo that
  also rolls back the `pairHistory`/`pairGen` mutation from the shuffle being
  undone, not just the group arrangement.

## Major Features

- **Done (2026-08-10) — Grouping strategies as first-class modes.** Random,
  balanced by skill, heterogeneous (deliberately mixed), and homogeneous (by
  readiness, for differentiation) are now explicit, switchable modes
  (`assignRandom`/`assignBalanced`/`assignHeterogeneous`/`assignHomogeneous`).
  By-interest and by-student-choice-with-constraints were **not** attempted —
  they need a data model (interests, choices) this tool doesn't have yet;
  left as a follow-up.
- **Roles built in** (P7). `022-lab-group-role-randomizer.html` assigns roles with
  a recency memory; `027-novel-study-circles-manager.html` does the same for
  reading circles. Three tools implement group-formation and two implement
  role rotation. One engine should serve all of them. **Skip (2026-08-10)** —
  explicitly out of scope for this round per the cross-tool consolidation
  note; still open for a dedicated round.
- **Group history across the year.** "Everyone has worked with everyone at
  least once" is a real goal and the pair history already tracks the data
  needed to visualize and drive it. **Skip (2026-08-10)** — out of scope for
  this round; note that `pairHistory` currently only retains
  `PAIR_MEMORY_WINDOW` (2) generations, so a real "across the year" view
  would need a retention-policy decision first.
- **Seating-aware grouping** (P7). Groups that are physically possible given
  the seating chart — four students who sit near each other — versus groups
  that require a room reshuffle. **Skip (2026-08-10)** — depends on Seating
  Chart Generator's data, out of scope for this round.
- **Project-team mode.** Longer-lived teams with names, a shared task list,
  and a printable team contract, rather than a one-period grouping. **Skip
  (2026-08-10)** — out of scope for this round; a persistent multi-day team
  is a different data model than this tool's per-period generate/print flow.
- **Done (2026-08-10) — Group sheet worth printing.** Names, table number,
  task, and a place for the group's output — one page per group, ready to
  hand out (`groupSheetHtml`). Roles were intentionally left out per the
  "roles built in" skip above.

## Moonshot / North Star

**Grouping that remembers the whole year and can explain itself.** Ask for
groups of four, balanced, nobody repeating a partner from the last three
weeks, these two apart, roles rotated so nobody is the recorder twice — and
get it instantly, with a plain-English explanation of what it optimized and
what it had to compromise, printed as table tents and a group sheet. Across
every tool on the site that forms groups, using the same memory.

## Platform themes that matter here

- **P7 (cross-tool)** — the clearest consolidation opportunity on the site:
  this tool, Lab Group & Role Randomizer, Novel Study Circles, and Name
  Picker's Groups mode all implement overlapping logic.
- **P2 (shared roster)** — already reads `np_rosters`; needs stable IDs so
  pair history survives a roster edit.
- **P11 (undo)** — a reshuffle destroys the previous grouping irrecoverably.
  **Resolved (2026-08-10)** for the single-most-recent shuffle via a one-level
  undo button; no multi-step history stack.
- **P6 (print quality)** — table tents and group sheets. **Addressed
  (2026-08-10)** — both are implemented, mirroring
  `022-lab-group-role-randomizer.html`'s existing print approach.

## Open Questions

- Should the group-formation engine be extracted into `_shared/` and consumed
  by the four tools that need it, or should one of them become the canonical
  tool and the others link to it?
- Where should skill values live — here, or on the shared student record (P2)?
  They're arguably the most sensitive thing the site would store.
