// smoke-card-options.mjs — 017's two card options (BACKLOG rank 125): the link typed under each code, and a
// blank comment area on the card.
//
//   node Tools/gallery-walk-qr/test/smoke-card-options.mjs   (npm run test:gallery-card-options, port 8656)
//
// Held here: both options are off for a gallery that never heard of them, and then the QR sheet is the card it
// was (no .p-link, no .p-comment); "Print the link" puts the entry's link under its code without the scheme, once,
// as text; a link past 70 characters and an entry that is only text get no line, and the code is unchanged; the
// comment area is three ruled lines under a heading, on every card, sized with min-height and never clipped;
// both choices are saved on the gallery and a gallery saved before them opens with both off; the code still
// decodes to the whole link whatever is printed beside it; the card text is never parsed as markup; the preview
// counts the same pages as Chromium's PDF with both on; axe finds nothing serious. print() is stubbed; nothing
// was printed on paper. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8656;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '017-gallery-walk-qr.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const LONG = 'https://example.com/a/very/long/path/that/nobody/could/type/by/hand/from/a/printed/card/' + 'x'.repeat(30);
const ENTRIES = [
  { name: 'Poster one', value: 'https://docs.example.com/d/abc123/' },
  { name: 'Poster two', value: 'http://example.org/two' },
  { name: 'Too long', value: LONG },
  { name: 'On paper', value: 'Read the poster, then leave a comment' },
  { name: '<img src=x onerror=window.__pwned=1>', value: 'https://example.com/<b>bold</b>' }
];
const setOf = extra => ({
  name: 'Test walk', cardsPerPage: '4', ecLevel: 'Q', showNumber: true, reactionsEnabled: false, entries: ENTRIES,
  feedbackEnabled: false, feedbackStyle: 'stars', feedbackPrompt: '', feedbackCopies: 6, feedbackPerPage: '4',
  timer: { minutes: 3, seconds: 0, rotations: 1 }, walkGroups: [], routeCardsPerPage: '4', ...extra
});

const server = await serve(PORT);
const browser = await launch();

async function open(set, size = { width: 1100, height: 900 }) {
  const page = await prepPage(browser, BASE, size);
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(saved => {
    if (saved && !localStorage.getItem('gallery-walk-qr-sets')) localStorage.setItem('gallery-walk-qr-sets', JSON.stringify({ current: saved.name, sets: { [saved.name]: saved } }));
  }, set);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 500);
  return page;
}
const cards = page => page.evaluate(() => [...document.querySelectorAll('#printQrGrid .p-card')].map(c => ({
  name: c.querySelector('.p-name').textContent,
  link: [...c.querySelectorAll('.p-link')].map(x => x.textContent),
  lines: c.querySelectorAll('.p-comment-line').length,
  head: [...c.querySelectorAll('.p-comment-head')].map(x => x.textContent),
  html: c.innerHTML.includes('<img') || c.innerHTML.includes('<b>'),
  order: [...c.children].map(x => x.className || x.tagName.toLowerCase())
})));

console.log('017 — card options: the link under the code, a comment area');

// ---- a gallery from before ----------------------------------------------------
let page = await open(setOf({}));
let c = await cards(page);
eq(c.length, 5, 'five cards');
ok(c.every(x => !x.link.length && !x.lines), 'both options off: no link line and no comment area on any card');
eq(await page.evaluate(() => [document.getElementById('showLink').checked, document.getElementById('commentArea').checked]), [false, false], 'and both boxes are unticked');
await page.close();

// ---- link on ----------------------------------------------------------------
page = await open(setOf({}));
await page.check('#showLink');
await settle(page, 500);
c = await cards(page);
eq(c.map(x => x.link), [['docs.example.com/d/abc123'], ['example.org/two'], [], [], ['example.com/<b>bold</b>']], 'the link is printed under the code without its scheme or trailing slash; too long and text-only get none');
ok(c.every(x => !x.lines), 'and no comment area appears with it');
ok(c.every(x => !x.html), 'a name or a link with markup in it is text on the card, not elements');
ok(await page.evaluate(() => !window.__pwned), 'and nothing ran');
eq(c[0].order, ['p-num', 'p-name', 'canvas', 'p-link'], 'the link sits under the code');
// the code still carries the whole link
const decoded = await page.evaluate(() => [...document.querySelectorAll('#printQrGrid canvas')].map(cv => {
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
  const r = window.jsQR(d.data, d.width, d.height);
  return r ? r.data : null;
}));
eq(decoded.slice(0, 2), ['https://docs.example.com/d/abc123/', 'http://example.org/two'], 'the code decodes to the whole link, scheme and all');
eq(decoded[2], LONG, 'a link too long to type still has its full code');
// saved on the gallery
const saved1 = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('gallery-walk-qr-sets')); return [s.sets['Test walk'].showLink, s.sets['Test walk'].commentArea]; });
eq(saved1, [true, false], 'the choice is saved on the gallery');
await page.reload({ waitUntil: 'load' }); await settle(page, 500);
eq(await page.evaluate(() => [document.getElementById('showLink').checked, document.getElementById('commentArea').checked]), [true, false], 'and a reload keeps it');
await page.uncheck('#showLink'); await settle(page, 400);
ok((await cards(page)).every(x => !x.link.length), 'unticking takes the lines off again');
await page.close();

