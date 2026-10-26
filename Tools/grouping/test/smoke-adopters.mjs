// smoke-adopters.mjs — the pages that split a class through _shared/grouping.js
// (Path 13 P2), driven in a browser.
//
//   node Tools/grouping/test/smoke-adopters.mjs     (or: npm run test:grouping-adopters)
//
// parity.test.mjs holds the engine, with each tool's options, to a copy of that
// tool's old splitter. What a pure suite cannot see is whether the page really
// loads the engine and calls it with those options. So for each adopter this
// pins the engine's generator in the page (Grouping.pin(seed)), presses the
// tool's own button, reads the groups off the screen, and compares them with
// the old splitter (_legacy.mjs) fed the same seed's numbers in Node. Equal
// groups in equal order, for every seed, is "the port changed nothing".
//
// A new adopter gets an entry in ADOPTERS. Exits 1 on any failure. Every name
// here is invented.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import * as L from './_legacy.mjs';

const PORT = 8555;
const BASE = `http://127.0.0.1:${PORT}`;
const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, '..', '..', '..', '_shared/grouping.js'), 'utf8'), ctx);
const G = ctx.window.Grouping;

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const J = x => JSON.stringify(x);

const CLASS = ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Zheng He', 'Grace Hopper', 'Ida B Wells',
  'Mae Jemison', 'Alan Turing', 'Rosa Parks', 'Carl Sagan', 'Mary Seacole', 'Nikola Tesla', 'Katherine Johnson'];
const SEEDS = [1, 7, 42, 20261025, 3735928559];

/* Each adopter: the page, how to load a class, how to ask for k groups and
   press the button, how to read the groups back, and the old splitter. */
const ADOPTERS = [
  {
    tool: '007',
    url: '/Tools/007-Name%20Picker.html',
    async load(page, names) {
      await page.evaluate(r => localStorage.setItem('np_current', JSON.stringify(r)), names);
    },
    async split(page, k, seed) {
      return page.evaluate(([k, seed]) => {
        document.getElementById('groupCount').value = String(k);
        window.Grouping.pin(seed);
        document.getElementById('makeGroups').click();
        window.Grouping.pin(null);
        return Array.from(document.querySelectorAll('#groupsResult .group-card-names'))
          .map(el => el.textContent === '' ? [] : el.textContent.split(', '));
      }, [k, seed]);
    },
    counts: [2, 3, 4, 5, 12],
    legacy: (names, k, rng) => L.np007(names, k, rng)
  }
];

const server = await serve(PORT);
const browser = await launch();
try {
  for (const a of ADOPTERS) {
    console.log(`${a.tool} — the page's groups are the old splitter's`);
    const page = await prepPage(browser, BASE, { width: 1280, height: 950 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + a.url, { waitUntil: 'networkidle' });
    await a.load(page, CLASS);
    await page.reload({ waitUntil: 'networkidle' });
    await settle(page, 400);
    ok(await page.evaluate(() => typeof window.Grouping === 'object' && typeof window.Grouping.formGroups === 'function'),
      `${a.tool}: the page loads _shared/grouping.js`);
    for (const k of a.counts) {
      for (const seed of SEEDS) {
        const got = await a.split(page, k, seed);
        const want = a.legacy(CLASS.slice(), k, G.rng(seed));
        ok(J(got) === J(want), `${a.tool}: ${k} groups, seed ${seed} (got ${J(got)}, want ${J(want)})`);
      }
    }
    ok(errors.length === 0, `${a.tool}: no page errors (${errors.join(' | ')})`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\ngrouping adopters: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
