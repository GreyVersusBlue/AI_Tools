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

**2026-08-11 — Pass 2, directed round (session `szyio3`).** Shipped two
Quick Wins: **multiple named saved worksheets** (a worksheet selector with
New/Duplicate/Rename/Delete, matching the multi-save convention used
elsewhere in this toolkit — old single-worksheet saves under `acw_worksheet_v1`
migrate automatically into the first entry of the new `acw_worksheets_v1`
store on first load), and the **print layout QA fix** flagged in this file's
own Quick Wins list: the half-sheet print block no longer hard-caps at
`height: 47vh; overflow: hidden`, which was silently truncating a worksheet
with many follow-up questions. It's now `min-height: 47vh` with normal
overflow, so a busy worksheet grows the block instead of clipping content —
the tradeoff is that a very full worksheet can now push its pair onto a
third page rather than being force-fit onto two, which is the correct
tradeoff (visible content beats silent cutoff). Verified with `node --check`
on both inline scripts and a headless Chromium pass: create/duplicate/
rename/delete a worksheet, add a follow-up question, print 3 copies — no
console errors.

Nothing else below has been started.

## What it does today

- 4 fixed critique steps (Describe/Analyze/Interpret/Judge), matching the
  standard art-education framework named in the backlog
- Editable main prompt and follow-up questions per step; add/remove
  follow-ups freely
- Print N copies as half-sheets with artwork title + reviewer name lines

## Quick Wins

- ~~Multiple named saved worksheets~~ — **shipped 2026-08-11.**
- **A short "artist self-reflection" variant toggle** — the same DAIJ steps
  but worded for the artist critiquing their own finished piece, instead of
  only a peer/viewer voice — useful for the "student artwork" half of the
  backlog description, distinct from the "gallery walk" half.
- ~~Print layout QA~~ — **shipped 2026-08-11** (this tool only; Peer
  Feedback / Editing Checklist Generator's copy of the same `47vh` cap is
  untouched — still worth fixing there too).
- ~~A "duplicate as starting point" option~~ — **shipped 2026-08-11** as
  part of the multi-worksheet save UI (Duplicate button).

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
- **P6 (print quality)** — shares the exact half-sheet height-cap risk
  already flagged in Peer Feedback / Editing Checklist Generator's
  improvement prompt; worth fixing as one shared pattern rather than twice.
- **P3 (share links)** — a digital fill-in mode, later.

**Where the next round should pick up:** the self-reflection wording
toggle (the only Quick Win left) is the cheapest next step; after that this
tool's real ceiling is the Gallery Walk QR Codes integration under Major
Features, which is this batch's single most direct P7 opportunity.

## Open Questions

- Should the Gallery Walk QR Codes integration be "generate both from one
  screen" (a bigger combined-tool build) or simply "a link/button on each
  tool pointing at the other, plus matching station-numbering conventions"
  (much smaller, still delivers most of the value)?
- Is a self-reflection wording variant worth a toggle that rewrites all 4
  prompts, or should it just be left to manual editing since the tool
  already makes every prompt editable?
