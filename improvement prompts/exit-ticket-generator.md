# Improvement Prompts — Exit Ticket / Bell Ringer Generator

**Tool file:** `Tools/exit-ticket-generator.html`
**Support folder:** `Tools/exit-ticket-generator/` — `lib/qrcode.js`

**Current description (from README):** A bank of short warm-up and reflection prompts with a big projector display, plus a printable handout mode for half- or quarter-sheet exit tickets.

---

## Status

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
- **Think time** timer with a chime (30s / 1min / 2min / off)
- Handout printing at 2-per-page (half sheets) or 4-per-page (quarter sheets),
  with either the same prompt on every slip or **a different prompt on each**
- **Quick Tally** counter with reset (`gvb-exit-ticket:tally`)
- QR code support

## Quick Wins

- **Skipped — deferred, Round 4.** **Name and date lines on the slips.** An exit ticket you can't attribute is
  an exit ticket you can't use; this should be on by default with a toggle.
  *(The new Paper Triage tab reads `np_rosters` for its own picker; the
  handout tab itself is untouched.)*
- **A response box sized for the prompt**, and lined vs blank as a choice.
- **Skipped — deferred, Round 4.** **Print a whole class set** with names pre-printed from `np_rosters` (P2) —
  the same batch pattern Certificate Maker and Permission Slip already have.
  *(Natural next pairing with the Round 4 roster helpers, not built yet.)*
- **Skipped — deferred, Round 4.** **Tag prompts by subject and by purpose** (recall, reflection, prediction,
  self-assessment) so the bank is browsable rather than only shuffleable.
- **Skipped — deferred, Round 4.** **Pin / favourite prompts** and a "don't show me this one again" control.
- **Skipped — deferred, Round 4.** **Import a prompt list** from a paste (P13) instead of adding one at a time.
- **Done — Round 4.** **Bigger projector type and fullscreen** (P1) — this is a display tool
  without a proper display mode. *(Shipped as a Fullscreen button on the
  `.stage` element, matching the same pattern already used by
  `writing-prompt-generator.html` and `pe-tournament-stations.html`.)*

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
- **Skipped — deferred, Round 4.** **Tally by response category**, not just a raw count, so the existing Quick
  Tally can capture "12 got it, 9 partial, 7 confused" and chart it over time.
- **Skipped — deferred, Round 4.** **Bell-ringer sequences.** A prompt per day for a week or a unit, planned in
  advance and advanced automatically by date, rather than shuffled each
  morning.
- **Skipped — deferred, Round 4.** **Standards / objective tagging** so the prompt bank can be filtered by what
  you're actually teaching that day.
- **Skipped — deferred, Round 4.** **Number Talks and Writing Prompt convergence** (P7). This tool, 
  `number-talks-board.html`, and `writing-prompt-generator.html` are three
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
`Tools/exit-ticket-generator.html` (no other files touched besides this one
and this prompt doc):

- **Fullscreen / projector mode (P1).** Added a Fullscreen button next to
  Shuffle on the Prompt & Display tab; it calls `requestFullscreen()` on the
  `.stage` element (same pattern already used by `writing-prompt-generator.html`
  and `pe-tournament-stations.html` — matched their convention exactly:
  `document.fullscreenElement === els.stage`, `fullscreenchange` listener,
  `F` keyboard shortcut ignored while typing in a field). Added
  `.stage:fullscreen` rules that bump the prompt text and think-timer font
  sizes well past their normal `clamp()` ceilings so it reads from the back
  of a room. This finally closes the gap the doc called out under P1.
- **Fast paper-triage grid (flagship Major Feature).** New "Paper Triage" tab.
  Teacher pastes a roster (or loads one from the shared `np_rosters`
  localStorage key the same way `writing-prompt-generator.html`'s roster
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

**Cross-tool note (P7):** `writing-prompt-generator.html` already carries a
fullscreen-stage implementation that is byte-for-byte the same pattern
this round just added here (and `pe-tournament-stations.html` has a third
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
