// smoke-locks.mjs — "Keep this group" and "Keep role" on Lab Group & Role Randomizer.
//
//   node Tools/lab-group-role-randomizer/test/smoke-locks.mjs
//
// A teacher who likes three of four groups should be able to hold them still and
// regroup the rest. Two boxes do it: Keep this group (its students, roles and
// station stay, at the same number, with their checkout row) and Keep role (one
// student keeps a role in whatever group they land in). Nothing is stored beyond
// the optional `locked` / `keep` fields on the saved groups. What this holds:
//
//   1. A kept group comes back identical, in the same place, across many shuffles,
//      and the other students are regrouped without it (nobody twice, nobody lost).
//   2. A kept group holds its station and its checkout row; the dealt groups do not
//      take its station while another is free.
//   3. A kept role is held across many shuffles, in a different group each time
//      (it is not a kept group), and the roles in each dealt group stay distinct.
//   4. A lock whose student is no longer on the roster is dropped and said so, and
//      the group is regrouped; nothing throws.
//   5. Locks survive a reload and are not on paper.
//   6. 360 px wide there is no sideways scroll, and axe finds nothing serious.
//   7. With nothing ticked a shuffle is as before (no lock notes, every student once).
//
// Every name is invented. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8641;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/022-lab-group-role-randomizer.html';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const errors = [];

const CLASS = Array.from({ length: 12 }, (_, i) => `Student ${String(i + 1).padStart(2, '0')}`);

async function fresh(width = 1400) {
  const page = await prepPage(browser, BASE, { width, height: 1050 });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await page.fill('#namesInput', CLASS.join('\n'));
  await page.fill('#splitValue', '4');
  await page.dispatchEvent('#splitValue', 'input');
  for (let i = 0; i < 4; i++) await page.click('#addStationBtn');
  const names = page.locator('#stationList .station-name');
  for (let i = 0; i < 4; i++) await names.nth(i).fill('Bench ' + (i + 1));
  await settle(page, 300);
  return page;
}
/** Each group as { members: [[name, role]], station }. */
const shown = page => page.evaluate(() =>
  Array.from(document.querySelectorAll('#resultsArea .group-card')).map(g => ({
    station: (g.querySelector('.group-station strong') || {}).textContent || null,
    members: Array.from(g.querySelectorAll('ul > li')).map(li => [li.querySelector('.name').textContent.trim(), li.querySelector('.role').textContent.trim()]),
    locked: g.classList.contains('is-locked'),
  })));
const shuffle = async page => { await page.click('#shuffleBtn'); await settle(page, 250); };
const warn = page => page.evaluate(() => document.getElementById('warnArea').textContent);
const allNames = gs => gs.flatMap(g => g.members.map(m => m[0])).sort();

console.log('Lab Group & Role Randomizer — keep a group, keep a role');

/* ── 7 first: nothing ticked is an ordinary shuffle ───────────────────────── */
{
  const page = await fresh();
  await shuffle(page);
  const g = await shown(page);
  eq(g.length, 4, 'four groups with nothing ticked');
  eq(allNames(g), CLASS.slice().sort(), 'every student appears once with nothing ticked');
  ok(!/Kept \d+ group|Could not keep/.test(await warn(page)), 'no lock note with nothing ticked');
  ok(g.every(x => !x.locked), 'no card is marked kept');
  await page.close();
}

