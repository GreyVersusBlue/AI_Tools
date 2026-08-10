# Vendored fonts

The Name Picker's three families, local. Nine `.woff2` files, **96.9 KB on disk**.

| File | Bytes | Used by |
| --- | --- | --- |
| `bungee-latin-400-normal.woff2` | 14,344 | the title, winner names, tournament tiles, Hall of Fame ticker |
| `bungee-latin-ext-400-normal.woff2` | 10,712 | the same, for a name with a glyph outside Latin-1 |
| `outfit-latin-400-normal.woff2` | 14,032 | body text and every name card |
| `outfit-latin-600-normal.woff2` | 14,140 | buttons, labels, name cards |
| `outfit-latin-700-normal.woff2` | 14,060 | soundboard buttons, `<strong>` |
| `outfit-latin-ext-400-normal.woff2` | 6,380 | as above, outside Latin-1 |
| `outfit-latin-ext-600-normal.woff2` | 6,528 | as above |
| `outfit-latin-ext-700-normal.woff2` | 6,484 | as above |
| `press-start-2p-latin-400-normal.woff2` | 12,512 | the Konami retro theme, and nothing else |

**A normal first paint fetches three of them, 41.5 KB** — Bungee 400 and Outfit
400/600. Outfit 700 arrives when the settings panel opens, for 55.3 KB. The other
five are never requested unless something needs them, which is the point:

- The `latin-ext` files carry a `unicode-range`, so the browser only fetches one
  when a name on screen actually contains a glyph in that range. An all-ASCII
  roster never touches them. They are here because this tool renders student
  names, and a name is the one string on a page you do not get to approximate.
- **Press Start 2P is only ever fetched by the easter egg.** Nothing applies that
  family until `body.retro-mode` exists, and `@font-face` is lazy by definition —
  a declared face is not downloaded until it is used. Verified: three page loads
  requested it zero times, and it appeared in the network log immediately after
  the Konami code.

Vietnamese, Cyrillic and Greek subsets are not vendored. A glyph outside what is
here falls back to the system font for that character, which still renders the
name correctly.

## Source and licence

All three from [Fontsource](https://fontsource.org) v5.3.0, which repackages
Google Fonts:

| Family | Package | Designer |
| --- | --- | --- |
| Bungee | `@fontsource/bungee` | David Jonathan Ross |
| Outfit | `@fontsource/outfit` | Smartsheet / On Brand Investments |
| Press Start 2P | `@fontsource/press-start-2p` | CodeMan38 |

All three are **SIL Open Font License 1.1**. The full text of each is in
`LICENSE-bungee.txt`, `LICENSE-outfit.txt` and `LICENSE-press-start-2p.txt`,
copied from the packages. OFL permits bundling and redistribution; it asks that
the fonts not be sold on their own and that a modified version be renamed.
Neither applies here — these are the unmodified upstream files.

```
npm pack @fontsource/bungee@5 @fontsource/outfit@5 @fontsource/press-start-2p@5
```

then the `files/*-latin-*-normal.woff2` members listed above. The same twelve
`@fontsource` packages already sit in `Tools/board-check/node_modules` — none of
these three were among them, which is part of why nobody noticed the hotlink.

## Why these are in the repo

`Tools/007-Name Picker.html` used to carry two `<link rel="preconnect">` tags and a
`fonts.googleapis.com/css2?family=Bungee&family=Outfit…&family=Press+Start+2P`
stylesheet. v7 §5 recorded that the site made zero offsite requests site-wide.
That was wrong for fifteen pages, and the reason it went unnoticed is worth
keeping: `prepPage()` in `Tools/board-check/harness.mjs` **fulfils** Google Fonts
requests locally from bundled `@fontsource` packages before the blocked-list
check runs, and the browser suites only ever drive the seven games, never the
tools. So `page.__blocked` was empty and the hotlink was invisible to it.

Grepping the page for `fonts.googleapis.com` is the check that works. It is zero
now, and the network log for a real page load shows nothing leaving localhost.

Which mattered more here than on most pages: this is the tool that holds a class
list, and every time a teacher opened it, Google got the IP address of the
classroom machine.
