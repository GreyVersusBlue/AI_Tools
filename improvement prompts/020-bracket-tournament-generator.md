# Improvement Prompts — 020 — Bracket / Tournament Generator

**Tool file:** `Tools/020-bracket-tournament-generator.html`
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

- **Done —** **Load a roster** (P2). This tool doesn't read `np_rosters`, so a class
  tournament means retyping the class list — the exact tax the toolkit exists
  to remove. *(Shipped Round 4 as a "Load a saved Name Picker roster…"
  dropdown, read-only over `np_rosters`.)*
- **Seeding options**: random, as-entered, or ranked — and a "protect the top
  seeds" bracket placement rather than pure order.
- **Done — round robin only.** **Round-robin and pool play.** Elimination brackets send half the class home
  after one round, which is pedagogically the wrong shape for a classroom
  review game or a PE unit. Round-robin, pools-into-a-bracket, and a ladder
  are the formats teachers actually want. *(Shipped Round 4 as a third
  bracket type using the circle-method scheduling algorithm; pools-into-a-
  bracket and a ladder are still open — see Round 4 update below.)*
- **Score entry, not just a winner tap.** "21–18" makes the printed bracket a
  record rather than a diagram.
- **Undo the last advance** (P11) — a mis-tap currently propagates.
- **Done —** **Bigger projector rendering** with the current match highlighted, so the
  bracket can live on the board during the activity. *(Shipped Round 4 as
  "Presentation mode" — a same-screen enlarge with a "Now Playing" banner,
  not a second-display broadcast; see Round 4 update below.)*
- **Team names with members**, so a bracket of six four-person teams prints a
  roster alongside.

## Major Features

- **Consolation / everybody-plays formats.** A "loser's side that keeps
  playing", a Swiss format, or guaranteed-three-games pool play. This is the
  difference between a tool used once a year and a tool used every unit.
- **Done — single elimination and round robin only.** **Match scheduling with stations and time.** Which match is on which court
  or table, in which round, at what time — which is precisely what
  `021-pe-tournament-stations.html` does for rotations. These two tools overlap
  heavily and should probably share an engine (P7). *(Shipped Round 4 for
  single elimination and round robin; deliberately not built for double
  elimination — see Round 4 update below.)*
- **Academic tournament mode.** Bracketed review — pairs of students compete
  on questions drawn from `030-review-game-board.html`'s question bank, with the
  bracket advancing on answers rather than clicks.
- **Live projected standings.** A read-only display view of the bracket
  driven from the teacher's machine, optionally on a second screen, with the
  current match called out and the scoreboard large enough to read from the
  back of the room (P9 — second display, not student devices).
- **Bracket history and repeat matchups.** Across a unit, avoid pairing the
  same two teams twice — the same "recency memory" idea that
  `022-lab-group-role-randomizer.html` and `002-group-team-generator.html` already
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
- **P7 (cross-tool)** — overlaps `021-pe-tournament-stations.html` and Name
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

## Round 4 update — 2026-08-10

Implemented four of the items above in one pass: **Load a roster** (Quick
Wins), **round robin / everybody-plays** and **match scheduling with
stations and time** (Major Features), and **live/projector presentation
mode** (Major Features — the "second display" reading of P9, not a
student-device view, per the Deferred section).

### What shipped

- **Roster loading (P2).** A "Load a saved Name Picker roster…" dropdown +
  Load button above the contestants textarea, reading `np_rosters`
  read-only, same pattern `002-group-team-generator.html` already uses. This
  closes the most obvious platform-theme gap called out above.
- **Round robin format.** A third `#bracketType` option. Uses the standard
  circle-method scheduling algorithm (`buildRoundRobin`) — n-1 rounds of n/2
  matches each, every pair meeting exactly once, an odd headcount padded
  with one bye seat per round ("Sitting out"). Renders as round columns
  reusing the existing `.round`/`.match`/`.slot` markup and click-to-advance
  convention (so no new CSS was needed for the matches themselves), plus a
  standings table (W/L/Played, sorted, ties highlighted) computed fresh from
  match results on every render (`computeStandings`). A champion banner
  fires once every match is decided, naming co-champions on a tie. Reset
  Picks, Delete, QR/share-link, and print-blank all got round-robin branches
  alongside the existing single/double-elim ones.
