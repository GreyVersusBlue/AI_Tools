// smoke-teams.mjs — the Behavior & Points Tracker's team / house points, driven
// in a real page.
//
//   node Tools/behavior-points-tracker/test/smoke-teams.mjs
//
// Two halves. First, a class with NO teams must be what it was: a fixed walk
// (_golden-run.mjs: every display mode, taps, award-all, undo, both printouts,
// the CSV, archive, undo-the-day) is replayed on today's page and compared,
// piece by piece and to the byte, with golden-no-teams.json, which was recorded
// from the page before team points existed. Second, the feature itself: making
// teams, the seeded even deal, a tap counting for a student's team, undo,
// direct points, the board (readable size, a word and a position for the
// leader, nothing of any student on it), archive, undo-the-day, reset behind a
// confirm that leaves every student alone, and a section saved with teams
// loading again.
//
// Exits 1 on any failure. Every name here is invented.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, a11yScan } from '../../board-check/harness.mjs';
import { walk, KEY, SEED } from './_golden-run.mjs';

const PORT = 8516;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/008-behavior-points-tracker.html';
const here = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(fs.readFileSync(path.join(here, 'golden-no-teams.json'), 'utf8'));

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Behavior & Points Tracker — team / house points');

/* ── 1. A class with no teams is what it was ─────────────────────────────── */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  const got = await walk(page, URL_PAGE);
  const pieces = ['start', 'afterTaps', 'afterAwardAll', 'afterUndo', 'afterAwardOthers', 'afterArchive', 'afterClearDay'];
  for (const k of pieces) {
    for (const f of Object.keys(GOLDEN[k])) {
      eq(got[k][f], GOLDEN[k][f], `no teams: ${k}.${f} is what it was`);
    }
  }
  eq(got.modes, GOLDEN.modes, 'no teams: every Show and Sort mode draws the same board');
  eq(got.printReport, GOLDEN.printReport, 'no teams: the end-of-day report is the same');
  eq(got.printSummary, GOLDEN.printSummary, 'no teams: the student summary is the same');
  eq(got.printed, GOLDEN.printed, 'no teams: print was asked for the same number of times');
  eq(got.csv, GOLDEN.csv, 'no teams: the history CSV is the same, byte for byte');
  eq(got.dialogs, GOLDEN.dialogs, 'no teams: the same questions were asked');
  ok(!/team|tm\d/i.test(got.afterClearDay.stored), 'no teams: no team field was ever written to the saved section');
  ok(!(await page.$eval('#teamBoard', el => !el.hidden)), 'no teams: the team board is not shown');
  ok(await page.$eval('#teamsNote', el => /No teams yet/.test(el.textContent)), 'no teams: the card says there are none');
  eq(page.__errs, [], 'no teams: no page errors');
  await page.context().close();
}

