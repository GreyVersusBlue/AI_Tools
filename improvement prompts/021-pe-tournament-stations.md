# Improvement Prompts — 021 — Tournament Bracket & Station Rotation (PE)

**Tool file:** `Tools/021-pe-tournament-stations.html`
**Support folder:** none — single file

**Current description (from README):** A station rotation timer with named stations and groups, plus a tournament bracket for PE units.

---

## Status

Reviewed — structural read of the source, before Round 4 (PR #55, see below)
shipped the station template library, fitness/score capture, gym-legible
fullscreen, and a same-device remote control. Ideas below are deliberately
ambitious and are **not** scoped to a single session; items confirmed shipped
are tagged **Done** below.

## What it does today

- Named **stations** and **groups**, with "randomly split into groups"
- **Rotation engine** — a timed rotation with Start / Pause / Resume / Reset /
  Rotate now, an audible alarm (`playRotationAlarm`, `playTone`), and a
  computed assignment schedule (`computeAssignment`)
- **Fullscreen stage** for the gym display (`toggleFullscreen`)
- **Bracket** generation from the groups or a typed list, with click-to-advance
  and auto-advance
- Prints: **station cards**, the rotation schedule, the bracket
- Saved units (`pe-tournament-stations`)

## Quick Wins

- **Done — Round 4.** **The display has to be readable from across a gym.** This is the most
  extreme legibility requirement on the site — bigger than any classroom
  projector. Current station / timer / group text should be sized for 60 feet,
  not 20. *(Fullscreen timer scales up to ~15rem; a "high-contrast gym
  display" toggle switches to black/yellow-white.)*
- **Done — Round 4.** **Audible signals that carry.** A single tone will not be heard over a gym.
  Longer, louder, repeated signals, plus a visual full-screen colour flash, and
  a warning signal 30 seconds before rotation. *(Alarm is now three louder
  repeated chimes, a distinct 30-second warning tone was added, plus a
  full-stage flash on rotation.)*
- **Done — Round 4.** **Show the next station**, not just the current one, so groups can move
  without being told where. *(Each station tile shows a "Next" line via
  `computeAssignment(count + 1)`.)*
- **Skipped — partial, Round 4.** **Uneven groups and stations.** More groups than stations, or a station that
  takes two rotations — currently the schedule assumes a clean cycle. *(More/
  fewer groups than stations already wraps via `computeAssignment`; a station
  taking two full rotations, or locking a group out of the cycle, is still
  unmodeled.)*
- **Done — Pass 2, Round 2.** **Rest stations** and a water break as a first-class station type. *(An
  `isRest` flag on the station schema, editable per station; rest stations
  hide the scored checkbox, render with a distinct badge/tile styling on the
  live stage and on the printed wall cards, and are excluded from the
  Fitness/skill scores card.)*
- **Print a wall-sized station card**, one per page, with the activity
  instructions and a diagram space.
- **Done — Pass 2, Round 2.** **Undo on Reset / New unit** (P11). *(A single-level,
  module-level undo snapshot with an Undo button in the toolbar.)*

## Major Features

- **Done — Round 4.** **Sport and activity library.** Shipped station templates for common PE
  units (volleyball skills, fitness circuit, striking/fielding, cooperative
  games) with the activity description and equipment list per station. This is
  the content that makes the tool usable by someone who isn't already
  designing the unit from scratch. *(Five `STATION_TEMPLATES` circuits, real
  activity descriptions and equipment lists, not placeholder text.)*
- **Done — Round 4.** **Fitness testing mode.** Station rotation is how fitness testing is run;
  recording scores per student per station (pacer, sit-ups, sit-and-reach)
  with a printable class record is a substantial, unserved need.
- **Done — Round 4.** **Score and result capture during the rotation** — not just a timer, but a
  record of what happened at each station, which feeds a unit grade. *(A
  scored flag + score unit per station, a live score-entry card, and a "Print
  class record" button.)*
- **Skipped — deferred, Round 4.** **One rotation engine for the whole site** (P7). Station rotation is also
  Classroom Timer's Round-Robin mode, and also what a gallery walk and a lab
  station rotation need. Four tools want this; one has it.
- **Skipped — deferred, Round 4.** **One bracket engine for the whole site** (P7). This tool's bracket
  duplicates `020-bracket-tournament-generator.html`, which is more capable
  (double elimination, byes, saved brackets, QR sharing). *(Deliberately left
  alone — `bracket-tournament-generator` was being worked on in parallel this
  round.)*
- **Skipped — deferred, Round 4.** **Team/group memory across a unit** so the same four kids aren't together
  every day — the recency logic that
  `002-group-team-generator.html` already implements.
- **Done — partial, Round 4.** **Phone as the remote** (P9). A PE teacher is never near the laptop; driving
  the rotation from a phone while the gym display follows is close to
  essential rather than a nicety. *(Shipped a same-device BroadcastChannel
  remote window — confirmed working only within the same browser
  profile/device, not phone-to-laptop; see the Round 4 update below.)*

## Moonshot / North Star

**Run an entire PE unit from a phone in your pocket.** Pick the unit, pick how
long the period is, and get groups that rotate fairly, stations with the
activity printed on wall cards, a gym-legible display with a horn everyone can
hear, scores captured as you walk around, a tournament at the end of the unit
seeded from those scores, and a printable record for grading — all offline,
because the gym wifi does not work.

## Platform themes that matter here

- **P9 (phone as remote)** — the strongest case on the site; a gym teacher
  cannot stand at a laptop. **Partial (Round 4, PR #55)**: a same-device
  remote window shipped; true phone-to-laptop control still needs a relay
  this tool doesn't have.
- **P7 (cross-tool)** — duplicates both the bracket engine and the rotation
  timer that exist elsewhere. Deliberately left duplicated this round to
  avoid stepping on parallel work on `020-bracket-tournament-generator.html`.
- **P1 (projector/display mode)** — with an unusually demanding legibility
  requirement. **Addressed (Round 4, PR #55)**: gym-legible fullscreen sizing
  and a high-contrast display toggle shipped.
- **P6 (print quality)** — wall-sized station cards.

## Open Questions

- Should the bracket here be replaced by an embed of / link to
  `020-bracket-tournament-generator.html`, keeping this tool focused on rotation?
- **Resolved 2026-08-10 (Round 4, PR #55).** Is score capture in scope, or
  does fitness testing deserve its own tool? — Built directly into this
  tool: a fitness/skill scores card and a printable class record, described
  below.

## Round 4 update — 2026-08-10 (PR #55)

Implemented four of the Major Features in one pass, still single-file
(`Tools/021-pe-tournament-stations.html`, no support folder added — the new
content fit comfortably inline without needing a vendored JS file, so the
"minimal support folder" option from the brief wasn't needed this round).

**Shipped station template library.** A `STATION_TEMPLATES` array ships five
real, ready-to-use circuits: Fitness Circuit (8 stations), Volleyball Skills,
Striking & Fielding, Cooperative Games, and a Fitness Testing Battery (PACER,
curl-ups, push-ups, sit-and-reach). Each station carries a real activity
description and an equipment list, not placeholder text. A "Start from a
shipped template" picker in the Stations card loads one in, replacing the
current list after a confirm if stations already exist.

**Station schema grew equipment + scored fields.** Every station now has an
`equipment` string and a `scored` flag with a free-text `scoreUnit` (reps,
seconds, laps, inches, etc.), editable in a second row under each station's
name/activity. Equipment and the "scored" tag now also print on the wall
station cards.

**Fitness testing / score capture mode.** A new "Fitness / skill scores" card
appears automatically whenever at least one station is marked scored. It
lists every group's members with a number input per student per scored
station, marks whichever group is currently assigned there ("here now"), and
persists to `state.scores[stationId][studentName]`. A "Print class record"
button produces a student-by-station printable table pulling from the same
data — this is the printable record for grading the brief asked for. Scores
are entered live as the rotation runs, independent of which rotation cycle
the group is in, so a mis-entered value can be corrected after the group
moves on.

**Gym-display legibility and audio.** Fullscreen now scales the timer, station
names, and chips dramatically larger (timer up to ~15rem) rather than reusing
the same clamp as the non-fullscreen card. A "high-contrast gym display"
toggle switches the stage to a black background with yellow/white text,
independent of fullscreen. Each station tile now shows a "Next" line (who's
arriving at this station after the next rotation), computed via
`computeAssignment(count + 1)`, addressing the Quick Win about showing next,
not just current. The rotation alarm is now three louder repeated chimes
instead of one soft pair, there's a distinct quiet 30-second warning tone
before rotation (`maybePlayWarning`, guarded so it fires once per countdown),
a full-stage flash on both automatic and manual rotation, and a short
confirmation tone on manual "Rotate now" — useful feedback when driving the
rotation from the remote below, where the teacher can't see the screen while
walking.

**Phone/remote control via BroadcastChannel.** An "Open remote control" button
opens the same HTML file in a second window with `?remote=1`, which renders a
stripped, huge-button remote view (Start/Pause/Resume/Rotate now/Reset, plus a
mirrored timer and a per-station here/next list) instead of the full editor.
The main window is the sole timer authority — it still runs the only `tick()`
loop and broadcasts a state snapshot after every render; the remote window's
own `tick()` is disabled (`if (isRemote) return`) so it never double-counts
rotations, and it only ever sends `{type:'cmd'}` messages that the main window
applies through the same `doStart/doPause/doResume/doRotateNow/doReset`
functions the on-screen buttons call.

**Important tradeoff, tested and confirmed, not glossed over:**
`BroadcastChannel` only reaches other tabs/windows in the *same browser
profile on the same device* — it cannot bridge a phone to a laptop over wifi,
and there is no backend here to relay between two different devices. This was
verified directly: two independent Playwright browser *contexts* (Chromium's
approximate of two unrelated devices/profiles) never deliver a
`BroadcastChannel` message to each other, over both `file://` and `http://`,
while two pages in the *same* context (same profile, multiple tabs/windows —
the realistic "same laptop, second window" case) deliver instantly and
reliably, `file://` included. So what shipped is a genuine, working
same-device second-screen remote (e.g., a small control window on the same
laptop that's mirroring/HDMI'd to the gym TV), not yet a true separate-phone
remote — that would need either a lightweight local relay (a tiny same-machine
WebSocket/HTTP server the tool doesn't have) or a cloud relay (a real
backend, explicitly out of scope). The in-app copy on the remote screen and
around the "Open remote control" button says this plainly rather than
overselling it.

**Deliberately skipped this round** (left for a future pass, per the brief's
"pick 2-4" guidance):
- Rest/water stations as a first-class station type (Quick Win) — the
  templates include a "Rest / Water" station as ordinary content, but there's
  no special handling (e.g., skip-scoring, different tile styling) yet.
- Uneven groups/stations handling beyond what `computeAssignment` already
  does (it already copes with more/fewer groups than stations by wrapping,
  but a station that should take two full rotations, or locking a specific
  group out of the cycle, is not modeled).
- Undo on Reset / New unit (P11).
- Team/group memory across a unit (the `002-group-team-generator.html` recency
  logic) — not touched.
- Unifying the rotation engine or bracket engine across tools (P7) — not
  attempted, per the instruction not to touch `bracket-tournament-generator`,
  which is being worked on in parallel this round. Worth flagging again for
  whoever picks up P7 next: this tool's bracket code
  (`buildBracket`/`autoAdvance`/`renderBracket`) is line-for-line the same
  algorithm as `020-bracket-tournament-generator.html`'s, and the rotation-timer
  pattern here (endAt-based countdown, WebAudio tone alarm, fullscreen stage)
  is close enough to Classroom Timer's Round-Robin mode that a shared module
  seems genuinely warranted — this round intentionally left both alone to
  avoid stepping on that parallel work.

**Where the next round should pick up (superseded by the Pass 2 — Round 2
update below):** rest-station and uneven-rotation modeling; undo; a true
phone-to-separate-display remote (would need a deliberate decision on
backend/relay, since the site's "no backend" constraint is precisely what
blocks it); and the cross-tool engine unification once
`bracket-tournament-generator`'s parallel work has landed and the two can be
reconciled deliberately rather than by accident.

## Pass 2 — Round 2 update — 2026-08-11 (session `mxpfjs`)

Implemented the two remaining Quick Wins flagged as deliberately deferred at
the end of Round 4: rest/water stations as a first-class station type, and a
single-level undo on Reset / New unit. Still single-file, no support folder
added.

**Rest/water stations (`isRest`).** Every station gained an `isRest` boolean
alongside the existing `equipment`/`scored`/`scoreUnit` fields
(`normalizeState`). A station's editor row (`renderStationsEditor`) now shows
a "Rest / water station" checkbox; checking it forces `scored` to `false` and
removes the scored checkbox and unit input from that row entirely (rather
than merely disabling them) — un-checking it brings them back on the next
re-render. The `st-rest` change handler lives next to the existing `st-scored`
one in the same delegated `stationsList` `change` listener. On the live stage
(`renderStage`), a rest station's tile gets an `is-rest` class (distinct
background/border, styled to match the site's `--good` green) plus a "Rest /
Water" badge chip. Printed wall station cards (`buildPrintCards`) gained a
matching `card-page-rest` border treatment and a "Rest / Water — not scored"
tag in place of the scored tag. The Fitness/skill scores card
(`renderScoresCard`) and the printable class record (`buildPrintScores`) both
filter on `st.scored && !st.isRest`, so a rest station can never produce a
score row even if old/malformed data somehow set both flags — `normalizeState`
also defensively forces `scored = false` whenever `isRest` is true. The two
shipped "Rest / Water" / "Rest / Record" stations in `STATION_TEMPLATES`
(Fitness Circuit and Fitness Testing Battery) are now flagged `isRest: true`
so the shipped content actually exercises the new first-class type instead of
just adding the plumbing for it; `loadTemplateBtn`'s station-copy logic carries
`isRest` through from the template.

**Undo on Reset / New unit.** Added a module-level `undoSnapshot` variable
(mirroring the pattern in `022-lab-group-role-randomizer.html`) — deliberately
kept out of `state` and never written to localStorage, since undo here is a
same-session convenience over a unit's live in-memory state, not part of the
unit's saved data. `captureUndoSnapshot()` deep-clones (`deepClone`, a plain
`JSON.parse(JSON.stringify(...))`) the *entire* active `state` object and
enables a new toolbar "Undo" button; `clearUndoSnapshot()` disables it. Both
the Reset confirm handler (`resetRotationBtn`) and the New Unit handler
(`newProjectBtn`) call `captureUndoSnapshot()` right after their confirm/prompt
is accepted and before the destructive call (`doReset()` / `newProject()`)
runs. Capturing the whole state rather than just the rotation fields keeps one
mechanism working for both actions, since New Unit replaces everything.
Clicking Undo restores the snapshot as the current state
(`normalizeState(undoSnapshot)` → `applyStateToForm()` → `refreshSwitcher()` →
`save()`), which correctly re-saves the prior unit under its own name and
switches the project dropdown back to it — including the case where New Unit
had switched to a brand-new project name in between. It's single-level by
construction: a second Reset or New Unit simply overwrites `undoSnapshot`, so
using Undo or triggering another destructive action both leave at most one
usable snapshot, and the button is disabled the moment either happens.
Switching projects via the dropdown or deleting the current unit also clears
the snapshot (`clearUndoSnapshot()`), since silently jumping the teacher back
to an unrelated unit on a later Undo click would be more confusing than
helpful and was outside what P11 asked for.

**Compatibility.** `normalizeState` defaults `isRest` to `false` for any
station missing the field, so every unit saved before this round (including
ones with `scored`/`scoreUnit` already but no `isRest`) loads unchanged with
no rest stations misclassified. The undo mechanism touches no persisted
schema at all.

**Testing.** `node --check` on both extracted `<script>` blocks (syntax only —
this file has no inline-script-changing structural edits beyond the one
inline script block that already existed). A throwaway Playwright script
(deleted after the run, not committed) using the pre-installed Chromium at
`/opt/pw-browsers/chromium` via `file://`: loaded the Fitness Circuit template
and confirmed the shipped "Rest / Water" station's rest checkbox is
pre-checked and its scored checkbox is absent; marked a different station
scored and confirmed the scores card lists only that station's header, not
the rest station's; confirmed exactly one `.station-tile.is-rest` and one
`.rest-badge` render on the live stage; printed station cards and confirmed
`card-rest-tag`/`card-page-rest` markup is present while the rest flag is set,
then un-checked it and confirmed the scored checkbox reappears and the tile
loses the `is-rest` class. Separately for undo: started the rotation, reset
it, confirmed the rotation state actually cleared in `localStorage` and the
Undo button became enabled, clicked Undo, and confirmed the pre-reset running
state came back and the button disabled itself; then repeated the same
before/after/undo check for New Unit, confirming the original 8-station unit
and its name were restored as the active project after undoing a New Unit
that had switched to a different, blank project. A second throwaway script
seeded `localStorage` directly with a hand-written legacy-shaped save (no
`isRest` field on its stations, a `scored: true` station and a bare "Rest /
Water" station with no flags at all) and confirmed it loads with no console
errors, the legacy scored station stays scored, and the legacy rest station
defaults to `isRest: false` (not silently reclassified) exactly as the
backward-compatibility requirement asks. Both runs reported zero console
errors (`console.error`/`pageerror`) throughout. All test scripts were deleted
after the run; no test artifacts were left in the repo.

**What's still open for the next round:** uneven groups/stations modeling (a
station taking two full rotations, or locking a group out of the cycle); a
true phone-to-separate-display remote (needs a deliberate backend/relay
decision); team/group memory across a unit (the `002-group-team-generator.html`
recency logic); and the cross-tool rotation/bracket engine unification (P7),
still intentionally untouched pending `020-bracket-tournament-generator.html`'s
parallel work landing. Also newly worth a look, noticed but out of this
round's scope: `newProject()`/`save()` will silently overwrite an existing
saved unit's data if a teacher types a "New unit" name that collides with one
already in the switcher dropdown (no existence check before it clobbers
`store.projects[name]`) — the single-level undo added this round covers the
*immediately preceding* New Unit call, but not a rename/name-collision
scenario discovered later.
