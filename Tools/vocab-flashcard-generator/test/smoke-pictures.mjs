// smoke-pictures.mjs — a picture on a vocabulary card in 040 (rank 142).
//
//   node Tools/vocab-flashcard-generator/test/smoke-pictures.mjs        (port 8660)
//
// The arithmetic (which term a picture belongs to) is pictures-logic.test.mjs's. This is the page:
// the Pictures card lists a list's words; a picture added to a word is downscaled and kept as a
// Blob in the shared gvb-media store under `vocab` (nothing in localStorage, nothing in the list's
// record); it prints above the word on the flashcard front, the foldable card and the word-wall card,
// and not on the card's back; the same word in another list, in another case, shows it; it survives
// a reload; Change and Remove and Remove all work; a file that is not an image is refused with a
// note; a share link carries no picture; and the card has no serious axe finding. Pictures are
// invented 8x8 PNGs. Nothing here has been printed on paper. Exits 1 on any failure.

/* global MediaDB -- the shared media store, read inside page.evaluate() */
import zlib from 'node:zlib';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8660;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/040-vocab-flashcard-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* A solid-colour 8x8 PNG, made here so no file is committed. */
function png(r, g, b) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = buf => { let c = -1; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(8, 0); ihdr.writeUInt32BE(8, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(8 * (1 + 24));
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const o = y * 25 + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1360, height: 980 });
console.log('Vocabulary Flashcards — a picture on a card');

const WORDS = 'Photosynthesis: how plants make food | Plants use photosynthesis\nMitosis: cell division';
const open = async () => {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(() => MediaDB.store({ ns: 'vocab' }).clear());
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.fill('#wordInput', WORDS);
  await settle(page, 250);
};
const rows = () => page.$$eval('#picList li', ls => ls.map(l => [l.querySelector('.pic-term')?.textContent || l.textContent, !!l.querySelector('img'), [...l.querySelectorAll('button')].map(b => b.textContent)]));
const clearStatus = () => page.evaluate(() => { document.getElementById('picStatus').textContent = ''; });
const addPic = async (term, buf, name = 'p.png', type = 'image/png') => {
  await clearStatus();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click(`#picList button[aria-label$="picture for ${term}"]`)]);
  await chooser.setFiles({ name, mimeType: type, buffer: buf });
  await done();
};
/* the status line leaves "Adding…" for "Added …" or a refusal */
const done = async () => { await page.waitForFunction(() => { const t = document.getElementById('picStatus').textContent; return t && !/^Adding/.test(t); }, null, { timeout: 8000 }); await settle(page, 150); };
const stored = () => page.evaluate(async () => { const r = await MediaDB.store({ ns: 'vocab' }).list(); return r.map(x => x.id).sort(); });
const picsIn = sel => page.$$eval(sel + ' img.card-pic', is => is.map(i => i.src.slice(0, 23)));
const lsKeys = () => page.evaluate(() => Object.keys(localStorage).filter(k => !/^gvb-a11y|^stviz|a11y/.test(k)).sort());

await open();
console.log('1. the Pictures card');
eq(await rows(), [['Photosynthesis', false, ['Add picture']], ['Mitosis', false, ['Add picture']]], 'one row per word, each offering Add picture');
eq(await picsIn('#previewArea'), [], 'no picture on any card yet');
const keysBefore = await lsKeys();

console.log('2. add a picture');
await addPic('Photosynthesis', png(200, 30, 30));
eq(await stored(), ['photosynthesis'], 'the picture is a Blob in gvb-media under the vocab namespace, keyed by the term');
eq(await lsKeys(), keysBefore.concat([]).sort(), 'and no localStorage key was added by it (the list is saved as before)');
eq((await rows())[0], ['Photosynthesis', true, ['Change', 'Remove']], 'the row shows a thumbnail with Change and Remove');
eq((await page.textContent('#picStatus')).trim(), 'Added a picture for Photosynthesis.', 'and says what happened');
eq(await picsIn('#previewArea'), ['data:image/jpeg;base64,'], 'the flashcard front shows it (downscaled to a JPEG)');
const natural = await page.$eval('#previewArea img.card-pic', i => [i.naturalWidth, i.naturalHeight]);
eq(natural, [8, 8], 'at its own size (an 8 px picture is not enlarged)');
eq(await page.$eval('#previewArea img.card-pic', i => i.alt), '', 'the picture is decorative: the word is printed beside it');
ok(await page.$eval('#previewArea img.card-pic', i => i.nextElementSibling && i.nextElementSibling.classList.contains('term')), 'and sits above the word');
eq(await page.$$eval('#previewArea .flash-card .term', t => t.length), 2, 'both words still print');

