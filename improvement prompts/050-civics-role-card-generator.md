# Improvement Prompts — 050 — Government/Civics Simulation Role Card Generator

**Tool file:** `Tools/050-civics-role-card-generator.html`
**Support folder:** `Tools/civics-role-card-generator/` — `crcg-store.js`
(named saves), `crcg-templates.js` (the five built-in simulations), and the
test suites.

**Current description (from README):** Prints the whole simulation: role cards, private case files, an agenda with time boxes, ballots, a scoring rubric, and reflection sheets. Five starter templates (Mock Trial, Debate, Legislative Simulation, UN Security Council, Constitutional Convention) or build from scratch, saved by name.

---

## Status

**2026-08-14 — Devon-assigned round: save/open a simulation as a file
(session `c1jqjp`).** Shipped the JSON export/import that the previous
round's "where the next round should pick up" named as the clearer of the
two remaining Major Features, and for the reason it gave: the kit outgrew
the link.

- **"Save as file" / "Open a file…"** next to the existing link and QR
  buttons. The file is `<simulation-name>.civics.json` and carries the whole
  document — roles, talking points, and all six kit pieces.
- **Why a file at all, stated plainly:** a simulation now carries agenda,
  cards, case files, ballots, rubric and reflections, so a full one runs to
  tens of KB of URL. That is already past what a QR code can hold (the QR
  button has said so since the kit round), and past what some mail clients
  and chat apps carry without wrapping or truncating. A file has no length
  limit, survives email as an attachment, and works when the school network
  mangles long URLs — which was the failure mode the link path couldn't fix
  from inside.
- **One payload, two routes.** `sharePayload()` builds the JSON and both the
  link and the file use it; `adoptPayload()` validates, regenerates ids,
  names uniquely and opens, and both importers call it. The link path was
  rewritten to go through it rather than keeping its own copy — the whole
  point of doing it this way is that a later round *cannot* add a field to
  one route and not the other. The suite asserts the two payloads are
  byte-identical, so that stays true rather than being a good intention.
- **Import keeps the standing promise:** a file lands beside what is already
  saved, under a unique name, with fresh role and point ids, and replaces
  nothing. Two teachers who both started from the Mock Trial template can
  exchange simulations without colliding.
- **Junk is refused by name.** Valid JSON that isn't a simulation — the
  likely mistake, picking the wrong `.json` out of a downloads folder — gets
  an error that says what the file should have been, not a silent no-op or a
  half-loaded document. Same for a file that isn't JSON at all.
- The link-failure message now points at the file as the fallback, which is
  the advice a teacher actually needs when a pasted link arrives truncated.

**Tests.** New `smoke-file-transfer.mjs` (24 assertions): the exported file
carries the kit and not just the roles, a round trip lands beside the
original with no shared ids, link and file payloads match byte for byte, and
both flavours of junk are refused without saving anything. The three
existing suites pass unchanged.

#### Where the next round should pick up

- **The per-simulation roster memory** is now the only open Major Feature,
  and the note under it still stands: it should wait until the first Open
  Question below is answered, since the answer changes the feature's shape.
- **`crcg_roles_v1` and `crcg:` are still missing from
  `009-backup-restore.html`'s `STUDENT_KEYS`** — flagged two rounds running
  now, still out of scope for a hot-file edit in a parallel round, still
  changing year-end-clear behavior for anyone who assigns students to roles.
  Someone working in 009 should pick it up there.
- Export/import is a *document*, not a *deck*: there is no "export all my
  simulations" and no merge. If a teacher ever asks to move a whole library
  between machines, that is a different feature from this one.

**2026-08-11 — First build.** Shipped as a basic, functioning MVP from the
Ideas Backlog: three starter templates (Mock Trial: judge, prosecution,
defense, witness, juror; Debate: affirmative/negative teams, moderator,
judge; Legislative Simulation: bill sponsor, committee chair, opposing
and supporting legislators) plus a blank/custom option, each role fully
editable (name, position, add/remove talking points), printed as a
2-per-page card grid. Autosaves to `localStorage`
(`crcg_roles_v1`). Verified with a headless Chromium smoke test (default
Mock Trial roles render correctly including an em dash, template swap
with confirm-dialog accepted, print) — no console errors. One bug caught
and fixed before testing: several template `position` fields (and one
talking point) were originally written as JS string literals containing
the HTML entity text `&mdash;`/`&amp;` instead of literal characters —
the same class of entity-in-JS-string bug caught three times already in
this round (Verb Conjugation Reference Poster Generator, Sub Note /
Feedback Slip Generator, Science Fair Project Tracker) — fixed by using
literal em dash and ampersand characters in the source strings.

