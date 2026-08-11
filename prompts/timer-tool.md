I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" at `C:\Users\devon\OneDrive\Documents\GitHub\AI_Tools`
(GitHub Pages site, custom domain via `CNAME`). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Repo-wide conventions are documented in `CLAUDE.md` at the repo root — read
  it first, and treat it as the authority if anything below conflicts with it.
  The rules that matter most when generating a new tool:
  - Third-party libraries come from `_shared/vendor/<name>/` — one canonical
    copy site-wide. Use the copy that's there; if the library isn't vendored
    yet, add it there, never as a per-tool copy and never from a CDN.
  - If the tool's subfolder needs a folder for remaining tool-specific
    vendored files, name it `lib/`, never `libs/`.
  - Link the shared boilerplate instead of inlining it: `_shared/theme.css`,
    `_shared/theme-toggle.js`, `_shared/a11y.css` + `_shared/a11y.js`, and
    `_shared/sw-register.js` for service-worker registration (see CLAUDE.md
    if that file doesn't exist yet).
  - Every file the tool adds must go into `PRECACHE_URLS` in `sw.js` with
    `CACHE_VERSION` bumped, or the tool silently breaks offline.
- Each tool's entry point is one `.html` file directly under `Tools/` (e.g.
  `Tools/036-final_grade_checker.html`, `Tools/007-Name Picker.html`).
- Supporting JS/assets for a tool live in a matching subfolder, e.g.
  `Tools/name-picker/` holds `np-store.js`, `np-pick.js`, fonts, and tests for
  `Tools/007-Name Picker.html`. Follow that pattern if the tool needs more than
  inline script.
- Shared dark-mode/theme tokens live in `_shared/theme.css` and
  `_shared/theme-toggle.js` — load these so the new tool matches the rest of
  the site visually instead of inventing its own palette.
- Update the root `README.md` tools table and `index.html` landing page to link
  the new tool once it's built.

## The tool: Classroom Timer

Goal: one timer tool with a lot of variations, for a classroom projected on a
board — needs to be readable from the back of the room and simple enough that
I can start it in a couple clicks mid-lesson.

Variations to support (propose a UI that lets me pick between these quickly,
rather than separate pages):
- **Countdown timer** — set minutes/seconds, big readable digits, visible
  progress (bar or circle), audible alert at zero. This is the core mode.
- **Transition timer** — a countdown specifically framed for "clean up / move
  to next activity," maybe with preset short durations (1, 2, 5 minutes) as
  one-click buttons instead of typing a time every time.
- **Randomized-interval timer** — fires at random points within a range (e.g.
  "sometime in the next 3-8 minutes") instead of a fixed countdown, for things
  like surprise checks or randomized participation cues.
- Consider whether a simple **stopwatch / count-up** mode and a **round-robin
  timer** (repeating intervals, like "2 minutes per station, cycle through 5
  stations") are worth adding — use your judgment on scope, but flag what you
  chose to include or leave out and why.

Other requirements:
- Preferences (last-used duration, which mode was active, volume/sound choice)
  should persist across sessions via localStorage, same pattern as other tools
  in this repo (see `Tools/name-picker/np-store.js` for how they handle
  storage).
- Needs a dark mode / high-contrast look-good-projected mode using the shared
  theme tokens in `_shared/theme.css`.
- Should work fully offline once loaded — no external audio/CDN dependencies
  that could fail on the school network. Bundle any sound assets locally.
- Keep it a single HTML file if that stays clean; only split into a subfolder
  like other tools if the JS genuinely gets large enough to warrant it.

Ask me clarifying questions about which modes matter most before you build
anything elaborate — I'd rather get 3 modes done well than 6 done sloppily.
