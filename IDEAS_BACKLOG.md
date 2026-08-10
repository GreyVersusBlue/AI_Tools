# Ideas Backlog

Everything that's been suggested for the toolkit but hasn't been built yet. This file is the source of truth for
the list — the "coming soon" rows on `index.html` and the public [`ideas-backlog.html`](ideas-backlog.html) page
should both be kept in sync with whatever's here.

Reminder: coming soon means not right now.

## General / Classroom Logistics

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## Math

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## English / Language Arts

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## Science

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## Social Studies

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## World Language

| Idea | What it would do |
|---|---|

Nothing on this list right now — every row that was here has shipped. Add a new idea here to start the list over.

## Arts & PE

| Idea | What it would do |
|---|---|
| Student Art Portfolio Label & QR Tag Maker | Printable labels and QR tags for physical student art portfolios, each code linking to a photo or description — pairs with Gallery Walk QR Codes. |
| Music Sight-Reading / Rhythm Warm-Up Generator | Randomized rhythm or sight-reading warm-up patterns for a projector display, for band, chorus, or general music class. |
| PE Warm-Up Circuit Card Generator | Printable warm-up/calisthenics circuit cards to post at stations before a rotation or tournament begins. |

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

Nothing on this list right now — every row that was here has shipped. Add a new enhancement idea here at whatever
rank reflects its priority to start the list over.

### Currently claimed (in progress elsewhere)

Nothing claimed right now — every row that was here has shipped (or graduated back to the ranked table above).

## Platform-Wide — Big Swings

Cross-cutting infrastructure ideas, not new standalone tools — they'd touch the landing page or several existing
tools at once rather than adding one new `.html` entry point. Same rule as the Blank Map Generator section above:
no `index.html` "coming soon" row for these, since there's no single new tool page to point one at. Ambitious, and
all still within GitHub Pages' static-hosting limits (no server, no accounts, no database) — several lean on
browser APIs the toolkit doesn't use yet.

| Idea | What it would do |
|---|---|
| Bulk CSV Roster Import Hub | Upload a full set of class rosters once and have every roster-consuming tool on the site pick them up, instead of pasting the same list into each tool separately. |
| Custom Theme / Branding Pass | Let a school set an accent color and logo once (saved locally) and have it carry across every tool for a school-specific reskin. |
| Voice Command / Speech-to-Text Input | Wire the browser's Web Speech API into compatible tools (calling a name, logging a behavior point) for hands-free operation. |
| Printable "Cheat Sheet" Bundle Export | Combine chosen printable outputs from several tools (seating chart, sub plan, hall pass log) into one exported packet, generalizing the Sub Binder's approach to any tool combination. |

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
