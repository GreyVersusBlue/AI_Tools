# Improvement Prompts — Tournament Bracket & Station Rotation (PE)

**Tool file:** `Tools/pe-tournament-stations.html`
**Support folder:** none — single file

**Current description (from README):** A station rotation timer with named stations and groups, plus a tournament bracket for PE units.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

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

- **The display has to be readable from across a gym.** This is the most
  extreme legibility requirement on the site — bigger than any classroom
  projector. Current station / timer / group text should be sized for 60 feet,
  not 20.
- **Audible signals that carry.** A single tone will not be heard over a gym.
  Longer, louder, repeated signals, plus a visual full-screen colour flash, and
  a warning signal 30 seconds before rotation.
- **Show the next station**, not just the current one, so groups can move
  without being told where.
- **Uneven groups and stations.** More groups than stations, or a station that
  takes two rotations — currently the schedule assumes a clean cycle.
- **Rest stations** and a water break as a first-class station type.
- **Print a wall-sized station card**, one per page, with the activity
  instructions and a diagram space.
- **Undo on Reset / New unit** (P11).

## Major Features

- **Sport and activity library.** Shipped station templates for common PE
  units (volleyball skills, fitness circuit, striking/fielding, cooperative
  games) with the activity description and equipment list per station. This is
  the content that makes the tool usable by someone who isn't already
  designing the unit from scratch.
- **Fitness testing mode.** Station rotation is how fitness testing is run;
  recording scores per student per station (pacer, sit-ups, sit-and-reach)
  with a printable class record is a substantial, unserved need.
- **Score and result capture during the rotation** — not just a timer, but a
  record of what happened at each station, which feeds a unit grade.
- **One rotation engine for the whole site** (P7). Station rotation is also
  Classroom Timer's Round-Robin mode, and also what a gallery walk and a lab
  station rotation need. Four tools want this; one has it.
- **One bracket engine for the whole site** (P7). This tool's bracket
  duplicates `bracket-tournament-generator.html`, which is more capable
  (double elimination, byes, saved brackets, QR sharing).
- **Team/group memory across a unit** so the same four kids aren't together
  every day — the recency logic that
  `group-team-generator.html` already implements.
- **Phone as the remote** (P9). A PE teacher is never near the laptop; driving
  the rotation from a phone while the gym display follows is close to
  essential rather than a nicety.

## Moonshot / North Star

**Run an entire PE unit from a phone in your pocket.** Pick the unit, pick how
long the period is, and get groups that rotate fairly, stations with the
activity printed on wall cards, a gym-legible display with a horn everyone can
hear, scores captured as you walk around, a tournament at the end of the unit
seeded from those scores, and a printable record for grading — all offline,
because the gym wifi does not work.

## Platform themes that matter here

- **P9 (phone as remote)** — the strongest case on the site; a gym teacher
  cannot stand at a laptop.
- **P7 (cross-tool)** — duplicates both the bracket engine and the rotation
  timer that exist elsewhere.
- **P1 (projector/display mode)** — with an unusually demanding legibility
  requirement.
- **P6 (print quality)** — wall-sized station cards.

## Open Questions

- Should the bracket here be replaced by an embed of / link to
  `bracket-tournament-generator.html`, keeping this tool focused on rotation?
- Is score capture in scope, or does fitness testing deserve its own tool?
