# HISTORY — what already shipped

Condensed from the planning documents retired on 2026-09-03. This file exists for two
reasons: `CLAUDE.md` cites past decisions and they need somewhere to be true, and the
"what we got wrong" notes have consistently been the most useful prose in this repo.

**Nothing open lives here.** Open work is in `BACKLOG.md`. If you find yourself wanting
to add a to-do to this file, it belongs there instead.

---

## Stage 2 — the platform foundation (2026-09-03 → 2026-09-04, in progress)

Six of the fourteen planned phases have shipped. The plan itself — four `_shared/`
services in dependency order, so that the tool paths become adoption rounds rather than
invention — survives as the ordering of `BACKLOG.md`'s first ten ranks.

**Path 3 P1 — `_shared/roster.js`, the roster service and the identity layer. #176,
`CACHE_VERSION` v144.** `np_rosters` — `{ "Period 3": ["Aiden Smith", …] }` — is read by
**28 tool pages** through roughly **six** distinct copy-pasted picker functions. Measured:
most parse the key twice per interaction, only two (050, 064) listen for the cross-tab
`storage` event, **none of the 28** sees a write made in its own tab, and five (017, 022,
033, 043, 084) call `rosters[n].length` with no `Array.isArray` guard inside a `catch` that
blanks the whole control — so one hand-edited entry hides *every* roster. `roster.js` is
`window.Roster`: the roster CRUD, the identity layer (`getStudents`, `resolve`, `matchName`,
`reconcile`, and `diffNames` added in P2), the parsing lifted out of 006, and
`mountRosterPicker`, whose options are built with `createElement` — which is why the file
has no escape helper at all. The four different escaping spellings across the six variants
were four answers to a question that only existed because they concatenated markup.

*The finding this phase turned on:* **reading `np_rosters` through `Store` is fine; writing
it through Store's envelope is catastrophic.** It would put `{"v":1,"data":{…}}` on disk and
all 28 readers would show a teacher an empty roster list with nothing to say why — and the
Name Picker *silently*, because `np-store.js`'s sanitizer walks the envelope's own keys,
drops both, and returns `{}`. So `store.js` gained `set(key, value, {raw: true})`: a bare
write for the handful of keys whose on-disk shape is a contract with tools that still
`JSON.parse` them directly, keeping the quota report, the same-tab announce and the blocked
fallback. Such a payload is legacy version 0 by store.js's own rule 2, so it round-trips
through an identity `migrate`. `crh_students_v1` is the same case. **Assertion 1 of
`Tools/roster/test/roster.test.mjs` is that guard, and it is the reason the suite exists.**

006 was the single adopter and got smaller: twelve `saveAll(all)` call sites became
`setRoster`/`removeRoster`/`renameRoster`/`replaceAll`, and 279 lines came out. Two
pre-existing bugs went with them — `loadRecords()` **discarded** any `crh_students_v1` whose
`version` was not 1, so a teacher who opened a newer build and then an older one lost every
preferred name and pronunciation silently; and `syncRecords`/`adoptNames` were two
hand-written copies of one matcher that had already drifted (only one guarded a non-string
name). `getStudents()` returns `id: null` for a name the sidecar has never seen: readers do
not mint, only 006 does, because two readers minting separately would be two different ids
for one student. `check-registry.mjs`'s wrapper detection learned `Store.set` alongside
`localStorage.setItem` — 006 both wraps its keys and adopts store.js, and without that all
three `crh_*` keys, every one student data, went STALE. **Adoption must never be the thing
that drops a tool out of that guard.**

**What this phase got wrong on the way.** The port introduced a real bug: "Move to another
roster" mutates two rosters and relied on one `saveAll` to persist both, so replacing that
one call dropped the destination silently. Nothing caught it, because **none of 006's twelve
write paths had a suite at all** — the two existing roster-hub suites only *read*
`np_rosters`. `smoke-roster-writes.mjs` (23 assertions, port 8407) was written for that, and
mutation-tested against exactly that bug. A NUL byte also reached the picker's
"type names manually" sentinel and survived every passing assertion until a test was written
for the option model. **Not verified:** nothing was seen on a real projector, a Chromebook
or a phone, and no screenshot pass was run.

