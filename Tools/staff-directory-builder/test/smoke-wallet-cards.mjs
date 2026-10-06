// smoke-wallet-cards.mjs — 075's wallet and lanyard cards, with a QR on each
// that opens a tel: or mailto: link.
//
//   node Tools/staff-directory-builder/test/smoke-wallet-cards.mjs
//
// What a teacher is trusting: the code on a lanyard card, scanned by a phone,
// opens exactly the call or the email the editor said it would; it is big
// enough to scan (module size and quiet zone are MEASURED off the canvas, and
// the text is DECODED with the vendored jsQR, not assumed); the card is the
// size it says it is; and nothing about the directory page that already
// existed moved: the printed directory is compared with a recording of the page
// as it was before the cards (golden-old-print.json, taken from main at
// d34651b through _old-print.mjs), and a saved directory from before loads
// and stays byte for byte.
//
// Every name, number and address is invented (555-01xx, example.org).
// Exits 1 on any failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { captureOldPrint, SAMPLE } from './_old-print.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(here, '..', '..', '..');
const PORT = 8501;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/075-staff-directory-builder.html';
const STORE_KEY = 'sdb_directory_v1';
const PREFS_KEY = 'sdb_prefs_v1';
const JSQR = fs.readFileSync(path.join(SITE, '_shared', 'vendor', 'jsqr', 'jsqr.js'), 'utf8');

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const LONG_MAIL = 'twren-with-a-rather-long-address-for-the-gym-department@example.org';
const STAFF = [
  { id: 'a1', name: 'Marisol Ruiz', room: '214', ext: '4214', subject: 'Math', email: 'mruiz@example.org' },
  { id: 'a2', name: 'Devraj Balasubramanian-Whitfield', room: '118', ext: '4118', subject: 'Science' },
  { id: 'a3', name: 'Nadia Okonjo', room: 'Office', ext: '', subject: 'Admin' },
  { id: 'a4', name: 'Beckett Hale', room: '7', ext: '4/5', subject: 'Math' },
  { id: 'a5', name: 'Tobias Wren', room: 'Gym', ext: '555-0142', subject: 'PE', email: LONG_MAIL },
];
// By name: Beckett, Devraj, Marisol, Nadia, Tobias.
const WANT_WALLET = { 'Beckett Hale': null, 'Devraj Balasubramanian-Whitfield': 'tel:4118', 'Marisol Ruiz': 'mailto:mruiz@example.org', 'Nadia Okonjo': null, 'Tobias Wren': null };
const WANT_LANYARD = { ...WANT_WALLET, 'Tobias Wren': 'mailto:' + LONG_MAIL };

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

const seed = async (people, prefs) => {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(([p, pr, k1, k2]) => {
    localStorage.setItem(k1, typeof p === 'string' ? p : JSON.stringify(p));
    if (pr) localStorage.setItem(k2, typeof pr === 'string' ? pr : JSON.stringify(pr)); else localStorage.removeItem(k2);
  }, [people, prefs, STORE_KEY, PREFS_KEY]);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 200);
};
const showCards = async () => { if (!(await page.isChecked('#cardPreviewBox'))) await page.check('#cardPreviewBox'); await settle(page, 350); };

/** Every canvas on the sheet: what it was asked to encode, what jsQR decodes
    off its pixels, and the geometry read from the pixels themselves. */
const readCanvases = () => page.evaluate((jsqr) => {
  const self = {}; new Function('self', jsqr)(self);
  return [...document.querySelectorAll('#cardSheet canvas')].map(cv => {
    const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h);
    const dark = (x, y) => d.data[(y * w + x) * 4] < 128;
    let x0 = -1, y0 = -1, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dark(x, y)) {
      if (x0 < 0 || x < x0) x0 = x; if (x1 < x) x1 = x; if (y0 < 0 || y < y0) y0 = y; if (y1 < y) y1 = y;
    }
    const hit = self.jsQR(d.data, w, h);
    const css = cv.getBoundingClientRect();
    const card = cv.closest('.wc-card').getBoundingClientRect();
    return {
      uri: cv.getAttribute('data-qr-uri'), decoded: hit ? hit.data : null, w, h, x0, y0, x1, y1,
      cssW: css.width, cssH: css.height, cardW: card.width, cardH: card.height,
      aria: cv.getAttribute('aria-label'), role: cv.getAttribute('role'),
      name: cv.closest('.wc-card').querySelector('.wc-name').textContent,
    };
  });
}, JSQR);

