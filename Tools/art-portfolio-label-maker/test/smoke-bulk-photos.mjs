// smoke-bulk-photos.mjs — 048's bulk photo import (apl-photos.js and the page).
//
//   node Tools/art-portfolio-label-maker/test/smoke-bulk-photos.mjs
//
// A whole set of photos is chosen at once, shrunk in the browser, matched to entries by file name
// and shown as a plan the teacher can change before anything is stored. Every image here is drawn
// by the test; no photo of anyone is used. What this holds down:
//
//   The matcher: exact and partial name matches, an ambiguous name left unmatched, one photo per
//   entry, file-name order, the "fill the rest in order" and "replace" options, the limit.
//   The page: a 3000x2000 photo is stored at 480x320 as a JPEG, a transparent PNG goes white,
//   a text file and a broken picture are named and left out, the plan can be edited line by line,
//   nothing is stored until Add, a full browser store keeps the old portfolio and says so,
//   and nothing leaves the site. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import '../apl-photos.js';

const P = globalThis.PortfolioPhotos;
const PORT = 8635;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/048-art-portfolio-label-maker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const ids = plan => JSON.stringify(plan.map(p => p.entryId));

console.log('Art Portfolio Label Maker — bulk photos');

/* ── pure ──────────────────────────────────────────────────────────────── */
eq(P.baseName('C:\\Photos\\Ava_R (1).JPG'), 'Ava_R', 'a path, an extension and a camera counter come off');
eq(P.baseName('ava-r copy.png'), 'ava-r', 'a copy suffix comes off');
eq(JSON.stringify(P.words('José_Núñez-2')), '["jose","nunez","2"]', 'words fold accents and punctuation');
eq(P.looksLikeImage({ name: 'a.txt', type: 'text/plain' }), false, 'a text file is not a picture');
eq(P.looksLikeImage({ name: 'a.HEIC', type: '' }), true, 'no type: the extension decides');
eq(P.looksLikeImage({ name: 'a.png', type: 'image/png' }), true, 'an image type is a picture');
eq(P.titleFromName('clay_bowl-2 (1).jpg'), 'clay bowl 2', 'a new entry’s title comes from the file name');
eq(JSON.stringify(P.fitWithin(3000, 2000, 480)), '{"w":480,"h":320}', 'a big photo is fitted to 480 on its long side');
eq(JSON.stringify(P.fitWithin(100, 80, 480)), '{"w":100,"h":80}', 'a small one is never enlarged');
eq(JSON.stringify(P.fitWithin(0, 5, 480)), '{"w":0,"h":0}', 'a zero size stays zero');

const E = [
  { id: 'a', title: 'Self-Portrait', artist: 'Ava R.', image: '' },
  { id: 'm', title: 'Clay Bowl', artist: 'Marco T.', image: '' },
  { id: 'z', title: 'Landscape', artist: 'Zoe Kim', image: 'data:x' },
  { id: 'c', title: 'Clay Bowl', artist: '', image: '' },
  { id: 'p', title: 'Print', artist: 'Ava R.', image: '' },
];
const F = names => names.map(name => ({ name }));
eq(ids(P.plan(F(['marco_t.jpg']), E)), '["m"]', 'artist words match: marco_t.jpg is Marco T.');
eq(ids(P.plan(F(['Marco T.JPG']), E)), '["m"]', 'case and punctuation do not matter');
eq(ids(P.plan(F(['IMG_0042.jpg']), E)), '[null]', 'a camera name matches nothing');
eq(ids(P.plan(F(['ava-r.jpg']), E)), '[null]', 'two entries for one artist: ambiguous, so left for the teacher');
eq(ids(P.plan(F(['ava-r-self-portrait.jpg']), E)), '["a"]', 'a longer name can tell them apart');
eq(ids(P.plan(F(['clay bowl.jpg']), E)), '[null]', 'two entries titled Clay Bowl: ambiguous');
eq(ids(P.plan(F(['clay-bowl-marco-t.jpg']), E)), '["m"]', 'artist and title together beat the title alone');
eq(ids(P.plan(F(['mask.jpg']), [{ id: 'k', title: 'Mask', artist: '', image: '' }])), '["k"]', 'no artist: the title is the key');
eq(ids(P.plan(F(['zoe-kim.jpg']), E)), '[null]', 'an entry that has a photo is not offered');
eq(ids(P.plan(F(['zoe-kim.jpg']), E, { replace: true })), '["z"]', 'unless replace is on');
eq(ids(P.plan(F(['marco t 1.jpg', 'marco t 2.jpg']), E)), '["m",null]', 'one photo per entry, the first in file-name order');
eq(ids(P.plan(F(['marco t 10.jpg', 'marco t 2.jpg']), E)), '[null,"m"]', 'file-name order is natural (2 before 10)');
eq(JSON.stringify(P.plan(F(['q.jpg', 'r.jpg', 's.jpg', 't.jpg', 'u.jpg']), E, { fillInOrder: true }).map(p => p.entryId)), '["a","m","c","p",null]', 'fill in order: entries still without a photo, in list order');
eq(P.plan(F(['q.jpg']), E, { fillInOrder: true })[0].how, 'order', 'and says it was by order');
eq(P.plan(F(['marco_t.jpg']), E)[0].how, 'name', 'a name match says so');
eq(P.plan(new Array(80).fill({ name: 'x.jpg' }), E).length, P.MAX_FILES, 'a batch is capped');
eq(P.plan(null, null).length, 0, 'nothing in, nothing out');

