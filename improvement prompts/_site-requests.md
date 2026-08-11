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

## Fixed-height, `overflow: hidden` half-sheet print CSS silently clips content

Found/fixed 2026-08-11 in `076-sub-note-feedback-slip-generator.html` (session
`b4zswl`). The print CSS for a "two half-sheets per page" layout used
`.slip { height: 47vh; overflow: hidden; }` — if the content inside a slip
(a long prompt list, in this case) grows taller than 47vh, it gets silently
clipped with no visual sign anything is missing. This is worse than an
overflow that just looks bad, because a teacher has no way to know content
was cut off from the printed page.

**The fix applied to 076**: switch to `min-height: 47vh; overflow: visible`
and add a content-length threshold — under the threshold, keep the original
"two per page" layout (`page-break-after: always` every 2nd `.slip`); over
it, give each item its own full page instead
(`page-break-after: always` every 1st `.slip`), so nothing clips regardless
of how much content is in a single slip.

This tool's own file (`076-sub-note-feedback-slip-generator.md`, prior
Status entries) already flagged that **Peer Feedback / Editing Checklist
Generator** (`070-peer-feedback-checklist-generator.html`) and **Art Critique
Worksheet Generator** (`047-art-critique-worksheet-generator.html`) share the
identical `.slip`/half-sheet fixed-height print pattern and the identical
risk — neither has been fixed yet. Worth applying the same pattern (min-height
+ overflow: visible + a one-up fallback) the next time either tool gets a
round, rather than re-discovering the bug independently.
