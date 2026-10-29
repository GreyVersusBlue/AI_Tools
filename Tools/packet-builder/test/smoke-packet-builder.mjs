// smoke-packet-builder.mjs — 090 Packet Builder, the page (Path 10 P1 step 2).
//
//   node Tools/packet-builder/test/smoke-packet-builder.mjs   (or: npm run test:packet-builder; port 8594)
//
// What this pins:
//   - the page has no print block of its own and links the shared print files
//   - an empty profile: every section greyed, its checkbox off, a link to the tool that fills it in,
//     Print and Preview off, nothing thrown
//   - a seeded profile: the sections turn on, ticking them fills the live preview in the order shown,
//     Down/Up reorder them and the order is saved and survives a reload
//   - Print builds the same pages into #printArea and calls print() once; Chromium's PDF holds one
//     page per packet page
//   - what a source tool saved reaches the page as text, never as markup
//   - presets: a built-in one applies, a saved one stores section ids only, a delete asks first
//   - axe finds nothing serious on the empty page, the seeded page and in dark
//
// print() is stubbed. Nothing here has been checked against a printer. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8594;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '090-packet-builder.html';
const STANDING = 'subPlanBuilder.standingDetails.v1';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const FULL = {
  teacherName: 'Ms. Example', roomNumber: '214', rosterLocation: 'Blue folder', absenceLocation: 'Tray by the door',
  emergencyLocation: 'Red bin', periods: [{ label: '1', time: '8:00-8:50' }, { label: '2', time: '8:55-9:45' }],
  fireRoute: 'Out the east door to the field', lockdownProcedure: 'Lights off, door locked', medicalAlerts: 'None this year',
  phoneNurse: '555-0100', signOffName: 'Ms. E'
};

async function open(browser, { seed = {}, dark = false } = {}) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([seed, dark, first]) => {
    if (!first) return;
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [seed, dark, true]);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
const secs = page => page.evaluate(() => [...document.querySelectorAll('#secList .sec')].map(li => ({
  name: li.querySelector('.name').textContent, off: li.classList.contains('off'),
  checked: li.querySelector('input').checked, disabled: li.querySelector('input').disabled,
  link: li.querySelector('a.setup') ? li.querySelector('a.setup').getAttribute('href') : null,
  up: li.querySelector('button[aria-label$="up"]') ? !li.querySelector('button[aria-label$="up"]').disabled : null,
  down: li.querySelector('button[aria-label$="down"]') ? !li.querySelector('button[aria-label$="down"]').disabled : null
})));
const livePages = page => page.evaluate(() => [...document.querySelectorAll('#live .pb-page')].map(p => p.getAttribute('data-section')));

console.log('090 — Packet Builder');

const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(src), 'has no @media print block of its own');
ok(!/@page/.test(src), 'writes no @page rule of its own');

