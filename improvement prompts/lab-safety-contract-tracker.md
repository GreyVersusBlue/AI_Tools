# Improvement Prompts — 013 — Lab Safety Contract Tracker

**Tool file:** `Tools/lab-safety-contract-tracker.html`
**Support folder:** none — single file

**Current description (from README):** One-tap signed/not-signed tracking per student, with a live "N of M signed" count and a missing-list before lab day.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

### Round 3 (2026-08-10) — shipped

- **Print the contract itself.** Each required document now has an optional
  "form text" field (`doc.body`), and a new "Print blank forms" button
  prints one signable copy per roster student — title, form text, and
  Student/Parent signature+date lines. `defaultDocuments()` seeds a real
  generic lab-safety paragraph so a first-time user sees a usable form, not
  an empty one. When there's more than one required document, a `prompt()`
  picks which one (consistent with the file's existing style — it already
  uses `prompt()`/`confirm()` elsewhere rather than custom modals).
- **Reminder slips for the missing list.** "Print reminder slips" lays out
  the current missing students 4-to-a-page in a dashed-border cut-apart
  grid, each slip showing the student's name, which document(s) they still
  owe, and the due date if one is set.
- **Percent-signed on the class switcher.** Each `<option>` now reads e.g.
  "Period 3 — Chemistry — 18/24 (75%)", computed from that section's stored
  data (not just the currently-loaded one) so you can see which of several
  classes is behind without switching into each. Refreshed on every
  `renderAll()` so it stays live as students get marked off.
- **Date-received per student** and **confirm-before-destructive-action**
  (Mark all as signed, Delete class) turned out to already be implemented
  in the existing code — verified by reading `setDocDate`/`getDoc` (keyed by
  both student and document) and the existing `confirm()` calls before
  skipping those two items.

All three new print paths were verified in a headless Chromium run:
roster of 4, 2 marked signed → switcher reads "2/4 (50%)", "Print blank
forms" produces 4 form pages with signature lines, "Print reminder slips"
produces 2 slips naming the 2 missing students with the due date shown.

### Challenges

- `sectionProgressLabel()` has to read *other* sections' stored data (to
  show every class's percentage in the dropdown, not just the active one),
  which may still be in the pre-multi-document `{signed, date}` shape if
  that section hasn't been loaded (and therefore migrated) since the
  multi-document format shipped. Wrote `normalizedDocsFor()` as a read-only
  version of the same mapping `migrateContracts()` does, rather than
  triggering a write for a section the teacher hasn't opened.
- The reminder-slip grid uses `grid-auto-rows: 1fr` over a fixed
  `min-height` so 4 slips fill a page as quarters; with fewer than 4 missing
  students the single row still expands to fill that height, so a 1- or
  2-missing print comes out as half-page or full-page slips rather than
  true quarters. Cosmetic, not a correctness problem — noted for whoever
  picks this up next rather than fixed, since a real fix wants a
  content-driven row height that still ties out at exactly 4-per-page.

### Where the next round should pick up

- **Generalize beyond lab safety** (Major Feature) is now more clearly in
  reach — the tool can already print AND track an arbitrary named,
  multi-document form. Renaming/repositioning it as a general Form &
  Signature Tracker is a product decision for Devon, not a code change; the
  Open Question below still stands.
- **Merge with the permission-slip collection tracker** in
  `field-trip-permission-slip.html` (P7) is still open and is now more
  clearly the same feature built twice.
- **Money collection** (paid/unpaid) and **QR-scan check-in** for returned
  forms are still open Major Features, unbuilt this round.

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

- **Done —** **Print the contract itself**, not just the tracking. The tool tracks a
  document it can't produce; a printable contract (and a parent signature
  line) makes it a complete workflow. *(Shipped Round 3 as "Print blank
  forms" — one signable copy per roster student, seeded with a default
  generic lab-safety paragraph.)*
- **Done —** **Reminder slips** for the students who haven't returned theirs — a
  quarter-sheet with the student's name and the deadline, printed in one pass
  from the missing list. *(Shipped Round 3 as "Print reminder slips",
  4-to-a-page.)*
- **Already done (predates this round) —** **Date-received per student**, not just per document, so the record shows
  when each came in. *(Verified Round 3 — already implemented, keyed by
  both student and document; nothing to build.)*
- **Digital acknowledgement option.** A student signing on screen isn't legally
  equivalent to a parent signature, but for classroom-rules acknowledgements
  it's often enough and saves a paper cycle.
- **Done —** **Percent-signed progress bar** on the section switcher, so you can see at a
  glance which of six classes is behind. *(Shipped Round 3 — each class
  option reads e.g. "Period 3 — Chemistry — 18/24 (75%)".)*
- **Already done (predates this round) —** **Undo / confirm on "Mark all as signed"** and Delete class (P11). *(Verified
  Round 3 — both already prompted with `confirm()`; nothing to build.)*

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
