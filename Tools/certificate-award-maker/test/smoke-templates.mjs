// smoke-templates.mjs — 042's templates as data (cam-templates.js).
//
//   node Tools/certificate-award-maker/test/smoke-templates.mjs
//
// The five designs used to be CSS classes. They are data now, and the page draws a
// certificate from a template object. What this holds down:
//
//   The five built-ins draw exactly what the old classes drew (the literals below are the
//   old stylesheet's, computed by Chromium), so no saved preset changed its look.
//   A teacher's template is a font key, colours and a title look; saving one uses it, it
//   survives a reload, removing it puts Elegant back. Nothing typed or stored reaches the
//   page's CSS except a #rrggbb colour, a keyword or a number. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import '../cam-templates.js';

const T = globalThis.CertificateTemplates;
const PORT = 8633;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '042-certificate-award-maker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Certificate & Award Maker — templates as data');

/* ── pure ──────────────────────────────────────────────────────────────── */
eq(T.builtins().map(t => t.key).join(), 'playful,varsity,elegant,modern,ribbon', 'the five built-ins, in the old order');
eq(T.clean(null), null, 'nothing is not a template');
eq(T.clean({ label: 'no key' }), null, 'a template with no key is dropped');
eq(T.clean({ key: 'Bad Key!' }), null, 'a key with spaces or capitals is dropped');
const junk = T.clean({ key: 'x', label: '  A   b  ', font: 'comic; background:url(http://evil/x)', color: 'red;}', bg: ['#12345', 'javascript:1'],
  title: { color: 'expression(1)', transform: 'url(x)', style: 'oblique', weight: 'bold', spacing: '1px;x', size: 'huge' }, kicker: { color: '#GGGGGG' } });
