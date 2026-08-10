# Improvement Prompts — Quiz / Review Game Board

**Tool file:** `Tools/review-game-board.html`
**Support folder:** `Tools/review-game-board/` — `rgb-store.js`

**Current description (from README):** A Jeopardy-style review board — type in questions or import them from an Excel sheet (Category/Points/Question/Answer columns), click a cell to reveal it, award points per team.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Board of categories × point values; click a cell to open the clue, reveal
  the answer, award points to a team, or **mark used without awarding**
- **Excel import** (SheetJS) with a **downloadable blank template** —
  the best import onboarding on the site
- JSON import/export; multiple saved boards (`gvb-review-board:list` /
  `:data:*`)
- **Daily Double** assignment with a redraw (`assignDailyDouble`)
- **Lightning timer** per clue (`startLightningTimer`)
- Scoreboard; reset game; print **answer key**

## Quick Wins

- **Team names and a bigger scoreboard.** The scoreboard is the thing thirty
  students stare at; it should be large, persistent, and animated when it
  changes.
- **Undo the last score change** (P11) — a mis-tap in front of a competitive
  class is a genuine classroom management problem.
- **Wager mechanics for the Daily Double**, and a final-question wager round.
  The wager is where the format's strategy lives and it's currently absent.
- **Images and audio in a clue.** A map, a diagram, a primary source, a
  pronunciation — a text-only clue limits the tool to recall questions.
- **Keyboard control** (P10) — number keys to award, space to reveal, Esc to
  close. Running a game by mouse from a laptop is slow.
- **Load a roster to build teams** (P2) rather than typing team names.
- **Projector styling** (P1). This is a projector-first tool with neither
  fullscreen nor the shared theme.

## Major Features

- **Multiple game formats over one question bank.** The bank is the valuable
  asset; the board is one way to play it. The same questions could drive:
  a bracket-style head-to-head (P7 — the bracket engine exists), a team
  quiz-bowl with buzzers, a "spin the wheel" random question, a scavenger hunt
  or escape room (both of those tools need questions and have none), and a
  printed practice quiz with an answer key. Building the bank once and playing
  it six ways is the single highest-leverage change available here.
- **A real question bank, separate from a board.** Tagged by unit, standard,
  and difficulty; searchable; reusable across boards and across years. Right
  now questions live inside a board and can't be recombined.
- **Buzzer mode** (P9). Student devices connect via `webrtc-pair.js` and
  buzz in, with order and timing shown on the projector. This is the missing
  piece that makes a review game feel like a game, and this site can do it
  with no server, which almost no competitor can.
- **Answer capture from every team**, not just the fastest — so the quiet
  teams also answer every question rather than watching.
- **Difficulty-aware point values**, and a mode where a wrong answer passes
  the question to the next team.
- **Print the whole board as a paper quiz** with an answer key, for absent
  students or as a study guide.

## Moonshot / North Star

**One question bank, every review format.** Build or import the questions
once — tagged by unit and standard — and then play them as a game board, a
bracket, a buzzer quiz-bowl, a scavenger hunt, or an escape room; or print
them as a practice quiz, a study guide, or flashcards. With student devices
buzzing in over a local peer connection, no accounts, and no wifi required
beyond the room.

## Platform themes that matter here

- **P7 (cross-tool)** — the question bank is the site's most reusable missing
  asset; four other tools need questions and none can get them from here.
- **P9 (device pairing)** — buzzers are the standout unbuilt feature.
- **P13 (import surfaces)** — already the best on the site; its
  template-download pattern should be copied everywhere.
- **P1 (projector mode)** and **P10 (keyboard-first)** — it's a live
  performance tool run from the front of a room.

## Open Questions

- Should the question bank become its own tool (or a shared store) that this
  board, the escape room, the scavenger hunt, and the flashcard generator all
  read? That's the architectural version of the moonshot above.
- Is buzzer mode worth the complexity given classroom device reality, or is
  "one device per team" the realistic target?
