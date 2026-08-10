# Improvement Prompts — 035 — School Layout Visualizer

**Tool file:** `Tools/035-schedule-visualizer.html` (~19,400 lines — by far the largest tool on the site)
**Support folder:** `Tools/schedule-visualizer/` — `lib/jsqr.js`, `lib/qrcode.js`; plus `Tools/schedule/` — fonts, `libs/jspdf/`

**Current description (from README):** Build a hyperlinked map of teachers, rooms, and clusters — and publish a schedule browser like the one above from it.

---

## Status

**2026-08-10 — Round 7 (PR #60): a critical publish-pipeline crash fixed,
plus the storage headroom warning Quick Win.**

**The main finding this round, and the reason it dominates this Status
section:** `brBuildPublishedHTML()` — the function behind the "Publish"
button — was **producing a broken `034-schedule-browser.html`.** Its function
list (`brPublishFnList()`) stringifies `brRenderTeacher`, `brDayRows`,
`brRenderGroup`, `brMiniMapHTML`, `brGroupMapHTML`, `brGeoFloorSVG`, and
`brOverviewHTML` into the published file, and every one of those calls two
app-wide escaping helpers, `escHtml()` and `escJsAttr()` (defined once,
around line 10657, and used throughout the rest of this app) — but neither
function was ever added to the publisher's `consts` list. Those two names
would be **undefined in the published file's scope**, so opening any teacher
or any group in a freshly-published `034-schedule-browser.html` would throw
`ReferenceError: escHtml is not defined` immediately — the browser's two
core views, completely broken, with no error shown to the person who just
published it.

This wasn't a hypothetical: it was verified two ways. First, calling
`brBuildPublishedHTML()` directly in a live session and inspecting the
output confirmed `escHtml`/`escJsAttr` were absent from the generated
`<script>`. Second — and more convincingly — the *actual generated HTML* was
loaded into a fresh page, a fabricated teacher was injected into
`BR_TEACHERS`, and `brRenderTeacher()` was called on it: before the fix,
that throws; after the fix, it renders correctly. The comment already
sitting on `escJsAttr()` even says outright that it's "needed... in both the
live Schedule Browser preview and every already-published
034-schedule-browser.html this generates" — this was a known intention that
regressed, not a design gap.

- **Fixed — the publish crash.** Added `const escHtml = ...` and
  `const escJsAttr = ...` to `brBuildPublishedHTML()`'s `consts` array,
  using the exact same `.toString()`-embedding pattern already proven for
  `brDColor`/`brTDept`/`brDShort`/`brOrderOf` two lines above. Minimal,
  additive, and now verified end-to-end (generate → load → render).
- **Found but explicitly not fixed — R61–R63 feature drift.** While tracing
  this bug, a second and larger problem surfaced: the real, currently-shipped
  `Tools/034-schedule-browser.html` has features — PNG schedule download,
  copy/share links, the staleness banner, and the entire Common
  Planning/Compare mode — that **do not exist anywhere in this file's
  source**. `brPublishFnList()`, the live-preview `<div id="app-browser">`
  markup (around line 18193), and `BR_CSS` are all missing them. Someone
  clearly built these directly against the published output (the
  `/* R61: ... */`, `/* R62: ... */`, `/* R63: ... */` comments in
  `034-schedule-browser.html` name exactly this work) without ever backporting
  them here. Publishing today would silently **delete** all of it from a
  fresh export. This is a real "Major Feature"-sized port (~300 lines,
  across three template locations, needing UI verification this session
  didn't have the budget to do safely on a 19,400-line file) and was left
  for a dedicated future round rather than attempted partially. See
  `034-schedule-browser.md`'s Status for the Quick Wins this round shipped
  directly to the standalone file instead, and the note that they'll need
  re-applying (or finally backporting) whenever this gap does get closed.
- **Done — Storage headroom warning (P12).** A fixed, dismissible banner
  (`#stviz-storage-warn`) that appears once per session when this origin's
  total `localStorage` usage crosses ~4 MB (80% of the common 5 MB
  per-browser floor), checked after every successful blueprint autosave.
  A second, harder-styled banner fires on an actual write failure
  (`QuotaExceededError`), telling the teacher their last change did **not**
  save and to export a backup immediately — replacing the previous silent
  `console.warn`-only failure mode. Both paths verified in headless
  Chromium: the proactive banner by filling real `localStorage` until usage
  crossed the threshold, the failure banner by mocking `Storage.prototype.setItem`
  to throw a real `QuotaExceededError`.

**Where a future round should pick up:** the R61–R63 backport above is now
the clearest, best-documented, highest-value item in the whole improvement-
prompts programme for this tool pair — do it as its own round, with time to
actually drive the visualizer's UI (create a project, add teachers/rooms,
click Publish, open the result) rather than reasoning about it statically.
Everything else in Quick Wins and Major Features below is untouched.

Ideas below are **not** scoped to a single session; several are
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
- **Publishing** — generates a standalone `034-schedule-browser.html`
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
- **Done —** **Storage headroom warning** (P12). A blueprint with a traced image plus
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
  `school-calendar-visualizer.html`, `004-Classroom Timer.html`, and
  `010-command-center-dashboard.html` all want that data and none can reach it.

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
  **Partly addressed Round 7** — a proactive headroom warning and a hard
  write-failure banner now exist; the export-often workflow they point to is
  still manual.
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
- Should the published `034-schedule-browser.html` be regenerated automatically
  when the project changes, or stay an explicit publish step?
  **Sharpened 2026-08-10**: whichever answer Devon prefers, an explicit step
  that nobody re-runs is exactly how the R61–R63 drift (see above) happened
  silently — regeneration frequency and a way to *detect* drift both matter
  more now than they did before this round.
- **Raised 2026-08-10.** Given the R61–R63 drift, is `brPublishFnList()` +
  hand-copied consts the right mechanism going forward, or would a build-time
  check (e.g. a script that diffs a fresh `brBuildPublishedHTML()` output
  against the checked-in `034-schedule-browser.html` and flags unexplained
  removals) be worth adding so this class of bug can't recur silently?
