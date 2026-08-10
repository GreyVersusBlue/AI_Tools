# Improvement Prompts — Field Trip Permission Slip Generator

**Tool file:** `Tools/field-trip-permission-slip.html`
**Support folder:** `Tools/field-trip-permission-slip/` — `lib/qrcode.js`

**Current description (from README):** Fill in trip details once, then print one slip, a whole class set, or blank copies — save the trip as a template for next year.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Full trip detail form (destination, dates, times, cost, transport, contacts)
  with a **live preview** of the slip
- Saved trips as reusable templates (`gvb-field-trip:list` / `:current`),
  switchable, with JSON import/export
- **Batch printing** of a class set from a loaded `np_rosters` roster
- **Collection tracker** (`renderCollectionTracker`, `updateCollectionSummary`)
  — who has returned their slip
- QR code on the slip; print

## Quick Wins

- **Money tracking alongside slip tracking.** The collection tracker knows who
  returned a slip; trips also collect fees, and "paid / not paid / waived"
  next to "returned / not returned" is the actual clipboard a teacher carries.
  `parseCostAmount` already exists.
- **Print the missing list**, sized to fit in a pocket, plus a reminder slip
  to hand the students who haven't returned theirs.
- **Deadline and countdown.** "Due Friday — 11 of 28 returned, 6 days left."
- **A second language version** of the same slip, printed together — the
  single most-requested thing about permission slips in most districts.
- **Chaperone section**: names, ratios, phone numbers, and which students are
  in which chaperone group.
- **Medical/allergy line** pulled from nothing sensitive by default, but with
  a clearly-marked optional field, since it's the thing that has to be on the
  trip day printout.
- **Undo / confirm on Delete trip** (P11).

## Major Features

- **The whole trip packet, not just the slip.** A trip needs: the permission
  slip, a parent information letter, the roster grouped by chaperone, an
  emergency contact sheet, a headcount checklist for the bus, name tags, and a
  schedule for the day. Every one of those is printable from the same data.
  This is a straightforward expansion with a large payoff (P7).
- **Add the trip to the calendar** — an `.ics` export, which
  `school-calendar-visualizer.html` and `lab-safety-contract-tracker.html`
  both already know how to build.
- **Trip-day mode.** A projector/phone view: the headcount, the groups, the
  schedule, the "who's on the bus" checklist, and emergency numbers — usable
  while standing in a parking lot.
- **Multi-section trips.** A grade-level trip spans several teachers'
  rosters; merging them and splitting into buses/groups is currently manual.
- **Year-over-year reuse that actually works** (P14). "Same trip as last year,
  new dates, new roster" should be two clicks.
- **Return-slip scanning.** Each slip carries a QR already; scanning returned
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
  keeps).
- **P14 (year lifecycle)** — trips repeat annually; this is the clearest case
  for rollover.
- **P7 (cross-tool)** — `.ics` generation and QR scanning both already exist
  elsewhere on the site.

## Open Questions

- How much student medical/dietary information should this tool ever hold?
  It's genuinely needed on trip day and it's the most sensitive data the site
  would touch — worth an explicit decision and a very visible erase control.
- Does the district have a mandated slip format that should be a shipped
  template?
