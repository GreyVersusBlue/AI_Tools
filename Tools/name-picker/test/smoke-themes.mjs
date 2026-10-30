// smoke-themes.mjs — Name Picker: picking a theme in the page writes what np-themes.js says.
//
//   node Tools/name-picker/test/smoke-themes.mjs
//
// Path 15 P1 step 1: the page imports THEMES from np-themes.js instead of holding the
// object inline. For every theme in the select, the page must write each custom property
// on <html>, name the theme on <body>, and keep the choice across a reload.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { THEMES, themeVars } from '../np-themes.js';

const PORT = 8603;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
await page.click('#settingsBtn');
await settle(page, 300);

const options = await page.$$eval('#theme option', os => os.map(o => o.value).filter(v => v !== 'retro'));
ok(JSON.stringify(options.filter(v => v in THEMES)) === JSON.stringify(Object.keys(THEMES)),
   'the select offers every theme in np-themes.js: ' + JSON.stringify(options));

for (const n of Object.keys(THEMES)) {
  await page.selectOption('#theme', n);
  await settle(page, 50);
  const got = await page.evaluate(vars => ({
    vars: Object.fromEntries(Object.keys(vars).map(k => [k, document.documentElement.style.getPropertyValue(k)])),
    cls: [...document.body.classList].filter(c => c.startsWith('theme-')),
  }), themeVars(n));
  ok(JSON.stringify(got.vars) === JSON.stringify(themeVars(n)), n + ': every property is written on <html>');
  ok(JSON.stringify(got.cls) === JSON.stringify(['theme-' + n]), n + ': body carries only its own theme class');
}
await page.selectOption('#theme', 'ocean');
await settle(page, 100);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
ok(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg')) === THEMES.ocean['--bg'], 'the chosen theme survives a reload');

await browser.close();
server.close && server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
