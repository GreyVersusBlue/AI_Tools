# Improvement Prompts — Group / Team Generator

**Tool file:** `Tools/group-team-generator.html`
**Support folder:** none — single file

**Current description (from README):** Split a pasted or Name-Picker roster into random groups by count or size, with optional skill-balancing and "keep these two apart" constraints. Prints a clean group sheet.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Split by **group count** or **group size**; load a saved `np_rosters` roster
- **Skill balancing** (`avgSkill`, `totalScore`) with per-student skill values
- **Keep Apart** and **Put Together** constraints with violation reporting
  (`findApartViolations`, `findTogetherViolations`)
- **Pairing memory** — penalizes recently-paired students
  (`pairRecencyPenalty`, `recordPairHistory`, `findRecentPairViolations`),
  with a reset. This is the tool's best idea.
- Multiple saved class configs (`gtg:list` / `gtg:current`), reshuffle, copy
  as text, print

## Quick Wins

- **Show why a grouping was chosen.** The scoring machinery
  (`totalScore`, `totalPairPenalty`) already exists; surfacing "this grouping
  breaks one keep-apart constraint and repeats two pairs" makes the teacher
  trust it or reshuffle deliberately.
- **Lock a group and reshuffle the rest** — the most common real interaction
  and currently impossible.
- **Absent students excluded in one tap**, rather than edited out of the list.
- **Name the groups** (Table 1, Red Team, or by topic) and print them that way.
- **Print table tents** — `lab-group-role-randomizer.html` already generates
  them (`tentsHtml`, `tentPanelHtml`) and this tool doesn't (P7).
- **Odd-number handling as a stated choice**: one group of 5, or a floater, or
  a pair — currently implicit.
- **Undo the last shuffle** (P11).

## Major Features

- **Grouping strategies as first-class modes.** Random, balanced by skill,
  heterogeneous (deliberately mixed), homogeneous (by readiness, for
  differentiation), by interest, by student choice with constraints. "Group
  the four strongest together" and "spread them evenly" are opposite requests
  that both come up weekly, and only one is supported.
- **Roles built in** (P7). `lab-group-role-randomizer.html` assigns roles with
  a recency memory; `novel-study-circles-manager.html` does the same for
  reading circles. Three tools implement group-formation and two implement
  role rotation. One engine should serve all of them.
- **Group history across the year.** "Everyone has worked with everyone at
  least once" is a real goal and the pair history already tracks the data
  needed to visualize and drive it.
- **Seating-aware grouping** (P7). Groups that are physically possible given
  the seating chart — four students who sit near each other — versus groups
  that require a room reshuffle.
- **Project-team mode.** Longer-lived teams with names, a shared task list,
  and a printable team contract, rather than a one-period grouping.
- **Group sheet worth printing.** Names, roles, table number, task, and a
  place for the group's output — one page, ready to hand out.

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
- **P6 (print quality)** — table tents and group sheets.

## Open Questions

- Should the group-formation engine be extracted into `_shared/` and consumed
  by the four tools that need it, or should one of them become the canonical
  tool and the others link to it?
- Where should skill values live — here, or on the shared student record (P2)?
  They're arguably the most sensitive thing the site would store.
