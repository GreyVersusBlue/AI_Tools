// smoke-binder-refs.mjs — 044 names the classes whose seating chart and roster the Sub Binder prints
// (rank 144), and names the class a drawn seating chart came from.
//
//   node Tools/sub-plan-builder/test/smoke-binder-refs.mjs   (or: npm run test:sub-plan-binder-refs; port 8661)
//
// What this pins:
//   - the option is off by default and the plan says nothing about the binder until it is ticked
//   - ticked, Important Notes gains one line naming the classes with a seating chart and the classes with a roster,
//     read from the Packet Builder's own providers (the ones 045 prints), in the plain-text copy and in the Word file
//   - only the half that exists is named; with neither saved, no line
//   - the line carries class names only: no student of a roster or a chart reaches the plan
//   - a chart drawn from a saved class carries its name in the plain text and in the Word heading; an attached
//     picture reads exactly as before
//   - the setting is kept across a reload and the page names no key of the seating or roster tools
//
// Nothing here opens the .docx in Word, and the Sub Binder itself is not driven (045 is another page, with its own suites).
// Every name is invented. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8661;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '044-Sub%20Plan%20Builder.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const JSZip = (() => {
  const m = { exports: {} };
  new Function('module', 'exports', fs.readFileSync(path.join(SITE, '_shared', 'vendor', 'jszip', 'jszip.min.js'), 'utf8'))(m, m.exports);
  return m.exports;
})();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const desks = (n, row) => Array.from({ length: n }, (_, i) => ({ id: `d${row}${i}`, x: 100 + i * 140, y: 150 + row * 110, rot: 0, locked: false }));
const CHART = {
  __v: 1, active: 'p1', numbered: false, mirror: false,
  sections: [
    { id: 'p1', name: 'Period 2 Geography', students: [{ id: 's0', name: 'Ann Example' }], desks: [...desks(3, 0), ...desks(3, 1)], assign: { d00: 's0' } },
    { id: 'p3', name: 'Period 5 Art', students: [], desks: desks(2, 0), assign: {} },
    { id: 'p2', name: 'Empty room', students: [], desks: [], assign: {} },
  ]
};
const ROSTERS = { 'Period 2 Geography': ['Ann Example', 'Bo Example'], 'Period 6 Math': ['Cy Example'] };
const NOTE = /The Sub Binder prints [^\n]*/;

async function open(browser, seed) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 1000 });
  page.on('dialog', d => d.accept());
  await page.addInitScript(([seed]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  }, [seed]);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 400);
  await page.fill('#planDate', '2026-11-02');
  return page;
}

async function build(page) {
  await page.click('#btnGenerate');
  await page.waitForFunction(() => document.getElementById('downloadArea').style.display === 'block', null, { timeout: 15000 });
  const b64 = await page.evaluate(async () => {
    const buf = new Uint8Array(await (await fetch(document.getElementById('downloadLink').href)).arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  });
  const zip = await JSZip.loadAsync(Buffer.from(b64, 'base64'));
  const docx = (await zip.file('word/document.xml').async('string')).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  await page.click('#btnQuickCopy');
  await page.waitForSelector('#qcText');
  const text = await page.inputValue('#qcText');
  await page.click('#qcClose');
  return { docx, text };
}

const src = fs.readFileSync(path.join(SITE, 'Tools', decodeURIComponent(FILE)), 'utf8');
ok(!/seating-chart-v1|np_rosters|crh_students_v1/.test(src), '044 names no key of the seating or roster tools');

console.log('044 — the Sub Binder named in the plan');
const server = await serve(PORT);
const browser = await launch();
try {
  {
    const page = await open(browser, { 'seating-chart-v1': CHART, np_rosters: ROSTERS });
    eq(await page.isChecked('#binderRefs'), false, 'the option is off by default');
    eq(await page.textContent('#binderRefsNote'), 'Seating charts: Period 2 Geography, Period 5 Art. Rosters: Period 2 Geography, Period 6 Math', 'and lists what the binder could name (an empty room is not a chart)');
    const off = await build(page);
    ok(!NOTE.test(off.text) && !NOTE.test(off.docx), 'unticked, neither the text nor the Word file mentions the binder');
    await page.check('#binderRefs');
    const on = await build(page);
    const want = 'The Sub Binder prints seating charts for Period 2 Geography and Period 5 Art, and class rosters for Period 2 Geography and Period 6 Math.';
    ok(on.text.includes(want), 'ticked, the plain text names them in Important Notes');
    ok(on.docx.includes(want), 'and so does the Word file');
    ok(!/Example/.test(on.text) && !/Example/.test(on.docx), 'no student of a chart or a roster reaches the plan');
    await page.waitForFunction(() => /Saved/.test(document.querySelector('.saved, [class*=save]')?.textContent || '') || JSON.parse(localStorage.getItem('subPlanBuilder.standingDetails.v1') || '{}').binderRefs === true);
    await page.reload({ waitUntil: 'load' });
    await settle(page, 400);
    eq(await page.isChecked('#binderRefs'), true, 'the option is kept across a reload');
    await page.close();
  }
  {
    const page = await open(browser, { 'seating-chart-v1': CHART, subPlanBuilder_x: {}, 'subPlanBuilder.standingDetails.v1': { binderRefs: true } });
    const t = (await build(page)).text;
    ok(t.includes('The Sub Binder prints seating charts for Period 2 Geography and Period 5 Art.') && !/class rosters/.test(t), 'with only charts saved, only charts are named');
    await page.close();
  }
  {
    const page = await open(browser, { 'subPlanBuilder.standingDetails.v1': { binderRefs: true } });
    const b = await build(page);
    ok(!NOTE.test(b.text) && !NOTE.test(b.docx), 'with nothing saved, no line');
    eq(await page.textContent('#binderRefsNote'), 'No seating chart or roster is saved yet, so there is nothing to name.', 'and the page says why');
    await page.close();
  }
  {
    const page = await open(browser, { 'seating-chart-v1': CHART });
    await page.selectOption('#seatingChartPick', { label: 'Period 5 Art' });
    await page.click('#seatingChartPullBtn');
    await page.waitForFunction(() => /Drawn from/.test(document.getElementById('seatingChartStatus').textContent));
    await page.setViewportSize({ width: 360, height: 800 });
    await settle(page, 200);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= 361), 'at 360 px the page does not scroll sideways');
    await page.setViewportSize({ width: 1100, height: 1000 });
    const drawn = await build(page);
    ok(drawn.text.includes('Seating chart (Period 5 Art): attached'), 'a drawn chart names its class in the plain text');
    ok(drawn.docx.includes('Seating Chart — Period 5 Art'), 'and in the Word heading');
    await page.setInputFiles('#seatingChartFile', { name: 'room.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForFunction(() => !/Drawn from/.test(document.getElementById('seatingChartStatus').textContent));
    const attached = await build(page);
    ok(attached.text.includes('Seating chart: attached') && !/Seating chart \(/.test(attached.text), 'an attached picture reads as before, with no class');
    ok(/Seating Chart/.test(attached.docx) && !/Seating Chart —/.test(attached.docx), 'and its heading has no class');
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