**Path 3 P2 — bulk import in Class Roster Hub. #177, `CACHE_VERSION` v145.** 006 could
**export** a workbook and could not read one, and a six-period gradebook export had to be
imported six times by hand. Now: `.xlsx` through the existing lazy `loadXlsx()` injector
with each *sheet* its own table; many files at once, dropped anywhere on the page, walked
one at a time with a "2 of 6" label and each becoming a roster named after its file or
sheet; splitting one timetable export by its Period column into N rosters under an editable
`Period {value}` template; and a **diff before anything is written** — "1 new, 1 no longer on
it, 2 renamed, 0 unchanged" — from a new pure `Roster.diffNames`. The rename half is what
earns that function: a gradebook that switches to "Last, First" produces a rename for *every*
student, and without matching them the same import reads as "28 new, 28 left" and a teacher
reasonably concludes the file is wrong.

**`gvb-roster:meta.v1` was not built, on purpose** — Track R2 specifies it, but 006 already
stored period/subject/term on `crh_students_v1.rosters[<name>].meta`, so `source` and
`importedAt` joined them there rather than becoming a second answer to "what period is this
roster", plus a registry row and a backup surface. Rename-propagation, also listed under R2,
stayed deferred: nothing but 008 reads the id sidecar yet, so there is nothing to propagate
*to*. `BACKLOG.md`'s R2 text is struck and corrected rather than left to mislead.

**Two bugs caught by tooling rather than by eye, both in code written minutes earlier.**
`check:hidden-flex` found that `.map-row { display: flex }` beats the `hidden` attribute on
the new split controls — they would have been permanently visible; 006 had no `[hidden]`
rule. And mutation-testing the rename detection printed "**3 news, 0 unchangeds**":
`plural()` was being handed adjectives. Every passing assertion had accepted it, because
they regex-matched fragments; the diff text is now pinned in full. **Not verified:**
drag-and-drop is covered only through the file input, never through a real OS drag.

**A process note worth more than either feature.** A background task reported "completed,
exit 0" for a full-suite run that had been killed at suite 9 of 131 — the exit code was the
shell wrapper's, not the suite's. Reading the log rather than the notification is what
caught it. Two full runs were also thrown away and restarted because the tree was edited
after they began; a run is only evidence for the tree it started on.

**Path 4 P1 — `_shared/store.js`, the storage primitive. #173, `CACHE_VERSION` v142.**
The site had ~234 distinct localStorage key literals across 86 tools, each hand-rolling
the same three guards and getting them subtly different. `store.js` is `window.Store`:
a `{v, data}` envelope, a `migrate(fromV, data)` hook, `onChange` that fires in the tab
that wrote (the `storage` event never does, which is why all six hand-rolled listeners
missed their own writes), `estimate()`, and a write that can never fail silently.
*The migration contract is the deliverable*, and it is in the file header rather than
inferred from the code: an object with a numeric `v` **and** an own `data` property is an
envelope; anything else on disk is legacy at version 0, except a payload with a numeric
`__v`, which is an `assets/js/gvb-save.js` save read at its own version so the two modules
can share a key; a refusal returns the caller's default and **leaves the payload on disk**
rather than destroying data it cannot read; and no key is ever renamed, so there is no flag
day. Quota is detected with all four spellings browsers use — `035` had two *non-identical*
predicates in two places, neither checking both. `configure({onQuota})` re-renders the
message in a tool's own style and a handler that throws still falls back to the banner:
there is deliberately no way to suppress it. One adopter, 019, whose silent-catch
`loadStore`/`saveStore` is the same idiom in 017 and 001. Its student-facing `lock.html`
was left alone on purpose — "open Backup & Restore" is teacher advice, and that page runs
on a student's device.

