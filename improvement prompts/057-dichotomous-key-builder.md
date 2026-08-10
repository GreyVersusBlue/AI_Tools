# Improvement Prompts — 057 — Dichotomous Key Builder

**Tool file:** `Tools/057-dichotomous-key-builder.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** Numbered couplets branching to another step or a final answer, with example specimens tagged per result, printed as a shuffled classification worksheet plus a matching answer key.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog — closes out the Science section for now. Standard
numbered-couplet dichotomous key format: each step has two lettered
choices (a/b), and each choice either leads to another step (picked from a
dropdown of existing steps, so the couplet numbering stays consistent
automatically) or ends in a final result with an optional comma-separated
list of example specimens. The clever part that makes this tool actually
useful as a classroom exercise, not just a key-authoring form: any example
specimens tagged under final results get collected, shuffled, and turned
into a two-page print output — a worksheet (specimen names, blank
classification column, printed alongside the full key) and a matching
answer key (same specimens, correct classification filled in) — without
the teacher needing to separately track which specimen belongs under which
result. Autosaves to `localStorage` (`dkb_key_v1`), seeded with a working
2-step example (backbone/no backbone &rarr; fur/no fur) rather than a
single disconnected step. Verified with a headless Chromium smoke test
(default 2-step key loads with a valid step-to-step link, add a step,
print, confirm couplet numbering, results, and the specimen answer table
all render correctly) — no console errors.

Nothing below has been started.

## What it does today

- Numbered couplets, each choice either leads to another step or ends in
  a final result
- Example specimens tagged per result, auto-collected into a
  worksheet + answer-key specimen table
- Print: full key + shuffled specimen classification exercise

## Quick Wins

- **Reorder steps** via up/down (currently step order is fixed by
  insertion order, and since couplet numbers are derived from array
  position, reordering already works internally — this is purely a
  missing UI affordance, not a data-model change).
- **Validation/warnings**: flag a step where a choice's "leads to" points
  to a step that no other choice ever reaches (an orphaned/unreachable
  step), or a final result with no example specimens (fine for the key
  itself, but means it won't appear in the worksheet exercise) — both are
  easy-to-make authoring mistakes with no current feedback.
- **A "preview classification path" tool**: type a made-up specimen's
  traits and watch it highlight which couplets it would satisfy, as a
  build-time sanity check before handing the key to students.
- **Print-without-specimens option**, for when a teacher wants just the
  reference key (e.g. to demonstrate what a dichotomous key *is*) without
  the classification exercise.

## Major Features

- **Multiple named saved keys** (e.g. "Animal Kingdom," "Leaf
  Classification"), matching the multi-save convention used by most
  builder tools in this round — right now one key per browser.
- **A visual branching-tree view** as an alternative to the numbered-
  couplet list, for a teacher who wants to see (or show students) the
  key's shape at a glance rather than reading through numbered text.
- **Import a key from a pasted outline** (a simple indented-text or
  tab-separated format), for a teacher porting an existing paper key into
  this tool instead of rebuilding it couplet by couplet.
- **JSON export/import**, for sharing a completed key with another
  science teacher or across sections.

## Moonshot / North Star

**A dichotomous key builder that catches authoring mistakes before they
reach students, offers both the classic numbered-couplet text and a visual
tree view of the same key, and turns any key into a ready classification
exercise the moment example specimens are tagged.** Validation warnings
prevent the most common authoring error (an unreachable step, or a result
with no test specimens); the tree view makes the key's logic visible at a
glance for both teacher and student; and the worksheet/answer-key
generation already shipped is the foundation for making every key
immediately classroom-usable, not just a reference document.

## Platform themes that matter here

- **P7 (cross-tool)** — pairs conceptually with Blank Map Generator's
  general "build a custom reference tool from teacher-supplied content"
  pattern, though the underlying data structures differ enough that
  sharing code isn't obvious.
- **P6 (print quality)** — the print-without-specimens option and a
  visual tree-view print layout are both pure print-format additions.
- **P15 (first run)** — the seeded 2-step working example (already
  shipped) is the main first-run aid; validation warnings would extend
  that help through the whole authoring process, not just the starting
  point.

## Open Questions

- Is a visual tree view worth the layout complexity (computing branch
  positions, connecting lines) given the numbered-couplet format is both
  the traditional standard for real dichotomous keys and already fully
  functional here?
- Should validation warnings block printing (hard stop until fixed) or
  just flag issues non-blockingly (a warning banner, but printing still
  works)? A hard stop is safer against handing students a broken key; a
  soft warning respects that a teacher might legitimately want to print a
  work-in-progress key for their own reference.