/* ── helpers for the feature half ─────────────────────────────────────────── */
const NAMES = ['Aiden Whitfield', 'Brooklyn Bell', 'Camila Duarte', 'Dmitri Fox', 'Esi Mensah', 'Farid Noor'];
let confirmAnswer = true;
let promptAnswer = '';
const asked = [];
async function open(seedPatch) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  page.on('dialog', async d => {
    asked.push(d.type() + ':' + d.message());
    if (d.type() === 'confirm' && !confirmAnswer) await d.dismiss(); else await d.accept(promptAnswer);
  });
  const seed = JSON.parse(JSON.stringify(SEED));
  const sec = seed.sets[seed.current];
  sec.points = {}; sec.posCount = {}; sec.negCount = {}; sec.log = []; sec.history = []; sec.goals = {};
  if (seedPatch) seedPatch(sec);
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
  await page.goto(URL_PAGE);
  await page.waitForTimeout(400);
  return page;
}
const section = page => page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); return s.sets[s.current]; }, KEY);
const tiles = page => page.$$eval('#teamTiles .team-tile', els => els.map(el => ({
  pos: el.querySelector('.tile-pos').textContent,
  name: el.querySelector('.tile-name').textContent,
  total: el.querySelector('.tile-total').textContent,
  lead: el.querySelector('.tile-lead').textContent,
  cls: el.className,
})));
const boardShown = page => page.$eval('#teamBoard', el => !el.hidden);
const addTeams = async (page, names) => {
  for (const n of names) {
    await page.click('#addTeamBtn');
    await page.fill('#teamsEditor .team-row:last-child .team-name', n);
  }
};
const tap = async (page, name, key = '1') => {
  await page.keyboard.press(key);
  await page.click(`#studentGrid .student-card[data-name="${name}"]`);
  await page.waitForTimeout(420);
};
const pick = async (page, name, teamId) => {
  if (!(await page.$eval('#teamAssignWrap', d => d.open))) await page.click('#teamAssignSummary');
  await page.selectOption(`.team-pick[data-name="${name}"]`, teamId);
};
const studentSide = s => ({ points: s.points, posCount: s.posCount, negCount: s.negCount, log: s.log, history: s.history, goals: s.goals });

/* ── 2. Making teams ──────────────────────────────────────────────────────── */
{
  const page = await open();
  eq(await boardShown(page), false, 'make: no board before any team');
  await page.click('#addTeamBtn');
  ok(await page.$eval('#teamsNote', el => /one more team/.test(el.textContent)), 'make: one team asks for another');
  eq(await boardShown(page), false, 'make: one team is not a board');
  await page.fill('#teamsEditor .team-row:last-child .team-name', 'Falcons');
  await page.click('#addTeamBtn');
  await page.fill('#teamsEditor .team-row:last-child .team-name', 'Herons');
  eq(await boardShown(page), true, 'make: two teams show the board');
  await page.click('#addTeamBtn');
  eq(await page.$$eval('#teamsEditor .team-row', r => r.length), 3, 'make: a third row');
  const colors = await page.$$eval('#teamsEditor .team-color', s => s.map(x => x.value));
  eq(new Set(colors).size, 3, 'make: each new team starts on its own colour');
  ok(colors.every(Boolean), 'make: and every one has a colour');
  await page.selectOption('#teamsEditor .team-row:first-child .team-color', '');
  eq((await tiles(page))[0].name.trim(), 'Falcons', 'make: a team with no colour still has its name on the board');
  ok(!/tm-/.test((await tiles(page)).find(t => /Falcons/.test(t.name)).cls), 'make: and no colour class');
  for (let i = 0; i < 5; i++) await page.click('#addTeamBtn');
  eq(await page.$$eval('#teamsEditor .team-row', r => r.length), 8, 'make: eight teams');
  eq(await page.$eval('#addTeamBtn', b => b.disabled), true, 'make: Add team is off at eight');
  confirmAnswer = false;
  await page.click('#teamsEditor .team-row:nth-child(8) [data-remove-team]');
  eq(await page.$$eval('#teamsEditor .team-row', r => r.length), 8, 'make: a refused remove keeps the team');
  confirmAnswer = true;
  await page.click('#teamsEditor .team-row:nth-child(8) [data-remove-team]');
  eq(await page.$$eval('#teamsEditor .team-row', r => r.length), 7, 'make: a confirmed remove drops it');
  eq(await page.$eval('#addTeamBtn', b => b.disabled), false, 'make: and Add team is on again');
  const s = await section(page);
  eq(s.teams.length, 7, 'make: seven teams saved');
  eq(s.teams[0].name, 'Falcons', 'make: the typed name is saved');
  eq(s.teams[1].name, 'Herons', 'make: and the second');
  eq(s.teams[0].color, '', 'make: a cleared colour is saved as none');
  eq(page.__errs, [], 'make: no page errors');
  await page.context().close();
}

