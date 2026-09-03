# Handoff — Stage 2, after Wave A2

*Written 2026-09-03 after PR #168. This is a **delta**, like its predecessor:
`HANDOFF_STAGE_2.md` is still the Stage 2 plan, `HANDOFF_STAGE_2_A1.md` is
still the record of Wave A1. Read `CLAUDE.md` first, `HANDOFF_STAGE_2.md`
second, `HANDOFF_STAGE_2_A1.md` third, this fourth, then the path section you
are about to work.*

*If you are here to run **B1** (`store.js`) — the critical path — nothing below
blocks you. Skim §3.1, which is a correction that will otherwise cost you an
hour, and go. Everything else here is for whoever works accessibility, theme,
or the docs.*

## 1. Where Stage 2 stands

Two of the fourteen phases are done.

| Wave | Phase | Status |
|---|---|---|
| A1 | Path 5 P1 — theme architecture | **Shipped**, #167, `CACHE_VERSION` v139 |
| A2 | Accessibility label round | **Shipped**, #168, `CACHE_VERSION` v140 |
| A3 | Live-site checks | Open. Devon only. Now also covers #167 and #168. |
| B1 | Path 4 P1 — `_shared/store.js` | Open. Fable. **Nothing blocks it.** |
| B2–B4, C1–C6, D | — | Open, order unchanged |

Numbers as of main after #168: `CACHE_VERSION` v140, 249 precache entries (77
in the install tier), **125 suites** green in ~20 min, `expectedFailures`
empty, **22 accessibility allowances on 22 pages**, lint clean, 86 tools, next
free number 087.

Neither A1 nor A2 touched the Wave B/C dependency graph. **B1 is still the
critical path** and is the thing to start if you have a Fable session.

## 2. What A2 actually changed

Every `select-name`, `label` and `label-title-only` allowance in
`Tools/a11y-sweep/allowlist.json` is gone: **91 page-rule pairs on 59 pages →
22 on 22 pages**, and the 22 left are 21 `color-contrast` plus 034's one
`aria-required-children`. 274 controls on 52 tool pages were given an
accessible name. No behaviour changed and no file was added, moved or deleted.

That clears Stage 2's exit bar — "the accessibility allowlist is below 30
entries and none are `select-name` or `label`" — well ahead of schedule, so no
later path has to step around it.

**The allowlist diff being deletion-only is the load-bearing part.** The sweep
fails both when a new violation appears *and* when an allowed rule stops
firing. So a green run with 69 lines removed is proof the violations are gone,
not that they were re-silenced. If you ever find yourself adding a line back to
that file, you are undoing the mechanism, not using it.

## 3. What A2 found that the plan did not anticipate

This is the part worth your time.

### 3.1 `npm run path5:next` does not exist — and neither did the correction that announced it

`HANDOFF_STAGE_2_A1.md` §5 and §8 say `Tools/board-check/list-dark-candidates.mjs`
(`npm run path5:next`) shipped in #167, and §3.1 quotes its output as the
Path 5 P3 backlog. **It was never committed.** `git log --all` finds no trace,
`package.json` has no such script, and nothing anywhere in the repo references
either name.

The same section's "Correction to the record" is also wrong in its own right.
It says the three places carrying the stale "17–45 literals" figure "have been
fixed and now cite `npm run path5:next`". They were not fixed. When A2 started,
both surviving citations still carried the number that A1 itself established is
about **3× too high**:

- `UPGRADE_PATHS.md` §5 P1 — "All 74 ink-paper tools hardcode light colours in
  their own `<style>` — 17 to 45 occurrences each, measured."
- `improvement prompts/_tools-touched.md`, the #167 round entry — "(17–45
  occurrences each, measured)".

**A2 removed the false precision from both** rather than substituting a number
it had not measured, and pointed each at the gap. It did **not** build the
script: that is Path 5 P3's to build, and inventing a backlog figure to replace
a wrong one would repeat the mistake.

**So: Path 5 P3 cannot run the paste-ready prompt in `HANDOFF_STAGE_2_A1.md`
§7 as written.** Its first step is to build the thing that prompt calls, or to
measure inline and commit the measurement. Budget half a session for it.

**This is the third documented-but-never-committed tool on this site.**
`CLAUDE.md` already warns about two — `sync-social-tags.mjs` (the generator the
social meta blocks claim to come from) and the original `board-check` folder.
`list-dark-candidates.mjs` is the third, and the first where a handoff
*quoted its output* as fact.

The pattern has a cheap guard and nobody has written it. `check-tests.mjs`
already fails when `suites.json` names a suite that is not on disk; there is no
equivalent for a **`package.json` script a document tells you to run**. A
script that walks the tracked `.md` files for `` `npm run <x>` `` and fails on
any `<x>` that `package.json` does not define is perhaps thirty lines, and
would have caught all three of these before they reached a handoff. Suggested
as `check:docs-commands`; unclaimed.

### 3.2 "One `aria-label` each" was wrong in kind, not just in size

