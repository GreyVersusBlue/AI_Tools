// smoke-seals.mjs — 042's rendered seals and ribbons (Path 21 P4).
//
//   node Tools/certificate-award-maker/test/smoke-seals.mjs
//
// A certificate can carry a foil seal, bottom centre, with ribbon tails behind it:
// Blender renders in Tools/certificate-award-maker/art/, ledgered in
// Tools/blender-art/renders.json. What this suite holds down:
//
//   Every seal and ribbon the pickers offer is a ledgered file that loads from
//   the site at its ledgered size, and every ledgered one is offered.
//
//   They are decorative (alt="") and the ribbon is behind the seal.
//
//   The seal never covers the certificate's text, in either orientation.
//
//   A saved preset's seal value only ever selects from the fixed table: a
//   value that is not a key is "none", and is never written into a src.
//
//   Picking the Ribbon template with no seal gives it a gold seal with blue
//   tails; an existing preset, with no seal field, renders as it always did.
//
//   The print area carries the seal.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8455;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/042-certificate-award-maker.html';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ART = 'Tools/certificate-award-maker/art/';

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
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

const award = () => page.evaluate(() => {
  const a = document.querySelector('#previewArea .cert .cert-award');
  if (!a) return null;
  return Array.from(a.querySelectorAll('img')).map(i => ({ cls: i.className, src: i.getAttribute('src'), alt: i.getAttribute('alt') }));
});
const pick = (container, label) => page.evaluate(([c, l]) => {
  const sw = Array.from(document.querySelectorAll(`#${c} .swatch`)).find(s => s.querySelector('.label').textContent === l);
  if (!sw) return false;
  sw.click();
  return true;
}, [container, label]);

console.log('Certificate & Award Maker — seals and ribbons');
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

/* ── 1. a new preset has no seal ────────────────────────────────────────── */
eq(await award(), null, 'a new certificate has no seal until one is picked');

/* ── 2. every offered seal and ribbon is a ledgered file, and loads ─────── */
const labels = c => page.evaluate(id => Array.from(document.querySelectorAll(`#${id} .swatch .label`)).map(l => l.textContent), c);
const seals = (await labels('sealSwatches')).filter(l => l !== 'None');
const ribbons = (await labels('ribbonSwatches')).filter(l => l !== 'None');
const offered = [...seals.map(s => ART + 'seal-' + s.toLowerCase() + '.webp'), ...ribbons.map(r => ART + 'ribbon-' + r.toLowerCase() + '.webp')];
eq(offered.slice().sort().join(','), entries.map(e => e.path).sort().join(','), 'the pickers offer exactly the ledgered seals and ribbons');
for (const e of entries) {
  const got = await page.evaluate(async url => {
    const im = new Image();
    im.src = url;
    try { await im.decode(); } catch { return null; }
    return { w: im.naturalWidth, h: im.naturalHeight };
  }, BASE + '/' + e.path);
  ok(got && got.w === e.width && got.h === e.height, `${e.subject} loads at ${e.width}x${e.height}: ${JSON.stringify(got)}`);
}

/* ── 3. picking: seal, then ribbon behind it, decorative ────────────────── */
ok(await pick('sealSwatches', 'Gold'), 'the Gold seal swatch is there');
await pick('ribbonSwatches', 'Blue');
await settle(page);
const a1 = await award();
eq(JSON.stringify(a1 && a1.map(i => i.cls)), JSON.stringify(['cert-ribbon', 'cert-seal']), 'the ribbon is drawn first, behind the seal');
ok(a1 && a1[1].src.endsWith('seal-gold.webp') && a1[0].src.endsWith('ribbon-blue.webp'), 'the gold seal with blue tails: ' + JSON.stringify(a1));
ok(a1 && a1.every(i => i.alt === ''), 'both are decorative, alt=""');
await pick('sealSwatches', 'None');
eq(await award(), null, 'a ribbon with no seal shows nothing');
await pick('sealSwatches', 'Silver');

/* ── 4. the seal never covers the text ──────────────────────────────────── */
for (const orient of ['landscape', 'portrait']) {
  await page.click(`#orientTabs [data-orient="${orient}"]`);
  await page.fill('#studentName', 'Alexandria Montgomery-Okonkwo');
  await settle(page);
  const hit = await page.evaluate(() => {
    const cert = document.querySelector('#previewArea .cert');
    const box = el => el.getBoundingClientRect();
    const seal = box(cert.querySelector('.cert-award'));
    const inCert = seal.left >= box(cert).left && seal.top >= box(cert).top;
    const hits = Array.from(cert.querySelectorAll('.cert-kicker, .cert-name, .cert-title, .cert-reason, .cert-footer .line'))
      .filter(el => { const r = box(el); return !(r.right <= seal.left || r.left >= seal.right || r.bottom <= seal.top || r.top >= seal.bottom); })
      .map(el => el.className);
    return { inCert, hits };
  });
  ok(hit.inCert && hit.hits.length === 0, `${orient}: the seal sits inside the certificate and covers no text: ${JSON.stringify(hit)}`);
}

/* ── 5. the saved value only ever selects from the table ────────────────── */
const current = await page.evaluate(() => localStorage.getItem('gvb-certificate-maker:current'));
await page.evaluate(n => {
  const k = 'gvb-certificate-maker:data:' + n;
  const s = JSON.parse(localStorage.getItem(k));
  s.seal = '"><img src=x onerror="window.__pwned=1">';
  s.ribbon = '../../evil';
  localStorage.setItem(k, JSON.stringify(s));
}, current);
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await award(), null, 'a seal value that is not a key renders no seal');
ok(!(await page.evaluate(() => window.__pwned)), 'and nothing it held ran');
eq(await page.evaluate(() => document.querySelector('#sealSwatches .swatch.active .label').textContent), 'None', 'the picker shows None');

/* ── 6. the Ribbon template gets a real ribbon; old presets are unchanged ─ */
await pick('themeSwatches', 'Ribbon');
await settle(page);
const a2 = await award();
ok(a2 && a2[1].src.endsWith('seal-gold.webp') && a2[0].src.endsWith('ribbon-blue.webp'), 'picking the Ribbon template puts a gold seal with blue tails on: ' + JSON.stringify(a2));
await pick('sealSwatches', 'Red');
await pick('themeSwatches', 'Elegant');
await pick('themeSwatches', 'Ribbon');
ok((await award())[1].src.endsWith('seal-red.webp'), 'and leaves a seal already chosen alone');
await page.reload({ waitUntil: 'networkidle' });
ok((await award())[1].src.endsWith('seal-red.webp'), 'the seal is saved with the preset');
await page.evaluate(n => {
  const k = 'gvb-certificate-maker:data:' + n;
  const s = JSON.parse(localStorage.getItem(k));
  delete s.seal; delete s.ribbon;
  localStorage.setItem(k, JSON.stringify(s));
}, current);
await page.reload({ waitUntil: 'networkidle' });
eq(await award(), null, 'a preset saved before seals existed renders with none');

/* ── 7. the print area carries it ───────────────────────────────────────── */
await pick('sealSwatches', 'Bronze');
await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
await page.click('#printBtn');
const printed = await page.evaluate(() => Array.from(document.querySelectorAll('#printArea .cert-award img')).map(i => i.getAttribute('src')));
ok(printed.length === 1 && printed[0].endsWith('seal-bronze.webp'), 'the printed certificate has the seal: ' + JSON.stringify(printed));

/* ── 8. no console noise ────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
