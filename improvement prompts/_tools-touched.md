# Tools Touched — round tracker

> **Read this before picking a tool to work on.**
>
> This file records which tools have already had an implementation round, so
> that successive sessions spread across the toolkit instead of piling onto
> the same handful. **Do not pick a tool from the "Already done" list until
> every tool below has had a round** — even if its own file is full of
> tempting unbuilt ideas. Every tool's file is full of unbuilt ideas; that is
> what they are for.
>
> Multiple agent sessions work this list concurrently, often on the same
> calendar day — a date alone doesn't tell you who's doing what. **Claim a
> tool before you build it** (see "How to use this file" below) so a
> concurrent session can see, at a glance, which tools are already spoken
> for and by which session, not just which ones shipped yesterday.
>
> When the "Not yet touched" list is empty, that is the signal to **reset**:
> move every tool back to "Not yet touched", start a new round-number series,
> and begin the second pass. Devon may also reset it early, or move a specific
> tool back up, and that overrides everything here.

## How to use this file

1. Read this file first. Pick from **Not yet touched** — skip anything
   already listed in **Currently claimed**, even if no PR exists for it yet.
2. **Claim it before you build.** Add a row per tool to **Currently
   claimed**: the tool name, your session code, the UTC timestamp, and your
   branch name (see "Claiming a tool" below for exactly how). Commit and
   push that claim-only change by itself, before writing any implementation
   code, so a concurrent session sees your claim before picking its own
   batch.
3. Do the work, following the repo conventions in the root `CLAUDE.md` —
   in particular: vendored third-party libraries live in `_shared/vendor/`
   (one canonical copy, never a fresh per-tool copy); tool subfolders use
   `lib/`, never `libs/`; link `_shared/` boilerplate (theme, a11y,
   sw-register) instead of inlining a copy; and any file you add, rename,
   or delete means updating `PRECACHE_URLS` in `sw.js` and bumping
   `CACHE_VERSION` in the same commit. Then update that tool's own
   `improvement prompts/<tool>.md` with what shipped, what was hard, and
   where the next round should pick up.
4. When you finish: remove the tool's row from **Currently claimed** and
   from **Not yet touched**, and add it to **Already done**, in the table
   for your round — header the round like
   `### Pass N — Round M — <timestamp UTC> — session <code> — PR #NN`
   (see the Pass 2 example under "Not yet touched" below) so the round
   itself carries the same session code and time-stamped identity its claim
   did.
5. Abandoning a claim without shipping? Delete its row from **Currently
   claimed** and leave the tool in **Not yet touched** — don't leave a dead
   claim sitting there for the next session to trip over.
6. Do **not** edit `_platform-themes.md` — it is read-only reference material
   shared by parallel sessions.

Only the claim table, the round tables, and the two lists below change. Keep
the format.

### Claiming a tool

Every session working this repo is already on its own branch named
`claude/<something>-<code>`, where `<code>` is a short random suffix unique
to that session/branch (for example `claude/tools-touched-review-maptjt` →
session code `maptjt`). That code is the agent code — no need to invent a
separate identifier, just read it off your own branch name. If you haven't
created your branch yet, do that first.

To claim a tool, add a row to the **Currently claimed** table, one row per
tool, filling in the four columns like this:

```
| <Tool Name> | `<code>` | <output of `date -u +"%Y-%m-%d %H:%M UTC"`> | `<full branch name>` |
```

Push that row by itself before starting implementation work. A claim more
than **~6 hours old with no matching PR** is stale — safe to treat as
abandoned and reclaim (say so in your commit message if you do; sessions can
stall or get interrupted, this isn't an accusation).

---

## Tool ID registry

Every tool in the toolkit gets a permanent internal ID, assigned once and
never reused or renumbered — regardless of which list a tool sits in below,
or how many times it moves between "Not yet touched," "Currently claimed,"
and "Already done" across future passes. This ID is for internal tracking
only (round notes, cross-references, future tooling); it is not a public
tool number and has no bearing on display order anywhere on the site.

IDs were assigned in the order each tool first appears in this file's own
history: the 46 tools from Pass 1 (Rounds 1–10), in the order their round
tables list them, followed by the 35 tools added at the Pass 2 reset, in the
order they're listed in that reset note. Tools were **not** regrouped by
category or renumbered — this is simply the order they already showed up
in.

When a new tool joins the toolkit, give it the next unused ID by appending a
row to the bottom of this table. Never renumber or reuse an existing row,
even if a tool is later retired.

| ID | Tool | File |
|---|---|---|
| 001 | Digital Hall Pass / Sign-Out Log | `001-hall-pass-log.md` |
| 002 | Group / Team Generator | `002-group-team-generator.md` |
| 003 | Rubric Builder | `003-rubric-builder.md` |
| 004 | Classroom Timer | `004-classroom-timer.md` |
| 005 | Seating Chart Generator | `005-seating-chart-generator.md` |
| 006 | Class Roster Hub | `006-class-roster-hub.md` |
| 007 | Name Picker | `007-name-picker.md` |
| 008 | Behavior & Points Tracker | `008-behavior-points-tracker.md` |
| 009 | Backup & Restore | `009-backup-restore.md` |
| 010 | Command Center | `010-command-center-dashboard.md` |
| 011 | Image → PDF Assembler | `011-image-to-pdf.md` |
| 012 | Graph Paper & Number Line Generator | `012-graph-paper-generator.md` |
| 013 | Lab Safety Contract Tracker | `013-lab-safety-contract-tracker.md` |
| 014 | Immersion Roleplay Scenario Generator | `014-roleplay-scenario-generator.md` |
| 015 | Timeline Builder | `015-timeline-builder.md` |
| 016 | QR Code Generator | `016-qr-code-generator.md` |
| 017 | Gallery Walk QR Codes | `017-gallery-walk-qr.md` |
| 018 | QR Scavenger Hunt Builder | `018-qr-scavenger-hunt-builder.md` |
| 019 | Digital Escape Room / Puzzle Lock Builder | `019-escape-room-builder.md` |
| 020 | Bracket / Tournament Generator | `020-bracket-tournament-generator.md` |
| 021 | Tournament Bracket & Station Rotation (PE) | `021-pe-tournament-stations.md` |
| 022 | Lab Group & Role Randomizer | `022-lab-group-role-randomizer.md` |
| 023 | Exit Ticket / Bell Ringer Generator | `023-exit-ticket-generator.md` |
| 024 | Number Talks / Mental Math Routine Board | `024-number-talks-board.md` |
| 025 | Writing Prompt Generator | `025-writing-prompt-generator.md` |
| 026 | Math Fact Drill Sheet Generator | `026-math-drill-generator.md` |
| 027 | Novel Study / Reading Circles Manager | `027-novel-study-circles-manager.md` |
| 028 | Primary Source Analysis Worksheet Generator | `028-primary-source-analysis-generator.md` |
| 029 | Prompt Builder | `029-prompt-builder.md` |
| 030 | Quiz / Review Game Board | `030-review-game-board.md` |
| 031 | Word Doc Merger | `031-docx-merger.md` |
| 032 | School Calendar Visualizer | `032-school-calendar-visualizer.md` |
| 033 | Silent Reading (SSR) Log Tracker | `033-ssr-log-tracker.md` |
| 034 | East Middle Schedule Browser | `034-schedule-browser.md` |
| 035 | School Layout Visualizer | `035-schedule-visualizer.md` |
| 036 | Final Grade Checker | `036-final-grade-checker.md` |
| 037 | Grade Distribution Visualizer | `037-grade-distribution-visualizer.md` |
| 038 | Data Table → Chart Builder | `038-data-chart-builder.md` |
| 039 | Vocab & Conjugation Drill Generator | `039-vocab-conjugation-drill.md` |
| 040 | Vocabulary Flashcard & Word Wall Generator | `040-vocab-flashcard-generator.md` |
| 041 | Formula Reference Sheet Builder | `041-formula-sheet-builder.md` |
| 042 | Certificate & Award Maker | `042-certificate-award-maker.md` |
| 043 | Field Trip Permission Slip Generator | `043-field-trip-permission-slip.md` |
| 044 | Sub Plan Builder | `044-sub-plan-builder.md` |
| 045 | Sub Binder / Day Bundle Generator | `045-sub-binder-generator.md` |
| 046 | Blank Map Generator | `046-blank-map-generator.md` |
| 047 | Art Critique Worksheet Generator | `047-art-critique-worksheet-generator.md` |
| 048 | Student Art Portfolio Label & QR Tag Maker | `048-art-portfolio-label-maker.md` |
| 049 | Book Tasting Menu Generator | `049-book-tasting-menu-generator.md` |
| 050 | Government/Civics Simulation Role Card Generator | `050-civics-role-card-generator.md` |
| 051 | Classroom Label Maker, Target Language | `051-classroom-label-maker.md` |
| 052 | Cognates & False Friends Reference List Builder | `052-cognates-false-friends-builder.md` |
| 053 | Cultural Trivia Card Generator | `053-cultural-trivia-card-generator.md` |
| 054 | Current Events Discussion Guide Generator | `054-current-events-discussion-guide-generator.md` |
| 055 | Daily Editing / DOL Warm-Up Generator | `055-daily-editing-warmup-generator.md` |
| 056 | DBQ / Source Packet Builder | `056-dbq-source-packet-builder.md` |
| 057 | Dichotomous Key Builder | `057-dichotomous-key-builder.md` |
| 058 | Duty Roster Builder | `058-duty-roster-builder.md` |
| 059 | Scientific Method / Experiment Design Planner | `059-experiment-design-planner.md` |
| 060 | Fitness & Skill Assessment Tracker | `060-fitness-skill-assessment-tracker.md` |
| 061 | Fraction–Decimal–Percent Conversion Drill Generator | `061-fraction-decimal-percent-drill-generator.md` |
| 062 | Geography Bee / Map Skills Quiz Generator | `062-geography-bee-quiz-generator.md` |
| 063 | Grammar Mad Libs Generator | `063-grammar-mad-libs-generator.md` |
| 064 | Historical Figure / Country Trading Card Maker | `064-historical-trading-card-maker.md` |
| 065 | Lab Report Template Builder | `065-lab-report-template-builder.md` |
| 066 | Math "Find the Mistake" Warm-Up Generator | `066-math-find-the-mistake-generator.md` |
| 067 | Music Sight-Reading / Rhythm Warm-Up Generator | `067-music-sightreading-generator.md` |
| 068 | Parent/Guardian Contact Log | `068-parent-contact-log.md` |
| 069 | PE Warm-Up Circuit Card Generator | `069-pe-warmup-circuit-generator.md` |
| 070 | Peer Feedback / Editing Checklist Generator | `070-peer-feedback-checklist-generator.md` |
| 071 | Picture-Prompt Speaking/Writing Task Generator | `071-picture-prompt-generator.md` |
| 072 | Story Elements / Plot Diagram Builder | `072-plot-diagram-builder.md` |
| 073 | Science Fair Project Tracker | `073-science-fair-project-tracker.md` |
| 074 | Science Safety Symbol & Equipment Label Maker | `074-science-safety-label-maker.md` |
| 075 | Staff Directory / Quick-Reference Builder | `075-staff-directory-builder.md` |
| 076 | Sub Note / Feedback Slip Generator | `076-sub-note-feedback-slip-generator.md` |
| 077 | Testing Accommodations Reference Card Generator | `077-testing-accommodations-card-generator.md` |
| 078 | Unit Conversion Reference Chart Builder | `078-unit-conversion-chart-builder.md` |
| 079 | Verb Conjugation Reference Poster Generator | `079-verb-conjugation-poster-generator.md` |
| 080 | Virtual Manipulatives Board | `080-virtual-manipulatives-board.md` |
| 081 | Word Problem Warm-Up Generator | `081-word-problem-warmup-generator.md` |

---

## Currently claimed (in progress)

When you claim a tool per "Claiming a tool" above, add its row here; when
the round ships, the row moves down to **Already done** and is deleted from
here.

| Tool | Session | Claimed at (UTC) | Branch |
|---|---|---|---|
| Primary Source Analysis Worksheet Generator | `kx9rtm` | 2026-08-14 02:38 UTC | `claude/ssdemo2-028-kx9rtm` |
| Government/Civics Simulation Role Card Generator | `pq4rvn` | 2026-08-14 02:39 UTC | `claude/ssdemo2-050-pq4rvn` |
| Current Events Discussion Guide Generator | `mk3jq7` | 2026-08-14 02:44 UTC | `claude/ssdemo2-054-mk3jq7` |
| DBQ / Source Packet Builder | `vn8trq` | 2026-08-14 02:41 UTC | `claude/ssdemo2-056-vn8trq` |

---

## Already done

Counted from the start of the improvement-prompts programme. A tool may have
had unrelated fixes before that; those are not rounds.

### Devon-assigned round — tool 046 — 2026-08-13 23:54 UTC — session `q4wmxz`

Blank Map Generator (`046-blank-map-generator.md`), social studies demo round.

- **Choropleth from pasted data** (`IDEAS_BACKLOG.md` rank 13, "Choropleth
  from a data table") — paste `place, value` rows and the built-in vector base
  map shades itself in 4–6 quantile bands with a self-writing key. New
  `Tools/blank-map-generator/bmg-choropleth.js` (parse / match / classify /
  ramp, no DOM); `bmg-vector.js` paints the fills as it draws the raster, so
  every existing export path works on a shaded map unchanged.
- Grayscale-safe by construction: single-hue ramps with a guaranteed minimum
  luminance drop per band, verified in the suite and inspected as an actual
  grayscale render.
- Alias table + "48 of 50 rows matched" reporting; unmatched rows are named,
  never dropped.
- "Load example data" — rounded populations for all 50 states.
- Shaded renders take a `:choro:<hash>` cache-id suffix; `sameBaseMap()` keeps
  a teacher's placed labels through a re-shade.
- Fixed on the way: Student Handout Mode was blanking the class ranges, which
  makes a shaded map unreadable rather than fill-in-the-blank.
- New suite `Tools/blank-map-generator/test/smoke-choropleth.mjs` (59 checks),
  wired into `test:blank-map` and the end of the `test` chain.

### Pass 1 — complete (46/46 tools, Rounds 1–10, PRs #51–#65)

Every round below predates the claim system above — all ten rounds landed
the same calendar day (2026-08-10) from several concurrent sessions, which
is exactly the ambiguity the claim table and the `session <code>` round
header now exist to prevent. Left as-is for history; do not renumber or
backfill session codes onto these.

### Round 1 — 2026-08-10 — PR #51

| Tool | File |
|---|---|
| Digital Hall Pass / Sign-Out Log | `001-hall-pass-log.md` |
| Group / Team Generator | `002-group-team-generator.md` |
| Rubric Builder | `003-rubric-builder.md` |
| Classroom Timer | `004-classroom-timer.md` |
| Seating Chart Generator | `005-seating-chart-generator.md` |

### Round 2 — 2026-08-10 — PR #52

The platform spine: the tools that own shared data or compose it.

| Tool | File |
|---|---|
| Class Roster Hub | `006-class-roster-hub.md` |
| Name Picker | `007-name-picker.md` |
| Behavior & Points Tracker | `008-behavior-points-tracker.md` |
| Backup & Restore | `009-backup-restore.md` |
| Command Center | `010-command-center-dashboard.md` |

### Round 3 — 2026-08-10 — PR #54

Print-heavy and cross-cutting: a document assembler, a paper generator, two
tools that gained a shared-roster/print upgrade, and a timeline that got a
category legend + fill-in worksheet mode.

| Tool | File |
|---|---|
| Image → PDF Assembler | `011-image-to-pdf.md` |
| Graph Paper & Number Line Generator | `012-graph-paper-generator.md` |
| Lab Safety Contract Tracker | `013-lab-safety-contract-tracker.md` |
| Immersion Roleplay Scenario Generator | `014-roleplay-scenario-generator.md` |
| Timeline Builder | `015-timeline-builder.md` |

**15 of 46 tools done. 31 to go.**

### Round 4 — 2026-08-10 — PR #55

Ran concurrently with PR #54 above (both picked from the same "Not yet
touched" list before either had merged — no tool overlap between them, only
a merge conflict in this tracker file, resolved by renumbering this round to
4). Three clusters addressing recurring duplication themes: QR/station-builder
tools (shared `lib/qrcode.js` pattern), rotation/fairness tools ("who goes
next" logic reinvented independently), and prompt-bank/projector tools (the
same content-bank + display + handout shape, built three separate times).

| Tool | File |
|---|---|
| QR Code Generator | `016-qr-code-generator.md` |
| Gallery Walk QR Codes | `017-gallery-walk-qr.md` |
| QR Scavenger Hunt Builder | `018-qr-scavenger-hunt-builder.md` |
| Digital Escape Room / Puzzle Lock Builder | `019-escape-room-builder.md` |
| Bracket / Tournament Generator | `020-bracket-tournament-generator.md` |
| Tournament Bracket & Station Rotation (PE) | `021-pe-tournament-stations.md` |
| Lab Group & Role Randomizer | `022-lab-group-role-randomizer.md` |
| Exit Ticket / Bell Ringer Generator | `023-exit-ticket-generator.md` |
| Number Talks / Mental Math Routine Board | `024-number-talks-board.md` |
| Writing Prompt Generator | `025-writing-prompt-generator.md` |

**25 of 46 tools done. 21 to go.**

### Round 5 — 2026-08-10 — PR #56

Ran concurrently with another session working a separate tool set (no
overlap). Mixed group — two content-authoring tools that gained real
question/prompt banks (Math Drill, Primary Source), one classroom-workflow
tool (Novel Study Circles), and two projector-facing tools that share the
site's most underused pattern, a live scoring/game overlay (Review Game
Board) next to the one tool whose entire job is talking to a *different* AI
assistant (Prompt Builder).

