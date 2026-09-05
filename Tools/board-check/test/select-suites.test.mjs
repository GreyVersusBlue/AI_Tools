// select-suites.test.mjs — what `run-suites.mjs --changed` selects, and what it
// leaves out.
//
//   node Tools/board-check/test/select-suites.test.mjs   (or: npm run test:select-suites)
//
// CI runs the pull-request job with --changed, so this selector decides which
// of the browser suites a PR is judged by. The failure that matters is the
// quiet one — a suite that should have run and did not — so half of these
// assertions are about exclusion: a name-picker edit must NOT run the seating
// suites, and a docs-only change must run nothing. The other half pin the
// under-selections the first draft had (folder edits not reaching the pages
// that import them; the page sweeps never being selected), against the real
// tree so they cannot drift back in as the suites change.
//
// Pure Node, no browser. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import {
  SITE, suitesForChanges, foldersReferencedBy, isSweep, needlesFor,
  listPagesOnDisk, readFileOnDisk, toolOf,
} from '../select-suites.mjs';

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; return true; }
  failed++;
  console.log('  FAIL ' + label);
  return false;
}
const has = (list, item, label) => ok(list.includes(item), `${label}: expected ${item} to be selected`);
const lacks = (list, item, label) => ok(!list.includes(item), `${label}: expected ${item} NOT to be selected`);

/* ── 1. a synthetic tree: every rule in isolation ─────────────────────────── */

// The directory-listing call is spelled in two halves throughout this file so
// that the file does not itself read as a page sweep (rule 4 greps for it).
const LISTDIR = 'readdir' + 'Sync(';

const FAKE_SUITES = [
  'Tools/alpha/test/smoke-alpha.mjs',        // opens 001
  'Tools/alpha/test/logic.test.mjs',         // pure logic, names no page
  'Tools/beta/test/smoke-beta.mjs',          // opens 002 (space in the name)
  'Tools/gamma/test/smoke-cross.mjs',        // gamma's suite, but opens 001
  'Tools/sweep/test/smoke-sweep.mjs',        // lists every page itself
];
const FAKE_FILES = {
  'Tools/alpha/test/smoke-alpha.mjs': "goto(BASE + '/Tools/001-alpha.html')",
  'Tools/alpha/test/logic.test.mjs': "import { f } from '../alpha.js';",
  'Tools/beta/test/smoke-beta.mjs': "goto(BASE + '/Tools/002-Beta%20Tool.html')",
  'Tools/gamma/test/smoke-cross.mjs': "goto(BASE + '/Tools/001-alpha.html')",
  'Tools/sweep/test/smoke-sweep.mjs': `const pages = fs.${LISTDIR}path.join(SITE, 'Tools'))`,
  'Tools/001-alpha.html': '<script type="module" src="alpha/alpha.js"></script>',
  'Tools/002-Beta Tool.html': '<script>inline only</script>',
  'Tools/003-delta.html': '<script src="../_shared/a11y.js"></script><script src="beta/beta.js"></script>',
};
const fakeEnv = {
  suites: FAKE_SUITES,
  readFile: rel => (rel in FAKE_FILES ? FAKE_FILES[rel] : null),
  listPages: () => Object.keys(FAKE_FILES).filter(f => /^Tools\/\d{3}-.*\.html$/.test(f)),
};
const pick = files => suitesForChanges(files, fakeEnv).selected;