Path 2 P3's note — "the `select-name` and `label` classes are mostly one
`aria-label` each and would make a good mechanical round" — set the wrong
expectation. Roughly a third of the work was not an `aria-label` job at all:

**35 controls already had a visible `<label>` sitting next to them with no
`for`.** That is a copy-pasted toolbar idiom on 19 tools:

```html
<label style="margin:0;font-weight:600;font-size:.85rem;">Rubric:</label>
<select id="rubricSwitch">
```

Wiring `for` is strictly better than adding an `aria-label` there: it keeps one
name instead of two that can drift apart, and it makes the visible text a click
target. **That is now the house pattern — if you add a toolbar `<select>`, give
its label a `for`.** A further 4 had a `<span>` doing a label's job (007's
MODE/THEME/SPEED, 046's "Page shape"), promoted to `<label for=…>` after
checking that no rule or query selects those elements *as spans*.

The `for` wiring was done with a script that only touches a `for`-less label
directly followed by a control whose id is unique in the file. It also picked
up 9 controls behind a click that the sweep never opens — free, and a reminder
that the sweep is a floor.

### 3.3 A constant `aria-label` on a repeated row passes axe and helps nobody

The rest of the work was controls rendered from a JS template, in repeated
rows, and this is where a mechanical round can go quietly wrong. 058's duty
grid is **15 selects that all read `—`**. Naming every one of them
`"Assignment"` would have satisfied the rule and left a screen-reader user
exactly as lost as before.

They read `"Cafeteria, Monday"` now, built from the row they are in. Same for
056's rubric cells (`"Thesis / claim, 3 — Meets"`), 008's points and category
(`"Category for On Task"`), 073's due dates, 032's legend, 019's stations.

**The rule to carry:** a constant name is correct only where the control's own
*value* is what tells the rows apart — a destination name, a prompt, a
milestone title, all of which a screen reader announces along with the label.
Where the rows are visually identical, the name has to come from the row.

### 3.4 A sweep-driven round can go green by breaking the page

This one nearly bit and is worth internalising for any future round driven by
`test:a11y`, or by any guard that reports *absence*.

Most of A2's edits were inside JS template literals. **If one of those
templates throws, the controls it renders never exist, and axe reports the page
clean.** Every allowance would then come out of the allowlist, the suite would
go green, and the tool would be broken — with the test suite actively
confirming the fix.

The suites do not close this: the 125-suite run exercises specific behaviours,
not "did every row render". A2 closed it by reading the rendered `aria-label`
values back out of a browser for all twelve contextual cases and asserting they
contained real text and that no page error fired.

The risk was not hypothetical. Two of the identifiers interpolated into those
templates did not exist — `choice.key` in 057 and `panel.verb` in 079, both
guessed from the surrounding code. They were caught by grepping the source for
the field names before anything was run, so no test ever saw them; but had they
survived, both templates would have thrown, both pages would have scanned
clean, and both sets of allowances would have come out on a green suite.

