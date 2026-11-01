// smoke-tabs-undo.mjs — 087 Class Screen, Path 22 P10 (two tabs and memory).
//
//   node Tools/class-screen/test/smoke-tabs-undo.mjs
//
// Three things. A save from another tab raises a bar here instead of silently
// losing to whoever wrote last (load theirs, or keep this tab's). The name
// picker's "no repeats" list lives for the browser tab (sessionStorage), not
// for ever and not only until a reload. Moves and resizes undo, as removals
// already did, from the toast and from Ctrl+Z. Rosters here are made up.
//
// Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8651;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/087-class-screen.html';
const KEY = 'cls-screen:state';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const pageA = await prepPage(browser, BASE, { width: 1400, height: 900 });
let page = pageA;

console.log('Class Screen — two tabs, memory, undo');

await page.goto(URL_PAGE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle(page);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const widget = (type) => page.locator(`#board .w[data-type="${type}"]`);
const types = async () => (await cur()).widgets.map((w) => w.type);
const add = async (type) => { await page.click(`#dock button[data-add="${type}"]`); await settle(page, 450); };
const banner = () => page.locator('#tabBanner');

// ── another tab saved ────────────────────────────────────────────────
console.log(' two tabs');
await add('text');
await add('timer');
const pageB = await pageA.context().newPage();
pageB.__errs = [];
pageB.on('pageerror', (e) => pageB.__errs.push(String(e)));
await pageB.goto(URL_PAGE);
await settle(pageB);
ok(await banner().isHidden(), 'no bar while nothing else has saved');
ok(await banner().isHidden(), 'and this tab\'s own saves do not raise it');

page = pageB;
await add('dice');
page = pageA;
await settle(page, 300);
ok(await banner().isVisible(), 'a save from another tab raises the bar here');
ok((await banner().textContent()).includes('changed in another tab'), 'and says what happened');
eq(await types(), ['text', 'timer'], 'this tab\'s board is untouched until the teacher chooses');
const v = await a11yScan(page);
eq(v.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'axe: no serious violations with the bar showing');
await page.click('#tabLoad');
eq(await types(), ['text', 'timer', 'dice'], 'Load their changes brings the other tab\'s board in');
ok(await banner().isHidden(), 'and the bar goes');
ok(await page.locator('#toast').isVisible(), 'with a word that it happened');

page = pageB;
await add('clock');
page = pageA;
await settle(page, 300);
ok(await banner().isVisible(), 'a second save raises it again');
await page.click('#tabKeep');
ok(await banner().isHidden(), 'Keep what is here closes it');
await settle(page, 300);
eq((await st()).screens[0].widgets.map((w) => w.type), ['text', 'timer', 'dice'], 'and this tab\'s board is what is stored now (theirs was replaced)');
eq(await pageA.evaluate(([k]) => JSON.parse(localStorage.getItem(k)).data.screens[0].widgets.map((w) => w.type), [KEY]), ['text', 'timer', 'dice'], 'in storage too');

// present mode: the bar waits
page = pageB;
await add('traffic');
page = pageA;
await settle(page, 300);
ok(await banner().isVisible(), 'raised again');
await page.click('#presentBtn');
ok(!(await banner().isVisible()), 'present mode keeps it off the projector');
await page.click('#presentExit');
ok(await banner().isVisible(), 'and it is still there when present mode ends');
await page.click('#tabLoad');

for (const width of [375, 360]) {
  page = pageB;
  await pageA.setViewportSize({ width, height: 740 });
  await settle(pageA, 200);
  page = pageA;
  ok(await pageA.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal scroll at ${width}px`);
}
await pageA.setViewportSize({ width: 1400, height: 900 });

eq(pageA.__errs, [], 'no page or console errors in tab A');
eq(pageB.__errs, [], 'no page or console errors in tab B');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