console.log('select-suites: synthetic tree');
{
  const all = pick(['_shared/a11y.js']);
  ok(all.length === FAKE_SUITES.length, 'a _shared/ edit selects every suite');
  ok(pick(['sw.js']).length === FAKE_SUITES.length, 'sw.js selects every suite');
  ok(pick(['.github/workflows/ci.yml']).length === FAKE_SUITES.length, 'a workflow edit selects every suite');
  ok(pick(['Tools/board-check/harness.mjs']).length === FAKE_SUITES.length, 'a harness edit selects every suite');
  ok(pick(['manifest.json']).length === FAKE_SUITES.length, 'manifest.json selects every suite');
  ok(pick(['package-lock.json']).length === FAKE_SUITES.length, 'the lockfile selects every suite');
  ok(pick([]).length === 0, 'no files, no suites');
  ok(pick(['README.md', 'CLAUDE.md', 'eslint.config.js', '.gitignore']).length === 0, 'docs and config select nothing');
  ok(pick(['Tools/New Designs/x.html', 'Tools/Old Designs/y.html']).length === 0, 'the design archives select nothing');
}
{
  const s = pick(['Tools/alpha/alpha.js']);
  has(s, 'Tools/alpha/test/smoke-alpha.mjs', 'folder edit');
  has(s, 'Tools/alpha/test/logic.test.mjs', 'folder edit reaches the pure-logic suite too');
  has(s, 'Tools/gamma/test/smoke-cross.mjs', 'folder edit reaches the other tool that opens its page');
  has(s, 'Tools/sweep/test/smoke-sweep.mjs', 'folder edit reaches the sweep through the page it feeds');
  lacks(s, 'Tools/beta/test/smoke-beta.mjs', 'folder edit');
}
{
  const s = pick(['Tools/001-alpha.html']);
  has(s, 'Tools/alpha/test/smoke-alpha.mjs', 'page edit');
  has(s, 'Tools/gamma/test/smoke-cross.mjs', 'page edit reaches a suite in another folder that opens it');
  has(s, 'Tools/sweep/test/smoke-sweep.mjs', 'page edit reaches the sweep');
  lacks(s, 'Tools/alpha/test/logic.test.mjs', 'page edit does not run a pure-logic suite that never opens it');
  lacks(s, 'Tools/beta/test/smoke-beta.mjs', 'page edit');
}
{
  const s = pick(['Tools/002-Beta Tool.html']);
  has(s, 'Tools/beta/test/smoke-beta.mjs', 'a page with a space matches its %20 spelling');
  lacks(s, 'Tools/alpha/test/smoke-alpha.mjs', 'page-with-space edit');
  lacks(s, 'Tools/gamma/test/smoke-cross.mjs', 'page-with-space edit');
}
{
  const s = pick(['Tools/beta/beta.js']);
  has(s, 'Tools/beta/test/smoke-beta.mjs', 'beta folder edit');
  has(s, 'Tools/sweep/test/smoke-sweep.mjs', 'beta folder edit reaches 003, which imports it, and so the sweep');
  lacks(s, 'Tools/alpha/test/smoke-alpha.mjs', 'beta folder edit');
  const { why } = suitesForChanges(['Tools/beta/beta.js'], fakeEnv);
  ok(why.some(w => w.includes('Tools/003-delta.html loads from Tools/beta/')), 'the reason names the page that made the link');
}
{
  const s = pick(['Tools/alpha/test/smoke-alpha.mjs']);
  ok(s.length === 2 && s.includes('Tools/alpha/test/smoke-alpha.mjs') && s.includes('Tools/alpha/test/logic.test.mjs'),
    'editing a suite runs its own folder, nothing else (no page changed, so no sweep)');
}
{
  const s = pick(['Tools/alpha/hallway.html']);
  has(s, 'Tools/alpha/test/smoke-alpha.mjs', 'a support page under a folder counts as that folder');
  has(s, 'Tools/sweep/test/smoke-sweep.mjs', 'a support page counts as a page for the sweeps');
}
ok(pick(['Tools/001-alpha.html']).join() === pick(['Tools/001-alpha.html']).join(), 'selection is deterministic');
ok(pick(['Tools/001-alpha.html', 'Tools/alpha/alpha.js']).indexOf('Tools/alpha/test/smoke-alpha.mjs') <
   pick(['Tools/001-alpha.html', 'Tools/alpha/alpha.js']).indexOf('Tools/gamma/test/smoke-cross.mjs'),
  'the selection keeps suites.json order');

/* ── 2. helpers ────────────────────────────────────────────────────────── */

console.log('select-suites: helpers');
{
  const refs = foldersReferencedBy(
    '<script src="seating-chart/seating.js"></script>' +
    '<link href="../_shared/ink-paper.css">' +
    "<script type=module>import x from './schedule/x.js'; fetch('blank-map-generator/data/us.json')</script>" +
    '<img src="https://example.com/a/b.png"><a href="/Tools/x/y">'
  );
  ok(refs.has('seating-chart') && refs.has('schedule') && refs.has('blank-map-generator'), 'src, import and fetch references are found');
  ok(!refs.has('_shared') && !refs.has('..') && !refs.has('example.com') && !refs.has('Tools'),
    '_shared, parent, absolute and remote references are not folders');
  ok(needlesFor('005-Seating Chart Generator.html').includes('005-Seating%20Chart%20Generator.html'), 'needles include the %20 spelling');
  ok(needlesFor('001-hall-pass-log.html').length === 1, 'a name with no spaces has one spelling');
  ok(isSweep(`fs.${LISTDIR}path.join(SITE, 'Tools'))`) && !isSweep("goto('/Tools/001.html')"), 'isSweep keys on the directory listing');
  ok(toolOf('Tools/final-grade-checker/grade-math.test.mjs') === 'final-grade-checker', 'toolOf handles a suite beside its module');
}