/* ── page ──────────────────────────────────────────────────────────────── */
const server = await serve(PORT);
const browser = await launch();
const STORE = {
  list: [{ id: 'p1', name: 'Rm 214', title: 'Semester 1', labelsPerPage: '6', ecLevel: 'Q', entries: [
    { id: 'e1', title: 'Self-Portrait', artist: 'Ava R.', description: 'Charcoal', image: '' },
    { id: 'e2', title: 'Clay Bowl', artist: 'Marco T.', description: '', image: '' },
    { id: 'e3', title: 'Landscape', artist: 'Zoe Kim', description: '', image: '' },
    { id: 'e4', title: 'Mask', artist: '', description: '', image: '' }] }],
  currentId: 'p1',
};
async function open(size = { width: 1300, height: 1000 }) {
  const page = await prepPage(browser, BASE, size);
  await page.addInitScript(s => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('apl_portfolios_v1', s);
  }, JSON.stringify(STORE));
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
// An image drawn here: a PNG buffer of the given size and fill.
async function makePng(page, w, h, fill) {
  const b64 = await page.evaluate(([w, h, fill]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (fill) { x.fillStyle = fill; x.fillRect(0, 0, w, h); }
    x.fillStyle = '#00f'; x.fillRect(0, 0, w / 2, h / 2);
    return c.toDataURL('image/png').split(',')[1];
  }, [w, h, fill]);
  return Buffer.from(b64, 'base64');
}
async function choose(page, files, folder = false) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click(folder ? '#bulkFolderBtn' : '#bulkFilesBtn')]);
  await chooser.setFiles(files);
  await page.waitForSelector('#bulkRows tr', { timeout: 15000 });
  await settle(page, 200);
}
const savedEntries = page => page.evaluate(() => JSON.parse(localStorage.getItem('apl_portfolios_v1')).list[0].entries);
const planRows = page => page.$$eval('#bulkRows tr', trs => trs.map(tr => ({
  file: tr.children[0].textContent, to: tr.querySelector('select').selectedOptions[0].textContent, how: tr.children[2].textContent })));
const dims = (page, url) => page.evaluate(u => new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight, u.slice(0, 23)]); i.onerror = () => r(null); i.src = u; }), url);

let page = await open();
const big = await makePng(page, 3000, 2000, '#e33');
const small = await makePng(page, 100, 80, '#3a3');
const clear = await makePng(page, 60, 60, null);
const files = [
  { name: 'ava-r.png', mimeType: 'image/png', buffer: big },
  { name: 'Marco_T.png', mimeType: 'image/png', buffer: small },
  { name: 'IMG_0042.png', mimeType: 'image/png', buffer: clear },
  { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
  { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a picture at all') },
];
ok(await page.evaluate(() => document.querySelectorAll('input[type=file][webkitdirectory]').length) === 1, 'the folder chooser asks for a directory');
await choose(page, files);
let rows = await planRows(page);
eq(rows.length, 3, 'three readable pictures make three plan lines');
const line = f => rows.find(r => r.file === f);
eq(line('IMG_0042.png').to + '>' + line('IMG_0042.png').how, '(skip this photo)>', 'a camera name is skipped, not guessed');
eq(line('ava-r.png').to.startsWith('Ava R.'), true, 'ava-r.png goes to Ava R.');
eq(line('ava-r.png').how, 'by name', 'and says so');
eq(line('Marco_T.png').to.startsWith('Marco T.'), true, 'Marco_T.png goes to Marco T.');
const summary = await page.textContent('#bulkSummary');
ok(/2 of 3 photos matched/.test(summary), 'the summary counts the matches: ' + summary);
ok(/could not read: broken\.jpg/.test(summary), 'a broken picture is named');
ok(/1 file is not a picture/.test(summary), 'a text file is counted');
eq((await savedEntries(page)).filter(e => e.image).length, 0, 'nothing is stored before Add');

// Edit a line: send the camera photo to the blank "Mask" entry.
await page.selectOption('#bulkRows tr:nth-child(3) select', 'e4');
await settle(page, 100);
rows = await planRows(page);
eq(line('IMG_0042.png').how, 'by you', 'a line changed by hand says so');
ok(/3 of 3 photos matched/.test(await page.textContent('#bulkSummary')), 'and the count follows');
await page.click('#bulkApplyBtn');
await settle(page, 300);
let ents = await savedEntries(page);
eq(ents.map(e => !!e.image).join(), 'true,true,false,true', 'the three entries now have photos');
const d1 = await dims(page, ents[0].image);
eq(JSON.stringify(d1), '[480,320,"data:image/jpeg;base64,"]', 'the 3000x2000 photo is stored at 480x320 as a JPEG');
const d2 = await dims(page, ents[1].image);
eq(JSON.stringify([d2[0], d2[1]]), '[100,80]', 'a small photo is not enlarged');
const white = await page.evaluate(u => new Promise(r => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.drawImage(i, 0, 0, 4, 4); const d = x.getImageData(3, 3, 1, 1).data; r([d[0], d[1], d[2]]); }; i.src = u; }), ents[3].image);
ok(white.every(v => v > 240), 'a transparent PNG is stored on white, not black: ' + white);
ok(ents[0].image.length < 40000, 'a stored photo is small (' + ents[0].image.length + ' characters)');
ok((await page.textContent('#bulkDone')).includes('Added 3 photos'), 'a line says how many were added: ' + await page.textContent('#bulkDone'));
ok(await page.isHidden('#bulkPlan'), 'and the plan closes');
eq(await page.$$eval('#entriesList .entry-thumb[style*="background-image"]', e => e.length), 3, 'the rows show the thumbnails');
await page.reload({ waitUntil: 'load' }); await settle(page, 300);
eq(await page.$$eval('#entriesList .entry-thumb[style*="background-image"]', e => e.length), 3, 'a reload keeps them');

