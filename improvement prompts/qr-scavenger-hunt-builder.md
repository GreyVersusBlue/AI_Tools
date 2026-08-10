# Improvement Prompts — QR Scavenger Hunt Builder

**Tool file:** `Tools/qr-scavenger-hunt-builder.html`
**Support folder:** `Tools/qr-scavenger-hunt-builder/` — `lib/qrcode.js`

**Current description (from README):** Type in stations (or paste them from a spreadsheet) and print a sheet of station QR codes sized however many-per-page you need, plus a separate answer key that never shares a page with the codes.

---

## Status

Reviewed — structural read of the source. The README undersells this one
considerably — it has a full live-run mode. Ideas below are deliberately
ambitious and **not** scoped to a single session.

## What it does today

- Stations added manually or pasted from a spreadsheet; reorder, validate
- Print **station cards** at 1–9 per page with selectable error correction,
  plus a separate **answer key**
- **Live Run mode**: teams (`renderTeamsSetup`), a run timer with
  Start / Pause / Reset (`currentElapsedMs`, `formatElapsed`), **per-team
  progress** (`renderTeamProgress`) and a **leaderboard**
  (`renderLeaderboard`)
- Clear all progress; export CSV; multiple saved hunts
  (`qr-scavenger-hunt-sets`)

## Quick Wins

- **Teams should be able to check themselves in.** Right now the live run is
  driven by the teacher; a hunt with eight teams spread across a building
  needs the teams to report progress, not one person tapping for all of them
  (P9 — or a per-team code the team shows the teacher to scan).
- **Randomized station order per team**, so eight teams don't queue at station
  1. The tool has the data; the shuffle is small and the impact is large.
- **Hints with a time penalty** — the standard mechanic that keeps a stuck
  team moving.
- **Print a team answer sheet** the team carries and fills in, since not every
  hunt should require a device.
- **Location hint per station** ("outside the library") printed on the answer
  key, so the teacher can find their own stations again.
- **Timer visible on the projector** for the return-to-class moment.
- **Undo on "Clear all progress"** (P11) — it wipes a live run.

## Major Features

- **Merge or share an engine with the escape room builder** (P7). That tool
  has branching, per-station images, answer validation and a player page
  (`lock.html`); this tool has teams, timing, and a leaderboard. Each is
  missing exactly what the other has, and they print the same station cards.
- **Question types beyond text answers**: multiple choice, numeric with
  tolerance, "photograph this and show me", "count the X". The physical-world
  question types are what distinguish a hunt from a worksheet.
- **Content from the toolkit** (P7). Pull questions from
  `review-game-board.html`'s bank or vocabulary from the flashcard tool, so
  building Friday's hunt isn't writing twelve new questions from scratch.
- **Map of the hunt.** `blank-map-generator.html` can annotate a floor plan;
  a printed map with numbered station markers would make setup and cleanup far
  easier, and `schedule-visualizer.html` already holds a real building map.
- **Outdoor/no-device mode** — printed clue cards with a code word at each
  station and a paper answer sheet, for the field trip or the day the
  Chromebooks stayed in the cart.
- **Post-hunt debrief.** Print each team's answers with the key beside them,
  which is where the learning actually happens and currently doesn't exist.

## Moonshot / North Star

**A hunt you can build in a planning period and run without touching a
laptop.** Questions pulled from content you already have, station cards
printed with a map of where they go, each team starting at a different
station, teams checking themselves in from their own device or by showing you
a code, a live leaderboard on the projector, hints for the stuck, and a
printed debrief for every team at the end.

## Platform themes that matter here

- **P7 (cross-tool)** — the escape room overlap is the biggest single
  opportunity; question banks and building maps are close behind.
- **P9 (device pairing)** — team self-check-in is what makes a live run scale
  past one teacher's thumbs.
- **P6 (print quality)** — station cards get taped up and scanned; sizing and
  error correction are functional decisions.
- **P3 (state in the URL)** — payload budget for the codes.

## Open Questions

- Should this and `escape-room-builder.html` become one tool with a "linear
  chain" mode and a "free-roam teams" mode? They share most of their
  machinery and neither is complete alone.
- What's the device reality — one per team, one per student, or none? The
  answer changes whether self-check-in or paper answer sheets is the primary
  path.

## Round 3 update — 2026-08-10

Implemented three of the Major Features in one pass, all self-contained to
this tool (escape-room-builder untouched, no shared library, no CDN
additions):

