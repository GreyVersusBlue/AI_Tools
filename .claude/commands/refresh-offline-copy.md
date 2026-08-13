---
description: Regenerate the offline, file://-safe zip copy of the site for handing to peers
---

Regenerate the self-contained offline copy of the site and verify it
actually works from a real `file://` URL — this is the zip a teacher hands
to a colleague to unzip and double-click, no server involved.

1. Make sure dev tooling is installed: `npm ci` if `node_modules/` is stale
   or missing, and `npx playwright install chromium` if Chromium isn't
   already installed for Playwright.
2. Run `npm run offline:build`. It wipes and rebuilds
   `Tools/board-check/.offline-copy-staging/` from a fresh `git ls-files`
   snapshot, patches the staged copy's `bmg-vector.js` to bundle its 4
   GeoJSON files instead of fetching them, bundles the site's inline
   ES-module tools into classic `<script defer>` bundles with esbuild,
   rewrites their HTML, and zips the result into `AI_Tools-offline.zip` at
   the repo root. It fails loudly and specifically if a source file it
   depends on (`bmg-vector.js`'s shape, or any of the known module
   `<script>` tags) no longer matches what it expects — if that happens,
   update `Tools/board-check/make-offline-copy.mjs` to match the new
   source; never work around it by changing a live tool file to suit the
   generator.
3. Run `npm run offline:verify` — unzips the result outside the repo and
   opens every patched entry point from a real `file://` URL in headless
   Chromium, asserting no console/page errors, and confirms Blank Map
   Generator's built-in base map actually renders offline (proves the
   GeoJSON patch works end to end, not just that the page didn't throw).
4. Confirm the live repo is untouched: `git status --porcelain` should
   show nothing beyond what you intentionally changed this session — the
   generator only ever writes inside the gitignored staging directory and
   the gitignored zip, and self-checks this internally too.
5. Report back: the zip's absolute path and size
   (`ls -lh AI_Tools-offline.zip`), and note it's ready to hand out as-is —
   unzip anywhere, double-click any `Tools/*.html` file, no server needed.

If either step fails, stop and report the actual error rather than a
generic "it didn't work" — the failure messages are written to name the
exact assumption that broke.
