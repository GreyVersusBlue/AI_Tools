# Improvement Prompts — Prompt Builder

**Tool file:** `Tools/prompt-builder.html`
**Support folder:** none — single file

**Current description (from README):** _(Not currently listed in the README tools table — worth adding.)_ Builds a well-structured prompt for an AI assistant from a guided form, with presets for common teacher tasks.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

Note: this tool and `qr-code-generator.html` are both missing from the
README tools table and from the description list. Worth fixing whenever
someone touches the README.

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

- **Add it to the README and the landing page.** It's invisible right now.
- **A "paste your result back" field.** The workflow is build → copy → use
  elsewhere → and then nothing. Letting the teacher paste the AI's output back
  in, saved alongside the prompt, turns history into a genuinely useful record
  of what worked.
- **Explain the strength meter.** Tell the teacher *what* would make the
  prompt stronger, not just that it's weak — that's the teaching moment.
- **More presets aimed at this site's own outputs**: "write 20 review
  questions I can paste into the Review Game Board", "write 10 exit ticket
  prompts", "write a rubric I can type into Rubric Builder". Prompts that
  produce data in the exact shape another tool imports (P7) would be the
  single most useful thing this tool could do.
- **Guardrail reminders.** A visible, non-preachy note about not pasting
  student names or grades into a third-party AI service — this site's entire
  premise is that data stays local, and this is the one tool that sends the
  user somewhere it won't.
- **Prompt history search and pinning**; export the whole history.

## Major Features

- **Output-shape presets tied to the toolkit.** Generate a prompt that asks
  for CSV in exactly the columns `review-game-board.html` imports, or a
  `term: definition` list for `vocab-flashcard-generator.html`, or a rubric
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
- **Redaction helper.** Paste text containing student names, and have the tool
  replace them with Student A / Student B before you send it anywhere — a
  small feature that directly serves the site's privacy stance.

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

- The site's promise is "no data leaving your machine". This tool's whole
  purpose is to help the teacher send text somewhere else. That's a defensible
  distinction (the tool itself sends nothing) but it should be stated
  explicitly on the page, and it's worth Devon deciding how prominent that
  note should be.
- Should the tool ever call an AI API directly with a user-supplied key? That
  would cross the current constraint, so the default answer is no — but it's
  the obvious question and worth recording as answered.
