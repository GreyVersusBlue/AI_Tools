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

await browser.close(); server.close();
console.log(`\nBrand: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
