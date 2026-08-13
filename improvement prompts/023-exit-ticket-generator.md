# Improvement Prompts — 023 — Exit Ticket / Bell Ringer Generator

**Tool file:** `Tools/023-exit-ticket-generator.html`
**Support folder:** `Tools/exit-ticket-generator/` — `lib/qrcode.js`

**Current description (from README):** A bank of short warm-up and reflection prompts with a big projector display, plus a printable handout mode for half- or quarter-sheet exit tickets.

---

## Status

**2026-08-13.** **Bell-ringer sequences**, shipped as **Prompt Sets** — the
oldest still-open Major Feature in this file. The Prompt & Display tab now
has a Shuffle / Planned Sequence mode toggle; Planned Sequence shows a
teacher-built day-by-day list (a new "Prompt Sets" card: add/reorder/remove
items, random-from-current-filters or manual entry, a name and an optional
start date) instead of a random draw.

- Mirrors Writing Prompt Generator's Prompt Sets (`025-writing-prompt-generator.html`)
  cadence, per the P7 convergence note above: school-day-counted advancement
  from the set's start date (Mon-Fri only, start date = Day 1), a "Jump to
  today" button that appears only when the cursor isn't already there and
  hides once it is, and manual Prev/Next that clamps at either end instead of
  walking off the list.
- The date/cursor math is a pure module, `Tools/exit-ticket-generator/etg-sequence.js`
  (`schoolDaysSince`, `clampIndex`, `nextCursor`, `suggestedIndex`), shared
  between the tool and its tests rather than duplicated — same "pull the logic
  out so it can be unit-tested without a browser" shape as
  `Tools/math-drill-generator`'s drill-math module.
- Sets are their own record — `gvb-exit-ticket:sets` / `gvb-exit-ticket:activeSet`
  — separate from Quick Tally, Tally by Category, Paper Triage, and the
  Discussion Board; stepping through a planned sequence never touches the
  shuffle history log, and switching back to Shuffle restores whatever it was
  last showing rather than drawing a new prompt. The Printable Handout tab
  picks up whatever the active mode (shuffle or sequence) is currently
  displaying, same as before this round.
- Two new suites: `Tools/exit-ticket-generator/test/sequence-logic.test.mjs`
  (23 checks, pure date/cursor math, no browser) and
  `Tools/exit-ticket-generator/test/smoke-prompt-sets.mjs` (46 checks,
  Playwright — mode switching, set CRUD, Prev/Next/Jump-to-today, reload
  persistence, and that the shuffle history/handout tab are unaffected).
  `smoke-response-area.mjs` (36 checks) still passes unchanged.
- Still open from the P7 note: Number Talks Board and Writing Prompt
  Generator remain separate implementations of "bank + display + handout";
  this round ports one cadence pattern between them but doesn't converge the
  three tools onto a shared engine.

**2026-08-12 — session `r8kq4t`.** A fourth response style: a **quarter-inch
grid**, for the maths and science prompts that want a graph or a scale drawing
rather than sentences.

- Drawn with two `repeating-linear-gradient`s rather than an image, so it
  stays inside the one file and costs nothing to load, and ruled in `in` units
  so a square really is a quarter inch on paper. That measurement is the only
  reason to pick this over the blank box that was already there.
- **`print-color-adjust: exact`, which is the whole feature.** Browsers drop
  background images and colours from print by default, on the reasonable
  theory that they are decoration. Here the background *is* the thing being
  printed, so it has to be asked for explicitly — without it the option looks
  right on screen and comes out as an empty box, and nobody finds out until
  the copies are made.
- Two things found by looking at the render rather than the code: the lines
  were originally half a pixel, which anti-aliases to about half of an already
  pale grey and vanishes on screen entirely; and the print rule needed a
  darker grey than the screen one, because a grid that reads nicely on a
  monitor is almost nothing through a school photocopier.