/** px per module and the quiet zone, in modules, from where the first dark pixel is. */
const geometry = (c) => {
  const dpr = 1;
  const px = c.x0 / 4 / dpr;                      // the quiet zone is 4 modules, so the first dark module starts at 4 px
  const total = c.w / px;
  return { px, total, modules: total - 8, quietLeft: c.x0 / px, quietTop: c.y0 / px, quietRight: (c.w - 1 - c.x1) / px, quietBottom: (c.h - 1 - c.y1) / px };
};

console.log('Staff Directory — wallet and lanyard cards');

/* ── 1. the existing printed directory is unchanged ───────────────────── */
{
  const gold = JSON.parse(fs.readFileSync(path.join(here, 'golden-old-print.json'), 'utf8'));
  const now = await captureOldPrint(page, URL_PAGE);
  for (const k of ['flat', 'grouped']) {
    eq(now[k].html, gold[k].html, `${k}: Print directory builds the same sheet HTML as the page before the cards`);
    eq(now[k].text, gold[k].text, `${k}: and the same PDF text, page for page`);
    eq(now[k].pages, gold[k].pages, `${k}: and the same number of PDF pages (${gold[k].pages})`);
  }
  eq(await page.evaluate(() => document.body.classList.contains('print-cards')), false, 'Print directory never turns the cards mode on');
}

/* ── 2. a directory saved before the cards loads and stays ────────────── */
{
  const old = JSON.stringify(SAMPLE.slice(0, 4));
  await seed(old, '{"groupByDept":true}');
  eq(await page.evaluate(k => localStorage.getItem(k), STORE_KEY), old, 'a saved directory is byte for byte the same after the page loads');
  eq(await page.evaluate(k => localStorage.getItem(k), PREFS_KEY), '{"groupByDept":true}', 'and so are the preferences');
  eq(await page.$$eval('#dirRows tr', r => r.length), 6, 'its rows are all there: four people under two department headings (Science and science are one)');
  eq(await page.inputValue('#dirRows tr:not(.dept-head) input[data-field="email"]'), '', 'an old person has an empty Email box');
  eq(await page.$eval('#dirRows tr:not(.dept-head) select[data-field="qr"]', s => s.value), '', 'and follows the sheet');
  await page.fill('#dirRows tr:not(.dept-head) input[data-field="name"]', 'Beckett Hale II');
  const edited = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORE_KEY);
  ok(edited.every(p => !('email' in p) && !('qr' in p)), 'editing a name does not add email or qr keys to anyone');
  eq(Object.keys(edited[0]).join(), 'id,name,room,ext,subject', 'a person is still the five fields it was');
  await page.fill('#newName', 'Corin Vale'); await page.fill('#newExt', '4215'); await page.click('#addRowBtn');
  const added = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORE_KEY);
  eq(Object.keys(added[added.length - 1]).join(), 'id,name,room,ext,subject', 'a person added with no email is the old five fields');
  await page.fill('#newName', 'Ines Marchetti'); await page.fill('#newEmail', ' imarchetti@example.org '); await page.click('#addRowBtn');
  const added2 = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORE_KEY);
  eq(added2[added2.length - 1].email, 'imarchetti@example.org', 'a person added with an email keeps it, trimmed');
}

/* ── 3. the editor says what each QR opens, or why there is none ─────── */
await seed(STAFF, null);
const statusOf = async (name) => page.$$eval('#dirRows tr', (rows, n) => {
  const r = rows.find(tr => { const i = tr.querySelector('input[data-field="name"]'); return i && i.value === n; });
  return r ? r.querySelector('.qr-status').textContent : null;
}, name);
eq(await statusOf('Marisol Ruiz'), 'QR opens mailto:mruiz@example.org', 'editor: an email gives a mailto link, said exactly');
eq(await statusOf('Devraj Balasubramanian-Whitfield'), 'QR opens tel:4118', 'editor: no email, so the extension');
eq(await statusOf('Nadia Okonjo'), 'No QR: no extension or email listed', 'editor: nothing listed says so');
eq(await statusOf('Beckett Hale'), 'No QR: the extension is not a single number', 'editor: "4/5" is not one number, said so');
eq((await statusOf('Tobias Wren')).startsWith('No QR: 74 characters is too long to scan on a wallet card'), true, 'editor: a link too long for the wallet card says so (' + await statusOf('Tobias Wren') + ')');
eq(await page.$eval('#cardsNote', n => n.textContent), '5 cards on 1 page (8 to a page), 3 without a QR code — the Card QR column beside each name says why.', 'the note counts cards, pages and those with no QR');
ok(!(await page.$eval('#cardSheet', e => e.textContent)).includes('No QR'), 'the card sheet itself never says "No QR": the reason is for the editor');

