# Improvement Prompts — 005 — Seating Chart Generator

**Tool file:** `Tools/005-Seating Chart Generator.html`
**Support folder:** `Tools/seating-chart/` — `seating.mjs`, `scg-photo.js`,
fonts, and `test/` (`smoke-seating.mjs`, `smoke-sub-packet.mjs`,
`drive-seating.mjs`)

**Current description (from README):** Build a chart once, then reshuffle it whenever you need to.

---

## Status

**2026-08-11 — Round 2 (session `m3r8ro`).** Shipped the **whole-day sub
packet** (backlog rank 9). The single-section Sub export already put one
period's chart, notes and rule conflicts on one page; a teacher out for the day
has six periods and was running it six times.

- **"Sub packet (whole day)"** builds a contents page followed by one
  sub-export page per section, in the tool's own section order.
- **It reuses `buildPrintPage()` rather than a second render path.** That
  function already builds a static, trimmed, scaled page per section for "Print
  all sections"; it gained an `opts.sub` branch that appends the same flag,
  violations and notes blocks the live-floor sub export appends, so the two
  paths cannot drift apart.
- **The two "for the substitute" overrides are the part worth guarding.** Names
  and photos are forced on regardless of the teacher's persisted print toggles
  (a substitute cannot use a chart that respects a privacy preference), and
  per-student notes print — the one mode where they do, by design; see the CSS
  note by `.desk .seat`. Both are asserted, along with the ordinary "Print all
  sections" still doing neither.
- **The contents page is what makes it a packet rather than a stack.** Per
  section: page number, name, seated-of-total, and a "Read first" column
  flagging how many notes and how many broken seating rules that section
  carries, so a sub knows before the bell which page needs reading. Plus a line
  explaining that charts are drawn from the front of the room, which is the
  question every substitute asks.
- With a single section it falls back to the plain one-page Sub export — one
  section is not a packet.
- **Verified** by a new suite, `Tools/seating-chart/test/smoke-sub-packet.mjs`
  (34 checks, part of `npm run test:seating`). It seeds a two-period day
  through the tool's own storage key with desks placed 110px apart — inside
  `ROOM.neighbor` — so the keep-apart conflict is guaranteed rather than left
  to the auto-assigner's dice, then drives the real button with `window.print`
  stubbed and the print events dispatched by hand, the same way
  `drive-seating.mjs` does.
- **Not done:** the packet has no per-section page of the roster as a list
  (only the chart), and no "what to do if a student is absent" affordance. The
  mobile-toolbar row is still the tool's outstanding backlog item, and this
  round added one more toolbar button to it — worth doing before the toolbar
  grows again.

**2026-08-10** — Implemented all eight Quick Wins and both requested Major
Features in this round. Concretely:

- **Print options**: names on/off, photos on/off, and rule-conflicts on/off
  are now persisted checkboxes in the toolbar, honoured by both "Print" and
  "Print all sections."
- **Print blank** is a dedicated one-click button (forces names, photos and
  conflicts off, forces seat numbers on) rather than making a teacher toggle
  three checkboxes and remember to toggle them back.
- **Seat numbers** and **Mirror view** are both toggle buttons that apply to
  the screen and the printed page from one flag each (`state.numbered`,
  `state.mirror`), not separate screen/print settings.
- **Front-of-room indicator**: this turned out to already exist (the
  `FRONT OF ROOM · BOARD` bar) and already survived to the printed page — it
  just wasn't credited as a Quick Win. Confirmed it still renders correctly
  alongside the new mirror and numbered-seat features.
- **Constraint violations on the printed chart**: a "Seating rule conflicts"
  block now prints under the chart (single print, print-all, and the sub
  export), reusing `checkConstraints()` rather than a second solver.
- **Bulk photo import**: a multi-file picker matches a batch of image
  filenames to roster names (`matchPhotoFilenames()` in `seating.mjs`, pure
  and unit-tested — exact match, then a same-words-any-order match so
  "Lovelace, Ada (2).png" still finds "Ada Lovelace"). One undo entry per
  batch, not one per photo.
- **Storage-usage readout (P12)**: a live KB-used-of-~5MB bar with a
  photo-bytes call-out, computed by `storageReport()` in `seating.mjs`
  (pure, unit-tested) and shown under the roster.
- **Sub-friendly export**: a new print mode that adds per-student notes and
  a plain-English "should not sit together" / "should sit together" list
  under the chart — the one place on this page notes are intentionally
  printed, clearly flagged as such.
- **Multiple layouts per section (MF2)**: `section.layouts[]` holds named
  desk+seat snapshots ("Testing rows", "Group pods"); a sidebar block saves,
  switches, renames and deletes them. The roster and Keep Apart / Put
  Together rules stay shared across a section's layouts rather than
  duplicated per layout.