/* ── 1 + 2: a kept group holds still, with its station and checkout row ──── */
{
  const page = await fresh();
  await shuffle(page);
  const first = await shown(page);
  await page.check('[data-lock-group="1"]');
  await settle(page, 150);
  // Check the kept group's station out, to see its row survive.
  await page.click('[data-checkout-idx="1"]');
  await settle(page, 150);
  const status0 = await page.evaluate(() => document.querySelectorAll('#resultsArea .group-card')[1].querySelector('.checkout-status').textContent);
  ok(/Checked out/.test(status0), 'the kept group is checked out before the reshuffles');
  let sameElsewhere = 0;
  for (let n = 0; n < 8; n++) {
    await shuffle(page);
    const g = await shown(page);
    eq(g[1], { ...first[1], locked: true }, `shuffle ${n + 1}: the kept group is identical and still Group 2`);
    eq(allNames(g), CLASS.slice().sort(), `shuffle ${n + 1}: every student appears exactly once`);
    eq(g.length, 4, `shuffle ${n + 1}: still four groups`);
    const stations = g.map(x => x.station);
    eq(new Set(stations).size, 4, `shuffle ${n + 1}: no two groups share a bench`);
    const status = await page.evaluate(() => document.querySelectorAll('#resultsArea .group-card')[1].querySelector('.checkout-status').textContent);
    ok(/Checked out/.test(status), `shuffle ${n + 1}: the kept group is still checked out`);
    const others = g.filter((_, i) => i !== 1).map(x => x.members.map(m => m[0]).join(','));
    const before = first.filter((_, i) => i !== 1).map(x => x.members.map(m => m[0]).join(','));
    if (JSON.stringify(others) === JSON.stringify(before)) sameElsewhere++;
    ok(/Kept 1 group as it was/.test(await warn(page)), `shuffle ${n + 1}: the note says one group was kept`);
  }
  ok(sameElsewhere < 8, 'the other groups really were regrouped');
  // Un-ticking lets it move.
  await page.uncheck('[data-lock-group="1"]');
  let moved = false;
  for (let n = 0; n < 8 && !moved; n++) {
    await shuffle(page);
    const g = await shown(page);
    if (JSON.stringify(g[1].members.map(m => m[0])) !== JSON.stringify(first[1].members.map(m => m[0]))) moved = true;
  }
  ok(moved, 'unticking Keep this group lets the group move again');
  await page.close();
}

/* ── 1b: two kept groups, and every group kept ────────────────────────────── */
{
  const page = await fresh();
  await shuffle(page);
  const first = await shown(page);
  await page.check('[data-lock-group="0"]');
  await page.check('[data-lock-group="3"]');
  for (let n = 0; n < 5; n++) {
    await shuffle(page);
    const g = await shown(page);
    eq(g[0].members, first[0].members, `two kept: Group 1 holds (${n + 1})`);
    eq(g[3].members, first[3].members, `two kept: Group 4 holds (${n + 1})`);
    eq(allNames(g), CLASS.slice().sort(), `two kept: everyone once (${n + 1})`);
  }
  const before = await shown(page);
  await page.check('[data-lock-group="1"]');
  await page.check('[data-lock-group="2"]');
  await shuffle(page);
  const all = await shown(page);
  eq(all.map(x => x.members), before.map(x => x.members), 'every group kept: nothing moves and nothing throws');
  await page.close();
}

/* ── 3: a kept role follows the student ───────────────────────────────────── */
{
  const page = await fresh();
  await shuffle(page);
  const first = await shown(page);
  const who = first[0].members.find(m => /^(?!Team Member)/.test(m[1]) && m[1] !== 'Absent');
  await page.check('[data-lock-role="0:' + first[0].members.indexOf(who) + '"]');
  await settle(page, 150);
  const groupsSeen = new Set();
  for (let n = 0; n < 12; n++) {
    await shuffle(page);
    const g = await shown(page);
    const at = g.findIndex(x => x.members.some(m => m[0] === who[0]));
    const mine = g[at].members.find(m => m[0] === who[0]);
    eq(mine[1], who[1], `kept role ${n + 1}: ${who[0]} is still ${who[1]}`);
    groupsSeen.add(g[at].members.map(m => m[0]).sort().join(','));
    const roles = g[at].members.map(m => m[1]).filter(r => r !== 'Team Member');
    eq(new Set(roles).size, roles.length, `kept role ${n + 1}: no role twice in that group`);
    eq(allNames(g), CLASS.slice().sort(), `kept role ${n + 1}: everyone once`);
  }
  ok(groupsSeen.size > 1, 'a kept role is not a kept group: the student lands with different people');
  await page.close();
}

