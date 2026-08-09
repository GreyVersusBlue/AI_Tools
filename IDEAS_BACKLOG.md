# Ideas Backlog

Everything that's been suggested for the toolkit but hasn't been built yet. This file is the source of truth for
the list — the "coming soon" rows on `index.html` and the public [`ideas-backlog.html`](ideas-backlog.html) page
should both be kept in sync with whatever's here.

Reminder: coming soon means not right now.

## General / Classroom Logistics

| Idea | What it would do |
|---|---|
| Parent/Guardian Contact Log | Log a call, email, or note home per student — date, method, and outcome — for quick reference before a conference or a difficult phone call. |

## Math

| Idea | What it would do |
|---|---|
| Virtual Manipulatives Board | A projector-friendly board of draggable base-ten blocks, fraction tiles, algebra tiles, and a number line for demonstrating a concept live, with a one-click snapshot of whatever's on the board. |

## English / Language Arts

| Idea | What it would do |
|---|---|
| Daily Editing / DOL Warm-Up Generator | A bank of broken sentences reveals one at a time on the projector with a click-to-show corrected version, plus a printable worksheet mode and a teacher-added custom sentence bank. |

## Science

| Idea | What it would do |
|---|---|
| Lab Report Template Builder | Build a reusable lab report template — hypothesis, materials, procedure, data table, and conclusion prompts — from a topic starter or from scratch, and print a fillable packet for each lab. |

## Social Studies

| Idea | What it would do |
|---|---|
| DBQ / Source Packet Builder | Assemble several primary or secondary sources, text or image, into one printable document-based-question packet with a shared set of guiding questions per source — pairs with the Primary Source Analysis Worksheet Generator. |

## World Language

| Idea | What it would do |
|---|---|
| Classroom Label Maker (Target Language) | Print vocabulary labels for real classroom objects in the target language, each with a QR code linking to a text-to-speech pronunciation clip, plus a plain reference sheet of the whole label set. |

## Arts & PE

| Idea | What it would do |
|---|---|
| Art Critique Worksheet Generator | A structured describe/analyze/interpret/judge critique worksheet for student artwork or a gallery walk, with editable prompts per step and a printable half-sheet per student — pairs with Gallery Walk QR Codes. |

## Existing Tools — Enhancement Ideas

These are improvements to tools that are already built and live on the site, not new standalone tools — so none of
these get an `index.html` "coming soon" row.

**Rank** is a single priority order across this whole table, 1 = most important, no ties. It's what makes "work on
the next 10 most important ideas" a well-defined request — take the 10 lowest-numbered *unclaimed* rows, skipping
any row already tagged 🔒 **CLAIMED**. See "Working the ranked Existing Tools list" under
[Picking one up](#picking-one-up) for the renumbering rule and how to claim rows so multiple chats can work this
list in parallel without colliding.

| Rank | Tool | Idea | What it would do |
|---|---|---|---|
| 1 | Final Grade Checker | "What do I need on the final?" calculator | Given a target letter grade or percentage, solve for the score needed on a specified remaining assignment/exam, alongside the existing forward calculation. |
| 2 | Rubric Builder | Score-a-student mode | Click a point value per criterion for a specific student against a saved rubric and get a live computed total, instead of only printing a blank rubric. |
| 3 | Seating Chart Generator | Per-student photo thumbnail | An optional photo (loaded from a local file, stored as a data URL) shown on the desk — useful for a substitute matching faces to names, and stays fully local. |
| 4 | Bracket / Tournament Generator | Double-elimination mode | A second bracket type alongside the existing single-elimination one, with the same click-to-advance and print support. |
| 5 | Data Table → Chart Builder | Box-and-whisker chart type | A fifth chart type alongside bar/line/pie/scatter, useful for showing score/measurement spread in a lab report. |
| 6 | Grade Distribution Visualizer | Compare more than one saved assignment at once | Extend the existing side-by-side comparison (currently limited to one other saved assignment) to several at a time, for tracking a trend across a unit. |
| 7 | Group / Team Generator | Recent-pairing memory | Remember the last shuffle or two so a reshuffle avoids repeating the same pairing back-to-back — the same fairness idea the Lab Group & Role Randomizer already uses for roles. |
| 8 | QR Code Generator | Bulk mode | Turn a pasted list (one label + link/text per line) into a printable grid of QR codes in one pass, instead of one code at a time. |
| 9 | Certificate & Award Maker | Optional QR code on the certificate | Link to a congratulatory note, video, or portfolio page, reusing the QR pattern already on the Field Trip Permission Slip. |
| 10 | Classroom Timer | Silent low-time visual cue | A flashing border/background at zero alongside the existing audio alert, for testing rooms or hearing-impaired students. |
| 11 | Vocabulary Flashcard & Word Wall Generator | Optional example-sentence line | A third field per card (beyond term/definition) printed smaller under the definition. |
| 12 | Silent Reading (SSR) Log Tracker | Weekly pages/minutes goal | An optional weekly goal per class, shown as a simple progress indicator next to each student's summary row. |

### Currently claimed (in progress elsewhere)

Nothing claimed right now — every row that was here has shipped (or graduated back to the ranked table above).

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

**Claiming rows to run chats in parallel:** ranks never change when something gets claimed — only when it ships or
is removed. To claim a batch:

1. Pick your batch from the lowest-numbered *unclaimed* rows (skip any row already tagged 🔒 CLAIMED — it doesn't
   count toward your N).
2. Prefix each claimed row's Idea cell with `🔒 **CLAIMED (YYYY-MM-DD)**` (today's date) — e.g.
   `🔒 **CLAIMED (2026-08-10)** — Custom operand ranges` — in both `IDEAS_BACKLOG.md` and `ideas-backlog.html`
   (wrap the idea name in `<span class="claimed">🔒 CLAIMED (YYYY-MM-DD)</span>` there, right before the name text).
3. Push that tagging-only commit to `main` by itself, *before* writing any implementation code, so other sessions
   pull the claim before picking their own batch.
4. When you finish (or abandon) a row, the same commit that removes/renumbers it (per the rule above) removes the
   claim tag with it. If you abandon it without shipping, just strip the tag instead and leave the row at its rank.
5. A claim more than a day or two old with no corresponding commit landed on `main` is stale — safe to treat as
   abandoned and reclaim.
