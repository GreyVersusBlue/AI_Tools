// smoke-theme-packs.mjs — 064's theme packs on the page (BACKLOG rank 150): import a JSON pack of
// card themes, see them in the swatches, put them on cards, keep them across a reload, export,
// replace and remove them, and refuse a bad file without storing anything.
//
//   node Tools/historical-trading-card-maker/test/smoke-theme-packs.mjs      (port 8668)
//
// The pure rules (what a pack may hold, the contrast floor, the stored list) are in
// theme-packs.test.mjs. Here: that the page does what the rules say. Made-up names only.
// Exits 1 on any failure.

import fs from 'node:fs';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8668;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/064-historical-trading-card-maker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const theme = over => Object.assign({ id: 'forum', label: 'Forum', frame: 'greek-key', texture: 'parchment', font: 'Georgia, serif',
  ink: '#3d2b1f', paper: '#f4e9d0', accent: '#8a6d1d', accent2: '#5b4636' }, over);
const pack = (over, themes) => Object.assign({ v: 1, name: 'Rome unit', themes: themes || [theme(), theme({ id: 'villa', label: 'Villa', paper: '#e8f0e0' })] }, over);
const file = (obj, name = 'pack.json') => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)) });

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1100, height: 1000 });
const stored = () => page.evaluate(() => localStorage.getItem('htcm:themepacks'));
const swatches = () => page.$$eval('.theme-swatch', bs => bs.map(b => b.getAttribute('data-theme')));
const status = () => page.evaluate(() => document.getElementById('packStatus').innerText);
const importFile = async f => { await page.setInputFiles('#packFile', f); await settle(page, 250); };
const front = () => page.evaluate(() => {
  const c = document.querySelector('#previewFront .trading-card, #previewStage .trading-card');
  return c ? { cls: c.className, bg: getComputedStyle(c).backgroundColor, ink: getComputedStyle(c).color } : null;
});

console.log('School: 064 card theme packs');
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 300);
const BUILT_IN = (await swatches()).length;
eq(BUILT_IN, 11, 'the seven era themes and four subject packs are the swatches to begin with');
eq(await page.locator('#packList .pack-row').count(), 0, 'no pack is listed on a fresh browser');
await page.evaluate(() => { document.getElementById('packBox').open = true; });

console.log('1. importing');
await importFile(file(pack()));
eq(await swatches(), (await swatches()).slice(0, BUILT_IN).concat(['pk-rome-unit-forum', 'pk-rome-unit-villa']), 'a pack adds its themes after the built-in ones');
ok(/Imported .Rome unit.: 2 themes added to the swatches/.test(await status()), 'the status says what came in: ' + JSON.stringify(await status()));
eq(await page.locator('#packList .pack-row').count(), 1, 'and the pack is listed');
ok((await page.textContent('#packList .pack-name')).includes('Rome unit') && (await page.textContent('#packList .pack-name')).includes('Villa'), 'with its name and its themes');
eq(JSON.parse(await stored()).map(p => p.name), ['Rome unit'], 'and stored under htcm:themepacks');

console.log('2. a theme on a card');
await page.fill('#newName', 'Cicero');
await page.click('#addEntryBtn');
await settle(page, 200);
await page.click('.theme-swatch[data-theme="pk-rome-unit-forum"]');
await settle(page, 300);
let f = await front();
ok(f && f.cls.includes('theme-pk-rome-unit-forum'), 'the preview card carries the pack theme class: ' + JSON.stringify(f));
eq([f.bg, f.ink], ['rgb(244, 233, 208)', 'rgb(61, 43, 31)'], "and the pack's paper and ink colours");
eq(await page.getAttribute('.theme-swatch[data-theme="pk-rome-unit-forum"]', 'aria-pressed'), 'true', 'the swatch is pressed');
await page.click('.theme-swatch[data-theme="pk-rome-unit-villa"]');
await settle(page, 200);
eq((await front()).bg, 'rgb(232, 240, 224)', "the second theme's paper");
await page.click('.theme-swatch[data-theme="pk-rome-unit-forum"]');
await settle(page, 200);

const [png] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#pngBtn')]);
const pngBytes = fs.readFileSync(await png.path());
ok(pngBytes.length > 2000 && pngBytes.slice(1, 4).toString() === 'PNG', 'the PNG export of a card with a pack theme is a picture (' + pngBytes.length + ' bytes)');
await settle(page, 300);

