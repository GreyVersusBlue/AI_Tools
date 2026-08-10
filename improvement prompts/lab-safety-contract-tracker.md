# Improvement Prompts — Lab Safety Contract Tracker

**Tool file:** `Tools/lab-safety-contract-tracker.html`
**Support folder:** none — single file

**Current description (from README):** One-tap signed/not-signed tracking per student, with a live "N of M signed" count and a missing-list before lab day.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Per-student signed/not-signed, one tap; live "N of M signed" summary
- **Multiple tracked documents**, not just one contract (`renderDocsEditor`,
  `defaultDocuments`, `nextDocId`) with per-document dates
- Multiple class sections (`lsct_sections_v1` / `lsct_current_v1`); loads and
  saves `np_rosters`
- **Mark all as signed**; per-document date setting
- Print a **full report** and a **missing list**
- **`.ics` export** — "add lab-day reminder to calendar"
  (`buildIcsForDueDate`), with a days-until countdown

## Quick Wins

- **Print the contract itself**, not just the tracking. The tool tracks a
  document it can't produce; a printable contract (and a parent signature
  line) makes it a complete workflow.
- **Reminder slips** for the students who haven't returned theirs — a
  quarter-sheet with the student's name and the deadline, printed in one pass
  from the missing list.
- **Date-received per student**, not just per document, so the record shows
  when each came in.
- **Digital acknowledgement option.** A student signing on screen isn't legally
  equivalent to a parent signature, but for classroom-rules acknowledgements
  it's often enough and saves a paper cycle.
- **Percent-signed progress bar** on the section switcher, so you can see at a
  glance which of six classes is behind.
- **Undo / confirm on "Mark all as signed"** and Delete class (P11).

## Major Features

- **Generalize beyond lab safety.** The tool is already multi-document; it is
  three small steps from being **the** "did I get this paper back?" tracker —
  permission slips, syllabus signatures, AUP forms, device agreements,
  fundraiser envelopes, picture-day forms. That is a far more frequently
  needed tool than a lab-specific one, and the machinery is written.
- **Merge with the permission-slip collection tracker** (P7).
  `field-trip-permission-slip.html` has its own `renderCollectionTracker`;
  this is the same feature in two places.
- **Gate other tools on it** (P7). Lab Group & Role Randomizer should be able
  to ask "is this student cleared for lab?" and flag or exclude accordingly.
- **Money collection.** Many returned forms come with a fee; paid/unpaid
  beside returned/not-returned is the clipboard teachers actually keep.
- **Scan returned forms** with `_shared/qr-scan.js` if each printed form
  carries a per-student code — ticking off thirty returns in under a minute.
- **Parent contact list for the stragglers** — print the missing list with a
  place to record call/email attempts, which is what the follow-up actually
  requires.

## Moonshot / North Star

**Nothing that goes home is ever unaccounted for.** One board across every
form, every class, and every deadline: what's out, who's returned it, who's
paid, who's been reminded, who needs a phone call — with the forms printable
from the same tool, returns scannable, deadlines on the calendar, and a
missing list in your hand before the bell. Entirely local, and erasable at the
end of the year.

## Platform themes that matter here

- **P7 (cross-tool)** — duplicates the permission-slip collection tracker and
  should gate the lab grouping tool.
- **P2 (shared roster)** — both reads and writes `np_rosters`.
- **P14 (year lifecycle)** — signature tracking is per-year and should roll
  over cleanly.
- **P6 (print quality)** — missing lists, reminder slips, and the contract
  itself.

## Open Questions

- Should this be renamed and repositioned as a general **Form & Signature
  Tracker**, with lab safety as the default template? The code already
  supports it and the name is the main thing limiting its use.
- Is any form of on-screen student acknowledgement acceptable to the district,
  or must everything be paper?
