// smoke-bulk.mjs — 016: a label under each code, and batch codes from a spreadsheet.
//
//   node Tools/qr-code-generator/test/smoke-bulk.mjs
//
// Part 1, the label. A single code has had a caption band since before this
// row; what is pinned here is the rule the page now states and the two things
// the row asks for: the caption never comes closer to the code than its four
// module quiet zone, and it stays readable at the smallest size (200 px).
// Both are read off the canvas's pixels, and the code is decoded with the
// page's own jsQR, so it is the same code. A long caption shrinks, then ends in
// an ellipsis, and stays inside the code's width. A label holding markup is
// text on screen, in the printed sheet and in the downloaded SVG.
// Part 2, the batch. Rows pasted or chosen from a CSV file: a header row
// skipped, quoted cells, either column order, Check rows naming every row that
// will not make a code, Generate leaving those out and saying how many, the
// stated limit of 400, a label over 60 characters shown shortened in the grid
// and on the printed sheet (plain and on label stock) with its code unchanged,
// and every printed code decoding to its row's link. Lengths are asserted as
// relations, never as pixels of text: how wide a line of type is belongs to the
// machine's fonts. print() is stubbed. Nothing was printed on paper and no
// phone scanned a code. Exits 1 on any failure. Port 8520.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';

const PORT = 8520;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '016-qr-code-generator.html';
const SCRATCH = fs.mkdtempSync(path.join(process.env.QR_SCRATCH || os.tmpdir(), 'qr-bulk-'));

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);

const server = await serve(PORT);
const browser = await launch();

