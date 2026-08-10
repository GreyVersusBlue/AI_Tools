# Improvement Prompts — Name Picker

**Tool file:** `Tools/Name Picker.html`
**Support folder:** `Tools/name-picker/` — `np-store.js`, `np-pick.js`, fonts, tests, `lib/qrcode.js`

**Current description (from README):** Pull a random student for cold-calls, groups, or who goes first. Rosters stay in your browser.

---

## Status

Reviewed — structural read of the source. The ideas below are deliberately
ambitious and are **not** scoped to a single session. Pick what fits; leave
the rest.

## What it does today

This is the largest and most feature-dense tool on the site (~2,400 lines).

- Pick modes: standard scatter-pick, **Slot Machine**, **Team Draft**,
  **Tournament**, Multi-Pick, Jump / Press Your Luck
- Roster management with multiple saved rosters (`np_rosters` — the shared
  roster key the rest of the site reads), absent toggling, sort A→Z
- Post-pick actions: Roll Again, Remove & Roll, Eliminate & Roll, Done
- **Stats & fairness**: per-student pick counts, Most/Least Picked sort,
  today's picks, history, Hall of Fame, achievements, combo tracking
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
- Is Tournament here redundant with `bracket-tournament-generator.html`?
