# Improvement Prompts — East Middle Schedule Browser

**Tool file:** `Tools/schedule-browser.html`
**Support folder:** `Tools/schedule/` — fonts, `libs/jspdf/`

**Current description (from README):** This year's actual A/B schedule, searchable by teacher, room, or period. Published from the School Layout Visualizer, below.

---

## Status

Reviewed — structural read of the source. Note this file is **generated
output**, published by `schedule-visualizer.html` (`brBuildPublishedHTML`,
`brPublish`), not hand-maintained. Improvements here mostly mean improvements
to the publisher — but the *experience* is worth specifying separately, which
is what this file does. Ideas below are deliberately ambitious and **not**
scoped to a single session.

## What it does today

- Three view modes: **By Teacher**, **By Student Group**, **Building Map**
- Per-teacher view: where to find you, your classes, other teachers for your
  students, common planning
- A/B day toggle; per-class view showing who teaches it and where it goes
- **Compare mode** (`brCompareAdd`, `brCompareHTML`, `brCompareFreeIdxs`,
  `brCompareSummaryHTML`) — put two or more teachers side by side and find
  shared free periods
- **Interactive building map** with floor switching (`brGeoFloorSVG`,
  `brRenderMapDyn`, `brOpenMapFloorIdx`) and a mini-map
- Deep links (`brApplyDeepLink`, `brBuildLinkURL`), copy link, share
- **Download schedule as PNG** (`brDownloadTeacherSchedule`), print/save PDF
- **Staleness check** (`brCheckStaleness`) — warns when the data is old
- Type-ahead search (`brOnType`, `brFindKeyCI`)

## Quick Wins

- **"Who is free right now?"** The compare mode already computes free periods;
  answering it for the current time and day is a one-tap version of the most
  common real question.
- **Where is this student right now?** By-group view plus the current period
  answers it; the office asks this several times a day.
- **Save a home teacher.** Opening straight to your own schedule rather than
  a search box every time.
- **Add to phone home screen / offline** — the site has a service worker, so
  a teacher's own schedule should be reliably available with no signal in a
  hallway.
- **Bell times on the schedule.** Period numbers without times are half the
  information.
- **Print a wallet-sized or door-sized version** — the two physical formats
  that actually get used.
- **Show the staleness warning prominently.** A schedule browser showing last
  year's data is worse than no schedule browser; the check exists and should
  be loud.

## Major Features

- **Coverage finder.** "Mr. X is out 3rd period — who is free and qualified?"
  Combines the free-period computation with department information the
  publisher already has (`brSyncDeptFromSettings`). This is a daily
  administrative problem with no tool.
- **Room finder.** "I need an empty room with a projector 5th period" — the
  building map plus the schedule already contains the answer.
- **Duty and meeting overlays.** Common planning is already shown; adding
  duty rotations (`IDEAS_BACKLOG.md` has a Duty Roster Builder) and standing
  meetings would make this the complete "where is everyone" picture.
- **Personal overlay.** Let a teacher add their own notes to their schedule —
  which class is where, what the room code is — stored locally, surviving a
  republish.
- **Navigation for a new person.** A route on the building map from room A to
  room B; the visualizer already has pathfinding (`astar`,
  `buildMultiFloorGraph`, `computeTravelTimes`) that the published browser
  does not expose.
- **Substitute view.** One page: the absent teacher's day, their rooms, their
  classes, and a map — printable, and exactly what a sub needs at 7:15am.

## Moonshot / North Star

**Every "where is…" question in the building, answered in one tap, offline.**
Where is this teacher, where is this student's class, who is free now, which
room is empty, how do I walk from here to there, who can cover 3rd period —
answered from a published file that works on a phone in a hallway with no
signal, and that loudly tells you when it's out of date.

## Platform themes that matter here

- **P7 (cross-tool)** — this file is downstream of `schedule-visualizer.html`;
  most changes here are changes to the publisher.
- **P1 (theme)** — a hallway phone tool that's always white.
- **P8 (versioning)** — the staleness check is a good instinct; a version
  stamp and a "published on" date would make it precise.
- **P4 (accessibility)** — an SVG building map needs a text alternative.

## Open Questions

- Should improvements be specified here at all, or should this file simply
  point at `schedule-visualizer.html`? Kept separate here because the
  *reader's* experience is a different design problem from the *builder's*.
- Is this published for the whole staff, and if so does anything about it need
  to be different for a non-technical audience opening it on a phone?
