# Improvement Prompts — 030 — Quiz / Review Game Board

**Tool file:** `Tools/030-review-game-board.html`
**Support folder:** `Tools/review-game-board/` — `rgb-store.js`

**Current description (from README):** A Jeopardy-style review board — type in questions or import them from an Excel sheet (Category/Points/Question/Answer columns), click a cell to reveal it, award points per team.

---

## Status

**2026-08-12 — session `r8kq4t`.** Backlog rank 1 (as it stood): a storage
usage readout, now that clue images are the first thing here that can
realistically fill localStorage.

- **The measurement is the hard half.** No browser API reports a localStorage
  quota, so the ceiling has to be *probed* — write a growing string until it
  throws and report what fit. That is done once and cached, because it is not
  cheap, and it writes to its own key inside a `try/finally` so a throw
  mid-probe cannot leave a megabyte of padding behind in a teacher's browser,
  eating the space it was measuring. The suite checks the probe key is gone.
  Chromium reports ~10 MB per origin, not the 5 MB the older comments in this
  file assume.
- **Two numbers, because the cap is shared.** The line reports the boards' own
  share and the whole origin's. "Your boards are 3 MB" is the actionable half,
  but a teacher who is out of room because of some *other* tool on the site
  would otherwise delete boards that were not the problem.
- **It escalates in tone and in advice, not just in colour.** Past ~70% it
  goes amber and says clue images are the usual cause; past 90% it goes red
  and says the next save with an image in it is likely to fail, and to export
  a board to JSON before deleting it. The failure this replaces arrived
  mid-lesson, on a save the teacher never pressed, as an alert *after* the
  write had already failed.
- Deleting a board calls `forgetCapacity()` — the ceiling was probed against
  a fuller drawer, so the cached figure would understate the room now
  available.
- Two new store exports, `storageReport()` and `forgetCapacity()`. The report
  is `{ boards, total, free, cap, pct }` in bytes, counted in UTF-16 code
  units, which is what browsers actually charge for.
- `smoke-clue-image.mjs` 22 → 36 checks, including both warning thresholds
  driven by genuinely filling the origin.

**Where the next round should pick up:** the reusable tagged question bank on
the ranked backlog is the big one for this tool, and it changes the storage
picture again — a bank shared across boards would stop the same image being
stored once per board, which is the actual fix rather than a warning.

**2026-08-11 — images inside a clue (backlog rank 1).** The oldest open Quick
Win on this list, and the one that changes what the tool can ask: for a social
studies or science review the picture often *is* the question — which region
does this map show, what is happening in this cartoon, name this apparatus.

- **+ Image on any clue row** in the manual editor: a thumbnail you click to
  replace, an × to drop it, and the resulting size in KB shown in place so the
  storage cost is never invisible.
- **Downscaled hard on import** (`readAndDownscaleImage`) — long edge capped at
  1000px, re-encoded as JPEG at 0.72, transparent PNGs matted onto white rather
  than black since these land on printed paper as often as a dark board. A
  2400×1600 photo lands around a twentieth of its original size. 1000px is
  ample for a projector and for a 3.2in printed quiz image, and the whole
  origin only gets ~5 MB of localStorage (P12).
- **Kept inline on the clue** (`clue.image`), so it travels with the board
  through save, JSON export, and JSON import exactly like the question text —
  nothing to lose track of, nothing to upload. `normalizeBoard` only accepts a
  real `data:image/` URL, so nothing else gets put into an `<img src>`.
- **Projected with the clue**, capped at 42vh so a tall source cannot push the
  question text off the bottom of the screen — and **hidden behind the Daily
  Double wager panel**, because a picture shown early is the clue given away
  before anyone has bet on it.
- **Printed** on the practice quiz (3.2in wide, where it has to be there for
  the question to be answerable on paper) and as a small thumbnail on the
  answer key.
- **`save()` now reports a full-storage failure** instead of throwing silently.
  Inline images are the first thing in this tool that can realistically fill
  localStorage, and a silent write failure would lose a game mid-lesson. The
  message names images as the likely cause and suggests exporting first.

New suite `Tools/review-game-board/test/smoke-clue-image.mjs` (21 checks) as
`npm run test:review-board`: it builds a real 2400×1600 noise PNG in the page,
feeds it through the actual file input, and asserts the re-encode, the exact
capped dimensions, the preserved aspect ratio, the saved board, the projected
overlay, the text-only clue showing no stale image, the Daily Double hide/reveal
(pinned deterministically rather than left to the random assignment), both print
paths, and a JSON round trip that drops a hostile non-image string.

