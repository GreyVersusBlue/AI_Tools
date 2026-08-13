// make-offline-copy.mjs — builds a self-contained, file://-safe zip copy of
// the whole site, for handing to a peer who just unzips and double-clicks
// the HTML files with no server involved.
//
//   node Tools/board-check/make-offline-copy.mjs        (or: npm run offline:build)
//
// Three things break the live site, or just confuse a non-technical
// recipient, under this "unzip and double-click" use case — all fixed only
// in the STAGED COPY this script produces, never in the live repo:
//
//   1. Browsers refuse to load `<script type="module">` / ES-module
//      imports from a file:// origin at all. 10 live tools use one.
//   2. Browsers also block fetch() of local (non-http/https) resources
//      from a file:// page. Blank Map Generator's built-in base maps use
//      fetch() to load bundled GeoJSON at runtime, so that breaks too,
//      independent of #1.
//   3. The live repo is a git checkout, not a deliverable: it's full of
//      planning docs, design history, and dev/test tooling a colleague who
//      unzips this has no use for and no way to make sense of. Only files
//      an actual tool page loads at runtime get staged; see EXCLUDED_EXACT
//      / EXCLUDED_PREFIXES below for the specific things left out and why.
//
// Fix for #1: bundle each tool's inline module script into a plain classic
// <script defer> with esbuild (dev-only devDependency, never shipped to
// the live site — same category as the existing Playwright devDependency).
// Fix for #2: patch the staged copy's bmg-vector.js to statically `import`
// its 4 GeoJSON files instead of fetching them, so esbuild inlines them.
// Fix for #3: filter the git-tracked file list down to what's needed, and
// rename index.html to something self-explanatory (see renameEntryPoint()).
//
// Output:
//   Tools/board-check/.offline-copy-staging/   the patched copy (gitignored,
//                                               wiped + rebuilt every run)
//   AI_Tools-offline.zip                       the copy, zipped, at repo root
//                                               (gitignored)
//
// The script itself guarantees it never touches the live repo: it snapshots
// `git status --porcelain` before and after, and fails if they differ.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { ZipArchive } from 'archiver';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STAGE_DIR = path.join(SITE, 'Tools', 'board-check', '.offline-copy-staging');
const ZIP_PATH = path.join(SITE, 'AI_Tools-offline.zip');

function gitStatus() {
  return execFileSync('git', ['status', '--porcelain'], { cwd: SITE }).toString('utf8');
}

function fail(msg) {
  console.error('make-offline-copy: ' + msg);
  process.exit(1);
}

/* ── 1. copy phase ─────────────────────────────────────────────────────── */

// git ls-files, not a hand-rolled walk: it already matches .gitignore
// exactly (excludes .git/, node_modules/, .claude/, Tools/seating-chart/shots/)
// with no second exclusion list to keep in sync, and guarantees the offline
// copy only ever contains committed/staged content. On top of that, this
// EXCLUDED_* allowlist-by-exception drops files that are real, tracked parts
// of the repo but that no tool page ever loads at runtime: this build exists
// to hand a colleague something they can navigate without wondering what
// half of it is, not a mirror of the git history.
const EXCLUDED_EXACT = new Set([
  '.gitignore', '.nojekyll', 'CNAME',                    // GitHub Pages config, meaningless offline
  'CLAUDE.md',                                            // Claude Code instructions, not for teachers
  'IDEAS_BACKLOG.md', 'ideas-backlog.html',                // internal planning
  'PLATFORM_PLAN.md', 'REFACTOR_PLAN.md', 'REFACTOR_ROUNDS.md', // internal planning
  'README.md',                                             // repo-flavored dev doc; index.html IS the tool directory
  'index_backup.html',                                     // superseded landing-page draft
  'package.json', 'package-lock.json',                     // dev-only test tooling, never loaded by any tool
  'v1-inbox.html', 'v2-subplans.html', 'v3-bellboard.html', 'v4-riso.html', // retired landing-page concepts
]);
const EXCLUDED_PREFIXES = [
  '.claude/',                        // Claude Code slash commands
  'Other Landing Page ideas/',       // retired landing-page concepts
  'improvement prompts/',            // internal per-tool planning notes (80+ files)
  'prompts/',                        // internal planning notes
  'Tools/board-check/',              // dev/test tooling, including this generator itself
  'Tools/New Designs/',              // design drafts, superseded
  'Tools/Old Designs/',              // design drafts, superseded
];
function isDevOnly(rel) {
  if (EXCLUDED_EXACT.has(rel)) return true;
  if (EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) return true;
  if (rel.includes('/test/')) return true; // per-tool smoke tests, never shipped to a reader
  return false;
}

