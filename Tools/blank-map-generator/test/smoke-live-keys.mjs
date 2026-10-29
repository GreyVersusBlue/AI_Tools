// smoke-live-keys.mjs — keyboard pan and zoom on 046's map, and what a screen reader hears (Path 20 P3, step 3).
//
//   node Tools/blank-map-generator/test/smoke-live-keys.mjs   (npm run test:blank-map-live-keys, port 8586)
//
// Tab reaches the map; its role, roledescription and name are set. Arrows pan by a tenth of the
// viewport and Shift-arrows by half, in the direction the key points; + - 0 zoom and fit; with a
// label selected the arrows nudge it and do not pan; the status line, 500 ms after the last change,
// says the zoom and (for a map drawn from the vectors) the longitude and latitude on screen, which
// is computed here independently from the saved view and the preset's bounds; a data-shaded map
// is drawn live too (since v430) and names its window like a plain one.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8586;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Blank Map — keyboard pan and zoom');
const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 950 });
await page.goto(BASE + '/Tools/046-blank-map-generator.html', { waitUntil: 'networkidle' });
await settle(page, 700);
await page.selectOption('#baseMapSelect', 'usa-48');
await page.click('#btnBaseMap');
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 20000 });
await settle(page, 300);

const view = () => page.evaluate(() => { const k = Object.keys(localStorage).find(x => /bmg_workspace/.test(x)); const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find(q => q.id === w.activeId); return (p.data || p).view; });
const size = () => page.evaluate(() => { const v = document.getElementById('viewport'); return { w: v.clientWidth, h: v.clientHeight }; });
const status = async () => { await settle(page, 700); return page.evaluate(() => document.getElementById('viewerStatus').textContent); };

/* the map is a focusable, named group */
const attrs = await page.evaluate(() => { const v = document.getElementById('viewport'); return { tab: v.getAttribute('tabindex'), role: v.getAttribute('role'), rd: v.getAttribute('aria-roledescription'), name: v.getAttribute('aria-label') }; });
eq(attrs.tab, '0', 'the map is in the tab order'); eq(attrs.role, 'group', 'role group'); eq(attrs.rd, 'map', 'roledescription map'); ok(/arrow/i.test(attrs.name || ''), 'a name that says the keys');
await page.focus('#viewport');
eq(await page.evaluate(() => document.activeElement.id), 'viewport', 'the map takes focus');

/* arrows pan by a tenth, in the direction the key points */
const { w, h } = await size();
const v0 = await view();
await page.keyboard.press('ArrowRight'); await settle(page, 80);
let v1 = await view();
ok(Math.abs((v1.x - v0.x) + w * 0.1) < 1.5 && v1.y === v0.y && v1.scale === v0.scale, 'ArrowRight moves the view right: the picture slides left by a tenth of the width (dx ' + (v1.x - v0.x).toFixed(1) + ')');
await page.keyboard.press('ArrowDown'); await settle(page, 80);
let v2 = await view();
ok(Math.abs((v2.y - v1.y) + h * 0.1) < 1.5, 'ArrowDown moves the view down');
await page.keyboard.press('Shift+ArrowLeft'); await settle(page, 80);
let v3 = await view();
ok(Math.abs((v3.x - v2.x) - w * 0.5) < 1.5, 'Shift-arrow pans by half the width (dx ' + (v3.x - v2.x).toFixed(1) + ')');

/* + - 0 */
await page.keyboard.press('Home'); await settle(page, 80);
const fit = await view();
ok(Math.abs(fit.scale - v0.scale) < 1e-6, 'Home fits the map again');
await page.keyboard.press('+'); await settle(page, 80);
const z1 = await view();
ok(Math.abs(z1.scale / fit.scale - 1.25) < 1e-6, '+ zooms by 1.25');
await page.keyboard.press('-'); await settle(page, 80);
ok(Math.abs((await view()).scale - fit.scale) < 1e-6, '- undoes it');
await page.keyboard.press('+'); await page.keyboard.press('+'); await page.keyboard.press('0'); await settle(page, 80);
ok(Math.abs((await view()).scale - fit.scale) < 1e-6, '0 fits');

/* the announcement, computed independently from the view */
await page.keyboard.press('+'); await page.keyboard.press('+');
const text = await status();
const vz = await view();
const B = { north: 50, south: 24, west: -125, east: -66.5 };
const long = 4000 / 58.5, pxW = 4000, pxH = Math.round(26 * long);
const lon = sx => B.west + (sx / pxW) * (B.east - B.west), lat = sy => B.north - (sy / pxH) * (B.north - B.south);
const west = lon(Math.max(0, -vz.x / vz.scale)), east = lon(Math.min(pxW, (w - vz.x) / vz.scale));
const north = lat(Math.max(0, -vz.y / vz.scale)), south = lat(Math.min(pxH, (h - vz.y) / vz.scale));
const deg = (v, p, n) => Math.abs(Math.round(v)) + '°' + (v >= 0 ? p : n);
const want = `Zoom ${Math.round(vz.scale * 100)}%, showing ${deg(west, 'E', 'W')} to ${deg(east, 'E', 'W')} and ${deg(south, 'N', 'S')} to ${deg(north, 'N', 'S')}`;
eq(text, want, 'the status line names the zoom and the window on the map');

/* a label selected keeps the arrows */
await page.evaluate(() => { document.getElementById('viewport').focus(); });
const placed = await page.evaluate(() => {
  const k = Object.keys(localStorage).find(x => /bmg_workspace/.test(x)); const wk = JSON.parse(localStorage.getItem(k));
  const p = wk.projects.find(q => q.id === wk.activeId); const d = p.data || p;
  return !!d;
});
ok(placed, 'workspace readable');
await page.click('#btnLabelSets');
await page.selectOption('#labelSetSelect', 'us-states');
await page.click('#btnPlaceLabelSet');
await settle(page, 600);
const lbl = await page.$('.bmg-label');
if (lbl) {
  const vb = await view();
  await page.focus('#viewport');
  await lbl.click({ position: { x: 4, y: 4 }, force: true }).catch(() => {});
  await settle(page, 100);
  await page.evaluate(() => document.getElementById('viewport').focus());
  await page.keyboard.press('ArrowLeft'); await settle(page, 100);
  const va = await view();
  ok(va.x === vb.x && va.y === vb.y, 'with a label selected the arrow does not pan the map');
} else ok(false, 'a label was placed to select');

/* a data-shaded map is drawn live, so the status names the window too */
await page.click('#btnChoroToggle');
await page.click('#btnChoroExample');
await settle(page, 600);
await page.click('#btnChoroApply');
await page.waitForFunction(() => /:choro:/.test(Object.keys(localStorage).map(k => localStorage.getItem(k).slice(0, 4000)).join(' ')), null, { timeout: 30000 });
await settle(page, 1200);
await page.focus('#viewport');
await page.keyboard.press('-');
const t2 = await status();
ok(/^Zoom \d+%, showing /.test(t2), 'on a shaded map drawn live the status names the window: ' + t2);

const a11y = await a11yScan(page, { impact: 'serious' });
ok(!a11y || a11y.length === 0, 'axe: no serious or critical violations with the map focused' + (a11y && a11y.length ? ' ' + JSON.stringify(a11y.map(v => v.id)) : ''));

await browser.close();
server.close();
console.log(failed ? `${failed} failed, ${passed} passed` : `smoke-live-keys: all ${passed} passed`);
process.exit(failed ? 1 : 0);