const server = await serve(PORT);
const browser = await launch();
try {
  // ---- an empty profile ----
  {
    const page = await open(browser);
    const s = await secs(page);
    ok(s.length >= 2, 'the sections are listed');
    ok(s.every(x => x.off && x.disabled && !x.checked), 'empty profile: every section greyed, disabled and unticked');
    ok(s.every(x => x.link && /^044-/.test(x.link)), 'empty profile: each links the tool that fills it in');
    eq(await page.$eval('#printBtn', b => b.disabled), true, 'empty profile: Print is off');
    eq(await page.$eval('#previewBtn', b => b.disabled), true, 'empty profile: Preview is off');
    ok(/Tick a page/.test(await page.$eval('#live', e => e.textContent)), 'empty profile: the preview says what to do');
    const bad = await a11yScan(page);
    ok(bad.length === 0, 'empty page: axe finds nothing serious ' + JSON.stringify(bad));
    await page.close();
  }

  // ---- a seeded profile ----
  for (const dark of [false, true]) {
    const page = await open(browser, { seed: { [STANDING]: FULL }, dark });
    const what = dark ? 'dark' : 'light';
    const s = await secs(page);
    ok(s.every(x => !x.off && !x.disabled && !x.checked), `${what}: both sections are on and unticked at first`);
    await page.check('#secList .sec:nth-child(1) input');
    await page.check('#secList .sec:nth-child(2) input');
    const first = (await secs(page)).map(x => x.name);
    ok((await livePages(page)).length === 2, `${what}: ticking both fills the preview with two pages`);
    const order1 = await livePages(page);
    await page.click('#secList .sec:nth-child(1) button[aria-label$="down"]');
    const order2 = await livePages(page);
    ok(order2.join() === [...order1].reverse().join(), `${what}: Down on the first reverses the pages`);
    ok(await page.evaluate(() => !!document.activeElement.closest('.order')), `${what}: focus stays on a reorder button`);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-packet:layout.v1')));
    ok(stored.v === 1 && stored.ids.join() === order2.join(), `${what}: the order is saved, ids only`);
    ok(!JSON.stringify(stored).includes('Ms. Example'), `${what}: no content is stored with the layout`);
    ok((await page.$eval('#live', e => e.textContent)).includes('Ms. Example'), `${what}: the preview shows the saved teacher name`);
    ok(first.length === 2, `${what}: two rows`);

    await page.click('#printBtn');
    await settle(page, 150);
    eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);
    eq(await page.evaluate(() => document.querySelectorAll('#printArea > .pk-page').length), 2, `${what}: printArea holds one .pk-page per page`);
    eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${what}: the sheet is hidden on screen`);
    await page.emulateMedia({ media: null });
    const pages = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
    eq(pages, 2, `${what}: Chromium's PDF holds two pages`);

    const bad = await a11yScan(page);
    ok(bad.length === 0, `${what}: seeded page, axe finds nothing serious ${JSON.stringify(bad)}`);

    await page.reload({ waitUntil: 'load' });
    await settle(page, 300);
    ok((await livePages(page)).join() === order2.join(), `${what}: the order survives a reload`);
    await page.close();
  }

  // ---- text, never markup ----
  {
    const evil = '<img src=x onerror="window.__x=1">';
    const page = await open(browser, { seed: { [STANDING]: { ...FULL, teacherName: evil, whoToAsk: '<b>Pat</b>' } } });
    await page.check('#secList .sec:nth-child(1) input');
    await page.click('#printBtn');
    await settle(page, 200);
    eq(await page.evaluate(() => document.querySelectorAll('#live img, #printArea img, #live b, #printArea b').length), 0, 'markup in a saved field makes no element');
    eq(await page.evaluate(() => window.__x === 1), false, 'markup in a saved field runs nothing');
    ok((await page.$eval('#live', e => e.textContent)).includes(evil), 'the markup is shown as the text it is');
    await page.close();
  }

  // ---- a broken source key ----
  {
    const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
    await page.addInitScript(([k]) => { localStorage.setItem(k, '{not json'); localStorage.setItem('gvb-packet:layout.v1', '["x"'); }, [STANDING]);
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
    await settle(page, 300);
    ok((await secs(page)).every(x => x.off), 'a broken source key reads as nothing saved');
    eq(errors.length, 0, 'a broken key throws nothing at the page: ' + errors.join('; '));
    await page.close();
  }

  // ---- presets ----
  {
    const page = await open(browser, { seed: { [STANDING]: FULL, 'gvb-packet:layout.v1': { v: 1, ids: ['ghost', 'sub-plan'] } } });
    ok(/ghost/.test(await page.$eval('#layoutMsg', e => e.textContent)), 'an id no section answers to is named and dropped');
    eq((await livePages(page)).join(), 'sub-plan', 'the rest of the saved layout stands');
    await page.selectOption('#presetSelect', 'b:Emergency binder');
    await page.click('#applyPresetBtn');
    eq((await livePages(page)).join(), 'emergency-info,sub-plan', 'the built-in preset sets the pages and their order');
    await page.fill('#presetName', 'My packet');
    await page.click('#savePresetBtn');
    const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-packet:presets.v1')));
    ok(rec.v === 1 && rec.presets.length === 1 && rec.presets[0].name === 'My packet' && rec.presets[0].ids.join() === 'emergency-info,sub-plan', 'a saved preset stores its name and section ids');
    ok(!JSON.stringify(rec).includes('Ms. Example'), 'a saved preset holds no content');
    await page.click('#secList .sec:nth-child(1) input');
    eq((await livePages(page)).length, 1, 'unticking removes a page');
    await page.selectOption('#presetSelect', 's:My packet');
    await page.click('#applyPresetBtn');
    eq((await livePages(page)).length, 2, 'applying the saved preset brings both back');
    eq(await page.$eval('#deletePresetBtn', b => b.disabled), false, 'a saved preset can be deleted');
    page.once('dialog', d => d.dismiss());
    await page.click('#deletePresetBtn');
    eq(await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-packet:presets.v1')).presets.length), 1, 'a delete that is refused keeps the preset');
    page.once('dialog', d => d.accept());
    await page.click('#deletePresetBtn');
    eq(await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-packet:presets.v1')).presets.length), 0, 'an accepted delete removes it');
    await page.selectOption('#presetSelect', 'b:Sub day');
    eq(await page.$eval('#deletePresetBtn', b => b.disabled), true, 'a built-in preset cannot be deleted');
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log('PASS 090');
