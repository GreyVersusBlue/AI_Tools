// smoke-print.mjs — 042 prints through the shared print kit (Path 7 P3).
//
//   node Tools/certificate-award-maker/test/smoke-print.mjs
//
// 042 is the kit's sixth adopter and the first whose sheet is a fixed size on
// purpose: a certificate goes on pre-printed stock, so a sheet is exactly the
// printable page and a certificate exactly all or half of it. It had its own
// `@media print` block and an `@page` at 0.35 in, rewritten on every change of
// orientation; both are gone. print-area.css puts #printArea alone on the
// paper, PrintKit.setPage() writes the page (Letter, landscape or portrait,
// 0.35 in), each .print-page is a .pk-page and #printArea is a .pk-paper. It
// does not call PrintKit.renderSet(): a sheet here is a page of one or two
// certificates, not one student's, and it keeps its own height.
//
// What this pins, for every state, light and dark:
//   - the sheets the one print button builds, and who each certificate is for
//   - only the sheet has a box on paper, and the paper is white
//   - a sheet is the size of the printable page (100vw x 100vh, which is what
//     the page area is in print), a certificate fills its slot, and a slot is
//     all of the sheet or half of it
//   - a certificate keeps its own colours in the dark theme (.pk-paper does
//     not reach inside it)
//   - the @page rule the kit wrote, and Chromium's PDF: its page count and its
//     paper size, which are what the hand-written block printed in every state
//     (measured on the old page, 2026-10-04, before the adoption)
//   - Ctrl+P prints the certificates (it printed an empty page)
//
// Not pinned here, because it needs pdftoppm: the PDFs of the old page and of
// this one were rasterised at 48 dpi in the same twelve states, light and
// dark, and were identical pixel for pixel.
//
// print() is stubbed. Nothing here has been checked against a printer.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8472;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '042-certificate-award-maker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
/** The paper sizes in a PDF, in points: "792x612" for Letter landscape. */
const pdfPaper = buf => [...new Set((buf.toString('latin1').match(/\/MediaBox\s*\[[^\]]*\]/g) || [])
  .map(m => m.match(/[\d.]+/g).slice(2).map(n => Math.round(+n)).join('x')))].join('|');

// Made-up names only: a batch is student-shaped data.
const roster = n => Array.from({ length: n }, (_, i) => 'Student ' + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? '2' : '') + ' Sample');
const preset = extra => ({
  name: 'Honor Roll', theme: 'elegant', border: 'double-line', logo: '', mode: 'single', studentName: 'Avery Quill',
  batchNames: '', awardTitle: 'Certificate of Achievement', awardTitleCustom: '', reason: 'For outstanding effort',
  certDate: '2026-09-28', signature: 'Ms. Invented', signatureImage: '', qrUrl: '', orientation: 'landscape', perPage: 1,
  showGuides: false, stockInset: 0, ...extra,
});
const batch = (n, extra) => preset({ mode: 'batch', studentName: '', batchNames: roster(n).join('\n'), ...extra });
const LONG = new Array(30).join('For a very long reason indeed. ');

// `names` is who the certificates are for, in order; `per` certificates to a
// sheet; `pages` Chromium's PDF page count, the old block's too.
const STATES = [
  { name: 'a first visit', set: null, names: ['Student Name'], per: 1, pages: 1 },
  { name: 'one certificate, landscape', set: preset({}), names: ['Avery Quill'], per: 1, pages: 1 },
  { name: 'one certificate, portrait', set: preset({ orientation: 'portrait' }), names: ['Avery Quill'], per: 1, pages: 1, portrait: true },
  { name: 'one certificate at two per page', set: preset({ perPage: 2 }), names: ['Avery Quill'], per: 2, pages: 1 },
  { name: 'one certificate for pre-printed stock, with guides and a QR code', set: preset({ stockInset: 0.75, showGuides: true, qrUrl: 'https://example.org/awards' }), names: ['Avery Quill'], per: 1, pages: 1, guides: true, qr: true },
  { name: 'a batch with no names', set: batch(0, {}), names: ['Student Name'], per: 1, pages: 1 },
  { name: 'a batch of three', set: batch(3, {}), names: roster(3), per: 1, pages: 3 },
  { name: 'a batch of three at two per page', set: batch(3, { perPage: 2 }), names: roster(3), per: 2, pages: 2 },
  { name: 'a batch of four at two per page, portrait', set: batch(4, { perPage: 2, orientation: 'portrait' }), names: roster(4), per: 2, pages: 2, portrait: true },
  { name: 'a class of twenty-eight', set: batch(28, {}), names: roster(28), per: 1, pages: 28 },
  { name: 'a class of twenty-eight at two per page', set: batch(28, { perPage: 2 }), names: roster(28), per: 2, pages: 14 },
  { name: 'a batch of three with a reason too long for the certificate', set: batch(3, { theme: 'playful', border: 'stars', reason: LONG }), names: roster(3), per: 1, pages: 3, ink: 'rgb(224, 69, 155)' },
];

