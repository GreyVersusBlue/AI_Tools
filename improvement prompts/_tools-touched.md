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
3. Do the work; update that tool's own `improvement prompts/<tool>.md` with
   what shipped, what was hard, and where the next round should pick up.
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

Nothing claimed right now. When you claim a tool per "Claiming a tool"
above, add its row here; when the round ships, the row moves down to
**Already done** and is deleted from here.

| Tool | Session | Claimed at (UTC) | Branch |
|---|---|---|---|
| *(none)* | | | |

---

## Already done

Counted from the start of the improvement-prompts programme. A tool may have
had unrelated fixes before that; those are not rounds.

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
Leave them out until told otherwise:

Art Critique Worksheet Generator (`047-art-critique-worksheet-generator.md`) ·
Student Art Portfolio Label & QR Tag Maker (`048-art-portfolio-label-maker.md`) ·
Book Tasting Menu Generator (`049-book-tasting-menu-generator.md`) ·
Government/Civics Simulation Role Card Generator (`050-civics-role-card-generator.md`) ·
Classroom Label Maker, Target Language (`051-classroom-label-maker.md`) ·
Cognates & False Friends Reference List Builder (`052-cognates-false-friends-builder.md`) ·
Cultural Trivia Card Generator (`053-cultural-trivia-card-generator.md`) ·
Current Events Discussion Guide Generator (`054-current-events-discussion-guide-generator.md`) ·
Daily Editing / DOL Warm-Up Generator (`055-daily-editing-warmup-generator.md`) ·
DBQ / Source Packet Builder (`056-dbq-source-packet-builder.md`) ·
Dichotomous Key Builder (`057-dichotomous-key-builder.md`) ·
Duty Roster Builder (`058-duty-roster-builder.md`) ·
Scientific Method / Experiment Design Planner (`059-experiment-design-planner.md`) ·
Fitness & Skill Assessment Tracker (`060-fitness-skill-assessment-tracker.md`) ·
Fraction–Decimal–Percent Conversion Drill Generator (`061-fraction-decimal-percent-drill-generator.md`) ·
Geography Bee / Map Skills Quiz Generator (`062-geography-bee-quiz-generator.md`) ·
Grammar Mad Libs Generator (`063-grammar-mad-libs-generator.md`) ·
Historical Figure / Country Trading Card Maker (`064-historical-trading-card-maker.md`) ·
Lab Report Template Builder (`065-lab-report-template-builder.md`) ·
Math "Find the Mistake" Warm-Up Generator (`066-math-find-the-mistake-generator.md`) ·
Music Sight-Reading / Rhythm Warm-Up Generator (`067-music-sightreading-generator.md`) ·
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

### Held-out batch — Round 1 — 2026-08-11 01:29 UTC — session `8vo65u` — branch `claude/tools-047-51-improvements-8vo65u`

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
- Tournament Bracket & Station Rotation (PE) — `021-pe-tournament-stations.md`
- Lab Group & Role Randomizer — `022-lab-group-role-randomizer.md`
- Exit Ticket / Bell Ringer Generator — `023-exit-ticket-generator.md`
- Number Talks / Mental Math Routine Board — `024-number-talks-board.md`
- Writing Prompt Generator — `025-writing-prompt-generator.md`
- Math Fact Drill Sheet Generator — `026-math-drill-generator.md`
- Novel Study / Reading Circles Manager — `027-novel-study-circles-manager.md`
- Primary Source Analysis Worksheet Generator — `028-primary-source-analysis-generator.md`
- Prompt Builder — `029-prompt-builder.md`
- Quiz / Review Game Board — `030-review-game-board.md`
- Final Grade Checker — `036-final-grade-checker.md`
- Grade Distribution Visualizer — `037-grade-distribution-visualizer.md`
- Data Table → Chart Builder — `038-data-chart-builder.md`
- Vocab & Conjugation Drill Generator — `039-vocab-conjugation-drill.md`
- Vocabulary Flashcard & Word Wall Generator — `040-vocab-flashcard-generator.md`
- Formula Reference Sheet Builder — `041-formula-sheet-builder.md`
- Certificate & Award Maker — `042-certificate-award-maker.md`
- Field Trip Permission Slip Generator — `043-field-trip-permission-slip.md`
- Sub Plan Builder — `044-sub-plan-builder.md`
- Sub Binder / Day Bundle Generator — `045-sub-binder-generator.md`
- Blank Map Generator — `046-blank-map-generator.md`

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
  `070-peer-feedback-checklist-generator.html` has the exact same pattern
  flagged in its own improvement notes and hasn't been fixed yet — the
  same one-line change should work there too.
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
