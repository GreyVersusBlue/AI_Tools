# Improvement Prompts — East Middle Schedule Browser

**Tool file:** `Tools/schedule-browser.html`
**Support folder:** `Tools/schedule/` — fonts, `libs/jspdf/`

**Current description (from README):** This year's actual A/B schedule, searchable by teacher, room, or period. Published from the School Layout Visualizer, below.

---

## Status

**2026-08-10 — Round 7 (PR #60): four Quick Wins shipped directly to this
file, plus a critical bug found and fixed in the publisher (see
`schedule-visualizer.md`).**

**Read this before touching this file again:** this file and
`schedule-visualizer.html`'s `brPublishFnList()`/`brBuildPublishedMarkup()`
had already drifted apart before this round — this file has "R61"/"R62"/"R63"
features (PNG download, copy/share links, the staleness banner, Common
Planning/Compare mode) that **do not exist anywhere** in
`schedule-visualizer.html`'s source, meaning a real "Publish" today would
regenerate this file **without** all of them. Full detail and the fix
decision are in `schedule-visualizer.md`'s Status section — the short version
is: a genuinely more severe crash bug (`escHtml`/`escJsAttr` undefined in the
published scope) got fixed there this round, but the R61–R63 feature gap did
not — porting ~300 lines of untested feature code into a 19,400-line file
was judged too large and risky for this round. **The four Quick Wins below
were therefore applied by hand directly to this real, shipped file** (which
is what East Middle staff actually use today), not to the publisher — so
they will be **lost on the next real "Publish"** until someone either backs
them into the generator or manually re-applies them after republishing. That
tradeoff is spelled out here so it isn't a surprise later.

- **Done — Save a home teacher.** A "☆ Set as my schedule" button on any
  teacher's view stores their name in `localStorage` (`br_home_teacher`);
  on the next visit (after any URL deep link is tried first) it opens
  straight to that teacher instead of the empty search state.
- **Done — Show the staleness warning prominently.** Moved `#br-stale-banner`
  from below the whole schedule panel to directly under the header, and
  restyled it from a soft yellow note to a bordered amber alert with a ⚠
  prefix — it was easy to miss at the very bottom of a long page; now it's
  the first thing on screen when it fires.
- **Done — "Who's Free Right Now."** A new toolbar mode next to Common
  Planning: pick a day (A/B — there's no day-of-week calendar in this file,
  so the day itself stays a manual toggle) and a period, and see every free
  teacher, grouped and sorted the same way the rest of the app does. Bell
  times (`PUBLISHED_DATA.bell`, format `"8:30–10:00"`, no AM/PM marker) are
  parsed to auto-select the current period on open, on the assumption that
  any hour below 8 in that string means PM — true for any real school day.
- **Done — Print a door-sized sign.** A "Print door sign" button next to
  Download/Share builds one big compact card (name, room, department) into a
  normally-hidden `#br-door-sign` element and prints just that, via a
  `body.door-print-mode` class that hides `#app-browser` for the duration.
  Wallet-sized was the other size mentioned in this Quick Win but was
  skipped — a laminated door sign is the more commonly useful physical
  format of the two, and building both would have doubled the print-layout
  work for less benefit.

Verified end-to-end in headless Chromium against the real file (not a test
fixture): Free Right Now correctly lists free teachers per period, the home
teacher setting persists across a full page reload and auto-opens, the
staleness banner's new DOM position was confirmed relative to the panel, and
the door sign print path correctly toggles its class off after
`window.print()` returns. A regression pass confirmed Compare mode, Group
view, and Building Map still work — `brCompareSel` (not just the DOM chip
count, which was briefly a flaky read) was checked directly to confirm two
distinct teachers add cleanly.

**Where a future round should pick up:** the R61–R63 backport into
`schedule-visualizer.html` (see above) is the single highest-value and
highest-risk item now on the table for this tool pair — it should be its own
dedicated round with room to actually drive the visualizer's UI and verify
the live preview, not a Quick Win squeezed in alongside other work. Coverage
finder, room finder, and the substitute view (Major Features below) are all
still open and would benefit from the free-period computation this round
added (`brFreeTeachersFor`) being available to build on.

Ideas below are deliberately ambitious and **not** scoped to a single
session.

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

- **Done —** **"Who is free right now?"** The compare mode already computes free periods;
  answering it for the current time and day is a one-tap version of the most
  common real question. *(Shipped as a new "Who's Free Now" mode rather than
  extending Compare — see Status for why the day can't be auto-detected.)*
- **Where is this student right now?** By-group view plus the current period
  answers it; the office asks this several times a day. *(Partly enabled —
  Free Right Now answers "who", not "where's this specific group right now";
  still open.)*
- **Done —** **Save a home teacher.** Opening straight to your own schedule rather than
  a search box every time.
- **Add to phone home screen / offline** — the site has a service worker, so
  a teacher's own schedule should be reliably available with no signal in a
  hallway.
- **Already exists.** **Bell times on the schedule.** Period numbers without times are half the
  information. *(`brDayRows` already prints `PUBLISHED_DATA.bell` next to
  each period when present — this file was stale on that point. What was
  missing was *using* those same bell times to guess the current period,
  which Free Right Now now does.)*
- **Partly done.** **Print a wallet-sized or door-sized version** — the two physical formats
  that actually get used. *(Shipped door-sized only — see Status.)*
- **Done —** **Show the staleness warning prominently.** A schedule browser showing last
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
- **Raised 2026-08-10.** Now that this round's four Quick Wins were applied
  directly to this file rather than the publisher (see Status), should this
  file be treated as **the** source of truth going forward — i.e. should
  someone eventually make `schedule-visualizer.html` regenerate *from* the
  current shape of this file, rather than the other way around? The R61–R63
  drift this round found suggests the "publisher is the source of truth"
  model has already broken down once in practice.
