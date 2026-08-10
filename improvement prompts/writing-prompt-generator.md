# Improvement Prompts — Writing Prompt Generator

**Tool file:** `Tools/writing-prompt-generator.html`
**Support folder:** `Tools/writing-prompt-generator/` — `wpg-prompts.js`, `wpg-store.js`

**Current description (from README):** 200 prompts (100 middle school, 100 high school) across five genres, with a big projector-friendly display and a session history.

---

## Status

Reviewed — structural read of the source, followed by a Round 4 implementation
pass (see the Round 4 update below) that shipped Prompt Sets, rubric pairing,
and the Anonymous Response Display. Ideas below that remain unmarked are
deliberately ambitious and are **not** scoped to a single session.

## What it does today

- 200 shipped prompts across five genres and two grade bands
  (`wpg-prompts.js`), with band tabs and genre filtering
- Big projector display with **fullscreen** (`toggleFullscreen`) — one of the
  few tools that has it
- **Print poster** of a single prompt
- **My Prompts** — teacher-authored prompts with their own genre
  (`gvb-writing-prompts:custom`)
- **Roster assignment sheet** (`buildRosterSheet`, `pickDistinctForRoster`,
  `renderRosterPrintArea`) — assign a different prompt to each student from a
  loaded `np_rosters` roster and print the sheet. This is the tool's most
  distinctive feature and the README doesn't mention it.
- Prompt history with no-repeat logic (`recentTexts`, `uniqueByText`)
- **Prompt Sets** — Random Draw / Planned Sequence modes, a set advanced by
  date with a manual Prev/Next/Jump override (`wpg-store.js`: `loadSets`/
  `saveSets`)
- **Rubric pairing** with Rubric Builder — a read-only bridge
  (`wpg-rubric-link.js`) to attach an existing rubric to a prompt or Prompt
  Set item and open it in Rubric Builder
- **Anonymous Response Display** — up to six pasted student responses shown
  full-screen, one-at-a-time or side-by-side, never persisted to storage
- Loads `_shared/a11y.js`

## Quick Wins

- **A writing timer alongside the prompt** (P7 — the timer exists). Timed
  writing is the standard use of a prompt display.
- **Word-count goal** displayed with the prompt.
- **Print the prompt as a half-sheet with lines** to write on, not just as a
  poster — the handout version of the same thing.
- **Sentence starters and a "if you're stuck" line** with each prompt, which
  is what the students who need the prompt most actually need.
- **Tag prompts by purpose** (quick write, journal, on-demand assessment,
  creative) as well as genre.
- **Import a prompt list** from a paste (P13) instead of one at a time.
- **Done — subsumed.** **Prompt of the day, by date** — a stable sequence
  rather than a shuffle, so a class that writes daily doesn't get randomness
  where it wants routine. *(Built as the Planned Sequence mode of Prompt Sets
  below, rather than as its own feature — see the Round 4 update.)*

## Major Features

- **Done —** **Prompt sets as units.** A two-week narrative sequence, or a set of
  argumentative prompts escalating in complexity, planned in advance and
  advanced by date — rather than a random draw each morning. *(Random Draw /
  Planned Sequence modes, see the Round 4 update.)*
- **Done —** **Rubric pairing** (P7). A prompt without criteria is half an assignment;
  linking a prompt to a rubric from `rubric-builder.html` and printing them
  together would close the loop. *(A read-only `wpg-rubric-link.js` bridge —
  see the Round 4 update.)*
- **Done —** **Anonymous sharing on the projector.** A large, well-typeset display the
  teacher types or pastes two or three student responses into — without
  names — for a whole-class revision discussion. The highest-value five
  minutes in a writing classroom, and currently done by squinting at a
  document camera. *(Anonymous Response Display, see the Round 4 update.)*
- **Convergence with the other prompt-bank tools** (P7).
  `exit-ticket-generator.html` and `number-talks-board.html` have the same
  bank/display/handout architecture. Three implementations exist.
- **A much bigger, better-organized bank**, including prompts tied to
  historical documents and images (P7 — `primary-source-analysis-generator.html`
  and `blank-map-generator.html` both hold sources worth writing about).
- **Student writing portfolio.** Which prompts a student has responded to over
  the year, with the teacher's notes — the artifact for a conference.

## Moonshot / North Star

**The writing routine, planned and run.** A sequence of prompts planned across
a unit with rubrics attached, displayed full-screen with a timer and sentence
starters for whoever needs them, printed as lined half-sheets to write on, two
anonymous examples projected for a revision discussion, and a printed record
at the end of the quarter of which prompts each student wrote to and what the
teacher noted about each.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Response collection from student devices** over a local peer connection.
  The anonymous projection above gets the discussion benefit without it.
- **Student writing portfolio** maintained by students. A teacher-maintained
  record of prompts and notes stays in scope; students maintaining it does not.

## Platform themes that matter here

- **P7 (cross-tool)** — one of three prompt-bank tools; wants the timer and
  the source tools still. **Rubric pairing addressed 2026-08-10** via the
  read-only `wpg-rubric-link.js` bridge.
- **P2 (shared roster)** — already reads `np_rosters` for the assignment
  sheet, which is the pattern other tools should copy.
- **P9 (device pairing)** — teacher-side only: a phone remote for the
  projected prompt display.
- **P1 (projector mode)** — has fullscreen; still needs dark mode.

## Open Questions

- Should the three prompt-bank tools share a bank format and a display engine
  even if they keep separate front doors? The duplication is substantial.