function stageCopy() {
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  const listing = execFileSync('git', ['ls-files', '-z'], { cwd: SITE }).toString('utf8');
  const files = listing.split('\0').filter(Boolean).filter((rel) => !isDevOnly(rel));
  for (const rel of files) {
    const dest = path.join(STAGE_DIR, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(SITE, rel), dest);
  }
  return files.length;
}

/* ── 2. bmg-vector.js patch (staged copy only) ───────────────────────────
 * loadGeoJson() currently fetch()es 4 fixed GeoJSON filenames relative to
 * import.meta.url. Replace with static imports of those same 4 files, which
 * esbuild's built-in JSON loader inlines at bundle time — no browser-side
 * `with {type:'json'}` needed, since the browser only ever sees the
 * pre-resolved bundle, never a JSON import.
 *
 * Both blocks are matched by exact string and must occur exactly once; if
 * bmg-vector.js's source has drifted, this fails loudly instead of quietly
 * shipping a broken offline copy. */

const BMG_VECTOR_REL = path.join('Tools', 'blank-map-generator', 'bmg-vector.js');

const OLD_DATA_DIR = `const DATA_DIR = new URL('./data/', import.meta.url);`;

const OLD_LOAD_FN = `async function loadGeoJson(file) {
  if (geoCache.has(file)) return geoCache.get(file);
  const promise = fetch(new URL(file, DATA_DIR)).then(res => {
    if (!res.ok) throw new Error(\`couldn't read the built-in map data (\${res.status})\`);
    return res.json();
  }).catch(err => {
    geoCache.delete(file); // a failed load must not poison the cache forever
    throw err;
  });
  geoCache.set(file, promise);
  return promise;
}`;

const KNOWN_GEOJSON_FILES = [
  'world-land-110m.json',
  'world-countries-110m.json',
  'us-nation-10m.json',
  'us-states-10m.json',
];

const NEW_IMPORTS = `import __offlineWorldLand from './data/world-land-110m.json';
import __offlineWorldCountries from './data/world-countries-110m.json';
import __offlineUsNation from './data/us-nation-10m.json';
import __offlineUsStates from './data/us-states-10m.json';

const __OFFLINE_GEOJSON = {
  'world-land-110m.json': __offlineWorldLand,
  'world-countries-110m.json': __offlineWorldCountries,
  'us-nation-10m.json': __offlineUsNation,
  'us-states-10m.json': __offlineUsStates,
};`;

const NEW_LOAD_FN = `async function loadGeoJson(file) {
  const data = __OFFLINE_GEOJSON[file];
  if (!data) throw new Error(\`couldn't read the built-in map data (unknown file "\${file}")\`);
  return data;
}`;

function assertExactlyOne(haystack, needle, label) {
  const count = haystack.split(needle).length - 1;
  if (count !== 1) {
    fail(`${label}: expected exactly 1 occurrence, found ${count} — the source has drifted from ` +
      `what this generator expects. Update the matching patch in make-offline-copy.mjs.`);
  }
}

