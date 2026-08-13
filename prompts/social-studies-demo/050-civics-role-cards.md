# SS demo round — 050 Civics Role Cards — per-role case file packets

Read `CLAUDE.md`, then `prompts/social-studies-demo/_preamble.md` and follow it
exactly, then `improvement prompts/050-civics-role-card-generator.md` (Status
top-down is the source of truth).

Your tool: `Tools/050-civics-role-card-generator.html` (~444 lines, logic
inline) + `Tools/civics-role-card-generator/test/smoke-assign-roster.mjs`.
Storage key: `crcg_roles_v1` (single blob). It links `print-area.css` (prints
via `#printArea`) and is the toolkit's reference implementation for
`np_rosters` roster assignment (select + storage-event refresh + per-copy
student names).

## Headline — "Per-role case file packets" (backlog rank 17)

Attach role-specific evidence, witness facts, or bill text that prints as a
companion packet behind each card.

- Each role gets one optional long-form **Case file** textarea (this answers
  the improvement file's open question: one distinct field, so the cards
  themselves stay clean). Line breaks preserved in print; simple paragraphs
  are enough, no rich text.
- Printing: after the existing card grid, roles with case-file text get
  companion pages — one per printed copy of the role, headed with the role
  name and, when a student is assigned to that copy, the student's name
  (reuse the existing per-copy `r.students[c]` logic the cards use). Page
  breaks so each copy's packet starts on a fresh page and never splits
  mid-copy (`page-break-inside: avoid` on the packet block; use min-height,
  never fixed height + overflow hidden — that combination silently clips
  print output).
- Everything renders inside `#printArea`; do not add a competing
  `@media print` block.
- Seed all three built-in templates (Mock Trial, Debate, Legislative) with
  short sample case-file text (3–6 sentences each, 7th-grade friendly,
  teacher-credible — e.g. the mock trial gets a simple fact pattern like a
  school locker-search case) so the feature demos from the defaults.

## Supporting (in order — but see the cut rule below)

1. **Share link + QR** (P3): role sets are pure text, so payloads are small.
   Copy the pattern from `Tools/028-primary-source-analysis-generator.html`
   (~line 1091; `_shared/state-link.js` + `_shared/vendor/qrcode/qrcode.js`).
   An incoming link must not clobber unsaved work: with multi-save (item 2)
   landed, save under a uniqued name; without it, replace only after a
   confirm dialog.
2. **Multiple named saved simulations**: adopt the triple-key pattern used by
   the trading card maker (`htcm:list` / `htcm:data:<name>` / `htcm:current`)
   as `crcg:list` / `crcg:data:<name>` / `crcg:current`; migrate the existing
   `crcg_roles_v1` blob in as a first named simulation; **register the new
   keys in `Tools/009-backup-restore.html` `KNOWN_GROUPS`.**
3. **Extend the smoke suite** (same file or a sibling in the existing test
   folder): packet pages render per copy, assigned names carry onto packets,
   share link round-trips a role set.

**Cut rule:** if the session runs long, drop item 2 (multi-save) first and
ship the share link with the confirm-dialog fallback. Never ship half the
packet feature.

## Non-goals

New simulation templates (UN, constitutional convention); rubric-tool
integration; any change to the roster-assign machinery beyond reusing it;
changes under `_shared/`.

## Notes

- Assignment summary/copy counts must keep working when case files exist —
  the "grow the biggest role" logic is untouched by this round.
- New test or support files → `sw.js` `PRECACHE_URLS` + `CACHE_VERSION` bump
  (test files excluded, matching existing handling; if all logic stays inline
  there may be no sw.js file changes at all — the version still bumps only if
  the precache list changed).
- README row + index.html pitch: mention case-file packets.
