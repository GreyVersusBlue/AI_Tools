# jsPDF — vendored

| | |
| --- | --- |
| Library | jsPDF |
| Version | 2.5.1 (built 2022-01-28) |
| File | `jspdf.umd.min.js`, 364,463 bytes |
| SHA-256 | `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875` |
| Licence | MIT |
| Copyright | 2010-2021 James Hall, 2015-2021 yWorks GmbH |
| Source | `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` |
| Upstream | https://github.com/parallax/jsPDF |

Byte-for-byte copy of `Tools/schedule/libs/jspdf/jspdf.umd.min.js` — same
version, so this is a path change and nothing else. `image-to-pdf.html` used
to load this from cdnjs directly (see `improvement prompts/image-to-pdf.md`,
P5). A teacher on school wifi behind a filter that blocks cdnjs got a tool
that loaded, looked completely fine, and then silently failed the moment they
clicked "Generate PDF" — this file removes that failure mode, and lets `sw.js`
precache it for genuine offline use like every other vendored library.

## Updating

Download the same file for the new version, replace it, update the version
and hash above, and regenerate the PDF once by hand to confirm output still
looks right — there is no automated smoke test for this tool yet.
