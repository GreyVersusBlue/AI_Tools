# SS demo round 2 — 050 Civics Role Cards — full simulation kit

Read `CLAUDE.md`, then `prompts/social-studies-demo-2/_preamble.md` and
follow it exactly, then
`improvement prompts/050-civics-role-card-generator.md` (Status top-down;
round 1 just shipped per-role case-file packets, seeded template case
files, and share link + QR — and explicitly deferred multi-save, with the
`crcg:` triple-key design sketched in its Status entry).

Your tool: `Tools/050-civics-role-card-generator.html` +
`Tools/civics-role-card-generator/test/` (2 suites). Uses `print-area.css`
(everything prints inside `#printArea`; no competing `@media print`; use
`min-height`, never fixed height + overflow hidden).

## Headline — From role cards to a full simulation kit

One tool prints the whole class period, not just the cards. Add optional
kit pieces, each individually toggleable at print time:

- **Agenda / script page**: an editable ordered list of phases with time
  boxes and a one-line teacher script cue per phase (e.g. opening
  statements 10 min, witness questioning 15 min, deliberation 10 min,
  verdict 5 min). Each built-in template ships a sensible default agenda.
- **Ballots / verdict slips**: small printable slips matched to the
  template type (juror verdict slips for mock trial, roll-call vote cards
  for the legislative sim, judge scoring slips for debate), auto-counted
  from the roles' copies so a full class set prints in one go.
- **Scoring rubric page**: a simple editable criteria×levels grid per
  speaking role (prepared evidence, responds to other side, civil tone,
  etc.), one per template with editable rows.
- **Reflection sheet**: a half-page exit reflection (what was your role,
  what was the strongest argument you heard, what would you argue
  differently) printed per student, with the assigned student's name
  carried over like the case-file packets do.
- Print flow: kit pieces print in a sane order (agenda → cards → case
  files → ballots → rubric → reflections), each section page-breaking
  cleanly, all inside `#printArea`.
- All three built-in templates ship with the kit pieces pre-filled so the
  whole thing demos from the defaults.

## Supporting (in order; cut from the bottom)

1. **Finish multi-save** (deferred from round 1): `crcg:list` /
   `crcg:data:<name>` / `crcg:current` per the sketch already in the
   improvement file; migrate the existing `crcg_roles_v1` blob in as the
   first named simulation; share-link import saves under a uniqued name
   instead of the round-1 confirm-and-replace. **Register the new keys in
   `Tools/009-backup-restore.html` `KNOWN_GROUPS`.**
2. **Two new templates**: UN Security Council resolution debate and a
   Constitutional Convention compromise session, each with roles, positions,
   talking points, case files, agenda, ballots, and rubric pre-filled,
   7th-grade friendly and politically neutral.
3. **Extend the smoke suites**: kit pieces render and page-break inside
   `#printArea`, ballot counts match role copies, reflection sheets carry
   assigned names, multi-save migrates the old blob and round-trips.

## Non-goals

Timers or live scoreboards; student-operated flows (the teacher runs it);
rubric-tool (034) integration; changes to the roster-assign machinery
beyond reuse.

## Notes

- Both existing suites green before you start and after every feature.
- New files → `sw.js` `PRECACHE_URLS` + `CACHE_VERSION` bump (test files
  excluded, matching existing handling).
- README row + index.html pitch: this is the round that changes the
  one-liner ("prints the whole simulation: cards, case files, agenda,
  ballots, rubric, reflections").
