# BACKLOG — the one list

**This file is the entry point for open work.** Read `CLAUDE.md` first, then this.

On 2026-09-03 this replaced ~130 planning files — twenty ranked upgrade paths, a refactor
plan, a platform plan, an ideas backlog, five overlapping handoffs, a folder of session
prompts and 84 per-tool wishlists, 34,184 lines in all. Every open idea moved here in
full; everything that had already shipped was condensed into `HISTORY.md`, which also
lists exactly what was retired and where to find it in git history. Nothing was
summarised on the way in.

## How this repo is worked

**The standing instruction is: "work the next batch of ranked items in `BACKLOG.md`, open a
PR, merge to `main`."** That is the whole loop, and it is expected to run without anyone
watching it. Three rules follow from that, and they override any older wording in this file:

1. **Never stop to ask.** Devon is not reviewing these rounds and has said so
   (2026-09-05). If a row needs a judgement call, make it: take the standing default from
   [Standing decisions](#standing-decisions) if one is written, and otherwise decide it
   yourself, ship it, and record the call and its reasoning in `HISTORY.md` so it can be
   reversed cheaply. A decision recorded and shipped is worth more than a decision deferred.
   Any "ask Devon", "open question for Devon" or "worth Devon deciding" note left in Tier 2
   from an earlier era means *decide it and write down what you decided*.
2. **Do not park work on a person.** A row only a human at a real device can do does not
   belong in the ranked table; it goes in the parked list under Cross-cutting. The one such
   row has already been moved there.
3. **Size the batch by the Size column, not by a count.** See below. It used to say "the
   next two", which was right while the top of the list was quarter-session rows and wrong
   the moment it reached a 2+ row.

### How big a batch

The rule is the **Size** column, because a fixed count means something different at rank 2
than at rank 7:

| Size | Take | Why |
|---|---|---|
| ¼ | up to **4**, and they may share one PR when they are the same kind of work | CI is ~21 minutes per PR and is the real bottleneck, so rows-per-PR is nearly free while PRs-per-session is not |
| ½ | **2**, occasionally 3 | |
| 1 | **one** | |
| 2+ | **that row is the whole batch** | never pair it with anything |

**A 2+ row will not finish in one session, and that is expected.** Do one increment of it —
Path 5 P3 says "batches of ~6" and means it — ship that, and **leave the row in place**, with
its Item text rewritten to say what is done and what is left. Do not delete a 2+ row until it
is actually finished. A session that hits one and stalls, or one that tries to swallow it
whole, are both worse than one honest increment.

**Do not mix sizes to fill a quota.** Four ¼ rows is a good batch; two ¼ rows and a 2+ row is
not, because the 2+ row will absorb whatever time the others leave and finish neither well.

**Whatever the batch size, step 6 happens after each merge — never saved for the end.** This
is the rule most likely to be dropped as batches grow, and it is the one with a recorded
failure behind it: a session working two phases meant to write both handoffs at the end, its
first PR merged with its row still in the ranked table, and the next session spent about an
hour building something that already existed. See the note in "Where things stand".

The two things that still are not a session's call, because they change what the product is
rather than how it is built: **promoting anything student-facing** (see the scope rule under
"Rules the sources agreed on"), and **re-ranking the list wholesale**. Everything else is
yours.

## Where things stand — start here

*Current as of `main` after PR #193, 2026-09-05. Rewrite this header when your phase
merges — that is step 6 of the definition of done, and it is not optional.*

**Last shipped.** Ranks 1 and 2 — the last two storage eras and `gvb-save.js` (#193,
`CACHE_VERSION` **v152**), two ½ rows in one PR. **`_shared/store.js` has now reached all
three key-naming eras it was written for**: 063's `{v: 1, text: …}` custom story (which is
*not* a Store envelope — rule 1 wants a numeric `v` **and** an own `data` property — and so
reads as legacy version 0) and `Tools/school-calendar/scv-store.js`, which writes with
`raw: true` because 010 reads `scv_calendar_v1` with a plain `JSON.parse`. And
`assets/js/gvb-save.js` **moved to `_shared/gvb-save.js`** — `assets/` now holds only icons
and screenshots — and its `save()` stopped swallowing failed writes: through
`Store.set(…, {raw: true})` when the slot's storage is the page's own localStorage, through a
new `Store.reportWriteFailure` when the caller injected its own. Three claims in this file
were wrong and are corrected below. Before them, ranks 1 and 2 — 034's
`aria-required-children` and the install tier (#191, `CACHE_VERSION` v151), two ¼ rows in one
PR. The accessibility allowlist now holds
**nothing but `color-contrast`**: 034's `.mode` was a `role="tablist"` over six plain buttons
and is now a real tab pattern — roving tabindex, Arrow/Home/End, one `tabpanel` — in all three
places it exists, because 034 is a *published snapshot* and fixing only it would be undone by
the next Publish; and jsPDF and SheetJS left `SHELL_URLS`, 85 entries / 3.86 MB → 82 /
2.63 MB. Before them, ranks 2
and 3 — `check:docs-commands` and `check:adoption` (#187, **no
`CACHE_VERSION` bump**: nothing precached changed). Two read-only guards over the claims this
repo's documents make, and both found real drift on their first run — three dead `npm run`
citations left over from the never-committed `board-check` package, and a sentence in this
file naming the wrong two consumers of `student-details.js`. See `HISTORY.md` and the notes
below. Before them, Path 3 P3 and P4 — the picker rollout across 31 tools (#184,
`CACHE_VERSION` v149) and the rename helper with its eight adopters (#185, v150). Between
them they are the first two rows of the old list, and the first rounds on this site that were
pure adoption: no new service, **31 tool pages** touched between them (P4's eight are all
inside P3's thirty-one), and `_shared/roster.js` from one adopter to thirty-two. Before them, Path 4 P3 and Path 14 P2 — the shared media store
(`_shared/media-db.js`, adopted in 046) and one reader of the seating chart
(`_shared/seating-read.js`, adopted in 010), both in #182, v148; Path 6 P1 and Path 5 P2 —
the share sheet with its measured QR budget (#178, v146) and the fullscreen/projector helper
(#180, v147); Path 3 P1 and P2, the roster service and Class Roster Hub's bulk import (#176
v144, #177 v145); Path 4 P1 and P2, the storage primitive and the tool registry (#173 v142,
#174 v143); Stage 2 Wave A2, the accessibility label round (#168, v140); and Wave A1, the
theme architecture decision (#167, v139).

**Every `_shared/` service on the Stage 2 spine has shipped, the storage era is closed, and
what is left at the top is dark mode.** Ranks 1 and 2 are the two ½-session Path 5
prerequisites — rebuilding `list-dark-candidates.mjs`, and the three remaining hand-rolled
stages — and **rank 3 is Path 5 P3, the first 2+ row.** Take 1 and 2 together as one batch;
take 3 alone, do one increment of ~6 tools, and leave the row in place.

**Write step 6 after each merge, not after the batch.** On 2026-09-04 two sessions rewrote
this header at once and it had to be merged by hand: #178 merged before its session had
written step 6 (it was mid-way through its second phase, #180, and meant to write both at the
end), so its row was still in the table at what was then rank 3 when the parallel roster
session's #179 branch found it and removed it. A row still in the table after its PR merged
tells the next session to build what already exists, and it did so for about an hour. The
claim table itself worked, both then and for #182: sessions took different rows and no source
file conflicted.

**Numbers, all re-measured against the tree on 2026-09-05:**

| Fact | Value |
|---|---|
| `CACHE_VERSION` | `v152` (→ v152 in #193; a precached file was renamed in both tiers — `assets/js/gvb-save.js` → `_shared/gvb-save.js` — and four tool pages changed) |
| Precache entries | 257 in `PRECACHE_URLS`, **82** of them in the `SHELL_URLS` install tier — 2.63 MB of 10.89 MB, unchanged by #193, which renamed one entry in each list rather than adding or removing one |
| Suites | **142** in `Tools/board-check/suites.json`, green locally (24.0 min) and in CI (22.2 min on the merged head); `expectedFailures` **empty**. The new one is `Tools/grammar-mad-libs/test/smoke-storage.mjs` |
| Read-only guards | **11**: `dedupe`, `tests`, `social`, `precache`, `entities`, `hidden-flex`, `print-clip`, `registry`, `lint`, `docs-commands` and `adoption`. All run in CI. `check:precache` is one guard running **six** always-on checks since #191 (SHELLDEP is the sixth) plus the opt-in BUMP |
| Accessibility allowlist | **21 page-rule pairs on 21 pages, every one `color-contrast`** — 034's `aria-required-children` was fixed and its line deleted in #191, and it was the last non-contrast allowance on the site |
| Tool registry | 87 rows, **217 keys and 32 prefixes across 109 files** — `__scv_probe__` retired and `__gvb_save_probe__` declared for the first time, so the total is unchanged for two unrelated reasons; four IndexedDB databases declared; `check:registry` green, `dynamic` empty everywhere |
| Shared-file adoption (of 86) | `sw-register.js` 85 · `a11y.css` 77 · `a11y.js` 77 · `ink-paper.css` 71 · `base.css` 68 · `store.js` 36 · `roster.js` 32 · `print-area.css` 20 · `state-link.js` 17 · `qr-scan.js` 10 · `webrtc-pair.js` 7 · `theme.css` 5 · `tool-registry.js` 2 · `duplex-print.js` 1 · `gvb-save.js` 1 (+1 via a module) · `media-db.js` 1 · `qr-draw.js` 1 · `seating-read.js` 1 · `share.js` 1 · `stage.js` 1 · `student-details.js` 1 (+1 via a module) |
| Printing | 78 tools call `window.print()`; 63 carry a hand-written `@media print` block |
| Tools | 86 (`001`–`086`); next free number **087**. 81 of them have recorded open ideas |
| Tier 1 rows | **176**, a contiguous 1..176 — three fewer than #191 left, because #193 shipped two rows and closed a third that said the same thing as one of them (the old rank 90, `gvb-save.js` outside `_shared/`). Every one is a row a session can finish alone; the one that was not is parked under Cross-cutting. *(Counted, not carried forward, and NOT with `grep -oE '^\| [0-9]+ \|' BACKLOG.md` — that returns 177, because #190 added a batch-size table whose `| 1 | **one** | |` row matches it. Count the ranked table alone: `awk '/^\| Rank \| Item/,/^$/' BACKLOG.md | grep -cE '^\| [0-9]+ \|'`.)* |
| Lint | clean |

**217 keys is not a gain.** Two keys changed hands in #193 and cancelled out: `__scv_probe__`
retired when `scv-store.js` stopped doing its own blocked-storage probe, and
`__gvb_save_probe__` was declared for the first time. Nothing stopped being tracked.

**Start here: ranks 1 and 2**, the two dark-mode prerequisites — rebuilding
`list-dark-candidates.mjs` (`npm run path5:next`, which does **not** exist; that is the row),
and adopting `_shared/stage.js` in 023, 025 and 021. Both are ½ rows, so two is the batch,
and they are the same path's groundwork. **Rank 2 touches `_shared/` only by reading it, but
rank 1 adds a script to `Tools/board-check/`** — a second session working a tool row can still
run in parallel; one working another `board-check` script cannot.

After that comes rank 3, Path 5 P3, the first 2+ row: take it alone, do one increment of
~6 tools, and leave the row in place with its text rewritten to say what is done.

**Every row in the table below is a row a session can finish on its own.** The one that was
not — the live-site update test and the OS share-target run, which need a real deployment and
a real phone — was rank 1 until 2026-09-05 and is now parked under
[Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends). It was moved because it sat at the
top of the list telling every session to skip it. Nothing else in the table needs a person.

**What ranks 2 and 3 (#187) leave for whoever writes the next header.**

- **Take the adoption row from `npm run check:adoption` and confirm it with
  `npm run check:adoption -- --check`.** Do not re-derive it by grep; that is what produced
  two wrong numbers on 2026-09-04. Step 6 of the definition of done now says so.
- **`check:adoption`'s number is the DIRECT count**, the one this header has always carried.
  An adopter reached through a per-tool module prints separately as `+n via a module`. There
  are two now: 007 reaches `student-details.js` through `np-details.js`, and 007 reaches
  `gvb-save.js` through `np-store.js`. If a future session wants the combined figure it must
  say which it is quoting.
- **`check:docs-commands` has two escape hatches and both are self-expiring.** `path5:next`
  is in `KNOWN_MISSING` because three sentences in this file and `HISTORY.md` exist to say
  it does not exist; the guard goes red the day that script lands while the entry is still
  there. A muted region (`docs-commands: off` … `on`, alone on their lines, reason required)
  covers a passage whose subject is dead commands — `HISTORY.md` has two. Both are printed
  on every run, so neither can grow quietly.
- **Neither guard has a suite, and no guard in `Tools/board-check/` does.** Both were proved
  by hand, and the probes are written down in `HISTORY.md` — a future edit to either regex
  has nothing catching it. If someone wants to close that, it is a new row, not a leftover.
- **The prose said the ranked table ran to 189.** It has never held more than 185 rows; it
  holds 182 now. Counted with `grep -oE '^\| [0-9]+ \|' BACKLOG.md`, not carried forward.
- **Not checked, and not ranked:** the 318 bare backticked file paths in the tracked `.md`
  files. See the Tier 2 note for why, and for the honest version if anyone wants it.

**What ranks 1 and 2 (#193) leave for whoever picks up storage next.**

- **The storage era is closed, and `store.js` has 36 adopters.** All three key-naming eras
  the primitive was written for now go through it. What is left is not adoption but Path 4
  P4 (the media migration, rank 8) and P5 (009's upgrades, rank 9).
- **`{v: 1, …}` is not a Store envelope, and 063 is the proof.** Rule 1 wants a numeric `v`
  **and** an own `data` property; 063's story payload had only the first, so it reads as
  legacy version 0 and needs a `migrate`. `envelope.test.mjs` had recorded that as "the one
  case a reader will expect to go the other way" and it is now a browser assertion too.
  080 and 036 write the same shape; whoever adopts them next needs the same migrate.
- **The row said gvb-save's consumers were 005, 007 and 064. 064 is not one.** Its
  `htcm-store.js` says "discipline modeled on gvb-save.js" and imports nothing. The real two
  are 005 (directly, plus `seating.mjs`) and 007 (through `np-store.js`). The Tier 2 bullet
  said the same wrong thing and is fixed.
- **`__gvb_save_probe__` was the one write on this site `check:registry` had never heard of.**
  `defaultStorage()` wrote it as `ls.setItem(probe, '1')` on a local alias, and the guard
  matches `localStorage.setItem` — so the key was invisible in both directions: never
  demanded, and free to vanish unnoticed. It is spelled out in full now and declared on the
  `shared` row. **The general lesson is that the guard's floor is lower than it looks: a
  storage write through any alias is invisible to it.** Nobody has swept for others.
- **gvb-save writes two ways now, and the split is deliberate.** When the slot's storage IS
  the page's own localStorage (005) the write goes to `Store.set(…, {raw: true})` — identical
  bytes, plus the banner and the same-tab change event. When it is injected (007's boxing
  wrapper, a suite's Map) the write stays in gvb-save and only the *failure* goes to
  `Store.reportWriteFailure`. Merging the two modules would mean giving up that injection,
  which is what keeps 007's four array-valued keys their exact shape on disk.
- **With no store.js on the page, a failed gvb-save write falls back to `console.error`.**
  That is the one silent-ish path left, and it is real: any future page that links gvb-save
  and not store.js loses the banner. Nothing guards it.
- **Not verified: no real full disk, and no real install.** The banner assertions fill
  localStorage for real in headless Chromium and read the rendered element back, which is the
  strongest thing available here; the four browser spellings of a quota error are still only
  covered by `isQuotaError`'s unit test. `CACHE_VERSION` v152 covers a rename in both tiers
  that `check:precache --base` agrees with, but nothing installed the worker.
- **`Tools/Old Designs/` and `Tools/New Designs/` import `../assets/js/gvb-save.js`, and that
  was already dead before the move** — from those folders it resolves to `Tools/assets/js/`,
  which has never existed. Do not read it as breakage from #193. Deleting both folders is
  still a row (now rank 89).

**What ranks 1 and 2 (#191) leave for whoever writes the next header.**

- **The a11y allowlist is now one rule wide.** 21 page-rule pairs on 21 pages, every one
  `color-contrast`. Rank 14 (the contrast round) is the only thing between this site and an
  empty allowlist, and it is still gated behind Path 5 P3 for the reason in
  [Standing decisions](#standing-decisions): P3 re-tokenizes the same literals.
- **034 is a published snapshot, and a fix to it alone does not stick.** `035`'s
  `brBuildPublishedMarkup()` + `brPublishFnList()` regenerate it, so anything changed in 034
  has to be changed in the publisher template and in 035's own in-app copy too — that is the
  R61–R63 drift, and it is now guarded: `Tools/schedule-browser/test/smoke-mode-tabs.mjs`
  drives `brBuildPublishedMarkup()` in 035 and asserts the tab markup comes out of it. It is
  the first assertion anywhere that the publisher and the published file agree about anything.
  **034 also has six modes to 035's three** — that drift is real, predates this round, and was
  not touched: republishing 034 from 035 today would *lose* Common Planning, Who's Free Now
  and Substitute Plan.
- **Rank 2's stated reason was half wrong, and the change was still right.** "No shell tool
  uses them" is true of jsPDF and **false of SheetJS** — 001, 006 and 032 all use it. They
  inject it on demand behind an explicit spreadsheet click and every call site already handles
  the load failing, which is the actual argument. The rule now written into `sw.js`'s header is
  **"a vendored library is shell only when a shell page loads it with a plain `<script src>`"**
  (jsqr, qrcode.js and jszip do, and stay), and `check:precache`'s new **SHELLDEP** check
  enforces it. Accepted failure mode, unreproduced: install, go offline inside the deferred
  pass's few seconds, then import a spreadsheet → an error message instead of an import.
- **`check:precache` now runs six checks, not five** (SHELLDEP is the sixth; BUMP is still
  opt-in and is now the seventh). It is still one guard — the count of guards in the table
  below is unchanged at 11.
- **The row-count command in this header no longer counts what it says.** `grep -oE '^\| [0-9]+ \|' BACKLOG.md`
  returns 180, not 179: #190 added a batch-size table whose `| 1 | **one** | |` row matches
  it. Count the ranked table alone with
  `awk '/^\| Rank \| Item/,/^$/' BACKLOG.md | grep -cE '^\| [0-9]+ \|'`.
- **Not verified:** the two tiers were not re-run against a real browser install.
  `smoke-sw-tiers.mjs` drives a synthetic staged worker, not this list, so what is proved is
  that the list is internally consistent and that nothing eagerly loaded left the shell. The
  1.23 MB is `stat` on three files, not a measured install.
- **A latent flake in `drive-weighting.mjs` cost this batch a CI round**, and it was not caused
  by the batch: with the behind student seeded 60 calls back, `weight = max - count + 1` gave
  her 61/65 of each eligible draw at the start and only 52/56 by the twentieth pick, because
  her own count climbs while everyone else's stays put — a long-run rate of ~47.9% against a
  `> 0.4` assertion, which **fails 4.4% of runs** (200,000 simulated runs of the exact chain;
  CI hit exactly 8/20). A second one sat underneath it: `leanRate > flatRate + 0.15` needs the
  flat sample under ~35%, and twenty draws of a 1-in-6 chance lands there 1 run in 92. Fixed as
  budgets, per `CLAUDE.md` — deficit 60 → 600, and a separate `TRIES_FLAT = 40`; no assertion
  loosened, no `expectedFailures` entry, `Math.random` not seeded. About 1 run in 4,500 now,
  for ~36 seconds of extra wall clock. **The lesson for the next randomised suite: model the
  chain the page actually runs before choosing a budget** — the no-repeat rule caps this
  property at 50%, so an assertion at 0.4 has far less headroom than it looks.

**What Path 4 P3 and Path 14 P2 leave for whoever picks up media or seating next.**

- **`gvb-media` is declared and empty.** No tool writes to it yet; 046 kept its own `bmg-maps`
  database, because that one's name, store and keyPath are a contract with maps already on a
  teacher's disk. Rank 12 (Path 4 P4) is the migration, and 005's photos are its first row.
  Declaring an empty database is safe because 009 opens a declared-but-absent one, finds it
  storeless and deletes it again — that behaviour predates this phase and is what makes
  declaring ahead of use the right order.
- **`MediaDB` records are FLAT, and that is load-bearing.** `{id, blob, size, type, savedAt,
  ...meta}` — no `{meta: {...}}` envelope — so every record `bmg-map-cache.js` wrote before the
  module existed is still a valid record. Both suites assert it against a legacy-shaped record.
  Wrapping them later is the same class of mistake as enveloping `np_rosters`.
- **`downscaleImage` has no adopter yet.** It is tested (the arithmetic in Node, a real canvas
  in the browser) but the three copies — `tlb-photo.js` 480 px, `scg-photo.js` 160 px, 028
  inline 1600 px — are still there. There is no default `maxDim` worth trusting; each caller
  passes its own.
- **`MediaDB.clear()` on the UNNAMESPACED handle clears the whole store.** A namespaced handle
  (`store({ns})`) only ever reaches its own records — that is asserted — but `MediaDB.clear()`
  with no namespace is a whole-store wipe, because the default handle *is* the whole store. The
  file's comment says the first half and not the second; say it outright when P4 next opens the
  file, and be careful if the year-end rollover ever calls it.
- **009 now ticks a database whose contents cannot be got back**, via `backupByDefault` in the
  registry. A cache stays unticked. A database the browser has but the registry has never heard
  of is also unticked, because the page cannot say what it is.
- **`prepPage()` gives every page its own browser context, and IndexedDB does not cross one.**
  A suite that seeds a database on one page and reads it on another must open the second with
  `page.context().newPage()`. This cost a debugging round; the note is in the suite.
- **Three of the four seating readers are still their own.** 008's `seating-layout.js` and
  045's inline table (and 007's roster peek) were left alone: two of their differences from 010
  change what a teacher sees — 008 measures the room around only the students it matched, which
  also moves its mirror axis, and neither it nor 045 allows for a rotated desk's overhang — and
  those belong to those tools' own rounds. `SeatingRead.bounds()` measures whatever it is
  handed, so a migrating caller can keep its behaviour while it decides.
- **`SeatingRead.onChange` is `storage` only, and its reason changed in #193.** It used to be
  that 005 wrote the chart through gvb-save rather than Store, so `Store.onChange`'s same-tab
  half could never fire for that key. gvb-save now hands that particular write to Store, so it
  *would* fire — for 005's own writes and nothing else. The key is still read raw by four
  tools and written through an injected storage in the suites, so a `Store.onChange` here
  would still promise more than the key can keep. The listener stays; the comment in
  `_shared/seating-read.js` says both halves.

**What Path 6 P1 and Path 5 P2 leave for whoever picks up sharing or projecting next.**

- **`share.js` has one adopter (064) and `stage.js` has one (024).** The other sixteen
  `state-link` tools still carry their own share UI and **eleven** files still carry their
  own `drawQR` (016, 017, 018, 019, 021, 048, 051, `br-pair.js`, `ct-mirror.js`,
  `cc-remote.js`, `sv-handoff.js`); the other three stages P2 named (023, 025, 021) still
  carry their own fullscreen code. `check:dedupe` was **not** extended to `drawQR` because it
  would fail today; extend it in the same PR that removes the last copy. The Path 5 P2 row
  said "adopt in 023, 024, 025, 021" and the definition of done says at most one adopter per
  new module; the Path 4 P1 precedent decided it, and the three are **rank 2**.
- **The QR budget is the decoder's floor plus a margin, not a phone measurement.**
  `QrDraw.MIN_PX_PER_MODULE` is 4 CSS px because at 3 the vendored jsQR fails the heaviest
  blur the suite applies and at 2 it reads nothing; the suite asserts the constant against
  its own measurement, so the number cannot drift without the build going red. A 480 px
  sheet therefore takes up to version 23 (~1.1 KB at level L) and a 320 px one up to version
  13. **No code has been scanned with a real phone from a real screen.** If a teacher reports
  a code that will not scan, measure before touching the constant.
- **jsQR misses QR version 23.** At every size and blur, on payloads every other version
  decodes. Recorded in `Tools/share/test/qr-draw.test.mjs` as a decoder quirk; do not chase
  it as a renderer bug, and do not use jsQR round-trips as the only evidence for a version-23
  payload.
- **Images never ride in a link.** `Share.stripImages` drops every `data:image/` and `blob:`
  string before the URL is built and the sheet says how many; the `.json` download carries
  the untouched state. 064's card image is an object (`{src, w, h, crop, …}`), so what
  arrives is `{src: null, …}`, which its `repairImage` already reads as "no photo" — an
  adopter whose reader does not tolerate `null` where a string was needs a line.
- **The downloaded `.json` has no reader yet.** It is `{ aplp: { v, tool, param, exported },
  state }` so a file can say whose it is; opening one back into a tool is Path 6 P2's,
  alongside routing `?state=` through the same helper.
- **The site-wide axe sweep never scans a state behind a click.** 024's on-stage scan found
  its category tags at 2.6:1 on the dark stage, a bug older than `stage.js`. Every projector
  tool's on-stage contrast is unmeasured until its adoption round scans it — use
  `a11yScan(page, { include: '#stageArea' })` after entering the stage, as
  `smoke-stage.mjs` does.
- **Headless Chromium grants `requestFullscreen` from a Playwright click**, so a suite can
  drive the real API; a Playwright `Escape` does **not** leave real fullscreen (that is the
  browser's own key), so drive the exit through the tool's button. The no-API fallback was
  exercised only by stubbing `requestFullscreen` to reject.

**What Path 3 P3 and P4 leave for whoever picks up the roster or identity work next.**

- **The rename P4 can follow is the token-preserving one, and that is a real ceiling.** An id
  survives a re-spelling whose *sorted tokens* match — exactly the `Smith, Aiden` →
  `Aiden Smith` a gradebook export produces for a whole file at once, which is the case that
  does the most damage. Retyping `Aiden Smith` as `AJ Smith` is a different name by every
  measure `reconcile()` has, so it mints a new id and **nothing can follow it**. Making that
  work needs 006 to offer an explicit "same student, new name" action that keeps the id;
  assertion 27b in `roster.test.mjs` goes red the day someone adds one, which is the point.
- **A boot that seeds the id map must WRITE it.** Every adopter, 008 included, saved the map
  only when something moved — so the seeding pass was in memory only and the *next* rename was
  invisible. This was already in 008 before P4 and nothing caught it, because the tool looks
  perfectly fine the whole time. All eight persist unconditionally now, and
  `smoke-rename-follow.mjs`'s two-visit case is the guard.
- **`trackRenames` moves nothing on purpose.** It returns `{idNames, renames:[{id,from,to}]}`
  and the tool moves its own records, because 008's refusal — never move onto a name that
  already has data — is a judgement about *behaviour records*, and a contact log (068) has the
  opposite answer. A helper that decided for all eight would have been worse than eight copies.
- **`mountRosterPicker` always renders a placeholder; 003's two dropdowns did not.** They
  used to preselect the first roster, so 003's Load button now needs a deliberate pick.
  Nobody has driven that by hand; if a teacher reports 003's Load button "stopped working",
  this is why.
- **`readRosters()` drops a blank entry**, so a roster the old copies counted as 5 counts 4.
  That is a fix, but it is a visible number change on 25 pages.
- **008 still reads the sidecar through `student-details.js` as well as `roster.js`.** It
  keeps the ES module for the DISPLAY half (preferred name, pronunciation) because
  `Roster.resolve()` re-reads storage on every call and 008 renders per card; only the id
  half moved. The two modules agree about normalisation and about checking the tool's own
  roster first, and both say so in their headers — if that ever drifts, 008 is where it
  shows. `student-details.js` has exactly two consumers, and **this sentence used to name
  the wrong ones**: they are 008, directly, and **007**, through `np-details.js`, which
  re-exports the module. 006 is not a consumer at all — it names the file in two comments.
  `npm run check:adoption -- --file student-details.js` prints both, and finding this on its
  first run is the reason that row existed. Shipped in #187.
- **036 and 044 were on R3a's list and got no picker.** Neither has a student-names field —
  036 imports grade rows, 044 is a sub-plan form — so there was nothing for one to fill. If a
  future round wants them wired, it is a feature, not a rollout.
- **068 still asks which roster through a `prompt()`.** It is the only tool on the site that
  does. Giving it a real `<select>` is small and was left out of P3 deliberately, because it
  is a UI change rather than a dedupe.

**What Path 3 P1 and P2 leave for whoever picks up the roster work next.**

- ~~**`_shared/roster.js` has exactly one adopter (006).**~~ **Shipped in #184: 32 now.** The
  `Array.isArray` bug in 017, 022, 033, 043 and 084 is gone, and every migrated tool gained
  same-tab and cross-tab refresh, which only 010 had.
- **`np_rosters` and `crh_students_v1` must stay bare on disk.** Both are written through
  `Store.set(key, value, {raw: true})`, added in #176 for exactly this. Enveloping either
  would empty every raw reader at once — and the Name Picker *silently*, because
  `np-store.js`'s sanitizer walks the envelope's own keys and returns `{}`. Assertion 1 of
  `Tools/roster/test/roster.test.mjs` is that guard; do not weaken it.
- **`getStudents()` returns `id: null` for a name the sidecar has never seen.** Readers do
  not mint ids — only 006, which owns `crh_students_v1`, does. Two readers minting
  separately would be two different ids for one student, which is the exact confusion a
  stable id exists to end. Path 3 P4 (identity, shipped in #185) depended on this rule holding.
- ~~**Rename-across-tools is still open.**~~ **Shipped in #185**, as far as the identity layer
  can reach — see the P3/P4 notes below for the half of it that is still open. 006's
  dependency scan still warns which tools hold an old name, and its wording ("Renaming a
  student here does not rename them there") is now wrong for the eight adopters and should be
  softened by whoever next opens 006.
- **`gvb-roster:meta.v1` was not built, on purpose.** Track R2 below specifies it; 006
  already stores period/subject/term on `crh_students_v1.rosters[name].meta`, so `source`
  and `importedAt` joined them there. A second key would have been a second answer to
  "what period is this roster", plus a registry row and a backup surface. **The R2 text
  below has been corrected.**
- **`store.js` has 36 adopters, and all three key-naming eras are on it.** The last two —
  063's `{v: 1, text: …}` payload and `Tools/school-calendar/scv-store.js` — landed in #193.
  Every adoption must pass a `migrate`, even an identity one, or the tool will not see the
  data already on disk; and `{v: 1, …}` with no `data` beside it is legacy version 0, not an
  envelope, which is the trap 063 was.
- **028 and 039 each define a private object called `Store`.** They must rename theirs
  before they can adopt `_shared/store.js`. `check-registry.mjs` skips them for this
  reason and says so.
- ~~**`assets/js/gvb-save.js` still swallows quota errors.**~~ **Fixed in #193**, and the
  file is `_shared/gvb-save.js` now. Its consumers are 005 and 007, not 064 — 064's
  `htcm-store.js` only says it is modelled on it. `store.js` reads its `__v` format, so the
  two still interoperate at the payload level; what changed is that a failed write is
  reported rather than returned.
- **The registry is hand-maintained, guarded by a script**, exactly like `PRECACHE_URLS`
  and `sw.js`. `npm run check:registry` fails on any key the tree writes that no row
  declares; `--json` prints the extraction, which is how a new row gets seeded.

**The dependency spine, which is why the top of the list is ordered the way it is:**

```
Path 4 P1 storage (shipped) ──► Path 4 P2 registry (shipped) ──► Path 6 P4 "Send to…"
   │                                  │
   ▼                                  ▼
Path 3 P1 roster (shipped) ──► Path 3 P3 pickers (shipped) ──► Path 3 P4 identity (shipped)
   │                             Path 4 P3 media store (shipped) ──► Path 3 P5 photos
   ▼                                                                 Path 4 P4 migration
Path 3 P2 bulk import (shipped)

Path 14 P2 seating reader (shipped) ──► Path 14 P3 solver / P4 room model

Path 5 P1 theme (shipped) ──► Path 5 P2 stage (shipped) ──► Path 5 P3 rollout   (independent)
Path 6 P1 share sheet (shipped) ──► Path 6 P2 adopt ──► Path 6 P3 extend   (independent until P4)
```

Every service in the left-hand column has shipped, and the two rollouts onto the roster half
of it have too. What is left on the spine is Path 3 P5/P6 (photos and the year rollover, both
waiting on Path 4 P4's migration) and "Send to…", which needs the registry or every handoff is
another ad-hoc key read — the debt it exists to remove; the registry records which tool owns
each key and which tools only read it.

### Standing decisions

*Renamed from "Decisions Devon still owes" on 2026-09-05. Nothing here blocks work any
more.* Every question that was open now has a **default applied**, taken from the
recommendation the previous sessions had already written into the right-hand column. A
default is a real decision — build against it — and it is also cheap to reverse: if Devon
says otherwise later, change the row and the work that assumed it. The point is that a
session hitting one of these ships rather than stalls.

| Needed by | Decision | Where it stands |
|---|---|---|
| ~~Path 3 P3~~ **spent** | Staff rosters (058, 075): same namespace, or a `Staff —` prefix? | Prefix, **decided and now shipped** (#184): both tools' pickers say to save a staff list under a name starting with `Staff — `. It is a hint in the page, not enforcement — nothing stops a staff list being called anything, and nothing hides one from the Name Picker's dropdown. |
| ~~Path 3 P4~~ **spent** | Do skill/level values (002's balancing) go on the shared student record? | **No, decided**, and #185 kept to it: 002's pairing memory and skill ratings stay in 002's own storage; only the `{id: name}` map is shared-record-derived. |
| ~~Path 6 P1~~ **spent** | Link payload policy for images. | Strip by policy, say so in the sheet, offer the `.json` download. Shipped in #178; kept here until a session confirms the sheet actually does all three. |
| ~~Any time~~ **spent** | Is `check:docs-commands` worth thirty lines? | **Yes, and it was ~110 with its header.** Shipped in #187, and it caught three dead `npm run` citations on its first run — `social`, `social:check` and `games`, all survivors of the never-committed `board-check` package. |
| Rank 14 (or 4) | 035's private four-palette theme system: adopt `a11y.js`, or bless it as a documented exception? | **Default: bless and document**, unless Path 5 P4 is opening 035 anyway — in which case adopt while you are already in the file. Adopting cold is a re-skin of a 5,500-line tool for no user-visible gain. `test:theme` already stops the situation spreading. *(This row cited "Rank 6 / 21" from the day it was written; rank 6 as it then stood was the `store.js` adoption row and had nothing to do with 035. The two rows it means are the 035 decision itself and Path 5 P4, which is the round that would open 035 anyway.)* |
| Rank 3 | Rebuild `list-dark-candidates.mjs`, or measure inline? | **Default: rebuild and commit it.** This backlog gets re-measured by every session that touches it, and the two guards that shipped in #187 are the same argument one layer up. That row *is* the rebuild. |
| Rank 14 | Contrast round before or after Path 5 P3? | **After.** P3 re-tokenizes the same literals; doing contrast first is twice the work and a conflict in every file. |
| Path 8 | Is a paired *student* device ever in scope? | **No.** Teacher-device-only. |
| Rank 64 (Path 17 P5) | Is an on-demand, non-precached Tesseract download acceptable under the offline promise? | **Default: no.** "Every tool keeps working offline once the site has been visited" is the first sentence of `CLAUDE.md` and the reason there is no CDN anywhere on this site; a feature that silently needs the network on first use is a different promise, and a teacher meets it in the one room where the wifi is bad. Vendoring a full Tesseract build (~10 MB+) into the precache is the other option and is worse. **So: no OCR until someone reverses this**, and the honest version of the row is "OCR is out of scope", not "OCR, pending a decision". This is the one question here that is about what the product *is* rather than how it is built — it is the first row to bring to Devon if he ever does want to spend a decision — it sits at rank 64, roughly thirty rounds out at two rows a session, so it is not urgent. |
| Any time | Should CI also run `offline:build` + `offline:verify`? | **Default: yes, on `main` only, not on pull requests.** Nobody has wired it; it is not a ranked row and would fit inside any site-level round. |
| ~~Any time~~ **decided** | Interleave the per-tool ideas with the platform work, or keep platform first? | **Keep platform first** — the order the table is in. The path survey's argument stands: most per-tool work depends on a `_shared/` service that does not exist yet, and the two biggest rollouts of 2026-09-04 were pure adoption precisely because the services had shipped first. This was "left for Devon" until 2026-09-05. Reversing it is a re-rank, which is still not a session's call. |

### Live blockers and corrections carried forward

- **`npm run path5:next` / `Tools/board-check/list-dark-candidates.mjs` does not
  exist.** A Wave A1 handoff said it shipped in #167 and quoted its output as the Path 5
  rollout backlog; it was never committed. Rank 3 is to build it. This is the **third**
  tool documented but never committed (`sync-social-tags.mjs` and the original
  `board-check` folder were the first two) — which is why `check:docs-commands` exists.
  **That guard shipped in #187**, and `path5:next` is the one name in its `KNOWN_MISSING`
  list, with this bullet as the reason. The guard fails the day that script appears while
  the exemption is still there, so **the PR that builds `list-dark-candidates.mjs` must
  delete the entry and correct this bullet** — that is the point of the arrangement, not an
  obstacle to work around. *(This pointer said "rank 12" from #171 until 2026-09-04, when
  rank 12 was the jsPDF/`SHELL_URLS` row and had nothing to do with it; the guard the
  sentence means has always been `check:docs-commands`.)*
- **The "17–45 hardcoded literals per tool" figure for Path 5 P3 is wrong** and was
  removed in #169 rather than replaced: it swept in `white-space`, `@media print` blocks
  and inline script, and is about 3× too high. Do not reintroduce a figure without the
  script.
- **`index.html`'s `color-contrast` count is not stable between runs** — ×8 at the
  2026-09-03 baseline, then ×24 and ×35 with the file untouched. The landing page paints
  its category counts and the "Offline: N of 86 tools ready" readout as the worker
  reports progress, so how much muted text exists when axe runs depends on timing. Pin
  the page state before working it, or a partial fix and a slow run look identical.
- **`035-schedule-visualizer.html` is a third theme owner.** It does not load `a11y.js`
  and runs its own four-palette `data-theme` system. Not a bug today — it is not
  double-darkened — but the site has two answers to "who sets `data-theme`".
  `test:theme` asserts no page that loads a11y.js writes the attribute itself, so the
  situation cannot spread while 035 is undecided.

### Environment notes that have cost sessions time

- **Sandbox Chromium.** In the Claude Code web sandbox, run every browser suite with
  `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`. The pinned Playwright's browser is
  not there and `playwright install` is a silent no-op. CI has the right browser and is
  the authority.
- **One suite at a time.** Suites bind fixed ports; a background `npm test` plus a
  foreground suite produces failures that are not real. New suites take a port above
  **8405**.
- **A full `npm test` is ~20 minutes**, and CI is ~20 minutes on top. Plan a session
  around two CI rounds, not six.
- `npm ci` first — `node_modules` is gitignored and a fresh container has none.
- **The 002 pairing-history flake was arithmetic, and it is fixed.** On 2026-09-04 CI went
  red on a *documentation-only* branch at `smoke-pairing-history.mjs`'s "at least one pair
  has been grouped together more than once". Eight names split into `4` under the default
  `count` mode is four groups of **two**, so each shuffle records 4 of the C(8,2) = 28
  possible pairs; six generations drew 24 of 28, which usually repeats and sometimes does
  not. Twelve local runs produced 16–22 distinct pairs — two short of the 24 that fails. The
  suite now runs ten generations, where 40 draws over 28 pairs make a repeat certain by
  pigeonhole. The assertion was not touched. **Read the group shape off the running page
  before modelling one of these** — CLAUDE.md says this flake was misdiagnosed once by
  assuming the wrong one, and "split into 4" meaning four groups of two rather than two
  groups of four is exactly how.

## Tier 1 — the ranked index

Ranks are a single contiguous 1..176 order with no ties. **Area** is a tool number,
`_shared/`, or `site`. **Size** is quarter / half / one / two-plus sessions. **Claimed** is the
concurrency mechanism described above — leave it empty unless you are working the row.
**Detail** links to the section in Tier 2 that carries the idea in full.

**How this order was arrived at, so you can argue with it.** It is the order the sources
already implied, not a re-ranking. The Stage 2 dependency chain has shipped out of the top of
it entirely — storage, the registry, the roster service, the share sheet, the two
documentation guards, the last two quarter-session rows (#191) and the last two storage-era
adoptions (#193). **1–4** are now the dark-mode groundwork and the Path 5 rollout it feeds.
**5–13** are the remaining Stage 2 rollouts and the corrections they unblock. **14–94** are
the remaining platform and cross-tool paths in the path survey's own leverage ranking, phase
by phase, ending with the platform swings no path covers. **95–176** — every row whose Area
is a tool number — are the per-tool ideas: first the named enhancements from the retired
ranked table in their existing order, then the remaining tools in tool-number order, where no
priority is implied among them.

*(Boundaries shifted down by two or three when #193 shipped ranks 1, 2 and the old rank 90.
Only one of them is exact, and it is the one worth checking: the rank from which the Area
column is a tool number and stays one, **95** as of 2026-09-05. Measured by walking the table
from the bottom until an Area is not three digits — do not derive it by subtraction, which is
how the figure it replaced ("104") went wrong in the first place. Everything else here
describes the order rather than measuring it, and the old text's "39 enhancement rows then 42
other tools" — 81 for a block 82 rows long — is why that distinction is written down.)*

**The one place the sources disagreed, now decided.** The path survey says platform work
comes first because most tool work depends on it; the per-tool ranked table was written to be
worked from rank 1 down. Following the newer document puts every named per-tool enhancement
below rank 95, and **that is the order this table is in and stays in** — see
[Standing decisions](#standing-decisions). Interleaving them, one tool batch per platform
phase, is the alternative; it is a re-rank, and a re-rank is still not a session's call.

| Rank | Item | Area | Size | Claimed | Detail |
|---:|---|---|---|---|---|
| 1 | Rebuild and commit `list-dark-candidates.mjs` (`npm run path5:next`) before Path 5 P3 quotes a number | site | ½ | | [Path 5](#path-5--projector-mode-real-dark-mode-shared-fullscreen-stage) |
| 2 | Adopt `_shared/stage.js` in 023, 025 and 021 — the three remaining hand-rolled stages the P2 row named; scan each on-stage state with axe as `smoke-stage.mjs` does | site | ½ | | [Path 5](#path-5--projector-mode-real-dark-mode-shared-fullscreen-stage) |
| 3 | Path 5 P3 — native dark + `stage.js` across the projector tools, batches of ~6 | site | 2+ | | [Path 5](#path-5--projector-mode-real-dark-mode-shared-fullscreen-stage) |
| 4 | Path 5 P4 — landing page and hallway tools; 034 gets a native dark palette | site | 1 | | [Path 5](#path-5--projector-mode-real-dark-mode-shared-fullscreen-stage) |
| 5 | Path 6 P2 — adopt the share sheet in the 17 existing `state-link` tools | site | 2+ | | [Path 6](#path-6--share-everywhere) |
| 6 | Path 6 P3 — extend sharing to the ~11 builders that do not share yet | site | 2+ | | [Path 6](#path-6--share-everywhere) |
| 7 | Path 6 P4 — cross-tool "Send to…" driven by the tool registry | site | 1 | | [Path 6](#path-6--share-everywhere) |
| 8 | Path 4 P4 — migrate the image-bearing tools onto `media-db.js` (005 photos first) | site | 2+ | | [Path 4](#path-4--storage-primitive-tool-registry-media-store) |
| 9 | Path 4 P5 — 009 restore preview/diff, per-tool restore, storage readout, optional encrypted backup | 009 | 1 | | [Path 4](#path-4--storage-primitive-tool-registry-media-store) |
| 10 | Path 3 P5 — photos and flags on the shared student record (needs Path 4 P3) | site | 1 | | [Path 3](#path-3--roster-service-and-stable-student-identity) |
| 11 | Path 3 P6 — year rollover: archive, clear student data, keep setup (jointly with 009) | site | 1 | | [Path 3](#path-3--roster-service-and-stable-student-identity) |
| 12 | The contrast round — the 21 remaining `color-contrast` allowances. **After Path 5 P3, not before.** | site | 1–2 | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 13 | Light `--line-strong` misses the 3:1 WCAG 1.4.11 control-border ask. The axe sweep will never surface it | `_shared/` | ½ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 14 | Decide 035’s private four-palette theme system: adopt `a11y.js`, or bless it as a documented exception | 035 | ¼ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 15 | Path 7 P1 — `_shared/print-kit.css` + `print-kit.js`; the ink-safe utility set | `_shared/` | 1 | | [Path 7](#path-7--print-and-export-kit) |
| 16 | Path 7 P2 — print reliability audit across the 63 hand-written `@media print` blocks | site | 2+ | | [Path 7](#path-7--print-and-export-kit) |
| 17 | Path 7 P3 — adoption: the class-set/blank tools, then the card-grid tools | site | 2+ | | [Path 7](#path-7--print-and-export-kit) |
| 18 | Path 7 P4 — `_shared/export.js`: `toPdf`, `toCsv/xlsx`, `toZip`, booklet/N-up imposition | `_shared/` | 2+ | | [Path 7](#path-7--print-and-export-kit) |
| 19 | Path 7 P5 — a real in-page print preview with `@page` size emulation | `_shared/` | 1 | | [Path 7](#path-7--print-and-export-kit) |
| 20 | Path 8 P1 — `_shared/remote.js` + a generic `remote.html` join page; reconnect on drop | `_shared/` | 1 | | [Path 8](#path-8--phone-as-remote-and-pairing-rollout) |
| 21 | Path 8 P2 — phone-as-remote rollout: 007, 030, 021, 004, 023/025/024, 001, 010 | site | 2+ | | [Path 8](#path-8--phone-as-remote-and-pairing-rollout) |
| 22 | Path 8 P3 — `Remote.display()`: the room sees one thing, the teacher another | `_shared/` | 1 | | [Path 8](#path-8--phone-as-remote-and-pairing-rollout) |
| 23 | Path 8 P4 — device-to-device project transfer through the share sheet | `_shared/` | 1 | | [Path 8](#path-8--phone-as-remote-and-pairing-rollout) |
| 24 | Path 9 P1 — bell schedules per day type in 032 + `_shared/school-day.js` | 032 | 1 | | [Path 9](#path-9--the-school-year-spine-calendar-bell-schedules-grading-periods) |
| 25 | Path 9 P2 — pacing that recomputes around lost days | 032 | 2+ | | [Path 9](#path-9--the-school-year-spine-calendar-bell-schedules-grading-periods) |
| 26 | Path 9 P3 — consumers: 004, 010, 001, 036/037, 044/045, 032 itself | site | 2+ | | [Path 9](#path-9--the-school-year-spine-calendar-bell-schedules-grading-periods) |
| 27 | Path 9 P4 — `.ics` import/export and a one-page year wall calendar print | 032 | 1 | | [Path 9](#path-9--the-school-year-spine-calendar-bell-schedules-grading-periods) |
| 28 | Path 10 P1 — Packet Builder `087` with the section-provider registry | 087 | 2+ | | [Path 10](#path-10--packet-builder-and-the-sub-day-product) |
| 29 | Path 10 P2 — 045 re-based on the providers; its six raw key reads go away | 045 | 1 | | [Path 10](#path-10--packet-builder-and-the-sub-day-product) |
| 30 | Path 10 P3 — the evergreen emergency binder, with a staleness reminder | 045 | 1 | | [Path 10](#path-10--packet-builder-and-the-sub-day-product) |
| 31 | Path 10 P4 — 044 pulls from the calendar, prompt banks and seating instead of being typed | 044 | 2+ | | [Path 10](#path-10--packet-builder-and-the-sub-day-product) |
| 32 | Path 10 P5 — round trip: share the plan by link/QR, capture what the sub said | 044 | 1 | | [Path 10](#path-10--packet-builder-and-the-sub-day-product) |
| 33 | Path 11 P1 — publisher drift guard before any extraction | 035 | 1 | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 34 | Path 11 P2 — extract the pure engines; target the HTML under ~300 KB | 035 | 2+ | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 35 | Path 11 P3 — accessibility routing: wheelchair/elevator-weighted routes and a printable report | 035 | 1 | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 36 | Path 11 P4 — safety printing: evacuation cards, lockdown maps, door-sign sets | 035 | 1 | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 37 | Path 11 P5 — master-schedule assistance: constraint checks, congestion, multi-year comparison | 035 | 2+ | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 38 | Path 11 P6 — published browser: runtime-swappable data, expose the pathfinder, sub coverage | 034 | 1 | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 39 | Path 12 P1 — `_shared/question-bank.js` with 030 as the front door | `_shared/` | 1 | | [Path 12](#path-12--question-bank-hub-one-bank-played-six-ways) |
| 40 | Path 12 P2 — read-side adopters: 053, 062, 040, 018, 019, 020 | site | 2+ | | [Path 12](#path-12--question-bank-hub-one-bank-played-six-ways) |
| 41 | Path 12 P3 — play modes in 030: every-team-answers, quiz-bowl, wheel, final wager, printed quiz | 030 | 1 | | [Path 12](#path-12--question-bank-hub-one-bank-played-six-ways) |
| 42 | Path 12 P4 — clue images into the media store; media travels in export | 030 | ½ | | [Path 12](#path-12--question-bank-hub-one-bank-played-six-ways) |
| 43 | Path 13 P1 — one grouping engine: `formGroups`, `rotateRoles`, id-keyed history | `_shared/` | 1 | | [Path 13](#path-13--grouping-rotation-and-bracket-engine) |
| 44 | Path 13 P2 — adopt in 002, 022, 027, 007; seating-aware grouping and project teams | site | 2+ | | [Path 13](#path-13--grouping-rotation-and-bracket-engine) |
| 45 | Path 13 P3 — `_shared/bracket.js` + `_shared/rotation.js`; fix 021’s silent overwrite bug | `_shared/` | 1 | | [Path 13](#path-13--grouping-rotation-and-bracket-engine) |
| 46 | Path 13 P4 — bracket completeness: double elimination, pools, Swiss, ties, consolation | 020 | 2+ | | [Path 13](#path-13--grouping-rotation-and-bracket-engine) |
| 47 | Path 14 P3 — seating constraint solver that explains which soft constraints it broke | 005 | 2+ | | [Path 14](#path-14--seating-chart-room-model-constraint-solver-phone-toolbar) |
| 48 | Path 14 P4 — the room, not the grid: a room layer shared across period assignments | 005 | 2+ | | [Path 14](#path-14--seating-chart-room-model-constraint-solver-phone-toolbar) |
| 49 | Path 14 P5 — live mode; extract the undo stack into `_shared/undo.js` | 005 | 1 | | [Path 14](#path-14--seating-chart-room-model-constraint-solver-phone-toolbar) |
| 50 | Path 15 P1 — split Name Picker: themes as data, sound, one module per pick mode | 007 | 1 | | [Path 15](#path-15--name-picker-split-equity-dashboard-themes-as-data) |
| 51 | Path 15 P2 — per-day history rollup keyed on student ids | 007 | 1 | | [Path 15](#path-15--name-picker-split-equity-dashboard-themes-as-data) |
| 52 | Path 15 P3 — equity dashboard across weeks and periods, printed as one page | 007 | 1 | | [Path 15](#path-15--name-picker-split-equity-dashboard-themes-as-data) |
| 53 | Path 15 P4 — question-attached picks | 007 | ½ | | [Path 15](#path-15--name-picker-split-equity-dashboard-themes-as-data) |
| 54 | Path 15 P5 — artifacts and remotes: hand off to grouping and the bracket; theme packs as JSON | 007 | 1 | | [Path 15](#path-15--name-picker-split-equity-dashboard-themes-as-data) |
| 55 | Path 16 P1 — `_shared/chart-svg.js` with 037’s accessibility patterns; 038 gets the a11y baseline | `_shared/` | 1 | | [Path 16](#path-16--the-grades-trio-and-a-shared-chart-engine) |
| 56 | Path 16 P2 — `_shared/paste-table.js`, one parser for pasted spreadsheet regions | `_shared/` | 1 | | [Path 16](#path-16--the-grades-trio-and-a-shared-chart-engine) |
| 57 | Path 16 P3 — per-question item analysis in 037 and a printed reteach priority list | 037 | 1 | | [Path 16](#path-16--the-grades-trio-and-a-shared-chart-engine) |
| 58 | Path 16 P4 — 036 modelling: term count, scenario modelling, grading window, roster join | 036 | 2+ | | [Path 16](#path-16--the-grades-trio-and-a-shared-chart-engine) |
| 59 | Path 16 P5 — 038 for science: regression, log axes, annotation layer, handoffs to 065 and 073 | 038 | 1 | | [Path 16](#path-16--the-grades-trio-and-a-shared-chart-engine) |
| 60 | Path 17 P1 — thumbnail-grid reordering, crop/straighten, real-photo validation of the retry presets | 011 | 1 | | [Path 17](#path-17--image--pdf-as-a-document-scanner-a-local-pdf-layer) |
| 61 | Path 17 P2 — scanner mode: quadrilateral detection, perspective warp, adaptive threshold | 011 | 2+ | | [Path 17](#path-17--image--pdf-as-a-document-scanner-a-local-pdf-layer) |
| 62 | Path 17 P3 — PDF in: vendor `pdf.js`, merge/insert/extract/rotate existing PDFs | 011 | 2+ | | [Path 17](#path-17--image--pdf-as-a-document-scanner-a-local-pdf-layer) |
| 63 | Path 17 P4 — imposition: booklet order, N-up with cut marks, two-sided presets | `_shared/` | 1 | | [Path 17](#path-17--image--pdf-as-a-document-scanner-a-local-pdf-layer) |
| 64 | Path 17 P5 — OCR, decision first: a vendored Tesseract build against the offline promise | 011 | ½ | | [Path 17](#path-17--image--pdf-as-a-document-scanner-a-local-pdf-layer) |
| 65 | Path 18 P1 — one station/room/hunt schema both 018 and 019 can read, with stable station ids | `_shared/` | 1 | | [Path 18](#path-18--escape-room-and-scavenger-hunt-convergence) |
| 66 | Path 18 P2 — both tools on the schema, plus the payload budget and a printed short-code fallback | 018 | 1 | | [Path 18](#path-18--escape-room-and-scavenger-hunt-convergence) |
| 67 | Path 18 P3 — feature parity between 018 and 019; questions from the bank | 019 | 2+ | | [Path 18](#path-18--escape-room-and-scavenger-hunt-convergence) |
| 68 | Path 18 P4 — the debrief print: per-team path, time per station, misses, reflection page | 019 | 1 | | [Path 18](#path-18--escape-room-and-scavenger-hunt-convergence) |
| 69 | Path 18 P5 — decide the product: two entry points on one engine, or one tool with a mode switch | 018 | ¼ | | [Path 18](#path-18--escape-room-and-scavenger-hunt-convergence) |
| 70 | Path 19 P1 — `_shared/word-list.js`, owned by a Word Lists hub inside 040 | `_shared/` | 1 | | [Path 19](#path-19--vocabulary-hub-and-conjugation-engine) |
| 71 | Path 19 P2 — adopters: 040, 039, 014, 027, 051, 052; delete `vfg-conjdrill-link.js` | site | 2+ | | [Path 19](#path-19--vocabulary-hub-and-conjugation-engine) |
| 72 | Path 19 P3 — conjugation pattern engine for Spanish and French, with irregular overrides | 039 | 2+ | | [Path 19](#path-19--vocabulary-hub-and-conjugation-engine) |
| 73 | Path 19 P4 — printables: Frayer page, spaced repetition, fill-in-the-blank, word wall as a system | 040 | 1 | | [Path 19](#path-19--vocabulary-hub-and-conjugation-engine) |
| 74 | Path 19 P5 — audio: TTS on study mode, teacher-recorded pronunciations into the media store | 051 | 1 | | [Path 19](#path-19--vocabulary-hub-and-conjugation-engine) |
| 75 | Path 20 P1 — `_shared/geo-project.js` + `traceFeature`, hit-test and the curriculum gazetteer | `_shared/` | 1 | | [Path 20](#path-20--blank-map-live-vectors-dropped-geojson-shared-geometry) |
| 76 | Path 20 P2 — dropped GeoJSON/TopoJSON as a base map | 046 | 1 | | [Path 20](#path-20--blank-map-live-vectors-dropped-geojson-shared-geometry) |
| 77 | Path 20 P3 — live vector viewer, keeping the raster path for poster export | 046 | 2+ | | [Path 20](#path-20--blank-map-live-vectors-dropped-geojson-shared-geometry) |
| 78 | Path 20 P4 — time slices for annotations; two-way selective handoff with 015 | 046 | 2+ | | [Path 20](#path-20--blank-map-live-vectors-dropped-geojson-shared-geometry) |
| 79 | Path 20 P5 — quiz memory across sessions; decide the Wikimedia network question | 046 | 1 | | [Path 20](#path-20--blank-map-live-vectors-dropped-geojson-shared-geometry) |
| 80 | Track B1 — brand engine in `a11y.js`: school accent and logo, pre-paint, with an opt-out flag | `_shared/` | 1 | | [Track B](#track-b--custom-theme--branding-pass) |
| 81 | Track B2 — school-branding settings UI in the a11y widget, with a contrast warning | `_shared/` | 1 | | [Track B](#track-b--custom-theme--branding-pass) |
| 82 | Track V1 — `_shared/voice.js` (opt-in, push-to-talk, disclosed) + Name Picker commands | `_shared/` | 1 | | [Track V](#track-v--voice-command-input) |
| 83 | Track V2 — voice commands in 008 Behavior & Points Tracker | 008 | ½ | | [Track V](#track-v--voice-command-input) |
| 84 | Shared-baseline adoption sweep: 9 tools skip `a11y.*`, 15 skip `ink-paper.css`, 18 skip `base.css` | site | 1–2 | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 85 | First-run "Load sample data" across the tools that open to an empty form (P15) | site | 2+ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 86 | Phone-sized layout pass beyond 005 — cap or collapse oversized toolbars site-wide | site | 1–2 | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 87 | `assets/fonts/` — five `@font-face` files `ideas-backlog.html` declares were never committed | site | ¼ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 88 | `Tools/seating-chart/fonts/*.woff2` (~167 KB, three faces) are unreferenced and unprecached | 005 | ¼ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 89 | Delete the four dead, unlinked trees: `index_backup.html`, `Tools/Old Designs/`, `Tools/New Designs/`, `Other Landing Page ideas/` (~590 KB) | site | ¼ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 90 | Next `base.css` dedupe candidates: `.app-header h1`, `.app-header .sub`, `.back-link`, `.card h2` | `_shared/` | ½ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 91 | `_shared/levels.js` — one home for Academic / Honors / Honors GT and the level footer tag | `_shared/` | ½ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 92 | A shared plain-language social-studies glossary (056 ships ~60 entries; 028 and 040 want the same) | `_shared/` | ½ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 93 | `regionGroupCaption()` — one list-to-sentence formatter the whole site agrees on | `_shared/` | ¼ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 94 | Data-driven `index.html` — 86 hand-written rows and three hand-maintained counts | site | 1 | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 95 | Wiki Race (086): teacher scoreboard from finish codes, an offline corpus mode, a Node suite for the seed logic | 086 | 1 | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 96 | Speaking assessment layer — a short rubric per pair while circulating, stored per class, printed as a per-student speaking record | 014 | ½ | | [014 Immersion Roleplay Scenario Generator](#014--immersion-roleplay-scenario-generator) |
| 97 | Task-organized prompt library — grouped by teaching task, each entry loading a full form state | 029 | ½ | | [029 Prompt Builder](#029--prompt-builder) |
| 98 | Cover page, headers, and page numbers across the merged document | 031 | ½ | | [031 Word Doc Merger](#031--word-doc-merger) |
| 99 | Printable parent reading report — one page per student, batch-printed for conferences | 033 | ½ | | [033 Silent Reading (SSR) Log Tracker](#033--silent-reading-ssr-log-tracker) |
| 100 | Per-question item analysis — chart which questions the class missed, print a reteach priority list | 037 | ½ | | [037 Grade Distribution Visualizer](#037--grade-distribution-visualizer) |
| 101 | Chart annotation layer — arrows, text callouts and shaded regions so a printed figure makes an argument | 038 | ½ | | [038 Data Table → Chart Builder](#038--data-table--chart-builder) |
| 102 | Conjugation pattern engine — generate the full regular table from an infinitive and verb class | 039 | ½ | | [039 Vocab & Conjugation Drill Generator](#039--vocab--conjugation-drill-generator) |
| 103 | Local math notation renderer — fractions, radicals, exponents, subscripts, Greek letters | 041 | ½ | | [041 Formula Reference Sheet Builder](#041--formula-reference-sheet-builder) |
| 104 | Templates as data — layout, fonts, borders and colors as template objects, so new designs need no code | 042 | ½ | | [042 Certificate & Award Maker](#042--certificate--award-maker) |
| 105 | Evergreen emergency binder — date-independent sections only, with a staleness reminder | 045 | ½ | | [045 Sub Binder / Day Bundle Generator](#045--sub-binder--day-bundle-generator) |
| 106 | Rubric-scored critique variant — an optional per-step point scale and teacher score column | 047 | ½ | | [047 Art Critique Worksheet Generator](#047--art-critique-worksheet-generator) |
| 107 | Bulk photo import — a whole folder at once, downscaled and auto-matched by filename | 048 | ½ | | [048 Student Art Portfolio Label & QR Tag Maker](#048--student-art-portfolio-label--qr-tag-maker) |
| 108 | Spreadsheet book-list import via the shared SheetJS build, with a genre-balance warning | 049 | ½ | | [049 Book Tasting Menu Generator](#049--book-tasting-menu-generator) |
| 109 | Teacher-recorded audio fallback via MediaRecorder, so labels work with no target-language voice | 051 | ½ | | [051 Classroom Label Maker (Target Language)](#051--classroom-label-maker-target-language) |
| 110 | Practice worksheet variants — matching, fill-in-the-blank and "trap or true cognate" with answer keys | 052 | ½ | | [052 Cognates & False Friends Reference List Builder](#052--cognates--false-friends-reference-list-builder) |
| 111 | Export into Review Game Board — emit the question set in the board’s category/points format | 053 | ½ | | [053 Cultural Trivia Card Generator](#053--cultural-trivia-card-generator) |
| 112 | Bulk-import a custom bank — paste a whole list of broken-and-fixed pairs | 055 | ½ | | [055 Daily Editing / DOL Warm-Up Generator](#055--daily-editing--dol-warm-up-generator) |
| 113 | Visual branching tree view, printable as a one-page overview alongside the numbered key | 057 | ½ | | [057 Dichotomous Key Builder](#057--dichotomous-key-builder) |
| 114 | Multi-week rotating schedule — derive week N+1 by shifting each person one duty; print a month | 058 | ½ | | [058 Duty Roster Builder](#058--duty-roster-builder) |
| 115 | Hand off to Lab Report Builder pre-filled with question, hypothesis, materials and procedure | 059 | ½ | | [059 Scientific Method / Experiment Design Planner](#059--scientific-method--experiment-design-planner) |
| 116 | Per-student report cards — one page per student across all events and dates, with the class average | 060 | ½ | | [060 Fitness & Skill Assessment Tracker](#060--fitness--skill-assessment-tracker) |
| 117 | Improper, mixed and negative values — extend operand generation past 0–1 | 061 | ½ | | [061 Fraction–Decimal–Percent Conversion Drill Generator](#061--fractiondecimalpercent-conversion-drill-generator) |
| 118 | Multiple saved custom stories — named multi-save for templates plus their word banks | 063 | ½ | | [063 Grammar Mad Libs Generator](#063--grammar-mad-libs-generator) |
| 119 | Pre-lab and post-lab packet split from one saved template | 065 | ½ | | [065 Lab Report Template Builder](#065--lab-report-template-builder) |
| 120 | Bulk import a custom bank — paste problem/work/fix/explain rows for a whole unit | 066 | ½ | | [066 Math "Find the Mistake" Warm-Up Generator](#066--math-find-the-mistake-warm-up-generator) |
| 121 | Metronome and reference pitch — wire the decorative tempo field to a real click track | 067 | ½ | | [067 Music Sight-Reading / Rhythm Warm-Up Generator](#067--music-sight-reading--rhythm-warm-up-generator) |
| 122 | Conference print packet — one student’s full contact history plus a blank note area | 068 | ½ | | [068 Parent/Guardian Contact Log](#068--parentguardian-contact-log) |
| 123 | Live circuit rotation timer — a projector mode that counts down each station and signals the rotation | 069 | ½ | | [069 PE Warm-Up Circuit Card Generator](#069--pe-warm-up-circuit-card-generator) |
| 124 | Roster-driven pre-named half-sheets — read `np_rosters` and print one per student | 070 | ½ | | [070 Peer Feedback / Editing Checklist Generator](#070--peer-feedback--editing-checklist-generator) |
| 125 | Multiple named saved image sets, so two vocabulary libraries coexist without re-uploading | 071 | ½ | | [071 Picture-Prompt Speaking/Writing Task Generator](#071--picture-prompt-speakingwriting-task-generator) |
| 126 | Share a diagram by link, so the same novel’s diagram moves between class periods | 072 | ½ | | [072 Story Elements / Plot Diagram Builder](#072--story-elements--plot-diagram-builder) |
| 127 | Multiple named saved trackers — one per class period’s science-fair cohort | 073 | ½ | | [073 Science Fair Project Tracker](#073--science-fair-project-tracker) |
| 128 | Two symbols per label — across the edit form, duplicate logic and the printed card | 074 | ½ | | [074 Science Safety Symbol & Equipment Label Maker](#074--science-safety-symbol--equipment-label-maker) |
| 129 | Wallet-card layout with QR — a lanyard insert with a phone or email link per entry | 075 | ½ | | [075 Staff Directory / Quick-Reference Builder](#075--staff-directory--quick-reference-builder) |
| 130 | Room-assignment view — define rooms and proctors, auto-route by accommodation, print proctor lists | 077 | ½ | | [077 Testing Accommodations Reference Card Generator](#077--testing-accommodations-reference-card-generator) |
| 131 | Multiple named saved prompt sets — a general slip, a lab-day slip and a testing-day slip at once | 076 | ½ | | [076 Sub Note / Feedback Slip Generator](#076--sub-note--feedback-slip-generator) |
| 132 | Named saves plus reorder and share — group and line reordering and a state-link share URL | 078 | ½ | | [078 Unit Conversion Reference Chart Builder](#078--unit-conversion-reference-chart-builder) |
| 133 | Irregular verb call-out boxes — three to five common irregulars per tense | 079 | ½ | | [079 Verb Conjugation Reference Poster Generator](#079--verb-conjugation-reference-poster-generator) |
| 134 | Two-step word problems — chained-operation templates for the upper grade band | 081 | ½ | | [081 Word Problem Warm-Up Generator](#081--word-problem-warm-up-generator) |
| 135 | Correlate hall-pass trips with the schedule; a student-initiated request flow | 001 | ½ | | [001 Digital Hall Pass / Sign-Out Log](#001--digital-hall-pass--sign-out-log) |
| 136 | Roles built into a group; project-team mode; a pair-history that spans the year | 002 | ½ | | [002 Group / Team Generator](#002--group--team-generator) |
| 137 | Peer review mode; rubric handoff to the grades tools | 003 | ½ | | [003 Rubric Builder](#003--rubric-builder) |
| 138 | Bell-schedule awareness; a multi-timer board; a reconnecting mirror | 004 | ½ | | [004 Classroom Timer](#004--classroom-timer) |
| 139 | A constraint solver worth the name; the room, not the grid | 005 | ½ | | [005 Seating Chart Generator](#005--seating-chart-generator) |
| 140 | Bulk operations across rosters | 006 | ½ | | [006 Class Roster Hub](#006--class-roster-hub) |
| 141 | `prefers-reduced-motion` respect; equity across weeks and periods | 007 | ½ | | [007 Name Picker](#007--name-picker) |
| 142 | Team / house points; longitudinal reports | 008 | ½ | | [008 Behavior & Points Tracker](#008--behavior--points-tracker) |
| 143 | Restore preview / diff; per-record conflict resolution | 009 | ½ | | [009 Backup & Restore](#009--backup--restore) |
| 144 | Reuse the real timer; period-aware auto-advance | 010 | ½ | | [010 Command Center](#010--command-center) |
| 145 | Crop and straighten; scanner mode | 011 | ½ | | [011 Image → PDF Assembler](#011--image--pdf-assembler) |
| 146 | More grid types; number-line variants | 012 | ½ | | [012 Graph Paper & Number Line Generator](#012--graph-paper--number-line-generator) |
| 147 | Date-received per student; contract-gate reporting | 013 | ½ | | [013 Lab Safety Contract Tracker](#013--lab-safety-contract-tracker) |
| 148 | Printed ordering activity; blanking dates, not just titles | 015 | ½ | | [015 Timeline Builder](#015--timeline-builder) |
| 149 | A label under each code; batch codes from a spreadsheet | 016 | ½ | | [016 QR Code Generator](#016--qr-code-generator) |
| 150 | Peer feedback slips; gallery-walk reactions | 017 | ½ | | [017 Gallery Walk QR Codes](#017--gallery-walk-qr-codes) |
| 151 | Hints with a time penalty; branching and station images | 018 | ½ | | [018 QR Scavenger Hunt Builder](#018--qr-scavenger-hunt-builder) |
| 152 | Attempt limits and feedback; a non-QR fallback | 019 | ½ | | [019 Digital Escape Room / Puzzle Lock Builder](#019--digital-escape-room--puzzle-lock-builder) |
| 153 | Team names with members; a loser’s-side consolation bracket | 020 | ½ | | [020 Bracket / Tournament Generator](#020--bracket--tournament-generator) |
| 154 | Uneven groups and stations; a shared rotation engine | 021 | ½ | | [021 Tournament Bracket & Station Rotation (PE)](#021--tournament-bracket--station-rotation-pe) |
| 155 | Lock a group or a role and reshuffle the rest | 022 | ½ | | [022 Lab Group & Role Randomizer](#022--lab-group--role-randomizer) |
| 156 | Name and date lines on the slips; response collection questions | 023 | ½ | | [023 Exit Ticket / Bell Ringer Generator](#023--exit-ticket--bell-ringer-generator) |
| 157 | Draw on a strategy card; a shared stage | 024 | ½ | | [024 Number Talks / Mental Math Routine Board](#024--number-talks--mental-math-routine-board) |
| 158 | Sentence starters and an "if you’re stuck" line | 025 | ½ | | [025 Writing Prompt Generator](#025--writing-prompt-generator) |
| 159 | Fraction multiply/divide, exponents and one-step equations | 026 | ½ | | [026 Math Fact Drill Sheet Generator](#026--math-fact-drill-sheet-generator) |
| 160 | Discussion assessment; role recency across a book | 027 | ½ | | [027 Novel Study / Reading Circles Manager](#027--novel-study--reading-circles-manager) |
| 161 | More frameworks; a shipped starter source collection | 028 | ½ | | [028 Primary Source Analysis Worksheet Generator](#028--primary-source-analysis-worksheet-generator) |
| 162 | Projector styling; the site-wide question bank | 030 | ½ | | [030 Quiz / Review Game Board](#030--quiz--review-game-board) |
| 163 | Week-at-a-glance print; year-grid A/B badges | 032 | ½ | | [032 School Calendar Visualizer](#032--school-calendar-visualizer) |
| 164 | "Where is this student right now?"; the published pathfinder | 034 | ½ | | [034 East Middle Schedule Browser](#034--east-middle-schedule-browser) |
| 165 | Split the file; accessibility routing | 035 | ½ | | [035 School Layout Visualizer](#035--school-layout-visualizer) |
| 166 | Scenario modelling — drop lowest, curve, re-weight | 036 | ½ | | [036 Final Grade Checker](#036--final-grade-checker) |
| 167 | Image on a card; the Frayer model page | 040 | ½ | | [040 Vocabulary Flashcard & Word Wall Generator](#040--vocabulary-flashcard--word-wall-generator) |
| 168 | A second language version; trip-day rosters | 043 | ½ | | [043 Field Trip Permission Slip Generator](#043--field-trip-permission-slip-generator) |
| 169 | Seating chart and roster references by name | 044 | ½ | | [044 Sub Plan Builder](#044--sub-plan-builder) |
| 170 | Time-slice maps; live vectors | 046 | ½ | | [046 Blank Map Generator](#046--blank-map-generator) |
| 171 | A per-simulation roster memory | 050 | ½ | | [050 Government/Civics Simulation Role Card Generator](#050--governmentcivics-simulation-role-card-generator) |
| 172 | A bank of saved generic question sets beyond the six built-ins | 054 | ½ | | [054 Current Events Discussion Guide Generator](#054--current-events-discussion-guide-generator) |
| 173 | The reverse direction of the 028 pairing — pull a source out of 028’s library | 056 | ½ | | [056 DBQ / Source Packet Builder](#056--dbq--source-packet-builder) |
| 174 | Buzz-in from student devices (deferred); map-question tournaments | 062 | ½ | | [062 Geography Bee / Map Skills Quiz Generator](#062--geography-bee--map-skills-quiz-generator) |
| 175 | A student-facing fill-in mode; review-game theme packs | 064 | ½ | | [064 Historical Figure / Country Trading Card Maker](#064--historical-figure--country-trading-card-maker) |
| 176 | Snap-to-grid for base-ten blocks; export and data-driven piece families | 080 | ½ | | [080 Virtual Manipulatives Board](#080--virtual-manipulatives-board) |

## How to work this list

### Picking a row

Take the lowest-numbered **unclaimed** rows — normally the next two, which is the standing
instruction (see [How this repo is worked](#how-this-repo-is-worked)). A batch is however
many fit the session; finishing three properly beats half-doing eight. If a row turns out to
be already shipped, impossible within the static-only constraint, or simply a bad idea once
you are in the code, say so, take the next row instead, and **fix the row** — delete it, or
rewrite it to say what is actually true — so the next session does not rediscover the same
thing. Do not stop to ask which.

A row that turns out to need a person at a real device or a real deployment does not belong
in this table at all: move it to the parked list under
[Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends), renumber, and carry on.

Ranks are a contiguous 1..N with no gaps and no ties. **Claiming never changes a rank —
only shipping or removing does.** When a row ships, delete it and renumber every row
below it so the sequence is contiguous again. When you add a newly-noticed item, insert
it at the rank that reflects its priority and push everything at or below it down by one.

### Claiming, so two sessions do not collide

This replaces the retired round tracker, which was a live concurrency mechanism and
not a backlog. Do not reinvent a second one.

Every session is on a branch named `claude/<something>-<code>`; `<code>` is your session
code — read it off your own branch name, do not invent one. To claim a row, put
`` `<code>` <YYYY-MM-DD HH:MM UTC> `` in its **Claimed** cell and **push that
claim-only commit by itself, before writing any implementation code**, so a concurrent
session sees the claim before picking its own batch. Clear the cell if you abandon the
row. A claim more than about six hours old with no matching PR is stale — safe to
reclaim, and say so in the commit message; sessions stall, this is not an accusation.

**A claim cannot close a same-minute race, and one has already happened.** On
2026-08-11 two sessions were started in the same message, both read an empty claim table
in the same UTC minute, and five tools were built twice — discovered at merge time as
real conflicts in tool source, not just in the tracker, where one automatic 3-way merge
silently duplicated UI elements and event handlers. So, additionally:

- **Before opening a PR, re-fetch `main`** and check whether another session has since
  merged work touching your files — a claim disappears the moment that session finishes
  its round, well before its PR merges.
- **On a real merge conflict in a tool's own source**, never trust an automatic 3-way
  merge. Diff the conflicting file against the other session's already-merged version
  first, to see whether the two rounds picked the same item (redundant — discard one
  side) or different ones (complementary — hand-merge carefully).

Everything in `_shared/` is single-owner. Two sessions can run at once only if at most
one of them touches `_shared/`.

### Definition of done, every phase

1. Row claimed here and pushed before any code.
2. One phase per PR, following `CLAUDE.md` — shared boilerplate linked rather than
   inlined, one vendored copy of any library in `_shared/vendor/`, `lib/` not `libs/`,
   `PRECACHE_URLS` (and `SHELL_URLS` only for a shell tool or `_shared/`) plus
   `CACHE_VERSION` in the same commit as any file change, and a
   `[hidden]{display:none!important}` rule on any page whose CSS sets `display` on a
   toggled element.
3. Green locally: `check:dedupe`, `check:tests`, `check:social`, `check:entities`,
   `check:hidden-flex`, `check:print-clip`, `check:registry`, `check:docs-commands`,
   `lint`, `check:precache -- --base origin/main`, every touched tool's `test:<name>`, and
   `test:a11y -- --only <nnn>` for every touched page. **Never add an allowlist line.**
   A new tool comes in clean.
4. A new `_shared/` module ships with a pure-logic Node suite and at most one adopter.
5. Squash-merged to `main` after CI is green; merge confirmed before the session ends.
6. **Then rewrite this file's "Where things stand" header and re-rank.** After the merge
   is confirmed — not before, so it records what actually landed rather than what you
   hoped would. Take the adoption row from `npm run check:adoption` and confirm the
   result with `npm run check:adoption -- --check`; do not re-derive it by grep. Add a `HISTORY.md` entry for what shipped and what you got wrong. Commit
   and merge that too.

**On writing that honestly.** The most valuable line in any of these documents has
consistently been the one recording what did not work — the tool that was never
committed, the count that was 3× too high, the guard that would have passed on a broken
page. State what you did not verify, too. A handoff that only lists wins hands the next
session your mistakes instead of your knowledge.

### Rules the sources agreed on and this file keeps

- **Students are not intended users of this site.** The teacher operates every tool.
  Anything that would put a student in front of the site — logging in, submitting
  responses, buzzing in, self-logging — is out of scope and belongs at the bottom of any
  priority list, below every teacher-facing idea. That is not the same as "nothing for
  students": printed handouts, role cards, station cards and answer keys are the core of
  the product. The line is **who operates the tool**, not who benefits. Ideas of that
  shape are kept under each tool's "Deferred — student-facing (out of scope)" heading as
  notes, not as a queue; do not promote one without Devon saying so.
- **A document that names a command is making a claim. Run it once before you trust
  it.** Three tools have now been documented that were never committed.
- **Measure with a script, and commit the script.** A frozen wrong number in three files
  is worse than no number.
- **Prove your fix positively; a guard going quiet is not evidence.** A sweep-driven
  round can go green *by breaking the page* — if a JS row template throws, the controls
  never render, axe reports the page clean, and every allowance comes out on a green
  suite. Read the result back out of a browser.

---

## Tier 2 — the ideas, in full

Nothing below has been summarised. Every section carries its source text verbatim or very
nearly so — the per-tool Quick Wins / Major Features / Moonshot / Deferred / Open Questions,
the path phase lists, the platform themes and the cross-cutting notes. What was removed is
the accumulated per-round `## Status` changelog and the "what this tool does today"
restatements: those are condensed in `HISTORY.md`, and every original file is in git history.

## Platform themes (P1–P15)

The site-wide themes, cited **by ID** throughout the per-tool sections below (P7 appears
26 times, P9 17, P2 14). They are reproduced here so those citations resolve. Read this
section for the general direction and the tool's own section for what it means there.

**Do not renumber a theme** — the IDs are load-bearing. Add a new one at the end.

**Three of these carry counts that were true when they were written and are not now.**
Verified against the tree on 2026-09-03: the site has **86** tools, not 46, so every
"N of 46" is a fraction of a smaller site — the current adoption numbers are in the
header table above. `_shared/theme-toggle.js` (P1) **was deleted** in Path 5 P1; theme is
owned by `a11y.js` alone, and dark arrives either as a native palette or as a11y.css's
invert filter, never both. And P5's three cdnjs dependencies are **all fixed** — no CDN
dependency remains on the site, though a fresh grep is still worth it whenever a library
is added. The *direction* each theme describes is unchanged; only the arithmetic aged.

improvement file cites the themes that matter for it *by ID*, with
tool-specific framing, so you never have to read all 46 files to know what
the shared direction is.

Everything here is achievable **client-side only** — no server, no accounts,
no data leaving the browser, works offline. That constraint is not a
limitation to design around; it is the product.

---

#### Scope: this is a teacher-facing toolkit

**Students are not intended users of this site.** The teacher is the operator
of every tool. Anything that would put a student in front of this website —
logging in on their own device, submitting responses, buzzing in, studying
from a shared deck, self-logging their work — is **out of scope and belongs
at the bottom of any priority list**, below every teacher-facing idea.

This is not the same as "nothing for students." The toolkit's whole purpose is
producing things *for* students: printed handouts, blank worksheets, role
cards, answer keys, station cards, certificates, study sheets. All of that is
teacher-facing work — the teacher builds it and prints it. Keep those ideas
where they are; they're the core of the product.

The line is **who operates the tool**, not who benefits from it.

Where a tool file records a student-operated idea, it does so under a
**"Deferred — student-facing (out of scope)"** heading placed below the
moonshot. Those are kept as notes for completeness, not as a queue. Do not
pick one up ahead of teacher-facing work, and do not promote one back up the
list without Devon saying so.

Note that a few *shipped* features already put a student device in the loop —
`019-escape-room-builder.html` ships a `lock.html` player page, and the QR
scavenger hunt and gallery walk tools assume students scan codes. Those exist
and are not being reclassified here; the scope rule governs **new** work.

---

#### P1 — Dark mode / projector mode is built but not shipped

`_shared/theme.css` (45 lines of tokens) and `_shared/theme-toggle.js` (32
lines, persists to `gvb-tools-theme`, syncs across tabs via the `storage`
event) both exist and work.

- `_shared/theme.css` is loaded by **5 of 46** tools.
- `_shared/theme-toggle.js` is loaded by **0 of 46** tools.

So the site has a dark mode nobody can turn on. This is the single highest
leverage cross-cutting fix on the list, and it matters more here than on a
normal site: these tools get projected onto a screen in a room where the
lights are off, and a full-white page is genuinely unpleasant to look at for
forty minutes.

The lofty version is bigger than a toggle: a **Projector Mode** as a
first-class site-wide display state — larger base type, higher contrast,
chrome (settings panels, editors, switchers) hidden or collapsed, only the
thing students need to see left on screen. Tools that already have a
fullscreen presentation surface (Timer, Name Picker, Number Talks, Exit
Ticket, Writing Prompt, PE Stations, Review Game Board) each reinvent a
piece of this; a shared implementation would make it uniform and would give
the other 39 tools a presentation mode they don't currently have.

#### P2 — The shared roster (`np_rosters`) should be universal

Rosters live in `localStorage` under `np_rosters`, written by Name Picker and
Class Roster Hub. **15 of 46** tools read it. Any tool that asks the teacher
to type or paste a class list should offer to load one instead — retyping the
same 28 names into a seventh tool is exactly the prep-time tax this toolkit
exists to remove.

Beyond adoption, the roster record itself is thin (a name string). Richer
shared per-student data would unlock a lot across tools, and it has to be
designed once, carefully, because it is the closest thing this site has to a
schema:

- stable student IDs so two tools can agree that "J. Smith" and "Smith, John"
  are the same kid
- optional preferred name / pronunciation
- period or section membership, so a tool can filter to 3rd period
- flags a tool may honor (absent today, accommodations, do-not-cold-call)
- photo (see P12 — photos are the main storage-quota risk)

Anything sensitive must stay local and must be obvious to the teacher and
easy to wipe — Name Picker's Data tab is the model to copy.

#### P3 — Shareable state links (`_shared/state-link.js`)

Encodes a tool's state as base64 inside a URL query parameter, so a link
reopens that exact state on another machine with no server. **6 of 46** tools
use it. Almost every builder-style tool could: send a colleague the rubric,
the bracket, the escape room, the seating chart, the timeline — as a link or
a QR code, with no account and no upload.

The lofty version is a **site-wide share affordance**: one consistent
"Share…" control that offers copy-link, QR-code (several tools already vendor
`lib/qrcode.js`), and download-as-file, with a shared size warning when the
payload outgrows what a URL or a scannable QR code can carry.

#### P4 — Accessibility (`_shared/a11y.js`, `_shared/a11y.css`)

Loaded by **10 of 46** tools. Full adoption is the floor. Above the floor:
every tool should be operable start-to-finish from the keyboard, announce
state changes through a live region (several tools already have exactly one
`aria-live`), respect `prefers-reduced-motion` (Name Picker's confetti,
fireworks, and chaos particles especially), and keep every interactive target
big enough to hit on a touchscreen — a lot of these get used on a classroom
tablet or an interactive panel, not a mouse.

#### P5 — Offline integrity: no CDN dependencies

`sw.js` precaches the whole site for genuine offline use, which is the right
call for a school network. But **three tools still load libraries from
`cdnjs.cloudflare.com`**:

- `044-Sub Plan Builder.html` → JSZip
- `031-docx-merger.html` → JSZip
- `011-image-to-pdf.html` → jsPDF

`sw.js` has a CDN allowlist that catches these opportunistically *after* a
successful online load, but a teacher whose first use of the tool is on a
blocked or offline network gets a broken tool. Every other tool vendors its
libraries into `Tools/<tool>/lib/`. These three should too. `schedule/libs/jspdf/`
already has a vendored jsPDF to copy from.

#### P6 — Print and PDF output is the actual product

Nearly every tool ends at `window.print()`. Print output *is* the deliverable
for most of this toolkit, but there is no shared print stylesheet and each
tool re-solves the same problems independently, with varying success.

Worth standardizing:

- page margins, and a consistent optional header/footer (class, date, page
  N of M)
- deliberate page-break control — never split a table row, a certificate, a
  station card, or a student's block across pages
- ink-saving / grayscale-safe output; many school printers are black-and-white
  and several tools currently encode meaning in color alone
- a real print preview that matches the printed page, rather than a browser
  dialog surprise
- consistent handling of "print one / print a class set / print blanks",
  which the Certificate Maker, Permission Slip, and Exit Ticket tools each
  implement in their own way

#### P7 — Cross-tool bundles and handoff

`045-sub-binder-generator.html` is the proof of concept: it reads three other
tools' storage keys (`subPlanBuilder.standingDetails.v1`, `seating-chart-v1`,
`scv_calendar_v1`) and assembles one printable packet. `010-command-center-dashboard.html`
does the same trick live with four keys.

That pattern generalizes into the toolkit's biggest untapped idea: **a
tool's output becoming another tool's input, on purpose**, with a documented
handoff rather than ad-hoc key reads. Natural pairs already exist all over
the site — roster → groups → lab roles → seating; calendar → sub plan →
sub binder; rubric → grade distribution; vocab list → flashcards →
conjugation drill → review game board.

The moonshot is a **Day Bundle / Unit Bundle**: pick a date or a unit and
print everything for it in one pass, drawn from whichever tools have
something to contribute.

#### P8 — Storage keys, versioning, and migration

Key naming has drifted across three or four eras: `np_rosters`,
`gvb-<tool>:<thing>`, `stviz_*`, `sslt_*`, `lgrr_*`, `subPlanBuilder.<x>.v1`,
`seating-chart-v1`, `hall-pass-log-sections`. `009-backup-restore.html` has to
scan and label them heuristically as a result.

Not worth a disruptive rename on its own, but worth: a documented convention
for new keys, a version stamp inside each payload, and a migration helper so
a future schema change doesn't silently destroy a teacher's saved work.
Anything that changes a storage schema should be able to read the old shape.

#### P9 — Second screen and device pairing (`_shared/webrtc-pair.js`)

Serverless peer-to-peer pairing over WebRTC, with QR-code offer/answer
exchange (`_shared/qr-scan.js` + vendored `jsqr.js`). Used by **2 of 46**
tools — Classroom Timer ("Mirror to a device") and Schedule Visualizer
(project handoff).

This is a genuinely unusual capability for a no-server site and it is barely
used. The teacher-facing extensions are the valuable ones:

- **Phone as a remote.** Drive the projector view from a phone while walking
  the room — start and pause the timer, advance the prompt, call the next
  student, sign someone back in. A teacher is rarely standing at the laptop.
  This is the single strongest use of the module and it applies to a dozen
  tools.
- **Second display.** Mirror a projector-facing tool to a second monitor or a
  panel, so the teacher's screen can show controls while the room sees only
  the display.
- **Colleague handoff.** Hand a project file — a schedule, a bracket, a
  roster, a room layout — to another teacher standing next to you, without
  email and without a file. `035-schedule-visualizer.html` already does this.
- **Device migration.** Move a year of work from the school desktop to the
  home laptop with no file and no cloud (see Backup & Restore).

Student devices reporting into a live board (hunt progress, gallery
reactions, exit ticket responses) is technically the same mechanism, but it
is **out of scope** per the scope section above. Tool files record those
ideas under their "Deferred — student-facing" heading.

#### P10 — Fast, keyboard-first operation mid-lesson

These tools get used with twenty-eight teenagers in the room. The design
constraint is "two clicks, without looking away for long."

Ideas that recur: a site-wide command palette; consistent global shortcuts
(space to start/pause, F for fullscreen, N for next, Esc to exit
presentation); a "pin to top" set of favorite tools; per-tool one-click
presets so the common case never requires typing.

#### P11 — Undo, history, and safe destructive actions

`Seating Chart Generator` has a real undo stack, `blank-map-generator` has
undo/redo, `behavior-points-tracker` has per-entry undo, `schedule-visualizer`
has a full history system. Most other tools have none, yet nearly all have a
"Delete", "Clear all", or "Reset" button that immediately destroys work.

The floor: no destructive action without either a confirmation or an undo.
The ceiling: a shared undo stack helper that any tool can adopt in a few
lines, plus per-tool named snapshots ("save a version of this before I let
students touch it").

#### P12 — Storage quota, images, and IndexedDB

`localStorage` caps out around 5 MB, and several tools base64 images straight
into it: Seating Chart Generator (student photos), Formula Sheet Builder,
Certificate Maker (logo), Escape Room Builder (station images), Primary Source
Analysis (source image), Timeline Builder (per-event photos).

`blank-map-generator` already solved this properly by keeping full-quality
maps in IndexedDB (`bmg-map-cache.js`). That is the pattern the image-bearing
tools should follow. Until they do, they need at minimum: aggressive
downscaling on import (several already do), a visible storage-usage readout,
and a graceful, explanatory failure when the quota is hit instead of a
silent write failure that loses a period's work.

#### P13 — Import surfaces should be at parity

The strongest import experience on the site is `036-final_grade_checker.html`
(CSV *and* XLSX, drag-drop, header detection, warnings) and
`030-review-game-board.html` (Excel import plus a downloadable blank template).
Most other tools only accept a pasted list.

Two ideas travel well: **download a blank template** in the exact shape the
tool wants, and **paste-a-spreadsheet-region** parsing that tolerates tab-,
comma-, and newline-separated text with or without a header row. Several
tools already have the second under different names — it should behave
identically everywhere.

#### P14 — Year, semester, and section lifecycle

Almost every tool stores "sections" or "classes" or "projects" but few have a
concept of a *school year*. `School Calendar Visualizer` is the exception —
it has "Start New Year From This Template".

Teachers do this job on an annual cycle. A shared answer to "roll everything
forward to next year, keep my setup, drop last year's student data" would be
worth a lot, and it pairs naturally with Backup & Restore (archive last year
to a file, then clear).

#### P15 — First-run experience

Most tools open to an empty form. A teacher evaluating whether a tool is
worth their prep period gets more from a **"Load sample data"** button that
fills the tool with a realistic example they can immediately print, plus a
short "what this is for" line. `blank-map-generator` (Recently used),

---

## Platform paths

The eighteen paths with open phases, from the 2026-09-02 survey. Paths 1 and 2 are complete and
are recorded in `HISTORY.md`. Each path keeps its own **Why / Phases / Model / Verification /
Decisions** structure.

### Path 3 — Roster service and stable student identity

**Why.** This is [Track R](#track-r--bulk-csv-roster-import-hub), extended. `np_rosters` is read by 28
tools via ~20 copy-pasted picker functions; only Command Center listens for
cross-tab changes. Every tool that keeps per-student history (Behavior Points,
Hall Pass, Group Generator's `pairHistory`, Lab Roles' recency, Novel Circles, SSR
Log, Parent Contact Log, Lab Safety) keys it on the **name string**, so a roster
edit orphans history everywhere. Class Roster Hub already writes the fix
(`crh_students_v1`: stable ids, preferred names, pronunciation) and only three
readers exist. Six tool files independently name stable ids as the debt that costs
them data.

**Phases.**

- **P1 — `_shared/roster.js` (Fable).** As specified in [Track R](#track-r--bulk-csv-roster-import-hub) R1
  (`listRosters`, `getRoster`, `setRoster`, `onChange`, `mountRosterPicker`,
  `parseDelimited`, `flipLastFirst`), **plus** the identity layer this plan adds:
  `getStudents(rosterName)` returning `{id, name, preferred, say}` records joined
  from `crh_students_v1`, `resolve(nameOrId)` with the same normalization
  `student-details.js` uses today, and `matchName(spoken, students)` (exact →
  unique first name → small edit distance; returns `null` below threshold — this is
  also what Track V's voice commands need). 006 becomes the first consumer in the
  same PR. `np_rosters`' wire shape does not change. *Fable for the identity
  contract: what an id is, how renames and merges propagate, what "same kid" means
  across "Smith, John" and "John Smith". Everything after is adoption.*
- **P2 — Rename, merge and roster diff in 006 (Fable for the merge rules, Opus for
  the UI).** Import a fresh export and get "3 new, 1 left, 2 renamed — apply?";
  apply a rename across every tool that has adopted ids (P4) in one confirmed step;
  archive a departed student rather than deleting. Bulk CSV/XLSX import with
  period-column splitting per [Track R](#track-r--bulk-csv-roster-import-hub) R2, and export-all that
  round-trips.
- **P3 — Picker adoption rounds. SHIPPED #184, `CACHE_VERSION` v149.** 25 existing
  consumers migrated (19 onto `mountRosterPicker`, six onto
  `listRosters`/`getRoster` because their dropdown does more than the helper
  offers) and six unwired tools given a picker. 036 and 044 got none: neither
  has a student-names field to fill. Detail and what it changed that a teacher
  can see are in `HISTORY.md`.
- **P4 — Identity adoption in the history-keeping tools. SHIPPED #185, v150.**
  `Roster.trackRenames` is the one migration helper the row asked for; 008 was
  ported onto it and 001, 002, 013, 022, 027, 033 and 068 adopted it. It came
  out **lighter than this row specified, on purpose**: per-student records stay
  keyed by NAME and the helper moves them when a rename is detected, rather than
  re-keying eight tools' persisted history to ids. Re-keying is a one-way
  migration of a teacher's only copy of their data, on a site with no server; the
  lighter form delivers the same user-visible promise (a roster edit stops
  orphaning history) with nothing to undo if it is wrong. The ceiling — which
  renames the identity layer can actually see — is in `HISTORY.md` and in the
  header above.
- **P5 — Photos and flags (needs Path 4's media store).** Move Seating Chart's
  photo storage to the shared record so every tool can render a face sheet; add the
  small flag set the platform themes list (absent today, do-not-cold-call,
  accommodation note) with Name Picker's Data tab as the wipe-it model.
- **P6 — Year rollover.** "Start next year": archive this year's rosters and every
  id-keyed history to a Backup & Restore file, clear student data, keep setup. Owned
  jointly with 009.

**Verification.** `npm run test:name-picker` and `test:roster-hub` green each
phase; a Playwright test that renames a student in 006 and sees Behavior Points and
Hall Pass history follow; 009 export captures every new key.

**Decisions.** Staff rosters (058, 075) in the same namespace or a `Staff —` prefix
convention; whether skill/level values (002's balancing) belong on the shared
record at all — the platform themes call this the most sensitive thing the site
would store.

---

### Path 4 — Storage primitive, tool registry, media store

**Why.** *(Measured properly while shipping P2: **217 keys and 32 prefixes across 107
files**, not the ~206/69 estimate below — a call-site scan alone undercounts, because
some tools wrap localStorage in their own helper.)* ~206 localStorage keys across 69
tools, each hand-rolling parse guards and
(in ~17 cases) quota handling; three key-naming eras; a `"v":1` convention with no
migration mechanism. Backup & Restore's `KNOWN_GROUPS`/`STUDENT_KEYS` and Command
Center's panel readers are hand-maintained registries that go stale silently —
four tools' keys have already been found missing from backups after the fact
(050, 062, 064 and others). Image-bearing tools base64 into localStorage and hit
the ~5 MB ceiling (005, 015, 019, 028, 041, 042, 056, 071, 080); `bmg-map-cache.js`
is the IndexedDB pattern everyone cites and nobody has extracted.

**Status.** P1 shipped 2026-09-04 (#173, `CACHE_VERSION` v142), P2 the same day (#174,
v143), P3 the same day (#182, v148, with 046 as its single adopter). P4–P5 open. What
actually landed, and what each phase got wrong on the way, is in `HISTORY.md`.

**Phases.**

- **P1 — `_shared/store.js`. Shipped #173.** IIFE, `window.Store`: `get(key, {default,
  migrate})`, `set(key, value)` with `QuotaExceededError` surfaced as a visible,
  explanatory message (never silent), `remove`, `onChange(key, fn)` wrapping the
  `storage` event plus a same-tab `CustomEvent`, `estimate()` via
  `navigator.storage.estimate()` where available, and a versioned envelope
  (`{v, data}`) with a `migrate(fromV, data)` hook. Adopt in 3 tools of different
  eras in the same PR to prove the shape. **No renames of existing keys.** *The
  migration contract, and how legacy unversioned payloads are read without a flag
  day, is stated in the file's own header.* **What shipped differs in one way:** one
  adopter, not three, because the definition of done's "at most one adopter" won.
  **The other two eras shipped in #193** — 063 and `scv-store.js` — so `store.js` now has
  36 adopters and all three eras.
- **P2 — `_shared/tool-registry.js`. Shipped #174.** One data file: `{slug, title, file,
  localStorageKeys|prefixes, idbDatabases, studentData: bool, category}` for all 86
  tools. Consumers: 009 (replaces `KNOWN_GROUPS`, `STUDENT_KEYS`, `IDB_NOTES`), 010
  (panel sources), Path 10's Packet Builder, and a new `check-registry.mjs` that
  greps each tool for its declared keys and fails when a tool writes a key the
  registry doesn't know. **Correction, made while shipping it:** this does *not* make
  backups "complete by construction" — 009 always backed up every localStorage key
  regardless, and says so in its own comment. What was incomplete was the labelling
  (38 tools showed as unnamed "Other saved data"), the student/settings split that
  drives the year-end clear, and IndexedDB. The record shape also had to change:
  `studentData` is per **key**, not per tool, and ownership is decided by who *writes*.
- **P3 — `_shared/media-db.js`. Shipped #182.** Extract `bmg-map-cache.js` into a generic
  IndexedDB blob store (`put(id, blob, meta)`, `get`, `list`, `remove`, `usage()`),
  plus a shared `downscaleImage(file, {maxDim, quality})` lifted from the three
  near-identical copies (timeline-builder, seating-chart, 028). Register the
  database in the registry so 009 backs it up. *(The Firefox half of this — 009
  enumerating registry-declared databases instead of `indexedDB.databases()` — was
  taken in P2, because it fell out of the registry for free. All three existing
  databases are declared and labelled.)* **What shipped differs in two ways:** the store is
  ONE database (`gvb-media`) that tools share through a namespace prefix on the record id,
  rather than one per tool, so there is one registry row to keep right; and 046 kept
  `bmg-maps`, because its records predate the module and its database/store/keyPath are a
  contract with maps already on disk. `downscaleImage` shipped with no adopter — one adopter
  per new module — so the three copies are P4's to remove.
- **P4 — Migrate the image-bearing tools** to `media-db.js`, one or two per PR,
  keeping JSON export portable (export inlines blobs as data URLs on the way out;
  import rehydrates). Order by risk: 005 photos, 019 station images, 056/028 source
  libraries, 042 logo/signature, 015, 041, 071, 080 snapshots, 030 clue images
  (which currently live in localStorage while clue audio is already in IndexedDB).
- **P5 — 009 upgrades that fall out of the above.** Restore preview/diff ("3
  rosters replaced, 2 added, 1 untouched") built on registry metadata; per-tool
  restore as a shared control any tool can host; a storage-usage readout on
  `index.html`; an optional passphrase-encrypted backup (WebCrypto, local) — the
  files contain student names.

**Model.** Opus.

**Verification.** `test:backup` green; a seeded profile with every registered key
round-trips through export → clear → import byte-identically; a full-quota
simulation shows the explanatory message in every migrated tool.

---

### Path 5 — Projector mode, real dark mode, shared fullscreen stage

**Status.** P1 shipped 2026-09-03 (#167). P2 shipped 2026-09-04 (#180, `CACHE_VERSION`
v147) with 024 as its single adopter; 023, 025 and 021 are **rank 2**. P3–P4 open.

**Why.** `_shared/theme-toggle.js` is loaded by zero tools; the only dark mode
teachers get is `a11y.js`'s CSS-filter invert, which shifts every hue and looks
wrong on canvases and photos. Projector-first tools (Timer, Name Picker, Number
Talks, Exit Ticket, Writing Prompt, PE Stations, Review Game Board, Command Center)
each hand-rolled a fullscreen stage; the platform notes record the same wrinkle
being rediscovered four times (the Fullscreen API only renders the fullscreened
subtree, so live controls must live inside it).

**Phases.**

- **P1 — Decide the theme architecture (short, but it's a decision). Shipped #167,
  `CACHE_VERSION` v139 — kept here because it is the architecture every later phase
  builds on; what actually landed is in `HISTORY.md`.** Keep
  `a11y.js` as the owner (it already persists prefs and syncs tabs). Add a real
  `data-theme="dark"` token set to `_shared/ink-paper.css` (the 71-tool palette) so
  tools on ink-paper get native dark by adding one attribute; keep the filter
  fallback only for tools that opt out. Retire `theme-toggle.js` (archive it; it's
  dead) and fold `theme.css`'s Industry tokens into the same mechanism for the five
  `_ds` tools. Respect `prefers-color-scheme` on first visit.

- **P2 — `_shared/stage.js`. Shipped #180, `CACHE_VERSION` v147; what landed is in
  `HISTORY.md`.** One fullscreen/projector helper: `Stage.mount(el,
  {controls, hud, hotkeys})` that fullscreens a container, keeps a teacher HUD
  (answer key, next/prev, timer) inside the subtree, exposes a "presentation" body
  class that hides chrome and enlarges type, and wires the site-standard keys
  (Space start/pause, N next, F fullscreen, Esc exit) guarded by the existing
  input-focus checks. Adopt in 023, 024, 025 and 021 first (the four known copies),
  deleting their local stage code.
- **P3 — Rollout.** Every projector-facing tool adopts `stage.js` and native dark:
  004, 007, 010, 030 (a projector-first tool with neither today), 001's projector
  view, 062, 064, 046's quiz mode, 055, 066, 081, 086. Batches of ~6.
- **P4 — Landing page and hallway tools.** `index.html` already has a native dark
  palette; 034 (a phone tool "that's always white") gets one too; the offline copy
  generator's stale theme-link pattern is re-checked.

**Model.** Opus. Sonnet for the rollout batches.

**Verification.** Screenshot both themes for every migrated tool via the harness;
a Playwright check that no tool ships the invert filter *and* a native palette at
once; keyboard-only run-through of one stage.

---

### Path 6 — "Share…" everywhere

**Status.** P1 shipped 2026-09-04 (#178, `CACHE_VERSION` v146) with 064 as its single
adopter. P2–P4 open; P2 is **rank 5**.

**Why.** `state-link.js` works and is in 17 tools; [Track P](#track-p--printable-cheat-sheet-bundle-export-packet-builder) and
the platform themes both want it universal. Every adopter independently
re-discovered two failure modes: QR payload overflow on long states (028, 050, 056,
064 all fall back to copy-link by hand) and images that can't travel. Twelve files
carry their own `drawQR`. `navigator.share` is used by 3 tools. Nothing offers
download-as-file as the third option.

**Phases.**

- **P1 — `_shared/share.js` + `_shared/qr-draw.js`. Shipped #178, `CACHE_VERSION` v146;
  what landed, the measured budget and what was not verified are in `HISTORY.md`.**
  `Share.mount(button, {
  getState, tool, title, filename })` opens one consistent sheet: Copy link, Show
  QR (with a *measured* payload budget — grey the QR out above the reliable
  scan size and say why), Download `.json`, and `navigator.share` where available.
  `qr-draw.js` is the ~40-line canvas sizing helper that replaces the twelve copies.
  Strip images from link payloads by policy and say so in the sheet.
- **P2 — Adopt in the 17 existing `state-link` tools**, deleting their local QR and
  share code; then wire the receiving side (`?state=`) through the same helper so
  "open from link" behaves identically everywhere.
- **P3 — Extend to the builders that don't share yet.** From the improvement
  notes: 044, 045, 047, 052, 057, 065, 070, 072, 073, 079, 081, plus every
  "generator" tool with a saved configuration. Batches of ~8.
- **P4 — Cross-tool "Send to…".** The same sheet grows a "Send to <tool>" row
  driven by the tool registry (Path 4): map places → timeline (exists), rubric →
  grade distribution (exists), roster → groups → lab roles → seating, trivia →
  review board, vocab → flashcards. Each handoff is a declared
  `{from, to, param, transform}` entry, not an ad-hoc key read.

**Model.** Opus.

**Verification.** A shared Playwright helper that round-trips a state through
link, QR (decoded with the vendored jsQR) and file for every adopter; `check:dedupe`
extended to `drawQR`.

---

### Path 7 — Print and export kit

**Why.** Print output is the product: 78 tools call `window.print()`, 63 carry
hand-written `@media print` blocks, 20 use `print-area.css`. The same problems are
re-solved per tool: page margins, a class/date header, "N of M" footers, never
splitting a card or a student's block across pages, grayscale-safe output, and the
three variants of "print one / a class set / blanks". jsPDF, SheetJS and JSZip are
vendored but only 5, 6 and 4 tools use them, so most tools' data is trapped in
localStorage with no file export.

**Phases.**

- **P1 — `_shared/print-kit.css` + `print-kit.js`.** Opt-in classes for the
  recurring layouts (`.pk-page`, `.pk-keep`, `.pk-half`, `.pk-quarter`, `.pk-card
  grid` with Avery-ish presets), a header/footer helper (`PrintKit.setHeader({class,
  date, title})`), and a "print set" helper that renders one/class-set/blank from a
  single template plus a roster (Path 3). Grayscale guidance: a `.pk-ink-safe`
  utility set (hatching, borders, labels) for anything currently encoded in color.
- **P2 — Print reliability audit.** With Path 2's `check-print-clip.mjs`, sweep the
  63 hand-written blocks for the fixed-height clipping bug, `page-break-inside`
  on things that must not split, and tools linking `print-area.css` without a
  `#printArea`. Fix in batches.
- **P3 — Adoption.** Move the class-set/blank tools (042, 043, 023, 070, 076, 077)
  onto the shared set helper first; then the card-grid tools (016, 017, 018, 040,
  051, 064, 074).
- **P4 — Export layer (Fable for the PDF pagination and imposition math).**
  `_shared/export.js`: `toPdf(printArea, {paper, orientation})` built on the
  vendored jsPDF for tools that want a file rather than a dialog; `toCsv/xlsx(rows)`
  via SheetJS for every tool holding tabular data; `toZip(files)` for multi-sheet
  generators. Booklet/N-up/duplex imposition lives here too (extends
  `duplex-print.js`, which still has a second copy in `vfg-layout.js`).
- **P5 — A real print preview.** A shared "Preview" mode that renders the print
  DOM into an in-page paged view (CSS `@page` size emulation) so a teacher sees
  page breaks before the dialog, instead of after.

**Model.** Opus, except P4's imposition math.

**Verification.** `emulateMedia('print')` screenshots per adopter checked into the
tool's test folder; one physical print run on the school's black-and-white copier
recorded here (the notes say real paper has never been validated for Avery stock,
6-per-page cards, or the calibration page).

---

### Path 8 — Phone-as-remote and pairing rollout

**Why.** `_shared/webrtc-pair.js` is a serverless, LAN-only WebRTC channel with QR
signaling — an unusual capability for a static site, used by 7 tools. The platform
notes call "phone as a remote" the single strongest use of it, and empirical
testing (021) proved `BroadcastChannel` cannot do this across devices. Existing
pairing has to be redone when the connection drops (004), and each adopter
(`ct-mirror.js`, `cc-remote.js`, `br-pair.js`, `sv-handoff.js`, `monitor.html`)
re-implements the host/join/QR dance.

**Phases.**

- **P1 — `_shared/remote.js`.** On top of `webrtc-pair.js`: `Remote.host({commands,
  state})` and a generic `remote.html` join page that renders a command pad from
  the host's declared command list and shows host state. Persist the last pairing
  and auto-re-offer on drop; heartbeat and "reconnecting…" UI; the one-QR-per-side
  flow captured once. Migrate `cc-remote.js` and `ct-mirror.js` onto it as proof.
- **P2 — Rollout.** Name Picker (pick, undo, mark absent), Review Game Board
  (reveal, award, next), PE Stations (next rotation, pause), Timer (already a
  mirror; becomes a remote), Exit Ticket / Writing Prompt / Number Talks (next
  prompt, reveal), Hall Pass (sign back in), Command Center two-way status.
- **P3 — Second display.** The inverse: `Remote.display()` for a tool that wants
  the *room* to see one thing and the teacher another (Review Board answers, Number
  Talks strategies, Seating Chart with photos hidden).
- **P4 — Device-to-device data.** Generalize `br-transfer.js`'s chunked transfer
  so any tool can "send this project to the device next to me" — schedule, bracket,
  roster, room layout — via the Share sheet (Path 6).

**Model.** Opus.

**Verification.** `test:command-center` and `test:timer` already drive two peers
in one browser; extend that pattern into a shared `pairTwo(page)` harness helper.

**Decisions.** Whether a paired student device is ever in scope — the platform
themes say no, and this path deliberately stays teacher-device-only.

---

### Path 9 — The school-year spine: calendar, bell schedules, grading periods

**Why.** School Calendar Visualizer is "the spine of the school year", read today
by two tools (010, 045) and only for day type. Bell schedules exist only inside the
Schedule Visualizer's data model, so the Timer cannot answer "how long is 3rd period
today?", the Hall Pass report cannot correlate trips with periods, and the Final
Grade Checker treats "remaining quarter" as a manual input. Pacing shipped with
fixed unit dates; the valuable half (a unit defined by instructional days that
*recomputes* around a snow day) did not.

**Phases.**

- **P1 — Bell schedules per day type in 032.** Add `bell` to `scv_calendar_v1`
  (versioned via `scv-store.js`'s existing `migrate()`), with an importer from
  035's `_bellDayRows` so schools that already built it in the visualizer don't
  retype. Expose `_shared/school-day.js`: `today()`, `periodAt(date, time)`,
  `gradingPeriodOf(date)`, `daysRemaining(gradingPeriod)`, all reading the calendar
  read-only.
- **P2 — Pacing that recomputes (Fable).** Units by instructional-day count, flowed
  automatically around holidays/half days/testing windows; "you are N days behind"
  against the plan; rebinding when a day is lost. *Fable for the placement
  algorithm and its interaction with the existing bump/adjustment model.*
- **P3 — Consumers.** 004 Timer: "rest of this period" one click, half-day aware;
  010: current/next period, auto-advancing board; 001: period on every trip and in
  the long-range report; 036/037: grading window from the calendar; 044/045: "is
  tomorrow a grading deadline" and today's lesson code pre-filled; 032 itself:
  multi-course pacing side by side.
- **P4 — Calendar import/export.** `.ics` import (district calendars are published
  as ICS) and pasted-table import replacing the hard-coded 2026–27 preset that
  expires; `.ics` export of the pacing. A one-page year wall calendar print.

**Model.** Fable for P2; Opus otherwise.

**Verification.** `test:school-calendar` extended with a snow-day recompute
fixture; one Playwright test per consumer asserting it reads the shared module and
degrades gracefully with no calendar saved.

**Decision.** Whether bell schedules are owned by 032 or 035 (035 already has the
data; 032 is the better public owner). This plan says 032 owns, 035 imports/exports.

---

### Path 10 — Packet Builder and the sub-day product

**Why.** [Track P](#track-p--printable-cheat-sheet-bundle-export-packet-builder) (the Packet Builder, a new tool `087`) is the
general engine; separately, Sub Plan Builder (044) and Sub Binder (045) are two
tools for one job, joined by six literal key reads and no shared code, and 045's own
notes say the handoff interface question is "due, not deferred". The "evergreen
emergency binder" is the most-requested version and doesn't exist. Sub Note
Feedback Slip (076) prints prompts the binder ignores, and nothing captures what
the sub wrote back.

**Phases.**

- **P1 — Packet Builder `087` with the section-provider registry**, exactly per
  [Track P](#track-p--printable-cheat-sheet-bundle-export-packet-builder) P1/P2 (`Tools/packet-builder/sections.js`, evaluate/render
  providers, presets, live preview, seating section via `seating.mjs`), but with
  providers declared in the tool registry (Path 4) instead of a private list.
- **P2 — 045 re-based on the providers.** Sub Binder keeps its one-button UX but
  sources every section from `sections.js`; its six raw key reads go away. Add the
  076 feedback prompts as the binder's feedback page.
- **P3 — Emergency binder.** A permanently maintained no-notice packet built only
  from date-independent sections, with a staleness reminder on `index.html` and in
  Command Center; one click prints it. Standing details get a version stamp (a
  September plan must notice an October room change).
- **P4 — Sub Plan Builder pulls instead of being typed.** With Path 9: today's
  unit/lesson code from the calendar, the do-now from the prompt banks, the
  seating chart, so a plan is mostly drafted before the teacher types. One rendering
  model for both the `.docx` and the printed output (today they are two independent
  renderers that drift).
- **P5 — Round trip.** Share the plan by link/QR (Path 6) so a sick teacher at
  home can send it to the office; a per-date "what the sub said" field; optionally a
  QR on the feedback page that opens a three-field form on the sub's phone and
  hands the result back by link.

**Model.** Opus.

**Verification.** `test:sub-plan` and `test:sub-binder` green; a seeded profile
prints a combined seating + sub plan + hall pass packet with correct pagination
(`emulateMedia('print')` screenshot).

**Decision.** `.docx` vs PDF as 044's primary output (open in its notes for three
rounds).

---

### Path 11 — Schedule Visualizer: modularize, guard the publisher, route accessibly

**Why.** `035-schedule-visualizer.html` is 936 KB and ~20,000 lines of hand-written
code (428 top-level functions in one script; 68 titled sections), four times the
next largest tool. Its publisher builds `034-schedule-browser.html` by
`.toString()`-ing 26 live functions named in `brPublishFnList()`, so any refactor
silently changes published output, and drift has already happened once (R61–R63).
Its own notes say the split is "the main thing standing between this tool and
further progress". It also has the site's most complete undo/history system and
a real pathfinder that the published browser never exposes.

**Phases.**

- **P1 — Publisher drift guard (Fable).** Before touching anything: a test that
  regenerates the browser from the Northwind fixture and diffs it against
  `test/publish.mjs`'s baseline, plus a check that every function in
  `brPublishFnList()` still exists and that the published head block matches the
  newer social branding. Only after this is green does extraction start. *Fable
  because the coupling is by string name and by closure, and the failure is a
  silently wrong published file that teachers rely on.*
- **P2 — Extract the pure engines to `Tools/schedule-visualizer/`** in this order:
  schedule model, pathfinding (`astar`, `computeTravelTimes`), multi-floor graph,
  evacuation routes, congestion, playback renderer, publisher. Each extraction is
  one PR with a Node unit suite for the pure part (today all coverage is Playwright).
  Fold the two folders (`schedule/` and `schedule-visualizer/`) into one and fix the
  stale README. Target: the HTML under ~300 KB.
- **P3 — Accessibility routing.** Wheelchair/elevator-weighted routes over the
  existing graph, per-student route sheets, and "which rooms can't be reached
  without stairs" as a printable report — the notes call this "a real legal and
  human need that nobody has a tool for".
- **P4 — Safety printing.** Multi-floor batch evacuation cards, lockdown maps,
  per-teacher door-sign sets, published map packs as PDFs.
- **P5 — Master-schedule assistance.** Constraint checks (a teacher with three
  rooms in three consecutive periods, a room double-booked), congestion as a printed
  argument (top-ten pinch points with what-if deltas), multi-year comparison.
- **P6 — Published browser.** Runtime-swappable `PUBLISHED_DATA` (one browser file,
  many buildings), expose the pathfinder as "how do I get from here to there", and
  sub coverage marked and returned by link (Path 6).

**Model.** Fable for P1–P2 and P5's constraint work; Opus for P3, P4, P6.

**Verification.** `test:schedule` and `test:schedule-visualizer` green after every
extraction; the publish diff is byte-identical until a phase intentionally changes
it, and then the baseline is regenerated in that PR.

---

### Path 12 — Question bank hub: one bank, played six ways

**Why.** Review Game Board's `rgb-bank-store.js` already holds questions with
unit/standard/difficulty metadata and the site's best import (XLSX plus a template
download). Its notes call "one bank, played six ways" the highest-leverage change
available and name four tools that need questions and cannot get them: Scavenger
Hunt, Escape Room, Flashcards, Bracket (academic tournament). Cultural Trivia (053)
and Geography Bee (062) ship their own banks in incompatible shapes.

**Phases.**

- **P1 — `_shared/question-bank.js` + 030 as the front door.** Lift the bank store
  to a shared, versioned schema (`{id, prompt, answer, choices?, media?, unit,
  standard, difficulty, tags}`), keep 030's editor and importer as its UI, register
  the keys (Path 4), and give it export/import so a bank can be a department
  resource.
- **P2 — Read-side adopters.** 053 and 062 publish their built-in banks into the
  shared shape (read-only seed sets); 040 flashcards ↔ bank (term/definition is a
  question); 018 and 019 pull station questions from the bank; 020 gets an
  academic-tournament mode fed by it.
- **P3 — Play modes in 030.** Every-team-answers mode, quiz-bowl, spin-the-wheel,
  the final wager round, and a printed practice quiz/study guide with an answer key
  — all reading the same bank.
- **P4 — Media.** Clue images move to the media store (Path 4) beside the existing
  clue audio; media travels in export as data URLs.

**Model.** Opus.

**Verification.** `test:review-board` green; a bank round-trips 030 → export → 018
→ 019 with ids preserved.

---

### Path 13 — Grouping, rotation and bracket engine

**Why.** Group formation exists four times (002, 022, 027, Name Picker's Groups
mode); role rotation with recency memory twice; the bracket algorithm is
"line-for-line the same" in 020 and 021; the station-rotation timer exists in 004's
round-robin mode, 021, 017 and 069. 002's `pairHistory` keeps two generations, so
"everyone has worked with everyone this year" is unanswerable. 020 still lacks
double elimination, pools and Swiss scheduling, tie handling and re-deciding a
match; 021 silently overwrites a saved unit on a name collision (a real bug).

**Phases.**

- **P1 — `Tools/_engines/` or `_shared/grouping.js` (Fable for the API).** One
  pure, tested module: `formGroups(students, {count|size, balanceBy, keepApart,
  keepTogether, seatingAware})`, `rotateRoles(groups, roles, history)`, and a
  history model keyed on student ids (Path 3) with a retention policy that is a
  setting, not a constant. *Fable for reconciling four tools' constraint semantics
  into one API without changing any tool's results for existing inputs.*
- **P2 — Adopt in 002, 022, 027, 007** one PR each, deleting local engines. Add
  seating-aware grouping (groups that are physically possible given
  `seating-chart-v1`) and project-team mode (longer-lived named teams with a
  printable contract) to 002 once the engine is shared.
- **P3 — `_shared/bracket.js` + `_shared/rotation.js`.** Extract 020's bracket and
  scheduling code and 021's rotation timer; 004's round-robin mode and 017/069's
  station timers adopt rotation. Fix the 021 overwrite bug in the same PR.
- **P4 — Bracket completeness.** Double elimination, pools, Swiss (a scheduler
  that copes with match counts unknown up front), ties/draws, re-deciding a decided
  match, consolation bracket, team rosters, and a real second-display mode via
  Path 8.

**Model.** Fable for P1; Opus for the rest.

**Verification.** `test:groups`, `test:lab-groups`, `test:novel-study`,
`test:bracket`, `test:pe-stations` green; golden-file tests that the shared engine
reproduces each tool's previous output for a seeded input.

---

### Path 14 — Seating Chart: room model, constraint solver, phone toolbar

**Why.** It is read by 10 files and rendered by four independent readers (its own
`seating.mjs`, 010 inline, 008's `seating-layout.js`, 045). Its constraints are
pairwise only; teachers need front-of-room accommodations, near-the-door,
vision/hearing, and a solver that explains which soft constraints it broke. It
stores photos in localStorage. Its toolbar (~15 controls) is the site's one
currently-failing test. And its undo stack is "the best on the site" and
un-extracted.

**Phases.**

- **P1 — Fix the phone toolbar.** Overflow menu or sticky action bar so the chart
  is within one swipe at 375 px; turn the known-red assertion green without
  loosening it. Small, first, and overdue.
- **P2 — `_shared/seating-read.js`. Shipped #182.** One read-only reader of
  `seating-chart-v1` — the key, the desk geometry, the section chain, the room maths, the
  printed table — adopted in 010, the tool the other copies were made from. 008, 045 and Path
  10's packet section are the remaining callers, and two of their differences from 010 change
  what a teacher sees, so they wait for those tools' own rounds. Photos moving to the media
  store is Path 4 P4's, not this phase's.
- **P3 — Constraint solver (Fable).** Hard constraints (front row, near door,
  keep apart, keep together, needs partner) and soft ones (seat history, front-row
  once a quarter), a scored auto-assign that reports which soft constraints it
  broke and why, and enforcement across a *sequence* of charts rather than the
  single-shot 800-attempt loop. *Fable for the solver and its explanation output.*
- **P4 — The room, not the grid.** A room layer (doors, windows, teacher desk,
  benches, projector wall, obstacles) shared across period-specific assignments,
  so one physical room is drawn once. Reuse 035's tile editor where sensible;
  decide whether the room model lives here or in a shared "my classroom" store 035
  also writes.
- **P5 — Live mode + undo extraction.** Project the chart; tap a seat to mark
  absent, award a point (008), or start a pass (001). Extract the undo stack into
  `_shared/undo.js` and adopt it in the tools whose undo is a single in-memory
  snapshot (002, 003, 018, 020, 021, 022, 024, 027, 043).

**Status.** P1 shipped 2026-09-03. P2 shipped 2026-09-04 (#182, `CACHE_VERSION` v148) with
010 as its single adopter; 008, 045 and 007 still carry their own readers, for reasons
recorded in the module header and in this file's "what these phases leave" notes. P3–P5 open.

**Model.** Fable for P3; Opus otherwise.

**Verification.** All four `test:seating` suites green including the formerly
red one (done for P1); a solver fixture with a known-feasible constraint set and
a known-infeasible one asserting the explanation.

---

### Path 15 — Name Picker: split, equity dashboard, themes as data

**Why.** 2,830 lines with 100+ top-level functions and five modules already
extracted; the picker UI, the 11-theme skin system, sound engine, and each pick
mode are still inline. The 500-entry participation history cap now underpins an
equity feature teachers may be asked to defend. The equity math
(`np-equity.js`, `np-seat-equity.js`) already exists for the current roster and
day; the cross-week, cross-period view teachers actually want does not.

**Phases.**

- **P1 — Split.** `np-themes.js` (themes as JSON data, not code), `np-sound.js`,
  one module per pick mode, `np-ui.js`. No behavior change; `test:name-picker`
  green.
- **P2 — History.** Replace the flat 500-entry cap with a per-day rollup that
  survives trimming; key history on student ids (Path 3) so nickname/preferred-name
  matching stops under-reporting via `unmatched`.
- **P3 — Equity dashboard.** Who hasn't been called on in three weeks, distribution
  by seat position, per period and across periods, printed as a one-page artifact.
  A "Data" front door with an erase button, matching the site's privacy posture.
- **P4 — Question-attached picks.** A pick is `{student, question}` when a prompt
  bank is loaded (Exit Ticket, Number Talks, the question bank of Path 12), logged
  together.
- **P5 — Artifacts and remotes.** Team Draft hands off to Group Generator and the
  bracket (Path 13) instead of ending in a board; phone remote via Path 8; theme
  packs importable as JSON so a unit-themed board is a file.

**Model.** Opus.

**Verification.** `test:name-picker` (both suites) green; a fixture with 600
picks across three weeks asserts the rollup and the dashboard counts.

---

### Path 16 — The grades trio and a shared chart engine

**Why.** Final Grade Checker (036), Grade Distribution Visualizer (037) and Data
Chart Builder (038) were each given independent rounds and never share code: two
SVG chart engines, two SVG→PNG rasterizers, two palettes with two rationales, two
parsers for the same gradebook paste, two histogram bucketings. 038 skips the a11y
baseline entirely while 037 next door does hatching, contrast labels and live-region
announcements well. Per-question item analysis, the thing 037's notes call the most
valuable thing a teacher can learn from a test, is unbuilt. 036 never persists
grades by policy — keep that.

**Phases.**

- **P1 — `_shared/chart-svg.js`.** Axes, scales, bar/line/pie/scatter/box/histogram,
  037's accessibility patterns (hatching, contrast-aware labels, `<title>/<desc>`,
  announcements), one grayscale-safe sequential ramp (the `RAMPS` +
  `relativeLuminance()` pair from `bmg-choropleth.js`), one rasterizer, one
  copy/download helper. 037 and 038 adopt it; 038 gets the a11y baseline.
- **P2 — `_shared/paste-table.js`.** One parser for pasted spreadsheet regions
  (tabs/commas/semicolons/pipes, header detection, thousands separators, names
  containing the delimiter, a "rows I couldn't read" report rather than guesses),
  extracted from the three implementations the site requests already list
  (`bmg-choropleth.js`, 038, 036's `splitRow`). 036, 037, 038, 006 and 075 adopt it.
- **P3 — Item analysis in 037.** Per-question scores in, a "which questions did the
  class miss" chart, a printed reteach priority list; section-vs-section comparison
  (3rd vs 6th period); trend across a quarter as small multiples; a plain-language
  "what this says" page for a PLC binder.
- **P4 — 036 modelling.** Parameterize term count and column layout (trimesters,
  semester exams, other districts' exports); scenario modelling (drop lowest,
  curve, re-weight) with a before/after distribution drawn by P1; grading window
  from Path 9; roster join so missing students are flagged and triage lists flow to
  085/068. Still no grade persistence without an explicit, visible opt-in.
- **P5 — 038 for science.** Regression with R², log axes, multi-series scatter,
  annotation layer (arrows, callouts, shaded regions), multiple charts per printed
  page; handoffs to 065 and 073.

**Model.** Opus.

**Verification.** `test:final-grade`, `test:grade-dist`, `test:chart-builder`
green; golden SVG snapshots for each chart type in both themes.

---

### Path 17 — Image → PDF as a document scanner; a local PDF layer

**Why.** Its notes call document-scanner mode "the single most-wanted capability in
this category" (the copier's scanner is always broken): edge detection,
perspective correction, thresholding — all canvas math, no library. PDF in / PDF out
(merge, insert, extract, rotate) combined with Word Doc Merger (031) gives the site
a complete local document-assembly story. Print-shop presets (booklet imposition,
N-up with cut marks) are something teachers need that no free local tool does well.

**Phases.**

- **P1 — Reorder and crop.** Thumbnail-grid reordering (the list is unusable at 40
  photos), crop/straighten per page, and real-photo validation of the existing
  `compact`/`min` retry presets, which have only ever been tested against synthetic
  fixtures.
- **P2 — Scanner mode (Fable).** Auto-detect the page quadrilateral (edge/contour
  on a downscaled canvas), draggable corner handles, perspective warp, adaptive
  threshold / grayscale / color modes, per-page and batch. *Fable for the CV math
  and its failure handling on low-contrast phone photos.*
- **P3 — PDF in.** Accept PDFs as input (render pages via a vendored `pdf.js` —
  a new `_shared/vendor/` entry with the README, SHA and precache bookkeeping;
  weigh its size against the precache in Path 1), so merge/insert/extract/rotate
  work on existing PDFs. 031 gains "PDF export of the merged docx" via the same
  layer where feasible.
- **P4 — Imposition (Fable).** Booklet (saddle-stitch page order), N-up with cut
  marks, two-sided presets, in the shared export layer of Path 7 so every printing
  tool can use them.
- **P5 — OCR (decision first).** Searchable PDFs need a vendored Tesseract build
  (tens of MB). Decide whether an on-demand, non-precached download is acceptable
  under the offline promise before any code.

**Model.** Fable for P2 and P4; Opus otherwise.

**Verification.** `test:image-to-pdf` (three suites) extended with a
photographed-page fixture and a page-count assertion for contact sheets; a
16-page booklet printed and folded once, recorded here.

---

### Path 18 — Escape Room and Scavenger Hunt convergence

**Why.** Each tool is missing exactly what the other has and they print the same
station cards: 019 has branching, images, answer validation, a `lock.html` player
and a WebRTC `monitor.html`; 018 has teams, timing, hints-with-penalty and a
leaderboard. 018's last round "only widened the gap between the two station data
shapes". 019's most valuable open item is a non-QR fallback (not every student has a
working camera); the whole room rides in a QR with no payload-size warning.

**Phases.**

- **P1 — One station schema (Fable).** Design the shared station/room/hunt model
  that both tools can read (`{stations[{id, prompt, answers[], digitLength,
  branches: byAnswer, media}], teams, timing, hints}`), with a migration from each
  tool's current shape and explicit, stable station ids that survive reordering so
  a reprint doesn't invalidate codes already taped to the wall. *Fable for merging
  two divergent models without losing either tool's behavior.*
- **P2 — Both tools on the schema**, plus the payload budget from Path 6 (Share
  sheet) and a printed short-code fallback typed into `lock.html`.
- **P3 — Feature parity.** 019 gains teams/timing/hints/leaderboard; 018 gains
  per-answer branching, "a required set in any order", station images, and the
  player page. Questions come from the bank (Path 12).
- **P4 — The debrief.** Post-hunt print: per-team path, time per station, misses,
  a reflection page — "where the learning actually happens". Annotated floor-plan
  map via 046 or 035's building map.
- **P5 — Decide the product.** Two entry points on one engine, or one tool with a
  mode switch. Either is fine; decide after P3 with real usage.

**Model.** Fable for P1; Opus otherwise.

**Verification.** `test:escape-room` and `test:scavenger-hunt` green; a fixture
room built in 019 opens in 018 and back with ids intact.

---

### Path 19 — Vocabulary hub and conjugation engine

**Why.** The notes call a shared vocabulary store "the clearest content-reuse win
on the site". Today 040 → 039 is a read-only bridge carrying term/definition only
(part of speech, example, pronunciation, gender, audio, image are silently
dropped) with no write-back; 014's scenario vocabulary and 027's vocabulary log are
unbridged; 051 and 052 hold word lists in their own shapes. Regular Spanish/French
conjugation is entirely mechanical and 039 makes teachers type every form.

**Phases.**

- **P1 — `_shared/word-list.js`.** Versioned store of named lists of
  `{term, definition, partOfSpeech, example, pronunciation, gender?, tags}`, with
  paste import (Path 16's `paste-table.js`), export, and the template-download
  pattern from 030. Decide the owner: this plan says a small "Word Lists" hub UI
  inside 040 (the hub pattern that 006 uses for rosters), not a new tool number.
- **P2 — Adopters.** 040 reads/writes; 039 reads the full record and writes back
  edits; 014 pulls scenario vocabulary; 027 logs to it; 051 and 052 read. Delete
  `vfg-conjdrill-link.js`.
- **P3 — Conjugation pattern engine.** Given an infinitive and verb class, generate
  the full regular table for Spanish and French (present, preterite/passé composé,
  imperfect, future, conditional, subjunctive present), with irregular overrides
  stored on the word record; 079's posters and 039's drills both consume it.
- **P4 — Printables.** Frayer model page; spaced-repetition scheduling for printed
  drills (which list, which day); fill-in-the-blank sentence mode; a word wall as a
  system (cards by unit, printable index, retire a unit).
- **P5 — Audio.** TTS on study mode and labels via the existing `speechSynthesis`
  helper; teacher-recorded pronunciations via MediaRecorder into the media store
  (Path 4) for 051 when no target-language voice exists.

**Model.** Opus.

**Verification.** `test:vocab-share` green; a golden table for a dozen regular and
irregular verbs per language.

---

### Path 20 — Blank Map: live vectors, dropped GeoJSON, shared geometry

**Why.** The most modular tool on the site (16 ES modules) and the one whose
pieces others are already importing: Timeline Builder calls `bmg-vector.js`
directly, Geography Bee copied it, and `unwrapRing`/`drawableRings` (the
antimeridian handling that stops stray lines across the Pacific) now exists in
three places. The rendered map is still a raster, so zoom quality has a ceiling;
base maps are four bundled datasets; time-slice *annotations* (a border that moves
in 1803) need a per-slice store; `bmg-commons.js` fetches from Wikimedia at
runtime, the one content fetch that leaves the browser.

**Phases.**

- **P1 — `_shared/geo-project.js`.** Projection and inverse, `unwrapRing`,
  `drawableRings`, `traceFeature(ctx, feature)` (per-feature, so a highlighted
  country's holes cancel against its own rings), and an output-size argument for
  `renderBaseMapCanvas`. 046, 015 and 062 import it; the copies go. Move the
  `data/` GeoJSON alongside. Also lift `bmg-hittest.js` (point-in-polygon taking
  the transform as an argument) and the curriculum gazetteer that 015 duplicated.
- **P2 — Dropped GeoJSON/TopoJSON.** Accept a dropped file as a base map (district
  boundaries, watersheds, historical borders), with the same calibration path as
  the bundled sets; store in the media store (Path 4).
- **P3 — Live vector viewer (Fable).** Render the base map as vectors in the
  viewer (SVG or canvas re-render on zoom) so zoom is sharp, keeping the raster
  path for poster export and the print pipeline. *Fable for keeping hit-testing,
  labels and the tiled poster print consistent between the two render paths.*
- **P4 — Time slices for annotations.** Per-slice labels/lines/regions with a
  scrubber; small-multiple print; a two-way, selective handoff with 015 (send
  selected labels *and* markers; come back from a timeline into a map project).
- **P5 — Quiz memory and the network question.** Persist which labels a class
  missed across sessions (the reteaching signal); make the Wikimedia lookup an
  explicit, disclosed, online-only action with its cache shown, or drop it.

**Model.** Fable for P3; Opus otherwise.

**Verification.** All five `test:blank-map` suites plus `test:timeline` and
`test:geo-bee` green after P1; a Fiji/Chukotka/Antarctica fixture asserting no
stray full-width lines from the shared module.

---

---

## Platform Plan tracks

The four original platform-wide big swings. Tracks R and P are the specs that Path 3 P1 and
Path 10 P1 cite by name ("as specified in R1", "exactly per P1/P2") — they live here now.
Tracks B and V are covered by no path at all and would be lost otherwise.

### Track R — Bulk CSV Roster Import Hub

New keys introduced by this track:

| Key | Shape | Registered in |
|---|---|---|
| `np_rosters` *(existing, unchanged)* | `{rosterName: string[]}` | already in 009 `KNOWN_GROUPS` + `STUDENT_KEYS` |
| ~~`gvb-roster:meta.v1`~~ *(never built — see below)* | — | — |

**Correction, 2026-09-04 (#177).** `gvb-roster:meta.v1` was **not built, and should not
be.** 006 already stores `{period, subject, term, created, updated}` per roster at
`crh_students_v1.rosters[<name>].meta`, so R2's `source` and `importedAt` joined them
there. A second key would have been a second answer to "what period is this roster", plus
a registry row, a 009 backup surface and a migration. The rest of R2 shipped; the line
above is struck rather than deleted so this note has something to attach to.

**R1, R2 and R3 have all shipped** (#176 `CACHE_VERSION` v144, #177 v145, #184 v149). What
landed, and what it got wrong, is in `HISTORY.md`. R3a's list of eight unwired tools was two
too long: 036 and 044 have no student-names field for a picker to fill.

##### R1 — `_shared/roster.js` — **SHIPPED #176, v144**

- [ ] Create `_shared/roster.js`, IIFE exposing `window.Roster`:

  ```js
  window.Roster = {
    listRosters: function () {},          // sorted keys of np_rosters; [] on parse failure
    getRoster: function (name) {},        // string[] copy, never a live reference
    setRoster: function (name, names) {}, // writes np_rosters + fires same-tab notify
    removeRoster: function (name) {},
    getStudentMeta: function () {},       // read-only view of crh_students_v1
    onChange: function (fn) {},           // returns unsubscribe; wraps BOTH the 'storage'
                                          // event (cross-tab) and a same-tab CustomEvent
                                          // (storage events don't fire in the writing tab)
    mountRosterPicker: function (selectEl, opts) {},
    // opts: { persistKey, emptyLabel, includeManualOption, onChange: fn(name, names) }
    // returns { refresh, getSelected, getNames, destroy }
    parseDelimited: function (text) {},   // CSV/TSV → rows; ported from 006
    flipLastFirst: function (s) {}        // ported from 006
  };
  ```

- [ ] Port `splitCells` / `parseTable` / `flipLastFirst` out of
  `Tools/006-class-roster-hub.html` into the module verbatim; 006 switches to calling
  `window.Roster.*` in the same PR (the source of truth becomes the first consumer,
  proving the port).
- [ ] Module header documents the write-contention contract: three writers exist after
  this (006, 007, roster.js) — all must read-modify-write the whole `np_rosters` object;
  last-writer-wins across tabs is the existing, accepted behavior.
- [ ] Bookkeeping: `PRECACHE_URLS` += `_shared/roster.js`; bump `CACHE_VERSION`.
- [ ] Verify: 006 single-roster import round-trips a pasted CSV identically pre/post
  (manual + ad-hoc Playwright via `Tools/board-check/harness.mjs`);
  `npm run test:name-picker` stays green (007 owns `np_rosters`); `npm run check:dedupe`.

##### R2 — Bulk import in 006 — **SHIPPED #177, v145**

- [ ] **Bulk import UI**: a "Bulk import" entry alongside the existing `openImportModal`
  flow. Accepts multiple files (`<input type="file" multiple>` + drag-drop) in
  `.csv`/`.tsv`/`.txt`/`.xlsx`. XLSX via lazy-load of
  `_shared/vendor/xlsx/xlsx.full.min.js`, copying 036's `handleImportFile()`
  on-demand-script pattern exactly (never a static `<script>` tag — the file is ~881 KB).
- [ ] **Period-column splitting**: in the reused column-mapping dialog, a "Split into
  rosters by column" option — pick the Period/Class column and one file becomes N rosters
  named from its distinct values (editable name prefix, e.g. "Period {value}");
  sheet-per-roster for multi-sheet xlsx. Reuses `flipLastFirst` and the existing mapping
  UI; collisions get the same replace/merge choice the single-roster path already offers.
- [ ] **Export**: per-roster CSV download + "Export all rosters" single CSV with a
  `Period` column whose shape round-trips through the bulk importer (the file a teacher
  carries between machines and school years).
- [x] ~~Write `gvb-roster:meta.v1`~~ — **not built.** `source` and `importedAt` went onto
  the existing `crh_students_v1.rosters[<name>].meta` instead, so there is no new key, no
  009 registration and no 006 `TOOL_KEYS` change. See the correction above.
- [x] Verified in `Tools/class-roster-hub/test/smoke-bulk-import.mjs`: one CSV with a
  Period column → N rosters; a two-file batch; a real two-sheet `.xlsx`; both diff
  readings; and that **no new localStorage key was invented**. Export already existed and
  was not rebuilt. `test:name-picker` and `check:dedupe` green.

##### R3 — Picker adoption/migration rounds (2–3 PRs, batched, parallelizable)

- [ ] **R3a — wire the 8 unwired tools first** (biggest user payoff): 021, 036, 044,
  058 (staff), 060, 073, 077, 075 (staff). Each gets a small "Load from roster" control
  via `Roster.mountRosterPicker` that fills the existing names textarea
  (non-destructive: fills, doesn't lock — the textarea stays the tool's source of truth).
  060/073/077 share an identical `#rosterInput` template, so one worked example applies
  three times. 058/075 are *staff* lists: give them the picker collapsed/optional, since
  `np_rosters` holds student rosters. Each page adds
  `<script src="../_shared/roster.js"></script>` (after a11y.js, before the tool script).
- [ ] **R3b / R3c — migrate the ~20 copy-pasted picker functions** across the 23
  existing consumers to `Roster.mountRosterPicker`, in batches of ~10–12 per round —
  **incremental, never big-bang** (the Phase 2/3 refactor rounds are the precedent).
  Hash-compare the copy-pasted functions first (the Phase 2 discipline): variants that
  don't match the standard shape get reviewed individually. Rules per tool: keep the
  tool's existing remembered-selection localStorage key as `persistKey` (zero data
  migration); delete the local function; any picker too custom for the mount helper stays
  on direct `Roster.listRosters`/`getRoster` calls — still a dedupe win. Every migrated
  tool gains live cross-tab refresh for free (today only 010 has it).
- [ ] Bookkeeping per round: `CACHE_VERSION` bump (no PRECACHE changes after R1).
- [ ] Verify per round: every touched tool loads with zero console errors; picker lists
  the same rosters as before; selection persists across reload; a roster edit in a second
  tab refreshes the picker; `npm test` suites for any suite-bearing tool in the batch;
  `node Tools/board-check/check-social.mjs` before/after (head edits add a script tag).

##### R risks / open questions

- **Write contention**: documented in R1; acceptable, not new.
- **Staff vs student rosters** (058/075): does one shared namespace suffice, or does a
  staff list pollute Name Picker's roster dropdown? Cheapest answer is a naming
  convention ("Staff — …" prefix), not a second store. Decide in R3a.
- **Roster size**: a 6-period school in one xlsx is ~200 names — no quota risk, no
  IndexedDB needed.

---

### Track B — Custom Theme / Branding Pass

**Decision: extend `_shared/a11y.js` — do not create a separate `brand.js`.** a11y.js is
already the site's presentation-prefs owner: synchronous pre-paint execution on 73/81
tools, prefs persistence, storage-event tab sync, an injected floating settings widget,
and precedent for per-tool opt-out flags (`A11Y_NATIVE_THEME`). A separate file would buy
concern separation at the cost of ~73 head edits (a full mechanical migration phase)
before the first tool showed a brand color. Keep the brand code in a clearly fenced
section (`/* === brand === */`) so it can be extracted later if the file grows unwieldy.

New keys (both registered in 009 `KNOWN_GROUPS`, settings-class, not student data):

| Key | Shape |
|---|---|
| `gvb-brand:settings.v1` | `{v:1, accent:'#rrggbb', accent2:'#rrggbb', schoolName?, updatedAt}` |
| `gvb-brand:logo.v1` | bare data-URL string (PNG, ≤200px long edge, hard cap ~100 KB) |

The logo lives in its own key so accent tweaks never rewrite the blob and storage-event
handlers can tell the two apart.

##### B1 — Brand engine in a11y.js (one PR)

- [ ] Pre-paint (same code path that applies the saved theme): read
  `gvb-brand:settings.v1`; if present,
  `document.documentElement.style.setProperty('--accent', …)` and `--accent-2` — this
  cascades over `_shared/ink-paper.css` on the 67 majority tools — **plus** derived
  Industry aliases for the 5 `_ds` tools: set `--color-accent-600` to the accent and
  derive the neighboring steps with small HSL lighten/darken adjustments in JS
  (approximate is accepted; no second palette file).
- [ ] Opt-out flag `window.BRAND_OPT_OUT = true`, checked before applying (the
  `A11Y_NATIVE_THEME` precedent). Set it inline in `007-Name Picker.html` — its own
  11-theme `np_theme` system owns its accents; a site accent stomping a chosen Name
  Picker theme is a bug, not a feature. Audit whether other own-palette tools (004, 035,
  002/016/018) even resolve `--accent`; if they don't consume it, setting it is a
  harmless no-op and they need no flag.
- [ ] Logo injection: post-DOMContentLoaded, if `gvb-brand:logo.v1` exists and the page
  has the shared `.app-header`, insert `<img class="brand-logo" alt="">` before the
  `h1` (67 tools); silently no-op otherwise. `.brand-logo` sizing CSS goes in
  `_shared/a11y.css` (already precached), including
  `@media print { .brand-logo { display: none } }` — printed output doesn't change
  layout in v1.
- [ ] Expose `window.Brand = { get, set(settings), setLogo(dataUrl), reset, onChange }`
  from inside the IIFE, and extend the existing storage-event listener so accent/logo
  changes propagate live to open tabs.
- [ ] Verify: with no brand keys set, screenshot-diff 3 representative tools pre/post —
  must be pixel-identical (brand is strictly additive); set an accent → visible on an
  ink-paper tool and an Industry tool (005 or 036), and *not* on 007; dark mode + accent
  together (the a11y CSS-filter dark will shift the hue — observe and document, don't
  fight it); `npm test` name-picker + seating-chart suites; `check:dedupe`. Bump
  `CACHE_VERSION`.

##### B2 — Settings UI (one PR)

- [ ] Add a "School branding" section to the existing a11y floating widget: accent
  `<input type="color">`, optional accent-2 override (auto-derived by default), logo file
  input, and a **Reset to default** button that removes both keys and clears the inline
  properties live (no reload).
- [ ] Logo pipeline: reuse the `Tools/certificate-award-maker/cam-logo.js`
  `downscaleImage` approach — canvas downscale to ≤200px, PNG data URL (transparency
  survives). Enforce the ~100 KB post-encode cap with a visible, explanatory rejection
  message (P12: no silent quota failures), and surface `QuotaExceededError` from
  `setItem` as "storage is full — export a backup from Backup & Restore, then clear old
  tool data".
- [ ] Contrast guard: compute WCAG contrast of the chosen accent vs `--paper`/#fff in the
  widget and show a warning — warn, don't block.
- [ ] Verify: set accent+logo in one tab → a second tab updates without reload; reset
  restores the stock look; an oversized image is rejected with the message; 009
  export/import restores branding on a clean profile. Bump `CACHE_VERSION`.

##### B3 (optional, later) — coverage of the last 8 tools

- [ ] The 8 tools without a11y.js get it (desirable independent of branding) — fold into
  a normal improvement round, not this track.

##### B risks / open questions

- **Dark-mode interaction**: the CSS-filter dark fallback shifts the school accent's hue.
  Probably acceptable (it already shifts the stock accents); verify and document in B1.
- **Industry derivation**: derived `--color-accent-*` steps won't perfectly match the
  hand-tuned `_ds` scale. Accepted — those 5 tools are the minority.
- **Open question (for Devon)**: should printed output eventually include the logo as
  letterhead? Deferred; print exclusion is the v1 default.

---

### Track P — Printable Cheat-Sheet Bundle Export ("Packet Builder")

**Decision: a new tool `Tools/082-packet-builder.html` with a central section-provider
registry in `Tools/packet-builder/sections.js`; 045 stays untouched.**

- *Why a new tool, not extending 045*: Sub Binder is a curated product ("everything a sub
  needs today") with a fixed section list; this swing is *arbitrary combination*.
  Grafting reordering/presets onto 045 risks its working print output. 082 generalizes
  the architecture; 045 keeps its one-button job.
- *Why a central registry, not per-tool contribution*: tools are self-contained pages,
  not loadable modules, and there are no iframes in the repo — per-tool providers would
  mean inventing a module system. The proven precedents are 045's loaders, 010's
  `PANELS`/`DEFAULT_PANELS` registry, and 009's `KNOWN_GROUPS`. Cost: the registry must
  track source-tool schema changes — mitigated by each provider declaring its
  `storageKeys` and a one-line comment next to each source tool's save function
  ("rendered by Tools/packet-builder/sections.js — keep shape or bump key version"), the
  same social contract 045 already has implicitly.

Registry API (`sections.js`, IIFE, `window.PacketSections`):

```js
window.PacketSections.register({
  id: 'seating-chart',
  title: 'Seating Charts',
  sourceTool: '005-Seating Chart Generator.html',  // linked in the UI as "set this up"
  storageKeys: ['seating-chart-v1'],               // the schema contract
  evaluate: function () { return { available: true, status: '3 charts, updated Mon' }; },
  render: function (targetEl, opts) { /* builds print DOM into targetEl */ }
});
```

This mirrors 045's `loadXxx()/evalXxx() → {available, status}` shape, so a later 045
unification (P3) is mechanical. Sections render **live at open** (matching 045) — no
stored snapshots, avoiding stale-data confusion and quota use.

##### P1 — Tool + registry + first four sections (one PR)

- [ ] Build 082 per the CLAUDE.md new-tool boilerplate (ink-paper + a11y stack,
  `_shared/print-area.css` — as a new file it's written to comply with its no-local-print
  -rules constraint): checkbox list of registered sections with `evaluate()` status lines
  (unavailable sections greyed with a link to the source tool), drag-to-reorder, live
  preview into `#printArea`, Print button (`window.print()`), page breaks via `.page` +
  `page-break-before: always` (045's pattern).
- [ ] v1 sections (the confirmed re-renderable state): **hall pass log**
  (`hall-pass-log-sections`), **sub plan** (`subPlanBuilder.standingDetails.v1` /
  `.history.v1`), **school calendar** (`scv_calendar_v1`), and **class rosters**
  (`np_rosters` + `crh_students_v1` preferred names — a plain per-period name-list page).
- [ ] Saved presets: `gvb-packet:presets.v1` —
  `{v:1, presets:[{name, sectionIds:[…], order:[…]}]}`.
- [ ] Full new-tool bookkeeping: `index.html` row + record counts/memo/changelog per DEV
  NOTES item 6; `README.md` table row; `PRECACHE_URLS` += 2 files (URL-encode any
  spaces); `CACHE_VERSION` bump; 009 `KNOWN_GROUPS` += Packet Builder; social/OG block
  consistent with `check-social`; remove the idea's row from this backlog and
  `ideas-backlog.html` per "Picking one up".
- [ ] Verify: with a seeded localStorage fixture, each section renders; an empty profile
  shows all-unavailable gracefully; print preview paginates (Playwright
  `emulateMedia('print')` + screenshot); `check-social`; `check:dedupe`.

##### P2 — Seating-chart section (one PR)

- [ ] Seating is the highest-value section and the only one with an existing exported
  renderer: `Tools/seating-chart/seating.mjs` exports `buildPrintPage(s, opts)` /
  `printSubExport`. Load it from 082 via a page-level `<script type="module">` (the
  ES5-IIFE rule governs `_shared/` window-global libraries, not tool pages). Register the
  provider with `render` delegating to `buildPrintPage`.
- [ ] Verify: `npm run test:seating` (all four suites; note that the drive-seating
  mobile assertion this line used to call known-red was fixed in Path 14 P1 and must
  stay green); a packet combining
  seating + sub plan + hall pass prints as one correctly paginated document.
  Bump `CACHE_VERSION`.

##### P3 (stretch — explicit go/no-go decision, not default work)

- [ ] 045 keeps its curated UX but sources section renderers from
  `packet-builder/sections.js`. Only worth doing if a schema change actually bites both
  files; don't refactor preemptively.

##### P risks / open questions

- **Schema drift** is the structural risk: a source tool changes its save shape and a
  packet section silently renders garbage. Mitigations: the `storageKeys` contract, the
  source-tool comments, and `evaluate()` returning `available:false` on parse failure
  rather than throwing.
- **Cross-tool print CSS**: each source tool's print layout was tuned in isolation;
  combined pagination needs real print-preview time budgeted in P1/P2 verification.

---

### Track V — Voice Command Input

**Privacy stance (decided 2026-08-11):** the browser's `SpeechRecognition` (Chrome)
ships microphone audio to the vendor's servers for transcription — a real exception to
"nothing leaves the browser," and it needs connectivity. Voice therefore ships
**strictly opt-in, per device, with plain-language disclosure**: off by default; a
one-time consent dialog stating that "your browser sends microphone audio to its vendor's
speech service while listening"; a persistent on-screen listening indicator;
push-to-talk only (`continuous: false`), never an open mic; feature-detected so the mic
UI never renders where unsupported (e.g. Firefox). Everything else on the site stays
local. Chrome-on-laptop is the only supported v1 target.

New key: `gvb-voice:settings.v1` — `{v:1, enabled:false, consentAt:ISO|null,
lang:'en-US'}`, registered in 009 `KNOWN_GROUPS` (settings-class).

##### V1 — `_shared/voice.js` + Name Picker (one PR; requires R1)

- [ ] Create `_shared/voice.js` (IIFE, `window.Voice`):

  ```js
  window.Voice = {
    supported: function () {},        // !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    enabled: function () {},          // consent flag from gvb-voice:settings.v1
    requestEnable: function (cb) {},  // disclosure dialog -> persists consent -> cb(bool)
    disable: function () {},
    create: function (opts) {},       // -> { start, stop, listening, destroy }
      // opts: { commands: [ { template: 'call on {name}',
      //                       slots: { name: function () { /* current roster */ } },
      //                       action: function (slots, transcript) {} } ],
      //         onState: fn('idle'|'listening'|'error'),
      //         onNoMatch: fn(transcript) }
    matchName: function (spoken, names) {}  // -> {name, score} | null
  };
  ```

  Design points: mic error handling copies `_shared/qr-scan.js` (including surfacing the
  recognition `network` error as a friendly "voice needs internet" message); the returned
  handle follows the site's `{stop}`/`{destroy}` convention; command grammar is JS
  template-string parsing against the transcript — no `SpeechGrammarList` (Chrome ignores
  it); a visible mic button per tool plus one hold-key shortcut, guarded by the same
  input-focus checks as the tools' existing `keydown` handlers (don't hijack typing);
  `matchName` normalizes (lowercase, strip punctuation), then exact → unique-first-name →
  Levenshtein ≤ 2 on the first token; below threshold it returns null — never guess
  wildly at a student's name. Name slots feed from `Roster.getRoster` plus preferred
  names via `Roster.getStudentMeta`.
- [ ] Wire `007-Name Picker.html`: "pick a name" → `pickName()`; "undo" →
  `undoLastPick()`; "mark {name} absent" / "{name} is back" →
  `toggleAbsent(name, bool)`; "call on {name}" → a **new `pickSpecific(name)`** (small
  addition reusing the existing pick-animation/stats path — `chooseWinner` currently
  picks internally, so a targeted pick needs this entry point).
- [ ] Bookkeeping: `PRECACHE_URLS` += `_shared/voice.js`; `CACHE_VERSION` bump; 009 key
  registration; script tag added to 007 (`check-social` before/after).
- [ ] Verify: `npm run test:name-picker` stays green (especially around `pickSpecific`);
  manual Chrome mic session for each command including a mispronounced name (fuzzy match)
  and gibberish (`onNoMatch` feedback, no action taken); Firefox shows no mic UI at all;
  the consent-declined path constructs zero recognition objects; disclosure wording
  reviewed by Devon.

##### V2 — Behavior Points Tracker (one PR)

- [ ] Wire `008-behavior-points-tracker.html`: "point to {name}" →
  `applyTap(name, el, {skipNotePrompt: true})` with the currently armed chip;
  "point to everyone" → `awardMany()`; "undo" → `undoLogEntry(id)` of the newest log
  entry. All feedback through the existing `showMsg()` channel; same push-to-talk button
  placement as 007 for consistency.
- [ ] Verify: manual Chrome session mid-simulated-lesson (the actual use case: award a
  point without touching the laptop); `CACHE_VERSION` bump.

##### Explicitly NOT in scope (so future rounds don't drift)

- No always-on / continuous listening, no wake words.
- No free-form dictation into text fields (OS dictation already does that better).
- No voice in more than these 2 tools until both survive a month of real classroom use —
  each addition re-runs the privacy calculus.
- No local/offline speech models, no vendored recognition engine, no audio storage of
  any kind.

##### V risks / open questions

- **Recognition quality on real names** is unknowable until tried; `matchName`'s
  threshold will need a tuning round against real rosters.
- **iPad/Safari** `webkitSpeechRecognition` support is inconsistent — out of scope for
  v1; `supported()` gates it.
- **Spoken student names go to the vendor's speech service.** This is inherent to the
  API and is exactly what the consent dialog discloses. If that tradeoff stops being
  acceptable, this track is cut cleanly — nothing else depends on it.

---

---

## Cross-cutting work, sweeps and loose ends

Cross-tool observations, extraction candidates and small defects, gathered by the
sessions that hit them. Not a queue in themselves — but if one lands naturally inside a
tool you are already working on, take it. The ranked rows above point here.

#### Parked — needs a person at a real deployment or a real device

**Not ranked, and deliberately not in the table**, because no session can do it and a row a
session must skip does not belong at the top of a ranked list. It was rank 1 from
2026-09-03 until 2026-09-05, when Devon said he is not going to be running it; the standing
instruction is now "work the next two ranked items", and every row in the table has to be
one a session can actually finish. Recorded here so the gap in Stage 1's coverage is not
forgotten — see the Stage 1 entry in `HISTORY.md`, which says the same thing.

- **The two-deploy update test.** #161 replaced an unconditional `skipWaiting()` with an
  update bar, so a deploy no longer swaps assets under an open tab. `test:sw-update` drives
  the mechanism against a staging copy, but the real thing — deploy, leave a tab open,
  deploy again, watch the bar appear and the reload take — has never been done on
  aspermylessonplan.com.
- **An OS share into the installed app.** `manifest.json` declares a `share_target` POST
  that `sw.js` answers itself with a 303 into Class Roster Hub; `test:sw-tiers` and
  `test:roster-hub` cover the two halves in a browser. Nobody has installed the PWA on a
  phone and shared a CSV into it from the OS share sheet.

Both are ~15 minutes of a person's time, and both are the kind of thing that works in every
test and fails on the one device that matters. If either is ever run, record the result in
`HISTORY.md` and delete the bullet — a "never verified" note that has quietly become
verified is its own kind of wrong number.

#### ~~`check:adoption` and `check:docs-commands`~~ — **both shipped in #187**

Kept as a pointer, because two things below them still cite these sections.

`npm run check:adoption` measures the shared-file adoption row of the header above, which
was the last number in that table with no script behind it — `check:precache` has the
precache counts, `check:registry` the keys and prefixes, `check:tests` the suite count, the
a11y sweep the allowlist. It walks the 86 tool pages' real `src`/`href` and `import`
references (file list from `git ls-files`), follows per-tool modules, and prints the row as
pasteable Markdown; `-- --file roster.js` names the adopters and `-- --check` fails if the
header disagrees. It reproduces the 2026-09-04 header exactly on all eighteen rows that
header carried, which is the only reason to trust it.

**Two facts it established that were previously wrong, and one it added:**

- `_shared/student-details.js`'s two consumers are **008** (directly) and **007** (through
  `np-details.js`, which re-exports the module) — **not 006 and 008**, as the P3/P4 notes
  above said until 2026-09-05. 006 names the file in two comments and imports nothing. That
  is the identical mistake — counting a mention as a reference — that this row was written
  to end, made one section further down the same document.
- `sw-register.js` (85) and `a11y.css` (77) were not in the header's row at all. They are
  now.
- Indirect adopters print as `+n via a module` rather than being folded into the count, so
  the long-running direct number keeps meaning what it has always meant.

`npm run check:docs-commands` is the same shape of problem one layer up: a document making a
claim nothing checks. It fails when a tracked `.md` writes `npm run <name>` for a script
`package.json` does not define, or `node <path>` for a file not in the tree. See
`CLAUDE.md`'s sweeps list for the two escape hatches and what it deliberately does not check.

**What is still open here, and is not ranked because nobody has argued it is worth doing:**
the 318 bare backticked file paths across the tracked `.md` files. Most are written without a
directory prefix (`005-seating-chart.html`, `roster.js`), so resolving them means guessing,
and a guard that guesses is worse than no guard. Measured on 2026-09-05, not implemented. If
someone wants it, the honest version resolves against a basename index of `git ls-files` and
reports only the ones with exactly one candidate.

#### Small defects found during the 2026-09-02 survey, still open on 2026-09-03

Re-verified against the tree. Fix opportunistically; listed once so they stop being
rediscovered.

- **Dead and unlinked, ~590 KB in four places**: `index_backup.html` (40 K),
  `Tools/Old Designs/` (224 K), `Tools/New Designs/` (212 K) and
  `Other Landing Page ideas/` (116 K). Nothing in the repo references any of them and
  none is precached, so they cost nothing at runtime — they cost grep noise and the
  recurring "wait, is this live?" question. `Tools/New Designs/` is also where the five
  dangling `_shared/theme-toggle.js` script tags ended up when Path 5 P1 deleted that
  file. Deleting them is a one-line `git rm` with no `PRECACHE_URLS` or `CACHE_VERSION`
  consequence; git history keeps them. **Not dead, despite an earlier survey saying so:**
  `v1-inbox.html` → `v2-subplans.html` → `v3-bellboard.html` → `v4-riso.html` are a live
  loop of alternate landing skins, entered from `index.html`'s footer (C6) and returning
  to it from v4, and all four *are* precached. Leave them alone.
- ~~`assets/js/gvb-save.js` (save bar + storage probe) is shared code living outside
  `_shared/`, contra `CLAUDE.md`.~~ **Moved to `_shared/gvb-save.js` in #193**, which also
  emptied `assets/js/`. Its consumers are `005` and `007`'s `np-store.js`; the bullet used to
  name `064`'s `htcm-store.js` as a third, and that was wrong — it imports nothing from it.
- ~~`Tools/schedule/README.md` still documents `Tools/schedule/libs/jspdf/`.~~ **Fixed in
  #187**, in passing, while `check:docs-commands` was fixing that file's two dead `npm run`
  citations. The tree diagram now names `_shared/vendor/jspdf/`, which is where 035 actually
  loads it from. Nothing guards a path in a tree diagram — see the note about the 318 bare
  backticked paths above.
- `Tools/seating-chart/fonts/*.woff2` (~167 KB, three faces) appear unreferenced by any
  page and are not precached.
- `Tools/009-backup-restore.html`'s `IDB_NOTES` knows only `bmg-maps`; `rgb-audio`
  (Review Game Board clue audio) and `stviz-recovery` (Schedule Visualizer crash
  recovery) are unlabeled in backups, and `indexedDB.databases()` is unavailable in
  Firefox, so Firefox backups silently omit all IndexedDB content. Path 4 P2 and P3 fix
  the general case; the labels are cheap now.
- `ideas-backlog.html` declares `@font-face` for five woff2 files under `assets/fonts/`
  **that were never committed**, so the page falls back to system-ui on the live site
  while every tool page under `Tools/` has its own committed fonts. Either vendor the
  five files (and precache them) or drop the declarations. *(`index.html` no longer
  declares them; the directory genuinely does not exist.)*
- **Fixed since the survey, recorded so they are not re-reported:** the `v1`–`v4`
  landing chain, `scg-photo.js`, `ideas-backlog.html` and both maskable icons are now
  precached; the `_ds` Google Fonts `@import` is vendored to `_shared/vendor/barlow/`;
  the entity-in-a-JS-string bug, the `hidden`-loses-to-`display:flex` bug and the
  fixed-height print clip each have a guard (`check:entities`, `check:hidden-flex`,
  `check:print-clip`).

#### Refactor Plan leftovers

The retired refactor plan’s Phases 0, 1, 1b, 2, 5 and 6 are complete, and Phase 4 is complete
for the three rules currently in `_shared/base.css` — `npm run phase4:next` reports 0
remaining candidates, with 68 tools linking it and 11 identified as having only per-tool
variants. Phase 3 (theme adoption) was superseded by Path 5. One thing was left open on
purpose:

- **The next dedupe candidates in the same head block:** `.app-header h1`,
  `.app-header .sub`, `.back-link`, `.back-link:hover`, `.card h2`. Round 4f stopped at
  the three established rules to keep its blast radius small.

Two `base.css` facts that must survive the plan file: **`base.css` is safe for any tool;
`print-area.css` is not** — it blanks the page on print and restores only `#printArea`,
so linking it from a tool without that element, or one with its own `@media print`
block, breaks printing. And the **cascade trap**: `#printArea { display: none }` and the
`@media print` block both have specificity (1,0,0), so the print block only wins by
coming last. Both moved into `base.css` together, in their original relative order, and
the `<link>` goes after `_shared/a11y.css` and before the tool's inline `<style>`.

---

#### Shared design-system stylesheet loads Google Fonts over HTTPS — breaks offline/blocked-network use

Found 2026-08-10 while adding an automated smoke test to
`011-image-to-pdf.html` (Pass 2, Round 1, session `v19h3x`).

`_ds/industry-dbdf1714-c448-4b04-9ea3-c77c792b4c8a/styles.css` — a shared
design-system stylesheet referenced by at least 10 tools, including
`011-image-to-pdf.html`, `036-final_grade_checker.html`,
`005-Seating Chart Generator.html`, `031-docx-merger.html`, and others — opens
with:

```css
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap');
```

In an offline or blocked-network sandbox this `@import` fails outright
(`ERR_CONNECTION_RESET` in headless Chromium here), and it's a render-blocking
`@import` at the top of the stylesheet, not an opportunistically-cached
`<link>`. This is the exact same class of problem as the vendored-CDN-library
issue documented as **P5** in [Platform themes](#platform-themes-p1p15) (three tools used to load
JS libraries from `cdnjs.cloudflare.com`; all three are now fixed by
vendoring), just for a font instead of a script — and it likely affects more
tools than the ten discovered by grepping for the exact stylesheet path,
since other tools may pull the same or a different Google Fonts URL directly
in their own `<head>` rather than through this shared file. Worth a
site-wide grep for `fonts.googleapis.com` the next time someone is doing a
P5-style pass, alongside the existing `cdnjs.cloudflare.com` grep — not just
in this one shared stylesheet.

**Suggested fix**: vendor the Barlow/Barlow Condensed font files locally
(`Tools/schedule/fonts/fonts.css` already does exactly this pattern for a
different font — self-hosted `@font-face` rules pointing at local `.woff2`
files — and would be the template to copy), the same way the three CDN-JS
tools were vendored in earlier rounds. Out of scope for a single tool's own
round since `_ds/` is shared infrastructure, not any one tool's file — flagged
here rather than fixed unilaterally, per this file's purpose.

**Workaround used in the smoke test**: the test blocks non-`file://` network
requests and filters the resulting generic connection-reset console message,
rather than fixing the shared file. This means the smoke test doesn't
actually catch a regression in the font loading itself — just doesn't fail
on the pre-existing problem it isn't scoped to fix.

---

#### P12 image-storage risk likely extends beyond the tools already flagged

Found 2026-08-11 while adding image downscaling to
`028-primary-source-analysis-generator.html` (Pass 2, Round 2, session
`mxpfjs`). [P12](#p12--storage-quota-images-and-indexeddb) already names several
image-bearing tools that base64 uploads straight into `localStorage`; this
round's implementer checked and confirmed only `Tools/timeline-builder/`
and `Tools/seating-chart/` currently have a dedicated downscale-before-store
module to copy from (both accept a max-dimension + JPEG-quality canvas
resize). `028` now has its own copy of that same pattern.

Still worth a dedicated P12 pass across the rest of the image-accepting
tools this round didn't touch: `046-blank-map-generator.html` (already uses
IndexedDB for its map cache, so may already be fine — worth confirming
rather than assuming), `042-certificate-award-maker.html`'s logo upload
(`cam-logo.js`), `080-virtual-manipulatives-board.html`, and
`038-data-chart-builder.html` if it accepts images. A shared
`_shared/downscale-image.js` (extracted from the timeline-builder/
seating-chart/primary-source-analysis copies, which are likely near-identical
by now) would be a reasonable next step rather than a fourth
copy-paste the next time an image-upload tool gets touched.

---

#### Fullscreen-stage duplication has now reoccurred a fourth time, with a new wrinkle

Found 2026-08-11 across three tools worked in the same round (Pass 2, Round
2, session `mxpfjs`): `023-exit-ticket-generator.html`,
`024-number-talks-board.html`, and `025-writing-prompt-generator.html`.
[Threads left open across rounds](#threads-left-open-across-rounds) already
tracks this exact duplication (fullscreen-stage wiring independently built
in at least four tools: `021`, `023`, `024`, `025`), so this is not new
information — but this round surfaced a specific new wrinkle worth
recording for whoever eventually builds the shared module:

The Fullscreen API only renders the fullscreened element's own DOM
subtree. `025-writing-prompt-generator.html` needed to add a *live,
interactive* writing timer (Start/Pause/Reset buttons, not just a bigger
font) that stays usable while `.stage` is fullscreened — the same
constraint that already forced the Round 4 Anonymous Response Display
into an overlay reparented inside the fullscreened element. A shared
`_shared/stage.js` helper (built in Path 5 P2, #180, as `Stage.mount` with `hud`) needs to
account for *interactive controls living inside the fullscreened subtree*
(timers, reveal buttons, response toggles), not just static display
content (bigger prompt text, dark background) — the four independent
implementations so far have all discovered this the hard way rather than
having a documented contract for it.

---

#### HTML entity written as literal text in a JS string, later passed through `escapeHtml()` — six confirmed instances, worth a dedicated sweep

Found again 2026-08-11 in `072-plot-diagram-builder.html` (Pass 2, session
`4o6xmy`), fixed as part of that tool's own round.

The bug shape: a JS string literal contains an HTML entity written as text
(e.g. `'&mdash;'`, `'&deg;'`) instead of the actual Unicode character (—,
°), and that string is later passed through the toolkit's standard
`escapeHtml()` helper before being inserted via `innerHTML`. `escapeHtml()`
escapes the leading `&` into `&amp;`, so the entity never resolves — the
page (or, worse, the printed output) shows the literal text `&mdash;`
instead of an em dash.

This is now confirmed **six times** across the toolkit, each caught by
chance during a different tool's own round rather than by a systematic
search:

1. Verb Conjugation Reference Poster Generator (`079-...html`)
2. Sub Note / Feedback Slip Generator (`076-...html`)
3. Science Fair Project Tracker (`073-...html`)
4. Government/Civics Simulation Role Card Generator (`050-...html`)
5. PE Warm-Up Circuit Card Generator (`069-...html`, in a station's
   instructions text)
6. Story Elements / Plot Diagram Builder (`072-...html`, in the print
   view's empty-field fallback text — `'&mdash;'` used four times)

Six independent hits by accident is a strong signal there are more. Worth
a dedicated site-wide grep the next time someone has a round to spare:
search every `Tools/*.html` for entity-name patterns (`&mdash;`, `&ndash;`,
`&deg;`, `&hellip;`, `&rsquo;`, `&lsquo;`, `&ldquo;`, `&rdquo;`, `&trade;`,
etc. — not `&amp;`/`&lt;`/`&gt;`/`&quot;`/`&#39;`, which are the
legitimately-escaped ones) appearing *inside a JS string literal* (i.e.
inside `'...'` or `"..."` in a `<script>` block, not inside literal HTML
markup where entities are correct as-is) rather than waiting for the next
tool's smoke test to catch instance seven by luck. The fix each time has
been the same one-line swap: replace the entity name with the actual
Unicode character in the source string.

---

#### Fixed-height, `overflow: hidden` half-sheet print CSS silently clips content

Found/fixed 2026-08-11 in `076-sub-note-feedback-slip-generator.html` (session
`b4zswl`). The print CSS for a "two half-sheets per page" layout used
`.slip { height: 47vh; overflow: hidden; }` — if the content inside a slip
(a long prompt list, in this case) grows taller than 47vh, it gets silently
clipped with no visual sign anything is missing. This is worse than an
overflow that just looks bad, because a teacher has no way to know content
was cut off from the printed page.

**The fix applied to 076**: switch to `min-height: 47vh; overflow: visible`
and add a content-length threshold — under the threshold, keep the original
"two per page" layout (`page-break-after: always` every 2nd `.slip`); over
it, give each item its own full page instead
(`page-break-after: always` every 1st `.slip`), so nothing clips regardless
of how much content is in a single slip.

This tool's own file (`076-sub-note-feedback-slip-generator.md`, prior
Status entries) already flagged that **Peer Feedback / Editing Checklist
Generator** (`070-peer-feedback-checklist-generator.html`) and **Art Critique
Worksheet Generator** (`047-art-critique-worksheet-generator.html`) share the
identical `.slip`/half-sheet fixed-height print pattern and the identical
risk — neither has been fixed yet. Worth applying the same pattern (min-height
+ overflow: visible + a one-up fallback) the next time either tool gets a
round, rather than re-discovering the bug independently.

**Update, 2026-08-11: both are now fixed, independently and concurrently
with this note being written.** Art Critique Worksheet Generator switched
to `min-height`/no-`overflow:hidden` — shipped independently by both
session `szyio3` and session `8vo65u` in the same round (PR #74, merged
first; confirmed present on `main`). Peer Feedback / Editing Checklist
Generator picked up the same `min-height` fix plus an on-screen size
warning and two-tier print font/spacing scaling in session `4o6xmy`'s
round. 076's own fix (a content-length threshold that falls back to
one-slip-per-page past a certain size) is a third, slightly more
sophisticated variant of the same underlying idea — worth comparing all
three approaches the next time any print-clipping issue turns up
elsewhere, rather than picking one arbitrarily.

---

#### Same-minute claims in the retired round tracker are invisible to each other

Found 2026-08-11 when session `szyio3` (assigned tools 047–052) and session
`8vo65u` (assigned tools 047–051) were both directly instructed to start
work at essentially the same moment. Both read the "Currently claimed"
table while it was empty and pushed their own claim row in the same UTC
minute (01:29), so neither could see the other's claim before starting —
the claim system's "check before you build" step only works when a claim
actually lands before the next session reads the table, and two claims in
the same 60-second window race past each other. The result was five tools
(047, 049, 050, 051, and partial overlap on 048) built independently and
in parallel by two sessions, discovered only at merge time as real PR
conflicts, not just a tracker-file conflict — one file's automatic 3-way
merge silently duplicated UI elements and event handlers instead of
combining two genuinely complementary features cleanly, which would have
shipped a visibly broken double-button row if merged without a human (or
agent) actually reading the merged output. See
the retired round tracker’s "Held-out batch — Round 2" entry (git history) for the full
resolution.

**This isn't hypothetical anymore — it happened once and could happen
again**, especially whenever Devon assigns overlapping tool ranges to two
sessions in the same message/moment (as happened here: 047–051 and
047–052). Nothing about the claim table's mechanics can fully close a
same-minute race, but two things would reduce the odds and the damage:

- **Before opening a PR**, re-fetch `main` and check whether another
  session has since merged work touching the same tool files, not just
  whether they're still in "Currently claimed" — a claim disappears the
  moment the other session finishes its round, well before that session's
  own PR merges.
- **On a real merge conflict in a tool's own `.html`/`.md` files** (as
  opposed to just the shared tracker file), never trust an automatic
  3-way merge result at face value — diff the conflicting file against
  the other session's already-merged version first to check whether the
  two rounds picked the same Quick Win (redundant, discard one side) or
  different ones (complementary, needs a careful hand-merge, not a
  git-automatic one) before resolving.

#### Cross-tool vector map rendering wants a home in `_shared/`

Found while shipping the map + timeline print for `015-timeline-builder.html`
(social studies demo round, session `mq7fkd`).

`Tools/blank-map-generator/bmg-vector.js` turns out to be a genuinely
reusable, app-state-free vector map renderer: `renderBaseMapCanvas(preset,
{style, borders})` reads only `preset.bounds` and `preset.dataset`, resolves
its own data directory from `import.meta.url`, and returns a canvas plus the
calibration that describes it. Timeline Builder now calls it directly, with a
synthetic preset built from an auto-fitted extent, and gets a correct map with
no duplicated code.

That is the right call for one consumer — the alternative was a second
plate-carrée renderer, and the only real content of one would have been
re-deriving `unwrapRing`/`drawableRings`, the antimeridian handling that stops
a naive render of this data drawing full-width lines across the South Pacific
and northern Siberia. Getting that subtly wrong is a bug that survives a
visual check.

But it leaves a coupling nothing enforces: **a tool outside
`Tools/blank-map-generator/` now breaks at print time if that module's
signature changes**, and only Timeline Builder's own smoke test would notice.
Two things worth doing when someone has the room:

- Move the renderer (and the `data/` GeoJSON it reads) into `_shared/`, with
  both tools importing from there. Neither could be done this round:
  `_shared/` was off limits to all eight parallel sessions, and
  `Tools/blank-map-generator/` was owned by a concurrent one.
- Give `renderBaseMapCanvas` an optional output-size argument. It always
  renders at a 4000px long side, which is right for the map tool's poster
  exports and well past what a timeline's map panel needs — Timeline Builder
  currently downscales to 2× its print box and releases the big buffer by
  hand, which a size argument would make unnecessary for both tools.

Related, and cheaper: `Tools/blank-map-generator/bmg-label-sets.js` already
carries hundreds of curriculum place names with coordinates. Timeline Builder
shipped its own ~145-entry gazetteer in `Tools/timeline-builder/tlb-places.js`
because reaching into another tool's data for *content* felt like a bigger
commitment than reaching into it for a *renderer*. If a third tool ever wants
"a list of places a middle school course names", that data should be shared
rather than hand-grown a third time.
#### Two-column pasted data is now parsed in at least three places

Raised by the Blank Map Generator's choropleth round (2026-08-13, session
`q4wmxz`), which needed to turn pasted `name, value` rows into numbers and
deliberately did **not** reach into `_shared/` (the round rules forbid it,
for good reason with 8 sessions running).

What now exists independently:

- `Tools/blank-map-generator/bmg-choropleth.js` — `parseDataRows()`:
  tabs / semicolons / pipes / commas, thousands separators, `$` and `%`,
  blank lines, header-row detection, and the awkward case of a *name* that
  contains the delimiter (`Congo, Dem. Rep., 95000000`).
- `Tools/038-data-chart-builder.html` — its own pasted-table parsing.
- `Tools/blank-map-generator/bmg-label-sets.js` — `parseCoordLine()`, the
  same shape of problem for `name, lat, lon`.

None of these is wrong, and none should be ripped out on spec. But a third
independent implementation is the point at which it's worth someone deciding
whether `_shared/paste-table.js` should exist, with one documented set of
rules about delimiters, headers and thousands separators. That decision needs
a quiet moment and one owner, not a parallel round.

A second, smaller candidate from the same work: a grayscale-safe sequential
colour ramp plus a WCAG relative-luminance helper (`RAMPS`,
`relativeLuminance()` in `bmg-choropleth.js`). Any tool that shades something
by an ordered value — the grade distribution visualizer is the obvious one —
wants exactly this, and "does it survive the photocopier" is a property worth
asserting in one place rather than re-arguing per tool.

#### Antimeridian-safe GeoJSON ring drawing now exists in three places (from 062, SS demo round 2)

`unwrapRing()` / `drawableRings()` — the pair of functions that stop a plate
carrée render of Natural Earth from ruling a stray line clean across the map
every time a country's ring is clamped to ±180 (Fiji, Chukotka, Antarctica's
closing edge) — now exists three times:

- `Tools/blank-map-generator/bmg-vector.js` — the original, with the best
  comments.
- `Tools/timeline-builder/tlb-places.js` — delegates the render, but carries
  its own copy of the projection maths for pin placement.
- `Tools/geography-bee-quiz-generator/gbq-map.js` — added this round, adapted
  from bmg-vector for snippet-sized renders.

Three copies is the usual threshold. The natural extraction is a small
`_shared/geo-project.js` holding the projection, its inverse, `unwrapRing`,
`drawableRings` and a `traceFeature(ctx, …)` — deliberately *not* a renderer,
since each consumer wants different paint and a different output size.
`_shared/` is out of bounds during a parallel round, so this is a note rather
than a change.

Worth knowing before anyone does it: the three copies are not interchangeable.
bmg-vector traces a whole FeatureCollection into one path; gbq-map has to be
able to trace one named feature on its own, so a highlighted country's holes
cancel against its own rings and not its neighbours'. A shared version needs
both entry points, which is why the suggestion above is `traceFeature` rather
than `traceFeatures`.

#### `_shared/levels.js` — one home for the three teaching levels (from 056, round 2)

Round 2 asked several tools to implement the same differentiation spec: a
selector with exactly `Academic` / `Honors` / `Honors GT`, defaulting to
Honors, affecting printed output only, plus a "print all three levels" run
whose pages carry a level footer tag. 056 (DBQ / Source Packet Builder) and
028 (Primary Source Analysis) both built it independently in the same round,
and more tools will want it.

The duplicated part is small but exactly the kind that drifts: the three
label strings, the default, and the footer-tag markup. If two tools ever
disagree on a label ("Honors GT" vs "Honors-GT") the feature stops reading as
one coherent thing across the toolkit, which was the whole point of
specifying it centrally. A `_shared/levels.js` exporting the ordered list,
`levelLabel(key)`, `isLevel(key)`, and a `levelTag(key, title)` markup
helper would cost almost nothing and pin all of it.

A second, larger candidate from the same work: 056 ships a ~60-entry
plain-language glossary of social-studies vocabulary, used to build the
Academic-level "before you read" gloss from the teacher's own source text,
with an honest "check these words with a partner" fallback when nothing
matches. Any tool that wants a vocabulary support line — 028, the vocab
flashcard generator, the writing prompt generator — wants that same list, and
a shared one can grow over time instead of three tools each hand-rolling
sixty definitions. Worth one owner deciding where it lives before a third
copy exists.

#### Point-in-polygon picking, and a list-to-sentence formatter (from 046, SS demo round 2)

Two more small generic pieces written locally in `Tools/blank-map-generator/`
because the round rules forbid touching `_shared/`. Neither is urgent; both
are recorded so a third occurrence isn't written from scratch a third time.

- `bmg-hittest.js` — even-odd point-in-polygon over a set of projected rings,
  with bounding-box rejection, plus ring compaction for storage. It is written
  against GeoJSON-shaped data, but the geometry itself has nothing to do with
  maps: anything that has to turn a click into "which shape is this" wants it.
  **The one thing worth carrying over if it ever moves:** the module
  deliberately imports its projection from the *renderer* rather than owning a
  copy, because a hit test that disagrees with what was drawn fails silently
  and is very hard to notice. Whatever shape a shared version takes, it should
  keep taking the transform as an argument rather than defining one.
- `regionGroupCaption()` in `bmg-legend.js` — "A", "A and B", "A, B and C",
  "A, B, C and 4 more". Small, but several tools on the site build that
  sentence by hand and none of them agree about the Oxford comma or the
  cut-off. A shared version would at least make the site consistent with
  itself.

Also worth noting for whoever picks up the `_shared/paste-table.js` question
above: `bmg-choropleth.js` now has a **second** parser next to
`parseDataRows()` — `parseDataTable()`, for several value columns — and the
two make a genuinely instructive pair. The single-column one can afford to be
relaxed about commas, because a value has to run to the end of the line, so
`6,200,000` can only be one number. The multi-column one cannot: once there
are three value columns, `Rhode Island, 69,000, 148,000` is truly ambiguous.
It prefers tabs (which every real spreadsheet paste supplies) and *reports*
the rows it can't read rather than guessing at them. Any shared version has to
answer that, not paper over it.

#### Threads left open across rounds

From the retired the retired round tracker. Its allowlist figures (59 pages, 91 pairs)
are the 2026-09-03 baseline and have since dropped to **21 pairs on 21 pages, all of them
`color-contrast`** — the `select-name`, `label`, title-only-label and `aria-required-children`
classes it lists below are all gone; the rest stands.

Not a queue, and not a reason to re-open a finished tool — but if one of these
lands naturally inside a tool you are already working on, take it.

- **The accessibility baseline.** `Tools/a11y-sweep/allowlist.json` (Path 2
  P3, 2026-09-03) records every serious/critical axe-core finding on first
  load, per page and rule: 59 pages, 91 pairs — 41 unlabeled `<select>`s
  (`select-name`), 23 unlabeled inputs (`label`), 21 contrast failures on
  muted text, 5 title-only labels, 1 `aria-required-children` — of which only the
  contrast lines are left, the last non-contrast one (034's) having gone in #191. If you are in
  a tool that has a line there, fix it and delete the line; `npm run test:a11y
  -- --only <nnn>` confirms, and the suite goes red if the line outlives the
  bug. The `select-name`/`label` classes are one `aria-label` each and would
  make a clean mechanical round on their own.
- **Adopt the shared student record.** Class Roster Hub owns
  `crh_students_v1` (stable ids, preferred name, pronunciation) and Name
  Picker reads it via `Tools/name-picker/np-details.js`, which is the pattern
  to copy. Every tool that keys student history on a name string would
  benefit; the Behavior & Points Tracker is where it would save the most data.
- **P1 projector mode.** Command Center has one now as a display state rather
  than a separate page. Any tool that gets projected could copy the approach.
- **P5 CDN dependencies.** All three tools that used to load a library from
  cdnjs have now been fixed, each the same way — vendor it locally, source
  pulled from the library's npm package rather than cdnjs itself, since
  cdnjs was unreachable from more than one session's sandbox this round of
  rounds: `011-image-to-pdf.html` (jsPDF, Round 3, PR #54, vendored into
  `Tools/image-to-pdf/lib/`), `031-docx-merger.html` (JSZip, Round 6, PR #58,
  vendored into `Tools/docx-merger/lib/` — see the npm-package fallback
  approach documented in `031-docx-merger.md`'s Status section), and
  `044-Sub Plan Builder.html` (JSZip, Round 8, PR #61, vendored into the new
  `Tools/sub-plan-builder/lib/` via `npm pack jszip@3.10.1`). No known CDN
  dependency remains on the site as of Round 8, but it's worth a fresh grep
  for `cdnjs.cloudflare.com` (or any other CDN host) if a future round adds
  a library, rather than assuming this list is exhaustive forever.
- **P8 backup compatibility.** `Tools/009-backup-restore.html` keeps two lists
  that go stale silently: `KNOWN_GROUPS` (friendly names in the scan table)
  and `STUDENT_KEYS` (what the year-end clear is allowed to erase). **A tool
  that starts writing a new storage key — especially one holding student
  names — needs adding to both**, or it shows up as "Other saved data" and
  survives a year-end clear.
- **Content-bank + display + handout convergence.** After Round 4 (PR #55),
  this pattern now exists independently in `023-exit-ticket-generator.html`,
  `024-number-talks-board.html`, and `025-writing-prompt-generator.html` — each has
  its own bank editor, its own fullscreen/projector stage wiring, and its
  own print handout. The fullscreen-stage code in particular is now
  near-identical in three places (and also in `021-pe-tournament-stations.html`).
  Worth lifting into a shared `_shared/` helper next time one of these four
  is touched, rather than writing a fifth copy.
- **Rotation/bracket engine duplication.** `020-bracket-tournament-generator.html`
  and `021-pe-tournament-stations.html` still have separate bracket/rotation
  logic after Round 4 (each grew independently this round, deliberately
  scoped that way to avoid a risky shared-engine refactor mid-round). A
  future round could unify them — `bracket-tournament-generator`'s new
  round-robin/scheduling code and `pe-tournament-stations`'s rotation timer
  are the two halves to reconcile.
- **Read-only cross-tool bridge pattern.** `025-writing-prompt-generator.html`
  added `wpg-rubric-link.js`, which reads Rubric Builder's own localStorage
  keys read-only and writes back only the `:current` pointer Rubric Builder
  already watches on boot — no shared library, no format negotiation. This
  is a lighter-weight alternative to a full shared-hub tool and is worth
  copying wherever a tool wants to reference another tool's data without
  taking on a dependency.
- **BroadcastChannel is same-device only.** `021-pe-tournament-stations.html`'s
  new phone/remote-control feature confirmed empirically that
  `BroadcastChannel` only bridges tabs within the same browser
  context/profile — it does not work across two different phones/devices.
  Any future "phone as remote" work (P9) needs a different mechanism (e.g.
  WebRTC pairing, as `035-schedule-visualizer.html` already uses) for true
  cross-device control.
- **`hidden` loses to `display: flex`.** Round 10 found a control in the
  Blank Map Generator's toolbar that had been visible whenever it shouldn't
  be, because the element carried `hidden` but its class set
  `display: flex` — which outranks the browser's own `[hidden]` rule. Any
  tool that hides a flex/grid-displayed element by attribute needs an
  explicit `[hidden] { display: none; }` rule; worth a grep wherever a
  toolbar control is toggled this way.
- **`height` + `overflow: hidden` on a print block silently clips content.**
  `047-art-critique-worksheet-generator.html`'s half-sheet print CSS used
  `height: 47vh; overflow: hidden`, which cut off a worksheet's later
  follow-up questions with zero visual warning on screen — the printed
  page just quietly lost content. Fixed there by switching to
  `min-height: 47vh` (no `overflow: hidden`), letting normal page flow
  carry any overflow onto the next printed page instead of eating it.
  `070-peer-feedback-checklist-generator.html` had the exact same pattern
  and has since picked up the identical `min-height` fix (session
  `4o6xmy`'s held-out-batch round), layered on top of that same round's
  own on-screen size warning and two-tier print font/spacing scaling —
  see the matching entry in [Cross-cutting work](#cross-cutting-work-sweeps-and-loose-ends) for the fuller writeup and a
  third variant of the same fix in `076-sub-note-feedback-slip-generator.html`.
- **Multi-save localStorage convention: `list` / `data:<name>` / `current`.**
  Formula Sheet Builder (`Tools/formula-sheet-builder/fsb-store.js`) was
  the first to name this pattern explicitly — a `list` key holding an
  array of saved names, a `data:<name>`-prefixed key per saved item, and a
  `current` key pointing at whichever one is open. Plot Diagram Builder
  (072, session `4o6xmy`'s held-out-batch round) copied the same
  three-key shape inline (no support folder yet) to add multiple named
  diagrams, including a one-time migration path for any pre-existing
  single-document data under the old key. Any tool moving from "one
  document per browser" to "multiple named documents" should copy this
  shape rather than invent a new one.
- **Generated-output drift is a real failure mode, not just a theoretical
  one.** Round 7 found that `035-schedule-visualizer.html`'s "Publish" button
  would produce a broken `034-schedule-browser.html` (undefined `escHtml`/
  `escJsAttr` — fixed) and, separately, one missing three real feature
  generations' worth of code (R61–R63: PNG download, share links, staleness
  banner, Compare mode — documented but not ported, too large for one
  round). If another tool on this site generates a second artifact from a
  first (a template, a published snapshot, an exported format), it's worth
  checking whether the two have quietly diverged the same way before
  assuming the generator is still the source of truth.

---

## Per-tool sections

One section per tool that has recorded open ideas. Tools **082–086** (Citation Generator,
Propaganda Analysis, Socratic Seminar Prep, Parent Communication Templates, Wiki Race) never got
an improvement-prompts file, so they have no section here; 086 has one line in the cross-cutting
section above and 085 appears under Path 16 P4.

### 001 — Digital Hall Pass / Sign-Out Log

*`Tools/001-hall-pass-log.html`.*

#### Major Features

- **Skipped — deferred.** **Correlate with the schedule.** Which period, which activity, which day of
  the week — the report a counselor or administrator actually wants when a
  pattern is suspected (P7, using the calendar/bell schedule). *(Explicitly
  out of scope for this round per the cross-tool dependency on School
  Calendar Visualizer.)*
- **Skipped — deferred.** **Student-initiated request flow** (P9). A student taps a request on a
  shared classroom device or their own; it appears on the teacher's board for
  approval. Keeps the teacher from being interrupted mid-sentence, and needs
  no server. *(Explicitly out of scope for this round — nontrivial WebRTC/UX
  work.)*

#### Moonshot / North Star

**Hall passes that answer questions, not just record events.** A teacher taps
twice; the board handles the rest — enforcing the policy, timing the trip,
noticing the pattern, printing the pass, and being able to say, six weeks
later and entirely from local data, exactly when a student has been out of the
room and what was happening in class at the time.

#### Open Questions

- How long should archived hall pass history be retained, and should it
  auto-expire at the end of a quarter? *(Still open — `HISTORY_LIMIT = 90`
  entries was already the cap before this round; no auto-expiry-by-date
  logic exists yet.)*

#### Platform themes that matter here

- **P2 (shared roster)** — already reads `np_rosters`; needs stable IDs for
  history that survives a roster edit.
- **P7 (cross-tool)** — already consumed by Command Center; wants the
  bell schedule and the seating chart.
- **P9 (device pairing)** — multi-teacher awareness shipped 2026-08-13
  (Hallway Sync, WebRTC peer pairing); student-initiated request flow is
  still open.
- **P1 (projector mode)** — with a genuine privacy caveat about what gets
  projected.

### 002 — Group / Team Generator

*`Tools/002-group-team-generator.html`.*

#### Major Features

- **Roles built in** (P7). `022-lab-group-role-randomizer.html` assigns roles with
  a recency memory; `027-novel-study-circles-manager.html` does the same for
  reading circles. Three tools implement group-formation and two implement
  role rotation. One engine should serve all of them. **Skip (2026-08-10)** —
  explicitly out of scope for this round per the cross-tool consolidation
  note; still open for a dedicated round.
- **Group history across the year.** "Everyone has worked with everyone at
  least once" is a real goal and the pair history already tracks the data
  needed to visualize and drive it. **Skip (2026-08-10)** — out of scope for
  this round; note that `pairHistory` currently only retains
  `PAIR_MEMORY_WINDOW` (2) generations, so a real "across the year" view
  would need a retention-policy decision first.
- **Seating-aware grouping** (P7). Groups that are physically possible given
  the seating chart — four students who sit near each other — versus groups
  that require a room reshuffle. **Skip (2026-08-10)** — depends on Seating
  Chart Generator's data, out of scope for this round.
- **Project-team mode.** Longer-lived teams with names, a shared task list,
  and a printable team contract, rather than a one-period grouping. **Skip
  (2026-08-10)** — out of scope for this round; a persistent multi-day team
  is a different data model than this tool's per-period generate/print flow.

#### Moonshot / North Star

**Grouping that remembers the whole year and can explain itself.** Ask for
groups of four, balanced, nobody repeating a partner from the last three
weeks, these two apart, roles rotated so nobody is the recorder twice — and
get it instantly, with a plain-English explanation of what it optimized and
what it had to compromise, printed as table tents and a group sheet. Across
every tool on the site that forms groups, using the same memory.

#### Open Questions

- Should the group-formation engine be extracted into `_shared/` and consumed
  by the four tools that need it, or should one of them become the canonical
  tool and the others link to it?
- Where should skill values live — here, or on the shared student record (P2)?
  They're arguably the most sensitive thing the site would store.

#### Platform themes that matter here

- **P7 (cross-tool)** — the clearest consolidation opportunity on the site:
  this tool, Lab Group & Role Randomizer, Novel Study Circles, and Name
  Picker's Groups mode all implement overlapping logic.
- **P2 (shared roster)** — already reads `np_rosters`; needs stable IDs so
  pair history survives a roster edit.
- **P11 (undo)** — a reshuffle destroys the previous grouping irrecoverably.
  **Resolved (2026-08-10)** for the single-most-recent shuffle via a one-level
  undo button; no multi-step history stack.
- **P6 (print quality)** — table tents and group sheets. **Addressed
  (2026-08-10)** — both are implemented, mirroring
  `022-lab-group-role-randomizer.html`'s existing print approach.

### 003 — Rubric Builder

*`Tools/003-rubric-builder.html`.*

#### Major Features

- **Peer review mode.** The same rubric, reduced, as a peer feedback form —
  which this backlog lists as a separate tool and which is a print mode
  here. **Skipped this round** — the student-friendly print with a
  self-assessment column substantially covers this use case per the brief.
- **Feed the grade tools** (P7). Rubric scores should flow into
  `036-final_grade_checker.html` and `037-grade-distribution-visualizer.html` instead
  of being retyped. **Done 2026-08-13, for Grade Distribution Visualizer** —
  see Status. Final Grade Checker has no saved-gradebook storage contract to
  write into (verified, not assumed — see Status), so that leg stays
  not-applicable until that tool's storage model changes, not because it was
  skipped.
- **Standards alignment.** Tag criteria to standards, and report by standard
  rather than by assignment — the shape standards-based grading needs.
  **Skipped this round** — a larger schema decision; recorded as an Open
  Question rather than a partial implementation.

#### Moonshot / North Star

**One rubric, the whole assessment cycle.** Build it once; students see it in
their own language and self-assess against it; peers use a reduced version to
give feedback; the teacher grades a class of 28 from one grid with a comment
bank; each student gets a printed scored rubric with real comments; the class
data shows which criterion to reteach; and the scores flow into the gradebook
tools without being typed twice.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Rubric delivered to students by link** (rather than printed), and
  on-screen student self-assessment. The printed student-readable rubric with
  a self-assessment column covers the same practice on paper.

#### Open Questions

- Where should scored student data live — here, or in a shared assessment
  store that the grade tools also read? **Resolved 2026-08-13, for Grade
  Distribution Visualizer:** scores stay local to Rubric Builder (the source
  of truth), and a totals-only copy is written out into Grade Distribution
  Visualizer's own store on demand, same "write a copy into the target's own
  shape" pattern as other cross-tool handoffs in this repo rather than a new
  shared store both tools read from. Final Grade Checker still has no store
  to write into at all (see Status) — that half of the original question is
  moot until/unless it gets one.
- Is standards-based reporting something this district needs, or is
  points-based the only realistic model? **Still open** — standards
  alignment/tagging was explicitly skipped this round rather than
  half-implemented; needs a decision before any schema work starts.

#### Platform themes that matter here

- **P2 (shared roster)** — **Addressed 2026-08-10.** Scoring mode and the
  class-wide grid both load from `np_rosters` now.
- **P7 (cross-tool)** — scores should feed the grade tools. **Addressed
  2026-08-13 for Grade Distribution Visualizer** (`rb-gdv-handoff.js`, see
  Status) — a real write handoff into that tool's own store, not just CSV
  export. Final Grade Checker has no gradebook store to feed (see Status);
  CSV export remains the interim bridge for that tool specifically, until/
  unless its storage model changes.
- **P3 (share links)** — already adopts `state-link.js`; the natural use is
  sharing a rubric with a co-teacher or a department.
- **P6 (print quality)** — **Addressed 2026-08-10.** Table rows now carry
  `break-inside: avoid` so a criterion row never splits across a page break,
  across all five print formats. The peer form additionally overrides `@page`
  to portrait for its own print only (`setPrintOrientation`), since it is a
  handout rather than a wide grid.

### 004 — Classroom Timer

*`Tools/004-Classroom Timer.html`.*

#### Major Features

- **Bell-schedule awareness.** Read the School Calendar Visualizer's day type
  (`scv_calendar_v1`) and/or a stored bell schedule so the timer can offer
  "rest of this period" as a one-click duration and know that today is a half
  day. See P7.
- **Multi-timer board.** Two to four independent timers side by side on one
  projected page — for stations, for differentiated group work, or for a lab
  with staggered steps.
- **Sound design that survives a school laptop.** Ship several vendored
  alert sounds (not just three tones), allow a locally-chosen audio file, and
  fall back to Web Audio synthesis when a file won't play.
- **Reconnecting mirror.** `webrtc-pair.js` pairing currently has to be
  redone if the connection drops. Persist the pairing and auto-reoffer, and
  let the paired device act as a *remote* (start/pause/next-segment from a
  phone while walking the room), not just a passive mirror. See P9.
- **Done (Round 2) — Ambient period bar.** Shipped as `?strip=1` plus the
  header button; see Status. What is still open is driving it from a phone,
  and knowing the school's bell schedule rather than the timer's own.

#### Moonshot / North Star

**The lesson conductor.** The timer stops being a stopwatch and becomes the
thing that runs the period. It knows the day's agenda (typed here, or handed
over from Sub Plan Builder / the Calendar), drives the projector, mirrors to
the teacher's phone as a remote and to a student screen as a display, chimes
the transitions, and afterwards can show — and print — where the time
actually went versus where it was planned to go. A substitute could open one
link and have the whole period paced for them.

#### Open Questions

- Should Round-Robin remain here, or move to / merge with the rotation engine
  in `021-pe-tournament-stations.html`? Two implementations of the same idea
  currently exist.
- How much of the agenda idea belongs here versus in a new tool that this one
  consumes? *Partially answered 2026-08-10: a same-tool Agenda mode was built
  and works well as a self-contained "chain some named durations" feature.
  Whether a richer standalone lesson-planning tool should eventually feed
  this one (per the Moonshot) is still open.*
- Is a microphone-based noise meter something worth having, given the strict
  local-only rule? (It can be done entirely in-browser with no recording, but
  it needs a very clear explanation to the teacher.)

#### Platform themes that matter here

- **P1 (dark/projector mode)** — resolved 2026-08-10: dark mode already ships
  here via `_shared/a11y.js`'s native theme toggle (see Status), which
  deliberately supersedes `theme-toggle.js` rather than running a second
  parallel theme system. The remaining gap is site-wide discoverability of
  the "Aa" widget, not this tool specifically.
- **P9 (device pairing)** — one of only two tools using `webrtc-pair.js`; the
  patterns proven here should be lifted into other projector tools.
- **P10 (keyboard-first)** — a timer that needs a mouse mid-lesson has failed.
- **P4 (accessibility)** — `prefers-reduced-motion` for any flashing alert,
  and a live region announcing state changes.

### 005 — Seating Chart Generator

*`Tools/005-Seating Chart Generator.html`.*

#### Major Features

- **Constraint solver worth the name.** Today's Keep Apart / Put Together is
  pairwise. The real request is richer: front-of-room accommodations, "must be
  near the door", "needs a partner who can read the board", vision/hearing
  seating, height ordering, and a scored auto-assign that satisfies as many
  soft constraints as possible and *explains* which ones it had to break.
- **Real room geometry.** Doors, windows, the teacher desk, lab benches,
  a projector wall, immovable obstacles — enough that the printed chart is a
  map of the room rather than a grid of boxes. The Schedule Visualizer already
  has a full tile-based floor editor; some of that machinery is reusable (P7).
- **Done (2026-08-10) — Sub-friendly export** — chart plus notes plus "these
  students should not / should sit together" as a single printable page.
  Currently one section at a time (see Status for why); not yet wired into
  the Sub Binder Generator handoff (P7) — that cross-tool integration is
  still open.
- **Live mode.** Project the chart, tap a seat to mark absent, tag a
  participation point, or start a hall pass — turning the chart into the
  classroom's live control surface and feeding Behavior Points / Hall Pass Log.

#### Moonshot / North Star

**The room, not the grid.** One saved model of the actual classroom that every
other tool can reason about: where each student sits, who is next to whom,
where the door is, which desks have outlets. Seating charts, lab groups,
group work, hall passes, and participation data all read from it, and the
teacher maintains it once at the start of a unit instead of five times in
five tools.

#### Open Questions

- Is the photo feature actually used? It drives the storage risk and the
  privacy surface, and would be a reasonable thing to make opt-in with a
  clear warning if it isn't.
- Should the room model live here or in a shared "my classroom" store that
  Schedule Visualizer also writes?

#### Platform themes that matter here

- **P12 (storage quota)** — photos in `localStorage` is the acute risk;
  `blank-map-generator`'s IndexedDB cache is the pattern to copy.
- **P6 (print quality)** — the print layout *is* the deliverable here;
  page breaks across a multi-section print need care.
- **P2 (shared roster)** — already reads `np_rosters`; would benefit most from
  richer per-student records.
- **P11 (undo)** — already has the best undo implementation on the site; it
  should be the one extracted into a shared helper.

### 006 — Class Roster Hub

*`Tools/006-class-roster-hub.html`.*

#### Major Features

- **Partially done —** **Bulk operations**: merge two rosters, split one, apply a rename across all
  tools. *(Move-ticked-students and merge are shipped; "apply a rename across
  all tools" is still open — see "Where the next round should pick up" above.)*

#### Moonshot / North Star

**One place where the teacher enters a class list, once, per year — and every
other tool on the site just knows.** With stable identity, so participation
counts, hall passes, reading logs, lab roles, and behavior notes all follow
the same student through a name correction, a section change, and a new
semester. Entirely local, visible, and erasable in one click. This is the
quiet backbone that makes the other 45 tools feel like one product instead of
45 separate ones.

#### Open Questions

- How much personal data is appropriate to store at all? Preferred name and
  pronunciation are clearly useful; photos and flags deserve an explicit
  decision and a very visible erase control.

#### Platform themes that matter here

- **P2 (shared roster)** — this tool is the owner; the theme is this tool's
  roadmap.
- **P8 (versioning/migration)** — any schema change here ripples site-wide and
  must be backward compatible.
- **P13 (import surfaces)** — gradebook exports are the realistic input.
- **P14 (year lifecycle)** — rollover starts here.

### 007 — Name Picker

*`Tools/007-Name Picker.html`.*

#### Quick Wins

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

#### Major Features

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

#### Moonshot / North Star

**The participation memory for the whole year.** Every pick, every group,
every role, every hall pass, every cold call — already scattered across this
tool, Group Generator, Lab Role Randomizer, and Novel Circles — rolled into
one local, private, per-student picture the teacher can glance at before a
parent conference or an IEP meeting and print. Nothing leaves the browser;
everything is one click to erase. This tool already has the strongest data
transparency UI on the site (the Data tab), which makes it the right place to
hold that responsibility.

#### Open Questions

- How much of the game layer (achievements, combos, retro unlock, sudden
  death) is actually used, versus fun to build? Worth deciding before adding
  more of it — some of it may be worth retiring to make room.
- Should the fairness/equity data live here, or in a separate tool that reads
  from here? It is arguably sensitive enough to want its own front door and
  its own erase button.
- Is Tournament here redundant with `020-bracket-tournament-generator.html`?

#### Platform themes that matter here

- **P2 (shared roster)** — this tool *is* the schema owner. Any roster
  redesign starts here.
- **P4 (accessibility)** — the animation load is the heaviest on the site.
- **P11 (undo)** — destructive picks need to be reversible.
- **P12 (storage quota)** — if student photos land in `np_rosters`, this key
  becomes the biggest object on the site and needs IndexedDB.
- **P1 (projector mode)** — has bespoke theming that predates `theme.css`;
  reconciling the two needs care so the fun themes survive.

### 008 — Behavior & Points Tracker

*`Tools/008-behavior-points-tracker.html`.*

#### Major Features

- **Team / house points.** Aggregate individual points into groups from
  Group/Team Generator, with a projector leaderboard — a very common classroom
  economy that currently needs a whiteboard.
- **Redeemable points / classroom economy.** Points spent on rewards, with a
  balance rather than a total.

#### Moonshot / North Star

**Documentation that writes itself, and stays private.** The hard part of
behavior tracking isn't the counting — it's having something concrete and
fair to show when it matters, months later, without having run a surveillance
apparatus on children. This tool should make a teacher's day-to-day taps
accumulate into a defensible, printable, per-student record with dates and
context, stored only on their machine, erasable in one click, and never
displayed to the class in a way that shames anyone.

#### Open Questions

- Should negative points exist at all, or should the default configuration be
  positive-only with negatives as an explicit opt-in? This is a pedagogy
  question as much as a product one, and it's worth Devon deciding rather than
  an agent choosing by default.
- How long should archived day history be kept, and should it auto-expire?

#### Platform themes that matter here

- **P11 (undo)** — already strong; the per-entry undo pattern is worth
  extracting for other tools.
- **P2 (shared roster)** — reads `np_rosters`; would benefit from stable IDs
  so history survives a roster edit.
- **P1 (projector mode)** — this is a projected board; see the privacy note
  above about what should be projected at all.
- **P7 (cross-tool)** — seating layout in, charts out.

### 009 — Backup & Restore

*`Tools/009-backup-restore.html`.*

#### Quick Wins

- **Restore preview / diff.** Show what changes: "3 rosters will be replaced,
  2 new ones added, 1 left alone." Restoring is the scary operation and it
  currently asks for trust. *(Not shipped this round — "Verify a backup"
  below shows what a file contains before arming it, but not a per-record
  diff of what restoring it would change.)*

#### Major Features

- **Done — whole-file modes only.** **Merge restore, not just overwrite.** Two computers (school desktop and
  home laptop) is the normal case. "Combine, keeping the newer of each" and
  per-item conflict resolution would make the two-machine workflow actually
  work. *(Shipped three whole-file modes — Replace, Add only what's missing,
  Combine with file-wins-on-clash. Per-record conflict resolution ("keep the
  newer of each") is still open — it needs per-record timestamps no tool
  currently writes; see Where the next round should pick up.)*
- **Scheduled reminder.** A local, opt-in reminder — end of each grading
  period, or every N days — surfaced on the site rather than emailed.
- **Per-tool restore from the tool itself.** A small shared control any tool
  can mount — "restore just this tool's data from a backup file" — so a
  teacher who breaks one tool doesn't have to reason about all of them.

#### Moonshot / North Star

**Nobody ever loses a year of work to a cleared cache.** The failure mode this
whole site is exposed to is a browser wipe, a district-imaged laptop, or a new
computer in August. This tool should make that a non-event: continuous
awareness of what's stored, a trustworthy versioned archive, a one-tap
transfer to another device, and a restore that shows exactly what it will do
before it does it — all with nothing ever leaving the machine.

#### Open Questions

- Should this tool know the *list* of tools explicitly (so it can report
  "Rubric Builder: no data saved"), or stay purely heuristic over whatever
  keys it finds? Explicit is friendlier and is one more thing to maintain.
- Is there appetite for an optional encrypted backup (passphrase, WebCrypto,
  entirely local) given these files can contain student names?

#### Platform themes that matter here

- **P8 (keys, versioning, migration)** — this tool is the one that pays the
  cost of the site's inconsistent key naming, and the natural place to define
  the convention.
- **P12 (storage quota / IndexedDB)** — must learn to see IndexedDB.
- **P14 (year lifecycle)** — archive-and-roll-forward belongs here.
- **P9 (device pairing)** — device-to-device migration is the standout idea.

### 010 — Command Center

*`Tools/010-command-center-dashboard.html`.*

#### Quick Wins

- **Reuse the real timer.** This page reimplements a simplified timer
  (`startTimer`, `tick`, `playAlert`) that duplicates `004-Classroom Timer.html`.
  Extract the timer into `_shared/` or embed the real one (P7).

#### Major Features

- **A true classroom home screen.** Today's agenda, the current period's
  timer, the bell schedule, who's out, today's do-now prompt, the current
  seating chart, and the day's calendar note — assembled from the tools that
  already hold each piece, on one page you leave projected all day.
- **Remote control from a phone** (P9). Start the timer, call the next
  student, sign someone back in — while walking the room, with the projector
  showing the result.
- **Do Now / agenda strip.** A slim always-visible band with the day's agenda
  and the current segment highlighted, pairing with the Classroom Timer agenda
  idea.

#### Moonshot / North Star

**The screen that's on from bell to bell.** A teacher opens one tab in the
morning and never opens another: it knows what period it is, what's planned,
who's in the room, who's out of it, how long is left, and what's next — all
composed from local data the other tools already keep, all private, all
working with the wifi down. This is the tool that makes the toolkit feel like
a product rather than a directory of pages.

#### Open Questions

- Should this become the site's landing page for a logged-in-feeling
  experience, with `index.html` remaining the public directory?
- Reading other tools' storage keys directly is fast but brittle — if any of
  those four tools changes shape, this page breaks silently. Is it worth
  defining a small shared read API first (P7/P8)?

#### Platform themes that matter here

- **P7 (cross-tool composition)** — this tool *is* the theme; it reads four
  keys already and is the natural consumer of every future handoff.
- **P1 (projector mode)** — highest-value adopter after Classroom Timer.
- **P9 (phone as remote)** — a dashboard you can't reach from across the room
  is a dashboard you stop using.
- **P10 (keyboard-first)** — the whole page should be operable without
  precision clicking.

### 011 — Image → PDF Assembler

*`Tools/011-image-to-pdf.html`.*

#### Quick Wins

- **Crop and straighten.** Photos of student work and whiteboards are always
  slightly rotated with desk visible around the edges; a simple crop would
  improve nearly every output.
- **Auto-enhance for whiteboard/document photos** — contrast boost and
  white-balance to make a phone photo of a page legible and ink-cheap. Purely
  canvas math, no libraries.
- **Remember the last session's settings per use case** rather than one global
  preference.

#### Major Features

- **Document scanner mode.** Edge detection, perspective correction, grayscale
  thresholding — turning a phone photo of a worksheet into a clean scan. This
  is achievable with canvas math alone and it is the single most-wanted
  capability in this category. It would make the tool the answer to "the
  copier's scanner is broken again."
- **OCR / searchable PDF.** A vendored Tesseract build is large, but a text
  layer would make scanned handouts searchable and, more importantly, make
  student work accessible to a screen reader.
- **Reorder by thumbnail grid**, not a list — with 40 photos the list becomes
  unusable.
- **PDF in, PDF out.** Merge existing PDFs, insert images into one, extract
  pages, rotate pages. Combined with `031-docx-merger.html` this would give the
  site a complete local document-assembly story (P7).
- **Print-shop presets**: two-sided, booklet imposition, saddle-stitch order,
  N-up with cut marks. Booklet imposition in particular is something teachers
  need and no free local tool does well.

#### Moonshot / North Star

**A local document workshop for a teacher with a phone and a printer.**
Photograph a stack of student work or a set of textbook pages, and get back
clean, straightened, contrast-corrected, correctly-ordered, captioned,
page-numbered PDFs — one combined packet or one per student, sized to email,
optionally imposed as a booklet — without any of it touching a cloud service.

#### Open Questions

- Is scanning (perspective correction, thresholding) worth building here, or
  does it deserve its own tool that hands off to this one?
- How large a vendored library is acceptable for OCR, given the site's
  precache-everything service worker?

#### Platform themes that matter here

- **P5 (offline integrity)** — the cdnjs jsPDF load, with a vendored copy
  already sitting in the repo.
- **P7 (cross-tool)** — a shared PDF layer would serve this tool,
  `031-docx-merger.html`, and every tool that currently prints.
- **P6 (print quality)** — imposition and N-up are print problems in their
  purest form.
- **P12 (memory)** — 40 full-resolution photos in canvas is the site's
  heaviest memory workload; progressive processing matters.

### 012 — Graph Paper & Number Line Generator

*`Tools/012-graph-paper-generator.html`.*

#### Quick Wins

- **More grid types**: hexagonal, polar, log/semi-log, engineering (5 squares
  per inch), Cornell-notes ruling, handwriting lines with a dashed midline,
  storyboard boxes, music staff.

#### Major Features

- **Pre-plotted content** (outside worksheet mode, on the plain coordinate
  plane / graph paper modes) is still open. Worksheet mode (below) shipped
  its own copy of the expression parser scoped to that mode's problems only.
- **Isometric and dot paper for other subjects** — technical drawing, 3D
  volume nets, perspective grids for art.
- **Graph paper with a data table beside it**, for science labs — the exact
  page a lab handout needs and nobody generates.
- **A grid the student can also use on screen** via a share link (P3) — plot
  points on a device, print the result.

#### Moonshot / North Star

**Any grid, any scale, any subject — with the problem already on it.** Not
just blank paper, but the exact printable page a lesson needs: four labelled
planes with four problems, an isometric net for a volume unit, a semi-log
plot for a science lab, or a number line marked with the fractions today's
lesson is about — with an answer key, true to scale, on one sheet.

#### Open Questions

- Is the audience "give me paper" or "give me a worksheet"? The tool is
  excellent at the first; the second is where most of the remaining value is,
  and it's a meaningfully different product.
- Should pre-plotted graphing live here, or in a separate graphing tool that
  reuses this renderer?

#### Platform themes that matter here

- **P6 (print quality)** — scale fidelity is this tool's entire value
  proposition and depends on print settings the tool can't control. **Addressed
  2026-08-11:** the Printer check mode is that affordance. Everything else here
  is still trusting the print dialog.
- **P7 (cross-tool)** — plotting would pull in expression parsing that already
  exists on the site; answer keys are a shared pattern.
- **P15 (first run)** — presets exist, but a gallery of "common sheets" would
  land better than a form.

### 013 — Lab Safety Contract Tracker

*`Tools/013-lab-safety-contract-tracker.html`.*

#### Quick Wins

- **Digital acknowledgement option.** A student signing on screen isn't legally
  equivalent to a parent signature, but for classroom-rules acknowledgements
  it's often enough and saves a paper cycle.

#### Major Features

- **Generalize beyond lab safety.** The tool is already multi-document; it is
  three small steps from being **the** "did I get this paper back?" tracker —
  permission slips, syllabus signatures, AUP forms, device agreements,
  fundraiser envelopes, picture-day forms. That is a far more frequently
  needed tool than a lab-specific one, and the machinery is written.
- **Merge with the permission-slip collection tracker** (P7).
  `043-field-trip-permission-slip.html` has its own `renderCollectionTracker`;
  this is the same feature in two places.
- **Gate other tools on it** (P7). Lab Group & Role Randomizer should be able
  to ask "is this student cleared for lab?" and flag or exclude accordingly.
- **Parent contact list for the stragglers** — print the missing list with a
  place to record call/email attempts, which is what the follow-up actually
  requires.

#### Moonshot / North Star

**Nothing that goes home is ever unaccounted for.** One board across every
form, every class, and every deadline: what's out, who's returned it, who's
paid, who's been reminded, who needs a phone call — with the forms printable
from the same tool, returns scannable, deadlines on the calendar, and a
missing list in your hand before the bell. Entirely local, and erasable at the
end of the year.

#### Open Questions

- Should this be renamed and repositioned as a general **Form & Signature
  Tracker**, with lab safety as the default template? The code already
  supports it and the name is the main thing limiting its use.
- Is any form of on-screen student acknowledgement acceptable to the district,
  or must everything be paper?

#### Platform themes that matter here

- **P7 (cross-tool)** — duplicates the permission-slip collection tracker and
  should gate the lab grouping tool.
- **P2 (shared roster)** — both reads and writes `np_rosters`.
- **P14 (year lifecycle)** — signature tracking is per-year and should roll
  over cleanly.
- **P6 (print quality)** — missing lists, reminder slips, and the contract
  itself.

### 014 — Immersion Roleplay Scenario Generator

*`Tools/014-roleplay-scenario-generator.html`.*

#### Quick Wins

- **A sentence-frame layer** beneath the vocabulary layer: "I would like ___,
  please" is more supportive than a word list.
- **Difficulty variants of one scenario** — a supported version with frames
  and a challenge version with only a goal, printed together for a
  differentiated class.
- **Success criteria / self-assessment strip** on the handout, so students
  know what a good attempt looks like.
- **Undo on Delete custom scenario** (P11).

#### Major Features

- **Assessment layer.** Speaking is the hardest thing to assess in a language
  classroom. A quick rubric tap per pair during a roleplay, with a printable
  record, would be genuinely valuable — and `003-rubric-builder.html` already has
  scoring machinery to reuse (P7).
- **Audio.** `039-vocab-conjugation-drill.html` already uses `speechSynthesis`
  with a language selector; hearing the target-language prompts spoken would
  serve pronunciation directly, and the code already exists one file away.
- **Culture and context notes** per scenario — the register, the customs, what
  would be rude — which is what separates a language lesson from a phrasebook.
- **Chain scenarios into a unit.** Ordering, paying, complaining, and
  returning an item are one restaurant unit; a sequence with growing
  complexity is more useful than a shuffle.
- **Convergence with the other language tool** (P7).
  `039-vocab-conjugation-drill.html` holds vocabulary sets per language; this tool
  holds vocabulary fills per class. They should share one vocabulary store.

#### Moonshot / North Star

**A speaking curriculum for any language, in the teacher's own vocabulary.**
Scenarios sequenced into units, each with role cards per student, sentence
frames and useful phrases for the students who need them, spoken audio for
pronunciation, culture notes for context, a rubric the teacher taps while
circulating, and a printed record of every student's speaking progress — all
language-agnostic, because the teacher supplies the words.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Role cards on student devices** by link/QR instead of printing. Printing
  thirty half-sheets is the teacher-facing path.

#### Open Questions

- Should the vocabulary fills live in a shared per-language store that
  `039-vocab-conjugation-drill.html` and `040-vocab-flashcard-generator.html` also
  read? That would let one entered word list serve drills, flashcards, and
  roleplays.
- How much shipped scenario content is worth writing, versus making the
  custom-scenario authoring so good that teachers build their own?

#### Platform themes that matter here

- **P7 (cross-tool)** — a shared vocabulary store with the conjugation drill
  tool, and the rubric engine for speaking assessment.
- **P2 (shared roster)** — role assignment and per-student records.
- **P6 (print quality)** — per-student role cards are the deliverable.
- **P3 (share links)** — sending a scenario set to a colleague who teaches the
  same language.

### 015 — Timeline Builder

*`Tools/015-timeline-builder.html`.*

#### Quick Wins

Every one of these had already shipped by 2026-08-14 and was still listed as
open; struck through in session `c1jqjp` after checking each against the
source. The list was pointing later rounds at finished work.

- ~~**Blank / student-fill version**~~ — **done, 2026-08-14** (SS demo round
  2: the timeline worksheet print, `tlb-worksheet.js`). Blanks titles only;
  blanking *dates* instead is still open and is listed under "Where the next
  round should pick up" for that round.
No Quick Wins remain open. A future round should look to Major Features
below, or find a genuinely new gap — the label de-overlap fix that session
`c1jqjp` shipped was one of those, and it came out of the previous round's
notes rather than out of this list.

#### Major Features

- **Printed ordering activity** — *partly done*. The paper half shipped
  2026-08-14 as the timeline worksheet (numbered blanks, word bank, answer
  key). What is still unbuilt is the **cut-apart cards** version: ten events
  on separate cards for students to physically sequence, which is a different
  print layout from the worksheet's spatial strip.
- **Comparative timelines as a first-class teaching device.** Compare mode
  exists; framing it as "what was happening in China while this happened in
  Europe" — with a shipped set of reference timelines for major periods —
  would turn a feature into a lesson.
- **Student-built timelines as an assignment** — a rubric to score them
  against (P7, `003-rubric-builder.html`) and a share format for submission.

#### Moonshot / North Star

**The class timeline that lives on the wall.** Built once per unit, printed
tiled across a hallway wall, navigable on the projector when you're teaching
into it, comparable against a reference timeline of what was happening
elsewhere, linked to the class map so every event has a place as well as a
date, and printable as a blank for the unit test and as cut-apart cards for an
ordering activity.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-navigable timeline** by share link, and an on-screen drag-to-order
  activity students do themselves. The projected navigation mode and the
  printed cut-apart ordering activity above cover both.

#### Open Questions

- How much shipped timeline content is worth authoring? Like the number-talks
  library, the content is the value and it's writing rather than coding.
- Should the timeline and the map become one "historical context" tool, or
  stay separate and share a data format for dated, placed events?

#### Platform themes that matter here

- **P7 (cross-tool)** — tiled printing exists in the map tool; the
  map/timeline pairing is the strongest content idea.
- **P12 (storage/images)** — per-event photos base64'd into `localStorage`.
- **P6 (print quality)** — the paginated layout is good; tiled wall printing
  is the next step.
- **P3 (share links)** — sending a timeline to a colleague; student-facing
  output is printed.

### 016 — QR Code Generator

*`Tools/016-qr-code-generator.html`.*

#### Quick Wins

- **Label under each code**, in the single view and in the bulk grid, so a
  printed sheet of thirty codes is identifiable without scanning.
- **Partly done.** **Sizing guidance.** "At this size this code is scannable from about 3
  feet" — a printed classroom code is useless if it's too small, and the
  arithmetic is simple. *(Shipped for the new Avery label presets only,
  where the physical size is actually known; not attempted for single-code
  mode — see the Round 4 update below.)*
- **Confirm before clearing recents** (P11).

#### Major Features

- **Become the site's shared QR layer** (P7). Six tools currently vendor their
  own copy of `lib/qrcode.js` — bracket, certificate, class roster hub, escape
  room, exit ticket, field trip, gallery walk, scavenger hunt, name picker.
  A single shared module (plus this tool as its front door) would cut
  duplication substantially and give every tool the logo overlay, error
  correction guidance, and camera verification for free.
- **QR + link shortening for `state-link.js` payloads** (P3). The site's
  share-by-link mechanism produces long URLs that make dense, hard-to-scan
  codes. A shared "is this payload too big for a reliable code?" check
  belongs here.
- **Done (roster half) —** **Batch codes from a roster or a spreadsheet**
  (P2/P13) — one code per student, labelled with their name, printed as a grid.
  That's the pattern Gallery Walk and Scavenger Hunt each reimplement.
  *(The `np_rosters` path shipped in Pass 2 — Round 2 below; a spreadsheet
  import is still only the existing comma/tab paste.)*
- **Scanner mode as a first-class feature.** `jsqr.js` is already vendored;
  a "scan a code and act on it" mode would let this tool serve the check-in
  and collection-tracking flows other tools need (P7).
- **Inventory/labelling mode.** Generate, print, and then scan codes for
  classroom equipment, textbooks, or lab kits with a local record of what's
  checked out to whom.

#### Moonshot / North Star

**One QR layer for the whole toolkit, plus a genuinely good standalone
generator.** Every tool that prints codes gets the same reliable generation,
size guidance, error correction, verification, and label-stock layouts; and a
teacher who just needs a code for the Wi-Fi, a Google Form, or a set of
library books has a tool that does it properly — with a scanner on the other
end for check-in and collection workflows.

#### Open Questions

- Should `lib/qrcode.js` move to `_shared/` and every tool load it from
  there? It's a mechanical change touching nine tools plus `sw.js`, and it
  would need care to avoid breaking the precache list.
- Is a scanner/check-in mode this tool's job, or should it be a separate
  "Scan & Check In" tool that several workflows call?

### Pass 2 — Round 1 — 2026-08-10 — session `v19h3x`

Implemented the **"Scanner mode as a first-class feature"** Major Feature,
entirely inside `Tools/016-qr-code-generator.html` (no support-folder or
library changes — `lib/jsqr.js` and `lib/qrcode.js` untouched):

- **New third mode, "Scan a code"**, alongside the existing Single/Bulk
  toggle. Selecting it hides the generator-only cards (Content's
  single/bulk panes, Appearance, Center Overlay — all newly marked
  `.gen-card`/existing `single-only`/`bulk-only` classes) and shows a
  dedicated scan pane and result cards instead. This is a genuinely
  standalone capability, not the existing "verify your own generated
  code" self-check: it decodes *any* QR code shown to it, independent of
  whatever (if anything) is in the generator's own text field.
- **Camera input**, reusing the same `getUserMedia` + `window.QRScan`
  technique as the existing `verifyScan`/camera-test-scan modal, but as a
  second, separate modal (`#scan-cam-overlay`) that accepts whatever
  `onResult` decodes instead of comparing it against one expected string
  — the key behavioral difference from the existing verify flow.
- **Upload/drop an image file** as an alternative to the camera: a new
  drop zone (`#scan-drop-zone`, sharing the logo drop-zone's `.drop-zone`
  styling) loads the file into an `<img>`, draws it 1:1 onto a scratch
  canvas, and decodes it with `window.jsQR` directly — no camera needed,
  which is both how a teacher with a photo of a code would use this and
  how this feature could be verified headlessly.
- **Decoded content displayed clearly**: plain text as-is; a URL as a
  clickable `target="_blank"` link; and this tool's own typed formats
  (Wi-Fi, vCard, tel, SMS, mailto, geo, calendar event) parsed back into
  the same labeled-field convention the generator's template fields use
  (`scanFieldRows`/`.scan-field`), not a raw string dump — e.g. a scanned
  Wi-Fi code shows "Network (SSID)", "Password", "Security", "Hidden
  network" as separate rows. Parsing reverses the exact escaping the
  generator side uses (`escField`/`icsEscape`) via a small manual
  unescape/split walk (`splitUnescaped`, `unescapeField`, `icsUnescape`)
  rather than a lookbehind regex, to avoid any engine-support risk.
- **"Recently scanned" list, separate from "Recently generated"**: a new
  `sessionStorage` key (`qr-code-generator-scanned`, deliberately
  `sessionStorage` rather than `localStorage` since the ask was scoped to
  "for the session") holds up to 20 entries with kind + source (camera vs.
  upload) icon, so scanning several codes in a row — e.g. checking in a
  stack of returned equipment — keeps every prior result instead of only
  the latest. Clicking an entry re-renders that result; a per-item remove
  button matches the existing recent-generated list's pattern.

### Testing performed (Pass 2 — Round 1)

- `node --check` against both inline `<script>` blocks (extracted to temp
  files) — pass.
- Headless Chromium via Playwright (`/opt/pw-browsers`, package from the
  global npm install): loaded the file over `file://`, generated a plain
  URL code with the tool's own single-code generator, pulled the canvas
  as a PNG via `toDataURL`, saved it to disk, switched to the new Scan
  mode, confirmed the generator-only cards were actually hidden and the
  scan pane visible, fed that saved PNG into the new upload input, and
  confirmed the decoded text round-tripped byte-for-byte back to the
  original URL and rendered as a clickable link. Repeated the same
  round-trip with a Wi-Fi template code (SSID + password) to confirm
  field-parsing renders "Network (SSID)"/"Password"/"Security"/"Hidden
  network" correctly rather than raw `WIFI:...` text — this needed
  bumping the render size to 600px first, since the existing jsQR
  self-check already flagged the same payload as unverified at the
  default 400px (a pre-existing, documented characteristic from the
  Round 4 notes, not something this round introduced). Also confirmed two
  sequential scans (URL then Wi-Fi) both remain in the "recently scanned"
  list rather than the second overwriting the first. Zero console or page
  errors in every pass.

### Things noticed but deliberately left alone (Pass 2 — Round 1)

- Did not touch `_shared/qr-scan.js` — it already exposes
  `scanQRFromCamera(videoEl, {onResult, onError})` generically (it
  doesn't compare against an expected string itself; only this tool's own
  `verifyScan` caller does that comparison), so the new scan mode's camera
  path calls it directly with a different `onResult` handler rather than
  needing any change to the shared helper.
- Did not attempt to reuse the *existing* `#cam-overlay` modal for the new
  scan mode — added a second, separate modal (`#scan-cam-overlay`)
  instead. The existing modal's status text and close handlers are
  wired specifically to the single-code verify flow; sharing it would
  have meant threading a mode flag through code that's simple and correct
  as two small, independent instances of the same modal markup/CSS.
- Did not build an "Inventory/labelling mode" (the other open Major
  Feature in this file) — scanning is now a first-class capability this
  tool exposes, but persisting a local checked-out/returned record on top
  of it is a distinct, larger feature and was left for its own round per
  the existing Open Questions note about scope.
- Only decode formats already produced by this tool's own generator
  (seven typed templates) get the labeled-field treatment; any other QR
  content (a Google Form URL, an arbitrary app deep link, etc.) correctly
  falls through to the plain-text/link rendering, which is the intended
  behavior, not a gap.

### Where the next round should pick up

- **Inventory/check-out tracking mode** is the natural next step now that
  scanning is a first-class capability: pair it with a local
  checked-out/returned record (who has what, scanned in/out timestamps)
  per the remaining Major Feature idea in this file.
- Real-camera testing (as opposed to the headless upload-path proof used
  here) on an actual phone/tablet camera against printed codes in varied
  lighting would be the strongest validation of the new camera-scan path
  — a headless browser has no real camera, so that path is only exercised
  by code inspection and by the pattern match against the already-proven
  `verifyScan`/`stopCameraScan` camera technique, not by an end-to-end
  automated test.
- If a future round wants scanned Wi-Fi/vCard/etc. content to be
  *actionable* (e.g. a "connect" button, an "add to contacts" download),
  that's a reasonable next layer on top of the display-only parsing shipped
  here.

#### Platform themes that matter here

- **P7 (cross-tool)** — nine tools vendoring the same QR library is the
  clearest duplication on the site.
- **P3 (share links)** — QR is how state-links become physical.
- **P6 (print quality)** — cut lines, label stock, and scannable-at-distance
  sizing.
- **P13 (import surfaces)** — bulk generation from a paste or a roster.

### 017 — Gallery Walk QR Codes

*`Tools/017-gallery-walk-qr.html`.*

#### Quick Wins

- **Peer feedback slips.** The reaction counter hints at it; what a gallery
  walk actually needs is a printable feedback slip per station — two stars and
  a wish, a rubric row, a sticky-note prompt — that students fill in and leave.
- **Station numbering and a walking order**, so 28 students don't all start at
  station 1. Print a per-student route card.
- **QR code + label + a blank comment area on one card**, rather than a grid of
  bare codes — the card is the thing that gets taped next to the work.
- **Short-link display** under each code so a student without a camera can
  type it.
- **Undo / confirm on "Reset all reaction counts"** and on Delete gallery (P11).

#### Major Features

- **Partially done —** **Aggregate the feedback.** Once comments come back, print a per-student
  packet of the feedback their work received — the part of a gallery walk that
  usually never happens because collating sticky notes is tedious. *(Shipped
  Round 4 as manual transcription into a "Collected feedback" card, then
  "Print Feedback Packets" — saves the collating step, not the data-entry
  step; true OCR/scanning is still open.)*
- **Reuse for anything QR-and-stations shaped** — museum-style exhibits,
  science fair judging, book tasting stations. This tool,
  `018-qr-scavenger-hunt-builder.html`, and `019-escape-room-builder.html` are three
  variations on the same primitive.

#### Moonshot / North Star

**A gallery walk where the feedback survives the period.** Print the station
cards and a pad of feedback slips, run the rotation on a timer, and end with a
printed packet for each student showing what their classmates actually said
about their work — which is the entire pedagogical point and almost never
happens, because collating the slips by hand is what kills it.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device feedback.** Students scan, comment on their own device, and
  the comments return to the teacher's browser. The printed feedback slips
  above serve the same purpose.

Note: this tool's existing design already assumes students scan the printed
codes to reach the linked work. That's shipped behaviour, not something being
reclassified here.

#### Open Questions

- Is the "student work has a URL" assumption right for this classroom? If
  most work is on paper, the tool's centre of gravity should shift to the
  card-and-feedback model.
- Should the three QR tools share one station/card/print engine?

#### Platform themes that matter here

- **P9 (device pairing)** — teacher-side only: a phone remote for driving the
  rotation timer while walking the room.
- **P7 (cross-tool)** — shares primitives with two other QR tools and needs
  the rotation timer.
- **P2 (shared roster)** — already reads `np_rosters` for seeding names.
- **P6 (print quality)** — station cards get taped to walls and scanned;
  size and error correction are functional choices.

### 018 — QR Scavenger Hunt Builder

*`Tools/018-qr-scavenger-hunt-builder.html`.*

#### Quick Wins

- **Hints with a time penalty** — the standard mechanic that keeps a stuck
  team moving.
- **Location hint per station** ("outside the library") printed on the answer
  key, so the teacher can find their own stations again.
- **Timer visible on the projector** for the return-to-class moment.
- **Undo on "Clear all progress"** (P11) — it wipes a live run.

#### Major Features

- **Merge or share an engine with the escape room builder** (P7). That tool
  has branching, per-station images, answer validation and a player page
  (`lock.html`); this tool has teams, timing, and a leaderboard. Each is
  missing exactly what the other has, and they print the same station cards.
- **Content from the toolkit** (P7). Pull questions from
  `030-review-game-board.html`'s bank or vocabulary from the flashcard tool, so
  building Friday's hunt isn't writing twelve new questions from scratch.
- **Map of the hunt.** `046-blank-map-generator.html` can annotate a floor plan;
  a printed map with numbered station markers would make setup and cleanup far
  easier, and `035-schedule-visualizer.html` already holds a real building map.
- **Post-hunt debrief.** Print each team's answers with the key beside them,
  which is where the learning actually happens and currently doesn't exist.

#### Moonshot / North Star

**A hunt you can build in a planning period and run without touching a
laptop.** Questions pulled from content you already have, station cards
printed with a map of where they go, each team starting at a different
station, teams checking themselves in from their own device or by showing you
a code, a live leaderboard on the projector, hints for the stuck, and a
printed debrief for every team at the end.

#### Open Questions

- Should this and `019-escape-room-builder.html` become one tool with a "linear
  chain" mode and a "free-roam teams" mode? They share most of their
  machinery and neither is complete alone.
- What's the device reality — one per team, one per student, or none? The
  answer changes whether self-check-in or paper answer sheets is the primary
  path.

#### Platform themes that matter here

- **P7 (cross-tool)** — the escape room overlap is the biggest single
  opportunity; question banks and building maps are close behind.
- **P9 (device pairing)** — team self-check-in is what makes a live run scale
  past one teacher's thumbs.
- **P6 (print quality)** — station cards get taped up and scanned; sizing and
  error correction are functional decisions.
- **P3 (state in the URL)** — payload budget for the codes.

### 019 — Digital Escape Room / Puzzle Lock Builder

*`Tools/019-escape-room-builder.html`.*

#### Quick Wins

- **Attempt limits and feedback.** "Not quite — check your spelling" versus
  "wrong" changes the experience considerably; so does a lockout after N
  wrong answers.
- **Answer matching that forgives.** Case, whitespace, and punctuation
  tolerance, plus optional numeric-answer matching with a tolerance.
- **Non-QR fallback.** A printed short code students type into `lock.html` on
  a shared device — QR requires every student to have a camera, which is not
  a safe assumption.
- **Skipped — Round 4 considered this and passed.** **Estimated payload size warning.** The whole room rides in the QR; a room
  with several images will silently produce an unscannable code (P3). *(The
  new per-station fields are all a few bytes and omitted when unused, so the
  existing try/catch QR-generation error remains the only size guard.)*
- **Station numbering that survives reordering**, so a reprint doesn't
  invalidate the codes already taped to the wall.

#### Major Features

- **Done — partial, Round 4.** **Puzzle types beyond text answers.** A digit lock, a directional lock, a
  cipher (Caesar / substitution) with an auto-generated key, a jigsaw of a
  clue image, a "collect four letters to spell the word" meta-puzzle. The
  meta-puzzle in particular is what makes an escape room feel like an escape
  room rather than a worksheet with QR codes. *(Shipped: digit lock, Caesar
  cipher, and the meta-puzzle letter collection. Still open: directional
  lock, jigsaw.)*
- **Skipped — deferred, Round 4.** **Branching that matters.** The next-station rule already supports jumps;
  building on it — different paths for different answers, optional side
  stations, a required set in any order — would make genuinely different runs
  for different groups. *(Real scope, not attempted this round.)*
- **Content from elsewhere** (P7). Pull questions from
  `030-review-game-board.html`'s bank or vocabulary from
  `040-vocab-flashcard-generator.html` so building a room for Friday doesn't mean
  writing eight new questions.

#### Moonshot / North Star

**A review activity students ask for, built in a planning period.** Pick a
topic, pull questions the toolkit already has, choose a puzzle mix and a
difficulty, and get a printed set of station cards, a teacher answer key, a
live team leaderboard, and a fallback paper packet — with branching so groups
don't bottleneck, hints so nobody stalls out, and a finish that feels earned.
No accounts, no uploads, works with the wifi down.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Single-link student run.** One link/QR that opens the whole chain on a
  student device with progress kept locally, rather than a scan per station.

Note: this tool already ships `lock.html`, a student-operated player page, and
the printed QR codes are scanned by students by design. That's existing
behaviour and isn't being reclassified — but new work should favour the
printed/teacher-run paths (the paper packet, the typed short code on a shared
classroom device) over deepening student-device use.

#### Open Questions

- Should this and `018-qr-scavenger-hunt-builder.html` merge? They differ mainly
  in whether stations are ordered and whether teams are tracked.
- Given that students aren't intended users of this site, how much should the
  existing `lock.html` player page be leaned on at all? The printed paper
  packet and a typed short code on one shared classroom device are the
  teacher-facing alternatives, and it's worth deciding whether they become the
  primary path.

#### Platform themes that matter here

- **P3 (state in the URL)** — the whole design rests on it; payload size is
  the binding constraint and deserves an explicit budget.
- **P7 (cross-tool)** — shares a problem with the scavenger hunt builder and
  a content need with the review game board.
- **P12 (storage/images)** — station images are base64 in `localStorage` and
  also inflate the QR payload.
- **P6 (print quality)** — station cards get handled, taped, and re-scanned;
  error correction and print size are functional decisions here.

### 020 — Bracket / Tournament Generator

*`Tools/020-bracket-tournament-generator.html`.*

#### Quick Wins

- **Done — round robin only.** **Round-robin and pool play.** Elimination brackets send half the class home
  after one round, which is pedagogically the wrong shape for a classroom
  review game or a PE unit. Round-robin, pools-into-a-bracket, and a ladder
  are the formats teachers actually want. *(Shipped Round 4 as a third
  bracket type using the circle-method scheduling algorithm; pools-into-a-
  bracket and a ladder are still open — see Round 4 update below.)*
- **Team names with members**, so a bracket of six four-person teams prints a
  roster alongside.

#### Major Features

- **Done — pools and Swiss; a loser's-side consolation bracket is still open.**
  **Consolation / everybody-plays formats.** A "loser's side that keeps
  playing", a Swiss format, or guaranteed-three-games pool play. This is the
  difference between a tool used once a year and a tool used every unit.
  *(Pools-into-a-bracket and Swiss shipped Round 6 — see below. A true
  double-elimination-style "loser's side keeps playing" consolation bracket
  for the single-elimination format specifically is not the same thing as
  double elimination, which already exists, and remains open.)*
- **Academic tournament mode.** Bracketed review — pairs of students compete
  on questions drawn from `030-review-game-board.html`'s question bank, with the
  bracket advancing on answers rather than clicks.
- **Live projected standings.** A read-only display view of the bracket
  driven from the teacher's machine, optionally on a second screen, with the
  current match called out and the scoreboard large enough to read from the
  back of the room (P9 — second display, not student devices).
- **Bracket history and repeat matchups.** Across a unit, avoid pairing the
  same two teams twice — the same "recency memory" idea that
  `022-lab-group-role-randomizer.html` and `002-group-team-generator.html` already
  implement for pairs and roles.
- **Printable score sheets** per match for students to fill in and hand back.

#### Moonshot / North Star

**Any competitive classroom structure, in two minutes, printed and projected.**
Pick a format (bracket, round robin, pools, ladder, Swiss), pull the roster or
the teams, pick how long you have, and get a schedule, station assignments, a
projector board, printed score sheets, and a record at the end — for a PE
unit, a review game, a debate tournament, or a chess club, with the same
engine underneath.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device standings view.** A link or QR letting students follow the
  bracket on their own devices. Projecting it covers this.

#### Open Questions

- Should Name Picker's Tournament mode and PE Stations' bracket both be
  replaced by this engine, or do they serve different enough moments to
  justify staying separate?
- What is the largest realistic bracket — a class of 30, or a whole-grade
  event of 150? The answer changes the print layout work substantially.

#### Platform themes that matter here

- **P2 (shared roster)** — the most obvious gap; nothing here reads
  `np_rosters` today.
- **P7 (cross-tool)** — overlaps `021-pe-tournament-stations.html` and Name
  Picker's Tournament mode; three implementations of one idea currently exist.
- **P3 (share links)** — already adopts `state-link.js`; the useful extension
  is sending a bracket to a colleague (a co-teacher, the PE department)
  rather than to students.
- **P6 (print quality)** — a 32-entry bracket that fits legibly on one sheet
  is a genuine layout problem.

### 021 — Tournament Bracket & Station Rotation (PE)

*`Tools/021-pe-tournament-stations.html`.*

#### Quick Wins

- **Skipped — partial, Round 4.** **Uneven groups and stations.** More groups than stations, or a station that
  takes two rotations — currently the schedule assumes a clean cycle. *(More/
  fewer groups than stations already wraps via `computeAssignment`; a station
  taking two full rotations, or locking a group out of the cycle, is still
  unmodeled.)*
- **Print a wall-sized station card**, one per page, with the activity
  instructions and a diagram space.

#### Major Features

- **Skipped — deferred, Round 4.** **One rotation engine for the whole site** (P7). Station rotation is also
  Classroom Timer's Round-Robin mode, and also what a gallery walk and a lab
  station rotation need. Four tools want this; one has it.
- **Skipped — deferred, Round 4.** **One bracket engine for the whole site** (P7). This tool's bracket
  duplicates `020-bracket-tournament-generator.html`, which is more capable
  (double elimination, byes, saved brackets, QR sharing). *(Deliberately left
  alone — `bracket-tournament-generator` was being worked on in parallel this
  round.)*
- **Skipped — deferred, Round 4.** **Team/group memory across a unit** so the same four kids aren't together
  every day — the recency logic that
  `002-group-team-generator.html` already implements.

#### Moonshot / North Star

**Run an entire PE unit from a phone in your pocket.** Pick the unit, pick how
long the period is, and get groups that rotate fairly, stations with the
activity printed on wall cards, a gym-legible display with a horn everyone can
hear, scores captured as you walk around, a tournament at the end of the unit
seeded from those scores, and a printable record for grading — all offline,
because the gym wifi does not work.

#### Open Questions

- Should the bracket here be replaced by an embed of / link to
  `020-bracket-tournament-generator.html`, keeping this tool focused on rotation?

#### Platform themes that matter here

- **P9 (phone as remote)** — the strongest case on the site; a gym teacher
  cannot stand at a laptop. **Partial (Round 4, PR #55)**: a same-device
  remote window shipped; true phone-to-laptop control still needs a relay
  this tool doesn't have.
- **P7 (cross-tool)** — duplicates both the bracket engine and the rotation
  timer that exist elsewhere. Deliberately left duplicated this round to
  avoid stepping on parallel work on `020-bracket-tournament-generator.html`.
- **P1 (projector/display mode)** — with an unusually demanding legibility
  requirement. **Addressed (Round 4, PR #55)**: gym-legible fullscreen sizing
  and a high-contrast display toggle shipped.
- **P6 (print quality)** — wall-sized station cards.

### 022 — Lab Group & Role Randomizer

*`Tools/022-lab-group-role-randomizer.html`.*

#### Quick Wins

- **Skipped — deferred, Round 4.** **Lock a group or a role and reshuffle the rest.**
- **Group size that matches the equipment.** "I have 7 microscopes" is the
  real constraint, not "make groups of 4".
- **Names on the tent in a size readable from the front of the room.**

#### Major Features

- **Skipped — deferred, Round 4.** **One grouping engine** (P7). This tool, `002-group-team-generator.html`,
  `027-novel-study-circles-manager.html`, and Name Picker all implement group
  formation, and two of them implement role rotation with recency memory. The
  logic should be shared. *(Necessarily touches other tools; left for a
  dedicated cross-tool round.)*
- **Multi-day lab projects.** A lab that runs three days needs the same groups
  with rotating roles across sessions — which is exactly what
  `027-novel-study-circles-manager.html` does for reading circles, in a different
  tool.
- **Lab report handoff** (P7). The groups and roles should flow into a lab
  report template (already on this backlog) with the group's names
  pre-filled.

#### Moonshot / North Star

**The whole lab period, organized on one sheet.** Groups formed fairly with
memory of who has worked with whom and who has done which job, assigned to
stations with the right equipment, checked against the safety contract,
printed as table tents with the role's actual instructions on them plus a
materials checkout sheet and a rotation schedule — in the two minutes before
the bell.

#### Open Questions

- Should this remain a separate tool from Group/Team Generator, or become a
  "lab mode" of one grouping tool? The distinctive parts (roles, stations,
  equipment, safety) are real, but the group formation is duplicated.

#### Platform themes that matter here

- **P7 (cross-tool)** — the strongest case on the site for a shared grouping
  and role-rotation engine, plus real links to the safety tracker and the
  rotation timer.
- **P2 (shared roster)** — reads `np_rosters`; role history needs stable IDs
  to survive roster edits.
- **P6 (print quality)** — table tents are a specific and well-solved print
  format here worth generalizing.
- **P11 (undo)** — reshuffles are destructive.

### 023 — Exit Ticket / Bell Ringer Generator

*`Tools/023-exit-ticket-generator.html`.*

#### Quick Wins

- **Skipped — deferred, Round 4.** **Name and date lines on the slips.** An exit ticket you can't attribute is
  an exit ticket you can't use; this should be on by default with a toggle.
  *(The new Paper Triage tab reads `np_rosters` for its own picker; the
  handout tab itself is untouched.)*
- **Skipped — deferred, Round 4.** **Tag prompts by subject and by purpose** (recall, reflection, prediction,
  self-assessment) so the bank is browsable rather than only shuffleable.
- **Skipped — deferred, Round 4.** **Pin / favourite prompts** and a "don't show me this one again" control.
- **Skipped — deferred, Round 4.** **Import a prompt list** from a paste (P13) instead of adding one at a time.

#### Major Features

- **Skipped — deferred, Round 4.** **Standards / objective tagging** so the prompt bank can be filtered by what
  you're actually teaching that day.
- **Skipped — deferred, Round 4.** **Number Talks and Writing Prompt convergence** (P7). This tool, 
  `024-number-talks-board.html`, and `025-writing-prompt-generator.html` are three
  implementations of "bank of prompts + projector display + printable
  handout". They should share the bank format and the display engine even if
  they stay separate front doors. *(Confirmed duplication by inspection —
  see the Round 4 update's cross-tool note — but not touched; `_shared/` was
  out of scope this round.)*

#### Moonshot / North Star

**Formative assessment that closes the loop in one class period.** Show the
prompt, run the think time, collect the paper slips, and then triage a class
set in the time it takes students to pack up — tapping got-it / almost /
reteach down a grid, projecting two anonymous responses for a thirty-second
whole-class discussion, and printing tomorrow's small-group list on the way
out. All local, all private, all from the teacher's machine.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Digital response collection.** A QR/link students type a response into on
  their own device, returned to the teacher's browser over `webrtc-pair.js`.
  Technically the most distinctive thing the site could build with the pairing
  module, and out of scope regardless. Paper slips plus the fast triage grid
  above are the teacher-facing answer.
- **Live student response board** fed by those submissions.

#### Open Questions

- Should the three prompt-bank tools merge into one with modes, or stay
  separate and share a library?

#### Platform themes that matter here

- **P9 (device pairing)** — teacher-side only: a phone remote for advancing
  prompts and running think time while circulating.
- **P2 (shared roster)** — named class sets and per-student triage.
- **P7 (cross-tool)** — the prompt-bank/display/handout trio it shares with
  Number Talks and Writing Prompt Generator.
- **P1 (projector mode)** — **addressed 2026-08-10 (Round 4, PR #55)**: a
  Fullscreen button now enlarges the `.stage` element for the prompt display.

### 024 — Number Talks / Mental Math Routine Board

*`Tools/024-number-talks-board.html`.*

#### Quick Wins

- **Draw on a strategy card.** Number talk strategies are frequently
  visual — a number line, an array, a decomposition tree. A minimal drawing
  surface would capture what typing can't.
- **Turn-and-talk timer** built into the reveal flow (P7 — the timer exists).
- **A "wait time" pause** between reveal and discussion, since the routine
  depends on silent think time.
- **Save a whole session as a printable record** — the board, the strategies,
  and who contributed — which the export partly does but not as a handout.

#### Major Features

- **Skipped — deferred, Round 4.** **Generate strings from a strategy.** Given "compensation" and a grade band,
  produce a fresh, correctly-sequenced string. The expression parser already
  proves the tool can reason about arithmetic. *(Judged genuinely next-round
  scope — risky to get pedagogically right without more thought.)*
- **Student-device strategy submission** (P9), so quiet students contribute
  without speaking.
- **Convergence with the other prompt-bank tools** (P7) —
  `023-exit-ticket-generator.html` and `025-writing-prompt-generator.html` have the
  same bank/display/handout architecture in three separate implementations.

#### Moonshot / North Star

**The routine, with the pedagogy built in.** Not a random-problem projector,
but a sequenced library of number strings that each teach something specific,
a board that captures the class's strategies in their own words with their
names on them, a growing wall of the class's methods, and a printable record
of what the class figured out — for a teacher who wants to run number talks
well but doesn't have a math coach.

#### Open Questions

- How much curated content is Devon willing to author or curate? The library
  is the highest-value work here and it is writing, not programming.
- Should the expression parser be extracted to `_shared/` — the graph paper
  and math drill tools could both use it?

#### Platform themes that matter here

- **P1 (projector mode)** — **addressed 2026-08-10 (Round 4, PR #55)**:
  `#stageArea` fullscreen/dark mode shipped, with a noted single-vs-dual-screen
  tradeoff (only the stage subtree renders while fullscreened).
- **P7 (cross-tool)** — shares an architecture with two other prompt-bank
  tools and needs the timer.
- **P2 (shared roster)** — **addressed 2026-08-11 (Pass 2, Round 2)**: strategy
  attribution via `np_rosters`-backed autocomplete; see below.
- **P15 (first run)** — the shipped content library is the product here.

### 025 — Writing Prompt Generator

*`Tools/025-writing-prompt-generator.html`.*

#### Quick Wins

- **Sentence starters and a "if you're stuck" line** with each prompt, which
  is what the students who need the prompt most actually need.
- **Tag prompts by purpose** (quick write, journal, on-demand assessment,
  creative) as well as genre.
- **Import a prompt list** from a paste (P13) instead of one at a time.

#### Major Features

- **Convergence with the other prompt-bank tools** (P7).
  `023-exit-ticket-generator.html` and `024-number-talks-board.html` have the same
  bank/display/handout architecture. Three implementations exist.
- **A much bigger, better-organized bank**, including prompts tied to
  historical documents and images (P7 — `028-primary-source-analysis-generator.html`
  and `046-blank-map-generator.html` both hold sources worth writing about).

#### Moonshot / North Star

**The writing routine, planned and run.** A sequence of prompts planned across
a unit with rubrics attached, displayed full-screen with a timer and sentence
starters for whoever needs them, printed as lined half-sheets to write on, two
anonymous examples projected for a revision discussion, and a printed record
at the end of the quarter of which prompts each student wrote to and what the
teacher noted about each.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Response collection from student devices** over a local peer connection.
  The anonymous projection above gets the discussion benefit without it.
- **Student writing portfolio** maintained by students. A teacher-maintained
  record of prompts and notes stays in scope; students maintaining it does not.

#### Open Questions

- Should the three prompt-bank tools share a bank format and a display engine
  even if they keep separate front doors? The duplication is substantial.

#### Platform themes that matter here

- **P7 (cross-tool)** — one of three prompt-bank tools; wants the timer and
  the source tools still. **Rubric pairing addressed 2026-08-10** via the
  read-only `wpg-rubric-link.js` bridge.
- **P2 (shared roster)** — already reads `np_rosters` for the assignment
  sheet, which is the pattern other tools should copy.
- **P9 (device pairing)** — teacher-side only: a phone remote for the
  projected prompt display.
- **P1 (projector mode)** — has fullscreen; still needs dark mode.

### 026 — Math Fact Drill Sheet Generator

*`Tools/026-math-drill-generator.html`.*

#### Quick Wins

- **Mostly done — More operation types** (2026-08-12): fractions
  (add/subtract), decimals, percents, integers with negatives, and order of
  operations all shipped. Fraction multiply/divide, exponents and one-step
  equations are still open, and now need only a generator case each.
  Originally worded as: this backlog lists a
  fraction–decimal–percent drill as a separate tool; it belongs here.

#### Major Features

- **Targeted practice from data.** "Generate a sheet of only the facts this
  student missed." Requires a way in — a paste, or a tap-what-they-missed
  grid — and turns a random generator into an intervention tool.
- **Progression / fluency tracking.** A student's drill history over weeks,
  timed scores, and a printable progress chart. Fluency practice is
  fundamentally longitudinal and the tool currently has no memory.
- **Word problems.** this backlog has a word-problem generator as a
  separate idea; a templated version here (same numbers, wrapped in context)
  is a small addition with a big pedagogical difference.
- **"Find the mistake" mode** — also on the backlog — is this generator plus
  a deliberate error and a worked solution. Cheap to add on top of what
  exists.
- **On-screen practice mode** with immediate feedback via a share link (P3),
  for a student on a device — with no accounts and nothing stored.

#### Moonshot / North Star

**Any arithmetic practice a student needs, in the format that will actually
get done.** Choose the skill or import the misses, choose the shape (plain
drill, riddle, colour-by-answer, word problems, find-the-mistake, on-screen),
choose the difficulty, and print a sheet with an answer key — reproducibly, so
the same sheet can be reprinted, and longitudinally, so the sheet gets harder
as the student improves.

#### Open Questions

- Should the backlog's three math-generator ideas be built here as modes, or
  as separate tools sharing a generator module? Building them here is less
  work and gives one place to look; separate tools are easier to find from the
  landing page.
- Is fluency history worth storing given the site's careful stance on student
  data? It's arguably the most useful and the most sensitive addition.

#### Platform themes that matter here

- **P6 (print quality)** — problems-per-page and legible sizing are the whole
  output.
- **P15 (first run)** — templates are good; a skill-picker organized by grade
  band would be better.
- **P7 (cross-tool)** — three this backlog entries (word problems,
  find-the-mistake, fraction/decimal/percent) are extensions of this tool
  rather than new tools.
- **P3 (share links)** — an on-screen practice mode.

### 027 — Novel Study / Reading Circles Manager

*`Tools/027-novel-study-circles-manager.html`.*

#### Major Features

- **Discussion assessment.** A quick per-meeting rubric tap (participated /
  prepared / advanced the conversation) with a printable summary. This is the
  hardest thing to grade in an ELA classroom and the tool is already in the
  room when it happens.
- **Book and reading-log integration** (P7). `033-ssr-log-tracker.html` already
  tracks books and pages; a student in a novel study is doing both, in two
  tools that don't know about each other.
- **Reusable across the year.** Roles, question banks, and reading schedules
  saved as reusable templates rather than rebuilt per book.
- **Meeting-day board.** Project today's circles, roles, chapter target, and a
  discussion timer — the shape this tool takes on the actual day.

#### Moonshot / North Star

**Reading circles that run themselves for a whole unit.** Set up the books,
the groups, and the end date; get a paced reading schedule that respects the
school calendar, rotating roles that nobody repeats, printed role cards with
real prompts on them, an accountability sheet between meetings, a running
vocabulary list that feeds flashcards and a review game, and a per-student
discussion record — with the projector showing today's circles when the bell
rings.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Role cards on student devices** by link/QR, instead of printing them.
  Printing is the teacher-facing path and is already the better artifact,
  since the role prompts need to sit in front of the student all meeting.

#### Open Questions

- Should the role-rotation engine be shared with
  `022-lab-group-role-randomizer.html`, or are the roles different enough that
  only the recency algorithm is worth sharing?
- Is discussion assessment something to build here, or is it a rubric problem
  that `003-rubric-builder.html` should own with this tool calling it?

#### Platform themes that matter here

- **P7 (cross-tool)** — role rotation duplicated from the lab tool, group
  formation duplicated from three tools, vocabulary that should flow onward,
  reading logs that already exist elsewhere.
- **P2 (shared roster)** — role history needs stable IDs.
- **P6 (print quality)** — role cards and accountability sheets are the
  deliverables.
- **P14 (year lifecycle)** — templates should outlive a single book.

### 028 — Primary Source Analysis Worksheet Generator

*`Tools/028-primary-source-analysis-generator.html`.*

#### Quick Wins

- **Partly done.** **More frameworks.** APPARTS and 5 W's already existed (this file
  was stale — they were built in an earlier round not reflected here); HIPP
  and See-Think-Wonder shipped this round. Still open: the NARA document
  analysis worksheets and a dedicated Corroboration/Sourcing/Contextualization
  set for historical thinking skills.
No Quick Wins remain open.

#### Major Features

- **Multi-source packets (DBQ).** this backlog lists a DBQ / Source
  Packet Builder as a separate tool; it is this tool with several sources and
  a shared set of guiding questions plus a synthesis prompt. Building it here
  is far less work than building it separately, and this tool's framework
  machinery is exactly what it needs.
- **Done — SS demo round 2, session `kx9rtm`.** ~~A source library.~~ Teacher-built collections of frequently-used
  sources, tagged by unit / topic / era, so building a worksheet starts from a
  source rather than a blank paste. Still open from the original idea: a
  *shipped* starter collection, and searching public-domain material
  in-browser the way `046-blank-map-generator.html` handles Wikimedia (P7).
- **Projected analysis mode.** The source shown large with the framework's
  questions revealed one at a time, for working through a document together
  as a class — the no-copier fallback, driven from the teacher's machine.
- **Timeline and map handoff** (P7). A source has a date and a place;
  `015-timeline-builder.html` and `046-blank-map-generator.html` both want them.
- **Answer key with sample student responses**, not just teacher notes — what
  a proficient answer looks like, which is what makes the key useful to a
  substitute or a co-teacher.

#### Moonshot / North Star

**Turn any document into a full lesson in ten minutes.** Drop in a source —
text, image, cartoon, map, photograph — pick the analysis framework, and get a
scaffolded student worksheet with line numbers and vocabulary support, a
reading-support variant, a teacher key with sample responses, a multi-source
DBQ packet when you want one, and a projected walk-through version for the day
the copier is down. With the source's date and place flowing into the class
timeline and map.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device worksheet.** A link or QR opening the source and questions
  on a student device with responses staying local. The projected analysis
  mode above covers the no-copier case.

#### Open Questions

- Should the DBQ builder be built here as a "multi-source" mode, or stay a
  separate backlog tool? Building it here is cheaper and keeps one place to
  look; a separate tool is more discoverable from the landing page.
- Is there a public-domain source library worth shipping (Commons, Library of
  Congress, National Archives are all searchable and free), and does searching
  them in-browser stay within the offline-first constraint the way
  `046-blank-map-generator.html` handles Commons?

#### Platform themes that matter here

- **P7 (cross-tool)** — the DBQ builder on the backlog belongs here, and
  timeline/map handoff is natural for social studies.
- **P12 (storage/images)** — uploaded source images base64'd into
  `localStorage`.
- **P6 (print quality)** — line-numbered text, image detail callouts, and a
  worksheet that leaves the right amount of writing space.
- **P3 (share links)** — sharing a worksheet with a colleague or a co-teacher.

### 029 — Prompt Builder

*`Tools/029-prompt-builder.html`.*

#### Quick Wins

- **Done — Pass 2, Round 2.** **Prompt history search and pinning.** Export the
  whole history is still open.

#### Major Features

- **Output-shape presets tied to the toolkit.** Generate a prompt that asks
  for CSV in exactly the columns `030-review-game-board.html` imports, or a
  `term: definition` list for `040-vocab-flashcard-generator.html`, or a rubric
  in Rubric Builder's JSON shape — with a "paste the result here" box that
  hands it straight to that tool (P7). This would make the AI a content
  supplier for the whole site without any of the tools themselves needing an
  API key or a network call.
- **A prompt library organized by teaching task**, not by prompt technique —
  differentiation, translation for families, reading-level adjustment, IEP
  accommodation ideas, feedback comment banks, parent communication for
  difficult conversations.
- **Prompt versioning and comparison.** Keep v1 and v2 of a prompt with notes
  on what changed and which worked better — the actual skill of prompting,
  made visible.
- **Templates with variables.** `{{subject}}`, `{{grade}}`, `{{unit}}` filled
  from saved defaults, so a teacher's standing context (7th grade, social
  studies, this district) is never retyped.

#### Moonshot / North Star

**The bridge between an AI assistant and this toolkit, with the privacy line
drawn clearly.** A teacher describes what they need in plain language, gets a
prompt engineered for it, sends it to whichever assistant they use, pastes the
result back, and it lands as usable data in the right tool — questions in the
review board, vocabulary in the flashcards, a rubric in the rubric builder —
with names redacted on the way out and nothing stored anywhere but their own
browser.

#### Open Questions

- Should the tool ever call an AI API directly with a user-supplied key? That
  would cross the current constraint, so the default answer is no — but it's
  the obvious question and worth recording as answered.

#### Platform themes that matter here

- **P7 (cross-tool)** — the output-shape-matching idea is what makes this tool
  more than a text box, and it touches most of the site.
- **P1 (theme)** — already loads `theme.css`; still needs the toggle.
- **P15 (first run)** — presets exist and are the right idea; a task-organized
  library is the fuller version.

### 030 — Quiz / Review Game Board

*`Tools/030-review-game-board.html`.*

#### Quick Wins

- **Projector styling** (P1). This is a projector-first tool with neither
  fullscreen nor the shared theme.

#### Major Features

- **Multiple game formats over one question bank.** The bank is the valuable
  asset; the board is one way to play it. The same questions could drive:
  a bracket-style head-to-head (P7 — the bracket engine exists), a team
  quiz-bowl with buzzers, a "spin the wheel" random question, a scavenger hunt
  or escape room (both of those tools need questions and have none), and a
  printed practice quiz with an answer key. Building the bank once and playing
  it six ways is the single highest-leverage change available here.
- **Done — 2026-08-13. A real question bank, separate from a board.** Tagged
  by unit, standard, and difficulty; filterable; reusable across boards and
  across years via "pull into board" (a copy, not a live reference). *(Scoped
  to this tool's own boards — the site-wide "one bank, six formats" version
  below is still open; see the 2026-08-13 Status entry's scope note.)*
- **Every-team-answers mode.** Instead of first-hand-up, every team writes an
  answer on a whiteboard and the teacher taps which teams got it — awarding
  points to all of them at once. Keeps the quiet teams playing, and it's a
  scoring-UI change rather than a device problem.
- **Teacher-side buzz order.** A simple on-screen row of team buttons the
  teacher taps in the order hands went up, so ties and disputes have an
  answer without any student hardware.
- **Difficulty-aware point values**, and a mode where a wrong answer passes
  the question to the next team.

#### Moonshot / North Star

**One question bank, every review format.** Build or import the questions
once — tagged by unit and standard — and then play them as a game board, a
bracket, or a whiteboard every-team-answers round; or print them as a practice
quiz, a study guide, flashcards, or the station content for a scavenger hunt
or escape room. One authoring effort, six outputs, all driven from the front
of the room.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Buzzer mode.** Student devices connecting over `webrtc-pair.js` to buzz
  in, with order and timing on the projector. Genuinely novel for a no-server
  site, and out of scope. The teacher-side buzz-order row above solves the
  dispute problem without student hardware.
- **Per-student answer submission** from devices.

#### Open Questions

- Should the question bank become its own tool (or a shared store) that this
  board, the escape room, the scavenger hunt, and the flashcard generator all
  read? That's the architectural version of the moonshot above.

#### Platform themes that matter here

- **P7 (cross-tool)** — the question bank is the site's most reusable missing
  asset; four other tools need questions and none can get them from here.
- **P9 (device pairing)** — teacher-side only: running the board from a phone
  or mirroring it to a second display.
- **P13 (import surfaces)** — already the best on the site; its
  template-download pattern should be copied everywhere.
- **P1 (projector mode)** and **P10 (keyboard-first)** — it's a live
  performance tool run from the front of a room.

### 031 — Word Doc Merger

*`Tools/031-docx-merger.html`.*

#### Quick Wins

- **Done —** **Vendor JSZip locally** (P5). Same cdnjs dependency as Sub Plan Builder;
  the tool simply fails on a blocked network. *(Sub Plan Builder itself is
  still unfixed — see Status.)*
- **Per-document options**, not global: page break after *this* one, heading
  for *this* one, skip the first page of *this* one. *(Heading text is now
  per-document — see below. Page-break-after-this-one and skip-first-page
  are still global/unbuilt.)*

#### Major Features

- **Section-aware merging.** Preserve each source document's page size,
  orientation, and margins by keeping its `sectPr` — so a landscape rubric
  merged into a portrait packet stays landscape. `stripTrailingSectPr` and
  `createDefaultSectPr` show the groundwork is already understood.
- **Headers, footers, and page numbers** across the merged document — the
  single biggest gap between "merged file" and "packet you can hand out".
- **Split, extract, and reorder pages**, not just merge. The natural sibling
  operations, and there is no free local tool for them.
- **Merge PDFs too, or export the merged result as PDF.** `011-image-to-pdf.html`
  already vendors/loads jsPDF; a shared PDF layer would let this tool output
  both formats (P7).
- **Packet builder for the toolkit** (P7). The site generates a lot of
  printable documents — rubric, permission slip, sub plan, worksheet, answer
  key. A tool that assembles those into one ordered packet with a cover page
  and a table of contents is more valuable than a generic merger.
- **Cover page generator** with title, class, date, and teacher name.

#### Moonshot / North Star

**The packet assembler.** Everything the toolkit prints, plus whatever Word
and PDF files the teacher already has, ordered into one document with a cover
page, a table of contents, consistent page numbering, and correct per-section
orientation — assembled and printed in one pass, entirely in the browser. The
OOXML machinery here is already the hardest part of that and it's already
written.

#### Open Questions

- How much OOXML fidelity is worth chasing? Images and tables are common;
  tracked changes and footnotes are rare. Worth deciding where the honest
  "not supported, and here's a warning" line sits.
- Is PDF output more useful than .docx output for how these get used?

#### Platform themes that matter here

- **P5 (offline integrity)** — **fixed for this tool** (JSZip vendored,
  Round 6). `044-Sub Plan Builder.html` has the identical bug, still unfixed.
- **P7 (cross-tool)** — the natural terminal step of many other tools'
  workflows.
- **P6 (print quality)** — headers/footers/page numbers are exactly the shared
  print concerns, expressed in OOXML instead of CSS.
- **P1 (theme)** — already loads `theme.css`; still needs the toggle.

### 032 — School Calendar Visualizer

*`Tools/032-School Calendar Visualizer.html`.*

#### Quick Wins

- **Done —** **A/B day cycle overlay.** The rest of the site (Schedule Browser, Schedule
  Visualizer) is built around A/B days; this calendar doesn't know about them,
  so it can't answer "is the Monday after break an A day?" — which is the
  single most-asked calendar question in a block-schedule school. *(Month
  view only — year-grid badges are still open.)*
- **Week-at-a-glance print** in addition to the month/year views.

#### Major Features

- **Pacing layer, properly.** *(Partially done 2026-08-13 — see Status: named
  units with explicit start/end dates, a computed instructional-day count,
  a calendar band, and a printable pacing table all exist now.)* Still
  open: a unit defined by a *target* instructional-day count rather than an
  explicit end date, auto-flowing its end around holidays/half days/testing
  windows as they change, and a "you're three days behind" comparison
  against where a unit should be by today. A pacing calendar that
  *recomputes* when you lose a day to a snow day is worth a great deal.
- **Grading-period awareness everywhere.** If the calendar knows quarter
  boundaries, Final Grade Checker knows what "the remaining quarter" means,
  Grade Distribution knows which window it's summarizing, and Sub Plan Builder
  knows whether tomorrow is a grading deadline (P7).
- **Import a district calendar.** Paste an .ics, or paste the table off the
  district PDF/webpage and parse it. The 2026–27 CCPS preset is great and also
  a maintenance burden that expires; a parser outlives it.
- **Multi-calendar overlay.** School calendar + your own PD/appointments +
  the athletics schedule, toggled on and off, printed together.
- **Bell schedules per day type.** Half day, assembly schedule, testing
  schedule — this is the missing piece that would let Classroom Timer answer
  "how long is 3rd period today?" (P7).
- **Print quality for the wall.** A one-page year wall calendar with a legend,
  sized for a letter or ledger sheet, is a thing every teacher tapes above
  their desk.

#### Moonshot / North Star

**The spine of the school year.** Every other tool asks "what day is it, and
what does that mean?" — A or B, which quarter, which unit, how many teaching
days are left, is today a half day, when is the testing window. This tool
should be the single local source of truth for that, and everything else on
the site should read it. It is already read by two tools; the ambition is that
it is read by twenty.

#### Open Questions

- Should bell schedules live here or in a separate tool? They're calendar-
  shaped but they're really schedule-shaped, and `035-schedule-visualizer.html`
  already has a bell-day concept (`_bellDayRows`, `brSnapshotBell`).
- Is the hard-coded CCPS calendar a feature to keep updating each year, or
  should it become "import from a file/paste" plus a shipped example?

#### Platform themes that matter here

- **P14 (year lifecycle)** — this tool already solved rollover; its approach
  should be the model the rest of the site copies.
- **P7 (cross-tool handoff)** — the highest-value producer of shared context
  on the site.
- **P6 (print quality)** — a year-on-one-page print is a specific, hard,
  worthwhile layout problem.
- **P13 (import surfaces)** — .ics and pasted-table import.

### 033 — Silent Reading (SSR) Log Tracker

*`Tools/033-ssr-log-tracker.html`.*

#### Quick Wins

- **Genre tagging**, so "you've read six fantasy books; try one of these" is a
  conversation the data supports.
- **Timer for the SSR period itself** (P7 — the timer already exists).

#### Major Features

- **Reading conference notes.** The teacher's per-student notes from a reading
  conference, dated, alongside the log — turning a page counter into the
  record of the reading relationship, and exactly what you want in front of
  you at a conference.
- **Goals and challenges.** Personal page goals, a class total (a "read a
  million pages" thermometer), a 40-book challenge tracker — the structures
  that make independent reading programs work.
- **A printed class recommendations board.** The teacher records a rating when
  a student finishes a book, and the tool prints a "what your classmates
  recommend" sheet or poster for the classroom library wall — the same social
  effect, produced as a teacher artifact.
- **Novel study integration** (P7). `027-novel-study-circles-manager.html` tracks
  students reading assigned books with chapter checkpoints; this tracks
  independent reading. A student is doing both and the tools don't know about
  each other.
- **Parent-facing reading report**, printable, showing what a child read this
  quarter and how consistently — one of the most welcome things a parent can
  receive.
- **Classroom library inventory.** Which books exist, who has which one
  checked out, what's missing — the natural sibling problem, and one every
  classroom library has (QR codes on books; the site already has both a
  generator and a scanner, P7).

#### Moonshot / North Star

**The full picture of a reader's year, logged in minutes a week.** Paper slips
come back in the order the bulk-entry grid expects, so a class set is
transcribed in one pass; the teacher's conference notes sit beside the log;
the wall gets a printed finished-books display and a class recommendations
board; the classroom library knows where its books are; and at conference time
there's a printed report showing exactly what this child read, how their pace
changed, and what to try next — all stored only in the teacher's browser.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student self-logging.** Students entering their own reading from a
  projected QR/link or a shared classroom device. This would genuinely change
  the tool's economics — transcription is its real cost — and it is
  nonetheless out of scope. The bulk-entry grid and matching paper slips above
  are the teacher-facing way to attack the same cost.
- **Student-to-student book recommendations** displayed in-app, as opposed to
  the printed recommendations board above.

#### Open Questions

- Should classroom library inventory be part of this tool or its own?

#### Platform themes that matter here

- **P6 (print quality)** — paper log slips and the parent-facing report are
  the outputs that make the tool sustainable.
- **P2 (shared roster)** — both reads and writes `np_rosters`.
- **P7 (cross-tool)** — novel study, the timer, and the QR tools all connect.
- **P14 (year lifecycle)** — reading logs are annual and want archiving.

### 034 — East Middle Schedule Browser

*`Tools/034-schedule-browser.html`.*

#### Quick Wins

- **Where is this student right now?** By-group view plus the current period
  answers it; the office asks this several times a day. *(Partly enabled —
  Free Right Now answers "who", not "where's this specific group right now";
  still open.)*
- **Add to phone home screen / offline** — the site has a service worker, so
  a teacher's own schedule should be reliably available with no signal in a
  hallway.
- **Partly done.** **Print a wallet-sized or door-sized version** — the two physical formats
  that actually get used. *(Shipped door-sized only — see Status.)*

#### Major Features

- **Coverage finder.** "Mr. X is out 3rd period — who is free and qualified?"
  Combines the free-period computation with department information the
  publisher already has (`brSyncDeptFromSettings`). This is a daily
  administrative problem with no tool.
- **Room finder.** "I need an empty room with a projector 5th period" — the
  building map plus the schedule already contains the answer.
- **Duty and meeting overlays.** Common planning is already shown; adding
  duty rotations (this backlog has a Duty Roster Builder) and standing
  meetings would make this the complete "where is everyone" picture.
- **Navigation for a new person.** A route on the building map from room A to
  room B; the visualizer already has pathfinding (`astar`,
  `buildMultiFloorGraph`, `computeTravelTimes`) that the published browser
  does not expose.

#### Moonshot / North Star

**Every "where is…" question in the building, answered in one tap, offline.**
Where is this teacher, where is this student's class, who is free now, which
room is empty, how do I walk from here to there, who can cover 3rd period —
answered from a published file that works on a phone in a hallway with no
signal, and that loudly tells you when it's out of date.

#### Open Questions

- Should improvements be specified here at all, or should this file simply
  point at `035-schedule-visualizer.html`? Kept separate here because the
  *reader's* experience is a different design problem from the *builder's*.
- Is this published for the whole staff, and if so does anything about it need
  to be different for a non-technical audience opening it on a phone?
- **Raised 2026-08-10.** Now that this round's four Quick Wins were applied
  directly to this file rather than the publisher (see Status), should this
  file be treated as **the** source of truth going forward — i.e. should
  someone eventually make `035-schedule-visualizer.html` regenerate *from* the
  current shape of this file, rather than the other way around? The R61–R63
  drift this round found suggests the "publisher is the source of truth"
  model has already broken down once in practice.

#### Platform themes that matter here

- **P7 (cross-tool)** — this file is downstream of `035-schedule-visualizer.html`;
  most changes here are changes to the publisher.
- **P1 (theme)** — a hallway phone tool that's always white.
- **P8 (versioning)** — the staleness check is a good instinct; a version
  stamp and a "published on" date would make it precise.
- **P4 (accessibility)** — an SVG building map needs a text alternative.

### 035 — School Layout Visualizer

*`Tools/035-schedule-visualizer.html`.*

#### Quick Wins

- **Split the file.** 19,400 lines in one HTML file is the main thing standing
  between this tool and further progress; every other item on this list is
  cheaper after the editor, the schedule model, the pathfinder, the congestion
  engine, the playback renderer, and the publisher are separate modules under
  `Tools/schedule-visualizer/`. The support folder already exists and holds
  only two vendored libraries and, since Pass 2 Round 3, `sv-handoff.js` and
  `sv-recovery.js` — the module split has a foothold to grow from.
- **A shipped example project** (P15) — this tool has an onboarding flow and
  still starts from nothing, which is a steep first five minutes.
- **Print the floor plan itself** at a usable size — a labelled building map
  for a sub folder, a new-teacher packet, or an evacuation route poster.

#### Major Features

- **Master schedule building, not just visualizing.** The tool already detects
  conflicts; the natural step is helping *resolve* them — suggesting room
  assignments that reduce travel time and congestion, flagging a teacher with
  three rooms in three consecutive periods, or auto-placing sections against
  constraints. This moves the tool from "shows you the schedule" to "helps you
  build the schedule", which is a fundamentally more valuable thing.
- **Congestion as an argument, not just a picture.** The congestion model
  produces exactly the evidence an administrator needs for "we should stagger
  release" or "this stairwell needs one-way traffic". A printable report —
  the top ten pinch points, the worst transitions, what the what-if scenario
  saves — turns a visualization into a proposal.
- **Accessibility routing.** Wheelchair-accessible paths, elevator use, and
  travel-time estimates for a student with a mobility accommodation. The
  multi-floor graph already exists; this is a weighting problem, and it's a
  real legal and human need that nobody has a tool for.
- **Emergency planning.** Evacuation routes per room, assembly points,
  lockdown maps, and printed per-room posters — computed from the same graph.
  This is the highest-stakes use of the model already built.
  **Partly shipped Pass 2 Round 4** — evacuation routes per room, marked
  exterior exits with named assembly points, and printed per-room door
  cards (single active floor, batched into one PDF) all now exist; see
  Status above. Lockdown maps, multi-floor batch printing, and
  accessibility-aware evacuation routing (see the item above) remain open.
- **Publish more than the browser.** The publisher is excellent; publishing
  per-teacher one-page PDFs, a printed building map pack, or a room-by-room
  door sign set would extend it cheaply (P7).
- **Multi-year and multi-scenario comparison** — this year versus next year's
  proposed schedule, side by side, with the congestion delta.
- **Bell schedule as a shared asset** (P7). This tool already models bell days;
  `school-calendar-visualizer.html`, `004-Classroom Timer.html`, and
  `010-command-center-dashboard.html` all want that data and none can reach it.

#### Moonshot / North Star

**A planning tool a school actually uses to run the building.** Draw the
building once; import the master schedule; see where the crowds form, which
students can't make it between classes, which rooms sit empty; test a change
before it's made; publish a schedule browser for staff, per-teacher PDFs, door
signs, evacuation posters, and accessible-route plans — all from one local
file, with no district software purchase, and shareable to a colleague's
laptop by QR code across a desk.

#### Open Questions

- Who is the intended user — Devon, or an administrator? The tool currently
  spans both, and the master-schedule-building ideas above only make sense if
  an administrator is in scope.
- Is the 19,400-line single file a deliberate constraint (the site's
  "single-file tool" ethos) or an accident of growth? Everything ambitious
  here gets easier if it's the latter.
- Should the published `034-schedule-browser.html` be regenerated automatically
  when the project changes, or stay an explicit publish step?
  **Sharpened 2026-08-10**: whichever answer Devon prefers, an explicit step
  that nobody re-runs is exactly how the R61–R63 drift (see above) happened
  silently — regeneration frequency and a way to *detect* drift both matter
  more now than they did before this round.
- **Raised 2026-08-10.** Given the R61–R63 drift, is `brPublishFnList()` +
  hand-copied consts the right mechanism going forward, or would a build-time
  check (e.g. a script that diffs a fresh `brBuildPublishedHTML()` output
  against the checked-in `034-schedule-browser.html` and flags unexplained
  removals) be worth adding so this class of bug can't recur silently?

#### Platform themes that matter here

- **P9 (device pairing)** — the peer-to-peer project handoff here and the
  Classroom Timer mirror are the site's only two uses; the patterns here are
  the more advanced ones.
- **P11 (undo/history)** — has the most complete history system on the site;
  worth extracting.
- **P12 (storage quota)** — the largest payloads on the site live here.
  **Partly addressed Round 7** — a proactive headroom warning and a hard
  write-failure banner now exist; the export-often workflow they point to is
  still manual.
- **P7 (cross-tool)** — the bell schedule and building map are assets four
  other tools want.
- **P8 (versioning)** — seven storage keys and a published-output format;
  migration matters.

### 036 — Final Grade Checker

*`Tools/036-final_grade_checker.html`.*

#### Quick Wins

- **Done —** **Keep the deliberate no-storage default, but offer an explicit "hold this
  in the browser until I clear it" opt-in.** Losing a pasted gradebook to an
  accidental refresh mid-conference is a real cost; making persistence a
  visible, one-click-to-erase choice respects both concerns. *(A "Remember
  these settings" checkbox in the new Grading Settings panel — persists only
  the rounding/weight/show-work settings, never a student's name or grades,
  and student data is still never written to storage anywhere in this file.)*

#### Major Features

- **Skipped — deferred.** **Scenario modelling.** "If everyone's lowest test is dropped", "if I curve
  by 4 points", "if this assignment is worth 50 instead of 100" — recomputed
  across the class instantly, with a before/after distribution. *(Not
  attempted this round.)*
- **Skipped — deferred.** **Grade-window awareness** (P7). If `032-School Calendar Visualizer.html`
  knows when the quarter ends, "remaining quarter" stops being a manual input.
  *(Not attempted this round.)*
- **Skipped — deferred.** **Hand off to Grade Distribution Visualizer** (P7). These two tools consume
  the same paste and compute overlapping statistics; one should call the
  other rather than both parsing independently. *(Not attempted this round —
  Grade Distribution Visualizer got its own round of independent
  improvements in parallel; no shared engine was built. See that tool's
  improvement file.)*
- **Skipped — deferred.** **Rubric-scored input** (P7). `003-rubric-builder.html` already scores students
  against a rubric; those scores should be able to flow here. *(Not
  attempted this round.)*
- **Skipped — deferred.** **Progress reports.** A printable per-student progress sheet for mid-quarter
  mailing, generated for the whole class in one pass. *(Not attempted this
  round — the per-student slip is a step toward this but isn't framed as a
  progress-report mailing.)*

#### Moonshot / North Star

**The five minutes before grades are due, made safe.** Paste the export and
immediately see: whose grade is wrong, who is one assignment from a different
letter, who is borderline and needs a decision, what the distribution looks
like, and what each of those students would need — with a printable slip for
each conversation, an audit trail of the arithmetic, and nothing stored
anywhere unless the teacher explicitly asks for it.

#### Open Questions

- What gradebook does the district actually export from, and can a shipped
  parser for its exact format replace the generic one? *(Still open — not
  investigated this round.)*

#### Platform themes that matter here

- **P13 (import surfaces)** — this tool sets the standard; its CSV/XLSX
  pipeline should be extracted for the rest of the site.
- **P7 (cross-tool)** — overlaps Grade Distribution Visualizer substantially.
- **P8 (privacy/storage)** — the no-storage stance is a deliberate design
  decision and should be documented as such before anyone "fixes" it.
- **P6 (print quality)** — per-student slips are the natural output.

### 037 — Grade Distribution Visualizer

*`Tools/037-grade-distribution-visualizer.html`.*

#### Major Features

- **Skipped — deferred.** **Section comparison, not just assignment comparison.** "How did 3rd period
  do versus 6th?" is the question teachers actually ask, and it's a small
  extension of the existing compare mode. *(Not attempted this round.)*
- **Skipped — deferred.** **Trend across a quarter.** Several assignments over time, as a small
  multiple or a box plot per assignment — which is the shape a department or
  PLC conversation takes. *(Not attempted this round.)*
- **Skipped — deferred.** **Item analysis.** Given per-question scores rather than totals: which
  questions did the class miss most, and which distractors pulled. This is the
  single most valuable thing a teacher can learn from a test and there is no
  free local tool that does it. *(Not attempted this round.)*
- **Skipped — deferred.** **Share the charting engine** (P7). `038-data-chart-builder.html` already draws
  bar/line/pie/scatter/box and computes quartiles; this tool draws histograms
  and stacked bars. One of them should own charting. *(Not attempted this
  round — Data Chart Builder got its own independent round of improvements
  in parallel, including its own grayscale-mode work; no shared engine was
  built. See that tool's improvement file.)*
- **Skipped — deferred.** **Direct handoff from Final Grade Checker** (P7) — same paste, same parsing,
  currently done twice. *(Not attempted this round — Final Grade Checker
  also got its own independent round in parallel; see that tool's file.)*
- **Skipped — deferred.** **A printable "what this says" summary.** Plain-language observations —
  "the class median is 78; six students scored below 60; the distribution is
  left-skewed" — for a PLC binder or a reflection, generated rather than
  written. *(Not attempted this round.)*
- **Skipped — deferred.** **Reflection mode for students.** Show the distribution anonymously with the
  student's own score marked, as a printed slip. Powerful, and requires care
  to do without shaming anyone. *(Not attempted this round.)*

#### Moonshot / North Star

**Understand an assessment in ninety seconds, and know what to do next.**
Paste the scores, see the shape, see which questions failed, see which
students the shape is hiding, compare against your other sections and against
the last test, and print both a PLC-ready summary and a small-group reteach
list — locally, privately, with no gradebook integration required.

#### Open Questions

- Should this merge into Final Grade Checker as a tab, given they consume the
  same input and are described in the README as companions?
- Is per-question item analysis realistic given what the gradebook exports, or
  would it require a separate paste from the assessment platform?

#### Platform themes that matter here

- **P7 (cross-tool)** — should share parsing with Final Grade Checker and
  charting with Data Chart Builder; three tools currently overlap here.
- **P6 (print quality)** — colour-encoded grade bands print as identical grays.
- **P13 (import surfaces)** — no XLSX support, though a sibling tool has it.
- **P4 (accessibility)** — a chart-only tool needs a table alternative.

### 038 — Data Table → Chart Builder

*`Tools/038-data-chart-builder.html`.*

#### Quick Wins

- **Skipped — deferred.** **Copy chart to clipboard as an image**, so it can go straight into a slide
  or a doc without a download step. *(Not part of this round's scoped
  list.)*
- **Skipped — deferred.** **Bigger/print layout preset.** Charts get projected; a projector preset
  (thick lines, large type) and a print preset would both get used. *(Not
  part of this round's scoped list.)*

#### Major Features

- **Partially done — pulled up into this round.** **Printed worksheet output** (teacher-generated handout, not a
  student-operated mode). Print the chart with a blank axis for
  students to complete, or print the data table with a blank grid — turning a
  charting tool into a worksheet generator, which is the classroom shape of
  this need (P6). *(Shipped the blank-axes-chart half, for bar and line
  charts only. The "print the data table with a blank grid" half was not
  attempted — a natural next step, and would also extend worksheet mode to
  pie/scatter/box.)*
- **Skipped — deferred.** **Histogram and frequency table.** `037-grade-distribution-visualizer.html`
  already builds histograms; that logic belongs here, with the grade tool
  consuming it (P7). Right now two tools bucket numbers independently.
  *(Not attempted this round — Grade Distribution Visualizer got its own
  independent round of improvements in parallel, including its own
  zero-bucket histogram work; no shared engine was built. See that tool's
  improvement file.)*
- **Skipped — deferred.** **Two-variable analysis.** Scatter with trendline exists; correlation
  coefficient, residuals, and "is this linear?" prompts would make it a real
  data-literacy tool for a middle school science or math class. *(Not
  attempted this round.)*
- **Skipped — deferred.** **Templates by subject.** A lab data template (trial, measurement, average),
  a survey template, a grade template — each with the right chart type and
  stats preselected (P15). *(Not attempted this round.)*
- **Skipped — deferred.** **Chart annotation.** Arrows, labels, a shaded region, a "line of best fit"
  callout — the difference between a chart and a chart that makes an argument.
  *(Not attempted this round.)*
- **Skipped — deferred.** **Multiple charts on one printed page**, for a lab report or a comparison.
  *(Not attempted this round.)*
- **Skipped — deferred.** **XLSX import** (P13). Currently CSV-ish paste only; `036-final_grade_checker.html`
  and `030-review-game-board.html` already vendor SheetJS and could share it.
  *(Not attempted this round.)*

#### Moonshot / North Star

**The classroom's data-literacy workbench.** Paste anything — lab results, a
class survey, census data, a table off a website — and move fluidly between
seeing it, questioning it, annotating it, and printing it as either a finished
figure or a student worksheet. Every chart is exportable, every stat is
explained in words a 12-year-old can read, and nothing is uploaded anywhere.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-operated charting.** Students pasting their own lab data into the
  tool on their own devices. The tool is for the teacher building figures and
  worksheets; a student needing to chart lab data should be doing it in
  whatever the class already uses.

#### Open Questions

- Is the audience here the teacher (making a figure for a handout) or the
  student (analyzing their own lab data)? The two want fairly different UIs
  and it's worth choosing a primary.
- Should this absorb the histogram work in Grade Distribution Visualizer, or
  stay separate and be called by it?

#### Platform themes that matter here

- **P7 (cross-tool)** — should become the site's charting engine; Grade
  Distribution and Behavior Trends both want it.
- **P6 (print quality)** — grayscale-safe output is a correctness issue, not
  a polish issue.
- **P13 (import surfaces)** — XLSX parity with the two tools that already have
  it.
- **P4 (accessibility)** — charts need a text/table alternative and shouldn't
  encode meaning in colour alone.

### 039 — Vocab & Conjugation Drill Generator

*`Tools/039-vocab-conjugation-drill.html`.*

#### Quick Wins

- **Skipped — deferred.** **Fill-in-the-blank sentence mode** instead of bare conjugation tables,
  which is closer to how the skill is assessed. *(Not part of this round's
  scoped list — it needs an example-sentence field per conjugation entry and
  a blank-generation rule, which is a bigger addition than the five items
  above; a natural next Quick Win.)*

#### Major Features

- **Partially done — lightweight bridge shipped, full hub deferred.**
  **Shared vocabulary store** (P7). This tool, 
  `040-vocab-flashcard-generator.html`, and `014-roleplay-scenario-generator.html`
  each hold vocabulary in their own format. One entered word list should
  produce flashcards, word wall cards, drills, a roleplay scaffold, and review
  game questions. This is the clearest content-reuse win on the site.
  *(A full shared hub was explicitly out of scope for this round. Instead,
  this tool and `040-vocab-flashcard-generator.html` each got a small read-only
  bridge to the other's saved lists, copying the pattern
  `025-writing-prompt-generator.html`'s `wpg-rubric-link.js` established: no
  shared library, no format negotiation, just one tool reading the other's
  own localStorage keys and converting on the way in. See Open Questions
  below for the exact shape and what's still not bridged — that's where a
  future round building the real hub should pick up.)*
- **Spaced-repetition scheduling for printed drills.** The tool tracks which
  items the class has seen and when, and weights each new printed drill
  toward the words that are due for review — the retrieval-practice benefit,
  delivered on paper by the teacher.
- **Conjugation pattern engine.** Given a verb and its type, generate the
  regular conjugation automatically and let the teacher correct the
  irregulars — rather than typing every form of every verb. For Spanish and
  French the regular patterns are entirely mechanical.
- **Audio for every item** (already possible via `speechSynthesis`) plus a
  listening quiz — hear the word, write it — which no other free tool offers
  offline.
- **Grammar reference sheets.** The conjugation tables are already a reference
  sheet; formalizing that output (and connecting it to
  `041-formula-sheet-builder.html`'s layout engine, P7) would give language
  classes the equivalent of a math formula sheet.
- **Progress tracking per student**, for the teacher — which words the class
  consistently misses, printable as a reteach list.

#### Moonshot / North Star

**One word list, every practice format, in any language.** Type the vocabulary
once and get flashcards, word wall cards, printed drills in both directions
with answer keys, a conjugation table with the irregulars highlighted, a
projected listening exercise with real audio, printed drills automatically
weighted toward the words due for review, and review game questions — for
Spanish, French, Latin, ASL glossing, or a language the tool has never heard
of, because the teacher supplies the words and the person labels.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device spaced repetition.** A share link opening the set on a
  student's own device with a review schedule stored locally. Scheduling the
  *printed* drills instead keeps the retrieval-practice benefit teacher-side.

#### Open Questions

- **Resolved 2026-08-10 — partially, with a lightweight answer.** What shape
  should a shared vocabulary record take (term, definition, part of speech,
  gender, example sentence, audio hint, image)? Designing it once across the
  four vocabulary-adjacent tools is the prerequisite for everything above.
  — This round didn't design the full shared shape, but it did establish a
  concrete small one for the one bridge it built: `{term, definition,
  partOfSpeech, example, pronunciation}`, borrowed from
  `040-vocab-flashcard-generator.html`'s own storage format (which gained
  `partOfSpeech` and `pronunciation` fields this same round — see that
  tool's improvement file). This tool's own vocab format is still just
  `{word, translation}` — it has no fields for part of speech, example
  sentence, or pronunciation, so the bridge (`getFlashcardItems` here,
  `VfgConjDrillLink` in the flashcard tool's folder) only carries
  term/definition in *either* direction; everything else is silently
  dropped on import, by design (documented in-code at both bridge
  functions, not invented on the receiving end). **Not yet bridged:**
  `014-roleplay-scenario-generator.html`'s vocabulary log; any of
  part-of-speech/example/pronunciation/gender/audio/image; a write-back
  path (both bridges are strictly read-only, one-time-copy imports, not a
  live sync). A future round building the real shared hub should start from
  that five-field shape, decide whether this tool's conjugation-drill
  format should grow matching fields or stay minimal-by-design (a drill set
  is arguably not the place for a Frayer-model's worth of metadata), and
  decide whether the hub owns canonical records with every tool reading
  through it, or whether more pairwise bridges like this one are good
  enough. This round deliberately didn't decide that — it only proved the
  pairwise-bridge pattern works for a second pair of tools.
- Is `speechSynthesis` voice quality and language availability reliable enough
  on school machines to build a listening quiz on, or does it need a fallback?
  *(Still open — not investigated this round.)*

#### Platform themes that matter here

- **P7 (cross-tool)** — a shared vocabulary store serving four tools is the
  headline opportunity.
- **P3 (share links)** — sharing a drill set with another language teacher.
- **P4 (accessibility)** — TTS is already here; it's an accessibility asset
  worth extending across the site.
- **P6 (print quality)** — drills and answer keys.

### 040 — Vocabulary Flashcard & Word Wall Generator

*`Tools/040-vocab-flashcard-generator.html`.*

- **Carried over from a closed item.** The **Frayer model page** (one four-quadrant page per word: term, definition, example, non-example/picture) is the one piece of "More printable formats from the same list" still untouched — a per-word page layout, not a puzzle-generation problem, so it needs nothing from `vfg-printables.js`'s seeded-RNG/placement machinery; it is closer in shape to `wallCardHtml`/`buildWallPages`.

#### Quick Wins

- **Skipped — deferred.** **Image on a card.** For vocabulary — especially language and science
  vocabulary — a picture is often the definition. Requires downscaling and a
  storage warning (P12). *(Not part of this round's scoped list. The
  downscale-on-import pattern already exists in `041-formula-sheet-builder.html`
  — `readAndDownscaleImage` — and would be the template to copy.)*

#### Major Features

- **Partially done — lightweight bridge shipped, full hub deferred.**
  **Shared vocabulary store** (P7). This tool,
  `039-vocab-conjugation-drill.html`, `014-roleplay-scenario-generator.html`, and
  `027-novel-study-circles-manager.html` (which accumulates a vocabulary log) all
  hold word lists in incompatible formats. One list should drive flashcards,
  wall cards, drills, review game questions, and a word search.
  *(A full shared hub was explicitly out of scope for this round. Instead,
  this tool gained `vfg-conjdrill-link.js` — a read-only reader of Vocab &
  Conjugation Drill Generator's saved sets, converting to this tool's own
  `{term, definition, example, pronunciation, partOfSpeech}` shape — and
  that tool gained the mirror-image bridge reading this tool's lists. Copies
  the pattern `025-writing-prompt-generator.html`'s `wpg-rubric-link.js`
  established. See Open Questions below for exactly what does and doesn't
  make the trip.)*
- **Projected whole-class review mode.** Flip through the deck on the board —
  term, pause, definition — with shuffle and a "missed it" pile the teacher
  taps, producing a reteach list at the end. The existing quiz preview is
  most of the way there.
- **Partially done — 2026-08-13.** **More printable formats from the same
  list**: a word search, a crossword, a matching worksheet, a bingo card set
  **(shipped this round — see Status)**, plus a Frayer model page per word
  **(not attempted — the backlog row that scoped this round named only the
  four that shipped)**.
- **Word wall as a system**, not a print job — cards sized and coloured by
  unit, with a printable index of which words are up, and an easy way to
  retire a unit's words and add the next.
- **Text-to-speech on the study mode** (P7 — the conjugation drill already
  has it).

#### Moonshot / North Star

**One word list, a whole unit of vocabulary instruction.** Paste the terms
once and get: cut-apart flashcards that print correctly on any printer, word
wall cards sized for the room, a Frayer model page per word, a word search and
a crossword for the warm-up, a matching quiz with a key, review game
questions, and a projected whole-class review round that hands you a reteach
list at the end — all offline, all free, all from one paste.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student study decks on their own devices**, with self-testing and spaced
  repetition. This is how students actually use flashcards now, and it is
  still out of scope. Printed cards and the projected class review above are
  the teacher-facing equivalents.

#### Open Questions

- Which tool should own the shared vocabulary store — this one, the
  conjugation drill, or a new small "word lists" hub in the way
  `006-class-roster-hub.html` owns rosters? The hub pattern is probably right.
### Where the next round should pick up (after the share round)

- **Image on a card** is still the oldest deferred Quick Win, and it now has a
  second consequence: a base64 image would blow past what a `?deck=` URL can
  carry, let alone a QR. Whoever builds it should decide up front whether
  images travel in a share link at all (probably not — share the words, note
  that pictures stay behind) rather than discovering it after the fact.
- ~~**More printable formats from the same list** (word search, crossword,
  bingo, matching quiz, Frayer page) is the biggest remaining Major Feature
  and is still untouched.~~ **Done, 2026-08-13, except the Frayer page** —
  word search, crossword, bingo, and matching quiz shipped; see Status for
  the crossword's greedy-placement tradeoff. The Frayer model page (one
  four-quadrant page per word: term, definition, example, non-example/
  picture) is the one piece of this Major Feature still untouched — it's a
  per-word page layout, not a puzzle-generation problem, so it doesn't need
  `vfg-printables.js`'s seeded-RNG/placement machinery at all; it's closer in
  shape to `wallCardHtml`/`buildWallPages` (one page or quadrant per item)
  than to anything built this round.
- The share payload is versioned (`v: 1`) but nothing reads that field yet.
  A future shape change should branch on it rather than guessing. (This
  round added `bingoCount`/`bingoField` to the payload under the same v1
  shape rather than bumping the version — they're two more optional fields
  `normalizeIncomingList` already defaults for older payloads, the same
  pattern every prior round's new fields used.)

#### Platform themes that matter here

- **P7 (cross-tool)** — the shared vocabulary store, and formats that feed the
  review game and drill tools.
- **P6 (print quality)** — double-sided alignment, cut lines, and card stock
  sizes are this tool's core craft.
- **P3 (share links)** — **done:** Copy link / QR code in the toolbar, received
  as a new saved list.
- **P12 (storage)** — if images are added to cards.

### 041 — Formula Reference Sheet Builder

*`Tools/041-formula-sheet-builder.html`.*

#### Quick Wins

- **Skipped — deferred.** **Real math rendering.** Formulas are currently text. Even a small
  local subset renderer — superscripts, subscripts, fractions, radicals,
  Greek letters — would transform how the output looks. A vendored KaTeX
  build would be the complete answer and stays within the offline rule (P5)
  as long as it's bundled, not CDN-loaded. *(Not part of this round's scoped
  list — a genuinely separate effort; see Open Questions for the
  KaTeX-vs-hand-rolled tradeoff, still unresolved.)*

#### Major Features

- **Skipped — deferred.** **Printed scaffolding variants of the same sheet** (teacher-generated, given
  out on paper — not a student-operated feature). A blank version where the
  student fills in the formulas, a partially-blank version, and a full
  version — generated from one source. This is the standard scaffolding
  progression and it's three print modes over the same data. *(Not attempted
  this round.)*
- **Skipped — deferred.** **Allowed-on-the-test sheet.** Mark which formulas are permitted on an
  assessment and print exactly that subset with a header saying so — the most
  common real reason this sheet gets made. *(Not attempted this round.)*
- **Partially done.** **A shipped library worth having.** Middle and high school math, physics,
  chemistry, plus unit conversions and geometry area/volume. The
  this backlog entry for a Unit Conversion Chart Builder is really a
  request for this library to exist. *(The formula picker above makes the
  existing five math templates browsable, but no new subject content was
  added — the library itself is exactly as big as it was.)*
- **Skipped — deferred.** **Interactive mode for the projector.** Tap a formula to see it solved for
  each variable, or plug in numbers and see the result, at a size the room
  can read — a teacher-driven demonstration surface rather than a static
  sheet. *(Not attempted this round.)*
- **Skipped — deferred.** **Subject packs beyond math**: chemistry (polyatomic ions, solubility
  rules), physics (kinematics, circuits), grammar (parts of speech reference),
  world language (verb endings). The engine is subject-agnostic; only the
  content is math today. *(Not attempted this round — the picker and the
  new per-item fields make this cheaper whenever someone does take it on,
  since the display/print machinery no longer needs to change, only the
  content.)*

#### Moonshot / North Star

**Any reference sheet a class needs, properly typeset, in three minutes.**
Browse a real library or type your own, get correct mathematical typesetting,
auto-fit to the page, and print the full version for the wall, the blank
version for the students to build, and the allowed-subset version for the
test — from one source, offline, free.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Interactive reference on a student device** via a share link. The
  projector-driven interactive mode above covers the demonstration case.

#### Open Questions

- Is vendoring KaTeX (a few hundred KB) acceptable given the site's
  single-file-tool ethos? A minimal hand-rolled renderer covering fractions,
  exponents, roots, and Greek would be much smaller and cover most of what a
  middle school sheet needs.
- Should the formula library be shared with `026-math-drill-generator.html` and a
  future unit-conversion tool rather than living only here?

#### Platform themes that matter here

- **P5 (offline integrity)** — if a math renderer is added, it must be
  vendored, not CDN-loaded.
- **P6 (print quality)** — auto-fit to exactly one page is the core print
  problem here.
- **P12 (storage)** — per-item images base64'd into `localStorage`.
- **P15 (first run)** — templates are good; a browsable library is better.

### 042 — Certificate & Award Maker

*`Tools/042-certificate-award-maker.html`.*

#### Major Features

- **Skipped — deferred.** **Award tracking across the year.** Who has received what, so the same three
  students don't get everything and so "perfect attendance, Q1–Q4" is
  computable rather than remembered. Pairs naturally with
  `008-behavior-points-tracker.html` and `033-ssr-log-tracker.html`, both of which
  already know who has earned something (P7).
- **Skipped — deferred.** **Data-driven batch generation.** Pull from another tool: everyone above a
  reading-goal threshold, everyone with a positive behavior trend, everyone
  who finished the novel study — and generate that certificate set in one pass.
- **Skipped — deferred.** **A real template system.** Templates as data (fonts, layout boxes, border,
  colours) rather than code, so a new design is a small JSON object. This
  makes seasonal and subject-specific designs cheap, and would let a teacher
  build their own. *(This round's three new templates are still code, just
  with a configurable kicker string — a real step toward this would be
  layout-as-data, not layout-as-markup.)*
- **Skipped — deferred.** **Full-page design surface.** Drag text blocks, resize, choose fonts — the
  step from "fill in five fields" to "make the certificate look how I want."
- **Skipped — deferred.** **Postcards and notes home.** Same engine, different output: a printable
  postcard with a positive message, addressed and ready to mail, which is one
  of the highest-impact and lowest-adoption things a teacher can do.
  *("Good News Note Home" template is a small down payment on this — same
  certificate layout with different phrasing, not the postcard-specific
  layout/addressing this item actually describes.)*

#### Moonshot / North Star

**Recognition at scale, personal at the point of delivery.** Print thirty
certificates that each say something true and specific about that student,
assembled from what the toolkit already knows about the year, in the time it
currently takes to print thirty identical ones. Plus a design surface good
enough that the result doesn't look like a form.

#### Open Questions

- ~~The shipped alignment guides mark the certificate's own edges, not a
  computed safe area inset from the paper edge.~~ **Answered in Round 3:**
  built, as a stock-border inset in inches that moves the guides *and* the
  content. What is still not modelled is stock with an *asymmetric* border
  (a wide decorative band down one side only) — the inset is one value for
  all four edges. Worth four separate fields only if someone actually owns
  that paper.
- Should the decorative border SVG switch itself off when a stock border is
  set? Printing a drawn border inside a pre-printed one is almost never what
  a teacher wants, but silently changing their chosen border is worse than a
  hint — right now the tool says nothing.
- Is there interest in shipping a small set of licensed-clear decorative
  fonts, or should the tool stay with system fonts for reliability?
- Should the QR code on a certificate point at anything in particular
  (a shareable link, a portfolio), or is it currently a solution looking for
  a problem?

#### Platform themes that matter here

- **P2 (shared roster)** — **addressed 2026-08-10**: batch mode now reads
  `np_rosters` via a roster-select + Load button.
- **P6 (print quality)** — margins, bleed, and pre-printed stock alignment
  matter more here than anywhere else on the site. Orientation/2-per-page,
  corner alignment guides, and (Round 3) a real inch-accurate safe-area inset
  for bordered stock have all landed.
- **P12 (storage)** — the uploaded logo and (as of 2026-08-11) the uploaded
  signature image are both base64 in `localStorage`; both go through
  downscaling (`cam-logo.js`'s `CertificateLogo.downscaleImage`, capped at
  200px), but neither has a visible storage-usage warning yet.
- **P13 (import surfaces)** — **addressed 2026-08-10**: two-column
  name/reason paste (tab or comma) via the rewritten `batchEntriesList()`.

### 043 — Field Trip Permission Slip Generator

*`Tools/043-field-trip-permission-slip.html`.*

#### Quick Wins

- **Skipped — deferred.** **A second language version** of the same slip, printed together — the
  single most-requested thing about permission slips in most districts.
- **Skipped — deliberately.** **Medical/allergy line** pulled from nothing sensitive by default, but with
  a clearly-marked optional field, since it's the thing that has to be on the
  trip day printout. *(The doc calls this out as needing an explicit
  maintainer decision before it's built — not added unilaterally. See Open
  Questions.)*

#### Major Features

- **Skipped — deferred.** **The whole trip packet, not just the slip.** A trip needs: the permission
  slip, a parent information letter, the roster grouped by chaperone, an
  emergency contact sheet, a headcount checklist for the bus, name tags, and a
  schedule for the day. Every one of those is printable from the same data.
  This is a straightforward expansion with a large payoff (P7). *(The
  chaperone-grouped roster and the missing list are now printable — two of
  the several pieces this item describes. The parent letter, emergency
  sheet, headcount checklist, name tags, and day schedule are still
  unbuilt.)*
- **Skipped — deferred.** **Trip-day mode.** A projector/phone view: the headcount, the groups, the
  schedule, the "who's on the bus" checklist, and emergency numbers — usable
  while standing in a parking lot.
- **Skipped — deferred.** **Multi-section trips.** A grade-level trip spans several teachers'
  rosters; merging them and splitting into buses/groups is currently manual.
- **Skipped — deferred.** **Year-over-year reuse that actually works** (P14). "Same trip as last year,
  new dates, new roster" should be two clicks.

#### Moonshot / North Star

**Every piece of paper a field trip needs, from one form, twice a year.** Fill
in the trip once; print the slips (in two languages), the parent letter, the
chaperone groups, the emergency sheet, and the bus checklist; scan returned
slips to tick them off; carry the trip-day view on a phone; and roll the whole
thing forward to next year's dates in two clicks.

#### Open Questions

- **Resolved 2026-08-10, for this round only.** How much student
  medical/dietary information should this tool ever hold? It's genuinely
  needed on trip day and it's the most sensitive data the site would touch —
  worth an explicit decision and a very visible erase control. — This round's
  answer was "none": no medical/allergy/dietary field, storage key, or UI was
  added, deliberately, per the task's own instruction that this needs a
  maintainer decision rather than a unilateral addition. The underlying
  policy question (should this tool *ever* hold it, and with what erase
  control) is still genuinely open for a human to decide.
- Does the district have a mandated slip format that should be a shipped
  template?

#### Platform themes that matter here

- **P2 (shared roster)** — already reads `np_rosters`; multi-section merging
  is the next step.
- **P6 (print quality)** — a slip that gets cut, signed, and returned has
  real physical requirements (tear line, signature space, a stub the family
  keeps). The new missing-list and reminder-slip printables were sized with
  this in mind (a 4.25in pocket list, a half-sheet reminder) but weren't put
  through an actual print test on paper this round.
- **P14 (year lifecycle)** — trips repeat annually; this is the clearest case
  for rollover.
- **P7 (cross-tool)** — **addressed 2026-08-11** for `.ics` generation, and
  **addressed 2026-08-13** for QR scanning: `_shared/qr-scan.js` +
  `_shared/vendor/jsqr/jsqr.js` (already shared by `016-qr-code-generator.html`)
  are now wired up here too, not just generating a QR with the shared encoder
  but decoding one back with the shared scanner.

### 044 — Sub Plan Builder

*`Tools/044-Sub Plan Builder.html`.*

#### Quick Wins

- **Skipped — deferred.** **Seating chart and roster references by name**, so the sub plan says
  "seating chart attached" and the Sub Binder actually attaches it (P7).
  *(Out of scope for this round; Sub Binder Generator still only reads the
  seating chart independently rather than this tool naming a specific
  section.)*
- **Skipped — deferred.** **Print-first parity.** The .docx and the printed PDF should be the same
  document; today they're two rendering paths that can drift. *(Still two
  independently-coded renderers — `buildPlainTextForDay` for quick-copy/print,
  `buildDayParas` for the .docx — that were extended in parallel this round
  and produce equivalent content, but there's no single shared model backing
  both yet.)*

#### Major Features

- **Partially done.** **Templates by day type.** A lesson-day plan, a testing-day plan, a
  video-day plan, an emergency no-notice plan. The emergency one is the
  killer feature: a permanently-maintained generic plan that works for any
  day of the year, printed and left in a drawer. *(Shipped 2026-08-11: a
  per-day "Day type" select and an "Insert template" button that fill
  Overview/Schedule/Materials with generic content for Testing / Video /
  Emergency, confirm-gated so it can't overwrite work silently. Still open:
  richer per-type scaffolding beyond generic text, and any district/subject-
  specific variants.)*
- **Skipped — deferred.** **Pull the lesson from elsewhere** (P7). If the School Calendar Visualizer
  knows what unit you're in and the Exit Ticket / Number Talks banks have
  routines, the plan can be 70% drafted before you type anything. *(This
  round built the handoff in the other direction instead — Sub Binder
  Generator now pulls this tool's saved plan by date — but this tool itself
  still doesn't read the calendar or any routine bank to pre-fill anything.)*
- **Skipped — deferred.** **Sub feedback loop.** Generate the plan *and* a one-page feedback slip the
  sub fills in — already on this backlog as its own tool, but it belongs
  in the same document.
- **Skipped — deferred.** **Shareable link / QR of the plan** (P3) so a plan can reach a colleague or
  the office without email.
- **Skipped — deferred.** **Standing-details versioning** (P8) so a mid-year room change doesn't
  silently invalidate a plan generated in September.

#### Moonshot / North Star

**The absence packet, done in ninety seconds while sick.** One screen: pick
the dates, confirm what's already known (schedule, emergency info, seating
charts, class lists, standing routines), type or pick the lesson, and get a
complete printable packet plus a .docx plus a link — with the seating chart,
class rosters, hall pass procedure, and behavior plan already inside, and a
feedback slip on the back. The Sub Binder Generator is the beginning of this;
this tool should be its front door.

#### Open Questions

- **Resolved 2026-08-10 (for now).** Should Sub Binder Generator be absorbed
  into this tool, or should this tool become the editor and Sub Binder stay
  the assembler? — Went with the latter, explicitly, for this round: this
  tool authors the day's lesson and standing details; Sub Binder Generator
  assembles the printable packet, reading this tool's history/standing-details
  storage rather than duplicating any of it. They're linked by matching
  dates (`subPlanBuilder.lastAbsence.v1` for "which day," `subPlanBuilder.
  history.v1` for "what's the plan for that day") instead of a merge. Whether
  that split holds up as more sources get added to Sub Binder is still an
  open question — see that tool's Open Questions.
- Is .docx still the right primary output, or has PDF overtaken it for how
  these actually get delivered to the office? *(Still open — not addressed
  this round.)*

#### Platform themes that matter here

- **P5 (offline integrity)** — the cdnjs JSZip dependency is a real bug here
  more than anywhere else on the site, given when this tool gets used.
- **P7 (cross-tool bundles)** — this tool and `045-sub-binder-generator.html` are
  two halves of one workflow and should be designed together.
- **P6 (print quality)** — the printed page is handed to a stranger; it has
  the highest legibility bar on the site.
- **P14 (year lifecycle)** — standing details are annual and should roll over.

### 045 — Sub Binder / Day Bundle Generator

*`Tools/045-sub-binder-generator.html`.*

#### Major Features

- **Skipped — deferred.** **Become the toolkit's general packet assembler** (P7). The sub binder is
  one instance of a broader idea: pick a date and a set of tools, and print
  everything relevant. The same engine could produce a unit packet, an
  open-house packet, a new-student welcome packet, or a field trip packet.
  *(This round's section-config array (`SECTION_ORDER`/`SECTION_EVAL`, one
  eval+render pair per source) is a step toward this shape, but it's still
  hard-coded to the eight sub-binder-specific sources, not a generic engine.)*
- **Skipped — deferred.** **A documented handoff interface** (P8). Right now this tool reads other
  tools' raw storage keys, which is fast and brittle — any schema change
  elsewhere breaks this silently. A small shared read API ("give me your
  printable summary for date X") would let tools opt in properly and would
  make new bundles cheap. *(This round went the other way under time
  pressure — added three more direct key reads instead of building the
  interface first. See Open Questions: the brittleness this bullet warns
  about is measurably larger now (six tools' raw storage read directly,
  up from three) than when this file was first written.)*
- **Skipped — deferred.** **Emergency sub plan.** A permanently-maintained generic packet that works
  on any day, printed once and left in a drawer — the single most valuable
  version of this tool, and mostly a template plus a reminder to refresh it.
- **Skipped — deferred.** **Feedback slip.** Print a page the sub fills in before leaving
  (this backlog lists this as its own tool; it belongs on the back of
  this packet).
- **Skipped — deferred.** **Digital handoff.** A link or QR (P3) so the sub can open the packet on
  their phone, rather than needing a printout that requires you to be at
  school to produce.

#### Moonshot / North Star

**One button, at 6:40am, sick.** Pick the dates. The toolkit assembles
everything it already knows — standing details, bell schedule, rosters,
seating charts by period, hall pass procedure, behavior plan, emergency
information, today's calendar, the lesson, and a feedback slip — into an
ordered, cover-paged, page-numbered packet, printed or sent as a link, with a
clear list of anything it couldn't find.

#### Open Questions

- Should the packet assembler be generalized into its own thing, with "sub
  binder" as one preset? That's the larger of the two possible futures here.
  *(Still open. This round's per-section eval/render pairs are a small step
  toward it but weren't written as a reusable engine.)*
- **Still due, 2026-08-11.** This round (multi-day bundles) didn't touch the
  interface question either — it composes the same six raw-key reads across
  multiple dates rather than adding a seventh source, so the brittleness
  count didn't grow, but it also didn't shrink. The P8 interface is now due
  for two consecutive rounds; a third round that adds a new source instead
  of addressing it should think hard about whether that's still the right
  call.

#### Platform themes that matter here

- **P7 (cross-tool bundles)** — this tool is the theme's reference
  implementation and its natural home.
- **P8 (versioning/handoff)** — direct key reads are the fragility to fix.
- **P6 (print quality)** — a multi-source packet is the hardest print job on
  the site.
- **P15 (first run)** — should tell you what it can and can't find rather
  than silently producing a thin packet.

### 046 — Blank Map Generator

*`Tools/046-blank-map-generator.html`.*

#### Quick Wins

**All clear as of Round 12.** Rounds 9–12 worked through this whole list;
the entries are kept below (marked Done) as the record of what shipped
where. New quick wins surfaced by future rounds go here.

#### Major Features

- **Partly done —** **Time-slice maps.** One project, several dated states —
  1783 / 1803 / 1848 — that print as a sequence or animate on screen.
  *(The data half shipped 2026-08-14: several value columns in the paste box
  print as a labelled small-multiple series, one map per column, sharing one
  set of quantile bands and one key so the maps are comparable. What is still
  open is the harder half — several dated states of the **annotations**, so
  a border drawn in 1783 can move in 1803. That needs a per-slice
  labels/lines/regions store, which is a real change to the project model
  rather than a new panel.)*
- **Vector base maps — *phase 1 shipped in Round 13*.** Nine built-in
  base maps (World, six continents, two USA crops) render offline from
  vendored Natural Earth GeoJSON and, because the renderer owns the
  projection, **calibrate themselves** — which is what makes the label
  sets, grid, scale bar and coordinate placement work the moment one
  loads. They go through the existing raster pipeline, so every feature
  works on them unchanged. Still open, and the reason this stays on the
  list: **live vector rendering in the viewer** (the generated map is a
  raster, so zoom quality has a ceiling). **Per-region hit-testing and
  click-to-shade shipped 2026-08-14** in `bmg-hittest.js`, which reuses the
  renderer's own projection so the picking and the picture cannot disagree.
  **Choropleth shipped 2026-08-13** — Round 13's note that
  it needed hit-testing first was wrong: hit-testing turns a *click* into a
  region, and shading from a pasted table never has a click to turn.
- **Projected quiz mode** — *shipped in Round 10* (reveal-next, counter, ✓/✗
  tally, reshuffle, projector text). What's still missing is persistence of
  which labels a class struggled with across sessions, which is the part
  that would actually change reteaching.
No Major Features remain open.

#### Moonshot / North Star

**A social studies map studio that runs on a Chromebook with the wifi off.**
Vector base maps, layered time slices, data-driven shading, student handouts
with answer keys, poster-size tiled printing, and a projected quiz mode for
whole-class review — all offline, all local, all free. There is no product in
this space that is both classroom-appropriate and privacy-respecting; this
tool is already most of the way to being it.

#### Deferred — student-facing (out of scope)

The toolkit is teacher-facing; students are not intended users of this site
(see [Platform themes](#platform-themes-p1p15)). These ideas are recorded because they're natural
extensions of the tool, not because they're queued. **Everything above ranks
above everything here.** Don't pick one of these up ahead of teacher-facing
work, and don't promote one without Devon saying so.

- **Student-device quiz mode.** Hand students a link or QR that opens the map
  in Self-Check Quiz Mode on their own device. The projected version above
  covers the same teaching purpose without putting students on the site.

#### Open Questions

- How much of the geography data (`bmg-geography.js`) should be shipped
  locally versus fetched? Fully local is better offline and bigger.
  Round 13 set a precedent worth reusing: ~670 KB of vendored Natural Earth
  GeoJSON, checked in as data with a provenance README, no build step, and
  added to the service-worker precache. That was a comfortable size; the
  next decision point is the 50m world data (~750 KB more) if finer crops
  are wanted.
- **How accurate do the built-in label-set coordinates need to be?**
  *Answered for built-in base maps (Round 13), still open elsewhere.* This
  question guessed right: the fix was not per-projection anchor sets but
  the vector base maps themselves. On a built-in base map the anchors land
  at **0.00 px** error against the projection math (measured on all 50
  states), because the map is drawn in the projection those anchors were
  written for and calibrates itself to it — no dragging, no eyeballed
  calibration, nothing to correct. The anchors stay deliberately
  approximate *as anchors* (a readable spot inside each area, not a
  centroid), which is the right shape for a label. What remains open is
  unchanged and now clearly separable: a Robinson or conic **Commons**
  map will still need dragging, and nothing in phase 1 helps there. The
  honest answer for that case is "use a built-in base map instead", which
  is now a real option rather than advice.
- **Is Wikimedia Commons search reliable enough long-term to be the primary
  map source?** *Answered in practice, not yet in the UI (Round 13).* Two
  consecutive sessions found Commons unreachable from their sandbox, and a
  teacher on school wifi with a filtered connection is in the same
  position — a map source that can simply be absent cannot be the primary
  one. Built-in base maps now cover the common classroom cases (world,
  continents, USA) with better results than search: correctly projected,
  self-calibrating, no licence to check, no results to sift. The strip is
  placed **above** the search box for that reason. What was *not* done is
  demoting Commons any further — it stays a full first-class path, because
  it covers everything the nine presets don't (historical maps, physical
  maps, thematic maps, individual countries) and a teacher who wants a
  specific map should still get one. The open part is whether the search
  card should eventually collapse Commons behind a disclosure; that's a
  judgement about the *card*, not about the data, and it can wait until
  the preset list stops growing.

#### Platform themes that matter here

- **P12 (IndexedDB)** — this tool already solved the problem the rest of the
  site has; `bmg-map-cache.js` is the reference implementation to copy.
- **P6 (print quality)** — tiled poster printing is the site's most advanced
  print feature and worth generalizing.
- **P3 (share links)** — sending a map project to a colleague; student
  handouts are printed, not linked.
- **P11 (undo)** — has undo *and* redo; the only tool that does.
- **P15 (first run)** — "Recently used" is good; a shipped sample project
  would be better.

### 047 — Art Critique Worksheet Generator

*`Tools/047-art-critique-worksheet-generator.html`.*

#### Major Features

- **QR code integration with Gallery Walk QR Codes** — the backlog
  description explicitly calls this tool a pairing with that existing
  tool. A "print worksheet + matching QR sheet together" flow (or at least
  a direct link between the two tools) would deliver on that pairing
  instead of leaving it as a manual two-tool workflow.
- **JSON export/import**, for sharing a built critique worksheet between
  art teachers or across a department.
- **Digital fill-in mode** via a share link (this toolkit's P3 pattern),
  useful for a 1:1 classroom gallery walk where photographing artwork
  digitally makes more sense than a paper half-sheet per station.
- **A rubric-style scoring option** alongside the open-ended critique
  questions, for when a critique doubles as a graded assignment rather than
  a purely formative gallery-walk activity.

#### Moonshot / North Star

**A critique worksheet that pairs naturally with a QR-coded gallery walk,
works equally well as self-reflection or peer critique, and is reusable
across every unit a year of art class covers.** Direct integration with
Gallery Walk QR Codes closes the loop the backlog explicitly asked for;
a self-reflection wording variant covers the "student artwork" case the
peer-critique wording doesn't; and multiple named saves make "the
sculpture-unit worksheet" and "the painting-unit worksheet" both
one click away, every year.

#### Open Questions

- Should the Gallery Walk QR Codes integration be "generate both from one
  screen" (a bigger combined-tool build) or simply "a link/button on each
  tool pointing at the other, plus matching station-numbering conventions"
  (much smaller, still delivers most of the value)?

#### Platform themes that matter here

- **P7 (cross-tool)** — the most direct cross-tool opportunity in this
  entire batch: the backlog description names Gallery Walk QR Codes as a
  pairing, and no integration exists yet.
- **P6 (print quality)** — **fixed here in Round 1** (min-height instead of
  a hard clip). Peer Feedback / Editing Checklist Generator still has the
  same `height: 47vh; overflow: hidden` pattern and would benefit from the
  identical fix — worth a future round doing the same one-line change there.
- **P3 (share links)** — a digital fill-in mode, later.

### 048 — Student Art Portfolio Label & QR Tag Maker

*`Tools/048-art-portfolio-label-maker.html`.*

#### Quick Wins

- **CSV import including a photo column** isn't feasible without file
  paths, but a **bulk "add these students" from a saved roster** (like
  Gallery Walk QR Codes' roster-hub dropdown) would let a teacher
  populate all the titles at once before adding photos and statements one
  at a time.

#### Major Features

- **Photo cropping/rotation** before it's baked into the label, since a
  phone photo uploaded as-is may be sideways or need cropping to the
  artwork itself — today the raw uploaded image prints as-is.
- **Export/import entries as JSON**, so a title/statement list built here
  could be reused as the starting point for a Gallery Walk QR Codes
  gallery (or vice versa) without retyping every title by hand.
- **Print a companion class reference sheet** (title + full statement in
  plain text, one per row) the way Gallery Walk QR Codes prints a
  reference sheet alongside its QR codes — handy for a teacher's own
  binder copy without needing to scan every code.
- **Bulk photo import**: select a whole folder of photos at once and
  match them to existing entries by filename or by upload order, instead
  of clicking "Add photo" once per entry.

#### Moonshot / North Star

**A gallery-quality, zero-setup portfolio labeling workflow that goes
from "roster + a folder of photos" to "a printed sheet of labels" in
under a minute, each one scannable offline for the full artist
statement.** Multiple named portfolios and roster integration close the
gap between this and Gallery Walk QR Codes' more mature save/import
conventions; bulk photo matching and a reference-sheet export are what
would make a whole-class batch genuinely fast instead of one row at a
time.

#### Open Questions

- Is "the QR encodes the statement text directly" the right long-term
  answer, or would a future version of this toolkit's Bulk CSV Roster
  Import Hub (platform-wide idea) eventually make it reasonable to host
  photos somewhere real, at which point the QR could link to an actual
  hosted image instead of just carrying text?
- Should very long statements be silently truncated before encoding (to
  keep the QR code scannable and simple) rather than just warned about,
  trading completeness for a code that's guaranteed easy to scan from a
  few feet away on a bulletin board?

#### Platform themes that matter here

- **P7 (cross-tool)** — this tool and Gallery Walk QR Codes share a
  vendored QR library and near-identical `buildQR`/`drawQR` functions
  copy-pasted between them; **a third QR-based tool now exists**
  (Classroom Label Maker, `051-classroom-label-maker.html`, also built
  from the Ideas Backlog this same batch) with its own vendored copy and
  near-identical `buildQR`/`drawQR` — worth promoting into one shared
  `lib/qrcode.js` module referenced by relative path from `Tools/` next
  time any of the three gets touched, rather than a fresh vendored copy
  per tool folder.
- **P12 (data integrity)** — the `&hellip;`-through-`escapeHtml()` bug
  found here is the same shape as four other entity-in-JS-string bugs
  found this round; worth a dedicated sweep across every tool for the
  pattern "an HTML entity written as literal text inside a JS string
  literal" before it causes a real user-visible garbled character.

### 049 — Book Tasting Menu Generator

*`Tools/049-book-tasting-menu-generator.html`.*

#### Quick Wins

- **Reorder books** (drag or up/down buttons) so the print order can match
  a deliberate table arrangement instead of insertion order — also useful
  now for controlling which order genre sections print in, since that's
  currently first-appearance order.

#### Major Features

- **CSV/spreadsheet import** for a whole list of books at once (title,
  author, genre, blurb columns), matching the bulk-import pattern already
  used in Staff Directory Builder and Review Game Board — typing books one
  at a time doesn't scale to a real classroom library cart.
- **QR code per book linking to a longer review/trailer/Goodreads-style
  page**, reusing this toolkit's QR Code Generator pattern, for browsing
  beyond the blurb.
- **Multiple named saved menus** (e.g. "Fall Book Tasting" vs "Spring Book
  Tasting"), matching the multi-save convention used elsewhere in this
  toolkit — right now it's one flat list per browser.
- **A genre-balance check**: warn if one genre dominates the list, useful
  for a teacher trying to build a deliberately varied tasting menu.

#### Moonshot / North Star

**A book tasting that runs itself: genre-grouped like a real menu, covers
visible on the printed page, imported in bulk from a library cart list,
and closing with a response slip that captures what a class actually
picked.** Genre grouping and visible cover art turn this from "a list of
blurbs" into something that actually reads like a menu; bulk import removes
the biggest friction point (retyping an entire cart of books); and a
response slip gives the activity a measurable outcome.

#### Open Questions

- Should cover images be required for the table-tent print mode
  specifically (since visual browsing matters more there than in a
  text-forward menu), with a placeholder/blank spot when no image was
  uploaded, or should tents stay text-only unless an image happens to
  exist? **Still open** — Round 1 just renders the cover when one exists
  and shows nothing when it doesn't, no placeholder.

#### Platform themes that matter here

- **P7 (cross-tool)** — bulk import (Staff Directory Builder pattern) and
  QR-to-review-page (QR Code Generator pattern) are both directly
  transferable.
- **P6 (print quality)** — covers-on-print and genre grouping are pure
  print-layout work on an already-functional base.
- **P15 (first run)** — bulk import is the single highest-leverage
  friction reduction for a teacher setting this up for the first time with
  a real classroom library.

### 050 — Government/Civics Simulation Role Card Generator

*`Tools/050-civics-role-card-generator.html`.*

#### Major Features

- ~~**A scoring/rubric companion** tied to each role type~~ — **shipped
  2026-08-14 (SS demo round 2)** as part of the kit, built into this tool
  rather than handed off to Rubric Builder (034). Whether the two should
  share a rubric format is still an open cross-tool question; the kit's grid
  is deliberately simpler than 034's.
- **A per-simulation roster memory**, so a debate and a mock trial each
  remember which class list they were built for (see the Open Question).

#### Moonshot / North Star

~~**A full simulation kit generator — roles, private case-file details,
assigned student names, and a scoring rubric — built from one screen and
handed out ready to run.**~~ — **reached 2026-08-14 (SS demo round 2).** The
tool prints the agenda, the cards, the case files, the ballots, the rubric
and the reflections from one screen. The next horizon is the other side of
the period: capturing what came back (vote tallies, rubric scores) without
turning this into a gradebook, which the Non-goals have consistently ruled
out. Anything in that direction needs Devon's steer before it is built.

#### Open Questions

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

#### Platform themes that matter here

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

### 051 — Classroom Label Maker (Target Language)

*`Tools/051-classroom-label-maker.html`.*

#### Quick Wins

- **Per-word language override** — right now one language applies to the
  whole list; a classroom sometimes mixes vocabulary from two related
  languages or wants to spot-check a word in a dialect variant.

#### Major Features

- **Voice selection**, not just language code — `speechSynthesis` exposes
  multiple voices per language on most systems (different accents,
  genders), and letting a teacher pick a specific voice (with a live
  preview) would improve pronunciation quality noticeably over the
  browser's default choice for that language code.
- **Bulk QR-sheet printing at scale**: for a whole-classroom labeling
  project (20+ objects), verify and if needed adjust the print layout to
  handle larger lists gracefully across multiple pages (the grid should
  already paginate via normal CSS grid wrapping, but this hasn't been
  stress-tested past a handful of words).
- **Cognates & False Friends Reference List Builder integration** — the
  Ideas Backlog lists that as a separate, related World Language tool;
  sharing the paste-a-vocabulary-list UI pattern (or even letting one
  feed the other) would avoid rebuilding similar input UI twice.
- **Offline-capable pronunciation fallback**: detect when `speechSynthesis`
  has no voice installed for the requested language (common on some
  Android/Chrome OS setups) and show a clear message rather than silently
  speaking in the wrong accent or not at all.

#### Moonshot / North Star

**A classroom label system where every physical object's QR code reliably
speaks the word in a good voice, works the instant the site's real URL is
known, and warns clearly the one time it can't (local file mode).** Voice
selection with a live preview closes the biggest quality gap (browser
default voices vary a lot); a prominent file:// warning turns a silent
failure into an actionable one; and multiple saved lists mean this tool
scales from "a dozen objects in Spanish 1" to "every classroom vocabulary
unit all year," in every language a program teaches.

#### Open Questions

- Is voice selection (not just language code) worth the UI complexity of
  enumerating `speechSynthesis.getVoices()` (which loads asynchronously
  and varies significantly by browser/OS), given the language-code
  approach already produces a functional, if not always ideal-sounding,
  result?
- Should the file:// detection actively disable/grey out the print button
  with an explanation, or is a visible warning (current approach) combined
  with letting the teacher print anyway (e.g. for local reference use
  without QR functionality) the more flexible default? Round 1 kept the
  "warn but don't block" approach — the banner is prominent now, but
  printing is still always allowed.

#### Platform themes that matter here

- **P7 (cross-tool)** — potential overlap with Cognates & False Friends
  Reference List Builder's vocabulary-input UI; reuses the QR-drawing
  pattern already established across Gallery Walk QR Codes, QR Scavenger
  Hunt Builder, and QR Code Generator.
- **P6 (print quality)** — untested at larger word-list sizes; worth a
  deliberate check once real classroom-sized lists (20-40+ objects) are
  tried.
- **P15 (first run)** — the file:// constraint is the single biggest
  first-run trap for this specific tool, more so than most tools in this
  toolkit, precisely because it depends on the site's own hosted identity
  to function at all. **Partially addressed in Round 1** with the
  prominent warning banner; the "print anyway or block it" question below
  is still open.

### 052 — Cognates & False Friends Reference List Builder

*`Tools/052-cognates-false-friends-builder.html`.*

#### Quick Wins

- **Multiple named saved lists**, matching the multi-save convention used
  by most builder tools in this round — one flat pair of lists per browser
  right now, so a "Spanish 1" list and a "Spanish 2 (advanced)" list can't
  coexist.
- **A "quiz me" reveal mode**: show the target word, hide whether it's a
  true cognate or false friend, let students guess before revealing —
  turns the static reference sheet into a quick warm-up activity too.

#### Major Features

- **JSON export/import**, for sharing a built list between language
  teachers on the same team or across levels of the same language.
- **Partial cognates category**: real linguistics distinguishes "false
  friends" (mean something totally different) from "partial cognates"
  (share some but not all meanings) — a third category would be more
  linguistically complete for an advanced class, though it adds
  complexity the current true/false binary avoids.
- **Difficulty/frequency tagging** so a teacher can filter to "the 10 most
  common false friends" for a quick warm-up versus the full reference list
  for study.

#### Moonshot / North Star

**A cognates and false friends library spanning every commonly-taught
language, deep enough to filter by frequency or difficulty, that doubles
as both a static reference sheet and a quick quiz-yourself warm-up.** More
language example sets close the immediate content gap; a quiz mode turns
a passive reference into active practice; and bulk import removes the
friction of building a large list one row at a time.

#### Open Questions

- Is a "partial cognate" third category worth the added conceptual
  complexity for a middle-school audience, or does the simpler true/false
  binary already established here communicate the pedagogically important
  distinction well enough?
- Should quiz mode be built here, or does it belong better as a mode
  within Vocab &amp; Conjugation Drill Generator (an existing tool already
  built around quiz-style vocabulary practice) given the underlying
  interaction (show a word, hide the answer, reveal) is nearly identical?

#### Platform themes that matter here

- **P7 (cross-tool)** — bulk import (Staff Directory Builder pattern) is
  directly transferable; the quiz-me mode echoes this round's other
  reveal-based generators (Daily Editing, Math "Find the Mistake",
  Geography Bee, Cultural Trivia).
- **P15 (first run)** — more starter language sets is the single biggest
  first-run improvement, since only two of the many languages taught in
  U.S. schools currently have example content.

**Where the next round should pick up:** multiple named saved lists is the
remaining Quick Win and matches this round's 047/048/051 selector pattern
directly; the quiz-me reveal mode under Major Features is the highest-
leverage next step after that, and the Open Question below about where it
belongs (here vs. Vocab & Conjugation Drill Generator) should get answered
before building it.

### 053 — Cultural Trivia Card Generator

*`Tools/053-cultural-trivia-card-generator.html`.*

#### Quick Wins

- **More categories for other commonly-taught languages** (e.g. German-
  speaking World, Lusophone/Portuguese-speaking World, Sinophone World) —
  the current 3-category split covers only two of the languages most
  commonly taught in U.S. middle schools; adding more is pure content
  work.
- **More built-in questions per category** — 10 each will repeat with
  regular use, the same gap flagged on other bank-based generators built
  this round.

#### Major Features

- **Direct export/feed into Review Game Board**, which the backlog
  explicitly names as a pairing ("feeding into the Quiz / Review Game
  Board") — Review Game Board already imports Category/Points/Question/
  Answer from a spreadsheet; a one-click "download as .xlsx for Review
  Game Board" button would deliver on that named integration instead of
  leaving it as a manual copy-paste.
- **Difficulty tiers per question** (easy/medium/hard), letting a teacher
  build a review game board with graduated point values straight from
  this bank.
- **Image support per card** (a flag, a landmark photo) for a richer
  printed card, matching the visual richness already built into
  Historical Figure / Country Trading Card Maker.

#### Moonshot / North Star

**A cultural trivia bank deep enough across every commonly-taught
language, exportable in one click straight into a review-game point
board.** The Review Game Board export is the most direct, named
integration opportunity in the entire backlog description — closing that
loop turns "print some cards" into "build today's whole-class review game
from the same content, with no retyping."

#### Open Questions

- Should categories be organized by broad cultural region (current
  approach: Hispanic World, Francophone World, Global Culture) or by
  specific country, given "for whatever language you teach" spans many
  programs with very different needs? Region-level categories are easier
  to maintain as a fixed built-in set; per-country tagging scales better
  but needs many more built-in questions to feel populated per country.
- Is a direct .xlsx export matching Review Game Board's exact expected
  column format worth building now, or does that create a maintenance
  dependency between two tools that would need to stay in sync if either
  one's import/column format changes later?

#### Platform themes that matter here

- **P7 (cross-tool)** — the explicit Review Game Board pairing is the
  standout opportunity; bulk import reuses a pattern proven multiple times
  this round.
- **P6 (print quality)** — image support per card is the main print-
  quality gap versus this round's other card-printing tools.
- **P15 (first run)** — settings persistence is the recurring small gap
  versus sibling generators.

### 054 — Current Events Discussion Guide Generator

*`Tools/054-current-events-discussion-guide-generator.html`.*

#### Major Features

- **A bank of saved "generic" question sets beyond the 6 built-in ones**
  (e.g. a set skewed toward persuasive-writing follow-up, a set skewed
  toward historical-context articles) that a teacher can swap between,
  instead of one fixed list — now two sets exist (general + comparison),
  both still fixed rather than a real bank a teacher could add to.

#### Moonshot / North Star

**A discussion guide that gets smarter about the specific article pasted
in, not just templated around any article.** The honest ceiling for a
static, server-less, no-AI tool is heuristics — better stopword filtering,
reading-level estimates, topic-aware question sets — rather than genuine
summarization or vocabulary judgment. Getting those heuristics as good as
they can get, plus letting a teacher build a personal library of
saved/reusable question sets and past guides, is the realistic "as good as
this gets without a server" version of this tool.

#### Open Questions

- **Is a genuine AI-assisted mode ever in scope for this toolkit?** The
  backlog and README both describe this tool in terms ("summary box,"
  "pull vocabulary") that read as AI-summarization to a teacher, but the
  actual toolkit constraint (GitHub Pages, static hosting, "no data leaves
  your browser") rules out a server-side LLM call by design. Worth deciding
  explicitly whether this tool's ceiling is "as good as heuristics get" or
  whether a future version could optionally call a user-supplied API key
  against a model directly from the browser (still no toolkit-run server,
  but a meaningfully different privacy posture the "nothing leaves your
  browser" framing would need to caveat).
- Is a curated stopword list worth hand-maintaining, or is there a
  reasonably small built-in "top 1000 common English words" list that could
  be vendored once and reused (this tool, and potentially others) instead
  of ad-hoc filtering?

#### Platform themes that matter here

- **P7 (cross-tool)** — the multi-save pattern from Formula Sheet Builder /
  Rubric Builder applies directly; a "question set library" is the same
  shape at a different granularity.
- **P15 (first run)** — live word-count feedback while pasting, and a
  clear/reset button, both reduce first-use friction.

### 055 — Daily Editing / DOL Warm-Up Generator

*`Tools/055-daily-editing-warmup-generator.html`.*

- **Carried over from a closed item.** Settings persistence for worksheet count shipped in Round 2, but **grade-band-appropriate *defaults*** — as opposed to just remembering the last value used — is still open.

#### Quick Wins

- ~~**Settings persistence for worksheet count**~~ — **done, Round 2**
  (grade-band-appropriate *defaults* specifically, as opposed to just
  remembering the last value used, is still open).

#### Major Features

- **Import a whole custom bank from a pasted list** (one broken/fixed pair
  per line, tab- or `|`-separated), matching the bulk-paste pattern already
  used elsewhere in this toolkit (Staff Directory Builder, Review Game
  Board's spreadsheet import) — typing sentences one at a time in the Add
  form doesn't scale past a handful.
- **Difficulty/grade-band tiers** in the built-in bank (elementary vs
  middle vs high school errors), the way Math Fact Drill Sheet Generator
  scales by grade band, instead of one fixed difficulty for everyone.
- **A "why" explanation per correction** (one sentence: "its is possessive,
  it's is a contraction") so the reveal teaches the rule, not just the fix
  — this is the single biggest pedagogical gap versus a plain answer key.
- **Weekly/spiral rotation**: track which sentences have already been shown
  this week/month so "no repeats until everything's been seen" happens
  automatically instead of relying on shuffle alone.

#### Moonshot / North Star

**A DOL bank that teaches the rule, not just the fix, and never repeats
until it's cycled through everything — scoped to exactly the error types a
class needs this week.** Category filters get a teacher to "apostrophes
only" in one click; a why-explanation on each reveal turns "here's the
correct version" into an actual five-minute grammar lesson; and a no-repeat
tracker means daily use for a full year never feels like the same 24
sentences on loop.

#### Open Questions

- Should "hide a built-in sentence" be modeled as a per-sentence toggle
  (adds UI complexity to every built-in row) or as a single "exclude these
  IDs" list a teacher rarely touches? The former is more discoverable; the
  latter is less code.
- Is a why-explanation worth writing for all 24 built-ins as hand-authored
  text, or should it be optional/skippable so the bank doesn't need a
  rule-explanation for every single entry to ship the feature at all?

#### Platform themes that matter here

- **P7 (cross-tool)** — the bulk-import pattern already proven in Staff
  Directory Builder and Review Game Board's spreadsheet import applies
  directly here.
- **P15 (first run)** — category filters and grade-band tiers both reduce
  "is this even the right content for my class" friction on day one.
- **P6 (print quality)** — nothing urgent here; the worksheet/key layout is
  already plain and functional.

### 056 — DBQ / Source Packet Builder

*`Tools/056-dbq-source-packet-builder.html`.*

- **Carried over from a closed item.** The 028 pairing shipped in one direction only (a text source becomes a SOAPSTone worksheet in 028). **The other direction — pulling a source *out* of 028's library into a packet — is still open.**

#### Major Features

- ~~**Direct integration with Primary Source Analysis Worksheet
  Generator**~~ — **done, SS demo round 2 (`vn8trq`)**: a text source
  becomes a full SOAPSTone worksheet in 028 in one click, via 028's own
  share-link format. The remaining half of the pairing is the other
  direction (pull a source *out* of 028's library into a packet).
No Major Features remain open. The clearest remaining work is the reverse
direction of the 028 pairing — see "Where the next round should pick up"
under the 2026-08-14 entry.

#### Moonshot / North Star

**A DBQ packet builder backed by a reusable source library, tightly
integrated with Primary Source Analysis Worksheet Generator, that produces
differentiated packets for the same source set without rebuilding from
scratch for each ability level.** A source library removes the biggest
recurring cost (re-uploading and re-captioning the same historical
documents across units and years); the Primary Source Analysis
Worksheet Generator integration delivers on the backlog's explicit
pairing; and per-source scaffolding turns one packet into several
appropriately-leveled versions without duplicated authoring work.

#### Open Questions

- Should a source library be scoped per-browser (matching this toolkit's
  local-only philosophy) even though that means it can't be shared between
  a teacher's home and school computers, or is that an acceptable
  trade-off given every other tool in this toolkit makes the same choice?
- Is scaffolding/differentiation worth building as a first-class feature
  here, or does it belong as general guidance (a teacher builds two
  separate packets by hand) given how much source-specific judgment
  "simplify this historical document" actually requires?

#### Platform themes that matter here

- **P7 (cross-tool)** — the explicit backlog pairing with Primary Source
  Analysis Worksheet Generator is the clearest opportunity in this tool;
  a source library would also benefit any future tool needing
  reusable historical-document content.
- **P6 (print quality)** — image size/crop control (shipped 2026-08-13)
  mattered here more than most tools, since source images vary enormously
  in size and aspect ratio.
- **P15 (first run)** — a source library reduces the single biggest
  recurring cost of using this tool (finding and uploading the same
  sources again and again).

### 057 — Dichotomous Key Builder

*`Tools/057-dichotomous-key-builder.html`.*

#### Major Features

- **Multiple named saved keys** (e.g. "Animal Kingdom," "Leaf
  Classification"), matching the multi-save convention used by most
  builder tools in this round — right now one key per browser.
- **A visual branching-tree view** as an alternative to the numbered-
  couplet list, for a teacher who wants to see (or show students) the
  key's shape at a glance rather than reading through numbered text.
- **Import a key from a pasted outline** (a simple indented-text or
  tab-separated format), for a teacher porting an existing paper key into
  this tool instead of rebuilding it couplet by couplet.
- **JSON export/import**, for sharing a completed key with another
  science teacher or across sections.

#### Moonshot / North Star

**A dichotomous key builder that catches authoring mistakes before they
reach students, offers both the classic numbered-couplet text and a visual
tree view of the same key, and turns any key into a ready classification
exercise the moment example specimens are tagged.** Validation warnings
prevent the most common authoring error (an unreachable step, or a result
with no test specimens); the tree view makes the key's logic visible at a
glance for both teacher and student; and the worksheet/answer-key
generation already shipped is the foundation for making every key
immediately classroom-usable, not just a reference document.

#### Open Questions

- Is a visual tree view worth the layout complexity (computing branch
  positions, connecting lines) given the numbered-couplet format is both
  the traditional standard for real dichotomous keys and already fully
  functional here?
- Should validation warnings block printing (hard stop until fixed) or
  just flag issues non-blockingly (a warning banner, but printing still
  works)? A hard stop is safer against handing students a broken key; a
  soft warning respects that a teacher might legitimately want to print a
  work-in-progress key for their own reference.

#### Platform themes that matter here

- **P7 (cross-tool)** — pairs conceptually with Blank Map Generator's
  general "build a custom reference tool from teacher-supplied content"
  pattern, though the underlying data structures differ enough that
  sharing code isn't obvious.
- **P6 (print quality)** — the print-without-specimens option and a
  visual tree-view print layout are both pure print-format additions.
- **P15 (first run)** — the seeded 2-step working example (already
  shipped) is the main first-run aid; validation warnings would extend
  that help through the whole authoring process, not just the starting
  point.

### 058 — Duty Roster Builder

*`Tools/058-duty-roster-builder.html`.*

#### Quick Wins

- **Per-staff assignment counts** shown somewhere (e.g. next to the staff
  textarea or as a small summary row) so a teacher can see at a glance
  whether the round-robin (or manual edits afterward) left the load
  balanced — round robin distributes evenly by construction, but any manual
  edit afterward can silently unbalance it with no visibility.
- **"Skip a person this week" flag** per staff member (e.g. someone's out,
  or on a different duty schedule) so auto-fill respects it instead of
  needing every assignment fixed by hand afterward.
- **Multiple weeks/rotations saved**, not just one grid — a real duty
  schedule usually rotates who's on hallway vs. cafeteria week to week, and
  right now there's only one current week's grid.
- **CSV export** for handing the schedule to an administrator who wants it
  outside a browser.

#### Major Features

- **True week-to-week rotation**, not just round-robin-fills-one-week: a
  multi-week rotation where week 2's grid is auto-derived from week 1's
  (shift everyone over one duty), matching the backlog's "rotating" framing
  more literally than a single auto-filled grid does.
- **Duty-location constraints** ("this duty needs 2 people," "this person
  can't do bus loop") — the current model is one person per cell, which
  doesn't match every real duty roster (some locations need multiple staff
  covering at once).
- **Multiple named saved rosters** (e.g. "Fall semester" vs "Spring
  semester," or separate rosters per grade-level team), matching the
  multi-save convention used elsewhere in this toolkit.
- **Print layout for a full month at once**, if multi-week rotation ships,
  instead of one week per print.

#### Moonshot / North Star

**A duty schedule that rotates itself fairly across the whole semester,
respects who's out and who can't cover what, and never needs the same
manual balancing act every single week.** Real multi-week rotation with
skip/unavailability flags turns this from "a grid I fill in once a week"
into "a schedule that mostly runs itself" — the actual promise in the
Ideas Backlog's "rotating" framing.

#### Open Questions

- Should this tool read from Staff Directory Builder's saved list instead
  of (or in addition to) its own paste-in staff textarea, now that both
  tools exist? Sharing avoids re-typing the same names in two places but
  couples two otherwise-independent tools.
- Is round-robin-by-day-then-duty the right default rotation order, or
  should rotation be by-duty-then-day (each duty cycles through the full
  staff list before moving to the next duty)? The two produce visibly
  different weekly patterns and it's not obvious which a real workroom
  actually wants without asking a teacher who currently builds one by hand.

#### Platform themes that matter here

- **P7 (cross-tool)** — the staff list here duplicates effort with Staff
  Directory Builder; sharing that list (rather than re-pasting names into
  two tools) would be a natural follow-up once both tools exist.
- **P6 (print quality)** — a full-month print layout matters more here
  once multi-week rotation ships; a single week's plain table is
  sufficient for now.
- **P15 (first run)** — auto-fill already gets a usable grid in one click;
  skip/unavailability flags would keep that fast even as reality
  (substitutes, part-time staff) complicates it.

### 059 — Scientific Method / Experiment Design Planner

*`Tools/059-experiment-design-planner.html`.*

#### Quick Wins

- **Reorder list items** (controlled variables, materials, procedure
  steps) via up/down buttons, matching the pattern used elsewhere in this
  toolkit — currently delete-and-re-add is the only reordering option.
- **A "does this variable make sense" sanity hint** — e.g. flag if the
  independent and dependent variable fields are identical, a common
  student mistake this guided worksheet could catch before printing.
- **Multiple named saved plans**, matching the multi-save convention used
  by most builder tools in this round — one flat plan per browser right
  now, so back-to-back labs overwrite each other's planning.
- **A subject hint/example toggle**, showing a filled-in example (like
  Lab Report Template Builder's subject templates) as a reference without
  actually populating the student's own fields.

#### Major Features

- **Direct hand-off to Lab Report Template Builder**: export this plan's
  question/hypothesis/materials/procedure and pre-fill a new Lab Report
  Template Builder session with it, so a student's planning work carries
  straight into their post-lab report instead of being retyped. This is
  the single highest-value integration opportunity in this entire round,
  since both tools already exist and are explicitly described as
  companions.
- **A "peer review my plan" mode**: swap plans with a partner before
  running the experiment, with a simple checklist ("is the hypothesis
  testable? are the variables clearly separated?") — reuses this
  toolkit's Peer Feedback / Editing Checklist Generator pattern applied
  to lab planning instead of writing.
- **JSON export/import** for sharing a planning template between science
  teachers on the same team.
- **Safety flag integration**: pull relevant hazard symbols from Science
  Safety Symbol & Equipment Label Maker based on materials entered (e.g.
  typing "acid" surfaces the corrosive hazard reminder) — turns the
  planning stage into a safety checkpoint, not just a logistics form.

#### Moonshot / North Star

**A planning worksheet whose output becomes the report's input, whose
materials list flags its own safety hazards, and whose hypothesis gets a
sanity check before a single measurement is taken.** The direct hand-off
to Lab Report Template Builder is the obvious next step given both tools
already exist in this same toolkit — closing that loop turns "two
separate forms a student fills out" into one continuous, connected
scientific-method workflow.

#### Open Questions

- Should the Lab Report Template Builder hand-off be a one-way export
  (copy planning data into a new report session) or should the two tools
  eventually merge into one multi-stage tool (plan &rarr; run &rarr;
  report) sharing a single saved record? A hand-off is much less work;
  a merged tool is more coherent but a bigger rebuild of both.
- Is a "peer review my plan" checklist worth building as a feature of
  this tool, or does it belong as a template option within Peer Feedback
  / Editing Checklist Generator (which already supports arbitrary
  checklist categories) instead of duplicating checklist-building logic
  here?

#### Platform themes that matter here

- **P7 (cross-tool)** — the Lab Report Template Builder hand-off and
  Science Safety Symbol & Equipment Label Maker integration are both
  direct, high-value opportunities given all three tools now exist in this
  toolkit.
- **P15 (first run)** — a subject-example toggle reduces "what does a
  good hypothesis even look like" friction for a student using this for
  the first time.

### 060 — Fitness & Skill Assessment Tracker

*`Tools/060-fitness-skill-assessment-tracker.html`.*

#### Quick Wins

- **Parse time-type results** (mm:ss or seconds) so average/min/max/"most
  improved" stats work for time events too, not just counts — the single
  biggest functionality gap since two of the three default events (Mile
  Run) are time-based and get no stats today.
- **Per-student trend across two dates**: if the same event name is
  reused across a Fall and Spring entry, show a simple improved/declined
  indicator per student — turns "a snapshot" into "a year of progress."
- **CSV export** of the full results grid, for a gradebook or district PE
  reporting requirement that wants raw numbers, not just a printed table.

#### Major Features

- **Standards/benchmark bands per event** (e.g. Presidential Fitness
  thresholds) so a result cell shows pass/fail or a percentile alongside
  the raw number, not just the raw number.
- **Multiple saved rosters/classes**, matching the multi-save convention
  used by most builder tools in this round — one flat roster per browser
  right now, so a PE teacher with 6 class periods can't keep them
  separate.
- **Retest workflow**: duplicate an existing event as "<name> — Retest"
  in one click, pre-filling nothing but keeping the same type, instead of
  manually adding and renaming a new event every time.
- **Individual student report cards**: a print view that's one page per
  student across all events and dates, instead of only the single
  whole-class grid view, for handing back to students/parents.

#### Moonshot / North Star

**A full-year, standards-aware fitness and skill tracker that turns a
list of numbers into a visible trend per student and per class, with
zero setup beyond pasting a roster.** Time-value parsing and stats close
the biggest functional gap in what exists today; benchmark bands and
trend indicators are what would make this genuinely useful for PE
reporting requirements instead of just a spreadsheet substitute.

#### Open Questions

- Should time-type results be entered as free text (mm:ss, forgiving of
  typos) with parsing/validation on blur, or as two separate minute/second
  number inputs — trading a little more visual complexity for guaranteed-
  parseable data from the start?
- Is per-student report cards a feature that belongs in this tool, or
  would it fit better as a shared "printable report card" pattern reused
  across several data-collecting tools (this one, Science Fair Project
  Tracker, Duty Roster Builder) rather than reimplemented per tool?

#### Platform themes that matter here

- **P7 (cross-tool)** — CSV export and multi-roster support echo patterns
  already proven elsewhere in the toolkit (Staff Directory Builder's bulk
  import, several tools' named-save conventions).
- **P12 (data integrity)** — the full-table-rebuild-on-change bug found
  during this build is a good example of a broader pattern worth a sweep:
  any tool with a "rebuild the whole list/table on every change" listener
  is at risk of destroying in-flight user interaction the same way; worth
  auditing similar tools for the same shape of bug.

### 061 — Fraction–Decimal–Percent Conversion Drill Generator

*`Tools/061-fraction-decimal-percent-drill-generator.html`.*

#### Quick Wins

- **Seeded generation**, matching Math Fact Drill Sheet Generator's
  pattern (a "lock seed" checkbox), so a sheet can be reprinted identically
  for a make-up.
- **Settings persistence** — difficulty, given-form, and row count all
  reset to defaults on every page load, unlike most other drill/generator
  tools in this toolkit.
- **A "show all three, ask which is odd one out" mode** as a quick
  alternate format — a set of rows where two of the three forms are
  correct and one is deliberately wrong, spot-the-error style (natural
  overlap with Math "Find the Mistake" Warm-Up Generator, built earlier in
  this same round).
- **Repeating-decimal notation** (e.g. a bar over repeating digits, or an
  explicit "&hellip;" ellipsis) for hard-tier fractions like thirds and
  sevenths, instead of silently rounding to 3 places with no indication
  that the true value repeats.

#### Major Features

- **Negative number support** — all current values are positive fractions
  between 0 and 1; extending to values above 1 (improper
  fractions/mixed numbers) and negative values would substantially widen
  what this drill can practice.
- **Word-problem wrapping**: this backlog’s broader pattern (word
  problems as a wrapper around numeric drills) applies here too — "a
  recipe calls for 3/4 cup of sugar; what percent of a full cup is that?"
  turns a bare conversion into an applied skill.
- **Per-student targeted practice**: generate a sheet biased toward
  whichever of the three conversion directions (fraction&rarr;decimal vs
  decimal&rarr;percent, etc.) a student has been missing, the same
  longitudinal gap flagged on Math Fact Drill Sheet Generator.
- **A visual model option** (a fraction bar or percent-grid alongside the
  numeric row) for students who need a concrete representation before the
  abstract conversion clicks.

#### Moonshot / North Star

**A conversion drill that scales from "halves and quarters" all the way to
"repeating decimals with proper notation," targets whichever direction a
student actually struggles with, and never hands back an internally
inconsistent answer.** The floating-point consistency fix already shipped
is the foundation that a targeted-practice and repeating-decimal-notation
version would build on — correctness first, then adaptivity.

#### Open Questions

- Is silently rounding repeating decimals (e.g. showing "0.333" for 1/3
  with no repeating-decimal notation) acceptable for a middle-school
  audience, or does correctness here matter enough to add bar notation
  even for an MVP-tier tool?
- Should the "odd one out" mode live here or on Math "Find the Mistake"
  Warm-Up Generator, given both tools would implement essentially the same
  interaction (spot a deliberately wrong value) just with different
  underlying content?

#### Platform themes that matter here

- **P7 (cross-tool)** — the "odd one out" spot-the-error mode is a direct
  crossover with Math "Find the Mistake" Warm-Up Generator's established
  pattern from earlier in this round.
- **P15 (first run)** — settings persistence is the most obvious first-run
  gap versus sibling generators in this toolkit.

### 062 — Geography Bee / Map Skills Quiz Generator

*`Tools/062-geography-bee-quiz-generator.html`.*

#### Quick Wins

No Quick Wins remain open as of this round. A future round should look to
Major Features below, or find a genuinely new gap.

#### Major Features

- **Buzz-in from student devices** — the tournament's natural next step, and
  the explicit non-goal of round 2. `_shared/` already has the WebRTC pairing
  layer that 021 and 004 use, so this needs no server.
- **A timed "bee" mode**: sudden-death elimination format with a visible
  countdown per question, matching how an actual geography bee competition
  runs (as opposed to the current self-paced practice format).

#### Moonshot / North Star

**A geography practice bank deep enough to run an actual competitive bee
(timed, elimination-format, region-filterable) that also connects directly
to Blank Map Generator so a question about a place shows that place.** The
Blank Map Generator integration is the single most on-brief improvement
given the backlog explicitly frames this tool as its "quiz-format
companion" — right now the two tools have no connection beyond a shared
theme.

#### Open Questions

- Is a timed competitive-bee mode worth building as a mode within this
  tool, or does the self-paced practice format already cover the more
  common classroom use case (individual/small-group practice) well enough
  that a full competition mode is lower priority than more content? Round 2
  narrowed this: the team tournament covers "run it as a game" without any
  timing, so what's actually left open is whether *timing* adds anything a
  teacher wants, not whether competition does.
- Should map questions be able to run in reverse — "shade in Egypt on this
  blank map" — or is that a Blank Map Generator worksheet that belongs in
  046 rather than here? Worth a backlog row before anyone builds it.

#### Platform themes that matter here

- **P7 (cross-tool)** — the explicit Blank Map Generator pairing is the
  clearest opportunity in this tool; bulk import (Staff Directory Builder,
  Review Game Board) is a second, smaller one.
- **P15 (first run)** — settings persistence is the most obvious first-run
  gap versus sibling generators built earlier in this round.

### 063 — Grammar Mad Libs Generator

*`Tools/063-grammar-mad-libs-generator.html`.*

#### Major Features

- **Multiple named saved custom stories**, matching the multi-save
  convention used elsewhere in this toolkit, once custom stories persist
  at all.
- **A guided "pick one word of each type" flow** for actually playing Mad
  Libs as a class activity (not just generating a worksheet) — ask for a
  noun, then an adjective, etc., one at a time, building suspense the way
  the game is traditionally played out loud, then reveal the finished
  story.
- **JSON export/import** for a built custom story + its word choices, so
  a particularly good one can be shared between teachers.

#### Moonshot / North Star

**A Mad Libs generator deep enough in templates and word banks that it
doubles as vocabulary practice, played the traditional out-loud way (ask
for each word, then reveal) instead of just producing a worksheet.** The
guided one-word-at-a-time flow is the biggest gap between "generates a
fill-in-the-blank sheet" and "actually plays Mad Libs with a class," and
curriculum-tied word banks turn a novelty activity into something with
real vocabulary-reinforcement value.

#### Open Questions

- Is the guided "ask for each word, then reveal" play mode worth building
  as a third mode alongside Preview and Print, or does it belong as a
  separate lightweight tool given how different its interaction model
  (one word at a time, suspense-driven) is from the current
  generate-then-print flow?
- Should custom word-bank additions be per-story (saved with that specific
  custom story) or global (shared across every template), given a teacher
  might want "space vocabulary" words available for several different
  stories at once?

#### Platform themes that matter here

- **P15 (first run)** — a visible tag reference and persisted custom
  stories both remove real first-use friction.
- **P7 (cross-tool)** — curriculum-tied word banks could pull from the
  same vocabulary lists Vocabulary Flashcard & Word Wall Generator already
  manages, instead of maintaining a separate word list per tool.

### 064 — Historical Figure / Country Trading Card Maker

*`Tools/064-historical-trading-card-maker.html`.*

#### Quick Wins

No Quick Wins remain open.

#### Major Features

- **A student-facing fill-in mode** via a share link — right now the share
  link this round shipped is teacher-to-teacher (a whole deck, read/write
  on arrival, saved as a new deck). A true per-student mode — a link to one
  blank card, identified by deck + name, that a student fills in and hands
  back — is a different shape: it would need some way for the filled-in
  card to return to the teacher (there's no server here), which the deck
  link's "just open it and it's yours" model doesn't solve. Worth scoping
  as its own round rather than folding into deck-sharing.
- **Flag/photo library integration** for countries specifically (the
  backlog explicitly covers both historical figures and countries) — a
  small built-in flag-image picker for common countries would remove the
  need to hunt down and upload a flag image by hand.

#### Moonshot / North Star

**A trading-card set built collaboratively by a whole class researching
different figures or countries, printed with reliable automatic
front-to-back duplex alignment, and pulled from a small built-in flag
library for the country half of the idea.** Row-mirrored duplex closes the
print-quality gap versus this toolkit's own Vocabulary Flashcard
Generator; a student-facing share-link fill-in mode turns "one teacher
typing everyone's research" into "a class collaboratively building the
deck"; and a flag library removes the most repetitive manual step for the
country-card use case specifically.

#### Open Questions

- Is a small built-in flag image library (a fixed set of common countries)
  worth maintaining as static assets in this repo, or does that risk
  scope creep/staleness (new countries, disputed flags, political
  sensitivity) that's better left to "the teacher uploads their own
  flag image" as the tool already supports?

#### Platform themes that matter here

- **P6 (print quality)** — the duplex-alignment gap versus Vocabulary
  Flashcard & Word Wall Generator is the clearest, most concrete
  print-quality improvement available in this entire round, since a
  working reference implementation already exists in this same toolkit.
- **P3 (share links)** — the teacher-to-teacher deck link/QR shipped this
  round (state-link.js + vendor qrcode.js, same pattern as 028). A
  student-facing fill-in mode (one card, not a whole deck, with some way
  for the filled-in result to get back to the teacher) is the natural next
  extension for a whole-class research project — see Major Features.
- **P7 (cross-tool)** — reusing `VocabLayout.mirrorPageRows` (or
  extracting it into a small shared module both tools can use) avoids
  re-implementing duplex mirroring from scratch a second time.

### 065 — Lab Report Template Builder

*`Tools/065-lab-report-template-builder.html`.*

#### Quick Wins

All four from the previous round shipped this round — see Status above.
Nothing queued here right now; the next round should look at Major
Features below.

#### Major Features

- **JSON export/import**, so a built lab template can be shared between
  teachers on the same team/PLC, or backed up before a school year ends.
- **A pre/post-lab split**: a shorter "planning" packet (hypothesis,
  materials, procedure only) for the day before the lab, and a "report"
  packet (data, observations, conclusion) for after — instead of one packet
  covering both, which the backlog idea explicitly calls out as this tool's
  planning-stage sibling ("Scientific Method / Experiment Design Planner"
  is a separate backlog idea that overlaps here).
- **Safety symbol integration**: pull relevant hazard icons into the
  Materials section automatically based on keywords (matches the backlog's
  separate Science Safety Symbol & Equipment Label Maker idea — could share
  an icon set rather than duplicating one).
- **A data table with real column types** (numeric vs. text vs. units row)
  instead of a fully blank grid, so students see the expected unit/format
  before they start recording data.

#### Moonshot / North Star

**One lab template that carries a class from the planning packet through
the completed report, reusable across sections and years, with safety
information built in rather than bolted on separately.** Multiple named
saves mean every unit's lab template survives to next year without
rebuilding; a pre/post split matches how labs are actually run across two
class periods; and shared safety-icon data means updating a hazard doesn't
mean updating two different tools.

#### Open Questions

- Should the Scientific Method / Experiment Design Planner backlog idea be
  built as a "planning packet" export mode on this same tool (reusing the
  hypothesis/materials/procedure sections), or does it deserve its own
  entry point since a planning worksheet's audience (pre-lab) differs from
  a report packet's (post-lab)?
- Is per-column data typing (numeric/text/unit) worth the added UI
  complexity, or does a plain blank grid stay the right default given most
  data tables in a middle-school lab are simple enough not to need it?

#### Platform themes that matter here

- **P7 (cross-tool)** — direct overlap with the backlog's Scientific
  Method / Experiment Design Planner and Science Safety Symbol & Equipment
  Label Maker ideas; worth deciding whether those become modes here or
  stay separate tools before either gets built.
- **P6 (print quality)** — a print preview matters more here than on most
  tools in this toolkit, since a bad data-table row count or column width
  wastes a page of the packet, not just a line.
- **P15 (first run)** — named saved templates would make "start of next
  year" nearly instant if it's the same lab.

### 066 — Math "Find the Mistake" Warm-Up Generator

*`Tools/066-math-find-the-mistake-generator.html`.*

#### Major Features

- **Bulk import a custom bank** from a pasted list (problem | work | fix |
  explain, tab- or `|`-separated), matching the bulk-import pattern already
  proven in Staff Directory Builder and Review Game Board — typing one
  problem at a time in the Add form doesn't scale past a handful.
- **Fraction/decimal/percent overlap with the sibling backlog idea**:
  this backlog separately lists a Fraction&ndash;Decimal&ndash;Percent
  Conversion Drill Generator (building next in this round). Some of this
  tool's fraction/percent mistake-problems could share number-generation
  logic with that tool rather than being hand-authored one at a time.
- **A "student picks the wrong step" interactive mode** — instead of just
  revealing the fix, let a student click on which line of the worked
  solution contains the error before revealing, turning passive viewing
  into an active response (a natural fit for this toolkit's P3 share-link
  on-screen-practice pattern).
- **Difficulty/spiral tracking**: which problems a class has already seen,
  so daily use doesn't repeat the same 15 problems on a loop — the same
  longitudinal gap flagged for Math Fact Drill Sheet Generator and Daily
  Editing / DOL Warm-Up Generator.

#### Moonshot / North Star

**A "find the mistake" bank deep and well-tagged enough that a teacher can
pull exactly the error type their class is struggling with, in the format
that gets students actively hunting for the error rather than passively
reading the reveal.** Category filters get the right problem in front of
the right class; an interactive "click the wrong step" mode turns a
one-click reveal into real error-analysis practice; and bulk import means
a teacher's own hand-written trick questions can join the bank in minutes,
not one form submission at a time.

#### Open Questions

- Should the interactive "click the wrong step" mode replace the current
  reveal-everything button, or exist as an alternate mode alongside it?
  Some warm-ups want speed (reveal immediately), others want the class to
  actively hunt first.
- Is sharing number-generation logic with the upcoming
  Fraction&ndash;Decimal&ndash;Percent Conversion Drill Generator worth the
  coupling between two otherwise-independent tools, or is hand-authoring a
  fixed set of mistake-problems (as done here) simpler to reason about and
  maintain even if it means some duplicated effort?

#### Platform themes that matter here

- **P7 (cross-tool)** — bulk import (Staff Directory Builder, Review Game
  Board) and the fraction/decimal/percent overlap with this round's next
  tool are both direct opportunities.
- **P3 (share links)** — the "click the wrong step" interactive mode is
  this toolkit's on-screen-practice pattern applied to error analysis.
- **P15 (first run)** — category filters and grade-band scoping both
  reduce "is this even the right content for my class" friction, matching
  the same open item on Daily Editing / DOL Warm-Up Generator.

### 067 — Music Sight-Reading / Rhythm Warm-Up Generator

*`Tools/067-music-sightreading-generator.html`.*

#### Major Features

- **Accidentals and key signatures**: today's pitch generator is
  natural-notes-only; adding a key signature selector (with the correct
  sharps/flats drawn at the clef) and/or a "chromatic" toggle would make
  this useful for more advanced ensembles, not just a beginner diatonic
  warm-up.
- **Hand-drawn SVG clefs.** Round 3 drew the four rhythm values and made
  drawn notation switchable, so the only remaining font dependency is the
  treble and bass clef on the sight-reading staff, which currently falls back
  to the words TREBLE / BASS. Real clef paths would close it out.
- **Combined rhythm + pitch mode**: play the sight-reading notes in the
  rhythm generated alongside them (durations assigned per note) for a
  true melodic sight-reading drill instead of two separate, unrelated
  warm-ups.
- **Audio playback**: a Web Audio API metronome click track for the
  rhythm tab (tempo already has a display field with no function behind
  it today) and/or a reference pitch/scale play-through for the
  sight-reading tab, so students can check their own accuracy without a
  teacher at a piano.

#### Moonshot / North Star

**A full ensemble warm-up generator that plays what it displays** &mdash;
a metronome-backed rhythm click track, a sung/played reference pitch for
sight-reading, and eventually combined melodic-rhythmic phrases with key
signatures, so the "randomized pattern for a projector" becomes a
self-contained daily warm-up routine a section leader could run without
an instructor physically present.

#### Open Questions

- Is Unicode-glyph rendering for rhythm notation an acceptable permanent
  trade-off (simpler code, projector-dependent font support), or should
  hand-drawn SVG rhythm notation be treated as a near-term priority
  rather than a "someday" major feature, given the sight-reading tab
  already proves out the harder SVG-drawing approach in this same file?
- Should accidentals/key signatures be the very next feature (closing the
  biggest musical-completeness gap), or is a combined rhythm+pitch melodic
  mode more valuable to an actual classroom given the two are currently
  fully separate warm-ups that don't reinforce each other?

#### Platform themes that matter here

- **P7 (cross-tool)** &mdash; this is the first tool in the toolkit to
  hand-draw musical/geometric notation via computed SVG coordinates
  rather than relying on font glyphs or a vendored drawing library; the
  diatonic-position formula here (works for any clef/octave via one
  generic calculation) is a reusable pattern worth reaching for again if
  a future tool needs staff notation (e.g. a hypothetical "Ear Training"
  or "Interval Drill" tool).
- **P15 (first run)** &mdash; **resolved this round:** generation settings
  now persist to `localStorage`, so a teacher's preferred rhythm pool and
  pitch range survive closing the tab.

### 068 — Parent/Guardian Contact Log

*`Tools/068-parent-contact-log.html`.*

#### Major Features

- **Reminders / follow-up flag.** Mark a contact "needs follow-up by [date]"
  and surface a small "N follow-ups due" banner — the log becomes a to-do
  list, not just a record.
- **Multiple sections/classes**, the way Behavior & Points Tracker and SSR
  Log Tracker support named sections — right now there's exactly one roster
  and one log, which won't scale past a single class list.
- **Templates for the outcome field** — canned openers ("Called about missing
  homework", "Positive note home", "Behavior follow-up") a teacher can pick
  and edit instead of typing from scratch every time, cutting logging
  friction to almost nothing.
- **Year-end archive/rollover**: snapshot the year's log into a dated export
  and start fresh, mirroring the archive pattern already built for Hall Pass
  Log and Behavior & Points Tracker's daily history.
- **A real conference print packet**: one student's contact history plus a
  blank note-taking area, formatted for handing to an admin or printing right
  before a parent walks in — the actual "quick reference before a
  conference" the backlog idea named.

#### Moonshot / North Star

**The one place a teacher can answer "have I talked to this kid's family
about this before, and what did we say?" in five seconds, for every kid, all
year, without typing more than the outcome itself.** Fast enough to log
mid-hallway-conversation, complete enough to hand an admin, and structured
enough that a start-of-year rollover doesn't lose last year's pattern (e.g.
"we called four times about the same thing last year — should the plan
change?").

#### Open Questions

- Sensitivity: this is the most sensitive data of any tool in the toolkit
  (documented details of difficult family conversations). Is browser-only
  local storage sufficient, or does this deserve an explicit "this data never
  leaves your browser and isn't backed up automatically — export before you
  clear your cache" warning banner that other tools don't need?
- Should multiple sections be modeled as separate rosters (like Name Picker)
  or as one roster with a "class period" tag per student? The former matches
  existing conventions; the latter is less duplication if the same student
  roster is shared across contact-log purposes.

#### Platform themes that matter here

- **P7 (cross-tool)** — shares roster storage with Name Picker/Class Roster
  Hub already; multiple sections would make it a first-class citizen of that
  shared-roster ecosystem instead of a one-off reader.
- **P6 (print quality)** — the conference packet above is the whole point of
  this tool's existence per the backlog description; it's currently just a
  plain table.
- **P15 (first run)** — outcome templates would remove almost all the typing
  from the first time someone uses this mid-class-period.

### 069 — PE Warm-Up Circuit Card Generator

*`Tools/069-pe-warmup-circuit-generator.html`.*

#### Major Features

- **A "run the circuit" live projector/timer mode**, following the
  pattern already proven in Gallery Walk QR Codes: a rotation timer that
  counts down per station and signals when it's time to rotate, so this
  tool could drive the actual circuit live in addition to printing the
  station signage beforehand.
- **Difficulty tiers per station** (e.g. beginner/standard/advanced rep
  counts for the same exercise) so one circuit card set serves a mixed-
  ability class without printing three separate circuits.
- **A roster-linked station rotation chart**: given a class roster and a
  station count, auto-generate which student/group starts at which
  station and in what order they rotate — turns this from "signage only"
  into a full circuit-management tool.
- **Exercise image/diagram support** (like a photo per station, similar
  to Student Art Portfolio Label & QR Tag Maker's photo upload) for
  exercises that are easier to demonstrate visually than to describe in
  text, especially for stations run without direct teacher supervision.

#### Moonshot / North Star

**A complete PE circuit-running tool**: build the stations once, print
the signage, then run the actual rotation live on a projector with a
timer and an auto-generated roster rotation chart — closing the loop
between "the cards on the wall" and "who's where, doing what, for how
long" without a teacher needing to track it by hand.

#### Open Questions

- Is a live-run timer mode a natural fit for this tool specifically, or
  should the toolkit instead have one shared, reusable rotation-timer
  component that Gallery Walk QR Codes and this tool (and any future
  station-rotation tool) all reference, rather than three independent
  copy-pasted implementations?
- Should difficulty tiers be a per-station field (three rep counts
  stored on one station) or three entirely separate saved circuits
  (beginner circuit, standard circuit, advanced circuit) — the former is
  more compact to build once, the latter is simpler to print/post
  separately per class section?

#### Platform themes that matter here

- **P1 (milestone)** — this tool closes the Ideas Backlog's original
  per-tool list; the next "batch" of work is either newly-added ideas or
  the Platform-Wide big-swing ideas that were deliberately excluded from
  this two-round sprint since they touch the whole site rather than
  adding one new tool page.
- **P7 (cross-tool)** — the "run the circuit" timer described above
  would directly reuse Gallery Walk QR Codes' rotation-timer pattern
  (round count, minutes/seconds per round, sound-on-rotate, pause/
  resume/reset) rather than inventing a new one.
- **P12 (data integrity)** — the `&mdash;`/`&deg;`-through-`escapeHtml()`
  bug found here is the fifth instance of this exact bug class this
  round (Verb Conjugation Reference Poster Generator, Sub Note/Feedback
  Slip Generator, Science Fair Project Tracker, Government/Civics Role
  Card Generator, and now this one); this is a strong signal that a
  dedicated sweep for "HTML entity written as literal text in a JS
  string literal, later passed through escapeHtml()" across every tool
  in the toolkit would find more instances than the ones caught by
  chance during smoke testing.

### 070 — Peer Feedback / Editing Checklist Generator

*`Tools/070-peer-feedback-checklist-generator.html`.*

#### Quick Wins

- **Done — Print layout QA** — on-screen size warning plus two-tier print
  font/spacing scaling. *(A true measured-height layout is still the more
  robust option if this heuristic proves insufficient in practice.)*
- **A "duplicate template as starting point" option** — right now loading
  a template always fully replaces the current checklist; cloning it into
  an editable copy under a new name would let a teacher build variations
  faster. *(Still open — most useful once multiple named checklists exist,
  see Major Features.)*

#### Major Features

- **Multiple named saved checklists**, matching the multi-save convention
  in Formula Sheet Builder and Rubric Builder — right now there's exactly
  one checklist per browser, so "Narrative Draft 1" and "Persuasive Essay"
  checklists can't both be kept ready at once.
- **JSON export/import** for sharing a built checklist between teachers or
  across the same PLC/grade-level team.
- **Roster-driven half-sheets**: pull a class roster (Name Picker/Class
  Roster Hub's shared storage) and pre-fill the Author name on each
  half-sheet instead of leaving it blank for hand-writing — saves a step for
  every single student, every single time.
- **Digital fill-in mode** via a share link (this toolkit's P3 pattern) —
  peer feedback collected on a device instead of paper, useful for a 1:1
  classroom.

#### Moonshot / North Star

**A peer-feedback checklist that's pre-filled with the right names, sized
to fit a real half-sheet without surprises, and reusable across every
section that gets the same assignment.** Roster integration removes the
"write your partner's name" step at scale; multiple named saves mean the
narrative unit's checklist and the argumentative unit's checklist coexist
without overwriting each other; and a verified print layout means what's
on screen is exactly what comes out of the printer.

#### Open Questions

- Should the half-sheet print layout guarantee "however much content fits,
  fits" (dynamically shrink font/spacing) or should the tool warn/refuse
  past some category+item count instead? The former is more robust; the
  latter is simpler to implement correctly.
- Is roster-driven pre-fill worth the complexity of pairing students (who's
  the author vs. the reviewer for each half-sheet), or is a blank
  hand-written name line — which supports any pairing arrangement a teacher
  chooses live — actually the more flexible default to keep?

#### Platform themes that matter here

- **P7 (cross-tool)** — roster integration (Name Picker/Class Roster Hub)
  and the multi-save pattern (Formula Sheet Builder, Rubric Builder) are
  both proven elsewhere in the toolkit and would bring this tool to parity.
- **P6 (print quality)** — the half-sheet height-cap risk is the most
  urgent print-quality gap of anything shipped in this round.
- **P3 (share links)** — a digital fill-in mode, later.

### 071 — Picture-Prompt Speaking/Writing Task Generator

*`Tools/071-picture-prompt-generator.html`.*

#### Major Features

- **Multiple named saved image sets**, matching the multi-save convention
  used by most builder tools in this round — one flat image library per
  browser right now, so a "family vocabulary" set and a "school vocabulary"
  set can't coexist.
- **A student-facing timer/response mode** via a share link (this
  toolkit's P3 pattern) — students see the image and prompt on their own
  device with a countdown, for a timed speaking-prep or writing-sprint
  activity.

#### Moonshot / North Star

**A picture-prompt bank that scales to a real photo library without
storage risk, offers timed student-facing practice, and can pair specific
images with specific prompts when a teacher wants that control.** Image
downscaling on upload is the foundation everything else depends on (a
tool that silently fails past 20-30 full-resolution photos isn't durable);
a student-facing timed mode turns a teacher-led activity into independent
practice; and pinned image-prompt pairs give a teacher precise control
when the activity calls for it, while random pairing stays the flexible
default.

#### Open Questions

- Is pinning specific prompts to specific images worth the added UI (an
  explicit image-prompt pairing table) given the random-pairing default
  already covers the more common "any prompt works with any image" case?
  **Resolved this round, lightly:** built as a single per-image pin toggle
  on the currently-displayed image/prompt pair rather than a full pairing
  table — no dedicated UI, reuses the existing stage. Revisit if a teacher
  wants to pre-pin many pairs before ever seeing them projected, which
  would need the table after all.

#### Platform themes that matter here

- **P15 (first run)** — image downscaling directly affects whether a
  first-time user with a real photo library hits storage problems; this
  matters more here than almost any other tool in this round given how
  much larger photos are than any other localStorage content in this
  toolkit.
- **P3 (share links)** — a timed student-facing practice mode is a
  natural fit.
- **P7 (cross-tool)** — none of this round's other tools deal with
  bulk user-photo storage at this scale; any downscaling utility built
  here could become a reusable pattern for future image-heavy tools.

### 072 — Story Elements / Plot Diagram Builder

*`Tools/072-plot-diagram-builder.html`.*

#### Quick Wins

- **JSON export/import**, for sharing a completed diagram between class
  periods studying the same novel, or archiving one from a past year.
  *(Still open — natural pairing with the new multi-save feature.)*

#### Major Features

- **Alternate diagram shapes** for non-linear narratives (e.g. a
  circular/cyclical structure, parallel plotlines for a story with two
  protagonists) — the five-stage mountain assumes a classic linear
  Freytag's Pyramid structure, which doesn't fit every novel a class
  studies.
- **Per-chapter/per-section sub-notes** within a stage — right now each
  stage is one free-text box; a novel study spanning many chapters might
  want to log which chapter each plot point happened in.
- **Character arc tracking** layered onto the same diagram — a small
  per-character note at each plot stage (how does this character change
  by the climax vs. the exposition), extending "story elements" into
  something that tracks development over the plot, not just a static
  summary.
- **A class-collaborative fill-in mode** via a share link (this toolkit's
  P3 pattern) — students contribute to the same diagram from their own
  devices during a discussion, instead of one teacher typing at the front.

#### Moonshot / North Star

**A plot diagram flexible enough for any narrative structure a class
studies, filled in collaboratively during discussion, and kept as a
searchable record across every novel a class covers in a year.** Alternate
shapes handle non-linear stories the five-stage mountain can't; a
collaborative share-link mode turns "the teacher fills this in" into "the
whole class builds this together"; and multiple named saves mean a year's
worth of novel studies stays organized instead of overwriting itself.

#### Open Questions

- Is a single alternate "circular/cyclical" shape worth building as a
  second diagram type, or does that add enough UI complexity (shape
  picker, different positioning math) that it's better scoped as its own
  tool sharing this one's story-elements summary component?
- Should character-arc tracking live on this same diagram (adding density
  to an already-busy visual) or as a separate, simpler tool that just
  tracks one character's change across the same five plot stages?

#### Platform themes that matter here

- **P3 (share links)** — a collaborative fill-in mode is the single
  biggest opportunity for turning this from a teacher-facing builder into
  an actual class activity tool.
- **P7 (cross-tool)** — multiple named saves and JSON export/import both
  match conventions already established elsewhere in this toolkit.
- **P15 (first run)** — a presentation/discussion mode (bigger text, no
  visible borders) matters more here than on most tools, since this one's
  explicit use case is live projection during class discussion.

### 073 — Science Fair Project Tracker

*`Tools/073-science-fair-project-tracker.html`.*

#### Major Features

- **Multiple named saved trackers** (e.g. separate science-fair cohorts
  per class period), matching the multi-save convention used by most
  builder/tracker tools in this round — right now one tracker per browser.
- **Student self-check-in via a share link** (this toolkit's P3 pattern):
  students mark their own milestones complete from their own device,
  instead of a teacher manually checking every box for every student.
- **Export to Google Calendar/ICS** for milestone due dates, so deadlines
  show up wherever a teacher already tracks their calendar.

#### Moonshot / North Star

**A tracker that surfaces exactly who's behind on exactly what, before the
deadline arrives, with students checking in on their own progress instead
of a teacher manually auditing every row.** Overdue highlighting and a
"least complete first" sort turn the chase-list from something read on
print day into an ongoing early-warning system; student self-check-in
turns a teacher-maintained spreadsheet into a shared, live status board.

#### Open Questions

- Should student self-check-in require any verification (a student marks
  their own milestone done, but a teacher must confirm before it counts),
  or is trusting student self-report sufficient for a formative tracking
  tool like this?
- Next round could pick up any of the Major Features above — multiple
  named trackers and per-milestone notes are the two that don't require
  new toolkit-wide infrastructure (P3 share-link plumbing, ICS export) and
  so are probably the next-cheapest wins.

#### Platform themes that matter here

- **P3 (share links)** — student self-check-in is the single highest-value
  feature gap between "a teacher's tracking spreadsheet" and "a live
  project-status board the whole class updates."
- **P7 (cross-tool)** — could share roster storage with Class Roster Hub;
  overdue highlighting logic is a small, reusable pattern that could apply
  to any due-date-bearing tool in this toolkit (Field Trip Permission
  Slip's due dates, for instance).
- **P6 (print quality)** — the missing-list-by-milestone print section is
  already the tool's strongest print-quality feature; nothing urgent to
  add there.

### 074 — Science Safety Symbol & Equipment Label Maker

*`Tools/074-science-safety-label-maker.html`.*

#### Major Features

- **Multiple named saved label sets** (e.g. "Chem Storage Room," "Bio Lab
  Stations"), matching the multi-save convention used by most builder
  tools in this round — right now one flat queue per browser.
- **Direct integration with Lab Safety Contract Tracker**, which the
  backlog explicitly names as a pairing — e.g. a shared hazard/equipment
  vocabulary, or a link from one tool to the other, rather than two
  entirely separate tools that happen to be thematically related.
- **Official GHS pictogram fidelity** — the current icons are simplified
  originals in this toolkit's house style, not the standardized GHS
  (Globally Harmonized System) hazard pictograms used on real chemical
  labeling. A school with formal chemical safety compliance requirements
  might need labels that match the actual standard exactly.
- **A QR code per label** linking to an SDS (Safety Data Sheet) reference
  or a longer safety procedure, reusing this toolkit's QR Code Generator
  pattern — turns a static hazard label into a quick-reference gateway.

#### Moonshot / North Star

**A lab safety labeling system that matches real chemical-safety standards
where it matters (GHS pictograms) and links straight to the safety
information behind each label (SDS via QR), tied into the same safety
data as the Lab Safety Contract Tracker.** GHS fidelity matters for any
school taking chemical safety compliance seriously; QR-to-SDS turns a
static label into an actual safety resource; and tying into Lab Safety
Contract Tracker means "storage labeled X" and "students signed off on
handling X" live in the same mental model instead of two disconnected
tools.

#### Open Questions

- Is GHS pictogram accuracy a real requirement for this toolkit's
  audience (a middle school classroom, generally lower compliance burden
  than a research lab), or does the current simplified/stylized icon set
  serve the actual use case well enough that formal-standard fidelity is
  low priority?
- Should SDS-via-QR link to an external hosted SDS database (a real safety
  resource, but a dependency this toolkit doesn't currently have anywhere
  else) or to a teacher-authored local page/note per hazard (simpler,
  fully local, but less authoritative)?
- ~~Still open from the Quick Wins list: **reordering the queue**~~ —
  **done, 2026-08-12** (see Status). Still open: **combining two symbols
  on one label**, which
  would need the queue item shape to hold an array of symbols instead of
  one and touches the print-card rendering, the edit form, and the
  duplicate logic all at once — sizeable enough to deserve its own round
  rather than being folded in here.

#### Platform themes that matter here

- **P7 (cross-tool)** — the explicit backlog pairing with Lab Safety
  Contract Tracker, plus QR-to-SDS reusing QR Code Generator's pattern,
  are both direct opportunities.
- **P6 (print quality)** — label size options matter more here than on
  most tools, since the physical bins/stations these labels go on vary a
  lot in size.

### 075 — Staff Directory / Quick-Reference Builder

*`Tools/075-staff-directory-builder.html`.*

#### Quick Wins

- **Photo column** (optional headshot per person) for a "who is that" wall
  reference, not just a phone-book.
- **"Copy as plain text" button** for pasting a quick phone list into an
  email without needing to print first.

#### Major Features

- **Multiple saved directories** (e.g. "Teaching Staff" vs "Support Staff"
  vs "Front Office"), the way Formula Sheet Builder and Rubric Builder
  support multiple named saves — right now it's a single flat list for the
  whole building.
- **QR code per entry linking to an extension-dial or email**, printed next
  to the row, for a phone-mounted or wall-mounted quick-reference version —
  a natural pairing with this site's existing QR Code Generator/Gallery
  Walk QR patterns.
- **Wallet-card / lanyard-insert print layout** as an alternate to the
  full-page table, for a personal quick-reference card instead of a
  workroom wall poster.
- **Import from the shared roster system** other tools use (Class Roster
  Hub's storage), if staff lists ever get maintained there — though staff
  and student rosters are different enough this may not be worth forcing
  together.

#### Moonshot / North Star

**The one directory a school actually keeps up to date, because updating it
is as easy as fixing a typo in a spreadsheet cell.** Multiple views from one
data set — printable wall poster, personal wallet card, searchable on-screen
list, exportable spreadsheet — so it's worth maintaining once instead of
retyping into three different formats every August.

#### Open Questions

- Is a single flat directory the right default, or should "departments as
  separate saved lists" be the starting shape given how differently a math
  department list and a whole-building directory get used?
- Worth reusing the shared roster storage pattern at all for staff, or is
  keeping this fully separate from student-roster tools (Name Picker, Class
  Roster Hub) the right call given they serve different audiences?
- Next round: department grouping is probably the highest-value remaining
  Quick Win — it touches both the on-screen table and the print view, so
  it's a bit bigger than "photo column" or "copy as plain text," but it's
  the one the file's own Moonshot section leans on most.

#### Platform themes that matter here

- **P6 (print quality)** — the wallet-card and department-grouped layouts
  are print-format work on top of an already-functional table.
- **P15 (first run)** — the bulk-paste importer already lowers first-run
  friction a lot; export/import would close the loop for reuse next year.
- **P7 (cross-tool)** — QR-per-entry connects naturally to QR Code
  Generator/Gallery Walk QR's existing batch-QR code.

### 076 — Sub Note / Feedback Slip Generator

*`Tools/076-sub-note-feedback-slip-generator.html`.*

#### Quick Wins

- **Multiple named saved prompt sets** — a general sub note and a
  specialized one (e.g. for a lab day, or a day with a fire drill scheduled)
  could both be worth keeping ready, matching the multi-save convention
  used elsewhere in this toolkit.

#### Major Features

- **Direct pairing with Sub Plan Builder and Sub Binder Generator** — this
  slip is explicitly the "end of the day" companion to the "start of the
  day" sub plan packet those tools already build. A link or bundled-print
  option connecting all three (plan going out, note coming back) would
  close a loop the backlog description implies but doesn't yet build.
- **A digital version** for a sub without a working printer, or for a
  teacher who wants the feedback captured in a searchable form rather than
  a paper slip left on the desk — could feed into a simple per-day archive
  (loosely similar to Parent/Guardian Contact Log's history list) instead
  of being a one-time throwaway slip.

#### Moonshot / North Star

**The sub note that's actually left behind, because it took the sub thirty
seconds and gave the teacher exactly what they need the next morning — tied
directly to the plan that sent the sub in, not a disconnected slip of
paper.** Pairing with Sub Plan Builder/Sub Binder Generator turns "leave a
note" into a natural bookend of the whole sub-day workflow already built
elsewhere in this toolkit.

#### Open Questions

- Should Sub Binder Generator (which already assembles Sub Plan Builder's
  details and a seating chart into one packet) grow to include this slip as
  a blank page at the end, or should this stay a standalone tool a teacher
  prints separately, closer to the door, on the way out?
- Is a digital/archived version worth building given this toolkit's
  deliberately lightweight, throwaway framing for sub notes, or does
  "a slip on the desk" stay the right permanent shape for this specific
  tool?

#### Platform themes that matter here

- **P7 (cross-tool)** — the most direct opportunity here: Sub Plan Builder
  and Sub Binder Generator already exist and cover the other half of the
  same day.
- **P6 (print quality)** — this tool's own half-sheet height-cap risk is
  fixed as of this round (see Status); the identical risk still exists in
  Peer Feedback / Editing Checklist Generator and Art Critique Worksheet
  Generator, which share the same `.slip { height: Nvh; overflow: hidden }`
  print pattern and would benefit from the same fix.

### 077 — Testing Accommodations Reference Card Generator

*`Tools/077-testing-accommodations-card-generator.html`.*

#### Major Features

- **Multiple named saved rosters/sections**, matching the multi-save
  convention in Class Roster Hub and other tools — right now it's one flat
  roster, which doesn't scale to a teacher with several class periods each
  needing their own accommodation set.
- **Load roster from Name Picker/Class Roster Hub's shared storage**,
  reusing rosters already built elsewhere instead of re-typing names for
  yet another tool.
- **An expiration/review-date field** per student, since accommodations
  (like IEP/504 plans) are periodically reviewed and a stale card is worse
  than no card if a teacher trusts it without checking.
- **A room-assignment view**: given a set of testing rooms/proctors, sort
  students by which room their accommodations route them to (e.g. everyone
  needing "separate setting" together), turning the card generator into an
  actual testing-day logistics tool, not just a reference.

#### Moonshot / North Star

**A testing-day accommodations system that answers "who goes where and
needs what" at a glance, stays current because it's reviewed on a schedule,
and never requires re-typing a roster that already exists in another
tool.** Room-assignment logic turns individual reference cards into a
building-wide testing-day plan; shared roster loading removes the
redundant-typing tax; and a review-date field keeps the data trustworthy
instead of quietly going stale.

#### Open Questions

- Is a review-date/expiration field worth the added complexity given this
  tool's explicitly lightweight, single-teacher, single-testing-day
  framing? A school-wide accommodations system with expiration tracking is
  a meaningfully bigger scope than "print a reference card."
- Should room-assignment logic live here, or is that different enough in
  audience (a testing coordinator, not a single classroom teacher) that it
  deserves its own tool built on top of this one's data model instead of
  growing this tool's scope?
- Next round: sort/filter by accommodation type is the only Quick Win left
  unbuilt — a small addition to the existing grid, not a new data shape,
  so it's probably a quick pickup whenever this tool's turn comes around
  again.

#### Platform themes that matter here

- **P7 (cross-tool)** — roster sharing with Name Picker/Class Roster Hub is
  the most direct opportunity; this is the second tool in this round (after
  Parent/Guardian Contact Log) dealing with sensitive per-student data
  that stays local by design.
- **P6 (print quality)** — card-size/column control shipped this round;
  matters more once real accommodation lists (which can be longer than the
  6 defaults) get used.
- **P15 (first run)** — the "N students have accommodations" count shipped
  this round; sort/filter is still open and would further reduce the
  friction of scanning a full roster by eye.

### 078 — Unit Conversion Reference Chart Builder

*`Tools/078-unit-conversion-chart-builder.html`.*

#### Quick Wins

- **Multiple named saved charts**, matching Formula Sheet Builder's pattern
  — right now there's exactly one chart per browser, so a "Grade 5 metric
  only" chart and a "full reference" chart can't coexist.
- **Reorder groups and lines** (up/down buttons, matching Formula Sheet
  Builder's item reordering) — right now group and line order is fixed by
  template/insertion order.
- **JSON export/import**, the same convention Formula Sheet Builder and
  Rubric Builder use, so a chart can be shared between two teachers' Ideas
  Backlog-graduated setups.

#### Major Features

- **Area and speed unit sets** (sq ft/sq m/acres/hectares;
  mph/km per h/m per s) — common in both math and science classes and
  currently absent.
- **A tiny built-in calculator** next to each conversion line ("type a
  number, see it converted") as an optional toggle — turns the reference
  chart into something a struggling student can actually use mid-problem,
  not just read.
- **Print as a bookmark/half-sheet** in addition to the full-page chart, for
  taping inside a math notebook rather than posting on a wall.

#### Moonshot / North Star

**The conversion chart a student actually keeps in their binder, sized and
scoped for exactly their unit, with a quick-calc built in for the facts they
haven't memorized yet.** Grade-band presets get a teacher to a useful chart
in one click; the optional calculator turns "reference" into "tool"; and
saved named charts mean a chart built once for fifth-grade metric doesn't
need rebuilding for sixth-grade customary-to-metric next period.

#### Open Questions

- Is a built-in mini-calculator in scope for a tool the backlog explicitly
  frames as a static reference chart, or does that belong as a separate
  "Unit Converter" tool entirely (there's already a unit-conversion-adjacent
  idea gap on the backlog for an actual calculator)?
- Grade-band presets: worth hard-coding which templates map to "elementary"
  vs "middle" here, or is that better solved by just letting saved-chart
  names double as presets (a teacher builds their own "5th grade" chart
  once and reuses it)?

#### Platform themes that matter here

- **P6 (print quality)** — column-count control and a half-sheet layout are
  both pure print-format work.
- **P15 (first run)** — grade-band presets would remove almost all the
  clicking from a first visit.
- **P7 (cross-tool)** — shares its whole "checkbox templates → editable
  grouped list → print" shape with Formula Sheet Builder; multiple named
  saves and JSON export/import would bring it fully in line.

### 079 — Verb Conjugation Reference Poster Generator

*`Tools/079-verb-conjugation-poster-generator.html`.*

#### Quick Wins

- **Multiple named saved posters**, matching the multi-save convention in
  Formula Sheet Builder / Rubric Builder — right now one poster per
  browser, so a present-tense poster and a preterite poster can't both be
  kept ready.
- **Conditional tense and German/Italian starter templates**, to close the
  remaining content gaps the first content pass didn't reach.

#### Major Features

- **Irregular verb call-out boxes** — a small side panel per poster
  listing 3&ndash;5 common irregular verbs in that tense, since regular
  patterns are only half of what a wall reference needs to be useful.
- **JSON export/import**, for sharing a built poster with another teacher
  on the same team, or backing one up before a school year ends.
- **A "shrink to fit one page" print mode toggle** — right now font sizes
  are fixed; a poster with many panels could benefit from auto-scaling
  instead of manual tuning, while a single-panel poster might want to go
  even bigger for genuine across-the-room legibility.
- **Audio pronunciation via QR code per panel**, reusing the pattern the
  backlog's separate Classroom Label Maker idea calls for (QR &rarr;
  text-to-speech clip) — would make this poster double as a
  self-check pronunciation reference, not just a visual one.

#### Moonshot / North Star

**A wall-poster library for every tense and irregular-verb group a language
teacher needs, colour-coded for at-a-glance scanning, that survives year to
year as named saves.** More starter templates close the content gap fastest;
irregular-verb call-outs make a "regular pattern" poster into a genuinely
complete reference; and saved named posters mean building once and reusing
every year the same unit comes around.

#### Open Questions

- Should irregular verbs live as an optional add-on section within the same
  poster/panel model, or does "irregular verb reference" deserve its own
  distinct template type given how differently they're taught (usually
  memorized individually, not by pattern)? **Partially answered this
  round**: the new `es_irregulars`/`fr_irregulars` templates went with
  "own distinct template" (a poster made entirely of irregular-verb panels,
  loaded like any other template) rather than a call-out box grafted onto
  a regular-pattern poster — simpler to build with the existing panel
  model and keeps a teacher's "irregulars" poster separately printable
  from their "regular pattern" one. The Major Features item calling for a
  *combined* poster (regular panels + a small irregular-verb side box on
  the same page) is still open if that's the better pedagogical shape.

#### Platform themes that matter here

- **P7 (cross-tool)** — shares subject/person-label conventions with
  Vocab & Conjugation Drill Generator; QR-to-audio would share ground with
  the backlog's Classroom Label Maker idea and this toolkit's existing
  QR Code Generator / Gallery Walk QR patterns.
- **P6 (print quality)** — column-count control and shrink-to-fit are both
  pure print-layout work on an already-functional poster.
- **P15 (first run)** — more starter templates lower the barrier for a
  teacher who doesn't want to type six conjugated forms per panel by hand.

### 080 — Virtual Manipulatives Board

*`Tools/080-virtual-manipulatives-board.html`.*

#### Quick Wins

- **Snap-to-grid for base-ten blocks** (optional toggle) so demonstrating
  "these ten units make a ten-rod" lines up visually without careful manual
  dragging.
- **Touch-device testing and tuning** — Pointer Events should work on
  tablets already, but this hasn't been verified on an actual touchscreen,
  and a projector setup often pairs with a touch-enabled front-of-room
  display or tablet.

#### Major Features

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

#### Moonshot / North Star

**A manipulatives board where the physical intuition (ten units snap into
a rod, a +1 and -1 cancel when combined) is built into the interaction, not
left to the teacher narrating over static shapes.** Snapping and
cancellation turn "a board of draggable shapes" into "the thing physical
manipulatives are actually for" — showing *why* the math works, live,
instead of just displaying icons that represent it.

#### Open Questions

- Should a saved board carry a small preview image in the picker? It would
  make stepping through six prepped demos much faster to navigate, but a
  snapshot PNG per board is exactly the localStorage-quota trap P12
  describes. IndexedDB (the `bmg-map-cache.js` pattern) would be the honest
  way to do it.
- Is snap/cancel worth the real interaction-design complexity (detecting
  proximity, animating a merge/removal, handling ambiguous overlaps) for
  an MVP-grade tool, or does a simpler "align to grid" toggle deliver
  most of the pedagogical value for much less code?

#### Platform themes that matter here

- **P6 (print quality)** — not directly applicable (this is a live-display
  tool), but the snapshot feature is effectively this tool's "print," and
  the ten/hundred color bug is the equivalent of a print-quality defect.
- **P15 (first run)** — snap-to-grid and duplicate-piece both reduce the
  friction of getting a clean demonstration set up live, in front of a
  class, under time pressure.

### 081 — Word Problem Warm-Up Generator

*`Tools/081-word-problem-warmup-generator.html`.*

#### Quick Wins

- **A per-problem operation label** (small badge showing "multiplication",
  etc.) in the worksheet view, useful when operations are mixed on one
  sheet.

#### Major Features

- **Two-step word problems** for the upper grade band — the backlog and
  README both call this a grades 6&ndash;8 tool, and real 6&ndash;8 word
  problems are frequently two operations chained together
  ("buys 3 packs of 8, then gives away 5 — how many are left"). This is the
  biggest gap between what's shipped and what a middle-school teacher will
  actually want.
- **Fractions/decimals/percents templates**, sharing the operand-generation
  approach this backlog separately lists for a
  fraction-decimal-percent drill generator — this tool's template structure
  is the natural home for that as a mode rather than a separate build.
- **Custom template editor** — let a teacher add their own sentence pattern
  with `{a}`/`{b}`/`{name}`/`{item}` placeholders, so class-specific context
  (a current novel's characters, a science unit's vocabulary) can replace
  the generic name/item lists.
- **On-screen student answer input** with instant right/wrong feedback via
  a share link (this toolkit's P3 pattern), instead of only projector
  display or paper.

#### Moonshot / North Star

**Any word problem a class needs, worded for the actual unit they're in, at
the right difficulty, with numbers that never repeat until the teacher wants
them to.** Two-step problems for the grade band that needs them, a template
library deep enough that "not this one again" never happens, and a seed so
a make-up quiz is the exact same sheet as the one the rest of the class took.

#### Open Questions

- Should two-step problems be a separate operation category ("two-step") or
  a flag any operation template can opt into? A separate category is
  simpler to build; a flag reuses the existing per-operation number-range
  logic more cleanly.
- Is the generic name/item pool (Maya, Ethan, stickers, marbles, &hellip;)
  worth making editable, or does a custom-template editor make that
  unnecessary since a teacher could just write items into their own
  template text?

#### Platform themes that matter here

- **P7 (cross-tool)** — the fraction/decimal/percent backlog idea and this
  tool's template engine are a natural single build.
- **P15 (first run)** — settings persistence removes the "reset every visit"
  friction on a tool meant for daily warm-up use.
- **P3 (share links)** — an on-screen answer-input mode, later.

