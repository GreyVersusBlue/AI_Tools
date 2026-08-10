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
