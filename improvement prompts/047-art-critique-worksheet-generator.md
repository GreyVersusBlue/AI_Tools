# Improvement Prompts — 047 — Art Critique Worksheet Generator

**Tool file:** `Tools/047-art-critique-worksheet-generator.html`
**Support folder:** none yet — everything is inline in the one file.

**Current description (from README):** A four-step describe/analyze/interpret/judge critique worksheet with editable prompts and follow-up questions per step, printed as repeated half-sheets for a gallery walk or artwork critique.

---

## Status

**2026-08-10 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: the classic four-step DAIJ critique framework (Describe,
Analyze, Interpret, Judge), each step pre-filled with a main prompt and two
follow-up questions, all fully editable (edit any prompt/question text, add
or remove follow-up questions per step — the four top-level steps themselves
are fixed, matching the standard framework the backlog idea names). An
activity/gallery-walk name field and a copy count drive a print view that
repeats the worksheet as half-sheets (artwork title + reviewer name lines),
matching the print approach already used in this round's Peer Feedback /
Editing Checklist Generator. Single current worksheet autosaved to
`localStorage` (`acw_worksheet_v1`). Verified with a headless Chromium
smoke test (default 4 steps with 2 follow-ups each, add a follow-up, print
3 copies) — no console errors.

**2026-08-11 — Round 1 (session `8vo65u`).** Shipped two of the four Quick
Wins below. Multiple named saved worksheets: New/Duplicate/Delete buttons
plus a switcher dropdown, matching the Rubric Builder convention
(`RubricStore`-style list/data/current localStorage keys implemented inline
since this file has no support folder). The old single-save key
(`acw_worksheet_v1`) auto-migrates into a named save on first load after
the update, so no existing worksheet is lost. Also fixed the print layout
QA item: the half-sheet print CSS was `height: 47vh; overflow: hidden`,
which silently clipped a worksheet's later follow-up questions off the
printed page with no visual warning — changed to `min-height: 47vh` (no
`overflow: hidden`) so a half-sheet with many follow-ups grows instead of
getting cut off; normal page flow now carries overflow onto the next
printed page rather than losing content. Verified with a headless
Chromium smoke test: rename, create new, switch between, and duplicate a
worksheet (state carries over correctly each time), then print after
adding 5 extra follow-up questions to the first step to confirm the
half-sheet no longer clips — no console errors.

The self-reflection wording toggle (Quick Win 2) and duplicate-worksheet-
as-starting-point (now redundant, since "Duplicate" above covers exactly
this) were not built this round — self-reflection wording is still best
left to the tool's existing "every prompt is editable" design per the open
question below, unless a future round decides the toggle is worth the
added complexity anyway.

**2026-08-13 — Self-reflection mode toggle (shipped).** Built the
remaining Quick Win: a "Worksheet mode" select (Critiquing someone else's
work / Reflecting on my own work) next to the saved-worksheet switcher.
Each of the 4 DAIJ steps now has a parallel first-person default wording
(prompt + both follow-ups) for the self-reflection case — e.g. Describe's
"What do you see?" becomes "What did I make?", Judge's "What is one
suggestion you would give the artist?" becomes "What is one thing I would
change or improve next time?" — while the step labels themselves
(Describe/Analyze/Interpret/Judge) stay fixed, matching the framework name.
The step labels/order stay identical between modes; only prompt and
follow-up *text* changes.

Toggling mode rewords only text that still matches the previous mode's
default wording verbatim (per step, per follow-up, matched by exact text
rather than list position so reordered/partial edits aren't
misattributed) — anything a teacher has already customized away from the
default is left exactly as written, so the toggle can't silently clobber
edits. `mode` (`'other'` | `'self'`) is stored as a field on each named
worksheet's saved state, the same `acw_worksheet_data_v1:<name>`
localStorage record every other setting already uses — no new storage
key, and it round-trips through New/Duplicate/Delete/switch like
`activityName` or `copyCount` does. Worksheets saved before this change
have no `mode` field and default to `'other'`, so their existing
other-directed wording is unaffected. The printed half-sheet's "Artwork
title / Reviewer" line becomes "My artwork title / My name" in
self-reflection mode, and the untitled-worksheet print fallback becomes
"Self-Reflection Worksheet" instead of "Art Critique Worksheet"; the
print CSS itself (the `min-height: 47vh`, no-`overflow:hidden` half-sheet
rule fixed in Round 1) was not touched.

