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
- Click-to-advance live picks with auto-advance through byes, **or enter both
  sides' scores and the higher one decides the match automatically**
  (structured `{ a, b }` per-match scores — shipped Round 5, see below)
- A **derived, printable standings table** (W/L/Played, plus PF/PA/Diff once
  any score has been entered) for every format — round robin, single
  elimination, and double elimination alike (Round 5)
- Multiple saved brackets (`gvb-bracket:list` / `gvb-bracket:data:*`)
- Print the live bracket or a **blank** bracket
- Share by QR code and by `state-link.js` URL
- Reset picks; shuffle seeding

## Quick Wins

- **Done —** **Load a roster** (P2). This tool doesn't read `np_rosters`, so a class
  tournament means retyping the class list — the exact tax the toolkit exists
  to remove. *(Shipped Round 4 as a "Load a saved Name Picker roster…"
  dropdown, read-only over `np_rosters`.)*
- **Done —** **Seeding options**: random, as-entered, or ranked — and a "protect the top
  seeds" bracket placement rather than pure order. *(Shipped Pass 2 — see
  Pass 2 update below.)*
- **Done — round robin only.** **Round-robin and pool play.** Elimination brackets send half the class home
  after one round, which is pedagogically the wrong shape for a classroom
  review game or a PE unit. Round-robin, pools-into-a-bracket, and a ladder
  are the formats teachers actually want. *(Shipped Round 4 as a third
  bracket type using the circle-method scheduling algorithm; pools-into-a-
  bracket and a ladder are still open — see Round 4 update below.)*
- **Done —** **Score entry, not just a winner tap.** "21–18" makes the printed bracket a
  record rather than a diagram. *(Shipped Round 5 as structured per-side
  number inputs that auto-decide the match and feed a printable standings
  table — see Round 5 update below.)*
- **Done —** **Undo the last advance** (P11) — a mis-tap currently propagates.
  *(Shipped Pass 2 as a single-level "Undo last pick" button — see Pass 2
  update below.)*
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
- A real second-display presentation mode if a teacher ever asks for the
  bracket to live on a separate projector output rather than an enlarged
  browser tab.
- The P7 engine-sharing question with `021-pe-tournament-stations.html`, now
  that this tool has its own (intentionally separate) scheduling code to
  compare against.
- (Both Quick Wins carried over from Round 4 — "Undo the last advance" and
  ranked/protected seeding — shipped in Pass 2; see below.)

## Pass 2 — Round 1 — 2026-08-10 — session `v19h3x`

Closed out the two Quick Wins left open from Round 4: **undo the last
advance** and **seeding options beyond random/as-entered**.

### What shipped

- **Undo last pick.** A single-level "Undo last pick" button in the
  toolbar, visible only once at least one winner-advance click has been
  made and not yet undone. Every winner-advance click site —
  elimination round advance (single and double-elim winners bracket),
  double-elim losers-bracket advance, the grand-final match(es), and
  round-robin match decisions — now calls `captureUndoSnapshot()` (a
  `JSON.stringify(state)`) immediately before mutating `state`, so the
  snapshot always reflects the exact state the click was about to
  overwrite, including whatever earlier byes had already auto-advanced.
  Clicking Undo parses that snapshot back into `state` and re-renders,
  restoring the loser's bracket slot, any losers-bracket drop, and any
  downstream bye cascade the undone click had triggered, in one step.
  It's deliberately single-level (not a history stack) per the ask:
  the snapshot is cleared after being used, and also on every point that
  starts a fresh bracket state — New bracket, Generate, Reset picks,
  switching brackets, deleting the current bracket, and importing a
  shared link — so Undo never reaches across those boundaries or chains
  past "the last pick."
- **Seeding modes.** The "Seed randomly" checkbox became a `Seeding`
  dropdown: **Random** (existing shuffle), **As entered** (existing,
  no shuffle), and **Ranked** (new). Ranked treats the contestants
  textarea as seed 1..N in entry order and places them using the
  standard recursive "protect the top seeds" bracket-placement algorithm
  (`standardSeedOrder` — the same seed pairing used in real single/double-
  elimination brackets: size-8 order is 1,8,4,5,2,7,3,6, i.e. 1v8/4v5/2v7/
  3v6 in round 1, seed 1 and seed 2 on opposite halves so they can't meet
  before the final). Applies to both single and double elimination (double
  elim's winners bracket is built with the same `buildBracket()` ranked
  path it already reused for random/as-entered). For round robin — which
  has no bracket-placement concept, every pair meets regardless of seed —
  ranked mode instead stores a `seeds` map (entry order = rank) purely to
  drive a new **Seed** column on the standings table; it doesn't reorder
  or reshuffle the round-robin schedule itself. Byes under ranked seeding
  land on the weakest (highest-numbered) seeds automatically, and a code
  comment in `standardSeedOrder`'s caller works through why this placement
  can never put two byes in the same match (byes are always `< size/2`,
  and the algorithm's final round always pairs a top-half seed with a
  bottom-half one).
