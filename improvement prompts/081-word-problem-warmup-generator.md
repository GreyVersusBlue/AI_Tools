# Improvement Prompts — 081 — Word Problem Warm-Up Generator

**Tool file:** `Tools/081-word-problem-warmup-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Randomized word problems by operation and grade band, projected one at a time with a reveal-answer button or printed as a worksheet with a matching answer key.

---

## Status

**2026-08-12 — Backlog round: copy current problem to clipboard shipped
(backlog rank, then #1).** A 📋 Copy button in the projector display's nav
row copies the current problem's text plus `Answer: N` (the answer on its
own line, deliberately, so it's one keystroke to delete when pasting into
a student-facing slide) to the clipboard, with a transient aria-live
confirmation note that auto-hides after a few seconds and a
`window.prompt` fallback when the clipboard API is unavailable. Verified
with a headless Chromium test: copied text starts with the displayed
problem and carries the answer line, advancing to problem 2 and copying
follows the display, and the note auto-hides — zero console errors.
Next round: the per-problem operation badge is the remaining Quick Win;
two-step problems (its own backlog row) is the bigger lever.

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: three sentence templates per operation
(addition/subtraction/multiplication/division), two grade-band number
ranges, a projector display with prev/next and a reveal-answer toggle, and a
printable worksheet + answer key sharing the same generated set. Numbers are
randomized fresh on each "Generate"; division problems are constructed so
the answer is always a whole number. Verified with a headless Chromium
smoke test (default generation, reveal, next, switch to worksheet tab) — no
console errors.

**2026-08-11 — Round 1 (session `h4rwxn`).** Shipped three of the Quick Wins
below. More templates per operation: doubled from 3 to 6 per operation (24
total sentence patterns), reusing the existing `(a, b, name, item) =>
{text, answer}` template shape. Seeded generation: added the same
mulberry32 PRNG + "lock seed" checkbox pattern Math Fact Drill Sheet
Generator uses (`Tools/math-drill-generator/mdg-generate.js` was the
reference) — `randInt`/`pick` now take an explicit `rng` argument instead
of calling `Math.random()` directly, and one `rng = makeRng(seed)` is
created per Generate click so a whole set (not just one problem) is
reproducible from its seed. Settings persistence: grade band, the four
operation checkboxes, problem count, and the lock-seed state now save to
`wpwg_settings_v1` in localStorage and restore on load.

One bug caught and fixed before it shipped: the first Generate click
after checking "Lock seed" would still produce a *new* random set, because
`nextSeed()` read `settings.lockSeed` and that value was previously only
written inside `saveSettings()`, which ran *after* `nextSeed()` in the
Generate flow — a one-click lag between checking the box and it actually
taking effect. Fixed by adding a `change` listener on the checkbox that
writes `settings.lockSeed` immediately, so checking the box now freezes
the sheet currently on screen rather than the next one generated after
that. Caught by reasoning through the call order while writing it, then
confirmed with a headless Playwright test (check the box, click Generate,
confirm the seed and problem text are identical to what was already
displayed — not the next roll). A second Playwright pass confirmed
determinism end-to-end (2,000 direct-call trials against the extracted RNG
functions: no negative subtraction answers, no non-integer division
answers, same seed &rarr; byte-identical problem set) and that lock-seed
survives a page reload.

Two-step problems, fractions/decimals/percents templates, a custom
template editor, per-problem operation labels, copy-to-clipboard, and
on-screen answer input all remain unbuilt.

## What it does today

- 6 templates per operation &times; 4 operations = 24 total sentence
  patterns, each filled with a random name, random everyday item, and
  grade-band-scaled numbers
- Grade band toggle (3&ndash;5 vs 6&ndash;8) changes the number ranges, not
  the templates
- Projector display (one problem at a time, reveal button) and printable
  worksheet + answer key, generated from the same problem set so they always
  match
- Seeded generation with a "lock seed" checkbox — checking it freezes the
  current set; the next Generate click reproduces it exactly (same
  problems, same order); a visible seed field shows what's currently locked
- Grade band, operation selection, problem count, and lock-seed state
  persist in `localStorage` across visits
- **Copy button on the projector display** — current problem + answer to
  the clipboard for pasting into a slide deck

## Quick Wins

- **A per-problem operation label** (small badge showing "multiplication",
  etc.) in the worksheet view, useful when operations are mixed on one
  sheet.
- **Done — 2026-08-12.** **Copy-to-clipboard for the current projected
  problem**, for pasting into a slide deck. *(See Status.)*

## Major Features

- **Two-step word problems** for the upper grade band — the backlog and
  README both call this a grades 6&ndash;8 tool, and real 6&ndash;8 word
  problems are frequently two operations chained together
  ("buys 3 packs of 8, then gives away 5 — how many are left"). This is the
  biggest gap between what's shipped and what a middle-school teacher will
  actually want.
- **Fractions/decimals/percents templates**, sharing the operand-generation
  approach `IDEAS_BACKLOG.md` separately lists for a
  fraction-decimal-percent drill generator — this tool's template structure
  is the natural home for that as a mode rather than a separate build.
- **Custom template editor** — let a teacher add their own sentence pattern
  with `{a}`/`{b}`/`{name}`/`{item}` placeholders, so class-specific context
  (a current novel's characters, a science unit's vocabulary) can replace
  the generic name/item lists.
- **On-screen student answer input** with instant right/wrong feedback via
  a share link (this toolkit's P3 pattern), instead of only projector
  display or paper.

## Moonshot / North Star

**Any word problem a class needs, worded for the actual unit they're in, at
the right difficulty, with numbers that never repeat until the teacher wants
them to.** Two-step problems for the grade band that needs them, a template
library deep enough that "not this one again" never happens, and a seed so
a make-up quiz is the exact same sheet as the one the rest of the class took.

## Platform themes that matter here

- **P7 (cross-tool)** — the fraction/decimal/percent backlog idea and this
  tool's template engine are a natural single build.
- **P15 (first run)** — settings persistence removes the "reset every visit"
  friction on a tool meant for daily warm-up use.
- **P3 (share links)** — an on-screen answer-input mode, later.

## Open Questions

- Should two-step problems be a separate operation category ("two-step") or
  a flag any operation template can opt into? A separate category is
  simpler to build; a flag reuses the existing per-operation number-range
  logic more cleanly.
- Is the generic name/item pool (Maya, Ethan, stickers, marbles, &hellip;)
  worth making editable, or does a custom-template editor make that
  unnecessary since a teacher could just write items into their own
  template text?
