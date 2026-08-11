# Improvement Prompts — 013 — Lab Safety Contract Tracker

**Tool file:** `Tools/013-lab-safety-contract-tracker.html`
**Support folder:** none — single file

**Current description (from README):** One-tap signed/not-signed tracking per student, with a live "N of M signed" count and a missing-list before lab day.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

### Pass 2 — Round 1 — 2026-08-10 — session `v19h3x`

Shipped **money collection** (the first of the two remaining Major
Features from Round 3's "where the next round should pick up").

- Each `doc` (in `defaultDocuments`/`renderDocsEditor`) now carries an
  optional `fee` field — a small `.doc-fee` text input beside the label,
  blank by default. `feeAmount(doc)` parses it and treats blank/0/garbage
  as "no fee" (`docHasFee`), so a class with no paid forms sees nothing new
  in the UI at all — no stray toggle, no summary line, no print-column,
  exactly as scoped ("must not clutter the UI when unused").
- Per student per document, a `paid` boolean lives alongside `signed`/`date`
  in `contracts[name].docs[docId]`. A `.paid-toggle` pill (amber, echoing
  the existing green `.status-toggle.is-signed` pattern) appears next to a
  student's signed-toggle and date field *only* for documents where
  `docHasFee()` is true — `setDocPaid()`/`getDoc()` handle it the same way
  `setDocSigned()`/`setDocDate()` already did.
- Live summary: `summaryData()` now also returns `paid`/`hasFee`; when any
  document has a fee, `#summaryCount` reads e.g. "2 of 4 signed · 2 of 4
  paid ($15 each)" (single fee-bearing doc) or "… ($35 total)" (more than
  one fee-bearing doc, summed). The existing multi-document
  `#docBreakdown` chip row gains a second chip per fee-bearing document
  ("Lab Safety Contract paid: 2/4 ($15 ea)") alongside its existing
  signed-count chip — mirrors the file's existing per-doc breakdown
  convention rather than inventing a new one.
- **Print missing list** gains an "Unpaid" column (only when any document
  has a fee) listing which fee-bearing documents that student still owes
  on, plus the dollar amount, right beside the existing "Missing" column —
  so one printout covers both dimensions as asked.
- **Reminder slips** gain a `Fee due: $X` line (amber, matching the
  existing red due-date line's visual weight) whenever that student owes
  money on an unsigned document.
- **Print full report** also got a quieter version of the same treatment —
  each document's Yes/No cell appends "· Paid"/"· Unpaid" when that
  document has a fee — not explicitly asked for but essentially free once
  `docHasFee()`/`getDoc().paid` existed, and it keeps that print consistent
  with the other two.
- Migration: `loadSection()`'s existing per-document upgrade loop (the one
  that already defaults missing `d.body` to `''`) now also defaults a
  missing `d.fee` to `''`. `getDoc()` was changed to always return a
  fully-shaped `{signed, date, paid}` object (defaulting any missing field)
  rather than only defaulting when the whole record is absent, so a
  contract saved before this round (whose per-doc records have no `paid`
  key at all) reads as `paid: false` with no crash — verified directly
  against a hand-seeded pre-existing section using the *old pre-multi-doc*
  flat `{signed, date}` shape with a `documents` array that has no `fee`
  key whatsoever (i.e. a section untouched since before Round 3's
  `migrateContracts()` even existed).

Verified with a headless Playwright run against the real file (no build
step): seeded a 4-student roster, set a $15 fee on the one document,
confirmed 4 paid-toggle buttons appeared; mixed signed/paid combinations
across the 4 students produced summary "2 of 4 signed · 2 of 4 paid ($15
each)"; missing-list print showed the unpaid student with "Lab Safety
Contract — $15" and the paid-but-unsigned student with "—"; reminder slips
showed "Fee due: $15" only for the unpaid+unsigned student; full report
showed "Yes … · Paid" / "Yes … · Unpaid" / "No · Paid" / "No · Unpaid" per
student correctly. Separately loaded a hand-seeded legacy section (no
`fee` field anywhere, pre-multi-doc contract shape) and confirmed it loads
with no console/page errors, no paid toggles shown (correctly, since no
fee was ever set), and the pre-existing signed count still reads
correctly. Also verified the multi-document case (one fee-bearing doc
alongside one fee-free doc): breakdown chips and the "$X each" vs "$X
total" summary wording both render without errors.

#### Challenges

