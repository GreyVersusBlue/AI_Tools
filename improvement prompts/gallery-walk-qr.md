# Improvement Prompts — Gallery Walk QR Codes

**Tool file:** `Tools/gallery-walk-qr.html`
**Support folder:** `Tools/gallery-walk-qr/` — `lib/qrcode.js`

**Current description (from README):** Batch-generate QR codes linking to student work for a gallery walk, printed in a configurable grid, plus a plain-text reference sheet for you.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Entry rows (label + link), added manually, pasted in bulk
  (`importEntriesFromText`), imported from CSV, or seeded with names from a
  saved `np_rosters` roster
- Reorder, duplicate detection (`updateDupIndicators`, `updateDupWarning`),
  URL validation (`looksLikeUrl`)
- Print QR codes at 1–8 per page with selectable error correction
- Print a separate **reference sheet** mapping codes to labels
- Copy all links; multiple saved galleries (`gallery-walk-qr-sets`)
- **Reaction counts** with a reset — the beginnings of a feedback mechanism

## Quick Wins

- **Peer feedback slips.** The reaction counter hints at it; what a gallery
  walk actually needs is a printable feedback slip per station — two stars and
  a wish, a rubric row, a sticky-note prompt — that students fill in and leave.
- **Station numbering and a walking order**, so 28 students don't all start at
  station 1. Print a per-student route card.
- **QR code + label + a blank comment area on one card**, rather than a grid of
  bare codes — the card is the thing that gets taped next to the work.
- **Test-scan each code before printing** — `_shared/qr-scan.js` and a
  vendored `jsqr.js` already exist elsewhere on the site (P7); a broken batch
  of thirty printed codes is an expensive mistake.
- **Short-link display** under each code so a student without a camera can
  type it.
- **Undo / confirm on "Reset all reaction counts"** and on Delete gallery (P11).

## Major Features

- **Printed feedback slips as the collection mechanism.** Rather than
  collecting digitally, print a pad of feedback slips per station that
  students fill in by hand and leave behind — then give the teacher a fast
  way to tally and redistribute them. Paper is the right medium here anyway:
  it keeps the walk moving and doesn't require a device per student.
- **Works when the work isn't online.** The current model assumes each piece
  of student work has a URL. Most classroom work is on paper or on a
  Chromebook that isn't publicly shared. A mode where the QR encodes the
  *prompt and the rubric* rather than a link — or where the station card is
  just a printed card with a feedback area — would make the tool usable far
  more often.
- **Rotation timing** (P7). A gallery walk is a timed rotation; the timer and
  station-rotation logic already exist in `Classroom Timer.html` and
  `pe-tournament-stations.html`.
- **Aggregate the feedback.** Once comments come back, print a per-student
  packet of the feedback their work received — the part of a gallery walk that
  usually never happens because collating sticky notes is tedious.
- **Reuse for anything QR-and-stations shaped** — museum-style exhibits,
  science fair judging, book tasting stations. This tool,
  `qr-scavenger-hunt-builder.html`, and `escape-room-builder.html` are three
  variations on the same primitive.

## Moonshot / North Star

**A gallery walk where the feedback survives the period.** Print the station
cards and a pad of feedback slips, run the rotation on a timer, and end with a
printed packet for each student showing what their classmates actually said
about their work — which is the entire pedagogical point and almost never
happens, because collating the slips by hand is what kills it.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device feedback.** Students scan, comment on their own device, and
  the comments return to the teacher's browser. The printed feedback slips
  above serve the same purpose.

Note: this tool's existing design already assumes students scan the printed
codes to reach the linked work. That's shipped behaviour, not something being
reclassified here.

## Platform themes that matter here

- **P9 (device pairing)** — teacher-side only: a phone remote for driving the
  rotation timer while walking the room.
- **P7 (cross-tool)** — shares primitives with two other QR tools and needs
  the rotation timer.
- **P2 (shared roster)** — already reads `np_rosters` for seeding names.
- **P6 (print quality)** — station cards get taped to walls and scanned;
  size and error correction are functional choices.

## Open Questions

- Is the "student work has a URL" assumption right for this classroom? If
  most work is on paper, the tool's centre of gravity should shift to the
  card-and-feedback model.
- Should the three QR tools share one station/card/print engine?
