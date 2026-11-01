// smoke-math.mjs — the formula sheet's local math notation (fsb-math.js) and its use on the page.
//
//   node Tools/formula-sheet-builder/test/smoke-math.mjs
//
// Pure half: the parser's output for each mark, the fallbacks, the escaping.
// Page half: a typed formula is drawn as a stacked fraction / root / super- and subscript on the
// sheet, in the editor list and in the picker; a plain formula (every shipped template) comes out
// byte-for-byte as before; nothing leaves the site; 360 px does not scroll sideways.
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import '../fsb-math.js';

const M = globalThis.FsbMath;
const PORT = 8632;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/041-formula-sheet-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Formula Sheet Builder — math notation');

/* ── pure: plain text is untouched ─────────────────────────────────────── */
eq(M.toHtml('A = ½ (b₁ + b₂) h'), 'A = ½ (b₁ + b₂) h', 'plain text with Unicode marks comes back as it was');
eq(M.toHtml('a < b & "c"'), 'a &lt; b &amp; &quot;c&quot;', 'plain text is escaped the way the page escapes it');
eq(M.hasMarkup('A = πr²'), false, 'no marks, no markup');
eq(M.toText('A = s²'), 'A = s²', 'toText of plain text is the text');

/* ── pure: each mark ───────────────────────────────────────────────────── */
const frac = M.toHtml('V = \\frac{4}{3} \\pi r^3');
ok(frac.includes('<span class="fm-num">4</span><span class="fm-den">3</span>'), 'a fraction has its numerator over its denominator');
ok(frac.includes('π'), '\\pi is the Greek letter');
ok(frac.includes('<sup class="fm-sup">3</sup>'), 'a one-character superscript');
ok(M.toHtml('x^{n+1}').includes('<sup class="fm-sup">n+1</sup>'), 'a braced superscript');
ok(M.toHtml('x_{ab}').includes('<sub class="fm-sub">ab</sub>'), 'a braced subscript');
ok(M.toHtml('v_0').includes('<sub class="fm-sub">0</sub>'), 'a one-character subscript');
const root = M.toHtml('\\sqrt{a^2 + b^2}');
ok(root.includes('class="fm-root"') && root.includes('<span class="fm-rb">a<sup class="fm-sup">2</sup> + b<sup class="fm-sup">2</sup></span>'), 'a root covers its whole radicand, with notation inside');
ok(M.toHtml('\\sqrt[3]{x}').includes('<sup class="fm-rootidx">3</sup>'), 'a cube root carries its index');
ok(M.toHtml('\\frac{\\sqrt{2}}{2}').includes('fm-root'), 'a root inside a fraction');
ok(M.toHtml('x^\\alpha').includes('<sup class="fm-sup">α</sup>'), 'a Greek letter as an exponent');
eq(M.toText('\\frac{a}{b}'), '(a)/(b)', 'the spoken text of a fraction');
eq(M.toText('\\sqrt{x}'), 'square root of (x)', 'the spoken text of a root');
ok(M.toHtml('\\frac{a}{b}').includes('aria-label="(a)/(b)"'), 'drawn notation carries a plain-text label');
eq(M.toText('snake\\_case \\^ \\{ \\\\'), 'snake_case ^ { \\', 'escapes give the literal characters');

/* ── pure: unreadable notation falls back to the text typed ────────────── */
for (const bad of ['\\frac{1}', '\\frac{1}{2', 'x^', 'x^{2', '\\sqrt x', '\\bogus{1}', 'a}b ^2', '\\sqrt[abcd]{x}', 'x^^2']) {
  eq(M.toHtml(bad), bad.replace(/&/g, '&amp;'), `unreadable "${bad}" is shown as typed`);
}
const deep = '{'.repeat(9) + 'x' + '}'.repeat(9) + '^2';
eq(M.toHtml(deep), deep, 'nesting past the limit is shown as typed');
eq(M.toHtml('<img src=x onerror=1>^2').includes('<img'), false, 'markup in a formula is escaped, not run');
ok(M.toHtml('\\frac{<b>}{x}').includes('&lt;b&gt;'), 'markup inside a fraction is escaped too');

/* ── page ──────────────────────────────────────────────────────────────── */
const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);

// A shipped template prints the same as the text it holds.
const templates = await page.$$eval('#templatePicker option', els => els.map(o => o.value).filter(Boolean));
await page.selectOption('#templatePicker', templates[0]);
await page.click('#loadTemplateBtn');
await settle(page, 500);
eq(await page.$$eval('#previewArea .fexpr .fm', e => e.length), 0, 'a template with plain formulas draws no notation');
const firstExpr = await page.$eval('#previewArea .fexpr', e => e.textContent);
ok(firstExpr.length > 2, 'and its text is there: ' + firstExpr);

// Add typed formulas.
async function add(name, expr) {
  await page.fill('#newName', name);
  await page.fill('#newExpr', expr);
  await page.click('#addItemBtn');
  await settle(page, 200);
}
await add('Sphere volume', 'V = \\frac{4}{3} \\pi r^3');
await add('Pythagoras', 'c = \\sqrt{a^2 + b^2}');
await add('Motion', 'x = x_0 + v_0 t');
await add('Broken', '\\frac{1}');

const sheetFm = await page.$$eval('#previewArea .fexpr', els => els.map(e => ({ fm: !!e.querySelector('.fm'), text: e.textContent })));
const sphere = sheetFm[sheetFm.length - 4], pyth = sheetFm[sheetFm.length - 3], motion = sheetFm[sheetFm.length - 2], broken = sheetFm[sheetFm.length - 1];
ok(sphere.fm && pyth.fm && motion.fm, 'the three typed formulas are drawn as notation on the sheet');
eq(broken.fm, false, 'the unreadable one is not');
eq(broken.text, '\\frac{1}', 'and shows what was typed');

// The fraction is really stacked: numerator above denominator, the bar between.
const geo = await page.evaluate(() => {
  const n = document.querySelector('#previewArea .fm-num').getBoundingClientRect();
  const d = document.querySelector('#previewArea .fm-den').getBoundingClientRect();
  const sup = document.querySelector('#previewArea .fm-sup');
  return { stacked: n.bottom <= d.top + 1 && d.top - n.top > 6, nw: n.width, dw: d.width,
           bar: getComputedStyle(document.querySelector('#previewArea .fm-num')).borderBottomWidth,
           supSize: parseFloat(getComputedStyle(sup).fontSize), baseSize: parseFloat(getComputedStyle(sup.parentElement).fontSize),
           rb: getComputedStyle(document.querySelector('#previewArea .fm-rb')).borderTopWidth };
});
ok(geo.stacked, 'the numerator sits above the denominator');
ok(parseFloat(geo.bar) > 0, 'a bar is drawn between them');
ok(geo.supSize < geo.baseSize, 'a superscript is smaller than the line');
ok(parseFloat(geo.rb) > 0, 'a root has its bar over the radicand');

// The editor list and the saved sheet keep the typed text, not the markup.
const listText = await page.$$eval('#itemsList .item-expr', els => els.map(e => e.textContent));
ok(listText.length >= 4, 'the editor lists the formulas');
const stored = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).map(k => localStorage.getItem(k))));
ok(stored.includes('\\\\frac{4}{3}') || stored.includes('\\frac{4}{3}'), 'what is saved is the typed notation');
ok(!stored.includes('fm-frac'), 'and no markup is saved');

// 360 px: nothing scrolls sideways.
await page.setViewportSize({ width: 360, height: 800 });
await settle(page, 300);
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(over <= 1, `no sideways scroll at 360 px (${over}px over)`);

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