- Deciding what "the missing-list print … should show unpaid status
  alongside not-signed" means in scope: it does **not** pull
  signed-but-unpaid students onto the missing list (that list is still
  defined by "hasn't returned the form yet") — it only adds an unpaid
  column to the rows already on that list, matching the literal wording
  ("alongside not-signed"). A signed-but-unpaid student (turned the paper
  in, still owes money) is genuinely invisible to the missing-list/slips
  workflow today; they'd only show up in the summary's paid count and the
  full report. If a teacher wants a dedicated "still owes money" view
  independent of signed status, that's a follow-on, not something this
  round's wording asked for — flagging it for whoever picks this up next.
- Multiple fee-bearing documents in one class are supported (the summary
  sums them as "$X total" and the breakdown lists each separately), but
  this is a less-tested path than the common single-fee case the feature
  description centers on ("$15 each"); worth a second look if a teacher
  ever puts fees on more than one document in the same class.

### Where the next round should pick up

- **QR-scan check-in** for returned forms is the one remaining Major
  Feature from the original list that's still fully unbuilt.
- **Merge with the permission-slip collection tracker**
  (`043-field-trip-permission-slip.html`) and **generalize beyond lab
  safety** are both still open, unchanged from Round 3's notes.
- Consider whether a signed-but-unpaid student should surface somewhere
  more prominent than the full report (see Challenges above) — e.g. a
  "still owes money" filter next to "Show missing only" on the Students
  card.

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
  `043-field-trip-permission-slip.html` (P7) is still open and is now more
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
- **Parent-contact follow-up sheet** (`printContactBtn`, `contactAttemptHtml`)
  — the missing students with two dated contact attempts each, methods as tick
  boxes, and an outcome column, for documenting the chase
- **`.ics` export** — "add lab-day reminder to calendar"
  (`buildIcsForDueDate`), with a days-until countdown
- **Optional per-document fee with a paid/unpaid toggle** per student,
  a parallel "N of M paid" count in the live summary, and unpaid status
  on the missing-list print and reminder slips

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
  `043-field-trip-permission-slip.html` has its own `renderCollectionTracker`;
  this is the same feature in two places.
- **Gate other tools on it** (P7). Lab Group & Role Randomizer should be able
  to ask "is this student cleared for lab?" and flag or exclude accordingly.
- **Done — Money collection.** Many returned forms come with a fee; paid/unpaid
  beside returned/not-returned is the clipboard teachers actually keep.
  *(Shipped Pass 2 Round 1 — optional per-document fee, per-student
  paid/unpaid toggle, a parallel "N of M paid ($X each)" count in the live
  summary, and unpaid status on both the missing-list print and the
  reminder slips.)*
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

## Parent-contact round — 2026-08-11 (backlog rank 1)

Shipped the **parent-contact follow-up sheet**.

"Print missing list" answers *who* still owes a contract. It does nothing for
the part that actually eats the time: calling or emailing home, twice, and
being able to say what was tried and when when an administrator or a parent
asks later. **"Print parent-contact sheet"** is that page — the same missing
students, with the chase built into the row:

- Column 1 carries what the tool already knows: the student, which documents
  are missing (only when more than one is tracked — with a single document the
  label adds nothing to a row that already means "missing"), what is unpaid
  and how much, and the teacher's own note.
- Column 2 is **two dated attempts**, each with the method as tick boxes (call
  / email / text / note home / in person) and an outcome row (spoke / left
  message / no answer / bad number). One call is rarely the whole chase.
- Column 3 is left blank for the pen.
- A "Kept by / school year" line at the top, because this is a document that
  may be read by someone who is not the teacher.

It is deliberately paper rather than fields in the tool: the calls happen at a
desk phone with a stack of paper, and a teacher writing "no answer, left
voicemail" wants a pen. What the tool knows is printed; what only the teacher
will know is left blank.

One layout detail worth remembering: every tick box is glued to its label with
`&nbsp;`. Without it the narrow column stranded a ☐ at the end of a line with
its word on the next.

New suite `Tools/lab-safety-contract-tracker/test/smoke-contact-sheet.mjs`
(21 checks) as `npm run test:lab-safety`: a four-student class with two signed
through the tool's own toggles, asserting the sheet carries exactly the two
missing students and neither signed one, the note travels, the row shape is
right, the outcome column is empty, the existing missing-list print is
untouched, and an all-signed class prints "nobody to contact" instead of an
empty grid.

### Where the next round should pick up

- The sheet is print-only by design. If a future round wants the *outcome*
  captured in the tool (so next year's teacher can see the history), that is a
  storage-schema change to `lsct_sections_v1` and should carry a migration —
  do not bolt contact records onto the per-student note field.
- **Scan returned forms** (`_shared/qr-scan.js` against a per-student code on
  each blank contract) is still open and is the biggest remaining idea here.
