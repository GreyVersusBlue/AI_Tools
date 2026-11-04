// smoke-brand.mjs — the school accent (Track B1 + B2), in _shared/a11y.js.
//
//   node Tools/theme/test/smoke-brand.mjs        (or: npm run test:brand)
//
// With no key the page must not change at all: no <style>, nothing stored.
// A bad key (corrupt, an old shape, a blocked localStorage) is "no brand" and
// never an error. A good key paints before first paint on an ink-paper tool
// and an Industry one, not on 007 (BRAND_OPT_OUT), not on paper (print), and
// a second tab follows a set and a reset live. The widget's section sets,
// derives, warns (without blocking) and resets without a reload, by keyboard.

import { readFileSync } from 'node:fs';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8622;
let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const KEY = 'gvb-brand:settings.v1';
const INK = '001-hall-pass-log.html';
const DS = '005-Seating%20Chart%20Generator.html';
const NP = '007-Name%20Picker.html';

const server = await serve(PORT);
const base = `http://127.0.0.1:${PORT}`;
const browser = await launch();

async function open(file, { store = {}, init, theme = 'light' } = {}) {
  const page = await prepPage(browser, base, { width: 1100, height: 900 });
  await page.addInitScript(([store, theme, init]) => {
    try {
      if (!localStorage.getItem('gvb-a11y-prefs')) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme, textScale: 100, dyslexic: false }));
      for (const k of Object.keys(store)) if (!sessionStorage.getItem('seeded')) localStorage.setItem(k, store[k]);
      sessionStorage.setItem('seeded', '1');
    } catch (e) {}
    if (init) new Function(init)();
  }, [store, theme, init]);
  await page.goto(`${base}/Tools/${file}`);
  await settle(page, 300);
  return page;
}
const accent = page => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
const dsAccent = page => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent-600').trim());
const hasStyle = page => page.evaluate(() => !!document.getElementById('gvb-brand-style'));
const good = JSON.stringify({ v: 1, accent: '#a31f34', updatedAt: '2026-10-30T00:00:00.000Z' });

console.log('Brand — no key changes nothing');
{
  const page = await open(INK);
  eq(await hasStyle(page), false, 'no <style> without a key');
  eq(await accent(page), '#1f3550', 'the stock accent is untouched');
  eq(await page.evaluate(k => localStorage.getItem(k), KEY), null, 'nothing is written');
  ok(await page.evaluate(() => typeof window.Brand.set === 'function' && window.Brand.get() === null), 'Brand is there and empty');
  eq(page.__errs.length, 0, 'no page errors: ' + page.__errs.join('|'));
  await page.context().close();
}

