# JSZip — vendored

| | |
| --- | --- |
| Library | JSZip |
| Version | 3.10.1 |
| File | `jszip.min.js`, 97,630 bytes |
| SHA-256 | `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` |
| Licence | Dual MIT / GPLv3 |
| Copyright | 2009-2016 Stuart Knightley |
| Source | `dist/jszip.min.js` from the `jszip@3.10.1` npm package (identical build to `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`, which is where `docx-merger.html` used to load it from) |
| Upstream | https://github.com/Stuk/jszip |

`docx-merger.html` used to load this from cdnjs directly (see
`improvement prompts/docx-merger.md`, P5). A teacher on school wifi behind a
filter that blocks cdnjs got a tool that loaded, looked completely fine, and
then silently failed the moment they clicked "Merge" — this file removes that
failure mode, and lets `sw.js` precache it for genuine offline use like every
other vendored library. Same version as before, so this is a source change
only, not a version bump.

`Sub Plan Builder.html` has the same cdnjs JSZip dependency and has not been
vendored yet — it's a separate tool with its own improvement-prompts round.

## Updating

Download the same file for the new version (`npm pack jszip@<version>` and
take `dist/jszip.min.js` out of the tarball, or fetch straight from cdnjs if
that host is reachable), replace it, update the version and hash above, and
run a merge by hand to confirm output still opens correctly in Word — there
is no automated smoke test for this tool yet.
