# Improvement Prompts — Number Talks / Mental Math Routine Board

**Tool file:** `Tools/number-talks-board.html`
**Support folder:** none — single file

**Current description (from README):** A bank of number-talk prompts that reveal one expression at a time on a projector display, plus a lightweight strategy-sharing board.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Prompt bank by category, plus custom prompts saved to **"my bank"**
  (`gvb-number-talks:myBank`)
- **Reveal next expression / reveal all** — the defining interaction of a
  number string routine
- **Computes the answer itself** — a real expression parser
  (`tokenizeExpr`, `parseExpression`, `parseTerm`, `parseFactor`) with a
  teacher-only "show answer"
- **Strategy cards** added live during discussion, on a shared board
- Session save/export (`buildSessionExportText`, `exportSession`), string
  history (`gvb-number-talks:stringHistory`), clear board / clear log
- Print a handout of the number talk

## Quick Wins

- **Attribute strategies to students.** "Maya's way" is how number talks
  actually work, and a name field on a strategy card (optionally pulled from
  `np_rosters`, P2) would make the board match the classroom practice.
- **Bigger projector rendering and fullscreen** (P1). This is a projector tool
  without a projector mode.
- **Draw on a strategy card.** Number talk strategies are frequently
  visual — a number line, an array, a decomposition tree. A minimal drawing
  surface would capture what typing can't.
- **Turn-and-talk timer** built into the reveal flow (P7 — the timer exists).
- **A "wait time" pause** between reveal and discussion, since the routine
  depends on silent think time.
- **Save a whole session as a printable record** — the board, the strategies,
  and who contributed — which the export partly does but not as a handout.
- **Undo on Clear board** (P11) — it destroys a live discussion.

## Major Features

- **A real number string library.** Number talks work because the strings are
  deliberately sequenced (each problem sets up the next). A shipped library
  organized by strategy — making tens, doubling and halving, compensation,
  partial products, fraction equivalence — with the pedagogical intent stated
  for each, would be more valuable than any UI change. This is content work,
  not code work, and it's what separates a good number talk from a random set
  of problems.
- **Generate strings from a strategy.** Given "compensation" and a grade band,
  produce a fresh, correctly-sequenced string. The expression parser already
  proves the tool can reason about arithmetic.
- **Dot images / visual number talks.** Quick-image routines (dot cards, ten
  frames, arrays) shown briefly then hidden — a different and equally common
  form of the routine, and one that needs generated images rather than
  expressions.
- **Strategy library that persists across the year.** The class's own named
  strategies accumulate into a wall reference — printable as posters, which is
  exactly what a number-talks classroom has on its walls.
- **Student-device strategy submission** (P9), so quiet students contribute
  without speaking.
- **Convergence with the other prompt-bank tools** (P7) —
  `exit-ticket-generator.html` and `writing-prompt-generator.html` have the
  same bank/display/handout architecture in three separate implementations.

## Moonshot / North Star

**The routine, with the pedagogy built in.** Not a random-problem projector,
but a sequenced library of number strings that each teach something specific,
a board that captures the class's strategies in their own words with their
names on them, a growing wall of the class's methods, and a printable record
of what the class figured out — for a teacher who wants to run number talks
well but doesn't have a math coach.

## Platform themes that matter here

- **P1 (projector mode)** — this is a projector-first tool with no fullscreen
  or dark mode.
- **P7 (cross-tool)** — shares an architecture with two other prompt-bank
  tools and needs the timer.
- **P2 (shared roster)** — strategy attribution.
- **P15 (first run)** — the shipped content library is the product here.

## Open Questions

- How much curated content is Devon willing to author or curate? The library
  is the highest-value work here and it is writing, not programming.
- Should the expression parser be extracted to `_shared/` — the graph paper
  and math drill tools could both use it?

## Round 3 update — 2026-08-10

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
touched) — `exit-ticket-generator.html` and `writing-prompt-generator.html`
were independently given very similar content-bank + projector-display +
print-handout treatments this same round. All three tools now separately
implement "pick from a curated bank or type custom → reveal on a big/
fullscreen stage → print a handout," each with its own bespoke fullscreen
CSS/JS and its own print stylesheet conventions. That's real duplication
worth converging into a shared `_shared/` display-stage or print-handout
helper in a dedicated cross-tool round — but doing it well means diffing all
three implementations side by side first, which didn't fit in this
single-tool round.
