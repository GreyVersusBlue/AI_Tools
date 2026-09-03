# Handoff — Stage 2: the platform foundation

*Written 2026-09-03 after PR #165. For whoever runs the next stage of
`UPGRADE_PATHS.md`, human or model. Read `CLAUDE.md` first, this second,
then the path section you are about to work.*

> **A1 has since shipped (#167).** This file is still the Stage 2 plan and is
> still accurate except where `HANDOFF_STAGE_2_A1.md` corrects it — read that
> third. The short version: Path 5 P3 is a real rollout rather than a flag
> flip, and it is now sized and scripted (`npm run path5:next`). Nothing about
> A1 moved the Wave B/C dependency graph; **B1 is still the critical path**.

## 1. Where Stage 1 left the site

Stage 1 was the two infrastructure paths, and both are complete:

| | Shipped | What it means for Stage 2 |
|---|---|---|
| **Path 1 — Service worker** | Update bar (P1), `check:precache` (P2), two-tier precache with an offline readout (P3), manifest shortcuts / screenshots / share target (P4) | A deploy no longer swaps assets under an open tab. A first visit installs ~3.6 MB, not ~10.8. Any new file must be in `PRECACHE_URLS`; CI fails otherwise. |
| **Path 2 — CI and tests** | Runner with named expected failures (P2), GitHub Actions (P1), suite-reliability tooling (P6), axe-core sweep with a dated allowlist (P3), three sweep guards (P4), ESLint (P5) | Every pull request runs 9 guards, lint, and 124 suites (~21 min). A phase that breaks something is caught before merge, which is what makes the shared-module work below safe to attempt. |

Numbers as of main `f1d7bcb`: `CACHE_VERSION` v138, 249 precache entries
(77 in the install tier), 124 suites green, 91 accessibility allowances on
59 pages, lint clean, 86 tools, next free number 087.

Path 14 P1 (the Seating Chart phone toolbar) also shipped, in #164. It was
the only known-red assertion on the site; `expectedFailures` is empty.

## 2. What Stage 2 is

Stage 1 made changes safe. Stage 2 builds the **shared services every tool
path depends on**, so that Stage 3 (the tool paths, 9–20) is mostly
adoption rounds rather than invention. Four paths, in dependency order:

```
Path 4  Storage primitive ──► Path 4  Tool registry ──► Path 6  "Send to…" (P4)
   │                              │
   ▼                              ▼
Path 3  Roster service ──► Path 3  Identity adoption      Path 4  Media store ──► Path 3 P5 photos
                                                                                 Path 14 P2 photos

Path 5  Theme decision ──► Path 5  Stage helper ──► Path 5  Rollout       (independent of the above)
Path 6  Share sheet    ──► Path 6  Adopt in 17    ──► Path 6  Extend       (independent until P4)
```

The two arrows that matter most: **the roster service should be built on the
storage primitive, not before it** (otherwise it is the first thing to
migrate), and **"Send to…" needs the registry** (otherwise every handoff is
another ad-hoc key read, which is the debt it exists to remove).

Everything in `_shared/` is single-owner. Two sessions can run at once only
if at most one of them touches `_shared/`. That rule shapes the waves below.

## 3. The order of work

Sizes are sessions. The model column follows `UPGRADE_PATHS.md`: **Fable**
where a wrong contract is expensive to unwind; Opus for build-to-spec work;
Sonnet for batches once a pattern exists.

### Wave A — can start now, in parallel (only one touches `_shared/`)

| # | Phase | Model | Size | Touches `_shared/`? |
|---|---|---|---|---|
| ~~A1~~ | **SHIPPED (#167, `CACHE_VERSION` v139) — see `HANDOFF_STAGE_2_A1.md`.** ~~Path 5 P1 — theme architecture decision.~~ Decide that `a11y.js` owns theme, add a real `data-theme="dark"` token set to `ink-paper.css` (71 tools), fold `theme.css`'s five Industry tools into the same mechanism, archive the never-loaded `theme-toggle.js`, respect `prefers-color-scheme`. Write the decision down; do not roll it out in the same PR. | Opus | ½ | **Yes** |
| A2 | **Accessibility label round.** The 41 `select-name` and 23 `label` allowances in `Tools/a11y-sweep/allowlist.json`. One accessible name each, delete the line, `npm run test:a11y -- --only <nnn>` per page. Leave `color-contrast` for after A1. | Sonnet | 1–2 | No |
| A3 | **Live-site checks Stage 1 could not do.** After #165 deploys: confirm the app bar reaches "Offline: all 86 tools ready"; on the next deploy confirm the update bar appears and Reload takes it; if a phone or Chromebook has the toolkit installed, share a CSV into it. Record under Path 1 in `UPGRADE_PATHS.md`. | Devon | ¼ | No |

### Wave B — the two contracts, strictly in this order

| # | Phase | Model | Size | Notes |
|---|---|---|---|---|
| B1 | **Path 4 P1 — `_shared/store.js`.** Versioned envelope `{v, data}`, `migrate(fromV, data)` hook, quota errors surfaced as a visible message, `onChange` across tabs and same-tab, `estimate()`. Adopt in three tools of different key eras in the same PR. **No renames of existing keys.** | **Fable** | 1 | The migration contract — how unversioned legacy payloads are read without a flag day — is the whole decision. |
| B2 | **Path 4 P2 — `_shared/tool-registry.js` + `check-registry.mjs`.** One data file for all 86 tools: keys, prefixes, IndexedDB databases, `studentData` flag, category. Backup & Restore and Command Center read it; the new guard fails when a tool writes a key the registry does not know. | Opus | 1 | This is the change that makes backups complete by construction. Four tools' keys have already been found missing after the fact. |
| B3 | **Path 3 P1 — `_shared/roster.js`.** The `PLATFORM_PLAN.md` R1 API plus the identity layer: `getStudents()` joined from `crh_students_v1`, `resolve(nameOrId)`, `matchName(spoken, students)`. 006 is the first consumer. `np_rosters` wire shape unchanged. | **Fable** | 1 | What an id is, how renames and merges propagate, what "same kid" means across "Smith, John" and "John Smith". Six tool files name this as the debt that costs them data. |
| B4 | **Path 3 P2 — rename, merge, roster diff in 006.** "3 new, 1 left, 2 renamed — apply?"; archive rather than delete; bulk CSV/XLSX import with period-column splitting. | Fable for the merge rules, Opus for the UI | 1 | |

### Wave C — parallel again, once B1–B2 are in

| # | Phase | Model | Size | Touches `_shared/`? |
|---|---|---|---|---|
| C1 | **Path 6 P1 — `_shared/share.js` + `qr-draw.js`.** One sheet: copy link, QR with a *measured* payload budget, download `.json`, `navigator.share`. Replaces twelve `drawQR` copies. | Opus | 1 | Yes |
| C2 | **Path 5 P2 — `_shared/stage.js`.** Fullscreen/projector helper with the HUD inside the fullscreened subtree and the site-standard keys. Adopt in 023, 024, 025, 021 first. | Opus | 1 | Yes |
| C3 | **Path 4 P3 — `_shared/media-db.js`.** Extract `bmg-map-cache.js` into a generic IndexedDB blob store plus one shared `downscaleImage`. Register the database so 009 backs it up. | Opus | 1 | Yes |
| C4 | **Path 14 P2 — `_shared/seating-read.js`.** One read-only reader of `seating-chart-v1` for 010, 008, 045, replacing three copies. Photos move only after C3. | Opus | 1 | Yes |
| C5 | **Path 3 P3 — picker adoption rounds.** Wire the 8 unwired tools, then migrate ~20 copy-pasted pickers in batches of ~10. | Sonnet | 2–3 | No (adopters only) |
| C6 | **Path 3 P4 — identity adoption in the history-keeping tools**, 008 first (most data at stake), then 001, 002, 022, 027, 033, 068, 013. One migration helper in `roster.js`, not eight. | Opus | 2 | No |

### Wave D — rollouts (Stage 2's long tail; Stage 3 can start alongside)

Path 6 P2 (17 existing sharers onto the sheet) and P3 (~11 builders that do
not share yet); Path 5 P3 (native dark and `stage.js` across the projector
tools, batches of ~6) and P4; Path 4 P4 (image-bearing tools onto
`media-db.js`, one or two per PR, 005 photos first) and P5; Path 6 P4
"Send to…" once the registry exists. All Sonnet/Opus batch work.

**Stage 2 is done when:** `store.js` is adopted by every tool the registry
marks `studentData: true`; `check-registry` runs in CI and 009's backup is
generated from the registry; `roster.js` is the only roster reader on the
site and 008 and 001 key history on ids; the share sheet is in every tool
that had a link; ink-paper tools render native dark; the accessibility
allowlist is below 30 entries and none are `select-name` or `label`.

## 4. Decisions Devon should make before the phase that needs them

| Needed by | Decision | Recommendation |
|---|---|---|
| ~~A1~~ | ~~Who owns theme: `a11y.js` or a new module.~~ | **Answered and shipped in #167: `a11y.js` owns theme; `theme-toggle.js` deleted.** |
| B1 | Whether a quota error may ever be silent. | Never. Visible message, names the tool, points at Backup & Restore. |
| B3 | Staff rosters (058, 075): same namespace as student rosters, or a `Staff —` prefix. | Prefix convention; do not fork the store. |
| B3 | Whether skill/level values (002's balancing) go on the shared student record. | **No.** The platform themes call it the most sensitive thing the site would store; keep it tool-local. |
| C1 | Link payload policy for images. | Strip by policy, say so in the sheet, offer the `.json` download as the way to carry them. |
| Path 8 | Whether a paired *student* device is ever in scope. | No. Teacher-device-only, as the path already says. |
| Any time | Whether CI should also run `offline:build` + `offline:verify` on `main` (slow; the only end-to-end check of the `file://` copy). | Yes, on `main` only, not on pull requests. |

## 5. Definition of done, every phase

1. Claimed in `improvement prompts/_tools-touched.md` and pushed before code.
2. One phase per PR. Conventions from `CLAUDE.md`: shared boilerplate linked,
   one vendored copy, `lib/` not `libs/`, `PRECACHE_URLS` (and `SHELL_URLS`
   only for a shell tool or `_shared/`) plus `CACHE_VERSION` in the same
   commit, a `[hidden]{display:none!important}` rule on any page whose CSS
   sets `display` on a toggled element.
3. Green locally: `check:dedupe`, `check:tests`, `check:social`,
   `check:entities`, `check:hidden-flex`, `check:print-clip`, `lint`,
   `check:precache -- --base origin/main`, every touched tool's `test:<name>`,
   and `test:a11y -- --only <nnn>` for every touched page (a new tool comes
   in clean; never add an allowlist line).
4. A new `_shared/` module ships with a pure-logic Node suite and at most one
   adopter; adoption rounds are their own phases.
5. `UPGRADE_PATHS.md` updated under the phase: what shipped, what surprised,
   what was verified and what was not, and anything cut moved to the tool's
   improvement file.
6. Squash-merged to main after CI is green; merge confirmed before the
   session ends.

## 6. What Stage 1 learned that Stage 2 should not relearn

- **Sandbox Chromium.** In the Claude Code web sandbox, run every browser
  suite with `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`. The pinned
  Playwright's browser is not there and `playwright install` is a silent
  no-op. CI has the right browser and is the authority.
- **One suite at a time.** Suites share fixed ports; `run-suites.mjs` is
  sequential on purpose. A background `npm test` plus a foreground suite is
  how you get failures that are not real. New suites should take a port
  above 8404.
- **The guards are floors.** `check-entities` reports only strings with a
  visible text sink; `check-hidden-flex` sees class rules, not id rules; the
  a11y sweep is first-load only. When one of them reports a page, look at the
  page in a browser before fixing — the real count is usually higher and the
  fix is usually one rule.
- **Test the real worker.** `smoke-sw-tiers.mjs` stages the shipped `sw.js`
  with only its URL arrays swapped. Copy that pattern for anything in
  `sw.js`; do not write a toy worker.
- **Timing assertions race.** "The readout stays hidden until the worker
  reports" failed once because the report arrived in milliseconds. Assert
  invariants (hidden *iff* nothing reported), not orderings.
- **No flag days.** The precache went to two tiers without changing what
  offline means; the share target landed without a server; ESLint landed
  without touching the 86 inline scripts. Stage 2's contracts should be
  shaped the same way: `store.js` reads legacy payloads as they are,
  `roster.js` leaves `np_rosters` alone, the registry describes keys rather
  than renaming them.

## 7. Paste-ready prompts

**Contract phase (B1, B3 — run with Fable):**

```
Run git checkout main && git pull. Read CLAUDE.md, HANDOFF_STAGE_2.md,
PLATFORM_PLAN.md, and the Path <N> section of UPGRADE_PATHS.md. Execute
Path <N>, Phase <P>: a contract with many downstream consumers. Before
code: grep every consumer it will touch and list them under the phase in
UPGRADE_PATHS.md; write the contract and its migration story as the header
comment of the new _shared/ file; record the alternatives you rejected and
why. Ship the module with a pure-logic Node suite and at most one adopter.
Do not rename any existing storage key. Claim touched tools in improvement
prompts/_tools-touched.md first. Run every guard in CLAUDE.md, lint,
check:precache -- --base origin/main (fetch main first), the touched tools'
suites, and test:a11y -- --only <nnn> for touched pages. Update
UPGRADE_PATHS.md with what was verified. Commit on a new branch, push, open
a PR, squash-merge once CI is green, confirm the merge.
```

**Build-to-spec phase (A1, B2, C1–C4, C6 — Opus):**

```
Run git checkout main && git pull; export
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium. Read CLAUDE.md,
HANDOFF_STAGE_2.md, and the Path <N> section of UPGRADE_PATHS.md. Execute
Path <N>, Phase <P> only, to the spec as written; where the spec and the
tree disagree, follow the tree and note the difference under the phase.
Claim touched tools in improvement prompts/_tools-touched.md and push that
first. Follow CLAUDE.md (shared boilerplate, one vendored copy, lib/ not
libs/, PRECACHE_URLS + CACHE_VERSION in the same commit, SHELL_URLS only for
a shell tool or _shared/, the [hidden] rule where needed). Run every guard,
lint, check:precache -- --base origin/main, the touched tools' suites, and
test:a11y -- --only <nnn> for touched pages; a new page must be clean. Record
what you verified under the phase in UPGRADE_PATHS.md. Commit on a new
branch, push, open a PR, squash-merge once CI is green, confirm the merge.
```

**Batch round (A2, C5, Wave D — Sonnet):**

```
Run git checkout main && git pull; export
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium. Read CLAUDE.md and the
"<round name>" section of HANDOFF_STAGE_2.md / UPGRADE_PATHS.md. The pattern
is already set by <first adopter>; copy it exactly for tools <list>, one
tool at a time, deleting the local copy each replaces. Claim the batch in
improvement prompts/_tools-touched.md first. Do not touch _shared/. After
each tool run its test:<name> suite and test:a11y -- --only <nnn>; after the
batch run every guard and check:precache -- --base origin/main, bump
CACHE_VERSION once, and open one PR for the batch.
```

## 8. Files to know

- `UPGRADE_PATHS.md` — the authority for every path's phases and status.
- `PLATFORM_PLAN.md` — Track R (roster) and Track P (packet builder) are the
  original specs Paths 3 and 10 extend; read R1 before B3.
- `HANDOFF_2026-09-03.md` — the session-level handoff from Stage 1: what
  tripped it up, in more detail than section 6 here.
- `improvement prompts/_tools-touched.md` — claims, and the "accessibility
  baseline" thread.
- `Tools/a11y-sweep/allowlist.json` — the accessibility backlog, per page.
- `_shared/` — `state-link.js`, `student-details.js`, `webrtc-pair.js`,
  `a11y.js` are the modules Stage 2 builds beside or on top of; each has a
  header that says what it owns.
