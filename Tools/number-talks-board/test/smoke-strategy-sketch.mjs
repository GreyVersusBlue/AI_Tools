// smoke-strategy-sketch.mjs — drawing on a Number Talks strategy card.
//
//   node Tools/number-talks-board/test/smoke-strategy-sketch.mjs
//
// A card gets one drawing, a PNG kept on the card and carried into the class
// library, the wall poster and the session record. This suite draws with the
// mouse in a real page and reads the pixels back, then checks: Done / Cancel /
// Escape / Undo / Clear / Edit, a drawing-only card in the library, what a
// stored value must look like before it is put in an <img src>, a full browser
// store, text-only entries unchanged, a student's name kept out of markup, the
// dialog at 360 px and under axe. Every name here is invented. Exits 1 on any
// failure.
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8643;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/024-number-talks-board.html';
const LIB = 'gvb-number-talks:strategyLibrary';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
console.log('Number Talks — drawing on a strategy card');

async function open(width = 1300, seedLib) {
  const page = await prepPage(browser, BASE, { width, height: 1100 });
  page.__errs = []; page.__dialogs = [];
  page.on('pageerror', e => page.__errs.push(String(e)));
  page.on('dialog', async d => { page.__dialogs.push(d.type() + ':' + d.message()); await d.accept(); });
  if (seedLib) await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [LIB, seedLib]);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
async function addCard(page, name, text) {
  await page.click('#addStrategyBtn');
  await settle(page, 100);
  const n = await page.$$eval('.strategy-card', e => e.length);
  const sel = `.strategy-card:nth-of-type(${n})`;
  if (name) { await page.fill(sel + ' .s-name', name); await page.dispatchEvent(sel + ' .s-name', 'input'); }
  if (text) { await page.fill(sel + ' .s-text', text); await page.dispatchEvent(sel + ' .s-text', 'input'); }
  return sel;
}
/** a stroke across the pad, in pad pixels (the pad is 600 x 375) */
async function stroke(page, pts) {
  const box = await page.$eval('.sk-canvas', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const at = ([x, y]) => [box.x + x * box.w / 600, box.y + y * box.h / 375];
  const [sx, sy] = at(pts[0]);
  await page.mouse.move(sx, sy); await page.mouse.down();
  for (const p of pts.slice(1)) { const [x, y] = at(p); await page.mouse.move(x, y, { steps: 4 }); }
  await page.mouse.up();
}
/** the pixel (r,g,b) of a data URL at a pad coordinate */
const pixel = (page, url, x, y) => page.evaluate(([u, x, y]) => new Promise(res => {
  const i = new Image();
  i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(Math.round(x * i.width / 600), Math.round(y * i.height / 375), 1, 1).data; res([d[0], d[1], d[2]]); };
  i.src = u;
}), [url, x, y]);
const dark = p => p[0] < 100 && p[1] < 100 && p[2] < 100;
const white = p => p[0] > 245 && p[1] > 245 && p[2] > 245;
const cardSketch = (page, sel) => page.$eval(sel + ' .s-sketch', i => i.src).catch(() => null);
const lib = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), LIB);
async function printAndRead(page, id) {
  await page.evaluate(btnId => { const o = window.print; window.print = () => {}; document.getElementById(btnId).click(); window.print = o; }, id);
  await settle(page, 200);
  return page.$eval('#printArea', e => e.innerHTML);
}

