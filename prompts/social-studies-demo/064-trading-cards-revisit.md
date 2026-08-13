# SS demo round — 064 Trading Card Maker — revisit, share link, roster, sample deck

Read `CLAUDE.md`, then `prompts/social-studies-demo/_preamble.md` and follow it
exactly, then `improvement prompts/064-historical-trading-card-maker.md`
(Status top-down is the source of truth — this tool just had a substantial
visual-upgrade round: themes, rarity foils, photo editor, stat bars, live
preview, PNG/PDF/ZIP export, named decks, batch-add).

Your tool: `Tools/064-historical-trading-card-maker.html` (~876 lines) +
`Tools/historical-trading-card-maker/` (7 modules, 2 test suites with ~89
assertions). Storage keys: `htcm:list`, `htcm:data:<name>`, `htcm:current`,
`htcm_card_size_v1`.

## Step 0 — mandatory revisit before building

The backlog row for this tool (rank 31, "Batch-add blank cards from a
roster") is flagged NEEDS REVISIT and believed stale: batch-add shipped in
the recent upgrade round as a paste-a-list dialog. Re-read the tool and its
improvement file, confirm what actually exists, and report the row's true
status in your Status entry and PR body (do NOT edit `IDEAS_BACKLOG.md`).
Then build the replacement scope below.

## Headline — share a deck by link + QR (P3)

- Copy the pattern from `Tools/028-primary-source-analysis-generator.html`
  (~line 1091; `_shared/state-link.js` + `_shared/vendor/qrcode/qrcode.js`).
- Payload: the deck WITHOUT photos (card text, stats, themes, rarity,
  frames, deck settings travel; photo pixels do not). Show a visible note
  that photos stay on this device, and point at the existing PNG/PDF/ZIP
  exports as the full-fidelity way to send finished cards.
- An incoming link saves as a new uniquely-named deck via the existing
  `htcm:*` multi-save — never overwrite the current deck.
- Watch QR size on big decks: if the payload is too large for a scannable
  code, show the copy-link path with a clear message instead of drawing an
  unscannable QR.

## Supporting (in order; cut from the bottom)

1. **np_rosters integration for batch-add** (P2): next to the existing paste
   textarea, add a class-list dropdown fed from the shared `np_rosters`
   localStorage key. Copy the reference pattern from
   `Tools/050-civics-role-card-generator.html`: populate a select with
   roster names + counts, listen for the `storage` event to refresh when
   another tab saves a roster, and keep paste as the fallback when no
   rosters exist.
2. **"Load sample deck"** (P15): one click loads a demo deck of 4–6
   historical-figure cards (e.g. Washington, Franklin, Abigail Adams,
   Hamilton...) with real stats/facts, mixed rarities and themes, NO photos
   (or procedural placeholder art if the renderer needs an image — do not
   embed photographs). This tool is the visual centerpiece of Devon's
   presentation; the deck should look great the moment the page opens.
   Saves as its own named deck; never overwrites existing decks; confirm if
   a deck with that name exists.
3. **Extend the smoke suites**: share-link round-trip (deck minus photos),
   roster batch-add from np_rosters, sample deck loads and renders.

## Frozen — do not touch

`htcm-render.js`, `htcm-frames.js`, `htcm-themes.js`, `htcm-export.js`, and
the visual system generally. This tool was just redesigned across six
commits; regression risk is the enemy. **Run the existing suites
(`smoke-card-size.mjs`, `smoke-photo.mjs` — `npm run test:trading-cards` or
the equivalent scripts in package.json) green BEFORE you start and after
every feature.** If a feature seems to need a renderer change, it is out of
scope — note it in Status instead.

## Non-goals

Large 3.5×5 reference card; flag/emblem library; extracting
`_shared/image-import.js`; migrating vocab-flashcards to
`_shared/duplex-print.js`; any theme/frame/foil changes.

## Notes

- New files → `sw.js` `PRECACHE_URLS` next to the existing `htcm-*.js`
  entries + `CACHE_VERSION` bump (test files excluded, matching existing
  handling).
- No new localStorage keys expected; register any you do add in
  `Tools/009-backup-restore.html`.
- README row + index.html pitch: mention deck share links and roster-fed
  batch-add.
