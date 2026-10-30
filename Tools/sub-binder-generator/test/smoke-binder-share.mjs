// smoke-binder-share.mjs — 045 Sub Binder's share sheet (Path 6 P3, the last tool; Path 10 P2).
//
//   node Tools/sub-binder-generator/test/smoke-binder-share.mjs   (or: npm run test:sub-binder-share; port 8596)
//
// This is its own suite, not a row in smoke-share-rollout.mjs, because that table assumes one JSON
// document under one storage key and 045 has two small keys of its own and a recipe payload. The
// claims are the rollout's: the four share scripts in dependency order, a Share button whose sheet
// has Copy link, a link that carries what the page says it carries and no more, an arrival that asks
// before replacing and keeps the local copy on "no", and a parameter that is consumed on open.
//
// THE LINK IS THE RECIPE: the ticked sections and the note to the sub. A profile that has standing
// details, a seating chart with names, hall pass rules and a calendar must put none of them in it.
//
// Clipboard and print() are stubbed. No real phone has scanned the QR row. Exits 1 on any failure.

if (!process.env.TZ) process.env.TZ = 'America/New_York';

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8596;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = `${BASE}/Tools/045-sub-binder-generator.html`;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const PRIVATE = {
  'subPlanBuilder.standingDetails.v1': { teacherName: 'Ms. Exampleton', roomNumber: '214', fireRoute: 'Out the east door', periods: [{ _id: 'p1', label: '1', time: '8:00' }] },
  'seating-chart-v1': { sections: [{ id: 's1', name: 'Period 1', students: [{ id: 'a', name: 'Ada Lovelace', note: 'allergy to peanuts' }], desks: [{ id: 'd1', x: 1, y: 1, rot: 0 }], assign: { d1: 'a' } }] },
  'hall-pass-log-sections': { sets: { 'Period 1': { destinations: [{ label: 'Restroom', overtimeMin: 5 }] } } },
  'behavior-points-tracker-sections': { sets: { A: { tags: [{ label: 'On task', delta: 1 }] } } },
  'gvb-exit-ticket:customPrompts': [{ text: 'Name one thing you learned' }],
  'subPlanBuilder.history.v1': [{ date: '2026-10-29', lessonTitle: 'Fall of Rome' }], 'subPlanBuilder.lastAbsence.v1': { dates: ['2026-10-29'] },
  snfs_slip_v1: { prompts: [{ text: 'Who stayed late?' }] }
};
const NOTE = 'Bring the blue folder <b>please</b> & thanks';

const shareLink = async p => {
  await p.click('#shareBtn');
  await settle(p, 250);
  return p.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { captured = t; return Promise.resolve(); } } });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
  });
};

async function open(browser, url, { seed = {}, raw = {}, dialogs } = {}) {
  const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00'));
  if (dialogs) page.on('dialog', async d => { dialogs.push(d.message()); await (dialogs.accept ? d.accept() : d.dismiss()); });
  await page.addInitScript(([seed, raw]) => {
    window.print = () => {};
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
    for (const [k, v] of Object.entries(raw)) localStorage.setItem(k, v);
  }, [seed, raw]);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.errors = errors;
  await page.goto(url, { waitUntil: 'load' });
  await settle(page, 400);
  return page;
}
const ticks = page => page.evaluate(() => [...document.querySelectorAll('#sectionChecklist input[data-section]')].map(b => b.getAttribute('data-section') + ':' + (b.checked ? 1 : 0) + (b.disabled ? 'd' : '')).join());

console.log('045 — Sub Binder share sheet');

// ---- static ----
const src = fs.readFileSync(path.join(SITE, 'Tools', '045-sub-binder-generator.html'), 'utf8');
const ORDER = ['_shared/state-link.js', '_shared/vendor/qrcode/qrcode.js', '_shared/qr-draw.js', '_shared/share.js'];
const at = ORDER.map(s => src.indexOf(`src="../${s}"`));
ok(at.every(i => i !== -1) && at.every((v, i) => i === 0 || v > at[i - 1]), 'loads the four share scripts in dependency order: ' + JSON.stringify(at));
ok(/id="shareBtn"/.test(src) && /id="shareNote"/.test(src), 'has a Share button and a note line');

