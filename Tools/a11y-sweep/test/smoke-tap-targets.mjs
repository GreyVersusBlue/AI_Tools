// smoke-tap-targets.mjs — AI-83 (ML-72, ML-73, ML-80): the phone rules.
//
//   node Tools/a11y-sweep/test/smoke-tap-targets.mjs
//
// 1. Shared rule: on the eleven generated tools that had the most under-24 px controls
//    (050 078 056 065 070 052 090 045 073 001 021), no button, summary, select, checkbox, radio,
//    text field or standalone link is under 24 x 24 CSS px at 390 px. Inline links in running text
//    are exempt, as in WCAG 2.5.8. The count on 2026-11-24 before the rule was 738 over 75 pages.
// 2. Index: at 1280 x 800 the popular-tool chips are above the fold and each one links a real page;
//    at 390 the fixed Aa button does not overlap the filter box.
// 3. 035 at 390: the header fits the viewport, the "Best on a laptop or tablet" notice shows, the
//    "← Toolkit" link reads at 4.5:1 against its header, and the page has one h1. At 1280 the notice
//    is hidden.
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 8791;
const PAGES = ['050', '078', '056', '065', '070', '052', '090', '045', '073', '001', '021'];
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.error('FAIL ' + msg); } else console.log('ok   ' + msg); };

const srv = await serve(PORT);
const browser = await launch();
const base = `http://localhost:${PORT}`;
try {
  // 1
  const files = fs.readdirSync(path.join(SITE, 'Tools')).filter(f => /^\d{3}-.*\.html$/.test(f));
  for (const n of PAGES) {
    const f = files.find(x => x.startsWith(n + '-'));
    const page = await prepPage(browser, base, { width: 390, height: 844 });
    await page.goto(`${base}/Tools/${encodeURIComponent(f)}`);
    await settle(page, 500);
    const small = await page.evaluate(() => {
      const sel = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab]';
      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (el.closest('[hidden],[aria-hidden=true],.a11y-reserve')) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || (r.width >= 23.5 && r.height >= 23.5)) continue;
        if (el.tagName === 'A' && cs.display === 'inline') {
          const t = el.parentElement.textContent.trim().length;
          if (t > el.textContent.trim().length + 3) continue; // a link inside a sentence
        }
        out.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
      return out;
    });
    check(small.length === 0, `${n}: no control under 24x24 at 390 px (${small.length}${small.length ? ': ' + small.slice(0, 4).join(', ') : ''})`);
    await page.context().close();
  }

  // 2
  let page = await prepPage(browser, base, { width: 1280, height: 800 });
  await page.goto(`${base}/index.html`);
  await settle(page, 800);
  const chips = await page.evaluate(() => [...document.querySelectorAll('.quick a')].map(a => ({
    t: a.textContent.trim(), href: a.getAttribute('href'), bottom: a.getBoundingClientRect().bottom, shown: !!(a.offsetWidth && a.offsetHeight), vh: innerHeight })));
  check(chips.length >= 6 && chips.length <= 8, `index: 6 to 8 popular chips (${chips.length})`);
  check(chips.every(c => c.shown && c.bottom > 0 && c.bottom <= c.vh), 'index: every chip is above the fold at 1280x800');
  for (const c of chips) {
    const p = path.join(SITE, decodeURIComponent(c.href));
    check(fs.existsSync(p), `index: chip "${c.t}" links an existing page (${c.href})`);
  }
  await page.context().close();
  page = await prepPage(browser, base, { width: 390, height: 844 });
  await page.goto(`${base}/index.html`);
  await settle(page, 800);
  const ov = await page.evaluate(() => {
    const f = document.querySelector('#filter').closest('.field').getBoundingClientRect();
    const a = document.querySelector('.a11y-toggle').getBoundingClientRect();
    return { overlap: !(a.right <= f.left || a.left >= f.right || a.bottom <= f.top || a.top >= f.bottom), fr: f.right, al: a.left };
  });
  check(!ov.overlap, `index at 390: the Aa button does not overlap the filter box (filter right ${Math.round(ov.fr)}, Aa left ${Math.round(ov.al)})`);
  await page.context().close();

  // 3
  for (const [w, narrow] of [[390, true], [1280, false]]) {
    page = await prepPage(browser, base, { width: w, height: 844 });
    await page.goto(`${base}/Tools/035-schedule-visualizer.html`);
    await settle(page, 1200);
    const m = await page.evaluate(() => {
      const hd = document.getElementById('app-header');
      const n = document.getElementById('narrow-notice');
      const bl = document.querySelector('#app-header .back-link');
      const cs = getComputedStyle(bl);
      const lum = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
      const bg = getComputedStyle(hd).backgroundColor;
      const l1 = lum(cs.color), l2 = lum(bg);
      return { hs: hd.scrollWidth, cw: document.documentElement.clientWidth, notice: getComputedStyle(n).display !== 'none', op: +cs.opacity,
        ratio: (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05), h1: document.querySelectorAll('h1').length };
    });
    check(m.hs <= m.cw, `035 at ${w}: header (${m.hs}px) fits the viewport (${m.cw}px)`);
    check(m.notice === narrow, `035 at ${w}: laptop/tablet notice ${narrow ? 'shown' : 'hidden'}`);
    check(m.op === 1 && m.ratio >= 4.5, `035 at ${w}: "← Toolkit" at ${m.ratio.toFixed(1)}:1, opacity ${m.op}`);
    check(m.h1 === 1, `035 at ${w}: one h1 (${m.h1})`);
    await page.context().close();
  }
} finally {
  await browser.close();
  srv.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