/* ── 4. the wallet cards: link, size, quiet zone, decode ─────────────── */
await showCards();
let cvs = await readCanvases();
eq(cvs.length, 2, 'wallet: two cards of five have a code (the rest have nothing to link, or too long)');
for (const c of cvs) {
  const want = WANT_WALLET[c.name];
  const g = geometry(c);
  eq(c.uri, want, `wallet ${c.name}: the canvas was asked for exactly ${want}`);
  eq(c.decoded, want, `wallet ${c.name}: jsQR decodes exactly ${want} off the pixels`);
  ok(Number.isInteger(g.px) && g.px >= 4, `wallet ${c.name}: ${g.px} px per module, a whole number and at least 4`);
  eq(g.quietLeft, 4, `wallet ${c.name}: quiet zone left is 4 modules`);
  eq(g.quietTop, 4, `wallet ${c.name}: quiet zone top is 4 modules`);
  eq(g.quietRight, 4, `wallet ${c.name}: quiet zone right is 4 modules`);
  eq(g.quietBottom, 4, `wallet ${c.name}: quiet zone bottom is 4 modules`);
  eq(g.total, g.modules + 8, `wallet ${c.name}: the canvas is the modules plus two quiet zones`);
  ok(c.cssW <= 148 && c.cssH <= 148, `wallet ${c.name}: ${c.cssW} px is inside the 148 px the card gives it`);
  ok(c.cssW === g.total * g.px, `wallet ${c.name}: the canvas is a whole number of px per module wide`);
  eq(c.role, 'img', `wallet ${c.name}: the code is an image for a screen reader`);
  eq(c.aria, 'QR code: ' + want, `wallet ${c.name}: and it names the link`);
  ok(Math.abs(c.cardW - 3.375 * 96) < 0.01 && Math.abs(c.cardH - 2.125 * 96) < 0.01, `wallet ${c.name}: the card is 3.375 x 2.125 in (${c.cardW} x ${c.cardH} px)`);
}
const cards = await page.$$eval('#cardSheet .wc-card', els => els.map(c => ({ name: c.querySelector('.wc-name').textContent, w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height, canvases: c.querySelectorAll('canvas').length, text: c.textContent, nameBottom: c.querySelector('.wc-name').getBoundingClientRect().bottom, cardBottom: c.getBoundingClientRect().bottom, nameRight: c.querySelector('.wc-name').getBoundingClientRect().right, cardRight: c.getBoundingClientRect().right })));
eq(cards.length, 5, 'wallet: five cards for five people');
eq(cards.map(c => c.name).join('|'), 'Beckett Hale|Devraj Balasubramanian-Whitfield|Marisol Ruiz|Nadia Okonjo|Tobias Wren', 'wallet: in the directory\'s sort order');
ok(cards.every(c => Math.abs(c.w - 324) < 0.01 && Math.abs(c.h - 204) < 0.01), 'wallet: every card is exactly 324 x 204 px, 3.375 x 2.125 in');
ok(cards.every(c => c.nameBottom <= c.cardBottom && c.nameRight <= c.cardRight), 'wallet: no name runs past its card, the 33-character one included');
eq(cards.find(c => c.name === 'Nadia Okonjo').canvases, 0, 'wallet: a person with nothing to link has no code');
ok(cards.find(c => c.name === 'Marisol Ruiz').text.includes('Math') && cards.find(c => c.name === 'Marisol Ruiz').text.includes('Room 214') && cards.find(c => c.name === 'Marisol Ruiz').text.includes('Ext. 4214') && cards.find(c => c.name === 'Marisol Ruiz').text.includes('Scan to email'), 'wallet: name, role, room, extension and what the code does');
ok(cards.find(c => c.name === 'Devraj Balasubramanian-Whitfield').text.includes('Scan to call ext. 4118'), 'wallet: a call code says which extension');
ok(cards.find(c => c.name === 'Nadia Okonjo').text.includes('Office') && !cards.find(c => c.name === 'Nadia Okonjo').text.includes('Room Office'), 'wallet: a room that is not a number is shown as typed');
const pos = await page.$$eval('#cardSheet .wc-card', els => els.map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.left * 100) / 100, Math.round(r.top * 100) / 100]; }));
eq(Math.round(pos[1][0] - pos[0][0]), 323, 'wallet: neighbouring cards share their cut line (pitch is one card less 1 px)');
eq(await page.$eval('#cardSheet .wc-card', c => getComputedStyle(c).borderTopStyle), 'dashed', 'wallet: the cut guide is a dashed edge');