**Path 4 P2 — `_shared/tool-registry.js` + `check-registry.mjs`. #174, `CACHE_VERSION` v143.**
87 rows covering 217 keys and 32 prefixes across 107 files, replacing 009's `KNOWN_GROUPS`
(76 rows) and `STUDENT_KEYS`/`STUDENT_PREFIXES`. **Thirty-eight tools had no label at all**
and were appearing in teachers' backups as unnamed "Other saved data" — which also meant
they were classified as settings and survived the end-of-year clear. 009 and 010 read it;
010's five hardcoded tool filenames became `ToolRegistry.href()`, one of which had an
unencoded space the other four had escaped. 009's IndexedDB scan now enumerates
registry-declared databases instead of `indexedDB.databases()`, which **Firefox has never
implemented** and where the page used to give up entirely and leave a teacher's whole
IndexedDB out of every backup; `rgb-audio` and `stviz-recovery` are labelled for the first
time. The guard and the extractor are one script on purpose, given this repo's history of
documenting commands that were never committed.

**Wave A1 — Path 5 P1, the theme architecture decision. #167, `CACHE_VERSION` v139.**
`a11y.js` is now the only thing on the site that reads or writes theme state or sets
`data-theme` on `<html>`. Dark arrives one of two ways and never both: **native**, for a
page that sets `window.A11Y_NATIVE_THEME = true` and ships real colours, or the
**filter**, `a11y.css`'s invert, for a page that has not. `ink-paper.css` gained a
`:root[data-theme="dark"]:not(.a11y-filter-dark)` block — *the gate is the point*, because
without it, shipping a dark palette would have re-coloured all 74 ink-paper tools **and**
left the filter inverting them on the same load. With it, the phase changed nothing for
the 73 tools that had not adopted, which is what made it safe to ship the palette and the
rollout separately. Two tokens were added and deliberately only two: `--card-2` and
`--accent-ink` (white in light, near-black in dark, because `#fff` cannot survive the
accent inverting). Theme now has three stored states, `'auto'` being the default that
follows the OS live and writes nothing; existing users do not move, because pre-Path-5
prefs always named a literal theme. One bug was fixed on the way through in *both*
mechanisms: a teacher who left dark mode on and hit Print got a dark page — print is now
on paper regardless of the screen. `001-hall-pass-log.html` was the single adopter, and
its QR canvas was an unplanned win: under the filter it had been inverted and
counter-inverted, and now renders true. `Tools/theme/test/smoke-theme.mjs`
(`npm run test:theme`, 47 assertions) guards the whole mechanism and was mutation-tested
both ways. **Not verified:** nothing was seen on a real projector or a Chromebook, and no
screenshot pass was run.

**Wave A2 — the accessibility label round. #168, `CACHE_VERSION` v140.** The 41
`select-name` and 23 `label` allowances in `Tools/a11y-sweep/allowlist.json` were fixed —
an accessible name each, then the line deleted — taking the allowlist from 91 page-rule
pairs on 59 pages to **22 on 22**, all but one of them `color-contrast`. The round's own
finding was that "one `aria-label` each" was wrong in kind, not just in size: a constant
`aria-label` on a repeated row passes axe and helps nobody, so names had to be derived
from row content. It shipped no new scripts, deliberately.

**#169 — two figures corrected.** The "17–45 hardcoded literals per tool" citation for
Path 5 P3 was removed rather than replaced: it swept in `white-space`, `@media print`
blocks and inline script, and was about 3× too high. The correction was made by deleting
the false precision, not by substituting a number nobody had measured.

---

## Stage 1 — infrastructure (2026-09-02 → 2026-09-03)

Both platform paths are complete. Stage 1 is what makes the shared-module work of Stage 2
safe to attempt at all.

