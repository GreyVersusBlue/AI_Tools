// smoke-theme-packs.mjs — Name Picker: importing, using, exporting and removing a theme pack on the real page.
//
//   node Tools/name-picker/test/smoke-theme-packs.mjs
//
// Path 15 P5. A good pack's theme shows in the Theme list under "Theme packs", paints the board with its colours,
// survives a reload, exports back to the same file and goes when removed. A pack with a url() colour or a property
// outside the whitelist imports nothing and says why.

import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, prepPage, settle, downloadText, a11yScan } from '../../board-check/harness.mjs';
import { THEMES } from '../np-themes.js';

const PORT = 8610;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

const dir = fs.mkdtempSync(path.join(process.env.HOME + '/.cache/selector-scratch/AI-23/', 'packs-'));
const write = (name, obj) => { const f = path.join(dir, name); fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); return f; };
const rome = { ...THEMES.classroom, '--bg': '#112233' };
const goodFile = write('rome.json', { v: 1, name: 'Ancient Rome', themes: { forum: rome } });
const urlFile = write('url.json', { v: 1, name: 'Sneaky', themes: { t: { ...rome, '--bg': 'url(https://example.com/a.png)' } } });
const propFile = write('prop.json', { v: 1, name: 'Sneaky2', themes: { t: { ...rome, 'background-image': '#000000' } } });
const junkFile = write('junk.json', 'this is not json');

const server = await serve(PORT);
const browser = await launch();
try {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
  const importPack = async (file) => {
    await page.click('#settingsBtn'); await settle(page, 200);
    await page.click('[data-tab="options"]'); await settle(page, 200);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#importPackBtn')]);
    await chooser.setFiles(file);
    await settle(page, 500);
    return (await page.textContent('#packStatus')).trim();
  };
  const stored = () => page.evaluate(() => localStorage.getItem('np_theme_packs'));

  ok(await page.$$eval('#packThemeGroup', e => e.length) === 0, 'no theme-pack group before an import');
  for (const [f, label] of [[urlFile, 'a url() colour'], [propFile, 'a property outside the whitelist'], [junkFile, 'text that is not JSON']]) {
    const say = await importPack(f);
    ok(/Nothing was imported|not valid JSON/.test(say), label + ' is refused with a sentence: ' + say.slice(0, 80));
    ok((await stored()) === null, label + ' stores nothing');
    ok(await page.$$eval('#packThemeGroup', e => e.length) === 0, label + ' adds no theme');
  }
  const say = await importPack(goodFile);
  ok(/Imported the pack Ancient Rome \(1 theme\)/.test(say), 'a good pack is imported: ' + say);
  ok(await page.$$eval('#packThemeGroup option', o => o.map(x => x.textContent).join() === 'Forum — Ancient Rome'), 'its theme is listed under Theme packs');
  ok((await page.textContent('#packList')).includes('Ancient Rome (1 theme)'), 'the pack is listed with Export and Remove');

  await page.keyboard.press('Escape'); await settle(page, 200);
  await page.selectOption('#theme', 'pk-ancient-rome-forum');
  await settle(page, 200);
  const css = () => page.evaluate(() => ({ bg: document.documentElement.style.getPropertyValue('--bg'), fill: document.documentElement.style.getPropertyValue('--accent-fill'), stored: localStorage.getItem('np_theme') }));
  let c = await css();
  ok(c.bg === '#112233', 'choosing it paints the board with the pack\'s --bg: ' + c.bg);
  ok(c.fill === THEMES.classroom['--accent'], '--accent-fill falls back to the accent: ' + c.fill);
  ok(c.stored === 'pk-ancient-rome-forum', 'np_theme holds the pack theme id');

  await page.reload({ waitUntil: 'networkidle' }); await settle(page, 300);
  c = await css();
  ok(c.bg === '#112233' && (await page.inputValue('#theme')) === 'pk-ancient-rome-forum', 'a reload keeps the pack theme chosen');

  await page.click('#settingsBtn'); await settle(page, 200);
  await page.click('[data-tab="options"]'); await settle(page, 200);
  { const v = await a11yScan(page, { impact: 'serious', include: '#packList' }); ok(v.length === 0, 'the pack list has no serious a11y violation: ' + JSON.stringify(v).slice(0, 400)); }
  const exported = await downloadText(page, '#packList button:not(.btn-danger)', { what: 'the exported pack' });
  const back = JSON.parse(exported);
  ok(back.v === 1 && back.name === 'Ancient Rome' && back.themes.forum['--bg'] === '#112233', 'Export writes the pack back out');
  ok(Object.keys(back.themes.forum).length === 11, 'with all eleven colours');

  page.once('dialog', d => d.accept());
  await page.click('#packList .btn-danger');
  await settle(page, 400);
  ok(await page.$$eval('#packThemeGroup', e => e.length) === 0, 'Remove takes the theme out of the list');
  ok((await page.inputValue('#theme')) === 'default', 'and puts the board back on the default theme');
  c = await css();
  ok(c.bg === THEMES.default['--bg'] && c.stored === 'default', 'painted and stored as default: ' + c.bg + ' ' + c.stored);
  await page.context().close();
} finally {
  await browser.close();
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
