# Improvement Prompts — 003 — Rubric Builder

**Tool file:** `Tools/003-rubric-builder.html`
**Support folder:** `Tools/rubric-builder/` — `rb-store.js`, `rb-templates.js`

**Current description (from README):** Build a grading rubric from a template or from scratch — editable criteria and performance levels, live point totals, print a clean landscape table. Saves multiple named rubrics.

---

## Status

### Pass 2 — Round 1 — 2026-08-10 — session `yjj7k6`

Picked up the one "next round should pick up" item from Round 1: *"Half-credit
and per-criterion comments in the class-wide grid"* were flagged as
single-student-mode-only.

Investigating found **half-credit was actually already there** — the class
grid's per-cell `<select>` (`levelSelectOptions`) has always included a
combined "Level + ½ (N pts)" option alongside each plain level, so a teacher
could already award half credit from the grid; the Round 1 status note
undersold what existed, similar to the weighted-criteria finding from that
same round. Left it as-is rather than adding a second, redundant half-credit
control next to it.

**Per-criterion comments in the grid were genuinely missing** and are now
shipped: each grid cell gets a small 💬 button next to its level select.
Clicking it prompts for a comment (pre-filled with the existing one, if any);
the button turns gold and its tooltip shows the comment text once one is
set. It writes to the same `selections[critId].comment` field the
single-student Score mode already uses — `normalizeSelectionValue`,
`earnedPoints`, and the printed scored-rubric sheet (`scoreTableHtml`, which
already renders a `comment-row` under any criterion with a comment) all pick
it up with no further changes, since the shape was already there. Verified
with a headless-browser pass: created a rubric, added a criterion, added a
student to the class grid, set a comment via the button, and confirmed it
persisted and the button reflected the active state, with no console errors.

Everything else on this tool's backlog — feeding the grade tools (P7),
peer-review mode, and standards alignment/tagging — is still open, unchanged
from Round 1.

### Round 1 (Pass 1) — 2026-08-10 — implementation round. Implemented every Quick Win, plus the
student-readable print, single-point/checklist alternate formats, and rubric
analytics from Major Features. See below for what's marked **Done**.

Real findings from this pass:

- **Weighted criteria already existed** (a `weight` multiplier per criterion,
  shipped in an earlier session, 2026-08-08) — the backlog line asking for
  "percentage weights instead of raw point sums" undersold what was there.
  Mathematically a multiplier-based weight already produces exact percentage
  shares (`maxPts × weight ÷ totalPossiblePoints`, and those shares always
  sum to 100% automatically — verified in a standalone Node trace). The gap
  was legibility, not math: a teacher entering `2` had no way to see that
  meant "40% of the grade" without doing the division themselves. Fixed by
  adding a live `(NN% of grade)` label next to each weight input rather than
  redesigning the input model — lower risk, same saved-data shape, and it
  reads as the "percentage weight" the backlog asked for.
- **Half credit** is modeled as "toward the next-highest-point level, by
  point value" rather than "toward the next column", so it stays correct
  after a teacher reorders level columns with the arrow buttons — the
  neighbor is found by comparing point values, not array position.
- **Selections went from `{critId: levelId}` to `{critId: {levelId, half,
  comment}}`.** Backward compatibility is handled by
  `normalizeSelectionValue()`, which treats a bare string as the old shape on
  read; old saved scores, JSON imports, and shared links all still load and
  compute the same total they always did. Verified with a Node-side replay
  of `earnedPoints()` against a mixed old-string/new-object selection map.
- **Class-wide scoring** reuses the existing per-student score records
  (`gvb-rubric-builder:scores:*`) — a "class" is just every student who has a
  score record for this rubric, shown as a grid instead of one at a time.
  No new storage key was needed. Half credit and per-criterion comments are
  still only editable in single-student "Score a student" mode; the grid
  trades that granularity for the ability to grade 28 students in one pass.
  A future round could add a compact half/comment affordance to the grid
  itself if that trade-off turns out to matter in practice.
- **Rubric analytics** rides directly on the class-scoring data with no new
  storage — it's a live aggregation (`classAnalytics()`), not a saved report.
- **Single-point / checklist formats** are print/preview-only variations that
  reuse the existing levels+criteria model (pick one level's cell text as
  the "meets expectations" description); they do not add a parallel data
  model or change how Score mode works. Standard, student-friendly,
  single-point, and checklist all share one `currentPreviewHtml()` dispatcher
  so the "live preview is exactly what prints" contract still holds for all
  four formats, and the P6 fix (`break-inside: avoid` on table rows) applies
  to all of them.

**Skipped, and why** (all explicitly out of scope for this round):
- **Peer review mode** as its own flow — the student-friendly print with a
  self-assessment column substantially covers the same use case, per the
  brief.