- **Question types beyond text.** Each station now has a Type: Open-ended
  (the original behavior, unchanged), Multiple choice (2–6 editable options,
  one marked correct), Numeric answer (a target number plus a ± tolerance,
  covers both "numeric" and "count the X"), or Photo proof (a reminder type —
  see tradeoffs below). The Build table gained a Type column; picking
  Multiple choice or Numeric opens an inline editor row under that station.
  The type flows through to the live preview badge, the printed station card
  (choices are printed on the card itself so the team can read the question
  off the wall), the answer key (a new "Answer / Type" column spells out the
  correct choice or numeric target/tolerance), and CSV export.
- **Team self-check-in by code**, addressing P9. Each team gets an
  auto-generated 4-character code (ambiguous characters like 0/O/1/I excluded)
  shown next to its name with a regenerate button, and a new "Print Team
  Cards" button prints one card per team with a QR encoding that code. Live
  Run gained a "Team Check-In" panel: pick the current station once, then
  type or scan a team's code and press Enter (or tap Check In). Open-ended
  and Photo-proof stations mark the team in immediately; Multiple-choice and
  Numeric stations open a small inline panel to capture and validate the
  team's answer (wrong answers increment an attempt counter and let them
  retry, right answers mark it solved) before recording anything. This is
  the same text-input-plus-Enter shape a USB HID QR/barcode "keyboard wedge"
  scanner produces, so a school that owns one can scan team badges instead of
  typing, with no camera code or new vendored library needed.
- **Richer live-run feedback.** Team Progress now shows each team's next
  unsolved station by name ("Next up: Station 4 — Mascot Statue") or "All
  stations complete!", and a station button turns amber (not just grey/green)
  once a team has an incorrect attempt recorded on it, without yet being
  solved. The Leaderboard now ranks by *correct* stations (not just
  "reached") and gained a "Heading to" column showing each team's next
  target, so a glance at the projector says where every team should be.

### Data model / compatibility

Stations gained `qType`, `choices`, `correctChoice`, `numericAnswer`,
`tolerance` (all defaulted through `ensureStationDefaults`, so hunts saved
before this round load with every station as plain Open-ended). Team marks
changed shape from a bare timestamp number to `{at, correct, attempts}`;
`ensureRun()` upgrades old numeric marks in place on load, and teams saved
before this round get a code generated the first time the hunt is opened
after this update. Both migrations were exercised directly (a hand-built
legacy blob in localStorage, loaded and checked) rather than assumed.

### Tradeoffs / deliberately skipped

- **No cross-device sync.** This is a static, backend-free, localStorage-only
  tool, so a team's own phone cannot push progress to the teacher's laptop
  live — there is no server to relay it through. "Self-check-in" here means
  the *workflow* is check-yourself-in-by-code rather than
  teacher-hunts-you-down-in-a-grid, run from one shared device (the teacher's,
  or a helper's at a manned station), not that eight separate phones stay in
  sync with the projector. That's the honest ceiling without adding a backend,
  which is out of scope for this toolkit.
- **Photo proof is a label, not a capture.** It changes the printed
  instruction and the check-in copy ("don't forget to check their photo!")
  but doesn't take, upload, or store a picture — avoided deliberately to keep
  localStorage light and to not need camera-permission handling that a
  headless sandbox can't meaningfully verify anyway. A future round could
  attach an optional `<input type="file" accept="image/*" capture>` photo to
  a mark for the post-hunt debrief, sized down before storing.
- **Not implemented this round, left for next**: randomized/rotated station
  order per team, a hint system with a time penalty, a printed no-device team
  answer sheet, undo on "Clear all progress", pulling questions from other
  toolkit tools, the annotated floor-plan map, and the post-hunt debrief
  print. The new `qType`/answer data model gives the debrief print and the
  no-device answer sheet a real foundation now (the actual question text and
  choices are structured data, not just a QR payload), so those are the
  natural next pickups. Any merge with `escape-room-builder` should be
  planned jointly — this round only widened the gap between the two tools'
  station data shapes.

### Testing performed

`node --check` on both extracted `<script>` blocks (clean). Playwright
(Chromium, headless, `file://`) end-to-end: built a hunt with one station of
each type; confirmed the preview, printed station cards (choices/tolerance/
photo instructions appear), answer key, and CSV export all reflect type and
answer data correctly; ran the check-in flow through text, multiple-choice
(wrong then right), and numeric (out-of-tolerance then in-tolerance) stations
via both Enter-to-submit and the Check In button, plus an unknown-code
rejection; checked the leaderboard and per-team progress text after all of
the above; printed team check-in cards and confirmed the QR/code appear;
confirmed the manual station-button grid still works alongside check-in;
confirmed a hand-built legacy save (numeric marks, no team codes) migrates
cleanly on load; confirmed choice-editor min (2) and max (6) bounds and that
removing the correct choice re-indexes correctly; confirmed state survives a
full page reload; watched for console/page errors throughout (none seen).
No manual code-review fallback was needed — Playwright with the pre-installed
Chromium worked directly.
