# Improvement Prompts — 029 — Prompt Builder

**Tool file:** `Tools/029-prompt-builder.html`
**Support folder:** none — single file

**Current description (from README):** _(Not currently listed in the README tools table — worth adding.)_ Builds a well-structured prompt for an AI assistant from a guided form, with presets for common teacher tasks.

---

## Status

**2026-08-12 — session `r8kq4t`.** Backlog rank 1 (as it stood):
`{{placeholder}}` tokens with a fill-in panel.

- **The load-bearing decision is that substitution happens on the way *out*.**
  `fill()` is the single funnel every field value passes through to reach the
  built prompt, so that is where tokens are replaced — and the fields
  themselves keep the placeholder. Substituting into the fields would work
  exactly once and then quietly turn a template back into a one-off: the
  failure would be invisible until next unit, when the saved preset came back
  with last month's topic already baked in. The suite asserts the field still
  reads `{{topic}}` after the value has been filled and copied.
- **A preset is the template; the values are this unit's answers.** Placeholder
  values live in the draft, not in a preset — `applyFieldsFromData` clears them
  and only the draft-restore path puts them back. That is what makes "apply the
  preset, fill three blanks, go" the workflow.
- **An unfilled placeholder stays visible in the output**, marked loudly, with
  a count of what is outstanding. A prompt that still says `{{topic}}` when it
  reaches an AI is a wasted round trip; a prompt with a silent hole in it is
  worse.
- `{{ Topic }}` and `{{topic}}` are one blank — case and spacing are
  normalised, or the panel would ask the same question twice.
- **The panel is only rebuilt when the *set* of placeholders changes**, not on
  every keystroke, so typing a value does not replace the input being typed
  into. Same class of bug as the Formula Sheet Builder's tick boxes this round.
- **New suite:** `Tools/prompt-builder/test/smoke-placeholders.mjs`, 28 checks,
  wired into `npm test` and `npm run test:prompt-builder` — the first
  automated coverage this tool has had. It caught one real bug: token values
  were written to the draft but never read back, so a refresh lost every blank.

**Where the next round should pick up:** the task-organised prompt library on
the ranked backlog is the obvious partner to this — a built-in library of
templates is only worth having if the templates have blanks in them, which
they now can.

**2026-08-10 — Round 5 (PR #56): five Quick Wins shipped.**

- **Done — Added to the README.** Both this tool and `016-qr-code-generator.html`
  (also missing) got a row in the README tools table. Neither was missing
  from the landing page (`index.html` already had both) — only the README
  was stale.
- **Done — Guardrail reminder.** A visible (not preachy) banner under the
  page tagline: this is the one tool on the site whose whole purpose is
  sending text somewhere else, and it says so plainly, with a reminder to
  leave out student names/grades. Resolves the first Open Question below —
  Devon didn't need to weigh in beyond what shipped; it's a one-line banner,
  not a modal or a blocking gate.
- **Done — Strength meter explained.** Below the strength bar, a new hint
  line names the 1-2 highest-impact unfilled fields (from a fixed
  `IMPACT_FIELDS` priority list: what you're building, grade, subject,
  topic, learning goal, students to keep in mind, format, tone, what to
  avoid) rather than just showing a bare percentage.
- **Done — Paste-the-result-back field.** Each entry in prompt history can
  now be expanded to paste in what the AI actually returned; it's saved
  alongside that prompt in `promptBuilderHistory_v1` (new optional `result`
  field, old entries without one still render fine). Typing in the result
  textarea doesn't trigger a full list re-render (would steal focus
  mid-paste) — only the toggle button's label updates live.
- **Done — Output-shape presets tied to the toolkit.** Three new presets:
  "Review game questions" (asks for the exact `Category,Points,Question,
  Answer` CSV header `030-review-game-board.html` imports), "Vocab list" (the
  `term: definition` — optionally `| example sentence` — format
  `040-vocab-flashcard-generator.html` parses), and "Exit ticket prompts" (a
  plain numbered list). This is the first slice of the "AI as content
  supplier for the whole site" moonshot — output shape matched by hand per
  preset, no shared schema yet.