**Real tradeoffs hit:**
- **Mirror view is view-only, not edit-in-place.** Flipping the floor
  horizontally with CSS (`scaleX(-1)` on the desk layer, counter-transformed
  on each seat's content so text stays upright) is straightforward for
  rendering, but the free-drag-a-desk-by-hand code does its own
  screen-to-room pixel math that assumes an unmirrored floor. Making that
  math mirror-aware was more risk than the Quick Win justified, so
  dragging a desk by hand is disabled while mirrored (tap-to-place,
  drag-and-drop *assignment*, keyboard nudging, and the rotate/lock/delete
  buttons all still work — they rely on the browser's own hit-testing, not
  manual coordinate math, so mirroring doesn't touch them). Documented in
  code; worth revisiting if mirror view turns out to get used mid-edit
  rather than just for an orientation check or a print.
- **Sub export and Print blank both operate on the current section**, not
  "every section like a substitute's whole day." Reusing the well-tested
  live-floor print path (`preparePrint()`/`restoreAfterPrint()`) for both
  was deliberately lower risk than threading them through the print-all
  static-snapshot builder too. A teacher covering multiple periods runs Sub
  export once per section. Generalizing it to a "sub export for the whole
  day" pass is a reasonable pickup for a future round — the pieces
  (`buildPrintPage()` with options, `violationsHTML()`, `notesHTML()`) are
  already shaped to support it.
- **Layouts share the roster and Keep Apart / Put Together rules by
  design**, not by oversight — a layout is only ever `{ desks, assign }`.
  Switching layouts re-cleans the seat assignment against whoever is
  currently on the roster, since a layout saved weeks ago may reference a
  student who has since left.

**Not done / explicitly skipped, per the assignment:** the constraint-solver
upgrade, real room geometry (doors/windows/obstacles), seating history and
rotation tracking, and live mode — all left exactly where the Major
Features / Moonshot sections already put them, below.

**Top follow-up for the next round — the IndexedDB photo migration was NOT
done.** Photos are still base64 strings inside the one `seating-chart-v1`
localStorage key; the storage-usage readout added this round makes the risk
*visible* (P12) but doesn't remove it. `blank-map-generator/bmg-map-cache.js`
is still the pattern to copy: move `student.photo` out to an IndexedDB
object store keyed by student id, keep a small in-memory cache for the
`<img>` tags already on screen, and change `scg-photo.js` /
`repairState()`/`newLayout()` accordingly. This is a real migration (existing
saves have photos as data: URLs already in localStorage) rather than a
green-field feature, which is why it didn't fit in the same round as eight
Quick Wins and two Major Features — flagging it clearly rather than
attempting it half-carefully.

**Also surfaced, not fixed:** `duplicateSection()` (next-period room copy)
does not carry over a section's saved layouts, only its current desks — the
roster is intentionally reset to empty in a duplicate, so a carried-over
layout's seat assignments would be dead on arrival anyway, but the desks-only
layout shell might still be worth preserving. Left as a `newSection()` +
manual `desks` copy, unchanged from before this round; worth a look next
time someone is in `duplicateSection()`.

## What it does today

- Multiple **class sections**, each with its own floor plan and roster;
  rename, duplicate, delete
- **Multiple named layouts per section** — save the current desks and seats
  as "Testing rows", "Group pods", etc., and switch between them; the
  roster and Keep Apart / Put Together rules are shared across a section's
  layouts
- Furniture: add single desks, rows of N, pods of 4, "Make grid", remove
  desks, rotate a desk, lock a desk
- Roster: type/paste names, load a saved `np_rosters` roster, sort A–Z,
  last-name-first toggle, per-student note, per-student photo (one at a
  time, or in bulk matched to roster names by filename)
- Assignment: drag-and-drop between the unseated pool and the floor,
  click-to-place, **Auto-assign**, Shuffle, Clear seats, "Pick a student"
- **Constraints**: Keep Apart and Put Together pairs, with violation
  reporting on screen *and* on every printed chart
- A real **undo stack** (one of the few on the site), extended to bulk
  photo import and every layout action
- Zoom / actual-size view, a **mirror-view toggle** (teacher's-eye vs
  student's-eye), and an optional **seat number** on every desk
- A **storage-usage readout** (P12) showing how much of the ~5MB
  localStorage budget the current charts and photos are using
- Print one chart, **print all sections**, **print a blank/nameless chart**
  (for a seating quiz or a sub to fill in), a **sub-friendly export**
  (chart + per-student notes + keep-apart/put-together rules on one page), or
  a **whole-day sub packet** (a contents page flagging which periods carry
  notes or rule conflicts, then every section's sub export in order);
  independent print toggles for names, photos and rule conflicts; share a
  section by `state-link.js` URL

## Quick Wins

- **Done (2026-08-10) — Print a blank/nameless chart** for a seating quiz or
  for a sub to fill in. A dedicated "Print blank" toolbar button; names,
  photos and rule conflicts forced off, seat numbers forced on, independent
  of the persisted print checkboxes below.
- **Done (2026-08-10) — Print with photos vs without** as an explicit toggle
  — photo charts are for the teacher, name-only charts are for the sub.
  Persisted "Print: Names / Photos / Conflicts" checkboxes in the toolbar,
  honoured by both "Print" and "Print all sections."
- **Done (2026-08-10) — Numbered seats** as an option, so "seat 14" is a
  thing you can say aloud and so lab equipment can be assigned by seat. One
  toggle button, applies to the screen and every print mode.
- **Done (2026-08-10, confirmed pre-existing) — Front-of-room indicator** on
  the print layout. The `FRONT OF ROOM · BOARD` bar already printed before
  this round; verified it still renders correctly alongside mirror view and
  numbered seats.
- **Done (2026-08-10) — Mirror view toggle** — teacher's-eye view versus
  student's-eye view. One toggle button flips the floor left/right on screen
  and on paper; view-only (see Status for why free-dragging a desk is
  disabled while mirrored).
- **Done (2026-08-10) — Show constraint violations on the printed chart**,
  not only on screen. A "Seating rule conflicts" block prints under the
  chart on single print, print-all and the sub export.
- **Done (2026-08-10) — Bulk photo import** matched to names by filename,
  instead of one at a time. Exact match first, then a same-words-any-order
  match; pure logic in `matchPhotoFilenames()`, unit-tested.
- **Done (2026-08-10) — Storage-usage readout** (P12). A live KB-used-of-
  quota bar under the roster, with photo bytes called out separately. The
  underlying risk (photos still base64'd into `localStorage`) is unchanged —
  see the IndexedDB follow-up in Status.

## Major Features

- **Constraint solver worth the name.** Today's Keep Apart / Put Together is
  pairwise. The real request is richer: front-of-room accommodations, "must be
  near the door", "needs a partner who can read the board", vision/hearing
  seating, height ordering, and a scored auto-assign that satisfies as many
  soft constraints as possible and *explains* which ones it had to break.
- **Real room geometry.** Doors, windows, the teacher desk, lab benches,
  a projector wall, immovable obstacles — enough that the printed chart is a
  map of the room rather than a grid of boxes. The Schedule Visualizer already
  has a full tile-based floor editor; some of that machinery is reusable (P7).
- **Seating history and rotation.** "Nobody sits in the same seat two units in
  a row", "everybody sits in the front row once per quarter", and a record of
  who sat where when — which is exactly the artifact you want when a parent
  asks why their kid is at the back.
- **Done (2026-08-10) — Multiple layouts per section.** Rows for testing,
  pods for group work, a circle for Socratic seminar — saved as named
  arrangements (`section.layouts[]`) you can switch between and print,
  rather than rebuilding the room each time. The roster and Keep Apart / Put
  Together rules are shared across a section's layouts, not duplicated.
- **Done (2026-08-10) — Sub-friendly export** — chart plus notes plus "these
  students should not / should sit together" as a single printable page.
  Currently one section at a time (see Status for why); not yet wired into
  the Sub Binder Generator handoff (P7) — that cross-tool integration is
  still open.
- **Live mode.** Project the chart, tap a seat to mark absent, tag a
  participation point, or start a hall pass — turning the chart into the
  classroom's live control surface and feeding Behavior Points / Hall Pass Log.

## Moonshot / North Star

**The room, not the grid.** One saved model of the actual classroom that every
other tool can reason about: where each student sits, who is next to whom,
where the door is, which desks have outlets. Seating charts, lab groups,
group work, hall passes, and participation data all read from it, and the
teacher maintains it once at the start of a unit instead of five times in
five tools.

## Platform themes that matter here

- **P12 (storage quota)** — photos in `localStorage` is the acute risk;
  `blank-map-generator`'s IndexedDB cache is the pattern to copy.
- **P6 (print quality)** — the print layout *is* the deliverable here;
  page breaks across a multi-section print need care.
- **P2 (shared roster)** — already reads `np_rosters`; would benefit most from
  richer per-student records.
- **P11 (undo)** — already has the best undo implementation on the site; it
  should be the one extracted into a shared helper.

## Open Questions

- Is the photo feature actually used? It drives the storage risk and the
  privacy surface, and would be a reasonable thing to make opt-in with a
  clear warning if it isn't.
- Should the room model live here or in a shared "my classroom" store that
  Schedule Visualizer also writes?
