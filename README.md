# School Staff Toolkit

Small, single-file tools built for the day-to-day classroom logistics that eat prep time. Everything here runs entirely in the browser — no installs, no accounts, no data leaving your machine.

## Live site

`[add the hosted URL here once the domain/Pages setup is finished]` — or just open `index.html` from this repo.

## Tools

| Tool | File | What it does |
|---|---|---|
| East Middle Schedule Browser | `schedule-browser.html` | This year's actual A/B schedule, searchable by teacher, room, or period. Published from the School Layout Visualizer, below. |
| School Layout Visualizer | `schedule-visualizer.html` | Build a hyperlinked map of teachers, rooms, and clusters — and publish a schedule browser like the one above from it. |
| Final Grade Checker | `final_grade_checker.html` | Enter grades by hand or paste a TAC export, and check the math automatically. |
| Image → PDF Assembler | `image-to-pdf.html` | Combine photos into one clean PDF. |
| Name Picker | `Name Picker.html` | Pull a random student for cold-calls, groups, or who goes first. Rosters stay in your browser. |
| Seating Chart Generator | `Seating Chart Generator.html` | Build a chart once, then reshuffle it whenever you need to. |

## Using these

- **Online:** visit the live site and click through from the toolkit page.
- **Offline:** clone or download this repo and open any of the `.html` files above directly — no server or build step required.

## Repo structure

Each tool's entry point is a single `.html` file at the repo root. Supporting scripts, fonts, and libraries for a given tool live in the matching subfolder (e.g. `final-grade-checker/`, `schedule/`, `seating-chart/`). You shouldn't need to touch those unless you're editing the tool itself.

## Feedback

Found a bug, or want something a tool doesn't do yet? Reach out directly — feedback's always welcome.