/* ── 5. the lanyard cards ─────────────────────────────────────────────── */
await page.selectOption('#cardSize', 'lanyard');
await settle(page, 400);
cvs = await readCanvases();
eq(cvs.length, 3, 'lanyard: three codes, the long address now fits');
for (const c of cvs) {
  const want = WANT_LANYARD[c.name];
  const g = geometry(c);
  eq(c.decoded, want, `lanyard ${c.name}: jsQR decodes exactly ${want}`);
  eq(c.uri, want, `lanyard ${c.name}: and it was asked for exactly that`);
  ok(Number.isInteger(g.px) && g.px >= 4, `lanyard ${c.name}: ${g.px} px per module, whole and at least 4`);
  eq(g.quietLeft, 4, `lanyard ${c.name}: quiet zone is 4 modules`);
  ok(c.cssW <= 177, `lanyard ${c.name}: ${c.cssW} px is inside the 177 px the card gives it`);
  ok(Math.abs(c.cardW - 2.125 * 96) < 0.01 && Math.abs(c.cardH - 3.375 * 96) < 0.01, `lanyard ${c.name}: the card is 2.125 x 3.375 in`);
}
eq(geometry(cvs.find(c => c.name === 'Tobias Wren')).modules, 33, 'lanyard: the long address is a version 4 code, 33 modules');
eq(await statusOf('Tobias Wren'), 'QR opens mailto:' + LONG_MAIL, 'editor: on the lanyard card the long link is fine, and the editor follows the size');
eq(await page.$eval('#cardsNote', n => n.textContent), '5 cards on 1 page (9 to a page), 2 without a QR code — the Card QR column beside each name says why.', 'the note follows the size');
eq(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).card.size, PREFS_KEY), 'lanyard', 'the size is remembered, in the preferences object');
eq(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).groupByDept, PREFS_KEY), false, 'beside the preference that was already there');
await page.reload({ waitUntil: 'networkidle' });
eq(await page.inputValue('#cardSize'), 'lanyard', 'and survives a reload');
await page.selectOption('#cardSize', 'wallet');
eq(await page.evaluate(k => localStorage.getItem(k), PREFS_KEY), '{"groupByDept":false}', 'back on the defaults the preferences are the old shape again');

