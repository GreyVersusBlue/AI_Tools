# JSZip — vendored

| | |
| --- | --- |
| Library | JSZip |
| Version | 3.10.1 |
| File | `jszip.min.js`, 97,630 bytes |
| SHA-256 | `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` |
| Licence | Dual MIT / GPLv3 |
| Copyright | 2009-2016 Stuart Knightley |
| Source | `dist/jszip.min.js` from the `jszip@3.10.1` npm package (identical build to `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`, which is where `031-docx-merger.html` used to load it from) |
| Upstream | https://github.com/Stuk/jszip |

`031-docx-merger.html` used to load this from cdnjs directly (see
the 031 notes, P5 — now in `BACKLOG.md`). A teacher on school wifi behind a
filter that blocks cdnjs got a tool that loaded, looked completely fine, and
then silently failed the moment they clicked "Merge". Vendoring it removed that
failure mode and let `sw.js` precache it for genuine offline use, same as
every other vendored library. Same version as before, so that was a source
change only, not a version bump.

`044-Sub Plan Builder.html` carried its own separately-vendored copy of the
same 3.10.1 build in `Tools/sub-plan-builder/lib/jszip.min.js`. This round
(the vendored-library consolidation; `HISTORY.md`) confirmed the two copies were byte-identical
(normalizing CRLF→LF) and consolidated them here — one canonical copy for both
consumers, matching the treatment jsPDF/SheetJS/jsQR got in Phase 1.

## Consumers

| File | Tag |
| --- | --- |
| `Tools/031-docx-merger.html` | `<script src="../_shared/vendor/jszip/jszip.min.js">` |
| `Tools/044-Sub Plan Builder.html` | `<script src="../_shared/vendor/jszip/jszip.min.js">` |

Both are numbered tool pages in `Tools/`, so both use the same relative depth.

## Updating

Download the same file for the new version (`npm pack jszip@<version>` and
take `dist/jszip.min.js` out of the tarball, or fetch straight from cdnjs if
that host is reachable), replace it, update the version and hash above, and
run a real merge/export in both consumers by hand to confirm the output still
opens correctly (docx-merger produces a valid `.docx`, sub-plan-builder
produces a valid downloadable archive) — there is no automated smoke test for
either tool yet.
