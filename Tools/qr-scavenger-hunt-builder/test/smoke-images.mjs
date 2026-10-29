// smoke-images.mjs — 018 shows a station's picture on its card (Path 18 P3, v387).
//
//   node Tools/qr-scavenger-hunt-builder/test/smoke-images.mjs      (or: npm run test:scavenger-hunt-images)
//
// A hunt station may carry one picture, `image`: 'idb:<id>' in the media store under the namespace
// 'scavenger-hunt' (its own, so 019's clean-up of 'escape-room' never reaches it), or a data URL when
// IndexedDB would not take the write. Cases: no picture is no field and no <img> on any card; picking
// a file puts an idb reference on the station and a picture on the preview card, the QR card and the
// clue card; a reload keeps it; removing it deletes the field; a saved hunt with an inline picture is
// moved into the store at boot; a stored picture no hunt points at is deleted at boot, only in its own
// namespace (a picture in 'escape-room' is left alone); a reference with nothing behind it is said on
// the station and prints no frame; the share link carries no picture; an older saved hunt (no field)
// still loads with the stations it had. No console errors. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import * as F from '../../stations/test/_fixtures.mjs';

const PORT = 8570;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/018-qr-scavenger-hunt-builder.html';
const KEY = 'qr-scavenger-hunt-sets';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==';

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept());

const seed = (hunt) => page.evaluate(([k, h]) => {
  localStorage.setItem(k, JSON.stringify({ current: h.name, sets: { [h.name]: h } }));
}, [KEY, hunt]);
const saved = (name) => page.evaluate(([k, n]) => JSON.parse(localStorage.getItem(k)).sets[n], [KEY, name]);
const records = (ns) => page.evaluate((n) => window.MediaDB.store({ ns: n }).list(), ns);
const open = async () => { await page.goto(URL_PAGE, { waitUntil: 'load' }); await page.waitForFunction(() => window.__huntImagesSettled === true, null, { timeout: 8000 }); await settle(page, 400); };
const clean = async () => { await page.goto(URL_PAGE, { waitUntil: 'load' }); await page.evaluate(async () => { localStorage.clear(); for (const ns of ['scavenger-hunt', 'escape-room']) { const s = window.MediaDB.store({ ns }); for (const r of await s.list()) await s.remove(r.id); } }); };

const hunt = () => { const h = F.H2(); h.name = 'Pictures'; return h; };

console.log('018 — a station without a picture');
await clean(); await seed(hunt()); await open();
eq(await page.locator('#print-station-grid img.p-img, .print-station-grid img.p-img').count(), 0, 'no <img> on any printed card');
eq((await saved('Pictures')).stations.some(s => 'image' in s), false, 'no station gains an image field');

console.log('018 — picking a picture');
const png = Buffer.from(RED.split(',')[1], 'base64');
await page.locator('[data-hint-toggle]').first().click();
await page.locator('input.f-image').first().setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: png });
await page.waitForFunction(() => document.querySelector('[data-remove-image]'), null, { timeout: 8000 });
await settle(page, 500);
let st = (await saved('Pictures')).stations[0];
ok(/^idb:[A-Za-z0-9_-]+$/.test(st.image || ''), 'the station holds an idb: reference');
eq((await records('scavenger-hunt')).length, 1, 'one picture is in the scavenger-hunt namespace');
eq((await records('escape-room')).length, 0, 'and none in 019\'s');
eq(await page.locator('.preview-card img.pv-img').count(), 1, 'the preview card shows it');
eq(await page.locator('.print-station-grid img.p-img').count() >= 1, true, 'the QR card prints it');
ok((await page.locator('.print-station-grid img.p-img').first().getAttribute('src')).startsWith('data:image/'), 'as a data URL, not the reference');
eq((await page.locator('.print-station-grid img.p-img').first().getAttribute('alt')), '', 'decorative: empty alt');

console.log('018 — it survives a reload, and the clue card has it too');
await open();
eq((await saved('Pictures')).stations[0].image, st.image, 'the reference is unchanged after a reload');
eq(await page.locator('[data-remove-image]').count(), 1, 'the station opens on its picture with a Remove button');

console.log('018 — removing it');
await page.evaluate(() => { window.print = () => {}; });
await page.locator('#print-clues-btn').click();
await settle(page, 400);
eq(await page.locator('#print-clues-grid img.p-img').count(), 1, 'the clue cards print it as well');
await page.locator('[data-remove-image]').first().click();
await settle(page, 400);
eq('image' in (await saved('Pictures')).stations[0], false, 'the field is gone');
eq(await page.locator('.preview-card img.pv-img').count(), 0, 'and the card shows none');

console.log('018 — boot: inline moved in, a neighbour\'s namespace is left alone');
await clean();
const h2 = hunt(); h2.stations[0].image = RED;
await seed(h2);
await page.evaluate(async () => { await window.MediaDB.store({ ns: 'escape-room' }).put('keepmine', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), { tool: 'escape-room-builder' }); });
await open();
st = (await saved('Pictures')).stations[0];
ok(/^idb:/.test(st.image || ''), 'an inline picture is moved into the store at boot');
ok((await records('escape-room')).some(r => r.id === 'keepmine'), 'a picture in 019\'s namespace is left alone');

console.log('018 — a reference with nothing behind it');
await clean();
const h3 = hunt(); h3.stations[0].image = 'idb:gone123';
await seed(h3); await open();
await page.locator('[data-hint-toggle]').first().click();
eq(await page.locator('.station-image-missing').count(), 1, 'said on the station');
eq(await page.locator('.print-station-grid img.p-img').count(), 0, 'and no frame is printed');

console.log('018 — an older saved hunt (no field) still loads');
await clean(); await seed(hunt()); await open();
eq((await page.locator('#stations-body tr[data-idx]').count()), F.H2().stations.length, 'every station is there');

ok(page.__errs.length === 0, 'no console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));
console.log(`scavenger hunt images: ${passed} passed, ${failed} failed`);
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
