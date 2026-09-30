// smoke-starter-pictures.mjs — 071's twelve starter pictures (Path 21 P4).
//
//   node Tools/picture-prompt-generator/test/smoke-starter-pictures.mjs
//
// The tool asked a teacher to upload pictures before it did anything. It now
// ships twelve rendered scenes (Tools/picture-prompt-generator/art/*.webp,
// ledgered in Tools/blender-art/renders.json). What this suite holds down:
//
//   A fresh install works with nothing uploaded: "New random image" puts a
//   starter scene up, with alt text that describes it.
//
//   Every ledgered picture is one the page offers, from the site, at its
//   ledgered size — and every picture the page offers is ledgered.
//
//   They are site files and never copied into storage: after showing,
//   pinning and printing them, ppg_images_v1 holds nothing, and the one key
//   they use (ppg_starter_pictures_v1) holds no picture data.
//
//   The default: until the teacher uses the box, the starters are in the pool
//   exactly while there are no pictures of their own, so a first upload is
//   not dealt into twelve scenes. Ticking or unticking is remembered.
//
//   A prompt pinned to a starter picture survives a reload.
//
//   The printed cards carry each picture's alt text.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { makeSolidPng } from '../../image-to-pdf/test/make-fixtures.mjs';

const PORT = 8454;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/071-picture-prompt-generator.html';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ART = 'Tools/picture-prompt-generator/art/';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const ledger = JSON.parse(fs.readFileSync(path.join(SITE, 'Tools', 'blender-art', 'renders.json'), 'utf8'));
const entries = ledger.entries.filter(e => e.path.startsWith(ART));

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });

const stage = () => page.evaluate(() => {
  const img = document.querySelector('#stageCard img');
  return img ? { src: img.getAttribute('src'), alt: img.getAttribute('alt'), w: img.naturalWidth } : null;
});
const checked = () => page.isChecked('#starterToggle');
const stored = key => page.evaluate(k => localStorage.getItem(k), key);

console.log('Picture-Prompt Generator — starter pictures');
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

/* ── 1. the ledger and the page agree, and every file loads ─────────────── */
eq(entries.length, 12, 'twelve starter pictures are ledgered');
const offered = await page.evaluate(async () => {
  // Draw every picture once through the real path: up to 60 picks is enough
  // to see all twelve, since a round shows each picture once before repeating.
  const seen = {};
  for (let i = 0; i < 12; i++) {
    document.getElementById('newImageBtn').click();
    const img = document.querySelector('#stageCard img');
    if (img) seen[img.getAttribute('src')] = img.getAttribute('alt');
  }
  return seen;
});
const offeredPaths = Object.keys(offered).map(s => 'Tools/' + s).sort();
eq(offeredPaths.join(','), entries.map(e => e.path).sort().join(','), 'one round of twelve shows each ledgered picture exactly once');
for (const e of entries) {
  const alt = offered[e.path.slice('Tools/'.length)] || '';
  ok(alt.length > 40 && !e.decorative, `${e.subject} has a real alt text and a meaningful ledger entry: "${alt.slice(0, 50)}…"`);
  const size = await page.evaluate(async url => {
    const r = await fetch(url);
    const im = new Image();
    im.src = url;
    await im.decode();
    return { status: r.status, type: r.headers.get('content-type'), w: im.naturalWidth, h: im.naturalHeight };
  }, BASE + '/' + e.path);
  ok(size.status === 200 && /webp/.test(size.type) && size.w === e.width && size.h === e.height,
    `${e.subject} loads from the site at ${e.width}x${e.height}: ${JSON.stringify(size)}`);
}
const alts = Object.values(offered);
eq(new Set(alts).size, alts.length, 'no two pictures share an alt text');

