// check-precache.mjs — read-only guard that sw.js's PRECACHE_URLS and the tree agree.
//
//   node Tools/board-check/check-precache.mjs      (or: npm run check:precache)
//
// PRECACHE_URLS is 234 hand-maintained lines and nothing had ever checked it.
// The cost of a miss is invisible in every environment a developer works in: the
// file is on disk, the dev server serves it, the runtime cache picks it up the
// first time anyone loads it online. It only fails for a teacher who is offline,
// which is the one case the whole service worker exists for.
//
// Measured on 2026-09-02, before this guard existed: TWELVE entries were
// missing. UPGRADE_PATHS.md knew about two of them. All twelve were added to
// PRECACHE_URLS in the commit that wired this guard up (CACHE_VERSION v134).
//
//   Tools/certificate-award-maker/cam-logo.js            (042 — logo upload)
//   Tools/number-talks-board/dot-images.js               (024)
//   Tools/seating-chart/scg-photo.js                     (005 — the known one)
//   Tools/vocab-flashcard-generator/vfg-conjdrill-link.js(040)
//   Tools/writing-prompt-generator/wpg-rubric-link.js    (025)
//   ideas-backlog.html, v1-inbox.html, v2-subplans.html,
//   v3-bellboard.html, v4-riso.html                      (linked pages, 404 offline)
//   assets/icons/icon-maskable-192.png, -512.png         (the install dialog's icon)
//
// Four checks always, and a fifth with `--base <ref>`:
//
//   1. MISSING   — every same-origin src/href on a live page resolves to a file
//                  that exists AND is listed in PRECACHE_URLS.
//   2. MANIFEST  — every local file manifest.json names (icons, screenshots,
//                  shortcut icons) is listed too. This is a separate check on
//                  purpose: the maskable icons were missed for exactly this
//                  reason — the reference lives in JSON, not in an HTML
//                  attribute, so an HTML-only scan cannot see it.
//   3. DEAD      — every listed URL resolves to a file that exists. (Clean as of
//                  2026-09-02, and cheap to keep clean: a dead entry makes every
//                  install log a warning.)
//   4. DUPLICATE — no URL listed twice.
//
// A fifth check is opt-in, because it needs git history and a base to compare
// against, and a guess at either is how a guard learns to cry wolf:
//
//   5. BUMP      — `--base <ref>` only. If any precached file's content differs
//                  between the merge-base of <ref> and HEAD and the working
//                  tree, or PRECACHE_URLS itself does, then CACHE_VERSION must
//                  differ from what it was at that merge-base. Otherwise every
//                  teacher who already has the worker installed keeps serving
//                  the old bytes: the worker only reinstalls when its own text
//                  changes, and a bumped version string is how it changes.
//
// The merge-base is what makes this honest. Comparing against `main` directly
// would be wrong on a branch that legitimately holds several commits (a bump
// two commits ago is still a bump), and comparing HEAD~1 would be wrong on a
// squash. In CI this runs only in the pull-request job, where the checkout has
// full history and `origin/<base branch>` is known; a push to main has nothing
// sensible to compare against and does not run it. With no `--base` the check
// is skipped and says so. A base that git cannot resolve (a shallow clone, a
// typo) is an error, not a pass.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = p => path.relative(SITE, p).split(path.sep).join('/');

/* Pages that are shipped and reachable. Archived design folders are excluded:
   they are kept for reference, are not linked from anywhere live, and precaching
   them would grow the install for nothing. */
const PAGE_EXEMPT = ['Tools/Old Designs/', 'Tools/New Designs/', 'index_backup.html'];

const problems = [];
const warnings = [];

const argv = process.argv.slice(2);
const baseIdx = argv.indexOf('--base');
const BASE_REF = baseIdx >= 0 ? argv[baseIdx + 1] : null;
if (baseIdx >= 0 && !BASE_REF) {
  console.error('check-precache: --base needs a git ref (e.g. --base origin/main).');
  process.exit(2);
}

/* ── read PRECACHE_URLS ─────────────────────────────────────────────────── */

