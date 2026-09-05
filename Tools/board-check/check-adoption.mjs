// check-adoption.mjs — measure which tools reference which `_shared/` file, and
// print the "Shared-file adoption" row of BACKLOG.md's header as pasteable
// Markdown.
//
//   node Tools/board-check/check-adoption.mjs              (or: npm run check:adoption)
//   node Tools/board-check/check-adoption.mjs --check      compare against BACKLOG.md's header
//   node Tools/board-check/check-adoption.mjs --file roster.js   which tools, by name
//
// CLAUDE.md's rule is "measure with a script, and commit the script", and every
// other number in that header has one — `check:precache` for the precache
// counts, `check:registry` for keys and prefixes, `check:tests` for the suite
// count, the a11y sweep for the allowlist. The adoption row did not. It was
// re-derived by hand, by a different grep, in every session that touched it,
// and on 2026-09-04 that produced two wrong numbers in one day:
//
//   - a grep for `_shared/student-details.js` returned 2, and one of the two
//     was a COMMENT in 006 naming the file, written an hour earlier in the
//     same session; and
//   - another grep counted `Tools/board-check/.offline-copy-staging/` — a
//     gitignored build output, a copy of the whole site — as two more adopters.
//
// Both are avoided by construction here: the file list comes from `git ls-files`
// (so nothing untracked or gitignored is in it) and a reference has to be a
// real `src=`/`href=` attribute or a real `import` specifier, not a mention.
//
// DIRECT vs VIA. A tool adopts a shared file directly when its own .html names
// it. It adopts one indirectly when a per-tool module the page loads imports it
// — 008 reaches `student-details.js` that way. The header's figures have always
// been the direct count, and this script's default output reproduces them
// exactly (verified against the 2026-09-04 header on all eighteen rows before
// this file was committed), so the row stays comparable across sessions. Any
// indirect-only adopters are reported after it as `+n via a module` rather than
// folded in, because silently changing what a long-running number means is how
// the wrong numbers above got believed in the first place.
//
// Exit code: 0 always, unless `--check` is passed and the header disagrees, or
// the tree is unreadable. Without `--check` this is a measurement, not a guard
// — BACKLOG.md's header is legitimately stale between a merge and the step-6
// rewrite that follows it, so failing on that by default would go red during
// normal work. CI runs it without `--check`, which keeps the script itself from
// rotting unnoticed; that is the failure mode this whole row exists to answer.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const ONLY = (() => { const i = argv.indexOf('--file'); return i === -1 ? null : argv[i + 1]; })();

/** Tracked files only: no node_modules, no .offline-copy-staging, no scratch. */
const tracked = new Set(
  execFileSync('git', ['ls-files', '-z'], { cwd: SITE, encoding: 'utf8' }).split('\0').filter(Boolean),
);

const TOOL_PAGE = /^Tools\/\d{3}-[^/]+\.html$/;
const pages = [...tracked].filter(f => TOOL_PAGE.test(f)).sort();
const shared = [...tracked].filter(f => /^_shared\/[^/]+\.(js|css)$/.test(f)).sort();

/* ── what one file references ───────────────────────────────────────────────
   Three forms, and only these three, because each one is something the browser
   actually fetches:

     src="…" / href="…"     HTML, and <link> in particular
     import … from '…'      an ES module specifier, static or dynamic
     @import '…' / url(…)   CSS

   A path inside a comment, a string of prose, or a `data-*` attribute is not a
   reference and is not counted — that is the student-details.js mistake. */
