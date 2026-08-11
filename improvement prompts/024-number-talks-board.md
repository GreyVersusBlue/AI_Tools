# Improvement Prompts — 024 — Number Talks / Mental Math Routine Board

**Tool file:** `Tools/024-number-talks-board.html`
**Support folder:** none — single file

**Current description (from README):** A bank of number-talk prompts that reveal one expression at a time on a projector display, plus a lightweight strategy-sharing board.

---

## Status

Reviewed — structural read of the source, before Round 4 (PR #55, see below)
shipped the strategy-organized number string library, fullscreen/dark
projector mode, and dot images. Ideas below are deliberately ambitious and
are **not** scoped to a single session; items confirmed shipped are tagged
**Done** below.

## What it does today

- Prompt bank by category, plus custom prompts saved to **"my bank"**
  (`gvb-number-talks:myBank`)
- **Reveal next expression / reveal all** — the defining interaction of a
  number string routine
- **Computes the answer itself** — a real expression parser
  (`tokenizeExpr`, `parseExpression`, `parseTerm`, `parseFactor`) with a
  teacher-only "show answer"
- **Strategy cards** added live during discussion, on a shared board
- **Printable session record** (`printSessionRecord`) — the teacher's paper
  copy: the string with its computed answers, every attributed strategy card,
  the whole session's list of strings, and a "notes for next time" box
- Session save/export (`buildSessionExportText`, `exportSession`), string
  history (`gvb-number-talks:stringHistory`), clear board / clear log
- Print a handout of the number talk

## Quick Wins

- **Done — Pass 2, Round 2.** **Attribute strategies to students.** "Maya's way" is how number talks
  actually work, and a name field on a strategy card (optionally pulled from
  `np_rosters`, P2) would make the board match the classroom practice.
  *(Shipped as a `<datalist>`-backed autocomplete on the existing name field —
  see the Pass 2 — Round 2 update below.)*
- **Done — Round 4.** **Bigger projector rendering and fullscreen** (P1). This is a projector tool
  without a projector mode. *(Shipped as `#stageArea`-scoped
  `requestFullscreen()` with a near-black background and blown-up type; see
  the deliberate single-vs-dual-screen tradeoff in the Round 4 update below.)*
- **Draw on a strategy card.** Number talk strategies are frequently
  visual — a number line, an array, a decomposition tree. A minimal drawing
  surface would capture what typing can't.
- **Turn-and-talk timer** built into the reveal flow (P7 — the timer exists).
- **A "wait time" pause** between reveal and discussion, since the routine
  depends on silent think time.
- **Save a whole session as a printable record** — the board, the strategies,
  and who contributed — which the export partly does but not as a handout.
- **Done — Pass 2, Round 2.** **Undo on Clear board** (P11) — it destroys a live discussion.
  *(Shipped as a single-level, unpersisted undo — see the Pass 2 — Round 2
  update below.)*

## Major Features

- **Done — Round 4.** **A real number string library.** Number talks work because the strings are
  deliberately sequenced (each problem sets up the next). A shipped library
  organized by strategy — making tens, doubling and halving, compensation,
  partial products, fraction equivalence — with the pedagogical intent stated
  for each, would be more valuable than any UI change. This is content work,
  not code work, and it's what separates a good number talk from a random set
  of problems. *(~55 hand-written entries across 9 strategy categories, each
  with a "why this string" teaching note.)*
- **Skipped — deferred, Round 4.** **Generate strings from a strategy.** Given "compensation" and a grade band,
  produce a fresh, correctly-sequenced string. The expression parser already
  proves the tool can reason about arithmetic. *(Judged genuinely next-round
  scope — risky to get pedagogically right without more thought.)*
- **Done — Round 4.** **Dot images / visual number talks.** Quick-image routines (dot cards, ten
  frames, arrays) shown briefly then hidden — a different and equally common
  form of the routine, and one that needs generated images rather than
  expressions. *(Shipped as a "Quick Images (Dot Talk)" mode with ten-frame,
  dice/domino, scattered, and two-part-decomposition layouts.)*
- **Strategy library that persists across the year.** The class's own named
  strategies accumulate into a wall reference — printable as posters, which is
  exactly what a number-talks classroom has on its walls.
- **Student-device strategy submission** (P9), so quiet students contribute
  without speaking.
- **Convergence with the other prompt-bank tools** (P7) —
  `023-exit-ticket-generator.html` and `025-writing-prompt-generator.html` have the
  same bank/display/handout architecture in three separate implementations.

## Moonshot / North Star

**The routine, with the pedagogy built in.** Not a random-problem projector,
but a sequenced library of number strings that each teach something specific,
a board that captures the class's strategies in their own words with their
names on them, a growing wall of the class's methods, and a printable record
of what the class figured out — for a teacher who wants to run number talks
well but doesn't have a math coach.

## Platform themes that matter here

- **P1 (projector mode)** — **addressed 2026-08-10 (Round 4, PR #55)**:
  `#stageArea` fullscreen/dark mode shipped, with a noted single-vs-dual-screen
  tradeoff (only the stage subtree renders while fullscreened).
- **P7 (cross-tool)** — shares an architecture with two other prompt-bank
  tools and needs the timer.
- **P2 (shared roster)** — **addressed 2026-08-11 (Pass 2, Round 2)**: strategy
  attribution via `np_rosters`-backed autocomplete; see below.
- **P15 (first run)** — the shipped content library is the product here.

## Open Questions

- How much curated content is Devon willing to author or curate? The library
  is the highest-value work here and it is writing, not programming.
- Should the expression parser be extracted to `_shared/` — the graph paper
  and math drill tools could both use it?

## Round 4 update — 2026-08-10 (PR #55)

Implemented three of the Major Features in one round, no code comments added
beyond one non-obvious constraint note (the fullscreen/element-boundary
tradeoff below). Support folder `Tools/number-talks-board/` created with one
new file: `dot-images.js` (dot-layout geometry, no DOM/UI code — kept
separable and unit-testable in principle even though there's no test runner
in this repo).

**1. Real, strategy-organized number string library.** Rewrote `CATEGORIES`/
`PROMPTS` from grade-band buckets into named-strategy categories: Counting On,
Making Ten, **Compensation** (new — wasn't a category before), Doubling &
Halving, Partial Products, Division (reframed around partial quotients),
Fraction/Decimal Equivalence, Percent & Proportional Reasoning, Integers &
Order of Operations. Every entry is now `{ exprs, note }` instead of a bare
array — `note` states the pedagogical intent (why the string is sequenced
that way, what move it's meant to surface). A "Why this string" panel
(`#teachingNote`) renders the note on the control screen, teacher-only by
placement (outside `#stageArea`, so it never appears on the projector). The
custom-prompt box also grew an optional note field, saved through to "My
Number Talks" so a teacher's own authored strings carry the same metadata.
~55 entries across 9 categories, each hand-written, not generated. Left for
later: the "generate a fresh string from a chosen strategy" idea — genuinely
next-round scope, and risky to get pedagogically right without more thought.

**2. Fullscreen/dark projector mode.** `#stageArea` (stage + reveal controls
+ meta row) is now a single wrapper that gets `Element.requestFullscreen()`
called on it directly — no DOM reparenting, no duplicate render paths. CSS
`#stageArea:fullscreen` (plus a `.is-fullscreen` class kept in sync via the
`fullscreenchange` event, for a manual-class fallback when the Fullscreen API
is unavailable) blows up font sizes and fills the viewport on a near-black
background. Space/Enter/Right-arrow reveal the next expression or flash the
next quick image while fullscreen, scoped to only fire when `#stageArea` has
the fullscreen class so normal typing elsewhere is untouched. **Deliberate
tradeoff, worth flagging**: the Fullscreen API only renders the fullscreened
element's own subtree — everything outside `#stageArea` (answer key,
teaching note, category picker, strategy board) is invisible while
projecting. That's exactly right for a dual-screen setup (projector mirrors
just the stage) and exactly wrong for a single mirrored screen, where the
teacher temporarily loses their own controls other than reveal/flash/exit.
Accepted this because it guarantees the answer key can never leak onto the
screen by accident, which felt like the higher-value default; a future round
could add a small "teacher HUD" corner inside the fullscreen element if
single-screen use turns out to be the common case.

**3. Dot images / quick images (subitizing routine).** New "Quick Images
(Dot Talk)" mode, toggled via tabs above the stage, sharing the same
stage/reveal-row/print/history/strategy-board scaffolding as number strings
but with its own controls card. `dot-images.js` generates four arrangements
— ten-frame(s) (1–20, auto-splits into two frames past 10), classic dice/
domino patterns (1–6), scattered (randomized with minimum-distance spacing
so dots don't overlap), and two-part/decomposition (splits the count into
two colored clusters on a friendly anchor, e.g. 9 → 5 + 4) — all as
percentage-positioned `<div>`s, no canvas/SVG/images. Flow matches the real
routine: "New quick image" stages it hidden, "Flash" shows it for a
configurable duration (1.5–5s or untimed) then auto-hides to a "how many did
you see?" prompt, with "Flash again" and "Reveal & keep visible" for
follow-up, and a teacher-only "Show count" toggle (mirrors the existing
answer-key pattern) that also reveals the two-part split. Draws are logged
into the same session history / string-history log as number strings
(category label "Quick image"), and printing a handout renders the same dot
positions on paper with print-safe (dark-on-white) dot colors. Skipped for
this round: quick images aren't included in "Save this session" text export
beyond the history-list line (no dot diagram in the .txt), and there's no
roster/name attribution tie-in for who answered — both plausible quick wins
for a future pass rather than blockers here.

**Testing performed**: `node --check` on the extracted inline script and on
`dot-images.js` (both clean). Headless Chromium (Playwright) sanity pass
exercising: category pick → new number talk → teaching note renders →
answer key toggle computes correctly → custom prompt with note saves to bank
with note visible → switching to dots mode hides the strings UI and vice
versa → exact-count/two-part dot generation (verified a count of 9 split as
5 + 4) → flash → auto-hide after the configured duration → reveal-and-keep
→ dice layout stays within 1–6 → real `requestFullscreen()`/`exitFullscreen()`
enter and exit cleanly with the `is-fullscreen` class tracking actual
fullscreen state → Space key reveals the next expression while fullscreen →
print handout builds correctly for a dot image. Zero console errors across
the whole pass.

**Where the next round should pick up**: the "generate a string from a
strategy" idea from Quick Wins/Major Features; a "teacher HUD" inside
fullscreen if single-screen projector setups turn out to be common; roster
integration for strategy-card attribution (P2) and for tagging who answered
a quick image; including dot images in the session .txt export; and the
cross-tool convergence noted below.

**Convergence note for a future round**: confirmed by inspection (not
touched) — `023-exit-ticket-generator.html` and `025-writing-prompt-generator.html`
were independently given very similar content-bank + projector-display +
print-handout treatments this same round. All three tools now separately
implement "pick from a curated bank or type custom → reveal on a big/
fullscreen stage → print a handout," each with its own bespoke fullscreen
CSS/JS and its own print stylesheet conventions. That's real duplication
worth converging into a shared `_shared/` display-stage or print-handout
helper in a dedicated cross-tool round — but doing it well means diffing all
three implementations side by side first, which didn't fit in this
single-tool round.

## Pass 2 — Round 2 update — 2026-08-11 (session `mxpfjs`)

Shipped both remaining Quick Wins flagged as next-round work at the end of
Round 4: strategy attribution (P2) and undo on Clear board (P11). No other
behavior touched.

**1. Attribute strategies to students.** The strategy card already had a
free-text name field (`.s-name`); this pass wired it to the shared roster
instead of adding a new one. A `<datalist id="strategyNameOptions">` is
populated from `np_rosters` (read-only — same key and shape,
`{ rosterName: [names...] }`, that `023-exit-ticket-generator.html`,
`025-writing-prompt-generator.html`, and `003-rubric-builder.html` already
read) via `list="strategyNameOptions"` on the name input. `rosterNameOptions()`
merges and dedupes names across every saved roster (a teacher may have more
than one, e.g. different periods) rather than adding a "which roster" picker
— the earlier interrupted attempt at this same task had added a roster-select
dropdown that was reverted along with the rest of its partial work, and a
plain merged datalist covers the "start typing a name" use case with less
surface area. The datalist repopulates on boot and whenever a new card is
added, so a roster saved in Class Roster Hub / Name Picker moments earlier
still shows up without a reload. Typing a name not in any roster (or typing
nothing) still works exactly as before — `<datalist>` only suggests, never
constrains. No roster loaded means an empty, harmless datalist. The name
already flowed into `buildSessionExportText()`'s "STRATEGY BOARD" section
(`Name: text`, falling back to "Student N" when blank) before this pass, so
the session-record requirement was already satisfied by the existing data
model — confirmed still correct by the Playwright pass below rather than
changed.

**2. Undo on Clear board.** A single-level, module-level `boardUndoSnapshot`
(not persisted, not part of `state`/localStorage — the same pattern as
`022-lab-group-role-randomizer.html`'s `undoSnapshot`) is captured
(deep-cloned) right before `clearBoard()` empties the `strategies` array. A
new "Undo clear" button next to "Clear board" is disabled by default, enables
the instant a clear happens, and disables itself again either when clicked
(restoring the exact prior cards and IDs) or when a new strategy card is
added post-clear (`addStrategyCard()` discards the snapshot) — matching the
spec exactly. Clicking Clear on an already-empty board is a no-op and does
not touch the snapshot, so an accidental double-clear can't stomp a still-
useful undo.

**Compatibility notes**: both features are additive — no existing function
signature, storage key, or render path changed shape. `renderStrategies()`
still emits the same card markup plus one new `list` attribute; `clearBoard()`
still empties `strategies` and re-renders, just with a snapshot taken first.
Nothing here touched `dot-images.js`.

**Testing performed**: `node --check` on both extracted inline `<script>`
blocks (clean). Headless Chromium (Playwright, `/opt/pw-browsers/chromium`)
against the `file://` page: seeded a two-roster `np_rosters` entry in
localStorage and reloaded → confirmed the datalist contains the merged,
deduped roster names → added a strategy card, filled in a roster-sourced name
and reasoning, confirmed the `list` attribute and value stuck → drew a number
talk, printed its handout (`window.print` stubbed) and confirmed
`#printArea` rendered → exported the session and read the downloaded `.txt`,
confirming the attributed line appeared as `Maya Chen: Broke 36 into 30 + 6,
doubled each, added.` → added a second named card → confirmed Undo starts
disabled → Clear board → confirmed the board emptied and Undo enabled →
clicked Undo → confirmed both cards (name + text, in original order) came
back byte-for-byte → confirmed Undo disabled itself after use → cleared
again and added a new card → confirmed Undo stayed disabled (invalidated by
the new card, per spec) instead of offering to restore stale content. Zero
console errors across the whole pass. No test scripts left behind.

**Where the next round should pick up**: everything else noted at the end of
Round 4 is still open — the "generate a string from a strategy" idea; a
"teacher HUD" inside fullscreen for single-screen projector setups; a real
printable *session* record (board + strategies + attribution as a handout,
not just the `.txt` export — now a slightly better handout candidate since
names are roster-backed); including dot images in the session `.txt` export;
roster/name attribution for *who answered* a quick image (distinct from
strategy-card attribution, still untouched); and the cross-tool convergence
with `023`/`025` noted above.

## Session-record round — 2026-08-11 (backlog rank 1)

Shipped the **printable session record** — the paper half of "Save this
session", which until now only wrote a `.txt` file into a downloads folder.

"Print session record" sits beside "Save this session" and prints, on one page:

- **On the board** — the current string, each expression with its computed
  answer, plus the teaching note if the string carries one. In quick-image
  mode it draws the dot image itself and states the count.
- **Strategies shared (N)** — one block per card, with the student's name, or
  a stable "Student N" label when the card was left unnamed. This is the part
  the `.txt` export flattened into one line each.
- **Number talks used this session (N)** — the whole session's strings, not
  just the one currently on the board.
- **Notes for next time** — a ruled box, because the record is a thing you
  write on after the lesson.

The record is deliberately *not* the student handout, in three ways that the
suite pins down: it shows the answers (the handout never does), it names who
said what, and it covers the session rather than the current string. An
expression `computeAnswer()` cannot parse (a word problem, "as a percent")
still prints — just without an answer — rather than being dropped.

New suite `Tools/number-talks-board/test/smoke-session-record.mjs` (25 checks)
as `npm run test:number-talks`: it drives a real custom string, two strategy
cards (one named, one not), and checks the answer, the attribution, the
unnamed fallback, the counts, the session list, the untouched and still
answer-free student handout, quick-image mode, and an empty board printing
something honest instead of crashing.

### Where the next round should pick up

- **Draw on a strategy card** is now the most valuable open Quick Win, and the
  session record gives it an obvious payoff: a number line or an array sketched
  during discussion would print straight onto this page. It needs a canvas and
  the storage thinking that goes with it (P12).
- **Turn-and-talk timer** and **wait-time pause** are still open and untouched.
- The record prints the strategy board *as it stands*. Clearing the board mid
  lesson loses what was there; if that turns out to matter, the fix is an
  append-only session log rather than reading `strategies` at print time.