/* ── 3. The even deal ─────────────────────────────────────────────────────── */
{
  const page = await open();
  await addTeams(page, ['Falcons', 'Herons', 'Kestrels']);
  const dealWith = async seed => {
    await page.fill('#teamSeed', String(seed));
    await page.click('#dealTeamsBtn');
    return (await section(page)).teamOf;
  };
  const d1 = await dealWith(7);
  eq(Object.keys(d1).sort(), NAMES.slice().sort(), 'deal: every student is on a team');
  const sizes = ['tm1', 'tm2', 'tm3'].map(id => Object.values(d1).filter(v => v === id).length);
  eq(sizes, [2, 2, 2], 'deal: six students across three teams is two each');
  ok(await page.$eval('#msg', el => /same seed gives the same teams/.test(el.textContent)), 'deal: the message says what it did');
  const d2 = await dealWith(7);
  eq(d2, d1, 'deal: the same seed gives the same teams');
  ok(asked.some(q => /already on a team/.test(q)), 'deal: dealing again asks first');
  confirmAnswer = false;
  const d3 = await dealWith(8);
  eq(d3, d1, 'deal: refusing the question changes nothing');
  confirmAnswer = true;
  const d4 = await dealWith(8);
  ok(JSON.stringify(d4) !== JSON.stringify(d1), 'deal: another seed gives another deal');
  eq((await section(page)).teamSeed, 8, 'deal: the seed is saved');
  await page.fill('#teamSeed', '7');
  await page.reload(); await page.waitForTimeout(300);
  eq(await page.$eval('#teamSeed', el => el.value), '8', 'deal: the seed comes back after a reload');
  await page.fill('#namesInput', NAMES.concat(['Gia Hale']).join('\n'));
  await page.fill('#teamSeed', '7');
  confirmAnswer = true;
  await page.click('#dealTeamsBtn');
  const seven = Object.values((await section(page)).teamOf);
  const sz7 = ['tm1', 'tm2', 'tm3'].map(id => seven.filter(v => v === id).length).sort();
  eq(sz7, [2, 2, 3], 'deal: seven across three is 3, 2, 2');
  eq(await page.$eval('#teamAssignSummary', el => el.textContent), 'Who is on which team (7 of 7)', 'deal: the count in the summary');
  await pick(page, 'Gia Hale', '');
  eq(await page.$eval('#teamAssignSummary', el => el.textContent), 'Who is on which team (6 of 7)', 'hand: taking one off updates the count');
  await pick(page, 'Gia Hale', 'tm2');
  eq((await section(page)).teamOf['Gia Hale'], 'tm2', 'hand: choosing a team by hand is saved');
  await page.fill('#teamsEditor .team-row:nth-child(3) .team-name', 'Kites');
  eq(await page.$eval('.team-pick[data-name="Gia Hale"] option:nth-child(4)', o => o.textContent), 'Kites', 'hand: a renamed team is renamed in the pick list');
  await page.click('#teamsEditor .team-row:nth-child(2) [data-remove-team]');
  eq(await page.$eval('.team-pick[data-name="Gia Hale"]', s => s.value), '', 'remove: a student on a removed team goes back to no team');
  eq(page.__errs, [], 'deal: no page errors');
  await page.context().close();
}

