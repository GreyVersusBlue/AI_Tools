# pdfjs — PDF.js 3.11.174

Mozilla PDF.js, the text-extraction build used to read PDFs in the browser.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `pdf.min.js` | 320004 | `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946` |
| `pdf.worker.min.js` | 1087212 | `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b` |

Source: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/ (Apache-2.0).

Consumers: `Tools/089-progress-report-parser.html`. It loads both files with
plain `<script>` tags; the worker script defines the in-page fallback worker, so
no `workerSrc` is set.

Update: replace both files together (they must be the same version), update the
table above, and open 089 with a real Student Detail Report PDF.
