// smoke-uneven.mjs — 021's uneven groups and stations (BACKLOG rank 129).
//
//   node Tools/pe-tournament-stations/test/smoke-uneven.mjs   (npm run test:pe-uneven, port 8657)
//
// A station can take two or three rotations ("Rotations here"): it holds that many slots of the cycle, a group stays
// through them and the station holds that many groups at once. A group can sit out: it is left out of the cycle, shown on
// the stage beside it and on the printed schedule. Held here, on the running page:
//   - a unit saved before the options (no `turns`, no `sitOut`) draws the stage and the printed schedule exactly as the
//     engine's own arithmetic (group gi at station (gi + count) mod S) says, for 1..8 groups on 1..5 stations and every
//     count 0..2S, so the clean cycle is untouched;
//   - a station of two rotations: the cycle is the slots' count, the stage and the printed table match a model computed
//     here from the rule, over every count of the cycle, and the cycle hint says how long it is;
//   - a group that sits out leaves the cycle (the others are dealt as if it were not there), appears on the stage and the
//     print, and comes back when unticked; sitting out and the turns survive a reload and a rename;
//   - more groups than places and fewer groups than places are each said in words;
//   - "Rotate now" and the score card's "here now" follow the same map;
//   - a hostile saved `turns` (0, -3, 99) is read as one rotation and a sitOut is read as a yes or a no.
// axe finds nothing serious; no sideways scroll at 360 px. print() is stubbed. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8657;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/021-pe-tournament-stations.html';
const KEY = 'pe-tournament-stations';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

const unit = (stations, groups, extra = {}) => ({
  name: 'Unit', roster: '',
  stations: stations.map((s, i) => ({ id: 'st' + i, name: 'S' + (i + 1), activity: '', equipment: '', scored: !!s.scored, scoreUnit: '', isRest: false, ...(s.turns !== undefined ? { turns: s.turns } : {}) })),
  groups: groups.map((g, i) => ({ id: 'g' + i, name: 'G' + (i + 1), members: 'a' + i + ', b' + i, ...(g.sitOut !== undefined ? { sitOut: g.sitOut } : {}) })),
  rotation: { minutes: 4, seconds: 0, count: 0, running: false, paused: false, endAt: null, remainingMs: null },
  bracket: null, scores: {}, soundEnabled: false, highContrast: false, ...extra
});

async function open(saved, size = { width: 1280, height: 1000 }) {
  const page = await prepPage(browser, BASE, size);
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; window.confirm = () => true; });
  await page.addInitScript(([k, u]) => { if (u && !localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ current: u.name, projects: { [u.name]: u } })); }, [KEY, saved]);
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 400);
  return page;
}

/** The rule, written out here and not read from the page: slots in order, groups dealt (gi + count) mod T. */
function model(stationTurns, groups, count) {
  const slots = [];
  stationTurns.forEach((t, i) => { for (let k = 0; k < t; k++) slots.push(i); });
  const T = slots.length;
  const map = stationTurns.map(() => []);
  if (!T) return map;
  const wrapped = ((count % T) + T) % T;
  // slot by slot, so a station that holds two lists the group in its first rotation first
  const perSlot = slots.map(() => []);
  groups.forEach((g, gi) => perSlot[(gi + wrapped) % T].push(g));
  perSlot.forEach((gs, k) => gs.forEach(g => map[slots[k]].push(g)));
  return map;
}

const stage = page => page.evaluate(() => [...document.querySelectorAll('#stationTiles .station-tile')].map(t => ({
  title: t.querySelector('h3').textContent,
  here: [...t.querySelectorAll('.groups-here .station-chip')].map(c => c.textContent)
})));
const setCount = async (page, n) => {
  await page.evaluate(c => {
    const s = JSON.parse(localStorage.getItem('pe-tournament-stations'));
    s.projects[s.current].rotation.count = c;
    localStorage.setItem('pe-tournament-stations', JSON.stringify(s));
  }, n);
  await page.reload({ waitUntil: 'load' });
  await settle(page, 300);
};
const printedTable = async page => {
  await page.click('#printBtn');
  await settle(page, 150);
  return page.evaluate(() => [...document.querySelectorAll('#printScheduleWrap tbody tr')].map(r => [...r.children].slice(1).map(c => c.textContent === '—' ? [] : c.textContent.split(', '))));
};

console.log('Tournament Bracket & Station Rotation — uneven groups and stations');

