// smoke-tap-targets.mjs — tap targets and the "Aa" button (AI-78, ML-20).
//
//   node Tools/tap-targets/test/smoke-tap-targets.mjs        (or: npm run test:tap-targets)
//
// 1. WCAG 2.2 target size (2.5.8, minimum 24 x 24 CSS px): on the Classroom Timer (004), the Sub
//    Plan Builder (044) and the Schedule Visualizer (035), at 390 px with touch, every visible
//    link, button, field, checkbox, summary and tabbable element is at least 24 x 24. (A label is
//    not counted: the control it names is the target. The page's own fixed Aa button is.)
// 2. The shared Aa button (`_shared/a11y.js`) is fixed to the bottom-right corner. On every page
//    that loads a11y.js, at 390 and at 1280 px, scrolled to the very end the button must not sit
//    over any visible text, link, button, field, image or canvas: the page reserves one button's
//    height after its content (`.a11y-reserve`), so the last controls can always be scrolled
//    clear. (While scrolling, a floating button passes over content; that cannot be avoided
//    and is not what this holds. The end of the page is where a control used to be stuck.)
// Port 8703.

import fs from 'node:fs';
import { serve, launch, prepPage, settle, SITE } from '../../board-check/harness.mjs';

const PORT = 8703;
const BASE = `http://127.0.0.1:${PORT}/`;
const MIN = 24, EPS = 0.1;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };

const SMALL = [
  ['004', '004-Classroom Timer.html'],
  ['044', '044-Sub Plan Builder.html'],
  ['035', '035-schedule-visualizer.html'],
];
const WITH_AA = fs.readdirSync(SITE + '/Tools').filter(f => /^\d.*\.html$/.test(f))
  .filter(f => /a11y\.js/.test(fs.readFileSync(SITE + '/Tools/' + f, 'utf8')));

const server = await serve(PORT);
const browser = await launch();
try {
  for (const [name, file] of SMALL) {
    const page = await prepPage(browser, BASE, { width: 390, height: 844, mobile: true });
    await page.goto(BASE + 'Tools/' + encodeURI(file));
    await settle(page, 400);
    const small = await page.evaluate(MIN => {
      const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[tabindex]:not([tabindex="-1"])';
      const out = [];
      for (const e of document.querySelectorAll(sel)) {
        if (e.checkVisibility && !e.checkVisibility({ contentVisibilityAuto: true, checkVisibilityCSS: true })) continue;
        const b = e.getBoundingClientRect();
        if (!b.width && !b.height) continue;
        if (b.width < MIN || b.height < MIN) {
          out.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} is ${Math.round(b.width * 10) / 10} x ${Math.round(b.height * 10) / 10}`
            + ` ("${(e.getAttribute('aria-label') || e.textContent || e.value || '').trim().slice(0, 24)}")`);
        }
      }
      return out;
    }, MIN - EPS);
    ok(small.length === 0, `${name} @390: every target is at least ${MIN} x ${MIN} px — under: ${small.join('; ')}`);
    await page.context().close();
  }

  const covered = [];
  let scanned = 0;
  for (const [w, h, mobile] of [[390, 844, true], [1280, 800, false]]) {
    for (const f of WITH_AA) {
      const page = await prepPage(browser, BASE, { width: w, height: h, mobile });
      await page.goto(BASE + 'Tools/' + encodeURI(f));
      await settle(page, 400);
      const hits = await page.evaluate(() => {
        const t = document.querySelector('.a11y-toggle');
        if (!t) return null;
        const root = document.documentElement;
        window.scrollTo({ top: Math.max(0, root.scrollHeight - innerHeight), behavior: 'instant' });
        const b = t.getBoundingClientRect(), out = [];
        for (const e of document.body.querySelectorAll('*')) {
          if (e.closest('.a11y-widget, .a11y-reserve')) continue;
          if (e.checkVisibility && !e.checkVisibility({ contentVisibilityAuto: true, checkVisibilityCSS: true, opacityProperty: false })) continue;
          const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (!hasText && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY|IMG|CANVAS)$/.test(e.tagName)) continue;
          const r0 = e.getBoundingClientRect();
          // the part of it a person can see: cut to every ancestor that scrolls or clips
          let r = { left: r0.left, right: r0.right, top: r0.top, bottom: r0.bottom };
          for (let a = e.parentElement; a && a !== document.documentElement && a !== document.body; a = a.parentElement) {
            const cs = getComputedStyle(a);
            if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
            const ab = a.getBoundingClientRect();
            r = { left: Math.max(r.left, ab.left), right: Math.min(r.right, ab.right), top: Math.max(r.top, ab.top), bottom: Math.min(r.bottom, ab.bottom) };
          }
          r.width = r.right - r.left; r.height = r.bottom - r.top;
          if (r.width > 0 && r.height > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) {
            out.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' "' + (e.textContent || '').trim().slice(0, 20) + '"');
          }
        }
        return out;
      });
      if (hits) { scanned++; if (hits.length) covered.push(`${f} @${w}: ${hits.slice(0, 3).join(', ')}`); }
      await page.context().close();
    }
  }
  ok(scanned > 150, `the Aa sweep reached ${scanned} page loads (expected ~176)`);
  ok(covered.length === 0, `Aa button covers content at the end of the page — ${covered.join(' | ')}`);
} finally {
  await browser.close(); server.close();
}
console.log(`tap targets: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