- **Feeding scores into `036-final_grade_checker.html` /
  `037-grade-distribution-visualizer.html`** — cross-tool integration (P7),
  deferred; the CSV export is the interim bridge (import CSV into either
  tool by hand, or into a spreadsheet as a middle step).
- **Standards alignment/tagging** — a larger schema decision left to Devon;
  see Open Questions below rather than a partial implementation.
- **Moonshot section** — untouched, as instructed.

**Where a future round should pick up:**
- ~~Half-credit and per-criterion comments in the class-wide grid~~ — **done
  Pass 2 Round 1**; see the note at the top of Status.
- Standards alignment/tagging, if Devon decides points-based isn't the only
  model this district needs (see Open Questions).
- P7 cross-tool handoff: a documented format so rubric CSV scores could flow
  into the grade tools without hand re-entry.
- The single-point/checklist formats don't yet have their own dedicated
  Score-mode UI (they're print-only); if single-point scoring in-app (rather
  than paper) turns out to be wanted, that's a real follow-up, not something
  this round quietly half-did.

## What it does today

- Build from a template (`rb-templates.js`) or from scratch; add/remove/reorder
  criteria and performance levels; live total points
  (`totalPossiblePoints`, `maxLevelPoints`)
- **Weighted criteria** — a per-criterion point multiplier with a live
  "% of grade" readout, so teachers can reason in percentage terms directly.
- Multiple saved rubrics (`gvb-rubric-builder:list` / `:data:*`), JSON
  import/export
- **Scoring mode** — pick a student, score them against the rubric, see earned
  points live (`renderScoreMode`, `earnedPoints`, `renderScoreTotals`), saved
  per student (`gvb-rubric-builder:scores:*`); **half-point/partial credit**
  toward the next level up; **a comment box per criterion plus an overall
  comment**, with a **clickable comment bank** per criterion to avoid retyping
  the same six comments thirty times
- **Class-wide scoring grid** — every student scored against every criterion
  from one screen (`renderClassMode`), fed by a **loaded roster** from
  `np_rosters` (Name Picker / Class Roster Hub) or typed in one at a time
- **Rubric analytics** — class average per criterion, lowest first, as the
  reteaching signal (`classAnalytics`, `renderAnalytics`)
- **Export all scores as CSV** for the gradebook
- **Five print/preview formats**, chosen from one dropdown that drives both
  the live preview and the print output (`currentPreviewHtml`): the standard
  grid, a **student-friendly version with an "I can…" per-level option and a
  self-assessment column**, a **single-point rubric** (target-level
  description with blank "concerns"/"advanced" margins), a **checklist**, and a
  **peer feedback form** (`peerReviewTableHtml`) — criteria plus two ruled
  lines each, no points anywhere, printed portrait
- Print the blank rubric (in any of the five formats above) or **this
  student's scored rubric**; print rows never split across a page break
- Shareable by `state-link.js` URL; student name autocomplete
  (`populateStudentDatalist`), now merged with a loaded roster

## Quick Wins

- **Done —** **Load a roster** (P2). Scoring mode has a student datalist but no access to
  `np_rosters`, so the class list is typed in again. Score mode now loads a
  roster into the autocomplete datalist; the class-wide grid loads a whole
  roster as rows at once.
- **Done —** **Comment box per criterion and an overall comment** on the scored rubric.
  The comment is what the student reads; the numbers are what the gradebook
  reads.
- **Done —** **Class-wide scoring view** — a grid of students × criteria you can fill in
  from one screen, rather than one student at a time. This is the difference
  between grading a set of 28 in an hour and in three. (Half credit and
  per-criterion comments are still single-student-mode only — see Status.)
- **Done —** **Comment bank.** The same six comments get written thirty times; a
  clickable bank per criterion would save real hours.
- **Done —** **Half points / partial credit** between levels — toward the next
  higher-point level, robust to level-column reordering.
- **Done —** **Weighted criteria** (writing 40%, mechanics 10%) rather than raw point
  sums. (The underlying weight mechanism already existed; this pass added the
  live "% of grade" readout that makes it legible as percentage weighting —
  see Status for why.)
- **Done —** **Export scores as CSV** for the gradebook — currently the scores are
  trapped in this tool.

## Major Features

- **Done —** **A student-readable printed rubric.** A print version in student-friendly
  language, ideally with an "I can" phrasing per level, plus a self-assessment
  column students fill in on paper before submitting. Self-assessment against the rubric
  is one of the highest-effect-size practices there is and needs exactly this
  artifact.
- **Peer review mode.** The same rubric, reduced, as a peer feedback form —
  which `IDEAS_BACKLOG.md` lists as a separate tool and which is a print mode
  here. **Skipped this round** — the student-friendly print with a
  self-assessment column substantially covers this use case per the brief.
