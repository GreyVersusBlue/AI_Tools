// smoke-periods.mjs — 087 Class Screen's Path 22 P3 in a real browser:
// starter screens, linking a screen to a bell period, "Follow the bell", and
// exporting a screen (with its picture) to a file and importing it back.
//
//   node Tools/class-screen/test/smoke-periods.mjs
//
// The bell schedule is 010 Command Center's, so the suite seeds
// 'gvb-command-center:settings' the way 010 writes it. The page's clock is
// pinned (page.clock), and every period time is derived from that instant,
// so the suite passes at any hour — see CLAUDE.md on the command-center
// suites that failed after 23:20. Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook */
import fs from 'node:fs';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8444;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/087-class-screen.html';
const KEY = 'cls-screen:state';
const BELL_KEY = 'gvb-command-center:settings';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// 10:00 local on a fixed day: period 1 runs 09:30–10:20, period 2 10:25–11:15.
const T0 = new Date(2026, 8, 14, 10, 0, 0);
const BELL = { periods: [
  { id: 'p1', label: 'Period 1', start: '09:30', end: '10:20', roster: '' },
  { id: 'p2', label: 'Period 2', start: '10:25', end: '11:15', roster: '' }
] };

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (page.__promptAnswer ?? d.defaultValue()) : undefined));
await page.clock.install({ time: T0 });

console.log('Class Screen — periods, starters, files');

await page.goto(URL_PAGE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle(page);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const more = async (id) => { if (!(await page.locator('#moreMenu').evaluate((d) => d.open))) await page.click('#moreMenu summary'); await page.click(id); };

// ── no bell schedule yet ─────────────────────────────────────────────
eq(await page.locator('#periodSelect option').allTextContents(), ['No bell times'], 'without 010 bell times the period list says so');
ok(await page.locator('#followBell').isDisabled(), 'follow the bell is off without a schedule');

// ── starter screens ──────────────────────────────────────────────────
eq((await page.locator('#templateSelect option').allTextContents()).length, 7, 'six starters plus the prompt');
await page.selectOption('#templateSelect', 'donow');
await settle(page, 200);
let s = await st();
eq(s.screens.length, 2, 'a starter adds a screen');
eq((await cur()).name, 'Do Now', 'named after the starter');
eq(await page.locator('#board .w').count(), 4, 'with its widgets');
eq(await page.locator('#templateSelect').inputValue(), '', 'the starter picker resets');
eq(await page.locator('#board .w[data-type="text"] textarea').inputValue(), 'Do Now:\n', 'starter text is in place');
await page.selectOption('#templateSelect', 'donow');
eq((await cur()).name, 'Do Now 2', 'a second copy gets a unique name');
await page.selectOption('#templateSelect', 'groupwork');
eq(await page.locator('#board .w').count(), 5, 'group work starter');

// ── link screens to periods ──────────────────────────────────────────
await page.evaluate(([k, b]) => localStorage.setItem(k, JSON.stringify(b)), [BELL_KEY, BELL]);
await page.reload();
await settle(page, 300);
eq(await page.locator('#periodSelect option').allTextContents(), ['No period', 'Period 1 (09:30)', 'Period 2 (10:25)'], 'the bell periods are offered');
ok(await page.locator('#followBell').isEnabled(), 'follow the bell can be turned on');
s = await st();
const [first, doNow, doNow2, group] = s.screens;
await page.selectOption('#screenSelect', doNow.id);
await page.selectOption('#periodSelect', 'p1');
ok(/Period 1 now opens “Do Now”/.test(await page.locator('#toastText').textContent()), 'linking says what it did');
await page.selectOption('#screenSelect', group.id);
await page.selectOption('#periodSelect', 'p2');
await page.selectOption('#screenSelect', doNow2.id);
await page.selectOption('#periodSelect', 'p1');
ok(/not “Do Now”/.test(await page.locator('#toastText').textContent()), 'a period moves to the newest screen and says so');
s = await st();
eq(s.screens.map((x) => x.period), ['', '', 'p1', 'p2'], 'one screen per period');
ok((await page.locator('#screenSelect option').allTextContents()).includes('Do Now 2 (Period 1)'), 'the screen list shows the link');
eq(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), BELL_KEY)), BELL, 'the bell schedule is read, never written');

// ── follow the bell ──────────────────────────────────────────────────
await page.selectOption('#screenSelect', first.id);
await page.check('#followBell');
await settle(page, 100);
eq((await st()).current, doNow2.id, 'turning it on mid-period jumps to that period’s screen');
ok(/Period 1: showing “Do Now 2”/.test(await page.locator('#toastText').textContent()), 'and says why');
await page.selectOption('#screenSelect', first.id);
await page.clock.runFor(30000);
eq((await st()).current, first.id, 'between bells the teacher’s choice stands');
await page.clock.runFor(26 * 60 * 1000);           // 10:26 — period 2 has started
eq((await st()).current, group.id, 'the period 2 bell switches to its screen');
await page.reload();
await settle(page, 300);
eq((await st()).current, group.id, 'opening the page mid-period shows that period’s screen');
ok(await page.locator('#followBell').isChecked(), 'follow is saved');
await page.uncheck('#followBell');
await page.selectOption('#screenSelect', first.id);
await page.clock.runFor(60 * 60 * 1000);
eq((await st()).current, first.id, 'with follow off, bells change nothing');

