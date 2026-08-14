# SS demo round 2 — 028 Primary Source Analysis — differentiation + source library

Read `CLAUDE.md`, then `prompts/social-studies-demo-2/_preamble.md` and
follow it exactly (including **The differentiation spec** section — it is
your headline), then
`improvement prompts/028-primary-source-analysis-generator.md` (Status
top-down; round 1 just shipped corroboration mode, the Boston Massacre
example, share-link extensions, and `smoke-corroboration.mjs`).

Your tool: `Tools/028-primary-source-analysis-generator.html` (single file)
+ `Tools/primary-source-analysis-generator/test/`.

## Headline — Differentiation levels (the spec in the preamble)

Devon teaches Academic, Honors, and Honors GT sections of the same course;
this is the flagship implementation of the three-level switch, so build it
exactly to the preamble spec:

- Level selector (`Academic` / `Honors` / `Honors GT`, default Honors =
  today's output), stored with the worksheet.
- `Academic`: sentence starters under each open framework question (derived
  from the question itself, e.g. "The author's purpose was ___ because
  ___"), key vocabulary from the teacher's source text glossed in plain
  language under the source, multi-part questions chunked into lettered
  steps.
- `Honors GT`: open-ended variants, an added synthesis question ("So what?
  Why does this source matter beyond its moment?"), less pre-lined answer
  space.
- Works in BOTH single-source and corroboration modes, and on the answer
  key (the key notes what each level's expected depth looks like).
- **"Print all three levels"** produces three class sets in one print flow,
  each page footer-tagged with its level.
- The share link carries the level; update the payload validator (it has
  rotted before when fields were added) and keep **backward compatibility
  with round-1 links** — another tool (056) generates 028-format links this
  round, so old-format links must keep working.

## Supporting (in order; cut from the bottom)

1. **Tagged source library**: save a source (text/description/image +
   citation) independent of any worksheet, with free-text tags (unit,
   topic, era). A library panel lists sources filterable by tag; building a
   worksheet can pull Source A / Source B from the library instead of
   retyping. New localStorage keys → register in
   `Tools/009-backup-restore.html` `KNOWN_GROUPS`; keep image downscaling;
   warn near quota like siblings do.
2. **Annotation callouts**: optionally number 2–4 teacher-chosen excerpts
   of the source text and print them as numbered margin callouts with a
   "look closely at this line" question each.
3. **Extend the smoke suite**: level switch changes print output (starters
   present at Academic, absent at Honors), print-all-three produces three
   tagged sets, library round-trips a tagged source into a worksheet.

## Non-goals

Auto-generated reading-level rewrites of the source text itself (scaffolds
frame the teacher's text; they never rewrite it); OCR; 3+ source
corroboration; renaming legacy `gvb-*` keys.

## Notes

- This is the reference implementation of the differentiation spec — 054
  and 056 sessions copy your pattern's spirit, so keep the spec-visible
  parts (naming, defaults, footer tags) exactly as the preamble states.
- README row + index.html pitch: mention leveled printing ("one worksheet,
  three class sets").
