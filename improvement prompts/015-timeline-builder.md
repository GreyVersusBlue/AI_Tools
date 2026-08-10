# Improvement Prompts — 015 — Timeline Builder

**Tool file:** `Tools/015-timeline-builder.html`
**Support folder:** `Tools/timeline-builder/` — `tlb-layout.js`, `tlb-photo.js`, `tlb-store.js`

**Current description (from README):** Add events (exact years, BCE, or ranges/eras) with an optional photo each, pick a line style, view a scrolling on-screen timeline or a paginated print layout. Saves multiple named timelines.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

### Pass 2 — Round 1 — 2026-08-10 — session `v19h3x`

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
