// smoke-staggered-starts.mjs — staggered station starts and per-team route cards.
//
//   node Tools/qr-scavenger-hunt-builder/test/smoke-staggered-starts.mjs
//
// Every team beginning at station 1 means a queue at station 1 and an empty
// room everywhere else. Each team now gets a route card listing the stations
// in its own rotated order, starting somewhere different. What this suite
// holds down:
//
//   The rotation is a rotation, not a reshuffle. Every team's card must list
//   every station exactly once, in the hunt's own order, starting at that
//   team's offset — a team that skips a station finishes early and wrong.
//
//   The spread works when teams and stations do not divide evenly, in both
//   directions: more teams than stations (some share a start, which the tool
//   says out loud) and more stations than teams (the starts are spread across
//   the room, not bunched at the front).
//
//   Turning it off really means everyone starts at station 1, and the setting
//   is saved with the hunt.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8118;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/018-qr-scavenger-hunt-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

const STATIONS = ['Library', 'Gym', 'Cafeteria', 'Art Room', 'Front Office', 'Courtyard'];

/** Seed a hunt with `stationCount` stations and `teamCount` teams, in Run mode. */
async function seed(stationCount, teamCount) {
  await page.evaluate(({ labels, teamCount }) => {
    localStorage.clear();
    const stations = labels.map((label, i) => ({
      label, content: 'Clue ' + (i + 1), note: '', qType: 'none',
      choices: [], correctChoice: 0, numericAnswer: '', tolerance: '', hint: '', hintPenalty: 0,
    }));
    const teams = Array.from({ length: teamCount }, (_, i) => ({
      name: 'Team ' + (i + 1), code: 'CODE' + i, marks: {}, attempts: {}, hintsUsed: {}, penaltyMs: 0,
    }));
    localStorage.setItem('qr-scavenger-hunt-sets', JSON.stringify({
      current: 'Building Hunt',
      sets: {
        'Building Hunt': {
          name: 'Building Hunt', stations, cardsPerPage: '4', ecLevel: 'Q', showNumber: true,
          run: { teams, startedAt: null, elapsedMs: 0, running: false },
        },
      },
    }));
  }, { labels: STATIONS.slice(0, stationCount), teamCount });
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  await page.click('#tab-run');
  await settle(page);
}

/** Each printed route card as { team, route: [station labels] }. */
async function routeCards() {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#print-routes-btn');
  await settle(page);
  return page.evaluate(() => Array.from(document.querySelectorAll('#print-routes-grid .p-card')).map(c => ({
    team: c.querySelector('.p-label').textContent,
    route: Array.from(c.querySelectorAll('.p-route li')).map(li => li.textContent),
    firstMarked: c.querySelector('.p-route li.first') === c.querySelector('.p-route li'),
  })));
}

console.log('QR Scavenger Hunt Builder — staggered station starts');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* ── 1. six stations, three teams: starts spread across the room ─────────── */
await seed(6, 3);
ok(await page.isChecked('#stagger-starts'), 'staggered starts are on by default');
const three = await routeCards();
eq(three.length, 3, 'one route card per team');
eq(three.map(c => c.route[0]).join(','), 'Library,Cafeteria,Front Office',
   'the three teams start a third of the way apart around the six stations');
ok(three.every(c => c.firstMarked), 'each card marks its own first station');

/* ── 2. a rotation, not a reshuffle ──────────────────────────────────────── */
for (const card of three) {
  eq(card.route.length, STATIONS.length, `${card.team} visits every station`);
  eq(new Set(card.route).size, STATIONS.length, `${card.team} visits none of them twice`);
  const start = STATIONS.indexOf(card.route[0]);
  const expected = STATIONS.slice(start).concat(STATIONS.slice(0, start));
  eq(card.route.join(','), expected.join(','), `${card.team} keeps the hunt's own order, wrapping around`);
}

/* ── 3. the builder shows where each team begins ─────────────────────────── */
eq(await page.evaluate(() => Array.from(document.querySelectorAll('#teams-body .team-start')).map(e => e.textContent).join(' | ')),
   'starts at Library | starts at Cafeteria | starts at Front Office',
   'each team row says where it starts');
ok(/3 teams spread across 3 of 6 stations/.test(await page.textContent('#stagger-info')),
   'and the summary counts the spread: ' + JSON.stringify(await page.textContent('#stagger-info')));

/* ── 4. more teams than stations shares starts, and says so ──────────────── */
await seed(3, 5);
const crowded = await routeCards();
eq(crowded.length, 5, 'five route cards');
const crowdedStarts = crowded.map(c => c.route[0]);
const perStation = STATIONS.slice(0, 3).map(l => crowdedStarts.filter(x => x === l).length);
ok(Math.max(...perStation) - Math.min(...perStation) <= 1,
   `five teams are spread as evenly as three stations allow: ${JSON.stringify(crowdedStarts)}`);
ok(perStation.every(n => n > 0), 'with no station left without a team on it');
ok(/more teams than stations, so some will share a starting point/.test(await page.textContent('#stagger-info')),
   'and the tool warns that some teams share a start');
ok(crowded.every(c => c.route.length === 3 && new Set(c.route).size === 3),
   'every team still visits all three stations');

/* ── 5. turning it off puts everyone back on station 1 ───────────────────── */
await seed(6, 3);
await page.uncheck('#stagger-starts');
await settle(page);
const plain = await routeCards();
ok(plain.every(c => c.route.join(',') === STATIONS.join(',')),
   'with staggering off, every card is the plain station order');
ok(/Every team starts at Library/.test(await page.textContent('#stagger-info')),
   'and the summary says so');

/* ── 6. the setting is saved with the hunt ───────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
await page.click('#tab-run');
await settle(page);
eq(await page.isChecked('#stagger-starts'), false, 'the choice comes back after a reload');
await page.check('#stagger-starts');
await settle(page);
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
await page.click('#tab-run');
await settle(page);
eq(await page.isChecked('#stagger-starts'), true, 'and back on again');

/* ── 7. a team added later joins the rotation ────────────────────────────── */
await page.click('#add-team-btn');
await settle(page);
const four = await routeCards();
eq(four.length, 4, 'the new team gets a route card');
const fourStarts = four.map(c => c.route[0]);
eq(new Set(fourStarts).size, 4, `all four teams get their own starting station: ${JSON.stringify(fourStarts)}`);
const gaps = fourStarts.map(l => STATIONS.indexOf(l)).sort((a, b) => a - b);
ok(gaps[0] === 0 && gaps[3] >= 4,
   'and they are re-spread across the whole loop rather than the newcomer being tacked on next to team 3');

/* ── 8. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
