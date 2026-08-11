# Improvement Prompts — 044 — Sub Plan Builder

**Tool file:** `Tools/044-Sub Plan Builder.html`
**Support folder:** `Tools/sub-plan-builder/test/smoke-share.mjs`
(`npm run test:sub-plan`). JSZip now comes from the site-wide
`_shared/vendor/jszip/` copy rather than a per-tool `lib/`.

**Current description (from README):** Fill in the boilerplate once (schedule, emergency info, phone numbers), then add today's lesson and export a ready-to-print sub plan as a Word doc.

---

## Status

**2026-08-11 — Round 2 (session `m3r8ro`).** Shipped **share a plan by link or
QR** (backlog rank 11, platform theme P3). A finished sub plan almost always
has to reach somebody else — the front office, the department chair, whoever is
covering first period — and the only ways out of the tool were a .docx download
and a text blob to paste. Both mean an attachment.

- **"Copy link to this plan" and "Show QR code"** in a new share card. The plan
  rides inside the URL via `_shared/state-link.js`; nothing is uploaded and the
  payload never leaves the two browsers that see the link.
- **What travels and what does not was the real design decision.** The link
  carries the standing details (a plan read without the room number, the
  periods and the phone numbers is not a plan anyone can act on), the dates,
  and every day's fields. It does **not** carry the Student Notes box. That box
  is documented on the page as never being stored anywhere, and a link *is*
  storage — it lands in a chat log, an email, a browser history. The saved
  history already draws that line; this draws the same one, and the suite
  asserts the note is absent from the URL, from the decoded payload, and from
  the receiving browser.
- **Opening a link is confirm-gated** and says who it is from and how many days
  it covers, because it replaces the standing details saved in that browser.
  Declining changes nothing. The parameter is consumed on read, so a refresh
  cannot re-import the plan over whatever the receiving teacher has since done.
- **The QR has a real size limit and says so.** A plan with several days of
  detailed notes runs past what any scanner will read; `qrcode.js` throws and
  the tool names the failure and points at the copy-link button rather than
  drawing an unscannable grey square. A two-day plan with ordinary notes came
  out at 2.1 KB and encodes fine.
- A payload copied to the clipboard is a deep copy of `settings`, so editing
  the page afterwards cannot retroactively change a link already sent.
- **Verified** by `Tools/sub-plan-builder/test/smoke-share.mjs` (40 checks):
  the link is built, decoded, and then actually opened in three further browser
  contexts — one that accepts, one that declines, one handed a mangled link —
  plus both QR branches.
- **Not done:** the link carries no version negotiation beyond `v: 1`, and
  there is no "share just one day of a multi-day absence" option.

**2026-08-11 — Round 2 (session `gb5c6e`).** Shipped a scoped slice of
"Templates by day type" (Major Features): a per-day "Day type" select
(Regular lesson day / Testing day / Video day / Emergency plan (no notice))
plus an "Insert template" button that fills Overview/Schedule/Materials with
generic starter content for that day type — never automatically, only on
click, and only after a `confirm()` if any of those three fields already has
something in it (so it can't silently clobber a lesson someone was mid-way
through writing). The emergency-plan template is the one the file's own
Moonshot section calls "the killer feature" — a permanently-usable generic
plan that doesn't depend on whatever unit is currently running.

`dayType` is additive to `blankDayPlan()`/`captureCurrentDayFields()`/
`applyDayFieldsToForm()` (defaults to `'lesson'`) and to the history entry
shape written by `saveCurrentPlanToHistory()`/read by `loadHistoryEntry()`
(`en.dayType || 'lesson'` fallback for entries saved before this round) —
Sub Binder Generator, which reads this same history key, ignores the new
field entirely since it only reads the fields it already knew about. Tracked
per-day like every other day-tab field, so a 3-day absence can freely mix a
testing day and a lesson day. Verified with a headless Playwright pass: the
no-type-selected guard alert, the overwrite-confirm gate, per-day tracking
across tab switches (day 2 defaults to `'lesson'` independently of day 1's
choice), and a full round-trip through `saveCurrentPlanToHistory()` →
`localStorage` → "Load" restoring the saved day type — zero console errors.

Not attempted this round: everything else "Templates by day type" could
still mean (richer per-type period/schedule scaffolding beyond the four
generic templates, district- or subject-specific packs), and all of Major
Features' other bullets (still deferred — see below).

---