// The printable page at 96 px to the inch: Letter less 0.35 in on each edge.
// In print 100vw x 100vh is that page; in print *media* on a screen it is the
// viewport, so the viewport is given the page's size (to the whole pixel).
const AREA = { landscape: { width: 989, height: 749 }, portrait: { width: 749, height: 989 } };

async function open(browser, { set = null, theme = 'light' } = {}) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([s, dark]) => {
    if (s) {
      localStorage.setItem('gvb-certificate-maker:list', JSON.stringify(['Honor Roll']));
      localStorage.setItem('gvb-certificate-maker:current', 'Honor Roll');
      localStorage.setItem('gvb-certificate-maker:data:Honor Roll', s);
    }
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [set ? JSON.stringify(set) : null, theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}

/** What the page built in #printArea. */
const built = page => page.evaluate(() => {
  const area = document.getElementById('printArea');
  const sheets = [...area.children];
  return {
    n: sheets.length,
    areaClass: area.className,
    classes: [...new Set(sheets.map(x => x.className))].join('|'),
    slotsPer: sheets.map(x => x.querySelectorAll(':scope > .cert-slot').length).join(','),
    certsPer: [...new Set([...area.querySelectorAll('.cert-slot')].map(x => x.querySelectorAll(':scope > .cert').length))].join(','),
    names: [...area.querySelectorAll('.cert-name')].map(x => x.textContent),
    chrome: area.querySelectorAll('.pk-header, .pk-footer, .pk-sheet').length,
    guides: area.querySelectorAll('.cert-guides.safe-area').length,
    qrs: area.querySelectorAll('img.cert-qr').length,
    previewName: (document.querySelector('#previewArea .cert-name') || {}).textContent || '',
  };
});

/** The same sheets in print media. */
const onPaper = page => page.evaluate(() => {
  const area = document.getElementById('printArea');
  const cs = x => getComputedStyle(x);
  const box = x => x.getBoundingClientRect();
  const outside = [...document.body.querySelectorAll('*')].filter(x => !area.contains(x) && !x.contains(area) && x.getClientRects().length);
  const sheets = [...area.children];
  const slots = [...area.querySelectorAll('.cert-slot')];
  const cert = area.querySelector('.cert');
  const root = document.documentElement.style;
  return {
    outside: outside.length,
    first: outside[0] ? outside[0].tagName.toLowerCase() + (outside[0].className ? '.' + outside[0].className : '') : '',
    areaDisplay: cs(area).display,
    areaBg: cs(area).backgroundColor,
    pageRule: (document.getElementById('pk-page-style') || {}).textContent || '',
    pageRules: [...document.querySelectorAll('style')].filter(s => /@page/.test(s.textContent)).length,
    props: [root.getPropertyValue('--pk-page-w'), root.getPropertyValue('--pk-page-h'), root.getPropertyValue('--pk-margin')].join(' '),
    vw: innerWidth, vh: innerHeight,
    sheetW: sheets.map(x => box(x).width), sheetH: sheets.map(x => box(x).height),
    breaks: sheets.map(x => cs(x).breakAfter).join(','),
    slotH: sheets.map(x => [...x.children].map(k => box(k).height)),
    // how far a certificate's box is from the inside of its slot, at worst
    // (the lower slot of two has the 1 px cut guide along its top)
    fill: Math.max(0, ...slots.map(s => { const c = box(s.firstElementChild), b = box(s); return Math.max(Math.abs(c.left - b.left), Math.abs(c.right - b.right), Math.abs(c.top - b.top - parseFloat(cs(s).borderTopWidth)), Math.abs(c.bottom - b.bottom)); })),
    slotClip: [...new Set(slots.map(s => cs(s).overflowY))].join(','),
    cut: slots.map(s => cs(s).borderTopStyle + ' ' + parseFloat(cs(s).borderTopWidth)).join(','),
    ink: cert ? cs(cert).color : '',
    certBg: cert ? cs(cert).backgroundColor + ' ' + cs(cert).backgroundImage.slice(0, 15) : '',
    shadow: cert ? cs(cert).boxShadow : '',
    nameInk: cert ? cs(cert.querySelector('.cert-name')).color : '',
  };
});

console.log('042 — the certificates print through the shared kit, at their own size');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print\s*\{/.test(code), 'has no @media print block of its own');
ok(!/@page\s*\{/.test(code), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(!/camPageSizeStyle/.test(src), 'the injected @page <style> is gone');
ok(src.indexOf('print-area.css') < src.indexOf('<style>'), 'print-area.css is linked before the inline <style>');
ok(/<\/div>\n\n<div id="printArea" class="pk-paper"><\/div>\n/.test(src), '#printArea is a direct child of <body>, a .pk-paper, with no inline display');
eq((code.match(/PrintKit\.setPage\(/g) || []).length, 1, 'one PrintKit.setPage() call');
ok(/PrintKit\.setPage\(\{[^}]*margin:\s*PAGE_MARGIN_IN\s*\}/.test(code), 'which is handed the margin the stock inset is worked out from');
ok(/var PAGE_MARGIN_IN = 0\.35;/.test(code), 'still 0.35 in');
ok(!/PrintKit\.renderSet\(/.test(code), 'it does not call renderSet(): a sheet is a page of certificates');

const server = await serve(PORT);
const browser = await launch();
const lightInk = {};

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const what = `${theme}, ${s.name}`;
    const page = await open(browser, { set: s.set, theme });
    try {
      const orient = s.portrait ? 'portrait' : 'landscape';
      const sheets = Math.ceil(s.names.length / s.per);
      eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${what}: the page is in ${theme}`);
      eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${what}: the sheet is hidden on screen`);
      eq(await page.locator('#printArea > *').count(), 0, `${what}: and empty until something prints`);
      await page.click('#printBtn');
      await settle(page, 150);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: the button called print()`);

      const r = await built(page);
      eq(r.n, sheets, `${what}: ${sheets} sheet${sheets === 1 ? '' : 's'}`);
      eq(r.areaClass, 'pk-paper', `${what}: #printArea is the kit's paper and nothing else`);
      eq(r.classes, `print-page pk-page${s.per === 2 ? ' per-2' : ''}`, `${what}: each sheet is a kit page`);
      eq(r.chrome, 0, `${what}: no kit header, footer or sheet wrapper`);
      eq(r.slotsPer, Array.from({ length: sheets }, (_, i) => Math.min(s.per, s.names.length - i * s.per)).join(','), `${what}: ${s.per} to a sheet, and what is left over on the last`);
      eq(r.certsPer, '1', `${what}: one certificate in each slot`);
      eq(r.names.join('|'), s.names.join('|'), `${what}: each certificate is made out to its student, in order`);
      eq(r.previewName, s.names[0], `${what}: and the first is the one the preview shows`);
      eq(r.guides, s.guides ? s.names.length : 0, `${what}: ${s.guides ? 'the safe-area guides print' : 'no alignment guides'}`);
      eq(r.qrs, s.qr ? s.names.length : 0, `${what}: ${s.qr ? 'the QR code prints' : 'no QR code'}`);

      await page.setViewportSize(AREA[orient]);
      await page.emulateMedia({ media: 'print' });
      await settle(page, 150);
      const m = await onPaper(page);
      eq(m.areaDisplay, 'block', `${what}: the sheet shows on paper`);
      eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
      eq(m.areaBg, 'rgb(255, 255, 255)', `${what}: the paper is white`);
      eq(m.pageRule, `@page { size: letter ${orient}; margin: 0.35in; }`, `${what}: the page is Letter ${orient} with 0.35 in margins, as it was`);
      eq(m.pageRules, 1, `${what}: and that is the only @page rule on the page`);
      eq(m.props, s.portrait ? '8.5in 11in 0.35in' : '11in 8.5in 0.35in', `${what}: the kit's page properties agree with it`);
      ok(m.sheetW.every(w => w === m.vw) && m.sheetH.every(h => h === m.vh), `${what}: every sheet is exactly the printable page (${m.sheetW[0]} x ${m.sheetH[0]} px of ${m.vw} x ${m.vh})`);
      eq(m.breaks, Array.from({ length: sheets }, (_, i) => i === sheets - 1 ? 'auto' : 'page').join(','), `${what}: a page break after every sheet but the last`);
      ok(m.slotH.every(hs => hs.every(h => Math.abs(h - m.vh / hs.length) <= (hs.length === 1 ? 0.01 : 0.51)) && Math.abs(hs.reduce((x, y) => x + y, 0) - m.vh) < 0.01), `${what}: a slot is all of its sheet, or half when it shares it, the cut guide's 1 px aside (${m.slotH[0].map(h => h.toFixed(1)).join(' + ')} px)`);
      ok(m.fill < 0.01, `${what}: every certificate fills its slot (off by ${m.fill.toFixed(2)} px)`);
      eq(m.slotClip, 'hidden', `${what}: a slot is a fixed size on purpose: it clips, it does not grow onto more stock`);
      if (s.per === 2 && s.names.length > 1) ok(m.cut.startsWith('none 0,dashed 1'), `${what}: the dashed cut guide is between the two halves, not above the first (${m.cut.split(',').slice(0, 2).join(' / ')})`);
      else ok(m.cut.split(',').every(c => c === 'none 0'), `${what}: no cut guide`);
      eq(m.shadow, 'none', `${what}: the preview's shadow is off the paper`);
      const k = s.name;
      if (theme === 'light') lightInk[k] = [m.ink, m.certBg, m.nameInk].join(' / ');
      else eq([m.ink, m.certBg, m.nameInk].join(' / '), lightInk[k], `${what}: the certificate keeps its own colours (.pk-paper does not reach inside it)`);
      eq(m.ink, s.ink || (s.set ? 'rgb(138, 109, 29)' : m.ink), `${what}: in its template's ink, not black`);

      await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
      await page.setViewportSize({ width: 1100, height: 900 });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
      eq(pdfPageCount(pdf), s.pages, `${what}: Chromium prints ${s.pages} page${s.pages === 1 ? '' : 's'}, as the old block did`);
      eq(pdfPaper(pdf), s.portrait ? '612x792' : '792x612', `${what}: on Letter ${orient}`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
      eq(page.__blocked.length, 0, `${what}: nothing tried to leave the site`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }
}

// ---- Ctrl+P, with no button pressed, prints the certificates ------------------
// The old page built its sheet in the button's handler only, so Ctrl+P printed
// an empty page. page.pdf() fires the page's own beforeprint, as Ctrl+P does.
for (const [name, set, pages, certs] of [['a first visit', null, 1, 1], ['a batch of three at two per page', batch(3, { perPage: 2 }), 2, 3]]) {
  const page = await open(browser, { set });
  try {
    eq(await page.locator('#printArea .cert').count(), 0, `Ctrl+P, ${name}: nothing is built before it`);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    eq(pdfPageCount(pdf), pages, `Ctrl+P, ${name}: Chromium prints ${pages} page${pages === 1 ? '' : 's'}`);
    eq(await page.locator('#printArea .cert').count(), certs, `Ctrl+P, ${name}: holding ${certs} certificate${certs === 1 ? '' : 's'}`);
    eq(await page.evaluate(() => window.__printCalls), 0, `Ctrl+P, ${name}: without the page calling print() itself`);
    await page.emulateMedia({ media: 'print' });
    eq((await onPaper(page)).outside, 0, `Ctrl+P, ${name}: with nothing else on the paper`);
  } catch (e) {
    ok(false, `Ctrl+P, ${name}: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- the page follows the orientation and per-page controls -------------------
{
  const page = await open(browser, { set: batch(3, {}) });
  try {
    const rule = () => page.evaluate(() => document.getElementById('pk-page-style').textContent);
    eq(await rule(), '@page { size: letter landscape; margin: 0.35in; }', 'on load the kit has the page: Letter landscape');
    await page.click('.seg-tab[data-orient="portrait"]');
    eq(await rule(), '@page { size: letter portrait; margin: 0.35in; }', 'choosing Portrait turns the page, before any print');
    eq(pdfPaper(await page.pdf({ preferCSSPageSize: true, printBackground: false })), '612x792', 'and Chromium prints on Letter portrait');
    await page.click('.seg-tab[data-perpage="2"]');
    await page.click('#printBtn');
    eq(await page.locator('#printArea > .print-page.pk-page.per-2').count(), 2, 'two per page: three certificates on two sheets');
    await page.click('.seg-tab[data-perpage="1"]');
    await page.click('.seg-tab[data-orient="landscape"]');
    await page.click('#printBtn');
    eq(await page.locator('#printArea > .print-page.pk-page').count(), 3, 'one per page again: three sheets replace the two, they do not add to them');
    eq(await rule(), '@page { size: letter landscape; margin: 0.35in; }', 'and the page is landscape again');
    eq(await page.evaluate(() => document.querySelectorAll('style#pk-page-style').length), 1, 'there is still one kit page rule, rewritten in place');
    eq(await page.evaluate(() => window.__printCalls), 2, 'print() was called once per press');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `orientation and per page: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- text, not markup ---------------------------------------------------------
{
  const evil = '<img src=x onerror="window.__pwned=1"> & <b>Bo</b>';
  const page = await open(browser, { set: preset({ mode: 'batch', studentName: '', batchNames: evil + '\nBella Cruz' }) });
  try {
    await page.click('#printBtn');
    await settle(page, 150);
    const r = await built(page);
    eq(r.names.join('|'), [evil, 'Bella Cruz'].join('|'), 'a name reaches the certificate character for character');
    const x = await page.evaluate(() => ({
      injected: document.querySelectorAll('#printArea .cert-name *, #previewArea .cert-name *').length,
      pwned: !!window.__pwned,
    }));
    eq(x.injected, 0, 'nothing typed became an element');
    eq(x.pwned, false, 'nothing typed ran');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `text, not markup: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
