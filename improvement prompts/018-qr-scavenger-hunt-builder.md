# Improvement Prompts — 018 — QR Scavenger Hunt Builder

**Tool file:** `Tools/018-qr-scavenger-hunt-builder.html`
**Support folder:** `Tools/qr-scavenger-hunt-builder/` — `test/` only. (The QR
encoder used to live here as `lib/qrcode.js`; Phase 1b of `REFACTOR_PLAN.md`
moved it to the single site-wide `_shared/vendor/qrcode/qrcode.js`.)

**Current description (from README):** Type in stations (or paste them from a spreadsheet) and print a sheet of station QR codes sized however many-per-page you need, plus a separate answer key that never shares a page with the codes.

---

## Status

Reviewed — structural read of the source. The README undersells this one
considerably — it has a full live-run mode. Ideas below are deliberately
ambitious and **not** scoped to a single session.

**2026-08-13 — Round 6 (paper no-device hunt mode).** Shipped the Major
Feature flagged at the end of Round 5: "the day the Chromebooks stayed in the
cart." Every station now gets a short, stable **code word** (from a fixed
classroom-safe word list, falling back to `STATION1`/`STATION2`/... if a hunt
somehow outgrows the list), assigned once and kept through
`ensureStationCodeWords()` — a station that already has a word keeps it, so a
reprinted card never disagrees with one already taped to a wall. A ↻ button
next to each station's code in the Build table regenerates just that one
word. Three printed pieces tie together:

- **Print Clue Cards (No Device)** — the same per-station text the QR station
  cards show (label, question/choices/numeric/photo instruction) but with no
  QR canvas, ending in the station's code word and an instruction to write it
  on the team's answer sheet.
- **Print Answer Sheets** (Live Run tab) — one blank sheet per team, in that
  team's own route order (reusing the same `teamRoute()` rotation the
  staggered-start route cards already use, so a paper run gets the same
  spread-out starts a device-based run gets), with one row per station: a
  blank for the code word found and a blank for the answer, plus a short
  per-type instruction line (circle a letter / write the number / nothing to
  write for photo proof).
- **Answer Key** — gained a Code Word column so a teacher can grade a stack
  of paper sheets against the one key they already print, without a separate
  paper-mode key.

Verified with a new 26-assertion headless Chromium suite,
`Tools/qr-scavenger-hunt-builder/test/smoke-paper-mode.mjs`, run directly with
`node` (no npm script added — see package.json boundary). It checks: every
station gets a distinct, non-empty code word, stable across a reload; clue
cards carry no `<canvas>` and print the right label/question/choices/code
word; the answer key's new column matches the clue cards word-for-word;
answer sheets are one per team with the team's check-in code, one row per
station in that team's own staggered route order (independently
re-derived, the same way `smoke-staggered-starts.mjs` does, rather than
assumed), and exactly two blank cells per row; regenerating a station's code
word changes what the next print shows; and no console/page errors anywhere
in the run. Also re-ran `smoke-staggered-starts.mjs` (29 assertions) to
confirm the route-card rotation logic this mode reuses is untouched — still
green.

**Left for next round:** the annotated floor-plan map, pulling questions from
other toolkit content, the post-hunt debrief print, and any joint planning
with `escape-room-builder`.

**2026-08-12 — Round 5 (backlog rank 10: staggered station starts).** Teams no
longer all start at station 1. Each team gets a **route card** — its own
rotation of the station list, starting at a different point — printed
two-to-a-page with its check-in code and a line telling the team its list is in
a different order from everyone else's.

The offset is `round(i × stations / teams)`, which spreads teams evenly whether
there are more teams than stations or fewer, and is **derived from the team's
position rather than stored**, so a reprinted route card is always the same
card. The rotation is a rotation: every team walks the hunt's own station
order, wrapped around from its own starting point, so every team still visits
every station exactly once. A shuffle per team would have been easier and is
wrong — it makes the printed order impossible to check at a glance and loses
whatever sequence the teacher built into the stations.

The Teams list now shows "starts at &lt;station&gt;" beside each team, and a
summary line under the toggle counts the spread — including saying plainly
when there are more teams than stations, so some share a starting point rather
than that being a silent surprise on the day. Turning the toggle off gives
every team the plain station order (still a useful route sheet), and the
choice is saved with the hunt.