**2026-08-10 — JSZip vendored, plus the round of Quick Wins scoped for this
tool alongside `045-sub-binder-generator.html`.** JSZip 3.10.1 now ships locally
at `Tools/sub-plan-builder/lib/jszip.min.js` (pulled via `npm pack jszip@3.10.1`
since `cdnjs.cloudflare.com` isn't reachable from a blocked-network sandbox but
`registry.npmjs.org` is — same exact build, verified by generating a real zip
with it and checking the `PK\x03\x04` signature). The `<script src>` tag now
points at the local relative path. Everything below was added additively to
`subPlanBuilder.standingDetails.v1` and `subPlanBuilder.history.v1` — both
still load correctly with no new fields present (checked directly with an
old-shape saved record).

What shipped: an always-included Emergency Info block (fire route, lockdown
procedure, medical alerts) that's now its own visually-separated card in the
form and its own heading in every output; a prefilled Quick Checklist (bell
times pulled from the periods list, plus new keys-location/who-to-ask/
tech-failure fields) at the top of every generated plan; a room-number field
(new, feeds the Sub Binder cover page); and full multi-day support — "First
day out" + "Days out" (school days only, weekends skipped automatically) now
drive a day-tab UI where each day gets independent lesson/schedule/period
content while sharing one set of standing details, and Generate produces one
.docx with a page break between days (each day's page is self-contained —
checklist and emergency info repeat on every day, not just the first, so a
page pulled out on its own still has what a sub needs). "Save to history" now
writes one history entry per day out, in the exact same entry shape the tool
already used — that's also *the* cross-tool handoff: Sub Binder Generator
reads this same key to find "the plan for date X." Every day/date change also
writes `subPlanBuilder.lastAbsence.v1` (`{dates, updatedAt}`), a small new key
whose only purpose is telling Sub Binder Generator which date(s) to default
to — see that tool's Status for how it's consumed. Validated with a scripted
jsdom pass (weekend-skip date math, day-tab capture/restore round-tripping,
multi-day quick-text and .docx XML output, well-formed-XML check on the
generated `document.xml`) rather than by hand-clicking alone.

Not done this round (see Quick Wins / Major Features below for the specific
skips): true print/.docx *parity* — they're still two independently-coded
renderers that happen to produce equivalent content, not one shared model;
seating-chart/roster references by name; richer .docx (tables, headers/
footers with page numbers, an embedded seating-chart image); day-type
templates; pulling the lesson from the School Calendar Visualizer; the
feedback slip; shareable link/QR; standing-details versioning.

## What it does today

- **Standing details** saved once (`subPlanBuilder.standingDetails.v1`) and
  reused: schedule, room number, emergency info, phone numbers, a prefilled
  sub checklist (keys/who-to-ask/tech-failure), per-period blocks
- **Emergency Info** — fire route, lockdown procedure, medical alerts — as its
  own always-included block in every output, not just a field among others
- **Multi-day absence support** — "First day out" + "Days out" (school days,
  weekends auto-skipped) drive a day-tab UI; each day gets its own lesson,
  schedule, and per-period notes while sharing one set of standing details
- JSZip is now **vendored locally** (`Tools/sub-plan-builder/lib/jszip.min.js`)
  instead of loaded from cdnjs — works fully offline
- **Generates a real .docx from scratch** — hand-built OOXML (document,
  styles, numbering, content types, rels, core/app props) zipped with JSZip,
  one page break per day for multi-day plans. This is the most technically
  impressive export on the site.
- Plain-text "quick copy" mode with clipboard copy and **Read aloud**
  (`speechSynthesis`) — also multi-day aware
- Print / Save as PDF
- **Share the whole plan by link or QR code** (`_shared/state-link.js`) —
  standing details, every day out, every period note, but never the Student
  Notes box; opening a link is confirm-gated and consumes the parameter
- Plan **history** (`subPlanBuilder.history.v1`) with load/delete — one entry
  per day out; also the record `045-sub-binder-generator.html` reads to find "the
  plan for date X"
- Writes `subPlanBuilder.lastAbsence.v1` on every date/day-count change so
  Sub Binder Generator can default to the same day(s)
- Import/export standing details as JSON
- Behavior-plan variants: Short version / Full version with referral track /
  Custom
- **Day-type starter templates** — Testing / Video / Emergency (no notice) —
  fill in Overview/Schedule/Materials with generic content on request,
  tracked per-day in multi-day plans

## Quick Wins

- **Done —** **Vendor JSZip locally** (P5). This tool is broken on a first offline or
  blocked-network load, and a sub plan is precisely the thing you write at
  6:40am from home when you've woken up sick. *(Now at
  `Tools/sub-plan-builder/lib/jszip.min.js`, pulled from the npm registry
  since cdnjs wasn't reachable — same 3.10.1 build.)*
