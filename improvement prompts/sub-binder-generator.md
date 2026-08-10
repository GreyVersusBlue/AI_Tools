# Improvement Prompts — 045 — Sub Binder / Day Bundle Generator

**Tool file:** `Tools/sub-binder-generator.html`
**Support folder:** none — single file

**Current description (from README):** Pulls Sub Plan Builder's standing details and the current Seating Chart into one printable packet, plus today's lesson.

---

## Status

**2026-08-10 — Quick Wins mostly shipped, designed together with
`Sub Plan Builder.html` per P7.** Storage stayed additive throughout: this
tool still reads `subPlanBuilder.standingDetails.v1` and `seating-chart-v1`
exactly as before (verified against an old-shape standing-details record with
none of the new fields — no throw, every new field just renders as "not set"
or is omitted), and every newly-read key (`hall-pass-log-sections`,
`behavior-points-tracker-sections`, `gvb-exit-ticket:customPrompts`,
`subPlanBuilder.history.v1`, `subPlanBuilder.lastAbsence.v1`) is read
defensively (try/catch, shape-checked) and never written back to another
tool's storage.

**The date handoff, exactly:** there is no single "current absence date"
record shared platform-wide. Instead, Sub Plan Builder writes whichever
date(s) it's currently showing to `subPlanBuilder.lastAbsence.v1`
(`{dates: [...], updatedAt}`) every time the date or day-count changes there.
This tool reads that once on load to default its own date picker — to the
*first* date of that absence, with the rest offered as one-click quick-pick
buttons — and otherwise falls back to today. From there the two tools are
linked only by matching dates: this tool looks up `subPlanBuilder.history.v1`
for an entry whose `date` matches whatever's selected here, and uses that
entry's lesson/schedule/period notes if found. Nothing is fetched live from
the other tool's DOM or any shared object — it's two plain localStorage reads
plus a date match, not a documented interface (P8 is still open; see below).

**New sources, read-only:** hall pass procedure and destinations (from
`hall-pass-log-sections`, including the one-out-at-a-time and weekly-budget
rules if set), a behavior-plan snapshot (the point-value chip list from
`behavior-points-tracker-sections` — deliberately just the rules, not any
student's actual point totals, to avoid handing a sub a list of "problem"
students), and an exit-ticket/bell-ringer bank (`gvb-exit-ticket:
customPrompts`). The exit-ticket source came with a real finding: Exit Ticket
Generator only persists the teacher's saved custom bank and display
preferences — the prompt actually *shown* on a given day lives in an
in-memory variable that resets on every reload, so there is no "today's exit
ticket" to read. The card says so plainly and offers the saved bank instead
of pretending to know what ran today.

**Cover page, section checklist, and "what's missing":** a new cover-page
card/print-page shows teacher, room (new field, from Sub Plan Builder), date,
periods, and a one-line "in an emergency, do this" (lockdown text, falling
back to fire-route text, falling back to a generic office-call instruction).
A new checklist lists all eight non-cover sections with a live status string
per source — every source this tool reads, old and new, now says what it
found or exactly why it didn't (down to "No seating chart saved for period
3" when a configured period has no matching seating section, which was the
literal example in this file's own Quick Wins). Unavailable sections show a
disabled, unchecked box rather than silently vanishing; only checked +
available sections print, in a fixed order (cover, emergency, standing,
today, lesson, seating, hall pass, behavior, exit ticket), with the existing
per-section-page-break print CSS untouched. Checklist preferences persist in
a new `gvb-sub-binder:included-sections.v1` key.

Validated with a scripted jsdom pass covering: date defaulting from Sub Plan
Builder's handoff key, quick-pick date switching (including per-period lesson
notes for a specific date), the seating "missing period" heuristic, every new
source's available/unavailable messaging, checklist checkbox
enabled/disabled state, print-page count and ordering when a source is
unavailable, and full backward compatibility against an old-shape
standing-details record with no data for any of the new sources.

Not done this round: multi-day bundles (the companion tool now supports
multiple days out; this tool still assembles one date at a time — see Quick
Wins); roster, bell schedule, and lab-safety sections mentioned in the
original "include far more" bullet weren't added (roster is partially covered
via seating, bell schedule via the periods table already in Standing
Details; lab safety was skipped outright — no lab-safety tool key was in
scope for this round); the documented cross-tool "printable summary"
interface (P8) — this round added *more* direct key reads (six tools now,
up from three) rather than building that interface first, which is an
explicit scope tradeoff, not an oversight (see Open Questions).

## What it does today

- **Date picker** for "which day is this packet for," defaulting to whatever
  Sub Plan Builder last had selected (`subPlanBuilder.lastAbsence.v1`),
  otherwise today; quick-pick buttons when that absence spans multiple days
- Reads **six** other tools' storage directly, all read-only:
  `subPlanBuilder.standingDetails.v1` (standing details, emergency info, room
  number, checklist fields), `subPlanBuilder.history.v1` (the saved lesson for
  the selected date), `seating-chart-v1` (seating chart, with per-section
  selection), `scv_calendar_v1` (the calendar entry for the selected date),
  `hall-pass-log-sections` (procedure/destinations), `behavior-points-
  tracker-sections` (the behavior-tag "rules" list, not student point totals),
  and `gvb-exit-ticket:customPrompts` (the saved exit-ticket bank)
- Still has its own freeform "anything else for the sub" field
  (`gvb-sub-binder:today-lesson`), now paired with whatever Sub Plan Builder
  plan was found for the selected date rather than standing alone
- **Cover page** — teacher, room, date, periods, one-line emergency
  instruction — synthesized from the sources above, no separate input
