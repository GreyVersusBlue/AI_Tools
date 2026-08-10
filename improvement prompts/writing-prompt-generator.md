# Improvement Prompts — Writing Prompt Generator

**Tool file:** `Tools/writing-prompt-generator.html`
**Support folder:** `Tools/writing-prompt-generator/` — `wpg-prompts.js`, `wpg-store.js`

**Current description (from README):** 200 prompts (100 middle school, 100 high school) across five genres, with a big projector-friendly display and a session history.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

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
- **Prompt of the day, by date** — a stable sequence rather than a shuffle, so
  a class that writes daily doesn't get randomness where it wants routine.

## Major Features

- **Prompt sets as units.** A two-week narrative sequence, or a set of
  argumentative prompts escalating in complexity, planned in advance and
  advanced by date — rather than a random draw each morning.
- **Rubric pairing** (P7). A prompt without criteria is half an assignment;
  linking a prompt to a rubric from `rubric-builder.html` and printing them
  together would close the loop.
- **Anonymous sharing on the projector.** A large, well-typeset display the
  teacher types or pastes two or three student responses into — without
  names — for a whole-class revision discussion. The highest-value five
  minutes in a writing classroom, and currently done by squinting at a
  document camera.
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

- **P7 (cross-tool)** — one of three prompt-bank tools; wants the timer, the
  rubric engine, and the source tools.
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