- **Done —** **Emergency info as a locked, always-included block** — fire route, lockdown
  procedure, medical alerts — visually separated so a sub can find it in two
  seconds, and always printed even when the lesson section is short. *(New
  "Emergency info" card in Standing Details; its own heading in the quick-copy
  text and the .docx, repeated on every day's page for multi-day plans.)*
- **Done —** **"I'm out tomorrow" one-click flow.** Pick a date, pull that day's
  schedule, and produce the plan; the current flow assumes today. *("First day
  out" date field, defaulting to today but freely changeable; feeds the new
  `subPlanBuilder.lastAbsence.v1` handoff key Sub Binder Generator reads.)*
- **Done —** **Multi-day absence.** Three days out means three plans; today it means
  filling the form three times. *("Days out" field (school days, weekends
  auto-skipped) plus a day-tab UI — one lesson/schedule/period set per day,
  one shared set of standing details, one .docx with a page break between
  days.)*
- **Skipped — deferred.** **Seating chart and roster references by name**, so the sub plan says
  "seating chart attached" and the Sub Binder actually attaches it (P7).
  *(Out of scope for this round; Sub Binder Generator still only reads the
  seating chart independently rather than this tool naming a specific
  section.)*
- **Skipped — deferred.** **Print-first parity.** The .docx and the printed PDF should be the same
  document; today they're two rendering paths that can drift. *(Still two
  independently-coded renderers — `buildPlainTextForDay` for quick-copy/print,
  `buildDayParas` for the .docx — that were extended in parallel this round
  and produce equivalent content, but there's no single shared model backing
  both yet.)*
- **Done —** **A "what a sub actually needs" checklist** at the top — bell times, where
  the keys are, who to ask, what to do if the tech doesn't work — prefilled
  from standing details and hard to accidentally omit. *(New "Quick checklist
  for the sub" fieldset feeding a "QUICK CHECKLIST" block right under
  Emergency Info in every output.)*

## Major Features

- **Partially done.** **Templates by day type.** A lesson-day plan, a testing-day plan, a
  video-day plan, an emergency no-notice plan. The emergency one is the
  killer feature: a permanently-maintained generic plan that works for any
  day of the year, printed and left in a drawer. *(Shipped 2026-08-11: a
  per-day "Day type" select and an "Insert template" button that fill
  Overview/Schedule/Materials with generic content for Testing / Video /
  Emergency, confirm-gated so it can't overwrite work silently. Still open:
  richer per-type scaffolding beyond generic text, and any district/subject-
  specific variants.)*
- **Skipped — deferred.** **Pull the lesson from elsewhere** (P7). If the School Calendar Visualizer
  knows what unit you're in and the Exit Ticket / Number Talks banks have
  routines, the plan can be 70% drafted before you type anything. *(This
  round built the handoff in the other direction instead — Sub Binder
  Generator now pulls this tool's saved plan by date — but this tool itself
  still doesn't read the calendar or any routine bank to pre-fill anything.)*
- **Skipped — deferred.** **Sub feedback loop.** Generate the plan *and* a one-page feedback slip the
  sub fills in — already on `IDEAS_BACKLOG.md` as its own tool, but it belongs
  in the same document.
- **Skipped — deferred.** **Richer .docx.** The OOXML builder is already substantial; extending it to
  tables (per-period grids), headers/footers with page numbers, and an
  embedded seating-chart image would make the output look like something the
  front office produced. *(This round added new sections and a page break
  between multi-day pages, but no tables, headers/footers, or images.)*
- **Skipped — deferred.** **Shareable link / QR of the plan** (P3) so a plan can reach a colleague or
  the office without email.
- **Skipped — deferred.** **Standing-details versioning** (P8) so a mid-year room change doesn't
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
- **P7 (cross-tool bundles)** — this tool and `045-sub-binder-generator.html` are
  two halves of one workflow and should be designed together.
- **P6 (print quality)** — the printed page is handed to a stranger; it has
  the highest legibility bar on the site.
- **P14 (year lifecycle)** — standing details are annual and should roll over.

## Open Questions

- **Resolved 2026-08-10 (for now).** Should Sub Binder Generator be absorbed
  into this tool, or should this tool become the editor and Sub Binder stay
  the assembler? — Went with the latter, explicitly, for this round: this
  tool authors the day's lesson and standing details; Sub Binder Generator
  assembles the printable packet, reading this tool's history/standing-details
  storage rather than duplicating any of it. They're linked by matching
  dates (`subPlanBuilder.lastAbsence.v1` for "which day," `subPlanBuilder.
  history.v1` for "what's the plan for that day") instead of a merge. Whether
  that split holds up as more sources get added to Sub Binder is still an
  open question — see that tool's Open Questions.
- Is .docx still the right primary output, or has PDF overtaken it for how
  these actually get delivered to the office? *(Still open — not addressed
  this round.)*