| Tool | File |
|---|---|
| Math Fact Drill Sheet Generator | `026-math-drill-generator.md` |
| Novel Study / Reading Circles Manager | `027-novel-study-circles-manager.md` |
| Primary Source Analysis Worksheet Generator | `028-primary-source-analysis-generator.md` |
| Prompt Builder | `029-prompt-builder.md` |
| Quiz / Review Game Board | `030-review-game-board.md` |

**30 of 46 tools done. 16 to go.**

### Round 6 — 2026-08-10 — PR #58

Three tools with little else in common except each having a genuinely
underbuilt "quick win" list: a document merger that finally got its cdnjs
dependency vendored (P5) plus real preview/warning info per file, a
year-spine calendar that gained the instructional-day arithmetic teachers
do by hand plus range-select and .ics round-trip, and a reading log whose
real cost — transcription — got a bulk-entry grid built specifically to cut
it down.

| Tool | File |
|---|---|
| Word Doc Merger | `031-docx-merger.md` |
| School Calendar Visualizer | `032-school-calendar-visualizer.md` |
| Silent Reading (SSR) Log Tracker | `033-ssr-log-tracker.md` |

**33 of 46 tools done. 13 to go.**

### Round 7 — 2026-08-10 — PR #60

A linked pair: the published schedule browser and the 19,400-line tool that
generates it. Found, along the way, that the two had already drifted apart —
`034-schedule-browser.html` carries real features
(PNG download, share links, staleness banner, Common Planning/Compare mode)
that don't exist in `035-schedule-visualizer.html`'s publisher at all, and the
publisher's own function list was missing two helpers its stringified
functions actually call, which would throw a `ReferenceError` on the browser's
two core views the moment anyone published fresh. The second bug — the crash
— got fixed this round; the first — the feature drift — was judged too large
to port safely into a file this size in one sitting and is documented in
detail instead, with four Quick Wins shipped by hand to the real,
currently-shipped `034-schedule-browser.html` in the meantime.

| Tool | File |
|---|---|
| East Middle Schedule Browser | `034-schedule-browser.md` |
| School Layout Visualizer | `035-schedule-visualizer.md` |

**35 of 46 tools done. 11 to go.**

### Round 8 — 2026-08-10 — PR #61

Ran concurrently with the Round 7 session above (picked from the same "Not
yet touched" list before either had merged — no tool overlap; this round's
own merge picked up Round 7's changes cleanly with no conflicts in this
file). Four clusters, each addressing a duplication or gap the tools' own
files called out: a grade/data trio that all parse a pasted gradebook table
independently (Final Grade Checker, Grade Distribution Visualizer, Data
Chart Builder); a vocab/reference trio that each wanted "a shared
vocabulary store" and got a lightweight read-only bridge between the two
vocab tools instead of the full hub; a school-office print pair
(Certificate Maker, Field Trip Slip) missing the same roster-loading and
per-student-data gaps; and a sub-coverage pair (Sub Plan Builder, Sub
Binder Generator) that their own files said should be designed together —
plus a real fix, vendoring Sub Plan Builder's JSZip locally instead of
loading it from cdnjs (P5).

| Tool | File |
|---|---|
| Final Grade Checker | `036-final-grade-checker.md` |
| Grade Distribution Visualizer | `037-grade-distribution-visualizer.md` |
| Data Table → Chart Builder | `038-data-chart-builder.md` |
| Vocab & Conjugation Drill Generator | `039-vocab-conjugation-drill.md` |
| Vocabulary Flashcard & Word Wall Generator | `040-vocab-flashcard-generator.md` |
| Formula Reference Sheet Builder | `041-formula-sheet-builder.md` |
| Certificate & Award Maker | `042-certificate-award-maker.md` |
| Field Trip Permission Slip Generator | `043-field-trip-permission-slip.md` |
| Sub Plan Builder | `044-sub-plan-builder.md` |
| Sub Binder / Day Bundle Generator | `045-sub-binder-generator.md` |

**45 of 46 tools done. 1 to go.**

### Rounds 9 and 10 — 2026-08-10 — PRs #64 and #65