**2026-08-11 — Round 1 (session `8vo65u`).** Shipped two of the four Quick
Wins. Per-role "Copies" number field (1-40, default 1) next to the role
name — the print step now repeats a role's card that many times, so a
role several students share (jurors, witnesses) doesn't need to be typed
or duplicated N times just to get N cards. Duplicate-role button clones a
role (name, position, all talking points, fresh IDs) and inserts it
directly after the original, for building out similar roles — e.g. a
second witness with mostly-shared talking points — fast. Verified with a
headless Chromium smoke test: duplicated the first Mock Trial role (Judge)
and confirmed the role count went from 5 to 6, set that role's copies to
3, printed, and confirmed the printed card count matched exactly
(6 roles - 1 + 3 copies of the first = 8 total cards) — no console errors.

Assigning a student name per role and reordering roles/talking points
were not built this round — see "Where the next round should pick up"
below.

**2026-08-11 — Round 2 (session `szyio3`), layered on Round 1 above.**
Shipped the reorder Quick Win this note flagged as the smallest remaining
item: up/down buttons on both roles (in the role-block header, alongside
the existing Copies field and Duplicate button) and talking points
(independently, within each role) — matching the pattern used elsewhere
in the toolkit. Built directly on top of Round 1's copies field and
duplicate-role button (both preserved and re-verified working together)
rather than independently — an earlier attempt to merge this session's
and `8vo65u`'s branches via git's automatic 3-way merge left literal
conflict markers in the middle of `renderRoles()`, so the file was
rebuilt from `8vo65u`'s merged main state with this session's reorder
layer re-applied by hand instead of trusting the auto-merge. Verified
with a headless Chromium pass: moved a role down and confirmed the order
changed, set a role's copy count and moved a talking point, duplicated a
role (confirming Round 1's button still works), printed and confirmed
the card count matched (6 roles, one with 3 copies = 8 cards) — no
console errors.

**2026-08-12 — Round 3 (backlog rank 9: assign students to roles).** The tool
now reads `np_rosters` — the class list Name Picker and Class Roster Hub
already save — and prints each card with its student's name on it. Pick a
class list, optionally shuffle it, and press Assign; a card nobody is assigned
to still prints the blank name line it always did.

Three decisions worth recording:

- **Copies stopped being interchangeable.** The print path used to build one
  card string and repeat it `copies` times. Each copy can now carry a
  different name, so they are built individually. Had that been missed, a
  role's whole stack would have printed one student's name — which is exactly
  what the suite checks.
- **The class is bigger than the simulation, so the simulation grows.** A
  28-student class against a 21-card mock trial leaves seven students out. The
  default is to grow the role that *already has the most copies* — the jury,
  the audience, whichever role was built to scale — rather than adding a copy
  round-robin and ending up with eight judges. The summary line names the role
  it grew and by how much, so nothing happens silently. Untick the box and the
  leftover students are counted out loud instead.
- **That growth rule only works if the templates mean it,** and they didn't:
  every role in every template shipped at `copies: 1`, so "the biggest role"
  was a five-way tie that resolved to whoever was listed first — the judge.
  The templates now carry realistic counts (mock trial: 1 judge, 2+2
  attorneys, 4 witnesses, 12 jurors; debate 3/3/1/3; legislative 1/1/6/6),
  which is a better starting point on its own and is what makes the growth
  rule land where it should.

Roles saved before this round have no `students` array; `load()` gives them an
empty one, which means "nobody assigned" and prints exactly what it used to.

Verified with a new 28-assertion headless Chromium suite,
`Tools/civics-role-card-generator/test/smoke-assign-roster.mjs`
(`npm run test:civics-roles`): 28 students landing on 28 distinct cards, the
growth going to the jury and not the bench, distinct names across one role's
copies, the leftover count with growth off, blank name lines when there are
more cards than students, Clear names, a shuffle preserving the set, and an
old role set printing unchanged — no console errors.

**Next round should pick up** multiple named saved simulations, and per-role
case-file packets (already on the backlog).

**2026-08-14 — SS demo round (session `tjkd6u`), headline: per-role case file
packets (backlog rank 17).** Each role now carries an optional long-form
**Case file** textarea, right below Position. Printing appends one companion
packet page per printed copy of any role with case-file text, after the full
card grid: headed with the role name and — when a student is assigned to
that copy — that student's name (reusing the same `r.students[c]` lookup the
cards use). Each packet is forced onto its own fresh page
(`page-break-inside: avoid` plus `page-break-before: always`, and a
`min-height` rather than a fixed height, per the assignment note about that
combination silently clipping print output). All three starter templates
ship sample case-file text so the feature demos from the defaults: the mock
trial gets a locker-search fact pattern (shared by the Judge and both
attorney roles; the Witness gets a separate personal statement; the
Juror gets none, since real jurors shouldn't see outside case facts before a
trial), the debate gets a cell-phones-at-lunch resolution with a briefing per
role, and the legislative sim gets a recess-extension bill with a briefing
per role. That answers this file's open question about case files vs. talking
points (see Open Questions below): case-file content is different enough
from talking points (private background vs. public speaking points) to earn
its own field.

