# `Tools/schedule/`

Everything the School Layout Visualizer needs that is not the HTML file itself.

```
Tools/035-schedule-visualizer.html   the tool
Tools/034-schedule-browser.html      a published snapshot, committed and served
Tools/schedule/fonts/            vendored woff2 + the embedded-font build
Tools/schedule/test/             the smoke suite and its fixture
_shared/vendor/jspdf/            jsPDF, one site-wide copy (035 loads it from there)
```

Neither HTML file makes an offsite request. Both used to.

## Running the suite

```bash
node Tools/schedule/test/smoke.mjs
```

42 assertions, exit code 1 on any failure. It boots the generator in headless
Chromium, imports a fake school, publishes a Schedule Browser, opens that file
from `file://` with no server, and uses it. It also checks the committed
`034-schedule-browser.html` and the generator as the site serves them.

It borrows the static server and browser launch from
`Tools/board-check/harness.mjs`, which belongs to another thread and is only
ever read.

## The regression baseline

The generator is a generator: its template can silently drop a column and
nothing errors. Since Path 11 P1 (2026-10-25) the baseline is committed and
held by two checks, one with a browser and one without.

```bash
npm run test:schedule-publish            # publish Northwind, diff against the baseline
node Tools/schedule/test/smoke-publish-baseline.mjs --update   # after a change you meant
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

`node Tools/schedule/test/publish.mjs out.html` still writes a publish to a
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
node Tools/schedule/test/fixture-northwind.mjs
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

The suite drives one path: import, publish, use. The blueprint editor, the
pathfinding engine, the congestion heatmap, the travel-time playback and the
What-If lab have no tests. That is roughly two thirds of the file.
