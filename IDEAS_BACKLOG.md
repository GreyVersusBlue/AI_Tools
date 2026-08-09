# Ideas Backlog

Everything that's been suggested for the toolkit but hasn't been built yet. This file is the source of truth for
the list — the "coming soon" rows on `index.html` and the public [`ideas-backlog.html`](ideas-backlog.html) page
should both be kept in sync with whatever's here.

Reminder: coming soon means not right now.

## General / Classroom Logistics

No open ideas on the list right now — everything collected so far has shipped. Add new ones here as they come up.

## Math

No open ideas on the list right now — everything collected so far has shipped. Add new ones here as they come up.

## English / Language Arts

No open ideas on the list right now — everything collected so far has shipped. Add new ones here as they come up.

## Science

No open ideas on the list right now — everything collected so far has shipped. Add new ones here as they come up.

## Social Studies

No open ideas on the list right now — everything collected so far has shipped. Add new ones here as they come up.

## World Language

No open ideas on the list right now — everything collected so far has shipped. Add new ones here as they come up.

## Arts & PE

No open ideas on the list right now — everything collected so far has shipped. Add new ones here as they come up.

## Existing Tools — Enhancement Ideas

These are improvements to tools that are already built and live on the site, not new standalone tools — so none of
these get an `index.html` "coming soon" row. This mirrors the open, unclaimed suggestions from
[`TOOL_IMPROVEMENTS_PLAN.md`](TOOL_IMPROVEMENTS_PLAN.md) in a friendlier read; that file stays the working list
Claude sessions pick bullets from (including its 🔒 claim tags), so check there for the most current, most granular
version.

**Rank** is a single priority order across this whole table, 1 = most important, no ties. It's what makes "work on
the next 10 most important ideas" a well-defined request — take the 10 lowest-numbered rows. See "Working this
ranked list" under [Picking one up](#picking-one-up) for how to keep the numbering contiguous as rows get removed.

