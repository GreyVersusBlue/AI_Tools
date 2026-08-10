# Vendored libraries

The Final Grade Checker used to pull all three of these from
`cdnjs.cloudflare.com` on every page load. They are here now, at the same
versions, and the page loads them from disk.

| File | Library | Version | Licence | Size |
| --- | --- | --- | --- | --- |
| `xlsx.full.min.js` | [SheetJS Community Edition](https://sheetjs.com/) | 0.18.5 | Apache-2.0 | 861 KB |
| `jspdf.umd.min.js` | [jsPDF](https://github.com/parallax/jsPDF) | 2.5.1 | MIT | 356 KB |
| `jspdf.plugin.autotable.min.js` | [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | 3.6.0 | MIT | 37 KB |

**1,284,216 bytes, 1.22 MB for the three.** Byte-for-byte as served by cdnjs on
2026-07-28, fetched from:

```
https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.6.0/jspdf.plugin.autotable.min.js
```

`jsPDF` and `jsPDF-AutoTable` carry their MIT notices in the file header.
`xlsx.full.min.js` does not carry its licence text; SheetJS published the
community edition through 0.18.x under Apache-2.0, and the upstream
`LICENSE` is at
[github.com/SheetJS/sheetjs/blob/v0.18.5/LICENSE](https://github.com/SheetJS/sheetjs/blob/v0.18.5/LICENSE).

## None of this loads until you press a button

1.22 MB on every page load, for a page whose main job is adding up four
numbers, would be a bad trade, and it would be worse than a bad trade here,
because most visits never export anything.

So nothing is in a `<script src>` tag. `loadLibs()` in the page injects the
scripts the first time an export button is pressed, and only the ones that
button needs:

- **Export PDF** pulls `jspdf.umd.min.js` and `jspdf.plugin.autotable.min.js`. 393 KB
- **Export Excel** pulls `xlsx.full.min.js`. 861 KB
- **Everything else** pulls nothing. The page is 0 KB of library.

They come off local disk, so the second press is instant and the first one is
not a network round trip.

## Why they are in the repo at all

The hotlinks were three real offsite requests in production, on the one page in
this repo that handles student grades. Two problems, and the smaller one is the
privacy problem:

- A teacher on school wifi with cdnjs behind the content filter got a tool
  whose export buttons silently did nothing. The failure showed up at the
  moment of use, not at load.
- `xlsx` was being fetched from a third-party CDN in order to write a
  spreadsheet of student grades.

Vendoring settles both, and it matches what v4 decided for three.js and what v7
decided for Golden Hour's sand. Each project keeps its own copy (locked
decision #17). `Tools/011-image-to-pdf.html` also uses jsPDF and gets its own,
because a shared `Tools/libs/` would couple two tools that other threads are
editing right now.

## If 861 KB starts to matter

`xlsx.full.min.js` is 67% of the total and it is used for exactly one thing:
writing `final_grades.xlsx`. It never reads a spreadsheet. The import path is
a paste box. A CSV export would produce a visually identical file at 0 KB of
library, because SheetJS Community drops cell styling on write anyway (checked:
`xl/styles.xml` in the output has one font and no fills). That is a call for
Devon to make, not a cleanup to do quietly, so the Excel button still works and
the library is still here.
