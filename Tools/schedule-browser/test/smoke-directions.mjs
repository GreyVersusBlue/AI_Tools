// smoke-directions.mjs — 034's Directions tab (backlog rank 139): a route from room A to room B
// on the building map, worked out in the page on the published geometry.
//
//   node Tools/schedule-browser/test/smoke-directions.mjs
//   (or: npm run test:schedule-browser-directions)
//
// Held:
//   1. 034 as it ships (a file published before 035 could embed a walk: its geometry has no door
//      cells or staircase pairs) opens, shows a Directions tab, and the tab says plainly that the file
//      has no directions, and names no route;
//   2. given a geometry published the way 035's Publish does with "show directions" ticked
//      (Northwind, built here by the 035 page itself), the tab lists rooms, and for every ordered pair
//      of a sample (same floor, across floors, step-free where the building has an elevator or a ramp)
//      the steps on 034 are the steps 035's published reader gives, the last one arrives at the
//      room, a floor map with the walk drawn on it is shown for each floor crossed, and the same room,
//      a room with no way in and a pair with no route each get a sentence, not a blank;
//   3. the tab follows the tablist: aria-selected moves, Arrow keys reach it, Home/End still end on
//      the first and last tabs;
//   4. nothing about a student is in the tab: the lists hold rooms only, and the page makes no request;
//   5. 360 px wide: no sideways scroll; and no serious axe finding on the tab.
// The room lists carry the teacher's name 034 already shows beside a room; this suite never prints one.
// Exits 1 on any failure.

/* global brSetMode, brDirRoute, brShowRoute, BR_GEOM:writable, applyFullProject, brBuildGeometrySnapshot, brRouteGeometry, AppState -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { fixtureProject } from '../../schedule-visualizer/test/fixture-northwind.mjs';

const PORT = 8675;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; } else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

/* The geometry, from 035's own Publish code, on 035's page. */
const vis = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await vis.context().addInitScript(() => { try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* blocked */ } });
await vis.goto(BASE + '/Tools/035-schedule-visualizer.html', { waitUntil: 'networkidle' });
await settle(vis, 400);
const geom = await vis.evaluate((p) => {
  applyFullProject(p);
  AppState.settings.publishDirections = true;
  return JSON.parse(JSON.stringify(brRouteGeometry(brBuildGeometrySnapshot(AppState.blueprint), AppState.blueprint, AppState.settings)));
}, fixtureProject());
const ref = (g, a, b, sf) => vis.evaluate(([g, a, b, sf]) => { const r = brDirRoute(g, a, b, sf); return { error: r.error || null, same: !!r.same, steps: r.steps || [] }; }, [g, a, b, sf]);
const rooms = geom.floors.flatMap((f, i) => f.rooms.filter(r => typeof r.rn === 'string' && r.door).map(r => ({ rn: r.rn, floor: i })));
ok(geom.links.length >= 1 && rooms.length >= 8, `the published Northwind carries links and rooms (links ${geom.links.length}, rooms ${rooms.length})`);

const page = await prepPage(browser, BASE, { width: 1000, height: 900 });
await page.goto(BASE + '/Tools/034-schedule-browser.html', { waitUntil: 'networkidle' });
await settle(page, 500);
console.log('Schedule Browser: the Directions tab');

console.log('1. a file published before directions');
ok(await page.evaluate(() => !!document.getElementById('br-mDir')), 'the Directions tab is there');
await page.evaluate(() => brSetMode('dir'));
let t = await page.evaluate(() => ({
  text: document.getElementById('br-view').textContent.replace(/\s+/g, ' ').trim(),
  sel: document.getElementById('br-mDir').getAttribute('aria-selected'),
  selects: document.querySelectorAll('#br-view select').length,
  empty: getComputedStyle(document.getElementById('br-empty')).display,
}));
ok(/This file has no directions/.test(t.text), `it says the file has no directions (got "${t.text.slice(0, 80)}")`);
eq([t.sel, t.selects, t.empty], ['true', 0, 'none'], 'the tab is selected, no room list is offered, the empty prompt is gone');

console.log('2. a file published with directions');
await page.evaluate((g) => { BR_GEOM = g; brSetMode('dir'); }, geom);
const opts = await page.evaluate(() => [...document.querySelectorAll('#br-dir-from option')].map(o => o.value).filter(Boolean));
eq(opts.slice().sort(), rooms.map(r => r.rn).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice().sort(), 'both lists offer every routable room');
const f0 = rooms.filter(r => r.floor === 0), f1 = rooms.filter(r => r.floor === 1);
const pairs = [[f0[0], f0[f0.length - 1]], [f0[1], f1[0]], [f1[0], f0[2]], [f1[0], f1[f1.length - 1]]].filter(p => p[0] && p[1] && p[0].rn !== p[1].rn);
ok(pairs.length >= 3, 'the sample has same-floor and cross-floor pairs');

