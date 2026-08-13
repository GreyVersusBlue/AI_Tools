# Improvement Prompts — 035 — School Layout Visualizer

**Tool file:** `Tools/035-schedule-visualizer.html` (~19,400 lines — by far the largest tool on the site)
**Support folder:** `Tools/schedule-visualizer/` — `sv-handoff.js`,
`sv-recovery.js`, `test/smoke-recovery.mjs`, `test/smoke-evacuation.mjs`;
plus `Tools/schedule/` — fonts, the published-browser fixtures and test suite

**Current description (from README):** Build a hyperlinked map of teachers, rooms, and clusters — and publish a schedule browser like the one above from it.

---

## Status

### Pass 2 — Round 4 — 2026-08-13 — session `a91780`

**Shipped the evacuation route planner and door cards (Major Features,
"Emergency planning").** Every room on the currently active floor now routes,
via the existing A* graph, to the nearest hand-marked exterior exit, and the
whole floor's routes batch-print as one PDF of postable per-room door cards.

- **New data: "exterior exit" is a flag on an existing hallway tile, not a
  new grid-tile TYPE.** The prompt's own instructions flagged the
  A*-admissibility subtlety in the portal-graph heuristic (lines
  ~12554–12573 before this round) as something not to break, and the
  surest way not to break it was to touch `astar()`, `buildHeuristic()`,
  `buildMultiFloorGraph()`, and the classify pass in
  `buildLocalFloorGraph()` **not at all**. A fourth tile TYPE would have
  meant new cases in the classify pass, `drawTile()`, the doorway/eraser
  tools, and the door-edge-restriction logic — real surface on a
  19,900-line file for a feature that doesn't need new topology, only a
  new kind of *destination* on topology that already exists. Instead,
  three properties — `tile.isExit` (bool), `tile.exitLabel` (string),
  `tile.assemblyPoint` (string) — live directly on an ordinary hallway
  tile object, following the **exact existing precedent** of
  `tile.corridorLabel` on the same tile shape (`showHallwayEditor()`,
  originally "Change 5"). Because tiles are already copied wholesale
  (`{ ...tile }`) by `serializeBlueprint()` / `applyBlueprintData()`, this
  flag round-trips through save, export/import, and the Round-3 recovery
  ring **for free** — none of that code needed to change, and
  `validateBlueprintData()` doesn't constrain tile shape beyond
  `col`/`row`/`tile` presence, so it doesn't reject the new fields either.
- **Marking an exit:** select the Select tool, click a hallway tile, check
  "Exterior exit" in the right panel (new fields under the existing
  Corridor Label section), optionally name the door and its assembly
  point, Apply. The tile gets a green ring + door glyph on the canvas so
  authors can see what they've marked (`drawTile()`'s hallway branch).
  Staircase tiles were deliberately **not** given the same checkbox — see
  Deferred below.
- **New pathfinding module** (`collectExitPoints`, `evacPathCost`,
  `computeEvacuationRouteForRoom`, `evacDirectionLabel`,
  `buildEvacuationSteps` — inserted right after the existing A* section's
  own `window.findPath = …` export block, ~line 13030): for a room, try
  `astar()` against every marked exit (schools have very few) and keep the
  cheapest by re-summing real edge cost from the same adjacency list
  `astar()` searched (path cell-count alone is misleading once a 0-cost
  staircase teleport is in the path). `buildEvacuationSteps()` turns the
  raw key path into numbered turn-by-turn text ("Head east 4 tiles.",
  "Take the stairs to Floor 1.", "Exit at Door A."), reading the
  `teleport` flag straight off the matching adjacency edge — the same
  flag `buildMultiFloorGraph()` already sets — rather than inferring a
  floor change from coordinates, since paired staircases are not required
  to sit at the same col/row on each floor.
- **Door cards:** "Print Door Cards" (new Evacuation section in the
  Blueprint sidebar, next to the existing PNG/PDF export buttons) builds
  one letter-size jsPDF page per room on the active floor — room number,
  a cropped route-highlighted floor-plan image, the numbered steps, and an
  assembly-point callout box — batched into one downloadable PDF, reusing
  the *exact* ctx-swap-then-`renderCanvas()`-then-restore technique
  `renderBlueprintExportCanvas()` already uses for the plain floor-plan
  print, plus a path overlay drawn the same way the existing
  `drawCorridorLabelHighlights()` overlay is drawn, then cropped to the
  route's bounding box via a second canvas + `drawImage`. No changes to
  `renderCanvas()` or any tile-drawing helper were needed.
