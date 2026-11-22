// smoke-ocr.mjs — 011 Image -> PDF, Path 17 P5: "Make the PDF searchable (OCR)".
//
//   node Tools/image-to-pdf/test/smoke-ocr.mjs     (npm run test:image-to-pdf-ocr)
//
// The fixture is a page of printed words drawn on a canvas inside the page, so no binary is
// committed. The OCR engine is the vendored Tesseract.js under _shared/vendor/tesseract/, served
// by the suite's own static server; nothing comes from the network (offsite requests are aborted
// and counted). What is asserted is the PDF that comes out: its text layer read back with the
// vendored pdf.js, and its rendering compared pixel for pixel with the same build without OCR,
// which is what "invisible" has to mean. Made-up words only. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, prepPage, settle, SITE } from '../../board-check/harness.mjs';

const PORT = 8668;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '011-image-to-pdf.html';
const VENDOR = path.join(SITE, '_shared', 'vendor', 'tesseract');

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('011 — OCR: a searchable PDF');

// ---- 0. what is on disk, and what is not in the precache ----
{
  const html = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
  ok(!srcs.some(s => /tesseract|ocr\.js/.test(s)), 'neither Tesseract nor ocr.js is a script tag of the page (they load only when OCR is used)');
  const sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  ok(!/tesseract/i.test(sw), 'sw.js does not name the Tesseract files: they are not precached');
  ok(!/ocr\.js/.test(sw.match(/const SHELL_URLS[\s\S]*?\];/)[0]), 'ocr.js is not in the install-time shell');
  for (const f of ['tesseract.min.js', 'worker.min.js', 'eng.traineddata.gz', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-relaxedsimd-lstm.wasm.js', 'LICENSE-tesseract.js.md', 'LICENSE-tesseract-core.txt', 'README.md']) {
    ok(fs.existsSync(path.join(VENDOR, f)), `vendored: ${f}`);
  }
  const readme = fs.readFileSync(path.join(VENDOR, 'README.md'), 'utf8');
  ok(/Apache-2\.0/.test(readme) && /not precached/i.test(readme), 'the vendor README names the licence and says "not precached"');
  ok(/connection/i.test(html.match(/id="ocr-help"[\s\S]*?<\/p>/)[0]) && /first time/i.test(html.match(/id="ocr-help"[\s\S]*?<\/p>/)[0]), 'the help text says the first use needs a connection');
}

const server = await serve(PORT);
const browser = await launch();

// A letter-shaped page of big printed words; `turn` rotates the whole picture (for the sideways test).
async function addFixture(page, name, lines, turn = 0) {
  const b64 = await page.evaluate(({ lines, turn }) => {
    const c = document.createElement('canvas');
    const upright = document.createElement('canvas'); upright.width = 1300; upright.height = 1000;
    const u = upright.getContext('2d');
    u.fillStyle = '#fff'; u.fillRect(0, 0, 1300, 1000);
    u.fillStyle = '#000'; u.font = 'bold 70px Arial, Helvetica, sans-serif'; u.textBaseline = 'alphabetic';
    lines.forEach((t, i) => u.fillText(t, 80, 150 + i * 150));
    if (turn) { c.width = 1000; c.height = 1300; const x = c.getContext('2d'); x.translate(1000, 0); x.rotate(Math.PI / 2); x.drawImage(upright, 0, 0); }
    else { c.width = 1300; c.height = 1000; c.getContext('2d').drawImage(upright, 0, 0); }
    return c.toDataURL('image/png').split(',')[1];
  }, { lines, turn });
  await page.setInputFiles('#file-input', [{ name, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') }]);
  await page.uncheck('#opt-pagenum');   // the footer's "Page 1 of 1" is text too; these checks are about the page's own words
}
const waitQueue = async (page, n) => {
  await page.waitForFunction(k => document.querySelectorAll('#file-list li').length === k, n, { timeout: 30000 });
  await settle(page, 150);
};

async function open(opts = {}) {
  const page = await prepPage(browser, BASE, { width: 1000, height: 900, ...opts });
  await page.addInitScript(() => {
    window.__tessReq = [];
    window.__recognize = 0;
    let kit;
    Object.defineProperty(window, 'OcrKit', {
      configurable: true,
      get() { return kit; },
      set(v) { kit = v; const r = v.recognize; v.recognize = function () { window.__recognize++; return r.apply(this, arguments); }; }
    });
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.tagName === 'SCRIPT' && /tesseract|ocr\.js/.test(n.src)) window.__tessReq.push(n.src.split('/').pop()); }))).observe(document, { childList: true, subtree: true });
  });
  const reqs = [];
  page.on('request', r => { if (/vendor\/tesseract\//.test(r.url())) reqs.push(r.url().split('/').pop()); });
  page.__tess = reqs;
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 100);
  return page;
}

async function generate(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.click('#btn-generate')]);
  return fs.readFileSync(await dl.path());
}
const msgOf = page => page.evaluate(() => document.getElementById('msg').textContent);

