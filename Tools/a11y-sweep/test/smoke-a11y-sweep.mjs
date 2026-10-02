// smoke-a11y-sweep.mjs — axe-core over every live page, failing on serious and
// critical violations.
//
//   node Tools/a11y-sweep/test/smoke-a11y-sweep.mjs             (all pages)
//   node Tools/a11y-sweep/test/smoke-a11y-sweep.mjs --only 046  (one page, by number or name)
//   node Tools/a11y-sweep/test/smoke-a11y-sweep.mjs --all-impacts  (also print moderate/minor, not failing)
//   node Tools/a11y-sweep/test/smoke-a11y-sweep.mjs --empty-only   (skip the seeded pass)
//   node Tools/a11y-sweep/test/smoke-a11y-sweep.mjs --baseline     (record every unallowed finding
//                                                                   into the allowlist, dated, and exit 0)
//
// --baseline exists for one reason: the first run. 59 of 87 pages had at least
// one serious or critical violation on 2026-09-03 — 41 unlabeled <select>s, 23
// unlabeled inputs, contrast on 21 pages — and fixing those is per-tool work
// that belongs in each tool's improvement file, not in the commit that adds the
// check. The baseline records exactly what was red, per page and rule, with the
// date; the suite then fails on anything NEW, and fails again when an allowed
// rule stops firing so the entry has to come out. The list is meant to shrink.
//
// The accessibility widget (_shared/a11y.js) is on 77 tools and nothing had
// ever checked the pages under it. This opens index.html and every
// Tools/NNN-*.html as a teacher would (desktop width, first load, no data)
// and runs axe-core via harness.a11yScan(). A page fails on any violation of
// impact serious or critical that Tools/a11y-sweep/allowlist.json does not
// allow for it — and an allowance that no longer fires is ALSO a failure, so
// the list can only shrink as pages are fixed.
//
// Every page that has saved state worth showing is then scanned a SECOND time,
// labelled "[seeded]", with the localStorage in ../seeds.mjs written before
// its first script runs: the shared roster on every page that reads it, and a
// per-tool fixture on the pages whose violations shipped from behind saved
// state (#202, #206, #210 and seven more; seeds.mjs lists them). The empty
// pass alone could not see any of those. A seeded page has its own allowlist
// entry, "<page> [seeded]", so the two states are judged separately.
//
// What this does not cover, on purpose: states behind a click (a modal, a
// second tab of a tool, a mode the tool always opens out of — seeds.mjs names
// the ones it knows), which are per-tool suite territory; moderate and
// minor impacts, which are printed with --all-impacts but never fail; and
// colour contrast on text the tool draws on <canvas>. It is a floor.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { serve, launch, prepPage, settle, a11yScan, SITE } from '../../board-check/harness.mjs';
import { ROSTERS, PAGE_SEEDS } from '../seeds.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8403;
const BASE = `http://127.0.0.1:${PORT}`;
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const allImpacts = argv.includes('--all-impacts');
const baseline = argv.includes('--baseline');
const emptyOnly = argv.includes('--empty-only');
const ALLOWLIST_PATH = path.join(HERE, '..', 'allowlist.json');

const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
const allowed = allowlist.pages || {};

const pages = ['index.html', ...fs.readdirSync(path.join(SITE, 'Tools')).filter(f => /^\d{3}-.*\.html$/.test(f)).sort().map(f => 'Tools/' + f)];
const selected = only ? pages.filter(p => p.includes(only)) : pages;
if (!selected.length) { console.error(`smoke-a11y-sweep: --only ${only} matched no page`); process.exit(1); }

// Which pages touch the shared roster comes from the registry, not a list kept
// here: a new roster reader is seeded the day its registry row says so.
const registryCtx = { window: {} };
vm.createContext(registryCtx);
vm.runInContext(fs.readFileSync(path.join(SITE, '_shared', 'tool-registry.js'), 'utf8'), registryCtx);
const usesRoster = k => k === 'np_rosters' || (k && k.k === 'np_rosters');
const rosterPages = new Set(registryCtx.window.ToolRegistry.tools
  .filter(t => (t.keys || []).some(usesRoster) || (t.reads || []).some(usesRoster))
  .map(t => decodeURIComponent(t.file)));
for (const num of Object.keys(PAGE_SEEDS)) {
  if (!pages.some(p => p.startsWith(`Tools/${num}-`))) { console.error(`smoke-a11y-sweep: seeds.mjs seeds ${num}, which is no page`); process.exit(1); }
}
const seedFor = p => {
  const num = (p.match(/^Tools\/(\d{3})-/) || [])[1];
  const own = num && PAGE_SEEDS[num] ? PAGE_SEEDS[num]() : null;
  if (!own && !rosterPages.has(p) && num !== '009') return null;
  return { ...ROSTERS, ...(own || {}) };
};
const scans = [];
for (const p of selected) {
  scans.push({ p, key: p, seed: null });
  const seed = emptyOnly ? null : seedFor(p);
  if (seed) scans.push({ p, key: `${p} [seeded]`, seed });
}

