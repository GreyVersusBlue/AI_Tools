# Improvement Prompts — 006 — Class Roster Hub

**Tool file:** `Tools/006-class-roster-hub.html`
**Support folder:** `Tools/class-roster-hub/` — `lib/qrcode.js`, `test/smoke-export.mjs`

**Current description (from README):** Build and save a class roster once, in the same shared storage Name Picker uses — several other tools can load it straight in instead of re-typing a class list.

---

## Status

### Pass 2 — Round 3 — 2026-08-13 — device-to-device roster transfer (backlog item P9, "All-rosters device transfer")

**Shipped.** "Move Everything to Another Device" — a new card (viewer column,
below "Archived rosters & past years") opens a modal that pairs this tool
with the same tool open on another computer over `_shared/webrtc-pair.js`
(manual-signaling WebRTC, no server, same-Wi-Fi/LAN only by design — see that
file's header) and moves everything in one shot. No file is ever written to
disk; nothing leaves the local network.

- **What "every roster, sidecar record, and archive" turned out to mean,
  concretely, in this tool's actual schema:** every entry of `np_rosters`
  (the active rosters), each one's `crh_students_v1` sidecar (`meta` — period,
  course, school year — plus each student's `preferred`/`say`) and its own
  `crh_archived_students` withdrawn-student list, folded together by the
  existing `snapshotRoster()` helper (the same one Archive-a-roster and
  Start-a-new-school-year already use) — plus every individually archived
  roster and every archived school year from `crh_archive_v1`. That is
  every key in this file's own `OWN_KEYS` — the same array the dependency
  scanner already uses to define "this tool's own data" — so a future fifth
  key can't quietly fall out of a transfer that still claims to move
  everything.
- **Import is additive, not a destructive overwrite.** Each incoming active
  roster goes through `restoreSnapshot()` — the exact function "Restore" on
  an archived roster/year already calls — which auto-renames on a name
  collision (`"X" → "X (2)"`) rather than replacing whatever the receiving
  device already has. Incoming archived rosters/years are prepended into the
  receiving device's own `crh_archive_v1` arrays. A teacher moving to a bare
  new laptop gets an exact copy; a teacher who already has rosters here loses
  nothing of their own. The tradeoff, named rather than hidden: there's no
  "replace everything" mode and no de-duplication if the same transfer is run
  twice — re-running a transfer produces a second renamed copy, not a merge.
  That was a deliberate scope cut for a first version, consistent with how
  the existing shared-roster-URL import already behaves (always a new,
  uniquely-named roster, never a merge into an existing one).
- **Chunked transfer, reusing the exact protocol** `schedule-visualizer`'s
  `sv-handoff.js` already ships for the same "one-shot bulk data transfer"
  shape: a `meta`/`chunk`/`end` message sequence over the data channel, split
  at 12,000 characters per message — comfortably under every browser's
  practical per-message ceiling for an `RTCDataChannel`, per that file's own
  comment, which this tool's own test now proves against a real 200-student
  roster that spans several chunks and arrives with nothing lost or
  duplicated.
- **A real bug caught before it shipped:** the first draft attached the data
  channel's `'open'` listener *after* `applyAnswer()` resolved, on the theory
  that `'open'` can't fire before then anyway. It can — on a fast local
  connection the event can fire before that `.then()` callback even runs, and
  a listener attached after an event has already fired never sees it. Fixed
  by attaching `'open'`/`'close'` the moment the channel is *created* (right
  after `createOffer()` resolves), matching the safe pattern
  `classroom-timer/ct-mirror.js` and `schedule-visualizer/sv-handoff.js`
  already use — attaching early can't race a fired-before-we-listened event,
  because `'open'` genuinely cannot fire until a remote description has been
  applied, which can't happen before the user pastes/scans a reply.
- **Both a QR code and a plain-text code, on both sides, with a camera-scan
  option** — matching `classroom-timer/ct-mirror.js` and
  `classroom-timer/mirror.html`'s fuller pattern (QR + `_shared/qr-scan.js`
  camera scan + a paste-back textarea as the fallback) rather than
  `schedule-visualizer`'s QR-and-paste-only handoff modal, since some
  devices/browsers can't reach each other's camera at all and the paste path
  has to work regardless.