Verified with a headless Chromium smoke test (Playwright, via the
`board-check` harness): default mode is "other" with the original
wording; toggling to "self" rewords all 4 prompts and their follow-ups to
first person; the reworded mode and text persist across a reload; a
manually edited prompt survives a mode toggle unchanged; and the print
area's DOM reflects the self-reflection names line and wording with no
`Reviewer:` leftover from the other mode. No console errors at any step.

## What it does today

- 4 fixed critique steps (Describe/Analyze/Interpret/Judge), matching the
  standard art-education framework named in the backlog
- Editable main prompt and follow-up questions per step; add/remove
  follow-ups freely
- **Self-reflection mode toggle** — switches all 4 steps' default prompt
  and follow-up wording between other-directed ("What do you see?") and
  first-person self-reflection ("What did I make?"); custom edits are
  preserved through a toggle, and the printed half-sheet's names line and
  untitled fallback adapt to match
- **Multiple named saved worksheets** (New/Duplicate/Delete + switcher),
  legacy single-save data auto-migrates on first load; mode is saved
  per-worksheet alongside the other fields
- Print N copies as half-sheets with artwork title + reviewer (or "my
  name" in self-reflection mode) lines; half-sheets grow to fit content
  instead of clipping long ones

## Quick Wins

- ~~A short "artist self-reflection" variant toggle~~ — **shipped
  2026-08-13**, see Status above.

## Major Features

- **QR code integration with Gallery Walk QR Codes** — the backlog
  description explicitly calls this tool a pairing with that existing
  tool. A "print worksheet + matching QR sheet together" flow (or at least
  a direct link between the two tools) would deliver on that pairing
  instead of leaving it as a manual two-tool workflow.
- **JSON export/import**, for sharing a built critique worksheet between
  art teachers or across a department.
- **Digital fill-in mode** via a share link (this toolkit's P3 pattern),
  useful for a 1:1 classroom gallery walk where photographing artwork
  digitally makes more sense than a paper half-sheet per station.
- **A rubric-style scoring option** alongside the open-ended critique
  questions, for when a critique doubles as a graded assignment rather than
  a purely formative gallery-walk activity.

## Moonshot / North Star

**A critique worksheet that pairs naturally with a QR-coded gallery walk,
works equally well as self-reflection or peer critique, and is reusable
across every unit a year of art class covers.** Direct integration with
Gallery Walk QR Codes closes the loop the backlog explicitly asked for;
a self-reflection wording variant covers the "student artwork" case the
peer-critique wording doesn't; and multiple named saves make "the
sculpture-unit worksheet" and "the painting-unit worksheet" both
one click away, every year.

## Platform themes that matter here

- **P7 (cross-tool)** — the most direct cross-tool opportunity in this
  entire batch: the backlog description names Gallery Walk QR Codes as a
  pairing, and no integration exists yet.
- **P6 (print quality)** — **fixed here in Round 1** (min-height instead of
  a hard clip). Peer Feedback / Editing Checklist Generator still has the
  same `height: 47vh; overflow: hidden` pattern and would benefit from the
  identical fix — worth a future round doing the same one-line change there.
- **P3 (share links)** — a digital fill-in mode, later.

## Open Questions

- Should the Gallery Walk QR Codes integration be "generate both from one
  screen" (a bigger combined-tool build) or simply "a link/button on each
  tool pointing at the other, plus matching station-numbering conventions"
  (much smaller, still delivers most of the value)?
- ~~Is a self-reflection wording variant worth a toggle...~~ — resolved
  2026-08-13: built as a toggle, since it turned out cheap (parallel
  default-text tables + a match-and-swap that leaves customized text
  alone) and a toggle for the common case is friendlier than asking every
  teacher to hand-edit all 4 prompts and 8 follow-ups themselves.

## Where the next round should pick up

The remaining open item is the Gallery Walk QR Codes integration named
under Major Features — that pairing is still the single highest-value
item outstanding for this tool per the backlog's own framing. A future
round could start there: either a simple cross-link between the two
tools with matching station-numbering, or scope out the bigger combined-
screen build per the first Open Question above.
