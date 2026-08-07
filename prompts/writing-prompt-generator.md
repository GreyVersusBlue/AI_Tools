I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" (GitHub Pages site, custom domain via `CNAME`,
publicly known as AsPerMyLessonPlan.com). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Each tool's entry point is one `.html` file directly under `Tools/`.
- Supporting JS/assets for a tool live in a matching subfolder — this one
  will need one just to hold the prompt-bank data files
  (`Tools/writing-prompt-generator/prompts-ms.js`,
  `Tools/writing-prompt-generator/prompts-hs.js` or similar).
- Update the root `README.md` tools table and `index.html` landing page (plus
  `index.html`'s DEV NOTES items 4/5/6) to link the new tool once it's built.
  Also remove its `.row.soon` placeholder from `index.html`, and its entry
  from `IDEAS_BACKLOG.md` and `ideas-backlog.html`.

## The tool: Writing Prompt Generator

Goal: a "give me a random writing prompt" button by genre, for warm-ups, bell
ringers, or filler writing time.

Requirements:
- Genre categories (propose a reasonable set — e.g. narrative, persuasive/
  argumentative, descriptive, expository/informative, creative/fiction — and
  confirm before writing 100+ prompts for each).
- **Grade-band toggle**: middle school vs. high school appropriate prompts,
  switchable at any time. Content and complexity should genuinely differ
  between bands, not just be the same prompts relabeled.
- **At least 100 prompts per grade band** (so MS + HS combined is 200+ total,
  spread across the genre categories) — write real, usable, varied prompts,
  not filler/repetitive ones. Flag if you want to build this incrementally
  (e.g. ship with a smaller set per genre first for me to review the tone/
  quality, then fill out the rest) rather than writing all 200+ blind.
- "Generate" picks a random prompt from the selected genre(s) (allow
  "all genres" as an option) and grade band; a "shuffle again" avoids
  immediate repeats where practical.
- Simple, readable, big-text display suitable for projecting as a bell-ringer
  prompt.
- Nice-to-have: a small history/list of recently shown prompts in the session
  so I don't lose one I liked — use your judgment on whether to include it.

Ask me clarifying questions about the genre list and how to pace writing the
100+ prompts per band before generating all of them.
