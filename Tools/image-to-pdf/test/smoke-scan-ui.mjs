// smoke-scan-ui.mjs — 011 Image -> PDF, Path 17 P2: the Scan dialog, its Worker and the queue.
//
//   node Tools/image-to-pdf/test/smoke-scan-ui.mjs     (npm run test:image-to-pdf-scan-ui)
//
// The photos are the synthetic fixtures of make-scan-fixtures.mjs (a sheet drawn through a
// homography onto a desk, with its true corners), so no camera and no network. The detector's own
// accuracy is scan.test.mjs's; this is the page: the dialog's handles, keys, undo, the Worker, the
// queue entry, the saved format and the PDF that comes out. Made-up names only.

import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, prepPage, settle, a11yScan, SITE } from '../../board-check/harness.mjs';
import { fixture, toPng } from './make-scan-fixtures.mjs';

const PORT = 8699;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '011-image-to-pdf.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('011 — Scan dialog, Worker and queue');

{
  const html = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
  ok(!srcs.some(s => /scan/.test(s)), 'scan.js and scan-ui.js are not script tags of the page (they load when Scan is first pressed)');
  const sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  for (const f of ['scan.js', 'scan-ui.js', 'scan-worker.js']) ok(sw.includes(`"Tools/image-to-pdf/${f}"`), `${f} is precached`);
}

const photos = {};
for (const n of ['centred', 'noPage', 'keystone']) photos[n] = fixture(n);
const png = n => toPng(photos[n].imageData);

const server = await serve(PORT);
const browser = await launch();

async function open() {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  page.__workers = 0;
  page.on('worker', () => { page.__workers++; });
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 100);
  return page;
}
async function add(page, names) {
  const had = await page.$$eval('#file-list li', l => l.length);
  await page.setInputFiles('#file-input', names.map(n => ({ name: `${n}_Invented.png`, mimeType: 'image/png', buffer: png(n) })));
  await page.waitForFunction(k => document.querySelectorAll('#file-list li').length === k, had + names.length);
  await settle(page, 100);
}
const quadOf = page => page.evaluate(() => {
  const W = document.querySelector('.scan-photo').width, H = document.querySelector('.scan-photo').height;   // display canvas, a scaled copy
  return [...document.querySelectorAll('.scan-handle')].map(b => [parseFloat(b.style.left) / 100, parseFloat(b.style.top) / 100, W, H]);
});
const status = page => page.textContent('.scan-status');
async function openDialog(page, row = 1) {
  await page.click(`#file-list li:nth-child(${row}) [data-act="scan"]`);
  await page.waitForSelector('.scan-dialog[open] .scan-handle:not([hidden])');
  await page.waitForFunction(() => /Found the page|not sure|find the edges/.test(document.querySelector('.scan-status').textContent), null, { timeout: 30000 });
}
const near = (fr, truth, W, H, tol) => fr.every((p, i) => Math.hypot(p[0] * W - truth[i][0], p[1] * H - truth[i][1]) <= tol);
const rowBadge = (page, row) => page.evaluate(r => (document.querySelector(`#file-list li:nth-child(${r}) .scan-badge`) || {}).textContent || '', row);