const server = await serve(PORT);
const browser = await launch();
try {
  // ---- the sender ----
  const sender = await open(browser, PAGE, { seed: PRIVATE, raw: { 'gvb-sub-binder:today-lesson': NOTE } });
  await sender.uncheck('#sectionChecklist input[data-section="behavior"]');
  await sender.uncheck('#sectionChecklist input[data-section="hallpass"]');
  const rows0 = await (async () => { await sender.click('#shareBtn'); await settle(sender, 250); const r = await sender.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share'))); await sender.evaluate(() => window.Share.close()); return r; })();
  ok(rows0.includes('copy') && rows0.includes('qr') && rows0.includes('download'), 'the sheet offers Copy link, QR code and Download: ' + rows0.join());
  const url = await shareLink(sender);
  ok(url && url.includes('binder='), 'Copy link produces a ?binder= link');
  const payload = await sender.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('binder')), url);
  eq(payload.v, 1, 'the payload is version 1');
  ok(payload.included && payload.included.behavior === false && payload.included.hallpass === false && payload.included.emergency === true, 'it carries the ticked sections, ticked or not');
  eq(payload.lesson, NOTE, 'and the note to the sub as typed');
  const whole = JSON.stringify(payload);
  for (const leak of ['Exampleton', 'Ada Lovelace', 'peanuts', 'Restroom', 'east door', 'Fall of Rome', 'Name one thing', 'Who stayed late', 'On task']) ok(!whole.includes(leak), `no "${leak}" in the payload`);
  ok(Object.keys(payload).sort().join() === 'included,lesson,v', 'only included, lesson and v are in it: ' + Object.keys(payload).join());
  eq(sender.errors.length, 0, 'the sender throws nothing: ' + sender.errors.join('; '));
  await sender.close();

  // ---- a fresh receiver: no work to lose, so no question ----
  {
    const dialogs = [];
    const r = await open(browser, url, { seed: { 'subPlanBuilder.standingDetails.v1': PRIVATE['subPlanBuilder.standingDetails.v1'], 'hall-pass-log-sections': PRIVATE['hall-pass-log-sections'] }, dialogs });
    eq(dialogs.length, 0, 'a device with nothing of the binder\'s own saved is not asked');
    const t = await ticks(r);
    ok(/behavior:0d/.test(t) || /behavior:0/.test(t), 'the shared untick of behavior arrived (or the section is greyed here): ' + t);
    ok(/hallpass:0/.test(t), 'the shared untick of hall pass arrived: ' + t);
    eq(await r.inputValue('#lessonInput'), NOTE, 'the note arrived in the box, as text');
    eq(await r.evaluate(() => document.querySelectorAll('#lessonInput ~ b, #shareNote b').length), 0, 'markup in the note makes no element');
    ok(/Loaded a shared binder/.test(await r.textContent('#shareNote')), 'and it says what it did: ' + JSON.stringify(await r.textContent('#shareNote')));
    eq(new URL(r.url()).searchParams.get('binder'), null, 'the parameter is consumed on open');
    eq(await r.evaluate(() => localStorage.getItem('gvb-sub-binder:today-lesson')), NOTE, 'the note is saved on the device');
    ok(/"hallpass":false/.test(await r.evaluate(() => localStorage.getItem('gvb-sub-binder:included-sections.v1'))), 'the ticks are saved on the device');
    // its own data is its own: nothing of the sender's reached this device
    eq(await r.evaluate(() => localStorage.getItem('seating-chart-v1')), null, 'no seating chart appeared on the receiver');
    // printing uses the receiver's tools, not the sender's
    await r.click('#printBtn');
    const printed = await r.$eval('#printArea', e => e.innerHTML);
    ok(printed.includes('Ms. Exampleton') && printed.includes('Bring the blue folder'), 'the receiver prints its own standing details with the shared note');
    eq(r.errors.length, 0, 'the receiver throws nothing: ' + r.errors.join('; '));
    await r.close();
  }

  // ---- a receiver that has its own ticks and note: asked, and "no" keeps them ----
  {
    const dialogs = [];
    const local = { 'gvb-sub-binder:included-sections.v1': JSON.stringify({ seating: false }), 'gvb-sub-binder:today-lesson': 'My own note' };
    const r = await open(browser, url, { raw: local, dialogs });
    eq(dialogs.length, 1, 'a device with its own ticks and note is asked once');
    ok(/Replace the ticked sections/.test(dialogs[0] || ''), 'the question says what is replaced: ' + dialogs[0]);
    eq(await r.inputValue('#lessonInput'), 'My own note', 'declining keeps the local note');
    eq(await r.evaluate(() => JSON.parse(localStorage.getItem('gvb-sub-binder:included-sections.v1')).seating), false, 'and the local ticks');
    ok(/Kept the sections and note already on this device/.test(await r.textContent('#shareNote')), 'and says so');
    await r.reload({ waitUntil: 'load' });
    await settle(r, 300);
    eq(await r.inputValue('#lessonInput'), 'My own note', 'a refresh does not ask again or import it');
    await r.close();

    const yes = [];
    yes.accept = true;
    const r2 = await open(browser, url, { raw: local, dialogs: yes });
    eq(await r2.inputValue('#lessonInput'), NOTE, 'accepting replaces the note');
    eq(await r2.evaluate(() => JSON.parse(localStorage.getItem('gvb-sub-binder:included-sections.v1')).seating), true, 'and the ticks become the link\'s (seating was off here, on in the link)');
    await r2.close();
  }

  // ---- bad links ----
  {
    const bad = await open(browser, PAGE + '?binder=%00%00notastate', {});
    ok(/./.test(await bad.textContent('#shareNote')), 'a link that is not a binder says so: ' + JSON.stringify(await bad.textContent('#shareNote')));
    eq(bad.errors.length, 0, 'and throws nothing');
    await bad.close();
    const evil = await sender_link(browser, { v: 1, included: { emergency: 'yes', bogus: false, hallpass: false }, lesson: 'x'.repeat(5000) });
    const r = await open(browser, evil, {});
    const t = await ticks(r);
    ok(/hallpass:0/.test(t), 'a boolean tick is taken: ' + t);
    ok(!/bogus/.test(await r.evaluate(() => localStorage.getItem('gvb-sub-binder:included-sections.v1') || '')), 'an unknown section name is not stored');
    eq((await r.inputValue('#lessonInput')).length, 4000, 'a note over 4000 characters is cut to 4000');
    await r.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

// A link carrying `state`, made by the page's own encoder.
async function sender_link(browser, state) {
  const p = await prepPage(browser, BASE, { width: 800, height: 600 });
  await p.goto(PAGE, { waitUntil: 'load' });
  const url = await p.evaluate(s => location.origin + location.pathname + '?binder=' + window.StateLink.encodeState(s), state);
  await p.close();
  return url;
}