| Rank | Tool | Idea | What it would do |
|---|---|---|---|
| 1 | Vocab & Conjugation Drill Generator<br>`Tools/vocab-conjugation-drill.html` | "Listen" button per word/verb form | Add spoken pronunciation via the browser's built-in text-to-speech, with a language selector — the tool is billed as "for any language" but has no audio today. |
| 2 | Writing Prompt Generator<br>`Tools/writing-prompt-generator.html` | Add your own prompts to the rotation | Let a teacher blend in custom prompts stored locally instead of only the built-in 200. |
| 3 | Vocabulary Flashcard & Word Wall Generator<br>`Tools/vocab-flashcard-generator.html` | Paste straight from a spreadsheet | Support tab-separated/CSV paste so a list can come straight from a Google Sheet or Excel column instead of typing "term: definition" by hand. |
| 4 | Timeline Builder<br>`Tools/timeline-builder.html` | Parallel/comparison timeline track | Add the second timeline track the tool's own UI already flags as "not supported yet," so two related timelines (e.g., a country's history vs. world history) can be viewed stacked on the same year axis. |
| 5 | Digital Escape Room / Puzzle Lock Builder<br>`Tools/escape-room-builder.html` | Optional whole-room countdown | Add a timer baked into the player link that shows on the student's lock screen — a common escape-room mechanic that's missing today. |
| 6 | Math Fact Drill Sheet Generator<br>`Tools/math-drill-generator.html` | Custom operand ranges | Let a teacher set the min/max range per template instead of the fixed 1–12/1–20 ranges baked in today, so a 3rd grader drilling to 5 and a 5th grader drilling to 100 aren't stuck with the same range. |
| 7 | Graph Paper & Number Line Generator<br>`Tools/graph-paper-generator.html` | Independent range per number line copy | When printing several number lines on one page, let each have its own min/max/interval instead of forcing identical copies — useful for differentiated worksheets. |
| 8 | Seating Chart Generator<br>`Tools/Seating Chart Generator.html` | Optional student photo on the desk | Let a teacher attach a small local photo per student so a substitute can match faces to names at a glance. |
| 9 | Silent Reading Log Tracker<br>`Tools/ssr-log-tracker.html` | Weekly pages/minutes goal | Add an optional per-class goal shown as a simple progress indicator next to each student's row in the summary. |
| 10 | Number Talks / Mental Math Routine Board<br>`Tools/number-talks-board.html` | Printable handout of the current string | Add a print-friendly version of the number string on screen, for an absent student or as a written record. |
| 11 | Command Center<br>`Tools/command-center-dashboard.html` | Real feature parity for the built-in timer | It's currently a stripped-down duplicate of Classroom Timer's countdown (no progress ring, only one sound); bring it closer to parity so it can be a real replacement instead of a second, weaker timer. |
| 12 | Exit Ticket / Bell Ringer Generator<br>`Tools/exit-ticket-generator.html` | A different prompt per printed slip | Let a printed sheet carry a different prompt on each slip (e.g., one per table group) instead of repeating the same prompt to fill the page. |
| 13 | Writing Prompt Generator<br>`Tools/writing-prompt-generator.html` | Roster-paste, one prompt per student | Randomly pair each pasted name with a distinct prompt and print a one-page assignment sheet for independent writing stations. |
| 14 | Vocabulary Flashcard & Word Wall Generator<br>`Tools/vocab-flashcard-generator.html` | On-screen self-quiz/flip mode | Add a click-to-reveal quiz mode, like the one already in the conjugation drill tool, so cards are usable directly with a student at a screen and not just for printing. |
| 15 | Vocab & Conjugation Drill Generator<br>`Tools/vocab-conjugation-drill.html` | Print vocab + conjugation together | Let both sections print as a single packet instead of two fully separate outputs. |
| 16 | Vocab & Conjugation Drill Generator<br>`Tools/vocab-conjugation-drill.html` | Quick-start pronoun presets | Add one-click Spanish/French/German/Latin person-label sets instead of retyping them from the same Spanish default every time. |
| 17 | Math Fact Drill Sheet Generator<br>`Tools/math-drill-generator.html` | Multiple distinct versions at once | Add a "generate N different sheets" option (Version A/B/C) that prints several randomized versions back to back — useful for preventing copying during timed drills. |
| 18 | Certificate & Award Maker<br>`Tools/certificate-award-maker.html` | Multiple named presets | Save more than one theme/border/signature combo, the way Rubric Builder and Formula Sheet Builder already save multiple named documents — today only the single last-used settings object persists. |
| 19 | Graph Paper & Number Line Generator<br>`Tools/graph-paper-generator.html` | Multiple named presets | Save more than one settings profile (e.g., "Algebra 1 graphing" vs. "6th grade fractions") instead of one global settings object. |
| 20 | Immersion Roleplay Scenario Generator<br>`Tools/roleplay-scenario-generator.html` | Add your own scenarios | Let teachers save custom scenarios (title, roles, setup, scaffolding phrases) merged into the shuffle/print pool, instead of being limited to the 34 built-in ones. |
| 21 | Primary Source Analysis Worksheet Generator<br>`Tools/primary-source-analysis-generator.html` | More frameworks | Add one or two more analysis frameworks (e.g., APPARTS, or a simplified "5 W's" for younger/EL students) alongside the existing OPTIC/SOAPSTone pair. |
| 22 | Novel Study / Reading Circles Manager<br>`Tools/novel-study-circles-manager.html` | Numeric chapter/page checkpoint | Add an optional number field alongside the free-text checkpoint, so a group falling behind is easy to spot at a glance instead of only comparable by reading free text. |
| 23 | Exit Ticket / Bell Ringer Generator<br>`Tools/exit-ticket-generator.html` | QR code on the printed slip | Add an optional small QR code linking to a digital response form, reusing the QR generation already built elsewhere in the toolkit. |
| 24 | Writing Prompt Generator<br>`Tools/writing-prompt-generator.html` | Print the current prompt as a poster | For classrooms that post the daily prompt on a wall rather than only projecting it. |
| 25 | Image → PDF Assembler<br>`Tools/image-to-pdf.html` | Contact-sheet layout | Add an "N images per page" grid option for printing thumbnail overview sheets, not just one image per page. |
| 26 | Schedule Browser<br>`Tools/schedule-browser.html` | Direct link to one schedule | Add a copy-link/share button on a teacher's or group's result so a colleague can be sent straight to that view instead of told how to search for it. |
| 27 | Number Talks / Mental Math Routine Board<br>`Tools/number-talks-board.html` | Personal bank of favorite number strings | Let a teacher save their own custom strings into a small persistent bank instead of only pulling from the built-in categories or typing a one-off each time. |
| 28 | Blank Map Generator<br>`Tools/blank-map-generator.html` | Duplicate a project | Spin off a per-class or per-period copy of a finished map without hand-recreating every label, marker, and region. |
| 29 | Blank Map Generator<br>`Tools/blank-map-generator.html` | Point-to-point distance measuring | Click two spots on a calibrated map to read the real-world straight-line distance between them — distinct from the existing fixed-length scale bar reference. |
| 30 | Math Fact Drill Sheet Generator<br>`Tools/math-drill-generator.html` | Fact-family templates | Add narrower templates like "×6 facts only" or "÷ by 7 only." |
| 31 | Schedule Browser<br>`Tools/schedule-browser.html` | "Last updated" staleness banner | Flag the published snapshot as out of date if it's older than a configurable threshold (e.g. 60 days) — right now there's no signal beyond a small footnote. |
| 32 | PE Tournament & Station Rotation<br>`Tools/pe-tournament-stations.html` | Printable per-station cards | Add one large-text slip per station to tape up physically, separate from the combined schedule table that prints today. |
| 33 | Immersion Roleplay Scenario Generator<br>`Tools/roleplay-scenario-generator.html` | Randomly assign roles | Add a "randomly assign role A/B" button for fairness when partners are deciding who plays which role. |
| 34 | Immersion Roleplay Scenario Generator<br>`Tools/roleplay-scenario-generator.html` | Proficiency-level tag/filter | Add Novice/Intermediate/Advanced tagging alongside the existing category filter. |
| 35 | Immersion Roleplay Scenario Generator<br>`Tools/roleplay-scenario-generator.html` | Per-class scaffolding | Save filled-in scaffolding phrases per class/session instead of per scenario, so switching classes doesn't overwrite one class's answers with another's. |
| 36 | Vocab & Conjugation Drill Generator<br>`Tools/vocab-conjugation-drill.html` | Share a drill set between teachers | Add JSON export/import so language teachers on the same team can share a built conjugation table. |
| 37 | Primary Source Analysis Worksheet Generator<br>`Tools/primary-source-analysis-generator.html` | Share a built worksheet | Add JSON export/import so a department can share a worksheet (source + framework + notes) between colleagues. |
| 38 | Primary Source Analysis Worksheet Generator<br>`Tools/primary-source-analysis-generator.html` | Custom follow-up question per step | Let a teacher add their own question after the built-in guiding questions. |
| 39 | Primary Source Analysis Worksheet Generator<br>`Tools/primary-source-analysis-generator.html` | Configurable answer space | Make the number of blank answer lines per step adjustable instead of fixed. |
| 40 | Primary Source Analysis Worksheet Generator<br>`Tools/primary-source-analysis-generator.html` | Upload a local image | Support attaching a source image from a file instead of only an external image URL. |
| 41 | Vocabulary Flashcard & Word Wall Generator<br>`Tools/vocab-flashcard-generator.html` | Auto-shrinking text for long definitions | Prevent overflow/clipping on fixed-size cards when a definition runs long. |
| 42 | Math Fact Drill Sheet Generator<br>`Tools/math-drill-generator.html` | Optional timed-fluency header | Add a blank "Start time / End time" or "Target: ___ seconds" line, since the tool is framed as a drill tool but has no fluency-tracking element today. |
| 43 | Immersion Roleplay Scenario Generator<br>`Tools/roleplay-scenario-generator.html` | Read-aloud accessibility | Wire up the shared accessibility helper already used by sibling tools (vocab/conjugation drill, writing prompt generator) so the stage content gets the same treatment. |
| 44 | School Layout Visualizer<br>`Tools/schedule-visualizer.html` | Trace over a real floor plan | Import a photo or scan of the school's actual floor plan as a low-opacity background to trace over, instead of placing every room from a blank grid. |
| 45 | School Layout Visualizer<br>`Tools/schedule-visualizer.html` | Hand off an in-progress layout | Reuse the same QR/WebRTC pairing already used by Classroom Timer so two staff can co-edit the blueprint on separate devices over Wi-Fi, instead of manual JSON export/import. |
| 46 | School Layout Visualizer<br>`Tools/schedule-visualizer.html` | Copy publish HTML to clipboard | Let the "Publish for Teachers" step copy the generated file straight to the clipboard, so publishing doesn't need a local download-then-upload round trip through GitHub's web editor. |
| 47 | Digital Escape Room / Puzzle Lock Builder<br>`Tools/escape-room-builder.html` | Live "teacher monitor" view | Show which station each team has reached in real time on the teacher's own screen, using the toolkit's existing WebRTC/QR pairing pattern, instead of having to walk the room to check. |
| 48 | Digital Escape Room / Puzzle Lock Builder<br>`Tools/escape-room-builder.html` | Optional image per clue | Let a station carry a photo, the way Timeline Builder attaches photos to events, for picture-based puzzles instead of text-only clues. |