// ---- comment area on, and both -------------------------------------------------
page = await open(setOf({}));
await page.check('#commentArea');
await settle(page, 500);
c = await cards(page);
ok(c.every(x => x.lines === 3 && x.head.length === 1 && x.head[0] === 'Comments'), 'every card has a heading and three ruled lines');
ok(c.every(x => !x.link.length), 'and no link line without the other box');
const geo = await page.evaluate(() => {
  const el = document.querySelector('#printQrGrid .p-comment-line');
  const st = getComputedStyle(el);
  const card = document.querySelector('#printQrGrid .p-card');
  return { border: st.borderBottomWidth, height: st.height, overflow: getComputedStyle(card.querySelector('.p-comment')).overflow, cardOverflow: getComputedStyle(card).overflow };
});
eq([geo.overflow, geo.cardOverflow], ['visible', 'visible'], 'nothing on the card is clipped');
await page.check('#showLink');
await settle(page, 500);
c = await cards(page);
ok(c[0].link.length === 1 && c[0].lines === 3, 'both on: the first card has the link and the comment area');
eq(c[0].order, ['p-num', 'p-name', 'canvas', 'p-link', 'p-comment'], 'in the order number, name, code, link, comments');

// ---- the preview and Chromium's PDF, both on ------------------------------------
await page.evaluate(() => { document.getElementById('cardsPerPage').value = '2'; document.getElementById('cardsPerPage').dispatchEvent(new Event('change', { bubbles: true })); });
await settle(page, 500);
await page.evaluate(() => document.getElementById('previewCodesBtn').click());
await page.waitForSelector('dialog.pk-preview[data-pk-pages]', { timeout: 15000 });
const pages = Number(await page.getAttribute('dialog.pk-preview', 'data-pk-pages'));
await page.click('.pk-preview-print');
await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 15000 }).catch(() => {});
await settle(page, 150);
await page.emulateMedia({ media: null });
const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
eq(pdf, pages, `the preview's count (${pages}) is Chromium's PDF page count`);
ok(pages >= 3, 'five cards at two to a page run to three pages or more');

// ---- the three older card settings survive a reload --------------------------------
// (the change listener once saved the gallery without copying the control into it: all three came back as defaults)
{
  const pg = await open(setOf({}));
  await pg.selectOption('#cardsPerPage', '2');
  await pg.selectOption('#ecLevel', 'H');
  await pg.uncheck('#showNumber');
  await settle(pg, 400);
  const stored = await pg.evaluate(() => { const g = JSON.parse(localStorage.getItem('gallery-walk-qr-sets')).sets['Test walk']; return [g.cardsPerPage, g.ecLevel, g.showNumber]; });
  eq(stored, ['2', 'H', false], 'codes per page, error correction and the entry number are saved on the gallery');
  await pg.reload({ waitUntil: 'load' }); await settle(pg, 500);
  eq(await pg.evaluate(() => [document.getElementById('cardsPerPage').value, document.getElementById('ecLevel').value, document.getElementById('showNumber').checked]), ['2', 'H', false], 'and a reload keeps all three');
  ok((await cards(pg)).every(x => !x.order.includes('p-num')), 'the cards after the reload have no entry number');
  await pg.check('#showNumber'); await settle(pg, 400);
  await pg.reload({ waitUntil: 'load' }); await settle(pg, 500);
  eq(await pg.evaluate(() => document.getElementById('showNumber').checked), true, 'ticking it again is kept too');
  await pg.close();
}

// ---- an older save, a phone, axe -------------------------------------------------
const old = setOf({}); delete old.showLink; delete old.commentArea;
const p2 = await open(old);
eq(await p2.evaluate(() => [document.getElementById('showLink').checked, document.getElementById('commentArea').checked]), [false, false], 'a gallery saved before the options opens with both off');
await p2.close();
const phone = await open(setOf({ showLink: true, commentArea: true }), { width: 360, height: 800 });
eq(await phone.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no sideways scroll at 360 px');
await phone.close();
const scan = await a11yScan(page, { impact: 'serious' });
ok(!scan.length, 'axe: no serious violation: ' + JSON.stringify(scan.map(v => [v.id, v.nodes])));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