**Path 1 — service worker. #161, #162, #164, #165.** An update bar replaced the
unconditional `skipWaiting()`, so a deploy no longer swaps assets under an open tab
(P1). `check-precache.mjs` fails when a live page's `src`/`href`, or a local file
`manifest.json` names, is missing from `PRECACHE_URLS`, or when a listed URL is dead or
duplicated (P2) — the survey had estimated the precache gap at 2; **measured, it was
12**, and two of the twelve were the maskable icons, whose reference lives in JSON rather
than an HTML attribute, so the guard had to learn to read `manifest.json`. The precache
split into two tiers (P3): `SHELL_URLS` at install, the rest fetched by a deferred pass a
few seconds after load, with `index.html` showing "Offline: N of 86 tools ready" — a first
visit installs ~3.6 MB rather than ~10.8. `manifest.json` gained shortcuts, screenshots
and a share target that `sw.js` answers itself with a 303 into Class Roster Hub (P4).
**Never verified on the live site:** the two-deploy update test and an OS share into the
installed app. Both are still open in `BACKLOG.md`.

**Path 2 — CI, the test runner, and the sweeps. #159, #160, #163, #165.** `npm test`
became `run-suites.mjs` reading an ordered list from `suites.json`, running every suite
even after one fails (P2) — the old `&&`-joined string stopped at the first failure,
which meant one assertion red since 2026-08-11 had been hiding the last 25 suites from
every run. GitHub Actions runs 9 guards, lint and every suite on each pull request (P1).
Suite-reliability tooling followed after CI's first day (P6), including the fix for an
`ECONNRESET` that was the harness's own keep-alive socket race, not a flake. The axe-core
sweep with a dated allowlist (P3), three read-only sweep guards — `check:entities`,
`check:hidden-flex`, `check:print-clip` (P4) — and ESLint (P5) landed together in #165.
Each sweep guard is a floor: it reports only what it can see statically, and everything it
prints is real.

**Path 14 P1 — the Seating Chart phone toolbar. #164, v136.** The site's one known-red
assertion, failing since 2026-08-11 because the toolbar's ~25 controls wrapped to 460px at
375px wide and pushed the chart 1132px down the page. Below 900px the toolbar is now one
sideways-scrolling row of the controls a teacher uses standing in the room, with a **More**
button that unfolds the desk-building and printing groups. Folded, the chart sits 740px
down an 812px screen. **The fix was in the tool; the assertion was not touched**, and
`suites.json`'s `expectedFailures` has been empty since.

**Also in #164:** the six Barlow faces used by five `_ds` tools were vendored to
`_shared/vendor/barlow/`, closing the last offsite font request, and the harness stopped
stripping a Google Fonts import out of served CSS — an offsite font request is now a
finding like any other.

---

## The `_shared/` deduplication (2026-08-10 → 2026-08-11)

The refactor plan's six phases, all closed.

**Phase 1 and 1b — vendored libraries.** jsPDF (+AutoTable), SheetJS, jsQR, qrcode.js and
jszip.min.js each became one canonical copy under `_shared/vendor/`, with a README
recording version, source URL, SHA-256 and consumers. No per-tool duplicate of any of the
six remains. The lesson that keeps costing time: **when comparing two copies of a library,
hash them with line endings normalized** (`tr -d '\r'`) — raw file sizes differ by CRLF
alone and will fool you.

**Round 1c — the test suites.** The suites were made runnable at all, and
`Tools/board-check/harness.mjs` (static server, Playwright launch, offsite-request
blocking) was written from scratch, because the original board-check folder **had never
been committed to this repo** — verified with `git log --all`. A root `package.json` for
dev-only test dependencies was a deliberate tradeoff: a committed lockfile and `npm ci`
against a documented global install that pins nothing. `dependencies` stays empty forever.

**Phase 2 — service-worker registration** extracted to `_shared/sw-register.js` across
~83 files.

**Phase 3 — theme adoption.** The variance audit's headline finding was that a literal
diff against `_shared/theme.css` is the wrong comparison, and the audit proved it. 38/38
of bucket (a) and 29/29 of bucket (b) migrated. The phase's original text claimed theme
toggling came from `_shared/theme-toggle.js`, "already used by 16 tools" — **both claims
were false**; the file was loaded by zero live pages and was deleted outright in Path 5 P1.
The rest of Phase 3 was superseded by Path 5.