// The text layer and a rendering of page 1, read back with the vendored pdf.js in a scratch page.
async function readPdf(bytes) {
  const page = await prepPage(browser, BASE, { width: 800, height: 600 });
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await page.addScriptTag({ url: `${BASE}/_shared/vendor/pdfjs/pdf.min.js` });
  await page.addScriptTag({ url: `${BASE}/_shared/vendor/pdfjs/pdf.worker.min.js` });
  const out = await page.evaluate(async b64 => {
    const bin = atob(b64); const data = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    const doc = await window.pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const tc = await pg.getTextContent();
      const vp = pg.getViewport({ scale: 1 });
      const items = tc.items.filter(i => i.str.trim()).map(i => ({ s: i.str, x: i.transform[4] / vp.width, y: 1 - i.transform[5] / vp.height }));
      const c = document.createElement('canvas'); const v2 = pg.getViewport({ scale: 0.5 });
      c.width = Math.round(v2.width); c.height = Math.round(v2.height);
      await pg.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let h = 0; for (let i = 0; i < px.length; i++) h = (h * 31 + px[i]) >>> 0;
      pages.push({ items, hash: h, w: c.width, h2: c.height });
    }
    return { n: doc.numPages, pages };
  }, bytes.toString('base64'));
  await page.context().close();
  return out;
}
const words = pg => pg.items.map(i => i.s).join(' ').toLowerCase();

const LINES = ['Invented Lesson', 'Photosynthesis Quiz', 'Name and Date'];

