# Improvement Prompts — Seating Chart Generator

**Tool file:** `Tools/Seating Chart Generator.html`
**Support folder:** `Tools/seating-chart/` — `scg-photo.js` and assets

**Current description (from README):** Build a chart once, then reshuffle it whenever you need to.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Multiple **class sections**, each with its own floor plan and roster;
  rename, duplicate, delete
- Furniture: add single desks, rows of N, pods of 4, "Make grid", remove
  desks, rotate a desk, lock a desk
- Roster: type/paste names, load a saved `np_rosters` roster, sort A–Z,
  last-name-first toggle, per-student note, per-student photo
- Assignment: drag-and-drop between the unseated pool and the floor,
  click-to-place, **Auto-assign**, Shuffle, Clear seats, "Pick a student"
- **Constraints**: Keep Apart and Put Together pairs, with violation reporting
- A real **undo stack** (one of the few on the site)
- Zoom / actual-size view
- Print one chart or **print all sections**; share a section by
  `state-link.js` URL

## Quick Wins

- **Print a blank/nameless chart** for a seating quiz or for a sub to fill in.
- **Print with photos vs without** as an explicit toggle — photo charts are
  for the teacher, name-only charts are for the sub.
- **Numbered seats** as an option, so "seat 14" is a thing you can say aloud
  and so lab equipment can be assigned by seat.
- **Front-of-room indicator** on the print layout. A chart printed without
  knowing which way it faces is a chart a sub will read backwards.
- **Mirror view toggle** — teacher's-eye view versus student's-eye view is a
  perennial confusion in every seating tool ever made.
- **Show constraint violations on the printed chart**, not only on screen.
- **Bulk photo import** matched to names by filename, instead of one at a time.
- **Storage-usage readout** (P12). Photos are base64'd into `localStorage`
  today; a class set will approach the quota and the failure mode is silent.

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
- **Multiple layouts per section.** Rows for testing, pods for group work,
  a circle for Socratic seminar — saved as named arrangements you can switch
  between and print, rather than rebuilding the room each time.
- **Sub-friendly export** — chart plus notes plus "these three students should
  not sit together" as a single printable page, handed straight to the Sub
  Binder Generator (P7).
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
