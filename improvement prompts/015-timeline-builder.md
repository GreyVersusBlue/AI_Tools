# Improvement Prompts — 015 — Timeline Builder

**Tool file:** `Tools/015-timeline-builder.html`
**Support folder:** `Tools/timeline-builder/` — `tlb-layout.js`, `tlb-photo.js`, `tlb-store.js`

**Current description (from README):** Add events (exact years, BCE, or ranges/eras) with an optional photo each, pick a line style, view a scrolling on-screen timeline or a paginated print layout. Saves multiple named timelines.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

### Pass 2 — Round 2 — 2026-08-13

Shipped the **tiled wall-timeline print** Quick Win (P7, P6) — the item both
Round 1 and Round 3 explicitly flagged as still open, pointing at
`046-blank-map-generator.html`'s `printTiledPages` as the pattern to reuse.

- **Correction to the backlog premise going in:** the assignment described
  reusing `printTiledPages`'s approach of rasterizing the content onto a
  virtual `<canvas>` and slicing that into per-page `<img>`s. That's the
  right move for the map tool because it already renders to a pannable
  canvas. The timeline renders as plain positioned DOM (`renderTimelineCanvas`
  builds `<div>`s for the line, markers, labels, era bands, gridlines — no
  canvas or SVG anywhere in the file), and there is no vendored
  html-to-canvas/rasterization library in `_shared/vendor/` to add one
  (and CLAUDE.md's vendoring rule means that's not a decision to make
  lightly for one tool). So this shipped as a **pure CSS crop-and-scale** of
  cloned DOM instead of a canvas rasterization: build one full-size,
  off-screen copy of the real spatial timeline (`buildTimelinePoster()`,
  reusing `renderTimelineCanvas` — the exact function the on-screen scrolling
  view already calls, so colors/eras/gridlines/tracks are guaranteed
  identical to what's on screen), then for each output page, clone that
  whole poster and position it with `transform: scale(...)` plus a
  `left`/`top` offset inside an `overflow: hidden` page box, so only that
  page's slice is visible. Text and lines print vector-crisp, not as a raster
  image, and there's no `img.decode()`-on-a-fresh-`toDataURL()` race to guard
  against for the timeline geometry itself (only the event photos, which are
  already-loaded `<img src="data:...">` elements being cloned, not newly
  rasterized — still waited on before printing, out of caution, the same way
  every other print path in this repo does).
- **The cols x rows picker means something different here than in the map
  tool, and that's a second, smaller premise correction worth recording.**
  Blank Map's `cols`/`rows` size a poster canvas at the map's *current pan/
  zoom* — more tiles just capture more of whatever the user is already
  looking at, and content can run off the edge of the grid with no warning.
  The timeline has no independent zoom control, and "spread the whole
  timeline across taped-together sheets" only means something if the whole
  timeline is actually on the sheets. So `cols`/`rows` here instead set a
  target page grid, and the whole timeline is scaled **uniformly** (never
  stretched non-uniformly on one axis, never silently cropped) to the
  largest size that fits entirely inside that grid — `scale =
  Math.min(pageGridWidth / posterWidth, pageGridHeight / posterHeight)`,
  centered in the leftover space on whichever axis doesn't divide evenly.
  Picking more columns makes the print bigger and more legible; more rows
  helps a multi-track timeline that's tall relative to how wide the grid is.
- **A legend page is appended automatically** when the timeline uses
  category colors (`TimelineLayout.collectCategories(state.events).length`),
  built from the same `legendHtml()` helper the screen/print views already
  use — so a colored wall timeline doesn't lose its color key once it's cut
  apart from the editor page. Mirrors Blank Map's optional legend-page
  behavior for the same reason (a key with no context is useless on a wall).
- **Landscape, not portrait, tiles** — a horizontal timeline tapes together
  more naturally as a strip of landscape sheets than portrait ones. The
  injected `@page { size: landscape; margin: 0.4in; }` deliberately leaves
  the paper size unspecified (just the orientation) rather than hardcoding
  Letter, so it works on A4 printers too; it's added right before
  `window.print()` and removed again on `afterprint` (new
  `#tiledPageSizeStyle` `<style>` element, same technique Blank Map uses for
  `setPrintPageSize`) so a tiled print never leaves the plain single-page
  Print button stuck in landscape afterward.
- **Alongside, not replacing**, the existing single-page print: a new "Wall
  print (tiled)…" secondary button next to the existing Print button opens a
  small panel (Columns / Rows selects, matching the spirit of Blank Map's
  own tiled-print panel) without touching `printMode`, `printBtn`,
  `printViewHtml`, or anything else the existing print path uses.

**Verified**: `npm ci` (this repo had no `node_modules` yet in this
worktree) then a manual headless Playwright pass (Chromium at
`/opt/pw-browsers/chromium-1194`, not committed as a permanent suite —
`Tools/timeline-builder/` has no `test/` folder) against a 5-event timeline
spanning 476 CE to 1969 with 3 categories: added the events, opened the tiled
panel, set 3 columns x 1 row, clicked "Print tiled pages", and confirmed —
zero console/page errors, zero offsite requests — that it built exactly 4
page elements (3 tile pages + 1 legend page), the legend page listed all 3
categories, and the page-number labels read "Page 1 of 4" / "Page 2 of 4" /
"Page 3 of 4" correctly. Re-ran with `page.emulateMedia({media:'print'})` and
checked real bounding rects: the leftmost tile page showed only the earliest
event's marker inside its own crop rectangle, the rightmost tile page showed
only the two latest events', and the same three marker elements (cloned into
every tile page, then clipped by `overflow:hidden`) reported bounding boxes
outside a tile's own rect wherever they weren't supposed to be visible on
that page — confirming the scale/offset math actually crops distinct,
correctly-ordered regions of the timeline per page rather than just
repeating the same view three times. Also re-ran the *existing* single-page
Print button afterward (in the same session, after a tiled print) and
confirmed `#printArea` still renders normally in `@media print` — the new
`body.tiled-printing`-scoped rules don't leak into the plain print path.
One assertion needed a workaround, not a fix: headless Chromium's
`window.print()` is a documented no-op that never fires `afterprint` at all
(confirmed on a bare page with no other logic, isolated from this tool's own
code) — the `afterprint` cleanup listener (clearing `tiled-printing`,
emptying `#tiledPrintPages`, removing the injected `@page` style) was instead
verified by dispatching a synthetic `afterprint` event and checking all
three effects fired correctly; this is a headless-testing limitation shared
by Blank Map Generator's own tiled print, not something either tool's code
can work around.

