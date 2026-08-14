# SS demo round 2 — 056 DBQ Packet Builder — essay scaffolding + leveled packets

Read `CLAUDE.md`, then `prompts/social-studies-demo-2/_preamble.md` and
follow it exactly (including **The differentiation spec** — it is a
supporting item here), then
`improvement prompts/056-dbq-source-packet-builder.md` (Status top-down;
round 1 just shipped named multi-save (`dbq:` triple-key), share by
link/QR, JSON export/import, the child-labor example packet, and
`smoke-share.mjs`).

Your tool: `Tools/056-dbq-source-packet-builder.html` (single file) +
`Tools/dbq-source-packet-builder/test/`. Uses `print-area.css`; everything
prints inside `#printArea`; `min-height`, never fixed height + overflow
hidden.

## Headline — Essay planning scaffold + rubric page

A DBQ packet should carry students all the way to the essay, not stop at
the sources.

- **Essay planning organizer** (optional page, on by default when an essay
  prompt exists): thesis line with a sentence-frame hint, a
  three-body-paragraph planning grid (claim / which documents support it /
  strongest evidence quote or detail), a counterargument box, and a
  conclusion line. Document slots reference the packet's actual source
  numbers and titles.
- **Scoring rubric page** (optional): an editable criteria×levels grid
  seeded with a 7th-grade-appropriate DBQ rubric (thesis, use of documents,
  outside knowledge, organization), one editable cell set, printed for the
  teacher or as a student-facing checklist.
- Both pieces save with the named packet, travel in the share link and JSON
  export (update the payload validator; **round-1 links must keep
  working**), and print in order: cover → sources → essay prompt →
  organizer → rubric.

## Supporting (in order; cut from the bottom)

1. **Differentiation levels** per the preamble spec (Academic / Honors /
   Honors GT, print-all-three with footer tags). At Academic, each source
   page adds a "before you read" line glossing 2–3 hard words from that
   source's text and sentence starters on source questions; the organizer
   gets pre-filled paragraph frames. At GT, the organizer drops frames and
   adds an outside-evidence row and a historiography-flavored "whose voice
   is missing from this packet?" question. Level stored with the packet.
2. **Send a source to Primary Source Analysis**: a per-source button that
   builds a 028-format share link (the pattern is in
   `Tools/028-primary-source-analysis-generator.html` — reuse
   `_shared/state-link.js` exactly as it does) and opens
   `028-primary-source-analysis-generator.html?...` in a new tab, so a
   packet source becomes a full analysis worksheet in one click. Use 028's
   **current, round-1** link format (another session is upgrading 028 in
   parallel and is required to keep that format working). Text sources
   only; image pixels stay behind, matching both tools' share-link rules.
3. **Extend the smoke suite**: organizer references real source numbers,
   rubric prints when toggled, levels change output (gloss lines at
   Academic, absent at Honors), old-format share links still import, the
   028 handoff URL parses as a valid 028 payload.

## Non-goals

Auto-grading or AI feedback; a source bank (library lives in 028 after this
round; note the cross-link idea in Status instead); PDF export; changing
image compression.

## Notes

- Match the differentiation spec exactly (naming, default, footer tags) —
  028 is the reference implementation this round.
- No new localStorage keys expected (new fields ride the packet object);
  register any genuinely new key in `Tools/009-backup-restore.html`.
- README row + index.html pitch: mention the essay organizer and leveled
  packets.