/* ── 4. Points: a tap counts for the team, an undo takes it back ──────────── */
const withTeams = sec => {
  sec.teams = [{ id: 'tm1', name: 'Falcons', color: 'red' }, { id: 'tm2', name: 'Herons', color: 'blue' }];
  sec.teamOf = { 'Aiden Whitfield': 'tm1', 'Brooklyn Bell': 'tm1', 'Camila Duarte': 'tm1', 'Dmitri Fox': 'tm2', 'Esi Mensah': 'tm2', 'Farid Noor': 'tm2' };
  sec.teamBank = { tm1: 0, tm2: 0 }; sec.teamDay = { tm1: 0, tm2: 0 }; sec.teamLog = []; sec.teamSeed = 1;
};
const totals = async page => (await tiles(page)).map(t => `${t.pos} ${t.name.trim()} ${t.total}`);
{
  const page = await open(withTeams);
  const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
  eq(await boardShown(page), true, 'points: a saved section with teams shows the board on load');
  eq(await totals(page), ['Tied for 1st Falcons 0', 'Tied for 1st Herons 0'], 'points: everyone at 0 is a tie');
  eq((await tiles(page)).map(t => t.lead), ['', ''], 'points: and nobody leads');
  await tap(page, 'Aiden Whitfield');
  eq(await totals(page), ['1st Falcons 1', '2nd Herons 0'], 'points: a tap counts for the student\'s team');
  eq((await tiles(page))[0].lead, 'Leading', 'points: the leader is told in words');
  ok(/lead-sole/.test((await tiles(page))[0].cls), 'points: and marked');
  ok(/Falcons now leads with 1 point\./.test(await page.$eval('#teamLive', el => el.textContent)), 'points: a screen reader is told who leads');
  eq(await page.$eval('#studentGrid .student-card[data-name="Aiden Whitfield"] .s-points', el => el.textContent), '+1', 'points: the student\'s own points are what they were');
  await tap(page, 'Dmitri Fox', '2'); await tap(page, 'Dmitri Fox', '2');
  eq(await totals(page), ['1st Falcons 1', '2nd Herons −2'], 'points: negative taps count, with a real minus');
  await tap(page, 'Esi Mensah', '4');
  await tap(page, 'Farid Noor', '4');
  eq(await totals(page), ['1st Herons 2', '2nd Falcons 1'], 'points: the order follows the totals');
  eq((await tiles(page))[0].lead, 'Leading', 'points: the new leader is told');
  await tap(page, 'Brooklyn Bell');
  eq(await totals(page), ['Tied for 1st Falcons 2', 'Tied for 1st Herons 2'], 'points: a tie says so in words, in team order');
  eq((await tiles(page)).map(t => t.lead), ['Tied for the lead', 'Tied for the lead'], 'points: and says it is a tie for the lead');
  await page.click('#activityFeed [data-undo-id]');
  eq(await totals(page), ['1st Herons 2', '2nd Falcons 1'], 'undo: the undone tap comes off its team');
  await tap(page, 'Camila Duarte');
  await pick(page, 'Camila Duarte', 'tm2');
  await page.click('#activityFeed [data-undo-id]');
  eq(await totals(page), ['1st Herons 2', '2nd Falcons 1'], 'undo: after the student moved, it comes off the team that got it');
  await tap(page, 'Camila Duarte');
  eq(await totals(page), ['1st Herons 3', '2nd Falcons 1'], 'points: a moved student now counts for the new team');
  await page.click('#awardAllBtn');
  await page.waitForTimeout(420);
  eq(await totals(page), ['1st Herons 7', '2nd Falcons 3'], 'points: "Award everyone" counts for every team');
  const s1 = await section(page);
  eq(s1.points['Camila Duarte'], 2, 'points: students\' own points stay their own');
  eq(s1.log.filter(e => e.team).length, s1.log.length, 'points: every entry of a student with a team is stamped with it');

  /* the board shows teams only */
  const boardText = await page.$eval('#teamBoard', el => el.textContent);
  ok(!NAMES.some(n => boardText.includes(n.split(' ')[0]) || boardText.includes(n.split(' ')[1])), 'board: no student\'s name is on the team board');
  ok(!/Manual|Great Answer|On Task|Off Task|Undo/.test(boardText), 'board: no behaviour entry is on the team board');
  ok(!/\bnote\b/i.test(boardText), 'board: no note is on the team board');
  const size = await page.$eval('#teamTiles .tile-total', el => parseFloat(getComputedStyle(el).fontSize));
  ok(size >= 36, `board: the total is projector size (${size}px)`);
  const nameSize = await page.$eval('#teamTiles .tile-name', el => parseFloat(getComputedStyle(el).fontSize));
  ok(nameSize >= 17, `board: the team name is readable from the back (${nameSize}px)`);
  const tile0 = await page.$eval('#teamTiles .team-tile', el => el.textContent);
  ok(/1st/.test(tile0) && /Herons/.test(tile0) && /Leading/.test(tile0), 'board: position, name and "Leading" are all words');
  const swatchHidden = await page.$eval('#teamTiles .swatch', el => el.getAttribute('aria-hidden'));
  eq(swatchHidden, 'true', 'board: the colour swatch is decoration for a screen reader');

  /* hidden and total modes */
  await page.selectOption('#displayMode', 'positive');
  await tap(page, 'Dmitri Fox', '2');
  await page.selectOption('#displayMode', 'full');
  await page.selectOption('#displayMode', 'positive');
  eq(await boardShown(page), true, 'modes: the board stays in "positives only"');
  ok((await tiles(page)).every(t => !t.total.includes('−')), 'modes: negatives are hidden on the board in "positives only"');
  await page.selectOption('#displayMode', 'total');
  eq(await boardShown(page), true, 'modes: the board stays in "class total only"');
  ok(!(await page.$eval('#studentGrid', (el, names) => names.some(n => el.textContent.includes(n.split(' ')[0])), NAMES)), 'modes: and the student grid still names nobody');
  await page.selectOption('#displayMode', 'full');

  /* teams only */
  eq(await page.$eval('#teamOnlyBtn', b => b.getAttribute('aria-pressed')), 'false', 'only: Teams only starts off');
  await page.click('#teamOnlyBtn');
  eq(await page.$eval('#teamOnlyBtn', b => b.getAttribute('aria-pressed')), 'true', 'only: pressed');
  eq(await page.isVisible('#studentGrid'), false, 'only: the student cards are out of the way');
  eq(await page.isVisible('#teamTiles'), true, 'only: the team board stays');
  await page.click('#teamOnlyBtn');
  eq(await page.isVisible('#studentGrid'), true, 'only: and comes back');

  /* print */
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('#printBtn');
  const printed = await page.$eval('#printBody', el => el.textContent);
  ok(/Team standings/.test(printed) && /1st — Herons/.test(printed), 'print: the report lists team standings when there are teams');
  ok(await page.$eval('#printBody', el => !!el.querySelector('tr td.pts') && el.querySelectorAll('tr').length > 6), 'print: after the students\' own rows');

  eq(await page.evaluate(() => Object.keys(localStorage).sort()), keysBefore, 'storage: no new key was written');
  eq(await page.evaluate(() => location.hash + location.search), '', 'storage: nothing was put in the address');
  eq(page.__blocked, [], 'storage: nothing left the page');
  eq(page.__errs, [], 'points: no page errors');
  await page.context().close();
}

