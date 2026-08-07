I'm Devon Moore, a 7th grade Social Studies teacher. I run a small repo called
"East Middle Staff Toolkit" at `C:\Users\devon\OneDrive\Documents\GitHub\AI_Tools`
(GitHub Pages site, custom domain via `CNAME`). It's a set of small, single-file
HTML tools for day-to-day classroom logistics — no accounts, no server, no data
leaving the browser. `index.html` at the repo root is the landing page that links
to everything; `README.md` has a table describing each tool.

Conventions already established in this repo (look at existing tools before
building):
- Each tool's entry point is one `.html` file directly under `Tools/` (e.g.
  `Tools/final_grade_checker.html`, `Tools/Name Picker.html`).
- Supporting JS/assets for a tool live in a matching subfolder, e.g.
  `Tools/name-picker/` holds `np-store.js`, `np-pick.js`, fonts, and tests for
  `Tools/Name Picker.html`. Follow that pattern if the tool needs more than
  inline script.
- Shared dark-mode/theme tokens live in `_shared/theme.css` and
  `_shared/theme-toggle.js` — load these so the new tool matches the rest of
  the site visually instead of inventing its own palette.
- Update the root `README.md` tools table and `index.html` landing page to link
  the new tool once it's built.
- No CDN-only dependencies that could fail on the school network — vendor any
  JS libraries locally in the tool's subfolder like the fonts are vendored in
  `Tools/name-picker/fonts/`.

## The tool: QR Code Generator

Goal: generate QR codes for classroom use (linking to Schoology assignments,
station instructions, forms, etc.) with the ability to embed a logo or short
text in the center of the code, not just a plain black-and-white QR square.

Requirements:
- Input: a URL or arbitrary text, generated entirely client-side (find and
  vendor a solid open-source QR generation library locally — do not call an
  external QR API, since that would send the URL/content to a third party and
  also breaks the "works offline" pattern this repo follows).
- Center overlay: let me either upload an image (e.g. a school logo, once I
  track one down) or type short text to render in the middle of the code.
  QR codes tolerate a moderate amount of center obstruction due to error
  correction — use a high error-correction level (e.g. level H) when a center
  image/text is present so the code stays scannable, and validate/test that
  the generated codes actually scan with the overlay in place.
- Let me adjust size and, ideally, foreground/background color for print
  contrast, plus download the result as a PNG (and SVG if reasonably easy).
- If reasonable, remember my last-used settings (size, error-correction
  preference, colors) via localStorage between visits, same pattern as other
  tools in this repo.
- Keep the UI simple: this should be a "paste link, tweak a couple options,
  download image" flow, not a full design tool.

I don't have a school logo file ready yet — build the image upload as generic
(accepts any PNG/JPG/SVG I provide) rather than hard-coding anything
school-specific. Ask me clarifying questions if scope is unclear.