// ---- 1. the box off: no OCR file is asked for; the box on: the PDF gains text ----
let plainHash = null;
{
  const page = await open();
  await addFixture(page, 'Worksheet_Invented.png', LINES);
  await waitQueue(page, 1);
  eq(await page.evaluate(() => typeof window.OcrKit), 'undefined', 'OcrKit is not loaded before OCR is used');
  ok(!(await page.isChecked('#opt-ocr')), 'the OCR box starts unticked');
  const plain = await generate(page);
  eq(page.__tess, [], 'with the box unticked, no OCR file is requested');
  eq(await page.evaluate(() => window.__tessReq.length), 0, 'and no OCR script is added');
  const r0 = await readPdf(plain);
  eq(r0.pages[0].items.length, 0, 'the plain PDF has no text layer');
  plainHash = r0.pages[0].hash;

  await page.check('#opt-ocr');
  eq(await page.evaluate(() => typeof window.OcrKit), 'undefined', 'ticking the box alone loads nothing');
  const t0 = Date.now();
  const bytes = await generate(page);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  (OCR of one page, cold: ${secs} s)`);
  ok(page.__tess.includes('worker.min.js') && page.__tess.includes('eng.traineddata.gz') && page.__tess.some(f => /^tesseract-core.*-lstm\.wasm\.js$/.test(f)),
    `OCR fetched its worker, a core and the English data from the vendored folder (got ${JSON.stringify(page.__tess)})`);
  ok(page.__tess.every(f => !/^tesseract-core\.|^tesseract-core-simd\.|^tesseract-core-relaxedsimd\./.test(f)), 'only an LSTM core is fetched');
  eq(page.__blocked, [], 'no offsite request was made');
  ok(/searchable/.test(await msgOf(page)), `the message says the PDF is searchable (got "${await msgOf(page)}")`);
  const r = await readPdf(bytes);
  const w = words(r.pages[0]);
  ok(/photosynthesis/.test(w) && /invented/.test(w) && /lesson/.test(w) && /quiz/.test(w), `the PDF's text layer holds the printed words (got "${w}")`);
  // "Photosynthesis" is on the second line of three: its text sits above the third line's and below the first's
  const y = s => (r.pages[0].items.find(i => i.s.toLowerCase().includes(s)) || {}).y;
  ok(y('invented') < y('photosynthesis') && y('photosynthesis') < y('date'), `the words sit in reading order down the page (y: ${y('invented')?.toFixed(2)}, ${y('photosynthesis')?.toFixed(2)}, ${y('date')?.toFixed(2)})`);
  ok(y('invented') > 0.02 && y('date') < 0.98, 'and inside the page');
  eq(r.pages[0].hash, plainHash, 'the page renders pixel for pixel as it does without OCR: the text is invisible');
  eq(await page.evaluate(() => window.__recognize), 1, 'the page was read once');
  eq(page.__errs.length, 0, `no page or console errors: ${JSON.stringify(page.__errs)}`);

  // ---- 2. a second Generate of the same queue reads nothing again; a rotation reads again ----
  await generate(page);
  eq(await page.evaluate(() => window.__recognize), 1, 'a second Generate reuses the words already read');
  await page.click('#file-list li:nth-child(1) [data-act="rotate"]');
  await generate(page);
  eq(await page.evaluate(() => window.__recognize), 2, 'after the picture is rotated in the queue, the page is read again');
  await page.context().close();
}

// ---- 3. a sideways picture, turned upright in the queue, is read the way it is shown ----
{
  const page = await open();
  await addFixture(page, 'Sideways_Invented.png', LINES, 1);
  await waitQueue(page, 1);
  await page.check('#opt-ocr');
  // as queued the picture lies on its side, turned a quarter clockwise: three more clockwise turns stand it up
  for (let i = 0; i < 3; i++) await page.click('#file-list li:nth-child(1) [data-act="rotate"]');
  const bytes = await generate(page);
  const r = await readPdf(bytes);
  ok(/photosynthesis/.test(words(r.pages[0])), `the rotated page's text layer is the upright words (got "${words(r.pages[0])}")`);
  await page.context().close();
}

// ---- 4. the quality ladder: a target it cannot meet in one go reads each page once ----
{
  const page = await open();
  await addFixture(page, 'A_Invented.png', LINES);
  await waitQueue(page, 1);
  await page.check('#opt-ocr');
  await page.fill('#target-size', '0.5');
  await page.selectOption('#quality', 'original');
  const bytes = await generate(page);
  const run = await page.evaluate(() => window.__imgToPdfLastRun);
  ok(run.attempts.length >= 1, `the ladder ran (attempts: ${run.attempts.length})`);
  eq(await page.evaluate(() => window.__recognize), 1, `one OCR read however many attempts the ladder made (${run.attempts.length})`);
  ok(/photosynthesis/.test(words((await readPdf(bytes)).pages[0])), 'and the final PDF is searchable');
  await page.context().close();
}

