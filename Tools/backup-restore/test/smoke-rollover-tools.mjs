// smoke-rollover-tools.mjs — every tool opened after a year rollover (Path 3
// P6, item 6). rollover.test.mjs proves each reducer's output in Node; this is
// the only proof that each tool loads the shape its reducer leaves.
//
//   node Tools/backup-restore/test/smoke-rollover-tools.mjs
//
// One profile is seeded with what the clear writes: every fixture of
// _rollover-fixtures.mjs reduced by the real BrRollover rule (a deleted key
// left out), and the switcher keys a page needs to show its document. Then
// each tool that owns a reduced key is opened, and must have:
//   - no page error;
//   - no fixture student's name anywhere on the page (text, form values,
//     option labels, titles);
//   - its setup marker still on the page: the one kept thing the fixture
//     put there (005's desk layout name, 001's custom destination, 008's
//     custom tag, 013's contract wording, and so on), which is what shows the
//     page read the reduced document rather than falling back to a blank one.
//
// Exits 1 on any failure.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { serve, launch, prepPage, settle, SITE } from '../../board-check/harness.mjs';
import { FIX, RAW } from './_rollover-fixtures.mjs';

const PORT = 8536;
const BASE = `http://127.0.0.1:${PORT}`;
const NAMES = ['Avery Stone', 'Blake Rivers', 'Casey Lund'];

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};

/* The real module and registry, in a vm, as rollover.test.mjs runs them. */
const window = { crypto: globalThis.crypto, TextEncoder };
const ctx = { window, document: { currentScript: null }, TextEncoder, setTimeout, clearTimeout, globalThis: {} };
vm.createContext(ctx);
for (const f of ['_shared/tool-registry.js', 'Tools/backup-restore/br-rollover.js']) {
  vm.runInContext(readFileSync(path.join(SITE, f), 'utf8'), ctx);
}
const RO = window.BrRollover;
const REG = window.ToolRegistry;
const CTX = { names: NAMES, nextTerm: '2027-28', choices: {} };

/* What the clear leaves: each fixture through its rule. */
const SEED = {};
const owner = {};
for (const [key, [fixture]] of Object.entries(FIX)) {
  const r = RO.reduceKey(RO.ruleFor(key), key, JSON.stringify(fixture), CTX);
  if (r.action === 'write') SEED[key] = r.after;
  else if (r.action !== 'delete') throw new Error(key + ': the reducer did not change it (' + r.action + ')');
  const hit = REG.lookupKey(key);
  if (!hit) throw new Error(key + ': no registry row');
  (owner[hit.tool.file] = owner[hit.tool.file] || []).push(key);
}
for (const [key, text] of Object.entries(RAW)) {
  const r = RO.reduceKey(RO.ruleFor(key), key, text, CTX);
  if (r.action === 'write') SEED[key] = r.after;
  const hit = REG.lookupKey(key);
  (owner[hit.tool.file] = owner[hit.tool.file] || []).push(key);
}

/* The switchers that open each document, as the teacher left them. They are
   setup and the rollover keeps them; 020's bracket is deleted, so its
   switcher would be rewritten to the documents left and is not seeded. */
const SWITCHERS = {
  'gtg:list': ['Period 3'], 'gtg:current': 'Period 3',
  'gvb-review-board:list': ['Unit 3'], 'gvb-review-board:current': 'Unit 3',
  'gvb-grade-distribution:list': ['Quiz'], 'gvb-grade-distribution:current': 'Quiz',
  'gvb-certificate-maker:list': ['Awards'], 'gvb-certificate-maker:current': 'Awards',
  'gvb-field-trip:list': ['Zoo'], 'gvb-field-trip:current': 'Zoo',
  'crcg:list': ['Senate'], 'crcg:current': 'Senate',
  'htcm:list': ['Figures'], 'htcm:current': 'Figures',
  'socsem:list': ['Seminar'], 'socsem:current': 'Seminar',
  lsct_current_v1: 'Period 3', lgrr_current: 'Bio 1', 'novel-study-circles-current': 'Hatchet',
};
for (const [k, v] of Object.entries(SWITCHERS)) SEED[k] = typeof v === 'string' ? v : JSON.stringify(v);

