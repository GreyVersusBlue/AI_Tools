# `Tools/name-picker/`

Everything `Tools/007-Name Picker.html` needs that is not markup or CSS.

The page itself stayed at `Tools/007-Name Picker.html`, space and all, so
`https://greyversusblue.com/Tools/007-Name%20Picker.html` and the board's `href` both
still resolve. Splitting the 1,700-line file further, or losing the space in the
name, would have meant a board change and a broken URL; see the session notes.

| File | What it is |
| --- | --- |
| `np-store.js` | All thirteen storage keys, on `_shared/gvb-save.js`. DOM-free. |
| `np-pick.js` | Who gets called and how fairly. Pure, injectable `rng`. DOM-free. |
| `fonts/` | Bungee, Outfit, Press Start 2P, vendored. See its README. |
| `test/smoke.mjs` | 207 assertions under plain Node. |
| `test/blocked-storage.html` | The one case Node cannot reach — a browser that blocks storage. |

## Running the tests

```
node Tools/name-picker/test/smoke.mjs
```

Exits non-zero on any failure (locked decision #13). It prints the picking and
shuffle distributions as numbers, because "looks random" is not a test:

```
fair rotation over 280 picks:  min 10, max 10, spread 0
uniform draws over 280 picks:  min 6, max 16, spread 10
first-pick uniformity over 28000 rounds: expected 1000, worst deviation 67
shuffle bias, position 1 of 6 over 20000 shuffles: comparator worst 2437, Fisher-Yates worst 67
```

For the blocked-storage case, serve the repo and open
`/Tools/name-picker/test/blocked-storage.html`. It replaces the `localStorage`
property with a throwing getter before importing the store, because that is what
Chrome actually does with site data blocked — the property access throws, not
`setItem`. The page title reads `PASS` or `FAIL (n)`. Ten checks.

## `np-store.js`

Thirteen keys: the twelve the tool shipped with, unchanged (locked decision #36),
plus `np_options`.

Three representations, kept apart on purpose:

- **disk** — what `localStorage` holds. `'1'`, `medieval`, a JSON array.
- **app** — what the page wants. `true`, `'medieval'`, an array.
- **box** — what `gvb-save` sees: `{value: <disk>}`.

`boxed()` is that adapter, and it exists because `gvb-save`'s `save()` does
`JSON.stringify({...state, __v: version})`. Spreading `__v` into an object-valued
key is harmless; spreading it into `np_history` turns an array into an object with
numeric keys, and `np_theme` is not even JSON on disk — it is the bare string
`medieval`. So **adopting the shared module rewrote nothing**: every one of the
twelve keys still holds exactly the bytes the old build wrote, verified by
asserting no `__v` appears anywhere in storage after a full session.

`ok()` and `fix()` judge and clean the **disk** form; `decode`/`encode` cross
between disk and app.

### The three groups

```
roster    np_rosters  np_current  np_lucky
records   np_stats    np_history  np_hof
prefs     np_theme  np_prompts  np_options  np_crazy
          np_lucky_enabled  np_retro_active  np_retro_unlocked
```

`roster` and `records` hold student names. `prefs` holds none. That split is what
makes one honest erase button possible: **"Erase all student data" clears the six
keys with names in them and keeps the themes, the task prompts, the options and
the unlocked retro theme** — which is what a teacher actually wants, and is not
what "clear site data" does.

`np_lucky` is in `roster`, not `prefs`, because it stores a student's name. That
is invisible from the key name and is the reason the grouping is a table in code
rather than a comment.

### `migrate` vs `repair`

Per-key slots use **`repair`** only. All twelve keys hold unversioned data on real
machines, which `normalize()` reads as version 0, so `migrate` would fire on every
load and `repair` is where the compatibility work belongs (locked decision #37).
The fill-in that earns it: `updateHofTicker()` calls `e.tier.toLowerCase()` on
every Hall of Fame entry, so a single entry without a `tier` threw and killed the
ticker for good. `repair` drops entries with no usable name or tier and fills the
rest.

The export bundle is the one place **`migrate`** runs: the hand-rolled backup
format the tool shipped with (`{version: 2, rosters, currentRoster, hallOfFame,
…}`) gets lifted onto the `np_` keys, so a backup a teacher saved months ago still
restores. Those files carry `version: 2` but no `format`, so `gvb-save` reads them
as version 0 and hands the whole object to `migrate`.

### The bundle slot

Export and import go through one extra slot with `key: 'np_bundle'` and a
**memory-backed storage stub**, so it can serialize, deserialize, download and
open a file picker without ever becoming a fourteenth stored key.

`mountSaveBar` is deliberately not used. Its export filename is fixed to
`<game>-save-<date>.json` with no way to override it, and this file is a list of
children's names — the name has to say so. There is a Shared-file request in the
session notes.

## `np-pick.js`

Two things were wrong before this existed:

1. **Every pick was an independent uniform draw.** Over 28 students that repeats
   the previous student about once every 28 picks and, after a full 28 picks,
   leaves roughly ten of them never called. `np_stats` and `np_history` were
   already recording who had been called; nothing read them back.
2. **`makeGroups()` shuffled with `sort(() => Math.random() - 0.5)`**, which is not
   a shuffle — the comparator is inconsistent, so the result depends on the sort
   implementation and strongly favours leaving elements near where they started.

`fairPick` draws without replacement inside a round, refills from the current
eligible pool when a round runs out, and excludes the previous pick from the first
draw of a new round so a round boundary cannot produce a back-to-back repeat. A
roster of one is the only case that can repeat.

The rotation is **in memory, per page load**, not stored — a class period is one
page session, and it was not worth a fourteenth key. Loading a different roster or
pressing Reset Board starts a clean round. Marking a student absent mid-period
does not reset anybody's turn: names that leave the pool are dropped from the
round, names that join are picked up at the next refill.

Every mode now **chooses the winner first and animates towards it.** Jump,
disappear and tournament mode used to let the animation decide — whoever the last
random highlight landed on, or the last card standing — which made fairness
impossible to honour in three of the five modes.
