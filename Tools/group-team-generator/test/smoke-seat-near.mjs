// smoke-seat-near.mjs — 002's "Seat groups near each other" (Path 13 P2, v352).
//
//   node Tools/group-team-generator/test/smoke-seat-near.mjs     (npm run test:seat-near)
//
// The checkbox feeds the engine's `cost` from the Seating Chart (seating-chart-v1, read through
// SeatingRead). Held here, in the real page:
//   1. it is off by default, saves nothing when off, and with no chart saved says so, in the hint
//      and under the groups, and still makes every group;
//   2. with a chart for the class (12 desks, 2 rows of 6, students seated in a scattered order)
//      the groups sit together: over 25 shuffles the mean distance inside a group is well under
//      half the class's own, where with it off it is the class's own;
//   3. a keep-apart pair on neighbouring desks is still kept apart, and every student is placed;
//   4. two students with no desk are named, placed anyway, and the groups still come to 12;
//   5. a chart of two sections neither named like the class says so;
//   6. the choice survives a reload, and long memory is skipped (and says so) while it is on.
// Every name is invented. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8556;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/002-group-team-generator.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) passed++; else { failed++; console.log('  FAIL ' + label); } };

const NAMES = ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Zheng He', 'Grace Hopper', 'Ida Wells',
  'Rosa Parks', 'Cesar Chavez', 'Alan Turing', 'Mae Jemison', 'Ibn Battuta', 'Hedy Lamarr'];
// Where each student sits: desk index, scattered so a group by roster order is not a group by seat.
const DESK_OF = [0, 7, 3, 10, 5, 1, 8, 4, 11, 2, 9, 6];
const desks = Array.from({ length: 12 }, (_, i) => ({ id: 'd' + i, x: 40 + (i % 6) * 120, y: 100 + Math.floor(i / 6) * 100, rot: 0, locked: false }));
function chart(sectionName, { skip = [] } = {}) {
  const students = NAMES.map((n, i) => ({ id: 's' + i, name: n, note: '', flag: false }));
  const assign = {};
  NAMES.forEach((n, i) => { if (!skip.includes(n)) assign['d' + DESK_OF[i]] = 's' + i; });
  return { sections: [{ id: 'sec1', name: sectionName, students, desks, assign }], active: 'sec1', mirror: false, numbered: false };
}
const deskPos = n => { const d = desks[DESK_OF[NAMES.indexOf(n)]]; return [d.x, d.y]; };
const dist = (a, b) => { const p = deskPos(a), q = deskPos(b); return Math.hypot(p[0] - q[0], p[1] - q[1]) / 106; };
let classMean = 0, pairs = 0;
for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) { classMean += dist(NAMES[i], NAMES[j]); pairs++; }
classMean /= pairs;

const server = await serve(PORT);
const browser = await launch();

async function open(storage) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(s => { localStorage.clear(); Object.keys(s).forEach(k => localStorage.setItem(k, JSON.stringify(s[k]))); }, storage);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.fill('#names-input', NAMES.join('\n'));
  await page.dispatchEvent('#names-input', 'input');
  await page.selectOption('#strategy-select', 'random');
  await page.fill('#split-value', '3');
  await settle(page, 200);
  return page;
}
const groupsOf = p => p.evaluate(() => Array.from(document.querySelectorAll('.group-card ul')).map(ul => Array.from(ul.querySelectorAll('li > span:first-child')).map(s => s.textContent)));
async function shuffle(p, times) {
  const seen = [];
  for (let i = 0; i < times; i++) { await p.click(i === 0 ? '#generate-btn' : '#regenerate-btn'); await settle(p, 120); seen.push(await groupsOf(p)); }
  return seen;
}
const meanIn = shuffles => {
  let s = 0, n = 0;
  shuffles.forEach(gs => gs.forEach(g => { for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { s += dist(g[i], g[j]); n++; } }));
  return s / n;
};
const placedAll = gs => gs.flat().length === 12 && new Set(gs.flat()).size === 12;
const explain = p => p.evaluate(() => document.getElementById('explain-area').textContent);
const hint = p => p.evaluate(() => document.getElementById('seat-near-hint').textContent);
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('gtg:data:' + localStorage.getItem('gtg:current'))));

console.log('Group / Team Generator — seat groups near each other');

/* 1. off by default; no chart. */
{
  const p = await open({});
  ok(await p.isChecked('#seat-near-check') === false, 'the checkbox is off by default');
  await shuffle(p, 1);
  ok(!/Seat groups near/.test(await explain(p)), 'off: nothing about seating under the groups');
  ok(!('seatNear' in await saved(p)), 'off: nothing saved for it');
  await p.check('#seat-near-check'); await settle(p, 150);
  ok(/No seating chart found/.test(await hint(p)), 'on with no chart: the hint says no chart was found: ' + await hint(p));
  const [g2] = await shuffle(p, 1);
  ok(placedAll(g2) && g2.length === 3, 'no chart: all 12 students are still placed in 3 groups');
  ok(/Seat groups near each other is on, but No seating chart found/.test(await explain(p)), 'no chart: the groups say they were made without it');
  await p.context().close();
}

