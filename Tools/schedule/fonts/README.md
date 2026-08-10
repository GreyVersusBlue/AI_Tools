# Vendored fonts — Schedule Visualizer

Eleven woff2 files, 163,380 bytes total. They replace a `fonts.googleapis.com`
stylesheet link in `Tools/035-schedule-visualizer.html` and another one that the
generator baked into every Schedule Browser file it published.

| Family | Weights here | Licence | Source |
| --- | --- | --- | --- |
| DM Sans | 400, 500, 600, 700 | SIL Open Font License 1.1 | [`@fontsource/dm-sans`](https://www.npmjs.com/package/@fontsource/dm-sans) 5.3.0 |
| DM Mono | 400, 500 | SIL Open Font License 1.1 | [`@fontsource/dm-mono`](https://www.npmjs.com/package/@fontsource/dm-mono) 5.3.0 |
| Fraunces | 600 | SIL Open Font License 1.1 | [`@fontsource/fraunces`](https://www.npmjs.com/package/@fontsource/fraunces) 5.x, already on disk under `Tools/board-check/node_modules/` |
| Public Sans | 400, 500, 600, 700 | SIL Open Font License 1.1 | [`@fontsource/public-sans`](https://www.npmjs.com/package/@fontsource/public-sans) 5.x, same |

All eleven are the `latin` subset, not `latin-ext`. Upstream files are named
`<family>-latin-<weight>-normal.woff2` and were copied without renaming.

Nothing at runtime references `node_modules`. DM Sans and DM Mono were not
among the twelve `@fontsource` packages already in `Tools/board-check`, so they
were installed into a scratch directory and the two files copied out;
`Tools/board-check/package.json` was not touched.

## What is not here, and why

**No italics.** The Google URL never requested any either, for any of the four
families. The six `font-style: italic` rules in the visualizer and the two in
the Schedule Browser stylesheet have always been synthesised by the browser.
Shipping real italics would change how the tool looks, and that is a design
decision, not part of removing a network dependency.

**No DM Sans 300, no Fraunces 300, no Fraunces 300-italic.** The old Google URL
pulled all three. `font-weight: 300` appears zero times in the page and every
`--font-display` rule sets `font-weight: 600` explicitly, so all three were
downloaded on every page load and never drawn.

**Public Sans was not in the old URL at all**, which was a bug rather than an
economy: `BR_CSS` sets `font-family:'Public Sans'` and the visualizer never
loaded it, so the Schedule Browser rendered in `system-ui` inside the tool and
in Public Sans once published. Same stylesheet, two different results. Adding
the four weights here is what makes the preview honest.

## The two consumers

`fonts.css` is for `035-schedule-visualizer.html`, which is served from the site
and can reference these files by relative path.

`published-fonts.js` is for the files the generator *publishes*. Those are
single HTML files that get downloaded and emailed to staff, so they have no
folder next to them and cannot use a path. It is a generated file: five faces
(Fraunces 600 plus the four Public Sans weights), 76,576 bytes of woff2,
base64-encoded into one CSS string, 103,058 bytes of JavaScript. Base64 costs
34.6%.

Rebuild it after changing any woff2 file in this folder:

```bash
node Tools/schedule/fonts/build-published-fonts.mjs
```

A published Schedule Browser is therefore about 100 KB bigger than it used to
be and renders identically with no network at all. The version it replaced was
58 KB and rendered in Times New Roman on any machine behind a filter that
blocks Google Fonts, which is most school wifi.