- No new vendored libraries and no new precache entries: `webrtc-pair.js`,
  `qr-scan.js`, `vendor/jsqr/jsqr.js`, and `vendor/qrcode/qrcode.js` were
  already in `sw.js`'s `PRECACHE_URLS` (added when Classroom Timer and School
  Layout Visualizer shipped their own pairing features) and this tool already
  loaded the `qrcode.js` encoder for its existing per-roster QR share, so
  `sw.js` needed no changes at all.
- Everything lives inline in `006-class-roster-hub.html`'s existing script,
  matching this file's own established style (a single classic-script IIFE,
  `window.WebRTCPair`/`window.QRScan` as plain globals) rather than adding a
  new ES-module support file the way `schedule-visualizer/sv-handoff.js`
  does — this tool didn't already have that module-script wiring, and
  introducing it for one feature would have been more surface area than the
  feature needed.
- **Verified end-to-end**, not just logic-only: `test/smoke-export.mjs`
  (still the only suite for this tool — extended, not replaced, since
  `package.json`'s `test:roster-hub` script and `check-tests.mjs`'s wiring
  guard are both out of scope for this round) opens **two real Playwright
  browser contexts** — two independent `localStorage` stores standing in for
  two devices — and drives the actual buttons end to end: Send on device A,
  paste/generate the reply on device B, Connect, and Import. `_shared/
  webrtc-pair.js` is host-candidates-only by design, and two contexts on
  `127.0.0.1` really do negotiate a genuine peer connection (loopback is a
  valid same-machine ICE candidate) and really do move bytes over a real
  `RTCDataChannel` — this is not a mock. The one thing genuinely not
  exercised is the camera-scan buttons themselves (no `getUserMedia` in a
  headless run); the manual paste path they fall back to is what's driven,
  and it is the same code path either way once the code text is in hand.
  The scenario doubles as the "export the full payload, reimport it, verify
  nothing is lost or duplicated" round-trip check: a detailed roster (sidecar
  meta + per-student detail + an archived-withdrawn student), a bare roster
  with no sidecar record, a 200-student roster sized to force multiple
  chunks, one individually archived roster, one archived school year, and a
  same-named roster already sitting on the receiving device to prove the
  collision auto-rename — 24 new checks, all passing, none of them mocking
  the connection itself.

### Pass 2 — Round 2 — 2026-08-11 — session `m3r8ro`

**Shipped roster export to spreadsheet** (backlog rank 6). This tool holds the
canonical class list for the whole site and the only way out of the browser was
a printed page — but what a gradebook import or a sub folder wants is columns.

- **Export CSV / Export Excel**, with a scope select: *This roster* or *Every
  roster*. Columns are `# / Name / Preferred name / Pronunciation / Period or
  block / Course / School year`.
- **The export is where the two-key design finally pays off.** `np_rosters`
  holds the names; `crh_students_v1` hangs preferred name, pronunciation and
  the roster's period/course/year off them. `exportRowsFor()` joins them, and
  a roster the sidecar has never seen — one written by Name Picker years ago —
  still exports cleanly, just with empty detail columns. That fallback is
  asserted in the suite, because it is the case a naive join would drop.
- **The open roster exports from what's on screen**, not from what was last
  saved, and pending edits in the "Paste / bulk edit" tab are adopted first via
  `adoptPendingEdits()` — the same thing Print already does. An export that
  quietly dropped the four names just pasted in would be worse than useless.
