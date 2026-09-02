// check-tests.mjs — read-only guard that the test wiring and the test files agree.
//
//   node Tools/board-check/check-tests.mjs        (or: npm run check:tests)
//
// This exists because of a failure that had already happened, silently, for
// days: `package.json` referenced `Tools/qr-code-generator/test/smoke-roster.mjs`
// from both the `test` chain and a `test:qr` script, and that file was never
// committed. The `test` script was `&&`-joined, so `npm test` died on the
// missing file about two-thirds of the way down the list and every suite after
// it simply never ran — including one carrying a genuinely failing assertion.
// Nothing anywhere went red in a way that named the cause.
//
// The list itself has since moved out of that string and into
// `Tools/board-check/suites.json`, read by `run-suites.mjs`. That removes the
// stop-at-the-first-failure half of the original bug but not this half: a path
// in a JSON file can name a missing suite exactly as easily as a path in a
// shell string could, and a suite on disk that the list forgets is still a
// suite nobody runs. So the same three checks apply, now across the JSON list,
// the `test:*` shortcuts, and the tree.
//
// Four checks, all of them things a human reviewer would have to hold in
// their head across two files:
//
//   0. CONFIG    — suites.json parses, lists suites as an array of strings, and
//                  every expectedFailures entry names a suite that is in it and
//                  carries the assertion text and reason that make the entry
//                  auditable.
//   1. MISSING   — every path in suites.json, and every `node <path>` in a
//                  `test:*` script, resolves to a file that exists.
//   2. ORPHAN    — every suite on disk under `Tools/*/test/*.mjs` is named by
//                  suites.json. A suite nobody runs is worse than no
//                  suite: it reads as coverage on the file listing.
//   3. UNSCRIPTED— every suite in suites.json also has its own `test:*`
//                  script, so a single tool can be re-run without the full
//                  40-suite pass. This one is advisory and prints a warning
//                  rather than failing, because the shape of the shortcut
//                  scripts is a convenience, not a correctness property.
//
// Files whose name starts with `_` are treated as helpers rather than suites
// and are exempt from ORPHAN, as is anything under `Tools/board-check/` — the
// harness and these guards are not themselves suites. Three further files are
// exempt by name, listed with their reason below, because "is this a suite or
// a tool that happens to live in test/" is not something a filename can be
// trusted to answer.
//
// Exit code: 0 all clean, 1 any CONFIG, MISSING or ORPHAN.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = p => path.relative(SITE, p).split(path.sep).join('/');

const pkg = JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};

/** Every `node <path.mjs>` a script invokes, in the order it invokes them. */
function suitesIn(script) {
  return [...String(script || '').matchAll(/node\s+([^\s&|]+\.m?js)/g)].map(m => m[1]);
}

const shortcutNames = Object.keys(scripts).filter(k => k.startsWith('test:'));

const problems = [];
const warnings = [];

/* ── 0. CONFIG ──────────────────────────────────────────────────────────── */
/* The suite list lives in JSON now, so it can be malformed in ways a shell
   string could not be. Check the shape before trusting anything below it. */
const CONFIG_PATH = 'Tools/board-check/suites.json';
let config = null;
try {
  config = JSON.parse(fs.readFileSync(path.join(SITE, CONFIG_PATH), 'utf8'));
} catch (e) {
  console.error(`check-tests: ${CONFIG_PATH} could not be read as JSON — ${e.message}`);
  process.exit(1);
}

let chain = [];
if (!Array.isArray(config.suites) || !config.suites.every(s => typeof s === 'string' && s)) {
  problems.push(`CONFIG      ${CONFIG_PATH}\n            "suites" must be an array of path strings`);
} else {
  chain = config.suites;
  const seen = new Set();
  for (const p of chain) {
    if (seen.has(p)) problems.push(`CONFIG      ${CONFIG_PATH}\n            "${p}" is listed twice`);
    seen.add(p);
  }
}

const expected = config.expectedFailures === undefined ? [] : config.expectedFailures;
if (!Array.isArray(expected)) {
  problems.push(`CONFIG      ${CONFIG_PATH}\n            "expectedFailures" must be an array`);
} else {
  const inChainSet = new Set(chain);
  for (const e of expected) {
    const where = `${CONFIG_PATH} expectedFailures[${expected.indexOf(e)}]`;
    if (!e || typeof e !== 'object') { problems.push(`CONFIG      ${where}\n            not an object`); continue; }
    if (!e.suite || !inChainSet.has(e.suite)) {
      problems.push(`CONFIG      ${where}\n            names suite "${e.suite}", which is not in the list`);
    }
    // An expected failure without its assertion text would swallow the whole
    // suite; without a reason nobody can tell later whether it is still true.
    if (!e.assertion || typeof e.assertion !== 'string') {
      problems.push(`CONFIG      ${where}\n            needs "assertion": the exact text of the failing assertion`);
    }
    if (!e.reason || typeof e.reason !== 'string') {
      problems.push(`CONFIG      ${where}\n            needs "reason": why this is red and where the fix belongs`);
    }
  }
}