Two supporting items also shipped. **Share link + QR** (P3, copied from
`028-primary-source-analysis-generator.html`'s pattern): a role set is pure
text, so it travels intact through `state-link.js` — role, position, copies,
talking points, and case-file text all round-trip. Since multi-save (the
next supporting item) didn't ship this round, an incoming link can't be
filed away under its own name — it asks with a confirm dialog before
replacing whatever's on screen, and declining leaves the existing roles
untouched. **The smoke suite gained a sibling file**,
`Tools/civics-role-card-generator/test/smoke-case-file-packets.mjs`
(`npm run test:civics-case-files`, 27 assertions): packet count matches
copies, packets carry the right names in the right order, whitespace-only
case-file text prints no packet, typed case-file text survives a reload, and
the share link round-trips a full role set through both the accept and
decline paths of the confirm dialog — no console errors.

**Cut per the assignment's own cut rule:** multiple named saved simulations
(item 2 of the supporting list) — the tool still holds one flat role set per
browser. No new `localStorage` key was introduced this round (case-file text
lives inside the existing `crcg_roles_v1` blob), so `009-backup-restore.html`
needed no changes. Multi-save is still the right next step — see "Where the
next round should pick up" below.

**2026-08-14 — SS demo round 2 (session `pq4rvn`), headline: from role cards
to a full simulation kit.** The tool now prints the whole class period rather
than just the cards. Four kit pieces were added, each individually toggleable
at print time under "What prints": an **agenda page** (ordered phases with
time boxes, a one-line teacher cue per phase, a tick column and an auto
total), **ballots** matched to the simulation type (juror verdict slips,
roll-call vote cards, judge scoring slips), a **scoring rubric page**
(editable criteria rows against four editable level columns), and a
**half-page reflection sheet per student** carrying the assigned name and
role the way the case-file packets already did. Printing emits them in the
order the period runs: agenda, cards, case files, ballots, rubric,
reflections.

Four decisions worth recording:

- **"Who gets a ballot" is a flag on the role, not a list inside the ballot
  settings.** `role.ballot` means "print a slip for every copy of this role",
  so the slip count follows the copies count with nothing to keep in sync:
  12 jurors give 12 verdict slips, and the UN template lands on exactly 15
  vote cards because 5 permanent + 10 elected members is what the real
  Council is. Duplicating a role carries the flag, deleting one takes it
  away, and reordering does not matter. A list of role names inside
  `ballot` would have gone stale the first time a teacher renamed a role.
- **An empty kit piece prints nothing, which is what makes the print toggles
  safe to default on.** A simulation migrated from the old `crcg_roles_v1`
  blob has no agenda, no ballot options, no rubric criteria and no reflection
  prompts, so it prints exactly the cards and case files it always did even
  with all six boxes ticked. `repairDoc` therefore defaults kit content to
  empty and only the built-in templates supply real content. Defaulting the
  content instead would have silently added 40 pages to an old saved set.
- **The first thing printed must not force a blank page ahead of itself.**
  `.kit-section { page-break-before: always }` plus
  `#printArea > :first-child { page-break-before: auto }` — the id selector
  outranks the class, so whichever piece happens to be first (agenda today,
  the card grid if the agenda is unticked) never wastes a sheet. The
  case-file packets stay direct children of `#printArea` rather than getting
  wrapped in a section, because they already force their own break and
  wrapping them would have broken the existing suite's assertion about it.
- **The rubric keeps level descriptors generic on purpose.** A full
  criteria×levels grid would have meant writing 16 cells per template and 80
  across five, most of them padding. Instead each row carries the criterion
  and one "top score looks like" line, and the four column headings are
  shared and editable. That is the format a middle-school scorer actually
  circles, and it stays editable without a wall of text.

Both supporting items also shipped. **Multi-save** (deferred from round 1)
landed on the sketched `crcg:list` / `crcg:data:<name>` / `crcg:current`
triple-key pattern in a new `Tools/civics-role-card-generator/crcg-store.js`,
copied from `htcm-store.js`; the legacy `crcg_roles_v1` blob migrates in as
"My simulation" on first load and is left in place as a one-release backup,
and the new `crcg:` prefix is registered in `009-backup-restore.html`
`KNOWN_GROUPS`. That changed what a share link does: instead of round 1's
confirm-and-replace, an incoming link files itself away under its own uniqued
name ("My simulation 2") and touches nothing already saved, which is a
strictly better answer and is now asserted in both directions. **Two new
templates** shipped in a new `crcg-templates.js` (all five live there now, out
of the HTML): a **UN Security Council** resolution debate on earthquake relief
for a fictional country, and a **Constitutional Convention** compromise
session on representation in Congress. Both use the real institution's
structure and rules with a neutral question on the floor, and name roles by
job rather than by country or historical figure, so no student is asked to
argue a real nation's or real person's position.

Verified with a new 62-assertion suite,
`Tools/civics-role-card-generator/test/smoke-simulation-kit.mjs`
(`npm run test:civics-kit`): print order and the fresh-page break on every
section, agenda totals and cues, slip counts following copies both ways,
reflection names matching card names, a toggle only ever subtracting, the two
new templates' seat and vote counts, the legacy blob migrating in and
printing unchanged, and two named simulations keeping their own roles across
a reload. The two existing suites were updated where storage and the import
path genuinely changed (they read `crcg:data:<current>` now, and the old
"declining the confirm" case became "opening the same link twice never
overwrites") and are green at 28 and 28.

**Nothing was cut.** One thing deliberately not built: the Open Question
below about whether switching simulations should also swap the assigned
roster is still open, and the answer shipped here is the simple one — the
roster assignment stays a one-at-a-time action, and each saved simulation
just keeps whatever names were assigned when it was last open.

## What it does today

- **5 starter templates** (Mock Trial, Debate, Legislative Simulation, UN
  Security Council, Constitutional Convention) + blank, each shipping
  realistic per-role copy counts, sample case-file text, an agenda, ballots,
  a rubric and reflection prompts, so the whole kit demos out of the box
- **Multiple named saved simulations** (`crcg:list` / `crcg:data:<name>` /
  `crcg:current`), with New / Rename / Delete, migrating the old
  `crcg_roles_v1` blob in as "My simulation"
- Fully editable: role name, position, talking points (add/remove), and an
  optional long-form case file
- **Per-role copies count** — print N cards for a role N students share
- **Per-role "Votes" tick** — drives how many ballot slips print
- **Duplicate-role button** for cloning a role as a starting point
- **Reorder roles and talking points** via up/down buttons
- Assign a saved class list (`np_rosters`) across the role slots, optionally
  shuffled, growing the biggest role so nobody is left without a card
- **The full simulation kit**, each piece individually toggleable at print
  time and listed in a live "printing now would produce…" summary:
  - agenda page with time boxes, teacher cues, a tick column and a total
  - 2-per-page role card grid respecting copy counts and assigned names
  - one case-file companion packet per printed copy of a role that has one
  - ballot slips, 4 to a page, counted from the roles ticked "Votes", with a
    switch for a secret slip (blank name line) or a recorded one (name printed)
  - scoring rubric page, editable criteria rows against four editable levels
  - half-page reflection sheet per student, name and role already on it
- **Share link + QR code** — round-trips a whole simulation (state-link.js)
  and files an incoming one under its own uniqued name, replacing nothing

## Quick Wins

- ~~Reorder roles and talking points~~ — **shipped 2026-08-11 (Round 2).**
- ~~**Assign a student name to each role**~~ — **shipped 2026-08-12
  (Round 3)**, driven off a saved class list rather than a per-role text
  field; see the Round 3 note above.
- ~~**Facts/case-file attachments per role**~~ — **shipped 2026-08-14 (SS
  demo round)** as the round's headline; see above.

## Major Features

- ~~**Multiple named saved simulations**~~ — **shipped 2026-08-14 (SS demo
  round 2)** on the sketched `crcg:` triple-key pattern; see above.
- ~~**A scoring/rubric companion** tied to each role type~~ — **shipped
  2026-08-14 (SS demo round 2)** as part of the kit, built into this tool
  rather than handed off to Rubric Builder (034). Whether the two should
  share a rubric format is still an open cross-tool question; the kit's grid
  is deliberately simpler than 034's.
- ~~**JSON export/import**, for sharing a built simulation with another
  social studies teacher as a file rather than a link~~ — **done,
  2026-08-14** (session `c1jqjp`). `<name>.civics.json`, carrying the whole
  kit; link and file are built from one payload function so they cannot
  drift apart. See the Status entry.
- **A per-simulation roster memory**, so a debate and a mock trial each
  remember which class list they were built for (see the Open Question).

## Moonshot / North Star

~~**A full simulation kit generator — roles, private case-file details,
assigned student names, and a scoring rubric — built from one screen and
handed out ready to run.**~~ — **reached 2026-08-14 (SS demo round 2).** The
tool prints the agenda, the cards, the case files, the ballots, the rubric
and the reflections from one screen. The next horizon is the other side of
the period: capturing what came back (vote tallies, rubric scores) without
turning this into a gradebook, which the Non-goals have consistently ruled
out. Anything in that direction needs Devon's steer before it is built.

## Platform themes that matter here

- **P7 (cross-tool)** — the rubric pairing (Rubric Builder) is a direct
  opportunity; the assigned-student-name field already loads from Name
  Picker/Class Roster Hub (shipped Round 3), and the share link reuses
  028's state-link.js/QR pattern (shipped 2026-08-14).
- **P6 (print quality)** — **fixed in Round 1**: per-role copy count now
  drives the print step.
- **P15 (first run)** — the 3 starter templates already cover the most
  common classroom simulation types named in the backlog; more templates
  (e.g. a UN Security Council simulation, a constitutional convention) are
  natural low-effort additions.

## Open Questions

*(Both prior Open Questions are resolved: assigned-student-name pulls from a
saved roster — shipped 2026-08-12, Round 3 — and case-file content earned
its own distinct field rather than folding into talking points — shipped
2026-08-14.)*

- Named saves landed 2026-08-14 and this question is still open, because the
  round shipped the simple answer rather than deciding it: the roster
  assignment is a one-at-a-time action, and each saved simulation keeps
  whichever names were assigned when it was last open. Should switching
  simulations instead re-run the assignment against a class list remembered
  per simulation (so a debate and a mock trial each reopen for their own
  period), or is remembering the names good enough?
- The kit's rubric grid is deliberately simpler than Rubric Builder's (034).
  Should they converge on one format, or is a scoring slip a genuinely
  different object from a graded rubric? The assignment file ruled 034
  integration out of scope for this round, so nothing was assumed.

## Where the next round should pick up

The Quick Wins, Major Features and Moonshot are now all struck through
except JSON export/import and the per-simulation roster memory. JSON
export/import is the clearer next step and got more useful this round: a
simulation now carries five kit pieces, so the share link is much longer and
the QR path can overflow on a big one (the tool already says so and tells the
teacher to use Copy link, but a file would sidestep it and travels better by
email). The per-simulation roster memory should wait until the first Open
Question above is answered, since it changes the shape of the feature.

Two smaller things noticed while building and left alone on purpose:
`crcg_roles_v1` is not in `009-backup-restore.html`'s `STUDENT_KEYS` even
though it holds assigned student names, and neither is `crcg:` — that is
pre-existing, it changes year-end-clear behavior, and it was out of scope for
a hot-file edit in a parallel round. The kit's four editor sections
(add/move/remove rows against a list in a document) are the same shape as
half a dozen other builder tools and would extract cleanly into `_shared/`
one day.