const swSrc = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
const block = /const PRECACHE_URLS = \[([\s\S]*?)\n\];/.exec(swSrc);
if (!block) {
  console.error('check-precache: could not find the PRECACHE_URLS array in sw.js.');
  process.exit(1);
}
const listed = [...block[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
const listedSet = new Set(listed.map(u => decodeURIComponent(u)));

/* ── 4. DUPLICATE ───────────────────────────────────────────────────────── */
const seen = new Set();
for (const u of listed) {
  if (seen.has(u)) problems.push(`DUPLICATE   ${u}\n            listed twice in PRECACHE_URLS`);
  seen.add(u);
}

/* ── 3. DEAD ────────────────────────────────────────────────────────────── */
for (const u of listed) {
  const p = decodeURIComponent(u);
  if (p === './') continue;
  if (!fs.existsSync(path.join(SITE, p))) {
    problems.push(`DEAD        ${u}\n            listed in PRECACHE_URLS but not on disk`);
  }
}

/* ── 1. MISSING (HTML references) ───────────────────────────────────────── */

function livePages() {
  const out = ['index.html'];
  for (const f of fs.readdirSync(path.join(SITE, 'Tools'))) {
    if (f.endsWith('.html')) out.push('Tools/' + f);
  }
  // Root-level pages that are linked from index.html or from each other.
  for (const f of fs.readdirSync(SITE)) {
    if (f.endsWith('.html') && f !== 'index.html') out.push(f);
  }
  return out.filter(p => !PAGE_EXEMPT.some(x => p.startsWith(x) || p === x));
}

const REF = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const missing = new Map();

for (const page of livePages()) {
  const abs = path.join(SITE, page);
  if (!fs.existsSync(abs)) continue;
  const html = fs.readFileSync(abs, 'utf8');
  for (const m of html.matchAll(REF)) {
    const raw = m[1];
    if (/^(https?:|data:|mailto:|tel:|#|javascript:|blob:)/i.test(raw)) continue;
    const clean = decodeURIComponent(raw.split('#')[0].split('?')[0]);
    if (!clean) continue;
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(page), clean)
    );
    if (!resolved || resolved.startsWith('..')) continue;
    if (!fs.existsSync(path.join(SITE, resolved))) continue;   // a real 404 is a different bug
    if (listedSet.has(resolved)) continue;
    if (!missing.has(resolved)) missing.set(resolved, new Set());
    missing.get(resolved).add(page);
  }
}

for (const [file, pages] of [...missing].sort()) {
  const by = [...pages].sort();
  problems.push(
    `MISSING     ${file}\n            loaded by ${by.slice(0, 3).join(', ')}` +
    `${by.length > 3 ? ` (+${by.length - 3} more)` : ''}, not in PRECACHE_URLS`
  );
}

/* ── 2. MANIFEST ────────────────────────────────────────────────────────── */

const manifestPath = path.join(SITE, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const mf = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const refs = [];
  for (const icon of mf.icons || []) if (icon.src) refs.push(icon.src);
  for (const shot of mf.screenshots || []) if (shot.src) refs.push(shot.src);
  for (const sc of mf.shortcuts || []) for (const i of sc.icons || []) if (i.src) refs.push(i.src);

  for (const raw of refs) {
    if (/^(https?:|data:)/i.test(raw)) continue;
    const resolved = path.posix.normalize(raw.replace(/^\.\//, ''));
    if (!fs.existsSync(path.join(SITE, resolved))) {
      problems.push(`MANIFEST    ${resolved}\n            named by manifest.json but not on disk`);
    } else if (!listedSet.has(resolved)) {
      problems.push(
        `MANIFEST    ${resolved}\n            named by manifest.json, not in PRECACHE_URLS` +
        ` — the install dialog falls back to a broken icon offline`
      );
    }
  }
}

/* ── 5. BUMP (opt-in: --base <ref>) ────────────────────────────────────── */

let bumpNote = '';
if (BASE_REF) {
  const git = (...args) => execFileSync('git', args, { cwd: SITE, encoding: 'utf8' }).trim();
  let mergeBase;
  try {
    mergeBase = git('merge-base', BASE_REF, 'HEAD');
  } catch (e) {
    console.error(`check-precache: cannot resolve --base ${BASE_REF} against HEAD (${String(e.message || e).split('\n')[0]}).`);
    console.error('A shallow clone has no history to compare; fetch the base branch (in CI, actions/checkout with fetch-depth: 0).');
    process.exit(2);
  }
  const versionOf = src => (/const CACHE_VERSION = '([^']+)'/.exec(src) || [])[1];
  const listOf = src => {
    const b = /const PRECACHE_URLS = \[([\s\S]*?)\n\];/.exec(src);
    return b ? [...b[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : [];
  };
  const baseSw = git('show', `${mergeBase}:sw.js`);
  const baseVersion = versionOf(baseSw), headVersion = versionOf(swSrc);
  if (!baseVersion || !headVersion) {
    console.error('check-precache: could not read CACHE_VERSION from sw.js at the merge-base and in the working tree.');
    process.exit(2);
  }
  // Committed and uncommitted changes alike: what a teacher's browser would
  // fetch is whatever is on disk when this is deployed, so compare the
  // merge-base against the working tree, not against HEAD.
  const changed = git('diff', '--name-only', '-z', mergeBase, '--').split('\0').filter(Boolean);
  const changedSet = new Set(changed);
  const cachedChanged = listed
    .map(u => decodeURIComponent(u))
    .filter(p => p !== './' && changedSet.has(p))
    .sort();
  const listChanged = listOf(baseSw).join('\n') !== listed.join('\n');
  const needsBump = cachedChanged.length > 0 || listChanged;
  const short = mergeBase.slice(0, 7);
  if (needsBump && baseVersion === headVersion) {
    const why = [
      ...cachedChanged.slice(0, 12).map(p => `            ${p}`),
      cachedChanged.length > 12 ? `            (+${cachedChanged.length - 12} more)` : '',
      listChanged ? '            (and PRECACHE_URLS itself changed)' : '',
    ].filter(Boolean).join('\n');
    problems.push(
      `BUMP        CACHE_VERSION is still ${headVersion}, as it was at ${short} (merge-base of ${BASE_REF} and HEAD),\n` +
      `            but precached content changed since then:\n${why}\n` +
      `            An installed worker only reinstalls when sw.js changes; bump CACHE_VERSION.`
    );
  } else if (needsBump) {
    bumpNote = ` CACHE_VERSION ${baseVersion} → ${headVersion} covers the ${cachedChanged.length} precached file${cachedChanged.length === 1 ? '' : 's'} changed since ${short}${listChanged ? ' and the list change' : ''}.`;
  } else if (baseVersion !== headVersion) {
    bumpNote = ` CACHE_VERSION ${baseVersion} → ${headVersion} with no precached content changed since ${short} (harmless: one extra reinstall).`;
  } else {
    bumpNote = ` No precached content changed since ${short}; CACHE_VERSION ${headVersion} stands.`;
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */

for (const w of warnings.sort()) console.warn('check-precache: ' + w);

if (problems.length) {
  console.error(`\ncheck-precache: PRECACHE_URLS and the tree disagree (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n`);
  for (const p of problems.sort()) console.error('  ' + p);
  console.error('\nA file a live page loads but the worker never caches works everywhere');
  console.error('except the one place the worker exists for: a teacher who is offline.');
  console.error('Add the path to PRECACHE_URLS and bump CACHE_VERSION in the same commit');
  console.error('(CLAUDE.md, "Service worker / offline"). URL-encode spaces as %20.');
  process.exit(1);
}

console.log(`check-precache: OK — ${listed.length} entries, all present; every file a live page or manifest.json references is listed.${bumpNote}`);
if (!BASE_REF) console.log('check-precache: (CACHE_VERSION bump not checked — pass --base <ref>, e.g. --base origin/main, to compare against a merge-base.)');
