# East Middle Staff Toolkit

Small, single-file tools built for the day-to-day classroom logistics that eat prep time. Everything here runs entirely in the browser — no installs, no accounts, no data leaving your machine.

## Live site

`[add the hosted URL here once the domain/Pages setup is finished]` — or just open `index.html` from this repo.

## Tools

| Tool | File | What it does |
|---|---|---|
| East Middle Schedule Browser | `Tools/schedule-browser.html` | This year's actual A/B schedule, searchable by teacher, room, or period. Published from the School Layout Visualizer, below. |
| School Layout Visualizer | `Tools/schedule-visualizer.html` | Build a hyperlinked map of teachers, rooms, and clusters — and publish a schedule browser like the one above from it. |
| Final Grade Checker | `Tools/final_grade_checker.html` | Enter grades by hand or paste a TAC export, and check the math automatically. |
| Image → PDF Assembler | `Tools/image-to-pdf.html` | Combine photos into one clean PDF. |
| Name Picker | `Tools/Name Picker.html` | Pull a random student for cold-calls, groups, or who goes first. Rosters stay in your browser. |
| Seating Chart Generator | `Tools/Seating Chart Generator.html` | Build a chart once, then reshuffle it whenever you need to. |
| Word Doc Merger | `Tools/docx-merger.html` | Combine multiple Word docs into one, in order. |
| Sub Plan Builder | `Tools/Sub Plan Builder.html` | Fill in the boilerplate once (schedule, emergency info, phone numbers), then add today's lesson and export a ready-to-print sub plan as a Word doc. |
| School Calendar Visualizer | `Tools/School Calendar Visualizer.html` | Build a full-year calendar template — holidays, half days, workdays, grading periods, testing windows — and lay lesson pacing on top. Saves in your browser; print or export a backup. |
| Classroom Timer | `Tools/Classroom Timer.html` | Big-digit projector timer: countdown, transition presets, random-interval surprise cues, stopwatch, and round-robin stations. |
| Bracket / Tournament Generator | `Tools/bracket-tournament-generator.html` | Build a single-elimination bracket (byes handled automatically), run it live with click-to-advance picks, save/switch between multiple brackets, and print a blank copy. |
| Quiz / Review Game Board | `Tools/review-game-board.html` | A Jeopardy-style review board — type in questions or import them from an Excel sheet (Category/Points/Question/Answer columns), click a cell to reveal it, award points per team. |
| Certificate & Award Maker | `Tools/certificate-award-maker.html` | Five templates × four decorative borders, editable name/title/reason/date/signature with a live preview, and a batch mode that prints one certificate per name for a whole class. |
| Graph Paper & Number Line Generator | `Tools/graph-paper-generator.html` | Printable graph paper (fill-the-page or exact grid size), number lines (single or several per page), and coordinate planes (four-quadrant or first-quadrant), all sized true-to-scale for printing. |
| Math Fact Drill Sheet Generator | `Tools/math-drill-generator.html` | Randomized addition/subtraction/multiplication/division/mixed drill sheets with a matching answer key — a fresh sheet every time you generate. |
| Formula Reference Sheet Builder | `Tools/formula-sheet-builder.html` | Five topic templates (geometry, linear equations, quadratics, basic statistics) or start blank, customize and reorder the list, print a one-page reference sheet. Saves multiple named sheets. |
| Vocabulary Flashcard & Word Wall Generator | `Tools/vocab-flashcard-generator.html` | Paste a "term: definition" word list, print cut-apart flashcards (front/back pages, mirrored for double-siding) or large word-wall cards. Saves multiple named word lists. |
| Writing Prompt Generator | `Tools/writing-prompt-generator.html` | 200 prompts (100 middle school, 100 high school) across five genres, with a big projector-friendly display and a session history. |
| Timeline Builder | `Tools/timeline-builder.html` | Add events (exact years, BCE, or ranges/eras) with an optional photo each, pick a line style, view a scrolling on-screen timeline or a paginated print layout. Saves multiple named timelines. |
| Blank Map Generator | `Tools/blank-map-generator.html` | Search Wikimedia Commons for a map, pan/zoom into a region, and annotate it with draggable labels, markers (pin/star/dot/flag), and shaded polygon regions — all auto-building an editable legend. Optional compass rose, lat/long grid, and a locator inset. Undo for accidental deletes. Maps are cached for offline reuse; print or save as PDF. |
| Group / Team Generator | `Tools/group-team-generator.html` | Split a pasted or Name-Picker roster into random groups by count or size, with optional skill-balancing and "keep these two apart" constraints. Prints a clean group sheet. |
| Behavior & Points Tracker | `Tools/behavior-points-tracker.html` | Arm a behavior (built-in +1/-1, or an editable list of point-valued behaviors) and tap any student's card to apply it — a live, projector-friendly per-student point tally with an activity feed and undo. Archive a day into an expandable history and print a report of the current totals. Multiple named sections, and can load a Name Picker roster. |
| Data Table → Chart Builder | `Tools/data-chart-builder.html` | Paste a table from a spreadsheet or lab notebook, pick the columns, and get a bar, line, pie, or scatter chart with quick descriptive stats — download as PNG or SVG. |
| QR Scavenger Hunt Builder | `Tools/qr-scavenger-hunt-builder.html` | Type in stations (or paste them from a spreadsheet) and print a sheet of station QR codes sized however many-per-page you need, plus a separate answer key that never shares a page with the codes. |
| Silent Reading (SSR) Log Tracker | `Tools/ssr-log-tracker.html` | Track books and pages read during independent reading time, per student or for the whole class — multiple saved sections, a class summary table, and printable logs. |
| Lab Group & Role Randomizer | `Tools/lab-group-role-randomizer.html` | Randomize lab groups and assign roles (recorder, materials, safety, etc.) — remembers who's had which role so nobody's stuck as Recorder every lab. |
| Rubric Builder | `Tools/rubric-builder.html` | Build a grading rubric from a template or from scratch — editable criteria and performance levels, live point totals, print a clean landscape table. Saves multiple named rubrics. |
| Grade Distribution Visualizer | `Tools/grade-distribution-visualizer.html` | Paste a gradebook export and get class-wide stats, an editable letter-grade breakdown, and a score histogram — a companion to the Final Grade Checker. |
| Vocab & Conjugation Drill Generator | `Tools/vocab-conjugation-drill.html` | Vocabulary quiz drills (any language) and verb-conjugation tables with editable person/subject labels, each with a printable answer key. |
| Gallery Walk QR Codes | `Tools/gallery-walk-qr.html` | Batch-generate QR codes linking to student work for a gallery walk, printed in a configurable grid, plus a plain-text reference sheet for you. |
| Backup & Restore | `Tools/backup-restore.html` | Scans your browser for everything every tool on this site has saved and downloads it as one file, or restores it back on a new computer or after a wiped cache. |

## Using these

- **Online:** visit the live site and click through from the toolkit page.
- **Offline:** clone or download this repo and open any of the `.html` files above directly — no server or build step required.

## Repo structure

`index.html` at the repo root is the toolkit landing page. Each tool's own entry point is a single `.html` file inside `Tools/`. Supporting scripts, fonts, and libraries for a given tool live in a matching subfolder under `Tools/` (e.g. `Tools/final-grade-checker/`, `Tools/schedule/`, `Tools/seating-chart/`). You shouldn't need to touch those unless you're editing the tool itself.

## Ideas backlog

Planned-but-not-built tools (subject-specific ones included) are tracked in [`IDEAS_BACKLOG.md`](IDEAS_BACKLOG.md),
and shown as "coming soon" entries on the [live toolkit page](index.html) and on
[`ideas-backlog.html`](ideas-backlog.html).

## Feedback

Found a bug, or want something a tool doesn't do yet? Reach out directly — feedback's always welcome.