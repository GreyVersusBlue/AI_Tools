# Improvement Prompts — Bracket / Tournament Generator

**Tool file:** `Tools/bracket-tournament-generator.html`
**Support folder:** `Tools/bracket-tournament-generator/` — `bt-store.js`, `lib/qrcode.js`

**Current description (from README):** Build a single-elimination bracket (byes handled automatically), run it live with click-to-advance picks, save/switch between multiple brackets, and print a blank copy.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- **Single and double elimination** brackets, with byes handled automatically
  (`nextPowerOf2`, `buildDoubleElimBracket`, `buildGrandFinalMatch`)
- Click-to-advance live picks with auto-advance through byes
- Multiple saved brackets (`gvb-bracket:list` / `gvb-bracket:data:*`)
- Print the live bracket or a **blank** bracket
- Share by QR code and by `state-link.js` URL
- Reset picks; shuffle seeding

## Quick Wins

- **Load a roster** (P2). This tool doesn't read `np_rosters`, so a class
  tournament means retyping the class list — the exact tax the toolkit exists
  to remove.
- **Seeding options**: random, as-entered, or ranked — and a "protect the top
  seeds" bracket placement rather than pure order.
- **Round-robin and pool play.** Elimination brackets send half the class home
  after one round, which is pedagogically the wrong shape for a classroom
  review game or a PE unit. Round-robin, pools-into-a-bracket, and a ladder
  are the formats teachers actually want.
- **Score entry, not just a winner tap.** "21–18" makes the printed bracket a
  record rather than a diagram.
- **Undo the last advance** (P11) — a mis-tap currently propagates.
- **Bigger projector rendering** with the current match highlighted, so the
  bracket can live on the board during the activity.
- **Team names with members**, so a bracket of six four-person teams prints a
  roster alongside.

## Major Features

- **Consolation / everybody-plays formats.** A "loser's side that keeps
  playing", a Swiss format, or guaranteed-three-games pool play. This is the
  difference between a tool used once a year and a tool used every unit.
- **Match scheduling with stations and time.** Which match is on which court
  or table, in which round, at what time — which is precisely what
  `pe-tournament-stations.html` does for rotations. These two tools overlap
  heavily and should probably share an engine (P7).
- **Academic tournament mode.** Bracketed review — pairs of students compete
  on questions drawn from `review-game-board.html`'s question bank, with the
  bracket advancing on answers rather than clicks.
- **Live projected standings.** A read-only display view of the bracket
  driven from the teacher's machine, optionally on a second screen, with the
  current match called out and the scoreboard large enough to read from the
  back of the room (P9 — second display, not student devices).
- **Bracket history and repeat matchups.** Across a unit, avoid pairing the
  same two teams twice — the same "recency memory" idea that
  `lab-group-role-randomizer.html` and `group-team-generator.html` already
  implement for pairs and roles.
- **Printable score sheets** per match for students to fill in and hand back.

## Moonshot / North Star

**Any competitive classroom structure, in two minutes, printed and projected.**
Pick a format (bracket, round robin, pools, ladder, Swiss), pull the roster or
the teams, pick how long you have, and get a schedule, station assignments, a
projector board, printed score sheets, and a record at the end — for a PE
unit, a review game, a debate tournament, or a chess club, with the same
engine underneath.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device standings view.** A link or QR letting students follow the
  bracket on their own devices. Projecting it covers this.

## Platform themes that matter here

- **P2 (shared roster)** — the most obvious gap; nothing here reads
  `np_rosters` today.
- **P7 (cross-tool)** — overlaps `pe-tournament-stations.html` and Name
  Picker's Tournament mode; three implementations of one idea currently exist.
- **P3 (share links)** — already adopts `state-link.js`; the useful extension
  is sending a bracket to a colleague (a co-teacher, the PE department)
  rather than to students.
- **P6 (print quality)** — a 32-entry bracket that fits legibly on one sheet
  is a genuine layout problem.

## Open Questions

- Should Name Picker's Tournament mode and PE Stations' bracket both be
  replaced by this engine, or do they serve different enough moments to
  justify staying separate?
- What is the largest realistic bracket — a class of 30, or a whole-grade
  event of 150? The answer changes the print layout work substantially.