Verified with a headless Chromium smoke test: banner renders, strength hint
text updates on a field change, all three new presets produce prompt text
containing the exact format strings above, prompt history captures a result,
the toggle label updates live, and the result **persists across a page
reload** (confirms the localStorage round-trip). No console errors (aside
from an unrelated network probe the sandboxed test environment itself
generates).

**Where a future round should pick up:** prompt versioning/comparison,
`{{variable}}` templates with saved defaults, and a task-organized prompt
library are all still open (Major Features below). The output-shape-preset
idea could go much further — e.g. matching Rubric Builder's actual JSON
export shape, not just a CSV/text convention.

Ideas below are deliberately ambitious and are **not** scoped to a single
session.

## Pass 2 — Round 2 update — 2026-08-11 (session `mxpfjs`)

Two still-open Quick Win / Major Feature items shipped, both fully wired
(no orphaned CSS or scaffolding):

- **Redaction helper.** New standalone card below the main form (outside
  `<form id="promptForm">` so "Clear everything" doesn't touch it): paste
  text, list names to redact (comma or line separated), optionally check
  "Also try auto-detecting capitalized names." Clicking **Redact** produces
  a result box with each unique name replaced consistently by `Student A`,
  `Student B`, etc. (longest names replaced first so a full name and a bare
  first name don't double-match), plus a copy button. The auto-detect
  checkbox and the hint text under it are explicit that it's a blunt
  capitalized-word heuristic — it will miss real names and flag non-names —
  and the result hint repeats that caveat whenever auto-detect was used.
  Nothing here is persisted; it only runs on click.
- **Prompt history search and pinning.** A search box above the history
  list (`#historySearch`) filters visible entries by substring match
  against either the saved prompt or its saved result. Each history entry
  now has a pin toggle (📌 button); pinned entries render above unpinned
  ones regardless of recency, survive being pushed out when the list is
  trimmed to `PROMPT_HISTORY_MAX`, and the `pinned` flag persists in
  `promptBuilderHistory_v1` across reloads. History rows switched from
  index-based `data-*-i` attributes to a stable per-entry `id` (existing
  entries without one get one assigned on first load) so pin/search
  re-sorting doesn't desync row actions from the wrong entry.

**Testing performed:** `node --check` on all three inline `<script>` blocks
(the two ran clean). Headless Chromium smoke test via
`/opt/pw-browsers/chromium` over `file://`, covering: redacting a repeated
name and a second name across one passage replaces both consistently and
distinctly (`Student A` / `Student B`, no leftover raw names); adding five
prompts to history, pinning one, then adding two more, newer prompts —
pinned entry stays first; the search box filters the list down to exactly
the matching entry; and a full page reload after all of that still shows
the pinned entry on top (confirms the localStorage round-trip). Zero
console errors from page script — the only network failure seen was the
sandboxed test environment's own blocked Google Fonts request, unrelated
to this change and pre-existing on the page.

**Still open** (see Major Features below): output-shape presets matched to
more of the toolkit's actual JSON/export shapes (not just CSV/text
conventions), a task-organized prompt library, prompt versioning/
comparison, and `{{variable}}` templates with saved defaults.

## What it does today

- **Simple / Advanced** modes (`setMode`, `promptBuilderMode_v1`)
- Task presets: Lesson plan, Quiz, Rubric, Parent email, Differentiated
  materials — plus a task-type dropdown (activity, slide presentation, email)
- Structured fields with **dynamic sub-fields per task type**
  (`renderDynamicFields`), tone selection (warm, formal, direct, playful,
  humorous, matter-of-fact), and a **prompt strength meter** (`updateStrength`)
- Builds the prompt live; **Copy**, **Download .txt**, **Copy shareable link**
- **Send to app**: ChatGPT, Claude, Gemini deep links
- Saved custom presets (`promptBuilderCustomPresets_v1`), prompt history
  (`promptBuilderHistory_v1`), autosaved draft (`promptBuilderDraft_v2`)
- Loads `_shared/theme.css` and `_shared/a11y.js`

## Quick Wins

- **Done —** **Add it to the README and the landing page.** It's invisible right now.
  *(Landing page already had it; README was the actual gap.)*
- **Done —** **A "paste your result back" field.** The workflow is build → copy → use
  elsewhere → and then nothing. Letting the teacher paste the AI's output back
  in, saved alongside the prompt, turns history into a genuinely useful record
  of what worked.
- **Done —** **Explain the strength meter.** Tell the teacher *what* would make the
  prompt stronger, not just that it's weak — that's the teaching moment.
- **Done —** **More presets aimed at this site's own outputs**: "write 20 review
  questions I can paste into the Review Game Board", "write 10 exit ticket
  prompts", "write a rubric I can type into Rubric Builder". Prompts that
  produce data in the exact shape another tool imports (P7) would be the
  single most useful thing this tool could do. *(Rubric preset already
  existed with a "table" format; shipped review-board CSV, vocab list, and
  exit-ticket presets net-new.)*
- **Done —** **Guardrail reminders.** A visible, non-preachy note about not pasting
  student names or grades into a third-party AI service — this site's entire
  premise is that data stays local, and this is the one tool that sends the
  user somewhere it won't.
- **Done — Pass 2, Round 2.** **Prompt history search and pinning.** Export the
  whole history is still open.

## Major Features

- **Output-shape presets tied to the toolkit.** Generate a prompt that asks
  for CSV in exactly the columns `030-review-game-board.html` imports, or a
  `term: definition` list for `040-vocab-flashcard-generator.html`, or a rubric
  in Rubric Builder's JSON shape — with a "paste the result here" box that
  hands it straight to that tool (P7). This would make the AI a content
  supplier for the whole site without any of the tools themselves needing an
  API key or a network call.
- **A prompt library organized by teaching task**, not by prompt technique —
  differentiation, translation for families, reading-level adjustment, IEP
  accommodation ideas, feedback comment banks, parent communication for
  difficult conversations.
- **Prompt versioning and comparison.** Keep v1 and v2 of a prompt with notes
  on what changed and which worked better — the actual skill of prompting,
  made visible.
- **Templates with variables.** `{{subject}}`, `{{grade}}`, `{{unit}}` filled
  from saved defaults, so a teacher's standing context (7th grade, social
  studies, this district) is never retyped.