Verified with a new 29-assertion headless Chromium suite,
`Tools/qr-scavenger-hunt-builder/test/smoke-staggered-starts.mjs`
(`npm run test:scavenger-hunt`), driving the printed route cards: six stations
across three teams, the rotation property checked card by card (every station
once, in hunt order, wrapped from that team's offset), the uneven cases in
both directions, the off switch, persistence across a reload, and a team added
mid-run being folded into the spread rather than tacked on the end. Two of the
suite's original assertions were wrong on first run — hand-computed offsets,
not tool bugs — and were rewritten to assert the *property* (spread within one
of even; all starts distinct) rather than a guessed sequence. No console
errors.

**Next round should pick up** the paper no-device hunt mode, which is still on
the backlog and now has most of what it needs: the route card is already the
per-team walking order a paper packet would be built around.

## What it does today

- Stations added manually or pasted from a spreadsheet; reorder, validate
- Print **station cards** at 1–9 per page with selectable error correction,
  plus a separate **answer key**
- **Live Run mode**: teams (`renderTeamsSetup`), a run timer with
  Start / Pause / Reset (`currentElapsedMs`, `formatElapsed`), **per-team
  progress** (`renderTeamProgress`) and a **leaderboard**
  (`renderLeaderboard`)
- **Staggered starts**: each team gets a route card with its own rotation of
  the station list, printed two per page, so teams don't queue at station 1
- Clear all progress; export CSV; multiple saved hunts
  (`qr-scavenger-hunt-sets`)

## Quick Wins

- **Done —** **Teams should be able to check themselves in.** Right now the live run is
  driven by the teacher; a hunt with eight teams spread across a building
  needs the teams to report progress, not one person tapping for all of them
  (P9 — or a per-team code the team shows the teacher to scan). *(Shipped as
  a 4-character team code plus a "Team Check-In" panel — see the Round 4
  update above.)*
- **Done — Staggered station order per team** (2026-08-12), so eight teams
  don't queue at station 1. Built as a *rotation* rather than the shuffle this
  line suggested — see the Round 5 note above for why.
- **Hints with a time penalty** — the standard mechanic that keeps a stuck
  team moving.
- **Done — Print a team answer sheet** the team carries and fills in, since not every
  hunt should require a device. *(Shipped 2026-08-13 as part of the paper
  no-device hunt mode — see the Round 6 note above.)*
- **Location hint per station** ("outside the library") printed on the answer
  key, so the teacher can find their own stations again.
- **Timer visible on the projector** for the return-to-class moment.
- **Undo on "Clear all progress"** (P11) — it wipes a live run.

## Major Features

- **Merge or share an engine with the escape room builder** (P7). That tool
  has branching, per-station images, answer validation and a player page
  (`lock.html`); this tool has teams, timing, and a leaderboard. Each is
  missing exactly what the other has, and they print the same station cards.
- **Done —** **Question types beyond text answers**: multiple choice, numeric with
  tolerance, "photograph this and show me", "count the X". The physical-world
  question types are what distinguish a hunt from a worksheet. *(Shipped as
  Open-ended / Multiple choice / Numeric / Photo proof — see the Round 4
  update above.)*
- **Content from the toolkit** (P7). Pull questions from
  `030-review-game-board.html`'s bank or vocabulary from the flashcard tool, so
  building Friday's hunt isn't writing twelve new questions from scratch.
- **Map of the hunt.** `046-blank-map-generator.html` can annotate a floor plan;
  a printed map with numbered station markers would make setup and cleanup far
  easier, and `035-schedule-visualizer.html` already holds a real building map.
- **Done — Outdoor/no-device mode** — printed clue cards with a code word at each
  station and a paper answer sheet, for the field trip or the day the
  Chromebooks stayed in the cart. *(Shipped 2026-08-13 — see the Round 6
  note above.)*
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

- Should this and `019-escape-room-builder.html` become one tool with a "linear
  chain" mode and a "free-roam teams" mode? They share most of their
  machinery and neither is complete alone.
- What's the device reality — one per team, one per student, or none? The
  answer changes whether self-check-in or paper answer sheets is the primary
  path.

## Round 4 update — 2026-08-10

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

### Pass 2 — Round 1 — 2026-08-10 — session `v19h3x`

Shipped the two remaining Quick Wins flagged at the end of Round 4: undo on
"Clear all progress" and hints with a time penalty. Both are additive to the
station/team data model; nothing from Round 4 was touched otherwise.

- **Undo on "Clear all progress."** The confirm() dialog already existed
  (`confirm('Clear every team’s marked progress...')`) — Round 4 or earlier
  had already added it — so this round's actual gap was the undo. Clicking
  the button now snapshots every team's `marks`/`attempts`/`hintsUsed`/
  `penaltyMs` (keyed by team **code**, not array index, so it survives a
  reorder) before wiping them, and reveals an "Undo clear" link next to the
  button for a 15-second window. Clicking it restores every team's snapshot
  exactly (a team deleted during the window is simply skipped, nothing
  throws); the window auto-collapses via `setTimeout`, and switching hunts or
  tabs (`refreshRunView`) also clears any pending undo so a stale snapshot
  can never be applied to the wrong run.
- **Hints with a time penalty.** Each station gained an optional `hint` text
  field and a `hintPenalty` (minutes) field, edited via a small 💡 toggle
  button added to the row actions (next to move/remove) that opens the same
  detail-row used by the choice/numeric editors — so a plain open-ended or
  photo-proof station can have a hint too, not just choice/numeric ones. The
  Team Check-In panel gained a "💡 Hint" button next to "Check In": type or
  scan a team's code and press it to reveal that station's hint text inline
  (no `alert()`, so it stays scriptable/testable) and, on that team's *first*
  request for that station, apply the penalty — a later re-request just
  re-shows the hint for free. The scoring model here is time-based, not
  points-based (this tool never had points — `renderLeaderboard` already
  ranked by solved-count then by earliest mark timestamp), so the penalty is
  stored as `team.penaltyMs` and added to that team's *effective* finish time:
  it now sorts ties later and lengthens their "Finished in X" clock by
  exactly the configured minutes. A new "Hints" column on the leaderboard and
  a "N hints used (−M min)" note under Team Progress make the penalty visible
  without doing math by hand. The hint text and its penalty also print on the
  answer key (so the teacher remembers what they wrote) and export to CSV.

### Data model / compatibility

Stations gained `hint` (string) and `hintPenalty` (string, parsed as
minutes), both defaulted through `ensureStationDefaults` — a hunt saved
before this round has no `hint`/`hintPenalty` keys at all, and loads with
both defaulting to `''`/`'0'`, no hint button shown (it's `disabled` whenever
the current check-in station's hint is empty), and the detail row stays
collapsed unless it's a choice/numeric type. Teams gained `hintsUsed` (an
object keyed by station index, like `attempts`) and `penaltyMs` (number),
both defaulted through `ensureRun()` alongside the existing `marks`/`code`
migrations, so a legacy team object (bare-number marks, no `code`, no
`attempts`) still upgrades cleanly and simply starts at zero hints/zero
penalty. This was exercised directly: a hand-built legacy blob (no `qType`,
no `hint`, bare-number `marks`, no team `code`) was written straight into
`localStorage` and loaded — it migrated with no console errors, the hint
button was correctly disabled (station has no hint), and the leaderboard/
progress views rendered normally.

### Tradeoffs / deliberately skipped

- The undo window is a fixed 15 seconds and in-memory only (not persisted) —
  a reload during the window loses the ability to undo, same as the general
  in-memory-toast pattern used elsewhere in the toolkit. This was a
  deliberate scope choice to keep the fix small; a "keep last N clears in
  localStorage" version would be more robust but is a bigger change than a
  Quick Win warrants.
- A hint applies its penalty once per team **per station**, not once per
  hunt — a team can request hints at multiple stations, each charged
  independently, which matches "the standard mechanic" description in the
  prompt (a stuck team pays to get unstuck at *that* station) rather than a
  single hunt-wide allowance.
- Still not implemented, left for the next round: randomized/rotated station
  order per team, a printed no-device team answer sheet, a distinct
  "location hint" printed on the answer key for the teacher's own setup/
  teardown (different from the team-facing penalty hint added this round —
  worth keeping those two concepts separate if built later), a projector-
  visible timer view, pulling questions from other toolkit tools, the
  annotated floor-plan map, the post-hunt debrief print, and any joint
  planning with `escape-room-builder`.

### Testing performed

`node --check` on both extracted `<script>` blocks (clean). Playwright
(Chromium, headless, `file://`) end-to-end: built a two-station hunt (one
open-ended station with a hint + 3-minute penalty, one multiple-choice);
confirmed the answer key shows the hint text and penalty; added two teams in
Live Run; requested the hint for team 1 via its code and the Hint button,
confirmed the inline hint text and penalty-applied note, then requested it
again and confirmed the "already used — no additional penalty" message with
no further time added; checked both teams fully through the hunt, started
the race timer, and confirmed the leaderboard's Hints column and "Finished
in X" ranking correctly reflected the 3-minute penalty (the team that used
the hint finished at 3:00 and ranked below the team that used none at 0:00,
despite both completing every station); clicked "Clear all progress",
confirmed the browser `confirm()` fired and, once accepted, that all
teams' marks/hints reset and an "Undo clear" control appeared; clicked Undo
and confirmed marks, attempts, hint usage, and the leaderboard/penalty
figures were restored exactly to their pre-clear values, and that the undo
control then hid itself; reloaded the page and confirmed all of the above
(marks, hints, penalties) persisted through localStorage; hand-built and
loaded a legacy hunt blob (no `qType`/`hint`/`hintPenalty` on the station, a
bare-number team mark, no team `code`, no `hintsUsed`/`penaltyMs`) and
confirmed it migrated cleanly with the hint button correctly disabled and no
console/page errors; took full-page screenshots of both the Build table
(hint toggle button and expanded hint/penalty editor) and Live Run view
(Hint button in Team Check-In, Hints column on the leaderboard) to confirm
layout held after widening the row-actions column for the new button.
Watched for console/page errors throughout all of the above (none seen).