console.log('3. across a reload');
await page.reload({ waitUntil: 'load' });
await settle(page, 400);
eq((await swatches()).slice(BUILT_IN), ['pk-rome-unit-forum', 'pk-rome-unit-villa'], 'the swatches come back');
f = await front();
ok(f && f.cls.includes('theme-pk-rome-unit-forum') && f.bg === 'rgb(244, 233, 208)', 'and the deck draws with its pack theme from the first paint: ' + JSON.stringify(f));
await page.evaluate(() => { document.getElementById('packBox').open = true; });

console.log('4. a bad file stores nothing');
const before = await stored();
await importFile(file(pack({}, [theme({ ink: '#999999' })])));
ok(/Nothing was imported\. 1 problem/.test(await status()) && /ink on paper is/.test(await status()), 'pale ink is refused and named: ' + JSON.stringify(await status()));
eq(await stored(), before, 'nothing was stored');
await importFile(file('{not json'));
ok(/not JSON/.test(await status()), 'a file that is not JSON says so');
await importFile(file(pack({}, [theme({ accent: 'red', font: 'a;b' })])));
ok(/2 problems/.test(await status()), 'two problems are counted: ' + JSON.stringify(await status()));
await importFile(file(' '.repeat(40001)));
ok(/over 40 KB/.test(await status()), 'an oversized file is refused');
eq(await stored(), before, 'still nothing stored');
eq((await swatches()).length, BUILT_IN + 2, 'and the swatches are as they were');

console.log('5. export and replace');
await page.evaluate(() => { document.getElementById('packBox').open = true; });
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#packList button:has-text("Export")')]);
eq(dl.suggestedFilename(), 'Rome unit theme pack.json', 'Export is named after the pack');
const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
eq(exported, pack(), 'and is the pack, as it was imported');
await importFile(file(pack({}, [theme({ id: 'villa', label: 'Villa II' })])));
ok(/replacing the pack of the same name/.test(await status()), 'a pack of the same name says it replaced the other');
eq((await swatches()).slice(BUILT_IN), ['pk-rome-unit-villa'], 'and only its themes are there now');
eq((await front()).cls.includes('theme-pk-rome-unit-forum') || (await front()).cls.includes('theme-classic'), true, 'a card whose theme went shows a theme that exists');
await importFile(file(pack()));

console.log('6. hostile text');
const evil = '<img src=x onerror=1>';
await importFile(file(pack({ name: 'Evil pack' }, [theme({ id: 'bad', label: evil })])));
eq(await page.evaluate(() => document.querySelectorAll('#packList img, .theme-swatches img, #packStatus img').length), 0, 'a label of markup is shown as text, never an element');
ok((await page.textContent('.theme-swatch[data-theme="pk-evil-pack-bad"]')).includes(evil), 'and the text is there as typed');
page.once('dialog', d => d.accept());
await page.click('#packList .pack-row:last-child button:has-text("Remove")');
await settle(page, 150);

console.log('7. removing');
const rome = '#packList .pack-row:has-text("Rome unit")';
page.once('dialog', d => d.dismiss());
await page.click(rome + ' button:has-text("Remove")');
eq((await swatches()).length, BUILT_IN + 2, 'declining the confirmation keeps the pack');
page.once('dialog', d => { ok(/Classic theme/.test(d.message()), 'the confirmation says the cards fall back to Classic'); d.accept(); });
await page.click(rome + ' button:has-text("Remove")');
await settle(page, 300);
eq(await swatches(), (await swatches()).slice(0, BUILT_IN), 'accepting it takes the themes off the swatches');
eq(JSON.parse(await stored()), [], 'and out of storage');
f = await front();
ok(f && f.cls.includes('theme-classic') && !f.cls.includes('theme-pk-'), 'a card that used one shows the Classic theme: ' + JSON.stringify(f));
ok(/Removed/.test(await status()), 'the status says so');

console.log('8. access and noise');
await importFile(file(pack()));
const bad = await a11yScan(page, { include: '#packBox' });
ok(bad.length === 0, 'the pack box has no serious axe finding: ' + JSON.stringify(bad.map(v => v.id)));
eq(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no horizontal scroll at 1100 px');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
