# HISTORY — what already shipped

Condensed from the planning documents retired on 2026-09-03. This file exists for two
reasons: `CLAUDE.md` cites past decisions and they need somewhere to be true, and the
"what we got wrong" notes have consistently been the most useful prose in this repo.

**Nothing open lives here.** Open work is in `BACKLOG.md`. If you find yourself wanting
to add a to-do to this file, it belongs there instead.

---

## Stage 2 — the platform foundation (2026-09-03, in progress)

Two of the fourteen planned phases have shipped. The plan itself — four `_shared/`
services in dependency order, so that the tool paths become adoption rounds rather than
invention — survives as the ordering of `BACKLOG.md`'s first ten ranks.

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
