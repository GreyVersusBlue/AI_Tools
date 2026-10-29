// smoke-live-arrival.mjs — a shared or imported project whose built-in map this browser never drew arrives drawn (Path 20 P3, step 5).
//
//   node Tools/blank-map-generator/test/smoke-live-arrival.mjs   (npm run test:blank-map-live-arrival, port 8588)
//
// A maker page builds a plain lower-48 project and a data-shaded one; each is sent as a ?map= link to a
// fresh browser context that has nothing cached. The arrival must show the map on the live canvas (band
// colours for the shaded one) and the arrival sentence must not tell the teacher to pick the map again.
// A link whose shading key the pasted rows no longer give opens map-less and says so. Nothing is requested
// off-site by these steps.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8588;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/046-blank-map-generator.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

console.log('Blank Map — a shared project arrives drawn');
const server = await serve(PORT);
const browser = await launch();
const errors = [];
const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };

const maker = await prepPage(browser, BASE, { width: 1300, height: 950 });
watch(maker);
await maker.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(maker, 700);
await maker.selectOption('#baseMapSelect', 'usa-48');
await maker.click('#btnBaseMap');
await maker.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 20000 });
await settle(maker, 300);
const project = () => maker.evaluate(() => { const w = JSON.parse(localStorage.getItem('bmg_workspace_v1')); const p = w.projects.find(q => q.id === w.activeId); return p.data; });
const plain = await project();
ok(/^vector:usa-48:/.test(plain.mapId), 'the maker holds a plain vector id: ' + plain.mapId);
const linkOf = (data, name) => maker.evaluate(({ data, name }) => window.StateLink.encodeState({ name, ...data }), { data, name });
const plainLink = await linkOf(plain, 'Plain share');

await maker.click('#btnChoroToggle');
await maker.click('#btnChoroExample');
await settle(maker, 600);
await maker.click('#btnChoroApply');
await maker.waitForFunction(() => { const w = JSON.parse(localStorage.getItem('bmg_workspace_v1')); const p = w.projects.find(q => q.id === w.activeId); return /:choro:/.test(p.data.mapId); }, null, { timeout: 30000 });
await settle(maker, 800);
const shaded = await project();
const shadedLink = await linkOf(shaded, 'Shaded share');
const brokenLink = await linkOf({ ...shaded, mapId: shaded.mapId.replace(/:choro:.*$/, ':choro:nosuchkey') }, 'Broken share');

const tints = page => page.evaluate(() => {
  const c = document.getElementById('baseCanvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 28) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) seen.add((d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5));
  return seen.size;
});
const arrive = async (link) => {
  const page = await prepPage(browser, BASE, { width: 1300, height: 950 });
  watch(page);
  await page.goto(URL_PAGE + '?map=' + link, { waitUntil: 'networkidle' });
  await settle(page, 1500);
  return page;
};

const a = await arrive(plainLink);
const offsiteBase = a.__blocked.length;
ok(await a.evaluate(() => !document.getElementById('baseCanvas').hidden), 'a plain arrival is drawn on the live canvas');
const noteA = await a.textContent('#shareNote');
ok(/Loaded a shared map project/.test(noteA) && !/does not appear/.test(noteA), 'its note does not send the teacher back to pick the map: ' + noteA);
ok(await a.evaluate(() => document.getElementById('viewerEmpty').hidden), 'the empty-map card is gone');
ok(await a.evaluate(() => { const w = JSON.parse(localStorage.getItem('bmg_workspace_v1')); const p = w.projects.find(q => q.id === w.activeId); return /^vector:usa-48:/.test(p.data.mapId); }), 'and the project keeps its map id');

const b = await arrive(shadedLink);
ok(await b.evaluate(() => !document.getElementById('baseCanvas').hidden), 'a shaded arrival is drawn on the live canvas');
ok(await tints(b) >= 3, 'with its band colours: ' + await tints(b) + ' tints');
const noteB = await b.textContent('#shareNote');
ok(!/does not appear/.test(noteB), 'its note does not send the teacher back either: ' + noteB);

const c = await arrive(brokenLink);
ok(await c.evaluate(() => document.getElementById('baseCanvas').hidden), 'a link whose shading the rows no longer give shows no live canvas');
ok(/does not appear/.test(await c.textContent('#shareNote')), 'and its note still says to pick the map again');

ok(a.__blocked.length === offsiteBase, 'the plain arrival requested nothing off-site: ' + JSON.stringify(a.__blocked));
const real = errors.filter(e => !/Failed to load resource|net::ERR/.test(e));
ok(real.length === 0, 'no console errors: ' + JSON.stringify(real));
await browser.close();
server.close();
console.log(failed ? `${failed} failed, ${passed} passed` : `smoke-live-arrival: all ${passed} passed`);
process.exit(failed ? 1 : 0);