The last tool on the list, and the only one to get two rounds in this pass —
both at Devon's direct request rather than by picking from the list below.
Round 9 (PR #64) did page shapes and turned Print/Save PDF into genuine
map exports instead of a screenshot of the web page. Round 10 did the
classroom-worksheet cluster: numbered fill-in-the-blank worksheets with
answer keys and shuffled versions, reusable label sets, a label
de-overlapping pass, semantic line types, and a projector-ready quiz mode
with scoring. See `046-blank-map-generator.md` for what each round shipped and
where the next one should pick up.

| Tool | File |
|---|---|
| Blank Map Generator | `046-blank-map-generator.md` |

**46 of 46 tools done.** Pass 1 complete.

### Pass 2 — reset 2026-08-10

Per the instructions at the top of this file, an empty "Not yet touched"
list is the signal to reset: every tool has been moved back below, and
round numbering starts over as **Pass 2, Round 1**. Round headers from here
on should carry a timestamp and session code, per "How to use this file"
above — e.g. `` ### Pass 2 — Round 1 — 2026-08-11 03:14 UTC — session `abc123` — PR #NN `` —
not just a bare date, so that several rounds landing the same calendar day
(as happened throughout Pass 1) stay distinguishable at a glance. The next
round entry gets appended directly below this note.

**35 new tools** were also added straight from the Ideas Backlog since Pass
1 started — as of this reset, the entire Ideas Backlog (`IDEAS_BACKLOG.md`)
has shipped and sits empty. Each new tool already has its own `improvement
prompts/<tool>.md` with a first-build Status, but none of the 35 are in the
"Not yet touched" list below yet — Devon wants to fold them into the round
system as a deliberate batch rather than mixed in silently with this reset.
Leave them out until told otherwise. **Exceptions:** 047–051, 053–057, and
063–067 were each pulled out of this batch and given a round at Devon's
direct request (see the "Held-out batch" and "063–067" round entries
below, in the same spirit as tool 046's extra Rounds 9–10 in Pass 1) — all
three groups are done and out of this list; the other 20 are still
untouched:

Cognates & False Friends Reference List Builder (`052-cognates-false-friends-builder.md`) ·
Duty Roster Builder (`058-duty-roster-builder.md`) ·
Scientific Method / Experiment Design Planner (`059-experiment-design-planner.md`) ·
Fitness & Skill Assessment Tracker (`060-fitness-skill-assessment-tracker.md`) ·
Fraction–Decimal–Percent Conversion Drill Generator (`061-fraction-decimal-percent-drill-generator.md`) ·
Geography Bee / Map Skills Quiz Generator (`062-geography-bee-quiz-generator.md`) ·
Parent/Guardian Contact Log (`068-parent-contact-log.md`) ·
PE Warm-Up Circuit Card Generator (`069-pe-warmup-circuit-generator.md`) ·
Peer Feedback / Editing Checklist Generator (`070-peer-feedback-checklist-generator.md`) ·
Picture-Prompt Speaking/Writing Task Generator (`071-picture-prompt-generator.md`) ·
Story Elements / Plot Diagram Builder (`072-plot-diagram-builder.md`) ·
Science Fair Project Tracker (`073-science-fair-project-tracker.md`) ·
Science Safety Symbol & Equipment Label Maker (`074-science-safety-label-maker.md`) ·
Staff Directory / Quick-Reference Builder (`075-staff-directory-builder.md`) ·
Sub Note / Feedback Slip Generator (`076-sub-note-feedback-slip-generator.md`) ·
Testing Accommodations Reference Card Generator (`077-testing-accommodations-card-generator.md`) ·
Unit Conversion Reference Chart Builder (`078-unit-conversion-chart-builder.md`) ·
Verb Conjugation Reference Poster Generator (`079-verb-conjugation-poster-generator.md`) ·
Virtual Manipulatives Board (`080-virtual-manipulatives-board.md`) ·
Word Problem Warm-Up Generator (`081-word-problem-warmup-generator.md`)

### Pass 2 — Round 1 — 2026-08-10 23:40 UTC — session `v19h3x` — PR #71

Ten tools, all print-heavy or QR/bracket-primitive tools that had each
already had a Pass 1 round (see their own files' Round 3/4 history) — this
round picked up specifically where each file's own "Where the next round
should pick up" notes left off, one scoped improvement (or two, where both
were small) per tool, each independently verified via `node --check` and a
headless Playwright pass before being committed. No tool outside this list
was touched.

| Tool | File | What shipped |
|---|---|---|
| Image → PDF Assembler | `011-image-to-pdf.md` | Automated Playwright smoke test (`Tools/image-to-pdf/test/`); optional "target output size (MB)" that steps down a quality ladder and reports the outcome honestly. |
| Graph Paper & Number Line Generator | `012-graph-paper-generator.md` | Two new grid modes — Cornell-notes ruling and handwriting practice lines — reusing the shared header/ink-saving plumbing. |
| Lab Safety Contract Tracker | `013-lab-safety-contract-tracker.md` | Money collection: optional per-document fee, per-student paid/unpaid toggle, reflected in the summary, missing list, and reminder slips. |
| Immersion Roleplay Scenario Generator | `014-roleplay-scenario-generator.md` | `speechSynthesis` audio (per-class language selector + Speak buttons) and an optional sentence-frame layer beneath each vocabulary card. |
| Timeline Builder | `015-timeline-builder.md` | Compressed/logarithmic scale mode — more pixel-space for recent history on a deep-BCE-to-present span, strict chronological ordering preserved, applied across the scroll/print/compare views. |
| QR Code Generator | `016-qr-code-generator.md` | Standalone "Scan a code" mode (camera or uploaded image), decoding and field-parsing any QR code, with a session-scoped recently-scanned list. |
| Gallery Walk QR Codes | `017-gallery-walk-qr.md` | Staggered walking order across stations plus printable per-walker route cards, composed with the existing rotation timer's rotation count. |
| QR Scavenger Hunt Builder | `018-qr-scavenger-hunt-builder.md` | Undo (15s window) on "Clear all progress"; per-station hints with a configurable time penalty, applied through the Team Check-In panel. |
| Digital Escape Room / Puzzle Lock Builder | `019-escape-room-builder.md` | Per-station attempt-limit lockouts with near-miss feedback; forgiving text-answer matching (punctuation/case/whitespace + optional numeric tolerance); fixed the multi-answer cipher display and flagged digit-lock length mismatches. |
| Bracket / Tournament Generator | `020-bracket-tournament-generator.md` | Single-level "Undo last pick" (full-state snapshot) across all three formats; Random/As-entered/Ranked seeding selector with standard protect-the-top-seeds bracket placement. |

**10 of 46 (Pass 2) tools done. 36 to go.** None of the ten cleared their
list — each still has substantial Major Features/Moonshot items open in its
own file — so none moved to `stable tools/` this round.

### Pass 2 — Round 1 — 2026-08-10 23:49 UTC — session `yjj7k6` — PR #72

Bounded follow-ups on five of the ten tools assigned to this session (001,
004, 005, 007, 008 are left for a future round from the same session or
another) — each tool's own "where the next round should pick up" note named
the specific gap picked up here, so this round stayed narrow and verified
rather than spreading thin across all ten. Every change was smoke-tested in
a headless browser (page load + a realistic interaction) with zero console
errors, and every touched file's inline scripts were confirmed to still
parse.

| Tool | File |
|---|---|
| Group / Team Generator | `002-group-team-generator.md` |
| Rubric Builder | `003-rubric-builder.md` |
| Class Roster Hub | `006-class-roster-hub.md` |
| Backup & Restore | `009-backup-restore.md` |
| Command Center | `010-command-center-dashboard.md` |

**Leftover from this round — pick these up before starting a fresh round
elsewhere:** session `yjj7k6` was assigned the 001–010 range and completed
five of them; **001 Hall Pass Log, 004 Classroom Timer, 005 Seating Chart
Generator, 007 Name Picker, and 008 Behavior & Points Tracker are still
sitting in "Not yet touched" below.** They weren't skipped for lack of
ideas — each one's own `improvement prompts/<tool>.md` "where the next round
should pick up" note names something real, it's just each is a full
session's worth on its own rather than a bounded fix (stable per-student
IDs / bell-schedule correlation for 001; bell-schedule awareness, a
multi-timer board, or real sound assets for 004; the base64→IndexedDB photo
migration for 005; splitting the 2,400-line file or the history-cap rollup
for 007; the seating-chart-based board layout for 008 — see each file for
the full list). A future session — ideally one picking up the 001–010 range
again, but anyone is fine — should finish these five so the range gets a
complete Pass 2 first pass before other tools get a second round.

### Pass 2 — Round 2 — 2026-08-11 00:49 UTC — session `j6ok2v` — PR #73

Tools 031–035: a document merger, a calendar, a reading log, and the
schedule-browser/visualizer pair. One scoped, independently-verified
Quick Win per tool (031 got two), plus — the main event — the first
phase of the R61–R63 backport into 035's publisher that two prior
rounds (Pass 1 Round 7 on both 034 and 035) had explicitly flagged as
the single highest-value item outstanding for that tool pair, and
explicitly deferred as too large for a single sitting. Given that same
sizing concern, this round ported one self-contained piece (the
staleness banner) rather than rushing all four remaining features;
`035-schedule-visualizer.md`'s Status has the recommended order for
the rest (copy/share links next, then Compare mode, then PNG
download).

| Tool | File | What shipped |
|---|---|---|
| Word Doc Merger | `031-docx-merger.md` | Remember-last-session file list (names/order/headings, resume banner); explicit "keep or normalize styles" choice with a full style-merge implementation. |
| School Calendar Visualizer | `032-school-calendar-visualizer.md` | A/B day cycle overlay — badges every day, skips weekends/no-school days without losing sync, "today is an X day" in the stats line. |
| Silent Reading (SSR) Log Tracker | `033-ssr-log-tracker.md` | Printable finished-books wall; fixed a real bug (single-entry form never refreshed the Books checklist) found while testing it. |
| East Middle Schedule Browser | `034-schedule-browser.md` | No direct changes — see 035; this file remains the source of truth for still-unported features. |
| School Layout Visualizer | `035-schedule-visualizer.md` | R61–R63 backport, phase 1 of 4: staleness banner ported into the publish pipeline and live preview, verified end-to-end. |

**20 of 46 (Pass 2) tools done** (10 from `v19h3x`'s round + 5 from
`yjj7k6`'s + these 5). **26 to go.** None of the five cleared their
list — each still has substantial Major Features/Moonshot items open in
its own file — so none moved to `stable tools/` this round.

### Pass 2 — Round 3 — 2026-08-11 01:29 UTC — session `yar0mb` — PR #82

Tools 036–040: the grade/data cluster (Final Grade Checker, Grade
Distribution Visualizer, Data Table → Chart Builder) plus the
vocabulary-drill pair (Vocab & Conjugation Drill Generator, Vocabulary
Flashcard & Word Wall Generator). One scoped, independently-verified Quick
Win per tool, each picked up from that tool's own Pass 1 "Skipped —
deferred" list rather than invented fresh. Every change was verified with
`node --check` (or the full 150-test `grade-math.test.mjs` suite for 036)
plus a headless Playwright pass (page load, the actual interaction, zero
console errors) served over a local HTTP server — `file://` module imports
are blocked by CORS in a headless Chromium sandbox, which is worth knowing
before assuming a smoke test needs a real server for this codebase's
`<script type="module">` tools specifically (`Tools/036-final_grade_checker.html`
is the only one of the five; the other four are classic non-module
`<script>` tags and load fine over `file://`, though the shared
Google-Fonts `@import` failure noted in `_site-requests.md` still fires
and was filtered out of the pass/fail check rather than fixed).

| Tool | File | What shipped |
|---|---|---|
| Final Grade Checker | `036-final-grade-checker.md` | Explicit column mapping on import (P13) — an optional `{nameCol, q1Col}` override in `parsePastedData`, plus a UI panel that previews the first row and lets a teacher override auto-detect when a gradebook export's column order changes. |
| Grade Distribution Visualizer | `037-grade-distribution-visualizer.md` | 15-second in-memory undo on Delete assignment (P11), same pattern as `018-qr-scavenger-hunt-builder.html`'s "Undo clear"; the existing confirm dialog stays. |
| Data Table → Chart Builder | `038-data-chart-builder.md` | Same undo pattern (P11) applied to Delete dataset. |
| Vocab & Conjugation Drill Generator | `039-vocab-conjugation-drill.md` | Accent-tolerant answer checking on the conjugation self-quiz — a three-state `answerMatch()` (correct/close/wrong) via Unicode NFD diacritic-stripping; scoring stays strict, only the feedback message changed. |
| Vocabulary Flashcard & Word Wall Generator | `040-vocab-flashcard-generator.md` | Alignment test page — one numbered front/back sheet pair reusing the real double-sided print's own mirroring math, to check duplex settings before a full class set. |

**25 of 46 (Pass 2) tools done** (20 from the prior three rounds + these
5). **21 to go.** None of the five cleared their own list — each still has
at least one deferred Quick Win or a full Major Features/Moonshot section
open — so none moved to `stable tools/` this round. Two tools (037, 038)
independently picked up the identical P11 undo pattern this round; nothing
shared was extracted, matching how the rest of this file's "Threads left
open" section already treats the read-only cross-tool bridge pattern —
copy-paste-and-adapt, not a shared library, until a third or fourth tool
wants the same thing.

### Held-out batch — Round 1 — 2026-08-11 01:29 UTC — session `8vo65u` — PR #74

Devon directly assigned tools 047-051 to this session, ahead of the
Pass-2-reset note above that holds the 35-tool Ideas Backlog batch out of
the round system until folded in deliberately — an explicit per-tool
override per this file's own top-of-file rule ("Devon may also reset it
early, or move a specific tool back up, and that overrides everything
here"). This is **not** a Pass 2 round pulled from "Not yet touched" —
these five remain outside that list, per the held-out-batch note below,
until Devon folds the rest of the 35 in. One or two scoped Quick Wins
shipped per tool (each tool's own file has the full breakdown), verified
with a single combined headless Chromium smoke test covering all five
tools' new interactions (24 checks, zero console errors).

| Tool | File | What shipped |
|---|---|---|
| Art Critique Worksheet Generator | `047-art-critique-worksheet-generator.md` | Multiple named saved worksheets (New/Duplicate/Delete + switcher, legacy-save auto-migration); fixed half-sheet print CSS that clipped worksheets with many follow-up questions. |
| Student Art Portfolio Label & QR Tag Maker | `048-art-portfolio-label-maker.md` | Reorder entries via up/down buttons; live character-count warning on the artist-statement field (QR density heads-up past ~220 chars). |
| Book Tasting Menu Generator | `049-book-tasting-menu-generator.md` | Menu print now groups books into genre-named course sections instead of one flat list; cover images now render in both menu and table-tent print output. |
| Government/Civics Simulation Role Card Generator | `050-civics-role-card-generator.md` | Per-role "copies" count so a role shared by several students (jurors, witnesses) prints that many cards; Duplicate-role button. |
| Classroom Label Maker, Target Language | `051-classroom-label-maker.md` | "Test ▶" link per word opening the pronunciation companion page directly; a prominent `file://` warning banner alongside the existing hint line. |

None of the five cleared their list — each still has open Quick Wins and
full Major Features/Moonshot sections — so none moved to `stable tools/`
this round. A cross-tool note surfaced this round: three tools now carry
their own copy-pasted `buildQR`/`drawQR` (Gallery Walk QR Codes, Art
Portfolio Label Maker, and now Classroom Label Maker) — worth promoting
into a shared `lib/qrcode.js` next time any of the three is touched again
(see 048's and 051's own files for the detail).

### Held-out batch — Round 2 — 2026-08-11 01:29–03:10 UTC — session `szyio3` — tools 047–052

**Genuine claim collision with the round directly above.** Devon assigned
this session tools 047–052 at essentially the same moment `8vo65u` was
assigned 047–051 — both sessions read this file's empty claim table and
pushed a claim row in the same UTC minute (01:29), so neither saw the
other's before starting. `8vo65u` merged first as PR #74. This session's
own PR (#75) then hit real merge conflicts against 047, 049, 050, and 051
— not just this tracker file. Rather than blindly resolving in either
direction, each conflicting tool file was diffed against `8vo65u`'s merged
version to check for genuine overlap before touching anything:

- **047, 049, 051** — `8vo65u` had independently picked the *same* Quick
  Wins this session also built (multi-save worksheets + the print fix for
  047; genre grouping + cover images for 049; the test link + file://
  banner for 051), so this session's redundant reimplementation of all
  three was discarded in favor of the already-merged version. No further
  changes needed.
- **048, 050** — `8vo65u` had picked a *different* second Quick Win than
  this session for both (048: character-count warning vs. this session's
  named/multiple saved portfolios; 050: Duplicate-role button vs. this
  session's reorder buttons) — genuinely complementary, not conflicting,
  work. Git's automatic 3-way merge on 048 silently duplicated the reorder
  buttons and click handlers instead of combining the two feature sets
  (confirmed by inspection — not caught until reading the merged file
  directly), and 050 left literal conflict markers mid-function. Both
  files were rebuilt from `8vo65u`'s merged `main` state with this
  session's addition re-applied by hand, then re-verified end to end.
- **052** — untouched by `8vo65u`; merged in cleanly as new work.

| Tool | File | What shipped this round |
|---|---|---|
| Art Critique Worksheet Generator | `047-art-critique-worksheet-generator.md` | No changes beyond PR #74 (redundant work discarded). |
| Student Art Portfolio Label & QR Tag Maker | `048-art-portfolio-label-maker.md` | Named/multiple saved portfolios (New/Duplicate/Rename/Delete, migrates the old single-portfolio save), layered on top of PR #74's reorder buttons and character-count warning. Clears this tool's Quick Wins list except the roster-bulk-add idea. |
| Book Tasting Menu Generator | `049-book-tasting-menu-generator.md` | No changes beyond PR #74 (redundant work discarded). |
| Government/Civics Simulation Role Card Generator | `050-civics-role-card-generator.md` | Reorder roles and talking points via up/down buttons, layered on top of PR #74's per-role Copies field and Duplicate-role button. Clears this tool's Quick Wins list except assigned-student-name. |
| Classroom Label Maker, Target Language | `051-classroom-label-maker.md` | No changes beyond PR #74 (redundant work discarded). |
| Cognates & False Friends Reference List Builder | `052-cognates-false-friends-builder.md` | Three more starter language sets (German, Italian, Portuguese — six total); reorder list items via up/down buttons on both lists. |

**7 of the 35 held-out Ideas-Backlog tools now have at least one round**
(047–052 from the combined work of both sessions above, none from the
remaining 29). None cleared their full Quick Wins list — 048 and 050 came
closest, one item each remains — so none moved to `stable tools/` this
round, and none are added to "Not yet touched" below per this file's own
convention (a tool moves to **Already done** after its round, not into
both lists at once).

**Process note for future sessions**, also logged in `_site-requests.md`:
the claim table only prevents collisions when a claim is visible before
the next session commits its own — two claims landing in the same
UTC minute are invisible to each other. This is a real, now-observed
failure mode of the claim system, not just a theoretical gap.

### Held-out batch — 2026-08-11 01:31 UTC — session `4o6xmy` — tools 068-072

Direct assignment (not picked from "Not yet touched") — these five sit in
the 35-tool batch Devon deliberately held out of the round system pending
a future decision to fold them in as a group (see the "Pass 2 — reset"
note above); this round works them anyway per explicit instruction, which
overrides the default picking order per this file's own header, the same
override several other held-out-batch rounds in this section also used.
Does not count toward the "X of 46 (Pass 2)" tallies, which track only the
original 46 Pass 1 tools' second pass — these 35 aren't part of that count
either way yet. One scoped round each, independently verified with a
headless Chromium smoke test per tool (real interactions — including a
real generated-PNG upload for 071's downscale test and a seeded-legacy-
storage test for 072's migration path — `window.print` mocked where
printing was involved) with zero console errors.

| Tool | File | What shipped |
|---|---|---|
| Parent/Guardian Contact Log | `068-parent-contact-log.md` | Date-range filter, CSV export (respects current filter), roster sort-by-fewest-contacts, confirmation toast, Enter-to-submit logging. |
| PE Warm-Up Circuit Card Generator | `069-pe-warmup-circuit-generator.md` | Reorder stations (up/down), duplicate station, a small click-to-pick emoji palette. |
| Peer Feedback / Editing Checklist Generator | `070-peer-feedback-checklist-generator.md` | Reorder categories and items (up/down); print-layout QA as an on-screen size warning plus two-tier print font/spacing scaling, plus a `min-height`/no-`overflow:hidden` fix for the same print-clipping bug pattern independently found and fixed in 047 by a concurrent session. |
| Picture-Prompt Speaking/Writing Task Generator | `071-picture-prompt-generator.md` | Cleared its whole Quick Wins list: fixed the reset-hint wording inconsistency, pin-a-prompt-to-an-image, silent image downscale-on-upload (≤1400px, JPEG), and a persisted print-count-subset field. Also folded in its most-called-out Major Feature (image downscaling) rather than leaving it for a later round. |
| Story Elements / Plot Diagram Builder | `072-plot-diagram-builder.md` | Fixed a real bug — literal `&mdash;` text printing instead of an em dash, the sixth instance of the same bug class flagged elsewhere this round (see `_site-requests.md`); multiple named saved diagrams (with automatic migration of the prior single-diagram data, verified in a dedicated test); a filled/empty stage visual highlight. |

None of the five cleared their own file's full list — 071 is the
exception, having cleared its Quick Wins entirely including one Major
Feature, but its Major Features/Moonshot sections still have real items
open — so none moved to `stable tools/` this round.

### Pass 2 — Round 4 — 2026-08-11 02:20 UTC — session `gb5c6e` — branch `claude/tools-041-046-improvements-gb5c6e`

Tools 041–046: the school-office print cluster (formula sheets,
certificates, field trip slips) plus the sub-coverage pair (Sub Plan
Builder, Sub Binder Generator) plus the Blank Map Generator. One scoped
Quick Win or Major Feature per tool, picked from each tool's own
"where the next round should pick up" note. Every change was verified with
`node --check`/syntax checks and a headless Playwright pass exercising the
actual new interaction (not just page load) — an .ics file byte-parsed for
correct VEVENT structure, a real worksheet+answer-key PDF generated
end-to-end through the actual UI with long place-name labels, per-day state
round-tripped through Sub Plan Builder's history storage, etc. — zero
console errors across all six.

| Tool | File | What shipped |
|---|---|---|
| Formula Reference Sheet Builder | `041-formula-sheet-builder.md` | Print size selector (Full page / Half sheet 2-up / Index card 4-up) tiling identical copies onto one physical letter page with cut lines; auto-fit now targets the selected page's actual height. |
| Certificate & Award Maker | `042-certificate-award-maker.md` | Uploadable signature image printed above the signature line (reuses the logo downscaler); toggleable print alignment guides (corner registration marks) for pre-printed certificate stock. |
| Field Trip Permission Slip Generator | `043-field-trip-permission-slip.md` | `.ics` calendar export — one event for the trip, plus a separate slip-due reminder event with a live missing-count snapshot, reusing Lab Safety Contract Tracker's VCALENDAR pattern. |
| Sub Plan Builder | `044-sub-plan-builder.md` | Per-day "Day type" template selector (Testing / Video / Emergency no-notice) that fills Overview/Schedule/Materials with confirm-gated starter content; tracked per-day and round-tripped through history. |
| Sub Binder / Day Bundle Generator | `045-sub-binder-generator.md` | "Print bundle for all N days" — shared sections print once, the date-specific Calendar+Lesson sections print once per day with a divider header, reusing the single-day render functions. |
| Blank Map Generator | `046-blank-map-generator.md` | Answer-key page no longer prints a redundant word bank; answer-key text now shrinks to fit its column instead of overflowing on long place names. |

**31 of 46 (Pass 2) tools done** (25 before this round, including session
`yar0mb`'s concurrent Round 3 on tools 036–040, + these 6). **15 to go.**
None of the six cleared their list — each still has substantial Major
Features/Moonshot items open in its own file — so none moved to
`stable tools/` this round. Sub Binder Generator's own file flags the P8
cross-tool handoff interface as now due for a third consecutive round; see
its Open Questions.

### 063–067 — 2026-08-11 01:30–~03:20 UTC — session `9iiyas` — branch `claude/tools-063-067-improvements-9iiyas`

Devon assigned this session tools 063–067 directly, pulling them out of the
35-tool Ideas-Backlog batch that's otherwise being held back from the round
system (see the "Exception" note above) — so this round is **not** part of
the 46-tool Pass 2 count/tally above, and doesn't move that "N to go"
number. Each tool got its top 2–3 Quick Wins from its own `improvement
prompts/<tool>.md`, implemented by five parallel subagents (one per tool,
each scoped to touch only its own `.html` file), independently reviewed and
re-verified with a fresh headless-Playwright pass by the orchestrating
session before each commit (not just trusting the sub-agent's own
self-report) — one bug in the reviewer's own beat-accuracy test script
turned up a wrong Unicode codepoint for the half-note glyph, not a bug in
the shipped code, worth noting so a future reviewer doesn't chase the same
false lead.

| Tool | File | What shipped |
|---|---|---|
| Grammar Mad Libs Generator | `063-grammar-mad-libs-generator.md` | Custom stories now persist to `localStorage`; a visible, click-to-insert tag reference row next to the custom-story textarea; 3 new built-in templates (7 total). |
| Historical Figure / Country Trading Card Maker | `064-historical-trading-card-maker.md` | Row-mirrored duplex front/back printing (adapted from Vocabulary Flashcard Generator's `VocabLayout.mirrorPageRows`, copied in rather than shared, so the file stays self-contained); edit-an-existing-card in place; a stat-overflow warning before print. |
| Lab Report Template Builder | `065-lab-report-template-builder.md` | Up/down reorder buttons on every list (materials, procedure, columns, conclusion); multiple named saved templates (mirrors Formula Sheet Builder / Rubric Builder's storage shape) with automatic one-time migration of the old single-template key; a print preview modal that reuses the real print markup. |
| Math "Find the Mistake" Warm-Up Generator | `066-math-find-the-mistake-generator.md` | An 8-category topic taxonomy with a filter panel scoping both projector shuffle and worksheet generation; a two-stage reveal (corrected work, then explanation, as separate clicks) in projector mode only — worksheet/answer-key mode still shows both together; per-built-in disable/enable without deleting. |
| Music Sight-Reading / Rhythm Warm-Up Generator | `067-music-sightreading-generator.md` | Generation settings (time signature, note pool, clef, range, counts, active tab) now persist to `localStorage` — the only tool in the toolkit that previously had zero persistence; a "lock this pattern for printing" toggle per tab so a new on-screen pattern doesn't overwrite what's about to print; a big single-measure step-through display for call-and-response clapping drills. |

None of the five cleared their own improvement-prompt list — each still has
real Major Features/Moonshot items open — so none moved to `stable tools/`
this round. See each tool's own file for what's next.

### Held-out batch — Round 2 — 2026-08-11 01:40 UTC — session `qer21r` — tools 053-057

Not picked from the "Not yet touched" list below — these five are part
of the 35 tools added at the Pass 2 reset and explicitly held out of the
round system pending a deliberate fold-in (see the reset note above).
Assigned directly by Devon rather than self-picked, same as Rounds 9/10
in Pass 1. One or two scoped Quick Wins
per tool, each independently verified via `node --check`-equivalent
syntax parsing, a headless Playwright interaction smoke test (including a
reload to confirm `localStorage` persistence survives), and a separate
print-path smoke test confirming each new feature reaches the printed
output — zero console errors across all of it.

| Tool | File | What shipped |
|---|---|---|
| Cultural Trivia Card Generator | `053-cultural-trivia-card-generator.md` | Category filter + card count settings persist across reloads; per-built-in Hide/Unhide toggle. |
| Current Events Discussion Guide Generator | `054-current-events-discussion-guide-generator.md` | Stopword list grown ~5x to cut vocabulary-suggestion noise; live word count/read-time while pasting; "Clear & start over" button. |
| Daily Editing / DOL Warm-Up Generator | `055-daily-editing-warmup-generator.md` | Built-ins tagged by error type with a filter (display + worksheet); error-type label shown alongside the reveal; worksheet count + filter persist; custom sentences editable in place. |
| DBQ / Source Packet Builder | `056-dbq-source-packet-builder.md` | Reorder sources via up/down; dedicated final synthesis/essay-prompt field, printed as its own closing page. |
| Dichotomous Key Builder | `057-dichotomous-key-builder.md` | Reorder steps via up/down; non-blocking validation warnings (unreachable steps, no-specimen results, dead-end choices); print-without-specimens checkbox. |

None of the five cleared their Quick Wins list entirely, and all five
still have open Major Features/Moonshot items, so none moved to
`stable tools/` this round. See each file's own Status section for what's
recommended next.

### Tools 058–062 — 2026-08-11 01:41 UTC — session `kq3g3h` — Devon's direct request

Devon directed this session to work tools 058&ndash;062 specifically,
outside the normal pick-from-"Not yet touched" flow — these five are part
of the 35-tool batch held out at the Pass 2 reset above ("Devon wants to
fold them into the round system as a deliberate batch rather than mixed
in silently with this reset"), so this round does **not** count toward
the "N of 46 (Pass 2)" tally above and the 35-tool batch is still not
folded into that rotation. One or two independently-verified Quick Wins
per tool, each confirmed with a headless Chromium smoke test (Playwright,
installed fresh into the scratchpad for this session since no
`package.json` exists in the repo) covering the new behavior plus a
reload to confirm `localStorage` persistence, with zero console errors.

| Tool | File | What shipped |
|---|---|---|
| Duty Roster Builder | `058-duty-roster-builder.md` | Live per-staff assignment counts; a per-staff "skip this week" flag that auto-fill respects; fixed a latent bug where deleting a duty location left orphaned assignments still counting toward staff totals. |
| Scientific Method / Experiment Design Planner | `059-experiment-design-planner.md` | Up/down reordering for controlled variables, materials, and procedure steps; a sanity hint when the independent and dependent variable fields match; fixed a print-output bug where empty-field HTML-entity placeholders were being double-escaped into literal text. |
| Fitness & Skill Assessment Tracker | `060-fitness-skill-assessment-tracker.md` | Time-value (`mm:ss`) parsing so class average/min/max stats now work for time-type events, not just count-type; CSV export of the full results grid. |
| Fraction–Decimal–Percent Conversion Drill Generator | `061-fraction-decimal-percent-drill-generator.md` | Seeded generation (mulberry32, ported from Math Fact Drill Sheet Generator's pattern) with a "Lock seed" checkbox for reproducible reprints; settings (difficulty/given-form/row count/seed lock) now persist across page loads. |
| Geography Bee / Map Skills Quiz Generator | `062-geography-bee-quiz-generator.md` | Category filter and quiz question count persist across page loads; built-in questions can now be hidden/shown individually (not just deleted, which only ever applied to custom questions) and hidden ones are excluded from the projector/shuffle/quiz pools. |

None of the five cleared their own Quick Wins list — each still has
Major Features/Moonshot items open — so none moved to `stable tools/`
this round. See each file's own Status section for exactly where the
next round should pick up.

### Devon-assigned round — tools 073–077 — 2026-08-11 ~01:45 UTC — session `b4zswl`

**Not part of the Pass 2 001–046 rotation above** — these five come from
the 35-tool batch the Pass 2 reset note explicitly held back ("leave them
out until told otherwise"). Devon directly assigned this range for this
session rather than picking from the Pass 2 "Not yet touched" list, so
this round is recorded separately and does **not** change the "X of 46
(Pass 2)" tallies above. Whether/when the rest of the 35-tool batch joins
the Pass 2 rotation is still Devon's call, per that note.

One or two scoped Quick Wins per tool, each independently verified with
`node --check` on every inline `<script>` block and a headless
Chromium/Playwright smoke test (interact with the real DOM, assert on
real state, zero console errors) before committing.

| Tool | File | What shipped |
|---|---|---|
| Science Fair Project Tracker | `073-science-fair-project-tracker.md` | Overdue-milestone highlighting (red cell + non-color ⚠ marker); a whole-class per-milestone summary bar; "sort: least complete first"; milestone up/down reorder. |
| Science Safety Symbol & Equipment Label Maker | `074-science-safety-label-maker.md` | Edit-in-place and Duplicate buttons on queued labels (previously delete-and-re-add only); a small/medium/large label-size control affecting both print columns and card height. |
| Staff Directory / Quick-Reference Builder | `075-staff-directory-builder.md` | CSV and JSON export/import (hand-rolled quoted-CSV parser, no library); duplicate-detection on bulk paste and CSV import (same name + room), with an "Added N, skipped M" report. |
| Sub Note / Feedback Slip Generator | `076-sub-note-feedback-slip-generator.md` | Fixed a real print bug — long prompt lists were silently clipped by a fixed-height `overflow:hidden` half-sheet; now falls back to one full page per slip past a 5-prompt threshold. Added an optional Class/Period field that pre-fills every printed copy. |
| Testing Accommodations Reference Card Generator | `077-testing-accommodations-card-generator.md` | "N of M students have an accommodation checked" summary (fixed a bug where it didn't update on checkbox change); "print one student only" option; 2/3/4-column print-size control. |

None of the five cleared their own Quick Wins list entirely (074 and 075
each have 2–3 items left; 076 and 077 have 1 each; 073 cleared its Quick
Wins but still has open Major Features/Moonshot) — so none moved to
`stable tools/` this round. See each tool's own file for exactly what's
still open and where the next round should pick up.

### Pass 2 — Round 3 — 2026-08-11 01:43 UTC — session `h4rwxn` — PR #78

Tools 078–081, assigned directly by Devon rather than picked from the
"Not yet touched" list below — these four are part of the 35-tool batch
the Pass 2 reset note (above) explicitly held out of the round-robin, so
this round doesn't count toward that list's "26 to go" and none of the
four were removed from it. One scoped, independently-verified item (or
two, where both were small) per tool, each checked with `node --check` and
a headless Playwright smoke test before committing. The 080 fix turned out
broader than its own file's Status had flagged: the "ten/hundred blocks
snapshot as blank" bug was actually one instance of a bug affecting three
piece types (fraction tiles hit the same root cause; number-line markers
had an unrelated instance of the identical pattern) — all three fixed in
the same pass since they shared one function.

| Tool | File | What shipped |
|---|---|---|
| Unit Conversion Reference Chart Builder | `078-unit-conversion-chart-builder.md` | Per-line delete for template-sourced lines (not just custom ones); print column-count control (1/2/3), both persisted. |
| Verb Conjugation Reference Poster Generator | `079-verb-conjugation-poster-generator.md` | 5 new starter templates (Spanish imperfect/future/irregulars, French imperfect/irregulars, doubling 3→8); print column-count control (1/2/3 panels per row), persisted. |
| Virtual Manipulatives Board | `080-virtual-manipulatives-board.md` | Fixed the snapshot color bug for segmented pieces (ten/hundred blocks *and* fraction tiles) and number-line markers; added a duplicate-piece button. |
| Word Problem Warm-Up Generator | `081-word-problem-warmup-generator.md` | Doubled templates per operation (3→6, 24 total); seeded generation (mulberry32 + lock-seed checkbox, matching Math Fact Drill Sheet Generator's pattern); settings persistence (grade band, operations, count, lock state). |

None of the four cleared their list — each still has substantial Major
Features/Moonshot items open in its own file — so none moved to
`stable tools/` this round.

### Devon-assigned round — tool 046 (Round 12) — 2026-08-11 02:07 UTC — session `albm3m` — branch `claude/tool-46-blank-map-generator-albm3m`

Devon directed this session at the Blank Map Generator specifically —
the same per-tool override as its Rounds 9–11 — so this does **not**
change the Pass 2 tally (046 already counted in session `gb5c6e`'s
Round 4 above). Cleared the tool's entire remaining Quick Wins list plus
one Major Feature, all verified with a 27-check headless Chromium pass
driving the real UI (worksheet PDF byte-parsed for page count, label-set
export/import round-tripped through real downloads/uploads, undo
exercised via real Ctrl+Z) plus direct visual inspection of the rendered
worksheet, answer key, PNG, and poster-tile output.

| Tool | File | What shipped |
|---|---|---|
| Blank Map Generator | `046-blank-map-generator.md` | Numbered markers with key captions are now worksheet items (uncaptioned ones print "?" and the panel says why, with a count); label sets gained rename / edit-as-text / JSON export / import (built-ins edit as copy-on-save); a "Shrink to Fit" companion to Tidy Labels (one undoable edit); the Commons credit line now stamps automatically on every raster export (PNG, Print, PDF, tiled poster). |

The tool's Quick Wins list is now empty — but its Major Features /
Moonshot sections (time-slice maps, vector base maps, choropleth,
map+timeline pairing) are substantial and open, so it does not move to
`stable tools/`.

### Devon-assigned round — tool 046 (Round 13) — 2026-08-11 02:44 UTC — session `mn6d5m` — branch `claude/vector-base-maps-phase-1-mn6d5m`

Devon directed this session at the Blank Map Generator specifically — the
same per-tool override as its Rounds 9–12 — so this is **not** picked from
"Not yet touched" and does **not** change the Pass 2 tally (046 already
counted in session `gb5c6e`'s Round 4 above). Round 12's branch had not
merged to `main` when this round started, and this round's work builds
directly on its `mapCreditLine()` export-stamping, so this branch was based
on `claude/tool-46-blank-map-generator-albm3m` rather than `main` — it
carries Round 12's commits as well as its own.

Phase 1 of the **vector base maps** Major Feature, the first item off that
list rather than a Quick Win (there were none left after Round 12).
Verified with `node --check` on every touched module plus a **19-check
headless Chromium pass** over the real UI served on local HTTP, and direct
visual inspection of the generated rasters and both PDF worksheet pages.

| Tool | File | What shipped |
|---|---|---|
| Blank Map Generator | `046-blank-map-generator.md` | Nine built-in, offline base maps (World, six continents, USA lower-48 and all-50) rendered from ~670 KB of vendored public-domain Natural Earth GeoJSON, in outline or land-fill style with borders on/off. They go through the *existing* raster/IndexedDB pipeline as an upload-shaped cache record, so every feature works unchanged — and because the renderer owns the projection, each one **calibrates itself**, verified at 0.01 map px against the projection math. Exports credit Natural Earth via Round 12's automatic stamping. |

Two notes worth carrying forward:

- **npm is the working route for third-party data and libraries** when the
  open web is blocked from a session's sandbox — twice now (jsPDF/JSZip
  vendoring in earlier rounds via `npm pack`, and this round's Natural
  Earth TopoJSON via `world-atlas`/`us-atlas` + `topojson-client`).
  Wikimedia was unreachable in both Round 12's and this round's sandbox.
- **Look at the rendered output, don't just assert on it.** This round's
  first render had three stray full-width lines across the world map
  (Natural Earth clamps antimeridian-crossing rings to ±180, which plate
  carrée turns into a `lineTo` across the whole canvas), and the *first
  fix* for that introduced a hard line along every world map's bottom
  edge. Both were found by looking at the image; only afterwards was a
  full-raster row scan added to catch the class automatically. Every
  numeric check in the suite passed the whole time.

The tool's Quick Wins list is still empty and its Major Features / Moonshot
sections remain open (time-slice maps, vector phase 2 — live rendering,
per-region hit-testing, choropleth — and map+timeline pairing), so it does
not move to `stable tools/`.

### Pass 2 — Round 2 — 2026-08-11 03:10 UTC — session `mxpfjs` — PR #89

Tools 021–030, picked from "Not yet touched" before any of the concurrent
rounds above had merged (no tool overlap with any of them). Ten tools, all
print/projector/data tools that each already had a Pass 1 round (Round 4 or
Round 5 — see each file's own history) — this round picked up specifically
where each file's own "Where the next round should pick up" notes left
off, two scoped improvements per tool, each independently verified via
`node --check` and a headless Playwright pass before being committed. No
tool outside this list was touched.

| Tool | File | What shipped |
|---|---|---|
| Tournament Bracket & Station Rotation (PE) | `021-pe-tournament-stations.md` | Rest/water stations as a first-class station type (`isRest` flag — no scored toggle, distinct tile/print-card badge, excluded from score capture); single-level undo on Reset and New Unit. |
| Lab Group & Role Randomizer | `022-lab-group-role-randomizer.md` | Absent-student handling (per-shuffle toggle, role redistributes round-robin to a present groupmate, absent students drop off printed tents); a printable per-student × per-role fairness grid, including zero-history students and zero-count roles. |
| Exit Ticket / Bell Ringer Generator | `023-exit-ticket-generator.md` | Batch class-set printing on the Printable Handout tab (one slip per `np_rosters` name, name + date pre-filled); a second, renamable-category tally alongside Quick Tally, with a dated save/reset history. |
| Number Talks / Mental Math Routine Board | `024-number-talks-board.md` | Strategy-card name field now autocompletes from `np_rosters` via a `<datalist>`; single-level undo on Clear board. |
| Writing Prompt Generator | `025-writing-prompt-generator.md` | A writing-timer widget (presets + custom, epoch-based countdown, WebAudio chime) and an optional word-count goal display, both living inside `.stage` so they survive fullscreen; goal also prints on the poster. |
| Math Fact Drill Sheet Generator | `026-math-drill-generator.md` | An optional same-sheet corner answer key (with a toggle to also drop the separate key page); a "same problems, reordered per version" anti-copying mode distinct from the existing different-problems version tabs. |
| Novel Study / Reading Circles Manager | `027-novel-study-circles-manager.md` | "Export vocabulary to Flashcard Generator" — writes a deduped word list directly into `040-vocab-flashcard-generator.html`'s own storage contract (mirroring the `wpg-rubric-link.js` read-only cross-tool bridge pattern); single-level undo on Delete-meeting and Reset-role-history. |
| Primary Source Analysis Worksheet Generator | `028-primary-source-analysis-generator.md` | An off-by-default reading-support card (summary + simplified paraphrase, printed with the source); uploaded source images now downscale to a 1600px max dimension before storage, with a visible size warning (P12). |
| Prompt Builder | `029-prompt-builder.md` | A standalone redaction helper (manual name list + opt-in best-effort auto-detect, consistent "Student A/B/C" placeholders); prompt-history text search and per-entry pinning. |
| Quiz / Review Game Board | `030-review-game-board.md` | Scoreboard is now sticky, larger, and flashes green/red on any score change; teams can be built from a saved `np_rosters` roster, split into N count-based groups with editable, pre-filled names. |

**41 of 46 (Pass 2) tools done** (31 from the concurrent rounds above —
`v19h3x` 10 + `yjj7k6` 5 + `j6ok2v` 5 + `yar0mb` 5 + `gb5c6e` 6 — + these
10, none overlapping). **5 to go**: 001, 004, 005, 007, 008 — the same five
`yjj7k6`'s Round 1 flagged as leftover from the 001–010 range. None of the
ten cleared their own backlog file — each still carries open Major
Features/Moonshot items — so none moved to `stable tools/` this round
either. Two site-wide findings from this round were added to
`_site-requests.md`: a likely-wider P12 image-storage risk beyond the tools
already named there, and a new wrinkle on the recurring fullscreen-stage
duplication (interactive controls, not just static display, now need to
live inside the fullscreened subtree in at least four tools).

### Ranked-backlog batch — 2026-08-12 01:33–03:40 UTC — session `r8kq4t` — branch `claude/backlog-batch-3-r8kq4t`

**Worked from the ranked "Existing Tools — Enhancement Ideas" table in
`IDEAS_BACKLOG.md`, not from the "Not yet touched" list below**, so this
round does not change the "X of 46 (Pass 2)" tallies and none of the eight
tools moved between the lists. Ranks 1–8 as they stood at the start; each row
was deleted from both backlog files on the commit that shipped it, and the
remaining rows renumbered, leaving 131 contiguous.

This session was also the one that collided with a parallel session earlier
in the day (its first branch, PR #122, was abandoned unmerged after PR #123
shipped overlapping work). The claim table above was used properly this time:
a tagging-only commit for all eight rows went to `main` before any
implementation code.

| Tool | File | What shipped |
|---|---|---|
| Command Center | `010-command-center-dashboard.md` | A ninth panel: the current period's seating chart, read-only from `seating-chart-v1`, drawn as one SVG in the generator's own coordinate space so it scales to the projector. Which chart to show is remembered per period, not globally. |
| Digital Escape Room / Puzzle Lock Builder | `019-escape-room-builder.md` | The reported contraction bug was not real (apostrophes already collapsed); two adjacent ones in the same line were — hyphens glued words together and punctuation stripping left phantom double spaces. `normalizeTextAnswer` rewritten as four ordered passes. |
| QR Code Generator | `016-qr-code-generator.md` | The roster code sheet's missing suite, 39 checks. (The commit message's claim that `package.json` already pointed at it was wrong — see the correction below.) |
| Gallery Walk QR Codes | `017-gallery-walk-qr.md` | A projector rotation display: the clock at room size, plus which students are standing at which station right now, driven by the same timer as the panel rather than a copy of it. |
| Testing Accommodations Reference Card Generator | `077-testing-accommodations-card-generator.md` | A Show filter over the grid — one accommodation, or the students nothing is ticked for yet — that reaches the printed cards, so the read-aloud proctor gets exactly their stack. |
| Staff Directory / Quick-Reference Builder | `075-staff-directory-builder.md` | Department sub-headers on screen and in print, with the unassigned staff in a block of their own and case-variant spellings collapsed. The preference went in a new `sdb_prefs_v1` rather than wrapping the exported array. |
| Fitness & Skill Assessment Tracker | `060-fitness-skill-assessment-tracker.md` | Click an event heading to rank the class by it, best-first meaning fastest for a time event and highest for a count, with no-result rows held at the bottom either way. Print and CSV follow. |
| Exit Ticket / Bell Ringer Generator | `023-exit-ticket-generator.md` | A quarter-inch grid response area, with `print-color-adjust: exact` — without it the option looks right on screen and prints as an empty box. |

**Six new suites** (`command-center/smoke-seating-panel`,
`qr-code-generator/smoke-roster`, `gallery-walk-qr/smoke-projector`,
`testing-accommodations-card-generator/smoke-filter`,
`staff-directory-builder/smoke-departments`,
`fitness-skill-assessment-tracker/smoke-sort`), all wired into `npm test`
with their own `test:*` script; two existing suites extended
(`escape-room-builder/smoke-test-run` 39 → 57 checks,
`exit-ticket-generator/smoke-response-area` 27 → 36). Four of the eight tools
had no automated coverage at all before this round.

**`npm test` was red on `main` before this round**, in
`exit-ticket-generator/smoke-response-area.mjs`: an assertion measured the
response box against the whole slip and expected "more than half", but the
flex weights divide the space left *under* the question, so a two-line prompt
made it fail on a correct tool. It measures `share` (box against
box-plus-spacer) now. The full run is 42 suites green, with the one known-red
seating-chart mobile-toolbar assertion still failing for real; that belongs to
the "Phone-Sized Layout Pass" platform row and was left alone.

> **Correction, 2026-08-12 — a false claim in this round's commits.** Several
> commit messages and notes from this round state that `package.json` already
> referenced `Tools/qr-code-generator/test/smoke-roster.mjs`, that the file was
> never committed, and that the `&&`-chain therefore died two-thirds of the way
> down and a dozen suites had not been running. **None of that was true of
> `main`.** That reference exists only on the abandoned branch
> `claude/backlog-batch-2`, which happened to be checked out when this session
> read `package.json` for the first time; `git show 4cc1381:package.json` has
> no mention of the path. `npm test` on `main` ran its whole chain.
>
> The mistake had a real consequence, in the other direction: because the
> suite was believed to be already wired up, it was written and then referenced
> by nothing, and would have sat unrun indefinitely. It was found the next
> round by `Tools/board-check/check-tests.mjs` — the guard added for exactly
> this — reporting it as an ORPHAN, and it is now in the chain with a
> `test:qr` shortcut. The commits themselves are on `main` and were not
> rewritten; this note is the correction.

### Ranked-backlog batch, second round — 2026-08-12 02:35–05:10 UTC — session `r8kq4t` — branch `claude/backlog-batch-3-r8kq4t`

Ranks 1–8 of the ranked table again, immediately after the same session's
first batch. Claimed as a tagging-only push to `main` before any
implementation, per the protocol above. Does not change the "X of 46 (Pass
2)" tallies; no tool moved between the lists below.

| Tool | File | What shipped |
|---|---|---|
| Silent Reading (SSR) Log Tracker | `033-ssr-log-tracker.md` | A class reading-diet panel counted in **readers, not books**, scarcest genre first, with the existing filter now naming exactly who has finished none of it. Prints alongside the per-reader grid. |
| Parent/Guardian Contact Log | `068-parent-contact-log.md` | A reason breakdown over whatever is filtered, with the positive count pulled out and stated as a share. A term with nothing positive in it says so rather than leaving the line off. |
| Number Talks / Mental Math Routine Board | `024-number-talks-board.md` | An "include the answers" tick, on by default, that also strips the teaching note — several built-ins give the answer away in prose — and changes the printed header so the sheet says which version it is. |
| Test tooling | `Tools/board-check/check-tests.mjs` | A `check:tests` guard: MISSING (a wired path with no file), ORPHAN (a suite on disk nobody runs), and an advisory UNSCRIPTED. It found a real orphan immediately — see the correction below. |
| Grade Distribution Visualizer | `037-grade-distribution-visualizer.md` | The three holes left in the copy-failure path: a `ClipboardItem` constructor that throws synchronously and escaped the fallback entirely, a status nothing announced, and a "Copied" that never cleared. |
| Quiz / Review Game Board | `030-review-game-board.md` | A storage readout, with the ceiling found by probing (no API reports a quota) and the probe cleaning up after itself. Escalates in advice as well as colour past 70% and 90%. |
| Formula Reference Sheet Builder | `041-formula-sheet-builder.md` | An allowed-on-the-test subset with a printed "Approved for … — these formulas only" header. A missing flag reads as *allowed*, so switching the mode on cannot empty a year of saved sheets. |
| Prompt Builder | `029-prompt-builder.md` | `{{placeholder}}` tokens with a fill-in panel. Substitution happens on the way *out*, so the fields keep the placeholder and a saved preset stays a template. |

**Four more tools gained their first automated coverage** (formula sheet,
prompt builder — plus the previous round's four), and four existing suites
grew. `npm test` is 45 suites green, with the one known-red seating-chart
mobile-toolbar assertion still failing for real; that belongs to the
"Phone-Sized Layout Pass" platform row and was left alone. Two bugs were found
by the new suites rather than by inspection: prompt-builder token values were
written to the draft and never read back, and both new bar charts rendered as
empty tracks because a bare `<span>` is inline and ignores `width`.

**Three ranked rows were removed as already shipped** (verified against the
source, not the notes): Duty Roster per-staff counts, Experiment Design
Planner reordering, and Fraction–Decimal–Percent seeded generation, all
delivered by session `kq3g3h` and never taken off the list.

### Devon-assigned round — tool 062 — 2026-08-14 00:09 UTC — session `mee9kj` — branch `claude/ssdemo-062-mee9kj`

One of eight parallel social-studies-demo-round sessions (see
`prompts/social-studies-demo/_preamble.md` and its own
`062-geography-bee-mc.md` scope file), ahead of a live presentation to
teachers. Shipped the full headline plus its scope-coupled supporting work;
nothing was cut.

| Tool | File | What shipped |
|---|---|---|
| Geography Bee / Map Skills Quiz Generator | `062-geography-bee-quiz-generator.md` | **Multiple-choice quiz mode** (backlog rank 29) — a quiz-format setting (Short answer / Multiple choice, persisted in `gbq_settings_v1`) that auto-generates A&ndash;D options by sampling 3 distractors from other questions' answers in the same category, restricted to what the teacher can actually see (hidden built-ins excluded, active category filter honored); a category too thin for distractors falls back to short answer for that one question instead of padding with cross-category nonsense. The projector display shows lettered options with Reveal marking the correct one; the printed quiz gets lettered options and the key states the letter plus the answer text. A seeded mulberry32 PRNG (the Blank Map Generator's worksheet-versions pattern) makes a printed quiz reproducible by a teacher-facing "Quiz version" number. **Built-in bank grown from 30 to 90 questions** (30 per category, world-balanced beyond the original set's US/Europe lean, `bi30`&ndash;`bi89` appended — `bi0`&ndash;`bi29` untouched per the stable-id rule). **New smoke test** `Tools/geography-bee-quiz-generator/test/smoke-multiple-choice.mjs` (29 checks: distractor uniqueness/sourcing via the tool's own test hooks, hidden-built-in exclusion, same-seed-same-quiz, key-matches-paper, thin-pool fallback, format persistence, bank balance). |

Verified: `npm run check:dedupe` and `check:social` clean (no new drift —
062 already had no `gvb:social` block and stays that way, untouched per
scope); new suite green (29/29); a headless Chromium pass driving the real
MC flow end to end (projector reveal, hidden-built-in exclusion, print +
key match, thin-pool fallback, settings persistence) with zero console
errors and zero offsite requests. See `062-geography-bee-quiz-generator.md`
for the fuller writeup and where a future round should pick up (Blank Map
Generator integration remains the open Moonshot item, deliberately not
guessed at this round).

### Devon-assigned round — tool 054 — 2026-08-14 00:20 UTC — session `qfx7mz`

One of Devon's 8-session social studies demo round, direct assignment ahead
of a live presentation (per `prompts/social-studies-demo/_preamble.md`, not
picked from "Not yet touched"). Shipped the full scope of
`prompts/social-studies-demo/054-current-events-comparison.md` — headline plus
all three supporting items, nothing cut.

| Tool | File | What shipped |
|---|---|---|
| Current Events Discussion Guide Generator | `054-current-events-discussion-guide-generator.md` | **Headline (backlog rank 21):** an optional Article B (headline/source/body) on the existing named-guide object. With Article B present, "Pull out vocabulary" analyzes both articles and merges suggestions, words appearing in **both** articles are flagged (chip badge on screen, "core" tag in print) as the event's shared vocabulary, and Print switches to a side-by-side two-article layout with a new 6-question bias/framing preset set ("What does each headline emphasize?", "Which article would you trust more, and why?", etc.) alongside the existing 6 general questions. **Supporting:** a one-click "Load two-article example" seeding two ~195-word fictional articles about a town skate-park vote with different framing (teens-get-a-safe-place vs. lost-parking-worries-businesses), confirming before it overwrites unsaved work; share-by-link/QR copied from `028-primary-source-analysis-generator.html`'s pattern (`_shared/state-link.js` + `_shared/vendor/qrcode/qrcode.js`), an incoming link saves as a new guide rather than overwriting the recipient's; a new smoke suite (`Tools/current-events-discussion-guide-generator/test/smoke-comparison.mjs`, 38 assertions) covering Article B persistence, shared-vocab flagging, the comparison print layout, the Load Example flow, and the share-link round trip, wired in as `test:current-events` and appended to the `test` chain. |

Verified: `npm run check:dedupe` and `npm run check:social` clean (no new
drift; this tool still has no `gvb:social` block, unchanged), the new suite
green (38/38, zero console errors, zero offsite requests across all pages
driven), and a manual headless-Chromium pass confirmed Load Example seeds
both summaries and flags 8 shared words. No new localStorage keys — Article
B rides the existing `cedg_guide_v1:<name>` guide object, so
`009-backup-restore.html` needed no changes. Where a future round should
pick up: this tool's own `improvement prompts/054-*.md` Status entry has the
full list (reading-level estimate, a question-set library beyond the two
built-in sets, and the still-open AI-assisted-mode question).

### Devon-assigned round — tool 028 — 2026-08-14 00:10 UTC — session `qzmvhx`

One of 8 parallel sessions in Devon's social-studies demo round ahead of a
live presentation to teachers (see `prompts/social-studies-demo/_preamble.md`
and `028-primary-source-analysis.md`). Shipped the headline feature
completely; no supporting items were cut.

| Tool | File | What shipped |
|---|---|---|
| Primary Source Analysis Worksheet Generator | `028-primary-source-analysis-generator.md` | Corroboration mode (backlog rank 3): an optional Source B (text/description/image, own citation) prints side by side with Source A under shared framework questions, with dual per-source answer areas and a closing agree/disagree/more-reliable comparison block; the answer key mirrors it with per-source teacher notes plus a comparison key. A "Load Boston Massacre example" button (P15) demos it with a real two-source pair. The share link now carries the corroboration fields (images still excluded). First automated test for this tool (`test:primary-source`, 42 assertions). |

Backlog row covered: rank 3, "Side-by-side corroboration worksheet." No new
localStorage keys, so `009-backup-restore.html` needed no changes; no new
production files, so `sw.js` needed no changes either (only a `test/`
subfolder was added, which the precache list already excludes). Verification:
`npm run check:dedupe` and `npm run check:social` both clean (no `<head>`
changes made, so social check wasn't required but was run anyway); inline
script syntax-checked with `node --check`; new suite green (42/42, zero
console errors, nothing left the site) both standalone and via
`npm run test:primary-source`; headline feature also driven manually in a
live headless-Chromium session. See the tool's own `improvement
prompts/028-primary-source-analysis-generator.md` Status entry for the full
writeup and where a future round should pick up (page-space testing with two
large uploaded images side by side).

### Devon-assigned round — tool 056 — 2026-08-14 00:30 UTC — session `xo4v63`

One of 8 parallel sessions in a Devon-assigned social-studies demo round
(see `prompts/social-studies-demo/_preamble.md`). Shipped "share a packet by
link" (backlog rank 23) in full, sequenced multi-save first as scoped:

| Tool | File | What shipped |
|---|---|---|
| DBQ / Source Packet Builder | `056-dbq-source-packet-builder.md` | Multiple named saved packets (triple-key `dbq:*` store, migrated from the old single-blob save); share a packet by link/QR that excludes image pixel data but names on-device-only images by letter and title; an incoming link always saves as a new, uniquely-named packet; JSON export/import (carries images); a worked Industrial Revolution child-labor example packet a fresh install opens on. New smoke test `Tools/dbq-source-packet-builder/test/smoke-share.mjs` (`npm run test:dbq`), 32 assertions. |

### Devon-assigned round — tool 050 — 2026-08-14 00:12 UTC — session `tjkd6u`

Part of Devon's 8-session social studies demo round (`prompts/social-studies-demo/`),
each session assigned exactly one tool ahead of a live presentation to
teachers — an explicit override of the "don't repick done tools" default per
that round's own preamble.

| Tool | File | What shipped |
|---|---|---|
| Government/Civics Simulation Role Card Generator | `050-civics-role-card-generator.md` | Headline: per-role case-file packets (backlog rank 17) — an optional long-form Case file field per role that prints as a companion page behind each printed copy of that role's card, headed with the role name and (when assigned) the student's name. All three starter templates ship sample case-file text so it demos from the defaults. Supporting: share link + QR (state-link.js, same pattern as 028), with a confirm-dialog fallback since multi-save didn't ship this round; a new sibling smoke-test file (`smoke-case-file-packets.mjs`, 27 assertions). Cut per the assignment's own cut rule: multiple named saved simulations. |

No new `localStorage` key was introduced (case-file text lives inside the
existing `crcg_roles_v1` blob), so `009-backup-restore.html` needed no
changes. No `sw.js` changes either — the only new file is a test file, which
this repo's convention excludes from `PRECACHE_URLS`.

### Devon-assigned round — tool 064 — 2026-08-14 00:12 UTC — session `vqrmlk`

One of eight parallel SS-demo-round sessions (see `_preamble.md`), each
assigned one tool ahead of Devon's live teacher presentation. Step 0 (a
mandatory revisit) first: **backlog rank 31, "Batch-add blank cards from a
roster," is confirmed stale** — a paste-a-list batch-add dialog already
shipped in the prior Visual-upgrade round (2026-08-13), and works as
described. Nothing to build there; see `064-historical-trading-card-maker.md`
Status for the full writeup. Then, per this round's own scope:

| Tool | File | What shipped |
|---|---|---|
| Historical Figure / Country Trading Card Maker | `064-historical-trading-card-maker.md` | Headline (P3): share a deck with another teacher by link or QR code (card text/stats/theme/rarity travel, photos never do; an oversized deck falls back to the copy-link message instead of an unscannable QR; an incoming link always lands as a new deck, never overwriting one already on the device). Supporting: a `np_rosters`-fed class-list dropdown next to the existing roster paste box (P2); a one-click "Load sample deck" with 5 real historical-figure cards, mixed rarity/theme, no photos (P15). New `smoke-share.mjs` (55 assertions) plus the two existing suites stayed green throughout. |

### Devon-assigned round — tool 015 — 2026-08-14 00:52 UTC — session `mq7fkd`

One of eight parallel sessions in the social studies demo round, each owning
a single tool ahead of a live staff presentation. Devon-assigned, which
overrides this file's "don't repick done tools" rule.

| Tool | File | What shipped |
|---|---|---|
| Timeline Builder | `015-timeline-builder.md` | **Map + timeline print** (`IDEAS_BACKLOG.md` rank 2 "Timeline plus map print"; P7) — events gained an optional place with a ~145-entry built-in gazetteer, and a new landscape print pairs an auto-fitted base map (numbered pins, US state outlines or world countries as appropriate) with the existing spatial timeline carrying the same numbers. Plus a one-click American Revolution example (P15), share by link/QR excluding photos (P3), and the tool's first automated suite (`npm run test:timeline`, 49 assertions). |

**Backlog row:** rank 2, "Timeline plus map print" — shipped. Nothing found
stale. The example and the share links came from this tool's own file rather
than from a numbered row.

The base map is rendered by calling
`Tools/blank-map-generator/bmg-vector.js` (read first and confirmed
standalone — it reads only `preset.bounds`/`preset.dataset` and resolves its
own data directory), not by a second renderer. Nothing new was vendored; that
module and its `data/` files were already precached. The runtime coupling
that creates, and the case for moving the renderer into `_shared/`, is logged
in `_site-requests.md` — it could not be done this round, since `_shared/` was
off limits to all eight sessions and `Tools/blank-map-generator/` was owned by
a concurrent one.

Timeline Builder did not clear its list — the projected navigation mode and
the printed cut-apart ordering activity are still open — so it does not move
to `stable tools/`.

---

## Not yet touched

Pick from here. No particular order is implied — group them however makes
sense for a round (by subject, by shared machinery, by print-heavy vs
data-heavy), and say why in the PR. Skip anything already listed in
**Currently claimed**.

- Digital Hall Pass / Sign-Out Log — `001-hall-pass-log.md`
- Classroom Timer — `004-classroom-timer.md`
- Seating Chart Generator — `005-seating-chart-generator.md`
- Name Picker — `007-name-picker.md`
- Behavior & Points Tracker — `008-behavior-points-tracker.md`

---

## Threads left open across rounds

Not a queue, and not a reason to re-open a finished tool — but if one of these
lands naturally inside a tool you are already working on, take it.

- **Adopt the shared student record.** Class Roster Hub owns
  `crh_students_v1` (stable ids, preferred name, pronunciation) and Name
  Picker reads it via `Tools/name-picker/np-details.js`, which is the pattern
  to copy. Every tool that keys student history on a name string would
  benefit; the Behavior & Points Tracker is where it would save the most data.
- **P1 projector mode.** Command Center has one now as a display state rather
  than a separate page. Any tool that gets projected could copy the approach.
- **P5 CDN dependencies.** All three tools that used to load a library from
  cdnjs have now been fixed, each the same way — vendor it locally, source
  pulled from the library's npm package rather than cdnjs itself, since
  cdnjs was unreachable from more than one session's sandbox this round of
  rounds: `011-image-to-pdf.html` (jsPDF, Round 3, PR #54, vendored into
  `Tools/image-to-pdf/lib/`), `031-docx-merger.html` (JSZip, Round 6, PR #58,
  vendored into `Tools/docx-merger/lib/` — see the npm-package fallback
  approach documented in `031-docx-merger.md`'s Status section), and
  `044-Sub Plan Builder.html` (JSZip, Round 8, PR #61, vendored into the new
  `Tools/sub-plan-builder/lib/` via `npm pack jszip@3.10.1`). No known CDN
  dependency remains on the site as of Round 8, but it's worth a fresh grep
  for `cdnjs.cloudflare.com` (or any other CDN host) if a future round adds
  a library, rather than assuming this list is exhaustive forever.
- **P8 backup compatibility.** `Tools/009-backup-restore.html` keeps two lists
  that go stale silently: `KNOWN_GROUPS` (friendly names in the scan table)
  and `STUDENT_KEYS` (what the year-end clear is allowed to erase). **A tool
  that starts writing a new storage key — especially one holding student
  names — needs adding to both**, or it shows up as "Other saved data" and
  survives a year-end clear.
- **Content-bank + display + handout convergence.** After Round 4 (PR #55),
  this pattern now exists independently in `023-exit-ticket-generator.html`,
  `024-number-talks-board.html`, and `025-writing-prompt-generator.html` — each has
  its own bank editor, its own fullscreen/projector stage wiring, and its
  own print handout. The fullscreen-stage code in particular is now
  near-identical in three places (and also in `021-pe-tournament-stations.html`).
  Worth lifting into a shared `_shared/` helper next time one of these four
  is touched, rather than writing a fifth copy.
- **Rotation/bracket engine duplication.** `020-bracket-tournament-generator.html`
  and `021-pe-tournament-stations.html` still have separate bracket/rotation
  logic after Round 4 (each grew independently this round, deliberately
  scoped that way to avoid a risky shared-engine refactor mid-round). A
  future round could unify them — `bracket-tournament-generator`'s new
  round-robin/scheduling code and `pe-tournament-stations`'s rotation timer
  are the two halves to reconcile.
- **Read-only cross-tool bridge pattern.** `025-writing-prompt-generator.html`
  added `wpg-rubric-link.js`, which reads Rubric Builder's own localStorage
  keys read-only and writes back only the `:current` pointer Rubric Builder
  already watches on boot — no shared library, no format negotiation. This
  is a lighter-weight alternative to a full shared-hub tool and is worth
  copying wherever a tool wants to reference another tool's data without
  taking on a dependency.
- **BroadcastChannel is same-device only.** `021-pe-tournament-stations.html`'s
  new phone/remote-control feature confirmed empirically that
  `BroadcastChannel` only bridges tabs within the same browser
  context/profile — it does not work across two different phones/devices.
  Any future "phone as remote" work (P9) needs a different mechanism (e.g.
  WebRTC pairing, as `035-schedule-visualizer.html` already uses) for true
  cross-device control.
- **`hidden` loses to `display: flex`.** Round 10 found a control in the
  Blank Map Generator's toolbar that had been visible whenever it shouldn't
  be, because the element carried `hidden` but its class set
  `display: flex` — which outranks the browser's own `[hidden]` rule. Any
  tool that hides a flex/grid-displayed element by attribute needs an
  explicit `[hidden] { display: none; }` rule; worth a grep wherever a
  toolbar control is toggled this way.
- **`height` + `overflow: hidden` on a print block silently clips content.**
  `047-art-critique-worksheet-generator.html`'s half-sheet print CSS used
  `height: 47vh; overflow: hidden`, which cut off a worksheet's later
  follow-up questions with zero visual warning on screen — the printed
  page just quietly lost content. Fixed there by switching to
  `min-height: 47vh` (no `overflow: hidden`), letting normal page flow
  carry any overflow onto the next printed page instead of eating it.
  `070-peer-feedback-checklist-generator.html` had the exact same pattern
  and has since picked up the identical `min-height` fix (session
  `4o6xmy`'s held-out-batch round), layered on top of that same round's
  own on-screen size warning and two-tier print font/spacing scaling —
  see `_site-requests.md`'s matching entry for the fuller writeup and a
  third variant of the same fix in `076-sub-note-feedback-slip-generator.html`.
- **Multi-save localStorage convention: `list` / `data:<name>` / `current`.**
  Formula Sheet Builder (`Tools/formula-sheet-builder/fsb-store.js`) was
  the first to name this pattern explicitly — a `list` key holding an
  array of saved names, a `data:<name>`-prefixed key per saved item, and a
  `current` key pointing at whichever one is open. Plot Diagram Builder
  (072, session `4o6xmy`'s held-out-batch round) copied the same
  three-key shape inline (no support folder yet) to add multiple named
  diagrams, including a one-time migration path for any pre-existing
  single-document data under the old key. Any tool moving from "one
  document per browser" to "multiple named documents" should copy this
  shape rather than invent a new one.
- **Generated-output drift is a real failure mode, not just a theoretical
  one.** Round 7 found that `035-schedule-visualizer.html`'s "Publish" button
  would produce a broken `034-schedule-browser.html` (undefined `escHtml`/
  `escJsAttr` — fixed) and, separately, one missing three real feature
  generations' worth of code (R61–R63: PNG download, share links, staleness
  banner, Compare mode — documented but not ported, too large for one
  round). If another tool on this site generates a second artifact from a
  first (a template, a published snapshot, an exported format), it's worth
  checking whether the two have quietly diverged the same way before
  assuming the generator is still the source of truth.
