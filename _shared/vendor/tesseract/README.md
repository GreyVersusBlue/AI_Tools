# tesseract — Tesseract.js 7.0.0, core 7.0.0, English model

Tesseract.js, the OCR engine behind "Make the PDF searchable" in
`Tools/011-image-to-pdf.html`. It runs entirely in the browser; the picture
never leaves the page.

**Not precached, on purpose** (Devon, 2026-10-05 and 2026-11-21). The set is
about 15 MB in the repo (a device fetches about 7 MB of it), so it is not in `sw.js`'s `PRECACHE_URLS`. Nothing here loads
until someone ticks the OCR box; the service worker's same-origin runtime cache
keeps what that use fetched, so OCR then works offline on that device until the
next `CACHE_VERSION` bump clears the runtime cache. The first use needs a
connection, and the page says so.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `tesseract.min.js` | 62961 | `000c27d9cd0def655f77b36c72a389c0ab13793aa31cb4d7aab56d09c0afbc7e` |
| `worker.min.js` | 111307 | `576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d` |
| `tesseract-core-relaxedsimd-lstm.wasm.js` | 3905767 | `861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3` |
| `tesseract-core-simd-lstm.wasm.js` | 3899472 | `c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38` |
| `tesseract-core-lstm.wasm.js` | 3896484 | `eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680` |
| `eng.traineddata.gz` | 2952873 | `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91` |

Plus the licence texts (`LICENSE-tesseract.js.md`, `LICENSE-tesseract-core.txt`,
`tesseract.min.js.LICENSE.txt`, `worker.min.js.LICENSE.txt`), kept beside the code.

Sources, from the npm registry (all Apache-2.0; the language model is Apache-2.0 too, from Tesseract's `tessdata_best`):

- `tesseract.min.js`, `worker.min.js`: `tesseract.js@7.0.0`, `dist/`.
- the three `*-lstm.wasm.js` cores (WebAssembly embedded in the script; Tesseract.js picks
  relaxed SIMD, plain SIMD or neither by what the browser supports): `tesseract.js-core@7.0.0`.
- `eng.traineddata.gz`: `@tesseract.js-data/eng@1.0.0`, `4.0.0_best_int/` (the integer
  LSTM model, 2.9 MB, which is what Tesseract.js asks for in LSTM-only mode).

English only. Another language is another `<lang>.traineddata.gz` from
`@tesseract.js-data/<lang>` in this folder.

Consumers: `Tools/011-image-to-pdf.html` (through `Tools/image-to-pdf/ocr.js`,
which injects `tesseract.min.js` only when OCR is first used; `worker.min.js`,
the core and the model are fetched by Tesseract.js itself from this folder, with
`cacheMethod: 'none'` so the service worker is the only cache).

Update: replace the files together from matching versions, update the table,
bump `CACHE_VERSION`, and run `npm run test:image-to-pdf-ocr`.