/* ── 5. Direct points ─────────────────────────────────────────────────────── */
{
  const page = await open(withTeams);
  await page.selectOption('#teamGiveTeam', 'tm2');
  await page.fill('#teamGiveAmount', '3');
  await page.fill('#teamGiveLabel', 'Quietest line');
  await page.click('#teamGiveBtn');
  eq(await totals(page), ['1st Herons 3', '2nd Falcons 0'], 'give: points given to a team count');
  ok(/Herons/.test(await page.$eval('#teamLogList', el => el.textContent)) && /Quietest line/.test(await page.$eval('#teamLogList', el => el.textContent)), 'give: the log names the team and the reason');
  eq(await page.$eval('#teamGiveLabel', el => el.value), '', 'give: the reason box is cleared');
  await page.fill('#teamGiveAmount', '0');
  await page.click('#teamGiveBtn');
  ok(/not 0/.test(await page.$eval('#msg', el => el.textContent)), 'give: 0 is refused with a reason');
  await page.fill('#teamGiveAmount', '-2');
  await page.selectOption('#teamGiveTeam', 'tm1');
  await page.click('#teamGiveBtn');
  eq(await totals(page), ['1st Herons 3', '2nd Falcons −2'], 'give: a negative amount takes points off');
  await page.focus('#teamTiles [data-team-give="tm1"][data-delta="1"]');
  await page.keyboard.press('Enter');
  eq(await totals(page), ['1st Herons 3', '2nd Falcons −1'], 'give: the +1 button on a tile gives one point');
  eq(await page.evaluate(() => document.activeElement.dataset.teamGive + '/' + document.activeElement.dataset.delta), 'tm1/1', 'give: focus stays on the button after the board redraws');
  await page.click('#teamTiles [data-team-give="tm2"][data-delta="-1"]');
  eq(await totals(page), ['1st Herons 2', '2nd Falcons −1'], 'give: the −1 button takes one off');
  const sBefore = await section(page);
  eq(sBefore.log.length, 0, 'give: direct points are not student log entries');
  eq(Object.keys(sBefore.points).length, 0, 'give: and give no student a point');
  await page.click('#teamLogList [data-team-undo]');
  eq(await totals(page), ['1st Herons 3', '2nd Falcons \u22121'], 'give: undo takes the newest direct award off its team');
  eq(await page.$$eval('#teamLogList .team-log-row', r => r.length), 3, 'give: and the log keeps the others');
  await page.click('#teamLogList [data-team-undo]');
  eq(await totals(page), ['1st Herons 3', '2nd Falcons \u22122'], 'give: undo again, the next one back');
  eq((await section(page)).teamLog.length, 2, 'give: the saved log follows');
  eq(page.__errs, [], 'give: no page errors');
  await page.context().close();
}