function patchBmgVector() {
  const file = path.join(STAGE_DIR, BMG_VECTOR_REL);
  // Normalized to LF: template literals above are CRLF in this file on disk,
  // but the JS spec normalizes template-literal line terminators to LF at
  // parse time, so OLD_LOAD_FN etc. are LF-only in memory. bmg-vector.js is
  // read raw via fs and may still be CRLF (e.g. on a Windows checkout),
  // which would otherwise fail every exact-string match below. Safe to do
  // unconditionally: this only touches the gitignored staged copy.
  let src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  assertExactlyOne(src, OLD_DATA_DIR, 'bmg-vector.js DATA_DIR const');
  assertExactlyOne(src, OLD_LOAD_FN, 'bmg-vector.js loadGeoJson() function');
  for (const name of KNOWN_GEOJSON_FILES) {
    assertExactlyOne(src, `'${name}'`, `bmg-vector.js reference to '${name}'`);
  }
  src = src.replace(OLD_DATA_DIR, NEW_IMPORTS);
  src = src.replace(OLD_LOAD_FN, NEW_LOAD_FN);
  // geoCache is now dead (loadGeoJson no longer caches an in-flight fetch
  // promise — the imports are already resolved at bundle time) — drop it so
  // the staged file doesn't carry a pointless unused Map.
  src = src.replace(
    `// Fetched GeoJSON is kept in memory for the life of the page: switching
// styles or re-cropping a continent shouldn't re-read a 200 KB file.
const geoCache = new Map();

`,
    ''
  );
  fs.writeFileSync(file, src);
}

/* ── 3. HTML <script type="module"> → classic <script defer> ────────────
 * Not a blind whole-file regex: 035-schedule-visualizer.html contains a
 * literal, deliberately-escaped `<\/script>` inside a JS string building
 * exported HTML, which would confuse a naive pattern. Instead: locate the
 * exact opening-tag literal (asserted to occur exactly once), then scan
 * forward for the next literal `</script` — the same rule the HTML
 * tokenizer itself uses to end a script element, so it's correct regardless
 * of what else is in the file. */

function findModuleScript(html, openTag) {
  const occurrences = html.split(openTag).length - 1;
  if (occurrences !== 1) {
    fail(`expected exactly 1 occurrence of "${openTag}", found ${occurrences}`);
  }
  const tagStart = html.indexOf(openTag);
  const bodyStart = tagStart + openTag.length;
  const lower = html.toLowerCase();
  const closeTagStart = lower.indexOf('</script', bodyStart);
  if (closeTagStart === -1) fail(`no closing </script> found after "${openTag}"`);
  const closeTagEnd = html.indexOf('>', closeTagStart) + 1;
  if (closeTagEnd === 0) fail(`malformed closing tag after "${openTag}"`);
  return { tagStart, fullEnd: closeTagEnd, body: html.slice(bodyStart, closeTagStart) };
}

function spliceElement(html, span, replacement) {
  return html.slice(0, span.tagStart) + replacement + html.slice(span.fullEnd);
}

function bundleModule(source, resolveDir) {
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir, sourcefile: 'inline-module.js', loader: 'js' },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    loader: { '.json': 'json' },
    write: false,
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

// Every tool's inline module lives directly in Tools/, or a subfolder of
// it, and every import inside it is written relative to the HTML file's own
// directory — so resolveDir is just that directory in every case.
const SIMPLE_TOOLS = [
  { html: '046-blank-map-generator.html', open: '<script type="module">', bundle: 'blank-map-generator.offline-bundle.js' },
  { html: '035-schedule-visualizer.html', open: '<script type="module">', bundle: 'schedule-visualizer.offline-bundle.js' },
  { html: '036-final_grade_checker.html', open: '<script type="module">', bundle: 'final-grade-checker.offline-bundle.js' },
  { html: '032-School Calendar Visualizer.html', open: '<script type="module">', bundle: 'school-calendar.offline-bundle.js' },
  { html: '007-Name Picker.html', open: '<script id="appScript" type="module">', bundle: 'name-picker.offline-bundle.js' },
  { html: '008-behavior-points-tracker.html', open: '<script type="module">', bundle: 'behavior-points-tracker.offline-bundle.js' },
  { html: '005-Seating Chart Generator.html', open: '<script type="module">', bundle: 'seating-chart.offline-bundle.js' },
];

