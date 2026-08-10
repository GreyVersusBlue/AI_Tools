# Vendored fonts

Three files, **143 KB** (146,400 bytes) total:

| File | Bytes | What it is |
| --- | --- | --- |
| `fraunces-latin.woff2` | 67,304 | Fraunces, variable, `opsz 9..144` + `wght 100..900`, latin subset |
| `spline-sans-latin.woff2` | 57,984 | Spline Sans, variable, `wght 300..700`, latin subset |
| `spline-sans-latin-ext.woff2` | 21,112 | Spline Sans, same axis, latin-ext subset |

Both families are **variable** fonts, so one file covers every weight the page uses.
That is why there is no stack of static 500/600/700 files here: the `@font-face`
rules in `Tools/005-Seating Chart Generator.html` declare a weight *range*, and
Fraunces' optical-size axis is driven by `font-optical-sizing: auto` off the
font-size, which is the behaviour the old Google hotlink was asking for with
`opsz,wght@9..144`.

Source: the woff2 files Google Fonts serves for
`css2?family=Fraunces:opsz,wght@9..144,...&family=Spline+Sans:wght@400;500;600;700`,
fetched from `fonts.gstatic.com` (Fraunces v38, Spline Sans v16) with a current
Chrome user-agent — that header is what makes the API hand back the variable
files rather than static ones.

Licences: both are **SIL Open Font License 1.1**, copied here as
`OFL-Fraunces.txt` (Copyright 2020 The Fraunces Project Authors) and
`OFL-SplineSans.txt` (Copyright 2021 The Spline Sans Project Authors). The OFL
asks that the licence travel with the font, so it does.

## Why they are in the repo

The page used to `<link>` both families from `fonts.googleapis.com`. That is the
one page on this site where an offsite request is worth caring about beyond
principle: **a seating chart is a list of student names**, and the request went
out while that list was on screen. It handed Google the IP address of every
teacher who opened the tool, and it meant a chart could not be built at all on a
locked-down or offline classroom machine — the names would render in Georgia and
Segoe UI, which is survivable, but the request still went out first.

Handoff v7 §5 claimed the site made zero offsite requests site-wide. That was
wrong for this page and fourteen others. The reason nobody noticed: `prepPage()`
in `Tools/board-check/harness.mjs` *fulfills* Google Fonts requests locally from
its bundled `@fontsource` packages before the blocked-list check runs, so a font
hotlink never reaches `page.__blocked`. The check for this one is a grep for
`fonts.googleapis.com` (zero hits) plus `document.fonts.check()` in
`test/drive-seating.mjs`, which also asserts that 700 measures wider than 300 —
a static file faking a variable one would measure identically.

## What was measured and dropped (locked decision #42)

All five subsets Google offered came down first, at 225,488 bytes:

- `fraunces-latin-ext.woff2` (59,388) — **dropped.** Fraunces only renders the
  page heading and the printed section title. A section a teacher names with a
  Polish or Turkish letter falls back to Georgia for that glyph.
- `fraunces-vietnamese.woff2` (19,700) — **dropped**, same reason.

Spline Sans keeps both subsets because it is the font every **student name**
renders in, and latin-ext covers the Central and Eastern European letters that a
class roster genuinely contains. Spline Sans has no Vietnamese subset on Google
Fonts at all, so a name like Nguyễn renders its diacritics from a system font;
that is a per-glyph fallback, not a broken name.
