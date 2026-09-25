// smoke-widgets.mjs — 087 Class Screen's Path 22 P2 widgets in a real browser.
//
//   node Tools/class-screen/test/smoke-widgets.mjs
//
// Work symbols, the noise meter (on Chromium's fake microphone, which plays a
// steady tone, so the meter must rise and a low limit must trip "Too loud"),
// drawing by mouse, a picture stored in IndexedDB and never in localStorage,
// a QR code that decodes back to its text through the vendored jsQR, the
// group maker on a seeded roster, and board backgrounds including a picture.
// Every name here is invented. Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook (jsQR, injected below, is already a lint global) */
import fs from 'node:fs';
import zlib from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', '..', '..');
const PORT = 8443;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/087-class-screen.html';
const ROSTER = { 'Period 2': ['Ada Finch', 'Bo Larkin', 'Cy Moreau', 'Dee Okafor', 'Eli Pruitt', 'Fen Quist', 'Gil Rowe', 'Hana Sato', 'Ivo Tamm', 'Jo Underhill'] };

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// A 64×48 PNG, built here with zlib so the suite needs no fixture file.
function tinyPng() {
  const W = 64, H = 48;
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(tb));
    return Buffer.concat([len, tb, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < H; y++) {
    const row = Buffer.alloc(1 + W * 3);
    for (let x = 0; x < W; x++) { const top = y < H / 2; row[1 + x * 3] = top ? 46 : 200; row[2 + x * 3] = top ? 107 : 80; row[3 + x * 3] = top ? 143 : 60; }
    rows.push(row);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

// Chromium's default fake microphone is SILENT in headless (measured: peak 0),
// so a meter that works would still read zero. It is fed a 440 Hz tone
// instead, written here as a 2-second 16-bit WAV that Chromium loops.
function toneWav() {
  const rate = 48000, n = rate * 2;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / rate)), 44 + i * 2);
  const file = path.join(os.tmpdir(), 'class-screen-tone-' + process.pid + '.wav');
  fs.writeFileSync(file, buf);
  return file;
}
const TONE = toneWav();

const server = await serve(PORT);
const browser = await launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=' + TONE] });
const page = await prepPage(browser, BASE, { width: 1400, height: 900, permissions: ['microphone'] });
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (page.__promptAnswer ?? d.defaultValue()) : undefined));

console.log('Class Screen — P2 widgets');

await page.goto(URL_PAGE);
await page.evaluate(([r]) => { localStorage.clear(); localStorage.setItem('np_rosters', JSON.stringify(r)); }, [ROSTER]);
await page.reload();
await settle(page);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const data = async (type) => (await cur()).widgets.find((w) => w.type === type).data;
const widget = (type) => page.locator(`#board .w[data-type="${type}"]`);
const add = async (type) => { await page.click(`#dock button[data-add="${type}"]`); await settle(page, 150); };

// ── work symbols ─────────────────────────────────────────────────────
await add('symbols');
eq(await widget('symbols').locator('.sym-label').textContent(), 'Silent', 'symbol starts on Silent');
await widget('symbols').getByLabel('Choose a symbol').selectOption('partner');
eq(await widget('symbols').locator('.sym-label').textContent(), 'Partner talk', 'symbol changes');
eq(await widget('symbols').locator('.sym').getAttribute('aria-label'), 'Partner talk: Talk with one partner', 'symbol has a text alternative');
await settle(page, 400);
eq((await data('symbols')).mode, 'partner', 'symbol saved');
ok(await widget('symbols').evaluate((n) => n.classList.contains('wt-symbols') && !n.classList.contains('w-symbols')), 'frame class is wt-<type>');

// ── noise meter ──────────────────────────────────────────────────────
await add('noise');
const noise = widget('noise');
eq(await noise.locator('.noise-word').textContent(), 'Off', 'meter is off until Start');
await noise.getByRole('button', { name: 'Start' }).click();
await page.waitForFunction(() => +document.querySelector('.w[data-type="noise"] [role="meter"]').getAttribute('aria-valuenow') > 0, null, { timeout: 6000 }).catch(() => {});
const lvl = +(await noise.locator('[role="meter"]').getAttribute('aria-valuenow'));
ok(lvl > 0, `the fake microphone's tone moves the meter (${lvl})`);
await noise.getByLabel('Limit').fill('10');
await page.waitForFunction(() => document.querySelector('.w[data-type="noise"]').classList.contains('noise-loud'), null, { timeout: 5000 }).catch(() => {});
ok(await noise.evaluate((n) => n.classList.contains('noise-loud')), 'over the limit for a moment flags Too loud');
eq(await noise.locator('.noise-word').textContent(), 'Too loud!', 'and says so');
await settle(page, 400);
eq((await data('noise')).limit, 10, 'limit saved');
await noise.getByRole('button', { name: 'Stop' }).click();
eq(await noise.locator('.noise-word').textContent(), 'Off', 'Stop turns the meter off');
ok(!(await noise.evaluate((n) => n.classList.contains('noise-loud'))), 'and clears the alarm');