- CSV: UTF-8 BOM (Excel on Windows mangles accented names without it), proper
  quoting, and a leading `Roster` column when exporting more than one. XLSX
  lazy-loads the shared vendored SheetJS and writes **one sheet per roster**,
  with `sheetName()` handling Excel's 31-character cap and its rejection of
  `: \ / ? * [ ]` — "Period 5/6 Honors" becomes "Period 5 6 Honors", and a
  collision after truncation gets a suffix rather than throwing.
- No storage change: this reads what is already there.
- Verified by `Tools/class-roster-hub/test/smoke-export.mjs` (19 checks,
  `npm run test:roster-hub`) — real buttons, real downloads, the .xlsx read
  back through the tool's own SheetJS.

### Pass 2 — Round 1 — 2026-08-10 — session `yjj7k6`

Picked up item 4 from Round 1's "where the next round should pick up" list:
*"the numbered list, blank checklist, and blank name grid are in; a
seating-quiz variant that actually matches the Seating Chart layout would
need to read `seating-chart-v1` (P7)."*

Shipped as a new print format, **"Seating chart shape (from Seating Chart
Generator)"**, added to the existing print-format dropdown alongside the
three that already shipped. Read-only, one-way — this tool never writes
`seating-chart-v1`:

- `bestMatchingSeatingSection(names)` scans every section in
  `seating-chart-v1` and picks whichever one's student list overlaps this
  roster the most (by name, case/whitespace-insensitive), requiring at
  least 3 matching names and 40% overlap before it will match at all — so a
  roster with no corresponding seating chart gets a clear message instead of
  a nonsense match, and the teacher never has to know or type which Seating
  Chart Generator section name corresponds to which roster.
- The print itself (`seatGridPrintHtml`) reproduces the room's actual desk
  layout as blank, numbered boxes — positioned by the desks' real `x`/`y`
  (scaled as percentages of the same 1280×900 room space
  `Tools/seating-chart/seating.mjs`'s `ROOM` constant uses, including desk
  rotation) rather than a generic N-column grid — with a "Front of room"
  bar at the top and a shuffled (not seat-ordered) word bank of names below,
  so a student has to actually work out where they sit rather than reading
  it straight down a list.
- **Real risk, noted rather than hidden**: the 1280×900/106×70 room
  constants are copied, not imported (this tool doesn't load
  `seating.mjs`), so if Seating Chart Generator's `ROOM` export ever
  changes, this print silently drifts out of shape until someone updates
  the copy here too. Left a comment at the constant pointing at the source
  of truth.

Verified with a headless-browser pass: seeded a roster and a matching
`seating-chart-v1` section with four desks (one rotated), loaded the
roster, picked the new print format, and confirmed all four seats rendered
at the right positions with the shuffled name legend and no console errors.

Everything else on this tool's backlog (rename-propagation, roster
device-to-device transfer, photos/flags) is unchanged from Round 1.

### Round 1 (Pass 1) — 2026-08-10 — The student record schema, the dependency guardrail, sections,
and year rollover all shipped.** This was the round that turned the tool from
"a textarea that writes `np_rosters`" into something that behaves like a
system of record. Nothing about `np_rosters` changed shape — see the schema
note below, which is the most important decision in this round.

What shipped, against the backlog below:

- **The student record schema (Major Feature)** — new `crh_students_v1` key:
  `{ version: 1, rosters: { "<roster name>": { meta, students: [...],
  orphans: [...] } } }`, where a student is `{ id, name, preferred, say }`.
  Stable IDs, preferred name ("goes by"), and pronunciation ("say it"), with
  a version stamp so a future migration has something to branch on (P8).
- **Resolved the open question about where the record lives: a sidecar key,
  not an in-place migration of `np_rosters`.** Fifteen tools read
  `np_rosters` and every one of them expects `{ "Period 3": ["Aiden Smith",
  …] }` — an array of plain strings. Changing that shape in place would break
  all fifteen simultaneously, on a teacher's machine, with no way to roll
  back. So `np_rosters` stays byte-compatible and remains the authority on
  *who is on the roster*; the sidecar hangs detail off those names and is
  re-synced against them on every load and save. A tool that never learns
  about the sidecar keeps working forever. The cost is real and worth naming:
  identity is still keyed on the name string at the boundary, so the stable
  IDs only buy continuity *inside this tool* until other tools opt in. That
  opt-in is the next big step, not this one.
