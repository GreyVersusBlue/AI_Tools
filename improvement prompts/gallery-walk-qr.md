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

- **Done —** **Printed feedback slips as the collection mechanism.** Rather than
  collecting digitally, print a pad of feedback slips per station that
  students fill in by hand and leave behind — then give the teacher a fast
  way to tally and redistribute them. Paper is the right medium here anyway:
  it keeps the walk moving and doesn't require a device per student. *(Shipped
  Round 4 as a "Peer feedback slips" card — style, custom prompt, slips-per-
  station, slips-per-page.)*
- **Done —** **Works when the work isn't online.** The current model assumes each piece
  of student work has a URL. Most classroom work is on paper or on a
  Chromebook that isn't publicly shared. A mode where the QR encodes the
  *prompt and the rubric* rather than a link — or where the station card is
  just a printed card with a feedback area — would make the tool usable far
  more often. *(Shipped Round 4 — any entry row can expand to a multi-line
  prompt/rubric instead of a link, printed directly on the card.)*
- **Done —** **Rotation timing** (P7). A gallery walk is a timed rotation; the timer and
  station-rotation logic already exist in `Classroom Timer.html` and
  `pe-tournament-stations.html`. *(Shipped Round 4 as a "Run the gallery
  walk" card — Start/Pause/Resume/Rotate now/Reset, one shared class-wide
  clock.)*
- **Partially done —** **Aggregate the feedback.** Once comments come back, print a per-student
  packet of the feedback their work received — the part of a gallery walk that
  usually never happens because collating sticky notes is tedious. *(Shipped
  Round 4 as manual transcription into a "Collected feedback" card, then
  "Print Feedback Packets" — saves the collating step, not the data-entry
  step; true OCR/scanning is still open.)*
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

## Round 4 update — 2026-08-10

Implemented four of the Major Features in one pass, all in `gallery-walk-qr.html`
(no changes to `gallery-walk-qr/lib/`):

- **Printed feedback slips as the collection mechanism.** New "Peer feedback
  slips" card: pick a style (two stars and a wish / simple 1–4 rubric /
  open-ended prompt), an optional custom prompt, slips-per-station (a real
  "pad," default 6), and slips-per-page (2/4/6, own print grid
  `.print-slip-grid` mirroring the existing QR-grid page-break convention).
  Slips are keyed off station name only — no link or QR needed — so a station
  for physical/on-display work still gets a slip.
- **Works when the work isn't online.** Any entry row can be expanded ("Use
  multi-line prompt / rubric text instead") to a textarea for a full prompt
  or rubric instead of a one-line link. The data model didn't need a new
  field — this is just an editing affordance for the same `value`/QR content
  the tool already encodes literally when it doesn't look like a URL. What's
  new: the printed QR card itself now shows that instructions/rubric text
  directly on the card (`.p-instructions`) whenever the content isn't an
  actual link, so the wall card carries the rubric even for a student who
  never scans it. Detecting "is this actually a link" needed its own check
  (`contentIsLink`) — the existing scheme-detection regex used for
  auto-adding `https://` also matches plain prose that happens to start with
  a word and a colon (e.g. "Rubric:", "Directions:"), so `contentIsLink`
  additionally requires the content contain no whitespace before treating it
  as a link. This mattered in testing: a rubric literally starting with
  "Rubric:\n..." was originally mis-detected as a link and the instructions
  block silently didn't render.
- **Rotation timing.** New "Run the gallery walk" card: minutes+seconds per
  rotation, total rotation count, sound toggle, Start/Pause/Resume/Rotate
  now/Reset. Uses the same `endAt`/`remainingMs` + `Date.now()` pattern as
  `pe-tournament-stations.html` (drift-resistant, survives a tab switch) and
  the same WebAudio two-tone alarm (no audio assets, no CDN). Deliberately
  kept simple relative to the PE tool: one shared class-wide round counter
  and clock, no per-group station assignment/mapping — a gallery walk moves
  everyone at once, so that mapping machinery didn't carry over. Also
  deliberately skipped: a fullscreen/big-display mode (mentioned in P9-style
  asks for other tools) — the clock is just large-font instead. That's the
  clearest next step if a teacher wants this projected across a room.
- **Aggregate the feedback (partial).** New "Collected feedback (optional)"
  card: after the walk, expand any station and paste/type back what the
  slips said (one comment per line), then "Print Feedback Packets" generates
  one page per station with notes — a bulleted list of what came back — one
  page break per page for handing to students. This is a light version of
  the moonshot: it's manual transcription, not OCR/scanning of the paper
  slips, so it only saves the *collating* step, not the data-entry step.
  That's the honest scope for a single round — turning a photo of a stack of
  slips into structured feedback is a much bigger feature (OCR, handwriting
  recognition) and wasn't attempted here.

### Also fixed in passing

`newSet()` called `refreshSwitcher()` before `save()`, so the saved-gallery
dropdown briefly omitted a just-created gallery until some other action
resynced it (pre-existing, not introduced this round — found while writing
the Playwright test for gallery switching). Reordered so `save()` runs
first.

### Deliberately left for a future round

- **Station numbering and a walking order / per-student route cards** (Quick
  Win) — a natural pairing with the new rotation timer (assign each
  student/group a starting station and rotation offset) but not attempted
  here to keep this round's scope to the Major Features.
- **Test-scan each code before printing** (Quick Win, P7) — `_shared/qr-scan.js`
  and `jsqr.js` exist elsewhere on the site; wiring a scan-to-verify step
  into this tool is still open.
- **Fullscreen/projector mode for the timer** — see above.
- **Reuse the station/card/print engine across the three QR tools** (P7,
  Open Question) — not attempted; this round intentionally kept everything
  local to this one file rather than starting a shared engine that could
  touch `qr-scavenger-hunt-builder.html` / `escape-room-builder.html`, which
  are out of this round's file scope.
- **True feedback-slip scanning/OCR** — see "partial" note above; the
  packet-printing half of the moonshot works, the paper-to-text half
  doesn't.

### Testing performed

- `node --check` on the extracted inline script — passes.
- Playwright (Chromium, headless) sanity pass exercising: page load with no
  console errors; adding an entry, expanding it to multi-line rubric text,
  and confirming the textarea renders; live preview rendering for both a
  link entry and a rubric-text entry; enabling feedback slips and confirming
  the printed slip count matches stations × copies; printing QR codes and
  confirming the instructions block appears only on the non-link entry;
  running the rotation timer through a full start → auto-advance → complete
  cycle; pause/resume/rotate-now/reset; adding collected-feedback notes and
  printing a packet with the expected comment list; loading a pre-round
  ("legacy shape") saved gallery from `localStorage` to confirm the
  migration defaults apply without errors; creating a second gallery and
  switching between saved galleries without errors or stale UI state; and
  duplicate-link detection still working with an expanded row. A real
  naming collision (a new `renderTimer` function silently shadowed the
  existing `renderTimer` debounce-timer variable used by `scheduleRender`,
  permanently breaking it after the first assignment) was caught by this
  pass and fixed by renaming the new function to `renderTimerUI`. No
  automated check was run against a real print dialog/paper output — print
  CSS was reviewed by hand against the existing print stylesheet
  conventions.
