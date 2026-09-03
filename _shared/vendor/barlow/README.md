# `_shared/vendor/barlow/` — Barlow and Barlow Condensed

Twelve woff2 files, 222,160 bytes total, plus `barlow.css`, which declares
them. They replace the `@import url('https://fonts.googleapis.com/…')` that
`_ds/industry-dbdf1714-c448-4b04-9ea3-c77c792b4c8a/styles.css` used to open
with, so the design-system pages no longer reach off-site for their typeface
and keep it offline.

| Family | Weights here | Subsets | Licence | Source |
| --- | --- | --- | --- | --- |
| Barlow | 400, 500, 600, 700 | latin, latin-ext | SIL Open Font License 1.1 | Google Fonts, `s/barlow/v13` |
| Barlow Condensed | 600, 700 | latin, latin-ext | SIL Open Font License 1.1 | Google Fonts, `s/barlowcondensed/v13` |

Both families are by Jeremy Tribby ([tribby.com/fonts/barlow](https://tribby.com/fonts/barlow/)),
licensed under the SIL Open Font License 1.1 — free to bundle and redistribute
with the site.

## Files

Fetched 2026-09-03 from the exact `fonts.gstatic.com` URLs the Google Fonts
CSS endpoint returned for
`css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap`
(with a Chrome user agent, so the response was the woff2 build with
per-subset `unicode-range`). Named `<family>-<subset>-<weight>-normal.woff2`
to match `Tools/schedule/fonts/` and `Tools/name-picker/fonts/`.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `barlow-latin-ext-400-normal.woff2` | 14,268 | `122b24bc2a90b0abe189f5229768bf2e9ba641324fe2459b48850079625934f1` |
| `barlow-latin-400-normal.woff2` | 22,196 | `b0a8ad37ac45f5fb22ced461576db72e44e295107aad7a9c8a7a4bad728fd03b` |
| `barlow-latin-ext-500-normal.woff2` | 14,416 | `3facdf66b60778c7e64693013be7799e6686b2488dad65525b4036e211ab03e0` |
| `barlow-latin-500-normal.woff2` | 22,008 | `cd759df8ef9efc98fee14307b4eb5ba27f08b1f8f2f3ad2872432e25c89907a8` |
| `barlow-latin-ext-600-normal.woff2` | 14,968 | `b7f099c421968b583734bc631e6706bff8fc23908112a219f5f0e37f59b03b32` |
| `barlow-latin-600-normal.woff2` | 22,772 | `4b52ddd4836b592df0e4832b8286956883cdc651b015126bdd18f184b7f90cc3` |
| `barlow-latin-ext-700-normal.woff2` | 14,836 | `88c786d5fa8700a201615bc7b8ede09d209ec5d08cc3dd0a30ea1c4baff3476f` |
| `barlow-latin-700-normal.woff2` | 22,788 | `2d797dd8b35dcb3413e1af9d7052b3f4f8c341a147cdcb01f4f06af80db53289` |
| `barlow-condensed-latin-ext-600-normal.woff2` | 14,516 | `aef7edf54f79a5329fbca9c065b56dcec3852c680d58cf89a9ef2db6940ca4b3` |
| `barlow-condensed-latin-600-normal.woff2` | 22,308 | `215a93c696f442034a46fbb382958f753fda60e30490683aeea6b235fcbb2b66` |
| `barlow-condensed-latin-ext-700-normal.woff2` | 14,640 | `9d351bd9222bfab90f943850f8039aa73cdb40e0a6cfe4127308a48bef59d5f5` |
| `barlow-condensed-latin-700-normal.woff2` | 22,444 | `3787a5a419171630e6890cfa47c4da067474d005cd0ff8dc11ec090fdc3ee2b8` |

Source URLs, for re-fetching or re-verifying:

- `barlow-latin-ext-400-normal.woff2` ← `https://fonts.gstatic.com/s/barlow/v13/7cHpv4kjgoGqM7E_Ass52Hs.woff2`
- `barlow-latin-400-normal.woff2` ← `https://fonts.gstatic.com/s/barlow/v13/7cHpv4kjgoGqM7E_DMs5.woff2`
- `barlow-latin-ext-500-normal.woff2` ← `https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3_-gs6VospT4.woff2`
- `barlow-latin-500-normal.woff2` ← `https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3_-gs51os.woff2`
- `barlow-latin-ext-600-normal.woff2` ← `https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E30-8s6VospT4.woff2`
- `barlow-latin-600-normal.woff2` ← `https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E30-8s51os.woff2`
- `barlow-latin-ext-700-normal.woff2` ← `https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3t-4s6VospT4.woff2`
- `barlow-latin-700-normal.woff2` ← `https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3t-4s51os.woff2`
- `barlow-condensed-latin-ext-600-normal.woff2` ← `https://fonts.gstatic.com/s/barlowcondensed/v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B4873z3jWuZEC.woff2`
- `barlow-condensed-latin-600-normal.woff2` ← `https://fonts.gstatic.com/s/barlowcondensed/v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B4873z3bWuQ.woff2`
- `barlow-condensed-latin-ext-700-normal.woff2` ← `https://fonts.gstatic.com/s/barlowcondensed/v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2z3jWuZEC.woff2`
- `barlow-condensed-latin-700-normal.woff2` ← `https://fonts.gstatic.com/s/barlowcondensed/v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2z3bWuQ.woff2`

## What is not here, and why

**No vietnamese subset.** Google served one for every face; nothing on the
site sets Vietnamese text, and the browser falls back per-glyph to the next
family in the stack for anything outside `latin`/`latin-ext`.

**No italics.** The old URL never requested any, so italics on these pages
have always been synthesised by the browser. Shipping real ones would change
how the tools look, which is a design decision, not part of removing a network
dependency.

## Consumers

- `_ds/industry-dbdf1714-c448-4b04-9ea3-c77c792b4c8a/styles.css` — the only
  direct reference (`@import url('../../_shared/vendor/barlow/barlow.css')`).
  Through it: `Tools/005-Seating Chart Generator.html`,
  `Tools/011-image-to-pdf.html`, `Tools/029-prompt-builder.html`,
  `Tools/031-docx-merger.html`, `Tools/036-final_grade_checker.html`, and the
  archived pages under `Tools/New Designs/`.

All thirteen files are in `sw.js` `PRECACHE_URLS`. `check-precache.mjs` does
not follow CSS `@import`/`url()` references, only HTML `src`/`href` and
`manifest.json`, so a file added or renamed here has to be added to the list
by hand.

## Updating

Re-fetch the CSS endpoint above with a Chrome user agent, download the
`latin` and `latin-ext` URLs, replace the files, update the table and hashes
here, then open each consumer offline and confirm the headings are still in
Barlow Condensed (DevTools → Rendered Fonts, or
`document.fonts.check('600 16px "Barlow Condensed"')`).
