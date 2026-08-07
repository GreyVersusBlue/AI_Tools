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