# SheetJS (xlsx) — vendored

| | |
| --- | --- |
| Library | SheetJS Community Edition |
| Version | **0.18.5** |
| File | `xlsx.full.min.js`, 881,727 bytes (861 KB) |
| SHA-256 | `c9506197caf809a075b6dee1da0d36fb19da7158ffe8a88e7b0c96c5d8623c99` |
| Licence | Apache-2.0 |
| Source | `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js` |
| Upstream | https://github.com/SheetJS/sheetjs |

`xlsx.full.min.js` does not carry its licence text in the file. SheetJS
published the community edition through 0.18.x under Apache-2.0; the upstream
`LICENSE` is at
[github.com/SheetJS/sheetjs/blob/v0.18.5/LICENSE](https://github.com/SheetJS/sheetjs/blob/v0.18.5/LICENSE).

Phase 1 found two copies of this file (`final-grade-checker/libs/` and
`review-game-board/libs/`) at different byte counts — 881,727 vs 881,749. They
were the same 0.18.5 build; the 22-byte gap was 22 CRLF line endings. This is
the LF copy.

## Consumers

| Tool | How it loads | What it does with it |
| --- | --- | --- |
| `Tools/030-review-game-board.html` | injected on demand via `XLSX_LIB` | reads an uploaded spreadsheet of questions, writes the import template |
| `Tools/036-final_grade_checker.html` | injected on first Export Excel press | writes `final_grades.xlsx` |

## Nothing loads it until a button is pressed

861 KB on every page load, for pages whose main job is adding up numbers or
showing a game board, would be a bad trade — most visits never export anything.
So neither tool puts it in a `<script src>` tag; both inject it on first use and
it comes off local disk, so the second press is instant.

## If 861 KB starts to matter

For the Final Grade Checker this library is used for exactly one thing: writing
`final_grades.xlsx`. It never reads a spreadsheet there (the import path is a
paste box), and a CSV export would produce a visually identical file at 0 KB of
library, because SheetJS Community drops cell styling on write anyway. That is a
call for Devon to make, not a cleanup to do quietly. Review Game Board does read
spreadsheets, so it needs the real thing regardless.

## Updating

0.18.5 is the last Apache-2.0 community release distributed through the public
npm/cdnjs channels; SheetJS moved later versions to its own registry. Check the
licence terms before jumping versions. After any update, exercise both
consumers' export buttons by hand — neither tool has a test suite.
