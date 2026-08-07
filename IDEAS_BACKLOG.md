# Ideas Backlog

Everything that's been suggested for the toolkit but hasn't been built yet. This file is the source of truth for
the list — the "coming soon" rows on `index.html` and the public [`ideas-backlog.html`](ideas-backlog.html) page
should both be kept in sync with whatever's here.

Reminder: coming soon means not right now.

## General / Classroom Logistics

| Idea | What it would do |
|---|---|
| Group / Team Generator | Random groups with constraints — keep certain students apart, balance skill levels. Would reuse the Name Picker's saved roster. |
| Behavior & Points Tracker | A quick per-student tally or point system you can run live during class. |
| Exit Ticket / Bell Ringer Generator | Printable half-sheets or a rotating bank of daily warm-up prompts. |
| Rubric Builder | Build, save, and print grading rubrics. |
| Field Trip Permission Slip Generator | Fill in the trip details once, get a printable permission slip. |
| Grade Distribution Visualizer | Paste a gradebook export and see class-wide histograms and stats — a companion to the Final Grade Checker. |
| QR Scavenger Hunt Builder | Batch-generate a set of station QR codes plus an answer key, building on the existing QR Code Generator. |
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
| Data Table → Chart Builder | Turn lab data into a quick chart to paste into a report. |

## Social Studies

| Idea | What it would do |
|---|---|
| Blank Map Generator ⚠️ claimed | Printable blank maps by region for labeling activities. **Already being built in a separate chat, on branch `claude/map-builder-tool-aduz3m` — don't pick this one up here.** |
| Timeline Builder | Build a printable or on-screen timeline of events. |

## World Language

| Idea | What it would do |
|---|---|
| Vocab & Conjugation Drill Generator | Flashcard-style drills for vocabulary and verb conjugation. |

## Arts & PE

| Idea | What it would do |
|---|---|
| Tournament Bracket & Station Rotation | Brackets plus timed station rotation for PE units, paired with the Classroom Timer. |
| Gallery Walk QR Codes | Batch QR codes linking to student work for a gallery walk. |

## Picking one up

When an idea gets built for real:

1. Build it the normal way — one `.html` entry point in `Tools/`, matching subfolder for supporting assets if needed.
2. Remove its row from this file, and from `ideas-backlog.html`.
3. In `index.html`, delete its `.row.soon` placeholder and add a normal `<a class="row ink">` tool row in its place
   (see DEV NOTES item 6 in `index.html` for the exact steps and bookkeeping — record counts, memo/rev dates,
   changelog entry).
4. Add it to the `README.md` tools table.
