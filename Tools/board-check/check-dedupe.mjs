// check-dedupe.mjs — read-only guard against vendored-library duplication creep.
//
//   node Tools/board-check/check-dedupe.mjs        (or: npm run check:dedupe)
//
// Phases 1 and 1b of REFACTOR_PLAN.md consolidated six third-party libraries
// into _shared/vendor/ — one canonical copy of each, site-wide. This script
// fails (exit 1) if that consolidation starts to unravel, so run it before
// committing. Two checks:
//
//   1. FILES  — no file named after one of the six libraries may exist
//      anywhere in the repo outside _shared/vendor/ (a per-tool lib/ copy
//      creeping back).
//   2. REFS   — no src/href attribute in any live HTML page may point one of
//      the six filenames anywhere except into _shared/vendor/ (a CDN link or
//      a stale per-tool path creeping back, even before any file lands).
//
// Tools/Old Designs/ and Tools/New Designs/ are exempt from the REFS check:
// they are dead archives with pre-existing broken lib references, documented
// in REFACTOR_PLAN.md Phase 1 — unlinked from index.html and never precached.
// They are NOT exempt from the FILES check (an actual duplicate binary there
// would still be duplication).
//
// Exit code: 0 all clean, 1 any offender found.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The six libraries consolidated in Phases 1 and 1b. Add to this list when a
// new library is vendored into _shared/vendor/.
const VENDORED = [
  'jspdf.umd.min.js',
  'jspdf.plugin.autotable.min.js',
  'xlsx.full.min.js',
  'jsqr.js',
  'qrcode.js',
  'jszip.min.js',
];

// .offline-copy-staging is a disposable, gitignored full-repo copy built by
// make-offline-copy.mjs — it legitimately contains its own copy of every
// vendored library, so it must be skipped the same way node_modules is.
const SKIP_DIRS = new Set(['.git', 'node_modules', '.claude', '.offline-copy-staging']);
const REF_EXEMPT = ['Tools/Old Designs/', 'Tools/New Designs/'];

const rel = p => path.relative(SITE, p).split(path.sep).join('/');
const offenders = [];

// 1. FILES — walk the whole repo except _shared/vendor/ itself.
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    const r = rel(p);
    if (fs.statSync(p).isDirectory()) {
      if (r === '_shared/vendor') continue;
      walk(p);
    } else if (VENDORED.includes(name)) {
      offenders.push('FILE  ' + r);
    }
  }
})(SITE);

// 2. REFS — every src/href naming one of the six must point into _shared/vendor/.
const nameAlt = VENDORED.map(n => n.replace(/[.]/g, '\\.')).join('|');
const refRe = new RegExp('(?:src|href)\\s*=\\s*"([^"]*(?:' + nameAlt + '))"', 'gi');

(function scan(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    const r = rel(p);
    if (fs.statSync(p).isDirectory()) { scan(p); continue; }
    if (!name.endsWith('.html')) continue;
    if (REF_EXEMPT.some(prefix => r.startsWith(prefix))) continue;
    const html = fs.readFileSync(p, 'utf8');
    for (const m of html.matchAll(refRe)) {
      if (!m[1].includes('_shared/vendor/')) {
        offenders.push('REF   ' + r + '  ->  ' + m[1]);
      }
    }
  }
})(SITE);

if (offenders.length) {
  console.error('check-dedupe: vendored-library duplication has crept back (' +
    offenders.length + ' offender' + (offenders.length === 1 ? '' : 's') + '):\n');
  for (const o of offenders.sort()) console.error('  ' + o);
  console.error('\nThe six libraries above live ONLY in _shared/vendor/ — one canonical');
  console.error('copy each, loaded via a relative <script src>. See CLAUDE.md and');
  console.error('REFACTOR_PLAN.md Phases 1/1b. Repoint the reference or delete the copy.');
  process.exit(1);
}

console.log('check-dedupe: OK — no copy of, or non-vendor reference to, any of the ' +
  VENDORED.length + ' vendored libraries exists outside _shared/vendor/.');