**If your phase makes a guard stop reporting something, prove the thing you
built exists. A guard going quiet is not evidence.** This is the same lesson
A1 §6 recorded from the other direction ("a new guard's first run is a finding,
not a failure"), and it generalises: look at the page.

### 3.5 What is left in the allowlist, and when to do it

22 entries, and none of them is a labeling problem:

- **21 `color-contrast`** — mostly muted hint text, plus the landing page's
  category counts. Each needs a palette decision in its tool.
- **1 `aria-required-children`** on 034 — one tool's structure, an hour, no
  dependencies. The cheapest remaining win.

**Recommendation, and it is a real ordering constraint: run the contrast round
*after* Path 5 P3, not before.** P3 replaces hardcoded light literals with
tokens across 73 tools. Tuning contrast on those same literals first means
tuning values that P3 then re-tokenizes — twice the work and a merge conflict
in every file. 034 can go any time.

Note also A1 §3.6: light's `--line-strong` misses the 3:1 that WCAG 1.4.11
asks of a control border. **The axe sweep will never surface that** —
`color-contrast` is a text rule — so a "fix the contrast allowlist" round will
not touch it, and it still needs its own phase.

### 3.6 `index.html`'s contrast count is not stable between runs

The same tree reported `color-contrast ×8` at the 2026-09-03 baseline, then
`×24` and `×35` on two runs during A2, with `index.html` untouched. Nothing
fails — it is an allowed rule and the allowlist stores no counts — so this is
latent rather than broken. The likely cause is that the landing page paints its
per-tool category counts and the "Offline: N of 86 tools ready" readout as the
service worker reports progress, so how much muted text exists when axe runs
depends on timing.

Whoever works index's contrast should pin that state first, or scan a settled
page. Otherwise a partial fix and a slow run look identical.

## 4. Decisions Devon still owes

`HANDOFF_STAGE_2_A1.md` §4 carries forward **unchanged** — A2 answered none of
them, because it needed none. One addition:

| Needed by | Decision | Recommendation |
|---|---|---|
| The contrast round | Does it run before or after Path 5 P3? | **After.** See §3.5 — P3 re-tokenizes the same literals. |
| Path 5 P3 | Rebuild `list-dark-candidates.mjs`, or measure inline? | Rebuild and commit it. A backlog this size gets re-measured by every session that touches it. |
| Any time | Is `check:docs-commands` (§3.1) worth thirty lines? | Yes. It is the third occurrence. |

## 5. New machinery a phase must know about

**A2 shipped no new scripts, deliberately.** The obvious one — "list the pages
that still need labels" — would have had a backlog of zero the moment it
landed, and the measurement it would automate is already reproducible with a
committed command:

```
npm run test:a11y                 # the whole sweep, 87 pages, ~85s
npm run test:a11y -- --only 046   # one page
npm run test:a11y -- --all-impacts  # moderate/minor too, advisory
```

That is the difference from §3.1's failure: A1 §6's lesson is "if a phase
quotes a count, ship the thing that produced it," and here the thing that
produced it was already shipped. Do not read A2 as licence to skip the script
when the number is not otherwise reproducible.

Otherwise, everything in `HANDOFF_STAGE_2_A1.md` §5 still holds, with one
correction: **`npm run path5:next` is not among it** (§3.1).

## 6. What A2 learned that the next phase should not relearn

Everything in `HANDOFF_STAGE_2.md` §6 and `HANDOFF_STAGE_2_A1.md` §6 still
holds. Four to add:

- **A document that names a command is making a claim. Check it.** §3.1 cost
  the first twenty minutes of this session and would have cost Path 5 P3 more.
  Before quoting a handoff's tooling, run it once.
- **Prove the fix positively, not by the guard going quiet.** §3.4. A guard
  that reports absence can be satisfied by deleting the thing it inspects.
- **Reach for `for` before `aria-label`.** §3.2. Two names that can drift is
  worse than one name that cannot, and the visible label becomes clickable for
  free.
- **A round sized as "mechanical" deserves one measurement before you believe
  it.** The 274 controls fell into three kinds needing three different fixes;
  the plan predicted one. Dumping every violating node with its surrounding
  markup took ten minutes and reshaped the whole approach — do that before
  writing the first edit, not after the first surprise.

## 7. Paste-ready prompts

`HANDOFF_STAGE_2.md` §7's three prompts are unchanged and still correct.
`HANDOFF_STAGE_2_A1.md` §7's rollout prompt is **blocked on §3.1** — use this
instead.

**Rebuild the Path 5 P3 backlog tool, then run the first batch (Opus, then Sonnet):**

```
Run git checkout main && git pull; export
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium. Read CLAUDE.md, the header of
_shared/ink-paper.css (the whole thing — it is the spec), section 3 of
HANDOFF_STAGE_2_A1.md, and section 3.1 of HANDOFF_STAGE_2_A2.md.

npm run path5:next does not exist. Build it first:
Tools/board-check/list-dark-candidates.mjs, wired as path5:next, read-only,
never fails. It ranks the unadopted ink-paper tools by how many hardcoded light
colour literals each still has in its own <style> — counting only real colour
declarations, NOT white-space, NOT @media print blocks, NOT inline script,
which is what made the old "17–45" figure about 3x too high. Print the count
per tool, the median, how many have a #printArea, and support --batch N for the
lightest N. Commit it in its own PR with the corrected figure written into
UPGRADE_PATHS.md §5 P1 and the #167 round entry in improvement
prompts/_tools-touched.md, both of which A2 left pointing at this gap.

Then take --batch 8 and adopt them, following HANDOFF_STAGE_2_A1.md §7's
rollout prompt from "For each tool" onward.
```

**The 034 structural fix (any model, ~1 hour):**

```
Tools/a11y-sweep/allowlist.json allows one aria-required-children on
034-schedule-browser.html. Open the page, find the ARIA role whose required
children are missing, fix the structure (not the role, unless the role is the
mistake), delete the allowlist line, and run npm run test:a11y -- --only 034 —
it must be green with the line gone, which is what proves the violation is
fixed rather than re-silenced. Then the full npm run test:a11y and
test:schedule-browser. Claim it in improvement prompts/_tools-touched.md as a
path-assigned phase, per the shape Stage 2 A2 used.
```

## 8. Files to know (new or changed in #168)

- `Tools/a11y-sweep/allowlist.json` — **22 entries, down from 91.** The list
  only shrinks; adding a line back is undoing the mechanism.
- 52 tool pages — one accessible name each, no behaviour change. See the
  `UPGRADE_PATHS.md` §2 P3 record for the three fix kinds.
- `UPGRADE_PATHS.md` §2 P3 — the full A2 record, including what was *not*
  verified (no screen reader was driven; the claim is that every control has a
  programmatic name, not that every wording is the best one).
- `improvement prompts/_tools-touched.md` — the A2 round entry, and the
  precedent for how a **path-assigned phase touching many tools** claims work
  without consuming 52 tools' improvement rounds. Copy that shape.
- `HANDOFF_STAGE_2_A1.md` — added to the repo in this PR. It had been written,
  handed to a session, and never committed, which is how §3.1's error survived
  as long as it did.