- **Done — Pass 2, Round 2.** **Redaction helper.** Paste text containing
  student names, and have the tool replace them with Student A / Student B
  before you send it anywhere — a small feature that directly serves the
  site's privacy stance.

## Moonshot / North Star

**The bridge between an AI assistant and this toolkit, with the privacy line
drawn clearly.** A teacher describes what they need in plain language, gets a
prompt engineered for it, sends it to whichever assistant they use, pastes the
result back, and it lands as usable data in the right tool — questions in the
review board, vocabulary in the flashcards, a rubric in the rubric builder —
with names redacted on the way out and nothing stored anywhere but their own
browser.

## Platform themes that matter here

- **P7 (cross-tool)** — the output-shape-matching idea is what makes this tool
  more than a text box, and it touches most of the site.
- **P1 (theme)** — already loads `theme.css`; still needs the toggle.
- **P15 (first run)** — presets exist and are the right idea; a task-organized
  library is the fuller version.

## Open Questions

- **Resolved 2026-08-10.** The site's promise is "no data leaving your
  machine". This tool's whole purpose is to help the teacher send text
  somewhere else. That's a defensible distinction (the tool itself sends
  nothing) but it should be stated explicitly on the page, and it's worth
  Devon deciding how prominent that note should be. — Shipped a visible
  banner under the tagline stating it plainly; if Devon wants it more or
  less prominent than a static banner (e.g. dismissible, or gated behind a
  first-visit modal), that's a follow-up, not a re-litigation of whether to
  say it at all.
- Should the tool ever call an AI API directly with a user-supplied key? That
  would cross the current constraint, so the default answer is no — but it's
  the obvious question and worth recording as answered.