/* ── 3. the real tree ──────────────────────────────────────────────────── */

const config = JSON.parse(fs.readFileSync(path.join(SITE, 'Tools', 'board-check', 'suites.json'), 'utf8'));
const SUITES = config.suites;
const realEnv = { suites: SUITES, readFile: readFileOnDisk(SITE), listPages: () => listPagesOnDisk(SITE) };
const real = files => suitesForChanges(files, realEnv).selected;

console.log('select-suites: real tree (' + SUITES.length + ' suites)');
{
  // Every suite is reachable by a change to its own folder. A suite that no
  // non-site-wide change can select would only ever run on main.
  const unreachable = SUITES.filter(s => !real([`Tools/${toolOf(s)}/anything.js`]).includes(s));
  ok(unreachable.length === 0, 'every suite is selected by an edit to its own folder' +
    (unreachable.length ? ': ' + unreachable.join(', ') : ''));

  // The four page sweeps are found by reading, not listed. If a fifth appears
  // it is covered automatically; if one of these stops sweeping, this says so.
  // This file must not be one of them — it is site-wide already.
  const sweeps = SUITES.filter(s => isSweep(fs.readFileSync(path.join(SITE, s), 'utf8')));
  ok(!sweeps.includes('Tools/board-check/test/select-suites.test.mjs'), 'this test does not read as a sweep');
  for (const expected of [
    'Tools/a11y-sweep/test/smoke-a11y-sweep.mjs',
    'Tools/theme/test/smoke-theme.mjs',
    'Tools/roster/test/smoke-picker-rollout.mjs',
    'Tools/tool-registry/test/registry-shape.test.mjs',
  ]) ok(sweeps.includes(expected), `${expected} is recognised as a page sweep`);
}
{
  const s = real(['Tools/005-Seating Chart Generator.html']);
  has(s, 'Tools/seating-chart/test/drive-seating.mjs', '005 page edit');
  has(s, 'Tools/store/test/smoke-quota-banner.mjs', '005 page edit reaches the store suite that opens 005');
  has(s, 'Tools/a11y-sweep/test/smoke-a11y-sweep.mjs', '005 page edit runs the a11y sweep');
  has(s, 'Tools/theme/test/smoke-theme.mjs', '005 page edit runs the theme sweep');
  lacks(s, 'Tools/name-picker/test/smoke.mjs', '005 page edit');
  lacks(s, 'Tools/schedule/test/smoke.mjs', '005 page edit');
  lacks(s, 'Tools/seating-chart/test/smoke-seating.mjs', '005 page edit (pure-logic suite never opens the page)');
  ok(s.length < SUITES.length / 2, `005 page edit selects a minority of suites (${s.length} of ${SUITES.length})`);
}
{
  const s = real(['Tools/schedule/schedule-core.js']);
  has(s, 'Tools/schedule/test/smoke.mjs', 'schedule folder edit');
  has(s, 'Tools/schedule-visualizer/test/smoke-recovery.mjs', 'schedule folder edit reaches 035, which imports Tools/schedule/');
  lacks(s, 'Tools/seating-chart/test/drive-seating.mjs', 'schedule folder edit');
}
{
  const s = real(['Tools/name-picker/picker.js']);
  has(s, 'Tools/name-picker/test/smoke.mjs', 'name-picker folder edit');
  lacks(s, 'Tools/seating-chart/test/drive-seating.mjs', 'name-picker folder edit');
  lacks(s, 'Tools/class-roster-hub/test/smoke-export.mjs', 'name-picker folder edit');
}
{
  ok(real(['BACKLOG.md', 'HISTORY.md']).length === 0, 'a backlog/history edit runs no suite');
  ok(real(['_shared/roster.js']).length === SUITES.length, 'a _shared edit runs every suite');
  ok(real(['Tools/board-check/select-suites.mjs']).length === SUITES.length, 'an edit to the selector itself runs every suite');
}

/* ── done ──────────────────────────────────────────────────────────────── */

console.log(`\nselect-suites: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