- **Verified:** `Tools/schedule-visualizer/test/smoke-recovery.mjs` (21
  checks) and `Tools/schedule/test/smoke.mjs` (42 checks, the
  publish/schedule-browser pipeline the parallel Schedule Browser session
  is depending on) both still pass **unmodified**, confirming nothing
  about the published-data format changed. New
  `Tools/schedule-visualizer/test/smoke-evacuation.mjs` (15 checks, not
  wired into `npm test` — see below) drives the real thing in headless
  Chromium against the Northwind fixture: marking a hallway tile sets
  `collectExitPoints()`'s one entry with its label/assembly text intact;
  a same-floor room (101) finds a real multi-cell `astar()` route ending
  in "Exit at Door A."; a room on the *other* floor (201, which has no
  exit marked on its own floor) still finds a route and it correctly
  reports `crossesFloor: true` (via the ground floor's staircase
  teleport); zero marked exits returns `null` rather than throwing;
  `printEvacuationDoorCards()` runs end-to-end — jsPDF build and save —
  with zero new console errors and zero offsite requests. A separate
  manual headless pass confirmed the new "Print Door Cards" button
  renders in the sidebar with zero console errors on a cold page load.
  `check:dedupe` and `check:social` both still pass clean, and neither
  flags this tool.
- **This round's environment note:** `npx playwright install chromium`
  could not reach `cdn.playwright.dev` (blocked by this session's egress
  policy — a 403 at the proxy, not retried, per `/root/.ccr/README.md`).
  `Tools/board-check/harness.mjs`'s existing `PW_CHROMIUM_EXECUTABLE`
  escape hatch pointed at a pre-installed Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and every suite
  above ran for real, headless, against the actual served pages — this
  wasn't a change of test strategy, just using the accommodation the
  harness already had for exactly this situation.
- **Deliberately deferred** (named explicitly, per the assignment's own
  prompt):
  - **Multi-floor batch printing.** Door cards print for the *active*
    floor only, one click per floor. The room-registry / roomToKey
    grouping to do "every floor, one PDF, page breaks between floors" is
    straightforward given what already exists, but doubles the surface
    this round touched in the print path for a workflow (open each floor,
    click the button once) that's already only a few clicks.
  - **Staircase tiles as their own exit type.** Only hallway tiles got the
    "Exterior exit" checkbox — real ground-floor stairwells that open
    straight outside exist in real buildings, but `showStaircaseEditor()`
    already owns non-trivial pairing-mode UI state (see its
    `refreshStaircasePanel()`), and folding a second, unrelated checkbox
    into that same panel without driving it by hand felt like the wrong
    place to spend this round's remaining risk budget. A room whose
    shortest route happens to pass through such a stairwell still routes
    correctly to a hallway exit elsewhere; it just can't name the
    stairwell itself as the exit.
  - **Elevator / mobility-accommodation route variants.** The prompt named
    this explicitly as a plausible deferral. `astar()` has no concept of
    "avoid staircases" today; the multi-floor graph would need a second,
    stair-excluding heuristic pass and a way to mark which staircases are
    elevators. Real need, separate round — this is the "Accessibility
    routing" Major Feature already listed below, and evacuation-specific
    accessible routing compounds it (an evacuation route that must avoid
    stairs may have no route at all on some floors without an elevator,
    which needs its own UI treatment, not a silent fallback).
  - **Transition-time / congestion-aware evacuation costing.** Routes use
    the same uniform per-tile edge cost `astar()` always has; they don't
    account for `computeCongestionMap()`'s existing crowding model (a
    corridor that's a chokepoint during a congested passing period is a
    genuinely different evacuation risk than an empty one). Cheap to
    reason about, not cheap to verify without driving a full congestion
    scenario, and out of scope for this round.
  - **`npm test` wiring.** This round's boundaries excluded touching
    `package.json`; `smoke-evacuation.mjs` runs directly
    (`node Tools/schedule-visualizer/test/smoke-evacuation.mjs`) but isn't
    in the `npm test`/`npm run test:*` script list yet. A future round
    that's allowed to touch `package.json` should add
    `"test:evacuation": "node Tools/schedule-visualizer/test/smoke-evacuation.mjs"`
    next to `test:schedule-visualizer`.
  - **No changes to `sv-handoff.js` or the publish pipeline.** Evacuation
    data is editor-only; it isn't part of what `034-schedule-browser.html`
    consumes, and nothing about the published/handoff format changed —
    confirmed by the unmodified `Tools/schedule/test/smoke.mjs` passing.