**Phase 4 — common layout CSS.** `_shared/base.css` took the byte-identical `.card`,
`.app-header` and `.toolbar` rules; `npm run phase4:next` reports 0 remaining candidates,
with 68 tools linking it and 11 correctly never migrated because they have only per-tool
variants. Two things must survive from this phase. First, **`base.css` is safe for any
tool; `print-area.css` is not** — it blanks the page on print and restores only
`#printArea`. Second, **the cascade trap**: the migrated tools all had *two* `#printArea`
rules, `display: none` mid-stylesheet and the `@media print` block last, both at
specificity (1,0,0), so the print block only won by coming last. Moving just the print
block into a stylesheet that loads first would have made every one of those tools print a
blank page while looking fine on screen. Both rules moved together, in order, and the
negative control (reintroducing the inline `display: none`) was checked to confirm the
guard had teeth.

**Phase 5 — JS utility extraction: closed with nothing extracted.** A deliberate outcome,
not an abandonment.

**Phase 6 — the guard.** `npm run check:dedupe` fails if any of the six vendored library
filenames exists as a file, or is referenced by a live page, anywhere outside
`_shared/vendor/`.

---

## The improvement-prompts programme (2026-08-10 → 2026-08-14)

Eighty-one per-tool wishlists, worked in rounds by parallel sessions claiming tools in a
shared tracker. Pass 1 covered 46/46 tools across Rounds 1–10 (PRs #51–#65). Pass 2 reset
the list and ran a much larger set of concurrent sessions across roughly PRs #71–#89,
including several Devon-assigned batches, two ranked-backlog batches worked straight down
`IDEAS_BACKLOG.md`, and two social-studies demo rounds against tools 015, 028, 046, 050,
054, 056, 062 and 064. **441 of the ~1,320 recorded per-tool ideas were shipped** over
that fortnight; 880 remain open and are carried in full in `BACKLOG.md`.

Things worth not relearning:

- **Two sessions can claim in the same minute and never see each other.** On 2026-08-11
  two sessions were started in the same message, both read an empty claim table at 01:29
  UTC, and five tools were built twice. It surfaced at merge time as real conflicts in tool
  source, not just in the tracker, and one automatic 3-way merge silently duplicated UI
  elements and event handlers — it would have shipped a visibly broken double-button row if
  merged without someone reading the output. The mitigations are in `BACKLOG.md`'s claiming
  section.
- **A bug found six times by luck is a sweep waiting to happen.** An HTML entity written
  as text inside a JS string, then passed through `escapeHtml()`, shows the literal
  `&mdash;` on screen and in print. It was found by accident in 050, 069, 072, 073, 076 and
  079 before anyone swept for it; `check:entities` now does.
- **A fixed `height` plus `overflow: hidden` in a print block silently clips content**,
  which is worse than an overflow that looks bad, because the teacher has no way to know.
  Found in 047, 070 and 076; three slightly different fixes were shipped independently, and
  `check:print-clip` now finds the pattern.
- **`hidden` loses to `display: flex`.** A Blank Map Generator toolbar control had been
  visible whenever it shouldn't be. `check:hidden-flex` now finds this.
- **`BroadcastChannel` is same-device only** — proved empirically by 021's remote-control
  feature. Cross-device control needs WebRTC pairing.
- **A generator and the thing it generates drift.** 035's Publish button produced a
  034 with undefined helpers, and separately one missing three feature generations' worth of
  code. If a tool on this site builds a second artifact from a first, check they have not
  diverged before trusting the generator.
- **The multi-save convention is `list` / `data:<name>` / `current`** — named first in
  Formula Sheet Builder's `fsb-store.js`, copied by Plot Diagram Builder with a one-time
  migration from the old single-document key. Any tool moving from one document per browser
  to several should copy that shape rather than invent a new one.

---

## What we got wrong, collected

The most valuable paragraphs in the retired documents. Every one of these cost a session.

- **Three tools have been documented that were never committed.**
  `Tools/board-check/sync-social-tags.mjs` (which the social/OG meta blocks still claim
  generates them — they are hand-maintained, and have drifted into two branding
  generations plus one hybrid, with 41 tools carrying no block at all); the original
  `board-check` folder; and `list-dark-candidates.mjs` / `npm run path5:next`, which a
  handoff said shipped in #167 **and quoted the output of as fact**. A document that names
  a command is making a claim — run it once before you write it down. A guard that walks
  the tracked `.md` files for `` `npm run <x>` `` and fails on anything `package.json` does
  not define is thirty lines and would have caught all three; it is rank 12 in `BACKLOG.md`.
- **A handoff chain four documents deep, with one link that lived only as a file passed
  between sessions.** That is how a Wave A1 handoff came to describe a tool that does not
  exist and to claim a correction it had not made, with nothing in the tree able to
  contradict either. Hence one current file, in the repo.
- **A sweep-driven round can go green by breaking the page.** If a JS row template throws,
  the controls never render, axe reports the page clean, and every allowance comes out on a
  green suite. A guard's *silence* is not a pass; read the result back out of a browser.
- **Measure with a script, and commit the script.** A frozen wrong number in three files
  is worse than no number.
- **A flaky suite is a measurement problem before it is a fix.** Sort it by kind first: a
  property assertion over randomised behaviour fails at a real rate and needs its *budget*
  raised, never its assertion loosened; a crash or a timing race is a bug to root-cause,
  and a re-run is not a diagnosis; a fixture built around the real clock fails only in a
  window nobody tests in — both command-center suites failed after 23:20 local, and
  `--repeat` cannot find that one. And when the failing property is one a *teacher* would
  notice — "new code word" handing back the same word 1 time in 28 — the fix is in the
  tool.
- **A guard can be green because it cannot see the thing it is guarding.**
  `check-registry.mjs`'s first draft resolved localStorage call sites and looked
  complete: 203 keys, no unresolved sites. It was wrong four ways, and every one was
  found by *disagreeing with 009's old list*, never by reading the code. A tool that
  wraps localStorage in its own `readJson`/`writeJson` hides every key behind a
  parameter (006, and its three `crh_*` keys are all student data). `gvb-save.js`'s
  `createSaveSlot({key})` hid all fourteen Name Picker keys and made `np_rosters` look
  as though only 006 wrote it. A folder attributed to the first page that mentions it
  gave `name-picker/` to 006, which links there once, instead of to 007, which *is* the
  Name Picker. And `Store.get/set/remove` had to be followed, or every tool adopting
  `store.js` would have dropped out of the guard silently as adoption spread — the exact
  failure the guard exists to prevent, arriving through the front door. **Cross-check a
  new measurement against the stale thing it replaces; the disagreements are the
  findings.**
- **The same rule then invented a key that does not exist.** Reading `key:` alone made
  `np_bundle` a fifteenth Name Picker localStorage key; it is an export-only slot on a
  memory stub — "given a memory stub so it can never become a real key". A claim about
  it had already been written into 009's comment and the guard's header before the
  source was read. Both were corrected. An extractor over-reporting is as wrong as one
  under-reporting, and much easier to believe.
- **A browser test can pass while the feature is broken.** The first
  `smoke-quota-banner.mjs` filled localStorage with 512 KB chunks until one threw, then
  asserted the banner. It passed — because the first big write to fail still leaves room
  for a small one, and because overwriting an existing key with something no larger fits
  on a full disk. It now steps the chunk size down to one character and adds a station
  through the tool's own button, so the payload has to *grow*.
- **Two tools already have a private object called `Store`** (028 and 039, each with its
  own save/load/remove over a data prefix). They must rename before they can adopt
  `_shared/store.js`. Worth knowing before Path 4 P4 reaches them.
- **009's `gvb-command-center:excluded:` student-data rule could never have fired.**
  010 keeps that in `sessionStorage`, which dies with the tab and no backup has ever
  contained. It is the single classification difference between the old lists and the
  registry, and the registry suite asserts it stays the only one.
- **"Backups complete by construction" was the wrong claim.** BACKLOG said Path 4 P2
  would make backups complete; 009's own comment says it "backs up every localStorage key
  regardless". What was incomplete was the labelling, the student/settings split, and
  IndexedDB. Corrected rather than repeated.
- **Claims in these documents rot quietly.** `IDEAS_BACKLOG.md` insisted `index.html`
  carried "coming soon" rows that must be kept in sync; the convention had been retired and
  there were none. The platform themes were written when the site had 46 tools and still
  said so at 86. Verify a claim before you carry it forward.

---

## What was retired on 2026-09-03, and where it went

**#171, `CACHE_VERSION` v141.** One documentation consolidation replaced ~130 files and
34,614 lines with `BACKLOG.md` (open work, in full) and this file. Everything below is in
git history at `94dc004` and earlier.

The version bump was not cosmetic: pointing `ideas-backlog.html`, `index.html` and four
tool-page comments at the surviving files changed six precached pages, and
`check:precache -- --base origin/main` fails without it. Of the ~1,320 recorded per-tool
ideas, 904 came across and 417 were dropped as already shipped — 24 of those 417 turned
out to describe residual open work inside a bullet whose lead said "Done", and were kept
in place instead. **What was not done:** those 417 were classified by their own status
marker, cross-checked against the code only where the claim was structural (the missing
`list-dark-candidates.mjs`, the deleted `theme-toggle.js`, `phase4:next` reporting zero,
the absent `assets/fonts/`, the retired `.row.soon` rows). If one of them turns out to be
open after all, it is in git history, and this is the paragraph that says where to look.

**One item was already lost and recovered this way, within the hour.** The survey's
Baseline table carried a "Dead / unlinked" row — `index_backup.html`, `Tools/Old Designs/`,
`Tools/New Designs/`, `Other Landing Page ideas/`, ~590 KB unreferenced by anything. The
consolidation extracted the survey's *path sections* and hand-copied its *defect bullets*,
and missed that one row of the table sitting between them. Devon spotted the files in a
directory listing and asked why they still existed; it is now rank 104. The lesson is not
"be more careful" — it is that a table row above a bulleted list is exactly the shape an
extraction pass skips, and that the recovery worked because the originals are still in git.

| Retired | What it was | Where it went |
|---|---|---|
| `improvement prompts/` (84 files, 1.8 M) | 81 per-tool wishlists plus the platform themes, the site-wide request list and the round tracker | Open ideas → `BACKLOG.md` Tier 2 per-tool sections; themes → its Platform themes section; site requests and the tracker's open threads → its cross-cutting section; the round tracker's own history → above |
| `UPGRADE_PATHS.md` (104 K) | The top-20 ranked upgrade paths with phase lists | Open phases → `BACKLOG.md` Platform paths; Paths 1, 2 and 14 P1 → above |
| `REFACTOR_PLAN.md` (100 K) | The `_shared/` dedupe phases | Complete; summarised above, with the one open leftover in `BACKLOG.md` |
| `PLATFORM_PLAN.md` (28 K) | The four platform-wide big swings, Tracks R/B/P/V | `BACKLOG.md` Platform Plan tracks — all four, since Path 3 P1 and Path 10 P1 cite R1 and P1/P2 by name |
| `IDEAS_BACKLOG.md` (20 K) | The ranked per-tool enhancement table and the unbuilt-tool lists | The 39 ranked rows are `BACKLOG.md` ranks 110–148, in their existing order; the unbuilt-tool sections were all empty — every row had shipped |
| `REFACTOR_ROUNDS.md` (12 K) | Per-session prompts for the refactor plan | Superseded; the plan it drove is complete |
| `HANDOFF_NEXT.md`, `HANDOFF_STAGE_2.md`, `_A1.md`, `_A2.md`, `HANDOFF_2026-09-03.md` (72 K) | Five overlapping state handoffs | State → `BACKLOG.md`'s header; findings → above |
| `prompts/` (33 files, 192 K) | Paste-ready session prompts | Every tool they described has shipped, and several cited conventions that are now wrong (`_shared/theme-toggle.js`, `libs/`). The one reusable process prompt is replaced by `BACKLOG.md`'s "How to work this list" |
