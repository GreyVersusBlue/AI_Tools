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
the next 10 most important ideas" a well-defined request — take the 10 lowest-numbered *unclaimed* rows, skipping
any row already tagged 🔒 **CLAIMED**. See "Working the ranked Existing Tools list" under
[Picking one up](#picking-one-up) for the renumbering rule and how to claim rows so multiple chats can work this
list in parallel without colliding.

| Rank | Tool | Idea | What it would do |
|---|---|---|---|
| 1 | Immersion Roleplay Scenario Generator<br>`Tools/roleplay-scenario-generator.html` | 🔒 **CLAIMED (2026-08-09)** — Proficiency-level tag/filter | Add Novice/Intermediate/Advanced tagging alongside the existing category filter. |
| 2 | Immersion Roleplay Scenario Generator<br>`Tools/roleplay-scenario-generator.html` | 🔒 **CLAIMED (2026-08-09)** — Per-class scaffolding | Save filled-in scaffolding phrases per class/session instead of per scenario, so switching classes doesn't overwrite one class's answers with another's. |
| 3 | Vocab & Conjugation Drill Generator<br>`Tools/vocab-conjugation-drill.html` | 🔒 **CLAIMED (2026-08-09)** — Share a drill set between teachers | Add JSON export/import so language teachers on the same team can share a built conjugation table. |
| 4 | Primary Source Analysis Worksheet Generator<br>`Tools/primary-source-analysis-generator.html` | 🔒 **CLAIMED (2026-08-09)** — Share a built worksheet | Add JSON export/import so a department can share a worksheet (source + framework + notes) between colleagues. |
| 5 | Primary Source Analysis Worksheet Generator<br>`Tools/primary-source-analysis-generator.html` | 🔒 **CLAIMED (2026-08-09)** — Custom follow-up question per step | Let a teacher add their own question after the built-in guiding questions. |
| 6 | Primary Source Analysis Worksheet Generator<br>`Tools/primary-source-analysis-generator.html` | 🔒 **CLAIMED (2026-08-09)** — Configurable answer space | Make the number of blank answer lines per step adjustable instead of fixed. |
| 7 | Primary Source Analysis Worksheet Generator<br>`Tools/primary-source-analysis-generator.html` | 🔒 **CLAIMED (2026-08-09)** — Upload a local image | Support attaching a source image from a file instead of only an external image URL. |
| 8 | Vocabulary Flashcard & Word Wall Generator<br>`Tools/vocab-flashcard-generator.html` | 🔒 **CLAIMED (2026-08-09)** — Auto-shrinking text for long definitions | Prevent overflow/clipping on fixed-size cards when a definition runs long. |
| 9 | Math Fact Drill Sheet Generator<br>`Tools/math-drill-generator.html` | 🔒 **CLAIMED (2026-08-09)** — Optional timed-fluency header | Add a blank "Start time / End time" or "Target: ___ seconds" line, since the tool is framed as a drill tool but has no fluency-tracking element today. |
| 10 | Immersion Roleplay Scenario Generator<br>`Tools/roleplay-scenario-generator.html` | 🔒 **CLAIMED (2026-08-09)** — Read-aloud accessibility | Wire up the shared accessibility helper already used by sibling tools (vocab/conjugation drill, writing prompt generator) so the stage content gets the same treatment. |
| 11 | School Layout Visualizer<br>`Tools/schedule-visualizer.html` | 🔒 **CLAIMED (2026-08-09)** — Trace over a real floor plan | Import a photo or scan of the school's actual floor plan as a low-opacity background to trace over, instead of placing every room from a blank grid. |
| 12 | School Layout Visualizer<br>`Tools/schedule-visualizer.html` | 🔒 **CLAIMED (2026-08-09)** — Hand off an in-progress layout | Reuse the same QR/WebRTC pairing already used by Classroom Timer so two staff can co-edit the blueprint on separate devices over Wi-Fi, instead of manual JSON export/import. |
| 13 | School Layout Visualizer<br>`Tools/schedule-visualizer.html` | 🔒 **CLAIMED (2026-08-09)** — Copy publish HTML to clipboard | Let the "Publish for Teachers" step copy the generated file straight to the clipboard, so publishing doesn't need a local download-then-upload round trip through GitHub's web editor. |
| 14 | Digital Escape Room / Puzzle Lock Builder<br>`Tools/escape-room-builder.html` | 🔒 **CLAIMED (2026-08-09)** — Live "teacher monitor" view | Show which station each team has reached in real time on the teacher's own screen, using the toolkit's existing WebRTC/QR pairing pattern, instead of having to walk the room to check. |
| 15 | Digital Escape Room / Puzzle Lock Builder<br>`Tools/escape-room-builder.html` | 🔒 **CLAIMED (2026-08-09)** — Optional image per clue | Let a station carry a photo, the way Timeline Builder attaches photos to events, for picture-based puzzles instead of text-only clues. |

### Currently claimed (in progress elsewhere)

Nothing claimed right now — every row that was here has shipped (or graduated back to the ranked table above).
This section fills back in whenever a parallel session claims a row in `TOOL_IMPROVEMENTS_PLAN.md`; if a claim
goes stale (a day or two with nothing landed on `main`), it's fair game to reclaim in the plan file and add back to
the ranked list above at whatever rank fits.

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
