# Improvement Prompts — 080 — Virtual Manipulatives Board

**Tool file:** `Tools/080-virtual-manipulatives-board.html`
**Support folder:** none yet — everything is inline in the one file.

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

## What it does today

- Base-ten blocks (unit/ten/hundred), fraction tiles (2&ndash;12
  denominators), algebra tiles (&plusmn;1/&plusmn;x/&plusmn;x&sup2;) —
  add via palette buttons, drag freely, delete via hover-x
- Separate number line: configurable range, click-to-add/drag/click-to-
  remove markers
- PNG snapshot + download for either the block board or the number line

## Quick Wins

- **Fix the ten/hundred snapshot color bug** described above — the
  highest-priority fix, since it's a visible gap between what's on screen
  and what gets exported.
- **Snap-to-grid for base-ten blocks** (optional toggle) so demonstrating
  "these ten units make a ten-rod" lines up visually without careful manual
  dragging.
- **A "duplicate this piece" button** next to delete, since demonstrating
  most base-ten/algebra concepts needs several of the same piece (e.g. 23
  = 2 tens + 3 units) and clicking the palette repeatedly for identical
  pieces is more friction than it needs to be.
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
- **Saved board states** (name and reload a board setup), so a teacher can
  prep several demonstrations ahead of class and step through them instead
  of rebuilding each live.
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

- Should board state persist across reloads (`localStorage`, matching
  every other tool in this toolkit) or is "always starts blank" actually
  the right default for a live-demonstration tool that's reset before every
  class period anyway? If saved boards (Major Features) ship, persistence
  becomes necessary either way.
- Is snap/cancel worth the real interaction-design complexity (detecting
  proximity, animating a merge/removal, handling ambiguous overlaps) for
  an MVP-grade tool, or does a simpler "align to grid" toggle deliver
  most of the pedagogical value for much less code?
