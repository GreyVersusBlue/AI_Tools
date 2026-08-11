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

**2026-08-11 — Round 2 (session `qer21r`).** Three Quick Wins shipped:

- **Reorder steps via up/down buttons** — confirmed the prediction in
  this file: since `leadsTo` references step ids (not array indices),
  reordering was a pure array-swap UI addition with zero data-model
  changes, exactly as flagged.
- **Validation/warnings** — a new banner (hidden when clean) flags, on
  every render: a step nothing else in the key leads to (unreachable,
  other than the implicit step 1 entry point), a final choice with a
  result but no example specimens (won't appear in the classification
  worksheet), and a dead-end choice with neither a "leads to" step nor a
  result. Chose the **non-blocking** option from this file's own Open
  Question — the banner warns but never prevents printing, since a
  teacher may legitimately want to print a work-in-progress key.
- **Print-without-specimens option** — a checkbox (default checked) on
  the main page controls whether Print includes the classification
  worksheet + answer key pages or just the reference-key page alone.

All three verified with a headless Chromium smoke test (default seeded
key shows no warnings; adding an unattached third step triggers the
warning banner; reordering doesn't crash) plus a separate print-path
check confirming the specimen table is present with the checkbox on and
absent with it off — zero console errors in either pass.

**Not started this round:** multiple named saved keys, a visual
branching-tree view, import from a pasted outline, JSON export/import,
and the "preview classification path" build-time sanity checker. See
Major Features/Moonshot below — multiple named saved keys is the natural
next pickup, matching the multi-save convention flagged across sibling
builder tools this round.

## What it does today

- Numbered couplets, each choice either leads to another step or ends in
  a final result
- Example specimens tagged per result, auto-collected into a
  worksheet + answer-key specimen table
- Print: full key + shuffled specimen classification exercise

## Quick Wins

- ~~**Reorder steps** via up/down~~ — **done, Round 2.**
- ~~**Validation/warnings**~~ — **done, Round 2** (non-blocking banner;
  covers unreachable steps, no-specimen final results, and dead-end
  choices).
- **A "preview classification path" tool**: type a made-up specimen's
  traits and watch it highlight which couplets it would satisfy, as a
  build-time sanity check before handing the key to students.
- ~~**Print-without-specimens option**~~ — **done, Round 2.**

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