// Options: replace, order, new entries; Cancel stores nothing.
await choose(page, [{ name: 'zoe-kim.png', mimeType: 'image/png', buffer: small }, { name: 'ava-r.png', mimeType: 'image/png', buffer: small }, { name: 'extra one.png', mimeType: 'image/png', buffer: small }]);
rows = await planRows(page);
eq(rows.find(r => r.file === 'ava-r.png').to, '(skip this photo)', 'an entry that already has a photo is not a target');
eq(rows.find(r => r.file === 'zoe-kim.png').to.startsWith('Zoe Kim'), true, 'Zoe has none, so the name matches');
await page.check('#bulkReplace'); await settle(page, 100);
eq((await planRows(page)).find(r => r.file === 'ava-r.png').to.startsWith('Ava R.'), true, 'replace on: Ava’s photo can be replaced');
await page.check('#bulkNew'); await settle(page, 100);
eq((await planRows(page)).find(r => r.file === 'extra one.png').to, '(new entry)', 'new entries on: the leftover photo says so');
await page.click('#bulkCancelBtn');
eq((await savedEntries(page)).length, 4, 'Cancel adds nothing');
await choose(page, [{ name: 'extra one.png', mimeType: 'image/png', buffer: small }]);
await page.check('#bulkNew'); await settle(page, 100);
await page.click('#bulkApplyBtn'); await settle(page, 300);
ents = await savedEntries(page);
eq(ents.length, 5, 'a new entry is added');
eq(ents[4].title + '|' + !!ents[4].image, 'extra one|true', 'with its title from the file name and the photo');
await page.reload({ waitUntil: 'load' }); await settle(page, 300);

// Only non-pictures: said plainly, no plan.
{
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bulkFilesBtn')]);
  await chooser.setFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }]);
  await settle(page, 300);
  ok(/None of those files are pictures/.test(await page.textContent('#msg')), 'a folder with no pictures says so');
  ok(await page.isHidden('#bulkPlan'), 'and shows no plan');
}

// A full store keeps everything as it was.
await choose(page, [{ name: 'zoe-kim.png', mimeType: 'image/png', buffer: small }]);
const before = JSON.stringify(await savedEntries(page));
await page.evaluate(() => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
await page.click('#bulkApplyBtn'); await settle(page, 300);
ok(/not enough room/.test(await page.textContent('#msg')), 'a full store says so: ' + (await page.textContent('#msg')).slice(0, 80));
eq(JSON.stringify(await savedEntries(page)), before, 'and the saved portfolio is unchanged');
eq(await page.$$eval('#entriesList .entry-thumb[style*="background-image"]', e => e.length), 4, 'and the rows are too');
// Room comes back; the next edit must not smuggle the refused photo in.
await page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
await page.fill('#entriesList .entry-row:nth-child(1) [data-title]', 'Self-Portrait II');
await settle(page, 200);
const later = await savedEntries(page);
eq(later.map(e => e.image).join('|') === JSON.parse(before).map(e => e.image).join('|') && later[0].title, 'Self-Portrait II', 'an edit after a refused import saves the old photos only');

// 360 px
await page.reload({ waitUntil: 'load' });
await page.setViewportSize({ width: 360, height: 800 }); await settle(page, 200);
await choose(page, [{ name: 'ava-r.png', mimeType: 'image/png', buffer: small }]);
eq(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), true, 'the plan fits at 360 px');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
