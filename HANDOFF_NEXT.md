# Handoff — read this first

*Current as of `dd23886` on `main`, 2026-09-03, after PR #169.*

**This file is the entry point, and it is the one that gets rewritten.** When
your phase merges, you replace this file's contents with the state you are
handing over (see §6 — it is step 7 of the definition of done, and it is not
optional). The dated delta handoffs stay where they are as history; you do not
need to read the whole stack to start work.

## Read order

1. `CLAUDE.md` — the repo conventions. Always. Non-negotiable.
2. **This file** — where things stand and what to pick up.
3. `HANDOFF_STAGE_2.md` — the Stage 2 plan: the fourteen phases, their
   dependency graph, and why the waves are shaped as they are. Still ~95%
   correct; §1–§3 are what you want.
4. The path section of `UPGRADE_PATHS.md` you are about to work.

**History, read only if you need the detail behind a claim here:**
`HANDOFF_STAGE_2_A1.md` (Wave A1, theme) and `HANDOFF_STAGE_2_A2.md` (Wave A2,
accessibility labels). Both are superseded by this file for *state*; they are
still the best record of what those phases learned. `HANDOFF_2026-09-03.md` and
`REFACTOR_*.md` predate Stage 2.

> **A caution earned the hard way.** Before Stage 2 the handoff chain was four
> documents deep and one link in it was never committed to the repo — it lived
> only as a file passed between sessions. That is how `HANDOFF_STAGE_2_A1.md`
> came to describe a tool that does not exist, and to claim a correction it had
> not made, with nothing in the tree able to contradict either. Hence one
> current file, in the repo, rewritten each phase.

## 1. Where Stage 2 stands

Two of the fourteen phases are done.

| Wave | Phase | Status |
|---|---|---|
| A1 | Path 5 P1 — theme architecture | **Shipped**, #167, `CACHE_VERSION` v139 |
| A2 | Accessibility label round | **Shipped**, #168, `CACHE_VERSION` v140 |
| A3 | Live-site checks | Open. **Devon only.** Now covers #167 and #168. |
| B1 | Path 4 P1 — `_shared/store.js` | Open. **Fable. Nothing blocks it.** |
| B2 | Path 4 P2 — tool registry | Open. Needs B1. |
| B3 | Path 3 P1 — `_shared/roster.js` | Open. Fable. Needs B1. |
| B4 | Path 3 P2 — roster diff in 006 | Open. Needs B3. |
| C1–C6 | share sheet, stage, media store, seating reader, picker + identity adoption | Open. Need B1–B2. |
| D | Rollouts, incl. Path 5 P3 | Open. See §3.1 — P3 has a blocker. |

**Numbers as of `dd23886`:** `CACHE_VERSION` v140, 249 precache entries (77 in
the install tier), **125 suites** green in ~20 min, `expectedFailures` **empty**,
**22 accessibility allowances on 22 pages**, lint clean, 86 tools, next free
tool number **087**.

## 2. Start here

**B1 — `_shared/store.js` — is the critical path and nothing blocks it.** It has
been the critical path since the Stage 2 plan was written and neither shipped
phase moved it. If you have a Fable session, this is the work.

Versioned envelope `{v, data}`, a `migrate(fromV, data)` hook, quota errors
surfaced as a visible message (never silent — that decision is made), `onChange`
across tabs and same-tab, `estimate()`. Adopt in three tools of different key
eras in the same PR. **No renames of existing keys.** The whole decision is the
migration contract: how unversioned legacy payloads are read without a flag day.
`HANDOFF_STAGE_2.md` §3 Wave B has the full brief; §7 has a paste-ready prompt.

**If you are not running B1,** the two cheapest genuinely useful things are
`034`'s single `aria-required-children` fix (~1 hour, prompt in
`HANDOFF_STAGE_2_A2.md` §7) and the `check:docs-commands` guard in §3.2 below.

## 3. Live blockers and corrections

Detail for all of these is in `HANDOFF_STAGE_2_A2.md` §3. The short forms:

### 3.1 Path 5 P3 cannot run its own prompt

`npm run path5:next` / `Tools/board-check/list-dark-candidates.mjs` **does not
exist.** `HANDOFF_STAGE_2_A1.md` §5 and §8 say it shipped in #167 and §3.1
quotes its output as the rollout backlog; it was never committed. P3's first
step is to build and commit it — budget half a session — or to measure inline
and commit the measurement. `HANDOFF_STAGE_2_A2.md` §7 has a corrected prompt.