- Both features are threaded through the existing persistence/share paths:
  `seedMode` (and, for round robin, `seeds`) round-trip through
  save/load (`bt-store.js`, unchanged — it already serializes whatever's
  on `state`) and through `importSharedBracketFromUrl()` for shared-link
  imports, and `Reset picks` preserves the original seed placement/seed
  numbers exactly the way it already preserved bye placement.

### Verification

Ran a headless Playwright script (Chromium, `/opt/pw-browsers`) against the
tool served locally:
- 8-contestant single elimination, Ranked seeding: confirmed round-0 order
  is `Seed1, Seed8, Seed4, Seed5, Seed2, Seed7, Seed3, Seed6` — seed 1 vs
  seed 8 in round 1, and seed 1 (position 0, first half) / seed 2 (position
  4, second half) on opposite halves of the bracket.
- 5-contestant single elimination, Ranked seeding: confirmed byes land on
  seeds 6/7/8 (the weakest) and never double up in one match.
- Undo: made a pick (with a bye already auto-advanced ahead of it),
  confirmed the state changed, clicked Undo, confirmed round 1 was
  restored to the exact pre-click array (bye included) and round 0 was
  untouched; also confirmed the Undo button itself hides again afterward
  (single-level). A second script made two picks in sequence and undid
  once, confirming only the second pick reverted and the first pick's
  result survived — the "single most recent click" semantics the ask
  specifically called for.
- Double elimination (4 teams, Ranked): confirmed seed 1 vs seed 4 in WB
  match 1, clicked a WB winner, confirmed the loser dropped into the
  losers bracket, then confirmed Undo restored both the winners bracket
  and losers bracket to their exact pre-click state.
- Round robin (4 teams, Ranked): confirmed the `seeds` map (1..4 from
  entry order), confirmed the standings table renders a Seed column,
  made a pick, and confirmed Undo reverted it.
- All scripts also asserted no uncaught page exceptions during the run.

### Challenges / tradeoffs

- **Undo is a full-state snapshot, not a granular action log.** Restoring
  `JSON.parse(JSON.stringify(state))` reverts *everything* that changed
  since the snapshot was taken — including, in principle, a score typed
  into an unrelated match's score box between the pick and the undo. This
  wasn't tested against (score edits don't trigger a new snapshot), but a
  teacher who types a score and then undoes a much earlier pick could see
  that score revert too. Treated as an acceptable edge case for a
  "mis-tap" affordance rather than a full history/redo system — the
  snapshot is taken immediately before each pick, so the common case (undo
  right after a wrong tap) always behaves exactly as expected.
- **Single-level by design.** There's no multi-step undo stack — clicking
  Undo twice in a row does nothing the second time (the button hides after
  one use). This matches the ask's framing ("the single most recent
  advance") but is worth flagging if a future round wants a full history.
- **Undo doesn't survive a page reload.** The snapshot lives in a
  module-level JS variable, not in `state` itself, so it isn't persisted
  to `localStorage`. Reloading the page (or switching away and back) loses
  the ability to undo the last pick made before the reload. This was a
  deliberate simplicity trade-off — persisting it would mean deciding
  whether an "undo history" belongs in the saved bracket data at all.
- **Ranked round robin only touches the standings display.** Per the
  Quick Win's own scoping note, round robin has no seeding-placement
  concept (everybody plays everybody regardless), so "ranked" there is
  cosmetic (a Seed column) rather than schedule-altering. Random and
  as-entered round robin still behave exactly as before.

### Where the next round should pick up

- Scheduling for double elimination (Round 4 carryover, still open).
- Pools-into-a-bracket and/or Swiss (Major Features, still open).
- A real second-display presentation mode (Round 4 carryover, still open).
- The P7 engine-sharing question with `021-pe-tournament-stations.html`
  (Round 4 carryover, still open).
- If a full undo history (not just single-level) or undo-across-reload
  ever becomes a real ask, the snapshot mechanism here (`captureUndoSnapshot`
  / `undoSnapshot`) is the obvious place to extend into a stack rather than
  a single slot — see the Challenges note above.