**2026-08-10 — Round 5 (PR #56): four Quick Wins shipped, one of which
replaced an existing mechanic rather than adding to it.**

- **Done — Undo the last score change (P11).** A generic undo stack (not
  scoped to just one clue) records every score change — the scoreboard's
  manual +/−10 buttons and every clue award — with enough context (team
  index, delta, and the clue it came from if any) to reverse it: the score
  moves back and, if the change came from awarding a clue, that clue goes
  back to unused so it can be replayed. The stack clears on board switch,
  new board, reset game, or team removal (an index-shift that would make old
  entries wrong) rather than trying to survive across those.
- **Done — Wager mechanics for the Daily Double.** This **replaced** the old
  fixed "always doubles the points" behavior rather than sitting alongside
  it: opening a Daily Double clue now shows a small wager panel (pick which
  team found it, type a wager) before the question itself appears, and the
  award row becomes a single Correct/Incorrect pair for just that team and
  wager amount — a real strategic decision instead of an automatic ×2. A
  final-question wager round (also mentioned in this Quick Win) was **not**
  built — it's a genuinely separate game phase (single question, every team
  wagers simultaneously) and didn't fit this round's scope next to the
  Daily Double rework.
- **Done — Keyboard control (P10).** While a clue is open: <kbd>Space</kbd>
  reveals the answer (or confirms a Daily Double wager panel first, if one's
  showing), digits <kbd>1</kbd>-<kbd>9</kbd> click the Nth award-row button
  (works for both the normal per-team row and the Daily Double
  Correct/Incorrect pair), <kbd>Esc</kbd> closes via whichever close action
  is currently valid. A hint line next to the scoreboard documents the keys
  in place, rather than a hidden shortcut nobody discovers.
- **Done — Print the whole board as a paper quiz (Major Feature, taken
  early).** A new "Print practice quiz" button next to the existing "Print
  answer key" produces a blank, numbered, one-per-question sheet
  (category + point value + question, with two blank lines) grouped in
  board order — for an absent student or a study guide once the game's done.

Verified with a headless Chromium smoke test covering both award paths: a
Daily Double open → wager entered → keyboard-space reveal → keyboard-1
"Correct" award → undo-button reverts the exact score and re-opens the clue;
and a normal clue → keyboard reveal → keyboard award → Esc-close on a
different clue confirmed it left the cell unused. No console errors.

**Where a future round should pick up:** the single highest-leverage idea in
this tool's Moonshot — **one question bank, played six ways** (bracket,
whiteboard every-team-answers, teacher-tapped buzz order, and feeding
questions to the escape room / scavenger hunt tools) — is entirely
untouched. So is "load a roster to build teams" (P2), images/audio in a
clue, and difficulty-aware/pass-along-on-wrong-answer scoring. The final
wager round from this round's Quick Win is also still open — see above.

## What it does today

- Board of categories × point values; click a cell to open the clue, reveal
  the answer, award points to a team, or **mark used without awarding**
- **An optional picture on any clue** (`buildClueImageCell`,
  `readAndDownscaleImage`) — downscaled to 1000px JPEG, stored inline on the
  clue, projected with the question, printed on the quiz and answer key
- **Excel import** (SheetJS) with a **downloadable blank template** —
  the best import onboarding on the site
- JSON import/export; multiple saved boards (`gvb-review-board:list` /
  `:data:*`)
- **Daily Double** assignment with a redraw (`assignDailyDouble`)
- **Lightning timer** per clue (`startLightningTimer`)
- Scoreboard; reset game; print **answer key**

## Quick Wins

- **Done — Pass 2, Round 2.** **Team names and a bigger scoreboard.** The scoreboard is the thing thirty
  students stare at; it should be large, persistent, and animated when it
  changes.
- **Done —** **Undo the last score change** (P11) — a mis-tap in front of a competitive
  class is a genuine classroom management problem.
- **Done — Daily Double wager shipped; final-question wager round not built.**
  **Wager mechanics for the Daily Double**, and a final-question wager round.
  The wager is where the format's strategy lives and it's currently absent.
  *(Daily Double now prompts for team + wager before showing the question,
  replacing the old fixed ×2. A separate final-round wager phase is a bigger,
  distinct feature — see Status.)*
- **Done (images) — 2026-08-11.** **Images and audio in a clue.** A map, a
  diagram, a primary source, a pronunciation — a text-only clue limits the tool
  to recall questions. *(Images shipped: downscaled, stored inline, projected,
  printed. **Audio was not built** — a recorded pronunciation is a different
  capture path (MediaRecorder), a different storage profile, and a different
  playback control; it deserves its own round.)*
- **Done —** **Keyboard control** (P10) — number keys to award, space to reveal, Esc to
  close. Running a game by mouse from a laptop is slow.
- **Done — Pass 2, Round 2.** **Load a roster to build teams** (P2) rather than typing team names.
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
- **Every-team-answers mode.** Instead of first-hand-up, every team writes an
  answer on a whiteboard and the teacher taps which teams got it — awarding
  points to all of them at once. Keeps the quiet teams playing, and it's a
  scoring-UI change rather than a device problem.
- **Teacher-side buzz order.** A simple on-screen row of team buttons the
  teacher taps in the order hands went up, so ties and disputes have an
  answer without any student hardware.
- **Difficulty-aware point values**, and a mode where a wrong answer passes
  the question to the next team.