The two stale "17–45 literals" citations that handoff also mis-reported as
fixed **have now actually been fixed** (#169), in `UPGRADE_PATHS.md` §5 P1 and
the #167 round entry — by removing the false precision, not by substituting a
number nobody has measured. Do not reintroduce a figure without the script.

### 3.2 Three tools have now been documented but never committed

`sync-social-tags.mjs`, the original `board-check` folder, and now
`list-dark-candidates.mjs` — the last one with a handoff quoting its output as
fact. `check-tests.mjs` already fails when `suites.json` names a suite that is
not on disk; **nothing does the equivalent for a `package.json` script a
document tells you to run.** A guard that walks the tracked `.md` files for
`` `npm run <x>` `` and fails on any `<x>` that `package.json` does not define
is ~30 lines and would have caught all three. Suggested as
`check:docs-commands`. Unclaimed, and overdue.

### 3.3 The contrast round runs *after* Path 5 P3, not before

The 21 remaining `color-contrast` allowances sit on hardcoded light literals
that P3 replaces with tokens across 73 tools. Doing contrast first means tuning
values P3 then re-tokenizes — twice the work, and a conflict in every file.

Separately, light's `--line-strong` misses the 3:1 WCAG asks of a control
border (`HANDOFF_STAGE_2_A1.md` §3.6). **The axe sweep will never surface it** —
`color-contrast` is a text rule — so a "clear the contrast allowlist" round will
not touch it. It needs its own phase.

### 3.4 `index.html`'s contrast count is not stable between runs

×8 at the baseline, then ×24 and ×35 during A2, with the file untouched. Nothing
fails (allowed rule, no counts stored). Pin the page state before working it, or
a partial fix and a slow run look identical.

## 4. Decisions Devon still owes

| Needed by | Decision | Recommendation |
|---|---|---|
| B1 | May a quota error ever be silent? | **Never.** Visible, names the tool, points at Backup & Restore. |
| B3 | Staff rosters: same namespace or a `Staff —` prefix? | Prefix. Do not fork the store. |
| B3 | Do skill/level values go on the shared student record? | **No.** Keep tool-local. |
| C1 | Link payload policy for images. | Strip by policy, say so in the sheet, offer `.json`. |
| Path 5 P3 | 035's private theme system: adopt `a11y.js`, or bless it as a documented exception? | Bless and document, unless P4 is opening 035 anyway. Adopting is a re-skin of a 5,500-line tool. |
| Path 5 P3 | Rebuild `list-dark-candidates.mjs`, or measure inline? | Rebuild and commit it. This backlog gets re-measured by every session that touches it. |
| The contrast round | Before or after Path 5 P3? | **After.** §3.3. |
| Path 8 | Is a paired *student* device ever in scope? | No. |
| Any time | Should CI also run `offline:build` + `offline:verify` on `main`? | Yes, `main` only. |
| Any time | Is `check:docs-commands` (§3.2) worth 30 lines? | Yes. Third occurrence. |

## 5. What the last two phases learned that yours should not relearn

`HANDOFF_STAGE_2.md` §6, `HANDOFF_STAGE_2_A1.md` §6 and
`HANDOFF_STAGE_2_A2.md` §6 all still hold. The four that generalise furthest:

- **A document that names a command is making a claim. Run it once before you
  trust it.** §3.1 and §3.2.
- **Prove your fix positively; a guard going quiet is not evidence.** A
  sweep-driven round can go green *by breaking the page* — if a JS row template
  throws, the controls never render, axe reports the page clean, and every
  allowance comes out on a green suite. Read the result back out of a browser.
- **Measure with a script, and commit the script.** A frozen wrong number in
  three files is worse than no number. If you quote a count, ship the thing that
  produced it — unless the thing that produced it is already committed (A2 quoted
  `test:a11y`, which is why it added no script).
- **Look at the page before you believe the guard.** A new guard's first run is
  a finding, not a failure; and a guard's *silence* is not a pass.

## 6. Definition of done, every phase

`HANDOFF_STAGE_2.md` §5's six steps, **plus a seventh**:

1. Claimed in `improvement prompts/_tools-touched.md` and pushed before code.
2. One phase per PR, following `CLAUDE.md`'s conventions.
3. Green locally: `check:dedupe`, `check:tests`, `check:social`,
   `check:entities`, `check:hidden-flex`, `check:print-clip`, `lint`,
   `check:precache -- --base origin/main`, every touched tool's `test:<name>`,
   and `test:a11y -- --only <nnn>` for every touched page. **Never add an
   allowlist line.**
4. A new `_shared/` module ships with a pure-logic Node suite and at most one
   adopter.
5. `UPGRADE_PATHS.md` updated under the phase: what shipped, what surprised,
   **what was verified and what was not.**
6. Squash-merged to `main` after CI is green; merge confirmed before the session
   ends.
7. **Then rewrite this file.** After the merge is confirmed — not before, so it
   records what actually landed rather than what you hoped would — replace
   `HANDOFF_NEXT.md` with the state you are handing over: the table in §1 with
   your phase marked shipped and its `CACHE_VERSION`, refreshed numbers, what
   the next session should start, any blocker or correction you found, and
   anything you were wrong about. Commit and merge that too. A phase that ships
   without a handoff has spent its learning and kept it.

**On writing §7 honestly.** The single most valuable thing in these documents
has consistently been the part that says *what did not work* — the tool that
was never committed, the count that was 3× too high, the guard that would have
passed on a broken page. Record what you got wrong and what you did not verify.
A handoff that only lists wins is how the next session inherits your mistakes
instead of your knowledge.

## 7. Environment notes that cost sessions time

- **Sandbox Chromium.** In the Claude Code web sandbox, run every browser suite
  with `PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`. The pinned
  Playwright's browser is not there and `playwright install` is a silent no-op.
  CI has the right browser and is the authority.
- **One suite at a time.** Suites bind fixed ports; a background `npm test` plus
  a foreground suite produces failures that are not real. New suites take a port
  above **8405**.
- **A full `npm test` is ~20 minutes**, and CI is ~20 minutes on top. Plan the
  session around two CI rounds, not six.
- `npm ci` first — `node_modules` is gitignored and a fresh container has none.