/* ── 2. a fresh install works with nothing uploaded ─────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
ok(await checked(), 'the starter box is ticked on a fresh install');
await page.click('#newImageBtn');
await settle(page);
const s1 = await stage();
ok(s1 && s1.src.startsWith('picture-prompt-generator/art/') && s1.w > 0 && s1.alt.length > 40,
  'New random image puts a starter scene up with its alt text: ' + JSON.stringify(s1));
ok(await page.evaluate(() => document.querySelector('#stageCard .task-text').textContent.length > 0), 'with a prompt beside it');

/* ── 3. pins on a starter picture, and nothing copied into storage ──────── */
await page.click('#pinPromptBtn');
const pinned = await page.evaluate(() => ({ src: document.querySelector('#stageCard img').getAttribute('src'),
  task: document.querySelector('#stageCard .task-text').textContent }));
const st = JSON.parse(await stored('ppg_starter_pictures_v1') || 'null');
ok(st && st.pins && Object.keys(st.pins).length === 1, 'the pin is kept under ppg_starter_pictures_v1: ' + JSON.stringify(st));
ok(st && !('on' in st), 'and pinning is not taken as a choice about the starter box');
ok(!/webp|data:|idb:/.test(await stored('ppg_starter_pictures_v1')), 'that key holds no picture, only ids');
const imagesKey = await stored('ppg_images_v1');
ok(imagesKey === null || imagesKey === '[]', 'ppg_images_v1 holds nothing: ' + imagesKey);
await page.reload({ waitUntil: 'networkidle' });
let back = null;
for (let i = 0; i < 12 && !back; i++) {
  await page.click('#newImageBtn');
  const s = await page.evaluate(() => ({ src: document.querySelector('#stageCard img').getAttribute('src'),
    task: document.querySelector('#stageCard .task-text').textContent,
    pinned: document.getElementById('pinPromptBtn').classList.contains('pinned') }));
  if (s.src === pinned.src) back = s;
}
ok(back && back.pinned && back.task === pinned.task, 'after a reload the pinned starter picture comes up with its pinned prompt');

/* ── 4. printing the starters: twelve cards, each with its alt ──────────── */
await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
await page.fill('#printCount', '');
await page.click('#printBtn');
await page.waitForFunction(() => window.__printed === true, null, { timeout: 10000 });
const cards = await page.evaluate(() => Array.from(document.querySelectorAll('#printArea .print-card img')).map(i => i.getAttribute('alt')));
eq(cards.length, 12, 'printing with no uploads gives twelve cards');
ok(cards.every(a => a && a.length > 40), 'each printed picture carries its alt text');

/* ── 5. the default follows the teacher's own pictures ──────────────────── */
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
const png = makeSolidPng(80, 60, [30, 90, 160]);
await page.setInputFiles('#imageInput', { name: 'mine.png', mimeType: 'image/png', buffer: png });
await page.waitForFunction(() => document.querySelectorAll('#thumbGrid img').length === 1);
ok(!(await checked()), 'uploading a first picture of your own takes the unchosen starters out');
await page.click('#newImageBtn');
ok(!(await stage()).src.startsWith('picture-prompt-generator/'), 'so New random image shows the upload');
await page.click('#thumbGrid .del');
await settle(page);
ok(await checked(), 'deleting it again brings the starters back');
await page.setInputFiles('#imageInput', { name: 'mine.png', mimeType: 'image/png', buffer: png });
await page.waitForFunction(() => document.querySelectorAll('#thumbGrid img').length === 1);
await page.check('#starterToggle');
await page.reload({ waitUntil: 'networkidle' });
ok(await checked(), 'ticking the box with a picture of your own is remembered');
const srcs = new Set();
for (let i = 0; i < 13; i++) { await page.click('#newImageBtn'); srcs.add((await stage()).src); }
eq(srcs.size, 13, 'and the round is the twelve starters plus the upload');
await page.uncheck('#starterToggle');
await page.click('#thumbGrid .del');
await page.reload({ waitUntil: 'networkidle' });
ok(!(await checked()), 'unticking is remembered too, even with no pictures of your own');

/* ── 6. no console noise ────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