// ── drawing ──────────────────────────────────────────────────────────
await add('draw');
const canvas = widget('draw').locator('canvas');
const cb = await canvas.boundingBox();
await page.mouse.move(cb.x + cb.width * 0.2, cb.y + cb.height * 0.2);
await page.mouse.down();
await page.mouse.move(cb.x + cb.width * 0.8, cb.y + cb.height * 0.7, { steps: 8 });
await page.mouse.up();
await widget('draw').getByRole('button', { name: 'Red pen' }).click();
await page.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.1);
await page.mouse.down();
await page.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.9, { steps: 5 });
await page.mouse.up();
await settle(page, 400);
let strokes = (await data('draw')).strokes;
eq(strokes.length, 2, 'two strokes saved');
eq(strokes.map((s) => s.c), ['ink', 'red'], 'with their pens');
ok(strokes[0].p.every((v) => v >= 0 && v <= 1), 'points are fractions of the widget');
const inked = await canvas.evaluate((c) => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n;
});
ok(inked > 200, `the strokes are painted (${inked} px)`);
await widget('draw').getByRole('button', { name: 'Undo' }).click();
await settle(page, 400);
eq((await data('draw')).strokes.length, 1, 'undo removes the last stroke');

// ── picture ──────────────────────────────────────────────────────────
await add('image');
const pic = widget('image');
await pic.locator('input[type="file"]').setInputFiles({ name: 'seating-map.png', mimeType: 'image/png', buffer: tinyPng() });
await page.waitForSelector('.w[data-type="image"] img.pic', { timeout: 5000 }).catch(() => {});
ok(await pic.locator('img.pic').isVisible(), 'picture shows');
const imgData = await data('image');
ok(/^img/.test(imgData.mediaId), `a media id is saved (${imgData.mediaId})`);
eq(imgData.alt, 'seating-map', 'alt starts from the file name');
const lsSize = await page.evaluate(() => JSON.stringify(localStorage).length);
ok(lsSize < 20000, `the picture is not in localStorage (${lsSize} chars)`);
const idbCount = await page.evaluate(() => MediaDB.store({ ns: 'class-screen' }).list().then((r) => r.length));
eq(idbCount, 1, 'one record in IndexedDB');
await pic.getByLabel('Picture fit').selectOption('cover');
ok(await pic.locator('img.pic.cover').isVisible(), 'fill mode applies');
page.__promptAnswer = 'Map of the room';
await pic.getByRole('button', { name: 'Describe' }).click();
eq(await pic.locator('img.pic').getAttribute('alt'), 'Map of the room', 'alt can be edited');
page.__promptAnswer = undefined;

// ── QR ───────────────────────────────────────────────────────────────
await add('qr');
const qr = widget('qr');
const LINK = 'https://example.org/lesson/42';
await qr.getByLabel('Link or text').fill(LINK);
await qr.getByRole('button', { name: 'Show code' }).click();
await settle(page, 300);
ok(await qr.locator('canvas').isVisible(), 'QR is drawn');
await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, '_shared', 'vendor', 'jsqr', 'jsqr.js'), 'utf8') });
const decoded = await qr.locator('canvas').evaluate((c) => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const r = jsQR(d.data, d.width, d.height);
  return r ? r.data : null;
});
eq(decoded, LINK, 'the code decodes back to the link');
eq(await qr.locator('.qr-caption').textContent(), LINK, 'caption shows the link');
await qr.getByRole('button', { name: 'Change' }).click();
await qr.getByLabel('Link or text').fill('x'.repeat(480));
await qr.getByRole('button', { name: 'Show code' }).click();
await settle(page, 300);
ok(await qr.locator('.err-note').isVisible(), 'a code too dense for the widget explains itself');
ok(/bigger or the text shorter/.test(await qr.locator('.err-note').textContent()), 'with advice that fits this page');

