# `Tools/schedule-visualizer/`

Everything the School Layout Visualizer (035) needs that is not the HTML file
itself. Until v324 this was two folders, `Tools/schedule/` (the fonts, the
publish suite and its fixture) and `Tools/schedule-visualizer/` (the modules);
Path 11 P2 folded the first into the second, last, as its design said.

```
Tools/035-schedule-visualizer.html   the tool: markup, settings, storage pairs, the BRIDGE
Tools/034-schedule-browser.html      a published snapshot, committed and served (its own page)
Tools/schedule-visualizer/           the modules below, sv.css, this README
Tools/schedule-visualizer/fonts/     vendored woff2 + the embedded-font build
Tools/schedule-visualizer/test/      every 035 suite, the Northwind fixture, P1's contract,
                                     ledger and baseline, P2's goldens and size ledger
_shared/vendor/jspdf/                jsPDF, one site-wide copy (035 loads it from there)
```

Neither HTML file makes an offsite request. Both used to.

## The modules

Path 11 P2 (`BACKLOG.md`, "Path 11", the P2 bullet) took the page from
974,675 bytes to under 300 KB in eleven increments; `test/size-ledger.json`
holds the page's size and records each module's. The page's one
`<script type="module">` imports every module and puts it on `window`. Two
shapes:

- **Engines**, pure: they take their inputs and touch neither `AppState` nor
  the DOM. The page reaches them through one thin wrapper per old name in its
  `BRIDGE` section, so the bare-name call sites did not change.
  `sv-model.js` (settings, labels, bell, weights, conflicts, the blueprint's
  serialise/migrate/validate, ids, the lockdown maps' and door signs' content), `sv-graph.js` (the multi-floor graph, A*, the
  graph cache, and the step-free and evacuation graphs), `sv-routes.js` (group
  day paths, congestion, evacuation, the step-free report and route sheets),
  `sv-congestion.js` (congestion data, travel times, the what-if arithmetic),
  `sv-playback.js` (a playback frame, the collision simulation), and, new
  rather than moved, `sv-check.js` (the fourteen schedule checks, their
  fingerprints, the accepted-finding store's rules and the one sentence for
  each kind; Path 11 P5).
- **Views**, moved verbatim: they own a tab's DOM and read the page's
  classic-script globals at call time (listed in each file's `/* global */`
  comments), and the module script copies their exports onto `window`
  (`Object.assign(window, …)`), which is the global surface the classic script
  had. `sv-browser.js` (the Schedule Browser and the publisher; see below),
  `sv-viz.js` (the Visualize tab and the playback bar), `sv-editor.js` (the
  blueprint editor and the evacuation cards' and lockdown maps' pictures), `sv-schedules-tab.js` (the
  groups list and editor, CSV import, the bulk editor), `sv-whatif.js` (room
  search and the what-if lab's controls), `sv-access.js` (the step-free report
  and route sheets as printed sheets, through the print kit; Path 11 P3),
  `sv-safety.js` (the evacuation cards, one per room, the lockdown maps, one
  per floor, and the door signs, per teacher, through the print kit; Path 11 P4),
  `sv-checks-view.js` (the Schedules tab's checks banner, the group cards' and
  bulk editor's marks, the room panel's capacity line, the what-if lab's
  Constraint Checks panel and Publish's warning; it keeps `stviz_checks`,
  the accepted findings, `{ v: 1, acks }`; Path 11 P5).

Older and separate: `sv-recovery.js` (recovery points), `sv-handoff.js`
(WebRTC hand-off), `sv-trace-image.js` (a classic `defer` script, the trace
image underlay). `sv.css` is the page's main stylesheet.

**The parse-time rule.** The classic script runs while the page parses and
the modules after it, before `DOMContentLoaded`. So nothing in the classic
script may call, or hand out a reference to, a module's function at parse time.
`test/bridge.test.mjs` follows every top-level statement's synchronous calls
and fails on a path that reaches one. It does not see a bare reference (an
`addEventListener('click', fn)` at top level); increment 10 found three of
those by hand and moved them into the module beside their functions.