// ---- the clean cycle is untouched ------------------------------------------------
{
  const page = await open(unit([{}, {}, {}], [{}, {}, {}, {}, {}]));
  let bad = 0, checked = 0;
  for (const [S, G] of [[1, 1], [2, 5], [3, 5], [4, 2], [5, 8], [3, 1], [4, 4]]) {
    const saved = unit(Array.from({ length: S }, () => ({})), Array.from({ length: G }, () => ({})));
    await page.evaluate(([k, u]) => { localStorage.setItem(k, JSON.stringify({ current: u.name, projects: { [u.name]: u } })); }, [KEY, saved]);
    for (const c of [0, 1, 2 * S]) {
      await setCount(page, c);
      const want = model(Array(S).fill(1), Array.from({ length: G }, (_, i) => 'G' + (i + 1)), c);
      const got = (await stage(page)).map(t => t.here);
      checked++;
      if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; if (bad < 4) console.log(`    S=${S} G=${G} count=${c}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`); }
    }
    const table = await printedTable(page);
    const rows = Array.from({ length: S }, (_, r) => model(Array(S).fill(1), Array.from({ length: G }, (_, i) => 'G' + (i + 1)), r));
    if (JSON.stringify(table) !== JSON.stringify(rows)) { bad++; console.log(`    printed table S=${S} G=${G}`); }
    checked++;
  }
  eq([bad, checked > 20], [0, true], `a unit with no options: the stage and the print equal the engine's rule (${checked} cases)`);
  eq(await page.evaluate(() => document.getElementById('cycleHint').textContent.includes('repeats every')), false, 'and the hint does not talk about a cycle it did not change');
  await page.close();
}

// ---- a station that takes two rotations ---------------------------------------------
{
  const saved = unit([{}, { turns: 2 }, {}], [{}, {}, {}, {}]);   // 4 slots, 4 groups
  const page = await open(saved);
  const names = ['G1', 'G2', 'G3', 'G4'];
  let bad = 0;
  for (let c = 0; c < 8; c++) {
    await setCount(page, c);
    const got = (await stage(page)).slice(0, 3).map(t => t.here);
    const want = model([1, 2, 1], names, c);
    if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; console.log(`    count ${c}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`); }
  }
  eq(bad, 0, 'with a two-rotation middle station the stage follows the slot rule for 8 counts');
  eq(await page.evaluate(() => document.querySelectorAll('#stationTiles .station-tile').length), 3, 'one tile per station, not per slot');
  ok((await page.textContent('#cycleHint')).includes('repeats every 4 rotations'), 'the hint gives the cycle length: ' + await page.textContent('#cycleHint'));
  eq(await page.evaluate(() => [...document.querySelectorAll('.st-turns')].map(s => s.value)), ['1', '2', '1'], 'the select shows each station\'s rotations');
  // a group stays: G1 at count 0 is at slot 0, at count 1 slot 1 (station 2), at count 2 slot 2 (station 2 again)
  const stays = [];
  for (let c = 0; c < 4; c++) { await setCount(page, c); stays.push((await stage(page)).findIndex(t => t.here.includes('G1'))); }
  eq(stays, [0, 1, 1, 2], 'G1 stands at station 2 for two rotations in a row');
  const table = await printedTable(page);
  eq(table.length, 4, 'the printed schedule has one row for each rotation of the cycle');
  eq(table, [0, 1, 2, 3].map(r => model([1, 2, 1], names, r)), 'and each row is the rule\'s');
  // change it from the page: set the station back to 1
  await page.selectOption('.st-turns >> nth=1', '1');
  await settle(page, 200);
  eq(await page.evaluate(([k]) => { const s = JSON.parse(localStorage.getItem(k)); return 'turns' in s.projects[s.current].stations[1]; }, [KEY]), false, 'choosing 1 takes the field off the saved station');
  await page.selectOption('.st-turns >> nth=0', '3');
  await settle(page, 200);
  eq(await page.evaluate(([k]) => JSON.parse(localStorage.getItem(k)).projects.Unit.stations[0].turns, [KEY]), 3, 'choosing 3 saves it');
  await page.reload({ waitUntil: 'load' }); await settle(page, 300);
  eq(await page.evaluate(() => document.querySelector('.st-turns').value), '3', 'and it is there after a reload');
  await page.close();
}

