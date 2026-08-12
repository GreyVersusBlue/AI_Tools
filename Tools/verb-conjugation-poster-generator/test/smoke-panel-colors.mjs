// smoke-panel-colors.mjs — per-panel accent colors on the conjugation poster.
//
//   node Tools/verb-conjugation-poster-generator/test/smoke-panel-colors.mjs
//
// The poster is a wall reference, so a teacher standing at the back of the
// room has to be able to find the -ER panel without reading it. Each panel now
// carries an accent — border plus a tinted heading band — assigned round the
// palette by panel order, overridable per panel, and switchable off entirely.
// What this suite holds down:
//
//   Auto assignment really varies by panel, and a per-panel override really
//   wins over it, in the printed DOM and not just in the builder.
//
//   Turning color-coding off returns every panel to plain black, so the
//   ink-conscious case is one checkbox and not a per-panel sweep.
//
//   Posters saved before this feature existed pick the accents up on load
//   instead of printing plain forever — the old `vcp_poster_v1` blob has
//   neither field.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8179;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/079-verb-conjugation-poster-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 950 });

/** Print into #printArea (with window.print stubbed) and report each panel's
 *  accent id, border color and heading band. */
async function printedPanels(p = page) {
  await p.evaluate(() => { window.print = function () {}; });
  await p.click('#printBtn');
  await settle(p);
  return p.evaluate(() => Array.from(document.querySelectorAll('#printArea .poster-panel')).map(el => ({
    accent: el.getAttribute('data-accent'),
    border: el.style.borderColor,
    band: el.querySelector('h3').style.backgroundColor,
    text: el.querySelector('h3').textContent,
  })));
}

const builderSwatches = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('.panel-block .swatch')).map(s => s.style.borderColor));

console.log('Verb Conjugation Poster — per-panel accent colors');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* ── 1. accents are on by default and vary by panel ──────────────────────── */
ok(await page.isChecked('#colorPanels'), 'color-coding is on for a new poster');
const first = await printedPanels();
eq(first.length, 3, 'the default Spanish present-tense poster prints its three panels');
eq(new Set(first.map(p => p.accent)).size, 3, 'each verb-ending group gets its own accent: ' + JSON.stringify(first.map(p => p.accent)));
ok(first.every(p => p.border && p.border !== 'rgb(51, 51, 51)'), 'every panel border takes its accent');
ok(first.every(p => p.band && p.band !== 'transparent'), 'every heading band is tinted');

/* the builder shows the same accents, so the choice is visible before printing */
eq((await builderSwatches()).length, 3, 'the builder shows one swatch per panel');

/* ── 2. a per-panel override beats the automatic assignment ──────────────── */
await page.selectOption('.panel-block:nth-of-type(2) select[data-panel-color]', 'purple');
await settle(page);
const overridden = await printedPanels();
eq(overridden[1].accent, 'purple', 'the second panel prints in the color it was given');
eq(overridden[0].accent, first[0].accent, 'the panels left on Auto keep their assignment');

/* ── 3. the override survives a reload ───────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await page.inputValue('.panel-block:nth-of-type(2) select[data-panel-color]'), 'purple', 'the per-panel pick is saved with the poster');
eq((await printedPanels())[1].accent, 'purple', 'and still prints that way');

/* ── 4. one checkbox turns the whole thing off ───────────────────────────── */
await page.uncheck('#colorPanels');
await settle(page);
const plain = await printedPanels();
ok(plain.every(p => p.accent === 'none'), 'no panel claims an accent with color-coding off');
ok(plain.every(p => p.border === 'rgb(51, 51, 51)'), 'borders go back to plain black: ' + JSON.stringify(plain.map(p => p.border)));
ok(plain.every(p => p.band === 'transparent'), 'heading bands go back to no fill');
ok(plain.every(p => p.text), 'the panel names — which is what actually says -AR from -ER — are untouched');

await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await page.isChecked('#colorPanels'), false, 'the off switch is remembered across a reload');
await page.check('#colorPanels');
await settle(page);

/* ── 5. a new panel joins the rotation ───────────────────────────────────── */
await page.click('#addPanelBtn');
await settle(page);
const four = await printedPanels();
eq(four.length, 4, 'the added panel prints');
eq(new Set(four.map(p => p.accent)).size, 4, 'and takes an accent none of the others is using');

/* ── 6. a poster saved before accents existed picks them up ──────────────── */
const old = await prepPage(browser, BASE, { width: 1400, height: 950 });
await old.goto(URL_PAGE, { waitUntil: 'networkidle' });
await old.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('vcp_poster_v1', JSON.stringify({
    title: 'Imperfect Tense',
    persons: ['yo', 'tú'],
    panels: [
      { id: 'p1', name: '-AR: hablar', forms: ['hablaba', 'hablabas'] },
      { id: 'p2', name: '-ER: comer', forms: ['comía', 'comías'] }
    ]
  }));
});
await old.reload({ waitUntil: 'networkidle' });
await settle(old);
ok(await old.isChecked('#colorPanels'), 'an old poster opens with color-coding on');
const upgraded = await printedPanels(old);
eq(upgraded.map(p => p.text).join(' | '), '-AR: hablar | -ER: comer', 'the old poster\'s content is intact');
eq(new Set(upgraded.map(p => p.accent)).size, 2, 'and its panels now carry distinct accents');
eq(await old.evaluate(() => JSON.parse(localStorage.getItem('vcp_poster_v1')).panels.map(p => p.color).join(',')),
   'auto,auto', 'the upgrade is written back to storage as an explicit Auto');

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
for (const [label, p] of [['main', page], ['upgrade', old]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