- **Feed the grade tools** (P7). Rubric scores should flow into
  `036-final_grade_checker.html` and `037-grade-distribution-visualizer.html` instead
  of being retyped. **Skipped this round** (cross-tool integration, deferred);
  CSV export is the interim bridge.
- **Done —** **Rubric analytics.** Across a class, which criterion did students score
  lowest on? That's the reteaching signal, computable from data already
  stored.
- **Done —** **Single-point rubrics and checklists** as alternative formats — a
  single-point rubric (one column of criteria, blanks either side for
  "concerns" and "advanced") is increasingly the preferred format and is a
  small variation of the existing structure.
- **Standards alignment.** Tag criteria to standards, and report by standard
  rather than by assignment — the shape standards-based grading needs.
  **Skipped this round** — a larger schema decision; recorded as an Open
  Question rather than a partial implementation.

## Moonshot / North Star

**One rubric, the whole assessment cycle.** Build it once; students see it in
their own language and self-assess against it; peers use a reduced version to
give feedback; the teacher grades a class of 28 from one grid with a comment
bank; each student gets a printed scored rubric with real comments; the class
data shows which criterion to reteach; and the scores flow into the gradebook
tools without being typed twice.

## Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see `_platform-themes.md`). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Rubric delivered to students by link** (rather than printed), and
  on-screen student self-assessment. The printed student-readable rubric with
  a self-assessment column covers the same practice on paper.

## Platform themes that matter here

- **P2 (shared roster)** — **Addressed 2026-08-10.** Scoring mode and the
  class-wide grid both load from `np_rosters` now.
- **P7 (cross-tool)** — scores should feed the grade tools; the peer-review
  backlog item belongs here. Still open — CSV export (done this round) is an
  interim bridge, not the real handoff.
- **P3 (share links)** — already adopts `state-link.js`; the natural use is
  sharing a rubric with a co-teacher or a department.
- **P6 (print quality)** — **Addressed 2026-08-10.** Table rows now carry
  `break-inside: avoid` so a criterion row never splits across a page break,
  across all five print formats. The peer form additionally overrides `@page`
  to portrait for its own print only (`setPrintOrientation`), since it is a
  handout rather than a wide grid.

## Open Questions

- Where should scored student data live — here, or in a shared assessment
  store that the grade tools also read? Keeping it here is simpler; sharing it
  is what makes the handoff work. **Still open** — this round kept scores
  local and added CSV export as a manual bridge rather than deciding this;
  a real P7 handoff still needs Devon's call on the shared store's shape.
- Is standards-based reporting something this district needs, or is
  points-based the only realistic model? **Still open** — standards
  alignment/tagging was explicitly skipped this round rather than
  half-implemented; needs a decision before any schema work starts.

## Peer-feedback round — 2026-08-11 (backlog rank 1)

Shipped the **peer feedback print format** — a fifth entry in the existing
print-format dropdown, so it drives the live preview and the print output
through the same `currentPreviewHtml()` switch as the other four.

The format is the rubric with the scoring taken out, and that is the design
argument: a student reviewing a partner's draft cannot award 4/4 for
"organization" in any way that means something, and asking them to try teaches
them to grade instead of to read. So the sheet carries the criteria, the
wording of whichever level the teacher picked as the target (so the reviewer
knows what to look for), and two ruled lines per criterion — *Works well* and
*One thing to try* — plus one overall comment box. No point column, no level
columns, no totals. The suite's central assertion is that negative one, checked
against a template whose levels carry real point values.

Two smaller decisions:

- The **target-level picker** (previously single-point only) now serves this
  format too, relabelled "Level whose wording tells the reviewer what to look
  for". Reusing it beat adding a second selector that means the same thing.
- **It prints portrait.** Every other format is a wide grid and the tool's
  `@page` is landscape; a peer feedback form is a handout. `setPrintOrientation()`
  injects a portrait `@page` into `#printPageStyle` just for this print and
  clears it on `afterprint`, so nothing else changed.
- The name line is *Writer / Reviewer / Date*, not the usual *Name / Date* —
  peer review is the one format where two names matter.

New suite `Tools/rubric-builder/test/smoke-peer-form.mjs` (29 checks) as
`npm run test:rubric`.

### Where the next round should pick up

- The peer form is blank-only. Scoring a peer review is deliberately not a
  thing, but **printing one per student from a loaded roster**, with the
  writer's name already filled in, would be a small addition and matches what
  Exit Ticket's class-set toggle already does.
- The teacher's own rubric title prints on the peer sheet as-is. A separate
  "title for student-facing prints" would avoid "4-Point Standard" appearing on
  a form that has no points on it — noticed while writing the suite, and left
  alone rather than rewriting a teacher's words behind their back.
