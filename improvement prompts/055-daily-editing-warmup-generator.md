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

**2026-08-11 — Round 2 (session `qer21r`).** Three Quick Wins shipped:

- **Category/error-type tags on every built-in sentence, plus a filter**
  — each of the 24 built-ins was hand-tagged into one of six buckets
  (Capitalization, Punctuation &amp; Apostrophes, Homophones,
  Subject-Verb Agreement, Run-ons &amp; Comma Splices, Other, matching the
  five named in this file's own suggestion plus a catch-all), and a new
  "Error type" dropdown filters the projector display, Prev/Next
  navigation, and worksheet build together — resolving the "targeting
  apostrophes this week" gap named in this file.
- **Error-type label alongside the reveal** — a bonus once tagging
  existed: the projector display now shows the error-type label the
  moment the correction is revealed (not before, so it doesn't spoil the
  answer), turning the reveal into a one-line grammar-term refresher per
  the Major Features wishlist.
- **Settings persistence** for the worksheet count and category filter
  (`deg_settings_v1`), matching the pattern used across sibling tools.
- **Edit an existing custom sentence** instead of delete-and-re-add — the
  Add form now also asks for an error type, and custom bank rows render
  as live-editable textareas/select (broken text, corrected text,
  category) instead of read-only text, saving on every keystroke.

Verified with a headless Chromium smoke test (filter narrows the display,
category label appears only after reveal, sheet count + category survive
a reload, editing a custom sentence's text persists across reload) plus a
separate print-path check building a filtered worksheet — zero console
errors in either pass.

**Not started this round:** hide/disable individual built-ins, bulk
import from a pasted list, difficulty/grade-band tiers, a "why"
explanation per correction, weekly/spiral no-repeat rotation. See Major
Features/Moonshot below — a "why" explanation is the single biggest
pedagogical gap still open (the reveal shows the fix but not the rule),
and now that sentences are error-tagged it could reasonably default to a
short per-category explanation with per-sentence override, addressing the
Open Question about whether 24 hand-written explanations are required
just to ship the feature.

## What it does today

- 24 built-in broken/corrected sentence pairs
- Projector mode: one sentence at a time, shuffle, reveal-the-fix
- Worksheet mode: pick a count, get a randomized worksheet + answer key from
  the combined built-in + custom bank
- Custom sentence bank: add your own, delete only your own

## Quick Wins

- ~~**Categorize/tag sentences**~~ — **done, Round 2** (six buckets:
  capitalization, punctuation &amp; apostrophes, homophones, subject-verb
  agreement, run-ons, other; filter applies to display + worksheet).
- **Hide/disable individual built-in sentences** without deleting them —
  right now the only granularity is "add custom" or "use everything," so a
  built-in that doesn't fit a class can't be dropped from rotation. (053
  Cultural Trivia Card Generator shipped this exact pattern in the same
  round this file's tool got tagging — its `Hide`/`Unhide`-per-built-in
  approach with a stable-id list in `localStorage` is the template to
  copy here.)
- ~~**Settings persistence for worksheet count**~~ — **done, Round 2**
  (grade-band-appropriate *defaults* specifically, as opposed to just
  remembering the last value used, is still open).
- ~~**Edit an existing custom sentence**~~ — **done, Round 2.**
- ~~**Error-type label alongside the reveal**~~ — **done, Round 2**
  (shown only once revealed, so it doesn't spoil the answer).

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