console.log('Brand — bad stored data is no brand, never an error');
for (const [name, val] of [
  ['corrupt JSON', '{not json'],
  ['an old shape (v 0)', JSON.stringify({ v: 0, accent: '#a31f34' })],
  ['no version', JSON.stringify({ accent: '#a31f34' })],
  ['an accent that is not #rrggbb', JSON.stringify({ v: 1, accent: 'red' })],
  ['a css injection attempt', JSON.stringify({ v: 1, accent: '#a31f34;}body{display:none}' })],
  ['an array', '[1,2]'],
  ['a bare string', '"#a31f34"'],
]) {
  const page = await open(INK, { store: { [KEY]: val } });
  eq(await hasStyle(page), false, `${name}: no <style>`);
  eq(await accent(page), '#1f3550', `${name}: stock accent`);
  eq(page.__errs.length, 0, `${name}: no errors: ` + page.__errs.join('|'));
  await page.context().close();
}
{
  const page = await open(INK, { init: "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})" });
  eq(await hasStyle(page), false, 'localStorage blocked: no <style>');
  eq(await accent(page), '#1f3550', 'localStorage blocked: stock accent');
  ok(await page.locator('.a11y-toggle').count() === 1, 'localStorage blocked: the widget still builds');
  await page.locator('.a11y-toggle').click();
  await page.locator('#a11y-brand-accent').evaluate(el => { el.value = '#a31f34'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  eq(await accent(page), '#a31f34', 'localStorage blocked: a pick still shows for the visit');
  ok(/would not save/.test(await page.locator('.a11y-brand-warn').textContent()), 'localStorage blocked: and says it will not be kept');
  await page.context().close();
}

console.log('Brand — a good key paints before first paint');
{
  const page = await open(INK, { store: { [KEY]: good } });
  eq(await accent(page), '#a31f34', '001 (ink-paper) takes the accent');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.btn-primary, button.primary, header, h1') || document.body).color !== undefined), 'page renders');
  const ink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-ink').trim());
  eq(ink, '#ffffff', 'text on a dark red fill is white');
  const a2 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim());
  ok(/^#[0-9a-f]{6}$/.test(a2) && a2 !== '#2e6b8f', 'accent-2 is derived: ' + a2);
  // before first paint: the style is in <head> at DOMContentLoaded-time, not added later
  eq(await page.evaluate(() => document.getElementById('gvb-brand-style').parentNode.tagName), 'HEAD', 'the style sits in <head>');
  await page.emulateMedia({ media: 'print' });
  eq(await accent(page), '#1f3550', 'print is unchanged');
  await page.emulateMedia({ media: 'screen' });
  await page.context().close();
}
{
  const page = await open(INK, { store: { [KEY]: good }, theme: 'dark' });
  const c = await accent(page);
  ok(/^#[0-9a-f]{6}$/.test(c) && c !== '#a31f34' && c !== '#7fb2e5', 'dark: the accent is lifted to read on the dark paper: ' + c);
  await page.context().close();
}
{
  const page = await open(DS, { store: { [KEY]: good } });
  eq(await dsAccent(page), '#a31f34', '005 (Industry) gets step 600 = the accent');
  const s500 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent-500').trim());
  ok(/^#[0-9a-f]{6}$/.test(s500) && s500 !== '#a31f34', 'and the neighbouring steps are derived: ' + s500);
  await page.context().close();
}
{
  const page = await open(NP, { store: { [KEY]: good } });
  eq(await hasStyle(page), false, '007 is opted out: no <style>');
  await page.locator('.a11y-toggle').click();
  ok(/keeps its own colours/.test(await page.locator('.a11y-brand').textContent()), '007 says so in the widget');
  await page.context().close();
}

console.log('Brand — the widget section');
{
  const page = await open(INK);
  await page.locator('.a11y-toggle').click();
  ok(await page.locator('.a11y-brand h3').textContent() === 'School branding', 'the section is there');
  eq(await page.locator('#a11y-brand-accent').inputValue(), '#1f3550', 'it shows the stock accent when nothing is set');
  ok(await page.locator('#a11y-brand-accent2').isDisabled(), 'the second colour is automatic by default');
  ok(await page.locator('.a11y-brand-reset').isDisabled(), 'Reset is disabled with nothing to reset');
  eq(await page.locator('.a11y-brand-warn').isVisible(), false, 'no warning for the stock colour');

  await page.locator('#a11y-brand-accent').evaluate(el => { el.value = '#a31f34'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  eq(await accent(page), '#a31f34', 'picking a colour shows it live');
  const stored = JSON.parse(await page.evaluate(k => localStorage.getItem(k), KEY));
  eq(stored.v, 1, 'stored: version'); eq(stored.accent, '#a31f34', 'stored: accent');
  eq('accent2' in stored, false, 'stored: no accent2 while it is automatic');
  ok(!await page.locator('.a11y-brand-reset').isDisabled(), 'Reset is enabled');

  await page.locator('#a11y-brand-auto').uncheck();
  ok(!await page.locator('#a11y-brand-accent2').isDisabled(), 'unchecking lets the teacher choose the second colour');
  await page.locator('#a11y-brand-accent2').evaluate(el => { el.value = '#226633'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  eq(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim()), '#226633', 'an override applies');
  eq(JSON.parse(await page.evaluate(k => localStorage.getItem(k), KEY)).accent2, '#226633', 'and is stored');
  await page.locator('#a11y-brand-auto').check();
  eq(JSON.parse(await page.evaluate(k => localStorage.getItem(k), KEY)).accent2, undefined, 'checking auto again drops the override');

  // the warning warns and does not block
  await page.locator('#a11y-brand-accent').evaluate(el => { el.value = '#ffe680'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  ok(/pale choice/.test(await page.locator('.a11y-brand-warn').textContent()), 'a pale colour is warned about');
  eq(await accent(page), '#ffe680', 'and is still applied');
  eq(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-ink').trim()), '#101720', 'text on a pale fill turns dark');
  eq(await page.locator('.a11y-brand-warn').getAttribute('role'), 'status', 'the warning is a live region');

  const v = await a11yScan(page, { impact: 'serious', include: '.a11y-brand' });
  eq(v.length, 0, 'axe finds nothing serious in the School branding group with a warning showing: ' + JSON.stringify(v));

  await page.locator('.a11y-brand-reset').click();
  eq(await accent(page), '#1f3550', 'Reset puts the stock accent back with no reload');
  eq(await hasStyle(page), false, 'and removes the <style>');
  eq(await page.evaluate(k => localStorage.getItem(k), KEY), null, 'and the key');
  eq(await page.locator('#a11y-brand-accent').inputValue(), '#1f3550', 'and the control');
  await page.context().close();
}

console.log('Brand — the widget still works by keyboard');
{
  const page = await open(INK);
  await page.locator('.a11y-toggle').focus();
  await page.keyboard.press('Enter');
  ok(await page.locator('.a11y-panel.open').count() === 1, 'Enter opens the panel');
  eq(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Decrease text size', 'focus lands on the first control as before');
  const reach = [];
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); reach.push(await page.evaluate(() => document.activeElement.id || document.activeElement.className)); }
  ok(['a11y-brand-accent', 'a11y-brand-auto'].every(id => reach.includes(id)), 'Tab reaches the new controls: ' + reach.join(', '));
  ok(!reach.includes('a11y-brand-accent2'), 'but skips the second colour while it is automatic');
  await page.keyboard.press('Escape');
  eq(await page.locator('.a11y-panel.open').count(), 0, 'Escape closes it');
  eq(await page.evaluate(() => document.activeElement.className), 'a11y-toggle', 'and gives focus back');
  const labels = await page.evaluate(() => ['a11y-brand-accent', 'a11y-brand-accent2', 'a11y-brand-auto'].map(id => document.querySelector(`label[for=${id}]`)?.textContent));
  ok(labels.every(Boolean), 'every new control has a label: ' + labels.join(' | '));
  await page.context().close();
}

console.log('Brand — a second tab follows live');
{
  const ctx = await browser.newContext();
  const one = await ctx.newPage(), two = await ctx.newPage();
  await one.goto(`${base}/Tools/${INK}`); await two.goto(`${base}/Tools/${DS}`);
  await settle(one, 300);
  await one.evaluate(() => window.Brand.set({ accent: '#a31f34' }));
  await two.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent-600').trim() === '#a31f34', null, { timeout: 5000 }).catch(() => {});
  eq(await dsAccent(two), '#a31f34', 'a set in one tab reaches the other');
  await two.evaluate(() => window.Brand.onChange(v => { window.__heard = v === null ? 'reset' : v.accent; }));
  await one.evaluate(() => window.Brand.reset());
  await two.waitForFunction(() => window.__heard === 'reset', null, { timeout: 5000 }).catch(() => {});
  eq(await two.evaluate(() => window.__heard), 'reset', 'onChange fires for a reset from another tab');
  eq(await hasStyle(two), false, 'and the colours are gone there');
  await ctx.close();
}

// AI-57 (review M2). --accent-ink is the text on an accent fill, and the brand
// re-picks it for the school colour; a gold school made it near-black, and 62
// pages drew it on --err as well (2.69 to 1 on 001's danger hover). Every rule
// that pairs a text token with a fill token is read off the page's own CSS and
// measured with and without a brand: a pair the brand changes must hold 4.5:1.
// A hover rule that sets only a fill takes its text from the same selector
// without :hover (001's `button:hover` over `button`).
const PAIR_PAGES = (await import('node:child_process')).execSync('git ls-files "Tools/*.html"', { encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter(f => { const s = (awaitRead(f)); return /ink-paper\.css/.test(s) && /a11y\.js/.test(s) && !/BRAND_OPT_OUT\s*=\s*true/.test(s); })
  .map(f => encodeURI(f.slice('Tools/'.length)));
function awaitRead(f) { return readFileSync(new URL('../../../' + f, import.meta.url), 'utf8'); }

async function tokenPairs(page) {
  return page.evaluate(() => {
    const rules = [];
    const walk = list => {
      for (const r of list) {
        if (r.media && !matchMedia(r.media.mediaText).matches) continue;
        if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; }
        if (r.selectorText && r.style) rules.push(r);
      }
    };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) {} }
    const colorOf = sel => { for (let i = rules.length - 1; i >= 0; i--) if (rules[i].selectorText === sel && /var\(--/.test(rules[i].style.getPropertyValue('color'))) return rules[i].style.getPropertyValue('color'); return ''; };
    const probe = document.createElement('div'); document.body.appendChild(probe);
    const rgb = v => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
    const out = [];
    for (const r of rules) {
      if (/printArea|paper-sheet|print/i.test(r.selectorText)) continue;
      const bg = r.style.getPropertyValue('background-color') || r.style.getPropertyValue('background');
      const m = /^\s*var\((--[\w-]+)\)\s*$/.exec(bg);
      if (!m) continue;
      let c = r.style.getPropertyValue('color');
      if (!c && /:hover/.test(r.selectorText)) c = colorOf(r.selectorText.replace(/:hover/g, ''));
      const t = /^\s*var\((--[\w-]+)\)\s*$/.exec(c);
      if (!t) continue;
      out.push({ sel: r.selectorText, fill: m[1], text: t[1], fillRgb: rgb(`var(${m[1]})`), textRgb: rgb(`var(${t[1]})`) });
    }
    probe.remove();
    return out;
  });
}
const lum = rgbStr => { const [r, g, b] = rgbStr.match(/[\d.]+/g).map(Number).map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// In light the accent written as text on a surface (`color: var(--accent)` on
// --card) is the teacher's own colour on white, which the widget's "pale
// choice" warning covers; those pairs are counted, not failed. In dark the
// brand lifts the accent itself, so there they must hold too.
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }
async function pairsOf(f, opts) { const page = await open(f, opts); try { return await tokenPairs(page); } finally { await page.context().close(); } }

console.log(`Brand — every text-on-fill pair the brand changes holds 4.5:1 (${PAIR_PAGES.length} pages)`);
for (const theme of ['light', 'dark']) {
  const stock = await pool(PAIR_PAGES, 4, f => pairsOf(f, { theme }));
  for (const b of [{ v: 1, accent: '#ffc72c' }, { v: 1, accent: '#ff8200' }, { v: 1, accent: '#006747' }, { v: 1, accent: '#ffc72c', accent2: '#ffe08a' }]) {
    const label = `${theme}, ${b.accent}${b.accent2 ? '+' + b.accent2 : ''}`;
    let checked = 0, owned = 0; const bad = [];
    const branded = await pool(PAIR_PAGES, 4, f => pairsOf(f, { theme, store: { [KEY]: JSON.stringify(b) } }));
    PAIR_PAGES.forEach((f, k) => {
      for (const p of branded[k]) {
        const was = stock[k].find(q => q.sel === p.sel && q.fill === p.fill && q.text === p.text);
        if (was && was.fillRgb === p.fillRgb && was.textRgb === p.textRgb) continue; // the brand did not touch it
        if (theme === 'light' && /^--accent(-2)?$/.test(p.text)) { owned++; continue; }
        checked++;
        const r = ratio(p.fillRgb, p.textRgb);
        if (r < 4.5) bad.push(`${decodeURI(f)} ${p.sel}: ${p.text} on ${p.fill} ${r.toFixed(2)}`);
      }
    });
    ok(checked > 100, `${label}: the sweep measured the pairs the brand changed (${checked}, and ${owned} accent-as-text pairs left to the widget's warning)`);
    ok(bad.length === 0, `${label}: ${bad.length} pairs under 4.5:1:\n    ` + bad.slice(0, 40).join('\n    '));
  }
}

console.log('Brand — the text on a status fill never follows the brand');
{
  const page = await open(INK, { store: { [KEY]: JSON.stringify({ v: 1, accent: '#ffc72c' }) } });
  await page.evaluate(() => { const b = document.createElement('button'); b.className = 'danger'; b.id = 'probe'; b.textContent = 'Delete'; document.body.prepend(b); });
  await page.hover('#probe');
  const [c, bg] = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('probe')); return [s.color, s.backgroundColor]; });
  ok(ratio(c, bg) >= 4.5, `001's danger button on hover, gold school: ${c} on ${bg} is ${ratio(c, bg).toFixed(2)} to 1`);
  await page.context().close();
}
for (const f of ['044-Sub%20Plan%20Builder.html', '032-School%20Calendar%20Visualizer.html', '046-blank-map-generator.html']) {
  for (const theme of ['light', 'dark']) {
    const page = await open(f, { theme, store: { [KEY]: JSON.stringify({ v: 1, accent: '#ffc72c' }) } });
    await page.evaluate(() => { const b = document.createElement('button'); b.className = 'primary'; b.id = 'probe'; b.textContent = 'Save'; document.body.prepend(b); });
    await page.hover('#probe');
    const [c, bg] = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('probe')); return [s.color, s.backgroundColor]; });
    ok(ratio(c, bg) >= 4.5, `${decodeURI(f)} primary button on hover, gold school, ${theme}: ${c} on ${bg} is ${ratio(c, bg).toFixed(2)} to 1`);
    await page.context().close();
  }
}

console.log('Brand — two school colours no one text colour reads on are warned about');
{
  const page = await open(INK);
  await page.locator('.a11y-toggle').click();
  await page.locator('#a11y-brand-accent').evaluate(el => { el.value = '#1f3550'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  eq(await page.locator('.a11y-brand-warn').textContent(), '', 'navy alone: no warning');
  await page.locator('#a11y-brand-auto').uncheck();
  await page.locator('#a11y-brand-accent2').evaluate(el => { el.value = '#ffc72c'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  ok(/Button text on the second colour/.test(await page.locator('.a11y-brand-warn').textContent()), 'navy with gold: the button text is warned about: ' + await page.locator('.a11y-brand-warn').textContent());
  const [ink2, a2] = await page.evaluate(() => ['--accent-2-ink', '--accent-2'].map(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()));
  eq(ink2, '#101720', 'and a fill that is only ever accent-2 still gets dark text on the gold (' + a2 + ')');
  await page.context().close();
}

await browser.close(); server.close();
console.log(`\nBrand: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