// Jump every finite CSS animation to its end before scanning. index.html fades
// its categories in on a stagger that outlasts settle(), so axe used to read
// the last few mid-fade: the page's contrast count was 8, 24 or 35 depending
// on timing, with the file untouched. Infinite animations are left running.
const finishAnimations = page => page.evaluate(() => {
  for (const a of document.getAnimations()) {
    if (a.effect && a.effect.getComputedTiming().endTime !== Infinity) a.finish();
  }
});

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};

const server = await serve(PORT);
const browser = await launch();
const started = Date.now();
const advisory = [];

try {
  for (const { p, key, seed } of scans) {
    const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
    if (seed) {
      await page.addInitScript(entries => {
        if (sessionStorage.getItem('__a11ySeeded')) return;
        for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
        sessionStorage.setItem('__a11ySeeded', '1');
      }, seed);
    }
    try {
      await page.goto(`${BASE}/${encodeURI(p)}`, { waitUntil: 'load', timeout: 30000 });
      await settle(page, 500);
      await finishAnimations(page);
      const violations = await a11yScan(page, { impact: allImpacts ? 'minor' : 'serious' });
      const serious = violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
      const lesser = violations.filter(v => v.impact !== 'serious' && v.impact !== 'critical');
      const allow = allowed[key] || {};
      const label = key.replace(/^Tools\//, '');
      if (seed && page.__errs.length) ok(false, `${label}: the seed raised a page error — ${page.__errs[0]}`);
      if (baseline) {
        const entry = allowed[key] || (allowed[key] = {});
        for (const v of serious) if (!entry[v.id]) entry[v.id] = `baseline ${new Date().toISOString().slice(0, 10)}: ${v.count} × ${v.help.toLowerCase()} (e.g. ${v.nodes[0]}); fix in the tool, then remove this line`;
        for (const id of Object.keys(entry)) if (!serious.some(v => v.id === id)) delete entry[id];
        if (!Object.keys(entry).length) delete allowed[key];
        console.log(`  ${label}: ${serious.length} serious/critical recorded`);
        continue;
      }
      const unexpected = serious.filter(v => !allow[v.id]);
      const stale = Object.keys(allow).filter(id => !serious.some(v => v.id === id));
      ok(unexpected.length === 0,
        `${label}: ${unexpected.length} unallowed serious/critical violation${unexpected.length === 1 ? '' : 's'}` +
        (unexpected.length ? '\n' + unexpected.map(v => `        ${v.impact.padEnd(8)} ${v.id} ×${v.count} — ${v.help}\n                 ${v.nodes.join(' | ').slice(0, 220)}`).join('\n') : ''));
      ok(stale.length === 0,
        `${label}: allowlist entries that no longer fire: ${stale.join(', ') || 'none'}` +
        (stale.length ? ' — remove them from Tools/a11y-sweep/allowlist.json' : ''));
      if (lesser.length) advisory.push(`${label}: ` + lesser.map(v => `${v.impact} ${v.id} ×${v.count}`).join(', '));
      const allowedHere = serious.filter(v => allow[v.id]);
      if (allowedHere.length) console.log(`  allowed ${label}: ${allowedHere.map(v => `${v.id} ×${v.count}`).join(', ')}`);
    } catch (e) {
      ok(false, `${key}: scan crashed — ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (baseline) {
  allowlist.pages = Object.fromEntries(Object.entries(allowed).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(ALLOWLIST_PATH, JSON.stringify(allowlist, null, 2) + '\n');
  const n = Object.values(allowlist.pages).reduce((t, e) => t + Object.keys(e).length, 0);
  console.log(`\nsmoke-a11y-sweep: wrote ${Object.keys(allowlist.pages).length} pages / ${n} page-rule allowances to Tools/a11y-sweep/allowlist.json`);
  await browser.close().catch(() => {});
  process.exit(0);
}

if (advisory.length) {
  console.log('\nModerate/minor (advisory, not counted):');
  for (const a of advisory) console.log('  ' + a);
}
console.log(`\nAccessibility sweep — axe-core over ${selected.length} page${selected.length === 1 ? '' : 's'}, ${scans.length - selected.length} of them again seeded, in ${Math.round((Date.now() - started) / 1000)}s`);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\nfailures:');
  for (const f of fails) console.log('  ' + f.split('\n')[0]);
  process.exit(1);
}
