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
| Digital Hall Pass / Sign-Out Log | `hall-pass-log.md` |
| Group / Team Generator | `group-team-generator.md` |
| Rubric Builder | `rubric-builder.md` |
| Classroom Timer | `classroom-timer.md` |
| Seating Chart Generator | `seating-chart-generator.md` |

### Round 2 — 2026-08-10 — PR #52

The platform spine: the tools that own shared data or compose it.

| Tool | File |
|---|---|
| Class Roster Hub | `class-roster-hub.md` |
| Name Picker | `name-picker.md` |
| Behavior & Points Tracker | `behavior-points-tracker.md` |
| Backup & Restore | `backup-restore.md` |
| Command Center | `command-center-dashboard.md` |

### Round 3 — 2026-08-10 — PR #54

Print-heavy and cross-cutting: a document assembler, a paper generator, two
tools that gained a shared-roster/print upgrade, and a timeline that got a
category legend + fill-in worksheet mode.

| Tool | File |
|---|---|
| Image → PDF Assembler | `image-to-pdf.md` |
| Graph Paper & Number Line Generator | `graph-paper-generator.md` |
| Lab Safety Contract Tracker | `lab-safety-contract-tracker.md` |
| Immersion Roleplay Scenario Generator | `roleplay-scenario-generator.md` |
| Timeline Builder | `timeline-builder.md` |

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
| QR Code Generator | `qr-code-generator.md` |
| Gallery Walk QR Codes | `gallery-walk-qr.md` |
| QR Scavenger Hunt Builder | `qr-scavenger-hunt-builder.md` |
| Digital Escape Room / Puzzle Lock Builder | `escape-room-builder.md` |
| Bracket / Tournament Generator | `bracket-tournament-generator.md` |
| Tournament Bracket & Station Rotation (PE) | `pe-tournament-stations.md` |
| Lab Group & Role Randomizer | `lab-group-role-randomizer.md` |
| Exit Ticket / Bell Ringer Generator | `exit-ticket-generator.md` |
| Number Talks / Mental Math Routine Board | `number-talks-board.md` |
| Writing Prompt Generator | `writing-prompt-generator.md` |

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
| Math Fact Drill Sheet Generator | `math-drill-generator.md` |
| Novel Study / Reading Circles Manager | `novel-study-circles-manager.md` |
| Primary Source Analysis Worksheet Generator | `primary-source-analysis-generator.md` |
| Prompt Builder | `prompt-builder.md` |
| Quiz / Review Game Board | `review-game-board.md` |

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
| Word Doc Merger | `docx-merger.md` |
| School Calendar Visualizer | `school-calendar-visualizer.md` |
| Silent Reading (SSR) Log Tracker | `ssr-log-tracker.md` |

**33 of 46 tools done. 13 to go.**

### Round 7 — 2026-08-10 — PR #60

A linked pair: the published schedule browser and the 19,400-line tool that
generates it. Found, along the way, that the two had already drifted apart —
`schedule-browser.html` carries real features
(PNG download, share links, staleness banner, Common Planning/Compare mode)
that don't exist in `schedule-visualizer.html`'s publisher at all, and the
publisher's own function list was missing two helpers its stringified
functions actually call, which would throw a `ReferenceError` on the browser's
two core views the moment anyone published fresh. The second bug — the crash
— got fixed this round; the first — the feature drift — was judged too large
to port safely into a file this size in one sitting and is documented in
detail instead, with four Quick Wins shipped by hand to the real,
currently-shipped `schedule-browser.html` in the meantime.