/* ── 6. which link: the sheet's rule and each person's own ───────────── */
await showCards();
await page.selectOption('#cardQrMode', 'tel-else-mail');
await settle(page, 350);
let uris = (await readCanvases()).map(c => c.uri).sort();
eq(uris.join('|'), 'tel:4118|tel:4214|tel:5550142', 'tel-else-mail: Marisol is now the call, and Tobias\'s long address no longer matters');
await page.selectOption('#cardQrMode', 'none');
await settle(page, 350);
eq((await readCanvases()).length, 0, 'no QR codes: no code on any card');
eq(await statusOf('Marisol Ruiz'), 'No QR: the sheet is set to no QR codes', 'and the editor says the sheet is why');
await page.selectOption('#cardQrMode', 'mail');
await page.selectOption('#dirRows tr:has(input[value="Devraj Balasubramanian-Whitfield"]) select[data-field="qr"]', 'tel');
await settle(page, 350);
uris = (await readCanvases()).map(c => c.uri).sort();
eq(uris.join('|'), 'mailto:mruiz@example.org|tel:4118', 'a person set to "call the extension" overrides a sheet that says email only');
eq(await statusOf('Devraj Balasubramanian-Whitfield'), 'QR opens tel:4118', 'and the editor shows it');
await page.selectOption('#dirRows tr:has(input[value="Marisol Ruiz"]) select[data-field="qr"]', 'none');
await settle(page, 350);
eq((await readCanvases()).map(c => c.uri).join('|'), 'tel:4118', 'a person set to "No QR" has none, on a sheet that would give one');
eq(await statusOf('Marisol Ruiz'), 'No QR: set to none for this person', 'and says why');
const saved6 = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORE_KEY);
eq(saved6.find(p => p.id === 'a1').qr, 'none', 'the person\'s choice is saved on the person');
await page.selectOption('#dirRows tr:has(input[value="Marisol Ruiz"]) select[data-field="qr"]', '');
eq('qr' in (await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORE_KEY)).find(p => p.id === 'a1'), false, 'putting it back to "Follow the sheet" removes the key');
await page.fill('#dirRows tr:has(input[value="Marisol Ruiz"]) input[data-field="email"]', 'm.ruiz@example.org');
await settle(page, 350);
ok((await readCanvases()).some(c => c.decoded === 'mailto:m.ruiz@example.org'), 'editing an email redraws the card with the new address');
await page.fill('#dirRows tr:has(input[value="Marisol Ruiz"]) input[data-field="email"]', '');
eq('email' in (await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORE_KEY)).find(p => p.id === 'a1'), false, 'clearing the email removes the key');
await page.selectOption('#cardQrMode', 'mail-else-tel');

/* ── 7. the file and the share carry the two new fields; the CSV does not change ── */
await seed(STAFF, null);
await page.evaluate(() => { const orig = URL.createObjectURL; window.__blob = null; URL.createObjectURL = b => { window.__blob = b; return orig.call(URL, b); }; });
await page.click('#exportJsonBtn');
const json = JSON.parse(await page.evaluate(() => window.__blob.text()));
eq(json.find(p => p.id === 'a1').email, 'mruiz@example.org', 'Export JSON carries the email');
eq(Object.keys(json.find(p => p.id === 'a2')).join(), 'id,name,room,ext,subject', 'and a person without one is the old shape');
await page.click('#exportCsvBtn');
const csv = await page.evaluate(() => window.__blob.text());
eq(csv.replace(/^﻿/, '').split('\r\n')[0], 'Name,Room,Extension,Subject / Dept', 'the CSV header is the four columns it always was');
await page.evaluate(() => localStorage.removeItem('sdb_directory_v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.setInputFiles('#importFile', { name: 'staff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([
  { name: 'Wren Castellanos', room: 'Office', ext: '4000', subject: 'Admin', email: 'wcastellanos@example.org', qr: 'tel' },
  { name: 'Pavel Dragan', room: '306', ext: '4306', subject: 'Music', email: 7, qr: 'bogus' }])) });
await settle(page, 300);
const imp = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORE_KEY);
eq(imp[0].email + '|' + imp[0].qr, 'wcastellanos@example.org|tel', 'Import JSON brings the email and the QR choice');
eq(Object.keys(imp[1]).join(), 'id,name,room,ext,subject', 'a non-text email and an unknown choice are dropped, not stored');

/* ── 8. text is text ──────────────────────────────────────────────────── */
await seed([{ id: 'x1', name: '<img src=x onerror="window.__x=1">Mallory', room: '<b>9</b>', ext: '4999', subject: '<script>window.__x=2</script>', email: 'x<i>@example.org' }], null);
await showCards();
eq(await page.evaluate(() => window.__x || 0), 0, 'markup in a name or subject runs nothing');
eq(await page.$$eval('#cardSheet img, #cardSheet b, #cardSheet script, #cardSheet i', e => e.length), 0, 'and creates no element on the sheet');
ok((await page.$eval('#cardSheet .wc-name', e => e.textContent)).startsWith('<img'), 'it is printed as the text it is');
eq(await page.$$eval('#cardSheet canvas', e => e.length), 1, 'an address with markup in it is unusable, so the extension is the link');