function bundleSimpleTools() {
  for (const t of SIMPLE_TOOLS) {
    const htmlPath = path.join(STAGE_DIR, 'Tools', t.html);
    const resolveDir = path.dirname(htmlPath);
    let html = fs.readFileSync(htmlPath, 'utf8');
    const span = findModuleScript(html, t.open);
    const bundled = bundleModule(span.body, resolveDir);
    fs.writeFileSync(path.join(resolveDir, t.bundle), bundled);
    html = spliceElement(html, span, `<script src="${t.bundle}" defer></script>`);
    fs.writeFileSync(htmlPath, html);
  }
}

// mirror.html lives in Tools/classroom-timer/, not Tools/ directly.
function bundleMirror() {
  const htmlPath = path.join(STAGE_DIR, 'Tools', 'classroom-timer', 'mirror.html');
  const resolveDir = path.dirname(htmlPath);
  let html = fs.readFileSync(htmlPath, 'utf8');
  const span = findModuleScript(html, '<script type="module">');
  const bundled = bundleModule(span.body, resolveDir);
  const bundleName = 'mirror.offline-bundle.js';
  fs.writeFileSync(path.join(resolveDir, bundleName), bundled);
  html = spliceElement(html, span, `<script src="${bundleName}" defer></script>`);
  fs.writeFileSync(htmlPath, html);
}

// 004-Classroom Timer.html has TWO type="module" tags that today share one
// ct-app.js module instance (real ES modules are cached by URL). Bundling
// them independently would create two separate copies of that module's
// state, breaking the mirror overlay's getDisplaySnapshot(). Bundle them as
// one merged entry so esbuild's real module-graph resolution collapses the
// shared import into a single instance, exactly reproducing current
// behavior — and preserve document order by putting the external tag's
// import first.
function bundleClassroomTimer() {
  const htmlPath = path.join(STAGE_DIR, 'Tools', '004-Classroom Timer.html');
  const resolveDir = path.dirname(htmlPath);
  let html = fs.readFileSync(htmlPath, 'utf8');

  const externalTag = '<script type="module" src="classroom-timer/ct-app.js"></script>';
  assertExactlyOne(html, externalTag, '004-Classroom Timer.html external ct-app.js module tag');
  const externalStart = html.indexOf(externalTag);

  const inlineSpan = findModuleScript(html, '<script type="module">');

  const merged = `import './classroom-timer/ct-app.js';\n` + inlineSpan.body;
  const bundled = bundleModule(merged, resolveDir);
  const bundleName = 'classroom-timer.offline-bundle.js';
  fs.writeFileSync(path.join(resolveDir, bundleName), bundled);

  // Remove the external tag entirely, then replace the inline tag with the
  // single merged bundle. Do the later (inline) splice first so removing
  // the external tag doesn't shift the inline span's recorded offsets.
  html = spliceElement(html, inlineSpan, `<script src="${bundleName}" defer></script>`);
  html = html.slice(0, externalStart) + html.slice(externalStart + externalTag.length);

  fs.writeFileSync(htmlPath, html);
}

// 010-command-center-dashboard.html's own <script type="module"> (remote
// control pairing, importing ./command-center/cc-remote.js) — the 10th
// module script counted in the file-header comment above and in the
// `SIMPLE_TOOLS.length + 3` total below, but kept out of SIMPLE_TOOLS
// because this file also gets bundleCommandCenterSounds()'s separate,
// unrelated edits further down; same conversion either way.
function bundleCommandCenterRemote() {
  const htmlPath = path.join(STAGE_DIR, 'Tools', '010-command-center-dashboard.html');
  const resolveDir = path.dirname(htmlPath);
  let html = fs.readFileSync(htmlPath, 'utf8');
  const span = findModuleScript(html, '<script type="module">');
  const bundled = bundleModule(span.body, resolveDir);
  const bundleName = 'command-center-remote.offline-bundle.js';
  fs.writeFileSync(path.join(resolveDir, bundleName), bundled);
  html = spliceElement(html, span, `<script src="${bundleName}" defer></script>`);
  fs.writeFileSync(htmlPath, html);
}