### Challenges

- The task framing (correctly, per the assignment's own wording) anticipated
  adapting the map's canvas-rasterization pattern to "however the timeline
  actually renders." Reading `renderTimelineCanvas` first — before writing
  any tiling code — showed the render target is `<div>`s with inline pixel
  widths and CSS `position: absolute` children, not a canvas, which ruled
  out reusing `drawMapContent`-style pixel drawing entirely and pointed at a
  CSS-transform crop instead. Grepping the file for `<canvas` or `getContext`
  first (finding neither) would have saved a moment of instinctively reaching
  for `canvas.toDataURL()` out of habit from the map tool.
- Getting the off-screen poster's *measured* size right took one wrong turn:
  a bare `<div>` appended to `document.body` is block-level and stretches to
  fill the viewport width by default, so `getBoundingClientRect()` on it
  reports the *viewport's* width, not the timeline's actual (often much
  wider) content width — silently producing a poster far too narrow and
  scaling everything wrong. `display: inline-block` on the wrapper fixes it
  by shrink-wrapping to the canvas's own explicit inline-style width, caught
  by reasoning through the CSS box model rather than by trial and error, and
  confirmed correct in the bounding-rect verification pass above (the tiled
  pages actually show *different* content on each page, not the same crop
  three times).

### Where the next round should pick up

- **Wall-timeline tiled printing is done** as of this round — the item below
  from Round 1/Round 3 pointing at it is now stale; left in place per this
  file's own convention of not retroactively pruning older rounds' notes (see
  e.g. Round 1's own note that "compressed scale" stayed listed in Quick Wins
  below even after Round 1 shipped it — the Status section, top-down, is the
  source of truth for what's actually shipped).
- **Map handoff** (Major Feature, P7 — timeline along the bottom, map above,
  events pinned to both) is still the most distinctive unbuilt idea in the
  file, and would now have two tiled-print implementations to draw on for its
  own combined print.
- The legend page added to the tiled print reuses the screen legend's fixed
  8-color palette as-is; if a future round changes how >8 categories are
  handled (still an open item below), the tiled legend page inherits
  whatever that becomes for free since it calls the same `legendHtml()`.
- Not attempted here: a "fit to N pages, tell me how many you'll need"
  auto-suggestion for cols/rows. The teacher currently has to guess-and-check
  ("3 columns felt small, try 4"); computing a recommended grid from the
  poster's natural aspect ratio and a target minimum on-page font size would
  remove that guesswork.

### Where the next round should pick up

Shipped the **logarithmic/compressed scale** Quick Win flagged at the end
of Round 3 as "probably the single most requested remaining capability."

- `tlb-layout.js` gained `yearToUnit(year, minYear, maxYear, scaleMode)` and
  `yearToX(...)`, a shared axis-mapping pair now used internally by
  `computeLayout`, `computeGridlines`, and `computeEraBands` (each grew a
  trailing `scaleMode` parameter, defaulting to `'linear'` when omitted so
  every existing call site — and every already-saved timeline — renders
  pixel-for-pixel identical to before this shipped).
- **Compressed mode never uses a raw `Math.log(year)`.** Year values cross
  zero and go negative for BCE dates, where a plain log is undefined or
  discontinuous. Instead the transform is anchored to `e = maxYear - year`
  ("years before the recent end of the range," always ≥ 0) and applies
  `log1p` to that, normalized against `log1p(span)`. This is a strictly
  increasing function of `year` for any `span > 0`, which is what
  guarantees the ordering requirement for free: distinct years always
  produce distinct, correctly-ordered positions in compressed mode exactly
  as in linear mode. Verified directly in Node — synthetic events from
  3000 BCE to 2020 CE stay strictly monotonic and NaN-free under both
  modes (see verification below).
- The **total canvas width is unchanged by scale mode** — compressed mode
  redistributes pixels *within* the same `(range) * pxPerYear` budget
  rather than resizing the scroll area. Only the *internal* spacing
  changes: recent years get much more of that budget, ancient years get
  much less.
- **Gridlines needed their own fix, not just a pass-through.** Under
  compression the same fixed year-interval that reads fine linearly
  crowds into unreadable clumps of overlapping labels toward the
  compressed (ancient) end, where px-per-year keeps shrinking as you go
  back. `computeGridlines` now thins consecutive ticks that would land
  within 30px of each other — but **only when `scaleMode === 'compressed'`**;
  linear mode's tick selection is untouched, verified byte-for-byte
  against the pre-existing behavior. Stress-tested with an extreme
  200,000-year span at a forced small `pxPerYear`: went from 203 linear
  gridlines to 74 after compressed-mode thinning, all still ≥30px apart
  and correctly labeled.
- **UI**: a third "Scale" select (Linear / Compressed) added next to Line
  style / Labels in the editor card (new `.row3` CSS class, so the
  existing `.row2` used elsewhere — era years, event years — is
  untouched). Stored as `state.scaleMode`, defaults to `'linear'` on new
  timelines, backfilled to `'linear'` on load/import for any
  timeline saved before this shipped.
- **Wiring turned out simpler than the category-color-map precedent from
  Round 3.** That map genuinely has three independent call sites
  (`renderTimelineCanvas`, `legendHtml`, `printEventsHtml`) built from three
  different event lists. Position/pixel layout does not: `computeLayout` /
  `computeGridlines` / `computeEraBands` are called from exactly **one**
  place in the whole file, `renderTimelineCanvas`, which both the
  on-screen scrolling view and the compare view already funnel through
  (each just hands it a different `{events, eras, tracks, ...}` bundle).
  Adding `scaleMode` to that one shared bundle covers screen + compare in
  one edit each. The **print layout has no position/pixel math to wire at
  all** — `printEventsHtml` was already a plain top-to-bottom sorted list,
  never a spatial axis — confirmed by grepping the whole file for
  `computeLayout`/`computeGridlines`/`computeEraBands` call sites before
  touching anything, so there was nothing to break or silently miss there.
  The compare view uses the currently-edited timeline's `state.scaleMode`
  as the one shared axis mode for both timelines being compared (same
  pattern already used for `state.lineStyle`/`state.compactLabels` as the
  "default" argument in that call).

**Verified**: a Node script exercising `tlb-layout.js` directly (no DOM)
with 14 synthetic events from 3000 BCE to 2020 CE confirmed strict
monotonic ordering and zero `NaN` in both modes, and that the pixel gap
between two closely-dated modern events (2010 and 2015) is **10px under
linear vs. ~714px under compressed** — a 71x difference, using the exact
scenario named in the problem statement. A headless Playwright pass
(Chromium at `/opt/pw-browsers/chromium-1194`) then drove the real page:
added 8 events spanning the same range, toggled Linear ⇄ Compressed on
the on-screen view, the print preview, and the compare view (against a
second saved timeline), watching the console throughout — zero errors in
any view, any mode. A visual screenshot comparison caught the exact
"one pixel" bug in the original problem statement in the wild: under
linear scale, the on-screen labels for 2010/2015/2020 visibly overlap
into unreadable stacked text ("2 0 1 0 2 0 1 5 2 0 2 0"); under
compressed scale the same three events render as three cleanly separated,
individually-legible labels.

### Challenges

- The natural instinct for "log scale" is a raw `Math.log`, and it took a
  moment to notice why that's wrong here specifically: BCE years are
  negative, and a timeline can span the zero-crossing (476 CE and 44 BCE
  need to coexist on the same axis as 2020 CE). Anchoring the transform to
  a nonnegative "years before the recent end" distance sidesteps that
  entirely, and turned out to also be exactly what guarantees strict
  monotonicity — order falls out of the math for free rather than needing
  a separate stable-sort safeguard.
- Assumed going in (per the task framing) that position layout would have
  the same three-call-site shape as `buildCategoryColorMap` from Round 3.
  It doesn't — grepping first rather than assuming saved a wasted attempt
  at wiring a print-view call site that doesn't exist, since print never
  positions events by year at all.
- Gridline thinning needed a real design decision, not just "reuse
  `gridlineInterval`": picking a coarser year-interval globally would
  under-serve the now-spacious recent end, while leaving the fixed
  interval as-is crowds the compressed ancient end. Filtering by minimum
  pixel gap *after* mapping through the new transform (rather than
  changing the year-interval-picking logic itself) solved both at once,
  and — since it's gated on `scaleMode === 'compressed'` — cannot regress
  linear mode's already-tuned tick spacing.

### Where the next round should pick up

- **Wall-timeline tiled printing** (Quick Win, P7) — `046-blank-map-generator.html`
  already has `printTiledPages` to reuse — is still open.
- **Map handoff** (Major Feature, P7 — timeline along the bottom, map above,
  events pinned to both) is still the most distinctive unbuilt idea in the
  file.
- More than 8 categories in one timeline needs a real answer (patterns or a
  documented cap), not just silent color reuse.
- Compressed mode currently anchors "more room" to the *end of the visible
  range* (`maxYear`), not to "today." For a timeline that ends in the past
  (e.g. a unit on the fall of Rome, nothing after 476 CE), that's exactly
  right — the most recent thing *in the timeline* gets the room. But it's
  worth flagging as a design choice, in case a future ask wants compression
  anchored to the actual present date regardless of what the last event is.
- The 30px gridline-thinning threshold in `computeGridlines` is a fixed
  constant, not derived from font size or label width — fine at the sizes
  tested, but worth revisiting if a future round changes `.grid-label`
  type size.

### Round 3 (2026-08-10) — shipped

- **Colour-code by category, with a legend.** Events get an optional free-text
  "Category" field (with a `<datalist>` of already-used categories for
  autocomplete). `tlb-layout.js` gained `collectCategories()` and
  `buildCategoryColorMap()` — the map assigns each distinct category a
  color from a fixed 8-color palette **by first-seen order**, not by
  hashing the string. A hash was tried first and rejected during testing: it
  put "Cultural" and "Technological" on the identical color, which silently
  defeats the entire point of a legend. The map is built once per render
  from the exact event list being drawn (screen, print, and the compare
  view all build their own, from their own combined event list) so the
  legend and the markers it describes can never drift apart. Colors repeat
  past 8 distinct categories in one timeline — flagged, not solved.
- **Blank / student-fill print mode.** A "Print mode" select next to the
  Print button: Full, "Blank titles" (dates stay, title replaced with a
  fill-in line), or "Blank dates" (title stays, date replaced with a
  fill-in line) — the standard fill-in-the-timeline worksheet, generated
  from the same event data instead of a hand-built separate sheet. The
  print-layout preview updates live when the mode changes.
- Confirmed **century/decade gridlines** (`computeGridlines` /
  `gridlineInterval` in `tlb-layout.js`) and **photo downscaling + storage
  warning** (`tlb-photo.js`, `save()`'s `storageWarn` banner) were already
  built — both were on the file's own Quick Wins list but shipped in an
  earlier pass not recorded here. Read the actual source before picking
  Quick Wins in a future round; the list undersells what's already done.

Verified in a headless Chromium run (four events, three categorized, one
not): legend shows exactly the three categories used, each a different
color both in the legend swatches and on the on-screen markers; print
preview in "blank titles" mode hides all four titles and keeps all four
dates (and vice versa for "blank dates"); a caught color-collision bug was
fixed and reverified before calling this done.

### Challenges

- The category-color collision above is the one worth remembering: a string
  hash into a small fixed palette *looks* fine with two or three
  categories in ad-hoc manual testing and only breaks with the "wrong"
  pair of words, which is exactly the kind of bug that survives a quick
  visual check and ships. Caught here only because the test script asserted
  on legend text with three specific category names rather than eyeballing
  a screenshot once.
- Deciding where the color map gets built was the actual design question —
  building it independently in three places (screen canvas, print, compare)
  from three different event lists would reintroduce the same
  drift-between-legend-and-markers risk in a different form. Solved by
  making `buildCategoryColorMap` a pure function of "the exact event list
  about to be drawn" and calling it fresh at the top of each render path.

### Where the next round should pick up

- **Logarithmic/compressed scale** for a timeline spanning millennia into
  the present (Quick Win) is still open and is probably the single most
  requested remaining capability — right now a 3000 BCE–2000 CE timeline
  still puts all of recorded history in a few pixels.
- **Wall-timeline tiled printing** (Quick Win, P7) — `046-blank-map-generator.html`
  already has `printTiledPages` to reuse — is still open.
- **Map handoff** (Major Feature, P7 — timeline along the bottom, map above,
  events pinned to both) is still the most distinctive unbuilt idea in the
  file.
- More than 8 categories in one timeline needs a real answer (patterns or a
  documented cap), not just silent color reuse.

## What it does today

- Events with exact years, **BCE support**, and ranges/eras; optional photo
  each (`tlb-photo.js`)
- **Multiple tracks** (`renderTrackList`, `ensureTracks`, `updateEvTrackOptions`)
  — parallel timelines on one axis
- Layout options: all above the line, compact alternating; solid / dashed /
  dotted line styles
- Two views: **on-screen scrolling** and **paginated print layout** with a
  preview (`renderPrintPreview`, `printViewHtml`)
- **Tiled wall-timeline print** (`printTiledPages`, `buildTimelinePoster`) —
  spreads the spatial timeline across a chosen cols x rows grid of landscape
  pages, scaled to fit and overlapping slightly at each edge, plus an
  auto-appended category legend page, for taping into a hallway wall print
- **Compare two timelines** (`renderCompareView`, `ensureTracksForCompare`)
- Multiple saved timelines (`gvb-timeline:list` / `:data:*`), JSON
  import/export

## Quick Wins

- **Logarithmic or compressed scale.** A timeline spanning 3000 BCE to 2000 CE
  puts everything modern in one pixel. A break-the-axis marker, or a
  compressed-empty-centuries mode, is the difference between a usable timeline
  and a line with a clump on it.
- **Blank / student-fill version.** Print the timeline with the events removed
  and the dates left, or vice versa — the standard worksheet, and one small
  print mode.
- **Colour-code by category** (political, cultural, technological) with a
  legend, which is what makes a multi-track timeline readable.
- **Duration bars for eras**, visually distinct from point events.
- **Century/decade tick marks and gridlines** so a reader can estimate a date
  without measuring.
- **Wall-timeline print** — tiled across several sheets to tape up in a
  hallway. `046-blank-map-generator.html` already implements tiled poster printing
  (`printTiledPages`) and the code is reusable (P7).
- **Downscale and warn on photos** (P12).

## Major Features

- **Projected navigation mode.** Pan and zoom the timeline on the projector,
  tap an event to expand it, and step through a period chronologically — a
  timeline is a navigational object and is wasted as a static image, and the
  teacher driving it is the classroom-appropriate way to use that.
- **Printed ordering activity.** Given ten events on cut-apart cards, students
  place them in sequence on paper — generated from the timeline along with a
  teacher answer key. The layout engine already has everything needed.
- **Map handoff** (P7). Every historical event has a place;
  `046-blank-map-generator.html` covers where. A combined print — timeline along
  the bottom, map above, events pinned to both — would be a distinctive
  classroom artifact that no free tool produces.
- **Comparative timelines as a first-class teaching device.** Compare mode
  exists; framing it as "what was happening in China while this happened in
  Europe" — with a shipped set of reference timelines for major periods —
  would turn a feature into a lesson.
- **Shipped timeline library.** World history, US history, and a few science
  ones, ready to load and edit (P15). The content is the product for this
  kind of tool.
- **Student-built timelines as an assignment** — a rubric to score them
  against (P7, `003-rubric-builder.html`) and a share format for submission.

## Moonshot / North Star

**The class timeline that lives on the wall.** Built once per unit, printed
tiled across a hallway wall, navigable on the projector when you're teaching
into it, comparable against a reference timeline of what was happening
elsewhere, linked to the class map so every event has a place as well as a
date, and printable as a blank for the unit test and as cut-apart cards for an
ordering activity.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-navigable timeline** by share link, and an on-screen drag-to-order
  activity students do themselves. The projected navigation mode and the
  printed cut-apart ordering activity above cover both.

## Platform themes that matter here

- **P7 (cross-tool)** — tiled printing exists in the map tool; the
  map/timeline pairing is the strongest content idea.
- **P12 (storage/images)** — per-event photos base64'd into `localStorage`.
- **P6 (print quality)** — the paginated layout is good; tiled wall printing
  is the next step.
- **P3 (share links)** — sending a timeline to a colleague; student-facing
  output is printed.

## Open Questions

- How much shipped timeline content is worth authoring? Like the number-talks
  library, the content is the value and it's writing rather than coding.
- Should the timeline and the map become one "historical context" tool, or
  stay separate and share a data format for dated, placed events?