/* ── 6. Archive, undo the day, reset ──────────────────────────────────────── */
{
  const page = await open(withTeams);
  await tap(page, 'Aiden Whitfield'); await tap(page, 'Esi Mensah', '4');
  await page.fill('#teamGiveAmount', '5'); await page.selectOption('#teamGiveTeam', 'tm1'); await page.click('#teamGiveBtn');
  eq(await totals(page), ['1st Falcons 6', '2nd Herons 2'], 'day: before the archive');
  await page.click('#archiveBtn');
  eq(await totals(page), ['1st Falcons 6', '2nd Herons 2'], 'day: archiving keeps the team totals');
  const arch = await section(page);
  eq(arch.points, {}, 'day: and zeroes the students');
  eq(arch.history[0].rows.find(r => r.name === 'Aiden Whitfield').points, 1, 'day: the archived row is the student\'s own');
  ok(arch.history.every(h => h.rows.every(r => !('team' in r))), 'day: no team field in an archived row');
  eq(await page.$$eval('#teamLogList .team-log-row', r => r.length), 0, 'day: the direct log is filed away');
  await tap(page, 'Brooklyn Bell');
  await page.fill('#teamGiveAmount', '1'); await page.click('#teamGiveBtn');
  eq(await totals(page), ['1st Falcons 8', '2nd Herons 2'], 'day: today adds to the bank');
  await page.click('#clearDayBtn');
  eq(await totals(page), ['1st Falcons 6', '2nd Herons 2'], 'day: undo the whole day drops only today\'s share');
  await page.click('#teamGiveBtn');
  await page.click('#archiveBtn');
  await page.click('#teamGiveBtn');
  await page.click('#clearDayBtn');
  eq(await totals(page), ['1st Falcons 7', '2nd Herons 2'], 'day: undo the day works when only direct points were given');

  const kept = studentSide(await section(page));
  await tap(page, 'Aiden Whitfield');
  const withTap = studentSide(await section(page));
  confirmAnswer = false;
  await page.click('#resetTeamsBtn');
  ok(asked.some(q => /Reset every team/.test(q)), 'reset: it asks first');
  eq((await totals(page))[0], '1st Falcons 8', 'reset: refusing changes nothing');
  confirmAnswer = true;
  await page.click('#resetTeamsBtn');
  eq(await totals(page), ['Tied for 1st Falcons 0', 'Tied for 1st Herons 0'], 'reset: every team to 0');
  const after = await section(page);
  eq(studentSide(after), withTap, 'reset: every student\'s own points, counts, log, history and goals are untouched');
  ok(JSON.stringify(withTap) !== JSON.stringify(kept), 'reset: (the check above had something to protect)');
  eq(after.teams.map(t => t.name), ['Falcons', 'Herons'], 'reset: the teams are kept');
  eq(Object.keys(after.teamOf).length, 6, 'reset: and who is on them');
  eq(await page.$eval('#studentGrid .student-card[data-name="Aiden Whitfield"] .s-points', el => el.textContent), '+1', 'reset: the card still shows the student\'s point');
  await page.reload(); await page.waitForTimeout(300);
  eq(await totals(page), ['Tied for 1st Falcons 0', 'Tied for 1st Herons 0'], 'reset: and it is saved');
  eq(page.__errs, [], 'day: no page errors');
  await page.context().close();
}

