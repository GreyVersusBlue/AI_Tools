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

---

## Not yet touched

Pick from here. No particular order is implied — group them however makes
sense for a round (by subject, by shared machinery, by print-heavy vs
data-heavy), and say why in the PR.

- Blank Map Generator — `blank-map-generator.md`
- Certificate & Award Maker — `certificate-award-maker.md`
- Data Table → Chart Builder — `data-chart-builder.md`
- Word Doc Merger — `docx-merger.md`
- Field Trip Permission Slip Generator — `field-trip-permission-slip.md`
- Final Grade Checker — `final-grade-checker.md`
- Formula Reference Sheet Builder — `formula-sheet-builder.md`
- Grade Distribution Visualizer — `grade-distribution-visualizer.md`
- Math Fact Drill Sheet Generator — `math-drill-generator.md`
- Novel Study / Reading Circles Manager — `novel-study-circles-manager.md`
- Primary Source Analysis Worksheet Generator — `primary-source-analysis-generator.md`
- Prompt Builder — `prompt-builder.md`
- Quiz / Review Game Board — `review-game-board.md`
- East Middle Schedule Browser — `schedule-browser.md`
- School Layout Visualizer — `schedule-visualizer.md`
- School Calendar Visualizer — `school-calendar-visualizer.md`
- Silent Reading (SSR) Log Tracker — `ssr-log-tracker.md`
- Sub Binder / Day Bundle Generator — `sub-binder-generator.md`
- Sub Plan Builder — `sub-plan-builder.md`
- Vocab & Conjugation Drill Generator — `vocab-conjugation-drill.md`
- Vocabulary Flashcard & Word Wall Generator — `vocab-flashcard-generator.md`

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
- **P5 CDN dependencies.** `Sub Plan Builder.html` and `docx-merger.html`
  still load JSZip from cdnjs — both are on the untouched list, so this gets
  fixed as a side effect if whoever takes them remembers.
  `image-to-pdf.html` had the same issue with jsPDF and was fixed in Round 3
  (PR #54, vendored into `Tools/image-to-pdf/lib/`).
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