- **Match scheduling.** A "Schedule" toolbar button (hidden for double
  elimination — see Skipped below) opens a small modal: number of
  stations/courts, start time, minutes per match. Applies to single
  elimination and round robin. The key design point: a round's *match count*
  is knowable even when its actual contestants aren't decided yet (round 2
  of an 8-team bracket always has exactly 2 matches), so scheduling assigns
  station+time by round/match-index (`matchesPerRoundFor`,
  `buildScheduleSlots`) rather than by name, and the match card just looks
  up its own slot. Each scheduled match gets a small "Station 2 • 9:20 AM"
  badge; a full sortable "Match Schedule" table (time, station, round,
  matchup — "TBD" for undecided elimination rounds) renders below the
  bracket and is included in print, including the blank/prediction print
  view (station/time doesn't depend on results, so it stays even when
  matchups don't).
- **Presentation mode.** A "Present" toolbar button enlarges the live view
  (bigger slots, round labels, standings/schedule tables) and adds a
  sticky "Now Playing — Round 2: A vs B" banner computed by walking the
  bracket for the earliest undecided real match (`findCurrentMatch`,
  branches for single/double/round-robin). An "Exit presentation" button
  (fixed top-right) and Escape both drop back to the normal view. This is a
  same-screen enlarge, not a second-display broadcast — see Skipped.
- **Bug fix found along the way:** `#bracketView` itself carried the
  `.bracket` class (a `display:flex` row) *and* `renderDouble()`/
  `renderBlankDouble()` appended heading+box pairs directly into it — so
  Winners Bracket / Losers Bracket / Grand Final were laid out as one long
  horizontal row of headings and boxes instead of the three stacked
  sections the surrounding code comments describe. Fixed by dropping the
  `.bracket` class from `#bracketView` (now a plain block container) and
  giving `renderSingle`/`renderBlankSingle` their own inner `.bracket` box
  div, matching the pattern the double-elim renderer already used for its
  three sections. Confirmed with a Playwright screenshot before/after.

### Challenges / tradeoffs

- **Double elimination was deliberately excluded from scheduling.** Its
  winners/losers rounds interleave (a losers-round's real match count
  depends on how many byes cascade into it from the winners bracket that
  round), which makes the clean "match count is knowable up front" property
  scheduling depends on much messier to get right. Rather than ship a
  half-correct schedule for the format most likely to be run as a serious
  tournament, the Schedule button is hidden entirely when
  `state.type === 'double'`. This is the clearest place for a future round
  to pick up if stations/times for double elim turn out to matter.
- **Presentation mode is same-screen only.** It enlarges the existing tab
  rather than broadcasting to a second display/window — a true second-screen
  projector view (BroadcastChannel or a `?present=1` window) would need
  more infrastructure and was out of scope for this round. Still matches
  the "read from the back of the room" ask because there was no live sync
  requirement in the prompt beyond that.
- **Round robin has no draw/tie support.** A match is decided by clicking a
  winner, same as elimination; the optional free-text score field exists
  for the record but doesn't feed standings. Sports/games with legitimate
  draws (soccer, some card games) aren't well served by this yet.
- **No pool-play-into-bracket hybrid.** Round robin here is a flat
  everybody-plays-everybody format, not pools feeding into an elimination
  bracket. That combination (the "pools" idea in Quick Wins) is a
  reasonable next step once plain round robin has seen real use.
- **`021-pe-tournament-stations.html` overlap (P7) — left alone as instructed.**
  That tool is being worked on in parallel this round. The station/time
  scheduling added here is a distinct, simpler engine (round/match-index →
  station/time, no rotation/circuit concept) and duplicates rather than
  reuses whatever `021-pe-tournament-stations.html` has. Worth a deliberate
  unification pass once both tools have settled, per the existing Open
  Questions above — this round did not attempt it.

### Where the next round should pick up

- Scheduling for double elimination, once there's a concrete need for it.
- Pools-into-a-bracket and/or Swiss, the other two "everybody plays more
  than one round" formats from Major Features.
- "Undo the last advance" (Quick Wins) — still unaddressed, and now applies
  to three formats instead of two.
- Seeding options beyond random/as-entered (ranked seeding, "protect the
  top seeds" placement).
- A real second-display presentation mode if a teacher ever asks for the
  bracket to live on a separate projector output rather than an enlarged
  browser tab.
- The P7 engine-sharing question with `021-pe-tournament-stations.html`, now
  that this tool has its own (intentionally separate) scheduling code to
  compare against.
