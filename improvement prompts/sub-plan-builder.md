# Improvement Prompts — Sub Plan Builder

**Tool file:** `Tools/Sub Plan Builder.html`
**Support folder:** none — single file (loads JSZip from cdnjs)

**Current description (from README):** Fill in the boilerplate once (schedule, emergency info, phone numbers), then add today's lesson and export a ready-to-print sub plan as a Word doc.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- **Standing details** saved once (`subPlanBuilder.standingDetails.v1`) and
  reused: schedule, emergency info, phone numbers, per-period blocks
- Today's plan, per-period blocks, student notes & concerns
- **Generates a real .docx from scratch** — hand-built OOXML (document,
  styles, numbering, content types, rels, core/app props) zipped with JSZip.
  This is the most technically impressive export on the site.
- Plain-text "quick copy" mode with clipboard copy and **Read aloud**
  (`speechSynthesis`)
- Print / Save as PDF
- Plan **history** (`subPlanBuilder.history.v1`) with load/delete
- Import/export standing details as JSON
- Behavior-plan variants: Short version / Full version with referral track /
  Custom

## Quick Wins

- **Vendor JSZip locally** (P5). This tool is broken on a first offline or
  blocked-network load, and a sub plan is precisely the thing you write at
  6:40am from home when you've woken up sick.
- **Emergency info as a locked, always-included block** — fire route, lockdown
  procedure, medical alerts — visually separated so a sub can find it in two
  seconds, and always printed even when the lesson section is short.
- **"I'm out tomorrow" one-click flow.** Pick a date, pull that day's
  schedule, and produce the plan; the current flow assumes today.
- **Multi-day absence.** Three days out means three plans; today it means
  filling the form three times.
- **Seating chart and roster references by name**, so the sub plan says
  "seating chart attached" and the Sub Binder actually attaches it (P7).
- **Print-first parity.** The .docx and the printed PDF should be the same
  document; today they're two rendering paths that can drift.
- **A "what a sub actually needs" checklist** at the top — bell times, where
  the keys are, who to ask, what to do if the tech doesn't work — prefilled
  from standing details and hard to accidentally omit.

## Major Features

- **Templates by day type.** A lesson-day plan, a testing-day plan, a
  video-day plan, an emergency no-notice plan. The emergency one is the
  killer feature: a permanently-maintained generic plan that works for any
  day of the year, printed and left in a drawer.
- **Pull the lesson from elsewhere** (P7). If the School Calendar Visualizer
  knows what unit you're in and the Exit Ticket / Number Talks banks have
  routines, the plan can be 70% drafted before you type anything.
- **Sub feedback loop.** Generate the plan *and* a one-page feedback slip the
  sub fills in — already on `IDEAS_BACKLOG.md` as its own tool, but it belongs
  in the same document.
- **Richer .docx.** The OOXML builder is already substantial; extending it to
  tables (per-period grids), headers/footers with page numbers, and an
  embedded seating-chart image would make the output look like something the
  front office produced.
- **Shareable link / QR of the plan** (P3) so a plan can reach a colleague or
  the office without email.
- **Standing-details versioning** (P8) so a mid-year room change doesn't
  silently invalidate a plan generated in September.

## Moonshot / North Star

**The absence packet, done in ninety seconds while sick.** One screen: pick
the dates, confirm what's already known (schedule, emergency info, seating
charts, class lists, standing routines), type or pick the lesson, and get a
complete printable packet plus a .docx plus a link — with the seating chart,
class rosters, hall pass procedure, and behavior plan already inside, and a
feedback slip on the back. The Sub Binder Generator is the beginning of this;
this tool should be its front door.

## Platform themes that matter here

- **P5 (offline integrity)** — the cdnjs JSZip dependency is a real bug here
  more than anywhere else on the site, given when this tool gets used.
- **P7 (cross-tool bundles)** — this tool and `sub-binder-generator.html` are
  two halves of one workflow and should be designed together.
- **P6 (print quality)** — the printed page is handed to a stranger; it has
  the highest legibility bar on the site.
- **P14 (year lifecycle)** — standing details are annual and should roll over.

## Open Questions

- Should Sub Binder Generator be absorbed into this tool, or should this tool
  become the editor and Sub Binder stay the assembler?
- Is .docx still the right primary output, or has PDF overtaken it for how
  these actually get delivered to the office?