function referencesIn(file) {
  let text;
  try { text = fs.readFileSync(path.join(SITE, file), 'utf8'); } catch { return []; }
  const out = [];
  const add = spec => {
    if (!spec || /^(?:[a-z]+:)?\/\//i.test(spec) || /^(data|mailto|tel|#)/i.test(spec)) return;
    out.push(spec.split(/[?#]/)[0]);
  };
  for (const m of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) add(m[1]);
  for (const m of text.matchAll(/\bimport\s*(?:[\s\S]*?\bfrom\s*)?\(?\s*["']([^"']+)["']/g)) add(m[1]);
  for (const m of text.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g)) add(m[1]);
  return out;
}

/** Resolve a reference the way the browser would, and keep it only if tracked. */
function resolve(from, spec) {
  const abs = spec.startsWith('/')
    ? spec.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  return tracked.has(abs) ? abs : null;
}

const refCache = new Map();
function refsOf(file) {
  if (!refCache.has(file)) {
    refCache.set(file, referencesIn(file).map(s => resolve(file, s)).filter(Boolean));
  }
  return refCache.get(file);
}

/* ── walk each page ─────────────────────────────────────────────────────────
   Depth 0 is the page itself, so its own references are DIRECT. Anything found
   below that is VIA whichever module the page loaded. A module can import a
   module, so this follows the graph rather than stopping at one hop; the
   `seen` set makes a cycle terminate. */
const direct = new Map(shared.map(f => [f, new Set()]));
const via = new Map(shared.map(f => [f, new Set()]));

for (const page of pages) {
  const seen = new Set([page]);
  const queue = refsOf(page).map(r => [r, 0]);
  const hitDirect = new Set();
  const hitVia = new Set();
  while (queue.length) {
    const [file, depth] = queue.shift();
    if (direct.has(file)) (depth === 0 ? hitDirect : hitVia).add(file);
    if (seen.has(file) || !/\.(js|mjs|css)$/.test(file)) continue;
    seen.add(file);
    for (const next of refsOf(file)) queue.push([next, depth + 1]);
  }
  for (const f of hitDirect) direct.get(f).add(page);
  for (const f of hitVia) if (!hitDirect.has(f)) via.get(f).add(page);
}

/* ── report ─────────────────────────────────────────────────────────────── */
const name = f => f.replace(/^_shared\//, '');

if (ONLY) {
  const key = ONLY.startsWith('_shared/') ? ONLY : `_shared/${ONLY}`;
  if (!direct.has(key)) {
    console.error(`check-adoption: no such shared file: ${key}`);
    console.error('Known: ' + shared.map(name).join(', '));
    process.exit(1);
  }
  const d = [...direct.get(key)].sort();
  const v = [...via.get(key)].sort();
  console.log(`${key} — ${d.length} direct, ${v.length} via a module\n`);
  for (const p of d) console.log('  direct  ' + p);
  for (const p of v) console.log('  via     ' + p);
  process.exit(0);
}

const ranked = shared
  .map(f => ({ f, d: direct.get(f).size, v: via.get(f).size }))
  .filter(r => r.d + r.v > 0)
  .sort((a, b) => b.d - a.d || a.f.localeCompare(b.f));

const cells = ranked.map(r => `\`${name(r.f)}\` ${r.d}${r.v ? ` (+${r.v} via a module)` : ''}`);
const row = `| Shared-file adoption (of ${pages.length}) | ${cells.join(' · ')} |`;

console.log(`check-adoption: ${pages.length} tool pages, ${shared.length} files in _shared/, ` +
  `${ranked.length} of them referenced.\n`);
console.log('Paste this into BACKLOG.md\'s "Where things stand" table:\n');
console.log(row);

const unused = shared.filter(f => direct.get(f).size + via.get(f).size === 0);
if (unused.length) {
  console.log('\nReferenced by no tool page: ' + unused.map(name).join(', ') +
    '\n(Not necessarily dead — index.html and the offline copy are not tool pages.)');
}

/* ── --check ─────────────────────────────────────────────────────────────── */
if (!CHECK) process.exit(0);

const backlog = fs.readFileSync(path.join(SITE, 'BACKLOG.md'), 'utf8');
const header = backlog.split('\n').find(l => l.startsWith('| Shared-file adoption'));
if (!header) {
  console.error('\ncheck-adoption: --check found no "| Shared-file adoption" row in BACKLOG.md.');
  process.exit(1);
}

/* Compare the numbers, not the formatting: a row that lost a `·` is not a
   wrong measurement. */
const stated = new Map([...header.matchAll(/`([^`]+)`\s+(\d+)/g)].map(m => [m[1], Number(m[2])]));
const wrong = [];
for (const r of ranked) {
  if (!stated.has(name(r.f))) wrong.push(`${name(r.f)}: header omits it, tree says ${r.d}`);
  else if (stated.get(name(r.f)) !== r.d) wrong.push(`${name(r.f)}: header says ${stated.get(name(r.f))}, tree says ${r.d}`);
}
for (const [k] of stated) {
  if (!ranked.some(r => name(r.f) === k)) wrong.push(`${k}: in the header, referenced by no tool page`);
}

if (wrong.length) {
  console.error('\ncheck-adoption: BACKLOG.md\'s adoption row disagrees with the tree ' +
    `(${wrong.length} row${wrong.length === 1 ? '' : 's'}):\n`);
  for (const w of wrong) console.error('  ' + w);
  console.error('\nPaste the row printed above. If the header is right and this is wrong, the');
  console.error('bug is here — say so in BACKLOG.md rather than editing the number back.');
  process.exit(1);
}
console.log('\ncheck-adoption: --check OK — BACKLOG.md\'s header matches the tree on all ' +
  ranked.length + ' rows.');