- **Done — see Round 5 below.** ~~Score entry into standings/records (Quick Wins) is still open — scores
  are free text today and don't feed round-robin standings or elimination
  results.~~
- Team names with members (Quick Wins) is still open.

## Round 5 — 2026-08-13

Closed out the last open Quick Win from Round 4/Pass 2: **score entry that
feeds standings** (the backlog row "Scores that feed standings," claimed
2026-08-13).

### Scope judgment call

The backlog row's premise names "round-robin W/L, point differential." At
the time of claiming, round robin was not this tool's only match format —
Round 4 had already shipped single elimination, double elimination, *and*
round robin (see "What it does today"). Per the assignment's own scoping
note, this round did not restrict the feature to round robin: the same
structured-score → derived-standings idea was generalized to single and
double elimination too, since "the printed bracket becomes a real record"
applies just as much to an elimination bracket as to a round-robin sheet,
and doing all three in one pass avoided leaving two of the tool's three
formats with the old free-text field while round robin alone got the new
one. No new match-format work (pools, Swiss, ladder) was in scope here —
those remain open under Major Features, unchanged.

### What shipped

- **Structured per-match scores.** Every score field (`.match-score`) that
  used to be one free-text `<input type="text">` is now a pair of
  `<input type="number">` boxes — `buildScoreInputs()` — one per side,
  stored as `state.scores[key] = { a, b }` under the exact same key scheme
  the old free-text version used (`r_m` for single elim, `w r_m` / `l r_m`
  / `g0` / `g1` for double elim, `rr r_m` for round robin), so nothing about
  how a match's score is *addressed* changed, only its *shape*.
- **Scores decide matches automatically.** When both sides have a number
  and they differ, the higher score is applied exactly like a winner-tap —
  same `captureUndoSnapshot()` call, same `winnerSide`/`loserWinnerSide`/
  `grandFinal` mutations the click handlers already made, same
  `state.rounds[r][m].winner` assignment for round robin. Each call site
  re-checks the match isn't already decided before acting (defends against
  a stale closure firing after a click meanwhile decided it some other
  way), and a tied score never auto-decides — this tool still has no draw
  support (a known limitation from Round 4), so a tie just sits there until
  a click or a differing score breaks it.