- **A real roster editor (Quick Win, and the biggest usability change)** —
  per-student rows with inline rename, up/down reorder, remove, archive,
  tick-to-select, plus sort A–Z and sort-by-last-name. The old textarea is
  still there as a "Paste / bulk edit" tab, and the two stay in sync. IDs and
  details follow a student through reorders, sorts, and edits.
- **Duplicate and near-duplicate detection (Quick Win)** — flags exact
  repeats, blank rows, and the case that actually breaks downstream history:
  `"Smith, John"` sitting beside `"John Smith"`. Detection is a sorted-token
  key, so it catches the name-order swap and stray punctuation/whitespace in
  one rule. Each finding gets a one-click fix.
- **Column mapping on import (Quick Win, P13)** — `firstCellOf` is gone.
  Files and pasted spreadsheet regions now open a mapping dialog: header-row
  detection, name-in-one-column or first+last-in-two-columns, a live preview
  of the first five rows showing exactly what each will import as, and
  add-vs-replace. When there is no header it guesses the name column by
  picking the one with the most letters (IDs and periods are digits).
- **Last, First ↔ First Last normalization (Quick Win)** — a checked-by-default
  option in the import dialog, and quoted `"Vance, Marcus"` cells keep their
  comma through parsing so the flip works.
- **Sections and periods as first-class (Major Feature)** — period, course,
  and school year per roster, stored in the sidecar's `meta`. The saved-roster
  list groups by school year and sorts by period, and the printed pages are
  headed with them.
- **Show what depends on this roster (Major Feature)** — a live scan of
  `localStorage` for other tools' payloads containing these students' names,
  shown as "Behavior & Points Tracker — 22 of 28 students", and surfaced
  *inside the delete confirmation* so the guardrail lands where the damage
  would. Rather than teach this tool fifteen schemas it searches each tool's
  saved JSON for the names; that is a heuristic, not a join, and it is
  labelled as a warning rather than a report.
- **Year rollover (Major Feature, P14)** — "Start a new school year" files
  every roster under a year label in `crh_archive_v1` and hands back the same
  classes, same periods, same courses, with empty student lists. Past years
  and individually archived rosters are both restorable.
- **Archive a roster rather than delete it (Quick Win, P11)** — a roster can
  now leave every other tool's roster list without its names being destroyed.
- **Bulk operations (Major Feature, partial)** — move ticked students to
  another roster (or to a brand-new one, which is how you split a list), and
  merge another roster's names in without touching the source.
- **Roster stats (Quick Win)** — students, archived, how many carry details,
  last saved.
- **Load a sample class (P15)** — 26 names, so the tool opens as something
  you can immediately print instead of an empty form.

**Challenges hit:**

- The two-pane editor (rows vs. textarea) was the only genuinely tricky part.
  The first cut re-read the textarea every time the list tab became active,
  which silently wiped any list built by import or sample data. It needed an
  explicit `activeTab` and a `keepStudents` flag on `setTab` for callers that
  have just built the list themselves. Worth remembering if anyone adds a
  third way to populate the list.
- Keeping a student's details attached through a rename is only possible up
  to a point. Reorders, sorts, and case fixes are handled by ID; retyping a
  name in the textarea is not, so records whose names vanish park in an
  `orphans` list (capped at 120) and are re-matched by sorted-token key if
  the name comes back — including in the other name order. It recovers the
  common case without pretending to be a real identity system.
- The dependency scan is a substring search over other tools' raw JSON. It
  can false-positive on a very short or very common name, so names under
  three characters are skipped and outsized payloads are ignored. Making it
  exact would mean teaching this tool every other tool's schema, which is the
  coupling the sidecar decision was specifically trying to avoid.