- **Done —** **Print the whole board as a paper quiz** with an answer key, for absent
  students or as a study guide. *(Taken early this round — see Status. Uses
  the existing "Print answer key" for the key half; the new "Print practice
  quiz" is the blank half.)*

## Moonshot / North Star

**One question bank, every review format.** Build or import the questions
once — tagged by unit and standard — and then play them as a game board, a
bracket, or a whiteboard every-team-answers round; or print them as a practice
quiz, a study guide, flashcards, or the station content for a scavenger hunt
or escape room. One authoring effort, six outputs, all driven from the front
of the room.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Buzzer mode.** Student devices connecting over `webrtc-pair.js` to buzz
  in, with order and timing on the projector. Genuinely novel for a no-server
  site, and out of scope. The teacher-side buzz-order row above solves the
  dispute problem without student hardware.
- **Per-student answer submission** from devices.

## Platform themes that matter here

- **P7 (cross-tool)** — the question bank is the site's most reusable missing
  asset; four other tools need questions and none can get them from here.
- **P9 (device pairing)** — teacher-side only: running the board from a phone
  or mirroring it to a second display.
- **P13 (import surfaces)** — already the best on the site; its
  template-download pattern should be copied everywhere.
- **P1 (projector mode)** and **P10 (keyboard-first)** — it's a live
  performance tool run from the front of a room.

## Open Questions

- Should the question bank become its own tool (or a shared store) that this
  board, the escape room, the scavenger hunt, and the flashcard generator all
  read? That's the architectural version of the moonshot above.
- ~~Is buzzer mode worth building?~~ **Answered: out of scope** — it requires
  student devices. The open question that replaces it: is a teacher-tapped
  buzz-order row enough to settle "who was first" disputes in practice?

## Pass 2 — Round 2 update — 2026-08-11 (session `mxpfjs`)

Two still-open Quick Wins from the list above shipped this round.

- **Team names and a bigger scoreboard.** The scoreboard bar is now
  `position: sticky; top: 0`, so it stays visible at the top of the viewport
  while scrolling a tall board instead of scrolling away with it. Team name
  and score type are both noticeably larger (the score uses a `clamp()` so it
  scales further on a wider display), and every score change — the
  scoreboard's own +/− buttons, a normal clue award, a Daily Double
  Correct/Incorrect, and an undo — briefly flashes that team's chip green
  (increase) or red (decrease) via a CSS keyframe animation, so a change
  reads from across a room even when the number itself is small.
- **Load a roster to build teams (P2).** The board-setup screen now has a
  "Build teams from a saved roster" control (a dropdown of `np_rosters`
  entries, read-only, same pattern as the exit-ticket and writing-prompt
  tools' roster pickers, plus a team-count field and a "Split into teams"
  button). It does a simple count-based contiguous split — no
  fairness/recency logic, that's a different tool's job — capping the team
  count at the roster size so a small class can't produce empty teams. Each
  resulting team's name lists its actual students (e.g. "Team 2: Dave, Eve,
  Frank") and is fully editable afterward on the scoreboard exactly like a
  typed-in team name. Works from both the manual "Type it in" tab and the
  Excel import tab, since teams are independent of where the questions come
  from.

**Testing performed:** `node --check` on `rgb-store.js` and the extracted
inline `<script>` block — both clean. A headless Chromium smoke test
(`/opt/pw-browsers/chromium`) seeded a fake `np_rosters` entry (8 names),
split it into 3 teams before saving a manual 2-category board, and confirmed
all 3 teams were created with all 8 names distributed across them and none
duplicated or dropped. It then confirmed the scoreboard's computed
`position` is `sticky` and its score font-size is scaled up from the
pre-round baseline, opened a clue, awarded it, and confirmed the awarded
team's chip briefly carried a `flash-up` class (removed again after the
900ms animation) while its score updated correctly. Zero console/page
errors throughout.

**What remains open:** the moonshot — **one question bank, played six
ways** — is still explicitly deferred as too big for one round. Also still
open: images/audio in a clue, difficulty-aware/pass-along-on-wrong scoring,
a real separate question bank, every-team-answers mode, teacher-side buzz
order, and the final-question wager round noted as open back in Round 5
(the Daily Double wager itself is done; the separate final-round wager
phase — single question, every team wagers simultaneously — was not built).
Projector styling (P1, fullscreen + shared theme) is also still untouched.

### Where the next round should pick up (after the clue-image round)

- **Audio in a clue** is the untouched half of that Quick Win — a recorded
  pronunciation or a music excerpt. It needs MediaRecorder capture, a much
  worse storage profile than a downscaled JPEG, and a playback control on the
  overlay. Worth its own round, and worth deciding first whether audio should
  live in IndexedDB (the `bmg-map-cache.js` pattern) instead of localStorage.
- If a future round moves images to IndexedDB, note that JSON export currently
  gets image portability for free by keeping them inline; that would have to be
  solved deliberately rather than lost.
- Everything under Major Features (one bank played six ways, a real tagged
  question bank, every-team-answers, teacher-side buzz order, difficulty-aware
  scoring) is still untouched.
