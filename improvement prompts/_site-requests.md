# Site-wide requests — shared scratch list

> This file is shared by every agent session working the improvement-prompts
> programme. If you find a problem or an opportunity that affects more than
> one tool — not specific enough to belong in a single tool's own
> `improvement prompts/<tool>.md` — add it here so other sessions see it
> without needing to re-discover it independently.
>
> This is distinct from `_platform-themes.md`, which is read-only reference
> material Devon curates. Add freely here; nothing here is authoritative
> until Devon (or a future round) acts on it.

---

## Shared design-system stylesheet loads Google Fonts over HTTPS — breaks offline/blocked-network use

Found 2026-08-10 while adding an automated smoke test to
`011-image-to-pdf.html` (Pass 2, Round 1, session `v19h3x`).

`_ds/industry-dbdf1714-c448-4b04-9ea3-c77c792b4c8a/styles.css` — a shared
design-system stylesheet referenced by at least 10 tools, including
`011-image-to-pdf.html`, `036-final_grade_checker.html`,
`005-Seating Chart Generator.html`, `031-docx-merger.html`, and others — opens
with:

```css
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap');
```

In an offline or blocked-network sandbox this `@import` fails outright
(`ERR_CONNECTION_RESET` in headless Chromium here), and it's a render-blocking
`@import` at the top of the stylesheet, not an opportunistically-cached
`<link>`. This is the exact same class of problem as the vendored-CDN-library
issue documented as **P5** in `_platform-themes.md` (three tools used to load
JS libraries from `cdnjs.cloudflare.com`; all three are now fixed by
vendoring), just for a font instead of a script — and it likely affects more
tools than the ten discovered by grepping for the exact stylesheet path,
since other tools may pull the same or a different Google Fonts URL directly
in their own `<head>` rather than through this shared file. Worth a
site-wide grep for `fonts.googleapis.com` the next time someone is doing a
P5-style pass, alongside the existing `cdnjs.cloudflare.com` grep — not just
in this one shared stylesheet.

**Suggested fix**: vendor the Barlow/Barlow Condensed font files locally
(`Tools/schedule/fonts/fonts.css` already does exactly this pattern for a
different font — self-hosted `@font-face` rules pointing at local `.woff2`
files — and would be the template to copy), the same way the three CDN-JS
tools were vendored in earlier rounds. Out of scope for a single tool's own
round since `_ds/` is shared infrastructure, not any one tool's file — flagged
here rather than fixed unilaterally, per this file's purpose.

**Workaround used in the smoke test**: the test blocks non-`file://` network
requests and filters the resulting generic connection-reset console message,
rather than fixing the shared file. This means the smoke test doesn't
actually catch a regression in the font loading itself — just doesn't fail
on the pre-existing problem it isn't scoped to fix.

---

## HTML entity written as literal text in a JS string, later passed through `escapeHtml()` — six confirmed instances, worth a dedicated sweep

Found again 2026-08-11 in `072-plot-diagram-builder.html` (Pass 2, session
`4o6xmy`), fixed as part of that tool's own round.

The bug shape: a JS string literal contains an HTML entity written as text
(e.g. `'&mdash;'`, `'&deg;'`) instead of the actual Unicode character (—,
°), and that string is later passed through the toolkit's standard
`escapeHtml()` helper before being inserted via `innerHTML`. `escapeHtml()`
escapes the leading `&` into `&amp;`, so the entity never resolves — the
page (or, worse, the printed output) shows the literal text `&mdash;`
instead of an em dash.

This is now confirmed **six times** across the toolkit, each caught by
chance during a different tool's own round rather than by a systematic
search:

1. Verb Conjugation Reference Poster Generator (`079-...html`)
2. Sub Note / Feedback Slip Generator (`076-...html`)
3. Science Fair Project Tracker (`073-...html`)
4. Government/Civics Simulation Role Card Generator (`050-...html`)
5. PE Warm-Up Circuit Card Generator (`069-...html`, in a station's
   instructions text)
6. Story Elements / Plot Diagram Builder (`072-...html`, in the print
   view's empty-field fallback text — `'&mdash;'` used four times)

Six independent hits by accident is a strong signal there are more. Worth
a dedicated site-wide grep the next time someone has a round to spare:
search every `Tools/*.html` for entity-name patterns (`&mdash;`, `&ndash;`,
`&deg;`, `&hellip;`, `&rsquo;`, `&lsquo;`, `&ldquo;`, `&rdquo;`, `&trade;`,
etc. — not `&amp;`/`&lt;`/`&gt;`/`&quot;`/`&#39;`, which are the
legitimately-escaped ones) appearing *inside a JS string literal* (i.e.
inside `'...'` or `"..."` in a `<script>` block, not inside literal HTML
markup where entities are correct as-is) rather than waiting for the next
tool's smoke test to catch instance seven by luck. The fix each time has
been the same one-line swap: replace the entity name with the actual
Unicode character in the source string.
