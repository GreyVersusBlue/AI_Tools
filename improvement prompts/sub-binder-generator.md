# Improvement Prompts — Sub Binder / Day Bundle Generator

**Tool file:** `Tools/sub-binder-generator.html`
**Support folder:** none — single file

**Current description (from README):** Pulls Sub Plan Builder's standing details and the current Seating Chart into one printable packet, plus today's lesson.

---

## Status

Reviewed — structural read of the source. This is the site's proof of concept
for cross-tool composition and, at 452 lines, its most leveraged small tool.
Ideas below are deliberately ambitious and **not** scoped to a single session.

## What it does today

- Reads three other tools' storage directly:
  `subPlanBuilder.standingDetails.v1` (standing details),
  `seating-chart-v1` (seating chart, with per-section selection),
  `scv_calendar_v1` (today's calendar entry)
- Adds a "today's lesson" field of its own
  (`gvb-sub-binder:today-lesson`)
- Renders standing details, today's calendar entry, and the seating chart as
  cards, then prints them as one bundle
- Refresh data button to re-pull from the source tools

## Quick Wins

- **Include far more.** The packet should be able to pull: the class roster,
  the hall pass procedure and destinations, the behavior plan, the bell
  schedule, today's exit ticket or bell ringer, the lab safety status if it's
  a lab day, and the emergency information. Most of those already exist in
  `localStorage` keys this tool could read today (P7).
- **A cover page** — teacher name, room, date, periods, and "in an emergency,
  do this" — which is the page a sub reads first.
- **Choose what's included.** A checklist of available sections with sizes, so
  the packet is 4 pages when that's right and 12 when it isn't.
- **Date selection.** Everything is "today"; being out on Thursday means
  generating the packet on Thursday morning, which is precisely when you
  can't.
- **Multi-day bundles**, printed with a divider per day.
- **Tell the teacher what's missing.** "No seating chart saved for 3rd period"
  is more useful than silently omitting it.
- **Page breaks between sections** (P6) so a seating chart never splits.

## Major Features

- **Become the toolkit's general packet assembler** (P7). The sub binder is
  one instance of a broader idea: pick a date and a set of tools, and print
  everything relevant. The same engine could produce a unit packet, an
  open-house packet, a new-student welcome packet, or a field trip packet.
- **A documented handoff interface** (P8). Right now this tool reads other
  tools' raw storage keys, which is fast and brittle — any schema change
  elsewhere breaks this silently. A small shared read API ("give me your
  printable summary for date X") would let tools opt in properly and would
  make new bundles cheap.
- **Emergency sub plan.** A permanently-maintained generic packet that works
  on any day, printed once and left in a drawer — the single most valuable
  version of this tool, and mostly a template plus a reminder to refresh it.
- **Feedback slip.** Print a page the sub fills in before leaving
  (`IDEAS_BACKLOG.md` lists this as its own tool; it belongs on the back of
  this packet).
- **Digital handoff.** A link or QR (P3) so the sub can open the packet on
  their phone, rather than needing a printout that requires you to be at
  school to produce.
- **Merge with Sub Plan Builder** or split the responsibilities cleanly — one
  tool authors the lesson, the other assembles the packet, and right now the
  boundary is blurry.

## Moonshot / North Star

**One button, at 6:40am, sick.** Pick the dates. The toolkit assembles
everything it already knows — standing details, bell schedule, rosters,
seating charts by period, hall pass procedure, behavior plan, emergency
information, today's calendar, the lesson, and a feedback slip — into an
ordered, cover-paged, page-numbered packet, printed or sent as a link, with a
clear list of anything it couldn't find.

## Platform themes that matter here

- **P7 (cross-tool bundles)** — this tool is the theme's reference
  implementation and its natural home.
- **P8 (versioning/handoff)** — direct key reads are the fragility to fix.
- **P6 (print quality)** — a multi-source packet is the hardest print job on
  the site.
- **P15 (first run)** — should tell you what it can and can't find rather
  than silently producing a thin packet.

## Open Questions

- Should the packet assembler be generalized into its own thing, with "sub
  binder" as one preset? That's the larger of the two possible futures here.
- Is defining a shared "printable summary" interface across tools worth doing
  before adding more sources? It's the difference between this tool scaling
  and this tool accumulating brittle special cases.
