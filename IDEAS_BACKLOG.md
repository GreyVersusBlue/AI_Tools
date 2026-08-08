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

## Blank Map Generator — Enhancement Ideas

Already built and continuously extended (`Tools/blank-map-generator.html`). No open ideas on the list right now —
every enhancement collected so far has shipped. Add new ones here as they come up; since this is an improvement to
an existing tool rather than a new standalone one, graduating an idea just means shipping it and deleting its row,
with no `index.html` "coming soon" row involved.

## Platform-Wide — Big Swings

Cross-cutting infrastructure ideas, not new standalone tools — they'd touch the landing page or several existing
tools at once rather than adding one new `.html` entry point. Same rule as the Blank Map Generator section above:
no `index.html` "coming soon" row for these, since there's no single new tool page to point one at. Ambitious, and
all still within GitHub Pages' static-hosting limits (no server, no accounts, no database) — several lean on
browser APIs the toolkit doesn't use yet.

| Idea | What it would do |
|---|---|
| Cross-Tool Shareable State Links | Encode a tool's current board (a seating chart, a bracket, a rubric) into the page URL itself, so pasting a link opens that exact state on another screen — no server, no login, just a longer link. |
| Live Student-View Sync | Peer-to-peer (WebRTC, no server) mirroring of Review Game Board scores, Bracket picks, or the Classroom Timer onto students' own devices, not just the projector. |

## Picking one up

When an idea gets built for real:

1. Build it the normal way — one `.html` entry point in `Tools/`, matching subfolder for supporting assets if needed.
2. Remove its row from this file, and from `ideas-backlog.html`.
3. In `index.html`, delete its `.row.soon` placeholder and add a normal `<a class="row ink">` tool row in its place
   (see DEV NOTES item 6 in `index.html` for the exact steps and bookkeeping — record counts, memo/rev dates,
   changelog entry).
4. Add it to the `README.md` tools table.
