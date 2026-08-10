# Improvement Prompts — 043 — Field Trip Permission Slip Generator

**Tool file:** `Tools/field-trip-permission-slip.html`
**Support folder:** `Tools/field-trip-permission-slip/` — `lib/qrcode.js`

**Current description (from README):** Fill in trip details once, then print one slip, a whole class set, or blank copies — save the trip as a template for next year.

---

## Status

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

## What it does today

- Full trip detail form (destination, dates, times, cost, transport, contacts)
  with a **live preview** of the slip
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
- QR code on the slip; print

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
- **Skipped — deferred.** **Add the trip to the calendar** — an `.ics` export, which
  `school-calendar-visualizer.html` and `lab-safety-contract-tracker.html`
  both already know how to build.
- **Skipped — deferred.** **Trip-day mode.** A projector/phone view: the headcount, the groups, the
  schedule, the "who's on the bus" checklist, and emergency numbers — usable
  while standing in a parking lot.
- **Skipped — deferred.** **Multi-section trips.** A grade-level trip spans several teachers'
  rosters; merging them and splitting into buses/groups is currently manual.
- **Skipped — deferred.** **Year-over-year reuse that actually works** (P14). "Same trip as last year,
  new dates, new roster" should be two clicks.
- **Skipped — deferred.** **Return-slip scanning.** Each slip carries a QR already; scanning returned
  slips with `_shared/qr-scan.js` to tick the collection tracker would make
  the tracking step take seconds instead of a prep period.

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
- **P7 (cross-tool)** — `.ics` generation and QR scanning both already exist
  elsewhere on the site.

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