/* 2, 3, 6. a chart for the class. */
{
  // A fresh page and one shuffle, four times: with no memory yet the groups are the room's tidy blocks.
  const firsts = [];
  for (let i = 0; i < 4; i++) {
    const f = await open({ 'seating-chart-v1': chart('Period 3') });
    await f.check('#seat-near-check'); await settle(f, 100);
    const gs = await shuffle(f, 1);
    ok(placedAll(gs[0]) && gs[0].length === 3 && gs[0].every(g => g.length === 4), 'a first shuffle with a chart: three groups of four, everyone once');
    firsts.push(meanIn(gs));
    await f.context().close();
  }
  const first = firsts.reduce((x, y) => x + y, 0) / firsts.length;
  ok(first < classMean / 1.8, `on, first shuffle: students in a group sit well under the class's own distance apart (${first.toFixed(2)} against ${classMean.toFixed(2)})`);
  // Twelve shuffles in a row: not repeating the last partners comes before seating, so the groups loosen,
  // but they stay nearer than with it off.
  const o = await open({ 'seating-chart-v1': chart('Period 3') });
  const off = meanIn(await shuffle(o, 12));
  await o.context().close();
  ok(Math.abs(off - classMean) < 0.6, `off: a group is as spread as the class (${off.toFixed(2)} against ${classMean.toFixed(2)})`);
  const p = await open({ 'seating-chart-v1': chart('Period 3') });
  await p.check('#seat-near-check'); await settle(p, 150);
  ok(/12 of 12 students have a desk there/.test(await hint(p)), 'the hint counts the seated students: ' + await hint(p));
  const on = await shuffle(p, 12);
  ok(on.every(placedAll), 'twelve shuffles: every one places all 12 students once');
  ok(on.every(gs => gs.length === 3 && gs.every(g => g.length === 4)), 'twelve shuffles: groups of four');
  const onMean = meanIn(on);
  ok(onMean < off - 0.15, `on, twelve in a row: nearer than off (${onMean.toFixed(2)} against ${off.toFixed(2)})`);
  ok(/sit about [\d.]+ desks? apart/.test(await explain(p)), 'the explanation gives the distance');
  // 3. a keep-apart pair on neighbouring desks.
  const a = NAMES.find((_, i) => DESK_OF[i] === 0), b = NAMES.find((_, i) => DESK_OF[i] === 1);
  await p.selectOption('#pair-a', a); await p.selectOption('#pair-b', b); await p.click('#add-pair-btn'); await settle(p, 150);
  const apart = await shuffle(p, 12);
  ok(apart.every(gs => placedAll(gs) && !gs.some(g => g.includes(a) && g.includes(b))), `a keep-apart pair on neighbouring desks (${a}, ${b}) is never in one group`);
  // 6. reload, and long memory.
  ok((await saved(p)).seatNear === true, 'on: saved as seatNear');
  await p.check('#long-memory-check'); await settle(p, 150);
  await shuffle(p, 1);
  ok(/Long memory was skipped/.test(await explain(p)), 'long memory on with seating on: skipped, and says so');
  await p.reload({ waitUntil: 'networkidle' }); await settle(p, 300);
  ok(await p.isChecked('#seat-near-check') === true, 'the choice survives a reload');
  await p.context().close();
}

/* 4. two students with no desk. */
{
  const skip = ['Zheng He', 'Hedy Lamarr'];
  const p = await open({ 'seating-chart-v1': chart('Period 3', { skip }) });
  await p.check('#seat-near-check'); await settle(p, 150);
  ok(/10 of 12 students have a desk there/.test(await hint(p)) && /Zheng He/.test(await hint(p)) && /Hedy Lamarr/.test(await hint(p)), 'the hint names the two with no desk: ' + await hint(p));
  const on = await shuffle(p, 10);
  ok(on.every(placedAll), 'two with no desk: all 12 are still placed');
  ok(/2 students have no desk there/.test(await explain(p)), 'the explanation counts them');
  await p.context().close();
}

/* 5. two sections, neither the class. */
{
  const c = chart('Period 1'); c.sections.push(Object.assign({}, c.sections[0], { id: 'sec2', name: 'Period 6' }));
  const p = await open({ 'seating-chart-v1': c });
  await p.check('#seat-near-check'); await settle(p, 150);
  ok(/no section named like this class/.test(await hint(p)), 'two unrelated sections: the hint says so: ' + await hint(p));
  const [gs] = await shuffle(p, 1);
  ok(placedAll(gs), 'two unrelated sections: groups are still made');
  await p.context().close();
}

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
