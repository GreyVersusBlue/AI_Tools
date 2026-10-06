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

**The one exception on record is Path 21, and it was Devon's call, not a session's.** On
2026-09-25 he put Blender-rendered art at the top of Tier 1 (ranks 1–8 as he placed them; **all shipped**, the last being 046's relief under AI-03, 2026-10-01) and authorized the
student-facing art among those rows (071's picture prompts). That is recorded in `HISTORY.md`
("Path 21 ranked first"). It does not extend to any other row. **Every Path 21 row needs Blender
locally: on Devon's Windows machine, or, since 2026-09-29, on huginn.** A row that needs
Blender's full feature set on a GPU says "Windows machine only" and huginn skips it. No Path 21
row is open now; a future one follows the same rule.

## Where things stand — start here

*Current as of huginn's local `main` after AI-sync's merge of origin's #329, 2026-10-03. **Keep this section under ~80 lines.** It is
the state of the repo and what to start — not a log. The story of each increment, what it
found and what it did not verify, goes in `HISTORY.md` in the same commit; this header gets
at most three lines about it. Rewrite it when your phase merges (step 6 of the definition of
done).*

**Why it is short.** It had grown to ~1,900 lines of handoffs by 2026-09-23; those moved
verbatim to `HISTORY.md` ("BACKLOG header handoffs, 2026-09-04 → 2026-09-12"). Search there for a PR number.

**Local `main` on huginn holds origin's #329 plus six sessions' unpushed work (AI-sync, 2026-10-03, `CACHE_VERSION` v222).**
- AI-sync merged origin `834ccd9` (#323 to #329) into local `main` with a merge commit. AI-11, AI-12, AI-08, AI-35,
  AI-34 and AI-13 P1 are local only; their `HISTORY.md` entries say v216 to v221, labels no deployed site ever
  carried (origin used v216 for #328). They all reach the site as **v222**. `HISTORY.md`, "AI-sync", has the map.
- **Not pushed.** `selector-presync-2026-10-03` tags local `main` as it was before the merge.

**Local only, newest first (detail in `HISTORY.md`):**
- **AI-13 (v249), rank 6, Path 7 P4 increment 5: 003, 008, 018, 033, 068 and 075 save their CSV through
  `ExportKit.toCsv`.** Every file now has a byte order mark, CRLF, a quoted carriage return and an apostrophe before
  a typed cell a spreadsheet would run as a formula; 075's Import takes the apostrophe off. Old file against new
  for all six. `npm run test:csv-adopters` (port 8486). **Left in rank 6: 001 and 006 (CSV and workbook), then 030
  and 036; `toXlsx` has no adopter. No file was opened in a spreadsheet program.**
- **AI-13 (v248), rank 6, Path 7 P4 increment 4: 011 makes booklets and several pages to a sheet on `ExportKit`
  (Path 17 P4's controls, built), and 064's zip and PNG downloads are the file helpers' first adopter.** 011's
  default output is the old page's in 120 states, to the pixel. `npm run test:image-to-pdf-impose` (port 8483).
  **Left in rank 6: CSV and XLSX for the tools that hold a table. No booklet has been printed or folded.**
- **AI-15 (no version, a design pass), rank 4, Path 3 P6: the year rollover is designed, not built.** The design is
  Path 3's P6 bullet: the inventory by kind, `br-rollover.js`'s surface, the order of operations, the tests, and
  ten questions for Devon. **009's rollover today loses student photos and deletes room layouts and other setup.**
- **AI-13 (v245), rank 6, Path 7 P4 increments 1 to 3: `_shared/export.js` (`ExportKit`) is whole, 064 and 040 are
  on it, and `_shared/duplex-print.js` is deleted.** The imposition and pagination math, `toPdf(pages, opts)` for
  drawn pages (**not a DOM element**), `toCsv` (formula guard), `toXlsx`, `toZip`, `download`, `filename`. 064's
  Download PDF and both tools' print pagination run on it, to the pixel. `npm run test:export` (port 8480),
  `test:trading-card-pdf` (8481), `test:vocab-imposition` (8482). **Nothing printed, no file opened in Excel.**
- **AI-13 (v242), old rank 6, Path 7 P3 increment 12: 016 prints through the kit, and P3 is finished and its row is
  gone** (thirteen adopters). Three sheets as three areas of one `#printArea`: one code, the bulk grid (`{ cols }` on
  plain paper, `{ cols, perPage }` on label stock) and the inventory. The kit changed once: `setPage()` takes two
  margins, top and sides. One code, the plain grid and the inventory are the old page's, pixel for pixel, in 38
  states. **Avery labels were printing a third of an inch below the die cut on the first sheet, 27 to a sheet of 30;
  they are in place now.** `npm run test:qr-code-print` (port 8479). **Next in Path 7 is rank 6, P4. Not printed on
  paper or on label stock.**
- **AI-13 (v241), old rank 6, Path 7 P3 increment 11: 017 prints through the kit** (twelve adopters now), all five
  buttons: three card sheets (`{ cols, perPage }`, as 018's), packets as kit pages and the reference table, five
  areas inside one `#printArea`. The kit did not change. Card sizes, markup, QR codes and PDF page counts are the old
  page's in 36 states. `npm run test:gallery-walk-print` (port 8478).
- **AI-16 (v240), the cheap piece of Path 4 P5:** 009 now says what `rgb-audio` and `stviz-recovery` hold; their
  registry rows had no `note`, so both showed as a bare name. Rank 2 (per-tool restore) is untouched. Open:
  should `rgb-audio` be ticked by default? See `HISTORY.md`.
- **AI-13 (v239), old rank 6, Path 7 P3 increment 10: 018 prints through the kit** (eleven adopters now), all six
  buttons: five card sheets (`{ cols, perPage }`, a card a share of the width and as tall as its content) and the
  answer key, six areas inside one `#printArea`. The kit did not change. Card sizes, markup, QR codes and PDF page
  counts are the old page's in 40 states, **except answer sheets a page tall or taller, which no longer print a blank
  page after each page.** `npm run test:scavenger-hunt-print` (port 8477).
- **AI-13 (v238), old rank 6, Path 7 P3 increment 9: 064 prints through the kit** (ten adopters now): fronts and backs
  through one `renderCards()` call (`{ cols, perPage }`, an exact-size card with the tool's own `height` and clipping).
  The kit did not change. Card sizes, positions and markup are the old page's in 32 states; **a deck of one page of
  cards printed three sheets and prints two now.** `npm run test:trading-card-print` (port 8476).
- **AI-13 (v237), old rank 6, Path 7 P3 increment 8: 040 prints through the kit** (nine adopters now), both buttons:
  every card goes through one `renderCards()` call (`{ cols, perPage }`) that draws the preview too. The kit did not
  change. PDF pages and card sizes are the old page's in 88 states, **except the 3x5 index-card preset, which had
  always printed a blank sheet after every page and is one sheet now.** `npm run test:vocab-print` (port 8475). **Next: 064, then 018 017 016.**
- **AI-13 (v236), old rank 6, Path 7 P3 increment 7: 051 prints through the kit** (eight adopters now), like 074 at its
  own label size (`{ cols: 3 }`), with its reference sheet on a second kit page. The kit did not change. PDF pages
  and label sizes are the old page's in 24 states. **Its QR codes are drawn in whole pixels now: 4 of 120 did not
  decode.** `npm run test:classroom-label-print` (port 8474).
- **AI-13 (v235), old rank 6, Path 7 P3 increment 6: 074 prints through the kit** (seven adopters now) and the kit has
  **`PrintKit.renderCards(container, items, preset, buildCard)`**: a preset name for cards that share the page (077
  uses it now), or `{ cols }` for a grid of the tool's own height (`.pk-cards-own`, 074's labels). 074's PDF is the
  old page's in 66 states. `npm run test:safety-label-print` (port 8473).
- **AI-13 (v234), old rank 6, Path 7 P3 increment 5: 042 prints through the kit** (six adopters now), the first whose
  sheet is a fixed size on purpose: `print-area.css`, `.pk-page`, `.pk-paper` and `setPage()` at 0.35 in, its own
  sheet height kept, no `renderSet`. The kit did not change. Chromium's PDF is the old page's, pixel for pixel.
  `npm run test:certificate-print` (port 8472). **Next: the seven card-grid tools. Not printed on paper.**
- **AI-13 (v233), old rank 6, Path 7 P3 increment 4: 023 prints through the kit** (five adopters now), the first on
  quarter sheets: slips are `mode: 'blank'` or `'set'` on half or quarter sheets, the reteach list is one page. The
  kit changed twice: `.pk-quarters` holds on `#printArea`, and `.pk-paper` (white sheet, black text; 043 uses it too).
  `npm run test:exit-ticket-print` (port 8471). **Not printed on paper; full `npm test` not run.**
- **AI-13 (v232), old rank 6, Path 7 P3 increment 3: 043 prints through the kit** (four adopters now), the first with a
  roster: `mode: 'set'` with the "N of M" footer on a class set of slips, the kit header on the chaperone sheet, and
  reminder slips two to a page. The kit did not change. `npm run test:permission-slip-print` (port 8470).
  **Next: 023, then 042. Not printed on paper.**
- **AI-13 (v231), old rank 6, Path 7 P3 increment 2: 070 and 077 print through the kit** (three adopters now). 070 is
  half sheets, like 076; 077 is the first on the card grids. The kit gained `renderSet`'s `cut: true` and a `4x3` card
  preset. `npm run test:peer-feedback-print` (port 8468), `npm run test:accommodations-print` (8469). **Not printed on paper.**
- **AI-13 (v230), old rank 6, Path 7 P3 increment 1: 076 is the print kit's first adopter.** Its print block is gone:
  `print-area.css` + `PrintKit.renderSet` (blank mode, half sheets). Same page counts in Chromium's PDF as before
  (`npm run test:sub-note-print`, port 8467). **The recipe for the next adopters is in Path 7's P3. Not printed on paper.**
- **AI-13 (v229), old rank 6, Path 7 P2 increment 6: P2 is finished and its row is gone.** `_shared/print-area.css`
  takes everything but `#printArea` out of the flow in print, so its pages (20 then, 23 now) print no blank sheets after the sheet
  (`npm run test:print-tail`, 376 assertions). Audit TAIL is 0; what it still lists (015, 042, 046, 064) is
  fixed-size on purpose. **Next in Path 7 is rank 6, P3 (adoption). Nothing was printed on paper.**
- **AI-13 (v228), old rank 6, Path 7 P2 increment 5:** the 15 tools that hid their editor with `visibility` in their own
  print block no longer print blank sheets after the sheet (`npm run test:print-tail`, Chromium's PDF per button).
- **AI-13 (v227), old rank 6, Path 7 P2 increment 4:** 015's map sheet runs on to a second page instead of cutting a
  long timeline off; 035's other four tabs print as documents; 004 009 010 print light from dark. New audit kind
  TAIL.
- **AI-13 (v226), old rank 6, Path 7 P2 increment 3:** 035's Blueprint tab prints the active floor's plan on one page
  (`#bp-print-sheet`, suite `smoke-print.mjs`, port 8465) and none of the editor. 040 no longer prints a blank
  sheet; seeds or prep reach every print button on 013 014 015 024 033 040 084.
- **AI-13 (v225), old rank 6, Path 7 P2 increment 2:** the audit now reaches every sheet (not measured 18 → 0) through
  18 new seeds, "print" tabs and `print-audit-prep.mjs`. Fixed: 061 printed blank, 023's clipped slips, 038, 051, 074.
- **AI-13 (v224), old rank 6, Path 7 P2 increment 1:** `npm run path7:next` audits every tool in print in a browser.
  077's clipped card, `theme.css`'s print reset and seven smaller fixes shipped.
- **AI-10 (v223), old rank 6:** every WebRTC pairing code is drawn by `QrDraw.fit()` at 4 px per module or more,
  and `webrtc-pair.js` writes a lossless compact code (569 → ~190 bytes). Suite `smoke-pairing-qr.mjs`, port 8463.
  **Not scanned with a real phone, and only Chromium's SDP was seen** (parked device check 4).
- **AI-13 (labelled v221), old rank 7, Path 7 P1:** `_shared/print-kit.css` + `print-kit.js` (`PrintKit`). **076 links it
  since v230**; adoption (P3) finished in v242. Suites on port 8462. **Never printed on paper** (parked device check).
- **AI-34 (v220):** no page claims a social-tag generator; precache bytes re-measured.
- **AI-35 (v219), old rank 76:** 002, 016, 018, 038 and 044 are native on `ink-paper.css` + `a11y.js`; 007 loads
  `a11y.js`; 010/032/046/087 link `base.css`. Every page still skipping one is a recorded exception.
- **AI-08 (v218), old ranks 6, 7 and 81:** 014/033 load `a11y.*` once; `.share-note` and the header/back-link/card
  rules are in `base.css`, the tint tokens in `ink-paper.css`. Rank 5 (035's theme) is Devon's call and untouched.
- **AI-12 (v217):** README URL, 028's upload hint. **AI-11 (v216):** four dead trees and unused seating fonts deleted.

**Last merged on origin: #328, Path 4 P5 in part (`CACHE_VERSION` v216). Rank 2 stays, cut to its last half.**
- 009 can lock a backup with a passphrase (`backup-restore/br-crypto.js`, AES-GCM, PBKDF2 600k;
  off by default, never on the year-end archive). The landing app bar shows "N KB saved · backed up
  N days ago", linking to 009. Suite `smoke-encrypted.mjs`, port 8461.
- The row's restore preview/diff had **already shipped** (`smoke-restore-diff.mjs`); the row was stale.
- 009 had a literal NUL byte in its source, so `grep` silently printed nothing for it. Use `grep -a` on
  any page you suspect; 009's is fixed (`'\ufffd'`, and why it cannot be `'\u0000'` is in `HISTORY.md`).

**Before that, #326, which landed three sessions' work that had been committed only to huginn's local
`main` (AI-03, AI-07, AI-09; `CACHE_VERSION` v215).** Old rank 1 (Path 21 P4, 046's shaded relief; Path 21 is
finished), old ranks 5, 6 and 12 (the accessibility group) and old rank 8 (`check:entities` follows arrays).
- The 14 `color-contrast` allowances are fixed in the tools and `allowlist.json` is **empty**. The sweep
  finishes finite CSS animations before scanning, which is what made index's count 8/24/35.
- Light `--line-strong` is `#8c897f` (3.07:1 on card-2), dark `#6e7885`; `test:theme` now asserts 3:1.
- The sweep scans 36 pages a second time with saved state (`Tools/a11y-sweep/seeds.mjs`). It found nothing new.

**Before that, #324: a new tool outside the ranked list, 088 Braille Reading Trainer (v214)**, asked for
directly by Devon. World Language, now 8 tools. Its translator is hand-checked, not checked against liblouis.

**Before that, #321** (035's trace images onto `media-db.js`, v211; Path 4 P4 is finished), **#317** (030's board art, v210), **#315** (042's seals, v209), **#313** (071's twelve starter pictures, v208: a pin on any 071 picture was lost on reload, fixed), **#311** (080's piece atlas, v207), **#308** (the landing hero, v206), **#306** (the PWA app mark, v205), **#304** (064's card photos, v204) and **#302** (030's clue images, v203).
- `MediaDB.images({ ns, owner })` in `_shared/media-db.js` is the one copy of the shared image
  layer (#294). A future image-bearing tool uses it and writes no new copy.
- **The two Windows-only suite failures are fixed (AI-34 part, v213):** `.gitattributes` pins LF
  and 067's glyph probe no longer calls Windows' music font missing. An existing Windows clone
  needs `git rm -rq --cached .` then `git reset -q --hard` once. `HISTORY.md` has it.
- **Path 22 P1–P5 are done.** His later asks are ranks 160–168 (P6–P14), unranked by him.

**Start here.** Path 21 is finished (046's relief was its last row, AI-03), so no row needs Blender.
- Rank 1 (Path 6 P4) is blocked on rank 27, so take **rank 2**, the rest of Path 4 P5: per-tool restore
  as a shared control any tool can host (½). It needs 009's `recordDiff`/merge logic moved out of 009's
  inline script into `_shared/`, and `ToolRegistry` to pick one tool's keys. Pair it with another ½ or two
  ¼ rows. A new suite takes port **8481** (8480 is the export kit's `smoke-export.mjs`, 8479 is 016's `smoke-print.mjs`, 8478 is 017's, 8477 is 018's, 8476 is 064's, 8475 is 040's, 8474 is 051's, 8473 is 074's, 8472 is 042's, 8471 is 023's, 8470 is 043's, 8469 is 077's `smoke-print.mjs`, 8468 is 070's, 8467 is 076's, 8466 is `smoke-print-tail.mjs`, 8465 is 035's `smoke-print.mjs`, 8464 is `audit-print.mjs`, 8459 is 046's `smoke-relief.mjs`, 8460 is 088's, 8461 is 009's
  `smoke-encrypted.mjs`, 8462 is the print kit's `smoke-print-kit.mjs`, 8463 is `smoke-pairing-qr.mjs`).
- **huginn's shared checkout** (`/home/devon/projects/AI_Tools`): local `main` now contains origin's `main`
  (AI-sync's merge) and is ahead of it by the local-only sessions above. It has not been pushed. The
  `backup/ai-03-relief` and `backup/ai-07-ai-09-local-main` branches on origin are #326's copies of work
  that is now on both sides.
- A prompt that names a row wins over the rule above.
- **End every session by writing the prompt for the next one** (Devon, 2026-09-29): after the
  step-6 merge, put it in your final message *and* in the handoff PR's body, so it is in
  GitHub as well as the chat. See "Definition of done", step 7.

**Decisions only Devon can make — surfaced, not taken.**
- **Interleave per-tool improvements with platform work?** Standing decisions say "keep
  platform first"; every per-tool idea sits at rank 78 or below.
- **A periodic human device check** (about 30 minutes with a phone, a laptop and a printer):
  the parked list under Cross-cutting ("Parked — needs a person").

**Numbers (2026-10-03, huginn's local `main` after AI-sync's merge; re-measure, do not carry forward):**

| Fact | Value |
|---|---|
| `CACHE_VERSION` | `v251` on local `main` (origin was at v240 when fetched on 2026-10-05, with #349's v241 waiting on CI) — `check:precache -- --base origin/main` is the thing to trust |
| Precache entries | **315** in `PRECACHE_URLS`, **96** in `SHELL_URLS`. Bytes summed on huginn 2026-10-03 (v222): **12,727,631 B (12.73 MB) / 2,996,269 B (3.00 MB)** shell, up from 11.21 / 2.52 MB after #267. Path 21's budget is 2 MB, ≤ 250 KB of it shell; **492,651 B** ledgered, **140,806 B** of it shell (`check:art` enforces both) |
| Suites | **213** in `Tools/board-check/suites.json`; `expectedFailures` empty |
| Read-only guards | **13**: `dedupe`, `tests`, `social`, `precache`, `entities`, `hidden-flex`, `print-clip`, `registry`, `lint`, `docs-commands`, `adoption`, `inline-sinks`, `art`. All run in CI |
| Inline markup sinks | **434** across the 54 pages that take link input (`check:inline-sinks` baseline) |
| Accessibility allowlist | **0**. The sweep scans 89 pages (index and 88 tools) empty and 48 of them again seeded (`Tools/a11y-sweep/seeds.mjs`) |
| Tool registry | 89 rows, **221 keys and 32 prefixes across 122 files** (`check:registry`); **54** key/prefix entries carry `student: true` (a grep for `{ k:`/`{ p:` lines with the flag; the 49 this cell used to say came from an unwritten rule) |
| Shared-file adoption (of 88) | `sw-register.js` 87 · `a11y.css` 86 · `a11y.js` 86 · `ink-paper.css` 78 · `base.css` 72 · `qr-draw.js` 60 · `share.js` 54 · `state-link.js` 54 · `store.js` 37 · `roster.js` 33 · `print-area.css` 31 · `media-db.js` 14 · `print-kit.css` 13 · `print-kit.js` 13 · `qr-scan.js` 10 · `stage.js` 10 · `export.js` 9 · `tool-registry.js` 8 · `webrtc-pair.js` 8 · `handoffs.js` 6 · `theme.css` 5 · `countdown.js` 3 · `gvb-save.js` 1 (+1 via a module) · `seating-read.js` 1 · `student-details.js` 1 (+1 via a module) |
| Printing | 78 tools call `window.print()`; 55 tool pages contain `@media print` (`grep -lE '@media\s+print' Tools/[0-9]*.html`, 2026-10-05, after 017 and 016 lost theirs; the 55 this cell said was counted some other way, not written down). `path7:next`: 4 pages with a finding (015, 042, 046, 064, all fixed-size on purpose), TAIL 0, 0 not measured, 10 with no print path, 0 blank sheets, 4 print buttons that open a panel or dialog instead of printing (015 ×3, 044) |
| Tools | 88 (`001`–`088`); next free number **089** |
| Tier 1 rows | **168**, contiguous (counted 2026-10-05; the 170 this cell said before P3's row went was one too many). Path 21 is finished; per-tool rows start at rank **78**; 160–168 are Path 22 P6–P14 |
| Art | **130** ledger entries: 046's relief (29,726 B), 030's board backdrop and tiles (5,348 B), 042's ten seals and ribbons (84,170 B), 071's twelve pictures (157,454 B), 080's piece atlas (43,318 B), 87 tool icons, the sprite (58,032 B), 4 shortcut PNGs, the 4 app-mark PNGs (14,457 B), the 4 hero WebPs (64,832 B), the test tile's light/dark pair |
| Dark mode / fullscreen | 92 of 92 themed pages native dark (`path5:next`; 8 live pages load no `a11y.js`: 035 is rank 5's decision, the rest are standalone on purpose); `stage.js` on 10 pages. Path 5 is finished |
| CI | Pull requests run `--changed`; a push to `main` runs everything, ~32 min. A PR touching `_shared/`, `index.html`, `package.json` or `Tools/board-check/` is site-wide (#296's took 38 min) |
| Lint | clean |

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
| Rank 5 | 035's private four-palette theme system: adopt `a11y.js`, or bless it as a documented exception? | **Default: bless and document**, unless Path 5 P4 is opening 035 anyway — in which case adopt while you are already in the file. Adopting cold is a re-skin of a 5,500-line tool for no user-visible gain. `test:theme` already stops the situation spreading. *(This row cited "Rank 6 / 21" from the day it was written; rank 6 as it then stood was the `store.js` adoption row and had nothing to do with 035. The two rows it means are the 035 decision itself and Path 5 P4, which is the round that would open 035 anyway.)* |
| ~~Rank 3~~ **spent** | Rebuild `list-dark-candidates.mjs`, or measure inline? | **Rebuilt**, per the default, and shipped in #195 as `npm run path5:next`. The argument held: the first thing it produced was a corrected figure (1,749 literals, median 17) for a number this file had been carrying as "17–45 per tool" and had already had to delete once. |
| ~~Rank 5~~ **spent** | Contrast round before or after Path 5 P3? | **After**, and that is how it went: AI-07 (v215) cleared the last 14 allowances once Path 5 had finished. |
| Path 8 | Is a paired *student* device ever in scope? | **No.** Teacher-device-only. |
| Rank 52 (Path 17 P5) | Is an on-demand, non-precached Tesseract download acceptable under the offline promise? | **Default: no.** "Every tool keeps working offline once the site has been visited" is the first sentence of `CLAUDE.md` and the reason there is no CDN anywhere on this site; a feature that silently needs the network on first use is a different promise, and a teacher meets it in the one room where the wifi is bad. Vendoring a full Tesseract build (~10 MB+) into the precache is the other option and is worse. **So: no OCR until someone reverses this**, and the honest version of the row is "OCR is out of scope", not "OCR, pending a decision". This is the one question here that is about what the product *is* rather than how it is built — it is the first row to bring to Devon if he ever does want to spend a decision — it sits at rank 52, roughly thirty rounds out at two rows a session, so it is not urgent. |
| Any time | Should CI also run `offline:build` + `offline:verify`? | **Default: yes, on `main` only, not on pull requests.** Nobody has wired it; it is not a ranked row and would fit inside any site-level round. |
| ~~Rank 1~~ **spent** | Path 21: Blender-rendered art first, including student-facing art? | **Decided by Devon, 2026-09-25**, not by a session: Path 21 ranks first, and its student-facing rows (071's picture prompts) are authorized. Blender runs only on his own machines, headless: huginn or Windows for basic work, the Windows machine only for a row that needs a GPU and says so (2026-09-29); a session without `blender` on PATH skips these rows. The build defaults the path section writes down (the generator in `Tools/blender-art/`, the palette parsed from `ink-paper.css`, `currentColor` SVG icons, WebP renders, screenshots staying Playwright, the byte budgets) are a session's calls and are reversible; `HISTORY.md` has the reasoning. |
| ~~Any time~~ **decided** | Interleave the per-tool ideas with the platform work, or keep platform first? | **Keep platform first** — the order the table is in. The path survey's argument stands: most per-tool work depends on a `_shared/` service that does not exist yet, and the two biggest rollouts of 2026-09-04 were pure adoption precisely because the services had shipped first. This was "left for Devon" until 2026-09-05. Reversing it is a re-rank, which is still not a session's call. |

### Live blockers and corrections carried forward

- **`npm run path5:next` exists now — this blocker is spent.**
  `Tools/board-check/list-dark-candidates.mjs` was built on 2026-09-05, and
  `check:docs-commands`'s `KNOWN_MISSING` entry for `path5:next` was deleted in the same
  PR, which is exactly the expiry the arrangement was designed for: check 3 of that guard
  would have gone red on the next run if the entry had outlived the gap. `KNOWN_MISSING`
  is empty again, and empty is its healthy state. The history — a Wave A1 handoff claiming
  the script shipped in #167 and quoting its output as the Path 5 rollout backlog, the
  third of three tools documented and never committed — is in `HISTORY.md`. Two of those
  three are still missing, and stay deleted (AI-34, 2026-10-02): `sync-social-tags.mjs` and the original `board-check`
  folder. No page claims a generator any more.
- **The "17–45 hardcoded literals per tool" figure for Path 5 P3 was wrong**, was removed
  in #169 rather than replaced (it swept in `white-space`, `@media print` blocks and
  inline script), and now has a replacement that comes from a script:
  **1,497 colour literals across the 68 pages still on the filter — median 16 per page,
  range 3–69, none at zero** (2026-09-05, after #198). Read it off `npm run path5:next`, do not carry it forward:
  it moves every time a page is converted. **And check the page count before you trust a run** —
  until #214 the script walked the filesystem instead of `git ls-files`, so on any tree where
  `npm run offline:build` had been run it swept `Tools/board-check/.offline-copy-staging/` and
  doubled everything. The tell is the first line: **97 live pages is right, 188 is the bug.** The script counts a literal only in a
  colour-bearing property, only inside `<style>`, never inside `@media print` and never
  inside a rule that is already dark work; its header says so in full.
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
- **huginn (Devon's Linux box).** Since 2026-09-29 it has `node` v22.11.0 and `blender` 5.2.2 LTS
  on PATH, both in `~/.local/bin` (Blender is a symlink into `~/.local/blender/`). Earlier sessions
  found neither and installed Node 22 into their scratchpads; check `node --version` first. Run
  `npm ci`, then run browser suites with `PW_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome` (Chrome 154,
  newer than the pinned Playwright's; CI is the authority).
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

Ranks are a single contiguous 1..171 order with no ties. **Area** is a tool number,
`_shared/`, or `site`. **Size** is quarter / half / one / two-plus sessions. **Claimed** is the
concurrency mechanism described above — leave it empty unless you are working the row.
**Detail** links to the section in Tier 2 that carries the idea in full.

**How this order was arrived at, so you can argue with it.** **1–5 are Path 21,
Blender-rendered art, put first by Devon on 2026-09-25** (eight rows; P1, P2 and P3 shipped in #263, #306 and #308). That is the one re-rank on record that
was his call rather than a session's, and every one of those rows is skipped by a session
without `blender` on PATH. **From 6 down,** the order is the one the sources
already implied, not a re-ranking. The Stage 2 dependency chain has shipped out of the top of
it entirely — storage, the registry, the roster service, the share sheet, the two
documentation guards, the last two quarter-session rows (#191) and the last two storage-era
adoptions (#193). **1–3** are now the dark-mode groundwork and the Path 5 rollout it feeds.
**4–12** are the remaining Stage 2 rollouts and the corrections they unblock. **13–95** are
the remaining platform and cross-tool paths in the path survey's own leverage ranking, phase
by phase, ending with the platform swings no path covers. **96–177** — every row whose Area
is a tool number — are the per-tool ideas: first the named enhancements from the retired
ranked table in their existing order, then the remaining tools in tool-number order, where no
priority is implied among them.

*(Boundaries shift down by two every time a batch of two ships. Only one of them is exact,
and it is the one worth checking: the rank from which the Area
column is a tool number and stays one, **99** as of 2026-09-29, after Path 21's eight rows
went in on top and P1, P2 and P3 shipped. Path 21's own per-tool rows, 1–5, have tool-number Areas but sit above the
boundary by Devon's re-rank, which is why "stays one" is part of the definition. Measured by walking the table
from the bottom until an Area is not three digits — do not derive it by subtraction, which is
how the figure it replaced ("104") went wrong in the first place. Everything else here
describes the order rather than measuring it, and the old text's "39 enhancement rows then 42
other tools" — 81 for a block 82 rows long — is why that distinction is written down.)*

**The one place the sources disagreed, now decided.** The path survey says platform work
comes first because most tool work depends on it; the per-tool ranked table was written to be
worked from rank 1 down. Following the newer document puts every named per-tool enhancement
below rank 78, and **that is the order this table is in and stays in** — see
[Standing decisions](#standing-decisions). Interleaving them, one tool batch per platform
phase, is the alternative; it is a re-rank, and a re-rank is still not a session's call.

| Rank | Item | Area | Size | Claimed | Detail |
|---:|---|---|---|---|---|
| 1 | Path 6 P4 rollout. The mechanism shipped in #242 (v174: `_shared/handoffs.js`, `share.param` on the registry, the sheet's Send row, 052 → 040). **Increment 1 (#257, v182):** 046 → 015, 056 → 028 (`sheet: false`) and 039 → 040 are entries; **003 → 037 is a documented exception** (student scores never ride a link); `share.js` gained `sendState(entry)` and `sheet: false`. **Increment 2 (#259, v183), the roster chain:** **002 → 022** is a sheet row and **022 → 005** a `sheet: false` entry from 022's "Seat these groups" button; **006/007 → 002 is not a link** (the roster already reaches 002 through `roster.js`). **Left: only 053 → 030, which is blocked on rank 27** (Path 12 P1, the question bank with 030 as the front door). Do not start this row until rank 27 has shipped; then it is one entry plus a row in `smoke-send-to.mjs` | site | ¼ | | [Path 6](#path-6--share-everywhere) |
| 2 | Path 4 P5 (rest) — per-tool restore as a shared control any tool can host | 009 | ½ | | [Path 4](#path-4--storage-primitive-tool-registry-media-store) |
| 3 | Path 3 P5 — photos and flags on the shared student record (needs Path 4 P3) | site | 1 | | [Path 3](#path-3--roster-service-and-stable-student-identity) |
| 4 | Path 3 P6 — year rollover: archive, clear student data, keep setup (jointly with 009). **Includes the seven mixed keys the 2026-09-23 audit found:** student names inside teacher content, which a whole-key delete cannot separate. Split the student field out of each, or teach 009 a per-field clear. Start with the most sensitive: `subPlanBuilder.standingDetails.v1`'s `medicalAlerts` (044). The rest: `gvb-certificate-maker:data:` (042), `crcg:data:` (050), `gvb-review-board:data:` teams (030), `qr-code-generator-inventory` checkouts (016), `data-chart-builder-datasets` (038), `qr-scavenger-hunt-sets` live-run teams (018). See `HISTORY.md`, 2026-09-23. **Designed 2026-10-05 (AI-15), not built:** the design is Path 3's P6 bullet. It found that today's rollover in 009 archives no IndexedDB (student photos are lost), verifies nothing, and deletes setup held inside 21 student-marked keys; four more mixed keys; and ten questions that are Devon's, which the build waits on | site | 1 | | [Path 3](#path-3--roster-service-and-stable-student-identity) |
| 5 | Decide 035’s private four-palette theme system: adopt `a11y.js`, or bless it as a documented exception | 035 | ¼ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 6 | Path 7 P4 — `_shared/export.js`. **Increments 1 to 5 shipped (AI-13, v243 to v249):** `ExportKit` has the imposition and pagination math, `toPdf(pages, opts)` for pages a tool can draw, and the file helpers `toCsv`, `toXlsx`, `toZip`, `download` and `filename`; 064 (Download PDF, print pagination, and since v248 its zip and PNG downloads), 040 (print pagination and backs) and 011 (booklet and pages per sheet, v248) are on it, and `_shared/duplex-print.js` is deleted. **Increment 5 (AI-13, v249):** 003, 008, 018, 033, 068 and 075 save their CSV through `toCsv` and `download` (`npm run test:csv-adopters`, port 8486). **Left:** two more CSV writers, 001 and 006, which also write a workbook with `XLSX.writeFile` (the first `toXlsx` adopters; 006 has an import to round-trip), then the workbook-only 030 and 036; 035's template and 060's results are AI-31's pages to move. `toXlsx` has no adopter. Nothing else in P4 is open. A slot is not clipped and turns 0 or 180 only. Ordinary work, no Fable needed | `_shared/` | 2+ | | [Path 7](#path-7--print-and-export-kit) |
| 7 | Path 7 P5 — a real in-page print preview with `@page` size emulation | `_shared/` | 1 | | [Path 7](#path-7--print-and-export-kit) |
| 8 | Path 8 P1 — `_shared/remote.js` + a generic `remote.html` join page; reconnect on drop | `_shared/` | 1 | | [Path 8](#path-8--phone-as-remote-and-pairing-rollout) |
| 9 | Path 8 P2 — phone-as-remote rollout: 007, 030, 021, 004, 023/025/024, 001, 010 | site | 2+ | | [Path 8](#path-8--phone-as-remote-and-pairing-rollout) |
| 10 | Path 8 P3 — `Remote.display()`: the room sees one thing, the teacher another | `_shared/` | 1 | | [Path 8](#path-8--phone-as-remote-and-pairing-rollout) |
| 11 | Path 8 P4 — device-to-device project transfer through the share sheet | `_shared/` | 1 | | [Path 8](#path-8--phone-as-remote-and-pairing-rollout) |
| 12 | Path 9 P1 — bell schedules per day type in 032 + `_shared/school-day.js` | 032 | 1 | | [Path 9](#path-9--the-school-year-spine-calendar-bell-schedules-grading-periods) |
| 13 | Path 9 P2 — pacing that recomputes around lost days (**designed 2026-10-05, not built**: the design and ten questions for Devon are under the P2 bullet; it still waits on its place in the order) | 032 | 2+ | | [Path 9](#path-9--the-school-year-spine-calendar-bell-schedules-grading-periods) |
| 14 | Path 9 P3 — consumers: 004, 010, 001, 036/037, 044/045, 032 itself | site | 2+ | | [Path 9](#path-9--the-school-year-spine-calendar-bell-schedules-grading-periods) |
| 15 | Path 9 P4 — `.ics` import/export and a one-page year wall calendar print | 032 | 1 | | [Path 9](#path-9--the-school-year-spine-calendar-bell-schedules-grading-periods) |
| 16 | Path 10 P1 — Packet Builder `087` with the section-provider registry | 087 | 2+ | | [Path 10](#path-10--packet-builder-and-the-sub-day-product) |
| 17 | Path 10 P2 — 045 re-based on the providers; its six raw key reads go away. **Then give 045 the share sheet** — the last tool Path 6 P3 left, held back only so its payload is not re-shaped the week after it ships; follow the P3 working notes in the Path 6 section | 045 | 1 | | [Path 10](#path-10--packet-builder-and-the-sub-day-product) |
| 18 | Path 10 P3 — the evergreen emergency binder, with a staleness reminder | 045 | 1 | | [Path 10](#path-10--packet-builder-and-the-sub-day-product) |
| 19 | Path 10 P4 — 044 pulls from the calendar, prompt banks and seating instead of being typed | 044 | 2+ | | [Path 10](#path-10--packet-builder-and-the-sub-day-product) |
| 20 | Path 10 P5 — round trip: share the plan by link/QR, capture what the sub said | 044 | 1 | | [Path 10](#path-10--packet-builder-and-the-sub-day-product) |
| 21 | Path 11 P1 — publisher drift guard before any extraction. **Designed 2026-10-05 (AI-20), not built: the P1 bullet has the whole design and seven questions for Devon** | 035 | 1 | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 22 | Path 11 P2 — extract the pure engines; target the HTML under ~300 KB. **Designed 2026-10-05 (AI-20), not built: the P2 bullet has the whole design, a measured ladder of eleven increments (the page is 968 KB; the engines alone leave it at about 620 KB, the full ladder at about 270 KB), and five questions for Devon** | 035 | 2+ | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 23 | Path 11 P3 — accessibility routing: wheelchair/elevator-weighted routes and a printable report | 035 | 1 | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 24 | Path 11 P4 — safety printing: evacuation cards, lockdown maps, door-sign sets | 035 | 1 | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 25 | Path 11 P5 — master-schedule assistance: constraint checks, congestion, multi-year comparison | 035 | 2+ | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 26 | Path 11 P6 — published browser: runtime-swappable data, expose the pathfinder, sub coverage | 034 | 1 | | [Path 11](#path-11--schedule-visualizer-modularize-guard-the-publisher-route-accessibly) |
| 27 | Path 12 P1 — `_shared/question-bank.js` with 030 as the front door | `_shared/` | 1 | | [Path 12](#path-12--question-bank-hub-one-bank-played-six-ways) |
| 28 | Path 12 P2 — read-side adopters: 053, 062, 040, 018, 019, 020 | site | 2+ | | [Path 12](#path-12--question-bank-hub-one-bank-played-six-ways) |
| 29 | Path 12 P3 — play modes in 030: every-team-answers, quiz-bowl, wheel, final wager, printed quiz | 030 | 1 | | [Path 12](#path-12--question-bank-hub-one-bank-played-six-ways) |
| 30 | Path 12 P4 — clue images into the media store; media travels in export | 030 | ½ | | [Path 12](#path-12--question-bank-hub-one-bank-played-six-ways) |
| 31 | Path 13 P1 — one grouping engine: `formGroups`, `rotateRoles`, id-keyed history (**designed 2026-10-05, not built**: the design and ten questions for Devon are under the P1 bullet) | `_shared/` | 1 | | [Path 13](#path-13--grouping-rotation-and-bracket-engine) |
| 32 | Path 13 P2 — adopt in 002, 022, 027, 007; seating-aware grouping and project teams | site | 2+ | | [Path 13](#path-13--grouping-rotation-and-bracket-engine) |
| 33 | Path 13 P3 — `_shared/bracket.js` + `_shared/rotation.js`; fix 021’s silent overwrite bug | `_shared/` | 1 | | [Path 13](#path-13--grouping-rotation-and-bracket-engine) |
| 34 | Path 13 P4 — bracket completeness: double elimination, pools, Swiss, ties, consolation | 020 | 2+ | | [Path 13](#path-13--grouping-rotation-and-bracket-engine) |
| 35 | Path 14 P3 — seating constraint solver that explains which soft constraints it broke | 005 | 2+ | | [Path 14](#path-14--seating-chart-room-model-constraint-solver-phone-toolbar) |
| 36 | Path 14 P4 — the room, not the grid: a room layer shared across period assignments | 005 | 2+ | | [Path 14](#path-14--seating-chart-room-model-constraint-solver-phone-toolbar) |
| 37 | Path 14 P5 — live mode; extract the undo stack into `_shared/undo.js` | 005 | 1 | | [Path 14](#path-14--seating-chart-room-model-constraint-solver-phone-toolbar) |
| 38 | Path 15 P1 — split Name Picker: themes as data, sound, one module per pick mode | 007 | 1 | | [Path 15](#path-15--name-picker-split-equity-dashboard-themes-as-data) |
| 39 | Path 15 P2 — per-day history rollup keyed on student ids | 007 | 1 | | [Path 15](#path-15--name-picker-split-equity-dashboard-themes-as-data) |
| 40 | Path 15 P3 — equity dashboard across weeks and periods, printed as one page | 007 | 1 | | [Path 15](#path-15--name-picker-split-equity-dashboard-themes-as-data) |
| 41 | Path 15 P4 — question-attached picks | 007 | ½ | | [Path 15](#path-15--name-picker-split-equity-dashboard-themes-as-data) |
| 42 | Path 15 P5 — artifacts and remotes: hand off to grouping and the bracket; theme packs as JSON | 007 | 1 | | [Path 15](#path-15--name-picker-split-equity-dashboard-themes-as-data) |
| 43 | Path 16 P1 — `_shared/chart-svg.js` with 037’s accessibility patterns; 038 gets the a11y baseline | `_shared/` | 1 | | [Path 16](#path-16--the-grades-trio-and-a-shared-chart-engine) |
| 44 | Path 16 P2 — `_shared/paste-table.js`, one parser for pasted spreadsheet regions | `_shared/` | 1 | | [Path 16](#path-16--the-grades-trio-and-a-shared-chart-engine) |
| 45 | Path 16 P3 — per-question item analysis in 037 and a printed reteach priority list | 037 | 1 | | [Path 16](#path-16--the-grades-trio-and-a-shared-chart-engine) |
| 46 | Path 16 P4 — 036 modelling: term count, scenario modelling, grading window, roster join | 036 | 2+ | | [Path 16](#path-16--the-grades-trio-and-a-shared-chart-engine) |
| 47 | Path 16 P5 — 038 for science: regression, log axes, annotation layer, handoffs to 065 and 073 | 038 | 1 | | [Path 16](#path-16--the-grades-trio-and-a-shared-chart-engine) |
| 48 | Path 17 P1 — thumbnail-grid reordering, crop/straighten, real-photo validation of the retry presets | 011 | 1 | | [Path 17](#path-17--image--pdf-as-a-document-scanner-a-local-pdf-layer) |
| 49 | Path 17 P2 — scanner mode: quadrilateral detection, perspective warp, adaptive threshold | 011 | 2+ | | [Path 17](#path-17--image--pdf-as-a-document-scanner-a-local-pdf-layer) |
| 50 | Path 17 P3 — PDF in: vendor `pdf.js`, merge/insert/extract/rotate existing PDFs | 011 | 2+ | | [Path 17](#path-17--image--pdf-as-a-document-scanner-a-local-pdf-layer) |
| 51 | Path 17 P4 — imposition. **Built (AI-13, v248, under Path 7 P4): 011 has booklet, 2/4/6/9 pages to a side with cut marks, either flip edge, creep.** Left: print and fold a 16-page booklet once and record it; then, only if asked for, a preset for a one-sided printer (fronts, then backs) and signatures for a thick booklet, both already in `ExportKit` | 011 | ¼ | | [Path 17](#path-17--image--pdf-as-a-document-scanner-a-local-pdf-layer) |
| 52 | Path 17 P5 — OCR, decision first: a vendored Tesseract build against the offline promise | 011 | ½ | | [Path 17](#path-17--image--pdf-as-a-document-scanner-a-local-pdf-layer) |
| 53 | Path 18 P1 — one station/room/hunt schema both 018 and 019 can read, with stable station ids | `_shared/` | 1 | | [Path 18](#path-18--escape-room-and-scavenger-hunt-convergence) |
| 54 | Path 18 P2 — both tools on the schema, plus the payload budget and a printed short-code fallback | 018 | 1 | | [Path 18](#path-18--escape-room-and-scavenger-hunt-convergence) |
| 55 | Path 18 P3 — feature parity between 018 and 019; questions from the bank | 019 | 2+ | | [Path 18](#path-18--escape-room-and-scavenger-hunt-convergence) |
| 56 | Path 18 P4 — the debrief print: per-team path, time per station, misses, reflection page | 019 | 1 | | [Path 18](#path-18--escape-room-and-scavenger-hunt-convergence) |
| 57 | Path 18 P5 — decide the product: two entry points on one engine, or one tool with a mode switch | 018 | ¼ | | [Path 18](#path-18--escape-room-and-scavenger-hunt-convergence) |
| 58 | Path 19 P1 — `_shared/word-list.js`, owned by a Word Lists hub inside 040 | `_shared/` | 1 | | [Path 19](#path-19--vocabulary-hub-and-conjugation-engine) |
| 59 | Path 19 P2 — adopters: 040, 039, 014, 027, 051, 052; delete `vfg-conjdrill-link.js` | site | 2+ | | [Path 19](#path-19--vocabulary-hub-and-conjugation-engine) |
| 60 | Path 19 P3 — conjugation pattern engine for Spanish and French, with irregular overrides | 039 | 2+ | | [Path 19](#path-19--vocabulary-hub-and-conjugation-engine) |
| 61 | Path 19 P4 — printables: Frayer page, spaced repetition, fill-in-the-blank, word wall as a system | 040 | 1 | | [Path 19](#path-19--vocabulary-hub-and-conjugation-engine) |
| 62 | Path 19 P5 — audio: TTS on study mode, teacher-recorded pronunciations into the media store | 051 | 1 | | [Path 19](#path-19--vocabulary-hub-and-conjugation-engine) |
| 63 | Path 20 P1 — `_shared/geo-project.js` + `traceFeature`, hit-test and the curriculum gazetteer | `_shared/` | 1 | | [Path 20](#path-20--blank-map-live-vectors-dropped-geojson-shared-geometry) |
| 64 | Path 20 P2 — dropped GeoJSON/TopoJSON as a base map | 046 | 1 | | [Path 20](#path-20--blank-map-live-vectors-dropped-geojson-shared-geometry) |
| 65 | Path 20 P3 — live vector viewer, keeping the raster path for poster export | 046 | 2+ | | [Path 20](#path-20--blank-map-live-vectors-dropped-geojson-shared-geometry) |
| 66 | Path 20 P4 — time slices for annotations; two-way selective handoff with 015 | 046 | 2+ | | [Path 20](#path-20--blank-map-live-vectors-dropped-geojson-shared-geometry) |
| 67 | Path 20 P5 — quiz memory across sessions; decide the Wikimedia network question | 046 | 1 | | [Path 20](#path-20--blank-map-live-vectors-dropped-geojson-shared-geometry) |
| 68 | Track B1 — brand engine in `a11y.js`: school accent and logo, pre-paint, with an opt-out flag | `_shared/` | 1 | | [Track B](#track-b--custom-theme--branding-pass) |
| 69 | Track B2 — school-branding settings UI in the a11y widget, with a contrast warning | `_shared/` | 1 | | [Track B](#track-b--custom-theme--branding-pass) |
| 70 | Track V1 — `_shared/voice.js` (opt-in, push-to-talk, disclosed) + Name Picker commands | `_shared/` | 1 | | [Track V](#track-v--voice-command-input) |
| 71 | Track V2 — voice commands in 008 Behavior & Points Tracker | 008 | ½ | | [Track V](#track-v--voice-command-input) |
| 72 | First-run "Load sample data" across the tools that open to an empty form (P15) | site | 2+ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 73 | Phone-sized layout pass beyond 005 — cap or collapse oversized toolbars site-wide | site | 1–2 | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 74 | `_shared/levels.js` — one home for Academic / Honors / Honors GT and the level footer tag | `_shared/` | ½ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 75 | A shared plain-language social-studies glossary (056 ships ~60 entries; 028 and 040 want the same) | `_shared/` | ½ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 76 | `regionGroupCaption()` — one list-to-sentence formatter the whole site agrees on | `_shared/` | ¼ | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 77 | Data-driven `index.html` — 86 hand-written rows and three hand-maintained counts | site | 1 | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 78 | Wiki Race (086): teacher scoreboard from finish codes, an offline corpus mode, a Node suite for the seed logic | 086 | 1 | | [Cross-cutting](#cross-cutting-work-sweeps-and-loose-ends) |
| 79 | Speaking assessment layer — a short rubric per pair while circulating, stored per class, printed as a per-student speaking record | 014 | ½ | | [014 Immersion Roleplay Scenario Generator](#014--immersion-roleplay-scenario-generator) |
| 80 | Task-organized prompt library — grouped by teaching task, each entry loading a full form state | 029 | ½ | | [029 Prompt Builder](#029--prompt-builder) |
| 81 | Cover page, headers, and page numbers across the merged document | 031 | ½ | | [031 Word Doc Merger](#031--word-doc-merger) |
| 82 | Printable parent reading report — one page per student, batch-printed for conferences | 033 | ½ | | [033 Silent Reading (SSR) Log Tracker](#033--silent-reading-ssr-log-tracker) |
| 83 | Per-question item analysis — chart which questions the class missed, print a reteach priority list | 037 | ½ | | [037 Grade Distribution Visualizer](#037--grade-distribution-visualizer) |
| 84 | Chart annotation layer — arrows, text callouts and shaded regions so a printed figure makes an argument | 038 | ½ | | [038 Data Table → Chart Builder](#038--data-table--chart-builder) |
| 85 | Conjugation pattern engine — generate the full regular table from an infinitive and verb class | 039 | ½ | | [039 Vocab & Conjugation Drill Generator](#039--vocab--conjugation-drill-generator) |
| 86 | Local math notation renderer — fractions, radicals, exponents, subscripts, Greek letters | 041 | ½ | | [041 Formula Reference Sheet Builder](#041--formula-reference-sheet-builder) |
| 87 | Templates as data — layout, fonts, borders and colors as template objects, so new designs need no code | 042 | ½ | | [042 Certificate & Award Maker](#042--certificate--award-maker) |
| 88 | Evergreen emergency binder — date-independent sections only, with a staleness reminder | 045 | ½ | | [045 Sub Binder / Day Bundle Generator](#045--sub-binder--day-bundle-generator) |
| 89 | Rubric-scored critique variant — an optional per-step point scale and teacher score column | 047 | ½ | | [047 Art Critique Worksheet Generator](#047--art-critique-worksheet-generator) |
| 90 | Bulk photo import — a whole folder at once, downscaled and auto-matched by filename | 048 | ½ | | [048 Student Art Portfolio Label & QR Tag Maker](#048--student-art-portfolio-label--qr-tag-maker) |
| 91 | Spreadsheet book-list import via the shared SheetJS build, with a genre-balance warning | 049 | ½ | | [049 Book Tasting Menu Generator](#049--book-tasting-menu-generator) |
| 92 | Teacher-recorded audio fallback via MediaRecorder, so labels work with no target-language voice | 051 | ½ | | [051 Classroom Label Maker (Target Language)](#051--classroom-label-maker-target-language) |
| 93 | Practice worksheet variants — matching, fill-in-the-blank and "trap or true cognate" with answer keys | 052 | ½ | | [052 Cognates & False Friends Reference List Builder](#052--cognates--false-friends-reference-list-builder) |
| 94 | Export into Review Game Board — emit the question set in the board’s category/points format | 053 | ½ | | [053 Cultural Trivia Card Generator](#053--cultural-trivia-card-generator) |
| 95 | Bulk-import a custom bank — paste a whole list of broken-and-fixed pairs | 055 | ½ | | [055 Daily Editing / DOL Warm-Up Generator](#055--daily-editing--dol-warm-up-generator) |
| 98 | Hand off to Lab Report Builder pre-filled with question, hypothesis, materials and procedure | 059 | ½ | | [059 Scientific Method / Experiment Design Planner](#059--scientific-method--experiment-design-planner) |
| 101 | Multiple saved custom stories — named multi-save for templates plus their word banks | 063 | ½ | | [063 Grammar Mad Libs Generator](#063--grammar-mad-libs-generator) |
| 102 | Pre-lab and post-lab packet split from one saved template | 065 | ½ | | [065 Lab Report Template Builder](#065--lab-report-template-builder) |
| 103 | Bulk import a custom bank — paste problem/work/fix/explain rows for a whole unit | 066 | ½ | | [066 Math "Find the Mistake" Warm-Up Generator](#066--math-find-the-mistake-warm-up-generator) |
| 104 | Metronome and reference pitch — wire the decorative tempo field to a real click track | 067 | ½ | | [067 Music Sight-Reading / Rhythm Warm-Up Generator](#067--music-sight-reading--rhythm-warm-up-generator) |
| 105 | Conference print packet — one student’s full contact history plus a blank note area | 068 | ½ | | [068 Parent/Guardian Contact Log](#068--parentguardian-contact-log) |
| 106 | Live circuit rotation timer — a projector mode that counts down each station and signals the rotation | 069 | ½ | | [069 PE Warm-Up Circuit Card Generator](#069--pe-warm-up-circuit-card-generator) |
| 107 | Roster-driven pre-named half-sheets — read `np_rosters` and print one per student | 070 | ½ | | [070 Peer Feedback / Editing Checklist Generator](#070--peer-feedback--editing-checklist-generator) |
| 108 | Multiple named saved image sets, so two vocabulary libraries coexist without re-uploading | 071 | ½ | | [071 Picture-Prompt Speaking/Writing Task Generator](#071--picture-prompt-speakingwriting-task-generator) |
| 109 | Share a diagram by link, so the same novel’s diagram moves between class periods | 072 | ½ | | [072 Story Elements / Plot Diagram Builder](#072--story-elements--plot-diagram-builder) |
| 110 | Multiple named saved trackers — one per class period’s science-fair cohort | 073 | ½ | | [073 Science Fair Project Tracker](#073--science-fair-project-tracker) |
| 111 | Two symbols per label — across the edit form, duplicate logic and the printed card | 074 | ½ | | [074 Science Safety Symbol & Equipment Label Maker](#074--science-safety-symbol--equipment-label-maker) |
| 112 | Wallet-card layout with QR — a lanyard insert with a phone or email link per entry | 075 | ½ | | [075 Staff Directory / Quick-Reference Builder](#075--staff-directory--quick-reference-builder) |
| 113 | Room-assignment view — define rooms and proctors, auto-route by accommodation, print proctor lists | 077 | ½ | | [077 Testing Accommodations Reference Card Generator](#077--testing-accommodations-reference-card-generator) |
| 114 | Multiple named saved prompt sets — a general slip, a lab-day slip and a testing-day slip at once | 076 | ½ | | [076 Sub Note / Feedback Slip Generator](#076--sub-note--feedback-slip-generator) |
| 115 | Named saves plus reorder and share — group and line reordering and a state-link share URL | 078 | ½ | | [078 Unit Conversion Reference Chart Builder](#078--unit-conversion-reference-chart-builder) |
| 116 | Irregular verb call-out boxes — three to five common irregulars per tense | 079 | ½ | | [079 Verb Conjugation Reference Poster Generator](#079--verb-conjugation-reference-poster-generator) |
| 117 | Two-step word problems — chained-operation templates for the upper grade band | 081 | ½ | | [081 Word Problem Warm-Up Generator](#081--word-problem-warm-up-generator) |
| 118 | Correlate hall-pass trips with the schedule; a student-initiated request flow | 001 | ½ | | [001 Digital Hall Pass / Sign-Out Log](#001--digital-hall-pass--sign-out-log) |
| 119 | Roles built into a group; project-team mode; a pair-history that spans the year | 002 | ½ | | [002 Group / Team Generator](#002--group--team-generator) |
| 120 | Peer review mode; rubric handoff to the grades tools | 003 | ½ | | [003 Rubric Builder](#003--rubric-builder) |
| 121 | Bell-schedule awareness; a multi-timer board; a reconnecting mirror | 004 | ½ | | [004 Classroom Timer](#004--classroom-timer) |
| 122 | A constraint solver worth the name; the room, not the grid | 005 | ½ | | [005 Seating Chart Generator](#005--seating-chart-generator) |
| 123 | Bulk operations across rosters | 006 | ½ | | [006 Class Roster Hub](#006--class-roster-hub) |
| 124 | `prefers-reduced-motion` respect; equity across weeks and periods | 007 | ½ | | [007 Name Picker](#007--name-picker) |
| 125 | Team / house points; longitudinal reports | 008 | ½ | | [008 Behavior & Points Tracker](#008--behavior--points-tracker) |
| 126 | Per-record conflict resolution ("keep the newer of each"; needs per-record timestamps) | 009 | ½ | | [009 Backup & Restore](#009--backup--restore) |
| 127 | Reuse the real timer; period-aware auto-advance | 010 | ½ | | [010 Command Center](#010--command-center) |
| 128 | Crop and straighten; scanner mode | 011 | ½ | | [011 Image → PDF Assembler](#011--image--pdf-assembler) |
| 129 | More grid types; number-line variants | 012 | ½ | | [012 Graph Paper & Number Line Generator](#012--graph-paper--number-line-generator) |
| 130 | Date-received per student; contract-gate reporting | 013 | ½ | | [013 Lab Safety Contract Tracker](#013--lab-safety-contract-tracker) |
| 131 | Printed ordering activity; blanking dates, not just titles | 015 | ½ | | [015 Timeline Builder](#015--timeline-builder) |
| 132 | A label under each code; batch codes from a spreadsheet | 016 | ½ | | [016 QR Code Generator](#016--qr-code-generator) |
| 133 | Peer feedback slips; gallery-walk reactions | 017 | ½ | | [017 Gallery Walk QR Codes](#017--gallery-walk-qr-codes) |
| 134 | Hints with a time penalty; branching and station images | 018 | ½ | | [018 QR Scavenger Hunt Builder](#018--qr-scavenger-hunt-builder) |
| 135 | Attempt limits and feedback; a non-QR fallback | 019 | ½ | | [019 Digital Escape Room / Puzzle Lock Builder](#019--digital-escape-room--puzzle-lock-builder) |
| 136 | Team names with members; a loser’s-side consolation bracket | 020 | ½ | | [020 Bracket / Tournament Generator](#020--bracket--tournament-generator) |
| 137 | Uneven groups and stations; a shared rotation engine | 021 | ½ | | [021 Tournament Bracket & Station Rotation (PE)](#021--tournament-bracket--station-rotation-pe) |
| 138 | Lock a group or a role and reshuffle the rest | 022 | ½ | | [022 Lab Group & Role Randomizer](#022--lab-group--role-randomizer) |
| 139 | Name and date lines on the slips; response collection questions | 023 | ½ | | [023 Exit Ticket / Bell Ringer Generator](#023--exit-ticket--bell-ringer-generator) |
| 140 | Draw on a strategy card; a shared stage | 024 | ½ | | [024 Number Talks / Mental Math Routine Board](#024--number-talks--mental-math-routine-board) |
| 141 | Sentence starters and an "if you’re stuck" line | 025 | ½ | | [025 Writing Prompt Generator](#025--writing-prompt-generator) |
| 142 | Fraction multiply/divide, exponents and one-step equations | 026 | ½ | | [026 Math Fact Drill Sheet Generator](#026--math-fact-drill-sheet-generator) |
| 143 | Discussion assessment; role recency across a book | 027 | ½ | | [027 Novel Study / Reading Circles Manager](#027--novel-study--reading-circles-manager) |
| 144 | More frameworks; a shipped starter source collection | 028 | ½ | | [028 Primary Source Analysis Worksheet Generator](#028--primary-source-analysis-worksheet-generator) |
| 145 | Projector styling; the site-wide question bank | 030 | ½ | | [030 Quiz / Review Game Board](#030--quiz--review-game-board) |
| 146 | Week-at-a-glance print; year-grid A/B badges | 032 | ½ | | [032 School Calendar Visualizer](#032--school-calendar-visualizer) |
| 147 | "Where is this student right now?"; the published pathfinder | 034 | ½ | | [034 East Middle Schedule Browser](#034--east-middle-schedule-browser) |
| 148 | Split the file; accessibility routing | 035 | ½ | | [035 School Layout Visualizer](#035--school-layout-visualizer) |
| 149 | Scenario modelling — drop lowest, curve, re-weight | 036 | ½ | | [036 Final Grade Checker](#036--final-grade-checker) |
| 150 | Image on a card; the Frayer model page | 040 | ½ | | [040 Vocabulary Flashcard & Word Wall Generator](#040--vocabulary-flashcard--word-wall-generator) |
| 151 | A second language version; trip-day rosters | 043 | ½ | | [043 Field Trip Permission Slip Generator](#043--field-trip-permission-slip-generator) |
| 152 | Seating chart and roster references by name | 044 | ½ | | [044 Sub Plan Builder](#044--sub-plan-builder) |
| 153 | Time-slice maps; live vectors | 046 | ½ | | [046 Blank Map Generator](#046--blank-map-generator) |
| 154 | A per-simulation roster memory | 050 | ½ | | [050 Government/Civics Simulation Role Card Generator](#050--governmentcivics-simulation-role-card-generator) |
| 155 | A bank of saved generic question sets beyond the six built-ins | 054 | ½ | | [054 Current Events Discussion Guide Generator](#054--current-events-discussion-guide-generator) |
| 156 | The reverse direction of the 028 pairing — pull a source out of 028’s library | 056 | ½ | | [056 DBQ / Source Packet Builder](#056--dbq--source-packet-builder) |
| 157 | Buzz-in from student devices (deferred); map-question tournaments | 062 | ½ | | [062 Geography Bee / Map Skills Quiz Generator](#062--geography-bee--map-skills-quiz-generator) |
| 158 | A student-facing fill-in mode; review-game theme packs | 064 | ½ | | [064 Historical Figure / Country Trading Card Maker](#064--historical-figure--country-trading-card-maker) |
| 159 | Snap-to-grid for base-ten blocks; export and data-driven piece families | 080 | ½ | | [080 Virtual Manipulatives Board](#080--virtual-manipulatives-board) |
| 160 | Path 22 P6 — present mode and spotlight: lock the layout (no drags, no close buttons, dock hidden) and double-click a widget to fill the board, Esc back | 087 | ½ | | [Path 22](#path-22--class-screen-a-widget-board-for-the-projector) |
| 161 | Path 22 P7 — keyboard and clicker shortcuts (Space timer, N pick, ←/→ screens) with a `?` help overlay | 087 | ¼ | | [Path 22](#path-22--class-screen-a-widget-board-for-the-projector) |
| 162 | Path 22 P8 — linked widgets: when a timer ends, flash the board, set the traffic light or tick the next agenda item | 087 | ½ | | [Path 22](#path-22--class-screen-a-widget-board-for-the-projector) |
| 163 | Path 22 P9 — more widgets: agenda checklist, visual (pie) timer, sequence timer (think/pair/share), countdown to the bell, team scoreboard, spinner wheel | 087 | 1 | | [Path 22](#path-22--class-screen-a-widget-board-for-the-projector) |
| 164 | Path 22 P10 — two tabs and memory: warn or reload when another tab saves, keep name-picker no-repeats for the browser session, undo moves and resizes | 087 | ½ | | [Path 22](#path-22--class-screen-a-widget-board-for-the-projector) |
| 165 | Path 22 P11 — layout comforts: snap to grid, minimize to a chip, per-widget colour, screen thumbnails, a large-text projector theme | 087 | ½ | | [Path 22](#path-22--class-screen-a-widget-board-for-the-projector) |
| 166 | Path 22 P12 — another site tool as a widget (same-origin frame, e.g. 024 Number Talks, 080 Manipulatives) | 087 | 1 | | [Path 22](#path-22--class-screen-a-widget-board-for-the-projector) |
| 167 | Path 22 P13 — 004's phase engine (agenda, round robin, random, overtime) onto `_shared/countdown.js` | 004 | ½ | | [Path 22](#path-22--class-screen-a-widget-board-for-the-projector) |
| 168 | Path 22 P14 — one remote wrapper: `cc-remote.js` and `cs-remote.js` onto a single `_shared/` file | `_shared/` | ¼ | | [Path 22](#path-22--class-screen-a-widget-board-for-the-projector) |

## How to work this list

### Picking a row

Take the lowest-numbered **unclaimed** rows — normally the next two, which is the standing
instruction (see [How this repo is worked](#how-this-repo-is-worked)). A batch is however
many fit the session; finishing three properly beats half-doing eight. If a row turns out to
be already shipped, impossible within the static-only constraint, or simply a bad idea once
you are in the code, say so, take the next row instead, and **fix the row** — delete it, or
rewrite it to say what is actually true — so the next session does not rediscover the same
thing. Do not stop to ask which.

**Path 21 rows need Blender: Devon's Windows machine, or huginn since 2026-09-29.** None is open
since AI-03 shipped 046's relief. Check with
`blender --version`. If it is not on PATH, skip every Path 21 row: do not claim it and do not
edit it, and take the lowest unclaimed row that is not Path 21. This is
not the parked list; the rows are workable, just not from a container.

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
session sees the claim before picking its own batch. **A claim is only visible if it
reaches `main`'s view of the table** — a claim commit pushed to a feature branch that
nobody fetches is invisible until the PR merges, which is how #239 and #240 (2026-09-08)
built the same increment twice with both sessions having "claimed" it. So, also: fetch
`main` and check the row's cell **again** just before the first implementation commit
and again before opening the PR. Clear the cell if you abandon the
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
   `lint`, `check:art`, `check:precache -- --base origin/main`, every touched tool's `test:<name>`, and
   `test:a11y -- --only <nnn>` for every touched page. **Never add an allowlist line.**
   A new tool comes in clean.
4. A new `_shared/` module ships with a pure-logic Node suite and at most one adopter.
5. Squash-merged to `main` after CI is green; merge confirmed before the session ends.
6. **Then rewrite this file's "Where things stand" header and re-rank.** After the merge
   is confirmed — not before, so it records what actually landed rather than what you
   hoped would. Take the adoption row from `npm run check:adoption` and confirm the
   result with `npm run check:adoption -- --check`; do not re-derive it by grep. Add a `HISTORY.md` entry for what shipped and what you got wrong. Commit
   and merge that too.
7. **Write the next session's prompt** (Devon's standing instruction, 2026-09-29). Once the
   step-6 PR is merged, write a self-contained prompt for the next session: which row, why
   that one, what to read first, the traps you found, the port a new suite takes, the
   machine setup, and that it too must end with a PR, a merge and a prompt of its own. Put it
   in your final message and in the step-6 PR's body. Every command it names, you have run.

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
  notes, not as a queue; do not promote one without Devon saying so. **Devon has said so once:**
  on 2026-09-25 he authorized the student-facing art in Path 21 (071's picture prompts, ranked
  first with the rest of the path). That authorization covers those rows and nothing else.
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

The nineteen paths with open phases: eighteen from the 2026-09-02 survey, and Path 21 (Blender-rendered art), added by Devon on 2026-09-25 and ranked first. Paths 1 and 2 are complete and
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
  per-student history to a Backup & Restore file, clear student data, keep setup. Owned
  jointly with 009. **Designed 2026-10-05 (AI-15, a design pass: no code, nothing run in a browser), not built.**
  The design is the rest of this bullet. It was written from reading 009, 006, `_shared/roster.js`,
  `_shared/media-db.js`, `_shared/tool-registry.js` and the code that writes each key named below; two
  read-only probes (kept outside the repo) loaded the registry in Node to count it.

  **What exists today, and what is wrong with it.** There are two rollovers, and they disagree.
  - *009, "Back up, then clear student data".* It builds one envelope of every localStorage key, downloads it,
    asks twice with `confirm()`, and removes every key `ToolRegistry.classifyKey()` calls `student`. Four faults,
    all read off the code:
    1. **The archive holds no IndexedDB.** The call is `buildEnvelope(lastScanGroups, [])`; the second argument is
       the database list. Seating Chart's student photos (`gvb-media`, namespace `seating/`) are not in the file,
       and once `seating-chart-v1` is gone 005's boot sweep deletes every photo older than ten minutes. **A
       teacher who runs today's rollover and opens 005 has the photos in neither place.**
    2. **Nothing is verified.** The second `confirm()` says "check it is in your Downloads folder". The page never
       reads the file back, so a blocked download, a full disk or a cancelled save dialog clears the year.
    3. **It deletes setup it promises to keep.** The dialog says "Your rubrics, templates, calendars and settings
       are kept" and the result line says "Your templates and settings are untouched". Of the 54 student-marked
       entries, 21 keys or families hold teacher setup beside the names (the table below): the room layout and
       saved arrangements in `seating-chart-v1`, hall-pass destinations and limits, behaviour tags and point
       values, lab contract wording and fees, lab roles and stations, novel-study roles and schedules, fitness
       events, science-fair milestones, accommodation types, PE stations, a field trip's whole text. It deletes
       `np_rosters` whole, so every class name goes, and `crh_archive_v1`, which is 006's only copy of past years.
    4. **It leaves names behind.** The mixed keys (below) are not marked, so they are kept as they are;
       `aplp-share`'s parked roster file is not looked at; an open tab of any tool writes last year back on its
       next save.
  - *006, "Start a new school year".* It files every roster under a year label inside `crh_archive_v1` (in the
    browser, not in a file), keeps the class names with empty lists, keeps period and course, and clears
    `crh_archived_students`. It touches no other tool, so points, hall passes and reading logs stay, keyed by
    name, and next year's student with the same name inherits them.

  P6 replaces both with one flow. It is run from 009; 006's button opens it.

  **The inventory, and how it was found.** The registry has 89 rows, 226 keys and 54 prefixes (probe, 2026-10-05).
  44 keys and 10 prefixes over 27 tools are `student: true` (5 of them legacy). Every one of those 54 was read at
  its write site for setup held inside it. The seven mixed keys of the 2026-09-23 audit were each re-read. Then
  every unmarked key of a tool that reads a roster (the registry's `reads`, plus a grep for `mountRosterPicker`,
  `Roster.getRoster`, `Roster.listRosters` and `np_rosters`), and of 004, 029, 044 and 045, was read for a field a
  roster fills or a student wrote. The other unmarked keys rest on the 2026-09-23 reading and were not re-read.
  Kinds, with what "clear" does to each:

  | Kind | Keys | Clear |
  |---|---|---|
  | **A. Student, nothing else** | `np_current`, `np_history`, `np_stats`, `np_hof`, `np_lucky`, `np_absent`; `crh_archived_students`; `pcl_entries_v1`, `pcl_idnames_v1`, `pcl_roster_v1`; `gvb-rubric-builder:scores:*`; `gvb-exit-ticket:tally`, `:triage`; `gvb-number-talks:strategyLibrary`; `gvb-writing-prompts:record`; `gtg-settings` (a blob 002 migrates and removes); the five legacy entries (`gtg:*`, `gvb-grade-distribution:*`, `gvb-bracket:*`, `gvb-exit-ticket:tally*`, `apl_portfolio_v1`) | delete the key |
  | **B. Student, with setup inside** | `seating-chart-v1`, `hall-pass-log-sections`, `behavior-points-tracker-sections`, `gtg:data:*`, `lsct_sections_v1`, `lgrr_rosters`, `novel-study-circles`, `sslt_sections_v1`, `fsat_tracker_v1`, `sfpt_tracker_v1`, `tacg_cards_v1`, `pe-tournament-stations`, `gallery-walk-qr-sets`, `gvb-field-trip:data:*`, `socsem:data:*`; milder: `gvb-bracket:data:*`, `gvb-grade-distribution:data:*`, `pct:lastValues`, `apl_portfolios_v1` | reduce: the student fields go to the tool's own empty value, the rest stays. A reduced family's `:list` and `:current` (and `lgrr_current`, `lsct_current_v1`, `sslt_current_v1`, `novel-study-circles-current`) are kept: the section or document they name is still there |
  | **C. Roster shells** | `np_rosters`, `crh_students_v1`, `gvb-roleplay:roster`, `crh_archive_v1` | `np_rosters`: every name kept, every list `[]`. `crh_students_v1`: `meta.period` and `meta.subject` kept, `meta.term` set to the new year, `students` and `orphans` `[]`. `gvb-roleplay:roster`: class names kept, lists `[]`. `crh_archive_v1`: question 1 |
  | **D. Mixed: a student field inside teacher content** (unmarked) | the seven, and four found by this reading; table below | reduce, by field |
  | **E. Free text that may name a student** (unmarked, not separable) | `data-chart-builder-datasets` (one of the seven); `subPlanBuilder.history.v1`; `promptBuilderDraft_v2`, `promptBuilderCustomPresets_v1`, `promptBuilderHistory_v1`; `gvb-sub-binder:today-lesson`; `qr-code-generator-recent`; `htcm:game` (typed team names); `pct:custom`; `np_prompts`; `gvb-number-talks:myBank` notes | scanned for this year's roster names and shown; nothing is cleared without the teacher choosing it (question 2) |
  | **F. A roster's name only** (unmarked) | `cls-screen:state` (`widgets[].data.roster`), `gvb-command-center:settings` (`rosterName`, `periods[].roster`), `gvb-roleplay:currentClass` and the keys filed under its class names | kept: class names survive in C, so the reference still resolves |
  | **G. Teacher setup** | everything else | kept, untouched |

  The mixed keys (kind D). None goes through `Store`; all are raw JSON. Field and empty value are the tool's own,
  from its default or blank-document code:

  | Key | Tool | Student field | Clear writes | Trap |
  |---|---|---|---|---|
  | `subPlanBuilder.standingDetails.v1` | 044 | `medicalAlerts` (free text; the placeholder names a student's EpiPen) | `''` | 045 reads it too. Deleting the whole key brings back hard-coded defaults, so never delete it |
  | `gvb-certificate-maker:data:*`, and the legacy `gvb-certificate-maker:last` | 042 | `studentName`, `batchNames` (one string, a name and its reason per line) | `''` for both | must be `''`, not removed: `batchNames.split` throws on `undefined`. `reason`, `qrUrl` are kind E |
  | `crcg:data:*`, and the legacy `crcg_roles_v1` | 050 | `roles[].students` | `[]`, what the tool's own "Clear names" writes | the legacy key is re-migrated when `crcg:list` is empty, so it gets the same rule |
  | `gvb-review-board:data:*` | 030 | `teams[].name` when it is `Team N: <names>` (a roster split), `teams[].score`, `clues[].used` | name back to `Team N`, score `0`, `used` `false` (question 9) | `teams` must stay an array: `renderBoard` calls `forEach` on it. A typed team name is kind E |
  | `qr-code-generator-inventory` | 016 | `assignedTo`, `history[]` (`who`, `ts`), `checkedOutAt`, `checkedInAt` | `''`, `[]`, `null`, `null`; `label`, `status`, `createdAt` kept | an item still `out` (question 3). `label` must stay: the list sort reads it unguarded |
  | `data-chart-builder-datasets` | 038 | the whole pasted text, per dataset | kind E: per dataset, on the teacher's choice | a stored `null` crashes the page at boot, so a cleared map is `{}` |
  | `qr-scavenger-hunt-sets` | 018 | `sets[*].run` (teams, check-in times, marks, hints, timer) | `run` removed; `ensureRun()` rebuilds it | `stations[].codeWord` is the hunt and stays |
  | `htcm:data:*` **(new)** | 064 | `cards[].name`, when "Batch-add from roster" made the cards | kind E per card: a card named for a figure and one named for a student are the same shape (question 9) | |
  | `drb_roster_v1`, `sdb_directory_v1` **(new)** | 058, 075 | `staff[]`, `assignments`, `staffSkip`; `[].name`: staff lists whose picker can load a class roster | question 7 | |
  | `gvb-exit-ticket:discussion`, `gvb-exit-ticket:categoryTally` **(new)** | 023 | what students wrote, with no names; the same tally `:tally` is, by topic | question 4. The 2026-09-23 audit read `discussion` as not student data because it has no names | |

  Not localStorage:
  - **`gvb-media`** (one database, twelve namespaces in use). Only **`seating/`** is student data: 160 px face
    photos, under random ids, referenced from `seating-chart-v1`'s `students[].photo`; a record carries no name.
    `cam`, `dbq`, `escape-room`, `fsb`, `htcm`, `ppg`, `psa`, `rgb`, `tlb`, `stviz-trace` are teacher content by the
    registry's comments and the page call sites (their modules were not each read in full). `class-screen` is
    whatever the teacher put on the board; kept. Clear is `MediaDB.store({ ns: 'seating' }).clear()`, the call 005's
    own "Erase saved data" makes. **Never `MediaDB.clear()`: the un-namespaced handle empties every tool's images.**
  - **`rgb-audio`** (030's clue recordings) and **`stviz-recovery`** (035's last three recovery points; 035 models
    no students, a group is a name and a headcount) are teacher content: archived, not cleared. **`bmg-maps`** is a
    cache: not archived, not cleared.
  - **Cache Storage `aplp-share`**, entry `share/roster`: a roster file shared to 006 and not yet collected. No
    expiry. The rollover deletes the entry.
  - **sessionStorage**: 016's `qr-code-generator-scanned` and 010's `gvb-command-center:excluded:<date>:<roster>`
    hold names and die with the tab. The rollover cannot reach another tab's; this is why it asks for the other
    tabs to be closed. (The registry's header still describes an `:excluded:` localStorage entry. Nothing writes
    one and no row declares it; correct the comment when the registry is opened.)

  **The module.** `Tools/backup-restore/br-rollover.js`, a classic script publishing `BrRollover`, loaded by 009
  only. It is pure apart from `run()`: it takes a snapshot and returns values, so the Node suite drives all of it.
  No new `_shared/` file. Two things move out of 009's inline script so the module and the suites can call them:
  `Tools/backup-restore/br-envelope.js` (`BrEnvelope`: `build`, `read`, `exportDatabase`, `importDatabase`, the
  blob codec; the functions as they are, moved, not changed), which is also the first half of what per-tool
  restore (rank 2) needs.
  - `BrRollover.RULES`: a frozen list of `{ match, prefix, tool, kind, reduce, describe }`. `match` is a registry
    key or prefix, `kind` is `'delete' | 'reduce' | 'ask' | 'keep'`, `reduce(value, ctx)` takes the parsed value
    and returns `{ value, removed, kept }` where `value` is the new parsed value (or `null` to delete the key),
    `removed` is `[{ what, count, sample }]` ("names", 28, the first few) and `kept` is `[{ what, count }]` ("desks",
    24). `ctx` is `{ names, nextTerm }`. A reducer does not touch storage, never throws on a shape it does not
    know (it returns `{ unreadable: true }`), and is idempotent: `reduce(reduce(x)) = reduce(x)`.
  - `BrRollover.snapshot(io)` → promise of `{ local: { key: string }, media: [{ ns, id, size }], databases:
    [{ name, stores: [{ name, count }] }], share: boolean, takenAt }`. `io` is `{ localStorage, indexedDB, caches,
    MediaDB }`, handed in so a suite can pass fakes.
  - `BrRollover.scanNames(text, names)` → `[{ name, count }]`: whole-word, case-blind matches of roster names
    (through `Roster.normKey`, full names only, never a bare first name) in a raw string. For kind E. It is 006's
    `scanDependencies` idea, made a function.
  - `BrRollover.plan(snapshot, { names, nextTerm, choices })` → `{ id, items, media, share, totals, problems }`.
    An item is `{ key, tool, label, kind, action, before, beforeHash, after, removed, kept, hits }`: `action` is
    `'delete' | 'write' | 'keep' | 'choose'`, `after` is the exact string that will be written (or `null`),
    `hits` is `scanNames`' answer for a kind E key, and `choices[key]` (`'keep' | 'clear'`, or per dataset or
    card for 038 and 064) turns a `'choose'` into a `'keep'` or a `'write'`. `media` is `[{ ns, action, count,
    bytes }]`. `problems` lists a student key with no rule, a key no rule could parse, and a rule whose key the
    registry does not declare. **The preview and the clear are this one value: `run()` writes `item.after` and
    nothing else, so what the teacher read is what happens.**
  - `BrRollover.manifest(snapshot)` → `{ local: { key: [length, hash] }, databases: { name: { store: count } },
    media: { ns: [count, bytes] } }`, and `BrRollover.hash(text)` → promise of hex SHA-256 (`crypto.subtle`; where
    there is none, a 53-bit string hash and the receipt says which).
  - `BrRollover.stamp(plan, { label, manifest })` → the `rollover` object put on the envelope: `{ id, label,
    nextTerm, plannedAt, manifest }`. **The envelope's `formatVersion` stays 2**; `rollover` is an added field an
    older reader ignores. A year archive is never locked (decided in v216).
  - `BrRollover.verify(fileText, { id, hash, manifest })` → `{ ok, reasons }`. In order: the text's hash is the
    hash of what was built; it parses; `BrEnvelope.read` accepts it with no bad flag; it is not a locked file;
    `rollover.id` is this run's; every key in the manifest is in `data` with the same length and hash; every
    declared database but the cache is in `indexedDB` with the manifest's record counts; every blob decodes to its
    recorded `size`.
  - `BrRollover.run(plan, io, { onStep })` → promise of `{ done, failed, receipt }`. The steps, below.
  - `BrRollover.resume(io)` → `null`, or `{ id, label, state, archiveName, archiveHash, doneSteps, totalSteps }`
    from the journal.
  - **Storage it owns:** one key, `br_rollover_v1` (009's row in the registry, not student, never cleared, in every
    backup): `{ v: 1, runs: [{ id, label, nextTerm, state: 'archived' | 'clearing' | 'done', archiveName,
    archiveHash, startedAt, finishedAt, steps, done, cleared: { key: hash } }] }`, the last three runs. **It holds
    no name and no value**, only hashes of what was removed. No migration: nothing has written it.
  - **Registry changes** (`_shared/tool-registry.js`, the platform worker's file when this is built): `rollover:
    'reduce' | 'ask'` on an entry whose rule is not the default (a student entry with no mark is `'delete'`; an
    unmarked entry with none is `'keep'`); `student: true` stays what it is. `idb[].namespaces: [{ ns, student }]`
    on `gvb-media`'s row, so the photo namespace is declared and not written into the module. `ToolRegistry.
    rolloverRule(key)` and `ToolRegistry.mediaNamespaces()`. `classifyKey()` does not change, so 009's scan table
    and filters read as before. The registry-shape suite fails on a student entry marked `'reduce'` with no rule in
    `RULES`, a rule with no entry, and a `gvb-media` namespace found in the tree that the row does not declare.

  **The order of operations.** Nothing is cleared until step 5. Each step is on the page as a numbered step, with
  the next one disabled until this one is done; there is no `confirm()`.
  1. *Close the other tabs.* An open tool holds last year in memory and writes it back on its next save. 009 asks
     the service worker for its window clients (a `CLIENTS` message, new in `sw.js`) and names the tools still
     open; the step is done when there are none. With no worker (the offline copy on `file://`), the page says it
     cannot see other tabs and asks; step 7 is the net.
  2. *Review.* `snapshot()` then `plan()`. The teacher sees the preview (below), makes the kind E choices, types
     the label of the year being closed (006's guess, from `meta.term`) and the new year's.
  3. *Save the archive.* One envelope of **every** localStorage key that is not transient and **every declared
     database but the cache** (`gvb-media`, `rgb-audio`, `stviz-recovery`), stamped. It is serialised once to a
     string; the string is hashed; `verify()` is run on the string itself; and storage is read again and compared
     with the manifest, so a write that landed while the archive was being built stops the run here. Then the
     download: `showSaveFilePicker` where the browser has it, so the page holds a handle; the anchor click
     elsewhere. The journal gets a run in state `'archived'`. `br_last_backup_at` is set here.
  4. *Check the archive.* The page reads the saved file back and runs `verify()` on its bytes. With a handle it
     does this itself (`handle.getFile()`). Without one the teacher picks the file they just saved (question 8).
     A file that fails names why ("this is an older archive", "the file is 0 bytes", "the file was changed") and
     the flow goes back to step 3. **Step 5 cannot start until a file on disk has passed.**
  5. *Clear.* `run()` first reads every planned key again and compares it with `beforeHash`; any difference stops
     with nothing changed ("something saved since you reviewed this; review again"). It sets the run to
     `'clearing'`, then, each step recorded in `done` before the next begins and every write read back:
     (a) the reductions, kinds B, D and the chosen E (each writes a value no longer than the one it replaces, so a
     full disk cannot fail it); (b) the deletions, kind A; (c) the two roster keys, `np_rosters` and then
     `crh_students_v1`, written the way 006's rollover writes them (`Roster.replaceAll`), last among the keys so no
     tool is ever looking at an empty class with last year's records still under it; (d) `seating/` in `gvb-media`;
     (e) the `aplp-share` entry; (f) the dangling indexes (below). Then `'done'`, with `cleared`.
  6. *Receipt.* What was removed and kept, by tool, in counts; the archive's name and the first twelve characters
     of its hash; "to see last year again" in two sentences. It can be printed. It has no names on it.
  7. *Afterwards.* When 009 or the landing page's backup readout next loads and the last run is `'done'`, each
     cleared key is hashed; one that is back with last year's hash was written by a tab that stayed open, and 009
     says which tool and offers to clear it again. One that is back with a different value is this year's work and
     is left alone.

  **A failure half way.** The page closes, the browser crashes or a write fails during step 5: the journal says
  `'clearing'`, and 009 opens on a banner, "The year rollover was interrupted. Your archive `<name>` was checked
  before it began." Two buttons. *Finish clearing* takes a new snapshot and plans again: every reducer is
  idempotent and a deleted key is simply absent, so finishing from any step gives the storage an uninterrupted
  run gives (the suite proves this for every step). *Put last year back* asks for the archive, checks its hash
  against the journal's, and restores it whole, Replace, with `gvb-media`. A run left at `'archived'` (the teacher
  stopped before step 5) changed nothing and shows as a note, not a banner. A reducer that cannot read its key
  (hand-edited or corrupt JSON) leaves the key as it is, and the receipt and the page say so by name: an
  unreadable key is in the archive, and deleting what the page cannot read is not the page's call.

  **What the teacher sees before confirming.** One table, a row per tool that has anything, three columns.
  *Removed*: counts by kind ("3 classes, 84 students: points, notes and goals"), and a "show" that opens the real
  values from `plan.items[].removed` (every name, the medical alerts text in full, each dataset's first lines).
  *Kept*: what setup was found, counted ("8 behaviours, 2 layouts of 24 desks", "the contract's wording and fee").
  *Your choice*: the kind E items, each with the names found in it and Keep or Clear, unset until chosen. Above
  the table: the totals, the photos by count and size, and a line for anything in `problems`. Below it: what is
  not touched at all (settings, question banks, calendars, and every image but the photos). The same table, with
  the choices fixed, is what step 5's button sits under.

  **What each tool changes.**
  - *009.* The "End of the school year" card becomes the seven steps. The inline rollover and its two `confirm()`s
    go. `buildEnvelope`, `readEnvelope` and the database functions are called from `br-envelope.js`. On restore, a
    file with a `rollover` stamp is announced as a year archive ("the 2026–27 year archive, taken 2027-06-18"),
    its `gvb-media` box is ticked (database boxes are off by default at restore today, which would bring a seating
    chart back with no faces), and Replace over a browser that has this year's student data says so above the
    existing "would be lost" list. `br_rollover_v1` is hidden from the scan table like `br_last_backup_at`.
  - *006.* "Start a new school year…" opens 009 at the rollover card. Its two `prompt()`s and the block that
    empties the rosters go; `Roster.replaceAll` is called by `run()`. Per-roster Archive and Restore stay.
    `crh_archive_v1.years` is question 1.
  - *043 and 084* (and any tool whose `:data:*` is reduced, not deleted, has no change). Both keep `:list` and
    `:current` unmarked while `:data:*` is student data, so today's rollover leaves switcher entries that select
    nothing. Under this design `:data:*` is reduced and kept, so the entries stay live. Step 5(f) is for the other
    case, an index naming a document that is gone: `gvb-field-trip:list`, `socsem:list`, `gtg:list`,
    `gvb-certificate-maker:list` and `novel-study-units`' `projectNames` are rewritten to the documents that
    exist. No tool page changes for this.
  - *005.* Nothing in the page. Its reducer keeps `sections[].name`, `desks`, `layouts[].desks` and the view
    settings, and empties `students`, `apart`, `together`, `assign`, `history` and each layout's `assign`.
  - *`sw.js`.* The `CLIENTS` message; the two new files in `PRECACHE_URLS` (not the shell); a `CACHE_VERSION` bump.
  - *No other tool page changes.* Every reducer writes a shape the tool already loads: each empty value above is
    the one the tool's own blank-document or "clear" code writes, and the browser suite opens every tool after a
    rollover to hold that.

  **Restore next August.** The archive is an ordinary backup with a stamp, so everything 009 does with a backup
  works. Three cases, and what each does:
  - *"I cleared by mistake" (days later).* Restore the whole file, Replace, images ticked. The suite holds this to
    the byte: seed, roll over, restore, and every key and every database record equals what was there before.
  - *"What did last year's log say?" (a parent asks in September).* Restoring over this year replaces this year's
    student data, and Combine merges by section name, so last year's Period 3 lands on this year's Period 3. The
    safe route that exists today is a second browser profile or a private window: open the site, restore the
    archive there, read, close. The receipt says this. A reader inside 009 is question 6.
  - *"Bring one thing back" (a seating layout, a set of certificates).* Setup is kept by the rollover, so the
    usual reason is gone. The rest is per-tool restore, rank 2, unchanged by this design.

  **P4's name-keyed history and `Roster.trackRenames`.** Eight tools key history on the name and keep an
  `idNames` map (`{ id: name }`) beside it: seven inside their student key (001, 002, 008, 013, 022, 027, 033) and
  068 in `pcl_idnames_v1`. What the rollover has to get right, and does:
  - Every reducer for those keys empties `idNames` with the names, and keeps `rosterName`, so a section stays
    tied to its class. Next year's names arrive with ids the sidecar mints fresh; an empty map makes each a first
    sighting, which `trackRenames` rule 2 says is not a rename. Nothing moves.
  - `crh_students_v1`'s `orphans` are emptied too. `reconcile()` matches a new name against orphans by name and
    by sorted tokens; an orphan left behind would hand next year's student of the same name last year's id,
    preferred name and pronunciation. 006's own rollover already writes `orphans: []`; the reducer must.
  - History goes before the rosters (step 5's order), because history is keyed by name: a name that is still on
    the roster while its records are being removed is harmless, and the reverse is the state 006's button leaves
    today, where a new student named like an old one inherits the old one's points.
  - *Restoring one tool's history into the new year* (the same students again): the records come back under
    their names and attach by name, which is the lighter form P4 chose doing its job. Their `idNames` name ids the
    new sidecar does not have, so `trackRenames` sees first sightings and the dead ids stay in the map, harmless.
    **A student whose name was re-spelled over the summer is not followed**: the old id is gone unless
    `crh_students_v1` is restored with the history. That is a limit, stated on the restore preview for a year
    archive, not something this design fixes.
  - A whole-archive restore brings the sidecar and every `idNames` back together, as one consistent state.

  **Path 3 P5 (photos and flags) is not built. What P6 needs from it, and what works without it.** Everything
  above works today: the only student images are `seating/`. From P5, when it is built: (1) flags live in
  `crh_students_v1`'s `students[]` records or in a key of their own marked `student: true`, never in a roster's
  `meta`, which the rollover keeps; (2) shared photos go in a namespace that holds student photos and nothing
  else, declared `student: true` in the registry's `namespaces`, so clearing stays one call per namespace; if P5
  moves `seating/` there, the registry row changes and the module does not; (3) each flag kind has a `describe`
  line, because an accommodation note is the most sensitive thing on the site and the preview must name it.

  **Tests that would prove it.**
  - `Tools/backup-restore/test/rollover.test.mjs` (pure Node; its shortcut would be `test:rollover`). *Rules:* every student
    entry in the registry has a rule and every rule an entry. *Each reducer*, on a fixture written from the tool's
    own default document with made-up names (Avery Stone, Blake Rivers, Casey Lund): no fixture name is left in
    the output; every setup field is deep-equal to the input's; the output is the documented empty shape (042's
    `batchNames === ''`, 030's `teams` an array, 016's `label` kept, 038's `{}`); idempotent; an unknown shape, an
    array where an object is expected, `null`, and text that is not JSON each give `unreadable` and no throw.
    *`scanNames`:* a full name, a name in other case, a name across a line break; no hit on a first name alone or
    on a name inside a longer word. *`plan`:* totals, `problems` for an undeclared student key, a choice applied.
    *`verify`:* passes on the built text; fails, with its own reason, on a truncated file, an edited value, a
    removed key, another run's archive, a locked file, a missing database, a blob one byte short. *`run` on fake
    storage:* the final state; a write that fails at step k, for every k, leaves the journal at k, and resuming
    gives the same final state as no failure; a key changed after the plan stops the run with nothing written.
    *Journal:* no fixture name appears anywhere in `br_rollover_v1`.
  - `Tools/backup-restore/test/smoke-rollover.mjs` (browser, the next free port). A profile seeded with every
    rule's fixture, three `seating/` photos, one `rgb/` image, one audio clip and a parked `aplp-share` entry.
    The steps cannot be skipped (step 5's button is disabled until a file passes). The downloaded text
    (`downloadText`) verifies; a wrong file and a truncated file are refused with their reasons. After the run:
    **no fixture name in any localStorage value, any `gvb-media` record or the share cache, outside a kind E item
    the test chose to keep**; `seating/` is empty and `rgb/` and the clip are there; class names and periods
    survive. A reload half way shows the banner and Finish gives the same storage. Restore of the archive,
    Replace with images: every key and every record equal to the seed, to the byte. A second tab open on 008 is
    named in step 1. A key written back with its old value is reported on the next load; one written with a new
    value is not.
  - `Tools/backup-restore/test/smoke-rollover-tools.mjs` (browser). After a rollover, every tool with a reduced
    key is opened: no page error, no fixture name in the page's text, and one setup marker each still on the page
    (005's desk count, 001's custom destination, 008's custom tag, 013's contract wording, 043's destination, and
    so on down the kind B and D tables). 043's and 084's switchers have no entry that selects nothing.
  - `registry-shape.test.mjs` gains the three registry assertions. `smoke-roster-writes.mjs` section 6 becomes
    "006's button opens 009's rollover"; its "every roster name survives" assertion moves to `smoke-rollover.mjs`.
  - Each new suite needs its `suites.json` line and `test:` shortcut (`check:tests`).

  **Deliberately left out.** A rollover that keeps some classes and clears others (question 5). A reader for an
  archive (question 6). Locking the year archive (decided in v216: a passphrase forgotten over the summer loses
  the year). Re-keying history to ids. Any undo but restoring the archive. 032's own "Start New Year From This
  Template", which stays its own button; a calendar is not student data. Rolling a second device: each browser is
  rolled over by itself, and the receipt says so. Marking the kind E keys in the registry: they stay unmarked, and
  the scan is what finds a name in them.

  **Found on the way, not part of P6.** 044's share link and its Export JSON both carry the whole of
  `standingDetails`, `medicalAlerts` included (`buildSharePayload()` puts `settings` in the link as `standing`).
  050's link and file carry `roles[].students`; 030's JSON export carries team names. Path 6's rule is that what
  travels is what was authored to be published; a medical alert is not. Not ranked here, because re-ranking is not
  a design pass's call. `gvb-certificate-maker:last` is a legacy key the registry does not mark `legacy`.

  **Questions that are Devon's. Not answered here; each is a default the build must not pick for him.**
  1. After a rollover, does this browser keep any copy of last year's names? 006 files past years in
     `crh_archive_v1`, in the browser, and tells the teacher they are there. "Clear student data" and that archive
     cannot both hold. Either the file is the only copy, or past rosters stay in 006.
  2. Free text that cannot be separated (038's datasets, 044's plan history, 029's drafts and history, 045's
     note): when this year's names are found in one, is the default Keep or Clear? And when none is found, is it
     shown at all?
  3. 016: a calculator still checked out in June. Does the rollover keep who has it until it is checked in, or
     clear the borrower with the rest?
  4. Is last year's student work with no names on it student data? 023's `discussion` (what students wrote) and
     `categoryTally`, and the strategy texts in 024's library, which is marked and so goes today. This decides two
     registry marks.
  5. Does a teacher who keeps the same students (looping, a two-year course) need to roll over some classes and
     not others? It makes every rule roster-aware, about twice the work.
  6. Looking at last year in September: is a private window and a restore enough, or should 009 open an archive to
     read without restoring it?
  7. 058 and 075 are staff lists, but both can be filled from a class roster (a student duty rota). Are they
     student data when they were?
  8. In a browser with no save picker (Firefox, Safari), must the teacher pick the saved file back before the
     clear is allowed, or may they tick "I have checked the file"? The first is safe and one more step; the second
     is today's promise with a checkbox.
  9. 030 and 064: does the rollover reset a review board's scores and played clues, and what happens to a trading
     card named for a student?
  10. One name for it. 009 says "End of the school year", 006 says "Start a new school year". Which, and does the
      button stay in both places?

  **Not verified.** Nothing was run in a browser. Every "safe empty value" is from reading the tool's load path,
  not from loading it. `showSaveFilePicker`, `clients.matchAll()` from a page's message, and reading a handle
  back were not tried. The size of a real archive with images was not measured (a `psa` or `dbq` image is stored
  at up to full size, and a blob is base64 in the file, a third larger). 017's, 020's and 060's inner shapes were
  read in part; the `:list` and `:current` writers of 042, 050 and 030 were inferred from their store modules.
  Whether `settings.seatingByPeriod` in 010 holds a section id or a name was not settled. The unmarked keys of
  tools that read no roster were not re-read.

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
v143), P3 the same day (#182, v148, with 046 as its single adopter). P4 is in progress: 005 (#280), 019 (#282), 056 (#284), 028 (#290), 042 (#292) and 015 (#294), 041 (#298), 071 (#300), 030 (#302) and 064 (#304) have moved, and the image layer they share is `MediaDB.images()` (#294); 035, added by #302's session, is the last. P5 open. What
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
  libraries, 042 logo/signature, 015, 041, 071, 030 clue images, 064 card photos, then 035's
  floor-plan trace image (added 2026-09-29 by #302's session with 064: both stored a
  downscaled JPEG in localStorage). **P4 is finished: every one of these shipped, the last
  being 035 in #321 (v211, `sv-trace-image.js`, `smoke-trace-image.mjs` on port 8457).**
  044's seating-chart image is never saved, so it was never on the list, but its hand-rolled
  downscaler moved onto `MediaDB.downscaleImage` in the same PR, so none of the copies P3
  counted is left.
  *080 snapshots were on this list and are not stored anywhere — a canvas and a
  download link only — so there is nothing to migrate (found 2026-09-29, #300's session).*
- **P5 — 009 upgrades that fall out of the above. Three of four done.** The record-level
  restore preview ("1 replaced, 1 added, 1 untouched", and what Replace would remove) had
  already shipped before the row was written (`smoke-restore-diff.mjs`); the row's text was
  stale. The optional passphrase lock (`backup-restore/br-crypto.js`: AES-GCM, PBKDF2-SHA-256
  at 600,000 iterations, off by default, never on the year-end archive) and the landing
  page's "N KB saved · backed up N days ago" readout shipped in v216 (`smoke-encrypted.mjs`,
  port 8461). **Left: per-tool restore as a shared control any tool can host** — "restore
  just this tool's data from a backup file", using `ToolRegistry` to pick the tool's keys and
  009's record diff (which would have to move out of 009's inline script into `_shared/`).

**Model.** Opus.

**Verification.** `test:backup` green; a seeded profile with every registered key
round-trips through export → clear → import byte-identically; a full-quota
simulation shows the explanatory message in every migrated tool.

---

### Path 5 — Projector mode, real dark mode, shared fullscreen stage

**Status.** P1 shipped 2026-09-03 (#167). P2 shipped 2026-09-04 (#180, `CACHE_VERSION`
v147) with 024 as its single adopter, and **its rollout finished 2026-09-05 (#195, v153):
021, 023 and 025 adopted too, so all four copies the P2 row named are gone and `stage.js`
has four adopters.** The picker P3 needs, `npm run path5:next`, shipped in the same PR.
**P3 is finished (#227).** P4 is rank 1.

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
  deleting their local stage code. **All four have (#180, #195).** Five pages still
  hand-roll fullscreen — 001, 004, 010, 015 and 072 — and `npm run path5:next` names
  them; they were never on the P2 list and belong to P3 and P4. **Three of the five went in
  #198 (010, 015, 072); 001 and 004 remain.**
- **P3 — Rollout.** Every projector-facing tool adopts `stage.js` and native dark.
  **Increment 1 shipped 2026-09-05 (#198, `CACHE_VERSION` v154): 010, 015, 021, 023, 024
  and 072 are native, and 010, 015 and 072 adopted `stage.js`. Increment 2 the same day
  (#200, v155): 025, `command-center/remote.html`, `escape-room-builder/monitor.html`, 051,
  048 and `escape-room-builder/lock.html`, all palette-only — none of the six had a stage of
  its own. Increment 3 the same day (#202, v156): 006, 020, 056, 019, 039 and 009, also all
  palette-only. Increment 4 on 2026-09-06 (#204, v157): 050, 040, 054, 017, 028 and 078,
  palette-only again — 017's projector view is a self-managed overlay, not a stage. Increment 5
  the same day (#206, v158): 047, 067, 075, 081, 061 and 063, palette-only again, and the first
  batch whose work included a *drawn SVG* (067's staff) rather than only CSS. Increment 6 the
  same day (#208, v159): 059, 070, 074, 076, 055 and 058, palette-only again, all six
  print-first generators whose printable is inside a hidden `#printArea` — and 074 the first
  page whose colours are written from a **data table in script**. Increment 7 the same day
  (#210, v160): 077, 082, 014, 045, 085 and 060, palette-only again; 045 is the first page whose
  printable classes are **shared with an on-screen card by one render function**, and the
  increment also fixed the picker's own `THEMED` test, which had been counting
  `ideas-backlog.html` — a page that only *names* `_shared/a11y.js` in its prose — as a
  candidate for six increments (83 themed → 82, 38 candidates → 37, 875 literals → 864).
  Increment 8 the same day (#212, v161): 066, 069, 079, 026, 073 and 083, palette-only again,
  four of them print-first generators with a hidden printable and two — 069 and 026 — with an
  on-screen facsimile that needed `.paper-sheet` written into its renderer. It is also the
  first increment to **edit a tool's own suite**: 079's `smoke-panel-colors.mjs` read an
  inline `style.borderColor`, which comes back unresolved once the value is a `var()`.
  Increment 9 the next day (#214, v162): 012, 052, 057, 068, 071 and 084, palette-only again;
  012 is the batch's one on-screen facsimile, and it is the strongest case yet for
  `.paper-sheet`, because `gpg-render.js` draws the entire grid in `currentColor`. The
  increment also **fixed the picker a second time** — it was walking the filesystem rather than
  `git ls-files`, so it swept the gitignored `Tools/board-check/.offline-copy-staging/` tree and
  reported double every figure (188 live pages, 99 on the filter, 17 rounds), printing six
  already-converted pages as its next batch — and it fixed the **regression that fix caused**:
  `select-suites.mjs` finds page-sweeping suites by grepping for `readdirSync`, so moving
  `smoke-theme.mjs` to `git ls-files` silently dropped it out of every page edit's CI selection.
  Increment 10 the same day (#216, v163): 041, 065, 053, 062, 049 and 037. Two on-screen
  facsimiles (041's live sheet preview, one template chokepoint; 065's print-preview modal, a
  static element), three hidden `#printArea`s — and **037, the first page in ten increments
  whose `#printArea` is not a print sheet at all** but its on-screen output panel, which is
  what ink-paper.css's `.paper-sheet-off` is for and the first use of it. The increment also
  fixed three bugs that had shipped in *light*: 037's stacked bar labelling its C segment
  white on `#4292c6` (3.41:1, a perceived-brightness guess where WCAG contrast was meant, and
  the sixth instance of the empty-storage blind spot), 041's allowlisted `.preview-note`
  contrast on the preview mat (its line is deleted), and `escapeHtml('&mdash;')` printing the
  entity as text on 065's lab packet and in three places on 057.
  Increment 11 on 2026-09-07 (#218, v164): 033, 080, 008, 022, 013 and 027. Five keep their
  printable out of sight (a `display:none` `#printArea`, a `.print-only` block, or — 022's
  table tents — markup that exists only for the duration of `window.print()`), and 013's QR is
  the same call: script paints it black on `#fff` onto a canvas, and a QR that follows a theme
  does not scan. **080 is the new category, and it is not about printing at all**: its board and
  number line are `.paper-sheet` because the manipulatives on them are objects with fixed
  colours, and because `snapshotEl()` paints `#ffffff` and then copies each piece's *computed*
  colour and the marker's `var(--accent)` onto the canvas — so a dark board would have exported
  pale blue on white paper. *Ask what a tool exports, not only what it prints.* The increment
  also fixed three bugs shipped in *light* — 027's four unnamed group-name inputs (critical
  `label`, the seventh empty-storage instance), 033's genre input rendering 859px wide, and
  008's three category stripe colours never once being drawn — the last two both cases of **a
  bare class losing to a higher-specificity selector, so the literal a conversion rewrites was
  never the winning declaration.**
  Increment 12 the same day (#221, v165): 003, 032, 043, 030, 064 and 042 — the last full batch.
  Four of the six render a printable on screen and they split two-two on the sheet question: 003's
  `.rubric-sheet` and 043's four printables got `.paper-sheet`, while **064's `.trading-card` and
  042's `.cert` had to be denied it**, because ink-paper's paper rule is (0,5,0) and outranks
  `.trading-card.theme-<key>` (0,2,0) and `.theme-elegant` (0,1,0) — marking a self-coloured
  object as paper repaints it white. 030 is the batch's projector page and needed a new fixed
  token, `--board-btn-ink`: its white award buttons sit **on** the navy overlay and were inking
  themselves with `var(--accent)`, 2.5:1 on white in dark. The increment also fixed **five
  unlabeled controls across four pages** — the eighth instance of the empty-storage blind spot and
  the first to find it four times at once — and deleted **three** `#previewNote` allowlist lines
  with the `--desk-ink` fix, its fifth through seventh use.
  Increment 13 the same day (#225, v166): **046, the last page on the filter.** Its whole viewer is
  the sheet of paper — `#viewport` carries `.paper-sheet`, so the label boxes, legend, markers,
  compass, scale bar, readout and locator inset keep their light literals — and the argument is
  what `buildExportCanvas()` paints, not what the page prints: hardcoded `#eef0ec`, `#fff` and
  `#1f3550`, which a themed viewer would have contradicted on screen. The mat is now
  `var(--map-mat)`, a token with **no dark override**, named so the constraint (it must equal the
  canvas fill) is visible; two thumbnail mats stay light because Commons maps are transparent PNGs
  of dark line art. It also fixed a critical `select-name` on `#scaleBarUnitSelect` that had
  shipped in light, the ninth instance of the sweep's blind spot and the first found **behind a
  toolbar toggle** rather than behind saved data, and it **deleted** `smoke-theme.mjs`'s
  filtered-page half rather than repointing it a third time.
  **The stage rollout — and with it the whole phase — finished the same day (#227,
  `CACHE_VERSION` v167).** 001's Projector View and 004's whole page were the last two hand-rolled
  `requestFullscreen` calls on the site; `stage.js` is at **9** adopters and `path5:next` reports
  **0**. Three things it settled that the row had left open. 001 is the shape where **the tool
  keeps its own display state and the helper owns only the fullscreen half**: `show` stays the
  tool's (the render loop and three callers test it), and because the stage element is
  `display:none` until the tool shows it, `fullscreenKey: false` plus `f` in the hotkey map is
  required — the helper's own key calls `enter()` straight out, and you cannot fullscreen a hidden
  element. 004 is the shape where **`<body>` is the stage**: it fullscreened `<html>`, which no
  mount can express. And both needed an id- or element-level `.is-fullscreen` rule, because the
  helper's fallback rule is injected into `<head>` *after* the page's own `<style>` and paints
  `var(--paper, #fff)` — a same-specificity override ties and loses on order, which would have put
  a white board in front of the room.
  **The one question this phase leaves open, written here because the ranked row is gone:** 030,
  064 and 017 each run a projector surface off a fixed `inset: 0` overlay rather than the
  Fullscreen API. Whether any of them should become a `Stage.mount` is a judgement call nobody has
  made. And **007 hand-rolls `requestFullscreen`**; it loaded no `a11y.js` until AI-35, so the picker could not
  see it at all. Now it has one (its own picker's; see HISTORY "AI-35"), and `path5:next` lists it as hand-rolled.
  **82 of 82 (100%) native, nothing on the filter, no hand-rolled stage among them.** Each
  converted page went into `PAGES` in `Tools/theme/test/smoke-dark-rollout.mjs` — more than once
  when the page shows one stage at a time, as 053, 062, 080, 003 and 030 do; the adopted stages
  are driven in `Tools/stage/test/smoke-stage-rollout.mjs`, which since #227 names its stage by
  **CSS selector** rather than by id, so a `<body>` mount can be driven at all.
  For the record, the batching rule while the palette rounds ran: **take the batch from
  `npm run path5:next`, not from this list** — the script ranks by projector evidence and then by
  cost, and it contradicted the list in two places:
  004 has had a native palette since #167 (it is one of the nine), and 007 loads no
  `a11y.js` at all, so it cannot be given a theme until it does. The prose list, kept for
  its intent: 004, 007, 010, 030 (a projector-first tool with neither today), 001's
  projector view, 062, 064, 046's quiz mode, 055, 066, 081, 086. Batches of ~6.
- **P4 — Landing page and hallway tools. Rank 1, and two of its three parts are already
  done — verified 2026-09-07 by #227, which surveyed the row without starting it.**
  `index.html` has had a native `[data-theme="dark"]` palette and `A11Y_NATIVE_THEME = true`
  since P1. The offline-copy generator's "stale theme-link pattern" **is not stale**:
  `sanitizeEntryPoint()` in `Tools/board-check/make-offline-copy.mjs` hardcodes two strings
  from `index.html` — the "Prefer a different look?" Inbox-edition link and the
  `ideas-backlog.html` link — and both still match exactly (1 and 3 occurrences), with
  `assertExactlyOne()` failing loudly the day the first one drifts. There is nothing to
  re-check; the ranked row says so now so nobody re-derives it.
  What is left is **034**, and the survey is in the ranked row in full. The headline: 034 is
  **not** a clean publish of 035's `BR_CSS` (~109 diff lines apart), a published standalone
  file has no `_shared/` beside it so the dark tokens must key on `prefers-color-scheme` as
  well as `data-theme`, `--br-forest` is one name for ten fills and twenty-four ink uses, and
  **the five department hues all fail as text on a dark card (2.39–3.56:1) while being written
  from script into `style="color:${col}"`**, where no CSS token reaches them.

**Model.** Opus. Sonnet for the rollout batches.

**Verification.** Screenshot both themes for every migrated tool via the harness;
a Playwright check that no tool ships the invert filter *and* a native palette at
once; keyboard-only run-through of one stage. **Nothing has been checked on a real projector or
a real Chromebook in twelve increments**, and nothing has installed the worker; the screenshots
and `smoke-dark-rollout.mjs` are the whole of the evidence — and #214 is the second increment
running where **the screenshots caught something no assertion did**. Two of its six pages were
being scanned in a state the `prep` had failed to reach (an `alert()` swallowed a click on 068;
071's stage stays empty until an image is drawn), and a failed prep leaves every assertion
passing on the same empty page the site-wide sweep already covers. Look at them.

---

### Path 6 — "Share…" everywhere

**Status.** P1 shipped 2026-09-04 (#178, `CACHE_VERSION` v146) with 064 as its single
adopter. **P3 is finished for everything it can do today: #255 (v181) took 016, 029 and 038, the
last of the bank-plus-settings group, taking `share.js` and `qr-draw.js` to 52 of 86 and
`state-link.js` to 53. 046 took the sheet in P4's first rollout increment (#257), and 045 is folded into Path 10 P2 (rank 17),
so the P3 row is gone from Tier 1.** Before it, #252 (v179) took 014, 023, 025, 067 and 071,
five more of the bank-plus-settings group, taking `share.js` and `qr-draw.js` to 49 of 86 and
`state-link.js` to 50. What is left of P3 is three bank-plus-settings tools (016, 029, 038), plus
046 (rank 2's job) and 045 (waits for Path 10).** Before it, #250 (v178) took 053, 055, 061, 062
and 066, and #248 (v177) took 018, 019, 048 and 077. Before it: #237 (v172) took 052, 057, 070, 073,
079 and 081 — the single-document builders — #239 (v173) took 047, 065 and 072, the
named-library ones, #244 (v175) took five more of those (041, 051, 069, 082, 083), and #246
(v176) took 049, 058, 074, 075, 076 and 078 — the rest of the single-document group that was a
copy, plus 075, which merges rather than replaces — taking `share.js` and `qr-draw.js` to 35 of
86 and `state-link.js` to 36.** **P2 is finished**, in three increments all on 2026-09-08: #231 (v169) took 028,
039, 040, 050, 054 and 056 and grew the receiving half (`unwrap`, `parseFile`, `receive`,
`receiveFile`); #233 (v170) took 002, 007, 015 and 044 — every tool with a hand-written
share bar — and added `Share.open()` beside `Share.mount()` for 007's per-row shape plus a
contrast fix in the sheet's own CSS; #235 (v171) took 003, 005, 006 and 020, the four that
went through `state-link.js`'s own `mountShareControl`, and **retired `mountShareControl`**.
**`share.js` and `qr-draw.js` are at 15 adopters each and `state-link.js` at 16** — the one
page with the latter and not the former is 046, whose single `buildShareUrl` builds 015's
`?timeline=` link, which is **P4's**. **P4's mechanism shipped 2026-09-08 (#242, v174) with
052 → 040 as its one adopter; its rollout is rank 2. P3 is rank 1.**

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
- **P2 — Adopt in the existing `state-link` tools**, deleting their local QR and
  share code; then wire the receiving side (`?state=`) through the same helper so
  "open from link" behaves identically everywhere. **Shipped, in three increments.**
  **#231 (v169)** did the first six and built the receiving side, finding that the
  count of tools was wrong (004 loads `state-link.js` and calls nothing; 046's one call
  is a P4-shaped cross-tool send). That receiving side turned out to be two halves, not
  one: a `.json` written by P1's own Download row is wrapped in `{ aplp, state }` and did
  not open in any adopter's file importer, so `Share.receiveFile()` exists beside
  `Share.receive()`. **#233 (v170)** did 002, 007, 015 and 044, finishing the
  hand-written share bars; it added `Share.open()` for a per-row share that no single
  `getState` could express, gave `onMessage` the error flag, and fixed the sheet painting
  a host's `--muted` onto its own `--card` fallback. **#235 (v171)** did the last four —
  003, 005, 006, 020 — and **retired `mountShareControl`** rather than keeping it as a
  wrapper over `Share.mount`, because a wrapper would invert the module dependency,
  cannot express a real in-page button, and would make `check:adoption`'s number wrong;
  `state-link.js` carries all three reasons where the function was. It also deleted two
  genuinely dead `state-link.js` script tags (004 and `classroom-timer/mirror.html`),
  which is what finished the list. **005 is the increment's headline**: its students carry
  `data:image/` photos and the old control encoded the section whole, for a link of
  ~105 KB against 3.0 KB stripped. 006's WebRTC pairing codes are **not** share payloads,
  and produced the finding AI-10 fixed in v223 (`QrDraw.fit()`; see Path 8).

- **P3 — Extend to the builders that don't share yet. Three increments shipped
  2026-09-08 (#237 v172, #239 v173, #244 v175); the row stays.** The phase's original
  list — 044, 045, 047, 052, 057, 065, 070, 072, 073, 079, 081, plus every
  "generator" tool with a saved configuration — was already one out of date:
  **044 adopted in P2 (#233).** **052, 057, 070, 073, 079 and 081 are done**, which
  takes `share.js` and `qr-draw.js` to **21 of 86** and `state-link.js` to 22.
  **047, 065 and 072 are done** (#239) — the named-library set (`LIST_KEY` +
  `DATA_PREFIX` + `CURRENT_KEY`), where an arrival is saved *beside* what is there
  under a free name exactly as P1/P2's adopters do, and none of the confirm machinery
  below applies. **Left after #248: the thirteen bank-plus-settings
  generators, plus 046 (rank 2's job) and 045 — the enumeration this row kept
  asking for is written down at the end of this section.** 045 is the odd one: it
  compiles other tools' storage rather than owning much of its own, and Path 10 P2/P3
  are about to re-base it on section providers, so **share it after those or accept
  that its payload will change shape.**

  The first increment's own decisions, which the next one should follow or
  deliberately reverse: an arriving link on a **single-document** tool asks with the
  page's own `confirm()` before replacing, and **only when `load()` found something
  in storage** — the starter template an empty install seeds is not somebody's work;
  a tool whose state is a **recipe rather than authored content** (081's seed) does
  not ask at all; and what travels is decided per field, not per key — **073 shares
  its milestone schedule and no student name, tick or note**, following 003's
  rubric-without-marks split. Verification is one **rollout suite**,
  `Tools/share/test/smoke-share-rollout.mjs` (`npm run test:share-rollout`), a table
  with a row per adopter rather than a per-tool suite each; add a row to it.

  #239's own decisions, which the next increment should follow or deliberately
  reverse: a **named-library** tool does **not** ask before loading, because an
  arrival costs nothing — the guard against loss is `uniqueName()`, and the assertion
  that matters is the **name collision** rather than the arrival; a tool whose library
  name lives outside its document (072) attaches that name to a **copy** in
  `getState()` rather than writing it onto the stored state; and the **legacy
  migration runs before the import** in all three, because an arrival saved first
  makes the name list non-empty and every one of these migrations bails on exactly
  that.

  **The generator enumeration, done once (2026-09-08).** "Plus every generator with a saved
  configuration" is how P3's list went one out in the first place, so here it is, measured
  rather than remembered: of the 86 pages, **24 now load `share.js`**; of the 62 that do not,
  **30 have "generator", "builder", "maker" or "creator" in the name and write to
  localStorage.** They are not one kind of work, and the split is by *storage shape*, which is
  what decides how much of #237 applies:

  - **Named library (a list key + a per-name data prefix + a current pointer) — the same
    shape 047/065/072 took.** **041** (formula sheet), **051** (classroom labels), **069**
    (PE warm-up circuits), **082** (citations) and **083** (propaganda analysis) **shipped in
    #244**, and the copy really was a copy: five `Share.mount` calls, five importers, five
    registry parameters, and not one of #239's three decisions needed changing. **048 and 019
    shipped in #248** and neither was a copy — 048 for the student-data decision, 019 because
    it already had a link of its own. **This group is empty.**
  - **One document or one settings blob — #237's shape, so the `confirm()`-when-`load()`-
    found-something rule applies as written:** **046** only. **049, 058, 074, 075, 076 and
    078 shipped in #246; 077 shipped in #248**; and **038 and 018 were both mis-filed here**
    (see below). 046 is rank 2's first job.
  - **A built-in bank plus custom additions plus device settings, where what a teacher would
    hand over is the *custom bank*, not the settings, and the two are separate keys:**
    **053**, **055**, **061**, **062** and **066** **shipped in #250** — four of them the shape
    exactly, and **061** the one that is not (a *seeded* generator with a single settings key, so
    its link is 081's: the seed, and the receiver regenerates the worksheet). **014**, **023**,
    **025**, **067** and **071** **shipped in #252** — 014 with the current class's fill-ins riding
    along on its custom scenarios, 023 and 025 with two kinds of arrival in one importer (a bank
    that merges, sets saved beside), 067 as 081 without a seed (the recipe travels, the receiver
    rolls its own), 071 as a fourth library layout. **Left: 016**, **029**, **038**, each surveyed
    in #252's handoff. Deciding what travels here is a real design question per tool, not wiring,
    which is why they should not be batched with the first group. **This is all that is left of
    P3** apart from 046 and 045.

  **THIS ENUMERATION HAS NOW BEEN WRONG TWICE, AND BOTH TIMES IN THE SAME LIST.** #246 moved
  **038** out of the single-document group (it keeps device settings plus a name→pasted-text
  map of datasets), and #248 found **018** in it too: 018 keeps `{current, sets}` under one
  key — a **named library that happens to live in a single key**, which is 019's shape, and
  the enumeration filed 019 one group up. The cause is the same both times: **the split was
  measured by how many keys a tool writes, and what actually decides how an arrival is filed
  is what `load()` does with them.** Read `load()` and the boot block before trusting a row's
  group; the storage dump will not tell you. A practical consequence for the suite:
  `smoke-share-rollout.mjs` needed **two new seeding shapes** in #248 — a library inside one
  key, and one keyed by id in a list — because its `library` option had been fitted to the
  three-key shape alone.

  **One still carries a `student: true` key and needs 073's per-field split before it can
  share anything:** 023 (`gvb-exit-ticket:tally`). 048 and 077 were the other two and both
  shipped in #248 — **read what they decided before deciding 023**, because they went
  opposite ways and the rule that separates them is written down above; applied to 023 it says
  the exit-ticket *prompts* travel and a tally, which is not a field authored to be published,
  never does. **The Path 12 P2 note is now clear:** 053 and 062 were the last two tools this
  section still promised to rank 40, and #250 shared them on #248's precedent (018 and 019),
  because a bank id is an additive field in a payload each tool validates itself.
  #244's own decisions and findings, which the next increment should follow or deliberately
  reverse: an assertion that has only ever seen one kind of fixture is a claim about the
  fixture, and section 6 of the rollout suite proved it — `Share.unwrap(file) === payload`
  was false by design for the first adopter with a picture in it (041, 083) and had passed
  for nine rows only because none of them had one; the general form, **the file put through
  the same image policy IS the link's payload**, is what it asserts now. A page that already
  loads the vendored QR encoder for its *own* codes (051's pronunciation labels) still gets
  `qr-draw.js` for the sheet, and the two do not meet. And a tool whose `load()` seeds a
  starter template must skip that seeding on an arrival that has its own content (069) — one
  branch, silent if missed, and only findable by reading `load()`.

  #246's own decisions and findings, which the next increment should follow or deliberately
  reverse: **#237's confirm rule is about replacing, not about single-document storage**, and 075 is
  where the two come apart — a tool whose single document is a *list* and which already has a
  merging importer files a link the same way that importer does, asks nothing, and gets its own
  section in the rollout suite (5c: what survives on both sides, and that the same link opened twice
  adds nobody twice) rather than a loosened assertion in an existing one. A **starter template that
  is written to storage** (078) makes "did `load()` find something?" the wrong question, and the only
  way to see that is to read the boot block. An **id-bearing cross-reference** turned up for the
  second time in eleven single-document adopters (058's `<dutyId>|<day>` assignments, after 057's
  `leadsTo`), and the assertion that catches it is that a *relationship* survived, not a field. Staff
  names travel on 058 and 075 because the registry marks neither key `student: true` and both tools
  print those names on paper — the rule is whose data it is, not whether a name is in it.

  #248's own decisions and findings, which the next increment should follow or deliberately
  reverse: the two `student: true` rows went **opposite ways**, and the rule that separates them
  is **what the field is for** rather than whether a child's name is in it — 077 shares the
  accommodation *names* and never a roster, tick or note, while 048 shares the artist names
  because every field on a gallery label is composed to be printed and hung in public. Stated
  once: **the registry's `student: true` governs what the device keeps and what the year-end
  rollover deletes; what governs a link is whether the field was authored to be published.**
  077's other half is the one to carry into the bank-plus-settings group: a tool that looks as
  though it has nothing shareable usually has a **vocabulary** to share, and the department's
  wording is exactly what teachers copy by hand today. An arrival that **merges** is now the
  rule wherever merging loses nothing (077 joins 075), and here it was load-bearing rather than
  polite: every tick is filed under `<student>|<typeId>`, so keeping the local ids is what keeps
  a ticked grid intact. 077 also needed 069/078's starter-template branch for the **third** time
  — the six default accommodation types are a seed, so an arrival on a device that has saved
  nothing replaces them. 019 completes the id rule 058 started: **preserve an id that something
  you store refers to; mint a new one for an id that names this copy to somebody else** — its
  `roomId` is regenerated, because `lock.html` keys a player's progress under it. 019 is also
  the first adopter that **already had a link of its own**, and the two are not the same link:
  `lock.html?r=` is the room as played, the sheet's is the room as authored. 018's split is the
  same idea inside one object — the hunt travels, the Live Run does not. Finally, a page with no
  `a11y.js` and its own dark palette (018) gets the sheet's tokens through **one block scoped to
  `.share-sheet-backdrop`**, which is not the same as adopting `a11y.js`.

  #250's own decisions and findings, which the next increment should follow or deliberately
  reverse: in a bank-plus-settings tool **what travels is the additions and what stays is the
  subtractions** — the hidden/disabled built-in list of every tool in this group is curation that
  *looks* shareable and cannot ride a link that does not ask, because applying it removes
  questions from the receiver's rotation under a note that says "Added 12"; an arrival that merges
  silently may only add, and the suite's `untouched` option asserts that negative against keys the
  payload never mentions. **A tool that writes its state with `innerHTML` needs the arriving copy
  sanitized** (066, the first such adopter in nine increments): a link is the first input this site
  has had that did not come from the person at the keyboard, and the storage shape does not say
  which tools those are — grep the sinks. **A seeded generator's arrival rebuilds from the seed it
  was sent rather than calling the tool's own Generate** (061), which draws a new one unless the
  seed is locked and would hand the receiving teacher a different worksheet, silently. And a
  generated asset that is *described* rather than rendered travels for nothing: 062's map questions
  are three words each and the receiver draws its own from the same vendored data.

  #252's own decisions and findings, which the next increment should follow or deliberately
  reverse: **a per-class or per-scenario annotation travels with the thing it annotates when that
  thing is new on the receiving device, and never when it is shared** — 014's fill-ins ride along on
  a custom scenario (filed under the receiver's open class, under the fresh id) and stay put on the
  built-in ones, because those are keyed by an id both devices have and merging would overwrite. A
  tool can carry **two kinds of arrival in one importer** (023, 025: a bank merges by text, a planned
  set is saved beside with fresh ids and its cursor reset), and the note says both halves. A
  generator with **no seed** shares its recipe and says the receiver rolls its own (067) — a seed is a
  tool change of 061's kind, not a share-sheet job. A fourth library layout (071) took a per-row
  `libraryHooks` in the suite, not a fourth flag; a row asserts what landed *outside* its merged key
  through `afterMerge`. And **reading a tool for what a link must never carry is a registry audit**:
  three keys holding student names (014's roster, 023's triage, 025's Writing Record) had never been
  marked, which is a third class of registry bug after #248's and #250's.

- **P4 — Cross-tool "Send to…". Mechanism shipped 2026-09-08 (#242, `CACHE_VERSION`
  v174); the rollout is rank 2.** The same sheet grows a "Send to <tool>" row driven by
  the tool registry (Path 4). Each handoff is a declared `{ from, to, label, note, sent,
  transform }` entry in `_shared/handoffs.js`, not an ad-hoc key read; the receiver's
  **file and parameter are not in the entry** — they come from the registry row, whose
  new `share: { param }` is checked against every page's own source by
  `Tools/share/test/handoffs.test.mjs`. The link is the receiver's ordinary share link,
  so the receiver files it through its own importer and no third format exists. One
  handoff is declared: **052 → 040**, cognates and false friends as a flashcard word list.
  **Left** (rank 2): map places → timeline (exists in 046 by hand), source → worksheet
  (exists in 056 by hand), rubric → grade distribution (exists in 003 by writing 037's
  storage — decide whether that becomes a link), roster → groups → lab roles → seating,
  trivia → review board, vocab → flashcards from 039 (exists as a storage read in 040).
  **Rollout increment 1 (#257, v182):** 046 → 015 and 056 → 028 are entries now (056's is
  `sheet: false`, sent from each source's own button); 039 → 040 is an entry beside 040's
  read-only pull; **003 → 037 stays a same-device storage write by decision** (student names
  beside scores are not written to be published). `Share.mount` takes `sendState(entry)` for a
  Send row whose payload is derived rather than the shared document. Left: the roster chain,
  and trivia → review board after Path 12 P1.
  **Rollout increment 2 (#259, v183), the roster chain:** 002 → 022 is a sheet row (the grouping
  002 already shares; 022 files it as a new lab class through `?labgroups=` and hands out roles);
  022 → 005 is `sheet: false`, from 022's "Seat these groups" button (a new section, one pod per
  group); **006/007 → 002 is not a link**, because 002 already reads the saved roster through
  `roster.js` on the same device. Left: trivia → review board (053 → 030), after Path 12 P1.

**Model.** Opus.

**Verification.** A shared Playwright helper that round-trips a state through
link, QR (decoded with the vendored jsQR) and file for every adopter; `check:dedupe`
extended to `drawQR`.

---

#### Working notes for a P3 increment (moved from the header, 2026-09-23)

**And add a row to `Tools/share/test/smoke-share-rollout.mjs`'s table rather than writing a
per-tool share suite** — that is what the rollout shape is for, and four increments have now grown it
from 226 assertions to 777 without adding a file. Three cautions from writing those rows: a fixture
that names a record **id** is asserting that nothing remaps ids, which is false on any tool that
merges an arrival into local records; the string a row calls `arrivedWant` has to be a string that is
**in the fixture**, because section 5 makes the local variant by swapping it for a sentinel; and read
the arrived value the way the *page* holds it — 075's table cells are editable inputs, so
`textContent` came back `""` and the suite said so. A tool whose arrival neither replaces nor saves
beside gets a section of its own, as 075's merge did (5c), rather than a looser assertion in an
existing one.

**What P3 inherits from three increments of P2, so it does not rediscover any of it.** The sheet is
`Share.mount(button, {...})` on a button the page already has, and `Share.receive({...})` on the way
back in; **fifteen pages** are worked examples. Four things cost earlier increments real time.
`Share.open()` exists beside `mount()` for a per-row share that no single `getState` can express
(007). `onMessage(text, isError)` passes the failure flag, so an adopter with a two-colour note never
matches on the wording. The sheet is a **real modal with a backdrop**, so a suite that opens it and
walks away wedges the next click — close it in the same `page.evaluate`. And a `.json` the Download
row writes is wrapped in `{ aplp, state }`, which is what `Share.unwrap()` is for; P1 shipped that
envelope with no reader and no single-file suite could have said so. Read `HISTORY.md`'s P1 notes for
what the QR budget actually measured before assuming any payload fits.

**A P3 candidate that carries images needs the 005 lesson.** `share.js` strips `data:image/` and
`blob:` strings out of the link and QR by policy and says how many; without it a tool that puts
photos in a URL produces a link of **~105 KB for a class of 28** that the clipboard accepts and
nothing else will (measured on 005 in #235). If a P3 tool has images, check the link size before
believing the sheet is a no-op for it.

### Path 7 — Print and export kit

**Why.** Print output is the product: 78 tools call `window.print()`, 63 carry
hand-written `@media print` blocks, 20 use `print-area.css`. The same problems are
re-solved per tool: page margins, a class/date header, "N of M" footers, never
splitting a card or a student's block across pages, grayscale-safe output, and the
three variants of "print one / a class set / blanks". jsPDF, SheetJS and JSZip are
vendored but only 5, 6 and 4 tools use them, so most tools' data is trapped in
localStorage with no file export.

**Phases.**

- **P1 — `_shared/print-kit.css` + `print-kit.js`. Shipped (AI-13, 2026-10-03, v221), with no
  adopter.** Opt-in classes for the recurring layouts (`.pk-page`, `.pk-keep`, `.pk-half`,
  `.pk-quarter` inside `.pk-quarters`, `.pk-cards` + `.pk-card` with six presets (seven since v231 added `4x3`), two of them
  Avery-ish), a header/footer helper (`PrintKit.setHeader({class, date, title})`), and
  `PrintKit.renderSet(container, template, {mode, roster, count, sheet})`, which renders
  one/class-set/blank from a single `<template>`. The roster is handed in (names or
  `Roster.getStudents()` records); the kit reads no storage. `PrintKit.setPage()` owns `@page`
  and the `--pk-page-*` properties the half and quarter sheets divide. The ink-safe set is
  `.pk-ink-safe`, `.pk-hatch-1..6`, `.pk-ink-solid/dashed/dotted/double`, `.pk-label`, handed
  out by `PrintKit.inkClass(i)`. Both file headers are the reference. **What P2 and P3 should
  know:** sheets are sized with `min-height` and never clip; the label presets are checked
  against Chromium's PDF output only, not label stock; there is no running header across the
  pages of one long sheet (a header belongs to a sheet, not to a printed page); and
  `check:print-clip` reads `print-kit.css` only once a live page links it.
- **P2 — Print reliability audit.** With Path 2's `check-print-clip.mjs`, sweep the
  63 hand-written blocks for the fixed-height clipping bug, `page-break-inside`
  on things that must not split, and tools linking `print-area.css` without a
  `#printArea`. Fix in batches.
  **Increment 1 shipped (AI-13, 2026-10-03, v224).** All three static checks were already clean, so the
  audit became a browser sweep: `npm run path7:next` (`Tools/board-check/audit-print.mjs`, ~12 minutes,
  not in CI) reports CLIP, FIXED, SCROLL, CHROME, SPLIT and DARK per page, and `--check` compares a run
  with `print-audit-baseline.json`. Fixed: 077 (the fixed-height card), `_shared/theme.css` (dark tokens
  on paper for 005/011/029/031/036), 002, 018, 020, 037, 040, 043, 079.
  **Increment 2 shipped (AI-13, 2026-10-03, v225).** Seeds for the 18 unmeasured pages, automatic opening
  of "print" tabs, `print-audit-prep.mjs` and a `print()` stub that throws: nothing is "Not measured" now.
  Fixed: 061 (blank sheet), 023 (slips clipped a long prompt), 038 (Ctrl+P), 051, 074.
  **Increment 3 shipped (AI-13, 2026-10-03, v226).** 035's visualizer had no print rule at all; Ctrl+P on
  the Blueprint tab now prints `#bp-print-sheet`, the active floor cropped to what is drawn, on a landscape
  or portrait page to suit (`Tools/schedule-visualizer/test/smoke-print.mjs`). 040 refuses an empty list
  instead of printing a blank sheet. Seeds for 013 014 024 033 084 and prep for 014 015 035 040: no print
  button is left that a seed could reach and does not.
  **Increment 4 shipped (AI-13, 2026-10-03, v227).** 015's map + timeline page gave a long timeline a fixed
  7.5 in and cut the rest off; the strip now yields height to the key and legend and the page runs on to a
  second sheet past that. 035's Schedules, Visualize, What-if and Settings tabs print as documents (the audit
  opens them now). 004, 009 and 010 put their own dark tokens back in print. The audit's new kind **TAIL**
  counts blank paper after a sheet.
  **Increment 5 shipped (AI-13, 2026-10-03, v228).** `body * { visibility: hidden }` leaves the editor's
  height behind, and every print ended in one to six blank sheets. The fifteen pages that do it in their own
  print block now also take everything but the sheet out of the flow (`body > *:not(#printArea) { display:
  none !important }`; 016 keeps its three `.print-only` sheets, 037's sheet is nested and names its path).
  `Tools/print-kit/test/smoke-print-tail.mjs` presses every print button on them and reads Chromium's PDF.
  **Increment 6 shipped (AI-13, 2026-10-03, v229), and P2 is finished.** The same rule went into
  `_shared/print-area.css`, once, for the 20 pages that print through it (`#printArea` is a direct child of
  `body` on all 20, checked in a browser by the suite's "the sheet still shows"). `smoke-print-tail.mjs` covers
  all 35 pages now. The audit reports TAIL 0, and what it still lists is fixed-size on purpose: 042's
  certificate, 046's viewport, 064's trading card and 015's tile, map box and strip (`HISTORY.md`).
  **Nothing in P2 was checked on paper**; that is the parked device check.
- **P3 — Adoption.** Move the class-set/blank tools (042, 043, 023, 070, 076, 077)
  onto the shared set helper first; then the card-grid tools (016, 017, 018, 040,
  051, 064, 074).
  **Increment 1 shipped (AI-13, 2026-10-04, v230): 076, the first adopter.** It was picked as the smallest of
  the six (313 lines, one print button, blank copies only, no roster). Its `@media print` block is deleted;
  `print-area.css` puts `#printArea` alone on the paper and `PrintKit.renderSet()` builds the copies as
  `.pk-half` sheets (`.pk-page` past five prompts). Chromium's PDF has the page count the old block had in
  seven states, light and dark (`Tools/sub-note-feedback-slip-generator/test/smoke-print.mjs`).
  **Increment 2 shipped (AI-13, 2026-10-04, v231): 070 and 077.** 070 is 076 over again: its `@media print` block
  is deleted and "Print checklists" is `renderSet` in blank mode on `.pk-half` sheets; the two smaller type sizes for
  a long checklist stayed in the page as plain rules. 077 turned out not to be a class-set tool at all: it prints one
  small card per student, 2, 3 or 4 across, so it is **the first card-grid adopter** (`PrintKit.chunk`, one
  `.pk-cards.pk-page` grid to a page, `.pk-card` on each card) and does not call `renderSet`. It already linked
  `print-area.css` and had no print block, so what moved to the kit was its grid, its card height and its
  `break-inside`. **The kit changed twice, both asked for by an adopter:** `renderSet(..., { cut: true })` puts
  `.pk-cut` on the upper half sheet of each pair (076's loop, which 070 needed too; 076 now uses it), and a seventh
  card preset, `4x3`, for 077's four across. Suites: `Tools/peer-feedback-checklist-generator/test/smoke-print.mjs`
  and `Tools/testing-accommodations-card-generator/test/smoke-print.mjs`.
  **Increment 3 shipped (AI-13, 2026-10-04, v232): 043, the first adopter with a roster.** Its `@media print` block
  and its `@page` are deleted and all four print buttons go through `PrintKit.renderSet()`: "Print" is `mode: 'one'`,
  `'set'` (one kit page per student, **with the kit's footer**, the name and "3 of 28") or `'blank'`; the missing list
  and the chaperone sheet are one-page documents in `mode: 'one'`, the chaperone sheet **under the kit's header**
  (destination, school line, trip date); the reminder slips are `mode: 'set'` over the students still missing, on half
  sheets with `cut: true`, two to a page where each used to take a page. **The kit did not change.** PDF page counts
  equal the old page's for every button in eleven states, light and dark, except the reminders, which are half as
  many. Suite: `Tools/field-trip-permission-slip/test/smoke-print.mjs`. What `mode: 'set'`, the header and the footer
  needed is in the recipe below (steps 4 to 6 and the list after it).
  **Increment 4 shipped (AI-13, 2026-10-04, v233): 023, the second with a roster and the first on quarter sheets.**
  Its `@media print` block, its `@page` and its second print area are deleted. "Print Handout" is `mode: 'blank'` over
  the slips of one page and "Print Class Set" is `mode: 'set'` over the roster, on `sheet: 'half'` at two to a page
  and `sheet: 'quarter'` at four; the reteach list is one page in `mode: 'one'`. No header, footer or cut line: a slip
  names its student and has its own dashed edge. PDF page counts equal the old page's in fourteen states, light and
  dark, and for the reteach list. **The kit changed twice, both asked for by 023:** `.pk-quarters` is
  `display: grid !important`, because `print-area.css` makes `#printArea` a block by id and the quarters came out one
  to a row (no adopter had printed quarters); and **`.pk-paper`**, a white sheet with black text that leaves the fills
  inside alone, which is what 043 had written for itself (043 uses it now). The rest of what 043 did itself stays in
  the page: 023 uses neither the header nor the footer, so it gave no second vote on their type and inset. Suite:
  `Tools/exit-ticket-generator/test/smoke-print.mjs`.
  **Increment 5 shipped (AI-13, 2026-10-04, v234): 042, the first whose sheet is a fixed size on purpose, and the
  last of the six class-set/blank tools.** Its `@media print` block and the `@page` `<style>` it rewrote on every
  change of orientation are deleted. It takes four things from the kit and nothing else: `print-area.css` to hide the
  editor, `PrintKit.setPage({ paper, orientation, margin })` for the page (Letter, landscape or portrait, 0.35 in,
  the same constant its stock-inset arithmetic uses), `.pk-page` on each `.print-page` for the page breaks, and
  `.pk-paper` on `#printArea`. It keeps its own sheet (`100vw x 100vh`, a slot all or half of it, clipped) and does
  not call `renderSet`: a sheet is a page of one or two certificates, not one student's. **The kit did not change.**
  Chromium's PDF was rasterised from the old page and the new in twelve states, light and dark, and is the same
  pixel for pixel; Ctrl+P prints the certificates where it printed an empty page. Suite:
  `Tools/certificate-award-maker/test/smoke-print.mjs`.
  **Increment 6 shipped (AI-13, 2026-10-04, v235): 074, and `PrintKit.renderCards()`.** The kit's card loop, which
  077 wrote for itself, is in the kit: `renderCards(container, items, preset, buildCard)` empties the container and
  appends one `div.pk-cards.pk-page` per page, `buildCard(item, index)` returning each card's node, which gains
  `.pk-card`. `preset` is a `PRESETS` name (cards that share the page; 077 uses it now, its suite unchanged and
  green) or an object, `{ cols, perPage }`, for **a grid of the tool's own**: `--pk-cols` set inline, the class
  `pk-cards-own`, and no height from the kit, so a one-class rule in the page sizes the card; with no `perPage` it is
  one grid that runs on over the pages. `PrintKit.cardPlan()` is the pure half. 074's labels are that second kind:
  4, 3 or 2 across (a share of the width) and 1.5, 2 or 2.75 in tall at the least (a size, not a share), so it keeps
  its three `min-height` rules and its 0.2 in gap (`--pk-gap` on `#printArea`) and gives the kit its grid, its
  columns and its `page-break-inside`. It had no print block and no `@page` to delete; it gains `setPage()` (Letter,
  half an inch), `.pk-paper`, and Ctrl+P. Old against new in 66 states, light and dark: the same label count, width,
  height, page count, and the same raster in dark; in light the white `.pk-paper` ground moves antialiased edges by
  at most 2 grey levels of 255. Suite: `Tools/science-safety-label-maker/test/smoke-print.mjs`.
  **Increment 7 shipped (AI-13, 2026-10-04, v236): 051, the first adopter that prints a canvas.** Its labels are
  074's kind: three across (a share of the width) and 1.4 in tall at the least (a size), so `{ cols: 3 }`,
  `pk-cards-own`, its `min-height` and its 0.2 in gap kept. Its `@media print` block is deleted (it was the
  `visibility` pair `print-area.css` has, and one break rule). **The kit did not change, and no `_shared/` file
  did.** Two things were new. *A second thing on the sheet:* the reference table follows the grid as
  `div.ref-sheet.pk-page`, appended after `renderCards()`; the grid is a `.pk-page` that is no longer the last
  child, so the table starts a page with no rule in the tool. *A canvas:* each label carries a QR code, and a
  canvas drawn inside `beforeprint` reaches Chromium's PDF as replayed drawing commands, about 4% smaller than the
  bitmap the button printed; so 051 does not build on `beforeprint` but keeps its hidden sheet current, rebuilt
  whenever the words or the language change. Old against new in 24 states, light and dark: the same label count,
  width, height, row gap, QR size and PDF page count; the same raster in dark and within 2 grey levels in light,
  text colour held equal. **One fix to the tool rode along:** its QR drawing widened every dark module by up to two
  pixels, and jsQR could not read 4 of 120 short words' codes; modules are whole pixels now and all 120 decode.
  Suite: `Tools/classroom-label-maker/test/smoke-print.mjs`.
  **Increment 8 shipped (AI-13, 2026-10-04, v237): 040, the first adopter whose preview is the sheet, and the first
  with exact-size cards.** Both its buttons print through the kit: Print (double-sided flashcards, fold-over
  flashcards, word-wall cards, and four puzzle pages) and the alignment test. Its `@media print` block and `@page`
  are deleted; `setPage()` keeps its 0.2 in margin, which the index-card presets need. **All its cards are the second
  kind, a grid of the tool's own** (`{ cols, perPage }`, `pk-cards-own`), for three different reasons: an index-card
  preset is exact inches (3 x 5, 4 x 6); a word-wall card is a share of a 9.5 in grid inside the page's own 0.4 in
  inset, one, two or four to a page, which no kit preset is; and a grid or fold-over card is as tall as its words.
  The kit gives the grid, the columns, the cut into pages and the page breaks; the page keeps its `.page` frame (the
  inset and the dashed margin guide) round each grid, its 0.15 in gap, its equal rows and its sizes. One function
  draws a mode's cards for the preview and for the paper, built with `textContent` (inline-sinks 14 to 10); the four
  puzzle pages are whole pages and stay strings, each now a `.pk-page`. **The kit did not change, and no `_shared/`
  file did.** Old against new in 44 states, light and dark: the same pages, card widths and heights, and PDF page
  counts, and the same raster in dark, but for three things that are better: a long word wraps on a narrow card
  where it was cut off; a long word no longer makes one word-wall column 518 px and the other 168; and **a 3x5
  index-card page is one sheet of paper, where it had always run on to a second, blank one** (10.95 in on a 10.6 in
  page; the alignment test lost its second row to the next sheet the same way). Ctrl+P prints the current mode's
  sheet where it printed an empty page. Suite: `Tools/vocab-flashcard-generator/test/smoke-print.mjs`.
  **Increment 9 shipped (AI-13, 2026-10-04, v238): 064, the first adopter whose card is drawn by a renderer it
  shares with other views.** Its one button, "Print cards", prints through the kit. Its `@media print` block and
  `@page` are deleted; `setPage()` keeps its 0.3 in margin, which three 2.5 in cards and two gutters need. **Every
  size is the second kind, a grid of the tool's own** (`{ cols, perPage }`, `pk-cards-own`): a standard card is
  2.5 x 3.5 in and a reference card 3.5 x 5 in, exact inches for a sleeve or a pocket page; a "fill" card is a third
  of a 7.7 in band (a share, but of the tool's band, not the kit's printable width) and 3.4 in tall. The kit gives
  the grid, the cut into pages of six or four, the page breaks and `break-inside`; the page keeps the card's
  `height`, `width` and `overflow: hidden`, its gap, its column widths, and the banners. The fronts and the
  row-mirrored backs are one list and one `renderCards()` call; the two banners and the SVG defs are inserted
  between and before the grids afterwards. A card is still `HtcmRender`'s string, parsed in a `<template>`: the
  preview, the review game and the PDF export draw the same card. **The kit did not change, and no `_shared/` file
  did.** Old against new in 32 states, light and dark: the same cards, the same markup, the same width, height and
  place on the page, the same PDF page count for a deck of more than one page of cards; **a deck of one page
  printed three sheets on the old page and prints two now** (the editor, hidden with `visibility`, kept its
  height; the audit's seed has eleven cards, a sheet longer than the editor, so its TAIL never saw it). Ctrl+P
  prints the sheet where it printed an empty page. Suite: `Tools/historical-trading-card-maker/test/smoke-print.mjs`.
  **Increment 10 shipped (AI-13, 2026-10-04, v239): 018, the first adopter with six print buttons.** All six moved:
  station cards, answer key and clue cards on the Build tab, team cards, route cards and answer sheets on Live Run.
  Its two `@media print` blocks are deleted (it had no `@page`); `setPage()` is Letter at half an inch. **Every card
  is the second kind, a grid of the tool's own** (`{ cols, perPage }`, `pk-cards-own`): the old rules gave a card a
  share of the page's *width* (one, two or three across) and no height at all, so it is as tall as what is on it,
  and cut the list into pages of 1, 2, 4, 6 or 9 with `page-break-after` on every Nth card. A kit preset is a share
  of the height too, so none fits. The kit gives the grid, the columns, the cut into pages, the page breaks and
  `break-inside`; the page keeps the card, its 8 px gap (`--pk-gap`) and the 4 px at the sides the cards' own margin
  gave. **The six sheets are six areas inside one `#printArea`**, each with the grid container it had, and a button
  builds its sheet, shows it (`.active`) and prints; `afterprint` puts the station cards back, which is what Ctrl+P
  prints. The station sheet has a canvas on every card, so it is kept current from `render()` and nothing is drawn on
  `beforeprint`. Every card and the answer key are built with `textContent` (inline-sinks 13 to 7). **The kit did not
  change, and no `_shared/` file did.** Old against new in 40 states, light and dark, six buttons each: the same
  cards, markup, text, widths, heights, QR sizes, decoded QR text and table columns in all 240, and the same PDF page
  count in 228. **The other twelve are answer sheets as tall as the page or taller, which are better:** the cards'
  4 px top margin pushed a sheet that just fitted (fourteen stations, 959 px on a 960 px page) on to a second,
  almost blank page, eleven pages for nine teams; the grids now have no inset above or below, and it is five. Every
  card sits 4 px higher on its page for it. Suite: `Tools/qr-scavenger-hunt-builder/test/smoke-print.mjs`.
  **Increment 11 shipped (AI-13, 2026-10-05, v241): 017, five print buttons, and the second with a QR sheet kept
  current.** All five moved: QR codes, reference sheet, feedback slips, feedback packets, route cards. Its `@media
  print` block is deleted (it had no `@page`); `setPage()` is Letter at half an inch. **The three card sheets are the
  second kind, a grid of the tool's own** (`{ cols, perPage }`, `pk-cards-own`), for 018's reason: the old rules were
  a wrapping flexbox that gave a card a share of the page's *width* (1, 2, 3 or 4 across) and no height, and cut the
  list with `page-break-after` on every Nth card (1, 2, 4, 6 or 8 to a page). A packet is a page of comments, not a
  card: each is a `.pk-page`. The reference sheet is a table. **Five areas inside one `#printArea`**, with their old
  ids; a button builds its sheet, shows it (`.active`) and prints, and `afterprint` takes `.active` off again. **No
  area is `.active` at rest:** `#printArea:not(.sheet-asked) #printQrArea` shows the QR codes for Ctrl+P, so the
  tool's older suite, which asserts that a dismissed warning leaves `#printQrArea` not `.active`, still means what
  it says. The QR sheet is kept current from `render()`, without the test-scan; the button rebuilds it with the
  test-scan and asks before printing a code that did not read back, as it did. Everything is built with `textContent`.
  **The kit did not change, and no `_shared/` file did.** Old against new in 36 states, light and dark, five buttons
  each (170 sheets; a walk of one station has no route cards): the same cards, markup, text, left, width, height,
  canvas size, decoded QR text, table columns, colours and PDF page count in all 170. Ctrl+P prints the QR codes
  where it printed an empty page. Suite: `Tools/gallery-walk-qr/test/smoke-print.mjs`.
  **Increment 12 shipped (AI-13, 2026-10-05, v242): 016, the last, and P3 is finished.** It has three print buttons,
  not five, and its codes are `<img>`s of a canvas's PNG, not canvases. Its two `@media print` blocks and the
  `@page` `<style>` it rewrote for label stock are deleted. **Three areas inside one `#printArea`**, with their old
  ids; which one prints is the tab that is showing (the body's `mode-bulk` / `mode-scan`), and the buttons' body
  classes (`print-bulk`, `print-inventory`), which 016's older suite asserts, still go on and come off. *One code* is
  not a card: a picture centred on a `100vh` page. *The plain grid* is the second kind, `{ cols }` with no `perPage`:
  a code is a share of the width, as tall as its picture and label, and the old grid ran on over the pages. *Label
  stock* is the second kind with `{ cols, perPage }`: a label is exact inches at an exact pitch and a sheet holds
  cols x rows. *The inventory* is a table, built with `textContent` now. **The kit changed once:**
  `PrintKit.setPage({ margin })` takes two lengths, top and bottom then the sides (`--pk-margin`, `--pk-margin-x`),
  because Avery 5160 is half an inch down and 3/16 in. Old against new in 58 states, light and dark: one code, the
  plain grid and the inventory are the same in every measurement, PDF page count and raster (`pdftoppm -r 96 -gray`,
  38 of 38 states identical). **Label stock is better, not the same:** `<body>`'s `2rem` of padding had stayed above
  the grid in print, so the first sheet's labels sat a third of an inch below the die cut and its last row ran on to
  a second sheet (30 labels on Avery 5160: two pages). The sheet now starts at the first label's corner; the raster
  of a sheet is the old one moved up 32 px, and 30 labels are one page. Ctrl+P prints the showing tab's sheet, on
  that sheet's page. Suite: `Tools/qr-code-generator/test/smoke-print.mjs`.
  **The recipe, which is what a later adopter follows** (P3's thirteen are done; a new printing tool starts here):
  1. *Before touching the page*, press its print buttons in a few states and write down Chromium's
     `page.pdf()` page counts. They go into the new suite as the numbers to hold. **Measure a page that has no
     `@page` rule twice: as it is, and with `page.pdf({ format: 'Letter', margin: half an inch all round })`.**
     With no rule, `page.pdf()` prints edge to edge, which no printer does, and the kit's half-inch margins then
     look like a regression that is not one (070's 36-line checklist 4 pages to 8, 077's fourth row of cards). The
     second count is the fair one. To load the old page again after editing it, answer its URL from
     `git show origin/main:Tools/<file>` in a `page.route()`; nothing in the tree moves.
  2. Link `print-area.css` and `print-kit.css` before the inline `<style>`, and `print-kit.js` in the head.
     The kit has no rule that hides the editor (it is opt-in by class, so it cannot); `print-area.css` is that
     rule. `#printArea` must be a direct child of `<body>`. A page that already links `print-area.css` (077)
     skips this half. **Take `style="display:none"` off the `#printArea` element** if it has one (043 did):
     `print-area.css` hides it on screen, and its print rule cannot undo an inline style.
  3. Delete the page's `#printArea { display: none }` and its whole `@media print` block. Keep only what a
     sheet's *content* looks like, as plain rules: the sheet is never on screen, so they need no media query.
     **Take the vertical margin off the tool's sheet element.** 076's `.slip` had `margin-bottom: 1rem`; two
     `.pk-half` plus two such margins is taller than the printable page, so every slip would land on its own (worked out, not run).
  4. Build one sheet in a function that returns a node, with `textContent`, and hand it to
     `PrintKit.renderSet(printArea, fn, { mode, count | roster, sheet })`. That retires the `innerHTML` string
     and its escaper; lower the page's line in `inline-sinks-baseline.json` in the same commit. Half sheets
     that are cut apart pass `cut: true`. **Quarter sheets are `sheet: 'quarter'`** (023): the kit puts its two-across
     grid on `#printArea` itself, a short last row is left as it falls, and there is no `cut` for them. **A sheet's
     content does not fill the sheet by itself:** a kit sheet has a `min-height`, which a child's `height: 100%`
     cannot see. 023 makes `#printArea .pk-sheet` a column flexbox and its slip `flex: 1 0 auto`. **Space between
     the sheets of a page is padding on their inner edges** (`:nth-child(odd)` and `(even)` for halves, `4n+1` to
     `4n` for quarters), never a margin or a grid gap, either of which makes a page of them taller than the page.
     **A page with two things to print has one `#printArea`:** each button renders into it, and `afterprint` puts
     the default sheet back, so Ctrl+P prints something (023's reteach list). **A card-grid tool does not call `renderSet`:** it calls
     `PrintKit.renderCards(printArea, items, preset, buildCard)` (since v235), where `buildCard(item, index)` returns
     one card's node built with `textContent`; the kit adds `.pk-card`. **Decide first which kind of card it is, from
     the tool's own CSS.** *A share of the page* (077: "three rows to a page"): pass a preset name (`'3x3'`), and drop
     the tool's grid, card `min-height` and `break-inside` rules. *A size of its own* (074's label, 2 in at the
     least; 064's exact trading card): pass `{ cols: n }`, keep the tool's `min-height` or `height` on the card as
     a plain rule, drop only the grid, the columns and `break-inside`, and set `--pk-gap` on `#printArea` if the tool's
     gap is not the kit's 0.125 in, or the cards change width. `{ cols }` alone is one grid that breaks between rows
     wherever the page ends, which is what a flowing grid did before and gives the old page counts exactly; add
     `perPage` only if the tool means "N to a page". **Where a size or column class used to sit on the tool's grid
     element** (`.label-grid.size-small`), put it on `#printArea` (`className = 'pk-paper size-' + size`, written on
     every render) and key the card rules on it. **A card with a drawing** from a constant in the page (074's symbols)
     builds it with `DOMParser` (`image/svg+xml`, with the `xmlns`) and `importNode`; only what is typed goes through
     `textContent`. **Render in a function and call it on `beforeprint` as well as from the button**, so Ctrl+P prints
     the sheet (it printed an empty page on 042 and 074). **Unless a card has a `<canvas>` on it** (051's QR codes;
     016, 017 and 018 will): a canvas drawn inside `beforeprint` is printed by Chromium as replayed drawing
     commands, not as its bitmap, and 051's code came out about 4% smaller than the button's (seen in `pdfimages
     -list`: no image objects, and in a 300 dpi raster). Such a tool keeps the hidden sheet current instead: call the
     render function wherever the data it reads changes (051: at the end of `renderTable()`), and have no
     `beforeprint` listener. Its suite asserts `/Subtype /Image` is in the PDF and reads every code back with
     `_shared/vendor/jsqr/jsqr.js` (`page.addScriptTag`), which is how 051's undecodable codes were found.
     **A second thing after the grid** (051's reference table): `renderCards()` empties the container, so append it
     afterwards with the class `pk-page`. The grid is then not the last child and breaks the page after itself; the
     tool needs no break rule, and its old `margin-bottom` under the grid goes (it sat at a page end).
     **A page frame of the tool's own round each grid** (040's `.page`: a 0.4 in inset and a dashed margin guide):
     call `renderCards()` with `{ cols, perPage }`, then loop over `container.children` and put each grid inside a
     frame (`replaceChild`, then `appendChild`), with `pk-page` on the frame; the grid inside is a last child, so its
     own `pk-page` breaks nothing. A label per page (040's alignment test) goes into the frame in the same loop.
     **An exact-size card on an own grid** (040's index cards, 3 x 5 in; 064's trading card is next): a rule in the
     page overrides the kit's columns, `grid-template-columns: repeat(var(--pk-cols), var(--w))` and
     `grid-auto-rows: var(--h)` on `.pk-cards.<a class of the tool's>`, with the two sizes set on the grid in the
     same loop; one class more than `.pk-cards` is enough to win. **Then check the page of exact cards fits the
     paper** (rows, gaps and any inset against the page less its margins): 040's 3x5 page was 10.95 in on 10.6 in
     and had printed a blank sheet after every page for as long as the preset existed, which the held PDF count
     would have carried on holding. **Rows that must be one height** are `grid-auto-rows: 1fr` on the grid, if every
     page is padded to a full grid. **When the preview is the sheet and the sheet is cards** (040), draw the preview
     with the same function into a detached `div` and move the wanted page into the preview; `.pk-cards` is a grid
     on screen too, so nothing else is needed, and the string builders go. **`.pk-card` itself changes two things:**
     `min-width: 0` makes `1fr` columns equal whatever is in them, and `overflow-wrap: anywhere` wraps a word the
     old card cut off. Both were improvements on 040, and both move a measurement, so compare old and new with
     short words first and then with a long one. **`beforeprint` and two buttons:** a flag the buttons set and
     `afterprint` clears keeps `beforeprint` from replacing the sheet a button has just built (040's alignment
     test), and from reshuffling a shuffled list.
     **A card whose markup comes from a renderer other views share** (064: the preview, the review game and the
     PDF export all call `HtcmRender`): do not rebuild it. `buildCard` returns the string parsed in a `<template>`
     (`t.content.firstElementChild`), the renderer goes on escaping what is typed, and the inline-sinks count does
     not move (one `innerHTML` out, one in); the suite types markup into a name and reads it back as text. **Fronts
     and backs** are one list (every padded page of fronts, then every mirrored page of backs) and one call with
     `perPage`; pad each page to a full grid yourself, with whatever the tool's blank card is, because the kit pads
     nothing and a short page of backs would not sit under its fronts. **Things between the grids** (064's two
     banners, its SVG defs) go in with `insertBefore` after the call, as 051's table is appended. A banner before
     a grid needs no break rule: the grid before it is a `.pk-page`. **An exact card that already has `height`,
     `width` and `overflow: hidden` on its own class keeps all three untouched** (`.pk-cards-own` gives a card no
     height, and `.pk-card`'s `min-width: 0` does nothing to a card with a `width`); 064 needed no `grid-auto-rows`
     and no size variables, only `repeat(var(--pk-cols), 2.5in)` on its own two-class rule. **A test that clones
     `#printArea` into a probe** (064's card-size suite) loses any rule keyed on the id, so key the gap and the
     columns on classes. **`beforeprint` with photos:** the button waits for its `<img>`s before `print()`;
     Ctrl+P cannot wait, so a photo not yet decoded may be missing from that one print (not seen, not ruled out).
     **Measure a one-page state as well as a long one before you hold the old PDF count:** 064's old page ended
     in a blank sheet only when the sheet was shorter than the editor, which the audit's eleven-card seed never is.
     **Several print buttons with a canvas on some sheets** (018 has six buttons, 016 has five): one `#printArea`
     holding one area per sheet (`.print-only`, `display: none`, and `.active` shown, both plain rules), each area
     keeping the grid container the tool already had, so the tool's other suites still find their cards by the old
     ids. A button builds its own sheet (in the click, which prints a canvas as its bitmap), shows its area and
     calls `print()`; one `afterprint` listener shows the default area again. Only the default sheet is kept
     current for Ctrl+P, from the tool's own render function. This is not 023's "each button renders into
     `#printArea`": that would redraw the default sheet's canvases inside `afterprint`, and it renames every
     container. **A card that is a share of the width and as tall as its content** (018) is the second kind too:
     `{ cols, perPage }` with no height rule at all. **A card margin becomes the grid's gap and side padding**
     (018's `margin: 4px` is `--pk-gap: 8px; padding: 0 4px` on `.pk-cards`), which keeps the card's width to the
     pixel; **leave the padding off the top and bottom**, where it makes a card a few px short of the page spill
     on to a blank one. **A table on a card** (018's answer sheet) gets `overflow-wrap: break-word`, because
     `.pk-card`'s `anywhere` lets an auto-layout table squeeze its columns. **Do not hold a PDF page count for a
     card whose height is its text and lands within a few px of the page:** another machine's fonts put it on
     the other side; assert the property (a card that fits is one page) for that case, as 018's suite does.
     **A row of underscores to write on** (017's slips: `★ ______`) gets `overflow-wrap: normal`: `.pk-card`'s
     `anywhere` breaks the rule in two on a narrow card, and every 017 slip three across came out 66 px taller and
     the sheet a page longer. Compare card *heights* against the old page, not only widths; that is what showed it.
     **A default sheet with no `.active`** (017): if an older suite of the tool reads `.active` on the default area
     to mean "the button went through", do not write `.active` into the markup as 018 did. `showSection(area)` puts
     a class on `#printArea` (`sheet-asked`) with the area's `.active`, `afterprint` calls `showSection(null)`, and
     one plain rule, `#printArea:not(.sheet-asked) #<default area> { display: block }`, is Ctrl+P's sheet.
     **That older suite must stub `print()`:** headless Chromium fires `afterprint` inside `print()` itself, so a
     real call has already stepped the sheet down when the next line reads it (017's scan-verify suite got a
     one-line `addInitScript`; no assertion changed). **A thing that is a page, not a card** (017's packets) is a
     `div.pk-page` appended in a loop, no `renderCards()`. **A build with a costly check** (017 test-scans every
     600 px code with jsQR) takes a flag: the render function keeps the sheet current without it, the button
     rebuilds with it. **The hidden sheet has no `innerText` line breaks:** a suite that reads a card's words
     walks its text nodes, or reads them in print media. **Sheets chosen by a class on `<body>`** (016: `mode-bulk`,
     `mode-scan`, and a button's `print-bulk` / `print-inventory`): keep the classes if an older suite reads them,
     and key each area's `display` on them with plain rules, a button's class winning over the mode; nothing is
     `.active`. **A page whose `@page` follows the sheet** (016's label stock) has one function that reads the same
     state the CSS does and calls `setPage()`; call it wherever that state changes (the tab, a new grid, each button,
     `afterprint`), not on `beforeprint`. **Label stock** is `{ cols, perPage: cols * rows }` with the label's size
     and gutters as custom properties on the area, and `setPage({ margin: 'top side' })`. **Nothing may stand above
     the first label:** on the old page `<body>`'s padding did, in print, and the whole first sheet was a third of
     an inch low; measure the first label's top against the printable page, not against the old page. **A sheet that
     was a centred, shrink-to-fit flex child of `<body>`** (016's plain grid and inventory) keeps its size with
     `width: fit-content; max-width: 100%; margin: 0 auto`. **A picture that is an `<img>`** is not the canvas trap,
     but set its `src` from the tool's render, not on `beforeprint`, where it may not have decoded.
     **A class set is `{ mode: 'set', roster: names }`** and the function reads `sheet.name` (043). **A tool whose
     sheet is also its live preview** keeps its escaped string and returns it parsed: `t = createElement('template');
     t.innerHTML = html; return t.content` (043's `nodeFrom()`); the preview and the print then cannot drift, and the
     `textContent` rewrite is a separate job. **A single document** (a list, a roster page) is `mode: 'one'` with a
     function that ignores its argument; pass `name` or the kit marks the sheet `pk-sheet-blank`. Every sheet is now
     inside its own `<section>`, so a suite selector like `.slip:nth-of-type(2)` stops matching: count `.pk-sheet`.
  5. Call `PrintKit.setPage()` once, so `@page` and the size `.pk-half` divides agree. A tool that had its own
     `@page` (043 and 023 did at 0.4 in, 042 at 0.35 in) passes that margin here instead, and deletes the rule.
     **A tool that prints in either orientation** (042) calls `setPage({ orientation, margin })` again whenever the
     setting changes; the kit rewrites its one `<style>` in place.
     **A sheet that must be an exact size** (042's certificate, for pre-printed stock; 064's trading card will be the
     next) keeps its own `height` and its own clipping as plain rules, takes only `.pk-page` for the break, and skips
     `renderSet`, whose sheets are `min-height`. Size a full-page sheet `100vw x 100vh`, not from `--pk-page-h`: the
     `calc()` came out a fraction of a pixel taller in Chromium's PDF (one raster row at 48 dpi), and the viewport
     units reproduce the old page exactly. The audit goes on reporting it as FIXED, which is true; leave its baseline.
     **The footer and the header** (043 is the example). `footer: true` on a class set prints the student's name and
     "N of M"; ask for it only in `mode: 'set'`, since one sheet or a run of blanks has nothing to count. It costs
     about 33 px under the tool's sheet (23 px and a 0.6 em margin): check the sheet plus the footer still fits the
     page before turning it on, by PDF page count. `header: true` prints what `PrintKit.setHeader({ title, class,
     date })` was last given, **as text**: a value the page keeps as markup (043's `&ndash;` date range) needs a text
     form. The header is page-wide state, so every other `renderSet()` call on the page says `header: false`. Both
     are drawn on `#printArea`, outside the tool's own sheet, so the page gives them its sheet's type, an inset to
     match the sheet's padding. Their ink and the white behind them come from `.pk-paper` (step 6).
  6. **`class="pk-paper"` on `#printArea`** (since v233): white paper and black text in print from either theme,
     with every fill, grey and drawn grid inside left as the tool set it. Use `class="pk-ink-safe"` instead if the
     sheet has grey rules or muted text that should print black and no fill worth keeping. A tool that sets
     `#printArea.className` when it renders (023 does, for its slip size) writes `pk-paper` back each time.
  7. Give the tool a suite (next free port **8480**), add it to `suites.json` and `package.json`, add the page
     to `smoke-print-tail.mjs`'s table if it newly links `print-area.css`, bump `CACHE_VERSION`, paste
     `check:adoption`'s row into the header, and take one off the header's hand-written print block count.
  **What the kit did not have, and an adopter did itself** (none of it blocked an adoption; a second adopter that
  needs the same thing is the reason to move it into the kit):
  - *No per-sheet hook.* A function template is called with the sheet but never sees the `<section>` the kit
    wraps it in, so 076 added `.pk-cut` to every other sheet in a loop after `renderSet()`. **Moved into the kit in
    v231** as `cut: true`, when 070 needed the same loop. It is for half sheets only: on quarter sheets `.pk-cut`
    also draws a right-hand line, and no adopter has needed those yet. There is still no general hook.
  - *No card renderer.* 077 built its grids in a loop over `PrintKit.chunk()`. **Moved into the kit in v235** as
    `PrintKit.renderCards()`, when 074 needed a grid too; 077 calls it now.
  - *A card is a share of the page, never a fixed size* (except the two label presets). 077's cards went from a
    2.6 in minimum to a third of the printable page (3.24 in), three rows either way. **Answered in v235** for a
    tool whose card has a size of its own: `renderCards(..., { cols }, ...)` and `.pk-cards-own`, which takes the
    kit's row height off the card. 074 uses it with a `min-height`; 064's exact `height` has not been tried on it.
  - *An own grid has no "N of M" and no per-page hook.* A flowing grid is one element over several pages, so there
    is nowhere to hang a page footer, and `.pk-page` on it only matters when `perPage` cuts it. No adopter has asked.
  - *No page frame round a grid, and no hook to add one.* 040's grid sits inside its own `.page` (an inset and a
    margin guide), and its alignment test labels each page. It wraps each grid in a loop after `renderCards()`
    (v237). One adopter; a second that needs it is the reason for a `wrap(grid, pageIndex)` callback in the kit.
  - *Header and footer were not used* by 076, 070 or 077. A slip has its own title and a "Date / Class / Sub name"
    line of write-in rules; the kit's header prints values, not rules, and "3 of 5" on five identical blanks says
    nothing. **043 used both (v232)** and found four things. **023 (v233) decided one of them:** the white paper and
    black ink are `.pk-paper` in the kit now. 023 prints no header and no footer (a slip carries its student's name;
    the reteach list has its own heading), so the other three are still one adopter's, and stay in 043's page:
    - *An empty header still rules a line.* With no title, class or date the three spans are hidden and the
      `.pk-header` border prints alone. 043 passes `header: false` when all three are empty.
    - *The header does not suit a sheet with a letterhead.* A permission slip opens with the school line and its
      title; a kit header above that says it twice. It went on the chaperone sheet, which had no date on it at all.
    - *A footer belongs to a kit sheet, not to a printed page.* With a second language on a facing page one student
      is two pages in one sheet, and the footer prints once, under the translated slip. A sheet longer than a page
      gets it on its last page only.
    - *No class for the tool's own sheet to hook.* The function template never sees the `<section>`, so the footer
      inset and colour are `#printArea .pk-footer` rules in the page (the "no general hook" gap again).
  - *The class field was not routed through `setHeader()`.* A `data-pk="class"` slot is emptied when the class
    is blank, and 076 prints a rule to write on there. The kit swaps in `.pk-blank-line` for a blank *name* only.
  - *A kit class on `#printArea` lost to `print-area.css`'s id rule.* Fixed in v233 for `.pk-quarters`. Any later
    kit rule that sets `display` or position on the container has the same fight; `smoke-print-kit.mjs` has the case.
  **P3 is finished: all thirteen print through the kit** (076 070 077 043 023 042 074 051 040 064 018 017 016).
  **What P3 left unfixed across the adopters** (each the same before its adoption; none is a row yet):
  - *The page colour under a short sheet.* With the browser's "background graphics" ticked, the paper below a sheet
    shorter than the page takes the page's colour, dark in the dark theme: `.pk-paper` whitens `#printArea`, not
    `<body>`. All thirteen share it. One kit rule would fix it (a white `body` in print where it holds a
    `.pk-paper`); not written, because it changes every adopter's raster at once and wants the full `npm test` and
    a look at each.
  - *043's bilingual pair* is 1010 px on a 979 px page, so two sheets per student; and its sheets print
    `#1f2430`, not `#000`, from the dark theme (`.paper-sheet` re-declares `color`). Below, "Found on 043".
  - *042 at two per page:* a certificate alone on its sheet fills the whole page while the stock inset is worked
    out for half. Below, "Found on 042".
  - *017:* a slip's 31-underscore rule runs over the card's right border three across.
  - *016:* the plain grid keeps `<body>`'s old `2rem` above its first row on the first page only (kept, so the
    sheet is the old one pixel for pixel); Ctrl+P on the Bulk tab before a grid is generated is an empty page.
  - *The header, the footer and a per-sheet hook* are still one adopter's (043); the list above says what each lacks.
  **How to prove an adoption changed nothing** (042, and worth repeating where `pdftoppm` is installed): print the old
  page and the new to PDF in the same states, `pdftoppm -r 48 -gray` each, and compare the pages' bytes. It caught
  the fraction of a pixel above, which page counts and the audit both passed.
  **Found on 042 and not fixed** (the same before the adoption): at two per page, a certificate alone on its sheet
  (one certificate, or the last of an odd batch) is stretched over the whole page, while the pre-printed stock inset
  is worked out for half a page, so its top and bottom safe area is twice what was asked for. A full-page certificate
  that then reads oddly is a product call, so it was left.
  **Found on 043 and not fixed** (its own layout, the same before the adoption): the side-by-side bilingual pair is
  1010 px tall with a one-line description and the printable page is 979 px, so every student prints on two sheets;
  and a sheet printed from the dark theme is in `ink-paper.css`'s light ink (`#1f2430`), not the `#000` the page asks
  for, because `.paper-sheet` re-declares `color`. (`.pk-paper` fixes this for text that inherits from `#printArea`,
  as 023's does; 043's sheets carry `.paper-sheet` themselves and still print `#1f2430`.)
  **Not verified:** nothing was printed on paper.
- **P4 — Export layer (Fable for the PDF pagination and imposition math).**
  `_shared/export.js`: `toPdf(printArea, {paper, orientation})` built on the
  vendored jsPDF for tools that want a file rather than a dialog; `toCsv/xlsx(rows)`
  via SheetJS for every tool holding tabular data; `toZip(files)` for multi-sheet
  generators. Booklet/N-up/duplex imposition lives here too (it took over
  `duplex-print.js` and the second copy in `vfg-layout.js`; both are gone since v245).
  **Increment 1 shipped (AI-13, 2026-10-05, v243): the math and `toPdf`, with no adopter.** `_shared/export.js`
  publishes `ExportKit`; its header is the reference. Suites: `Tools/export/test/export.test.mjs` (pure Node) and
  `smoke-export.mjs` (port 8480, the vendored jsPDF in Chromium), together `npm run test:export`.
  **The surface for all of P4. All three groups exist; `_shared/export.js`'s header is the reference.**
  - *Imposition and pagination, pure, shipped.* `booklet(n, { sheetsPerSignature, flip, rtl })`, `nUp(n, { cols,
    rows, order, rtl, duplex })`, `sheetCount()`, `sides(sheets, { stack, reverseBacks })` (front-back-front for a
    duplex unit, or every front and then every back for a stack fed by hand), `flipAxis(orientation, flip)`,
    `backIndex()`, `mirrorPage(items, { cols, rows, orientation, flip })` (a card's back behind its front, for
    either edge), `paginate()` and `mirrorPageRows()` (the old `duplex-print.js`'s two, to the letter), `layout({ sheet,
    cols, rows, margin, gutter, page, fit, align })`, `creep()`, `cutMarks()`, `matrix()`, and
    `paginateBlocks(blocks, pageHeight, { gap, firstPageHeight, minSlice })` for a PDF no CSS lays out: whole
    blocks, `split`, `keepWithNext`, `breakBefore`, and `overflow` on a block taller than its page, which is placed
    and never clipped. Points throughout; `toPt()` reads `in`, `mm`, `cm`, `pt`, `px`.
  - *`toPdf(pages, { paper, orientation, margin, gutter, pageSize, impose, stack, cutMarks, filename, title })`,
    shipped,* and `pdfPlan(n, opts)`, the same job as data. A page is a canvas, a loaded `<img>`, a data URL, or a
    function `(doc, { w, h, page })` that draws with jsPDF in points. `impose` is `{ kind: 'booklet', … }` or
    `{ kind: 'nup', … }`. Synchronous; returns `{ doc, plan }`.
  - *The file helpers, shipped in increment 2 (AI-13, 2026-10-05, v244), to the design that stood here.*
    `toCsv(rows, { columns, delimiter, bom, raw })` returns a string: rows are arrays or objects, `columns` (keys, or
    `{ key, label }`) names the order and the header row, and object rows with no `columns` take every key in the
    order first seen; RFC 4180 quoting, CRLF after every record, a UTF-8 BOM unless `bom: false`. **A string that
    starts with `=`, `+`, `-`, `@`, a tab or a return gets a leading `'`** unless `raw: true`; a number is not a
    typed cell, so `-5` the number stays `-5`. A Date is local `2026-10-05`, with its time when it has one.
    `toXlsx(sheets, { filename })` on the vendored SheetJS returns a Blob: `sheets` is rows, one `{ name, rows,
    columns }` or a list of them; a string is a shared-string cell whatever it starts with, a number a number, a
    boolean a boolean, a Date a date-formatted serial in local time, and nothing is ever a formula; names lose
    `[]:*?/\`, are cut to 31, and a repeat gets ` (2)`. `toZip(files, { filename })` on the vendored JSZip is a
    promise of a Blob: data a string, Blob, ArrayBuffer, typed array or canvas (stored as a PNG); a path separator
    becomes a hyphen, so the zip is flat, and a repeat (case-blind) gets ` (2)` before its extension.
    `download(data, filename, mime)` is the one anchor click and returns the Blob; `filename(title, ext)` is a name
    every desktop accepts. `toXlsx` and `toZip` throw an error naming the vendor file when the library is not on the
    page; `opts.XLSX` and `opts.JSZip` hand one in. Nothing was vendored. **No tool calls any of the five yet.**
    Not built, because nothing asked: a `header: false` for object rows, column widths, a zip with folders.
  **`toPdf` does not take a DOM element, and that is this session's call, cheap to reverse.** The sentence above
  says `toPdf(printArea, …)`. The vendored jsPDF's `html()` needs html2canvas, which is not vendored (about 200 KB
  more in the precache), and what it makes is a picture of the page: text nobody can select, at screen resolution.
  The print dialog's "Save as PDF" already turns a kit sheet into a real PDF, and that is what P1 to P3 built. So
  `toPdf` is for the tools that can draw their pages (the canvas tools 011, 046 and 064; tables through AutoTable
  with `paginateBlocks` deciding the breaks), and a DOM sheet goes to the dialog. To reverse it: vendor
  html2canvas with the README and precache bookkeeping, rasterise each `.pk-page` to a canvas, and hand the
  canvases to `toPdf` as it is; nothing in the surface changes.
  **Adoption. 064 is done (increment 2, v244) and 040 (increment 3, v245); what is left follows them.** 064's `exportPdf` in `htcm-export.js`
  takes its pages from `ExportKit.paginate`, its backs from `mirrorPage` and its sheet from `toPdf` (3 x 2 on
  letter, the cards as JPEG data URLs, a no-op draw function for an empty cell), and the page's print button takes
  `paginate` and `mirrorPageRows` from `ExportKit` too; `npm run test:trading-card-pdf` (port 8481) reads the file.
  The old and new PDFs were compared for eight decks: same pages, same image bytes in the same order, same pixels.
  **Increment 3 shipped (AI-13, 2026-10-05, v245): 040 is the second adopter, and `_shared/duplex-print.js` is
  deleted.** 040 has no PDF export, so what moved is its print pagination: `ExportKit.paginate` cuts the
  flashcards, fold-over cards and word-wall cards into pages, and one `backsOf()` calls `ExportKit.mirrorPage` with
  `{ orientation: 'portrait', flip: 'long' }` for the cards and for the alignment test; `vfg-layout.js` has neither
  function now. 040 offers one turn edge (long), so there was one to compare: old against new in 160 states, same
  page count, paper, card boxes and text, and the same pixels. `npm run test:vocab-imposition` (port 8482) checks
  on the paper that every definition is behind its own word. With no page loading it, `duplex-print.js` went, with
  its two `sw.js` lines and its ESLint global; `export.test.mjs` keeps a copy of the two functions and still holds
  `ExportKit`'s to their answers. (An earlier note here said `printables-logic.test.mjs` covered 040's two
  functions. It never called them; only `export.test.mjs` did.)
  **Increment 4 shipped (AI-13, 2026-10-05, v248): 011 is the third adopter, and the file helpers have their
  first.** 011 (Image → PDF) has a "Booklet & Pages per Sheet" card: off, booklet, or 2, 4, 6 or 9 pages to a
  side; one-sided or two-sided with the edge the printer flips on; cut marks for pages per sheet; creep for a
  booklet. How a tool that draws with jsPDF adopts `toPdf`: 011's `buildAtQuality()` has one `startPage()` and one
  `draw(step)`; with no layout a step runs at once on the millimetre document, call for call what the function
  did before, and with a layout the steps are recorded per page and `toPdf` runs them in the page's slot, in
  points (each step multiplies its lengths by `K`). The layer gained two things 011 asked for: `toPdf`'s
  `compress: true`, and `flip` on a two-sided N-up (`nUp(…, { turnBack })`: the backs are set upside down when the
  edge brings the sheet over top to bottom, so it always reads like a book). The layout is not saved between
  visits, only its details are; that is 011's own rule for an option that changes what the download is.
  `npm run test:image-to-pdf-impose` (port 8483) reads the file. 064's `exportZip` builds its list and calls
  `toZip`, and its PNG and zip downloads go through `download`: the same entries with the same bytes inside, the
  file about a fifth smaller (deflated; it was stored). `npm run test:trading-card-pdf` reads the zip now too.
  **Increment 5 shipped (AI-13, 2026-10-05, v249): six pages save their CSV through `toCsv`.** The survey
  first, since "twelve pages" above was a grep for `text/csv` and two of its hits (017, 038) are a file
  input's `accept`. **Ten pages write a CSV by hand, and four write a workbook:**

  | Tool | What it saves | What was wrong with the file | Now |
  |---|---|---|---|
  | 003 Rubric Builder | every scored student: points per criterion, total, percent, comment | no byte order mark (Excel shows `Zoë` as `ZoÃ«`), no formula guard | `toCsv`, v249 |
  | 008 Behavior Points | archived days: date, student, points, taps | no mark, no guard | `toCsv`, v249 |
  | 018 QR Scavenger Hunt | stations: label, question, note, type, answer, hint, code word | no mark, no guard (a note typed `-5 is wrong` opened as `#NAME?`) | `toCsv`, v249 |
  | 033 SSR Log | reading log: student, date, book, genre, pages, minutes | no mark, no guard, a bare carriage return left unquoted (the row breaks in two) | `toCsv`, v249 |
  | 068 Parent Contact Log | contacts: date, student, method, reason, outcome, initials | no guard (an outcome typed `-left voicemail`), a bare carriage return unquoted; it had the mark | `toCsv`, v249 |
  | 075 Staff Directory | name, room, extension, department; **it also imports this file** | no mark, no guard (an extension typed `+1 555 0100`), a bare carriage return unquoted | `toCsv`, v249; Import takes the apostrophe off again |
  | 001 Hall Pass Log | a range report (title lines, totals, every pass), as CSV and as a two-sheet workbook | no guard in the CSV; it has the mark and quotes a carriage return. The workbook is `aoa_to_sheet`, which writes a string as a string, so nothing to fix there but the copy of the code | left |
  | 006 Class Roster Hub | one roster or all of them, as CSV and as a workbook; **it imports both** | no guard in the CSV (it has the mark and quotes a carriage return); its import would have to take the apostrophe off, as 075's does | left |
  | 030 Review Game Board | a blank template workbook | nothing wrong; a copy of `XLSX.writeFile` | left |
  | 036 Final Grade Checker | `final_grades.xlsx` | not read closely; `aoa_to_sheet`, so strings stay strings | left |
  | 035 Schedule Visualizer | `groups-template.csv`, three fixed lines | LF line ends, no mark, nothing typed in it | left: 035 is AI-31's |
  | 060 Fitness Tracker | assessment results | no mark, no guard, a bare carriage return unquoted | left: an AI-31 worker had the page in this batch |

  032 and 038 only read a workbook. The six that moved were taken worst file first and stopped at six; 001 and
  006 are next and are the first `toXlsx` adopters (a CSV and a workbook from one table each).
  **How a page adopts `toCsv`, as the six did.** Link `../_shared/export.js`; delete the page's own cell
  quoting and its Blob and anchor; hand the rows as arrays to `ExportKit.toCsv(rows)` and the text to
  `ExportKit.download(text, name, 'text/csv;charset=utf-8')`, keeping the tool's own file name. **A computed
  number goes in as a number, not as its text:** the guard is for typed cells, and `"-3"` the string would come
  out `'-3` (003's scores were strings from `fmtNum()`; they are numbers now, the same digits). A page that
  imports its own file strips a leading apostrophe that stands before `=`, `+`, `-` or `@` (075's
  `unguardCsv()`). Then a row in `Tools/export/test/_csv-adopters.mjs`: the seed, the button, the file name, the
  numeric columns and the table the file must hold; `smoke-csv-adopters.mjs` does the rest (the mark, CRLF, strict
  RFC 4180, the apostrophe on every typed formula and on no number, every cell as typed, the bytes against a
  writer of its own, and the round trip for a page with an import), and its `PAGES` list gets the page so CI's
  selector runs it when the page changes. Old against new for the six, each on its sample data and on cells
  built to break a CSV: the new file is the old file's cells with the mark, a CRLF after the last row, the
  apostrophes and the quoted carriage return, and nothing else differs. What differs on purpose and a teacher may
  notice: a cell typed `-` (075's "no room") opens in a spreadsheet as `-` still, but the file holds `'-`, so a
  program that is not a spreadsheet shows the apostrophe.
  **What is left of P4.** 001 and 006 (CSV and workbook, one PR each; 006's import round trip is the care), then
  030 and 036's `XLSX.writeFile` calls, which are tidying and fix nothing; 035 and 060 when their pages are free.
  `toXlsx` has no adopter. 011's layouts leave three things unbuilt, all in the layer already and none asked for: a
  preset for a one-sided printer (`stack: 'fronts-first'`), signatures, right-to-left.
  **Known limits, none of them a row yet.** A slot is not clipped, so a draw function that runs off its page
  runs onto its neighbour. A slot turns 0 or 180 degrees, not 90, so N-up never turns a page to fit. A booklet has
  no cut marks of its own (it is folded, not cut). Creep is the linear model. Two-sided N-up always emits the
  back of the last sheet, blank or not (011's two-sided files can end in an empty page for that reason). `layout()` rounds to a billionth of a point (064 found a card at
  215.99999999999997 pt, which a rasteriser at 96 to the inch draws a pixel left of one at 216).
  **Not verified:** nothing was printed, no booklet was folded and no duplex unit turned a sheet; the fold and the
  turn are models in the Node suite. The raster check needs `pdftoppm`, which huginn has; where it is missing the
  browser suite says so and checks the file's structure only. No CSV or workbook was opened in Excel, Sheets or
  Numbers (huginn has none): the workbook was read as XML by a reader written in the suite, by Python's `zipfile`
  and by SheetJS, and the apostrophe guard is the documented defence, not one seen working in a spreadsheet.
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

**The pairing codes' size, fixed 2026-10-03 (AI-10, v223; was rank 6).** Every pairing
adopter drew its offer and reply with its own copy of one loop into a canvas a stylesheet
then held to 180 to 260 px: 2.0 to 2.9 px per module for the 569-byte, 81-module code,
under the 4 px floor, on all eight pairings (001, 004, 006, 009, 010, 021, 035 on a phone,
019's monitor). All of them now call `QrDraw.fit()`, which sizes the code from the room its
parent has and says so on the page when there is not enough, and `webrtc-pair.js` writes a
lossless compact code of about 190 bytes (49 modules, 228 px at the floor), so the reply
fits a 375 px phone. `smoke-pairing-qr.mjs` measures every one on a board and a phone.
**P1 should build `_shared/remote.js` on `QrDraw.fit()` and not write another renderer.**
What is not known is whether a real phone reads them (parked device check 4), and what
Firefox's and Safari's SDP compress to: only Chromium's was seen. `HISTORY.md` has the rest.

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
  **Designed, not built (AI-18, 2026-10-05). Everything from here to P3 is the design; no code exists for it.**
  Read from the tree at v245: 032's page, `scv-pacing.js`, `scv-store.js`, `scv-seed.js`, both suites, and the
  two readers (010, 045). Figures marked *measured* came from two pure-Node probes over the shipped 2026-27 seed
  and the shipped modules; they were not kept. Questions that are Devon's are listed at the end and not answered.
  - *What is there today, as read.* Two pacing layers that do not know about each other. (1) `cal.pacing =
    { startDate, lessons, adjustments }`: one lesson sequence, one lesson a school day, placed by `placeLessons()`
    on every render. **It already recomputes** round a no-school tag; a bump is `{ id, beforeLessonId, reason,
    createdOn }`, one empty slot before a lesson, which travels with the lesson. (2) `cal.units = [{ id, name,
    start, end, color }]`: date ranges the teacher types, with a count worked out by `unitInstructionalStats()`.
    Units may overlap, sit in any order, and are not tied to the lesson codes' `U<n>`. `units` and `abCycle` are
    optional fields: `isValid()` and `migrate()` in `scv-store.js` do not mention either, and both arrived with
    no `__v` change. One "school day" predicate (`isTeachableDay`: a weekday with no `noSchool` type) serves the
    lessons, the unit count and the A/B cycle. Half days and testing days count as full days; the seed tags no
    testing day. 010 and 045 read `days[date].types`, `.lesson` and `.note` with a plain `JSON.parse`; **neither
    reads the placement**, so no tool but 032 knows today's paced lesson. Only `scv-store.js` writes the key.
  - *Measured.* The seed has 184 school days, 13 of them half days; with A on the first day, 92 A and 92 B; the
    three `mpend` tags cut it into 45, 46, 47 and 46 days. Turning a fixed unit into "first school day on or
    after its start, plus its counted days" gives back the same set of school days for every one of the 40,528
    start/end pairs in the seed year that hold a school day (227 pairs hold none); the start date moves in
    14,329 of them and the end in 14,103, only off a weekend or closure. A 20-day unit from 2027-01-04 ends
    2027-02-02, and 2027-02-03 once 2027-01-12 is a snow day. **032's A/B cycle slides: after that snow day the
    letter of all 99 later school days flips.** One bump on a 184-lesson list that alternates A and B puts 143 of
    the 144 later lessons on the other letter's day (the last overflows); a second bump puts them back. A blob
    with `__v: 3` fails the shipped `isValid()`, so the shipped `get()` returns the seed, and the page's next
    `save()` writes the seed over the teacher's calendar; a `__v: 2` blob with an extra `plan` field passes.
  - *The storage decision, mine, and to be settled before the build, not after: no `__v` bump.* The new model
    lives in one new optional field, `cal.plan`, with a version of its own; `__v` stays 2 and `isValid()` is not
    touched. The reason is the measured line above: a page from an older cache (a second device on its first
    visit after the update, or a 009 restore into one) that meets `__v: 3` shows the seed and overwrites on the
    first click. An older page that meets `plan` ignores it and writes it back, since it saves `cal` whole. P1's
    `bell` should be added the same way; if P1 bumps `__v` anyway, nothing here depends on it.
  - *The model.* `cal.plan = { v: 1, active: courseId|null, algo: 1, courses: [Course] }`.
    `Course = { id, name, color, meets: 'all'|'A'|'B', start: ISO|null, pace: { [dayTypeId]: 'count'|'skip' },
    lost: [{ id, date, reason }], units: [Unit], lessons: [Lesson], adjustments: [Adjustment], baseline }`.
    `Lesson` and `Adjustment` are today's shapes, ids kept, plus one written field, `on: ISO|null`, the date last
    saved. `Unit = { id, name, color, code: string|null, days: int, pin: ISO|null, flex: int, start, end, placed,
    short }`: `days` is what the teacher asks for, `pin` a start date that holds, `flex` how many of the days are
    buffer (increment 2), and the last four are written at every save (below). A day type gains one optional
    field, `pace: 'count'|'skip'`; absent means `count`, which is today's rule for every type that is not
    `noSchool`. A course's own `pace` map overrides the type's. `start: null` is `meta.start`. No new
    localStorage key: the active course is in the blob, so `check:registry` has nothing to add.
  - *A course is in one of two modes, by whether it has lessons.* With lessons, the list is the plan: units are
    the runs of equal `U<n>` in list order (a code that comes back after another unit is a second run, a second
    unit), each matched to a `Unit` by `code` and run number so its name, colour and pin survive a re-import, and
    `days` is read-only (lessons plus bumps in the run). With no lessons, the teacher types `days`. One placer
    serves both, working on *slots*: a lesson, an anonymous unit day, or a gap (a bump).
  - *What counts as a class day for a course.* `dayValue(cal, course, date)` returns `{ meets: bool, why, half,
    letter }`. A date is a class day when all of these hold, tested in this order, and `why` names the first that
    fails: inside `[course.start, meta.end]` (`outside`); a weekday (`weekend`); no day type with `noSchool`
    (`closed:<typeId>`); no day type whose pace for this course is `skip` (`skip:<typeId>`); the A/B letter is
    the course's, when `meets` is A or B (`rotation`); not in `course.lost` (`lost:<id>`). On a day with several
    types a closing or skipping type wins over a counting one. `half` is today's test (`id === 'halfday'` or the
    label), carried through to the ½ mark; a half day is a whole class day or a skipped one, never half a
    count. **The A/B cycle keeps today's predicate**: a skipped testing day is still a school day and the letter
    still advances, so the one predicate becomes two (`isTeachableDay` for the cycle, `dayValue` for pacing).
    `meets: 'A'` with the cycle off is a problem the placer reports (`no-rotation`) and treats as `all`.
  - *The module: `Tools/school-calendar/scv-plan.js`, new, pure, an ES module beside `scv-pacing.js`* (which is
    not changed: `placeLessons()` and its assertions stay as the reference). Nothing in `_shared/`. No
    function reads the clock; `todayISO` is always an argument. Dates walk in UTC like `scv-pacing.js`.
    - `emptyPlan()`, `newCourse(name, opts)`, `newUnit(name, days)`.
    - `readPlan(cal)` returns `{ plan, state: 'ok'|'none'|'broken'|'newer' }`. `broken` (not the shape above):
      the page shows a banner, treats the plan as empty and moves the bad value to `cal.planBroken`, so nothing
      is thrown away and a backup still carries it. `newer` (`plan.v > 1`): the calendar works, the plan is shown
      read-only and written back untouched.
    - `absorbLegacy(cal)` returns `{ cal, report }`, the migration (below). Idempotent.
    - `abLetters(cal)` returns `{ ISO: 'A'|'B' }`: the page's `buildAbMap()` moved here in UTC, same letters.
    - `dayValue(cal, course, date, letters)`, and `classDays(cal, course)` returning `{ days: [{ date, half,
      letter }], excluded: [{ date, why }] }` for every weekday in range.
    - `syncUnits(course)`: in lesson mode, rebuilds `units` from the runs, keeping matched records.
    - `placeCourse(cal, course)` returns `{ courseId, days, excluded, byDate: { ISO: { kind:
      'lesson'|'day'|'gap', unitId, lesson, n, of, half, reason } }, dateByLessonId, vacated, units: [{ id, start,
      end, days, placed, short, open, half, pinIgnored }], overflow, orphanedAdjustmentIds, problems: [{ code,
      unitId, detail }] }`. `byDate`, `dateByLessonId`, `vacated`, `overflow` and `orphanedAdjustmentIds` have
      `placeLessons()`'s shapes, so the month grid, week strip, drawer and `buildIcs()` read the active course
      with no change of their own. Problem codes: `no-rotation`, `pin-before-previous`, `pin-after-year`,
      `short`, `empty-unit`, `no-class-days`.
    - `placePlan(cal)` returns one placement per course, keyed by id.
    - `stamp(cal, placements)` writes `lesson.on` and each unit's `start`, `end`, `placed`, `short` into the blob.
    - `stored(course)` reads those back as a placement-shaped view, and `diffPlacement(before, after,
      todayISO)` returns `{ moved: [{ kind: 'lesson'|'unit', id, label, from, to, by }], newlyShort, nowFits,
      past: count of moved lessons whose old date is before today, summary }`; `describeDiff(diff)` is the
      sentence.
    - `setBaseline(cal, course, todayISO)`, `slip(cal, course, placement, todayISO)` (below).
    - `splitByLetter(course)` returns two courses, and `convertDatedUnits(cal, unitIds)` returns `{ course,
      refused: [{ a, b, why }] }` (below). Both are pure and are previewed with `diffPlacement` before the page
      applies them.
    - `carryForward(plan)`: the plan for a new year (below).
  - *The placer.* Take the course's class days in order, index `i = 0`, and its units in order. For each unit:
    if it has a `pin`, find `j`, the first class day on or after the pin. `j > i`: the days between are *open*
    (class days with nothing planned, counted on the unit as `open`), and `i = j`. `j < i`: earlier work has run
    past the pin; the pinned unit wins, every slot placed on day `j` or later is taken back off and counted
    `short` on its own unit, and `i = j`. No `j`: the whole unit is short (`pin-after-year`). Then the unit's
    slots take class days one each until the days run out; what is left is `short`. Year end is the last pin.
    A gap is a slot: it takes its day and shows as today's "bumped" note. Edge cases, each with its answer:
    a pin on a day that is not a class day starts the unit on the next one, and says so in the unit row; a pin
    on or before the start of the unit before it is not honoured (`pin-before-previous`, `pinIgnored: true`),
    so a later unit can shorten the one before it but never remove it or reorder the list; two units pinned to
    one date: the second is `pin-before-previous`; `days: 0` places nothing (`empty-unit`); a short unit keeps
    its first days and loses its last, and in lesson mode the lost ones are `overflow`, which so means "does not
    fit before the next pin or the year's end" and is today's meaning when there is no pin; a course whose range
    holds no class day reports `no-class-days` and places nothing. **The placer never changes a count, a pin or
    the order.** It reports what does not fit; the teacher decides what to cut.
  - *What a bump means once units flow: there are two, and today's UI has one button for both.* "Ran long" is
    about the lesson: it needs another day wherever it lands. That is today's adjustment, kept as it is,
    anchored to the lesson. "Assembly" is about the date: this class did not happen that day, whatever was
    planned. That is new: `course.lost`, a date with a reason, which is not a class day for that course only.
    They differ when an earlier day changes later. A closure added before a lesson-anchored gap moves the gap
    with its lesson (today's "no double-shift" case, kept). A closure added *on* a lost date changes nothing,
    since the date was already not a class day, and removing the lost entry afterwards changes nothing either.
    A lost date that is not a class day anyway is inert and listed as such. The drawer offers both by name
    ("This class didn't meet…" and "This lesson needs another day…"); in a course with no lessons the second is
    "add a day to this unit" (`days + 1`). Bumps saved before the build stay lesson-anchored: their `createdOn`
    is not proof of which kind was meant. *Rebinding* is `rebindAdjustments()` as today, by raw code, per course;
    lost dates need none, and a unit's name, colour and pin are rebound to its run by `syncUnits()`.
  - *Pinned and floating.* A floating unit starts on the class day after the one before it ends, so a lost day
    moves it. A pinned unit starts at its pin. Units pinned back to back behave as fixed windows did, with the
    loss said aloud: a snow day inside the first leaves it `short: 1` and the second does not move.
  - *Buffers (increment 2, designed here because it needs the baseline).* A unit's `flex` (in lesson mode, its
    lessons whose number starts `BUF`, the convention the page already documents) can take a loss so the unit's
    end holds. `taken = min(flex, class days lost inside the unit's baseline span + gaps added in the unit since
    the baseline)`; that many flex slots, last first, are not placed and are listed as "used as a buffer for
    <date>". Off by default per course (`absorb: false`), and never on for a course made by the migration.
  - *"N days behind".* Measured against a **baseline**, the plan as it stood: `course.baseline = { setOn, start,
    mask, seq, adjIds, units: [{ id, days, pin }] }`. `mask` is one character a calendar day from `start` to
    `meta.end`, `1` for a class day; `seq` is the lesson order as `unit-num-letter` keys (lesson ids are
    positions and change on re-import). About 2 KB a course. From it the baseline's own placement is rebuilt
    exactly. Let X be what the baseline put on the last baseline class day on or before today (a lesson by key,
    first match, or day *k* of a unit). `behind` is the number of the course's class days after today up to and
    including the day X sits on now; 0 when X is on or before today; negative, *ahead*, when what is on today
    now was planned later. It counts the course's class days, not school days: an A course is behind in A days.
    Before the course starts it is 0; if X no longer exists it falls back to counting placed slots and says
    "about". `slip()` returns `{ behind, about, asOf, item, plannedOn, nowOn, causes, unit: { id, endWas, endNow
    }, short }`. `causes` is the ledger, worked out by comparing, not kept by hand: class days lost (each with
    its `why` and the day's label), class days gained, gaps added, days or lessons added or removed before X,
    less open days used up before a pin and buffers taken. **`behind` equals the sum of `causes`, always**; that
    identity is the test that the ledger is honest. The sentence: "World History: 3 class days behind the plan
    of Sep 8. U3-06 was planned for today and is now Jan 22. Lost: Jan 12 and 13 (Snow Day). Added: one day for
    U3-02 (ran long)." When the baseline is set: when a course is made or first distributed; again at every
    save while today is before the course's first class day (still planning); by a "Make this the plan" button
    at any time; and at migration, from the placement as it then stands. A migrated course so starts at 0 with
    its old bumps inside the baseline, and its row says so. Re-importing a lesson list keeps the baseline.
  - *The migration: `absorbLegacy()`, run by the page after every load and every JSON import.* It is keyed on
    what it finds, not on a version, so a v1 backup, a v2 backup and a blob an older page wrote into are one
    case. (1) No `cal.plan`: add an empty one. (2) `cal.pacing` has lessons or bumps: they become a course
    (`meets: 'all'`, no pins, no skips, no lost dates, `start` the old `startDate`), units from the codes, and
    `cal.pacing` becomes `emptyPacing()`. Every lesson lands on the date it had: the placer with those settings
    is `placeLessons()`, and a test holds it to that. (3) **`cal.units` is not touched.** The dated units stay
    where they are, drawn and counted by today's code, in today's card, which is shown only while the list is
    not empty and gains one button, "Turn into a course…". Nothing a teacher typed is rewritten. (4) If an older
    page later writes lessons into `cal.pacing` again, step 2 runs again and makes a second course; the report
    says so. The page saves after absorbing only if `diffPlacement` is empty, and shows one line ("Your lesson
    sequence is now the course 'Course 1'. No date changed."). "Turn into a course" (`convertDatedUnits`) sorts
    the chosen units by start, refuses with the pairs named if two overlap or one holds no school day, and
    otherwise makes each a unit pinned at its start with its counted days, which by the measurement above is
    the same days; the preview shows every unit's dates before and after, and "let these flow" (clear the pins
    after the first) is a second, separate, previewed step, the first time a date can move.
  - *Recomputing when the calendar changes under a plan.* Every change in 032 goes through one `commit(label,
    fn)`: keep a copy of `cal`, apply, place, `diffPlacement(stored, fresh)`, `stamp`, save. If anything moved, a
    bar says what ("Marking Jan 12 as Snow Day moved 31 lessons one class day later; Unit 3 now ends Feb 3, was
    Feb 2; 1 lesson no longer fits before Jun 11.") with **Undo**, which writes the copy back, one step deep.
    Lessons whose old date is past are counted apart, since those are the surprising ones. This covers a day
    tag, a day type's `noSchool` or pace, the year's dates, the A/B anchor, the `.ics` and `.xlsx` imports and
    a plan edit alike. **On load**, if the dates in the blob are not what the placer gives (an older page wrote
    it, a file was edited by hand, or a later version changed the placer, which `plan.algo` names), the bar
    shows the same list and nothing is saved until the teacher takes it ("Keep these dates") or exports first.
    The dates written by `stamp()` are also what a reader outside 032 gets without running any placer.
  - *More than one course.* Courses are independent: own lessons, units, lost dates, baseline and `slip()`. P2's
    page shows one active course on the grid, week strip and `.ics` (so a one-course calendar is as today), every
    course's unit bands, and one "behind" line a course. "Split into A and B" turns one alternating list into
    two courses (`meets: 'A'` and `'B'`, each with its letter's lessons and their bumps); with no bumps the
    preview shows no date changing, and after it a bump moves one track only. Side by side is P3.
  - *New year.* `carryForward()` keeps courses, names, colours, `meets`, unit names, `days`, `flex` and lessons,
    and drops pins, lost dates, bumps, baselines and stamped dates; the confirm says how many of each.
  - *What each file changes at build.* `032` page: a Courses card in place of Lesson Pacing (course tabs; name,
    meets, start; the lesson box and both imports per course; a unit table of name, colour, days, pin, start to
    end, short and open; the behind line), the two drawer actions, "Count for pacing" on each day type that is
    not `noSchool`, the notice bar, `commit()`, the Units card only when `cal.units` has entries, and the unit
    print table per course with Short. `scv-seed.js`: `plan: emptyPlan()` on the seed and blank. `scv-store.js`:
    nothing. `scv-pacing.js`: nothing. `sw.js`: `scv-plan.js` in `PRECACHE_URLS` and `SHELL_URLS` (032's files
    are in both) and a `CACHE_VERSION` bump. `Tools/a11y-sweep/seeds.mjs`: a 032 seed with a course, so the
    sweep sees the new card. **010, 045 and 009: nothing**; they read fields this leaves alone.
  - *What P2 needs from P1, which is not built: nothing to ship.* It uses what 032 has: the school-day
    predicate, `abCycle`, the page's local "today" passed in. What P1 changes for it later: (a) richer meeting
    patterns (weekday lists, longer cycles, a rotation that does not slide) come in through `meets`, which is
    why the placer asks one function whether a course meets on a date; (b) `gradingPeriodOf()` lets a unit say
    "ends 2 days after the marking period"; P2 has only the `mpend` tags and derives nothing from them; (c) a
    half day's real length from a bell schedule is what a fractional count would need; (d) `_shared/school-day.js`
    is where 010 and 045 should get "today's lesson, N behind" in P3, reading the stamped dates; whether the
    pure functions then move to `_shared/` for classic scripts is P3's call.
  - *Tests that would prove it.* `Tools/school-calendar/test/plan.test.mjs`, pure Node, added to
    `test:school-calendar` and `suites.json`: **day values** (each `why`, the order, several types on a day,
    the course override, cycle off with `meets: 'A'`); **letters** (`abLetters` against a copy of `buildAbMap`
    kept in the suite, anchor before, inside and after the year, all 184 days); **equivalence** (the cases of
    `smoke-pacing.mjs` sections 6 to 10 through `placeCourse`, then 500 seeded random lists, bumps and closures:
    same `byDate`, `vacated`, `overflow`, orphans as `placeLessons`); **flow** on the seed (units of 10, 8 and 12
    days are Aug 31 to Sep 14, Sep 15 to 24, Sep 25 to Oct 12; an A course's 10-day unit is Aug 31 to Sep 25);
    **the snow-day fixture** this path's Verification asks for (a 20-day unit from 2027-01-04 ends 02-02, then
    02-03; every later floating unit moves one class day; a pinned one does not and the unit before it is short
    1); **pins** (unit 3 pinned at Oct 1 leaves 4 open days; pinned at Sep 21 leaves unit 2 short 4; a pin on a
    Saturday; before the previous start; after the year; two on one date); **lost dates** (one date; then a
    closure on it, no second shift; then the entry removed, no shift; a lost weekend, inert); **A and B** (92
    and 92; the snow day flips all 99 later letters and the A course follows; `splitByLetter` with no bumps
    moves nothing; one bump on the joined list mismatches 143 lessons and on a split course none); **slip** (no
    change 0; a closure before today 1 with its cause; one after today 0 today and the unit end a day later; a
    gap; a day given back; open days before a pin absorb it; a lesson inserted before X; X removed says about;
    500 seeded edit sequences with `behind` equal to the sum of causes); **diff**; **absorb** (v1; v2 with
    lessons; with units only, `cal.units` deep-equal before and after; with both; twice gives the same blob; an
    older page's second write makes a second course; a broken plan kept in `planBroken`; `v: 2` read-only; the
    shipped `isValid()`, copied into the suite, still passes the result); **convert** (every start/end pair in
    the seed year gives the same days; overlap refused; a window with no school day refused); the whole file
    again under `TZ=Pacific/Kiritimati`. `smoke-plan.mjs`, Chromium, the next free port: a v2 blob with lessons,
    bumps and dated units loads with every lesson in the cell it was in and `cal.units` unchanged in storage;
    010's and 045's calendar panels have the same HTML from the blob before and after; the snow-day shortcut
    shows the bar and Undo restores the stored bytes; a blob with stale stamped dates shows the bar and storage
    is not written until it is accepted; both drawer actions; a pin made in the table; the convert preview; the
    behind line with the clock pinned (`page.clock.setFixedTime`, every date in the fixture from that instant);
    `.ics` text the same for the migrated one-course blob as from v245. Then `smoke-pacing.mjs` and
    `smoke-week.mjs` unchanged and green, `test:a11y --only 032` with no allowance, `path7:next --only 032`.
  - *Left out on purpose.* A half day as half a count (two half days weeks apart are not one lesson; revisit
    with P1's bell lengths). A unit that ends on a date in a flowing course (two pinned units say the same). Due
    dates. Freezing the past. Getting *ahead* by doubling lessons into a day. Per-date overrides for one course
    other than a lost date. Suggesting what to cut. Reordering by drag (up and down buttons). More than one step
    of undo. Marking-period warnings, the side-by-side view, any consumer, per-course `.ics` (P1, P3, P4).
  - *Increments.* (1) `scv-plan.js` with the placer, `absorbLegacy`, `stamp`, `diffPlacement`, the notice bar and
    `commit()`, the Courses card for one or more courses in lesson mode, lost dates: nothing looks different for
    a calendar with no pacing, and a migrated one keeps every date. (2) Typed units with pins, the dated-unit
    conversion, the pace setting. (3) The baseline and "behind". (4) Buffers, the A/B split, the new-year carry.
  - **Questions for Devon. None is answered here; each says what the design assumes until he does.**
    1. *Half days.* Does a half day count as a class day for pacing? Assumed: yes, as today, with the ½ mark,
       and a teacher can set the day type to skip. Is skip the better default for a new calendar?
    2. *Testing days.* Count or skip by default, and is a testing window the whole school's or different by
       course? Assumed: count, as today; the type can be set to skip, and a course can override it.
    3. *A/B after a snow day.* 032's cycle slides, so the lost day's letter goes to the next school day and every
       later day flips (99 of 99 after one January day). Is that what East Middle does, or do the printed
       letters hold and that letter's classes simply lose the day? It decides which course is behind. Assumed:
       today's sliding, unchanged.
    4. *Behind what.* Is "the plan as it stood when the course started, until I press Make this the plan" the
       right thing to measure against, counted in that course's class days? Or should it be measured against
       the county sheet's own dates, where one was imported?
    5. *Buffers.* When a day is lost, should a buffer day in that unit be used up automatically so the unit
       still ends on time, or should everything always move later and the teacher decide? Assumed: move later;
       buffers are a per-course switch, off.
    6. *The past.* Entering a closure for a date weeks ago re-dates every lesson since, taught ones included.
       Assumed: recompute, say how many past lessons moved, offer Undo. Should the past be frozen instead?
    7. *One list or two for A/B.* The county sheet is one alternating list. Assumed: it stays one course on
       import and on migration, and "Split into A and B" is offered. Should an import split it at once?
    8. *Dated units already saved.* Assumed: they stay as they are for good, with the offer to turn them into a
       course. Should the page press teachers to convert, or is the old card welcome to stay?
    9. *New year.* Assumed: unit lengths and lessons carry, pins and lost dates do not. Should pins carry,
       shifted, the way lesson notes can be?
    10. *The word.* "Course" for one prep's plan, "class day" for a day it meets. His words, if different.
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
  **P1 is designed, not built (AI-20, 2026-10-05, a design pass: no code, no suite, no browser).** What follows is
  the whole of it. It was written from the code as it stands at v248 and from one static probe, a scratch
  script that was not kept (what it measured is marked *measured*; everything else is read off the code).
  **What the bullet above gets wrong, first.** There is no baseline: `test/publish.mjs` writes
  `Tools/schedule/test/baseline.html` when run with no argument, and that file has never been committed (it is
  not ignored either, so a bare run leaves an untracked file). The list is 28 functions now, not 26, and the
  published script is 35 named pieces, because seven more go in through a second list of `.toString()` calls
  inside `brBuildPublishedHTML()` (`brDColor`, `brDeptInk`, `brTDept`, `brDShort`, `brOrderOf`, `escHtml`,
  `escJsAttr`). "Every function in the list still exists" cannot fail in a way that matters: a missing one is a
  `ReferenceError` the moment the page loads. And "the published head block matches the newer social branding"
  names a block the publisher does not write and, by `Tools/schedule/README.md`, must not; the block is 034's,
  it is the *older* branding, and which is right is undecided (question 3).
  - *What can drift. Three pairs, and they are not the same problem.*
    **(a) 035 live against what 035 publishes.** The published script is assembled from strings: a hand-typed
    preamble (`let brMode = 'teacher'…`), two JSON constants, seven `.toString()` constants, the 28 functions,
    five boot calls and the empty-data notice. So it drifts from the page it was cut from whenever (1) a published function reaches for
    a name that is not in the file (Round 7: `escHtml` and `escJsAttr`, a `ReferenceError` when a teacher was
    opened); (2) a string-built handler (`onclick="brJumpTeacher(…)"`) or the markup template names a function
    that is not published; (3) a published function looks up an element id the published markup does not have;
    (4) a preamble `let` falls behind the live declaration; (5) something live-only leaks in (`AppState`,
    storage, a URL); (6) a function is declared twice, or stops being a top-level `function` declaration, so
    `.toString()` yields something that defines nothing at top level (an arrow, a method shorthand); (7) the
    live page is sloppy-mode and the published script begins `'use strict'` (*measured:* none of 035's three
    inline scripts is strict), so a construct can work live and throw published. *Measured today:* all 28
    resolve to one top-level declaration each; every handler name (nine) and every looked-up id (eight) resolves; the only
    names the script reaches for beyond the language's own are `document` and `brRenderMapLegacy`, and the
    second is a real hole behind a dead door (`brRenderMap()` calls it only when `typeof BR_WINGS !==
    'undefined'`, which is never true in a published file); the only URL is the SVG namespace.
    **(b) The publisher against its own last output.** Nothing records what a publish produced, so a refactor
    that changes it is seen by nobody. This is the one P2 is about to make likely.
    **(c) 035's publisher against the committed `034-schedule-browser.html`.** 034 was published by v60 on
    2026-07-15 and then edited here; the README calls it a second implementation and says not to resync it.
    *Measured:* of the 35 published pieces, 21 are the same text in 034, 12 differ (`brCheckStaleness`,
    `brBuildOpts`, `brRenderMenu`, `brOnKey`, `brSetMode`, `brChoose`, `brDayRows`, `brRenderTeacher`,
    `brRenderGroup`, `brGeoFloorSVG`, `brMiniMapHTML`, `brGroupMapHTML`) and 2 are absent (034 has its own
    `brEscHtml` and `brJsAttr`); 034 has 42 functions 035 has never had, six tabs to three, and two
    localStorage keys (`br_home_teacher`, `br_personal_notes_v1`) where a published file has none. Two suites
    already hold the parts that must agree (`smoke-mode-tabs.mjs` the tab markup, `smoke-dark-theme.mjs` the
    theme CSS, byte for byte). Nothing holds the 21 functions that agree today: a fix to one of them in one
    file is the R61–R63 drift again, and it would be silent.
    **There is no fourth pair.** Nothing but 034 and the file's own script reads `PUBLISHED_DATA` (searched
    the tree); a published file's reader and data are always the same age, because they are one file. The data
    and its reader come apart in exactly two places, both later: when 034's data is refreshed by hand under
    034's own reader, and in P6, where one browser file takes many data files. The contract below is for those.
  - *The contract for the data, written down once.* `Tools/schedule/test/published-contract.mjs`, pure Node,
    no DOM, test-side only in P1 (a published file cannot import, and no reader needs a runtime check until P6).
    `FORMAT = 1`. `formatOf(data)` returns the integer in `data.format`, or `0` when there is none: **format 0
    is every file published up to v61, 034's included.** `validate(data, { fixture })` returns `{ ok, format,
    errors: [{ path, message }], warnings: [...] }`; `upgrade(data)` returns a copy at `FORMAT` (0 to 1 adds
    the two fields below and changes nothing else) and throws on a format above `FORMAT`; `readEmbedded(html)`
    takes the one `const PUBLISHED_DATA = …;` line out of a published file and parses it;
    `shapeOf(data)` is a summary of types and counts with no values in it, **and it is the only thing a failure
    prints**: 034's data is a real staff list and CI's log is public. The shape, formats 0 and 1 alike:
    `school` string; `publishedOn` `YYYY-MM-DD`; `dept` `{ code: { c: '#rrggbb', name } }`; `order` `{ code:
    integer }`; `teachers` `{ name: { dept, room, plan, sec: [group], A: [modCount], B: [modCount], co: [name]
    } }`, a slot being a group's name or the word `Planning`; `sections` `{ group: [teacher] }`; `room2teacher`
    `{ room: teacher }`; `groupRooms` `{ group: { A: [modCount of room or null], B: the same } }`; `modCount`
    integer of 1 or more; `modLabel` string; `bell` null or `{ A: [modCount strings], B: the same }`;
    `geometry` `{ floors: [{ id, label, cols, rows, hall: [[c, r]], stair: [[c, r]], rooms: [{ rn, dept,
    teacher, cells: [[c, r]] }] }] }`. Format 1 adds `format: 1` and `tool` (the `TOOL_VERSION` string).
    `groupRooms`, `bell` and `geometry` may be missing in format 0 (the reader already allows it: `||
    {}`, "No building map available"). *Errors:* a wrong type, a slot array that is not `modCount` long, a
    slot naming no group, a `sec` entry or a `sections` teacher that does not exist, `room2teacher[t.room]`
    not the teacher, a cell outside `cols` by `rows`, a room number on two rooms. *Warnings, never errors:* a
    department code with no entry (the reader falls back to grey on purpose); a `co` list that is not
    mirrored; a section that lists a teacher whose own day never shows that group. **The last two cannot be
    errors because 034's committed data has them** (*measured, counts only:* 21 one-way `co` entries; 30 of
    162 section-to-teacher links with no matching slot; 6 room-day-mod slots holding more than one group;
    every hard rule above holds). The cause is in `brDeriveScheduleData()`: a room holds one group per mod, the
    last one written, and a teacher has one room, the last one found. That is the publisher dropping a group
    from a teacher's printed day without a word. P1 measures it and does not change it (question 5).
    **The rule for a later format:** adding a field does not raise `FORMAT`; a change that would make an older
    reader show something wrong does, and `upgrade()` gains the step in the same commit. A reader at N reads
    everything at or below N through `upgrade()`. What a reader does with data *above* its own format is
    question 4, and nothing in P1 builds it.
  - *The guard that needs no browser.* `Tools/board-check/check-publisher.mjs`, an npm script named
    `check:publisher`, in CI beside the other guards (a new step in `ci.yml`). It reads the two HTML files as
    text and parses 035's classic inline scripts with ESLint's own `Linter` (ESLint and `globals` are direct
    devDependencies; `espree` is not, so it is not imported by name). Exports, for its test and for the browser
    suite: `readPublisher(html)` returns `{ fns: [{ name, text, line }], consts: [{ name, from, kind, text }],
    json: [{ name, from }], preamble: [string], boot: [string], markup, css, dataKeys, problems }`;
    `assemble(pub, data)` returns the `<script>` text the page would publish for that data; `freeNames(script)`
    returns `[{ name, line }]`; `forkState(pub, html034)` returns `[{ name, state: 'same' | 'forked' |
    'absent' }]`; `check({ root })` returns `{ failures: [{ code, message }], notes }`. Flags: `--list` (the 35
    pieces and where each is declared), `--json`, `--explain <name>` (the first line where 034's copy parts
    from 035's), `--ledger` (rewrites the ledger's `same` list only, after you have read what moved).
    **How it reads the publisher.** It walks the syntax tree of `brPublishFnList()` (the returned array must
    be a plain list of identifiers) and of the `consts` and `js` arrays in `brBuildPublishedHTML()`, whose
    elements must each be one of five forms: a string literal; `'const X = ' + Y.toString() + ';'`; `'const X
    = ' + JSON.stringify(Y) + ';'`; `'const X = ' + Y + ';'`; the functions' `map(f => f.toString()).join()`.
    **Anything else fails as "publisher not understood", with the line.** Not knowing what is published has to
    fail, never pass. The module script at the top of 035 is skipped: its bindings are not page globals.
    A function's published text is its source from `function` to its closing brace; an arrow constant's is
    its initializer. That is what `.toString()` returns, and the browser suite holds the guard to it (below).
    **What it fails on, by code.** **LIST**: a listed name with no top-level `function` declaration in a
    classic script, or with two. **CONST**: X and Y differ (the piece would publish under another name), or Y
    is not a top-level arrow constant or function. **FREE**: a name the assembled script uses and does not
    define. The allowed outside names are a list in the guard, `PUBLISHED_GLOBALS`, seeded with what is used
    today, which is `document` alone; ESLint's whole browser set would wave through a bare `name`, `status` or
    `event`. `brRenderMapLegacy` goes in `KNOWN_FREE` with its reason, and the guard fails if a `KNOWN_FREE`
    name stops being free, so the entry cannot outlive the hole. `typeof X` is not a use. **STRICT**: the
    assembled script does not parse as strict code. **LIVE**: `AppState`, `localStorage`, `sessionStorage`,
    `indexedDB`, `fetch`, `XMLHttpRequest`, `WebSocket`, `import(`, `getSubjects`, `toggleApp`, `showToast`,
    `brLoadFromVisualizer`, or any URL but the SVG namespace, anywhere in the assembled script, the markup or
    `BR_CSS`. **HANDLER**: an `on…="name(` in the markup template or inside a published function's text that
    is not a published function (`window.print()` is allowed). **ID**: a literal `getElementById('x')` in a
    published function with no `id="x"` in the markup template or in a published function's own strings.
    **STATE**: a preamble `let` whose name or initial value differs from the live top-level declaration (`brMode`,
    `brCurrent`, `brActiveIdx`, `brOpts`, `brGrpDay`, `brMapFloorIdx`). **HEAD**: the page template gains a
    `<link`, a `<script src`, a manifest or a `gvb:social` marker. **DATA**: 034's embedded `PUBLISHED_DATA` is
    not one parseable line, or has a contract error at its own format; and the keys the publisher writes
    (`dataKeys`) are not the contract's. **FORK**, the 034 pair, a ledger in the shape of
    `inline-sinks-baseline.json`: `Tools/schedule/test/publisher-ledger.json` holds `same` (21 names), `forked`
    (12, each with a sentence saying what 034's copy does that 035's does not) and `absent` (2, each with what
    034 uses in its place). It fails when a `same` piece differs (the fix landed in one file: port it, or move
    the name to `forked` and say why), when a `forked` piece has become the same (lower the list in the same
    commit), and when a published name is in none of the three. Text is compared exactly, after CRLF is
    stripped. The 42 functions only 034 has are not in the ledger; they have no second copy to drift from.
    **Edge cases.** A function moved into a block, an IIFE or a module is not a page global and fails LIST with
    that said. A comment or JSDoc above a function is not part of its published text and may change freely. A
    backtick in a `BR_CSS` comment ends the template literal (the README's trap): the script no longer parses
    and the guard says "035's script does not parse" with the parser's line, before anything else. A name used
    only as a property (`x.fetch`) is not a LIVE hit; the check is on identifiers and string contents, with
    comments skipped. CSS classes a function emits against the selectors in `BR_CSS` are **not** checked: a
    class with no rule is common and harmless, and a guard that guesses is worse than none.
  - *The guard that needs a browser, which is the bullet's "regenerate and diff".*
    `Tools/schedule/test/smoke-publish-baseline.mjs`, a suite and a `test:schedule-publish` shortcut, on the
    next free port. `publishFromFixture()` gains one option, `{ now }`, which calls `page.clock.setFixedTime`
    before the page loads; the suite pins **2026-01-15 17:00 UTC**, noon on the east coast and the same date in
    every US zone and in UTC. With the clock pinned the output has no other moving part (Playwright's default
    locale is en-US, so the footnote reads "January 15, 2026"; `JSON.stringify` keeps insertion order;
    `.toString()` is the source text in every Chromium). It cuts the published file into named sections (page
    template, fonts, `BR_CSS`, overrides, markup, preamble, data, each constant, each function, boot) and
    compares them with the committed `Tools/schedule/test/baseline-northwind.html`, **which is the published
    file with the 103 KB font block replaced by one line giving its SHA-256 and length**, so the baseline is
    about 75 KB of text a person can diff in a PR. A mismatch names the section and prints the first differing
    line of each side. `--update` rewrites the baseline; the diff of that file in the PR is the review. The
    folder is `test/`, so the file is never precached and `make-offline-copy.mjs` leaves it out.
    The other assertions: **the static guard's `assemble(readPublisher(html), data)` equals the real published
    `<script>` byte for byte**, which is what entitles `check:publisher` to speak for the page with no browser;
    the published data validates at `FORMAT` with no error and no warning and matches the fixture's `EXPECTED`;
    the file opened from `file://` runs **every one of the 35 pieces at least once** while the suite picks a
    teacher, a group, a mate, a room on the map, a floor tab, an A/B day, types in the search box and walks the
    tabs by keyboard (Chromium's JS coverage names what never ran; a piece nothing can reach is reported and
    fails); a published file whose data is replaced by `fixture-published-format0.json` (Northwind as v61
    wrote it, captured from the unmodified tool) still shows the same teacher's day, so **a newer reader reads
    an older file's data**; a fixture whose school is named `</script><b>` publishes a file with one script
    block and that name in its masthead as text; and a publish at 23:30 local says the local date in both
    places it says a date.
  - *What an artefact from an older 035 is, and what happens to it.* **Nothing happens to it, by design.** A
    file a teacher was emailed carries its own reader, data, styles and fonts; no page of this site opens it,
    nothing imports it, and no storage key belongs to it, so there is nothing to migrate and no version of 035
    can break it. Its one way of ageing is the banner after `BR_STALE_DAYS` (60). It is format 0, and P1 gives
    that a name, a validator and a test that the current reader still reads it. 034 is the one old artefact
    the repo holds: format 0, v60, and by its own date and rule its banner has been showing on the live site
    since 2026-09-13 (82 days on 2026-10-05; read off the code, not seen in a browser). P1 does not refresh it
    (question 2).
  - *What each tool changes, in two increments, so the first proves the guard on the tool as it is.*
    **Increment 1, no page changes, no `CACHE_VERSION`:** the guard, the contract, the ledger, the baseline
    taken from 035 untouched, the format-0 fixture, the suite and the pure test; `package.json`, `suites.json`,
    `ci.yml` and the README's "regression baseline" section rewritten. `Tools/board-check/` and `.github/`
    change, so CI runs site-wide once. **Increment 2, 035 only, a `CACHE_VERSION` bump and `TOOL_VERSION` v62,
    the baseline regenerated in the same commit** (the first intended change of it, which is the workflow
    working): `data` gains `format: 1` and `tool`; `publishedOn` becomes the **local** date (it is
    `toISOString()` today, the UTC date, while the footnote beside it is local and the reader parses the field
    as local midnight, so a file published after 8 pm eastern is dated tomorrow); and `JSON.stringify(data)`
    has every `<` written as `<` (today a room, teacher or school name holding `</script>` ends the
    published script; the name can arrive in an imported project file or over a hand-off, and the file is then
    emailed to staff; read off line 20743, not run). **034 does not change in P1**, not even its data, and no
    storage key, registry row or precache line changes anywhere. `brRenderMapLegacy` stays where it is, listed.
  - *The tests that would prove it.* `Tools/board-check/test/check-publisher.test.mjs` (pure Node, a
    `test:check-publisher` shortcut), on the real tree and on edited copies of 035's text: the tree passes;
    the extraction is 28 functions, 7 `.toString()` constants, 2 JSON constants, `BR_STALE_DAYS`, 6 state names, 5 boot calls; and **each
    break on purpose fails with its own code and no other**: `escHtml` taken out of `consts` (FREE, naming
    it, the Round 7 bug); a listed function renamed at its declaration (LIST); a listed function turned into
    `const f = () =>` (LIST); a second declaration of one (LIST); `'const brDColor = ' + brDeptInk.toString()`
    (CONST); `AppState.settings` read inside `brRenderTeacher` (FREE and LIVE); a `localStorage` read (LIVE); an
    `onclick="brNope()"` in a template (HANDLER); `br-view` renamed in the markup (ID); `brGrpDay = 'B'` in the
    preamble only (STATE); an undeclared assignment and a duplicate parameter (STRICT); a `<link>` in the head
    (HEAD); a spread in the function list and a ternary in `consts` ("not understood"); a backtick in a CSS
    comment (does not parse); one character changed in `brOverviewHTML` in 035 only, then in 034 only (FORK,
    both ways); a `forked` function made identical (FORK asks for the ledger to be lowered); a new name added
    to the list and to no ledger group (FORK); `brRenderMapLegacy` published after all (`KNOWN_FREE` expired).
    The contract, on built data with made-up names (Ms. Okafor in 204, group 7-3): each error above one at a
    time; each warning; format 0 with and without its three optional keys; `upgrade()` idempotent, never
    changing a field it was given, throwing on format 2; `shapeOf()` output containing no string from its
    input. The browser suite's cases are the paragraph above; its breaks on purpose are made by rewriting 035
    on the way in with `page.route()`: a property dropped from the teacher record, a function reordered in the
    list, one CSS declaration changed, the footnote reworded, each failing the named section and only it.
  - *Left to P2, on purpose.* Following `import`s: the reader takes 035's inline classic scripts and nothing
    else, so the first function P2 moves into a module fails LIST, and that failure is the prompt to teach
    `readPublisher()` a `sources` list (the page, then each module it loads, the way `check-adoption.mjs`
    follows them). What P2 should know before it starts: `.toString()` of an `export function` is the same
    text without `export`, so a moved function publishes unchanged; a method shorthand or a bundled or
    minified function does not; a helper a moved function imports becomes a free name and FREE says so;
    modules are strict, which closes pair (a)'s seventh gap by itself. Publishing from Node with no browser
    (so that the baseline is a pure suite) waits for `brDeriveScheduleData`, `brBuildGeometrySnapshot` and the
    publisher to be extracted, which is the last step of P2's order. Folding `schedule/` and
    `schedule-visualizer/` into one folder moves every path named here; P1 uses `schedule/test/` because the
    fixture and `publish.mjs` are there.
  - *Left out altogether.* Making 034 a pure publish again, or teaching 035 any of 034's 42 functions
    (question 1). Refreshing 034's data. A runtime format check in any reader, and swappable data (P6). The
    theme region and tab markup, which have their suites. The publisher's CSS-to-markup agreement. The 400-odd
    functions of 035 that are not published. Fixing the double-booked room and the teacher with two rooms
    (P5's constraint checks; P1 only counts them). Any social block. Nothing here was run: no line of the
    guard exists, the 75 KB is an estimate (28 KB of `BR_CSS`, 24 KB of script, the data, the markup), and
    the claim that `assemble()` can match the browser byte for byte is the suite's first assertion, not a
    result. The probe compared whole declarations for functions and initializers for arrow constants.
  - *Questions that are Devon's. None is answered here, and the build waits on none of them except where said.*
    1. **Is 034 a fork for good?** Today it is a second implementation with a ledger round it. The other
       course is to teach 035's publisher 034's features (three more tabs, notes, links, the PNG, the door
       sign) so that 034 is again exactly what Publish makes. P6 needs to know which before it starts.
    2. **034's own schedule is from 2026-07-15 and has been telling visitors it may be stale since
       2026-09-13.** Refresh it (from which project file; none is in the repo), quiet the banner on the site
       copy, or leave it? And should the public site's copy carry the real building's schedule at all, or
       the invented Northwind one?
    3. **Which social branding is right for 034's head block:** the older greyversusblue block with the
       guild-board image that it has, or the newer AsPerMyLessonPlan block with none? P1's bullet assumed the
       newer; `CLAUDE.md` says the policy is undecided. Until it is, the guard checks only that a file made
       by Publish carries no block.
    4. **When a reader meets data from a newer format than it knows** (034 after a hand refresh, P6's
       swappable data): show it with a warning, or refuse and say "ask for a new copy"?
    5. **Two groups in one room in one mod, and one teacher named in two rooms:** the published file shows
       one and drops the other, silently. Should Publish refuse, warn and go on, or show both? 034's
       committed data has 6 such room slots.
    6. **Do files published before R60 still circulate** (no map, no bell times, no group rooms)? The
       contract reads them as format 0 with those keys missing; if none exist, that allowance can go.
    7. **Is 60 days the right age for the stale banner** for a schedule that holds a semester? It is one
       constant, and it is in every file already sent.
- **P2 — Extract the pure engines to `Tools/schedule-visualizer/`** in this order:
  schedule model, pathfinding (`astar`, `computeTravelTimes`), multi-floor graph,
  evacuation routes, congestion, playback renderer, publisher. Each extraction is
  one PR with a Node unit suite for the pure part (today all coverage is Playwright).
  Fold the two folders (`schedule/` and `schedule-visualizer/`) into one and fix the
  stale README. Target: the HTML under ~300 KB.
  **P2 is designed, not built (AI-20, 2026-10-05, a design pass: no code, no suite, no browser).** It sits on P1's
  design above and changes none of it. Written from the code at v61 (`TOOL_VERSION`; site `CACHE_VERSION` v251) and
  from five pure-Node probes over the page's text, kept in a scratch folder and not committed (what they measured is
  marked *measured*; everything else is read off the code). Every name in an example is made up.
  **What the bullets above get wrong, first.** The page is **968,296 bytes** and 20,849 lines, not 936 KB; it has grown
  32 KB since the "Why" was written (the print rules of Path 7 P2, the trace images, the pairing codes). The main
  script has 388 top-level function declarations and the browser script 48, so 436, not 428. The support folder holds
  three modules, not two: `sv-trace-image.js` has been there since Path 4 P4 (v211). And the order in the bullet
  ("schedule model, pathfinding, multi-floor graph, evacuation routes, congestion, playback renderer, publisher")
  stops about 320 KB short of its own target: **the markup alone is 141 KB and the stylesheet 158 KB**, so no amount
  of script leaving the page gets it under 300 KB while the stylesheet stays, and the engines named are about 210 KB
  of a 662 KB script. The ladder below reaches the target, but only by also moving the stylesheet, the visualize
  tab's renderer, the blueprint editor, the what-if lab and the groups tab, none of which is a pure engine. That is this design's first call (recorded in
  `HISTORY.md`; question 1 asks whether it is wanted).
  - *The page by part (measured, bytes of UTF-8, LF line ends throughout).*

    | Part | Bytes | Of which comments and blank lines | Note |
    |---|---|---|---|
    | head, markup between the blocks | 141,326 | — | `#panel-blueprint` 40 KB, `#panel-visualize` 20 KB, `#panel-settings` 20 KB, `#panel-schedules` 16 KB, nine modals 27 KB, the live `#app-browser` 3.7 KB |
    | first `<style>` (line 59) | 157,702 | 9,397 | the app; one `@media print` block at line 2813; no `@font-face` (fonts are `schedule/fonts/fonts.css`) |
    | second `<style>` (line 4275) | 7,735 | 67 | the settings panel |
    | inline `type="module"` script (line 52) | 314 | — | imports `sv-handoff.js` and `sv-recovery.js`, puts them on `window` |
    | main classic script (line 5210) | 578,715 | 114,423 | 68 banner sections, 388 functions, 81 top-level `let`/`const`, one `class` (`MinHeap`) |
    | browser script (line 19352) | 82,818 | 13,080 | `BR_CSS` 30 KB, data derivation 14 KB, the legacy hard-coded map 22 KB, the publisher |

    Comments are 137 KB of the page. They move with their code and are not a lever: stripping them is not extraction.
    The main script's banner sections, largest first: path visualization 107,689; playback and travel time 54,613;
    room search and what-if 48,957; evacuation door cards 35,468; multi-floor graph 26,495; bulk editor 17,107;
    blueprint persistence 15,922; canvas event binding 14,823; schedules editor 13,949; settings panel 10,517.
  - *The seams (measured: a probe that stripped comments and strings and counted every top-level name each banner
    section uses from another).* `AppState` is read in 57 of the 68 sections and in the browser script. The engines
    the bullet names are these sections, with what each reaches for:

    | Section (line) | Bytes | Reads from the page | Called by | Pure today? |
    |---|---|---|---|---|
    | Round 7 pathfinding engine (12862) | 2,345 | nothing; owns `pathfindingGraph`, `_blueprintDirty`, `ORTHO` and the three key helpers | every engine below, door cards, what-if; `_blueprintDirty = true` is written **nine times in three** page sections (persistence once, blueprint data five times, staircase pairing three) | yes, but its cache is a shared `let` |
    | Round 31 multi-floor graph (12916) | 26,495 | `AppState.blueprint.floors` and `.crossFloorPairs` (in `buildMultiFloorGraph`, `buildStaircasePairLookup`), `AppState.schedules.groups` and `.settings.modCount` (`findGroupDayPath`, `computeCongestionMap`), `getAllModLabels()`, `groupWeight()`, `getPairLabel()`, `isCellHeatExcluded()` | viz (`findGroupDayPath`), what-if (`resolveRoomPath`), evacuation (`astar`) | the graph build, A*, `buildPathMetadata` and `resolveRoomPath` are pure given a graph; the two group functions read state |
    | Evacuation routes (13562) | 5,970 | `AppState.blueprint.floors` (`collectExitPoints`), `getPathfindingGraph()`, `astar()` | door cards only | pure given a graph and the floors |
    | Congestion: `computeCongestionMap` (multi-floor), `buildCongestionData` (viz, 14355), `computeTravelTimes` (playback, 16190), `wiComputeMetrics`/`wiComputeDiff` (what-if, 18560) | about 16,000 across four sections | `AppState.settings` (`tileWalkTime`, `staircaseTime`, `defaultGroupSize`, `modCount`), `.schedules.groups`, `.blueprint.floors[0].id`, `groupWeight()`, `congestionDelayMult()`, `isCellHeatExcluded()`, `floorCellKey()` | viz, playback, what-if | the arithmetic is pure; every entry point reads state |
    | Round 30 playback engine (16190) | 54,613 | `AppState` (63 times), the viz canvas and ten viz functions, `showToast` | blueprint data (`PlaybackController.stop`), tab navigation | a renderer: pure given a 2D context and the render data; `PlaybackController` holds the animation clock |
    | Round 41 browser and publisher (19353) | 82,818 | `AppState.settings`, `.blueprint`, `.schedules.groups` (in `brLoadFromVisualizer` and `brBuildPublishedHTML`), `getSubjects()`, `formatModTime()`, `TOOL_VERSION`, `escHtml`/`escJsAttr` (schedules rendering), `window.BR_PUBLISHED_FONT_CSS` | the subjects editor (`brSyncDeptFromSettings`), what-if (`BR_CSS`), the live preview's `onclick` strings | `brDeriveScheduleData(settings, blueprint, groups)` and `brBuildGeometrySnapshot(blueprint)` already take their inputs; the rest reads module-level `BR_*` state |
    | Round 9 path visualization (13706) | 107,689 | `AppState` (162 times), `document` (90), the blueprint canvas helpers, the door-card drawing helpers (`drawTile`, `drawRoomLabel`…), `findGroupDayPath` | playback, what-if, sidebar init | not an engine: a tab's UI and its canvas, with `buildVizRenderData` the one data function |
    | The schedule model, which has no section of its own: `normalizeSettings`, `getBellDay`, `formatModTime`, `groupWeight`, `congestionDelayMult`, `anyGroupSized` (settings, 5347); `modLabel`, `getAllModLabels` (5327); `rebuildRoomRegistry` (5630); `serializeBlueprint`, `migrateBlueprintToFloors`, `applyBlueprintData`, `validateBlueprintData` (5687); `deriveSameFloorPairs` (6214); `computeScheduleConflicts`, `generateGroupId`, `getNextGroupColor` (11132); `serializeFullProject`'s group shape (17505) | about 22,000 | `AppState` throughout, `roomRegistry` (a page `let`), `localStorage` in the save/load pairs | everything | the normalizers and the conflict check are pure given their inputs; the save/load pairs are the page's and stay |

    The blueprint editor (sections 6214 to 10558, about 113 KB) reads `AppState` 300 times and `document` 250 and
    owns `canvas` and `ctx` (`let canvas, ctx`, line 6664) which the door cards swap under `renderCanvas()`. It is
    not an engine and nothing in P3 to P6 needs it in a module; it is in the ladder only for the number.
  - *The shape of a module, decided.* **Pure ES modules under `Tools/schedule-visualizer/`, with `export`ed
    functions that take their inputs and touch neither `AppState` nor the DOM; the page's inline `type="module"`
    script imports each and puts it on `window` as a namespace (`window.SVGraph = …`, exactly as it does
    `window.SVRecovery` today); and the page keeps one thin wrapper per old name in a short `BRIDGE` banner
    section of its classic script, reading `AppState` and calling the namespace.** So the 388 bare-name call
    sites and the suites' `/* global getPathfindingGraph, applyFullProject … */` lines are untouched: the
    wrapper is hoisted at parse like the function it replaces, and it dereferences the namespace at call time.
    Why not classic `<script src>` files with bare top-level functions (015's and 009's shape): the lint config
    parses every `Tools/*/*.js` as a module with browser globals, so a classic file's page-only functions fail
    `no-unused-vars` and its reads of `AppState` fail `no-undef` without a `/* global */` line per file; a classic
    file is sloppy unless it says otherwise, and P1 counts on modules being strict; `select-suites` rule 2 and
    `check-adoption` follow `import`, which is how a change to `sv-graph.js` selects every suite that opens 035;
    and P1's `readPublisher()` is to learn a `sources` list of modules, not scripts. Why not an IIFE with
    `global.X = X` (015's shape): it hides the shared `let`s, which is right, but it still cannot be `import`ed by
    the Node suite the bullet asks for, and the one repo precedent for testing such a file (`export.test.mjs`'s
    `vm.runInContext`) exists because `_shared/export.js` must load on pages that have no module script. 035 has
    one. **The shared `let`s are the one thing a module cannot keep:** `pathfindingGraph` and `_blueprintDirty` are
    assigned from four page sections, which a module binding does not allow. They become a cache object the
    graph module owns, `SVGraph.cache(blueprint)` returning the graph for that blueprint and
    `SVGraph.invalidate()`; the nine `_blueprintDirty = true` writes (*measured:* lines 5834, 6269, 6340, 6364, 6381, 6449, 6526, 6542 and
    6574 in the page as it stands) become `invalidate()` calls, and the wrapper `getPathfindingGraph()` is
    `SVGraph.cache(AppState.blueprint)`. `roomRegistry` stays the page's and is passed in. **The parse-time rule:**
    the main classic script runs during parsing and the module scripts run after it, before `DOMContentLoaded`;
    `init()` runs on `DOMContentLoaded` (line 17770) and every other call is in a listener, so a wrapper is never
    called before its namespace exists (*measured:* no top-level statement of the main script calls a function; its
    top-level statements are `addEventListener` wiring, `window.X = X` lines that move with their functions, and
    `AppState.viz = {…}`). A wrapper whose namespace is missing throws `SVGraph is not loaded` by name rather than a
    bare `TypeError`, and the pure test below holds the page to the rule statically so that it cannot drift.
  - *The surface, module by module. Every function is pure unless it says otherwise; every object is plain JSON
    except the `Map`s the graph has always used; nothing reads or writes storage.* Shapes are the ones in the page
    today, renamed only where a name was the page's (`gridData` stays `gridData`).
    **`sv-model.js`** — `normalizeSettings(s) → settings` (the page's, which fills `bellSchedule`, `subjects`, the
    walk and stair seconds, `defaultGroupSize`); `modLabel(index, style)`, `modLabels(settings) → [string]`;
    `bellDay(settings, day) → [{start,end}|null]|null` (B falls back to A, the page's rule); `formatClockTime`,
    `formatModTime(settings, day, modIdx) → ''|'8:00–8:42'`; `groupWeight(group, settings) → integer`;
    `congestionDelayMult(effOthers)`; `dayMods(group, day) → [room|'']` (A is `modsA || mods`, B is a non-empty
    `modsB` else A for paths but `modsB || []` for the publisher: **two rules today**, both kept and both named,
    `dayMods(group, day, { emptyB: true })` for the publisher's); `roomRegistryOf(blueprint) → [{roomNumber,
    teacher, dept, floorId, col, row, excludeFromConflict}]`; `scheduleConflicts(groups, day, { registry, modLabels
    }) → [{mod, modLabel, room, groupNames}]`; `serializeBlueprint(blueprint, settings, { portable, traceImage })`
    returning the version-5 object the page writes today (`savedAt` is the caller's; `traceImage` is a function the
    page hands in, since `portableTraceImage` reaches into `SVTraceImage`); `migrateBlueprint(data) → data` (the
    page's `migrateBlueprintToFloors`, the floors-and-pairs normaliser, which mutates in place and keeps doing so);
    `validateBlueprint(data) → { ok, errors }`; `blueprintFromData(data) → blueprint` (the pure half of
    `applyBlueprintData`: `cells` to `gridData`, no `AppState`, no canvas); `deriveSameFloorPairs(blueprint,
    floorId)`; `pairLabel(i)`; `groupRecord(g) → {name, grade, color, size, modsA, modsB, mods}` (the project file's
    shape, so the project export and the publisher agree on one normaliser); `nextGroupColor(groups)`, `groupId()`.
    **`sv-graph.js`** — `cellKey`, `floorCellKey`, `parseKey`, `manhattan`, `ORTHO`; `buildLocalFloorGraph(gridData,
    cols, rows) → { adjacency, types, roomToKey }`; `buildGraph(blueprint) → graph` (today's
    `buildMultiFloorGraph` with the blueprint as its argument: `{ adjacency: Map<key,[{key,cost,teleport?}]>,
    types: Map<key,type>, roomToKey: Map<room,key>, portals: [{key,partnerKey}], cols, rows, walkableCount,
    classroomCount, edgeCount, portalCount, isWalkable(key) }`); `heuristic(graph, goalKey) → (key) → number`;
    `astar(graph, startKey, goalKey) → [key]|null`; `pathMetadata(keys, graph, { pairs }) → { path: [{x,y,floorId}],
    pathLength, usesStaircase, staircasePairsUsed: [label], hallwayCells, crossesFloor }`;
    `resolveRoomPath(graph, fromRoom, toRoom, { pairs }) → metadata | { noTravel: true, … } | { error, severity }`
    (the four messages exactly as today: `Mod not assigned` and `Room not found in blueprint` are warnings,
    `Room unreachable — not connected to any hallway` and `No valid path between rooms` are errors);
    `findPath(graph, fromRoom, toRoom)`; `createCache() → { get(blueprint), invalidate() }`.
    **`sv-routes.js`** — `groupDayPath(group, day, { graph, settings, pairs }) → [segment]|null` (today's
    `findGroupDayPath`: `modCount − 1` segments of `{ fromMod, toMod, fromModLabel, toModLabel, fromRoom, toRoom,
    path, pathLength, usesStaircase, staircasePairsUsed, hallwayCells, noTravel?, error?, severity? }`);
    `congestionMap(groups, day, { graph, settings, blueprint, isExcluded }) → Map<key, load>` (one tally per segment
    per cell, weighted by `groupWeight`; a cell with no `floorId` is on the first floor, the page's fallback);
    `isCellExcluded(blueprint, x, y, floorId)`; `collectExitPoints(blueprint, graph) → [{key, floorId, col, row,
    label, assemblyPoint}]` (a marked exit that is not in the graph's adjacency is dropped, as today);
    `evacPathCost(graph, path)`; `evacuationRoute(graph, roomKey, exits) → { path, exit, cost, crossesFloor } |
    null`; `evacDirectionLabel(dx, dy)`; `evacuationSteps(path, exit, graph) → [string]`.
    **`sv-congestion.js`** — `congestionData(entries, settings, { blueprint, transFilt }) → { congestion: Map,
    contributors: Map, maxCongestion }` (the pure body of `buildCongestionData`); `travelTimes(entries, settings, {
    congestion }) → entries` (the pure body of `computeTravelTimes`: each segment gains `travelSec` and `delaySec`,
    `walkSec` per hallway cell plus `stairSec` per teleport plus `walkSec × congestionDelayMult(others / dgs)`);
    `whatIfMetrics(groups, day, overrides, { graph, settings, blueprint, pairs }) → { groups: [{id, name, grade,
    color, mods, segments, weight}], totals… }` and `whatIfDiff(base, scenario)` (the pure cores of `wiComputeMetrics`
    and `wiComputeDiff`; the two are on `window` today and the what-if suite-to-be reads them there). The
    renderers that paint these (`renderCongestionSummary`, `wiRenderCards`…) stay on the page.
    **`sv-playback.js`** — `createPlayback({ draw, now, raf, reducedMotion }) → controller` (today's
    `PlaybackController` with its clock and `requestAnimationFrame` injected, so the Node suite can step it);
    `teleportLegs(segment, graph)`, `sequentialDwell(…)`, `collisionSimulation(entries, settings)` (pure);
    `drawPlaybackFrame(ctx, frame, geometry)`, `drawPortalDwellArc(ctx, …)`, `drawPortalPulse(ctx, …)` (renderers:
    they take the context and the numbers and read nothing). The viz canvas's size and offsets come in as
    `geometry` (`{ cellSize, floorOffsetY(floorId), lane }`), which the page computes from its canvas as it does now.
    **`sv-browser.js`** — the whole browser script, in one module, because the live preview and the published file
    run the same functions and P1's ledger names them by text: `BR_CSS`, `BR_STALE_DAYS`, `BR_LEGACY_SHORT`,
    `BR_DEPT_FALLBACK`; `deriveScheduleData(settings, blueprint, groups, { dept, order })` (today's
    `brDeriveScheduleData` without the `brSyncDeptFromSettings()` call inside it: the palette is an argument);
    `deptFromSubjects(subjects) → { dept, order }`; `snapshotBell(settings) → bell|null`;
    `geometrySnapshot(blueprint)`; `publishedData({ settings, blueprint, groups, subjects, now, tool }) → data` (the
    object `brBuildPublishedHTML` builds, at P1's `FORMAT`); `publishedMarkup(school, dateStr, tool)`;
    `publishedHTML(data, { fontCss, dateStr, tool }) → string`; `publishFileName(school, now)`; and the 28 listed
    functions and 7 constants **as named exports with their names unchanged** (`brRenderTeacher`,
    `brDColor`…), with `publishFnList()` the module's own list of them. `brLoadFromVisualizer`, `brPublish`,
    `brCopyPublishedHTML`, `toggleApp` and the legacy map (`BR_WINGS`, `brRenderMapLegacy` and the 20 functions
    of the "Building map (legacy hardcoded geometry)" section, 22 KB, which no published file has had since R60 and
    the live preview reaches only for a project with no geometry; it holds a real building's room numbers and is
    worth a look of its own) move with the module, unexported.
    The published functions keep reading the module-level `BR_TEACHERS`, `brMode`… that the published preamble
    declares; in the module those are `let`s the page sets through `SVBrowser.load(data)`, which is what
    `brLoadFromVisualizer` becomes.
    **`sv-viz.js`** (increment 9) — the visualize tab's canvas: `vizRenderData(groups, day, { graph, settings, pairs
    })` (pure), the `draw*` functions taking `(ctx, geometry, data)`, and the tab's controls as today, reading
    `AppState` through a `ctx` object the page hands in. **`sv-editor.js`** (increment 10) — the blueprint editor,
    moved as a module that takes `{ state: AppState, canvas, els }` at `init` and otherwise unchanged; not purified.
    **`sv.css`** (increment 1) — the first `<style>` block, verbatim, linked by `<link rel="stylesheet"
    href="schedule-visualizer/sv.css">` where the block was. **Storage keys and migrations: none change.** The
    seven keys and four prefixes of the registry row stay the page's; `stviz_blueprint` stays version 5; the
    project file stays `fileType` `PROJECT_FILE_TYPE`, `version` 1, `schemaVersion` 31; the recovery ring stays
    `sv-recovery.js`'s. There is no migration in P2 because no stored shape changes, and a save or project from v61
    loads on the last increment as it does today (the test holds it).
  - *The algorithms, with their edge cases, which the Node suites pin so the move cannot change them.*
    **The graph.** A floor's cells are classified `hallway`, `staircase` or `classroom`; `dummy` tiles and empty
    cells are not nodes. A room number maps to the first cell found in row-major order; a grouped room's cells
    carry `roomNumber` only on the anchor (Round 55), so every cell's room is resolved through its group anchor
    (`effectiveRoomNumber`, cached per `groupId`), and a corridor touching *any* cell of a room reaches it. Edges
    are orthogonal, cost 1. A classroom with doorways (`classroomDoorEdges`) connects to a corridor only through
    them; one with none connects on every side. Floors join through `crossFloorPairs` whose two ends are both
    staircases, as zero-cost `teleport` edges; a pair naming a cell that is not a staircase is skipped. A* never
    expands through a classroom that is not the start, and never steps onto a classroom that is not the goal
    (rooms are terminals, not corridors). The heuristic is a portal Dijkstra from the goal over every staircase
    cell with Manhattan edges, so it stays admissible under teleports; because it is not consistent, a closed node
    is reopened when a cheaper route reaches it. `resolveRoomPath`: blank room on either side is the warning `Mod
    not assigned`; the same room both sides is `noTravel`; an unknown room is `Room not found in blueprint`; a room
    with no edges is the error `unreachable`; a search that exhausts is `No valid path`. `pathMetadata` records
    `usesStaircase` and the pair labels crossed, `hallwayCells` (hallway-typed cells only, with `floorId`), and
    `crossesFloor`. **Routes and congestion.** A day's mods are `modsA || mods` for A and a non-empty `modsB`, else
    A's, for B; a segment runs mod `i` to `i+1` for `modCount − 1` segments and carries the labels from
    `modLabels(settings)`. Congestion counts each segment once per cell, weighted by `groupWeight` (the group's
    `size` if a positive number, else `settings.defaultGroupSize`, else 25), skipping cells inside a heat-exclude
    zone **on the cell's own floor** (a cell with no `floorId` is checked against the active floor's zones today,
    which is the one place the engine's answer depends on which floor the editor is showing: the module takes the
    first floor instead, which is what `floorCellKey` already assumes two lines later, and the test names the
    difference). Travel time is `walkSec` per hallway cell, `stairSec` per teleport, and a delay of `walkSec ×
    congestionDelayMult(othersWeight / defaultGroupSize)` per cell shared with other groups in the same transition
    (`0.2 × n` below one other group's worth, `0.2 + 0.3 × (n − 1)` to two, `0.5 + 0.3 × (n − 2)` to three, `0.8`
    from three). **Evacuation.** Exits are hallway cells with `isExit` that are in the graph; the route for a room is the
    exit with the least real edge cost (teleports free), ties to the first found; a route through a staircase pair
    is `crossesFloor`, and the door card then prints steps without a map crop (the card's choice, which stays on
    the page). Steps are runs of one direction with the length in cells and a turn word from `evacDirectionLabel`.
    **The model.** `scheduleConflicts` keys `mod-room` over a day's mods, skips blank rooms and rooms flagged
    `excludeFromConflict` in the registry, reports keys with two or more groups sorted by mod; the room is
    re-joined on `-` because a room number may contain one. **The publisher.** `deriveScheduleData` walks each
    floor's `gridData` (not `cells`), takes one record per room (a grouped room once, by `groupId`), one room per
    teacher (the last found) and one group per teacher-room-mod (the last written; P1 question 5), builds `plan`
    from the Planning slots with the `A1 / A2 / B3` form, `sec`, `co` (mates across shared sections, sorted),
    `room2teacher`, `groupRooms` with B independent of A, and a missing `dept` is `ELA`. **These are the rules as
    they are; P2 changes none of them**, including the two it finds doubtful (the active-floor zone check, the
    `ELA` default), which it names in the suite and leaves to P5.
  - *The order of extraction. Eleven increments, each one PR with the suite green, each bumping `CACHE_VERSION`,
    each adding its files to `PRECACHE_URLS` (never to `SHELL_URLS`: 035 is not one of the ten shell tools). The page
    size after each is measured on the sections as they stand, so the moved-out bytes are exact and the bridge's
    added bytes are an estimate of about 0.3 KB per wrapper.*
    1. **`sv.css`.** The first `<style>` out, verbatim, one `<link>` in its place. **811 KB.** No JavaScript seam;
       it proves the precache, `check:precache`, `check:hidden-flex` and `check:print-clip` (both follow a linked
       stylesheet, read off their source), `test:theme`, `audit-print --only 035` and the offline path on a new
       file before any function moves. The theme sweep and the print audit must come out identical.
    2. **`sv-model.js`** and the `BRIDGE` section. The normalisers, labels, bell, weights, conflicts, registry
       derivation, blueprint serialise/migrate/validate and the group record. The page's `saveSettings`,
       `loadBlueprintFromLocalStorage`, `applyBlueprintData` and friends keep their names and storage calls and call
       the module for the pure half. **794 KB.** The first Node suite (`model.test.mjs`) and the first
       `readPublisher()` `sources` entry are in this PR, because `formatModTime` and `getSubjects` are reached by the
       publisher and the static guard would otherwise fail FREE on the move. The byte-identical save test lands here.
    3. **`sv-graph.js`.** The cache object replaces the two shared `let`s; the nine `_blueprintDirty = true` writes
       become `SVGraph`'s `invalidate()`. **771 KB.** `graph.test.mjs`.
    4. **`sv-routes.js`.** Group day paths, congestion map, evacuation. **762 KB.** `routes.test.mjs`;
       `smoke-evacuation.mjs` runs unchanged (it reads `window.computeEvacuationRouteForRoom`, which the bridge
       keeps).
    5. **`sv-congestion.js`.** The four pure cores out of viz, playback and what-if; their renderers stay. **748
       KB.** `congestion.test.mjs`, which is the first test the what-if lab has ever had.
    6. **`sv-playback.js`.** **699 KB.** `playback.test.mjs` steps the controller with an injected clock.
    7. **`sv-browser.js`.** The publisher and the shared browser functions; the live preview's nine `onclick`
       names set on `window` by the bridge. **623 KB.** P1's baseline is regenerated **and must not change**: this
       is the increment P1's "regenerate and diff" exists for, and the first real use of `readPublisher()`'s
       `sources`. `test:schedule` and all four `test:schedule-browser` suites unchanged.
    8. **`check-precache` follows `import`.** A guard change in `Tools/board-check/`, its own PR, site-wide CI once:
       `sv-routes.js` imports `sv-graph.js` and nothing on a page names `sv-graph.js` directly, so from increment 4
       the list has been hand-kept for module-to-module imports. (Until then `imports.test.mjs` below holds it.)
    9. **`sv-viz.js`.** The visualize tab's renderer and controls. **518 KB.**
    10. **`sv-editor.js`.** The blueprint editor **with the tile-drawing helpers and the evacuation door cards**,
        which live under the door-cards banner but are what `renderCanvas()` draws with (`drawTile`, `drawRoomLabel`,
        `drawStaircaseIcon`…), as a module that is handed `AppState`, the canvas and its elements, and is not
        purified. **368 KB.** Its suite is the existing `smoke-print.mjs` and
        `smoke-trace-image.mjs` plus a new `smoke-editor.mjs` that paints a plan, pairs stairs, undoes, and saves.
    11. **`sv-whatif.js`** (the what-if lab's controls and room search, 41 KB after increment 5 took its arithmetic),
        **`sv-schedules-tab.js`** (the groups editor, bulk editor, CSV import and conflicts banner, 63 KB) **and the
        folding of the two folders.** **About 270 KB**, under the line with some 30 KB to spare for the bridge's
        growth and whatever the moves find. The folding: `Tools/schedule/fonts/` (13 precache lines, the page's `<link>` and `published-fonts.js` tag, the
        build script and its README) and `Tools/schedule/test/` (`publish.mjs`, `smoke.mjs`, the fixture, P1's
        contract, ledger and baseline) move to `Tools/schedule-visualizer/`; `suites.json`, `package.json`,
        `sw.js`, `select-suites.mjs`'s header comment and **`select-suites.test.mjs`, which pins the rule-2 example
        "an edit to `Tools/schedule/*.js` selects schedule-visualizer's suites"** (read off the header; the test's
        text was not opened), and `Tools/schedule/README.md`, rewritten as `Tools/schedule-visualizer/README.md`
        with the file list, the module map and the suites. Last on purpose: every path P1 names is in it.
    **The page after increment 11 is about 270 KB: the markup 141 KB, the second style block and head 10 KB, the
    bridge about 15 KB and the rest of the script about 100 KB** (app state and keys, the storage pairs, settings
    panel, bell and subjects editors, tabs, toasts, trace images, hand-off, onboarding, project export and import,
    sidebar init, snapshots, recovery, presentation mode). Each figure is today's sections summed; the bridge is an
    estimate. **How the target is measured:** `fs.statSync(page).size`, bytes on disk of
    `Tools/035-schedule-visualizer.html`, which is the figure every note about this file has used. A ledger holds
    it: `Tools/schedule-visualizer/test/size-ledger.json`, `{ page, modules: { file: bytes } }`, and
    `size.test.mjs` fails when the page is larger than its ledger line and when it is smaller by more than 2 KB
    (lower it in the same commit), the inline-sinks ratchet's shape; the modules' lines are a record, not a cap.
  - *What stays byte-identical, and how each is held.* **The published file for Northwind**, from increment 1 to
    11, under P1's pinned clock: P1's `smoke-publish-baseline.mjs` against the committed baseline, section by
    section. The publisher's own move (increment 7) keeps it: `.toString()` of an `export function` is its text
    from `function` on, and the 35 pieces are moved as declarations, never as methods or arrows; `assemble()`
    equals the browser's bytes is P1's assertion and it runs here on a page whose publisher is a module. **034**:
    not opened by any increment (the folder fold does not touch it). **Saved state**: `model.test.mjs` loads a
    `stviz_blueprint` captured from v61 (a fixture with made-up rooms), runs it through `migrateBlueprint`,
    `blueprintFromData` and `serializeBlueprint`, and gets the same JSON with only `savedAt` differing; the same
    for `stviz_settings` through `normalizeSettings` and for a project file through `groupRecord`;
    `smoke-recovery.mjs` already proves the ring survives a reload. **State links**: 035 loads none of `share.js`,
    `state-link.js` or `handoffs.js` and takes no input from a URL (*measured*: zero references), so there is
    nothing to hold and no `inline-sinks` baseline line to add. **The data contract**: `publishedData()` validates
    at P1's `FORMAT` with no error and no warning on Northwind, unchanged by the move.
  - *Load order and offline.* The page's module script (line 52) grows one `import` per increment and one
    `window.SV<Name> = …` line; a wrapper in the `BRIDGE` section per old name. Module scripts and `defer` scripts
    run in document order after parsing and before `DOMContentLoaded`, which is when `init()` runs, so the
    namespaces exist before the first call; the parse-time rule above is what makes that true, and
    `bridge.test.mjs` reads the page with the parser P1's guard uses and fails if a top-level statement of a
    classic script calls, or reads a property of, a bridged name. Every new file is in `PRECACHE_URLS` in the
    increment that adds it, so a teacher who has visited the site once has it offline after the deferred pass; the
    precache is versioned, so the bump re-fetches the page and its files together and a stale page never meets a
    new module. A module that only another module imports is not seen by `check:precache` until increment 8;
    `imports.test.mjs` walks the `import` graph from the page and fails on a file the list lacks, from increment 2.
    The published file is the only thing of 035's opened from `file://`, and it imports nothing: it is one file by
    design (P1's "nothing happens to it"). `make-offline-copy.mjs` ships the modules and drops `test/`, as it does
    for 046's seventeen. Nothing here loads lazily: a module that `import()`ed on first use would make the first
    offline use of a tab a failure, so every import is static.
  - *The tests that would prove it, named.* Pure Node, under `Tools/schedule-visualizer/test/`, each with a
    `test:<name>` shortcut and a `suites.json` line (`check:tests` fails otherwise), fixtures built in the test with
    made-up names (Ms. Okafor in 204, Mr. Lindqvist in 116, groups 7-1 to 7-4) and the Northwind project:
    `model.test.mjs` (labels in all four styles; `bellDay` B falling back to A; `formatModTime` blank on a missing
    end; `groupWeight` with a size, a blank, a string, a zero, and no default; the two `dayMods` rules; conflicts:
    none, one, a flagged room, a room with a hyphen, both days; `migrateBlueprint` on a save from before floors existed (no
    `floors` key, a top-level `cells`), on a version-5 save, and on one with a pair naming a missing floor; the byte-identical round trips above; `validateBlueprint` on
    each malformed field). `graph.test.mjs` (a 3×3 floor: classification, orthogonal edges, a dummy tile as a wall;
    a room with one doorway reachable only through it; a grouped room reached through a non-anchor cell; two floors
    joined by a pair, the teleport edge and its zero cost; a pair naming a hallway cell, skipped; A* through a
    teleport shorter than the stairs' Manhattan distance, which is the admissibility case; the reopen case built
    by hand; a path that must not cut through a third classroom; `resolveRoomPath`'s five answers; `pathMetadata`'s
    `hallwayCells` holding no staircase; the cache returning the same object until `invalidate()`).
    `routes.test.mjs` (a four-mod day with a Planning gap, a same-room pair and an unknown room; congestion with
    two groups sharing a corridor, one sized, one not; a zone on floor 2 that excludes a floor-2 cell and not the
    floor-1 cell under it; exits: nearest by cost through a teleport, a tie, no exit at all, an exit cell not in the
    graph; steps for a path with two turns). `congestion.test.mjs` (`congestionDelayMult` at 0, 0.5, 1, 1.5, 2, 2.5,
    3, 4; `travelTimes` on a segment with two teleports; `whatIfMetrics` with an override that removes a trip and
    `whatIfDiff` reporting it). `playback.test.mjs` (a controller stepped by an injected clock through two
    transitions; reduced motion; `collisionSimulation` on two groups crossing). `browser.test.mjs`
    (`deriveScheduleData` on Northwind equals P1's `EXPECTED`; the `ELA` default and the last-writer rules, named;
    `publishedHTML` on Northwind with a fixed `now` equals P1's baseline's script and markup sections;
    `publishFnList()` is the 28 names). `bridge.test.mjs`, `imports.test.mjs`, `size.test.mjs` as above. Browser:
    `smoke-editor.mjs` (increment 10) on the next free port after P1's (8489 is free at v251; the header's note on
    ports is the record); every existing suite unchanged. **The breaks on purpose** each increment is held to: a
    moved function's text changed by one character (P1's baseline names the section); a wrapper deleted (the
    evacuation suite fails on the missing global); a module file left out of `PRECACHE_URLS` (`imports.test.mjs`);
    a top-level call to a bridged name added to the page (`bridge.test.mjs`); a `let` made shared again
    (`graph.test.mjs`'s cache case); the page grown by a 3 KB comment (`size.test.mjs`).
  - *What each adopting tool changes.* 035 only, as above. 034 changes nothing. P1's `check-publisher.mjs` gains
    `sources` (the page, then every module its `type="module"` script imports, followed transitively) in increment
    2, and reads `export function` and `export const` as declarations. No other tool imports from
    `Tools/schedule-visualizer/`, and P2 does not offer one: a shared bell schedule (P7) is a later row.
  - *Left to P3 to P6, on purpose.* P3 takes `sv-graph.js`'s edge cost and `sv-routes.js`'s options (`{ weights:
    { stairs, elevator }, avoid }`) and `collectExitPoints`' shape; it needs increments 3 and 4 and nothing after.
    P4 needs the door cards out of the page (they go with the editor in increment 10; P4 may want them as their own
    `sv-cards.js`), and `ExportKit.toPdf` for the packs. P5 needs `scheduleConflicts` and `whatIfMetrics` (increments 2 and
    5) and adds the teacher-with-three-rooms and double-booked-room checks beside them. P6 needs `sv-browser.js`
    (increment 7) and P1's contract; whether 034 is a fork (P1 question 1) decides whether it imports the module
    or is published from it.
  - *Left out altogether.* Templating the 141 KB of markup, which is the floor under the number. Bundling or
    minifying anything (no build step on this site). Stripping comments. Changing any algorithm, default or
    message the suites find doubtful (named in the tests, left for P5). Adopting `a11y.js` or `ink-paper.css`
    (rank 5, Devon's). Lazy loading. A per-floor or per-building data model beyond what the page has. Fixing the
    stale `README.md` before increment 11 (it would be rewritten twice). Nothing here was run: no module exists,
    the sizes after each increment are sums of today's sections and will move by the bridge's bytes and by whatever
    the move finds, the "about 270 KB" at increment 11 could be 30 KB either way, and whether a
    reopen-tolerant A* on a 60×40 three-floor school stays fast in a module is the same question it is today
    (the page has no timing test; none is designed).
  - *Questions that are Devon's. None is answered here; the build waits on none of them except where said.*
    1. **Is under 300 KB the right target, now that it is measured?** The engines and the publisher (increments 1
       to 7) leave the page at about 620 KB with every Node suite in place, the visualize renderer (9) at about
       520 KB; the last 250 KB are the editor, the what-if lab and the groups tab, moved for the number and not
       purified. Stop at 7, at 9, or go to 11? The design goes to
       11 because the bullet says so; it is the cheapest decision in this list to reverse.
    2. **Should the two folders be folded at all?** It moves every path P1 names and a `select-suites` test pin,
       for a tidier tree. The design folds last; if the answer is no, increment 11 rewrites the README in place.
    3. **May the two doubtful rules change in P2's suites, or only in P5's?** A heat-exclude zone is checked against
       the floor the editor is showing when a cell has no `floorId`; a room with no subject publishes as `ELA`. The
       design keeps both and names them; changing either changes a congestion number or a published colour.
    4. **Is `sv-browser.js` one module or two** (the shared browser functions, which 034 mirrors, apart from the
       publisher that assembles the file)? One keeps P1's ledger on one file; two lets P6's reader import the
       browser without the publisher. The design says one, for P1's sake.
    5. **Does the help and onboarding prose stay in the markup?** It is 7.6 KB and the only markup a template could
       carry without changing what a teacher sees before `init()`.
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
  **Designed, not built (AI-21, 2026-10-05, a design pass: no code, nothing run in a browser). Everything from
  here to P2 is the design.** Read from the tree at v248: 002, 022, 027 and 021's pages, 007's page and
  `Tools/name-picker/np-pick.js`, 087's `Tools/class-screen/cs-core.js`, 020's pools, `_shared/roster.js`
  (`trackRenames`, `reconcile`, `idIndex`), `_shared/seating-read.js`, the registry rows and the suites behind
  `test:groups`, `test:lab-groups`, `test:novel-study` and `test:name-picker`. Figures marked *measured* came
  from one pure-Node probe: 002's and 022's grouping functions and 022/027's role picker copied out line for
  line, with a seeded generator in place of `Math.random`, and invented names. It was not kept. Questions that
  are Devon's are listed at the end and not answered.
  - *What is there today, as read.* The split into groups exists **six** times, not four: 002, 022, 027,
    `np-pick.js` (007), 021's "split the roster" button and `cs-core.js` (087's groups widget); 020's
    `distributeIntoPools` is a seventh deal, by seed order. All six share one core, to the letter: a Fisher-Yates
    shuffle from the end (`j = floor(rng() * (i + 1))`), then name `i` goes to group `i % k`. So for the same
    random numbers all six make the same groups, and that is what a shared engine can be held to. They differ
    round the core. *The count:* 002, 022 and 027 take "students per group" as `ceil(n / size)` (never over the
    size, often under); 087 takes `floor`, plus one when the remainder is at least half a group; 007 has a count
    only, at least 2, and drops repeated names; 022 can take the count from its scarcest equipment; 021 has a
    count only. *Constraints:* 002 has keep-apart, keep-together, locked groups, absent students, five
    strategies (random; a snake draft, three tiers and sorted slices on a 1 to 5 skill typed after the name, a
    missing one read as 3; and "everyone pairs with everyone") and three remainder rules; 022 has keep-apart
    only, and a safety gate that takes names out before the split; the rest have none. *The repair:* 002 and 022
    each run a random-swap search after the deal (800 and 600 tries), scored in 002 as broken pairs times
    100,000 plus 1,000 for a pair that shared a group last time and 100 for the time before. *Memory:* 002 keeps
    `pairHistory` (`"nameA␟nameB"` to `{ gen, count }`) and `pairGen` in `gtg:data:<class>`, for the whole year
    since 2026-08-13 (the "Why" above still says two generations), cut only when a name leaves the list; 022 and
    027 keep `history` (`name` to the last 30 role names) in `lgrr_rosters` and `novel-study-circles`. All three
    are keyed on the name and follow a rename through `Roster.trackRenames` with an `idNames` map and a
    `renameStudentData()` of their own (002 adds the counts of two pairs that become one; 022 and 027 refuse to
    put one student's roles onto a name that has some). *Roles:* 022 and 027 hold the same picker: members in
    random order, each takes the open role it held longest ago, with a random tie-break. *Saving:* 002 keeps
    the loaded object whole and saves it back; **022's `normalizeRosterData()` and 027's `loadProjectByName()`
    rebuild the object field by field, so a page from an older cache drops any field it does not know on its
    next save.** Every random draw in all six is `Math.random`; only `np-pick.js` and `cs-core.js` take an `rng`.
  - *Measured.* (1) **002's "floaters" and "leftover group" rules misread "students per group".** 30 students,
    groups of 4, floaters: 8 groups of 3 and 6 floaters; with "leftover group", 8 groups of 3 and a ninth of 6.
    The same for 22, 26, 27, 29 and 31 students (4 to 7 floaters, every group a 3). The rule pops every group
    down to the smallest after a deal into `ceil(n / size)` groups. (2) **The no-repeat search undoes the skill
    strategies after the first shuffle.** 28 students with random skills, 7 groups, 500 classes: under
    "Balanced" the gap between the highest and lowest group average is 0.38 on the first shuffle and 1.56, 1.89
    and 1.74 on the next three; under "Homogeneous" the range of skill inside a group goes from 0.43 to 3.05.
    The search swaps for recency and its score has no term for the strategy. (3) Keep-apart: 002's and 022's
    searches fail equally often on the same 2,000 classes at each of seven shapes: never for 28 in 7 groups with
    up to 30 pairs or 24 in 4 with 20; 0.65% and 0.75% for 30 in 3 with 20 pairs, where 20,000 tries also leave
    0.65% (those cannot be done). (4) Keep-together as pairs: two chains of three (A with B, B with C; D with
    E, E with F) in 28 by 7 are left broken in 4.5% of 2,000 shuffles; one pair, four pairs and one chain of
    four never were. (5) Roles: with the same four students and four roles over 12 meetings the picker hands
    someone the role they held last time in 1.1% of hand-outs, 6.0% with three roles and 3.6% with five students
    and four roles; the cheapest assignment over the same scores never does. (6) "Everyone pairs with everyone",
    28 in groups of 4: every pair has met after a median of 30 shuffles (23 to 46 over 200 classes), against 41
    (27 to 77) for random; the floor is 9. The first three shuffles are all new pairs, the tenth 36% new.
    (7) A full pair table for 30 students is 23.6 KB keyed on names, 24.8 KB keyed on ids, 6.8 KB keyed on two
    indexes into one list of keys. (8) The search costs about 1 ms a shuffle for 36 students in 9 groups;
    for 28 in 7 with memory and no constraints it used a mean of 22 of its 800 tries and never all of them.
  - *The rule the design is held to.* For the same random numbers the engine makes the groups, floaters and
    roles each tool makes today, for every option the tool has today, with two named exceptions: 022's
    keep-apart repair becomes 002's (same failure rate, measured above; different draws), and a class with a
    repeated name. Everything better than today (items 1, 2, 4 and 5 above) is an option that is off until an
    adopter turns it on in a commit of its own, after the commit that proves the port.
  - *The module: `_shared/grouping.js`, new, a classic script publishing `Grouping`* (not `Tools/_engines/`:
    `_shared/` is the one shared location). Pure: no DOM, no storage, no clock, and no `Math.random` when it is
    given `rng` or `seed`. It runs in a `vm` context under Node as `export.js` does. It never throws on data: a
    malformed option is dropped and named in `result.dropped`. A **member** is `{ key, name, attrs }`; `key` is
    any string unique in the call, `attrs` an optional map of teacher-set values (`{ skill: 4 }`). Groups are
    lists of keys throughout; the caller keeps its own records and maps back.
    - `rng(seed)`: a generator (mulberry32) from a 32-bit number or a string (FNV-1a); `newSeed()`.
      `pin(seed|null)`: a test hook; while set, a call with no `rng` or `seed` draws from it.
    - `plan(n, { count | size, sizeRule, remainder, min })` returns `{ count, sizes, floaters, ownGroup,
      note }` and draws nothing: the arithmetic a page shows before the shuffle. `sizeRule` is `'ceil'`
      (002, 022, 027 today), `'near'` (087) or `'floor'`; `remainder` is `'spread'` (some groups get one more),
      `'floaters'` or `'own-group'` (two or more left over make a group; one stays a floater, with `note`).
      Count is clamped to `[max(1, min), n]`. Today's 002 is `ceil` with any remainder rule; item 1's fix is
      `floor` when the rule is not `spread`, and nothing else.
    - `formGroups(members, opts)`. `opts`: `count` or `size`, `sizeRule`, `remainder`, `min`; `absent: [key]`
      (left out of the groups, kept in the memory); `strategy`: `'random'`, `'balanced'`, `'heterogeneous'`,
      `'homogeneous'`, `'coverage'` (002's five stored words, so nothing saved is renamed) or `'spread'` (a
      category dealt evenly); `by: 'skill'` and `missing: 3` for the strategies that read an attribute;
      `apart` and `together`: lists of key pairs; `previous: [[key]]` with `lock: [bool]` (002's locked
      groups: kept at their index, the count fixed at `previous.length`); `history` (read, never changed);
      `recency: { penalties: [1000, 100] }`; `cost(aKey, bKey)`, an optional number added for each pair that
      shares a group (P2's seating distance; nothing in P1 supplies one); `search: { attempts: 800, restarts: 0,
      keepStrategy: false, together: 'pairs' }`; `rng` or `seed`. It returns `{ groups, floaters, absent,
      seed, violations: { apart, together, repeats }, impossible, dropped, stats }`, where `stats` is
      `{ strategy, fellBack, count, sizes, ownGroup, note, lockedCount, placed, locksDropped, newPairs,
      totalPairs, attempts, tries, score, stoppedBy, spread }`. **It does not write the memory**; `history.record()`
      does, so Undo is the old object and a preview costs nothing.
    - `rotateRoles(groups, roles, history, { method, rng, seed })` returns `{ byGroup: [[{ key, role }]],
      repeats: [key] }`; a member past the last role gets `role: null`. `method: 'greedy'` is today's picker
      draw for draw; `'best'` is the cheapest assignment over the same scores (every ordering tried for up to
      8 members, greedy then pair swaps above that), ties broken by `rng`.
    - `coverRoles(group, absentKeys)`: 022's `computeEffectiveMembers()`, which hands an absent member's role
      round the present ones; no draws.
    - `history.*`, all returning a new object: `empty()`, `normalize(h)` (repairs or empties, never throws,
      refuses `__proto__`, `constructor` and `prototype` as keys, as 022 does for an arriving link),
      `record(h, groups, { roles, members })`, `count(h, a, b)`, `lastGen(h, a, b)`, `rolesOf(h, key)`,
      `coverage(h, keys)` (`{ met, possible, never: [[a, b]], counts }`, which is 002's grid and the answer to
      "has everyone worked with everyone"), `rekey(h, from, to)`, `prune(h, keys, policy)`,
      `identify(h, names, ids)`, `fromLegacy({ pairHistory, pairGen, roles, idNames })`, `toLegacyPairs(h)`,
      `toLegacyRoles(h)` and `absorbLegacy(h, legacy)`.
  - *The memory.* `{ v: 1, gen, keys: [key], names: [name], seen: [gen], pairs: { "i.j": [lastGen, count] },
    roles: { "i": [roleName] } }`, where `i < j` index `keys`. Index keys are why a rename or a new id is one
    string changed and not up to 29 pair keys rebuilt, and why the table is 6.8 KB and not 23.6 (measured).
    `gen` is the number of recorded groupings; `seen[i]` the last `gen` member `i` was handed in, absent or
    not; `roles` holds the last `maxRoles` (30, today's cap) per member, oldest first. A role is its name, as
    today: renaming a role in a tool's editor starts that role's memory again, which is today's behaviour and
    is not fixed here.
  - *Keys, and how the memory survives a rename.* `identify(h, names, ids)` is the one place a name becomes a
    key. `ids` is `{ name: id|null }` from the sidecar; the build adds one read-only export to `roster.js`,
    `Roster.idsFor(names, rosterName)`, over the `idIndex()` and `idFor()` that `trackRenames` already uses
    (same precedence: the tool's roster first, then the first roster that knows the name). For each name in
    order: (a) it has an id the memory knows (`i:<id>`): that member, and the stored name is updated, which is
    all a followed rename is; (b) else the memory holds a key no other current name has claimed whose stored
    name is this exact string: that member, re-keyed to `i:<id>` when there is one. This is the first sighting
    of an id for a student known by name, and also a roster deleted and made again in 006, which mints new ids
    for the same names; (c) else a new member, `i:<id>` or `n:<name>`. A name that appears twice gets `#2`,
    `#3` on its key in list order, and the call says so in `duplicates`; today 002 treats two students of one
    name as one in every constraint. It returns `{ members, history, moved: [{ from, to, why }], duplicates }`
    and needs no `idNames`: `names[]` is that record. What it cannot follow is what `trackRenames` cannot: a
    student retyped under a different name with no id carried over (`roster.js`, assertion 27b).
    `rekey(h, from, to)` when `to` exists keeps both tools' rules: pair counts add and the later `gen` wins
    (002); roles are not merged, `to` keeps its own (022, 027); the pair of the two with each other is dropped.
  - *Retention is `prune(h, keys, { departed, maxRoles })`,* called by the tool once per grouping, never per
    keystroke (002's reason stands: a name half retyped must not lose its year). `departed` is `'drop'` (002
    today: a member not in the list loses every pair), `'keep'` (022 and 027 today) or `{ gens: N }` (kept
    until N groupings have been recorded without them). Absent members are in the list. Nothing is pruned by
    age. The policy is an argument each adopter passes; whether a teacher sees it as a setting is a question
    below.
  - *The algorithm, in the order the draws happen.* (1) Take out `absent`. With `previous` and `lock`, if
    every locked member is present the locked groups stay and the pool is the rest; if not, the locks are
    dropped, `locksDropped` is set and the whole class is dealt (today's silent fallback, now reported).
    (2) `plan()`. (3) The deal, each strategy a port: `random` shuffles and deals round-robin; `balanced`
    shuffles, sorts by the attribute (stable, highest first) and snakes; `heterogeneous` sorts the same way,
    cuts three tiers at `ceil(n / 3)` and `ceil((n - t1) / 2) + t1`, shuffles each and deals each round-robin;
    `homogeneous` cuts sorted slices; `coverage` takes students in shuffled order and puts each in the smallest
    group, shuffled among equals, where the sum of `count()` with its members is least; `spread` is new:
    shuffle, stable sort by category, round-robin. A strategy that reads an attribute no member has falls back
    to `random` (`fellBack`). With `together: 'units'` the pairs are joined into sets first and a set is dealt
    as one block into the smallest group. (4) The remainder: for `floaters` and `own-group`, pop from the end
    of each dealt group, in group order, down to the size `plan()` gave. (5) The repair, 002's
    `resolveConstraints()` to the draw: while the score is above zero and tries remain, pick a broken pair at
    random (apart, then together, then repeats in the list); if the two share a group, swap the second with a
    random member of a random other unlocked group, and if they should be together, swap the second with a
    random member of the first's group; undo the swap only if the score rose. It is skipped when there are no
    constraints and the memory is empty, or fewer than two unlocked groups. (6) Count `newPairs` against the
    memory as it was handed in.
  - *The quality measure, and when the search stops.* The score is a list compared left to right: `[hard,
    strategy, repeats, cost]`. `hard` is the number of broken apart and together pairs; `repeats` is today's
    sum of 1,000 and 100; `cost` the sum of `cost()`; `strategy` is 0 unless `search.keepStrategy` is on, and
    then it is the measure the chosen strategy deals for (`balanced`: the gap between the highest and lowest
    group mean, in hundredths; `homogeneous`: the summed range inside groups; `heterogeneous`: groups missing
    a tier; `spread`: the largest difference in a category's count between groups). With `keepStrategy` off
    and no `cost` this orders every pair of arrangements as 002's single number does while a swap moves fewer
    than 100,000 points of recency, which holds for any group of 50 students or fewer. `stoppedBy` is `'clean'`
    (score all zero), `'nothing'` (no broken pair to pick), `'budget'` (`attempts` used), or `'skipped'`.
    `restarts: N` deals again, up to N times, only when a try ends with `hard` above zero, and keeps the best
    try; `tries` says how many ran. Before any draw, `impossible` names what no search can do: a together set
    larger than the largest group, a together set that contains an apart pair, and a set of members all apart
    from one another that is larger than the group count (found greedily, so it can miss one; it never
    invents one). An impossible constraint is still scored, so the result is still the best found.
  - *Seeding.* `seed` wins over `rng`, which wins over `pin()`, which wins over a fresh `newSeed()`; the
    result carries the seed when the engine chose or was given one, so `formGroups(members, { ...opts, seed })`
    gives the same result again. A page-driven property suite does not pin (`CLAUDE.md`: seeding turns a
    property test into a single-path test); the pure suite and the golden files do.
  - *Storage: P1 adds no key, and no adopter needs one.* Each adopter keeps its blob and gains one field,
    `groupHistory` (the memory above), so `tool-registry.js` and 009 are untouched and the year rollover
    already deletes it with the key. **The old fields stay written, derived from the new one, and on load the
    old field wins where it is ahead.** The reason is the line in "as read": an older cached page of 022 or 027
    (a second device restored from a 009 backup, or 022's own roster file opened on one) drops `groupHistory`
    when it saves, and an older 002 would shuffle against an empty `pairHistory` if the field were moved. So
    on every save the page writes `pairHistory` and `pairGen` (002) or `history` (022, 027) from
    `toLegacyPairs()` and `toLegacyRoles()`, and on load `absorbLegacy()` runs: no `groupHistory` means
    `fromLegacy()` (first visit after the update, or after an older page dropped it; roles and pairs as the
    old field has them); `pairGen` above `groupHistory.gen` means an older page shuffled since, and each pair
    with a newer `gen` adds its count difference and takes that `gen`; a role list that differs from the
    derived one replaces it. 002's bare-number pair entries (before `{ gen, count }`) and `gtg-settings` keep
    their existing migrations, which run first. `idNames` is read once by `fromLegacy()` (it maps a legacy
    name to its id) and written no more. Cost, measured: about 30 KB a class of 30 with every pair met, against
    23.6 KB today. Keep-apart and keep-together pairs, absent lists, `lastGroups` and 027's meetings stay
    names on disk, as typed and as shown; the tool maps them to keys for the call and keeps the few lines of
    its `renameStudentData()` that move them, driven by `identify()`'s `moved`.
  - *What each adopter changes in P2* (one PR each; the first commit of each is the port, proved by the golden
    files, and each improvement is a later commit with a `CACHE_VERSION` of its own).
    **007**: the page's `makeGroups()` calls `formGroups(names, { count, min: 2 })`; `np-pick.js` loses
    `makeGroups` and the suite's six assertions on it move to the parity suite. No memory.
    **087** and **021** (neither is named in P2 above; they are the fifth and sixth copies and the two
    smallest ports): `cs-core.js`'s `makeGroups` becomes a call with `sizeRule: 'near'`; 021's split button a
    call with `count`, its groups still saved as comma-joined text.
    **027**: `makeGroups()`, `shuffle()`, `roleRecencyScore()`, `assignRolesForGroup()` and `recordHistory()`
    go; the split keeps its group ids and labels; `logMeeting()` calls `rotateRoles()` then `history.record()`
    with the roles only (027 has never remembered pairs; whether it starts is a question below); the hint and
    "Reset role history" read and empty `groupHistory`.
    **022**: the same five functions and `resolveKeepApart()`, `groupIndexOf()`, `findApartViolations()` and
    `computeEffectiveMembers()` go; equipment mode still works out the count and passes `count`; the safety
    gate's excluded names are left out of `members` and the policy is `departed: 'keep'`, so they lose
    nothing; `normalizeRosterData()` learns `groupHistory`, and so does the roster file it exports and
    imports. Its warning text is written from `violations.apart`.
    **002**: `makeGroups()` and everything under it (the five strategies, `applyOddHandling()`,
    `resolveConstraints()`, the pair functions, `prunePairHistoryToRoster()`, `followRenames()` and most of
    `renameStudentData()`) goes; `buildExplanation()` stays and reads `result`; the pairing grid reads
    `history.coverage()`; Undo keeps the previous memory object and stops deep-copying it; the share payload
    is unchanged and still carries no memory (`smoke-share.mjs` asserts it). Then, each its own commit: the
    floater fix (`sizeRule: 'floor'`), `keepStrategy`, `together: 'units'`, `restarts`, and for 022 and 027
    `method: 'best'`. Seating-aware grouping is `cost` fed from `SeatingRead`; project teams are a 002 feature
    on top of `previous` and `lock`. Both stay P2's.
  - *Tests the build ships* (no page loads the module in P1, so no browser suite; the suites are pure Node on
    the `vm` loader, under a new `test:grouping` shortcut and a `suites.json` entry).
    `Tools/grouping/test/grouping.test.mjs`: `plan()` for every `n` from 0 to 60 against every rule (sizes sum
    to `n` less floaters, differ by at most one under `spread`, never exceed `size` under `ceil` or fall below
    it under `floor` when `n >= size`; 30 by 4 is `[4,4,4,4,4,4,3,3]`, then 7 fours and 2 floaters under
    `floor`); every strategy places each present member exactly once for 500 seeds and `n` from 0 to 40
    (0 and 1 member, more groups than members, everyone absent); the same seed twice gives the same result,
    and `seed` reproduces a result made from `newSeed()`; locks (kept at their index; a locked member absent
    sets `locksDropped`); `impossible` for the three shapes, and none reported on 2,000 random satisfiable
    classes; `together: 'units'` leaves no chain broken where `'pairs'` leaves some (the two-triples case,
    with its measured rate as a band); `keepStrategy` holds the `balanced` gap after four generations within a
    stated bound of the first; `restarts` never returns a worse score than no restarts; `rotateRoles` `'best'`
    never repeats a role when an assignment without a repeat exists, and `'greedy'`'s rate is inside a band
    round the measured 1.1%; `coverRoles` against 022's cases (one absent, two absent, everyone absent, an
    absent member with no role). The memory: `record` then `count` and `lastGen`; `normalize` on fifteen
    broken shapes; `prune` under the three policies; `rekey` onto an existing key (counts add, roles not
    merged); `identify` for a first id, a rename by id, a roster made again with new ids, two students of one
    name, a name retyped that still exists as another student, and no ids at all; `coverage` against a count
    written in the test. Each assertion is seen failing once with its rule broken on purpose.
    `Tools/grouping/test/parity.test.mjs`, with `_legacy.mjs` beside it holding today's functions copied out
    of 002, 022, 027, `np-pick.js`, `cs-core.js` and 021 before P2 deletes them (as `export.test.mjs` keeps
    `duplex-print.js`'s two): for 300 seeds and class sizes 1 to 36, old and new are fed the same generator
    and must return the same groups in the same order, the same floaters, and leave the generator at the same
    point, for 007, 087 (both rules), 021, 027, 022 with no keep-apart pair, and 002 across the grid of five
    strategies, three remainder rules, count and size, with and without pairs, locks, absences and one to six
    generations of memory; the roles for 022 and 027 across eight meetings; and `fromLegacy()` then
    `toLegacyPairs()` and `toLegacyRoles()` give back what went in. For 022 with keep-apart pairs the suite
    asserts the measured claim, not equality: over 2,000 classes at each of the seven shapes the engine fails
    no more often than 022's copy. `absorbLegacy()` is driven by blobs an older page would write: the field
    missing, `pairGen` ahead, a longer role list. Nothing is called a golden file unless it is on disk: twelve
    results for fixed seeds are written to `Tools/grouping/test/golden.json` in the P1 commit so that a later
    change to the engine that moves a draw fails by name.
    P2's adopters keep their own suites (`test:groups`, `test:lab-groups`, `test:novel-study`,
    `test:name-picker`, `test:class-screen`, `test:pe-stations`) and each adds a load of a blob saved by the
    page before it.
  - *The build's bookkeeping, so it is not found by a red guard.* `_shared/grouping.js` in `PRECACHE_URLS` and
    `SHELL_URLS` with a `CACHE_VERSION` bump; `Grouping` in `eslint.config.js`'s `SITE_GLOBALS`; the
    `roster.js` export covered in `Tools/roster/test/smoke-rename-follow.mjs`; the suite in `suites.json` with
    its shortcut; `_shared/` changes run every suite in CI.
  - *Deliberately left out of P1.* Any page change. A shared memory key. A setting a teacher sees. The words
    of 002's explanation (the engine returns counts and pairs, the tool writes the sentence). Group labels,
    tents, sheets and the grid's drawing. Stations: 022's `assignStationsToGroups()` and 021's
    `computeAssignment()` are rotation, P3's `_shared/rotation.js`, with the timers. Brackets, pools, Swiss
    pairing and seeding orders are P3 and P4; 020's `distributeIntoPools` (a snake over a seeded order, no
    shuffle) can call the deal from `bracket.js` then or stay where it is. An exact solver: the search is
    today's, bounded, and says when it gave up. Balance on two attributes at once. A minimum or maximum group
    size beyond the three rules. Stopping the mirror of the old fields, which is a later cleanup with a
    `CACHE_VERSION` of its own once no cached page can predate P2.
  - *Not verified.* Nothing here ran in a browser and no engine exists; the parity claim is from reading the
    six copies and from the probe's ports, which the build's `_legacy.mjs` must redo from the files and not
    from this text. The probe's classes were random pairs and random skills, not a real class's constraints.
    The older-cache case was read from 022's and 027's load functions, not reproduced. `identify()`'s rule (b)
    has not been run against a sidecar written by 006.
  - **Questions for Devon. None is answered here; each says what the design assumes until he does.**
    1. *Skill on the shared record* (Path 3's Decisions, and 002's open question). Do skill or level values
       belong on the shared student record, or only inside the tool that asks for them? Assumed: the standing
       default, no; `attrs` is handed in by the calling tool from its own storage, and the engine stores no
       attribute anywhere.
    2. *One memory or several.* 002's north star is one memory "across every tool on the site that forms
       groups". Should a pair made in Lab Groups count in the Group Generator, and a role held in one count
       in another? Assumed: no; each tool keeps its own memory per class, as today, and 007's and 087's quick
       groups remember nothing.
    3. *Should Lab Groups and Novel Circles start remembering who worked with whom?* It is new student data
       in two tools that hold only role memory today. Assumed: not in P2's ports; the engine can.
    4. *A grouping that is reshuffled away.* Today every press of Make Groups or Reshuffle counts as "these
       students worked together", including the four a teacher rejects before the one they use; Undo takes
       back one. Should only the grouping that is kept count, and what marks it as kept (printing, a button)?
       Assumed: today's rule.
    5. *"Groups of 4" with 30 students.* Eight groups (six of 4, two of 3: never over the size, 002 today) or
       seven (two of 5: never under)? With floaters: seven groups of 4 and 2 floaters (the fix), where today
       gives eight groups of 3 and 6 floaters? Assumed: never over, and the fix.
    6. *Should every tool that makes groups read "students per group" the same way?* 002, 022 and 027 round
       the count up; 087's widget rounds to the nearest. Assumed: each keeps its rule through P2.
    7. *Balance against no repeats.* When "Balanced by skill" and "nobody with last time's partner" cannot
       both hold, which gives way? Today the repeat rule wins without saying so (measured above). Assumed for
       `keepStrategy`: the strategy the teacher picked wins, and the result says which repeats it kept.
    8. *Keep-together.* Is a keep-together pair a promise (the pair moves as one block, and a chain of pairs
       is one block) or a preference? When a keep-apart and a keep-together cannot both hold, which is broken
       first? Assumed: a block once `together: 'units'` is turned on, and today's equal weight until then.
    9. *How long a student's history is kept.* Today the Group Generator drops every pair of a student the
       moment they are off the list at the next shuffle (loading another class into the same saved class
       empties the memory), and the two role tools keep a departed name's roles for good. Should a departed
       student's history wait some number of groupings, and is that a setting a teacher sees? Assumed: each
       tool's rule today.
    10. *Other things to balance on.* The engine can spread any teacher-set category evenly (`spread`). Is
        there one he wants offered beyond skill, and may a tool store it? Assumed: none is offered; the option
        exists for the suite only until he names one.
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
  tool can use them. **The math shipped in Path 7 P4's first increment (AI-13, v243):
  `ExportKit.booklet()`, `nUp()`, `cutMarks()` and `toPdf(pages, { impose })` in
  `_shared/export.js`. 011's controls and their suite shipped in its fourth (AI-13, v248): a
  "Booklet & Pages per Sheet" card (booklet; 2, 4, 6 or 9 pages to a side; either flip edge; cut
  marks; creep), `npm run test:image-to-pdf-impose`. Do not build it again. What is left of this
  phase is the paper: the 16-page booklet under Verification has not been printed or folded.**
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
working camera). Since #320 each printed station code carries only its own station (no
images; the picture prints on the card), so a code's size no longer grows with the room.

**Phases.**

- **P1 — One station schema (Fable).** Design the shared station/room/hunt model
  that both tools can read (`{stations[{id, prompt, answers[], digitLength,
  branches: byAnswer, media}], teams, timing, hints}`), with a migration from each
  tool's current shape and explicit, stable station ids that survive reordering so
  a reprint doesn't invalidate codes already taped to the wall. *Fable for merging
  two divergent models without losing either tool's behavior.*
- **P2 — Both tools on the schema**, plus the payload budget from Path 6 (Share
  sheet) on each station's own code (one station per code since #320) and a printed
  short-code fallback typed into `lock.html`.
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

### Path 21 — Blender-rendered art: one pipeline, one style, offline-sized

**Why.** Devon's instruction, 2026-09-25: Blender-rendered art is the new top priority, and
**he ranked these rows first himself**. Re-ranking is normally not a session's call, and
neither is anything student-facing; he authorized both for this path, and `HISTORY.md` records
that ("Path 21 ranked first", 2026-09-25). Today the site has no illustration at all. Every
visual is hand-drawn inline SVG or CSS: the landing page's rows have no icons, 83 of the 86
tool pages carry a one-off data-URI SVG favicon (029, 031 and 044 have none), and the only
raster art is the four PWA icons in `assets/icons/` and the two Playwright screenshots in
`assets/screenshots/`. Where a tool needs a picture it draws one on a canvas (080's pieces,
042's `.cert-seal`, which is a glyph at 2.6rem) or asks the teacher to upload one (071).

**Where it runs. This constraint shapes every phase.** Blender runs **only on Devon's own
machines, headless**: `blender -b -P <script>.py -- <args>`. It never runs in a
container. Two machines, split by what the row needs (Devon, 2026-09-29):

- **Basic headless Blender: huginn or the Windows machine.** huginn is Devon's Linux box,
  Blender 5.2.2 LTS on PATH, Cycles on the CPU only (no HIP), 14 GB of RAM with little swap
  free: render with `-t 4`, one render at a time. **Every Path 21 row today is basic**,
  because the pipeline renders Cycles on the CPU by design (GPU and CPU differ) at icon and
  thumbnail sizes.
- **The full feature set on a real GPU: the Windows machine only.** A row that needs it
  (GPU Cycles, a large lit scene, anything huginn would run out of memory on) **says
  "Windows machine only" in its row**, and a session on huginn skips it even though
  `blender --version` works there. None does yet.

Lit rasters differ by a few levels in 255 between the two machines, so every file of one
entry renders on one machine, and the PR names it.

A cloud session has no Blender, and none is to be installed, downloaded or vendored:
the binary is ~300 MB and is a tool, not a site file. So:

- **Every Path 21 row needs Blender locally. A session without `blender` on PATH skips it.**
  Check with `blender --version`, or `Get-Command blender` in PowerShell. Skipping means you
  do not claim the row and do not edit it; take the next unclaimed row that is not Path 21.
  With rank 1 Path 21, **a cloud session starts at rank 2.**
- What CI and cloud sessions *can* do is validate what a local session committed. The
  validator (P1) is pure Node, reads only committed files, and never calls Blender.
- **Blender itself is pinned.** P1 pins one **LTS** release (4.5 LTS unless Devon's machine
  has a different LTS installed; pin what is installed, record it, and never pin a non-LTS).
  Every scene script checks `bpy.app.version` and exits non-zero on a mismatch, and every
  output records the version that made it. Moving to a new LTS is its own increment: it
  re-renders everything, and the hash diffs show what moved.

**Where the generator lives (decided 2026-09-25, reversible; the reasoning is in `HISTORY.md`).**
A new folder, `Tools/blender-art/`, **not** `Tools/board-check/`:

1. `select-suites.mjs` rule 1 makes any `Tools/board-check/` edit site-wide, so every icon
   increment would pay the full ~32-minute CI run. A `Tools/<folder>/` edit runs only that
   folder's suites and the pages that import from it, which is none.
2. There is precedent for a folder under `Tools/` that is not a tool: `Tools/a11y-sweep/` and
   `Tools/theme/`.
3. Python scene scripts are not site tooling in the sense `board-check` means, which is
   Node guards over the tree.

Contents, set up by P1: the scene template and one scene script per art family (`.py`); a
`renders.json` ledger; the validator (`.mjs`) and its pure-Node test under `test/`; and a
README recording the pinned Blender version, any add-on or extension and its version, and the
exact command lines. **Outputs do not live there.** Site-level art (icons, hero) goes in
`assets/art/`, next to the existing `assets/icons/`. Per-tool art goes in the tool's own
subfolder, `Tools/<tool-folder>/art/`, per `CLAUDE.md`'s layout. `Tools/blender-art/` is never
linked by a page and never precached, the same rule `package.json` follows. It also has to go
into `make-offline-copy.mjs`'s `EXCLUDED_PREFIXES`, because the offline zip must not ship `.py`
files or the ledger. **`.blend` files are not committed.** A scene is built from its script,
which is the only way "seeded and pinned" means anything; a binary `.blend` can be neither
reviewed nor diffed.

**Phases.**

- **P1 — The pipeline: scene template, palette, determinism, formats, validator** — **shipped
  in #263, v184.** As built: the pin is the **5.2** LTS line (Devon's Steam install, not on PATH);
  the Freestyle SVG Exporter is **not bundled** with 5.2.2, so icons use the fallback line
  exporter in `art_common.py`; three renders of each entry were byte-identical; the guard is
  `check:art`. `Tools/blender-art/README.md` and `HISTORY.md` have the rest. The spec below is
  kept as the record of what P1 was held to.
  - *Scene template.* One camera per art family, fixed and named in the script (icons: an
    orthographic three-quarter view at 48×48; hero: true isometric orthographic; top-down
    orthographic for 080's pieces and 046's relief). One fixed light rig (key, fill and a sun
    at a stated azimuth and elevation, the same in every family so the site reads as lit from
    one side), and one world colour.
  - *Palette tied to `_shared/ink-paper.css`.* The scene script **parses the CSS at render
    time**: the `--token: #hex` pairs in `:root` for light and in the `[data-theme="dark"]`
    block for dark, turned into linear-space material colours. There is no second copy of
    the palette to drift. Materials are named for the token they use (`mat.--ink`,
    `mat.--card`). A colour that is not a token is a validator failure unless its
    `renders.json` entry says why. Read `ink-paper.css`'s header first; its dark block is
    gated, and the parser has to take the dark values from the right selector.
  - *Dark-mode variant.* A raster that appears on screen ships as a `-light`/`-dark` pair,
    rendered from the same scene with the dark token set and the dark world colour. The page
    picks between them with CSS off `[data-theme="dark"]`, which `a11y.js` owns, and never by
    writing the attribute itself. **SVG icons need no pair.** They are drawn in
    `currentColor`, so the theme switch is free. Print-only art (042's seals) is light-only.
    Content pictures (071) get no dark variant, the same as a teacher's uploaded photo; only
    the frame around them follows the theme.
  - *Determinism.* Cycles on **CPU** (GPU and CPU differ), `scene.cycles.seed` fixed from the
    entry's seed, `use_animated_seed` off, a fixed sample count, and the OIDN denoiser on
    CPU. Any procedural placement uses Python's `random.Random(seed)`, never the module-level
    generator, and nothing is taken from the clock. **The P1 acceptance test is to render the
    same entry twice and compare hashes.** Write down whether the result was byte-identical,
    and if it was not, what varied. That is exactly the kind of line `CLAUDE.md` asks for.
    The ledger's hash is of the committed file, so the guard checks that the ledger matches
    the tree. It does not promise that a re-render reproduces the file on another machine.
  - *Output formats.* **Icons: SVG** from Blender's Freestyle line renderer, via the
    Freestyle SVG Exporter. Blender 4.2 moved the bundled add-ons onto the Extensions
    platform, so confirm whether the pinned version still bundles it or it has to be
    installed as an extension. Pin its version either way, and do **not** commit it; it is a
    local tool, not a site file. The script post-processes the SVG: simplify each polyline,
    round coordinates to one decimal, strip metadata, set `stroke="currentColor"`, drop fills,
    and write LF line endings explicitly, so a Windows checkout does not change the hash (hash
    with `tr -d '\r'` when comparing, per `CLAUDE.md`). If Freestyle's output cannot meet the
    cap, the fallback is a small exporter in the scene script that projects silhouette and
    crease edges through `bpy_extras.object_utils.world_to_camera_view`. **Renders: WebP**,
    written by Blender itself (it has had WebP output since 3.x), so no encoder is vendored
    and nothing lands outside `_shared/vendor/`. Lossy at quality ~80, or lossless with alpha
    where an edge must stay crisp. **PNG only where a consumer cannot take WebP**:
    `manifest.json` icons and shortcut icons, and any path that goes through jsPDF if it
    turns out not to accept WebP (check the vendored build before assuming either way).
  - *Size caps.* Every entry in `renders.json` carries a byte cap and pixel dimensions, and
    each family carries a total. **The path's total budget is 2 MB** of new precache, against
    **11.24 MB** precached today, of which **2.68 MB** is the install-time `SHELL_URLS` tier
    (measured 2026-09-25 by summing the files each list names). **The shell tier takes at most
    250 KB of it**: the icon sprite and the hero, because the landing page is shell. Per-row
    caps are in each row below. A cap is raised in the ledger, in the same commit, with a
    reason, never by just editing the number.
  - *Contrast under text, measured at render time.* Axe cannot see text over a background
    image; it reports `color-contrast` as incomplete. So an entry that will have text drawn
    over it declares the text region and the text token. The scene script samples that region
    of the finished render (`bpy.data.images`' pixels) and records its minimum and maximum
    relative luminance in the ledger, and the validator asserts **4.5:1** against the text
    token in **both** themes. Large text is 3:1, and only when the entry says the text is
    large. That keeps the check static and CI-runnable.
  - *The ledger, `renders.json`.* For each output: its path, scene script, seed, Blender
    version, SHA-256, bytes, cap, dimensions, theme (`light`/`dark`/`both` for `currentColor`
    SVG), whether it is decorative, and the under-text luminance record where one applies.
  - *The validator.* A read-only `.mjs` in `Tools/blender-art/`. It **exits non-zero** on any
    of these: an output in the ledger that is missing, over its cap, or whose hash does not
    match; an art file under `assets/art/` or any `Tools/*/art/` that the ledger does not list
    (an orphan); a ledger entry whose Blender version is not the pinned one; an on-screen
    raster with no dark twin; an SVG icon carrying a literal colour, a fill or an embedded
    raster; an `<img>` in a live page pointing at an art file with no `alt` attribute (a
    decorative entry needs `alt=""`, a meaningful one needs non-empty text); and an under-text
    entry below its contrast floor. It does not duplicate `check:precache`, which already fails
    a referenced file missing from `PRECACHE_URLS`. **Break it on purpose once** before trusting
    it: commit nothing, but corrupt one output's bytes locally (or lower one cap below its file)
    and show the non-zero exit and its message in `HISTORY.md`. Then wire it the way the other
    twelve guards are wired: a `check:` script in `package.json`; a step in
    `.github/workflows/ci.yml`; a line in `CLAUDE.md`'s guard list and in step 3 of this file's
    definition of done; the header's guard count, 12 → 13; and its pure-Node test in
    `suites.json` with a `test:<name>` shortcut, which `check:tests` enforces. **Two things
    will bite.** `eslint.config.js` lints `Tools/*/*.mjs` as a *browser* file (its line-110
    block), so a Node validator there fails `no-undef` on `process` until its path is added to
    the Node block. And do not write the new command's `npm run` name into any `.md` until the
    script is committed, because `check:docs-commands` fails the citation.
  - *A first real output*, so the pipeline is proven end to end rather than in the abstract:
    one icon (007 Name Picker) and one small render pair (a 256-px test tile), committed,
    ledgered, precached with a `CACHE_VERSION` bump, and not yet linked from any page. Linking
    is P2's job, which keeps P1 one session.
- **P2 — 86 tool icons in one style, and the app mark. SHIPPED** (#265–#296 and #306, v185–v205). **Increment 1
  shipped in #265, v185:** the ten shell icons, the sprite, the landing rows and the shortcut
  PNGs, all as specified below. Three calls went beyond the spec: the landing size is a fixed
  32 px with a 2.25 stroke; the sprite is a *derived* ledger entry that `check:art` rebuilds;
  and shortcut icons are `use: "manifest"`. The offline zip needed the sprite inlined.
  `HISTORY.md` has the detail. **Increment 2 shipped in #267, v186:** 003, 009 and 011–027,
  plus new modelling primitives (`prism`, `rounded`, `tube_arc` and others). 29 of 86 were
  done then. **Increment 3 shipped in #286, v195:** 028–031, 033–043 and 045–048, no new
  primitives. **Increment 4 shipped in #288, v196:** 049–067, one new primitive (`dome`).
  **Increment 5 shipped in #296, v200:** 068–087, no new primitives. **The set is complete,
  87 of 87** (087 Class Screen was added to the site after this spec said 86). **The app mark
  shipped in #306, v205**, which finished P2: swapped, not kept. It is a dog-eared page with "A+"
  circled by `index.html`'s red-pen `.grade` path, in `--ink` and `--err`. The maskable pair sits
  inside the safe zone, and `check:art`'s SAFE rule enforces that. The per-page favicons stay,
  because the mark does not hold at 16 px. `Tools/blender-art/README.md` has the detail.
  - *The open call, decided here (reversible; recorded in `HISTORY.md`).* There is **no
    existing per-tool icon set to replace**; the landing rows have none. So the Blender set is
    **added**, and it replaces exactly two things. First, the generic `assets/icons/icon-192.png`
    on `manifest.json`'s four shortcuts (007, 004, 005, 010), which each get their own tool's
    icon as a **96×96 PNG** from the same scene, since shortcut icons are the one place the
    platform wants raster. Second, nothing else until the last increment. **Kept on
    purpose:** the per-page data-URI favicons (zero bytes, zero requests, and each tab's
    identity; revisit only once the set has been seen at 16 px), and the PWA app icon in
    `assets/icons/`. The final increment re-renders that app mark in the new style and swaps
    it only if it stays legible inside the maskable safe zone at 48 px. Otherwise it keeps the
    current mark, and says so.
  - *How `index.html` picks them up.* One sprite, `assets/art/icons/tools.svg`, with one
    `<symbol id="t007">` per tool. Each landing row gets
    `<svg class="tool-icon" aria-hidden="true"><use href="assets/art/icons/tools.svg#t007"/></svg>`.
    It is decorative, because the tool's name is the row's own text, and it is `currentColor`,
    so dark mode costs nothing. The sprite goes in `PRECACHE_URLS` **and** `SHELL_URLS`.
    **Test the offline zip before trusting this.** Chrome treats an external `<use>` under
    `file://` as cross-origin and may draw nothing. If it does, `make-offline-copy.mjs` inlines
    the sprite into its staged `index.html`, and `verify-offline-copy.mjs` gets an assertion
    that the icons render. Rank 100's data-driven `index.html` would later generate these
    rows; until then they are hand-written, like the rest of the row.
  - *Increments.* The first increment is the style: the ten shell tools' icons (001, 002, 004,
    005, 006, 007, 008, 010, 032, 044), the sprite, the `index.html` wiring and the four
    shortcut PNGs. Then about 19 per increment in tool-number order, which is four more
    increments. Leave the row in place with its text rewritten after each.
  - *Caps.* **≤ 1.4 KB per icon** after post-processing, and the **sprite ≤ 120 KB** for all
    86. Shortcut PNGs **≤ 4 KB** each. Strokes must stay at least 1.5 px at the landing page's
    display size; check at 1× and at the smallest size the page ever draws.
  - *a11y.* Decorative (`aria-hidden`, no title in the symbol) on the landing rows. Where an
    icon ever stands alone as a control, the control carries the name, not the icon. Icons
    are ink on paper in `currentColor`, so contrast is the text's contrast. Nothing to allowlist.
- **P3 — The landing-page hero, and a call on the manifest screenshots. SHIPPED** (#308, v206):
  `assets/art/hero/classroom-{1x,2x}-{light,dark}.webp`, 64,832 B, transparent background, beside the
  heading and hidden under 760 px; `landing-wide.png` regenerated. `HISTORY.md` has the calls. The
  spec below is kept as the record of what P3 was held to.
  - *Hero.* An isometric classroom diorama (desks, board, a window, a clock, a few of the
    tools' objects in the room), from the P1 rig in the ink-paper palette. It ships as WebP at
    1× and 2× widths, each as a light/dark pair: four files, `srcset` for density and CSS off
    `[data-theme="dark"]` for theme, with `width`/`height` set so nothing shifts on load.
    **Caps: 2× ≤ 45 KB, 1× ≤ 18 KB, all four ≤ 130 KB**, all in `SHELL_URLS`.
  - *a11y.* The hero is decorative (`alt=""`). **No text sits on it**; the heading stays on
    the page's own `--paper`, which removes the contrast problem instead of measuring it. If a
    later design wants text over it, that is a P1 under-text entry with its luminance recorded.
    Respect `prefers-reduced-motion` if anything about it ever animates; nothing is planned to.
  - *Manifest screenshots: decided, **not** renders.* The install sheet shows them as what the
    app *is*, and a render of a classroom would misrepresent a list of tools. They stay
    Playwright captures from `make-manifest-screenshots.mjs`. Regenerate them after the hero
    lands, since `landing-wide.png` will then show it; that is the "visible redesign" case
    `CLAUDE.md` already names.
- **P4 — Per-tool art** (**finished**: 080, 071, 042 and 030 shipped in #311, #313, #315 and #317, and 046's relief under AI-03 on 2026-10-01; one row per tool, in the order Devon listed them).
  Everything here is precached in `PRECACHE_URLS` only, since none of these five tools is a
  shell tool, and every page touched gets `test:a11y -- --only <nnn>` and its own suites.
  - **080 Virtual Manipulatives: rendered pieces. SHIPPED in #311, v207**, as one light atlas (`use: "sheet"`:
    the board is a `.paper-sheet`), with no thousand-cube; `HISTORY.md` has the calls. The spec below is the record.
    Base-ten blocks (unit, rod, flat, cube),
    algebra tiles (1, x, x² and their negatives), fraction bars (1 through 1⁄12), pattern
    blocks (the six standard shapes) and dice (a d6 first). The last two are new piece
    families; today 080 draws the first three on a canvas. Top-down orthographic renders
    into one sprite atlas per theme, drawn with `drawImage` at integer scale so they tile on
    080's grid. *a11y:* a piece's name and value are already its accessible description, so
    keep that and make sure the renders do not replace it. **Colour is never the only
    carrier:** a negative algebra tile needs a visible "−" or a pattern, not just red, and
    the fraction bars carry their label. The renders must pass the colour-blind simulation
    the Blender script can do on its own output (grey-convert and check that the families
    stay distinct). **Cap: ≤ 250 KB** for both atlases. Existing rank 161 (snap-to-grid,
    data-driven piece families) is the natural next step; do not fold it in.
  - **071 Picture-prompt starter set. SHIPPED in #313, v208**: twelve scenes (a café, a library, a party,
    a bedroom and a farm joined the six named below), on until the teacher has pictures of their own.
    (Student-facing, **authorized by Devon 2026-09-25**.)
    A starter library of scenes (a market, a kitchen, a park, a classroom, a bus stop, a
    doctor's office and so on) to sit beside the existing text-only starter prompt sets, so
    the tool is usable before a teacher uploads anything. **There is no text in the images**:
    the prompts are in the target language and the pictures serve every language. They are
    site files referenced by path and never copied into the teacher's storage, so "Restore
    starter prompts" still works and backups do not grow. *a11y:* every image gets real
    `alt` text describing the scene, in the page's language; this is content, not
    decoration. Each must print legibly in greyscale. **Caps: 12 images, ≤ 40 KB each,
    ≤ 480 KB total**, light-only (content pictures; see P1).
  - **042 Certificate seals and ribbons. SHIPPED in #315, v209**: six seals, four ribbons, bottom centre.
    A small set of foil seals and ribbons to replace
    the glyph `.cert-seal` and to give the existing `ribbon` theme a real ribbon.
    **No text is baked into a seal**, because names and award titles change. *a11y:*
    decorative (`alt=""`); the certificate's own text carries the meaning. Any text placed
    over a seal is an under-text ledger entry. *Print:* these are printed, so they are
    light-only and ink-conscious (no heavy dark plate); confirm the tool's print and PDF path
    takes WebP before choosing it over PNG. **Cap: ≤ 120 KB** for about six seals and four
    ribbons.
  - **030 Review-game art. SHIPPED in #317, v210**: one set (`use: "sheet"`), 9-slice tiles.
    A board backdrop, category header tiles and point-value tiles,
    projected. Text is always drawn over these, so **every tile is an under-text entry with
    its luminance recorded and 4.5:1 asserted in both themes.** That is the whole reason P1
    measures it. Keep the tiles quiet; this is a projected board read from the back of the
    room. **Cap: ≤ 200 KB** for both themes.
  - **046 Relief heightmap.** A shaded-relief layer rendered in Blender from a public-domain
    elevation model (displacement from the heightmap, lit by the P1 sun so it matches
    everything else), drawn **under** 046's base map as an optional layer. It is **off by
    default and disabled in choropleth mode**, where relief behind data colours would read as
    data. The DEM input is **not committed**; the README records its source URL, licence and
    SHA-256, and only the output enters the repo. It must match the projection and extent of
    the bundled base map it sits under, so start with 046's default world base and treat
    each other projection as its own entry. *a11y:* render with a capped luminance range so
    046's label ink holds 4.5:1 everywhere over it (an under-text entry covering the whole
    image), and make sure the layer toggle has an accessible name. **Cap: ≤ 400 KB** for a
    2048-px-wide light/dark pair. Relation to Path 20: the relief stays a raster even after
    P3's live vector viewer; its zoom ceiling is the render width, and the row says so rather
    than chasing it.
    **Shipped under AI-03 (2026-10-01, `CACHE_VERSION` v213):** world only, one light file
    (`use: "sheet"`: 046's viewer is a `.paper-sheet`, so a dark twin would never be shown),
    29,726 B; see `HISTORY.md`.

**Model.** Opus. These rows are judgement about style, bytes and legibility, not algorithmic
risk.

**Verification.** Every increment runs the art validator with its non-zero case shown once
(P1), and runs `check:precache -- --base origin/main` for the `CACHE_VERSION` bump,
`check:dedupe`, `check:docs-commands`, `lint`, and `test:a11y -- --only <nnn>` on every page
it touches. It checks both themes by eye in a real browser and records in `HISTORY.md` what was
not checked. Browser suites on Devon's machine run under the pinned Playwright's own Chromium.
If `npx playwright install chromium` cannot reach its host, set `PW_CHROMIUM_EXECUTABLE` to a
local Chrome, per `CLAUDE.md`. CI remains the authority.

**Decisions.** Recorded in `HISTORY.md` under "Path 21 ranked first" (2026-09-25): the
generator folder, the palette read from the CSS, `currentColor` SVG icons as a sprite,
WebP for renders, the icon-set call, screenshots staying Playwright, and the byte budgets.
Each is cheap to reverse before P2's second increment and expensive after it.

### Path 22 — Class Screen: a widget board for the projector

**Why.** Devon asked for it on 2026-09-25: a page that works like ClassroomScreen — widgets
placed anywhere on a projected board, saved screens, timers, text boxes — built the way
this site builds everything else. **He made four scope calls in the same conversation, and
they are not a session's to reverse:** no accounts or cloud sync; **no student voting,
on purpose**; no Google or Microsoft integration; and **YouTube is in** — the one widget
allowed to reach the network, because he asked for it. Imitating ClassroomScreen's
behaviour is fine by him. The page keeps its own name and this site's palette anyway.
He did not rank the rows, so they sit at the end of Tier 1 (183–191 now P5 has shipped and P6–P14 were added) until he does. Moving
them up is a re-rank, and that is his call.

**Why a new tool and not 010.** 010's Tier 2 "true classroom home screen" idea is close to
this, but 010 is a fixed grid of cards with two suites built around that layout, and a
free-form board is a different page. 087 starts clean. P4 and P5 then share code with 010
rather than folding one page into the other.

**Rules the path keeps.**
- **A position is a fraction of the board, never pixels**, so a screen built on a laptop
  lands in the same place on a 1080p projector.
- **YouTube is the only thing that leaves the browser.** It uses
  `youtube-nocookie.com/embed/`. Offline it shows a "needs internet" card instead of a
  broken frame, and it never blocks the rest of the board. Every other widget works offline.
- **No markup sinks.** Every widget builds its DOM with `createElement` and `textContent`,
  so text a teacher types (and later a URL) never reaches `innerHTML`.
- **Nothing student-facing beyond what the teacher projects.** No student devices, per
  Devon's call above and the standing Path 8 decision.

- **P1 — shipped in #269 (v187).** The board and the first widgets. Drag by the title bar, resize from the corner,
  arrow keys to move and Shift+arrows to resize, click to bring to front. Named screens are
  saved automatically in one Store key. Fullscreen via `stage.js`. Widgets: text, timer,
  stopwatch, clock, YouTube, traffic light, name picker (shared roster), dice.
- **P2 — shipped in #272 (v188).** Work symbols, a noise meter (Web Audio; the microphone
  starts only on Start and never leaves the page), a drawing pad widget (not a board-wide
  layer), pictures (`media-db.js`, namespace `class-screen`), QR (`qr-draw.js`), a group maker,
  and a background per screen. The frame class is now `wt-<type>`.
- **P3 — shipped in #274 (v189).** Link a screen to one of 010's bell periods, and "Follow
  the bell" switches the board when that period starts. Six starter screens. Export and import
  of one screen as `.json`, pictures included. The screen actions moved into a More menu.
- **P4 — shipped in #276 (v190).** `Tools/class-screen/remote.html` and `cs-remote.js`. A phone
  paired over `webrtc-pair.js` switches screens and runs the timer, stopwatch, name picker,
  groups, dice, light and symbol. Commands are checked by `ClassScreenCore.readCommand`.
- **P5 — shipped in #278 (v191).** `_shared/countdown.js`. 087's timer widget and 010's
  Timer panel run on it; 004 shares its formatter only. P13 moves 004's phase engine onto it.

**P6–P14 were proposed by session `t4ktn1` on 2026-09-26** from a brainstorm Devon asked for.
He asked for them to be added at the end of the list, so they are ranks 160–168 and are not
ranked against anything else. Moving them up is a re-rank, which is his call.
- **P6 — present mode and spotlight.** A lock toggle for the projector: no dragging, no close
  buttons, the dock and header hidden, so a tap on a smartboard cannot move a widget.
  Double-clicking a widget fills the board with it; Esc goes back.
- **P7 — shortcuts.** Space starts or pauses the topmost timer, N picks a name, ←/→ switch
  screens, and `?` shows the list. A presentation clicker sends ←/→ and PageUp/PageDown, so it
  can then run the board. Keys go through `Stage.isTyping` so text boxes still type.
- **P8 — linked widgets.** When a timer ends, it can also flash the board, set the traffic
  light, or tick the next agenda item (P9). The link is per timer, chosen in its foot.
- **P9 — more widgets.**
  - An agenda checklist ("Today we will…", ticked off as the lesson goes).
  - A visual timer (a shrinking pie, which reads from the back of the room and helps younger
    students and IEP accommodations).
  - A sequence timer (Think 1:00 → Pair 2:00 → Share 3:00, each step labelled), which should
    run on `countdown.js`.
  - A countdown to the bell, from 010's schedule.
  - A team points scoreboard (projector-only, so not voting).
  - A spinner wheel for any list.
- **P10 — two tabs and memory.** Last writer wins across tabs today (P1's `HISTORY.md` entry).
  At least warn "this screen is open in another tab", or reload on `storage`. The name picker's
  "no repeats" resets on reload; keeping it for the browser session only (`sessionStorage`)
  still saves no student data. Undo covers removals only; moves and resizes should undo too.
- **P11 — layout comforts.** Snap to grid or alignment guides, minimize a widget to a chip, a
  colour per widget (tokens only), screen thumbnails in the switcher, and a large-text,
  high-contrast projector theme.
- **P12 — another site tool as a widget.** A same-origin frame of another tool (024 Number
  Talks, 080 Manipulatives), precached so it works offline. It needs a design for sizing, and
  a list of which tools behave inside a frame.
- **P13 — 004 onto `countdown.js`.** Move 004's phase engine off `phase.endAt` and
  `remainingAtPause` onto a `Countdown` state, keeping 004's display and its mirror and remote
  suites green. P5 left this for its own PR on purpose.
- **P14 — one remote wrapper.** `cs-remote.js` is a classic-script copy of `cc-remote.js`'s
  channel plumbing. Move both onto one `_shared/` file, and 004's `ct-mirror.js` too if it fits.

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
- **The recurring "not verified" list, as one checklist** (added 2026-09-23 after a repo
  review found the same five items in every P3 handoff since #231). About 30 minutes with a
  phone, a laptop and a printer; record each result in `HISTORY.md`:
  1. Open any share-sheet tool (e.g. 002), make a QR, and **scan it with a real phone camera**.
     Does the link open the tool with the state?
  2. Use the sheet's **system-share row** on a phone. It is exercised by no suite.
  3. **Download** a share `.json`, then re-open it in the same tool on another device.
  4. **Pair a phone** with 006 or 010 through `_shared/webrtc-pair.js`, by scanning both codes
     (the board's with the phone, the phone's reply with the board's camera). Until v223 the
     codes were 2 to 3 px per module and should not have scanned; AI-10 redrew them at 4 px or
     more and cut the payload to about a third. This is the check that says whether that
     worked. Note the phone, the browser on each side, and the distance. If a reply shows "too
     narrow" instead of a code, note the phone's width and how many `k` lines the text has
     (one per network interface). A Firefox or Safari on either side is worth a second try:
     only Chromium's codes have been seen.
  5. **Print** 034 and one card tool on a real printer **from dark mode**.
  6. On an iPad (Safari) and in Firefox, save something in a tool and reload a few seconds
     later: Safari should grant persistent storage silently, and Firefox should ask once.
     `navigator.storage.persisted()` in the console reads the answer.

The first two are ~15 minutes of a person's time, and both are the kind of thing that works in every
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

- ~~`assets/js/gvb-save.js` (save bar + storage probe) is shared code living outside
  `_shared/`, contra `CLAUDE.md`.~~ **Moved to `_shared/gvb-save.js` in #193**, which also
  emptied `assets/js/`. Its consumers are `005` and `007`'s `np-store.js`; the bullet used to
  name `064`'s `htcm-store.js` as a third, and that was wrong — it imports nothing from it.
- ~~`Tools/schedule/README.md` still documents `Tools/schedule/libs/jspdf/`.~~ **Fixed in
  #187**, in passing, while `check:docs-commands` was fixing that file's two dead `npm run`
  citations. The tree diagram now names `_shared/vendor/jspdf/`, which is where 035 actually
  loads it from. Nothing guards a path in a tree diagram — see the note about the 318 bare
  backticked paths above.
- ~~`Tools/009-backup-restore.html`'s `IDB_NOTES` knows only `bmg-maps`; `rgb-audio` and
  `stviz-recovery` are unlabeled in backups, and Firefox backups silently omit all IndexedDB
  content.~~ **Fixed in two steps.** Path 4 P2 (#174) replaced `IDB_NOTES` with the registry's
  `idb` rows and made 009 open the declared databases, which is what covers Firefox. It gave
  the two rows no `note`, though, so 009 still showed them as a bare name; AI-16 (2026-10-05,
  v240) wrote the notes, and `registry-shape.test.mjs` now fails on a database without one.
- **Fixed since the survey, recorded so they are not re-reported:** the `v1`–`v4`
  landing chain, `scg-photo.js`, `ideas-backlog.html` and both maskable icons are now
  precached; the `_ds` Google Fonts `@import` is vendored to `_shared/vendor/barlow/`;
  the entity-in-a-JS-string bug, the `hidden`-loses-to-`display:flex` bug and the
  fixed-height print clip each have a guard (`check:entities`, `check:hidden-flex`,
  `check:print-clip`).

#### Threads left open across rounds

From the retired the retired round tracker. Its allowlist figures (59 pages, 91 pairs)
are the 2026-09-03 baseline and have since dropped to **none**: the last 14 `color-contrast`
lines went in AI-07 (v215), and the `select-name`, `label`, title-only-label and
`aria-required-children` classes it lists below had gone before that; the rest stands.

Not a queue, and not a reason to re-open a finished tool — but if one of these
lands naturally inside a tool you are already working on, take it.

- **The accessibility baseline.** `Tools/a11y-sweep/allowlist.json` (Path 2
  P3, 2026-09-03) records every serious/critical axe-core finding on first
  load, per page and rule: 59 pages, 91 pairs — 41 unlabeled `<select>`s
  (`select-name`), 23 unlabeled inputs (`label`), 21 contrast failures on
  muted text, 5 title-only labels, 1 `aria-required-children`. **All of it is fixed** and the
  list is empty (AI-07). A new tool comes in clean; a new finding is fixed, not listed.
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

- **Done — restore preview / diff.** The preview counts records replaced, added,
  untouched, and those Replace would remove, per mode (`smoke-restore-diff.mjs`).

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
- *Decided (v216): yes, optional and off by default.* An encrypted backup exists
  (Path 4 P5); the year-end archive is never locked, because a passphrase forgotten
  over the summer would lose the year.

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
- ~~A visual branching-tree view~~ **Shipped 2026-10-05 (v246):** a "Tree view" card drawn from the same
  `state.steps`, and an opt-in one-page print after the worksheet. See `HISTORY.md`.
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

- ~~Is a visual tree view worth the layout complexity?~~ Answered by ranking it and building it: nested
  lists with CSS connectors, no computed positions.
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
  visual tree-view print layout are both pure print-format additions (the tree print shipped, v246).
- **P15 (first run)** — the seeded 2-step working example (already
  shipped) is the main first-run aid; validation warnings would extend
  that help through the whole authoring process, not just the starting
  point.

### 058 — Duty Roster Builder

*`Tools/058-duty-roster-builder.html`.*

**Shipped (v247, AI-31-058).** Multi-week rotation: week 1 is the grid the tool always had; weeks
2 to N (1 to 6, default 4) are derived from the week before by moving everyone down one duty (the last
duty wraps to the first, day by day, rows in the order shown) and stay derived until the teacher edits a
cell in that week. A hand edit is pinned (marked "edited by hand" in words and to a screen reader), carries
into the weeks after it by the rotation, and is kept when week 1 changes; "Reset this week to the rotation"
and putting back the derived value release it. Print this week and Print the month (one headed table per
week, never split across a page). Saved in the same `drb_roster_v1` key (`weeks`, `weekOverrides`); an old
roster is week 1; share links carry both. Suite `test:duty-roster`. Not checked on paper.

#### Quick Wins

- **Per-staff assignment counts** shown somewhere (e.g. next to the staff
  textarea or as a small summary row) so a teacher can see at a glance
  whether the round-robin (or manual edits afterward) left the load
  balanced — round robin distributes evenly by construction, but any manual
  edit afterward can silently unbalance it with no visibility.
- **"Skip a person this week" flag** per staff member (e.g. someone's out,
  or on a different duty schedule) so auto-fill respects it instead of
  needing every assignment fixed by hand afterward.
- **CSV export** for handing the schedule to an administrator who wants it
  outside a browser.

#### Major Features

- **Duty-location constraints** ("this duty needs 2 people," "this person
  can't do bus loop") — the current model is one person per cell, which
  doesn't match every real duty roster (some locations need multiple staff
  covering at once).
- **Multiple named saved rosters** (e.g. "Fall semester" vs "Spring
  semester," or separate rosters per grade-level team), matching the
  multi-save convention used elsewhere in this toolkit.

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
- ~~**Individual student report cards**~~ — shipped (v251, 2026-10-05): see
  `HISTORY.md`. A "Report cards" card prints one page per student (one chosen,
  or everyone); there is still no min, max, rank or trend on it.

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
- Report cards were built in this tool, on `#printArea` and the page's own
  table styles (decided 2026-10-05, no shared pattern exists to reuse). If a
  second data-collecting tool wants one, lift `buildCardHtml()` into
  `print-kit` then; nothing here is stored, so moving it costs nothing.

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