- ~~Is collecting student writing in scope?~~ **Answered: no**, here and in
  the exit ticket tool alike. Students aren't intended users of this site.

## Round 4 update — 2026-08-10

Implemented three of the Major Features in one pass, plus the small
"Prompt of the day, by date" quick win that the first one subsumes.

**1. Prompt sets as units.** New "Prompt Sets" panel and a `Random Draw` /
`Planned Sequence` mode-tab pair above the stage. A set is
`{id, name, startDate, cursor, items:[{id, band, genre, text, rubricName}]}`,
persisted at `gvb-writing-prompts:sets` (`wpg-store.js`: `loadSets`/
`saveSets`); the set being viewed/edited is remembered at
`gvb-writing-prompts:activeSet`. Items are added either as a random pull from
the current band/genre filters (dedup'd against what's already in the set) or
typed by hand, and can be reordered and removed. Giving a set a start date
computes a suggested day-index by counting school days (Mon–Fri) since that
date, offered as a one-click "Jump to today" rather than auto-advancing — a
teacher who was out sick shouldn't have the sequence silently skip a day out
from under them. Prev/Next move the cursor by hand regardless. Deliberately
**does not** write into the existing "Prompt history" list — that log stays
scoped to the random-draw generator's own no-repeat logic, and a set's own
item list is its own record, so the two features don't tangle.

**2. Rubric pairing with Rubric Builder.** New
`writing-prompt-generator/wpg-rubric-link.js` — a small, explicitly
**read-only** bridge that reads Rubric Builder's own storage contract
(`gvb-rubric-builder:list`, `gvb-rubric-builder:data:<name>`) to list and
summarize already-built rubrics, and writes only the `:current` pointer
Rubric Builder already reads on boot to pick a rubric before opening it in a
new tab. A "Rubric" row under the stage (present in both modes) lets a
teacher attach one of their existing rubrics to whatever prompt is showing;
for a Prompt Set item the pairing is persisted on the item itself, and each
set item row also gets its own compact rubric picker. The print poster grows
a one-line "Rubric: <name>" credit when a rubric is attached. Deliberately
**did not** duplicate Rubric Builder's full criteria/level table into the
poster print, and did not add a "generate a starter rubric from here" flow —
both would mean this tool carrying a second, silently-driftable copy of
Rubric Builder's state shape. `_shared/state-link.js` already exists for
exactly that kind of handoff (`rubric-builder.html?rubric=<encoded>`) if a
future round wants to build one; picking an *existing* named rubric by
reading the list, the way this round does it, needs no knowledge of that
shape at all and can't go stale.

**3. Anonymous Response Display.** New "Anonymous Response Display" section:
add up to six response textareas (no name field exists at all — anonymity
isn't a display option, there's nothing identifying to strip), then
"Project" opens a full-screen overlay reusing the same fullscreen affordance
as the prompt stage. Two view modes: "One at a time" (large centered text,
Prev/Next, arrow-key navigation) for walking a class through responses one
by one, and "Side by side" (a card grid) for a quick compare. The view-mode
toggle is duplicated into the overlay's own bar — the overlay is
`position: fixed; inset: 0`, so the page's copy of that control is covered
and unclickable while projecting, which an early Playwright pass caught.
Responses are **intentionally not persisted** to localStorage; they exist in
memory for the current page session only, so nothing a student wrote lingers
in browser storage after class. "Clear all" wipes them without a confirm
dialog, matching their transient/low-stakes nature.

**Not done, left for a future round:**
- Sentence starters / "if you're stuck" lines (Quick Win) — would need
  genuinely per-prompt authored content across all 200 bank prompts to be
  worth shipping, not generic filler; too large for this round.
- The bigger, source-tied prompt bank and the student portfolio (Major
  Features) — untouched, per the round's 2–4-idea scope.
- Convergence with `exit-ticket-generator.html` / `number-talks-board.html`
  — not attempted this round (both were being worked on in parallel by
  someone else). Worth flagging concretely now that this round exists: the
  "prompt sets as a sequenced unit, advanced by date with a manual
  Prev/Next override" pattern built here is generic enough that all three
  bank tools could plausibly share it verbatim, and the read-only
  cross-tool bridge pattern in `wpg-rubric-link.js` (read the other tool's
  own storage contract, write only its "open this one" pointer) is probably
  the right template for any future bank tool that wants to hand off to a
  companion tool without coupling to its internals.
- Dark mode / P1 projector polish — not addressed; the new overlay and
  seq-nav UI reuse the existing CSS variables so they inherit whatever
  theming the tool has today (i.e., none beyond `_shared/a11y.js`'s filter
  fallback), but nothing new was done here.

**Testing:** `node --check` on `wpg-store.js`, `wpg-rubric-link.js`,
`wpg-prompts.js`, and both inline `<script>` blocks extracted from the HTML.
A throwaway Playwright script (Chromium, `file://`) exercised: generating a
random prompt; switching to Planned Sequence with no sets; creating a set,
adding random and manual items, reordering guards (first item's "up" button
disabled); Prev/Next/Jump navigation and its persistence across a reload;
attaching a rubric (seeded a fake Rubric Builder entry in localStorage) and
confirming the summary line, the poster's rubric credit, and the set item's
persisted `rubricName`; the "Open in Rubric Builder" handoff end-to-end,
including that the opened tab read back the `:current` pointer this tool
wrote and loaded with zero console errors; deleting a set and confirming the
sequence stage falls back cleanly; and the anonymous response flow including
the one-at-a-time/grid toggle and Next navigation. Zero console errors on
either page throughout. The test script was thrown away after use.
