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

Already built and continuously extended (`Tools/blank-map-generator.html`) — this is the wish list of further
enhancements collected since. These are improvements to an existing tool, not a new standalone tool, so they don't
get a "coming soon" row on `index.html` — graduating one just means shipping it and deleting its row here.

| Idea | What it would do |
|---|---|
| Upload your own map image | Let a teacher use a scanned or custom map file directly, bypassing Wikimedia Commons entirely, for district-specific or textbook maps that aren't on Commons. |
| Auto-computed scale bar | Once a map is calibrated, show a real-world distance scale bar (e.g. "500 km") computed from the projection math. |
| Accessibility hatching for regions/lines | Optional hatch/pattern fills as an alternative or addition to color, so shaded regions and lines stay distinguishable for colorblind students. |
| Batch marker placement from coordinates | Paste a "name, lat, lon" list and auto-place matching markers at once on a calibrated map, instead of clicking each one by hand. |
| Keyboard nudge + legend reordering | Arrow-key nudge for a selected label/marker's position, and drag-to-reorder legend rows instead of first-placed-first-listed order. |
| Multi-page tiled print | Print a heavily zoomed-in, detailed map across multiple tiled pages (poster-style) instead of squeezing it onto one sheet. |
| Full undo/redo history | Broaden the current "undo the last delete" into a real undo/redo stack covering moves and edits too, not just deletions. |

## Picking one up

When an idea gets built for real:

1. Build it the normal way — one `.html` entry point in `Tools/`, matching subfolder for supporting assets if needed.
2. Remove its row from this file, and from `ideas-backlog.html`.
3. In `index.html`, delete its `.row.soon` placeholder and add a normal `<a class="row ink">` tool row in its place
   (see DEV NOTES item 6 in `index.html` for the exact steps and bookkeeping — record counts, memo/rev dates,
   changelog entry).
4. Add it to the `README.md` tools table.
