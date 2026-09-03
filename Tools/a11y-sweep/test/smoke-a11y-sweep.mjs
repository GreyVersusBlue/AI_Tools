// smoke-a11y-sweep.mjs — axe-core over every live page, failing on serious and
// critical violations.
//
//   node Tools/a11y-sweep/test/smoke-a11y-sweep.mjs             (all pages)
//   node Tools/a11y-sweep/test/smoke-a11y-sweep.mjs --only 046  (one page, by number or name)
//   node Tools/a11y-sweep/test/smoke-a11y-sweep.mjs --all-impacts  (also print moderate/minor, not failing)
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
// What this does not cover, on purpose: states behind a click (a modal, a
// second tab of a tool), which are per-tool suite territory; moderate and
// minor impacts, which are printed with --all-impacts but never fail; and
// colour contrast on text the tool draws on <canvas>. It is a floor.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, a11yScan, SITE } from '../../board-check/harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8403;
const BASE = `http://127.0.0.1:${PORT}`;
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const allImpacts = argv.includes('--all-impacts');
const baseline = argv.includes('--baseline');
const ALLOWLIST_PATH = path.join(HERE, '..', 'allowlist.json');

const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
const allowed = allowlist.pages || {};

const pages = ['index.html', ...fs.readdirSync(path.join(SITE, 'Tools')).filter(f => /^\d{3}-.*\.html$/.test(f)).sort().map(f => 'Tools/' + f)];
const selected = only ? pages.filter(p => p.includes(only)) : pages;
if (!selected.length) { console.error(`smoke-a11y-sweep: --only ${only} matched no page`); process.exit(1); }

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
  for (const p of selected) {
    const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
    try {
      await page.goto(`${BASE}/${encodeURI(p)}`, { waitUntil: 'load', timeout: 30000 });
      await settle(page, 500);
      const violations = await a11yScan(page, { impact: allImpacts ? 'minor' : 'serious' });
      const serious = violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
      const lesser = violations.filter(v => v.impact !== 'serious' && v.impact !== 'critical');
      const allow = allowed[p] || {};
      const label = p.replace(/^Tools\//, '');
      if (baseline) {
        const entry = allowed[p] || (allowed[p] = {});
        for (const v of serious) if (!entry[v.id]) entry[v.id] = `baseline ${new Date().toISOString().slice(0, 10)}: ${v.count} × ${v.help.toLowerCase()} (e.g. ${v.nodes[0]}); fix in the tool, then remove this line`;
        for (const id of Object.keys(entry)) if (!serious.some(v => v.id === id)) delete entry[id];
        if (!Object.keys(entry).length) delete allowed[p];
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
      ok(false, `${p}: scan crashed — ${String(e.message || e).split('\n')[0]}`);
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
console.log(`\nAccessibility sweep — axe-core over ${selected.length} page${selected.length === 1 ? '' : 's'} in ${Math.round((Date.now() - started) / 1000)}s`);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\nfailures:');
  for (const f of fails) console.log('  ' + f.split('\n')[0]);
  process.exit(1);
}
