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
> When the "Not yet touched" list is empty, that is the signal to **reset**:
> move every tool back to "Not yet touched", start a new round-number series,
> and begin the second pass. Devon may also reset it early, or move a specific
> tool back up, and that overrides everything here.

## How to use this file

1. Read this file first and pick from **Not yet touched**.
2. Do the work; update that tool's own `improvement prompts/<tool>.md` with
   what shipped, what was hard, and where the next round should pick up.
3. Move the tool from **Not yet touched** to **Already done**, in the table
   for your round, with the PR number.
4. Do **not** edit `_platform-themes.md` — it is read-only reference material
   shared by parallel sessions.

Only the round tables and the two lists below change. Keep the format.

---

## Already done

Counted from the start of the improvement-prompts programme. A tool may have
had unrelated fixes before that; those are not rounds.

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

---

## Not yet touched

Pick from here. No particular order is implied — group them however makes
sense for a round (by subject, by shared machinery, by print-heavy vs
data-heavy), and say why in the PR.

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