/* ── draw, keep, edit, undo, clear ──────────────────────────────────────── */
{
  const page = await open();
  const card = await addCard(page, 'Maya <i>Q</i>', 'Made 48 into 50.');
  ok(!(await page.$(card + ' .s-sketch')), 'a new card has no drawing');
  eq(await page.$eval(card + ' [data-draw]', b => b.textContent), 'Draw', 'its button says Draw');

  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  ok(await page.evaluate(() => document.querySelector('dialog.sk-dialog').contains(document.activeElement)), 'focus moves into the dialog');
  eq(await page.$eval('dialog.sk-dialog', d => d.getAttribute('aria-labelledby')), 'skTitle', 'the dialog is labelled');
  ok(/Maya <i>Q<\/i>/.test(await page.$eval('#skTitle', e => e.textContent)), 'the title names the student (as text)');

  await stroke(page, [[100, 100], [300, 100], [500, 100]]);
  await page.click('dialog [data-done]');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  let url = await cardSketch(page, card);
  ok(/^data:image\/png;base64,/.test(url || ''), 'Done puts a PNG on the card');
  ok(url.length < 60000, 'and it is under the cap (' + url.length + ' characters)');
  ok(dark(await pixel(page, url, 300, 100)), 'the stroke is dark where it was drawn');
  ok(white(await pixel(page, url, 300, 300)), 'the rest of the sheet is white');
  ok(white(await pixel(page, url, 5, 5)), '...including the corner');
  eq(await page.$eval(card + ' [data-draw]', b => b.textContent), 'Edit drawing', 'the button now says Edit drawing');
  eq(await page.$eval(card + ' .s-sketch', i => i.alt), 'Drawing for Maya <i>Q</i>', 'the picture has alt text with the name');
  eq(await page.evaluate(() => document.activeElement.getAttribute('data-draw') !== null), true, 'focus comes back to the card button');
  eq(await page.$$eval(card + ' i', e => e.length), 0, 'a name with markup in it never became markup');

  // edit: the old stroke stays, a new one is added in blue
  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await settle(page, 200);
  await page.click('dialog [data-color="#1f4fd8"]');
  eq(await page.$eval('dialog [data-color="#1f4fd8"]', b => b.getAttribute('aria-pressed')), 'true', 'the pen colour button says it is pressed');
  eq(await page.$eval('dialog [data-color="#111111"]', b => b.getAttribute('aria-pressed')), 'false', '...and the other no longer is');
  await page.click('dialog [data-size="8"]');
  await stroke(page, [[100, 250], [500, 250]]);
  await page.click('dialog [data-done]');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  url = await cardSketch(page, card);
  ok(dark(await pixel(page, url, 300, 100)), 'editing keeps the earlier stroke');
  const blue = await pixel(page, url, 300, 250);
  ok(blue[2] > 150 && blue[0] < 100, 'and the new stroke is blue: ' + blue);

  // undo removes the last stroke only
  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await settle(page, 200);
  await stroke(page, [[100, 330], [500, 330]]);
  await page.click('dialog [data-undo]');
  await page.click('dialog [data-done]');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  const afterUndo = await cardSketch(page, card);
  ok(white(await pixel(page, afterUndo, 300, 330)), 'Undo stroke took the new stroke off');
  ok(dark(await pixel(page, afterUndo, 300, 100)), '...and left the old ones');

  // Cancel and Escape change nothing
  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await stroke(page, [[100, 330], [500, 330]]);
  await page.click('dialog [data-cancel]');
  eq(await cardSketch(page, card), afterUndo, 'Cancel keeps the drawing as it was');
  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await stroke(page, [[100, 330], [500, 330]]);
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  eq(await cardSketch(page, card), afterUndo, 'Escape keeps the drawing as it was');

  // the eraser paints white
  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await settle(page, 200);
  await page.click('dialog [data-erase]');
  await stroke(page, [[200, 100], [400, 100]]);
  await page.click('dialog [data-done]');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  url = await cardSketch(page, card);
  ok(white(await pixel(page, url, 300, 100)), 'the eraser rubbed the line out');
  ok(dark(await pixel(page, url, 150, 100)), '...only where it went');

  // clear + Done removes it; Remove drawing too
  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await page.click('dialog [data-clear]');
  await page.click('dialog [data-done]');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  ok(!(await page.$(card + ' .s-sketch')), 'Clear then Done removes the drawing');
  eq(await page.$eval(card + ' [data-draw]', b => b.textContent), 'Draw', '...and the button is Draw again');
  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await stroke(page, [[10, 10], [20, 20]]);
  await page.click('dialog [data-done]');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  await page.click(card + ' [data-remove-sketch]');
  ok(!(await page.$(card + ' .s-sketch')), 'Remove drawing takes it off');
  eq(page.__errs, [], 'no page errors');
  await page.context().close();
}

