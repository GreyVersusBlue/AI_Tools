# Improvement Prompts — 080 — Virtual Manipulatives Board

**Tool file:** `Tools/080-virtual-manipulatives-board.html`
**Support folder:** `Tools/virtual-manipulatives-board/test/` — the browser
suite (`smoke-boards.mjs`, wired into `npm test` as `test:manipulatives`).
Everything the page itself needs is still inline in the one file.

**Current description (from README):** Draggable base-ten blocks, fraction tiles, and algebra tiles on a shared board, plus a separate draggable number line, each with a one-click PNG snapshot.

---

## Status

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog — the most interactively complex tool built in this round.
A palette of base-ten blocks (unit/ten/hundred, each built from real
mini-square segments so a "ten" visibly reads as ten units), fraction tiles
(halves through twelfths, one segment shaded per tile), and algebra tiles
(&plusmn;1, &plusmn;x, &plusmn;x&sup2;, color- and size-coded the standard
way) can all be added to a shared board and dragged freely via Pointer
Events; each piece gets a hover-reveal delete button. A separate Number
Line tab has a configurable min/max range, click-to-add markers, drag-to-
move, and click-to-remove. Both the block board and the number line have
independent "Snapshot" buttons that draw the current contents onto a
`<canvas>` and offer a PNG download — no `html2canvas` dependency, just
manual rect-drawing per piece. No state persists across reloads (a
deliberate MVP cut — see Open Questions). Verified with a headless
Chromium smoke test simulating real pointer drag sequences (add pieces,
drag one, delete one, snapshot; add/drag/remove a number-line marker,
snapshot) — no console errors.

**Known limitation caught during the build, not yet fixed:** the snapshot
function reads `background-color` off each piece's first child to color its
canvas rectangle. This works correctly for single-color pieces (unit
blocks, algebra tiles) but the "ten" and "hundred" base-ten blocks are
built from many individual mini-square segments with no single background
color on their outer wrapper — a snapshot currently renders those two piece
types as blank/transparent rectangles instead of showing their segmented
look. Fixing this means either drawing each segment individually in the
snapshot loop, or giving the wrapper itself a representative fill color as
a simplification.

**2026-08-11 — Round 1 (session `h4rwxn`).** Fixed the snapshot color bug
above, and found it was actually broader than described: fraction tiles
are *also* built from `.seg` children with no background color on their
own wrapper, so they were rendering as blank rectangles in a snapshot too
(not just ten/hundred blocks) — same root cause, same fix. Number-line
marker snapshots had an unrelated instance of the identical bug pattern
(`.nl-marker` has no `background-color`, only a `color` CSS property for
its glyph, so the old code's `getComputedStyle(...).backgroundColor` read
was always transparent there too) — fixed as part of the same pass by
drawing a small filled triangle from the marker's `color` instead. `snapshotEl`
now special-cases any piece with `.seg` children (draws each segment
individually, its own color, its own border) and draws markers as a
triangle rather than a transparent rect. Verified with a headless
Playwright test that samples actual canvas pixel colors after a snapshot —
ten-block and hundred-block segments now paint their real on-screen colors
(`rgb(46,107,143)` and `rgb(31,53,80)` respectively, matching CSS exactly)
instead of leaving those regions blank.