/* The setup each page must still show, from its fixture; each was checked
   to be absent from the page in an empty profile, and pass 1 holds that. A
   page whose only key the clear deletes has nothing to show, and is held to
   the document being gone instead (`gone`). */
const MARKERS = {
  '001': 'Library annex', '002': 'Scribe', '005': 'Test day', '006': 'Biology', '007': 'Pair and share',
  '008': 'Lab helper', '013': 'I will wear goggles', '014': 'Period 3', '016': 'Calculator 1', '017': 'One wish',
  '018': 'mitosis', '021': 'Sack race', '022': 'Materials manager', '023': 'Got it, mostly', '024': '3x4',
  '027': 'Word wizard', '029': 'Plan for cells', '030': 'Cells', '033': 'Cozy mystery', '037': '87.5',
  '038': 'Rainfall', '042': 'Star of the week', '043': 'City Zoo', '044': 'Exit B', '048': 'Spring show',
  '050': 'Vote no', '058': 'Mr. Okafor', '060': 'Shuttle run', '064': 'Oliver Kelley (Grange)', '073': 'Hypothesis draft',
  '075': 'Mr. Okafor', '077': 'Extended time (1.5x)', '084': 'Is it fair?', '085': 'Field trip',
};
const GONE = { '020': 'gvb-bracket:data:Spelling', '045': 'gvb-sub-binder:today-lesson' };
const num = file => (/Tools\/(\d{3})-/.exec(file) || [])[1];

const PROBE = process.argv.includes('--probe');
const server = await serve(PORT);
const browser = await launch();
async function pageText(page) {
  return page.evaluate(() => {
    const parts = [document.body.textContent, document.title];
    document.querySelectorAll('input, textarea, select').forEach(el => parts.push(el.value || ''));
    document.querySelectorAll('option, [title], [aria-label], [placeholder]').forEach(el =>
      parts.push(el.textContent || '', el.getAttribute('title') || '', el.getAttribute('aria-label') || '', el.getAttribute('placeholder') || ''));
    return parts.join('\n');
  });
}
async function visit(page, file) {
  page.__errs.length = 0;
  await page.goto(BASE + '/' + file);
  await settle(page, 700);
  return pageText(page);
}
const FILES = Object.keys(owner).sort();
try {
  console.log('Every tool after a year rollover — ' + FILES.length + ' pages');
  ok(FILES.every(f => MARKERS[num(f)] || GONE[num(f)]), 'every page with a reduced key has a marker or a gone key (' + FILES.filter(f => !MARKERS[num(f)] && !GONE[num(f)]).join(', ') + ')');
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/index.html');

  /* Pass 1, the control: no marker is on its page without the data. */
  await page.evaluate(() => localStorage.clear());
  for (const file of FILES) {
    const m = MARKERS[num(file)];
    if (!m) continue;
    const seen = await visit(page, file);
    ok(!seen.includes(m), file + ': without the data, "' + m + '" is not on the page (so it can be a marker)');
    await page.evaluate(() => localStorage.clear());
  }

  /* Pass 2, after the rollover. */
  await page.evaluate(seed => { localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);
  for (const file of FILES) {
    const seen = await visit(page, file);
    if (PROBE) { console.log('=== ' + file + ' [' + owner[file].join(', ') + '] errs=' + page.__errs.length + ' ' + page.__errs.slice(0, 2).join(' | ')); console.log(seen.replace(/\s+/g, ' ')); continue; }
    ok(page.__errs.length === 0, file + ': no page error (' + page.__errs.slice(0, 2).join(' | ') + ')');
    const left = NAMES.filter(n => seen.includes(n));
    ok(!left.length, file + ': no student name on the page (' + left.join(', ') + ')');
    const m = MARKERS[num(file)];
    if (m) ok(seen.includes(m), file + ': its setup is still there ("' + m + '")');
    else ok(await page.evaluate(k => localStorage.getItem(k), GONE[num(file)]) === null, file + ': the deleted ' + GONE[num(file)] + ' is not brought back');
  }
  await page.context().close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