async function open(extra) {
  const page = await prepPage(browser, BASE, { width: 1000, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; window.__pwn = 0; });
  if (extra) await page.addInitScript(extra);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
const XSS = '<img src=x onerror="window.__pwn=1">';

/** Reads a single code's canvas: where the code's ink ends, where the
    caption's begins, the quiet zone in px, whether it decodes, how wide and how
    tall the caption's ink is. Ink is anything dark on the default white. */
const readCanvas = (page, text) => page.evaluate(text => {
  const c = document.getElementById('qr-canvas');
  const w = c.width, h = c.height, size = w;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const ink = (x, y) => { const i = (y * w + x) * 4; return d[i] + d[i + 1] + d[i + 2] < 384; };
  const rowInk = y => { for (let x = 0; x < w; x++) if (ink(x, y)) return true; return false; };
  let codeBottom = -1, capTop = -1, capBottom = -1, capLeft = w, capRight = -1;
  for (let y = 0; y < size; y++) if (rowInk(y)) codeBottom = y;
  for (let y = size; y < h; y++) if (rowInk(y)) { if (capTop < 0) capTop = y; capBottom = y; }
  for (let y = size; y < h; y++) for (let x = 0; x < w; x++) if (ink(x, y)) { if (x < capLeft) capLeft = x; if (x > capRight) capRight = x; }
  const q = window.qrcode(0, document.getElementById('ec-level').value); q.addData(text); q.make();
  const modules = q.getModuleCount();
  const r = window.jsQR(d, w, h);
  return { w, h, size, codeBottom, capTop, capBottom, capLeft, capRight, quiet: 4 * size / (modules + 8), modules, decoded: r ? r.data : null };
}, text);

async function single(page, { text, caption, size }) {
  await page.evaluate(sz => { const e = document.getElementById('size-slider'); e.value = sz; e.dispatchEvent(new Event('input', { bubbles: true })); }, size);
  await page.fill('#caption-text', caption || '');
  await page.fill('#qr-text', text);
  await page.waitForFunction(() => !document.getElementById('btn-svg').disabled);
  await settle(page, 150);
}

// ---- Part 1: the label under a single code -----------------------------------------------
console.log('016 — a label under each code');
{
  const page = await open();
  try {
    const hint = await page.locator('#caption-text').locator('xpath=following-sibling::div[contains(@class,"hint")]').textContent();
    ok(/60 characters/.test(hint) && /shrinks/.test(hint) && /…/.test(hint) && /blank border/.test(hint), 'the caption field states the rule: 60 characters, shrink, then an ellipsis, outside the blank border');
    eq(await page.getAttribute('#caption-text', 'maxlength'), '60', 'the field takes 60 characters');
    const T = 'https://example.com/station/12';
    for (const size of [200, 400, 1000]) {
      await single(page, { text: T, caption: 'Rm 214 Wi-Fi', size });
      const m = await readCanvas(page, T);
      const what = `a caption at ${size}px`;
      eq(m.decoded, T, `${what}: the code decodes to what was typed`);
      eq(m.w, size, `${what}: the code's square is the size asked for`);
      ok(m.capTop >= 0, `${what}: the caption has ink`);
      ok(m.capTop - m.codeBottom - 1 >= m.quiet - 1, `${what}: the caption is at least 4 modules (${m.quiet.toFixed(1)}px) from the code (${m.capTop - m.codeBottom - 1}px)`);
      ok(m.capBottom - m.capTop + 1 >= 8, `${what}: its letters are at least 8px tall (${m.capBottom - m.capTop + 1}px)`);
      ok(m.capBottom < m.h, `${what}: it is inside the image`);
      ok(m.capLeft >= m.size * 0.04 && m.capRight <= m.size * 0.96, `${what}: it is inside the code's width (${m.capLeft}..${m.capRight} of ${m.size})`);
      // nothing but the code's own border between the code and the caption
      const gap = await page.evaluate(([from, to]) => {
        const c = document.getElementById('qr-canvas'); const d = c.getContext('2d').getImageData(0, from, c.width, to - from).data;
        let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 384) n++; return n;
      }, [m.codeBottom + 1, m.capTop]);
      eq(gap, 0, `${what}: the border under the code is blank`);
    }
    // a caption of 60 characters at the smallest size
    const LONG = 'The quick brown fox jumps over the lazy dog, again and again!!';
    await single(page, { text: T, caption: LONG.slice(0, 60), size: 200 });
    let m = await readCanvas(page, T);
    eq(m.decoded, T, 'a 60-character caption at 200px: the code decodes');
    ok(m.capLeft >= m.size * 0.04 && m.capRight <= m.size * 0.96, `…and it stays inside the code's width (${m.capLeft}..${m.capRight})`);
    ok(m.capTop - m.codeBottom - 1 >= m.quiet - 1, '…and at least 4 modules from the code');
    ok(m.capBottom - m.capTop + 1 >= 5, `…and is still drawn at a size that has letters (${m.capBottom - m.capTop + 1}px tall)`);
    await single(page, { text: T, caption: '', size: 200 });
    m = await readCanvas(page, T);
    eq(m.h, m.w, 'with no caption the image is a square, as it was');
    eq(m.capTop, -1, '…with no caption ink');
    eq(m.decoded, T, '…and the same code');
    // the code with a caption is the code without one, module for module
    const bits = async cap => { await single(page, { text: T, caption: cap, size: 300 }); return page.evaluate(() => {
      const c = document.getElementById('qr-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.width).data; let h = 5381;
      for (let i = 0; i < d.length; i += 4) h = ((h * 33) ^ d[i]) >>> 0; return h; }); };
    eq(await bits('Station 12'), await bits(''), 'the code is bit for bit what it is without a caption');
    // markup in a caption is text
    await single(page, { text: T, caption: XSS, size: 300 });
    const svg = await downloadText(page, '#btn-svg', { what: 'the SVG' });
    ok(svg.indexOf('<img') === -1 && svg.indexOf('&lt;img') !== -1, 'a caption holding markup is escaped in the downloaded SVG');
    const parsed = await page.evaluate(s => { const d = new DOMParser().parseFromString(s, 'image/svg+xml'); return { err: !!d.querySelector('parsererror'), imgs: d.getElementsByTagName('img').length, text: [...d.getElementsByTagName('text')].map(t => t.textContent).join('|') }; }, svg);
    ok(!parsed.err && parsed.imgs === 0 && parsed.text.indexOf('<img') !== -1, 'the SVG parses and the markup is its text');
    eq(await page.evaluate(() => window.__pwn), 0, 'nothing in the caption ran');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `the single code's label: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

// ---- Part 2: a batch from a spreadsheet --------------------------------------------------
const openBulk = async extra => { const p = await open(extra); await p.click('label[for="mode-bulk"]'); return p; };
const generate = async page => {
  await page.click('#btn-bulk-generate');
  await page.waitForFunction(() => /generated|Trim the list|Paste at least/.test(document.getElementById('bulk-status').textContent), null, { timeout: 90000 });
  await page.evaluate(() => Promise.all([...document.images].filter(i => i.getAttribute('src')).map(i => i.decode().catch(() => 0))));
  return page.textContent('#bulk-status');
};
const checkText = page => page.evaluate(() => document.getElementById('bulk-check').innerText.replace(/\s+/g, ' ').trim());
const problems = page => page.evaluate(() => [...document.querySelectorAll('#bulk-problems li')].map(l => l.textContent));
const gridLabels = page => page.evaluate(() => [...document.querySelectorAll('#bulk-grid .bulk-item-label')].map(l => l.textContent));
const printed = page => page.evaluate(() => [...document.querySelectorAll('#print-area-bulk img')].map(i => {
  const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, c.width, c.height);
  const r = window.jsQR(d.data, c.width, c.height); return r ? r.data : null;
}));
const NEEDS = 'Label,URL\n"Rm 214, Wi-Fi",https://example.com/wifi\n\nStation 2,https://example.com/s/2\n,\nStation 2,https://example.com/s/2\nStation 3\thttps://example.com/s/3\nStation 4,' + 'x'.repeat(2400);

console.log('016 — batch codes from a spreadsheet');
{
  const page = await openBulk();
  try {
    const rule = await page.textContent('#bulk-rule');
    ok(/header row/i.test(rule) && /400/.test(rule) && /60 characters/.test(rule) && /Nothing is uploaded/.test(rule), 'the page states the header rule, the 400 limit, the 60-character label and that nothing is uploaded');
    eq(await page.locator('#bulk-file').getAttribute('type'), 'file', 'there is a file chooser');
    ok(await page.locator('label[for="bulk-file"]').isVisible(), '…with a label');
    // Check rows
    await page.click('#btn-bulk-check');
    ok(/Paste at least one line/.test(await checkText(page)), 'Check rows on an empty paste says to paste');
    await page.fill('#bulk-text', NEEDS);
    await page.click('#btn-bulk-check');
    const t = await checkText(page);
    ok(/3 rows will make a code/.test(t), 'Check rows counts the rows that will make a code: ' + t);
    ok(/the first row \(column names\) is skipped/.test(t), '…says the header is skipped');
    ok(/3 rows will not make a code/.test(t), '…and counts the three that will not');
    const pr = await problems(page);
    eq(pr.length, 3, 'each row that will not make a code is listed');
    ok(/^Line 5 \(\(empty\)\): nothing to put in a code$/.test(pr[0]), 'the empty row is line 5: ' + pr[0]);
    ok(/^Line 6 \(Station 2\): same label and link as line 4$/.test(pr[1]), 'the repeat is line 6 and names line 4: ' + pr[1]);
    ok(/^Line 8 \(Station 4\): too long for a code at error correction M \(2400 bytes, the most is 2331\)$/.test(pr[2]), 'the long one is line 8 and says why: ' + pr[2]);
    ok(await page.locator('#bulk-check [role], #bulk-check').first().isVisible(), 'the result is on screen');
    eq(await page.getAttribute('#bulk-check', 'aria-live'), 'polite', 'and announced politely');
    // the error correction level moves the limit
    await page.selectOption('#ec-level', 'L');
    await page.click('#btn-bulk-check');
    ok(/Station 4/.test((await problems(page)).join('')) === false, 'at Low error correction the 2400 byte row fits');
    await page.selectOption('#ec-level', 'H');
    await page.click('#btn-bulk-check');
    ok(/error correction H/.test((await problems(page)).join('|')), 'at High it is too long, and the reason names H');
    await page.selectOption('#ec-level', 'M');
    // Generate leaves them out
    const st = await generate(page);
    ok(/3 codes generated/.test(st) && /3 rows left out/.test(st), 'Generate makes 3 codes and says 3 rows were left out: ' + st);
    same(await gridLabels(page), ['Rm 214, Wi-Fi', 'Station 2', 'Station 3'], 'the grid is the three good rows, labelled');
    same(await printed(page), ['https://example.com/wifi', 'https://example.com/s/2', 'https://example.com/s/3'], 'every printed code decodes to its row\'s link');
    ok(/3 rows will not make a code/.test(await checkText(page)), 'Generate shows the same list');
    ok(!(await page.locator('#btn-bulk-print').isDisabled()), 'the grid can be printed');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `Check rows and Generate: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

// order, and a CSV file with a byte order mark
{
  const page = await openBulk();
  try {
    await page.fill('#bulk-text', 'https://example.com/1, Door 1\nhttps://example.com/2, Door 2');
    await page.selectOption('#bulk-order', 'link-first');
    ok(await generate(page).then(s => /2 codes generated/.test(s)), 'link-first: two codes');
    same(await gridLabels(page), ['Door 1', 'Door 2'], 'link-first: the labels are the second column');
    same(await printed(page), ['https://example.com/1', 'https://example.com/2'], 'link-first: the codes are the first');
    await page.selectOption('#bulk-order', 'label-first');
    eq(await checkText(page), '', 'changing the column order clears a stale result');
    ok(await generate(page).then(s => /2 codes generated/.test(s)), 'label-first on the same paste: two codes');
    same(await gridLabels(page), ['https://example.com/1', 'https://example.com/2'], 'label-first reads the first column as the label, as it always did');

    const csv = path.join(SCRATCH, 'rooms.csv');
    fs.writeFileSync(csv, '﻿Name,Link\r\n"Lab, north",https://example.com/north\r\nLab south,https://example.com/south\r\n');
    await page.fill('#bulk-text', '');
    await page.setInputFiles('#bulk-file', csv);
    await page.waitForFunction(() => /will make a code/.test(document.getElementById('bulk-check').textContent));
    const v = await page.inputValue('#bulk-text');
    ok(v.charCodeAt(0) !== 0xFEFF && /^Name,Link/.test(v), 'the file is read into the box without its byte order mark');
    ok(/2 rows will make a code; the first row \(column names\) is skipped/.test(await checkText(page)), 'a file is checked as soon as it is chosen: ' + await checkText(page));
    ok(await generate(page).then(s => /2 codes generated/.test(s)), 'its two rows make two codes');
    same(await gridLabels(page), ['Lab, north', 'Lab south'], 'the quoted comma stays in its label');
    same(await printed(page), ['https://example.com/north', 'https://example.com/south'], 'and the codes decode to the links');
    // a second file adds to what is there
    const csv2 = path.join(SCRATCH, 'more.csv');
    fs.writeFileSync(csv2, 'Label,URL\nLab east,https://example.com/east\n');
    await page.setInputFiles('#bulk-file', csv2);
    await page.waitForFunction(() => /^3 rows will make a code/.test(document.getElementById('bulk-check').textContent.trim()));
    ok(true, 'a second file is added after the first (3 rows)');
    ok(!/Label,URL/.test((await page.inputValue('#bulk-text')).split('\n').slice(1).join('\n')), 'the second file\'s own header row is not added as a row');
    ok(/Name,Link/.test(await page.inputValue('#bulk-text')), 'the first file\'s header stays, as the first row');
    eq(await page.evaluate(() => document.getElementById('bulk-file').value), '', 'the chooser is cleared so the same file can be chosen again');
    // too big
    const big = path.join(SCRATCH, 'big.csv');
    fs.writeFileSync(big, 'a,b\n' + 'x'.repeat(1024 * 1024 + 10));
    await page.setInputFiles('#bulk-file', big);
    await page.waitForFunction(() => /over 1 MB/.test(document.getElementById('bulk-check').textContent));
    ok(true, 'a file over 1 MB is refused and says so');
    ok(!(await page.inputValue('#bulk-text')).includes('xxxxxxxx'), '…and is not put in the box');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `order and files: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

// labels: 60 characters, markup, the printed sheets
{
  const page = await openBulk();
  try {
    const L61 = 'Long label ' + '0123456789'.repeat(5);
    const lines = ['A, https://example.com/a', L61 + ', https://example.com/long', XSS.replace(/,/g, ';') + ', https://example.com/xss'];
    ok(L61.length === 61, 'the long label is 61 characters');
    await page.fill('#bulk-text', lines.join('\n'));
    await page.click('#btn-bulk-check');
    ok(/1 label is shown shortened/.test(await checkText(page)), 'Check rows says one label is shown shortened: ' + await checkText(page));
    ok(/3 rows will make a code/.test(await checkText(page)), '…and that all three make a code');
    await generate(page);
    const labels = await gridLabels(page);
    eq(labels[1], L61.slice(0, 59) + '…', 'the long label is its first 59 characters and an ellipsis');
    eq(Array.from(labels[1]).length, 60, '…60 in all');
    eq(labels[0], 'A', 'a short label is as typed');
    eq(labels[2], XSS.replace(/,/g, ';'), 'markup in a label is shown as text');
    eq(await page.evaluate(() => window.__pwn), 0, 'nothing in a label ran on screen');
    eq(await page.locator('#bulk-grid img[src="x"], #print-area-bulk img[src="x"]').count(), 0, 'no <img src=x> was made by it, on screen or on the sheet');
    eq(await page.locator('#bulk-grid .bulk-item-label img, #print-area-bulk .bulk-item-label img, #bulk-check img').count(), 0, 'no element was made inside a label or the result list');
    same(await printed(page), ['https://example.com/a', 'https://example.com/long', 'https://example.com/xss'], 'the codes are not shortened: each decodes to its whole link');
    const alts = await page.evaluate(() => [...document.querySelectorAll('#print-area-bulk img')].map(i => i.alt));
    ok(alts[2].indexOf('<img') !== -1, 'the picture\'s alt text is the label as text');
    // the same on the printed sheet, plain and on label stock
    for (const sheet of ['custom', 'avery5160', 'avery5163']) {
      await page.selectOption('#bulk-sheet', sheet);
      await generate(page);
      const m = await page.evaluate(() => {
        document.body.classList.add('print-bulk');
        const items = [...document.querySelectorAll('#print-area-bulk .bulk-item')];
        const out = items.map(it => {
          const im = it.querySelector('img').getBoundingClientRect(), lb = it.querySelector('.bulk-item-label').getBoundingClientRect(), box = it.getBoundingClientRect();
          return { text: it.querySelector('.bulk-item-label').textContent, imgBottom: im.bottom, labTop: lb.top, labBottom: lb.bottom, boxBottom: box.bottom, labLeft: lb.left, labRight: lb.right, boxLeft: box.left, boxRight: box.right };
        });
        document.body.classList.remove('print-bulk');
        return out;
      });
      eq(m.length, 3, `${sheet}: three labels on the sheet`);
      eq(m[1].text, L61.slice(0, 59) + '…', `${sheet}: the printed label is the shortened one`);
      eq(m[2].text, XSS.replace(/,/g, ';'), `${sheet}: the printed markup is text`);
      ok(m.every(x => x.labTop >= x.imgBottom - 0.5), `${sheet}: every label starts below its code's picture, which holds the code's border`);
      ok(m.every(x => x.labBottom <= x.boxBottom + 1), `${sheet}: and ends inside its card`);
      if (sheet !== 'custom') ok(m.every(x => x.labLeft >= x.boxLeft - 0.5 && x.labRight <= x.boxRight + 0.5), `${sheet}: and inside its label's width`);
    }
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `labels: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

// the limit, and a list pasted before this row
{
  const page = await openBulk();
  try {
    const rows = n => Array.from({ length: n }, (_, i) => `Row ${i + 1}, https://example.com/r/${i + 1}`).join('\n');
    await page.fill('#bulk-text', rows(401));
    await page.click('#btn-bulk-check');
    ok(/401 rows will make a code/.test(await checkText(page)) && /over the 400 limit/.test(await checkText(page)), 'Check rows says 401 is over the 400 limit: ' + await checkText(page));
    const st = await generate(page);
    ok(/up to 400/.test(st), 'Generate refuses 401 and names the limit: ' + st);
    eq(await page.locator('#bulk-grid .bulk-item').count(), 0, '…and draws nothing');
    ok(await page.locator('#btn-bulk-print').isDisabled(), '…and prints nothing');
    await page.fill('#bulk-text', rows(400) + '\nRow 400, https://example.com/r/400');
    await page.click('#btn-bulk-check');
    ok(/400 rows will make a code/.test(await checkText(page)) && !/over the 400/.test(await checkText(page)), '400 good rows and one repeat is at the limit, not over it');
    eq((await problems(page)).length, 1, '…and the repeat is listed');
    // an old paste: no header, no quotes, no problems -> the old result
    await page.fill('#bulk-text', 'Station 1, https://example.com/1\nStation 2\thttps://example.com/2\nJust text\nWi-Fi, https://example.com/?a=1,2');
    const s2 = await generate(page);
    ok(/4 codes generated\.$/.test(s2.trim()) || /4 codes generated/.test(s2) && !/left out/.test(s2), 'an old-style paste makes its four codes with nothing left out: ' + s2);
    same(await printed(page), ['https://example.com/1', 'https://example.com/2', 'Just text', 'https://example.com/?a=1,2'], 'the codes are the ones the old page made');
    same(await gridLabels(page), ['Station 1', 'Station 2', 'Just text', 'Wi-Fi'], 'with the old labels');
    ok(!(await page.locator('#bulk-problems').count()), 'and no list of problems');
    // settings saved before today still open as they were
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `the limit and an old paste: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}
{
  const page = await open(() => localStorage.setItem('qr-code-generator-settings', JSON.stringify({ size: '640', fg: '#112233', bg: '#ffffff', ec: 'Q' })));
  try {
    eq(await page.inputValue('#size-slider'), '640', 'a saved size opens as it was');
    eq(await page.inputValue('#ec-level'), 'Q', 'a saved error-correction level opens as it was');
    eq(await page.inputValue('#bulk-order'), 'label-first', 'the new column choice starts where the page always read');
    await page.click('label[for="mode-bulk"]');
    await page.fill('#bulk-text', 'x, ' + 'a'.repeat(1664));
    await page.click('#btn-bulk-check');
    ok(/error correction Q \(1664 bytes, the most is 1663\)/.test((await problems(page)).join('')), 'a saved level of Q sets the limit Check rows uses');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `saved settings: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

// keyboard and screen reader
{
  const page = await openBulk();
  try {
    await page.fill('#bulk-text', NEEDS);
    await page.click('#btn-bulk-check');
    const v = await a11yScan(page, { impact: 'serious' });
    eq(v.length, 0, 'axe: no serious or critical violation with the result list showing: ' + JSON.stringify(v.map(x => x.id)));
    await page.focus('#bulk-text');
    const seen = [];
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); seen.push(await page.evaluate(() => document.activeElement.id)); }
    ok(['bulk-file', 'bulk-order', 'btn-bulk-check'].every(id => seen.includes(id)), 'Tab reaches the chooser, the column order and Check rows: ' + seen.join(','));
    await page.focus('#btn-bulk-check');
    await page.keyboard.press('Enter');
    ok(/will make a code/.test(await checkText(page)), 'Enter on Check rows runs it');
    ok(await page.locator('#btn-bulk-check').evaluate(b => b.textContent.trim() === 'Check rows'), 'the button is a button with its name');
  } catch (e) { ok(false, `keyboard and screen reader: ${String(e.message || e).split('\n')[0]}`); }
  finally { await page.context().close(); }
}

await browser.close();
server.close();
fs.rmSync(SCRATCH, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`PASS — ${passed} green`);
