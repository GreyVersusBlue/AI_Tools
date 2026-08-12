# Improvement Prompts — 052 — Cognates & False Friends Reference List Builder

**Tool file:** `Tools/052-cognates-false-friends-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Spanish and French starter examples (or build from scratch) split into true cognates and false friends, printed as a two-section reference sheet.

---

## Status

**2026-08-12 — Backlog round: bulk paste import shipped (backlog rank,
then #3).** A "Bulk paste import" card above the two lists takes one entry
per line and appends to the existing lists (never replaces). Parsing is
the tolerant P13 shape: separator picked per line (tab first for
spreadsheet pastes, then pipe, then comma), fields beyond three folded
back into the note so a comma inside "actually means…" doesn't shear the
line, and routing decided by field count — two fields make a true cognate,
three make a false friend — with an optional trailing type token
(`cognate`/`true` or `false`/`ff`) as an explicit override. The result
note reports how many of each were added and quotes the first few skipped
(sub-two-field) lines; the textarea clears only on a successful import.
Verified with a headless Chromium test: mixed tab/pipe/comma lines, both
type tokens, the comma-folding note arriving intact, the skip report, and
persistence + print inclusion of imported rows — zero console errors.
Next round: named multi-save and the quiz-me reveal mode are the open
Quick Wins; the practice-worksheet variants row is separately on the
backlog.

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

**2026-08-11 — Pass 2, directed round (session `szyio3`).** Shipped both
top Quick Wins: **three more starter language sets** (German, Italian,
Portuguese — six languages total now, each with real, well-known cognate
and false-friend examples in the same style as the existing Spanish/French
sets, e.g. German "Gift" looks like "gift" but means "poison"; Italian
"camera" looks like "camera" but means "room"; Portuguese "puxar" looks
like "push" but means "pull"), and **reorder list items** via up/down
buttons on both the cognates list and the false-friends list independently.
Verified with a headless Chromium pass: loaded all three new templates and
confirmed the language name and first two cognates populated correctly for
each, reordered a false-friend pair, printed and confirmed the printed
language header matched — no console errors.

Nothing else below has been started.

## What it does today

- 2 starter example sets (Spanish, French) + blank
- Fully editable cognates list (target + English) and false friends list
  (target + looks-like + actual meaning)
- Print: two-section color-coded reference sheet
- **Bulk paste import**: tab/pipe/comma lines append to either list (field
  count or an explicit type token picks cognate vs. false friend)

## Quick Wins

- ~~More starter language example sets~~ — **shipped 2026-08-11**
  (German, Italian, Portuguese; six languages total).
- ~~Reorder list items~~ — **shipped 2026-08-11**, both lists.
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
- ~~**Bulk import from a pasted list**~~ — **done, 2026-08-12** (backlog
  round; see Status).
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

**Where the next round should pick up:** multiple named saved lists is the
remaining Quick Win and matches this round's 047/048/051 selector pattern
directly; the quiz-me reveal mode under Major Features is the highest-
leverage next step after that, and the Open Question below about where it
belongs (here vs. Vocab & Conjugation Drill Generator) should get answered
before building it.

## Open Questions

- Is a "partial cognate" third category worth the added conceptual
  complexity for a middle-school audience, or does the simpler true/false
  binary already established here communicate the pedagogically important
  distinction well enough?
- Should quiz mode be built here, or does it belong better as a mode
  within Vocab &amp; Conjugation Drill Generator (an existing tool already
  built around quiz-style vocabulary practice) given the underlying
  interaction (show a word, hide the answer, reveal) is nearly identical?
