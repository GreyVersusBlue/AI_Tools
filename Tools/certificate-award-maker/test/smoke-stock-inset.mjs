// smoke-stock-inset.mjs — the Certificate & Award Maker's pre-printed stock
// safe area.
//
//   node Tools/certificate-award-maker/test/smoke-stock-inset.mjs
//
// The shipped alignment guides marked the page edge, which is the wrong
// boundary for exactly the paper people buy: store-bought certificate stock
// carries its border in the ink, and the usable area is the rectangle inside
// it. What this suite checks is that the inset is a real measurement and not a
// decoration — the guides move, and so does the content, the logo and the QR
// code, by the number of inches the teacher entered, computed against the
// certificate's actual printed size for both orientations and both per-page
// layouts.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8156;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/042-certificate-award-maker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ~${b})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

/** The safe-area inset the rendered certificate is actually using, in inches,
 *  measured off the live element and converted back through the certificate's
 *  own printed width. */
const measured = () => page.evaluate(() => {
  const cert = document.querySelector('#previewArea .cert');
  if (!cert) return null;
  const cs = getComputedStyle(cert);
  const rect = cert.getBoundingClientRect();
  const guides = cert.querySelector('.cert-guides');
  const g = guides ? guides.getBoundingClientRect() : null;
  return {
    padLeftFrac: parseFloat(cs.paddingLeft) / rect.width,
    padTopFrac: parseFloat(cs.paddingTop) / rect.width,   // % padding is width-relative on all sides
    guideLeftFrac: g ? (g.left - rect.left) / rect.width : null,
    guideTopFrac: g ? (g.top - rect.top) / rect.height : null,
    guideSafeArea: guides ? guides.classList.contains('safe-area') : null,
    hasGuides: !!guides,
  };
});

const setInset = async (val) => {
  await page.selectOption('#stockInset', String(val));
  await settle(page, 150);
};

console.log('Certificate & Award Maker — pre-printed stock safe area');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 1. the default is unchanged behaviour ─────────────────────────────── */
eq(await page.inputValue('#stockInset'), '0', 'a new preset starts on "None" — plain paper, as before');
const base = await measured();
near(base.padLeftFrac, 0.08, 0.005, 'with no inset the horizontal padding is the original 8%');
near(base.padTopFrac, 0.06, 0.005, 'and the vertical padding is the original 6%');
ok(!base.hasGuides, 'guides are off by default');

/* ── 2. turning the guides on with no inset still marks the page edge ──── */
await page.check('#showGuides');
await settle(page, 150);
const edge = await measured();
near(edge.guideLeftFrac, 0, 0.002, 'with no stock border the guides sit on the page edge, as they always did');
eq(edge.guideSafeArea, false, 'and are drawn as bare corner marks, not a safe-area box');

/* ── 3. 0.75in of stock border moves the guides AND the content in ─────── */
await setInset(0.75);
const std = await measured();
// Landscape, one per page: 11in less the 0.35in @page margins = 10.3in wide.
const LANDSCAPE_W = 11 - 0.7, LANDSCAPE_H = 8.5 - 0.7;
near(std.guideLeftFrac, 0.75 / LANDSCAPE_W, 0.004, 'the guides pull in 0.75in horizontally on a 10.3in-wide print');
near(std.guideTopFrac, 0.75 / LANDSCAPE_H, 0.004, 'and 0.75in vertically on a 7.8in-tall print');
eq(std.guideSafeArea, true, 'the guides become a closed safe-area box');
near(std.padLeftFrac, 0.08 + 0.75 / LANDSCAPE_W, 0.004, 'the text is pushed inside the border, not just the guides');
near(std.padTopFrac, 0.06 + 0.75 / LANDSCAPE_W, 0.004, 'top and bottom too');

/* ── 4. the QR code is a corner element and has to move with it ────────── */
await page.fill('#qrUrl', 'https://example.org/portfolio');
await settle(page, 250);
const qrInset = await page.evaluate(() => {
  const cert = document.querySelector('#previewArea .cert');
  const qr = cert.querySelector('.cert-qr');
  if (!qr) return null;
  const c = cert.getBoundingClientRect(), q = qr.getBoundingClientRect();
  return (c.right - q.right) / c.width;
});
ok(qrInset !== null, 'the QR code renders');
near(qrInset, 0.07 + 0.75 / LANDSCAPE_W, 0.006, 'the QR code clears the pre-printed border too');
await page.fill('#qrUrl', '');
await settle(page, 200);

/* ── 5. the inches are measured against the real printed size ──────────── */
await page.click('#orientTabs .seg-tab[data-orient="portrait"]');
await settle(page, 250);
const portrait = await measured();
const PORTRAIT_W = 8.5 - 0.7, PORTRAIT_H = 11 - 0.7;
near(portrait.guideLeftFrac, 0.75 / PORTRAIT_W, 0.004, 'portrait recomputes the horizontal inset against a 7.8in width');
near(portrait.guideTopFrac, 0.75 / PORTRAIT_H, 0.004, 'and the vertical inset against a 10.3in height');

await page.click('#perPageTabs .seg-tab[data-perpage="2"]');
await settle(page, 250);
const half = await measured();
near(half.guideTopFrac, 0.75 / (PORTRAIT_H / 2), 0.006, 'two-per-page halves the printed height, so the vertical inset doubles as a fraction');
await page.click('#perPageTabs .seg-tab[data-perpage="1"]');
await page.click('#orientTabs .seg-tab[data-orient="landscape"]');
await settle(page, 250);

/* ── 6. the setting survives a reload with the preset ──────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.inputValue('#stockInset'), '0.75', 'the stock border is saved with the preset');
near((await measured()).guideLeftFrac, 0.75 / LANDSCAPE_W, 0.004, 'and is applied on load');

/* ── 7. a preset saved before this feature existed opens unchanged ─────── */
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('cam_presets_v1') || localStorage.getItem('cam-presets') || 'null');
  return raw;
});
const legacy = await page.evaluate(() => {
  // Strip the key the way a pre-feature build would have left it.
  for (const k of Object.keys(localStorage)) {
    const raw = localStorage.getItem(k);
    if (!raw || raw.indexOf('awardTitle') === -1) continue;
    const parsed = JSON.parse(raw);
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if ('awardTitle' in o) delete o.stockInset;
      Object.values(o).forEach(walk);
    };
    walk(parsed);
    localStorage.setItem(k, JSON.stringify(parsed));
    return k;
  }
  return null;
});
ok(legacy, 'found the preset store to age backwards: ' + legacy);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.inputValue('#stockInset'), '0', 'a preset with no stockInset key falls back to "None"');
near((await measured()).padLeftFrac, 0.08, 0.005, 'and renders exactly as it did before the feature existed');

/* ── 8. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