| Tool | File |
|---|---|
| East Middle Schedule Browser | `schedule-browser.md` |
| School Layout Visualizer | `schedule-visualizer.md` |

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
| Final Grade Checker | `final-grade-checker.md` |
| Grade Distribution Visualizer | `grade-distribution-visualizer.md` |
| Data Table → Chart Builder | `data-chart-builder.md` |
| Vocab & Conjugation Drill Generator | `vocab-conjugation-drill.md` |
| Vocabulary Flashcard & Word Wall Generator | `vocab-flashcard-generator.md` |
| Formula Reference Sheet Builder | `formula-sheet-builder.md` |
| Certificate & Award Maker | `certificate-award-maker.md` |
| Field Trip Permission Slip Generator | `field-trip-permission-slip.md` |
| Sub Plan Builder | `sub-plan-builder.md` |
| Sub Binder / Day Bundle Generator | `sub-binder-generator.md` |

**45 of 46 tools done. 1 to go.**

### Rounds 9 and 10 — 2026-08-10 — PRs #64 and #65

The last tool on the list, and the only one to get two rounds in this pass —
both at Devon's direct request rather than by picking from the list below.
Round 9 (PR #64) did page shapes and turned Print/Save PDF into genuine
map exports instead of a screenshot of the web page. Round 10 did the
classroom-worksheet cluster: numbered fill-in-the-blank worksheets with
answer keys and shuffled versions, reusable label sets, a label
de-overlapping pass, semantic line types, and a projector-ready quiz mode
with scoring. See `blank-map-generator.md` for what each round shipped and
where the next one should pick up.

| Tool | File |
|---|---|
| Blank Map Generator | `blank-map-generator.md` |

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

Art Critique Worksheet Generator (`art-critique-worksheet-generator.md`) ·
Student Art Portfolio Label & QR Tag Maker (`art-portfolio-label-maker.md`) ·
Book Tasting Menu Generator (`book-tasting-menu-generator.md`) ·
Government/Civics Simulation Role Card Generator (`civics-role-card-generator.md`) ·
Classroom Label Maker, Target Language (`classroom-label-maker.md`) ·
Cognates & False Friends Reference List Builder (`cognates-false-friends-builder.md`) ·
Cultural Trivia Card Generator (`cultural-trivia-card-generator.md`) ·
Current Events Discussion Guide Generator (`current-events-discussion-guide-generator.md`) ·
Daily Editing / DOL Warm-Up Generator (`daily-editing-warmup-generator.md`) ·
DBQ / Source Packet Builder (`dbq-source-packet-builder.md`) ·
Dichotomous Key Builder (`dichotomous-key-builder.md`) ·
Duty Roster Builder (`duty-roster-builder.md`) ·
Scientific Method / Experiment Design Planner (`experiment-design-planner.md`) ·
Fitness & Skill Assessment Tracker (`fitness-skill-assessment-tracker.md`) ·
Fraction–Decimal–Percent Conversion Drill Generator (`fraction-decimal-percent-drill-generator.md`) ·
Geography Bee / Map Skills Quiz Generator (`geography-bee-quiz-generator.md`) ·
Grammar Mad Libs Generator (`grammar-mad-libs-generator.md`) ·
Historical Figure / Country Trading Card Maker (`historical-trading-card-maker.md`) ·
Lab Report Template Builder (`lab-report-template-builder.md`) ·
Math "Find the Mistake" Warm-Up Generator (`math-find-the-mistake-generator.md`) ·
Music Sight-Reading / Rhythm Warm-Up Generator (`music-sightreading-generator.md`) ·
Parent/Guardian Contact Log (`parent-contact-log.md`) ·
PE Warm-Up Circuit Card Generator (`pe-warmup-circuit-generator.md`) ·
Peer Feedback / Editing Checklist Generator (`peer-feedback-checklist-generator.md`) ·
Picture-Prompt Speaking/Writing Task Generator (`picture-prompt-generator.md`) ·
Story Elements / Plot Diagram Builder (`plot-diagram-builder.md`) ·
Science Fair Project Tracker (`science-fair-project-tracker.md`) ·
Science Safety Symbol & Equipment Label Maker (`science-safety-label-maker.md`) ·
Staff Directory / Quick-Reference Builder (`staff-directory-builder.md`) ·
Sub Note / Feedback Slip Generator (`sub-note-feedback-slip-generator.md`) ·
Testing Accommodations Reference Card Generator (`testing-accommodations-card-generator.md`) ·
Unit Conversion Reference Chart Builder (`unit-conversion-chart-builder.md`) ·
Verb Conjugation Reference Poster Generator (`verb-conjugation-poster-generator.md`) ·
Virtual Manipulatives Board (`virtual-manipulatives-board.md`) ·
Word Problem Warm-Up Generator (`word-problem-warmup-generator.md`)

---

## Not yet touched

Pick from here. No particular order is implied — group them however makes
sense for a round (by subject, by shared machinery, by print-heavy vs
data-heavy), and say why in the PR. Skip anything already listed in
**Currently claimed**.

- Digital Hall Pass / Sign-Out Log — `hall-pass-log.md`
- Group / Team Generator — `group-team-generator.md`
- Rubric Builder — `rubric-builder.md`
- Classroom Timer — `classroom-timer.md`
- Seating Chart Generator — `seating-chart-generator.md`
- Class Roster Hub — `class-roster-hub.md`
- Name Picker — `name-picker.md`
- Behavior & Points Tracker — `behavior-points-tracker.md`
- Backup & Restore — `backup-restore.md`
- Command Center — `command-center-dashboard.md`
- Image → PDF Assembler — `image-to-pdf.md`
- Graph Paper & Number Line Generator — `graph-paper-generator.md`
- Lab Safety Contract Tracker — `lab-safety-contract-tracker.md`
- Immersion Roleplay Scenario Generator — `roleplay-scenario-generator.md`
- Timeline Builder — `timeline-builder.md`
- QR Code Generator — `qr-code-generator.md`
- Gallery Walk QR Codes — `gallery-walk-qr.md`
- QR Scavenger Hunt Builder — `qr-scavenger-hunt-builder.md`
- Digital Escape Room / Puzzle Lock Builder — `escape-room-builder.md`
- Bracket / Tournament Generator — `bracket-tournament-generator.md`
- Tournament Bracket & Station Rotation (PE) — `pe-tournament-stations.md`
- Lab Group & Role Randomizer — `lab-group-role-randomizer.md`
- Exit Ticket / Bell Ringer Generator — `exit-ticket-generator.md`
- Number Talks / Mental Math Routine Board — `number-talks-board.md`
- Writing Prompt Generator — `writing-prompt-generator.md`
- Math Fact Drill Sheet Generator — `math-drill-generator.md`
- Novel Study / Reading Circles Manager — `novel-study-circles-manager.md`
- Primary Source Analysis Worksheet Generator — `primary-source-analysis-generator.md`
- Prompt Builder — `prompt-builder.md`
- Quiz / Review Game Board — `review-game-board.md`
- Word Doc Merger — `docx-merger.md`
- School Calendar Visualizer — `school-calendar-visualizer.md`
- Silent Reading (SSR) Log Tracker — `ssr-log-tracker.md`
- East Middle Schedule Browser — `schedule-browser.md`
- School Layout Visualizer — `schedule-visualizer.md`
- Final Grade Checker — `final-grade-checker.md`
- Grade Distribution Visualizer — `grade-distribution-visualizer.md`
- Data Table → Chart Builder — `data-chart-builder.md`
- Vocab & Conjugation Drill Generator — `vocab-conjugation-drill.md`
- Vocabulary Flashcard & Word Wall Generator — `vocab-flashcard-generator.md`
- Formula Reference Sheet Builder — `formula-sheet-builder.md`
- Certificate & Award Maker — `certificate-award-maker.md`
- Field Trip Permission Slip Generator — `field-trip-permission-slip.md`
- Sub Plan Builder — `sub-plan-builder.md`
- Sub Binder / Day Bundle Generator — `sub-binder-generator.md`
- Blank Map Generator — `blank-map-generator.md`

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
  rounds: `image-to-pdf.html` (jsPDF, Round 3, PR #54, vendored into
  `Tools/image-to-pdf/lib/`), `docx-merger.html` (JSZip, Round 6, PR #58,
  vendored into `Tools/docx-merger/lib/` — see the npm-package fallback
  approach documented in `docx-merger.md`'s Status section), and
  `Sub Plan Builder.html` (JSZip, Round 8, PR #61, vendored into the new
  `Tools/sub-plan-builder/lib/` via `npm pack jszip@3.10.1`). No known CDN
  dependency remains on the site as of Round 8, but it's worth a fresh grep
  for `cdnjs.cloudflare.com` (or any other CDN host) if a future round adds
  a library, rather than assuming this list is exhaustive forever.
- **P8 backup compatibility.** `Tools/backup-restore.html` keeps two lists
  that go stale silently: `KNOWN_GROUPS` (friendly names in the scan table)
  and `STUDENT_KEYS` (what the year-end clear is allowed to erase). **A tool
  that starts writing a new storage key — especially one holding student
  names — needs adding to both**, or it shows up as "Other saved data" and
  survives a year-end clear.
- **Content-bank + display + handout convergence.** After Round 4 (PR #55),
  this pattern now exists independently in `exit-ticket-generator.html`,
  `number-talks-board.html`, and `writing-prompt-generator.html` — each has
  its own bank editor, its own fullscreen/projector stage wiring, and its
  own print handout. The fullscreen-stage code in particular is now
  near-identical in three places (and also in `pe-tournament-stations.html`).
  Worth lifting into a shared `_shared/` helper next time one of these four
  is touched, rather than writing a fifth copy.
- **Rotation/bracket engine duplication.** `bracket-tournament-generator.html`
  and `pe-tournament-stations.html` still have separate bracket/rotation
  logic after Round 4 (each grew independently this round, deliberately
  scoped that way to avoid a risky shared-engine refactor mid-round). A
  future round could unify them — `bracket-tournament-generator`'s new
  round-robin/scheduling code and `pe-tournament-stations`'s rotation timer
  are the two halves to reconcile.
- **Read-only cross-tool bridge pattern.** `writing-prompt-generator.html`
  added `wpg-rubric-link.js`, which reads Rubric Builder's own localStorage
  keys read-only and writes back only the `:current` pointer Rubric Builder
  already watches on boot — no shared library, no format negotiation. This
  is a lighter-weight alternative to a full shared-hub tool and is worth
  copying wherever a tool wants to reference another tool's data without
  taking on a dependency.
- **BroadcastChannel is same-device only.** `pe-tournament-stations.html`'s
  new phone/remote-control feature confirmed empirically that
  `BroadcastChannel` only bridges tabs within the same browser
  context/profile — it does not work across two different phones/devices.
  Any future "phone as remote" work (P9) needs a different mechanism (e.g.
  WebRTC pairing, as `schedule-visualizer.html` already uses) for true
  cross-device control.
- **`hidden` loses to `display: flex`.** Round 10 found a control in the
  Blank Map Generator's toolbar that had been visible whenever it shouldn't
  be, because the element carried `hidden` but its class set
  `display: flex` — which outranks the browser's own `[hidden]` rule. Any
  tool that hides a flex/grid-displayed element by attribute needs an
  explicit `[hidden] { display: none; }` rule; worth a grep wherever a
  toolbar control is toggled this way.
- **Generated-output drift is a real failure mode, not just a theoretical
  one.** Round 7 found that `schedule-visualizer.html`'s "Publish" button
  would produce a broken `schedule-browser.html` (undefined `escHtml`/
  `escJsAttr` — fixed) and, separately, one missing three real feature
  generations' worth of code (R61–R63: PNG download, share links, staleness
  banner, Compare mode — documented but not ported, too large for one
  round). If another tool on this site generates a second artifact from a
  first (a template, a published snapshot, an exported format), it's worth
  checking whether the two have quietly diverged the same way before
  assuming the generator is still the source of truth.
