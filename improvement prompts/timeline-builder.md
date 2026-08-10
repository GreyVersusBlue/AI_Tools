# Improvement Prompts — 015 — Timeline Builder

**Tool file:** `Tools/timeline-builder.html`
**Support folder:** `Tools/timeline-builder/` — `tlb-layout.js`, `tlb-photo.js`, `tlb-store.js`

**Current description (from README):** Add events (exact years, BCE, or ranges/eras) with an optional photo each, pick a line style, view a scrolling on-screen timeline or a paginated print layout. Saves multiple named timelines.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

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
- **Wall-timeline tiled printing** (Quick Win, P7) — `blank-map-generator.html`
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
  hallway. `blank-map-generator.html` already implements tiled poster printing
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
  `blank-map-generator.html` covers where. A combined print — timeline along
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
  against (P7, `rubric-builder.html`) and a share format for submission.

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