**Where a future round should pick up:** unchanged from Round 3/2 below —
the R61–R63 backport (copy/share links next, then Compare/Common Planning
mode, then PNG download) is still the highest-value item for the visualizer/
browser tool pair. For this feature specifically: multi-floor batch printing
and the `npm test` wiring above are the cheapest next steps; accessible
routing and congestion-aware costing are their own rounds.

### Pass 2 — Round 3 — 2026-08-11 — session `m3r8ro`

**Shipped automatic recovery points (backlog rank 2, "Autosave and crash
recovery").** The framing in the backlog row needed correcting before the
work could be scoped: *autosave already existed* — `scheduleBlueprintAutosave()`
has written the blueprint to `stviz_blueprint` 800ms after every change for
many rounds. What did not exist was any answer to what happens when that one
key fails, which for the site's largest artifact is the whole risk:

- **The unreadable-autosave hole was the real bug.** `loadBlueprintFromLocalStorage()`
  caught every failure with one `console.warn` and returned `false` — the same
  `false` it returns on a genuine first run. So a truncated or evicted payload
  opened an empty editor with no explanation, and the *next keystroke's
  autosave overwrote the only copy that existed*. It now records
  `_blueprintLoadStatus` as `restored` / `empty` / `corrupt`, and on `corrupt`
  copies the unreadable string to `stviz_blueprint_unreadable` before anything
  can tread on it.
- **New module `Tools/schedule-visualizer/sv-recovery.js`** keeps a rolling ring
  of three full-project generations (blueprint + groups + settings + what-if)
  **in IndexedDB, not localStorage** — deliberately, per P12 and per this
  tool's own storage-headroom warning: three copies of a project carrying a
  traced floor-plan image would compete with the live autosave for the same
  ~5MB and could be the very thing that pushes a write over quota. It also owns
  the `STVIZ_SESSION_OPEN_v1` marker (localStorage, because it has to be
  written and cleared synchronously at boot and at pagehide).
- **Capture points:** every 5 minutes when something has changed (hooked into
  `scheduleBlueprintAutosave()`, so "changed" can't drift from the autosave's
  own definition), on `pagehide` and on `visibilitychange → hidden`, and forced
  before an import replaces everything and before the danger-zone "clear saved
  blueprint". A restore captures the state it is about to replace first, so
  recovering is itself undoable.
- **On load,** a banner appears in exactly two cases and stays quiet otherwise:
  the autosave came back unreadable, or the previous session never reached its
  pagehide (crash / killed tab / dead machine). Both name the recovery point's
  time and contents. A "Automatic Recovery Points" list in Settings sits under
  Project Snapshots for a deliberate rollback with no crash involved.
- **Drive-by fix:** `.stviz-storage-banner` (the R58 quota warning) had markup
  and JS but **no CSS anywhere in the file** — it was rendering as unstyled
  body text at the top of the page. Both banners are now styled together.
- **What was fiddly.** (a) `RecoveryManager` is a `const` declared ~11,000
  lines below `scheduleBlueprintAutosave()`, so the hook has to go through
  `window.RecoveryManager` — a bare reference is a temporal-dead-zone *throw*,
  not `undefined`. (b) `sv-recovery.js` is an ES module and evaluates after the
  classic script, so `init()` waits on a `sv-recovery-ready` event when the
  namespace isn't there yet. (c) The pagehide capture is a best-effort
  IndexedDB write; the `visibilitychange` capture is the one that reliably
  lands, and pagehide is the clean-close case anyway.
- **Verified** by a new suite, `Tools/schedule-visualizer/test/smoke-recovery.mjs`
  (21 checks, `npm run test:schedule-visualizer`), reusing the schedule suite's
  Northwind fixture: a point really lands in IndexedDB with a readable header,
  the ring caps at three, an unchanged project doesn't spend a generation, a
  crash marker produces the "wasn't closed cleanly" banner, a corrupted
  `stviz_blueprint` produces the "could not be read" banner *and* the
  quarantine copy, and restoring from either banner puts the rooms back. The
  existing `Tools/schedule/test/smoke.mjs` (42 checks, the publish pipeline)
  still passes.
- **Not done:** the recovery ring holds the full project but not the undo
  history; and there is no "compare this recovery point with what's on screen"
  view, which is what would make a rollback from the Settings list a decision
  rather than a leap.

**Where a future round should pick up:** unchanged from Round 2 below — the
R61–R63 backport (copy/share links next, then Compare/Common Planning mode,
then PNG download) is still the highest-value item for this tool pair.

### Pass 2 — Round 2 — 2026-08-11 — session `j6ok2v`

**Started the R61–R63 backport — the item both this file's and
`034-schedule-browser.md`'s Round 7 notes named as the clearest,
best-documented, highest-value item in the whole programme for this tool
pair.** Given the size of the remaining gap (four features: staleness
banner, copy/share links + deep linking, Common Planning/Compare mode,
PNG download — each touching different parts of a 19,400-line file) and
the standing recommendation that this be "its own dedicated round with
room to actually drive the visualizer's UI," this round deliberately
ported **one** self-contained piece rather than rushing all four:

- **Done — Phase 1: staleness banner.** Ported `BR_STALE_DAYS`,
  `brFormatDateLong()`, and `brCheckStaleness()` from
  `034-schedule-browser.html`, plus the `#br-stale-banner` div and its
  CSS (now in the shared `BR_CSS` both the live preview and the publisher
  draw from). Wired into both the live preview markup (harmless there —
  the live editor never sets `PUBLISHED_DATA`, so `brCheckStaleness()`
  no-ops via a `typeof` guard) and `brBuildPublishedHTML()`'s actual
  publish pipeline, so a fresh Publish no longer silently drops it the
  way a fresh Publish would have dropped all four before this round.
- **Not done — copy/share links, Compare/Common Planning mode, PNG
  download.** All three remain unported. Recommended order for the next
  round: copy/share links next (self-contained like staleness, but needs
  `brRenderTeacher`/`brRenderGroup` output changes to add the buttons —
  worth doing before Compare mode since Compare's UI reuses the same
  share-button pattern), then Compare/Common Planning mode (the biggest
  single piece — a new toolbar mode, bell-time parsing for "current
  period," and its own render functions), then PNG download last (most
  self-contained of the three, touches canvas drawing code with no
  overlap with the others, and is the lowest-urgency of the four —
  losing a download button on republish is a smaller problem than losing
  a warning that the data is stale or losing Compare mode entirely).

Verified end-to-end in headless Chromium, following the same two-step
method Round 7 used to verify the `escHtml`/`escJsAttr` crash fix: (1)
called `brBuildPublishedHTML()` directly in a live session and confirmed
the output contains the function, the div, and the const; (2) loaded that
*actual generated HTML* fresh in a new page — once with `publishedOn`
backdated 200 days (banner appears, with the correct computed day count
and date in the text) and once with today's date (banner stays hidden) —
and confirmed opening a teacher still works in both (no regression on the
Round 7 fix). The live editor's own preview was also loaded and toggled
open with zero console errors.

**Where a future round should pick up:** copy/share links, in the order
above — this is now the best-scoped remaining phase of the single
highest-priority item on this tool pair's list. Everything else in Quick
Wins and Major Features below is untouched.

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
- **Automatic recovery points** (`sv-recovery.js`, IndexedDB `stviz-recovery`):
  a rolling three-generation copy of the whole project taken every few minutes,
  on leaving the page, and before an import or a danger-zone clear; offered on
  load when the autosave is unreadable or the last session ended abnormally,
  and listed in Settings for a deliberate rollback
- **Evacuation route planner and door cards** (Pass 2 Round 4): mark any
  hallway tile as an exterior exit (`showHallwayEditor`, `tile.isExit`/
  `tile.exitLabel`/`tile.assemblyPoint`), then "Print Door Cards" computes
  every room's shortest route to its nearest marked exit via the existing
  A* graph (`collectExitPoints`, `computeEvacuationRouteForRoom`,
  `buildEvacuationSteps`) and batch-prints one postable per-room card —
  route map crop, numbered turn-by-turn steps, assembly point — for the
  active floor as a single PDF (`printEvacuationDoorCards`)
- Onboarding flow (`stviz_onboarded`), PDF export via vendored jsPDF

## Quick Wins

- **Split the file.** 19,400 lines in one HTML file is the main thing standing
  between this tool and further progress; every other item on this list is
  cheaper after the editor, the schedule model, the pathfinder, the congestion
  engine, the playback renderer, and the publisher are separate modules under
  `Tools/schedule-visualizer/`. The support folder already exists and holds
  only two vendored libraries and, since Pass 2 Round 3, `sv-handoff.js` and
  `sv-recovery.js` — the module split has a foothold to grow from.
- **Done —** **Autosave and crash recovery** (Pass 2 Round 3). Autosave was
  already there; what shipped is the recovery ring in `sv-recovery.js` plus
  the corrupt-autosave detection the old loader silently swallowed.
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
  **Partly shipped Pass 2 Round 4** — evacuation routes per room, marked
  exterior exits with named assembly points, and printed per-room door
  cards (single active floor, batched into one PDF) all now exist; see
  Status above. Lockdown maps, multi-floor batch printing, and
  accessibility-aware evacuation routing (see the item above) remain open.
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