const pick = (a, b, sf) => page.evaluate(([a, b, sf]) => {
  document.getElementById('br-dir-from').value = a; document.getElementById('br-dir-to').value = b;
  const box = document.getElementById('br-dir-sf'); if (box) box.checked = !!sf;
  brShowRoute();
  const out = document.getElementById('br-dir-out');
  return { steps: [...out.querySelectorAll('.br-dir-steps li')].map(li => li.textContent), maps: out.querySelectorAll('figure.br-dir-map').length,
    lines: out.querySelectorAll('figure.br-dir-map polyline').length, none: (out.querySelector('.br-dir-none') || {}).textContent || null,
    hint: (out.querySelector('.maphint') || {}).textContent || null };
}, [a, b, sf]);

/* The same pairs on a building as published (stairs only), on one whose staircase pair is an elevator, and on one with both between the same tiles (where the switch changes the answer). */
const variants = [['stairs only', geom],
  ['one elevator', { ...geom, links: geom.links.map((l, i) => i === 0 ? { ...l, access: 'elevator', wait: 10 } : l) }],
  ['stairs and an elevator between the same tiles', { ...geom, links: [{ ...geom.links[0], access: 'stairs' }, { ...geom.links[0], access: 'elevator', wait: 10 }, ...geom.links.slice(1)] }]];
let sawElevatorStep = false;
for (const [vname, g] of variants) {
  await page.evaluate((g) => { BR_GEOM = g; brSetMode('map'); brSetMode('dir'); }, g);
  const hasSf = await page.evaluate(() => !!document.getElementById('br-dir-sf'));
  const kinds = new Set(g.links.map(l => l.access));
  eq(hasSf, kinds.has('elevator') || kinds.has('ramp'), `${vname}: the step-free switch appears exactly when the building marks an elevator or a ramp`);
  for (const [a, b] of pairs) for (const sf of (hasSf ? [false, true] : [false])) {
    const mine = await pick(a.rn, b.rn, sf), theirs = await ref(g, a.rn, b.rn, sf);
    const label = `${vname}, ${a.rn} to ${b.rn}${sf ? ' step-free' : ''}`;
    if (theirs.error) {
      eq(mine.none, theirs.error + '.', `${label}: the same sentence as the published reader when there is no route`);
      continue;
    }
    eq(mine.steps, theirs.steps, `${label}: the steps are the published reader's`);
    ok(mine.steps.length > 0 && mine.steps[mine.steps.length - 1] === `Arrive at room ${b.rn}.`, `${label}: the last step arrives at the room`);
    eq(mine.maps, a.floor === b.floor ? 1 : 2, `${label}: one floor map per floor the walk crosses`);
    ok(mine.lines >= mine.maps * 2, `${label}: the walk is drawn on every map`);
    if (a.floor !== b.floor) ok(mine.steps.some(s => /^Take (the stairs|the elevator|the ramp) to /.test(s)), `${label}: it says how to change floors`);
    if (sf && mine.steps.some(s => /the elevator/.test(s))) sawElevatorStep = true;
    if (!sf && vname.startsWith('stairs and') && a.floor !== b.floor) ok(mine.steps.some(s => /the stairs/.test(s)), `${label}: without the switch it takes the stairs`);
  }
}
ok(sawElevatorStep, 'a step-free cross-floor route takes the elevator (the switch changes the route)');
let m = await pick(f0[0].rn, f0[0].rn, false);
ok(/same room/.test(m.hint || ''), 'the same room twice says so');
m = await pick('', f0[0].rn, false);
ok(/Choose the room you are in/.test(m.hint || ''), 'with one room missing it says what to choose');
m = await page.evaluate(() => { const r = brDirRoute(BR_GEOM, '101', 'no-such-room', false); return r.error; });
eq(m, 'This map does not show the way into that room', 'a room that is not on the map is refused in words');

console.log('3. the tablist');
await page.evaluate(() => brSetMode('map'));
eq(await page.evaluate(() => document.getElementById('br-mDir').getAttribute('aria-selected')), 'false', 'leaving the tab deselects it');
await page.focus('#br-mMap');
await page.keyboard.press('ArrowRight');
eq(await page.evaluate(() => document.activeElement.id), 'br-mDir', 'Arrow Right from Building Map reaches Directions');
eq(await page.evaluate(() => [document.getElementById('br-mDir').getAttribute('aria-selected'), document.getElementById('br-stage').getAttribute('aria-labelledby')]), ['true', 'br-mDir'], 'it is selected and labels the panel');
await page.keyboard.press('End');
eq(await page.evaluate(() => document.activeElement.id), 'br-mSub', 'End still ends on Substitute Plan');
await page.keyboard.press('Home');
eq(await page.evaluate(() => document.activeElement.id), 'br-mTeacher', 'Home still starts on By Teacher');

console.log('4. no student, no request');
await page.evaluate(() => brSetMode('dir'));
ok(await page.evaluate(() => !/student/i.test(document.getElementById('br-view').innerText.replace(/Student Group/gi, ''))), 'the tab never mentions a student');
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));
eq(page.__errs.length, 0, 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));

console.log('5. 360 px and axe');
await page.setViewportSize({ width: 360, height: 800 });
await pick(f0[0].rn, f1[0].rn, false);
eq(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll with a cross-floor route showing');
await settle(page, 700); // the view fades in; axe reads colours mid-fade
const ax = await a11yScan(page, { impact: 'serious' });
eq(ax.map(v => v.id + ' ' + v.nodes.join(',')), [], 'no serious axe finding on the tab with a route showing');

await browser.close(); server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
