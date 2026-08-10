# Vendored library

`jspdf.umd.min.js` — the PDF assembly engine this tool exists to run. 357 KB (365,730
bytes).

Source: [jsPDF](https://github.com/parallax/jsPDF), version **2.5.2**, fetched from
`cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js`. Licence: **MIT**.

## Why 2.5.2 and not 2.5.1 or the 4.x line

The page was pulling 2.5.1 from cdnjs before this session. 2.5.2 is the last patch
release on the same 2.x line — same constructor, same `addImage`/`addPage` calls this
file uses, nothing to re-test. The diff between the two is seven commits: a unicode
font fix and three dependency security bumps (`dompurify`, `fflate`, `core-js`), no
API changes.

jsPDF has since moved to 3.x and 4.x (currently 4.2.1). Skipped deliberately: two
major version jumps is a bigger change than a single-page tool with no test suite
should absorb sight unseen, and the 4.2.1 UMD build is 420 KB — bigger, not smaller,
so there's no size argument for going there either. If a future session needs a 3.x
or 4.x feature, re-evaluate then and update this note.

## Why vendored instead of hotlinked

It used to load from `cdnjs.cloudflare.com`. Two problems with that:

- A school network's content filter blocking cdnjs left the page loading fine and
  then silently failing on click — the worst failure mode for a single-button tool.
- It was a real offsite request from a page that otherwise makes none, and the site
  aims for zero (see `gvb-site-handoff-v7.md` §5).

357 KB is nothing against a repo whose Castle Conundrum asset kit alone is 178 MB.

## Not shared with the other tools that use jsPDF

`Tools/036-final_grade_checker.html` and `Tools/Schedule Visualizer and Browser Generator
v60.html` also use jsPDF. Each vendors its own copy rather than pointing here — a
duplicated file beats a cross-tool dependency and a merge conflict between sessions
working on different tools at the same time.