Also shipped the duplicate-piece quick win: every piece now has a second
hover button (&#10064;) next to the delete &times; that re-adds an
identical fresh piece of the same type via the palette's own add
functions (`addByType`), landing at the board's next grid position rather
than exactly on top of the original. Verified via Playwright (add three
piece types, duplicate one, confirm piece count increments and no console
errors).

Snap-to-grid, touch-device tuning, and everything under Major Features
below remain unbuilt.

**2026-08-11 — Round 2 (session `m3r8ro`).** Shipped **saved board states**
(backlog rank 1), which also settles the Open Question below about
persistence: the answer turned out to be *both*. A named-boards bar above
the tabs does New/Save/Save as new/Rename/Delete plus `‹ Prev` / `Next ›`
stepping, so a teacher preps three demonstrations before class and walks
them in order; separately, the board in front of you is autosaved to
`vmb_working_v1` on every mutation and restored on load, so a reload or a
closed lid no longer discards the period's setup.

- **Storage.** `vmb_boards_v1` = `{v:1, boards:[{name, savedAt, state}]}`;
  `vmb_working_v1` = `{v:1, name, state}` where `name` remembers which saved
  board the working copy came from. A board's `state` is
  `{pieces:[{type,left,top}], line:{min,max,markers}}` — the number line
  travels with the board, which matters because a place-value demo and its
  number line are one demonstration, not two.
- **Serialization is DOM-derived**, since the DOM was already the only
  model: `serializeState()` reads `data-piece-type` plus `style.left/top`
  off each `.piece`, and `applyState()` replays them through the palette's
  own `addByType()` then repositions. That meant making `addUnit`/`addTen`/
  `addHundred`/`addFraction`/`addAlgebra`/`addByType` all *return* their
  element (they previously returned nothing) and hardening `addByType`
  against junk types from storage — an unknown type now returns `null`
  instead of falling through to `addAlgebra` and appending `undefined`.
- **What was fiddly.** (a) The autosave hook `touch()` has to be suppressed
  while `applyState()` rebuilds the board, or restoring a board immediately
  overwrites the working record mid-replay — hence the `restoring` flag.
  (b) Drag has no "changed" event, so `touch()` hangs off `pointerup` in
  `makeDraggable`, guarded on `dragging` so a stray pointerup doesn't write.
  (c) Loading over unsaved work is confirm-gated (P11), and *declining* has
  to snap the `<select>` back to the loaded board — otherwise the picker
  lies about what's on screen. (d) A rename onto a name that already exists
  is suffixed via `uniqueName()` rather than merging the two boards.
- **Deliberately not done:** no thumbnail/preview of a saved board in the
  picker (would mean storing a snapshot PNG per board — straight into the
  P12 quota problem), and Delete intentionally leaves what's on screen
  alone, deleting only the stored record.
- **Verified** with a new browser suite,
  `Tools/virtual-manipulatives-board/test/smoke-boards.mjs` (20 checks,
  `npm run test:manipulatives`): save/step/rename/delete, piece positions
  surviving a round trip, the number line saving with the board, the
  working board surviving a real `page.reload()`, the confirm gate being
  honored when declined, and zero console errors or offsite requests.

**2026-08-12 — Round 3 (backlog rank 7: snap-to-grid toggle).** A "Snap to
grid" checkbox on the board toolbar puts every drag on a grid whose cell is
one unit block, draws that grid faintly on the board while it is on, and
persists (`vmb_snap_v1`). Pieces added while snapping is on start on the grid
too, so the first drag of a new piece is a move rather than a correction.

**The interesting part was not the snapping — it was that the geometry didn't
agree.** A unit block is 26×26. A ten-rod was ten 24px segments with 1px gaps,
so 249px long and 24px tall; the hundred-flat was 250×229. Ten units snapped
into a neat row came to 260px, which meant the one thing base-ten blocks exist
to demonstrate — ten units *are* a rod — was visibly off by a rod's worth of
border, near enough to look right and wrong enough to undercut the point.
Every base-ten piece is now built from the same 26px square: the rod is
exactly ten units long and one unit tall, and the flat is exactly one rod wide
and ten units tall. That change is visible on existing boards, since piece
sizes come from CSS rather than from saved state — saved boards keep their
positions and gain the corrected sizes.

**Turning snapping on deliberately does not move anything.** Rearranging a
teacher's live demonstration the moment they tick a box is a surprise, and
this tool has no undo. "Align pieces" appears alongside the toggle as the
explicit way to pull an existing arrangement onto the grid.

Verified with a new 21-assertion headless Chromium suite,
`Tools/virtual-manipulatives-board/test/smoke-snap-grid.mjs` (folded into
`npm run test:manipulatives` alongside the existing saved-boards suite). It
drives real pointer drags rather than setting `style.left`, checks that an
unsnapped drag lands off-grid and a snapped one lands on it, measures that ten
units on consecutive cells span exactly one ten-rod, and confirms the toggle
moves nothing by itself. The existing saved-boards suite still passes
unchanged.

**Next round should pick up** an undo stack (P11) — this board destroys work
with Clear and has no way back, and Align pieces is now a second irreversible
action.

## What it does today

- Base-ten blocks (unit/ten/hundred), fraction tiles (2&ndash;12
  denominators), algebra tiles (&plusmn;1/&plusmn;x/&plusmn;x&sup2;) —
  add via palette buttons, drag freely, delete via hover-x, duplicate via
  hover-&#10064;
- The base-ten pieces share one 26px module: ten units are exactly a
  ten-rod, ten rods exactly a hundred-flat
- Optional snap-to-grid (one cell = one unit block) with the grid drawn on
  the board, remembered across visits, plus an explicit "Align pieces" for
  an arrangement that is already down
- Separate number line: configurable range, click-to-add/drag/click-to-
  remove markers
- PNG snapshot + download for either the block board or the number line,
  with every piece type (including segmented ten/hundred blocks and
  fraction tiles) and number-line markers now rendering their real
  on-screen color/shape in the exported PNG
- Saved boards: name a board (pieces + number line together), save,
  rename, delete, and step through the saved set with Prev/Next to run a
  prepped sequence of demonstrations
- The working board autosaves and comes back after a reload; loading a
  saved board over unsaved work asks first

## Quick Wins

- **Snap-to-grid for base-ten blocks** (optional toggle) so demonstrating
  "these ten units make a ten-rod" lines up visually without careful manual
  dragging.
- **Touch-device testing and tuning** — Pointer Events should work on
  tablets already, but this hasn't been verified on an actual touchscreen,
  and a projector setup often pairs with a touch-enabled front-of-room
  display or tablet.

## Major Features

- **Grouping/snapping semantics** — the real pedagogical value of physical
  manipulatives is composing them (ten units literally line up into a
  ten-rod; algebra tiles cancel in +1/-1 pairs). A "snap into place" or
  "combine" interaction, even a simple one, would make this feel like an
  actual manipulatives board rather than a bag of draggable shapes.
- **A labeled equation/expression readout** that updates live from what's
  on the board (e.g. "+2x + 3" from the current algebra tiles) — turns the
  board into a live worked-example generator, not just a visual aid.
- **A proper zero-pair/cancel animation** for algebra tiles (drag a +1 onto
  a -1 and both disappear) — the standard way algebra tiles demonstrate
  simplification, and currently unsupported (they just sit next to each
  other).

## Moonshot / North Star

**A manipulatives board where the physical intuition (ten units snap into
a rod, a +1 and -1 cancel when combined) is built into the interaction, not
left to the teacher narrating over static shapes.** Snapping and
cancellation turn "a board of draggable shapes" into "the thing physical
manipulatives are actually for" — showing *why* the math works, live,
instead of just displaying icons that represent it.

## Platform themes that matter here

- **P6 (print quality)** — not directly applicable (this is a live-display
  tool), but the snapshot feature is effectively this tool's "print," and
  the ten/hundred color bug is the equivalent of a print-quality defect.
- **P15 (first run)** — snap-to-grid and duplicate-piece both reduce the
  friction of getting a clean demonstration set up live, in front of a
  class, under time pressure.

## Open Questions

- ~~Should board state persist across reloads?~~ **Answered in Round 2:**
  both. The working board autosaves and restores; named boards are
  explicit. A "start fresh each period" button was not added — Clear board
  already does that, and it is now autosaved like any other change.
- Should a saved board carry a small preview image in the picker? It would
  make stepping through six prepped demos much faster to navigate, but a
  snapshot PNG per board is exactly the localStorage-quota trap P12
  describes. IndexedDB (the `bmg-map-cache.js` pattern) would be the honest
  way to do it.
- Is snap/cancel worth the real interaction-design complexity (detecting
  proximity, animating a merge/removal, handling ambiguous overlaps) for
  an MVP-grade tool, or does a simpler "align to grid" toggle deliver
  most of the pedagogical value for much less code?
