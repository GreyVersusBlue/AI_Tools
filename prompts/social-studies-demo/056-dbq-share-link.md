# SS demo round — 056 DBQ Packet Builder — share a packet by link

Read `CLAUDE.md`, then `prompts/social-studies-demo/_preamble.md` and follow it
exactly, then `improvement prompts/056-dbq-source-packet-builder.md` (Status
top-down is the source of truth; multiple named saved packets is its only
unbuilt Quick Win, and this round ships it as a prerequisite).

Your tool: `Tools/056-dbq-source-packet-builder.html` (~454 lines, single
file). Storage: a single `dbq_packet_v1` blob (one packet only). Links
`print-area.css` (prints via `#printArea`).

## Headline — "Share a packet by link" (backlog rank 23)

Encode the whole packet with `_shared/state-link.js` into a URL, plus a QR,
so a department teammate opens the identical packet offline.

**Sequencing matters: ship multi-save first.** An incoming shared link needs
somewhere to land that isn't "overwrite the teacher's only packet."

1. **Multiple named saved packets**: adopt the triple-key pattern used by the
   trading card maker (`htcm:*`) as `dbq:list` / `dbq:data:<name>` /
   `dbq:current`; migrate the existing `dbq_packet_v1` blob in as the first
   named packet; UI for new/rename/duplicate/delete consistent with siblings
   (054's guide library is a good reference). **Register the new keys in
   `Tools/009-backup-restore.html` `KNOWN_GROUPS`.**
2. **Share link + QR**: copy the pattern from
   `Tools/028-primary-source-analysis-generator.html` (~line 1091;
   `_shared/state-link.js` + `_shared/vendor/qrcode/qrcode.js`).
   - The payload **excludes each image source's pixel data** (data URLs would
     blow the URL); crop/width-percent metadata may travel. Show a visible
     note naming exactly which sources kept their images on this device, so
     the "identical packet" promise is honest.
   - QR limits: if the encoded payload is too large for a scannable QR
     (long pasted text sources), catch it and show the copy-link path with a
     clear size message instead of drawing an unscannable code — mirror how
     028 handles size.
   - An incoming `?packet=` (match state-link.js's param convention) saves
     as a new uniquely-named packet, never overwriting.

## Supporting (in order; cut from the bottom)

1. **JSON export/import**: nearly free once the share serializer exists, and
   it DOES carry images — it is the honest "send everything" path the share
   note points at. Download named `.json`, import validates and saves under a
   uniqued name.
2. **Load example** (P15): a 3-source mini-DBQ on Industrial Revolution child
   labor (public-domain text sources: e.g. a factory-act testimony excerpt, a
   mill-owner's defense, a child worker's account — each under ~150 words),
   with guiding questions and an essay prompt, so the demo opens on a real
   packet. Confirm before replacing unsaved work.
3. **First smoke test**: `Tools/dbq-source-packet-builder/test/smoke-share.mjs`
   (create the folder for the test only) asserting: link round-trip restores
   text sources and questions, image-exclusion note appears when a packet has
   image sources, incoming link saves under a uniqued name, migration keeps a
   pre-existing `dbq_packet_v1` packet. Add `test:dbq` to `package.json` and
   append to the `test` chain.

## Non-goals

Integration with 028 (worksheet-per-source); a source bank/library;
scaffolding levels; changing image compression; PDF export.

## Notes

- Print path stays as-is inside `#printArea`.
- New files → `sw.js` `PRECACHE_URLS` + `CACHE_VERSION` bump (test files
  excluded, matching existing handling).
- README row + index.html pitch: mention share-by-link/QR and named packets.