/* ── 9. the printed sheet ─────────────────────────────────────────────── */
const many = (n) => Array.from({ length: n }, (_, i) => ({ id: 'm' + i, name: 'Person ' + String(i + 1).padStart(2, '0') + ' Test', room: String(100 + i), ext: String(4100 + i), subject: 'Dept ' + (i % 3) }));
const pdfOf = async () => {
  const f = path.join(os.tmpdir(), 'sdb-cards-' + process.pid + '.pdf');
  fs.writeFileSync(f, await page.pdf({ preferCSSPageSize: true }));
  const info = spawnSync('pdfinfo', [f], { encoding: 'utf8' }).stdout;
  const pages = Number((info.match(/Pages:\s+(\d+)/) || [])[1]);
  const size = (info.match(/Page size:\s+([^\n]+)/) || [])[1];
  const texts = [];
  for (let i = 1; i <= pages; i++) texts.push(spawnSync('pdftotext', ['-f', String(i), '-l', String(i), '-layout', f, '-'], { encoding: 'utf8' }).stdout);
  fs.unlinkSync(f);
  return { pages, size, texts };
};
for (const [size, per, n, want] of [['wallet', 8, 1, 1], ['wallet', 8, 8, 1], ['wallet', 8, 9, 2], ['wallet', 8, 17, 3], ['lanyard', 9, 9, 1], ['lanyard', 9, 10, 2], ['lanyard', 9, 1, 1]]) {
  await seed(many(n), size === 'wallet' ? null : { groupByDept: false, card: { size, qr: 'mail-else-tel' } });
  await page.evaluate(() => { window.__printed = 0; });
  await page.click('#printCardsBtn');
  eq(await page.evaluate(() => window.__printed), 1, `${size} ${n}: Print cards asks the browser to print, once`);
  eq(await page.evaluate(() => document.body.classList.contains('print-cards')), true, `${size} ${n}: and the cards mode is on while it does`);
  await page.emulateMedia({ media: 'print' });
  const pdf = await pdfOf();
  eq(pdf.pages, want, `${size} ${n}: ${want} PDF page${want === 1 ? '' : 's'}, ${per} to a page (got ${pdf.pages})`);
  ok(/612 x 792/.test(pdf.size), `${size} ${n}: on Letter (${pdf.size})`);
  const names = pdf.texts.map(t => (t.match(/Person \d\d/g) || []).length);
  eq(names.join(','), Array.from({ length: want }, (_, i) => Math.min(per, n - i * per)).join(','), `${size} ${n}: ${per} cards then the rest, none lost or doubled`);
  ok(pdf.texts.every(t => !/Add staff member|Directory|Export CSV|Card size|Print cards/.test(t)), `${size} ${n}: nothing of the editor is on the paper`);
  const geo = await page.evaluate(() => [...document.querySelectorAll('#cardSheet .wc-page')].map(p => { const r = p.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  ok(geo.every(([w, h]) => w <= 7.75 * 96 && h <= 10.25 * 96), `${size} ${n}: each page of cards fits inside the page's margins (${JSON.stringify(geo[0])} of 744 x 984)`);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  eq(await page.evaluate(() => document.body.classList.contains('print-cards')), false, `${size} ${n}: afterprint puts the page back`);
}

/* ── 10. nothing to print ─────────────────────────────────────────────── */
await seed([], null);
await page.evaluate(() => { window.__printed = 0; });
await page.click('#printCardsBtn');
eq(await page.evaluate(() => window.__printed), 0, 'an empty directory does not open the print dialog');
eq(await page.$eval('#cardsNote', n => n.textContent), 'Nothing to print yet — add staff above.', 'and says why');

/* ── 11. dark mode: the cards are paper ───────────────────────────────── */
await seed(STAFF, null);
await showCards();
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const dark = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('#cardSheet .wc-card')); const n = getComputedStyle(document.querySelector('#cardSheet .wc-name')); return [s.backgroundColor, n.color]; });
eq(dark.join('|'), 'rgb(255, 255, 255)|rgb(0, 0, 0)', 'in dark mode a card is still white with black ink');
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

/* ── 12. the controls are reachable and named ─────────────────────────── */
ok(await page.$eval('#cardSize', e => !!document.querySelector('label[for="cardSize"]')), 'the card size select has a label');
ok(await page.$eval('#cardQrMode', e => !!document.querySelector('label[for="cardQrMode"]')), 'the QR select has a label');
eq(await page.$eval('#dirRows select[data-field="qr"]', s => s.getAttribute('aria-label').startsWith('Card QR — ')), true, 'each row\'s QR select says whose it is');
eq(await page.$eval('#cardsNote', n => n.getAttribute('aria-live')), 'polite', 'the card count is announced');

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close && server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