/* ── 1. MISSING ─────────────────────────────────────────────────────────── */
const referenced = new Map();   // path -> the script names that name it
const note = (p, from) => {
  if (!referenced.has(p)) referenced.set(p, []);
  referenced.get(p).push(from);
};
chain.forEach(p => note(p, CONFIG_PATH));
for (const name of shortcutNames) suitesIn(scripts[name]).forEach(p => note(p, name));

for (const [p, from] of referenced) {
  if (!fs.existsSync(path.join(SITE, p))) {
    problems.push(`MISSING     ${p}\n            named by: ${[...new Set(from)].join(', ')}`);
  }
}

/* ── 2. ORPHAN ──────────────────────────────────────────────────────────── */
/* Not suites, and not orphans. Each of these lives in a test/ folder but is
   run by hand or imported by something that is, so "npm test never runs it"
   is the correct state rather than a fault. Add to this list only with a
   reason — the whole value of the check is that the default answer is "wire
   it up or delete it". */
const NOT_A_SUITE = {
  'Tools/schedule/test/fixture-northwind.mjs':
    'fixture data, imported by the suites that use it',
  'Tools/image-to-pdf/test/make-fixtures.mjs':
    'writes the PNG fixtures smoke.mjs feeds to the file input; run once, output committed',
  'Tools/schedule/test/publish.mjs':
    'a regression-baseline generator taking an output path in argv, not an assertion suite',
};

const onDisk = [];
const toolsDir = path.join(SITE, 'Tools');
for (const tool of fs.readdirSync(toolsDir)) {
  if (tool === 'board-check') continue;
  const testDir = path.join(toolsDir, tool, 'test');
  if (!fs.existsSync(testDir) || !fs.statSync(testDir).isDirectory()) continue;
  for (const file of fs.readdirSync(testDir)) {
    if (!file.endsWith('.mjs') || file.startsWith('_')) continue;
    onDisk.push(rel(path.join(testDir, file)));
  }
}
// A handful of suites live directly beside the tool's own module rather than in
// a test/ folder (final-grade-checker's grade-math.test.mjs is the only one so
// far); those are picked up here so they cannot be orphaned either.
for (const tool of fs.readdirSync(toolsDir)) {
  const dir = path.join(toolsDir, tool);
  if (tool === 'board-check' || !fs.statSync(dir).isDirectory()) continue;
  for (const file of fs.readdirSync(dir)) {
    if (/\.test\.m?js$/.test(file)) onDisk.push(rel(path.join(dir, file)));
  }
}

const inChain = new Set(chain);
for (const p of onDisk.sort()) {
  if (inChain.has(p) || NOT_A_SUITE[p]) continue;
  problems.push(`ORPHAN      ${p}\n            exists but "npm test" never runs it`);
}

/* ── 3. UNSCRIPTED (advisory) ───────────────────────────────────────────── */
const inShortcuts = new Set();
for (const name of shortcutNames) suitesIn(scripts[name]).forEach(p => inShortcuts.add(p));
for (const p of chain) {
  if (!inShortcuts.has(p)) warnings.push(`UNSCRIPTED  ${p} — no test:* script runs it on its own`);
}

/* ── report ─────────────────────────────────────────────────────────────── */
for (const w of warnings.sort()) console.warn('check-tests: ' + w);

if (problems.length) {
  console.error('\ncheck-tests: the test wiring and the test files disagree (' +
    problems.length + ' problem' + (problems.length === 1 ? '' : 's') + '):\n');
  for (const p of problems.sort()) console.error('  ' + p);
  console.error('\nAdd the file, or take the path out of ' + CONFIG_PATH + ' — but do not');
  console.error('leave them disagreeing. A path naming a suite that is not there fails the');
  console.error('run for a reason nobody can act on; a suite on disk that the list forgets');
  console.error('reads as coverage while running never.');
  process.exit(1);
}

console.log('check-tests: OK — ' + chain.length + ' suites in suites.json, all present; ' +
  onDisk.length + ' on disk, all wired up' +
  (warnings.length ? '; ' + warnings.length + ' without a test:* shortcut (advisory).' : '.'));
