# Improvement Prompts — Class Roster Hub

**Tool file:** `Tools/class-roster-hub.html`
**Support folder:** `Tools/class-roster-hub/` — `lib/qrcode.js`

**Current description (from README):** Build and save a class roster once, in the same shared storage Name Picker uses — several other tools can load it straight in instead of re-typing a class list.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session. This tool is small but
strategically the most important one on the site: it owns the shared data
that 15 other tools read.

## What it does today

- Create, rename, duplicate, delete named rosters, stored in the shared
  `np_rosters` key
- Type/paste names, or **import from a file** (`namesFromFileText`,
  `firstCellOf` — handles CSV-ish input by taking the first cell)
- Roster switcher, live name count
- **Share a roster by QR code** and by `state-link.js` URL
- Print a class list

## Quick Wins

- **A real roster editor.** Today a roster is a textarea. Per-student rows
  with add/remove/reorder, inline rename, and duplicate detection would make
  this feel like the system of record it actually is.
- **Duplicate and near-duplicate detection** ("John Smith" and "John  Smith"),
  which silently breaks every downstream tool's per-student history.
- **Column mapping on import.** `firstCellOf` assumes the name is in column 1;
  a real export from a gradebook has ID, Last, First, Period. Let the teacher
  pick which columns are which (P13).
- **Last, First ↔ First Last normalization**, since gradebook exports and
  teacher typing disagree and downstream tools display both.
- **Roster stats on the card**: 28 students, last edited 3 weeks ago, used by
  6 tools.
- **Print a numbered class list**, a blank checklist, and a seating-quiz style
  blank — the three paper formats every teacher prints.
- **Archive rather than delete** (P11) — deleting a roster silently orphans
  history in a dozen other tools.

## Major Features

- **Own the student record schema** (P2). This is the decision that unblocks
  the whole site: stable IDs, preferred name, pronunciation, period/section,
  optional photo, and a small set of flags other tools may honor. Today a
  student is a string, which means no tool can reliably carry history across a
  roster edit, and "J. Smith" in one tool is a different person from "Smith,
  John" in another. Whatever shape this takes has to be versioned and
  migratable (P8), because 15 tools depend on it.
- **Sections and periods as first-class.** One roster per period is the
  current model; grouping them into "my 6 sections this year", filtering,
  and moving a student between sections mid-year are all normal events with no
  current answer.
- **Show what depends on this roster.** Before you delete or rename, tell the
  teacher which tools have data keyed to it. This is the friendliest possible
  guardrail and no other tool can provide it.
- **Year rollover** (P14). Archive last year's rosters, start clean, keep the
  section structure. Pairs directly with Backup & Restore.
- **Roster transfer between devices** (P9) — QR sharing exists; peer-to-peer
  transfer of *all* rosters would make the school-to-home move trivial.
- **Bulk operations**: merge two rosters, split one, apply a rename across all
  tools.

## Moonshot / North Star

**One place where the teacher enters a class list, once, per year — and every
other tool on the site just knows.** With stable identity, so participation
counts, hall passes, reading logs, lab roles, and behavior notes all follow
the same student through a name correction, a section change, and a new
semester. Entirely local, visible, and erasable in one click. This is the
quiet backbone that makes the other 45 tools feel like one product instead of
45 separate ones.

## Platform themes that matter here

- **P2 (shared roster)** — this tool is the owner; the theme is this tool's
  roadmap.
- **P8 (versioning/migration)** — any schema change here ripples site-wide and
  must be backward compatible.
- **P13 (import surfaces)** — gradebook exports are the realistic input.
- **P14 (year lifecycle)** — rollover starts here.

## Open Questions

- Should the richer student record live in `np_rosters` (migrating in place,
  with the old array-of-strings shape still readable) or in a new key beside
  it? In-place migration is kinder to the 15 consuming tools but riskier.
- How much personal data is appropriate to store at all? Preferred name and
  pronunciation are clearly useful; photos and flags deserve an explicit
  decision and a very visible erase control.