// Bonus, low-risk fix for 010-command-center-dashboard.html's dynamic
// import('./classroom-timer/ct-sounds.js') — also broken under file://,
// though it already degrades gracefully via .catch() to beep(). Bundle
// ct-sounds.js as a real global and swap the dynamic import for a plain
// assignment from that global; same shape (.SOUND_NAMES/.unlock/.play/.default)
// as the dynamic import's resolved module-namespace object.
function bundleCommandCenterSounds() {
  const htmlPath = path.join(STAGE_DIR, 'Tools', '010-command-center-dashboard.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  const ctSoundsPath = path.join(STAGE_DIR, 'Tools', 'classroom-timer', 'ct-sounds.js');
  const result = esbuild.buildSync({
    entryPoints: [ctSoundsPath],
    bundle: true,
    format: 'iife',
    globalName: 'CTSounds',
    platform: 'browser',
    write: false,
    logLevel: 'silent',
  });
  fs.writeFileSync(path.join(STAGE_DIR, 'Tools', 'classroom-timer', 'ct-sounds.offline-bundle.js'), result.outputFiles[0].text);

  const anchorTag = `<script src="../_shared/a11y.js"></script>`;
  assertExactlyOne(html, anchorTag, '010-command-center-dashboard.html a11y.js script tag');
  html = html.replace(anchorTag, anchorTag + `\n<script src="classroom-timer/ct-sounds.offline-bundle.js"></script>`);

  const dynamicImportLine = `import('./classroom-timer/ct-sounds.js').then(function (m) { Sounds = m; }).catch(function () { /* fall back to beep() */ });`;
  assertExactlyOne(html, dynamicImportLine, '010-command-center-dashboard.html dynamic import line');
  html = html.replace(dynamicImportLine, `Sounds = window.CTSounds || null;`);

  fs.writeFileSync(htmlPath, html);
}

/* ── 4. rename index.html ─────────────────────────────────────────────────
 * "index.html" means nothing to someone who just unzipped a folder full of
 * numbered tool files — it reads as one file among many, not an obvious
 * starting point. Rename it, then repoint every tool's "← Toolkit" back-link
 * (and manifest.json's start_url/id) at the new name, so the link keeps
 * working and not just the file. */

const ENTRY_POINT_FILENAME = 'Click Me! (Start Here).html';
const ENTRY_POINT_HREF = ENTRY_POINT_FILENAME.replace(/ /g, '%20'); // matches this repo's existing convention for spaces in hrefs (see CLAUDE.md)

function walkHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// index.html itself links to two things this trimmed copy excludes: a
// floating "Try: Inbox" button that switches to the alternate v1-inbox.html
// landing-page theme, and 3 "ideas backlog" mentions pointing at
// ideas-backlog.html. Left alone, both would be dead links on the one page
// every recipient is guaranteed to open — worse than not having them at all.
function sanitizeEntryPoint(html) {
  // Normalized to LF for the same reason as bmg-vector.js above: the
  // multi-line template literals below are LF-only once parsed (per the JS
  // spec's template-literal line-terminator normalization), but index.html
  // on disk may still be CRLF (e.g. on a Windows checkout).
  html = html.replace(/\r\n/g, '\n');
  const themeSwitch = `<a class="theme-switch" href="v1-inbox.html" title="Switch landing page theme" aria-label="Switch to Inbox theme">
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11 2l3 3-3 3M14 5H5.5A3.5 3.5 0 0 0 2 8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14l-3-3 3-3M2 11h8.5A3.5 3.5 0 0 0 14 7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <span>Try: Inbox</span>
</a>`;
  assertExactlyOne(html, themeSwitch, 'index.html theme-switch button');
  html = html.replace(themeSwitch, '');

  const ideasLink = `<a href="ideas-backlog.html">ideas backlog</a>`;
  const ideasCount = html.split(ideasLink).length - 1;
  if (ideasCount < 1) {
    fail('index.html: expected at least 1 "ideas backlog" link, found 0 — the source has ' +
      'drifted, update the sanitizeEntryPoint() patch in make-offline-copy.mjs to match it.');
  }
  html = html.split(ideasLink).join('ideas backlog'); // de-link, keep the label as plain text

  return html;
}

function renameEntryPoint() {
  const oldPath = path.join(STAGE_DIR, 'index.html');
  const newPath = path.join(STAGE_DIR, ENTRY_POINT_FILENAME);
  const entryHtml = sanitizeEntryPoint(fs.readFileSync(oldPath, 'utf8'));
  fs.rmSync(oldPath);
  fs.writeFileSync(newPath, entryHtml);

  // Matches href="index.html", href="../index.html", href="../../index.html",
  // etc. — every tool links back at a different relative depth, but always
  // ends in exactly this filename.
  const hrefPattern = /href="((?:\.\.\/)*)index\.html"/g;
  for (const file of walkHtmlFiles(STAGE_DIR)) {
    const html = fs.readFileSync(file, 'utf8');
    const patched = html.replace(hrefPattern, (_m, prefix) => `href="${prefix}${ENTRY_POINT_HREF}"`);
    if (patched !== html) fs.writeFileSync(file, patched);
  }

  const manifestPath = path.join(STAGE_DIR, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    const patched = manifest.split('./index.html').join(`./${ENTRY_POINT_HREF}`);
    if (patched !== manifest) fs.writeFileSync(manifestPath, patched);
  }
}

/* ── 5. zip ────────────────────────────────────────────────────────────── */

// Built with the `archiver` devDependency rather than shelling out to a
// `zip` binary: `zip` isn't bundled with Windows or with Git Bash, and the
// Windows-native alternatives (Compress-Archive, .NET's
// ZipFile.CreateFromDirectory) both emit backslash path separators in zip
// entries on this PowerShell 5.1 / .NET Framework combo — spec-noncompliant,
// and `unzip` (used by offline:verify, and by anyone on macOS/Linux) refuses
// to open the result. archiver always writes forward slashes and runs
// identically on every platform, so there's one code path instead of a
// per-OS branch.
async function makeZip() {
  fs.rmSync(ZIP_PATH, { force: true });
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(ZIP_PATH);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(STAGE_DIR, false);
    archive.finalize();
  });
}

/* ── main ──────────────────────────────────────────────────────────────── */

const before = gitStatus();

const fileCount = stageCopy();
patchBmgVector();
bundleSimpleTools();
bundleMirror();
bundleClassroomTimer();
bundleCommandCenterRemote();
bundleCommandCenterSounds();
renameEntryPoint();
await makeZip();

const after = gitStatus();
if (before !== after) {
  fail('the live repo changed during this run (git status differs before/after) — ' +
    'this script must only ever write inside the gitignored staging directory and zip. ' +
    'Investigate before trusting the output.');
}

const zipSize = fs.statSync(ZIP_PATH).size;
console.log(`make-offline-copy: OK — staged ${fileCount} files (dev/planning files excluded), ` +
  `patched ${SIMPLE_TOOLS.length + 3} module-loading entry points (blank-map-generator's built-in ` +
  `base maps bundled offline too), zipped to ${path.relative(SITE, ZIP_PATH)} (${(zipSize / 1024 / 1024).toFixed(1)} MB).`);
console.log(`Unzip anywhere and open "${ENTRY_POINT_FILENAME}" to get started.`);
