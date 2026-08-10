# Improvement Prompts — 055 — Daily Editing / DOL Warm-Up Generator

**Tool file:** `Tools/055-daily-editing-warmup-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** A bank of broken sentences reveals one at a time on the projector with a click-to-show corrected version, plus a printable worksheet mode and a teacher-added custom sentence bank.

---

## Status

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: a 24-sentence built-in bank covering common middle-school
grammar/punctuation errors (homophones, subject-verb agreement, run-ons,
apostrophes), a projector display with shuffle + reveal, a printable
worksheet (blank line under each sentence) with a matching answer key, and a
teacher-editable custom sentence bank that layers on top of the built-ins
(built-ins can't be deleted, only hidden by never including them — see Open
Questions). Custom sentences persist in `localStorage`
(`deg_custom_v1`). Verified with a headless Chromium smoke test (reveal,
next, add a custom sentence, build a worksheet) — no console errors.

Nothing below has been started.

## What it does today

- 24 built-in broken/corrected sentence pairs
- Projector mode: one sentence at a time, shuffle, reveal-the-fix
- Worksheet mode: pick a count, get a randomized worksheet + answer key from
  the combined built-in + custom bank
- Custom sentence bank: add your own, delete only your own

## Quick Wins

- **Categorize/tag sentences** (capitalization, punctuation, homophones,
  subject-verb agreement, run-ons) and let a teacher filter to one category
  — right now every sentence is in one undifferentiated pool, and a teacher
  targeting "this week we're focused on apostrophes" can't narrow to that.
- **Hide/disable individual built-in sentences** without deleting them —
  right now the only granularity is "add custom" or "use everything," so a
  built-in that doesn't fit a class can't be dropped from rotation.
- **Settings persistence for worksheet count and grade-band-appropriate
  defaults** — resets to `5` every page load.
- **Edit an existing custom sentence** instead of delete-and-re-add.
- **Error-type label alongside the reveal** ("subject-verb agreement") so
  the correction doubles as a quick grammar-term refresher, not just an
  answer.

## Major Features

- **Import a whole custom bank from a pasted list** (one broken/fixed pair
  per line, tab- or `|`-separated), matching the bulk-paste pattern already
  used elsewhere in this toolkit (Staff Directory Builder, Review Game
  Board's spreadsheet import) — typing sentences one at a time in the Add
  form doesn't scale past a handful.
- **Difficulty/grade-band tiers** in the built-in bank (elementary vs
  middle vs high school errors), the way Math Fact Drill Sheet Generator
  scales by grade band, instead of one fixed difficulty for everyone.
- **A "why" explanation per correction** (one sentence: "its is possessive,
  it's is a contraction") so the reveal teaches the rule, not just the fix
  — this is the single biggest pedagogical gap versus a plain answer key.
- **Weekly/spiral rotation**: track which sentences have already been shown
  this week/month so "no repeats until everything's been seen" happens
  automatically instead of relying on shuffle alone.

## Moonshot / North Star

**A DOL bank that teaches the rule, not just the fix, and never repeats
until it's cycled through everything — scoped to exactly the error types a
class needs this week.** Category filters get a teacher to "apostrophes
only" in one click; a why-explanation on each reveal turns "here's the
correct version" into an actual five-minute grammar lesson; and a no-repeat
tracker means daily use for a full year never feels like the same 24
sentences on loop.

## Platform themes that matter here

- **P7 (cross-tool)** — the bulk-import pattern already proven in Staff
  Directory Builder and Review Game Board's spreadsheet import applies
  directly here.
- **P15 (first run)** — category filters and grade-band tiers both reduce
  "is this even the right content for my class" friction on day one.
- **P6 (print quality)** — nothing urgent here; the worksheet/key layout is
  already plain and functional.

## Open Questions

- Should "hide a built-in sentence" be modeled as a per-sentence toggle
  (adds UI complexity to every built-in row) or as a single "exclude these
  IDs" list a teacher rarely touches? The former is more discoverable; the
  latter is less code.
- Is a why-explanation worth writing for all 24 built-ins as hand-authored
  text, or should it be optional/skippable so the bank doesn't need a
  rule-explanation for every single entry to ship the feature at all?