// ── More menu ────────────────────────────────────────────────────────
await page.click('#moreMenu summary');
ok(await page.locator('#renameScreenBtn').isVisible(), 'More opens');
await page.keyboard.press('Escape');
ok(await page.locator('#renameScreenBtn').isHidden(), 'Escape closes it');
await page.click('#moreMenu summary');
await page.mouse.click(700, 500);
ok(await page.locator('#renameScreenBtn').isHidden(), 'a click elsewhere closes it');

// ── export and import, picture included ──────────────────────────────
await page.selectOption('#screenSelect', doNow2.id);
await page.click('#dock button[data-add="image"]');
const png = await page.evaluate(() => new Promise((res) => {
  const c = document.createElement('canvas'); c.width = 40; c.height = 30;
  const g = c.getContext('2d'); g.fillStyle = '#2e6b8f'; g.fillRect(0, 0, 40, 30);
  c.toBlob((b) => b.arrayBuffer().then((a) => res(Array.from(new Uint8Array(a)))), 'image/png');
}));
await page.locator('#board .w[data-type="image"] input[type="file"]').setInputFiles({ name: 'chart.png', mimeType: 'image/png', buffer: Buffer.from(png) });
await page.waitForSelector('#board .w[data-type="image"] img.pic', { timeout: 5000 }).catch(() => {});
await page.locator('#board .w[data-type="text"] textarea').fill('Do Now: finish the chart');
await settle(page, 400);
const [dl] = await Promise.all([page.waitForEvent('download'), more('#exportScreenBtn')]);
eq(dl.suggestedFilename(), 'class-screen-do-now-2.json', 'export file name from the screen name');
const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
eq(file.kind, 'gvb-class-screen', 'export kind');
eq(file.screen.period, '', 'the period link is not exported');
eq(Object.keys(file.media).length, 1, 'the picture travels in the file');
ok(/^data:image\/png;base64,/.test(Object.values(file.media)[0]), 'as an image data URL');

const before = (await st()).screens.length;
await page.setInputFiles('#importFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
await page.waitForFunction((n) => __classScreen.state().screens.length > n, before, { timeout: 5000 }).catch(() => {});
s = await st();
eq(s.screens.length, before + 1, 'import adds a screen');
const imported = s.screens.find((x) => x.id === s.current);
eq(imported.name, 'Do Now 3', 'with a unique name');
eq(imported.period, '', 'and no period');
ok(imported.widgets.every((w) => !s.screens.filter((x) => x !== imported).some((o) => o.widgets.some((v) => v.id === w.id))), 'fresh widget ids');
await page.waitForSelector('#board .w[data-type="image"] img.pic', { timeout: 5000 }).catch(() => {});
ok(await page.locator('#board .w[data-type="image"] img.pic').isVisible(), 'the imported picture shows');
const pics = await page.evaluate(() => MediaDB.store({ ns: 'class-screen' }).list().then((r) => r.length));
eq(pics, 2, 'stored as its own copy');
eq(await page.locator('#board .w[data-type="text"] textarea').inputValue(), 'Do Now: finish the chart', 'text came through');

await page.setInputFiles('#importFile', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": 1}') });
await settle(page, 300);
eq(await page.locator('#toastText').textContent(), 'That file is not a Class Screen export.', 'a stranger’s JSON is refused');
await page.setInputFiles('#importFile', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
await settle(page, 300);
eq(await page.locator('#toastText').textContent(), 'That file is not a Class Screen export.', 'not JSON is refused');
eq((await st()).screens.length, before + 1, 'refused files add nothing');

// ── accessibility, phone width, errors ───────────────────────────────
const violations = await a11yScan(page);
ok(violations.length === 0, 'axe: no serious/critical violations: ' + violations.map((v) => `${v.id} ${v.nodes.slice(0, 3).join(' ')}`).join('; '));
await page.click('#moreMenu summary');
const v2 = await a11yScan(page);
ok(v2.length === 0, 'axe with the menu open: ' + v2.map((v) => `${v.id} ${v.nodes.slice(0, 3).join(' ')}`).join('; '));
await page.keyboard.press('Escape');
await page.setViewportSize({ width: 375, height: 740 });
await settle(page, 200);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll at 375px');
ok(await page.evaluate((k) => !!localStorage.getItem(k), KEY), 'state saved');
eq(page.__errs, [], 'no page or console errors');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
