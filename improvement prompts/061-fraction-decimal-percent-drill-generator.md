# Improvement Prompts — 061 — Fraction–Decimal–Percent Conversion Drill Generator

**Tool file:** `Tools/061-fraction-decimal-percent-drill-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Randomized conversion rows across three difficulty tiers, one form given and the other two left blank, with a matching answer key.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog — closes out the Math section of the Ideas Backlog for now.
Three difficulty tiers control which denominators are eligible (easy:
halves/quarters/fifths/tenths and similar terminating-decimal-friendly
denominators; medium: adds thirds/sixths/eighths; hard: any denominator
2&ndash;20, decimals rounded to 3 places). Each generated row picks a
random reduced fraction, then a "given form" setting (random per row, or
fixed to always-fraction/always-decimal/always-percent) determines which
one of the three columns shows the value and which two are blank for the
student to fill in. Worksheet and answer-key views share the same
generated row set so they always match; both print together on separate
pages. Verified with a headless Chromium smoke test — including a check
for a real floating-point precision bug caught and fixed during the build
(see below) — no console errors.

**Bug caught and fixed during this build:** the first implementation
computed the decimal and percent columns independently from the raw
fraction value, each rounded separately. Because of ordinary
floating-point rounding (e.g. `0.333 * 100` evaluates to
`33.300000000000004` in JavaScript, not exactly `33.3`), the percent column
risked displaying long, ugly floating-point tails, and — worse — the
displayed decimal and percent could imply slightly different underlying
values since they were rounded independently rather than derived from each
other. Fixed by deriving the percent value directly from the *already-
rounded* decimal (`roundedDecimal &times; 100`) and rounding that result
again before formatting, so the two displayed values are always
consistent with each other and free of floating-point noise. Verified with
a per-cell (not concatenated-text) regex check across 20 generated "hard"
rows with no matches.

## What it does today

- 3 difficulty tiers (denominator pools)
- Given-form control: random per row, or fixed to one form
- Worksheet + matching answer key from the same generated set, printed
  together

## Quick Wins

- **Seeded generation**, matching Math Fact Drill Sheet Generator's
  pattern (a "lock seed" checkbox), so a sheet can be reprinted identically
  for a make-up.
- **Settings persistence** — difficulty, given-form, and row count all
  reset to defaults on every page load, unlike most other drill/generator
  tools in this toolkit.
- **A "show all three, ask which is odd one out" mode** as a quick
  alternate format — a set of rows where two of the three forms are
  correct and one is deliberately wrong, spot-the-error style (natural
  overlap with Math "Find the Mistake" Warm-Up Generator, built earlier in
  this same round).
- **Repeating-decimal notation** (e.g. a bar over repeating digits, or an
  explicit "&hellip;" ellipsis) for hard-tier fractions like thirds and
  sevenths, instead of silently rounding to 3 places with no indication
  that the true value repeats.

## Major Features

- **Negative number support** — all current values are positive fractions
  between 0 and 1; extending to values above 1 (improper
  fractions/mixed numbers) and negative values would substantially widen
  what this drill can practice.
- **Word-problem wrapping**: `IDEAS_BACKLOG.md`'s broader pattern (word
  problems as a wrapper around numeric drills) applies here too — "a
  recipe calls for 3/4 cup of sugar; what percent of a full cup is that?"
  turns a bare conversion into an applied skill.
- **Per-student targeted practice**: generate a sheet biased toward
  whichever of the three conversion directions (fraction&rarr;decimal vs
  decimal&rarr;percent, etc.) a student has been missing, the same
  longitudinal gap flagged on Math Fact Drill Sheet Generator.
- **A visual model option** (a fraction bar or percent-grid alongside the
  numeric row) for students who need a concrete representation before the
  abstract conversion clicks.

## Moonshot / North Star

**A conversion drill that scales from "halves and quarters" all the way to
"repeating decimals with proper notation," targets whichever direction a
student actually struggles with, and never hands back an internally
inconsistent answer.** The floating-point consistency fix already shipped
is the foundation that a targeted-practice and repeating-decimal-notation
version would build on — correctness first, then adaptivity.

## Platform themes that matter here

- **P7 (cross-tool)** — the "odd one out" spot-the-error mode is a direct
  crossover with Math "Find the Mistake" Warm-Up Generator's established
  pattern from earlier in this round.
- **P15 (first run)** — settings persistence is the most obvious first-run
  gap versus sibling generators in this toolkit.

## Open Questions

- Is silently rounding repeating decimals (e.g. showing "0.333" for 1/3
  with no repeating-decimal notation) acceptable for a middle-school
  audience, or does correctness here matter enough to add bar notation
  even for an MVP-tier tool?
- Should the "odd one out" mode live here or on Math "Find the Mistake"
  Warm-Up Generator, given both tools would implement essentially the same
  interaction (spot a deliberately wrong value) just with different
  underlying content?
