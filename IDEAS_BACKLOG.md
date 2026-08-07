# Ideas Backlog

Everything that's been suggested for the toolkit but hasn't been built yet. This file is the source of truth for
the list — the "coming soon" rows on `index.html` and the public [`ideas-backlog.html`](ideas-backlog.html) page
should both be kept in sync with whatever's here.

Reminder: coming soon means not right now.

## General / Classroom Logistics

| Idea | What it would do |
|---|---|
| Behavior & Points Tracker | A quick per-student tally or point system you can run live during class. |
| Exit Ticket / Bell Ringer Generator | Printable half-sheets or a rotating bank of daily warm-up prompts. |
| Rubric Builder | Build, save, and print grading rubrics. |
| Field Trip Permission Slip Generator | Fill in the trip details once, get a printable permission slip. |
| Grade Distribution Visualizer | Paste a gradebook export and see class-wide histograms and stats — a companion to the Final Grade Checker. |
| Digital Hall Pass / Sign-Out Log | Track and print who's out of the room and when. |

## English / Language Arts

| Idea | What it would do |
|---|---|
| Silent Reading (SSR) Log Tracker | Track books and pages read during independent reading time. |

## Science

| Idea | What it would do |
|---|---|
| Lab Group & Role Randomizer | Randomize lab groups and assign roles — recorder, materials, safety, etc. |
| Lab Safety Contract Tracker | Track signed lab safety contracts per student. |

## World Language

| Idea | What it would do |
|---|---|
| Vocab & Conjugation Drill Generator | Flashcard-style drills for vocabulary and verb conjugation. |

## Arts & PE

| Idea | What it would do |
|---|---|
| Tournament Bracket & Station Rotation | Brackets plus timed station rotation for PE units, paired with the Classroom Timer. |
| Gallery Walk QR Codes | Batch QR codes linking to student work for a gallery walk. |

## Blank Map Generator — Enhancement Ideas

Already built (`Tools/blank-map-generator.html`), but here's the wish list collected after building all five phases
of it end to end. These are improvements to an existing tool, not new standalone tools, so they don't get a "coming
soon" row on `index.html` — graduating one just means shipping it and deleting its row here.

| Idea | What it would do |
|---|---|
| Mercator-aware calibration | Add a projection-type choice (equirectangular vs. Mercator) so lat/long stays accurate on the very common Mercator-projected Commons maps, not just the equirectangular ones the current linear math assumes. |
| Draggable compass rose & locator inset | Both are pinned to a fixed corner right now; let them move like the legend already does, so they can be dragged out of the way of markers/labels. |
| Multiple saved map projects | Only one working map persists today. Add named save/switch, like the School Calendar Visualizer's year templates, so a teacher can keep separate annotated maps per unit without losing one to start another. |
| Per-legend-entry color & size | Every marker of a given style shares one fixed color. Let color (and maybe size) be set per legend entry, so e.g. two colors of star can mean two different things. |
| Freehand/line drawing tool | Arrows and lines for trade routes, migration paths, borders — the single most common thing a "blank map" labeling activity needs that this can't do yet. |
| Download as PNG | Export the finished map as an image file, not just through the browser print dialog, for dropping into a slide deck or worksheet. |
| Undo for delete | Deleting a label or marker (an easy misclick mid-drag, especially on a touchscreen) has no way back except re-placing and retyping it. |
| "Safe to hand out" license filter | A search toggle limiting results to Public Domain/CC0 maps, since classroom handouts should avoid anything with a restrictive attribution requirement. |
| Bigger touch targets | Delete buttons and drag handles are sized for a mouse; on a shared classroom tablet they're fiddly. |
| Search pagination | Results are capped at about a dozen with no "load more," so a niche regional map might never surface if it's not on the first page. |

## Picking one up

When an idea gets built for real:

1. Build it the normal way — one `.html` entry point in `Tools/`, matching subfolder for supporting assets if needed.
2. Remove its row from this file, and from `ideas-backlog.html`.
3. In `index.html`, delete its `.row.soon` placeholder and add a normal `<a class="row ink">` tool row in its place
   (see DEV NOTES item 6 in `index.html` for the exact steps and bookkeeping — record counts, memo/rev dates,
   changelog entry).
4. Add it to the `README.md` tools table.