/* ── 3b: two kept roles that are the same role, landing in one group ─────── */
{
  const page = await fresh();
  await page.fill('#splitValue', '2');
  await page.dispatchEvent('#splitValue', 'input');
  await shuffle(page);
  const g0 = await shown(page);
  // Two students who hold the same role, in different groups, both kept: give
  // both the role by finding a role held in each group.
  const roleIn = g => new Set(g.members.map(m => m[1]));
  const common = [...roleIn(g0[0])].find(r => r !== 'Team Member' && roleIn(g0[1]).has(r));
  ok(!!common, 'two groups of six share a role to keep');
  const a = g0[0].members.findIndex(m => m[1] === common), b = g0[1].members.findIndex(m => m[1] === common);
  await page.check('[data-lock-role="0:' + a + '"]');
  await page.check('[data-lock-role="1:' + b + '"]');
  const pair = [g0[0].members[a][0], g0[1].members[b][0]];
  let together = 0;
  for (let n = 0; n < 30; n++) {
    await shuffle(page);
    const g = await shown(page);
    const ga = g.findIndex(x => x.members.some(m => m[0] === pair[0]));
    const gb = g.findIndex(x => x.members.some(m => m[0] === pair[1]));
    const roleOf = (gi, nm) => g[gi].members.find(m => m[0] === nm)[1];
    if (ga === gb) {
      together++;
      const kept = [roleOf(ga, pair[0]), roleOf(ga, pair[1])].filter(r => r === common).length;
      eq(kept, 1, `together (${n + 1}): only one of the two keeps ${common}`);
      ok(/Two kept roles landed in one group/.test(await warn(page)), `together (${n + 1}): the note says so`);
    } else {
      eq([roleOf(ga, pair[0]), roleOf(gb, pair[1])], [common, common], `apart (${n + 1}): both keep ${common}`);
    }
    // The loser of a conflict has no box ticked any more (it was dealt a role as usual), so stop here.
    if (ga === gb) {
      const ticked = await page.evaluate(() => document.querySelectorAll('[data-lock-role]:checked').length);
      eq(ticked, 1, 'after a conflict exactly one Keep role box is still ticked');
      break;
    }
  }
  ok(together > 0, 'the two kept students were put in one group at least once in 30 shuffles');
  await page.close();
}

/* ── 4: a lock whose student left the roster is dropped, said, and harmless ─ */
{
  const page = await fresh();
  await shuffle(page);
  const first = await shown(page);
  await page.check('[data-lock-group="2"]');
  const gone = first[2].members[0][0];
  await page.fill('#namesInput', CLASS.filter(n => n !== gone).join('\n'));
  await settle(page, 300);
  await shuffle(page);
  const g = await shown(page);
  ok(/Could not keep Group 3/.test(await warn(page)), 'the note names the group that could not be kept');
  ok(g.every(x => !x.locked), 'no card is marked kept after the lock was dropped');
  eq(allNames(g), CLASS.filter(n => n !== gone).sort(), 'the rest are regrouped, each once');
  await page.close();
}

/* ── 5: locks survive a reload and stay off paper ─────────────────────────── */
{
  const page = await fresh();
  await shuffle(page);
  await page.check('[data-lock-group="0"]');
  await page.check('[data-lock-role="2:0"]');
  await settle(page, 200);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
  ok(await page.isChecked('[data-lock-group="0"]'), 'Keep this group is still ticked after a reload');
  ok(await page.isChecked('[data-lock-role="2:0"]'), 'Keep role is still ticked after a reload');
  await page.emulateMedia({ media: 'print' });
  const shownOnPaper = await page.evaluate(() => Array.from(document.querySelectorAll('.lock-ctl, .lock-hint')).filter(e => getComputedStyle(e).display !== 'none').length);
  eq(shownOnPaper, 0, 'no Keep box or hint is on the printed sheet');
  await page.emulateMedia({ media: 'screen' });
  await page.close();
}

/* ── 6: 360 px and axe ────────────────────────────────────────────────────── */
{
  const page = await fresh(360);
  await shuffle(page);
  await page.check('[data-lock-group="0"]');
  await page.check('[data-lock-role="1:0"]');
  await settle(page, 200);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, `no sideways scroll at 360 px (overflow ${over})`);
  const violations = await a11yScan(page, { impact: 'serious' });
  eq(violations.map(v => v.id + ' ' + v.nodes.join(';')), [], 'axe finds nothing serious with the boxes ticked');
  await page.close();
}

ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));

await browser.close();
server.close && server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