- **Section checklist** (`gvb-sub-binder:included-sections.v1`) — one row per
  source with a live status string ("Saved", "No seating chart saved for
  period 3", etc.); unavailable sources show disabled/unchecked; only
  checked + available sections print
- Renders every source as its own card, then prints a cover page plus one
  page per checked, available section (fixed order), reusing the existing
  page-break-per-page print CSS
- Refresh data button to re-pull from every source tool

## Quick Wins

- **Done — partially.** **Include far more.** The packet should be able to pull: the class roster,
  the hall pass procedure and destinations, the behavior plan, the bell
  schedule, today's exit ticket or bell ringer, the lab safety status if it's
  a lab day, and the emergency information. Most of those already exist in
  `localStorage` keys this tool could read today (P7). *(Shipped: hall pass
  procedure/destinations, behavior-plan snapshot, exit-ticket bank, and
  emergency info as its own section. The bell schedule was already covered by
  the periods table in Standing Details. Not shipped: a standalone class
  roster section (seating covers per-period rosters, but there's no
  roster-only view) and lab safety status (no lab-safety tool key existed to
  read; out of scope for this round).)*
- **Done —** **A cover page** — teacher name, room, date, periods, and "in an emergency,
  do this" — which is the page a sub reads first. *(Room is a new Sub Plan
  Builder field, added for exactly this.)*
- **Done —** **Choose what's included.** A checklist of available sections with sizes, so
  the packet is 4 pages when that's right and 12 when it isn't. *(A status
  line per section rather than a page-count estimate — "sizes" in the literal
  sense wasn't built, but the effect — knowing what will and won't print
  before you print it — is there.)*
- **Done —** **Date selection.** Everything is "today"; being out on Thursday means
  generating the packet on Thursday morning, which is precisely when you
  can't. *(Defaults from Sub Plan Builder's selected absence date when one
  exists, otherwise today; freely overridable. See Status for the exact
  mechanism.)*
- **Skipped — deferred.** **Multi-day bundles**, printed with a divider per day. *(Sub Plan Builder
  now supports multiple days out; this tool still builds one date's packet at
  a time. Explicitly out of scope for this round — see the companion tool's
  file for the multi-day work that did happen.)*
- **Done —** **Tell the teacher what's missing.** "No seating chart saved for 3rd period"
  is more useful than silently omitting it. *(Every section — old and new —
  now has a live status string; the seating one specifically checks each
  configured period against saved section names and reports exactly this
  phrasing for whichever periods don't match.)*
- **Done — already existed.** **Page breaks between sections** (P6) so a seating chart never splits.
  *(The `.page + .page { page-break-before: always }` print rule predates
  this round; it kept working unmodified as more page types were added.)*

## Major Features

- **Skipped — deferred.** **Become the toolkit's general packet assembler** (P7). The sub binder is
  one instance of a broader idea: pick a date and a set of tools, and print
  everything relevant. The same engine could produce a unit packet, an
  open-house packet, a new-student welcome packet, or a field trip packet.
  *(This round's section-config array (`SECTION_ORDER`/`SECTION_EVAL`, one
  eval+render pair per source) is a step toward this shape, but it's still
  hard-coded to the eight sub-binder-specific sources, not a generic engine.)*
- **Skipped — deferred.** **A documented handoff interface** (P8). Right now this tool reads other
  tools' raw storage keys, which is fast and brittle — any schema change
  elsewhere breaks this silently. A small shared read API ("give me your
  printable summary for date X") would let tools opt in properly and would
  make new bundles cheap. *(This round went the other way under time
  pressure — added three more direct key reads instead of building the
  interface first. See Open Questions: the brittleness this bullet warns
  about is measurably larger now (six tools' raw storage read directly,
  up from three) than when this file was first written.)*
- **Skipped — deferred.** **Emergency sub plan.** A permanently-maintained generic packet that works
  on any day, printed once and left in a drawer — the single most valuable
  version of this tool, and mostly a template plus a reminder to refresh it.
- **Skipped — deferred.** **Feedback slip.** Print a page the sub fills in before leaving
  (`IDEAS_BACKLOG.md` lists this as its own tool; it belongs on the back of
  this packet).
- **Skipped — deferred.** **Digital handoff.** A link or QR (P3) so the sub can open the packet on
  their phone, rather than needing a printout that requires you to be at
  school to produce.
- **Resolved 2026-08-10 (for now).** **Merge with Sub Plan Builder** or split the responsibilities cleanly — one
  tool authors the lesson, the other assembles the packet, and right now the
  boundary is blurry. — Kept as two tools with a clean-ish split: Sub Plan
  Builder authors standing details and the day's lesson (and now owns date
  selection); this tool only reads that data and assembles a printable
  packet. No merge. Whether that boundary stays clean as more sources get
  added here is genuinely unclear — see Open Questions.

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
  *(Still open. This round's per-section eval/render pairs are a small step
  toward it but weren't written as a reusable engine.)*
- **Resolved 2026-08-10 — for this round, not for good.** Is defining a shared
  "printable summary" interface across tools worth doing before adding more
  sources? It's the difference between this tool scaling and this tool
  accumulating brittle special cases. — This round chose "add the sources"
  over "build the interface," under the scope and time given: hall pass,
  behavior, and exit-ticket reads were added as three more direct,
  defensively-parsed key reads, following the exact pattern the existing
  standing-details/seating-chart/calendar reads already used. That was the
  pragmatic call for a single round, but the bullet's own warning is now
  literally true at a larger scale — six other tools' raw storage keys are
  load-bearing for this tool instead of three, and any of their six authors
  changing shape without knowing this tool exists would break a section here
  silently (well, not silently — the missing-status messaging would show it
  as "not available" rather than crash — but a passing schema change could
  still make an available section render wrong instead of correctly flagging
  as unavailable). The next round that touches this file should treat the
  interface question as due, not deferred.