// ── group maker ──────────────────────────────────────────────────────
await add('groups');
const gm = widget('groups');
eq(await gm.getByLabel('Class roster').inputValue(), 'Period 2', 'roster picked up');
await gm.getByLabel('How many').selectOption('4');
await gm.getByRole('button', { name: 'Make groups' }).click();
eq(await gm.locator('.group').count(), 3, 'ten in fours makes three groups');
const members = await gm.locator('.group li').allTextContents();
eq([...members].sort(), [...ROSTER['Period 2']].sort(), 'everyone is in exactly one group');
await gm.getByLabel('Group by').selectOption('count');
await gm.getByLabel('How many').selectOption('5');
await gm.getByRole('button', { name: 'Make groups' }).click();
eq(await gm.locator('.group').count(), 5, 'five groups on request');
await settle(page, 400);
eq(await data('groups'), { roster: 'Period 2', by: 'count', n: 5 }, 'only the settings are saved, never the groups');

// ── backgrounds ──────────────────────────────────────────────────────
await page.selectOption('#bgSelect', 'grid');
eq(await page.locator('#board').getAttribute('data-bg'), 'grid', 'grid background applies');
eq((await cur()).bg, 'grid', 'background saved');
const gridImg = await page.locator('#board').evaluate((b) => getComputedStyle(b).backgroundImage);
ok(/linear-gradient/.test(gridImg), 'grid is painted');
await page.selectOption('#bgSelect', 'blue');
const blueBg = await page.locator('#board').evaluate((b) => getComputedStyle(b).backgroundColor);
const paper = await page.evaluate(() => { const d = document.createElement('div'); d.style.color = 'var(--paper)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
ok(blueBg !== paper, `a tint differs from the paper (${blueBg})`);
await page.setInputFiles('#bgFile', { name: 'bg.png', mimeType: 'image/png', buffer: tinyPng() });
await page.waitForFunction(() => document.getElementById('board').getAttribute('data-bg') === 'image', null, { timeout: 5000 }).catch(() => {});
eq(await page.locator('#board').getAttribute('data-bg'), 'image', 'picture background applies');
ok(/^url\("blob:/.test(await page.locator('#board').evaluate((b) => b.style.backgroundImage)), 'from a blob URL');
eq(await page.evaluate(() => MediaDB.store({ ns: 'class-screen' }).list().then((r) => r.length)), 2, 'two pictures stored');

// ── accessibility with every P2 widget up ────────────────────────────
const violations = await a11yScan(page);
ok(violations.length === 0, 'axe: no serious/critical violations: ' + violations.map((v) => `${v.id} ${v.nodes.slice(0, 3).join(' ')}`).join('; '));

// ── reload restores; removing a picture frees its record ─────────────
await settle(page, 400);
const before = await st();
await page.reload();
await settle(page, 600);
eq(await st(), before, 'state identical after reload');
ok(await widget('image').locator('img.pic').isVisible(), 'picture restored from IndexedDB');
eq(await page.locator('#board').getAttribute('data-bg'), 'image', 'picture background restored');
eq((await data('draw')).strokes.length, 1, 'drawing restored');
eq(await widget('symbols').locator('.sym-label').textContent(), 'Partner talk', 'symbol restored');
eq(await widget('noise').locator('.noise-word').textContent(), 'Off', 'the microphone does not start itself after a reload');

await widget('image').getByRole('button', { name: 'Remove Picture' }).click();
await page.selectOption('#bgSelect', 'dots');
eq(await page.evaluate(() => MediaDB.store({ ns: 'class-screen' }).list().then((r) => r.length)), 2, 'nothing is deleted while an undo could still need it');
await page.click('#toastUndo');
await settle(page, 300);
ok(await widget('image').locator('img.pic').isVisible(), 'undo brings the picture back');
await widget('image').getByRole('button', { name: 'Remove Picture' }).click();
await page.evaluate(() => { document.getElementById('toast').hidden = true; });
await page.reload();
await settle(page, 600);
eq(await page.evaluate(() => MediaDB.store({ ns: 'class-screen' }).list().then((r) => r.length)), 0, 'the removed picture is collected on the next load');

// ── phone width ──────────────────────────────────────────────────────
await page.setViewportSize({ width: 375, height: 740 });
await settle(page, 200);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll at 375px');

eq(page.__errs, [], 'no page or console errors');
eq(page.__blocked, [], 'nothing went offsite');

await browser.close();
server.close();
fs.rmSync(TONE, { force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
