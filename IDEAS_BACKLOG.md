# Ideas Backlog

Everything that's been suggested for the toolkit but hasn't been built yet. This file is the source of truth for
the list — the "coming soon" rows on `index.html` and the public [`ideas-backlog.html`](ideas-backlog.html) page
should both be kept in sync with whatever's here.

Reminder: coming soon means not right now.

## General / Classroom Logistics

| Idea | What it would do |
|---|---|
| Exit Ticket / Bell Ringer Generator | Printable half-sheets or a rotating bank of daily warm-up prompts. |
| Field Trip Permission Slip Generator | Fill in the trip details once, get a printable permission slip. |
| Digital Hall Pass / Sign-Out Log | Track and print who's out of the room and when. |
| Class Roster Hub | Build and save a class roster once — Name Picker, Seating Chart, Group/Team Generator, Lab Group & Role Randomizer, Gallery Walk QR, and the SSR Log Tracker all pull from it instead of every tool needing the roster re-pasted into it separately. |
| Sub Binder / Day Bundle Generator | Pulls today's Sub Plan, the current Seating Chart, and a Schedule Browser snapshot into one printable packet, so a substitute gets everything in one stack instead of three separate tools. |
| Command Center (Daily Dashboard) | One glanceable projector page — the Classroom Timer, today's A/B schedule block, and the current class roster side by side, for running the whole period from the front of the room. |
| Digital Escape Room / Puzzle Lock Builder | Chain QR-code and typed-answer puzzle stations into a linear or branching escape-room activity, each correct answer unlocking the next clue — built on the same QR engine as the Scavenger Hunt Builder. |

## Math

| Idea | What it would do |
|---|---|
| Number Talks / Mental Math Routine Board | A daily mental-math prompt with a strategy-sharing board — reveal a number string, then stamp students' strategies up on the projector as they share out. |

## English / Language Arts

| Idea | What it would do |
|---|---|
| Novel Study / Reading Circles Manager | Track reading groups, rotate discussion roles (Discussion Director, Summarizer, Word Wizard...), and pace chapter checkpoints for a whole-class novel study — the group cousin of the SSR Log Tracker. |

## Science

| Idea | What it would do |
|---|---|
| Lab Safety Contract Tracker | Track signed lab safety contracts per student. |

## Social Studies

| Idea | What it would do |
|---|---|
| Primary Source Analysis Worksheet Generator | Paste in or describe a primary source (photo, speech excerpt, political cartoon) and get a structured OPTIC/SOAPSTone-style analysis worksheet built around it, plus a matching answer-key version. |

## World Language

| Idea | What it would do |
|---|---|
| Immersion Roleplay Scenario Generator | Random real-life dialogue scenarios (ordering food, asking directions, checking into a hotel) with vocabulary scaffolding cards, printable or projected for partner speaking practice — pairs with the Vocab & Conjugation Drill Generator. |

## Arts & PE

| Idea | What it would do |
|---|---|
| Tournament Bracket & Station Rotation | Brackets plus timed station rotation for PE units, paired with the Classroom Timer. |

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
| Full Offline Install (PWA) | A manifest + service worker so the whole toolkit installs like an app and works with zero connectivity, including previously-downloaded Blank Map Generator tiles. |
| Sitewide Accessibility Pass | Adjustable text size, a high-contrast/dark theme, a dyslexia-friendly font toggle, and text-to-speech read-aloud wired into the tools that display blocks of text (Writing Prompt Generator, Vocab & Conjugation Drill, SSR Log Tracker). |
| Landing Page Command Palette | A Ctrl/Cmd+K quick-jump search over every tool (and idea) from anywhere on the site, keyboard only. |
| Live Student-View Sync | Peer-to-peer (WebRTC, no server) mirroring of Review Game Board scores, Bracket picks, or the Classroom Timer onto students' own devices, not just the projector. |

## Picking one up

When an idea gets built for real:

1. Build it the normal way — one `.html` entry point in `Tools/`, matching subfolder for supporting assets if needed.
2. Remove its row from this file, and from `ideas-backlog.html`.
3. In `index.html`, delete its `.row.soon` placeholder and add a normal `<a class="row ink">` tool row in its place
   (see DEV NOTES item 6 in `index.html` for the exact steps and bookkeeping — record counts, memo/rev dates,
   changelog entry).
4. Add it to the `README.md` tools table.
