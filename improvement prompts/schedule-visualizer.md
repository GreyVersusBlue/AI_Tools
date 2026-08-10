# Improvement Prompts — School Layout Visualizer

**Tool file:** `Tools/schedule-visualizer.html` (~19,400 lines — by far the largest tool on the site)
**Support folder:** `Tools/schedule-visualizer/` — `lib/jsqr.js`, `lib/qrcode.js`; plus `Tools/schedule/` — fonts, `libs/jspdf/`

**Current description (from README):** Build a hyperlinked map of teachers, rooms, and clusters — and publish a schedule browser like the one above from it.

---

## Status

Reviewed — structural read of the source. This is the most ambitious piece of
software in the repo by a wide margin and deserves a proportionally ambitious
list. Ideas below are **not** scoped to a single session; several are
multi-session on their own.

## What it does today

- **Tile-based floor plan editor** — draw classrooms, staircases, corridors,
  doors (`drawClassroomTile`, `drawStaircaseTile`, `detectDoorSide`,
  `drawDoorNotches`), multiple floors, trace an image underneath
  (`drawTraceImage`, `downscaleTraceImage`), pan/zoom, selection, bulk edit
- **Schedule data**: teachers, rooms, subjects, student groups, A/B days, mods
  and bell days (`buildModRows`, `_bellDayRows`, `_bellValidate`), CSV import
  with a downloadable template and conflict detection
  (`computeScheduleConflicts`)
- **Pathfinding and travel analysis** — A* across a multi-floor graph
  (`astar`, `buildMultiFloorGraph`, `buildFloorEdges`,
  `buildStaircasePairLookup`, `buildTeleportLegs`), travel times
  (`computeTravelTimes`), and **congestion modelling**
  (`computeCongestionMap`, `buildCongestionData`, `congestionDelayMult`) with
  a heat map and exclusion zones
- **Transition playback** — animate a passing period
  (`drawPlaybackFrame`, `drawVizPaths`, `drawPortalPulse`, `drawPortalDwellArc`),
  real-time / step / comet modes, presentation mode
- **What-if scenarios** (`stviz_whatif`, `applyWhatIfFromProject`,
  "Apply Scenario to Schedule", reset)
- **Publishing** — generates a standalone `schedule-browser.html`
  (`brBuildPublishedHTML`, `brBuildPublishedMarkup`, `brPublish`,
  "Copy Publish HTML") with fonts inlined
- **Snapshots and history** (`STVIZ_SNAPSHOT_*`, `beginAction`/`commitAction`,
  full undo), project export/import, **peer-to-peer project handoff** over
  `webrtc-pair.js` with QR pairing
- Onboarding flow (`stviz_onboarded`), PDF export via vendored jsPDF

## Quick Wins

- **Split the file.** 19,400 lines in one HTML file is the main thing standing
  between this tool and further progress; every other item on this list is
  cheaper after the editor, the schedule model, the pathfinder, the congestion
  engine, the playback renderer, and the publisher are separate modules under
  `Tools/schedule-visualizer/`. The support folder already exists and holds
  only two vendored libraries.
- **Autosave and crash recovery.** The largest, most-easily-lost artifact on
  the site; snapshots exist but a periodic autosave slot would prevent the
  worst outcome.
- **Storage headroom warning** (P12). A blueprint with a traced image plus
  snapshots is the biggest thing in `localStorage` on this site, and the
  failure mode is a silent write failure.
- **A shipped example project** (P15) — this tool has an onboarding flow and
  still starts from nothing, which is a steep first five minutes.
- **Print the floor plan itself** at a usable size — a labelled building map
  for a sub folder, a new-teacher packet, or an evacuation route poster.

## Major Features

- **Master schedule building, not just visualizing.** The tool already detects
  conflicts; the natural step is helping *resolve* them — suggesting room
  assignments that reduce travel time and congestion, flagging a teacher with
  three rooms in three consecutive periods, or auto-placing sections against
  constraints. This moves the tool from "shows you the schedule" to "helps you
  build the schedule", which is a fundamentally more valuable thing.
- **Congestion as an argument, not just a picture.** The congestion model
  produces exactly the evidence an administrator needs for "we should stagger
  release" or "this stairwell needs one-way traffic". A printable report —
  the top ten pinch points, the worst transitions, what the what-if scenario
  saves — turns a visualization into a proposal.
- **Accessibility routing.** Wheelchair-accessible paths, elevator use, and
  travel-time estimates for a student with a mobility accommodation. The
  multi-floor graph already exists; this is a weighting problem, and it's a
  real legal and human need that nobody has a tool for.
- **Emergency planning.** Evacuation routes per room, assembly points,
  lockdown maps, and printed per-room posters — computed from the same graph.
  This is the highest-stakes use of the model already built.
- **Publish more than the browser.** The publisher is excellent; publishing
  per-teacher one-page PDFs, a printed building map pack, or a room-by-room
  door sign set would extend it cheaply (P7).
- **Multi-year and multi-scenario comparison** — this year versus next year's
  proposed schedule, side by side, with the congestion delta.
- **Bell schedule as a shared asset** (P7). This tool already models bell days;
  `school-calendar-visualizer.html`, `Classroom Timer.html`, and
  `command-center-dashboard.html` all want that data and none can reach it.

## Moonshot / North Star

**A planning tool a school actually uses to run the building.** Draw the
building once; import the master schedule; see where the crowds form, which
students can't make it between classes, which rooms sit empty; test a change
before it's made; publish a schedule browser for staff, per-teacher PDFs, door
signs, evacuation posters, and accessible-route plans — all from one local
file, with no district software purchase, and shareable to a colleague's
laptop by QR code across a desk.

## Platform themes that matter here

- **P9 (device pairing)** — the peer-to-peer project handoff here and the
  Classroom Timer mirror are the site's only two uses; the patterns here are
  the more advanced ones.
- **P11 (undo/history)** — has the most complete history system on the site;
  worth extracting.
- **P12 (storage quota)** — the largest payloads on the site live here.
- **P7 (cross-tool)** — the bell schedule and building map are assets four
  other tools want.
- **P8 (versioning)** — seven storage keys and a published-output format;
  migration matters.

## Open Questions

- Who is the intended user — Devon, or an administrator? The tool currently
  spans both, and the master-schedule-building ideas above only make sense if
  an administrator is in scope.
- Is the 19,400-line single file a deliberate constraint (the site's
  "single-file tool" ethos) or an accident of growth? Everything ambitious
  here gets easier if it's the latter.
- Should the published `schedule-browser.html` be regenerated automatically
  when the project changes, or stay an explicit publish step?
