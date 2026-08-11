# Improvement Prompts — 007 — Name Picker

**Tool file:** `Tools/007-Name Picker.html`
**Support folder:** `Tools/name-picker/` — `np-store.js`, `np-pick.js`, fonts, tests, `lib/qrcode.js`

**Current description (from README):** Pull a random student for cold-calls, groups, or who goes first. Rosters stay in your browser.

---

## Status

**2026-08-11 — Round 2 (session `m3r8ro`).** Shipped **weighted fairness
picking** (backlog rank 10): an optional persistent lean toward whoever the
lifetime pick counts say has been called least.

- **Why it is not the same thing as fair rotation.** Fair rotation solves
  fairness *within a round* — everybody once before anybody twice — and says
  nothing across rounds. Across a term that is where the drift lives: a student
  who joined in October, or who was out for the two rounds everybody else was
  called in, stays behind for good. `np_stats` had been recording exactly the
  counts needed to fix that and nothing had ever read them back.
- **Two new pure functions in `np-pick.js`.** `fairnessWeights(names, stats)`
  returns `(max − count + 1)` per student, so the least-called student in the
  room always has the largest weight and the most-called always has weight 1 —
  never zero. `weightedChoice(candidates, weights, rng)` does the draw, and
  treats a missing, zero, negative or non-finite weight as 1: a weighting bug
  must never silently make a student uncallable. `fairPick`, `uniformPick`,
  `pickOne` and `pickMany` all take an optional `weights` and default to
  exactly their old behaviour without one.
- **It composes with rotation rather than replacing it.** Rotation decides who
  is still owed a turn this round; weighting decides which of them comes up
  next. With both on, a round still calls everybody exactly once, but the
  students furthest behind come up at the front of it — measured at an average
  position of 2.05 of 8 versus 6.14 for the most-called.
- **The one thing weighting cannot override is the no-repeat rule.** Both
  pickers exclude whoever was called last, so even a student sixty calls behind
  tops out at every *other* pick. That is deliberate — being called twice
  running is precisely what a teacher does not want — and it caps the lean at
  50% in the browser suite.
- **The lean self-corrects**, because each pick increments the count it is
  weighing. A student who is far behind is drawn hard until they are not.
- Off by default: it changes odds a teacher may have got used to. Flipping it
  starts the rotation over, so the setting means the same thing whenever it is
  flipped. Stored as `weighted` in `np_options` alongside the others, with the
  store's own repair filling it in for anyone whose options predate it.
- **Verified twice.** `test/smoke.mjs` gained 15 assertions measuring the
  distribution over tens of thousands of draws (a student six calls behind goes
  from 16.8% to 58.4% of the next call; a 9:1 weight really draws 9:1; zero and
  negative weights read as 1). New `test/drive-weighting.mjs` (11 checks) then
  drives the actual page — seeded lopsided stats, the real button, forty real
  picks — because a checkbox that persists nicely and changes nothing is the
  obvious way for this feature to be wrong.

**2026-08-11 — note only (session `m3r8ro`, no behaviour change here).**
`np-details.js`'s implementation moved to `_shared/student-details.js` when the
Behavior & Points Tracker needed the same read of `crh_students_v1`; two copies
of the name-matching rule would have been the drift `CLAUDE.md` exists to stop.
`Tools/name-picker/np-details.js` is now a thin re-export with the same
exports, so this tool's import path and the 261-check Node suite are unchanged
(the suite was re-run and still passes). The shared file also gained
`parseIds`/`loadIds`/`lookupId` for following a student through a rename —
unused here so far, but available if the equity history ever wants the same
protection. Separately, `np-details.js` was never in `sw.js`'s `PRECACHE_URLS`
despite being imported by this page; both files are precached now.

**2026-08-10 — The equity dashboard, question-attached picks, reduced motion,
undo, dated absences, and the first read of Class Roster Hub's student record
all shipped.** Two new DOM-free modules (`np-equity.js`, `np-details.js`) and
one new storage key (`np_absent`); the Node suite went from 206 to 261
assertions and a 28-check Playwright pass covers the page itself.

What shipped, against the backlog below:

