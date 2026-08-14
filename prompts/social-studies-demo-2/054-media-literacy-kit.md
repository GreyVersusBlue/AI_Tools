# SS demo round 2 — 054 Current Events Guide — media literacy toolkit

Read `CLAUDE.md`, then `prompts/social-studies-demo-2/_preamble.md` and
follow it exactly (including **The differentiation spec** — it is your
first supporting item), then
`improvement prompts/054-current-events-discussion-guide-generator.md`
(Status top-down; round 1 just shipped two-article comparison, the
skate-park example pair, share link + QR, and `smoke-comparison.mjs`).

Your tool: `Tools/054-current-events-discussion-guide-generator.html`
(single file) + `Tools/current-events-discussion-guide-generator/test/`.
Uses `print-area.css`; keep everything inside `#printArea`.

## Headline — Media literacy toolkit

Turn the comparison guide into a real media-literacy lesson. Three new
printable components, each toggleable per guide:

- **Source evaluation checklist**: a student-facing checklist walking the
  SIFT moves (Stop; Investigate the source; Find better coverage; Trace
  the claim) applied to the pasted article(s), with short write-in lines
  per move. Works in single-article and two-article modes (two columns
  when comparing).
- **Headline rewrite exercise**: prints the article's real headline with
  prompts to rewrite it twice — once as neutrally as possible, once
  deliberately slanted the other way — then a "what did you have to change?"
  reflection line. In comparison mode, students also match which headline
  goes with which framing.
- **Claim vs. evidence organizer**: a two-column table where students copy
  2–3 claims from the article and the evidence given (or note "no evidence
  given"), with an "is this fact, opinion, or spin?" tag per row. The
  teacher can pre-fill rows or leave them blank for students.
- All three ship with the round-1 skate-park example so the whole kit
  demos in one click; teacher-facing copy stays honest that the tool
  scaffolds the thinking, it does not do the evaluating.

## Supporting (in order; cut from the bottom)

1. **Differentiation levels** per the preamble spec (Academic / Honors /
   Honors GT, print-all-three with footer tags). Academic gets sentence
   starters on the SIFT lines and the reflection; GT gets an added "find
   and summarize a third source's framing" extension prompt. Level stored
   with the guide; share link carries it (keep old links working).
2. **Extend the smoke suite**: each kit piece renders when toggled, SIFT
   goes two-column in comparison mode, levels change the print output,
   share link round-trips the new fields.

## Non-goals

Fetching URLs or real coverage search (offline constraint — SIFT's "find
better coverage" is a prompt to do it elsewhere, and the sheet says so);
reading-level scores; AI/API modes; a question-set library.

## Notes

- 028's session is the differentiation reference implementation; match the
  preamble spec exactly (naming, default, footer tags) so the feature feels
  identical across tools.
- No new localStorage keys expected (new fields ride the guide object);
  register any genuinely new key in `Tools/009-backup-restore.html`.
- README row + index.html pitch: mention the media-literacy kit.