- **A derived, printable standings table for every format.** Round robin's
  existing `computeStandings()` gained `pf`/`pa`/`diff` fields (summed from
  each round's `state.scores['rr'+r+'_'+m]`) and a diff-based tiebreaker
  after wins. A parallel `computeEliminationStandings()` (backed by
  `eliminationMatches()`, which walks the winners bracket and, for double
  elimination, the losers bracket and grand final too) produces the same
  shape of record for single and double elimination — every entrant starts
  0-0, a bye-advance never counts as a played match (matching
  `autoAdvance()`'s own "nobody really played that" framing), and the
  champion's row is highlighted by name (`eliminationChampionName()`) rather
  than by "most wins," since an elimination bracket's win leader and its
  actual champion aren't always the same team (e.g. two finalists can tie
  on win count). A shared `renderStandingsTable()` renders both flavors;
  the PF/PA/Diff columns only appear once `standingsHasScores()` finds at
  least one entered score anywhere in the bracket, so a bracket nobody has
  scored yet still shows the plain W/L/Played table it always did. The
  elimination table sits under a new "Standings" heading below the bracket
  (single) and below the Grand Final (double), inside `#bracketView`, so it
  prints and shares exactly like everything else already there — no new
  print CSS was needed.
- **Legacy free-text scores migrate on load.** `migrateScores()` runs from
  `loadBracketByName()` and `importSharedBracketFromUrl()` and best-effort
  parses any leftover `"21-18"`-shaped string into `{ a: 21, b: 18 }`;
  anything unparseable is dropped rather than silently displayed as a fake
  record. Migration is deliberately *passive* — it normalizes the stored
  value but does not retroactively re-decide a match nobody has touched
  since the old free-text version, so a teacher's already-completed
  bracket doesn't have results flip out from under them on first open after
  this update. Touching the score again (typing, or even re-confirming the
  same numbers) decides it going forward, same as any fresh entry.
- **CSS**: `.match-score` became a flex-row pair (`.match-score-pair`) with
  an en-dash separator; number-input spin buttons are hidden
  (`-webkit-appearance: none` / `-moz-appearance: textfield`) since the
  field is narrow. No print-CSS changes were needed — the existing
  `.match-score { border: none; background: transparent; ... }` print rule
  already targets the class name, which both new inputs still carry.

### Verification

No `test/` folder existed for this tool before this round; added
`Tools/bracket-tournament-generator/test/smoke-standings.mjs` (not wired
into root `package.json` — that file was out of bounds for this
assignment; run it directly with
`node Tools/bracket-tournament-generator/test/smoke-standings.mjs`, same
as any other suite once Playwright is installed per the repo's normal
`npm ci && npx playwright install chromium` setup). It covers, headless:
- **Round robin** (4 entrants, as-entered): enters 6 match scores, confirms
  the correct side is auto-marked `.slot-winner` in each, confirms the
  standings table gains `PF/PA/Diff` columns once scores exist, confirms
  the exact ranked order and W/L/PF/PA/Diff numbers for the leader and the
  last-place team, confirms the champion banner names the standings
  leader, and confirms the standings table (and thus the score data behind
  it) survives a blank-print/live-restore cycle unchanged.
- **Single elimination** (4 entrants, as-entered): enters scores for both
  round-0 matches, confirms both winners auto-advance into a real (no
  longer TBD) final matchup, decides the final by score, confirms the
  champion banner and the exact derived W/L/Played/PF/PA/Diff record for
  all four entrants including the two first-round losers (who get a loss
  but no bye credit).
- **Legacy migration**: seeds `localStorage` with an old-shape
  `{ scores: { '0_0': '21-9' } }` bracket, reloads the page, confirms the
  text migrated into the two structured inputs, confirms the match is
  *not* auto-decided by the migration alone, then confirms a fresh
  `change` event on the now-structured field does decide it.
- All three sub-suites assert zero console/page errors and zero requests
  leaving the site.

Beyond the automated suite, an ad hoc headless run (not kept as a
committed script) exercised the full double-elimination path this suite
doesn't cover — winners bracket round 0 and final, a losers-bracket
round A and round B (interleaving a dropped WB loser), a **grand-final
bracket reset** (LB side wins game 1, forcing a second game), and the
final championship game — confirming the champion banner, every
intermediate matchup, and the derived standings table (including a team
with a losers-bracket win folded into its record) were all correct with
zero console errors throughout.

### Challenges / tradeoffs

- **Editing a score after a match is already decided updates the record
  but never re-flips the result.** `decideFn` bails out if the match (or
  grand-final game) is already decided by the time it fires — correcting a
  typo in an already-decided match's score updates PF/PA/Diff in standings
  but does not undo/redo the winner, even if the corrected score would
  reverse it. Re-deciding after the fact would mean unwinding whatever
  auto-advance/bye-cascade/losers-bracket-drop had already happened
  downstream, which is exactly the complexity Pass 2's single-level undo
  already chose not to solve generally. A teacher who mis-types a score
  before a bracket has cascaded further should use "Undo last pick" (which
  works identically whether the pick was made by a click or by a score,
  since both call `captureUndoSnapshot()`) rather than editing the score
  box after the fact.
- **No draw/tie support**, carried over unchanged from Round 4: a tied
  score never auto-decides a match in any format. Sports with legitimate
  draws still aren't well served.
- **Elimination standings are a new interpretation, not something the
  backlog literally asked for.** The ask named round robin specifically;
  extending the same idea to single/double elimination was a judgment call
  (see "Scope judgment call" above) made because the tool's actual format
  lineup had already grown past round-robin-only by the time this was
  picked up, and restricting the standings idea to one of three formats
  would have felt arbitrary and inconsistent in the UI.
- **`match-score-pair` widths get tight at very small print sizes** on a
  32-entry-class single-elimination bracket (the same P6 print-quality gap
  already tracked under Platform Themes) — not something this round
  attempted to fix.

### Where the next round should pick up

- Scheduling for double elimination (Round 4 carryover, still open).
- Pools-into-a-bracket and/or Swiss (Major Features, still open).
- A real second-display presentation mode (Round 4 carryover, still open).
- The P7 engine-sharing question with `021-pe-tournament-stations.html`
  (Round 4 carryover, still open).
- If a full undo history (not just single-level) or undo-across-reload
  ever becomes a real ask, the snapshot mechanism here (`captureUndoSnapshot`
  / `undoSnapshot`) is the obvious place to extend into a stack rather than
  a single slot.
- Draw/tie support for round robin and any future everybody-plays format
  (carried over, still open).
- Re-deciding an already-decided match from a corrected score (see
  Challenges above) — currently requires Undo instead.
- Team names with members (Quick Wins) is still open.