## Platform-Wide — Big Swings

Cross-cutting infrastructure ideas, not new standalone tools — they'd touch the landing page or several existing
tools at once rather than adding one new `.html` entry point. Same rule as the Blank Map Generator section above:
no `index.html` "coming soon" row for these, since there's no single new tool page to point one at. Ambitious, and
all still within GitHub Pages' static-hosting limits (no server, no accounts, no database) — several lean on
browser APIs the toolkit doesn't use yet.

No open ideas on the list right now — everything collected so far has shipped. Add new ones here as they come up.

## Picking one up

When an idea gets built for real:

1. Build it the normal way — one `.html` entry point in `Tools/`, matching subfolder for supporting assets if needed.
2. Remove its row from this file, and from `ideas-backlog.html`.
3. In `index.html`, delete its `.row.soon` placeholder and add a normal `<a class="row ink">` tool row in its place
   (see DEV NOTES item 6 in `index.html` for the exact steps and bookkeeping — record counts, memo/rev dates,
   changelog entry).
4. Add it to the `README.md` tools table.

### Working the ranked Existing Tools list

The "Existing Tools — Enhancement Ideas" table doesn't follow steps 3–4 above (no `index.html` row, no README entry
— it's an improvement to a tool already listed there, not a new one), and it has one extra rule the other sections
don't: **Rank must stay a contiguous 1..N sequence with no gaps and no ties.**

- To pick up a batch, take the N lowest-numbered rows (e.g. "the next 10" = ranks 1–10).
- When a row ships (or is abandoned), delete it from the table in `IDEAS_BACKLOG.md` and `ideas-backlog.html`, then
  renumber every remaining row so the ranks are contiguous again starting at 1 — e.g. if ranks 1–10 just shipped,
  old #11 becomes new #1, old #12 becomes new #2, and so on.
- If you're adding a newly-noticed enhancement idea rather than removing one, insert it at whatever rank reflects
  its priority and bump every row at or below that rank down by one to keep the sequence contiguous.
