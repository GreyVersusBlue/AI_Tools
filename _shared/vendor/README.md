# `_shared/vendor/` — one canonical copy of each third-party library

Every vendored third-party library on this site lives here, at exactly one
version, in `_shared/vendor/<name>/`. Tools reference it with a relative
`<script src>`; nothing is loaded from a CDN, because the school network can't
be trusted and the toolkit has to keep working offline.

This replaces the older per-tool convention (each tool kept its own copy under
`lib/` or `libs/`, on the reasoning that a duplicated file beat a cross-tool
dependency). That produced five copies of jsPDF, four of jsQR, and two of
SheetJS — about 2.5 MB of duplicate minified JS, at three different jsPDF
versions, with no way to tell which was current. Phase 1 of `REFACTOR_PLAN.md`
consolidated them.

## What's here

| Folder | Library | Version | Licence |
| --- | --- | --- | --- |
| `jspdf/` | [jsPDF](https://github.com/parallax/jsPDF) + [AutoTable plugin](https://github.com/simonbengtsson/jsPDF-AutoTable) | 2.5.2 / 3.6.0 | MIT |
| `xlsx/` | [SheetJS Community Edition](https://sheetjs.com/) | 0.18.5 | Apache-2.0 |
| `jsqr/` | [jsQR](https://github.com/cozmo/jsQR) | unversioned build — identified by SHA-256 | Apache-2.0 |

Each folder has its own README with the exact file size, SHA-256, source URL,
consumers, and update instructions.

## Rules

- **One version, site-wide.** If a tool needs a different version, that's a
  conversation, not a second copy. Fix it here and re-test the consumers.
- **Adding a library:** check this folder first. If it isn't here, put it here
  (not in the tool's folder) with a README recording version and source, add it
  to `PRECACHE_URLS` in `sw.js`, and bump `CACHE_VERSION`.
- **Updating a library:** replace the file, update the folder README's version
  and hash, and exercise the export feature of every consumer listed there. A
  vendored library with a wrong path or a breaking API change loads silently and
  fails at the moment of use — which reads to a teacher as a broken button.

Libraries still living in per-tool `lib/` folders (`qrcode.js`, `jszip.min.js`)
are duplicated too and are queued for the same treatment; see `REFACTOR_PLAN.md`.