**What stays on the page,** because other code assigns or reads it as a
binding (a classic script cannot see a module's `let`): `AppState` and its
`viz` and `whatif` parts, `let canvas, ctx` and the viz canvas lets (the door
cards and the what-if lab swap `ctx` and `vizCtx` to draw off screen),
`FloorManager`, the heat-zone id counter, `GROUP_COLOR_PRESETS`, the storage
pairs, and the settings, bell and subjects editors.

## The suites

`npm run test:schedule` (`test/smoke.mjs`: import, publish, open the published
file from `file://`), `test:schedule-publish` (the baseline below),
`test:schedule-visualizer` (recovery, evacuation cards, lockdown maps, door signs), `-trace`, `-print`,
`-editor` (`smoke-editor.mjs`, port 8552: paints a plan with real mouse
events, pairs stairs, undoes, reloads), `test:schedule-check-smoke`
(`smoke-checks.mjs`, port 8554: the checks banner, accept, capacity, publish), `test:layout-bell-from-calendar`, and
the pure-Node `-size`, `-model`, `-graph`, `-routes`, `-congestion`,
`-playback`, `-bridge`, `-step-free`, `-evac-cards`, `-safety-sheets`, and
`test:schedule-check` (`check.test.mjs`). `node Tools/board-check/run-suites.mjs --only schedule`
runs them all, with 034's `Tools/schedule-browser/` suites. The engine suites
compare each module with a golden file written by running the same cases
through the page's own functions before the move.

## The regression baseline

The generator is a generator: its template can silently drop a column and
nothing errors. Since Path 11 P1 (2026-10-25) the baseline is committed and
held by two checks, one with a browser and one without.

```bash
npm run test:schedule-publish            # publish Northwind, diff against the baseline
node Tools/schedule-visualizer/test/smoke-publish-baseline.mjs --update   # after a change you meant
npm run check:publisher                  # the static guard, no browser (runs in CI)
```

`test/baseline-northwind.html` is what Publish makes from the fixture with the
page's clock pinned to 2026-01-15 17:00 UTC, with the 103 KB font block cut to
one line holding its SHA-256 and length. The suite names every section that
moved (page head, BR_CSS, markup, data, each constant and function, boot) with
its first differing line. If the change is meant, run `--update` and commit the
baseline's diff with it: that diff is the review. The suite also holds
`check-publisher.mjs`'s `assemble()` to the real published `<script>` byte for
byte, and the published data to `test/published-contract.mjs`.

Since v62 (Path 11 P1 increment 2) a published file's data starts with
`format: 1` and `tool` (the `TOOL_VERSION` that wrote it), `publishedOn` is the
local date (it was the UTC date, so a file published after 8 pm eastern was
dated tomorrow), and every `<` in the data is written `\u003c`, so a school,
room or teacher name holding a closing script tag cannot end the published
script. A file with no `format` is format 0: every file published up to v61,
034's included. It is still read; `test/fixture-published-format0.json` is
Northwind as v61 published it, and the suite opens today's file with that data
put back in and checks the same teacher's day. The suite also opens the file
from `file://` and walks it until every published piece has run (Chromium's JS
coverage; `brDShort` is the one listed as unreachable, since only the
unpublished legacy map calls it), publishes a school named `</script><b>`,
publishes at 23:30 in Los Angeles, and breaks 035 itself on the way in with
`page.route()`, each break named by its own section.

`npm run check:publisher` reads 035's publisher as text and fails on a listed
function that is not one top-level declaration, a free name, a construct that
is not strict, a handler or element id the published file lacks, a preamble
`let` that has drifted from the live one, anything live-only, a `<link>` in the
head, and 034's copy of a published piece against `test/publisher-ledger.json`.
Its header lists the codes. `--explain <name>` shows where 034's copy of a
piece parts from 035's.

`node Tools/schedule-visualizer/test/publish.mjs out.html` still writes a publish to a
path you give it, today's date and all.

## The fixture

`test/fixture-northwind.mjs` is a small invented school: two floors, eleven
rooms, ten teachers, four groups, A/B blocks. Every name is made up, and
everything in this folder has to stay that way — `034-schedule-browser.html` is
committed to a public repository and served from a public domain.

`test/fixture-northwind.json` is the same object written out, so it can be
dropped into the tool's own **Import Full Project** button by hand. Regenerate
it after editing the module, or the suite fails:

```bash
node Tools/schedule-visualizer/test/fixture-northwind.mjs
```

## 034 is a snapshot, not a copy — the two files have drifted

`Tools/034-schedule-browser.html` was published from 035 and then **edited in
this repo**, round after round, while 035's `BR_CSS` and browser script stayed
where they were. Measured 2026-09-07, on the stylesheets as they stood before
Path 5 P4: **87 lines of CSS in 034 that no version of 035 has** (the PNG
download button, the copy-link button and staleness banner, the personal-notes
column, the common-planning and substitute views, the door sign,
`.gchip.active`) and 11 the other way, which are comments. On top of that 034
has three tab modes and their render functions that 035 has never had.
(`BACKLOG.md` said "~109 diff lines"; the figure is the same measurement read
off a slightly wider slice.) **A change to the browser therefore lands in both
files, independently.** Re-publishing 034 from 035 today would delete every
one of those features, so do not "resync" them; treat 034 as a second
implementation that happens to share a stylesheet's worth of rules.

Two mechanisms hold the pieces that MUST agree:

- `Tools/schedule-browser/test/smoke-mode-tabs.mjs` compares the tab markup
  the publisher emits against the tab markup 034 ships (Round 8's fix had to
  land in three places — 035's live copy, its publisher template, and 034).
- `Tools/schedule-browser/test/smoke-dark-theme.mjs` compares the **theme**
  region byte for byte: the palette block and everything from the dark block
  to the end of the stylesheet. That region is the one part of the CSS that is
  supposed to be identical in both files, and the suite fails the moment it is
  not.

Two things about the palette that are easy to break (Path 5 P4, 2026-09-07):

- **`BR_CSS` is a JavaScript template literal.** A backtick anywhere inside it
  ends the string and the rest of the stylesheet is parsed as JavaScript; the
  symptom is a `SyntaxError` naming a CSS property, several hundred lines from
  the backtick. Do not use backticks in its comments.
- **Three different things own `data-theme` on a page showing this browser** —
  `_shared/a11y.js` on 034, 035's own palette switcher inside the visualizer,
  and nothing at all in a file a teacher was emailed. The last case is the one
  `body.br-published` gates, and it is why `prefers-color-scheme` must not
  apply to the embedded copy. The dark block's own comment spells this out.

## After regenerating the committed browser file

`brPublish()` writes a plain `<head>`; it does not emit the `gvb:social`
markers, and it should not — a file a teacher emails to staff has no business
carrying `greyversusblue.com` Open Graph tags. So replacing
`Tools/034-schedule-browser.html` with a fresh publish drops its social block.

Putting it back is a hand edit: copy the `gvb:social:start`/`gvb:social:end`
block out of git history for that file and paste it into the fresh publish.
There is no generator. `Tools/board-check/sync-social-tags.mjs`, which an
earlier version of this README invoked through an npm script named `social`,
was never committed to this repo — see `CLAUDE.md`'s guardrails section. What does
exist is read-only and rewrites nothing:

```bash
node Tools/board-check/check-social.mjs     # validates, prints the drift
```

## What is not covered

The modules moved without changing a rule; the doubtful ones (a heat-exclude
zone checked against the floor the editor is showing for a cell with no
`floorId`; a room with no subject publishing as `ELA`) are named in the engine
suites and left for P5. A*'s reopen branch is reached by no fixture. The
what-if lab and the schedules tab are held by their arithmetic's goldens and by
`test:csv-adopters` (the groups template) only; nothing drives their controls.
No module has been checked on a real phone or with a real school's file.
