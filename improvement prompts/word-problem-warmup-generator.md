# Improvement Prompts — Word Problem Warm-Up Generator

**Tool file:** `Tools/word-problem-warmup-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Randomized word problems by operation and grade band, projected one at a time with a reveal-answer button or printed as a worksheet with a matching answer key.

---

## Status

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: three sentence templates per operation
(addition/subtraction/multiplication/division), two grade-band number
ranges, a projector display with prev/next and a reveal-answer toggle, and a
printable worksheet + answer key sharing the same generated set. Numbers are
randomized fresh on each "Generate"; division problems are constructed so
the answer is always a whole number. Verified with a headless Chromium
smoke test (default generation, reveal, next, switch to worksheet tab) — no
console errors.

Everything below is unbuilt — this ships with 3 templates per operation and
no persistence at all, both deliberate MVP cuts.

## What it does today

- 3 templates per operation × 4 operations = 12 total sentence patterns,
  each filled with a random name, random everyday item, and grade-band-
  scaled numbers
- Grade band toggle (3&ndash;5 vs 6&ndash;8) changes the number ranges, not
  the templates
- Projector display (one problem at a time, reveal button) and printable
  worksheet + answer key, generated from the same problem set so they always
  match

## Quick Wins

- **More templates per operation** — 3 repeats noticeably within one
  6&ndash;10 problem sheet. This is the single highest-value next step and
  is pure content, not architecture.
- **Seeded generation**, the way Math Fact Drill Sheet Generator does it
  (Mulberry32 RNG + a "lock seed" checkbox), so a sheet can be reprinted
  identically for a make-up.
- **Settings persistence** — grade band, operation checkboxes, and problem
  count reset to defaults on every page load right now; a `localStorage`
  save would match every other generator in the toolkit.
- **A per-problem operation label** (small badge showing "multiplication",
  etc.) in the worksheet view, useful when operations are mixed on one
  sheet.
- **Copy-to-clipboard for the current projected problem**, for pasting into
  a slide deck instead of switching windows to project this page.

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