- **Cold-call equity dashboard (Major Feature)** — a new ⚖️ Equity tab, built
  on `np-equity.js`. Per student: picks inside a 7/14/30-day or all-time
  window, days since last called, lifetime total, sorted so never-called and
  longest-overdue come first. A one-line summary ("31 picks across 28
  students in the last 14 days · 3 never called on record") and a printable
  Participation Summary, which is the artifact the backlog said teachers are
  asked for and have no way to produce.
- **The change that made it possible: `np_history` entries now carry a
  `date`.** Lifetime totals cannot answer "who have I not called on in three
  weeks" — a student called eleven times in September looks identical to one
  called eleven times this week. `date` is additive and optional; entries
  written before it existed have none, are excluded from every windowed
  figure, and are counted and reported (`undated`) rather than silently
  assumed to be today.
- **Question-attached picks (Major Feature)** — and a real bug fixed on the
  way. The page has always written `prompt` onto the history entry, and
  `np-store`'s repair silently dropped it on every read, so a question
  attached to a pick never survived a reload. It is kept now, shown in the
  history list, carried into the text export (which gained Date and Question
  columns), and already appeared in the print report. Added **"Same question,
  next student"** on the winner modal — asking one discussion question of
  three students in a row previously meant re-rolling, which threw the
  question away and drew a new one.
- **Preferred name and pronunciation (Quick Win + P2 adoption)** — this is
  the Name Picker reading Class Roster Hub's `crh_students_v1` sidecar, via
  the new `np-details.js`. On the winner modal the preferred name becomes the
  big name, the roster name drops to a subtitle, and the pronunciation sits
  under it in italics. A teacher who has never opened Class Roster Hub sees
  no change anywhere. **This is the first consumer of that schema** — it was
  the "next round should pick up" item in `006-class-roster-hub.md` and it is
  done; the read-side helper other tools would copy is `np-details.js`.
- **`prefers-reduced-motion` (Quick Win, P4)** — confetti, fireworks,
  lightning, screen shake, chaos particles and the sudden-death explosion all
  route through one `motionOff()` check and fall back to a **still** flash
  (`staticCelebrate`), not a fade — "reduce motion" means do not move things,
  and a fade is still movement to some of the people who set it. Sound
  survives. There is also a **Calm mode** checkbox for the teacher whose
  device does not ask for it but whose room does, and the options page says
  plainly when the device setting is already in effect.
- **Undo the last pick (Quick Win, P11)** — an ↩️ Undo button in the header
  reverses the pick: history entry removed, pick count decremented, Hall of
  Fame entry dropped, rotation restored, and any student the pick took off
  the board put back.
- **Absences that survive the day and clear themselves (Quick Win)** — the
  new `np_absent` key, date-stamped. A refresh mid-period used to silently
  put every absent student back on the board. A list from an earlier day is
  never applied, but it is offered back ("4 students were marked absent on
  8/8 — mark them absent again?"), because multi-day absences are normal and
  re-ticking eight names is exactly the retyping this site exists to remove.
- **Bigger, calmer winner name (Quick Win, partial)** — the winner name is
  now `clamp(2.4rem, 7vw, 5rem)` so it scales with the projector instead of
  sitting at a fixed 3.5em. The larger half of that idea — theming becoming
  opt-in rather than the tool's personality — was not attempted.

**Challenges hit:**

- **Undo across a "Remove & Roll" was the one genuinely hard part**, and the
  first implementation got it wrong in exactly the case the feature exists
  for. Three modal buttons remove a student and *then* immediately roll
  again, so the snapshot the new pick took was of a board the student had
  already vanished from — undo reversed the new pick and left the mis-click
  intact. Fixed with `noteBoardRemoval()`, called just before each of those
  removals, which the next `markUndoPoint()` inherits. Anything added later
  that removes a name and re-rolls needs that call too.
- Undo is deliberately **one level, not a stack**. The case is a fat-fingered
  eliminate thirty seconds ago, not rewinding a lesson, and every extra level
  is another copy of the roster held for a scenario nobody has described.
- `np_current` records the names on the board but not *which* saved roster
  they came from, and the roster name is what picks the right set of
  preferred names out of the sidecar. Rather than add a fourteenth key,
  `inferRosterName()` matches the restored list against the saved rosters on
  load. It fails silently for a hand-typed list, which then falls back to
  "any roster that knows this name" — the right degradation, but worth
  knowing it is a guess.
- `np_history` is capped at 500 entries. Six classes a day fills that in a
  few weeks, so a 30-day window can be reporting on less than it claims. The
  equity view says so (`truncated`) rather than quietly under-reporting, but
  raising the cap — or summarising per-day counts into a separate rollup —
  is the real fix and is not done.
- The site's ES modules mean the page cannot be exercised from a `file://`
  URL (module CORS); the browser pass runs against a local static server.

**Where the next round should pick up:**

1. **The 500-entry history cap** is now load-bearing for a feature teachers
   might be asked to defend. Either raise it or add a per-day rollup key that
   survives the trim.
2. **Seat-position distribution** — the equity report's most interesting
   unbuilt column, and it needs `seating-chart-v1` (P7). "You call on the
   back row a third as often" is a sharper finding than any of the numbers
   currently shown.
3. **Split the file.** Still 2,400+ lines, and this round added to it. The
   themes table, the sound engine, and each pick mode are the obvious
   extractions; `np-store`/`np-pick`/`np-equity`/`np-details` show the shape.
4. **Second-screen mirror (P9)** and **theme packs as data** are untouched.
5. **Team Draft still ends in a board**, not an artifact — the handoff to
   Group/Team Generator and the bracket seed are unbuilt.
6. The **Open Questions** below are unchanged and still want Devon's call —
   particularly whether the participation data should have its own front door
   and its own erase button now that it is a reportable artifact rather than
   a bar chart.

## What it does today

This is the largest and most feature-dense tool on the site (~2,400 lines).

- Pick modes: standard scatter-pick, **Slot Machine**, **Team Draft**,
  **Tournament**, Multi-Pick, Jump / Press Your Luck
- Roster management with multiple saved rosters (`np_rosters` — the shared
  roster key the rest of the site reads), absent toggling, sort A→Z
- Post-pick actions: Roll Again, Remove & Roll, Eliminate & Roll, Done
- **Stats & fairness**: per-student pick counts, Most/Least Picked sort,
  today's picks, history, Hall of Fame, achievements, combo tracking; **fair
  rotation** (everybody once before anybody twice) and an optional **lean
  toward who has been called least**, weighting each draw by the lifetime
  counts so a student who joined late or was absent catches up across the term
- Groups: Make Random Groups, Reshuffle, print rosters
- Discussion prompts bank with its own save/load
- Heavy presentation layer: themes (Space, Ocean, Forest, Medieval, Ancient
  China, Byzantine, Halloween, Stars & Stripes, Sunset, Classroom Light),
  confetti, fireworks, lightning, "Let's Go Crazy" chaos particles, retro
  unlock, sudden death, soundboard with several synthesized sounds
- **Data tab**: shows every key the tool writes, backup to file, restore from
  backup, erase student data, erase everything
- Roster sharing by QR code and by `state-link.js` URL

## Quick Wins

- **`prefers-reduced-motion` respect.** Confetti, fireworks, lightning, and
  chaos particles should all fall back to a static celebration. There are
  students for whom this matters medically, not just aesthetically.
- **Weighted fairness mode, on by default as an option.** "Never pick the
  same student twice until everyone has gone" already exists in spirit via
  Remove & Roll, but a persistent low-weight bias toward least-picked students
  is a better default than uniform randomness and takes little code given
  stats are already tracked.
- **Absent list that survives the day and clears itself.** Marking absent is
  a daily action; it should be date-stamped and offer "clear yesterday's
  absences" on open.
- **Pronunciation field per student**, shown next to the picked name. Small
  feature, disproportionate impact for a teacher with a new roster.
- **Bigger, calmer default.** The winner modal is the projected moment; make
  the name the largest thing on screen at all times and let the theming be
  opt-in rather than the personality of the tool.
- **Undo the last pick** (P11) — currently a mis-click that eliminates a
  student is unrecoverable.
- **Split the file.** At 2,400 lines with 100+ top-level functions, the
  themes, sound engine, and each pick mode should move into
  `Tools/name-picker/` modules the way `np-store.js` and `np-pick.js` already
  did. This is the enabling refactor for most of the Major Features below.

## Major Features

- **Cold-call equity dashboard.** The stats already collected are one step
  away from something genuinely useful: who has been called on this week, who
  hasn't been called on in three weeks, distribution by seat position (pair
  with Seating Chart Generator), and a printable summary. Teachers are
  frequently asked to demonstrate equitable participation and currently have
  no artifact for it.
- **Question-attached picks.** Combine the prompts bank with the picker so a
  pick is "student + question", logged together — turning a random-name tool
  into a discussion-facilitation tool. Feeds the exit ticket and number talks
  workflow.
- **Real roster records instead of name strings** (P2). Stable IDs, preferred
  name, period, photo, do-not-cold-call flag. This is the schema decision
  that unblocks the other 14 tools reading `np_rosters`, and it should be
  designed *here* since this tool owns the key.
- **Team Draft that produces a usable artifact.** The draft is fun but ends
  in a board; it should hand off to Group/Team Generator, print team sheets,
  and optionally seed a bracket in the Tournament Generator (P7).
- **Second-screen mirror** (P9). The picker on the projector, the roster and
  controls on the teacher's phone — the pattern Classroom Timer already
  proved with `webrtc-pair.js`.
- **Sound and theme packs as data, not code.** Let a theme be a small JSON
  object so new ones can be added without touching the engine, and so a
  teacher could build a unit-themed board (a "Rome" theme for the Rome unit).

## Moonshot / North Star

**The participation memory for the whole year.** Every pick, every group,
every role, every hall pass, every cold call — already scattered across this
tool, Group Generator, Lab Role Randomizer, and Novel Circles — rolled into
one local, private, per-student picture the teacher can glance at before a
parent conference or an IEP meeting and print. Nothing leaves the browser;
everything is one click to erase. This tool already has the strongest data
transparency UI on the site (the Data tab), which makes it the right place to
hold that responsibility.

## Platform themes that matter here

- **P2 (shared roster)** — this tool *is* the schema owner. Any roster
  redesign starts here.
- **P4 (accessibility)** — the animation load is the heaviest on the site.
- **P11 (undo)** — destructive picks need to be reversible.
- **P12 (storage quota)** — if student photos land in `np_rosters`, this key
  becomes the biggest object on the site and needs IndexedDB.
- **P1 (projector mode)** — has bespoke theming that predates `theme.css`;
  reconciling the two needs care so the fun themes survive.

## Open Questions

- How much of the game layer (achievements, combos, retro unlock, sudden
  death) is actually used, versus fun to build? Worth deciding before adding
  more of it — some of it may be worth retiring to make room.
- Should the fairness/equity data live here, or in a separate tool that reads
  from here? It is arguably sensitive enough to want its own front door and
  its own erase button.
- Is Tournament here redundant with `020-bracket-tournament-generator.html`?
