// smoke-ids.mjs — 018 and 019 give every station a stable id on disk (Path 18 P1).
//
//   node Tools/stations/test/smoke-ids.mjs      (or: npm run test:stations-smoke)
//
// What P1's build changes in the two pages is one thing: they call Stations.ensureIds() on
// the loaded blob and save when it drew one. This opens each page with the saved shape it
// had BEFORE (fixtures from stations.test.mjs: 018's rock-cycle hunt with a live run, 019's
// station-qr room) and reads the key back: every station has a four-character id, a reload
// keeps them, moving a station keeps its id, a removed station's id is not reused for the
// next station added, and nothing else in the blob moved (the stations' other fields and the
// 018 run are exactly what was seeded). No console errors. Share links are P2 and are not
// asserted. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import * as F from './_fixtures.mjs';

const PORT = 8568;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const ID = /^[a-z0-9]{4}$/;

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept());

const PAGES = [
  { n: '018', url: '/Tools/018-qr-scavenger-hunt-builder.html', key: 'qr-scavenger-hunt-sets', seed: F.H2(), name: 'Rock cycle hunt', rows: '#stations-body tr[data-idx]', add: '#add-row-btn', plain: false },
  { n: '019', url: '/Tools/019-escape-room-builder.html', key: 'escape-room-builder:rooms', seed: F.R2(), name: 'Crypt of Ammon', rows: '#stationsList .station-card', add: '#addStationBtn', plain: true },
];
const readKey = (key) => page.evaluate((k) => {
  const v = JSON.parse(localStorage.getItem(k));
  const store = v && v.data && v.v ? v.data : v;
  return store;
}, key);

for (const P of PAGES) {
  console.log(`${P.n} — ids on disk`);
  const errs = () => page.__errs.length;
  await page.goto(BASE + P.url, { waitUntil: 'load' });
  await page.evaluate(([k, name, seed, wrap]) => {
    const store = { current: name, sets: { [name]: seed } };
    localStorage.setItem(k, JSON.stringify(wrap ? { v: 1, data: store } : store));
  }, [P.key, P.name, P.seed, P.plain]);
  await page.goto(BASE + P.url, { waitUntil: 'load' }); await settle(page, 500);

  let set = (await readKey(P.key)).sets[P.name];
  ok(set.stations.every(s => ID.test(s.id)), `${P.n}: every station has a four-character id`);
  eq(new Set(set.stations.map(s => s.id)).size, set.stations.length, `${P.n}: the ids are unique`);
  const ids1 = set.stations.map(s => s.id);
  const strip = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.id; (c.stations || []).forEach(s => delete s.id); return c; };
  const want = strip(P.seed);
  if (P.n === '019') eq(strip(set), want, `${P.n}: nothing else in the saved room changed`);
  else { eq(strip(set).stations, want.stations, `${P.n}: the stations are otherwise as seeded`); eq(set.run.teams.map(t => t.marks), P.seed.run.teams.map(t => Object.fromEntries(Object.entries(t.marks).map(([k, m]) => [k, typeof m === 'number' ? { at: m, correct: true } : m]))), `${P.n}: the live run is as 018's own ensureRun() leaves it (marks still index-keyed; an old numeric mark upgraded as before)`); }
  if (P.n === '018') ok(typeof set.id === 'string' && set.id.length >= 8, '018: the hunt itself gets a set id');

  await page.goto(BASE + P.url, { waitUntil: 'load' }); await settle(page, 500);
  set = (await readKey(P.key)).sets[P.name];
  eq(set.stations.map(s => s.id), ids1, `${P.n}: a reload keeps the ids`);

  // move station 2 up: it keeps its id and the order of ids follows the stations
  await page.click(`${P.rows}:nth-of-type(2) [data-move="-1"], ${P.rows}[data-idx="1"] [data-move="-1"]`);
  await settle(page, 400);
  set = (await readKey(P.key)).sets[P.name];
  eq(set.stations.map(s => s.id), [ids1[1], ids1[0], ...ids1.slice(2)], `${P.n}: moving a station moves its id with it`);

  // remove the last, add one: the new one has an id, and it is not the removed one's
  const lastIdx = ids1.length - 1;
  await page.click(`${P.rows}[data-idx="${lastIdx}"] [data-remove]`); await settle(page, 300);
  set = (await readKey(P.key)).sets[P.name];
  eq(set.stations.length, ids1.length - 1, `${P.n}: a station was removed`);
  await page.click(P.add); await settle(page, 400);
  set = (await readKey(P.key)).sets[P.name];
  const fresh = set.stations[set.stations.length - 1].id;
  ok(ID.test(fresh) && fresh !== ids1[lastIdx], `${P.n}: a station added after a removal draws a new id (${fresh})`);
  eq(new Set(set.stations.map(s => s.id)).size, set.stations.length, `${P.n}: still unique`);
  eq(errs(), 0, `${P.n}: no console errors (${page.__errs.join(' | ')})`);
}

await browser.close(); server.close();
console.log(`stations smoke: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
