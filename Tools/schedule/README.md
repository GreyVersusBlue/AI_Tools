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
nothing errors. Before changing the publish path, keep a copy of its output.

```bash
node Tools/schedule/test/publish.mjs before.html
# ...make the change...
node Tools/schedule/test/publish.mjs after.html
diff before.html after.html
```

The fixture's `savedAt` is a fixed string rather than `new Date()` so the two
runs differ only where you changed something. The publish date in the footnote
is still today's, so expect one line of diff for free.

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