// ---- a group that sits out ---------------------------------------------------------------
{
  const saved = unit([{}, {}, {}], [{}, {}, {}, {}]);
  const page = await open(saved);
  eq((await stage(page)).map(t => t.here), model([1, 1, 1], ['G1', 'G2', 'G3', 'G4'], 0), 'before: 4 groups on 3 stations, one station holds two');
  ok((await page.textContent('#cycleHint')).includes('1 more group than places'), 'and the hint says so: ' + await page.textContent('#cycleHint'));
  await page.check('.grp-sit >> nth=3');
  await settle(page, 250);
  const tiles = await stage(page);
  eq(tiles.slice(0, 3).map(t => t.here), model([1, 1, 1], ['G1', 'G2', 'G3'], 0), 'G4 sits out: the other three are dealt as if it were not there');
  eq(tiles[3], { title: 'Sitting out', here: ['G4'] }, 'and a "Sitting out" tile names it');
  ok((await page.textContent('#cycleHint')).includes('1 group is sitting out'), 'the hint says one group is sitting out');
  const table = await printedTable(page);
  eq(table, [0, 1, 2].map(r => model([1, 1, 1], ['G1', 'G2', 'G3'], r)), 'the printed schedule leaves G4 out of every row');
  ok((await page.textContent('#printScheduleWrap')).includes('Sitting out: G4'), 'and names G4 under the table');
  await page.reload({ waitUntil: 'load' }); await settle(page, 300);
  eq(await page.evaluate(() => [...document.querySelectorAll('.grp-sit')].map(c => c.checked)), [false, false, false, true], 'sitting out survives a reload');
  // Rotate now follows
  await page.click('#rotateNowBtn'); await settle(page, 200);
  eq((await stage(page)).slice(0, 3).map(t => t.here), model([1, 1, 1], ['G1', 'G2', 'G3'], 1), 'Rotate now moves the three that are in the rotation');
  await page.uncheck('.grp-sit >> nth=3');
  await settle(page, 250);
  eq((await stage(page)).length, 3, 'unticking brings G4 back and the Sitting out tile goes');
  eq(await page.evaluate(([k]) => 'sitOut' in JSON.parse(localStorage.getItem(k)).projects.Unit.groups[3], [KEY]), false, 'and the field leaves the saved group');
  // fewer groups than places
  await page.check('.grp-sit >> nth=1'); await page.check('.grp-sit >> nth=2'); await page.check('.grp-sit >> nth=3');
  await settle(page, 250);
  ok((await page.textContent('#cycleHint')).includes('more places than groups'), 'one group left on three places: the hint says some stations are empty: ' + await page.textContent('#cycleHint'));
  await page.close();
}

// ---- the score card's "here now" follows the same map ----------------------------------------------
{
  const saved = unit([{ scored: true }, { turns: 2, scored: true }], [{}, {}, {}]);
  const page = await open(saved);
  const here = () => page.evaluate(() => [...document.querySelectorAll('#scoresList .score-station')].map(s => [...s.querySelectorAll('.score-group-here .score-group-title')].map(t => t.firstChild.textContent)));
  eq(await here(), model([1, 2], ['G1', 'G2', 'G3'], 0), 'the score card marks the groups the stage shows');
  await setCount(page, 1);
  eq(await here(), model([1, 2], ['G1', 'G2', 'G3'], 1), 'and after a rotation');
  await page.close();
}

// ---- hostile saved values ------------------------------------------------------------------------------
{
  const saved = unit([{}, {}, {}], [{}, {}]);
  saved.stations[0].turns = 0; saved.stations[1].turns = -3; saved.stations[2].turns = 99;
  saved.groups[0].sitOut = 'yes'; saved.groups[1].sitOut = 0;
  const page = await open(saved);
  eq(await page.evaluate(() => [...document.querySelectorAll('.st-turns')].map(s => s.value)), ['1', '1', '1'], 'turns of 0, -3 and 99 are one rotation');
  eq(await page.evaluate(() => [...document.querySelectorAll('.grp-sit')].map(c => c.checked)), [true, false], 'a truthy sitOut reads as sitting out and 0 as not');
  eq(await page.evaluate(() => document.getElementById('cycleHint').textContent.includes('repeats every')), false, 'and none of them makes the cycle longer');
  await page.close();
}

// ---- a11y, phone ------------------------------------------------------------------------------------------
{
  const page = await open(unit([{}, { turns: 2 }, {}], [{}, {}, { sitOut: true }, {}]));
  const scan = await a11yScan(page, { impact: 'serious' });
  ok(!scan.length, 'axe: no serious violation with the new controls showing: ' + JSON.stringify(scan.map(v => [v.id, v.nodes])));
  await page.close();
  const phone = await open(unit([{}, { turns: 2 }, {}], [{}, {}, { sitOut: true }, {}]), { width: 360, height: 800 });
  eq(await phone.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no sideways scroll at 360 px');
  await phone.close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