- Verified with a 30-check Playwright pass over the real file (sample load,
  save shape, sidecar IDs through reorder, near-duplicate detect+fix,
  dependency scan, delete guardrail, both import modes, student archive and
  restore, move, merge, roster archive and restore, year rollover, all three
  print formats). The site has no test dependency and this round did not add
  one — the script lives outside the repo.

**Where the next round should pick up:**

1. **Get one consuming tool onto the sidecar.** The schema exists and nothing
   reads it yet. Name Picker is the obvious first: show "goes by" on the
   drawn card and the pronunciation underneath. That is the proof that the
   sidecar is worth having, and it defines the read-side helper the other
   fourteen tools would copy.
2. ~~**Roster transfer between devices (P9)**~~ — **done Pass 2 Round 3.**
   "Move Everything to Another Device" sends every roster, its sidecar
   record, and the whole archive over `webrtc-pair.js` in one shot; see the
   Pass 2 Round 3 note at the top of Status.
3. **Apply a rename across all tools** — the last unbuilt bullet under Bulk
   operations, and the one that would make the dependency scan actionable
   rather than only informative.
4. ~~**The remaining print formats**~~ — **done Pass 2 Round 1.** A
   seating-chart-shaped blank print now reads `seating-chart-v1` and matches
   the roster to the right section by name overlap; see the Pass 2 note at
   the top of Status.
5. **Photos and flags are still deliberately unbuilt** — see Open Questions;
   they need the storage-quota answer (P12) and an explicit decision about
   what belongs on this device at all, which is Devon's call, not an
   implementation detail.

## What it does today

- Create, rename, duplicate, delete named rosters, stored in the shared
  `np_rosters` key
- Type/paste names, or **import from a file** (`namesFromFileText`,
  `firstCellOf` — handles CSV-ish input by taking the first cell)
- Roster switcher, live name count
- **Share a roster by QR code** and by `state-link.js` URL
- Print a class list
- **Export to CSV or Excel** — one roster or every roster, with preferred
  name, pronunciation, period, course and school year as columns (one sheet
  per roster in the .xlsx)
- **Move everything to another device** — every roster, its `crh_students_v1`
  sidecar detail, and the whole `crh_archive_v1` archive, over a direct
  WebRTC connection (QR or paste code, no server, same Wi-Fi/LAN only). No
  file is created; import is additive and auto-renames on a name collision
  rather than overwriting anything already on the receiving device.

## Quick Wins

- **Done —** **A real roster editor.** Today a roster is a textarea. Per-student rows
  with add/remove/reorder, inline rename, and duplicate detection would make
  this feel like the system of record it actually is. *(Shipped — per-student
  rows with inline rename, reorder, remove, archive, tick-to-select, sort;
  the old textarea stays as a "Paste / bulk edit" tab.)*
- **Done —** **Duplicate and near-duplicate detection** ("John Smith" and "John  Smith"),
  which silently breaks every downstream tool's per-student history.
  *(Shipped — a sorted-token key catches exact repeats, blanks, and
  name-order swaps, each with a one-click fix.)*
- **Done —** **Column mapping on import.** `firstCellOf` assumes the name is in column 1;
  a real export from a gradebook has ID, Last, First, Period. Let the teacher
  pick which columns are which (P13). *(Shipped — a mapping dialog with
  header-row detection, column choice, a five-row preview, and add-vs-replace.
  `firstCellOf` is gone.)*
- **Done —** **Last, First ↔ First Last normalization**, since gradebook exports and
  teacher typing disagree and downstream tools display both. *(Shipped — a
  checked-by-default import option.)*
- **Done —** **Roster stats on the card**: 28 students, last edited 3 weeks ago, used by
  6 tools. *(Shipped — students, archived, how many carry details, last
  saved.)*
