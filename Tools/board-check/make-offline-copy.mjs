// make-offline-copy.mjs — builds a self-contained, file://-safe zip copy of
// the whole site, for handing to a peer who just unzips and double-clicks
// the HTML files with no server involved.
//
//   node Tools/board-check/make-offline-copy.mjs        (or: npm run offline:build)
//
// Two browser restrictions break the live site under file://, both fixed
// only in the STAGED COPY this script produces — never in the live repo:
//
//   1. Browsers refuse to load `<script type="module">` / ES-module
//      imports from a file:// origin at all. 9 live tools use one.
//   2. Browsers also block fetch() of local (non-http/https) resources
//      from a file:// page. Blank Map Generator's built-in base maps use
//      fetch() to load bundled GeoJSON at runtime, so that breaks too,
//      independent of #1.
//
// Fix for #1: bundle each tool's inline module script into a plain classic
// <script defer> with esbuild (dev-only devDependency, never shipped to
// the live site — same category as the existing Playwright devDependency).
// Fix for #2: patch the staged copy's bmg-vector.js to statically `import`
// its 4 GeoJSON files instead of fetching them, so esbuild inlines them.
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
// copy only ever contains committed/staged content.
function stageCopy() {
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  const listing = execFileSync('git', ['ls-files', '-z'], { cwd: SITE }).toString('utf8');
  const files = listing.split('\0').filter(Boolean);
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
    fail(`${label}: expected exactly 1 occurrence, found ${count} — bmg-vector.js no longer ` +
      `matches the expected shape. Update the patch in make-offline-copy.mjs to match the new source.`);
  }
}

function patchBmgVector() {
  const file = path.join(STAGE_DIR, BMG_VECTOR_REL);
  let src = fs.readFileSync(file, 'utf8');
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

/* ── 4. zip ────────────────────────────────────────────────────────────── */

function makeZip() {
  fs.rmSync(ZIP_PATH, { force: true });
  execFileSync('zip', ['-r', '-X', '-q', ZIP_PATH, '.'], { cwd: STAGE_DIR });
}

/* ── main ──────────────────────────────────────────────────────────────── */

const before = gitStatus();

const fileCount = stageCopy();
patchBmgVector();
bundleSimpleTools();
bundleMirror();
bundleClassroomTimer();
bundleCommandCenterSounds();
makeZip();

const after = gitStatus();
if (before !== after) {
  fail('the live repo changed during this run (git status differs before/after) — ' +
    'this script must only ever write inside the gitignored staging directory and zip. ' +
    'Investigate before trusting the output.');
}

const zipSize = fs.statSync(ZIP_PATH).size;
console.log(`make-offline-copy: OK — staged ${fileCount} files, patched ${SIMPLE_TOOLS.length + 3} ` +
  `module-loading entry points (blank-map-generator's built-in base maps bundled offline too), ` +
  `zipped to ${path.relative(SITE, ZIP_PATH)} (${(zipSize / 1024 / 1024).toFixed(1)} MB).`);
console.log(`Unzip anywhere and open any Tools/*.html file directly — no server needed.`);