// ---- 1. one photo: open, detect, move, undo, apply ----
{
  const page = await open();
  await add(page, ['centred']);
  ok(await page.isVisible('#scan-bar'), 'the Scan all bar shows once a photo is queued');
  eq(await page.evaluate(() => typeof window.ScanUI), 'undefined', 'ScanUI is not loaded before Scan is pressed');
  eq(page.__workers, 0, 'no Worker before Scan is pressed');
  await openDialog(page);
  eq(page.__workers, 1, 'Detect runs in a Worker');
  const W = 1600, H = 1200, truth = photos.centred.quad;
  const q = await quadOf(page);
  eq(q.length, 4, 'four handles');
  ok(near(q, truth, W, H, 0.03 * W), `Detect put the handles within 3% of the sheet's corners (got ${JSON.stringify(q.map(p => [Math.round(p[0] * W), Math.round(p[1] * H)]))}, want ${JSON.stringify(truth.map(p => p.map(Math.round)))})`);
  eq(await page.$$eval('.scan-handle', bs => bs.map(b => b.getAttribute('aria-label'))), ['Top left corner', 'Top right corner', 'Bottom right corner', 'Bottom left corner'], 'the handles are labelled');
  const sizes = await page.$$eval('.scan-handle', bs => bs.map(b => [b.offsetWidth, b.offsetHeight]));
  ok(sizes.every(s => s[0] >= 44 && s[1] >= 44), 'every handle is a 44 x 44 target');
  ok(/Found the page/.test(await status(page)), `confidence is good, so it says "Found the page" (got "${await status(page)}")`);
  await settle(page, 500);
  ok(await page.evaluate(() => { const c = document.querySelector('.scan-after canvas'); return c.width > 100 && c.height > c.width; }), 'the live "after" shows an upright portrait page');

  const ax = await a11yScan(page, { impact: 'serious' });
  eq(ax.map(v => v.id), [], 'the open dialog has no serious axe violation');

  // arrow keys: Shift+Right is ten screen pixels; Ctrl+Z puts it back
  await page.focus('.scan-handle[data-i="0"]');
  const before = (await quadOf(page))[0];
  await page.keyboard.press('Shift+ArrowRight');
  const moved = (await quadOf(page))[0];
  const dispW = await page.evaluate(() => document.querySelector('.scan-photo').getBoundingClientRect().width);
  ok(Math.abs((moved[0] - before[0]) * dispW - 10) < 0.5 && moved[1] === before[1], `Shift+Right moves a corner 10 screen px (moved ${((moved[0] - before[0]) * dispW).toFixed(2)})`);
  await page.keyboard.press('Control+z');
  eq((await quadOf(page))[0], before, 'Ctrl+Z puts it back');

  // a drag
  const box = await (await page.$('.scan-handle[data-i="2"]')).boundingBox();
  const sb = await (await page.$('.scan-photo')).boundingBox();
  await page.mouse.move(box.x + 22, box.y + 22);
  await page.mouse.down();
  await page.mouse.move(box.x + 22 - 30, box.y + 22 - 20, { steps: 4 });
  ok(await page.isVisible('.scan-loupe'), 'a loupe shows while a handle is held');
  await page.mouse.up();
  ok(!(await page.isVisible('.scan-loupe')), 'and goes when it is let go');
  const dragged = (await quadOf(page))[2], q2 = q[2];
  ok(Math.abs((dragged[0] - q2[0]) * sb.width + 30) < 2 && Math.abs((dragged[1] - q2[1]) * sb.height + 20) < 2, 'a drag moves the corner with the pointer');
  await page.click('.scan-controls button:has-text("Reset")');
  ok(near(await quadOf(page), truth, W, H, 0.03 * W), 'Reset goes back to what Detect found');

  // corners that make no page: Apply is refused with a plain sentence
  await page.focus('.scan-handle[data-i="0"]');
  for (let i = 0; i < 60; i++) await page.keyboard.press('Shift+ArrowDown');
  for (let i = 0; i < 80; i++) await page.keyboard.press('Shift+ArrowRight');
  await settle(page, 400);
  const bad = await page.evaluate(() => ({ dis: document.querySelector('.scan-controls .btn-primary').disabled, t: document.querySelector('.scan-status').textContent }));
  ok(bad.dis && /do not make a page/.test(bad.t), `a crossed quad disables Apply and says why (got ${JSON.stringify(bad)})`);
  await page.click('.scan-controls button:has-text("Reset")');
  await settle(page, 400);

  // Escape leaves the entry as it was
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.scan-dialog[open]'));
  eq(await rowBadge(page, 1), '', 'Escape cancels: no Scanned badge');

  // Black and white, Apply
  await openDialog(page);
  await page.selectOption('.scan-mode select', 'bw');
  await settle(page, 500);
  ok(await page.evaluate(() => {
    const c = document.querySelector('.scan-after canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] !== 0 && d[i] !== 255) return false;
    return true;
  }), 'black and white previews two levels only');
  await page.click('.scan-controls .btn-primary');
  await page.waitForFunction(() => !document.querySelector('.scan-dialog[open]'));
  eq(await rowBadge(page, 1), 'Scanned', 'Apply marks the row Scanned');
  const th = await page.evaluate(async () => {
    const im = new Image(); im.src = document.querySelector('#file-list img.thumb').src; await im.decode();
    return { w: im.naturalWidth, h: im.naturalHeight };
  });
  ok(Math.abs(th.w / th.h - 850 / 1100) < 0.06, `the queued page is the sheet upright, 850:1100 (got ${th.w} x ${th.h})`);
  eq(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-act')), 'scan', 'focus returns to the row\'s Scan button');
  eq(await page.evaluate(() => JSON.parse(localStorage.getItem('image-to-pdf-settings')).scan), { mode: 'bw' }, 'the look is kept as a habit');
  eq(await page.evaluate(() => Object.keys(localStorage).filter(k => !/^(image-to-pdf-settings|gvb-)/.test(k))), [], 'nothing else is stored (a scan is not saved)');

  // Generate: one page, a PNG (no JPEG stream) for black and white
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#btn-generate')]);
  const bytes = fs.readFileSync(await dl.path()).toString('latin1');
  eq((bytes.match(/\/Type\s*\/Page\b/g) || []).length, 1, 'Generate makes a one-page PDF');
  ok(!/DCTDecode/.test(bytes), 'a black-and-white page is embedded as PNG, not JPEG');

  // Color goes out as JPEG, and the dialog reopens on the saved corners
  await page.click('#file-list li:nth-child(1) [data-act="scan"]');
  await page.waitForSelector('.scan-dialog[open] .scan-handle:not([hidden])');
  await settle(page, 400);
  ok(near(await quadOf(page), truth, W, H, 0.03 * W), 'reopening shows the corners in use');
  eq(await page.inputValue('.scan-mode select'), 'bw', 'and the look it was saved with');
  await page.selectOption('.scan-mode select', 'color');
  await page.click('.scan-controls .btn-primary');
  await page.waitForFunction(() => !document.querySelector('.scan-dialog[open]'));
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#btn-generate')]);
  ok(/DCTDecode/.test(fs.readFileSync(await dl2.path()).toString('latin1')), 'a color page is embedded as JPEG');

  // Rotate and delete still work on a scanned row
  await page.click('#file-list li:nth-child(1) [data-act="rotate"]');
  ok(/currently 90/.test(await page.getAttribute('#file-list li:nth-child(1) [data-act="rotate"]', 'aria-label')), 'rotate works on a scanned page');
  await page.click('#file-list li:nth-child(1) [data-act="remove"]');
  eq(await page.$$eval('#file-list li', l => l.length), 0, 'delete works on a scanned page');
  eq(page.__errs.length, 0, `no page or console errors: ${JSON.stringify(page.__errs)}`);
  await page.context().close();
}

// ---- 2. Scan all: flags the unsure ones, leaves a hand-set page alone ----
{
  const page = await open();
  await add(page, ['centred']);
  await openDialog(page);
  await page.focus('.scan-handle[data-i="1"]');
  await page.keyboard.press('Shift+ArrowLeft');           // a hand-set corner
  await page.click('.scan-controls .btn-primary');
  await page.waitForFunction(() => !document.querySelector('.scan-dialog[open]'));
  const before = await page.$eval('#file-list img.thumb', i => i.src);
  await add(page, ['noPage', 'keystone']);
  eq(await page.$$eval('#file-list li', l => l.length), 3, 'three photos queued');
  await page.selectOption('#scan-mode', 'gray');
  await page.click('#btn-scan-all');
  await page.waitForFunction(() => /Scanned \d/.test(document.getElementById('msg').textContent), null, { timeout: 60000 });
  const names = await page.$$eval('#file-list .filename', e => e.map(x => x.textContent));
  const badges = [];
  for (let i = 1; i <= 3; i++) badges.push(await rowBadge(page, i));
  const byName = Object.fromEntries(names.map((n, i) => [n.split('_')[0], badges[i]]));
  eq(byName.centred, 'Scanned', 'the hand-set page is left alone and still Scanned');
  eq(await page.$eval('#file-list li:nth-child(' + (names.findIndex(n => /^centred/.test(n)) + 1) + ') img.thumb', i => i.src), before, 'its page was not redone');
  eq(byName.noPage, 'Check the corners', 'a photo with no page is marked "Check the corners"');
  eq(byName.keystone, 'Scanned', 'a keystoned photo is Scanned');
  ok(/Scanned 2 photos\..*1 was not sure/.test(await page.textContent('#msg')), `the message counts them (got "${await page.textContent('#msg')}")`);
  ok(/Check the corners/.test(await page.textContent('#msg')), 'and says what to do');
  // the review strip: the two photos this run did, the unsure one first, each with its quad drawn
  ok(await page.isVisible('#scan-review'), 'the review strip shows after Scan all');
  eq(await page.$$eval('#scan-review .scan-tile', t => t.length), 2, 'the strip holds the two photos this run scanned, not the hand-set one');
  eq(await page.$$eval('#scan-review .scan-tile', t => t.map(x => x.querySelector('.scan-tile-name').textContent.split('_')[0])), ['noPage', 'keystone'], 'the one to check comes first');
  eq(await page.$$eval('#scan-review .scan-tile', t => t.map(x => x.classList.contains('check'))), [true, false], 'only the unsure tile is marked');
  ok(/Check the corners/.test(await page.textContent('#scan-review .scan-tile')), 'its badge says so');
  ok(/1 of 2 needs a look/.test(await page.textContent('#scan-review h3')), 'the heading counts what needs a look');
  const strip = await page.$$eval('#scan-review .scan-tile', t => t.map(x => {
    const poly = x.querySelector('.scan-poly-line'), vb = x.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
    return { n: poly.getAttribute('points').split(' ').length, vb };
  }));
  ok(strip.every(t => t.n === 4 && t.vb[2] > 0 && t.vb[3] > 0), `each tile draws four corners over a viewBox (got ${JSON.stringify(strip)})`);
  { // the keystone tile's polygon is the quad Detect found, in the photo's own pixels (the viewBox says how many)
    const t = await page.$eval('#scan-review li:nth-child(2)', li => ({
      vb: li.querySelector('svg').getAttribute('viewBox').split(' ').map(Number),
      pts: li.querySelector('.scan-poly-line').getAttribute('points').split(' ').map(c => c.split(',').map(Number)) }));
    ok(near(t.pts.map(c => [c[0] / t.vb[2], c[1] / t.vb[3]]), photos.keystone.quad, 1600, 1200, 48), `the polygon is the sheet's corners (got ${JSON.stringify(t)})`);
  }
  await page.click('#scan-review li:nth-child(1) .scan-tile');
  await page.waitForSelector('.scan-dialog[open]');
  ok(true, 'pressing a tile opens the Scan dialog for that photo');
  await page.click('.scan-controls .btn-primary');
  await page.waitForFunction(() => !document.querySelector('.scan-dialog[open]'));
  eq(await page.$eval('#scan-review li:nth-child(1) .scan-badge', b => b.textContent), 'Check the corners', 'Apply with no corner moved leaves the unsure tile flagged');
  ok(await page.isVisible('#scan-review'), 'and the strip is redrawn, not dropped');
  await page.click('#scan-review h3 button');
  ok(await page.isHidden('#scan-review'), 'Hide review closes the strip');
  await page.click('#btn-scan-all');
  await settle(page, 300);
  ok(/scanned already/.test(await page.textContent('#msg')), 'Scan all again has nothing to do and says so');
  eq(page.__workers, 1, 'one Worker served the dialog and the batch');
  eq(page.__errs.length, 0, `no page or console errors: ${JSON.stringify(page.__errs)}`);
  await page.context().close();
}

// ---- 3. a Worker that cannot start falls back to the page's thread ----
{
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await page.addInitScript(() => { window.Worker = function () { throw new Error('no workers here'); }; });
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 100);
  await add(page, ['centred']);
  await openDialog(page);
  ok(near(await quadOf(page), photos.centred.quad, 1600, 1200, 48), 'with no Worker, Detect runs on the page and finds the sheet');
  await page.click('.scan-controls .btn-primary');
  await page.waitForFunction(() => !document.querySelector('.scan-dialog[open]'));
  eq(await rowBadge(page, 1), 'Scanned', 'and Apply works');
  eq(page.__errs.length, 0, `no page or console errors: ${JSON.stringify(page.__errs)}`);
  await page.context().close();
}

// ---- 4. an unreadable photo and an SVG ----
{
  const page = await open();
  await page.setInputFiles('#file-input', [
    { name: 'Broken_Invented.png', mimeType: 'image/png', buffer: Buffer.from('not a png at all') },
    { name: 'Shape_Invented.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>') }]);
  await page.waitForFunction(() => document.querySelectorAll('#file-list li').length === 2);
  eq(await page.$$eval('[data-act="scan"]', b => b.length), 1, 'an SVG has no Scan button');
  await page.click('#file-list li:nth-child(1) [data-act="scan"]');
  await page.waitForFunction(() => /could not be read/.test((document.querySelector('.scan-status') || {}).textContent || ''), null, { timeout: 15000 });
  ok(true, 'an unreadable photo says so in the dialog');
  await page.click('.scan-controls button:has-text("Cancel")');
  await page.waitForFunction(() => !document.querySelector('.scan-dialog[open]'));
  eq(await rowBadge(page, 1), '', 'and is left unscanned');
  await page.context().close();
}

await browser.close();
await new Promise(r => server.close(r));
console.log(failed ? `\nFAIL — ${failed} failed, ${passed} passed` : `\nPASS — ${passed} green`);
process.exit(failed ? 1 : 0);