- **Done —** **Print a numbered class list**, a blank checklist, and a seating-quiz style
  blank — the three paper formats every teacher prints. *(All four formats
  now ship, including the real seating-chart-shaped seating-quiz variant
  added Pass 2 Round 1 — see Status.)*
- **Done —** **Archive rather than delete** (P11) — deleting a roster silently orphans
  history in a dozen other tools. *(Shipped — a roster can leave every other
  tool's roster list without its names being destroyed.)*

## Major Features

- **Done —** **Own the student record schema** (P2). This is the decision that unblocks
  the whole site: stable IDs, preferred name, pronunciation, period/section,
  optional photo, and a small set of flags other tools may honor. Today a
  student is a string, which means no tool can reliably carry history across a
  roster edit, and "J. Smith" in one tool is a different person from "Smith,
  John" in another. Whatever shape this takes has to be versioned and
  migratable (P8), because 15 tools depend on it. *(Shipped as the
  `crh_students_v1` sidecar — stable IDs, preferred name, pronunciation,
  version stamp; a sidecar rather than an in-place `np_rosters` migration —
  see the now-resolved Open Question above. Photo/flags deliberately not
  built yet.)*
- **Done —** **Sections and periods as first-class.** One roster per period is the
  current model; grouping them into "my 6 sections this year", filtering,
  and moving a student between sections mid-year are all normal events with no
  current answer. *(Shipped — period, course, and school year per roster,
  grouped and sorted in the saved-roster list and on printed pages.)*
- **Done —** **Show what depends on this roster.** Before you delete or rename, tell the
  teacher which tools have data keyed to it. This is the friendliest possible
  guardrail and no other tool can provide it. *(Shipped — a live
  localStorage scan surfaced inside the delete confirmation.)*
- **Done —** **Year rollover** (P14). Archive last year's rosters, start clean, keep the
  section structure. Pairs directly with Backup & Restore. *(Shipped as
  "Start a new school year" — files every roster under a year label in
  `crh_archive_v1`, restorable.)*
- **Done —** **Roster transfer between devices** (P9) — QR sharing exists; peer-to-peer
  transfer of *all* rosters would make the school-to-home move trivial.
  *(Shipped as "Move Everything to Another Device" — every roster, its
  sidecar record, and the whole archive, over `webrtc-pair.js`; see the Pass
  2 Round 3 note at the top of Status.)*
- **Partially done —** **Bulk operations**: merge two rosters, split one, apply a rename across all
  tools. *(Move-ticked-students and merge are shipped; "apply a rename across
  all tools" is still open — see "Where the next round should pick up" above.)*

## Moonshot / North Star

**One place where the teacher enters a class list, once, per year — and every
other tool on the site just knows.** With stable identity, so participation
counts, hall passes, reading logs, lab roles, and behavior notes all follow
the same student through a name correction, a section change, and a new
semester. Entirely local, visible, and erasable in one click. This is the
quiet backbone that makes the other 45 tools feel like one product instead of
45 separate ones.

## Platform themes that matter here

- **P2 (shared roster)** — this tool is the owner; the theme is this tool's
  roadmap.
- **P8 (versioning/migration)** — any schema change here ripples site-wide and
  must be backward compatible.
- **P13 (import surfaces)** — gradebook exports are the realistic input.
- **P14 (year lifecycle)** — rollover starts here.

## Open Questions

- **Resolved 2026-08-10.** Should the richer student record live in `np_rosters` (migrating in place,
  with the old array-of-strings shape still readable) or in a new key beside
  it? In-place migration is kinder to the 15 consuming tools but riskier. —
  Landed on a sidecar key (`crh_students_v1`): `np_rosters` stays
  byte-compatible for the fifteen tools that already read it, and the
  sidecar re-syncs against it on every load/save. Stable IDs only buy
  continuity inside this tool until other tools opt in — see "Where the
  next round should pick up" above.
- How much personal data is appropriate to store at all? Preferred name and
  pronunciation are clearly useful; photos and flags deserve an explicit
  decision and a very visible erase control.
