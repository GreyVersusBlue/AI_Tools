# Improvement Prompts — Timeline Builder

**Tool file:** `Tools/timeline-builder.html`
**Support folder:** `Tools/timeline-builder/` — `tlb-layout.js`, `tlb-photo.js`, `tlb-store.js`

**Current description (from README):** Add events (exact years, BCE, or ranges/eras) with an optional photo each, pick a line style, view a scrolling on-screen timeline or a paginated print layout. Saves multiple named timelines.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

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

- **Interactive on-screen mode for students** via a share link (P3) — pan the
  timeline, tap an event, quiz yourself on the order. A timeline is a
  navigational object and is wasted as a static image.
- **Drag events onto the line.** An ordering activity — given ten events,
  place them in sequence, check yourself — is the most common timeline
  exercise and needs exactly the layout engine already written.
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

**The class timeline that lives on the wall and in every student's hand.**
Built once per unit, printed tiled across a hallway wall, viewable and
navigable on a student device, comparable against a reference timeline of what
was happening elsewhere, linked to the class map so every event has a place as
well as a date, and printable as a blank for the unit test.

## Platform themes that matter here

- **P7 (cross-tool)** — tiled printing exists in the map tool; the
  map/timeline pairing is the strongest content idea.
- **P12 (storage/images)** — per-event photos base64'd into `localStorage`.
- **P6 (print quality)** — the paginated layout is good; tiled wall printing
  is the next step.
- **P3 (share links)** — a student-navigable timeline.

## Open Questions

- How much shipped timeline content is worth authoring? Like the number-talks
  library, the content is the value and it's writing rather than coding.
- Should the timeline and the map become one "historical context" tool, or
  stay separate and share a data format for dated, placed events?