// ---- 5. a contact sheet cell is searchable too ----
{
  const page = await open();
  await addFixture(page, 'B1_Invented.png', ['Alpha Gerund', 'Subjunctive Mood']);
  await waitQueue(page, 1);
  await page.check('#opt-ocr');
  await page.selectOption('#grid-density', '2');
  const bytes = await generate(page);
  const r = await readPdf(bytes);
  ok(/gerund/.test(words(r.pages[0])) && /subjunctive/.test(words(r.pages[0])), `a contact sheet cell is searchable (got "${words(r.pages[0])}")`);
  await page.context().close();
}

// ---- 6. the files cannot be fetched: a plain sentence, nothing built, the box can be unticked ----
{
  const page = await open();
  await page.route('**/_shared/vendor/tesseract/**', route => route.abort());
  await addFixture(page, 'C_Invented.png', LINES);
  await waitQueue(page, 1);
  await page.check('#opt-ocr');
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.click('#btn-generate');
  await page.waitForFunction(() => /Reading the text needs the OCR files/.test(document.getElementById('msg').textContent), null, { timeout: 60000 });
  const m = await msgOf(page);
  ok(/first time/.test(m) && /Connect/.test(m) && /untick/.test(m), `the sentence says what happened and what to do (got "${m}")`);
  await settle(page, 300);
  ok(!downloaded, 'no PDF was downloaded');
  ok(await page.isEnabled('#btn-generate') && await page.isEnabled('#btn-clear'), 'Generate and Clear are usable again');
  await page.uncheck('#opt-ocr');
  const bytes = await generate(page);
  eq((await readPdf(bytes)).pages[0].items.length, 0, 'unticked, the same queue makes the plain PDF');
  await page.context().close();
}

// ---- 7. the service worker keeps what the first use fetched, so OCR then works offline ----
{
  const page = await open({ serviceWorkers: 'allow' });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  await addFixture(page, 'D_Invented.png', LINES);
  await waitQueue(page, 1);
  await page.check('#opt-ocr');
  const cachedBefore = await page.evaluate(async () => { const out = []; for (const n of await caches.keys()) { for (const r of await (await caches.open(n)).keys()) if (/vendor\/tesseract\//.test(r.url)) out.push(r.url); } return out; });
  eq(cachedBefore, [], 'nothing of Tesseract is in any cache before OCR is used');
  await generate(page);
  const cached = await page.evaluate(async () => { const out = []; for (const n of await caches.keys()) { for (const r of await (await caches.open(n)).keys()) if (/vendor\/tesseract\//.test(r.url)) out.push(n.replace(/-v\d+$/, '') + ':' + r.url.split('/').pop()); } return out; });
  ok(cached.some(x => /worker\.min\.js/.test(x)) && cached.some(x => /eng\.traineddata\.gz/.test(x)) && cached.some(x => /lstm\.wasm\.js/.test(x)),
    `the worker, a core and the data are in the service worker's cache after one use (got ${JSON.stringify(cached)})`);
  ok(cached.every(x => x.startsWith('aplp-runtime')), 'in the runtime cache, not the precache');
  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch(() => {});
  await addFixture(page, 'E_Invented.png', ['Offline Check Words']);
  await waitQueue(page, 1);
  await page.check('#opt-ocr');
  const bytes = await generate(page);
  ok(/offline/.test(words((await readPdf(bytes)).pages[0])), 'with the network off, OCR still reads the page from the cache');
  await page.context().close();
}

// ---- 8. what a word may be ----
{
  const page = await open();
  await page.addScriptTag({ url: `${BASE}/Tools/image-to-pdf/ocr.js` });
  const c = await page.evaluate(() => [window.OcrKit.clean('café'), window.OcrKit.clean('a✓b'), window.OcrKit.clean(' ✓ '), window.OcrKit.clean(null)]);
  eq(c, ['café', 'ab', '', ''], 'clean keeps Latin-1 letters and drops what a standard PDF font cannot show');
  await page.context().close();
}

await browser.close();
server.close();
console.log(`\n${passed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
