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

Byte-for-byte copy of `Tools/image-to-pdf/lib/jspdf.umd.min.js` — same version,
so this is a path change and nothing else. Used by `046-blank-map-generator.html`'s
"Save PDF" export: the finished map is rasterized to a canvas at the selected
page format's exact physical dimensions, then embedded as a single full-page
image so the output PDF has genuinely correct page size/aspect ratio instead
of relying on the browser's print-to-PDF dialog. "Save Worksheet PDF" uses it
the same way, one `addPage()` per worksheet/answer-key page.

## Updating

Download the same file for the new version, replace it, update the version
and hash above, and regenerate a PDF once by hand (Save PDF, on any project)
to confirm output still looks right — there is no automated smoke test for
this tool yet.
