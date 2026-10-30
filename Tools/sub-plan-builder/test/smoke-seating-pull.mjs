// smoke-seating-pull.mjs — 044 Sub Plan Builder draws the room from the saved seating chart (Path 10 P4, increment 1).
//
//   node Tools/sub-plan-builder/test/smoke-seating-pull.mjs   (or: npm run test:sub-plan-seating; port 8598)
//
// What this pins:
//   - no saved chart: the control stays hidden and attaching an image still works as before
//   - a saved chart: the control lists the classes that have a desk (none with no desk), choosing one draws
//     the room into the same PNG an attached file becomes, with the class named in the status line
//   - the image is the chart's: its width and height follow the room's shape, it is white-backed and not blank
//   - the image is never saved (nothing of it in localStorage) and Remove clears it
//   - the Word file the page makes for that plan embeds the picture
//   - the page names no key of the seating tool
//   - axe finds nothing serious with the control showing
//
// Nothing here opens the .docx in Word. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8598;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '044-Sub%20Plan%20Builder.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const desks = (n, row) => Array.from({ length: n }, (_, i) => ({ id: `d${row}${i}`, x: 100 + i * 140, y: 150 + row * 110, rot: 0, locked: false }));
const CHART = {
  __v: 1, active: 'p1', numbered: false, mirror: false,
  sections: [
    { id: 'p1', name: 'Period 2 Geography', students: [{ id: 's0', name: 'Ann Example' }, { id: 's1', name: 'Bo Example' }], desks: [...desks(3, 0), ...desks(3, 1)], assign: { d00: 's0', d01: 's1' } },
    { id: 'p2', name: 'Empty room', students: [], desks: [], assign: {} },
    { id: 'p3', name: 'Period 5 <b>Art</b>', students: [], desks: desks(2, 0), assign: {} },
  ]
};

const src = fs.readFileSync(path.join(SITE, 'Tools', decodeURIComponent(FILE)), 'utf8');
ok(!/seating-chart-v1/.test(src), '044 names no key of the seating tool');

async function open(browser, seed) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 1000 });
  await page.addInitScript(([seed]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  }, [seed]);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 400);
  return page;
}

console.log('044 — seating chart pulled from 005');
const server = await serve(PORT);
const browser = await launch();
try {
  {
    const page = await open(browser, {});
    eq(await page.$eval('#seatingChartPullRow', e => e.hidden), true, 'no chart saved: the control is hidden');
    eq(await page.$eval('#seatingChartStatus', e => e.textContent), 'No image attached.', 'no chart saved: the attach line is as before');
    ok(await page.isVisible('#seatingChartPickBtn'), 'no chart saved: Attach image is still there');
    await page.close();
  }
  {
    const page = await open(browser, { 'seating-chart-v1': CHART });
    eq(await page.$eval('#seatingChartPullRow', e => e.hidden), false, 'a chart is saved: the control shows');
    const names = await page.$$eval('#seatingChartPick option', os => os.map(o => o.textContent));
    eq(JSON.stringify(names), JSON.stringify(['Period 2 Geography', 'Period 5 <b>Art</b>']), 'only classes with a desk are listed, and a name is text, not markup');
    eq(await page.$$eval('#seatingChartPick b', b => b.length), 0, 'a class name with markup in it makes no element');
    const bad = await a11yScan(page);
    ok(bad.length === 0, 'axe finds nothing serious with the control showing ' + JSON.stringify(bad));

    await page.click('#seatingChartPullBtn');
    await page.waitForFunction(() => /Drawn from your saved seating chart/.test(document.getElementById('seatingChartStatus').textContent));
    const status = await page.$eval('#seatingChartStatus', e => e.textContent);
    ok(/Period 2 Geography/.test(status), 'the status names the class: ' + status);
    const img = await page.$eval('#seatingChartPreview', e => ({ src: e.src.slice(0, 22), shown: getComputedStyle(e).display !== 'none' }));
    eq(img.src, 'data:image/png;base64,', 'the picture is a PNG data URL');
    ok(img.shown, 'and it is shown');
    const px = await page.evaluate(() => new Promise(res => {
      const i = new Image();
      i.onload = () => {
        const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
        const g = c.getContext('2d'); g.drawImage(i, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let dark = 0, light = 0;
        for (let k = 0; k < d.length; k += 4) { if (d[k] < 100 && d[k + 3] > 200) dark++; if (d[k] > 250 && d[k + 3] > 200) light++; }
        res({ w: i.width, h: i.height, dark, light, corner: Array.from(d.slice(0, 4)).join() });
      };
      i.src = document.getElementById('seatingChartPreview').src;
    }));
    ok(Math.max(px.w, px.h) === 900, `the longest side is 900 px (got ${px.w}x${px.h})`);
    ok(px.dark > 200, `the drawing has ink in it (${px.dark} dark pixels)`);
    eq(px.corner, '255,255,255,255', 'and a white ground, not a transparent one');
    const saved = await page.evaluate(() => Object.keys(localStorage).filter(k => /data:image|iVBOR/.test(localStorage.getItem(k) || '')));
    eq(saved.length, 0, 'the picture is saved nowhere');

    await page.click('#seatingChartRemoveBtn');
    eq(await page.$eval('#seatingChartStatus', e => e.textContent), 'No image attached.', 'Remove clears it');

    // the Word file embeds it, and holds no picture without it
    const docx = async () => {
      await page.click('#btnGenerate');
      await page.waitForSelector('#btnDownload', { state: 'visible', timeout: 20000 });
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#btnDownload')]);
      return fs.readFileSync(await dl.path()).toString('latin1');
    };
    await page.fill('#teacherName', 'Ms. Example');
    ok(!/word\/media\//.test(await docx()), 'with the image removed the .docx holds no picture');
    await page.click('#seatingChartPullBtn');
    await page.waitForFunction(() => /Drawn from/.test(document.getElementById('seatingChartStatus').textContent));
    const zipText = await docx();
    ok(/word\/media\/[^\0]*\.png/.test(zipText), 'the .docx holds a PNG for the seating chart');
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log('PASS 044 seating pull');
