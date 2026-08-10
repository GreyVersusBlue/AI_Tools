# Improvement Prompts — Cognates & False Friends Reference List Builder

**Tool file:** `Tools/cognates-false-friends-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Spanish and French starter examples (or build from scratch) split into true cognates and false friends, printed as a two-section reference sheet.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from
the Ideas Backlog — closes out the World Language section for now. Two
starter example sets (Spanish, French) with well-known real examples
(e.g. Spanish "embarazada" looks like "embarrassed" but means "pregnant";
French "librairie" looks like "library" but means "bookstore"), a blank
option, and two fully editable lists: true cognates (target word +
English word) and false friends (target word + what it looks like +
what it actually means). Print produces a clean two-section reference
sheet, cognates in green, false friends in red, matching the color
convention used in the tool's own favicon. Autosaves to `localStorage`
(`cffb_list_v1`). Verified with a headless Chromium smoke test (default
Spanish examples, template swap to French with confirm-dialog accepted,
add a cognate, print, confirm the French-specific false friend appears and
the Spanish-specific one correctly doesn't) — no console errors.

Nothing below has been started.

## What it does today

- 2 starter example sets (Spanish, French) + blank
- Fully editable cognates list (target + English) and false friends list
  (target + looks-like + actual meaning)
- Print: two-section color-coded reference sheet

## Quick Wins

- **More starter language example sets** (German, Italian, Portuguese) —
  pure content work, the highest-leverage next step given only two
  languages are covered today.
- **Reorder list items** via up/down buttons, matching the pattern used
  elsewhere in this toolkit.
- **Multiple named saved lists**, matching the multi-save convention used
  by most builder tools in this round — one flat pair of lists per browser
  right now, so a "Spanish 1" list and a "Spanish 2 (advanced)" list can't
  coexist.
- **A "quiz me" reveal mode**: show the target word, hide whether it's a
  true cognate or false friend, let students guess before revealing —
  turns the static reference sheet into a quick warm-up activity too.

## Major Features

- **JSON export/import**, for sharing a built list between language
  teachers on the same team or across levels of the same language.
- **Partial cognates category**: real linguistics distinguishes "false
  friends" (mean something totally different) from "partial cognates"
  (share some but not all meanings) — a third category would be more
  linguistically complete for an advanced class, though it adds
  complexity the current true/false binary avoids.
- **Bulk import from a pasted list**, matching the pattern proven in
  Staff Directory Builder and other tools this round — typing pairs one
  at a time in the current form doesn't scale to a large reference list.
- **Difficulty/frequency tagging** so a teacher can filter to "the 10 most
  common false friends" for a quick warm-up versus the full reference list
  for study.

## Moonshot / North Star

**A cognates and false friends library spanning every commonly-taught
language, deep enough to filter by frequency or difficulty, that doubles
as both a static reference sheet and a quick quiz-yourself warm-up.** More
language example sets close the immediate content gap; a quiz mode turns
a passive reference into active practice; and bulk import removes the
friction of building a large list one row at a time.

## Platform themes that matter here

- **P7 (cross-tool)** — bulk import (Staff Directory Builder pattern) is
  directly transferable; the quiz-me mode echoes this round's other
  reveal-based generators (Daily Editing, Math "Find the Mistake",
  Geography Bee, Cultural Trivia).
- **P15 (first run)** — more starter language sets is the single biggest
  first-run improvement, since only two of the many languages taught in
  U.S. schools currently have example content.

## Open Questions

- Is a "partial cognate" third category worth the added conceptual
  complexity for a middle-school audience, or does the simpler true/false
  binary already established here communicate the pedagogically important
  distinction well enough?
- Should quiz mode be built here, or does it belong better as a mode
  within Vocab &amp; Conjugation Drill Generator (an existing tool already
  built around quiz-style vocabulary practice) given the underlying
  interaction (show a word, hide the answer, reveal) is nearly identical?
