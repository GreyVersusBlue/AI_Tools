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

Byte-for-byte the file `Tools/schedule-visualizer.html` used to load from
cdnjs. Same version, so this is a path change and nothing else.

## Why it is here

The visualizer's "Export as PDF" button is the only consumer, at what used to
be line 14304. The privacy argument for vendoring is the weaker one. The
practical argument is that a teacher on school wifi behind a filter that blocks
cdnjs gets a tool that loads, looks completely fine, and then does nothing when
they click Export — the failure happens at the moment of use, not at load, so
it reads as a broken button rather than a blocked request.

The tag is still `defer`, so nothing about load order changed.

## Updating

Download the same file for the new version, replace it, update the version and
hash above, and re-run the smoke suite — `node Tools/schedule/test/smoke.mjs`
asserts that a PDF actually comes out, which is the part a wrong path breaks.