console.log('3. the other card layouts, and the back');
await page.click('.mode-tab[data-mode="wordwall"]');
await settle(page, 250);
eq((await picsIn('#previewArea')).length, 1, 'the word-wall card shows it above the word');
await page.click('.mode-tab[data-mode="flashcards"]');
await page.selectOption('#flashLayout', 'fold');
await settle(page, 250);
eq((await picsIn('#previewArea')).length, 1, 'the foldable card shows it in its term half');
await page.selectOption('#flashLayout', 'duplex');
await settle(page, 250);

console.log('4. the picture belongs to the word');
await page.fill('#wordInput', 'PHOTOSYNTHESIS: another list\'s definition\nCell: unit of life');
await settle(page, 250);
eq((await rows())[0], ['PHOTOSYNTHESIS', true, ['Change', 'Remove']], 'the same word in another case shows the same picture');
await page.fill('#wordInput', WORDS);
await settle(page, 250);

console.log('5. it survives a reload; change; remove');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 600);
eq(await picsIn('#previewArea'), ['data:image/jpeg;base64,'], 'after a reload the card still has its picture');
const before = await page.$eval('#previewArea img.card-pic', i => i.src);
await clearStatus();
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#picList button[aria-label="Change the picture for Photosynthesis"]')]);
await chooser.setFiles({ name: 'q.png', mimeType: 'image/png', buffer: png(10, 120, 220) });
await done();
const after = await page.$eval('#previewArea img.card-pic', i => i.src);
ok(after !== before, 'Change replaces the picture');
eq(await stored(), ['photosynthesis'], 'and still one record');
await addPic('Mitosis', png(30, 200, 30));
eq(await stored(), ['mitosis', 'photosynthesis'], 'a second word gets its own record');
await page.click('#picList button[aria-label="Remove the picture for Mitosis"]');
await settle(page, 500);
eq(await stored(), ['photosynthesis'], 'Remove deletes it from the store');
eq((await rows())[1], ['Mitosis', false, ['Add picture']], 'and the row offers Add picture again');

console.log('6. a file that is not a picture; share; remove all');
await clearStatus();
const [c2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#picList button[aria-label="Add a picture for Mitosis"]')]);
await c2.setFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('this is not an image') });
await done();
ok(/./.test(await page.textContent('#picStatus')) && !/^Added/.test(await page.textContent('#picStatus')), 'a file that does not decode is refused with a note');
eq(await stored(), ['photosynthesis'], 'and nothing is stored for it');
await page.click('#shareBtn');
await settle(page, 400);
const shareText = await page.evaluate(() => (document.querySelector('#shareNote') || {}).textContent + ' ' + [...document.querySelectorAll('input[type=text],input[readonly],textarea')].map(i => i.value).join(' '));
ok(!/data:image|jpeg|base64/i.test(shareText), 'the share sheet\'s link and text carry no picture');
await page.keyboard.press('Escape');
page.once('dialog', d => d.accept());
await page.click('#picClearBtn');
await settle(page, 500);
eq(await stored(), [], 'Remove all pictures empties the store');
eq(await picsIn('#previewArea'), [], 'and the cards lose them');
ok(await page.$eval('#picClearBtn', b => b.hidden), 'and the button goes');

console.log('7. a11y and errors');
await addPic('Photosynthesis', png(200, 30, 30));
const v = await a11yScan(page, { include: '#picCard' });
eq(v.map(x => x.id), [], 'the Pictures card has no serious axe finding');
await page.setViewportSize({ width: 360, height: 800 });
await settle(page, 200);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= 361), 'at 360 px the page does not scroll sideways');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
