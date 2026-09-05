// smoke-mode-tabs.mjs — the schedule browser's mode switcher as a real
// ARIA tablist.
//
//   node Tools/schedule-browser/test/smoke-mode-tabs.mjs
//
// Backlog rank 1 (2026-09-05): `.mode` carried role="tablist" over six plain
// buttons, which was the site's last non-contrast axe allowance
// (aria-required-children). The buttons are now tabs, the stage is the one
// panel they control, and brSyncTabs keeps the state honest. Under test:
//
//   1. the tablist's children are all role="tab" — the violation itself —
//      with exactly one aria-selected="true" and a roving tabindex, and the
//      stage is a tabpanel labelled by the selected tab;
//   2. switching mode moves all four of those things AND still renders the
//      view (a green axe run on a page whose script threw would look the
//      same, so the mode switch is asserted positively);
//   3. Left/Right/Home/End move between tabs and activate on arrival;
//   4. the School Layout Visualizer, which both hosts its own copy of this
//      browser and publishes 034, emits the tab markup from
//      brBuildPublishedMarkup() — the R61–R63 drift between publisher and
//      published file is exactly how this kind of fix gets undone.
//
// Exits 1 on any failure.

/* global brSetMode, brBuildPublishedMarkup, brPublishFnList -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8412;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_BROWSER = BASE + '/Tools/034-schedule-browser.html';
const URL_VISUALIZER = BASE + '/Tools/035-schedule-visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
/* ids come back as arrays; compare them as one string so a mismatch prints readably */
const eqIds = (a, b, label) => eq(a.join(','), b.join(','), label);

const tabState = (p) => p.evaluate(() => {
  const bar = document.querySelector('#app-browser .mode');
  const kids = [...bar.children];
  const panel = document.getElementById('br-stage');
  return {
    kids: kids.length,
    tabs: kids.filter(k => k.getAttribute('role') === 'tab').length,
    selected: kids.filter(k => k.getAttribute('aria-selected') === 'true').map(k => k.id),
    focusable: kids.filter(k => k.tabIndex === 0).map(k => k.id),
    on: kids.filter(k => k.classList.contains('on')).map(k => k.id),
    controls: [...new Set(kids.map(k => k.getAttribute('aria-controls')))],
    panelRole: panel && panel.getAttribute('role'),
    panelLabel: panel && panel.getAttribute('aria-labelledby'),
  };
});

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Schedule Browser — mode switcher as a tablist');

await page.goto(URL_BROWSER, { waitUntil: 'networkidle' });
await settle(page, 700);

/* ── 1. the shape axe was complaining about ──────────────────────────────── */
const at = await tabState(page);
eq(at.tabs, at.kids, 'every child of the tablist is a tab');
ok(at.kids >= 6, `all six modes are tabs (got ${at.kids})`);
eqIds(at.selected, ['br-mTeacher'], 'exactly one tab is aria-selected on load');
eqIds(at.focusable, ['br-mTeacher'], 'the roving tabindex sits on the selected tab');
eqIds(at.controls, ['br-stage'], 'every tab names the stage as its panel');
eq(at.panelRole, 'tabpanel', 'the stage is the tabpanel');
eq(at.panelLabel, 'br-mTeacher', 'the panel is labelled by the selected tab');

/* ── 2. switching mode moves the state, and still renders ────────────────── */
await page.evaluate(() => brSetMode('map'));
await settle(page, 500);
const mapState = await tabState(page);
eqIds(mapState.selected, ['br-mMap'], 'aria-selected follows the mode');
eqIds(mapState.focusable, ['br-mMap'], 'the roving tabindex follows the mode');
eqIds(mapState.on, ['br-mMap'], 'the .on styling still follows the mode');
eq(mapState.panelLabel, 'br-mMap', 'the panel is relabelled to the selected tab');
ok(await page.evaluate(() => document.getElementById('br-view').children.length > 0),
   'the Building Map view actually rendered (the switch still works)');

await page.evaluate(() => brSetMode('teacher'));
await settle(page, 400);
ok(await page.evaluate(() => document.getElementById('br-searchField').style.display !== 'none'),
   'switching back to By Teacher restores the search field');

/* ── 3. arrow keys walk the tablist and activate on arrival ──────────────── */
await page.focus('#br-mTeacher');
await page.keyboard.press('ArrowRight');
await settle(page, 400);
eq(await page.evaluate(() => document.activeElement.id), 'br-mGroup', 'ArrowRight moves focus to the next tab');
eqIds((await tabState(page)).selected, ['br-mGroup'], 'ArrowRight activates the tab it lands on');

await page.keyboard.press('End');
await settle(page, 400);
eq(await page.evaluate(() => document.activeElement.id), 'br-mSub', 'End jumps to the last tab');

await page.keyboard.press('Home');
await settle(page, 400);
eq(await page.evaluate(() => document.activeElement.id), 'br-mTeacher', 'Home jumps back to the first tab');
eqIds((await tabState(page)).selected, ['br-mTeacher'], 'Home activates By Teacher again');

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

/* ── 4. the publisher emits the same markup ──────────────────────────────── */
const vis = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await vis.goto(URL_VISUALIZER, { waitUntil: 'networkidle' });
await settle(vis, 900);

const visState = await tabState(vis);
eq(visState.tabs, visState.kids, "the visualizer's own browser view uses the same tabs");
eq(visState.panelRole, 'tabpanel', "the visualizer's own stage is a tabpanel");

const published = await vis.evaluate(() => brBuildPublishedMarkup('Northwind Middle', 'July 15, 2026'));
ok(/<div class="mode" role="tablist"/.test(published), 'the published markup still has a tablist');
eq((published.match(/role="tab"/g) || []).length, 3, 'every published mode button is a tab');
ok(/id="br-stage" role="tabpanel"/.test(published), 'the published stage is the tabpanel');
ok(published.includes('aria-controls="br-stage"'), 'published tabs name the panel they control');

const fns = await vis.evaluate(() => brPublishFnList().map(f => f.name));
ok(fns.includes('brSyncTabs') && fns.includes('brWireTabKeys'),
   'both tab helpers are in brPublishFnList, so the published file gets them');


await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
