# SS demo round — 028 Primary Source Analysis — corroboration worksheet

Read `CLAUDE.md`, then `prompts/social-studies-demo/_preamble.md` and follow it
exactly, then `improvement prompts/028-primary-source-analysis-generator.md`
(Status top-down is the source of truth — share link + QR already shipped
2026-08-12).

Your tool: `Tools/028-primary-source-analysis-generator.html` (single file,
~1,234 lines, no subfolder). Storage keys: `gvb-primary-source:list`,
`gvb-primary-source:data:<name>`, `gvb-primary-source:current`. It already
links `_shared/state-link.js` + `_shared/vendor/qrcode/qrcode.js`.

## Headline — "Side-by-side corroboration worksheet" (backlog rank 3)

Print two sources on one sheet with shared sourcing questions plus a "where
do they disagree" comparison block and answer key.

- Add a **Corroboration mode** INSIDE the existing single-worksheet shape: a
  mode flag plus optional Source B fields (text/description/image upload with
  the same downscale path, its own citation). Do not restructure into a
  multi-source list — that territory belongs to the DBQ tool (056).
- Worksheet print in corroboration mode: both sources side by side (or
  stacked, whichever survives real page-space testing with images), shared
  sourcing questions that apply to each source, then a comparison block:
  where do the sources agree, where do they disagree, which do you find more
  reliable and why.
- Answer key print: teacher notes per source plus a key section for the
  comparison block, following the existing answer-key pattern.
- The tool has its own hand-written print path (no `print-area.css`). Keep it
  that way.

## Supporting (in order; cut from the bottom)

1. **Load example** (P15): a canned two-source pair a 7th grader can argue
   about — e.g. the Boston Massacre: a description of Paul Revere's engraving
   vs. a passage from a British soldier's account (public-domain text, keep
   each under ~150 words). One click loads both sources, mode on, questions
   ready. Confirm before replacing unsaved work.
2. **Extend the share link** to carry the corroboration fields (mode flag,
   Source B text/citation; images stay excluded as today). Update
   `isPlausibleWorksheet()` and any other validator to accept the new fields —
   this validator has silently rotted before when fields were added; test the
   round-trip explicitly.
3. **First smoke test**: `Tools/primary-source-analysis-generator/test/`
   (create the subfolder for the test only, mirroring how 050 does it) with a
   suite asserting: corroboration mode renders both sources + comparison
   block in the print DOM, answer key includes the comparison key, share link
   round-trips a corroboration worksheet. Add `test:primary-source` to
   `package.json` and append to the `test` chain.

## Non-goals

Three-or-more sources; a saved source library; image crop/zoom; projector
mode; IndexedDB migration; renaming the legacy `gvb-*` keys.

## Notes

- New folder/files → `sw.js` `PRECACHE_URLS` (adjacent to this tool's entry,
  slug order) + `CACHE_VERSION` bump, except test files, which the precache
  list excludes (match existing handling of `test/` folders).
- No new localStorage keys expected; register any you do add in
  `Tools/009-backup-restore.html`.
- README row + index.html pitch: mention two-source corroboration.