/* ── the drawing travels: library, poster, record, text file ────────────── */
{
  const page = await open();
  const card = await addCard(page, 'Ravi', 'Used a number line.');
  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await stroke(page, [[50, 50], [550, 320]]);
  await page.click('dialog [data-done]');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  const url = await cardSketch(page, card);

  const rec = await printAndRead(page, 'printSessionBtn');
  ok(rec.includes('class="rec-sketch"') && rec.includes(url.slice(0, 60)), 'the session record carries the drawing');
  ok(/alt="Drawing for Ravi"/.test(rec), '...with alt text');

  await page.click(card + ' [data-save-to-library]');
  await settle(page, 150);
  let L = await lib(page);
  eq(L.length, 1, 'saving to the library adds one entry');
  eq(L[0].sketch, url, 'the entry holds the drawing');
  ok(await page.$('#libraryList img.bank-sketch'), 'the library list shows it');
  const poster = await printAndRead(page, 'printLibraryBtn');
  ok(poster.includes('class="poster-sketch"') && poster.includes('Used a number line.'), 'the wall poster has the drawing and the words');

  // a drawing-only card
  const c2 = await addCard(page, 'Sol', '');
  await page.click(c2 + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await stroke(page, [[50, 50], [100, 100]]);
  await page.click('dialog [data-done]');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  await page.click(c2 + ' [data-save-to-library]');
  await settle(page, 150);
  L = await lib(page);
  eq(L.length, 2, 'a card with only a drawing can be kept');
  eq(L[0].text, '', '...with no words');
  const p2 = await printAndRead(page, 'printLibraryBtn');
  eq((p2.match(/class="poster-text"/g) || []).length, 1, 'its poster has no empty text block');

  // a card with neither is still refused
  const c3 = await addCard(page, 'Tess', '');
  await page.click(c3 + ' [data-save-to-library]');
  eq((await lib(page)).length, 2, 'a card with nothing on it is still not kept');

  // survives a reload
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
  eq((await page.$$('#libraryList img.bank-sketch')).length, 2, 'both drawings are in the library after a reload');

  // the text file says the drawing is not in it
  const c4 = await addCard(page, 'Uma', 'Doubled it.');
  await page.click(c4 + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await stroke(page, [[50, 50], [100, 100]]);
  await page.click('dialog [data-done]');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  const { downloadText } = await import('../../board-check/harness.mjs');
  const txt = await downloadText(page, '#exportSessionBtn', { what: 'the session text' });
  ok(/Uma: Doubled it\. \(a drawing is on the card; it is not in this text file\)/.test(txt), 'the text file says a drawing is not in it');
  eq(page.__errs, [], 'no page errors');
  await page.context().close();
}

/* ── what a stored value must look like ─────────────────────────────────── */
{
  const good = 'data:image/png;base64,iVBORw0KGgo=';
  const page = await open(1300, [
    { id: 'a', name: 'Good', text: 'kept', context: '', ts: 1, sketch: good },
    { id: 'b', name: 'Svg', text: 'text stays', context: '', ts: 2, sketch: 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==' },
    { id: 'c', name: 'Js', text: '', context: '', ts: 3, sketch: 'javascript:alert(1)' },
    { id: 'd', name: 'Quote', text: 'q', context: '', ts: 4, sketch: 'data:image/png;base64,AAAA" onerror="alert(1)' },
    { id: 'e', name: 'Huge', text: 'big', context: '', ts: 5, sketch: 'data:image/png;base64,' + 'A'.repeat(70000) },
    { id: 'f', name: 'Plain', text: 'old entry', context: 'ctx', ts: 6 },
  ]);
  // the library is only written on a change, so read what the page shows
  const shown = await page.$$eval('#libraryList li', li => li.map(l => ({ name: l.querySelector('.bank-item-text').textContent, img: l.querySelector('img') ? l.querySelector('img').getAttribute('src') : null })));
  eq(shown.map(s => s.name), ['Good', 'Svg', 'Quote', 'Huge', 'Plain'], 'a drawing-less, text-less entry with a bad value is dropped; the rest load');
  eq(shown.map(s => s.img), [good, null, null, null, null], 'only a real PNG data URL is shown as a picture');
  // adding a text-only entry leaves no sketch key in the store
  await page.fill('#libraryTextInput', 'Plain words.');
  await page.click('#addToLibraryBtn');
  await settle(page, 150);
  const L = await lib(page);
  ok(!JSON.stringify(L.filter(e => !e.sketch)).includes('sketch'), 'entries without a drawing carry no sketch field');
  ok(L.every(e => e.sketch === undefined || /^data:image\/png;base64,/.test(e.sketch)), 'every stored sketch is a PNG data URL');
  eq(page.__dialogs, [], 'no dialogs');
  eq(page.__errs, [], 'no page errors');
  await page.context().close();
}

/* ── a full browser store is said out loud ──────────────────────────────── */
{
  const page = await open();
  const card = await addCard(page, 'Wen', 'Halved it.');
  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await stroke(page, [[50, 50], [100, 100]]);
  await page.click('dialog [data-done]');
  await page.waitForSelector('dialog.sk-dialog', { state: 'detached' });
  await page.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/strategyLibrary/.test(k)) throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); }; });
  await page.click(card + ' [data-save-to-library]');
  await settle(page, 150);
  ok(page.__dialogs.some(d => /no room left/.test(d)), 'the teacher is told there is no room');
  eq(await page.$$eval('#libraryList li', e => e.length), 0, 'and the list does not show an entry that was not kept');
  await page.context().close();
}

/* ── the dialog at 360 px and under axe ─────────────────────────────────── */
{
  const page = await open(360);
  const card = await addCard(page, 'Xia', 'x');
  await page.click(card + ' [data-draw]');
  await page.waitForSelector('dialog.sk-dialog[open]');
  await settle(page, 200);
  const fit = await page.$eval('dialog.sk-dialog', d => { const r = d.getBoundingClientRect(); return { l: r.left, r: r.right, over: d.scrollWidth - d.clientWidth, vw: innerWidth }; });
  ok(fit.l >= 0 && fit.r <= fit.vw + 1, 'the dialog fits a 360 px screen (' + Math.round(fit.l) + '..' + Math.round(fit.r) + ')');
  ok(fit.over <= 1, 'with no sideways scroll (' + fit.over + ')');
  const small = await page.$$eval('dialog .sk-btn', bs => bs.map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)));
  ok(Math.min(...small) >= 24, 'every button is at least 24 px (' + Math.round(Math.min(...small)) + ')');
  const v = await a11yScan(page);
  eq(Array.isArray(v) ? v.map(x => x.id) : v, [], 'no serious axe violations with the dialog open');
  await page.context().close();
}

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