- A note under the picker says **"Print at 100% — not 'fit to page'"**, shown
  only for this style. It is the one response area that makes a promise about
  physical size, and a browser's default shrink-to-fit quietly breaks it.
  (Graph Paper Generator's calibration page exists for the same reason.)
- `smoke-response-area.mjs` gained 9 checks (27 → 36), including that the
  print copy's grid is still a grid and that `print-color-adjust` computes to
  `exact`.

**A pre-existing red assertion in that suite, fixed on the way past.** It was
failing on `main` before this round — not caused by this work, and worth
recording because the diagnosis is the interesting part. The suite measured
the response box against the height of the *whole slip* and asserted an
explanation prompt got "more than half" of it. But the flex weights in
`answerAreaHtml()` divide the space *left under the question*, not the slip:
a two-line prompt plus a name line eats a third of a preview slip before the
writing area starts, so "the whole slip to write in" measured 0.44 and the
assertion failed on any prompt that wrapped. It was measuring the length of
the question, not the size of the answer box. `slipShape()` now also reports
`share` — the box against the box-plus-spacer, which is exactly what the flex
weights control and is resolution-independent — and the three sizing
assertions read off that instead. `frac` is kept for the monotonic
"it really does shrink" check, which was always sound.

Reviewed — structural read of the source, before Round 4 (PR #55, see below)
shipped fullscreen/projector mode, the paper-triage grid, and the anonymous
discussion board. Ideas below are deliberately ambitious and are **not**
scoped to a single session; items confirmed shipped are tagged **Done**
below.

## What it does today

- Two tabs: **Prompt & Display** (projector) and **Printable Handout**
- Built-in prompt bank by category, plus a **custom prompt bank** the teacher
  adds to (`gvb-exit-ticket:customPrompts`)
- Shuffle / next prompt, "new set of prompts", and a session history of what's
  already been shown today
- **Prompt Sets** (Planned Sequence mode): a teacher-planned prompt per day
  for a week or a unit, advanced by school-day count from a start date or by
  hand with Prev/Next/Jump-to-today — see `etg-sequence.js`
- **Think time** timer with a chime (30s / 1min / 2min / off)
- Handout printing at 2-per-page (half sheets) or 4-per-page (quarter sheets),
  with either the same prompt on every slip or **a different prompt on each**
- **A response area sized to the prompt** (`answerAreaHtml`, `autoAnswerSpace`)
  — ruled lines, a blank box for a sketch, a **quarter-inch grid** for a graph
  or scale drawing, or plain space, at a third / half / all of the room under
  the question, chosen explicitly or inferred from the prompt's own wording
- **Quick Tally** counter with reset (`gvb-exit-ticket:tally`)
- QR code support

## Quick Wins

- **Skipped — deferred, Round 4.** **Name and date lines on the slips.** An exit ticket you can't attribute is
  an exit ticket you can't use; this should be on by default with a toggle.
  *(The new Paper Triage tab reads `np_rosters` for its own picker; the
  handout tab itself is untouched.)*
- **Done — 2026-08-11.** **A response box sized for the prompt**, and lined vs
  blank as a choice. *(Two selects on the Printable Handout tab: a response
  style — ruled lines / blank box / plain space — and how much room to leave —
  Match the prompt (automatic) / short / medium / full. See the sized-response
  round below.)*
- **Done — Pass 2, Round 2.** **Print a whole class set** with names pre-printed from `np_rosters` (P2) —
  the same batch pattern Certificate Maker and Permission Slip already have.
  *(Shipped as a "Class Set" toggle on the Printable Handout tab — see the
  Pass 2 — Round 2 update below.)*
- **Skipped — deferred, Round 4.** **Tag prompts by subject and by purpose** (recall, reflection, prediction,
  self-assessment) so the bank is browsable rather than only shuffleable.
- **Skipped — deferred, Round 4.** **Pin / favourite prompts** and a "don't show me this one again" control.
- **Skipped — deferred, Round 4.** **Import a prompt list** from a paste (P13) instead of adding one at a time.
- **Done — Round 4.** **Bigger projector type and fullscreen** (P1) — this is a display tool
  without a proper display mode. *(Shipped as a Fullscreen button on the
  `.stage` element, matching the same pattern already used by
  `025-writing-prompt-generator.html` and `021-pe-tournament-stations.html`.)*

## Major Features

- **Done — Round 4.** **Paper triage that's actually fast.** The teacher reads the paper slips
  and taps each student got-it / almost / reteach on a class grid, then
  prints the reteach list for tomorrow and the small-group split. The
  reading is unavoidable; the sorting, counting, and list-making are what
  currently eat the prep period. *(Shipped as the "Paper Triage" tab — see
  the Round 4 update below for the small-groups pooling decision.)*
- **Done — Round 4.** **A projected discussion board the teacher types into.** Transcribe two or
  three anonymous responses onto the projector for a whole-class
  conversation — the "show me the class's thinking" move — driven entirely
  from the teacher's machine. *(Shipped as the "Discussion Board" tab.)*
- **Done — Pass 2, Round 2.** **Tally by response category**, not just a raw count, so the existing Quick
  Tally can capture "12 got it, 9 partial, 7 confused" and chart it over time.
  *(Shipped as a "Tally by Category" card alongside the existing 1-4 Quick
  Tally — see the Pass 2 — Round 2 update below. "Chart it over time" is
  addressed with a dated history log per the improvement doc's own
  "date-stamped log entry" suggestion, not a chart widget.)*
- **Done — 2026-08-13.** **Bell-ringer sequences.** A prompt per day for a week or a unit, planned in
  advance and advanced automatically by date, rather than shuffled each
  morning. *(Shipped as "Prompt Sets" — see the 2026-08-13 status entry
  below.)*
- **Skipped — deferred, Round 4.** **Standards / objective tagging** so the prompt bank can be filtered by what
  you're actually teaching that day.
- **Skipped — deferred, Round 4.** **Number Talks and Writing Prompt convergence** (P7). This tool, 
  `024-number-talks-board.html`, and `025-writing-prompt-generator.html` are three
  implementations of "bank of prompts + projector display + printable
  handout". They should share the bank format and the display engine even if
  they stay separate front doors. *(Confirmed duplication by inspection —
  see the Round 4 update's cross-tool note — but not touched; `_shared/` was
  out of scope this round.)*

## Moonshot / North Star

**Formative assessment that closes the loop in one class period.** Show the
prompt, run the think time, collect the paper slips, and then triage a class
set in the time it takes students to pack up — tapping got-it / almost /
reteach down a grid, projecting two anonymous responses for a thirty-second
whole-class discussion, and printing tomorrow's small-group list on the way
out. All local, all private, all from the teacher's machine.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Digital response collection.** A QR/link students type a response into on
  their own device, returned to the teacher's browser over `webrtc-pair.js`.
  Technically the most distinctive thing the site could build with the pairing
  module, and out of scope regardless. Paper slips plus the fast triage grid
  above are the teacher-facing answer.
- **Live student response board** fed by those submissions.

## Platform themes that matter here

- **P9 (device pairing)** — teacher-side only: a phone remote for advancing
  prompts and running think time while circulating.
- **P2 (shared roster)** — named class sets and per-student triage.
- **P7 (cross-tool)** — the prompt-bank/display/handout trio it shares with
  Number Talks and Writing Prompt Generator.
- **P1 (projector mode)** — **addressed 2026-08-10 (Round 4, PR #55)**: a
  Fullscreen button now enlarges the `.stage` element for the prompt display.

## Open Questions

- ~~Is collecting student responses something this site should do?~~
  **Answered: no.** The site is teacher-facing; students aren't intended users.
  Paper collection plus fast teacher-side triage is the direction.
- Should the three prompt-bank tools merge into one with modes, or stay
  separate and share a library?

## Round 4 update — 2026-08-10 (PR #55)

Implemented three of the Major Features / Quick Wins in one round, all in
`Tools/023-exit-ticket-generator.html` (no other files touched besides this one
and this prompt doc):

- **Fullscreen / projector mode (P1).** Added a Fullscreen button next to
  Shuffle on the Prompt & Display tab; it calls `requestFullscreen()` on the
  `.stage` element (same pattern already used by `025-writing-prompt-generator.html`
  and `021-pe-tournament-stations.html` — matched their convention exactly:
  `document.fullscreenElement === els.stage`, `fullscreenchange` listener,
  `F` keyboard shortcut ignored while typing in a field). Added
  `.stage:fullscreen` rules that bump the prompt text and think-timer font
  sizes well past their normal `clamp()` ceilings so it reads from the back
  of a room. This finally closes the gap the doc called out under P1.
- **Fast paper-triage grid (flagship Major Feature).** New "Paper Triage" tab.
  Teacher pastes a roster (or loads one from the shared `np_rosters`
  localStorage key the same way `025-writing-prompt-generator.html`'s roster
  sheet does — read-only, no shared code, just the same data convention) and
  gets one row per student with Got it / Almost / Reteach buttons. Tapping a
  button (or pressing 1/2/3 on the keyboard once a row is "current")
  auto-advances to the next student so the teacher can flip through the
  physical stack without touching the mouse; tapping the same status twice
  clears it (mis-tap undo). Live counts, a generated reteach + almost list,
  and a small-group split (configurable group size, reteach names first)
  render below the grid and print as a clean one-page handout via a new
  `#triagePrintArea`. Rebuilding the grid from a re-pasted roster preserves
  existing taps for names that are still present (matched by name, in order,
  so duplicate names don't collide). Everything persists to
  `gvb-exit-ticket:triage` so a mid-triage page reload doesn't lose taps.
- **Projected anonymous discussion board.** New "Discussion Board" tab. The
  teacher transcribes two or three student responses (plain textarea, no
  name field exists anywhere in this flow), sees them lettered (Response A,
  B, C…) in a manage list with per-response remove, and projects them on a
  `.discussion-stage` that supports the same fullscreen treatment as the
  main stage. Clicking a card on the board enlarges just that one response
  for the room (click again to return to the grid) — a small but real aid
  for driving a 30-second whole-class conversation off of one response at a
  time. Persists to `gvb-exit-ticket:discussion`.

Both new tabs reuse existing CSS classes/tokens (`.card`, `.card-title`,
`.hint`, `.bank-remove-btn`, `.row2`, the `--good`/`--err` vars already
defined but unused in the file, plus one new `--warn` var for "Almost") and
the existing storage-key-per-feature convention (`TALLY_KEY`, `CUSTOM_BANK_KEY`,
etc.) rather than overloading the single settings object. `afterprint` now
clears `.active` off of every `.print-only` element generically instead of
just the handout one, since there are now two independent print areas.

**Deliberate scope decisions / what's skipped:**

- Small groups combine reteach + almost students in one pool (reteach
  first) rather than only reteach. The improvement doc says "the reteach
  list for tomorrow and the small-group split" without specifying whether
  almost-there students belong in the groups too; grouping both felt like
  the more useful default for actually running small groups, but a future
  round could add a toggle if that guess is wrong.
- No name/date-line handout toggle-by-default and no batch class-set
  printing from `np_rosters` (P2, listed under Quick Wins) — the triage
  tab now reads `np_rosters` for its own roster picker, but the handout tab
  itself is untouched. That's the natural next pairing (print one exit
  slip per name from the loaded roster) and would reuse the same
  `loadNpRosters()`/`parseRosterNames()` helpers added here.
- Tag prompts by subject/purpose, pin/favorite prompts, "don't show again",
  import-a-list-from-paste for the custom bank, bell-ringer sequences, and
  standards tagging (all listed under Quick Wins / Major Features) were not
  touched this round — the three features above were judged the highest
  leverage for one session and the moonshot explicitly names all three
  together as the "closes the loop in one class period" workflow.
- Tally-by-response-category (got it / partial / confused counts over time)
  was left alone; Quick Tally is unchanged. It's a reasonable next pick and
  is a smaller lift than what shipped here.
- No student-facing changes — the deferred section's boundary was respected
  throughout; both new tabs are exclusively teacher-input, teacher-facing.

**Cross-tool note (P7):** `025-writing-prompt-generator.html` already carries a
fullscreen-stage implementation that is byte-for-byte the same pattern
this round just added here (and `021-pe-tournament-stations.html` has a third
copy). All three now duplicate the same ~15 lines of
`toggleFullscreen`/`updateFullscreenLabel`/`fullscreenchange` wiring and the
same `.stage:fullscreen` CSS shape. If Number Talks Board picks up
fullscreen too this round, that's four copies — worth lifting into a small
shared `_shared/` helper (e.g. `_shared/fullscreen-stage.js` exporting a
`wireFullscreen(stageEl, buttonEl)`) the next time any of these four files
is touched, rather than a fifth copy-paste. Not done here since touching
`_shared/` was out of scope for this round and the other two tools are
being worked on in parallel.

**Where the next round should pick up:** batch class-set printing from
`np_rosters` on the handout tab (reusing this round's roster helpers),
tally-by-category, and the P7 shared-library convergence noted above are
the most obvious next steps. The triage tab's "small groups" pooling
decision above is worth revisiting if a teacher explicitly wants
reteach-only groups.

## Pass 2 — Round 2 update — 2026-08-11 (session `mxpfjs`)

Picked up the two items the Round 4 update named as the natural next steps,
both in `Tools/023-exit-ticket-generator.html` only (no other files touched
besides this one and this prompt doc):

- **Batch class-set printing from `np_rosters` on the Printable Handout tab
  (P2).** New "Class Set" card at the top of the Printable Handout tab, above
  Layout: a "Print a slip for every student in a class" checkbox reveals the
  same roster-picker pattern as the Paper Triage tab (`np_rosters` dropdown +
  paste-names textarea), reusing the existing `loadNpRosters()` and
  `parseRosterNames()` helpers directly rather than duplicating them. When
  the toggle is on, the handout preview and print output switch to one slip
  per roster name, each with that student's actual name (bold, pre-printed —
  not the blank "Name: ___" line) and a "Date: ___" line, regardless of the
  "Include on each slip" checkboxes (which only govern the non-batch mode
  now). The existing "Same prompt on every slip" / "A different prompt on
  each slip" select is reused unchanged: "same" gives the whole roster the
  current stage prompt, "different" draws one distinct prompt per student
  from `pickDistinctSlipPrompts()` (same helper the non-batch different-slip
  mode already used), cached in a new `batchSlipPrompts` array so retyping a
  name mid-roster doesn't reshuffle everyone, with "New set of prompts"
  forcing a fresh shuffle either way. Slips still respect the existing
  2-per-page / 4-per-page setting; rosters larger than one page emit multiple
  `.slip-page.batch-page` blocks with a new `page-break-after` print rule so
  each page prints separately. The Print button relabels to "Print Class
  Set" while batch mode is on. Batch mode is a boolean on the existing
  `settings` object (persisted via `STORAGE_KEY`, same convention as
  `showName`/`slipMode`/etc.) — the roster text itself is intentionally not
  persisted, matching how the non-batch handout's prompt selection isn't
  persisted either.
- **Tally by response category.** Added a "Tally by Category" card alongside
  (not replacing) the existing 1-4 Quick Tally, in the same Quick Tally tab —
  the two are different tools (a fixed self-report scale for students to tap
  vs. a teacher-editable set of named buckets for sorting a paper stack) and
  extending the 1-4 tally in place would have muddied both. Ships with three
  default categories seeded from the improvement doc's own example — "Got
  it", "Partial", "Confused" — each independently renamable (inline text
  input) and removable, plus an "Add Category" button for more. Each
  category is a large tap-to-increment tile; "Save & Reset" logs a
  date-stamped snapshot (all category labels and counts, plus the total) to
  a persisted history list below and zeroes the counters for the next class,
  directly matching the doc's "a simple date-stamped log entry per
  save/reset action is sufficient" scoping note — no charting was built.
  History entries can be individually removed. Everything persists to a new
  `gvb-exit-ticket:categoryTally` key (`{ categories, history }`), following
  the file's one-key-per-feature convention rather than overloading
  `TALLY_KEY` or the settings object.

**Compatibility / storage notes:**

- New keys: `gvb-exit-ticket:categoryTally`. No existing key's schema
  changed; `settings.batchMode` is a new optional boolean on the existing
  `STORAGE_KEY` object and defaults to `false` for anyone with a pre-existing
  saved settings blob (old data has no `batchMode` field, which
  `applySavedSettings()`'s `typeof === 'boolean'` guard treats the same as
  "not set").
- `slipHtml()` gained an optional second parameter (`studentName`); calls
  from the pre-existing non-batch path are unchanged (single-argument), so
  no existing behavior shifted.

**Testing performed:**

- `node --check` on both extracted inline `<script>` blocks (main app logic
  and the service-worker registration snippet) — no syntax errors.
- A headless Playwright smoke test against the pre-installed Chromium at
  `/opt/pw-browsers/chromium` (`executablePath` set explicitly; `playwright
  install` was not run), loaded via `file://`, covering: seeding `np_rosters`
  and confirming the batch roster dropdown picks it up; selecting a roster
  and confirming `#printArea` contains one `.slip` per name with every name
  string present in the markup, first under "same prompt" (all slip prompts
  identical) and again after switching to "different prompt on each" (names
  still present, slip count unchanged); the three default category tiles
  render, increment correctly, "Save & Reset" logs the expected history text
  and zeroes counters, and a full page reload preserves both the zeroed
  counters and the logged history, with the counters still incrementing
  correctly post-reload. Zero console/page errors throughout. The test
  script and extracted script files were deleted after the run — nothing
  left behind in the repo.
- Result: pass, no deviations from the two scoped tasks.

**What's still open:** the P7 shared-library convergence
(prompt-bank/display/handout trio with Number Talks and Writing Prompt
Generator) and the fullscreen-stage duplication across four tools noted in
the Round 4 update are both untouched — still the right candidates for a
future round that's explicitly scoped to touch `_shared/`. Tag/pin/import
prompt-bank features and bell-ringer sequences also remain unpicked-up.

## Sized-response round — 2026-08-11 (backlog rank 1)

Shipped **"A response box sized for the prompt, and lined vs blank as a
choice"** — the oldest still-open Quick Win in this file.

Two selects on the Printable Handout tab's Layout card:

- **Response area**: *Ruled lines*, *Blank box* (bordered, for a sketch,
  diagram or graph), or *Plain space*.
- **How much room to leave**: *Match the prompt (automatic)*, or an explicit
  *short* (a third of the slip), *medium* (half) or *full*.

Design notes worth keeping:

- The size is a pair of **flex weights**, not a fixed pixel height: the
  response box gets its fraction of whatever room the slip has left after the
  prompt and the name/date row, so it stays correct at 2-per-page and
  4-per-page, on screen and in print, without a second set of numbers.
- **The slack goes below the box, not above it.** The first attempt put the
  spacer above, which pushed a lone ruled line to the bottom of the slip with a
  hole above it — it read as a rendering bug. Writing space starts directly
  under the question; the leftover paper reads as margin.
- **Line count follows the box height, rounded up.** Rounding down gave "List
  three things you learned" a single line, which is worse than the fixed
  layout it replaced.
- **The automatic size reads the prompt's wording, not its length.** "Explain
  why … with evidence" is a paragraph whether it is six words or sixty, and
  "List three" is short either way; length only breaks the tie when no verb
  gives it away. The hint line under the selects says out loud what automatic
  decided ("This prompt reads as an explanation, so each slip leaves the whole
  slip to write in"), so it is inspectable rather than mysterious. In
  different-prompt-per-slip mode each slip sizes to its own prompt and the note
  says so.
- Both settings persist in the existing `gvb-exit-ticket` settings blob and are
  defaulted in `applySavedSettings`, so a teacher's older saved settings load
  unchanged. Class Set slips inherit the same response area.

New suite `Tools/exit-ticket-generator/test/smoke-response-area.mjs` (23 checks)
as `npm run test:exit-ticket`: it measures the response box as a real fraction
of the rendered slip (so "short" cannot be a relabelled constant), checks the
three wording buckets, the explicit override, the three styles including the
computed border, print/preview parity, persistence across a reload, and the
class-set path.

### Where the next round should pick up

- The still-deferred Quick Wins from Round 4 are untouched: **name/date lines
  on the handout tab** (the Paper Triage tab has its own roster picker, the
  handout tab's checkboxes are unchanged), **tagging prompts by purpose**,
  **pin/favourite**, and **paste-import a prompt list** (P13).
- The auto-size heuristic is two regexes and a length tie-break. If it guesses
  wrong often in real use, the fix is more verbs, not a longer prompt — and the
  explicit override already covers the exceptions.