/* ── 7. A saved section with teams loads again; hand-edited ones are cleaned ─ */
{
  const page = await open(sec => {
    withTeams(sec);
    sec.teamBank = { tm1: 4, tm2: 7 };
    sec.teams.push({ id: 'tm1', name: 'Dup', color: 'red' });
    sec.teamOf['Nobody Here'] = 'tm9';
  });
  eq(await totals(page), ['1st Herons 7', '2nd Falcons 4'], 'load: saved totals come back');
  eq(await page.$eval('#teamsEditor .team-name', el => el.value), 'Falcons', 'load: and the editor');
  await page.click('#addTeamBtn');
  const s = await section(page);
  ok(!('Nobody Here' in s.teamOf), 'load: an assignment to a missing team is dropped once the section is saved');
  eq(s.teams.length, 3, 'load: the duplicate id was not kept');
  promptAnswer = 'Period 5';
  await page.click('#newSetBtn');
  promptAnswer = '';
  eq(await boardShown(page), false, 'sections: a new section has no teams');
  eq(await page.$eval('#teamsNote', el => el.textContent), 'No teams yet. Add at least two to show the team board.', 'sections: and says so');
  eq(page.__errs, [], 'load: no page errors');
  await page.context().close();
}

/* ── 8. Keyboard and screen reader ────────────────────────────────────────── */
{
  const page = await open(withTeams);
  const scan = await a11yScan(page, { impact: 'minor' });
  eq(scan.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id), [], 'a11y: no serious or critical violation with teams on screen');
  const names = await page.$$eval('#teamsCard input, #teamsCard select, #teamsCard button', els => els.map(el =>
    (el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || el.textContent).trim()));
  ok(names.every(Boolean), 'a11y: every control in the Teams card has a name');
  ok(await page.$eval('#teamBoard', el => el.getAttribute('aria-labelledby') === 'teamBoardTitle' && !!document.getElementById('teamBoardTitle').textContent), 'a11y: the board is a labelled region');
  eq(await page.$eval('#teamLive', el => el.getAttribute('aria-live')), 'polite', 'a11y: the lead is announced politely');
  eq(await page.$$eval('#teamTiles > li', l => l.length), 2, 'a11y: the tiles are a list');
  await page.focus('#addTeamBtn');
  await page.keyboard.press('Enter');
  eq(await page.evaluate(() => document.activeElement.className), 'team-name', 'a11y: Add team by keyboard puts the cursor in the new name');
  eq(page.__errs, [], 'a11y: no page errors');
  await page.context().close();
}

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
if (failed) { console.log('\nFailed:\n  ' + fails.join('\n  ')); process.exit(1); }
