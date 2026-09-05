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
