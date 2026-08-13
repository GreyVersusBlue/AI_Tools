# Improvement Prompts — 043 — Field Trip Permission Slip Generator

**Tool file:** `Tools/043-field-trip-permission-slip.html`
**Support folder:** `Tools/field-trip-permission-slip/` — `test/`. (The QR
encoder used to live here as `lib/qrcode.js`; Phase 1b of `REFACTOR_PLAN.md`
moved it to the single site-wide `_shared/vendor/qrcode/qrcode.js`.)

**Current description (from README):** Fill in trip details once, then print one slip, a whole class set, or blank copies — save the trip as a template for next year.

---

## Status

**2026-08-13 — Scan returned slips to check them off.** The backlog's own
next-round pointer (bottom of the 2026-08-12 entry below) called this out, so
this round built it: a "Scan a returned slip" button on the collection
tracker card opens a camera modal (`_shared/qr-scan.js` +
`_shared/vendor/jsqr/jsqr.js`, wired the same way `016-qr-code-generator.html`
already does it) and checks a student off the moment their slip's QR decodes.

**What the QR already encoded, and what changed.** Before this round, every
slip in a batch — all 30 students — carried the *identical* QR: a plain-text
`"trip name | destination | date"` string with nothing that identified which
student the printed page belonged to. That made scan-to-check-off impossible
as a starting point; the QR had to change to be scannable per-student, not
just added a scanner on top of what existed. It now encodes tagged JSON —
`{"ftps":1,"trip":"<trip name>","student":"<student name>"}` — via
`buildSlipQrPayload(studentName)`, called with each student's own name at the
point each slip is built (`slipHtml()` already had `studentName` in scope, it
just wasn't reaching the QR). A blank copy (no name filled in yet) encodes
`student: ""`, since there's nothing yet to check off. Nothing about the QR
is persisted in trip state — it was already generated fresh from the current
form on every render — so this is a pure behavior change, not a migration.

**How a scan resolves to a specific student.** `resolveScannedSlip(text)`:
parse the decoded text as JSON and require `ftps === 1` (rejects an unrelated
QR — a library book, someone else's flyer — instead of guessing at it);
require a non-empty `student`; if the payload's `trip` is set and doesn't
match the currently-loaded trip's name, refuse rather than checking off a
same-named student under the wrong trip; then match `student` case-
insensitively/trimmed against `batchNamesList()` — the exact list the
tracker's rows and the chaperone assignment panel already read. A match
flips `state.collected[name].returned = true` (the same field the manual
"Returned" checkbox writes) and re-renders the tracker; no match, no trip, no
roster, or unparseable text each return a distinct status the UI turns into a
plain-language banner without ever throwing. A second scan of an
already-returned student's slip is recognized as `'duplicate'` and left
alone — no double-count, no error.

**Testing.** Camera access can't be driven under headless Playwright, so
`Tools/field-trip-permission-slip/test/smoke-scan-tracker.mjs` (45
assertions, new this round) decodes the QR the tool actually renders — using
the page's own vendored jsQR against each printed slip's `<img>` data URL,
the same decoder the camera path uses — and feeds the resulting text into
`window.__ftpsResolveScan(text)`, a small hook exposed specifically so a test
can call exactly what the camera's `onResult` callback calls. It holds down:
each student's slip carries its own distinct QR (not a shared trip-level
one); a first scan checks off and updates the "N of M returned" count; a
duplicate scan is a no-op with an "already checked off" message; an
unmatched student name, a different trip's QR, a blank copy's QR (no
student), an empty roster, and outright garbage text are all reported
through the status banner and never crash; the scan modal itself opens,
reports "no camera" gracefully in this headless environment, and closes on
Cancel; and zero console errors or off-site requests anywhere in the run.
The pre-existing `test/smoke-bilingual.mjs` (44 assertions) was re-run
unchanged and still passes — the QR payload change doesn't touch anything
that suite asserts on.

**Not wired into `package.json`.** This round's task scope explicitly
excluded editing `package.json`; the new suite runs directly
(`node Tools/field-trip-permission-slip/test/smoke-scan-tracker.mjs`) but
isn't yet added to `npm test` or given its own `test:*` script the way
`smoke-bilingual.mjs` has `test:permission-slip`. A future round (or whoever
owns `package.json` centrally) should add it.

**Left for a future round:** the trip-mismatch check only fires when the
scanned QR's `trip` field is non-empty and the current trip's name is also
set — an untitled trip (`state.name === ''`) can't be distinguished this way,
though that's an edge case (every trip gets named on creation via a prompt).
Also unaddressed: there's no visible list of *who's been scanned this
session* versus checked off manually — the tracker rows already show that,
so it wasn't duplicated, but a teacher standing at a bus door scanning 28
slips in a row gets no separate "just scanned" feed, only the running total
and the per-row checkbox state.

**2026-08-11 — Round 2 (session `gb5c6e`).** Shipped `.ics` calendar export
(Major Features), reusing the exact hand-built-VCALENDAR pattern already
proven in `013-lab-safety-contract-tracker.html`: `icsEscape`/`icsTimestamp`/
compact-date helpers, all-day events only (no timezone to get wrong). A new
"Add trip to calendar (.ics)" button in the trip-details card downloads a
file containing **one event for the trip itself** (date range, or a single
day; departure/return times and cost/contact info folded into the
description rather than making it a timed event, to avoid timezone bugs) and
**a second, separate event on the slip-return due date** when one is set and
differs from the trip date — its description reuses the tool's own
`missingStudents()`/`batchNamesList()` to report who's still missing a slip
as of the moment it's downloaded, the same "live snapshot" approach the lab
safety tracker's reminder already uses. Clicking with no trip date set shows
an alert rather than downloading an empty/broken file. Verified with a
headless Playwright pass: the no-date guard alert, and the full two-event
`.ics` output (parsed and printed) for a trip with a due date, departure/
return times, cost, and chaperone contact — zero console errors.

Not attempted this round: everything else in Major Features (still
deferred), and the medical/allergy and second-language Quick Wins already
flagged as out of scope for a single round.

---

**2026-08-10 — Quick Wins mostly implemented; Major Features deferred.**
Storage stayed additive: `state.chaperones` and `state.chaperoneAssignments`
are new arrays/objects defaulting to empty, and each `collected[name]` record
gained a `payment` field (`'unpaid'|'paid'|'waived'`) alongside the existing
`returned`/`paid` booleans — `normalizeState()`/`normalizeCollectedRecord()`
backfill both on load (and on JSON import) so a trip saved before this round
still loads and tracks exactly as it did.

What shipped, in the order of the backlog:

- **Money tracking, upgraded to paid/not-paid/waived.** The collection
  tracker's "Paid" checkbox is now a `<select class="payment-select">` with
  three states. `parseCostAmount()` is unchanged and still does the actual
  cost parsing (reused, not re-derived); `updateCollectionSummary()` now also
  reports a waived count. **This was a partial pre-existing feature** — a
  binary paid/unpaid checkbox already existed — so the actual work was adding
  the third "waived" state, not the payment axis itself.
- **Printable missing list + reminder slips.** `missingStudents()` defines
  "missing" as not-returned OR (there's a cost AND not paid/waived — waived
  doesn't count as missing). `missingListHtml()`/`buildMissingListPrintArea()`
  print a pocket-sized (4.25in) list with a Returned/Payment column per
  missing student; `reminderSlipHtml()`/`buildReminderPrintArea()` print one
  half-sheet reminder per missing student naming exactly what's still needed.
  Both are separate "Print missing list" / "Print reminder slips" buttons on
  the collection tracker card, not part of the main batch print.
- **Deadline / countdown.** `renderDeadlineLine()` computes days-left (or
  overdue) from `state.dueDate` vs. today's local date and shows
  "Due Friday, Sep 12 — 11 of 28 returned — 6 days left" above the collection
  tracker, switching to a red "overdue" style once the date passes. Recomputed
  on every tracker render and whenever the due date or student list changes.
- **Chaperone section.** New "Chaperones" card: repeatable name+phone rows
  (`renderChaperoneRows()`) and a per-student group-assignment list
  (`renderChaperoneAssign()`), both keyed by chaperone *name* (not index) so
  removing a chaperone cleanly un-assigns anyone pointed at them instead of
  leaving a dangling reference. "Print chaperone groups"
  (`chaperonePrintHtml()`) prints one page with each chaperone's phone number
  and student list, plus an "Unassigned" bucket. This is deliberately
  separate from the existing single "Chaperone / trip contact name/phone"
  fields on the main form, which still print on the slip itself unchanged —
  the new section is for *multiple* chaperones and *groups*, not a
  replacement for the trip contact line.
- **Confirm-before-delete on trips** — **already existed** (a `confirm()`
  before `TripStore.deleteTrip()`). This round adds the "or undo" half of the
  ask: a 10-second undo bar in the toolbar restores the just-deleted trip via
  `TripStore.saveTrip()`.
- **Skipped — deliberately, not just deferred.** **Medical/allergy line.**
  The doc itself flagged this as needing an explicit maintainer decision
  before anything gets built, not something to add unilaterally — so nothing
  was added: no field, no storage key, no UI. See Open Questions below; the
  underlying policy question is still open, this round just declined to
  pre-empt it.
- **Skipped — deferred.** **Second language version** of the slip. Real and
  scoped, but not one of the five items assigned this round.

**Where a future round should pick up:** the medical/allergy decision (Open
Questions), the second-language version, and everything in Major Features
below — especially "the whole trip packet," where this round's missing-list
and chaperone-group printables are a first step (two more printable views
sharing the same trip data) but the parent letter, emergency sheet, headcount
checklist, name tags, and day schedule are all still unbuilt.

**2026-08-12 — Round 5 (backlog rank 2: bilingual slip printing).** A slip only
works if the person signing it can read it. The tool now prints a second
language beside the English one — **Spanish, French, or Portuguese** — either
as a facing page or as a two-column pair on one sheet.

The split that made this tractable: a permission slip is mostly **fixed
furniture** — the title, the table headings, the permission sentence, the four
signature lines, "please return this slip by" — which is identical on every
trip and every school, so it ships translated. Everything the *teacher* typed
is theirs to translate, and only three fields are actually prose (purpose,
what to bring, emergency instructions); the rest are proper nouns, dates, and
numbers that read the same in both columns. So the translation surface is
three textareas, not a form as long as the original.

Decisions worth keeping:

- **A blank translation falls back to the English text**, never to a gap. A
  half-finished translation still produces a slip a family can sign, which is
  the state a real teacher will be in at 4pm the day before. A hint under the
  fields names which ones are still in English, so that is known before it is
  printed rather than after.
- **The translated slip is a form, not a courtesy copy.** It carries the
  student's name, the dates, the QR, and all four signature lines. A
  translated slip with no signature block is decoration.
- **Facing page is the default**, side-by-side is the option. Two columns on
  letter paper is a four-inch column, and a long "what to bring" list reads
  badly in it — but it halves the paper, which some offices care about more.

**A known limitation, asserted in the suite so it can only change on purpose:**
the untranslated-fields hint tracks whether a translation *exists*, not whether
it still *matches*. Reword the English purpose and the old translation keeps
printing, unflagged. Fixing it means storing a hash or a copy of the English
text each translation was written against — worth doing, not worth guessing at
this round.

Also unhandled by design: translations are stored once, not per language.
Switching Spanish → French keeps the Spanish text in the boxes. For a teacher
who sends slips home in two languages in the same year that is a real gap;
`state.translations` would need to become `{ es: {...}, fr: {...} }`, which is
a schema change and belongs in its own round.

Verified with a new 44-assertion headless Chromium suite,
`Tools/field-trip-permission-slip/test/smoke-bilingual.mjs`
(`npm run test:permission-slip`): the translated titles and signature lines,
the English fallback, the hint appearing and clearing, both layouts producing
structurally different print output, batch printing pairing every student, the
language switching off again, persistence, and a trip saved before any of this
opening as English-only — no console errors.

**Next round should pick up** per-language translation storage (above); the
scanning row that used to be listed here shipped 2026-08-13 (see the Status
entry above it).

## What it does today

- Full trip detail form (destination, dates, times, cost, transport, contacts)
  with a **live preview** of the slip
- **Second-language printing** (Spanish / French / Portuguese): headings,
  permission sentence and signature lines ship translated, the three prose
  fields are teacher-translated with an English fallback, printed as a facing
  page or a two-column pair
- Saved trips as reusable templates (`gvb-field-trip:list` / `:current`),
  switchable, with JSON import/export, confirm-before-delete, and a
  10-second undo
- **Batch printing** of a class set from a loaded `np_rosters` roster
- **Collection tracker** (`renderCollectionTracker`, `updateCollectionSummary`)
  — who has returned their slip, and, if there's a cost, who's
  **paid / not paid / waived**
- **Deadline countdown** above the tracker (`renderDeadlineLine`) — days
  left or overdue, computed from the trip's due date
- **Printable missing list** (pocket-sized) and **printable reminder slips**,
  one per student still missing a slip and/or payment
- **Chaperone section** — multiple named chaperones with phone numbers,
  per-student group assignment, and a printable trip-day roster grouped by
  chaperone
- **`.ics` calendar export** — one event for the trip, plus a separate
  slip-due reminder event with a live missing-count snapshot
- **QR code per slip, scannable to check a student off** — each slip's QR
  encodes tagged JSON naming the trip and *that* student (not a copy of one
  shared trip-level code); the collection tracker's "Scan a returned slip"
  camera button decodes it and checks the matching roster row off, handling
  a duplicate scan, an unmatched name, and a different trip's slip without
  erroring

## Quick Wins

- **Done —** **Money tracking alongside slip tracking.** The collection tracker knows who
  returned a slip; trips also collect fees, and "paid / not paid / waived"
  next to "returned / not returned" is the actual clipboard a teacher carries.
  `parseCostAmount` already exists. *(The paid/unpaid half already existed;
  this round added the "waived" third state via a `payment` select.)*
- **Done —** **Print the missing list**, sized to fit in a pocket, plus a reminder slip
  to hand the students who haven't returned theirs.
- **Done —** **Deadline and countdown.** "Due Friday — 11 of 28 returned, 6 days left."
- **Skipped — deferred.** **A second language version** of the same slip, printed together — the
  single most-requested thing about permission slips in most districts.
- **Done —** **Chaperone section**: names, phone numbers, and which students are
  in which chaperone group. *(Skipped "ratios" specifically — no
  student-per-chaperone target/limit was added, just the grouping and
  contact info.)*
- **Skipped — deliberately.** **Medical/allergy line** pulled from nothing sensitive by default, but with
  a clearly-marked optional field, since it's the thing that has to be on the
  trip day printout. *(The doc calls this out as needing an explicit
  maintainer decision before it's built — not added unilaterally. See Open
  Questions.)*
- **Done —** **Undo / confirm on Delete trip** (P11). *(Confirm already existed;
  added a 10-second undo bar on top of it.)*

## Major Features

- **Skipped — deferred.** **The whole trip packet, not just the slip.** A trip needs: the permission
  slip, a parent information letter, the roster grouped by chaperone, an
  emergency contact sheet, a headcount checklist for the bus, name tags, and a
  schedule for the day. Every one of those is printable from the same data.
  This is a straightforward expansion with a large payoff (P7). *(The
  chaperone-grouped roster and the missing list are now printable — two of
  the several pieces this item describes. The parent letter, emergency
  sheet, headcount checklist, name tags, and day schedule are still
  unbuilt.)*
- **Done —** **Add the trip to the calendar** — an `.ics` export, which
  `school-calendar-visualizer.html` and `013-lab-safety-contract-tracker.html`
  both already know how to build. *(Reused `013-lab-safety-contract-tracker.html`'s
  hand-built VCALENDAR pattern; ships one trip event plus a separate
  slip-due reminder event.)*
- **Skipped — deferred.** **Trip-day mode.** A projector/phone view: the headcount, the groups, the
  schedule, the "who's on the bus" checklist, and emergency numbers — usable
  while standing in a parking lot.
- **Skipped — deferred.** **Multi-section trips.** A grade-level trip spans several teachers'
  rosters; merging them and splitting into buses/groups is currently manual.
- **Skipped — deferred.** **Year-over-year reuse that actually works** (P14). "Same trip as last year,
  new dates, new roster" should be two clicks.
- **Done —** **Return-slip scanning.** Each slip's QR now names the specific student it
  was printed for; scanning it with `_shared/qr-scan.js` on the collection
  tracker checks that student off in seconds instead of a prep period spent
  reading a paper list.

## Moonshot / North Star

**Every piece of paper a field trip needs, from one form, twice a year.** Fill
in the trip once; print the slips (in two languages), the parent letter, the
chaperone groups, the emergency sheet, and the bus checklist; scan returned
slips to tick them off; carry the trip-day view on a phone; and roll the whole
thing forward to next year's dates in two clicks.

## Platform themes that matter here

- **P2 (shared roster)** — already reads `np_rosters`; multi-section merging
  is the next step.
- **P6 (print quality)** — a slip that gets cut, signed, and returned has
  real physical requirements (tear line, signature space, a stub the family
  keeps). The new missing-list and reminder-slip printables were sized with
  this in mind (a 4.25in pocket list, a half-sheet reminder) but weren't put
  through an actual print test on paper this round.
- **P14 (year lifecycle)** — trips repeat annually; this is the clearest case
  for rollover.
- **P7 (cross-tool)** — **addressed 2026-08-11** for `.ics` generation, and
  **addressed 2026-08-13** for QR scanning: `_shared/qr-scan.js` +
  `_shared/vendor/jsqr/jsqr.js` (already shared by `016-qr-code-generator.html`)
  are now wired up here too, not just generating a QR with the shared encoder
  but decoding one back with the shared scanner.

## Open Questions

- **Resolved 2026-08-10, for this round only.** How much student
  medical/dietary information should this tool ever hold? It's genuinely
  needed on trip day and it's the most sensitive data the site would touch —
  worth an explicit decision and a very visible erase control. — This round's
  answer was "none": no medical/allergy/dietary field, storage key, or UI was
  added, deliberately, per the task's own instruction that this needs a
  maintainer decision rather than a unilateral addition. The underlying
  policy question (should this tool *ever* hold it, and with what erase
  control) is still genuinely open for a human to decide.
- Does the district have a mandated slip format that should be a shipped
  template?
