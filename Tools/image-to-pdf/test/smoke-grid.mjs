// smoke-grid.mjs — 011 Image -> PDF, Path 17 P1: the queue's thumbnail view.
//
//   node Tools/image-to-pdf/test/smoke-grid.mjs     (npm run test:image-to-pdf-grid)
//
// The grid is the same <li>s with a class on the <ul>, so every row action must work in it
// unchanged. Made-up names; the photo is the scan suite's synthetic fixture. No network.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { fixture, toPng } from './make-scan-fixtures.mjs';

const PORT = 8701;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '011-image-to-pdf.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('011 — queue thumbnail view');
const buf = toPng(fixture('centred').imageData);
const server = await serve(PORT);
const browser = await launch();
const names = page => page.$$eval('#file-list .filename', n => n.map(x => x.textContent));
const open = async (width = 1100) => {
  const page = await prepPage(browser, BASE, { width, height: 900 });
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 100);
  await page.setInputFiles('#file-input', ['1_Alpha', '2_Beta', '3_Gamma', '4_Delta'].map(n => ({ name: n + '.png', mimeType: 'image/png', buffer: buf })));
  await page.waitForFunction(() => document.querySelectorAll('#file-list li').length === 4);
  await settle(page, 100);
  return page;
};
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('image-to-pdf-settings') || '{}'));

{
  const page = await open();
  eq(await page.getAttribute('#view-list', 'aria-pressed'), 'true', 'the list is the default view');
  ok(!(await page.evaluate(() => document.getElementById('file-list').classList.contains('grid'))), 'no grid class at rest');
  eq((await stored(page)).view, undefined, 'a default view stores nothing');
  await page.click('#view-grid');
  ok(await page.evaluate(() => document.getElementById('file-list').classList.contains('grid')), 'Thumbnails turns the grid on');
  eq(await page.getAttribute('#view-grid', 'aria-pressed'), 'true', 'and presses its button');
  eq((await stored(page)).view, 'grid', 'the choice is a stored habit');
  eq(await names(page), ['1_Alpha.png', '2_Beta.png', '3_Gamma.png', '4_Delta.png'], 'the four tiles are in order');
  const cols = await page.evaluate(() => new Set([...document.querySelectorAll('#file-list li')].map(l => Math.round(l.getBoundingClientRect().top))).size);
  ok(cols < 4, `tiles sit side by side, not one per row (${cols} distinct rows)`);
  eq(await page.getAttribute('#file-list li:nth-child(2) [data-act="down"]', 'aria-label'), 'Move 2_Beta.png later', 'the arrows are named earlier/later in the grid');

  await page.click('#file-list li:nth-child(2) [data-act="down"]');
  eq(await names(page), ['1_Alpha.png', '3_Gamma.png', '2_Beta.png', '4_Delta.png'], 'later moves a tile one place on');
  eq(await page.$eval('#sort-custom', r => r.checked), true, 'and switches to the custom order');
  await page.click('#file-list li:nth-child(1) [data-act="rotate"]');
  ok(/rotate\(90deg\)/.test(await page.getAttribute('#file-list li:nth-child(1) .thumb', 'style')), 'rotate turns the thumbnail');
  await page.click('#file-list li:nth-child(4) [data-act="remove"]');
  eq(await names(page), ['1_Alpha.png', '3_Gamma.png', '2_Beta.png'], 'remove deletes a tile');
  await page.fill('#file-list li:nth-child(1) .caption-input', 'Cover');
  eq(await page.inputValue('#file-list li:nth-child(1) .caption-input'), 'Cover', 'a caption can be typed on a tile');

  // drag one tile onto another
  await page.dragAndDrop('#file-list li:nth-child(3)', '#file-list li:nth-child(1)');
  eq((await names(page))[0], '2_Beta.png', 'dragging a tile onto another puts it there');

  const widths = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  ok(widths.s <= widths.c, 'no sideways scroll at 1100 px');
  const v = await a11yScan(page, { impact: ['serious', 'critical'] });
  eq(v.length, 0, 'no serious a11y violations in the grid: ' + JSON.stringify(v.map(x => x.id)));
  await page.click('#view-list');
  eq((await stored(page)).view, undefined, 'back to the list stores nothing again');
  eq(await page.getAttribute('#file-list li:nth-child(1) [data-act="down"]', 'aria-label'), 'Move 2_Beta.png down', 'and the arrows say up and down');
  await page.context().close();
}
{
  // the habit survives a reload
  const page = await open();
  await page.click('#view-grid');
  await page.reload({ waitUntil: 'load' });
  await settle(page, 100);
  eq(await page.getAttribute('#view-grid', 'aria-pressed'), 'true', 'a reload keeps the grid');
  await page.context().close();
}
{
  const page = await open(375);
  await page.click('#view-grid');
  const w = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  ok(w.s <= w.c, `no sideways scroll at 375 px (${w.s} vs ${w.c})`);
  const small = await page.evaluate(() => [...document.querySelectorAll('#file-list li:first-child button')].filter(b => { const r = b.getBoundingClientRect(); return r.width < 36 || r.height < 36; }).length);
  eq(small, 0, 'tile buttons are at least 36 px at 375 px');
  await page.context().close();
}

await browser.close();
await new Promise(r => server.close(r));
console.log(failed ? `\nFAIL — ${failed} failed, ${passed} passed` : `\nPASS — ${passed} green`);
process.exit(failed ? 1 : 0);