eq(junk.label, 'A b', 'a label is trimmed to one-spaced text');
eq(junk.font, 'georgia', 'an unknown font falls back to a key, never the typed text');
eq(junk.color, '#333333', 'a bad colour falls back');
eq(JSON.stringify(junk.bg), '["#ffffff","#ffffff"]', 'a bad gradient pair falls back colour by colour');
ok(junk.title.transform === 'none' && junk.title.style === 'normal' && junk.title.weight === 700 && junk.title.spacing === 'none' && junk.title.size === 'medium', 'title keywords fall back');
eq(junk.title.color, '#333333', 'a bad title colour takes the ink');
const css = T.vars(junk);
ok(!/[<>{}]|url\(|expression|javascript|evil|comic/i.test(css), 'the style text holds nothing from the junk: ' + css);
for (const t of T.builtins()) ok(/^(--t-[a-z-]+:[^;{}<>"]+;)+$/.test(T.vars(t)), `${t.key}: vars are plain declarations`);
eq(T.list([{ key: 'elegant', label: 'Dupe' }, { key: 'mine', label: 'Mine' }, 7, null]).map(t => t.key).join(), 'playful,varsity,elegant,modern,ribbon,mine', 'a custom key that repeats a built-in is dropped, junk is skipped');
eq(T.list(new Array(30).fill(0).map((_, i) => ({ key: 'k' + i }))).length, 5 + T.MAX_CUSTOM, 'custom templates are capped');
eq(T.slug('  Spring Fling! '), 'spring-fling', 'a name makes a key');
eq(T.find(T.list([]), 'ribbon').seal.seal, 'gold', 'Ribbon still suggests its gold seal');

/* ── page ──────────────────────────────────────────────────────────────── */
const OLD = {   // read off the old .theme-* rules, as Chromium computes them
  playful: { color: 'rgb(224, 69, 155)', font: '"Trebuchet MS", "Segoe UI", sans-serif', bg: 'linear-gradient(135deg, rgb(255, 248, 240), rgb(255, 255, 255))', weight: '400', tColor: 'rgb(224, 69, 155)', tTransform: 'none', tStyle: 'normal', tWeight: '700', tSpacing: 'normal', kColor: 'rgb(255, 180, 0)' },
  varsity: { color: 'rgb(27, 58, 107)', font: '"Arial Black", Arial, sans-serif', bg: 'rgb(255, 255, 255)', weight: '400', tColor: 'rgb(27, 58, 107)', tTransform: 'uppercase', tStyle: 'normal', tWeight: '700', tSpacing: 'normal', kColor: 'rgb(200, 29, 37)' },
  elegant: { color: 'rgb(138, 109, 29)', font: 'Georgia, "Times New Roman", serif', bg: 'rgb(253, 250, 243)', weight: '400', tColor: 'rgb(31, 47, 77)', tTransform: 'none', tStyle: 'italic', tWeight: '700', tSpacing: 'normal', kColor: 'rgb(138, 109, 29)' },
  modern: { color: 'rgb(15, 118, 110)', font: '"Segoe UI", system-ui, sans-serif', bg: 'rgb(255, 255, 255)', weight: '300', tColor: 'rgb(22, 33, 31)', tTransform: 'none', tStyle: 'normal', tWeight: '300', tSpacing: '1.664px', kColor: 'rgb(15, 118, 110)' },
  ribbon: { color: 'rgb(30, 58, 95)', font: 'Georgia, "Times New Roman", serif', bg: 'rgb(255, 255, 255)', weight: '400', tColor: 'rgb(30, 58, 95)', tTransform: 'none', tStyle: 'normal', tWeight: '700', tSpacing: 'normal', kColor: 'rgb(176, 141, 47)' },
};
const preset = extra => ({
  name: 'T', theme: 'elegant', border: 'double-line', logo: '', mode: 'single', studentName: 'Avery Quill',
  batchNames: '', awardTitle: 'Certificate of Achievement', awardTitleCustom: '', reason: 'For outstanding effort',
  certDate: '2026-09-28', signature: 'Ms. Invented', signatureImage: '', qrUrl: '', orientation: 'landscape', perPage: 1,
  showGuides: false, stockInset: 0, ...extra,
});

const server = await serve(PORT);
const browser = await launch();
async function open(set, templates, size = { width: 1200, height: 900 }) {
  const page = await prepPage(browser, BASE, size);
  await page.addInitScript(([s, tpl]) => {
    if (sessionStorage.getItem('seeded')) return;   // seed once: a reload must see what the page saved
    sessionStorage.setItem('seeded', '1');
    if (s) {
      localStorage.setItem('gvb-certificate-maker:list', JSON.stringify(['T']));
      localStorage.setItem('gvb-certificate-maker:current', 'T');
      localStorage.setItem('gvb-certificate-maker:data:T', s);
    }
    if (tpl) localStorage.setItem('gvb-certificate-maker:templates', tpl);
  }, [set ? JSON.stringify(set) : null, templates || null]);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
const look = page => page.evaluate(() => {
  const c = document.querySelector('#previewArea .cert'), cs = getComputedStyle(c);
  const t = getComputedStyle(c.querySelector('.cert-title')), k = getComputedStyle(c.querySelector('.cert-kicker'));
  return { color: cs.color, font: cs.fontFamily, bg: cs.backgroundImage !== 'none' ? cs.backgroundImage : cs.backgroundColor, weight: cs.fontWeight,
    tColor: t.color, tTransform: t.textTransform, tStyle: t.fontStyle, tWeight: t.fontWeight, tSpacing: t.letterSpacing, kColor: k.color, tSize: t.fontSize };
});

for (const key of Object.keys(OLD)) {
  const page = await open(preset({ theme: key }));
  const got = await look(page);
  const { tSize, ...rest } = got;
  eq(JSON.stringify(rest), JSON.stringify(OLD[key]), `${key}: draws what the old class drew`);
  eq(tSize, '41.6px', `${key}: the title is still 2.6rem`);
  eq(page.__errs.length, 0, `${key}: no console errors ${JSON.stringify(page.__errs.slice(0, 2))}`);
  await page.close();
}

// Make a template on the page.
let page = await open(preset());
ok(await page.isHidden('#tplRemove'), 'no Remove button while a built-in is chosen');
await page.click('#tplMaker summary');
await page.fill('#tplName', 'Spring Fling');
await page.selectOption('#tplFont', 'courier');
await page.fill('#tplInk', '#2f6b2f');
await page.fill('#tplBg', '#f4fff0');
await page.fill('#tplTitleColor', '#aa3377');
await page.fill('#tplKickerColor', '#d97706');
await page.selectOption('#tplTitleStyle', 'caps');
await page.selectOption('#tplTitleSize', 'large');
await page.click('#tplSave');
await settle(page, 300);
let l = await look(page);
eq(l.color, 'rgb(47, 107, 47)', 'the saved template is drawn: ink');
ok(l.font.startsWith('"Courier New"'), 'its font: ' + l.font);
eq(l.bg, 'rgb(244, 255, 240)', 'its paper');
eq(l.tColor, 'rgb(170, 51, 119)', 'its title colour');
eq(l.tTransform, 'uppercase', 'its title in capitals');
eq(l.tSize, '49.6px', 'its larger title');
eq(l.kColor, 'rgb(217, 119, 6)', 'its small line');
eq(await page.$$eval('#themeSwatches .swatch, #themeSwatches > *', e => e.length), 6, 'the picker now offers six');
ok((await page.textContent('#themeSwatches')).includes('Spring Fling'), 'and names it');
ok(await page.isVisible('#tplRemove'), 'Remove shows for a template of your own');
const stored = await page.evaluate(() => localStorage.getItem('gvb-certificate-maker:templates'));
ok(/"key":"my-spring-fling"/.test(stored) && !/cert|<|url\(/.test(stored), 'what is stored is the template object only');
// The printed copy carries it too.
await page.evaluate(() => { window.print = () => {}; });
const printed = await page.evaluate(() => { const b = document.getElementById('printBtn'); b.click(); const c = document.querySelector('#printArea .cert'); return c ? c.getAttribute('style') : ''; });
ok(/--t-ink:#2f6b2f/.test(printed), 'the print area certificate carries the template: ' + printed.slice(0, 80));

// Reload: still there, still chosen.
await page.reload({ waitUntil: 'load' }); await settle(page, 300);
l = await look(page);
eq(l.color, 'rgb(47, 107, 47)', 'after a reload the preset still draws it');
// Remove it.
page.once('dialog', d => d.accept());
await page.click('#tplMaker summary').catch(() => {});
await page.click('#tplRemove');
await settle(page, 300);
l = await look(page);
eq(JSON.stringify([l.color, l.tStyle]), JSON.stringify([OLD.elegant.color, 'italic']), 'removing it puts Elegant back');
eq(await page.evaluate(() => localStorage.getItem('gvb-certificate-maker:templates')), null, 'and clears the key');
await page.close();

// A preset naming a template that no longer exists, and a hostile stored template.
page = await open(preset({ theme: 'my-gone' }), JSON.stringify({ v: 1, templates: [
  { key: 'evil', label: 'Evil', font: 'x}body{display:none}', color: 'red;}', bg: 'url(http://evil.example/a.png)', title: { color: '</style><script>1</script>' } },
  { key: 'elegant', label: 'Takes over Elegant', color: '#000000' }] }));
l = await look(page);
eq(l.color, OLD.elegant.color, 'a missing template falls back to Elegant');
eq(await page.evaluate(() => getComputedStyle(document.body).display !== 'none'), true, 'a hostile stored font cannot reach the page CSS');
ok((await page.textContent('#themeSwatches')).includes('Evil'), 'the hostile template is cleaned, not dropped');
ok(!(await page.textContent('#themeSwatches')).includes('Takes over'), 'a stored template cannot replace a built-in');
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));
await page.close();

// Ribbon suggests a seal; a seal already chosen stays.
page = await open(preset());
const savedSeal = () => page.evaluate(() => { const d = JSON.parse(localStorage.getItem('gvb-certificate-maker:data:T')); return d.seal + '/' + d.ribbon; });
await page.click('#themeSwatches >> text=Ribbon');
await settle(page, 200);
eq(await savedSeal(), 'gold/blue', 'picking Ribbon with no seal puts the gold seal and blue ribbon on');
await page.click('#themeSwatches >> text=Varsity');
await page.click('#sealSwatches >> text=Silver');
await page.click('#themeSwatches >> text=Ribbon');
await settle(page, 200);
eq((await savedSeal()).split('/')[0], 'silver', 'a seal already chosen is left alone');
await page.close();

// 360 px.
page = await open(preset(), null, { width: 360, height: 800 });
await page.click('#tplMaker summary');
await settle(page, 200);
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(over <= 1, `the maker fits at 360 px (${over}px over)`);
await page.close();

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
