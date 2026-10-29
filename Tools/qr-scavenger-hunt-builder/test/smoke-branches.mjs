// smoke-branches.mjs — 018's per-answer branching (Path 18 P3, v391).
//
//   node Tools/qr-scavenger-hunt-builder/test/smoke-branches.mjs      (or: npm run test:scavenger-hunt-branches)
//
// A multiple-choice station may send a team on: "Then go to" on a choice stores
// branches.byAnswer { <choice text>: <station id> }. A branched choice is an accepted answer, so
// picking it at check-in marks the station reached and stores where the team was sent (on the mark,
// so clearing the mark clears the route); Live Run's "next up" follows it. A branch that would strand a team
// is refused with a sentence and nothing is saved. Cases: no branch, as it always was; setting and
// reloading one; the refusal (a closed loop of right answers); a rename that keeps the branch; the
// check-in (the teacher's button shows the target, the team is sent, a wrong choice with no branch
// still fails); un-marking; removing the target; the share link. No console errors. Exits 1 on failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import * as F from '../../stations/test/_fixtures.mjs';

const PORT = 8572;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/018-qr-scavenger-hunt-builder.html';
const KEY = 'qr-scavenger-hunt-sets';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const hunt = () => ({
  name: 'Trail hunt', cardsPerPage: '4', ecLevel: 'Q', showNumber: true, id: 'trl1',
  stations: [
    { id: 'a1xx', ...F.hSt('Start', 'Walk to the gate') },
    { id: 'b2xx', ...F.hSt('Fork', 'Which way do you go?', { qType: 'choice', choices: ['Forest', 'River', 'Cave'], correctChoice: 0, codeWord: 'FORK' }) },
    { id: 'c3xx', ...F.hSt('Choose again', 'Pick one', { qType: 'choice', choices: ['Back', 'On'], correctChoice: 0, codeWord: 'AGAIN' }) },
    { id: 'd4xx', ...F.hSt('Bridge', 'Cross the bridge') },
  ],
  run: { by: 'id', teams: [F.hTeam('Team 1', 'K7Q')], timerRunning: false, timerStartedAt: null, timerElapsedMs: 0, raceStartAt: null, checkinStation: 'b2xx' }
});

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept());

const seed = (h) => page.evaluate(([k, x]) => { localStorage.setItem(k, JSON.stringify({ current: x.name, sets: { [x.name]: x } })); }, [KEY, h]);
const saved = () => page.evaluate((k) => { const o = JSON.parse(localStorage.getItem(k)); return o.sets[o.current]; }, KEY);
const open = async () => { await page.goto(URL_PAGE, { waitUntil: 'load' }); await settle(page, 400); };
const tab = async (t) => { await page.locator('#tab-' + t).click(); await settle(page, 200); };
const branch = (row, ci) => page.locator(`tr.detail-row .f-branch[data-idx="${row}"][data-ci="${ci}"]`);
const pick = async (row, ci, value) => { await branch(row, ci).selectOption(value); await settle(page, 250); };
const msg = () => page.locator('#msg').textContent();
const status = (n) => page.locator('#team-progress-list .tp-status').nth(n).textContent();

console.log('018 — no branch: as it always was');
await page.goto(URL_PAGE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await seed(hunt()); await open();
eq(await branch(1, 0).inputValue(), '', 'a choice starts with "No branch"');
ok(!('branches' in (await saved()).stations[1]), 'nothing written to disk');
eq(await page.locator('#branch-info').isVisible(), false, 'no warning shown');
ok(!(await branch(1, 0).locator('option').allTextContents()).some(t => /Station 2/.test(t)), 'a station cannot branch to itself (not offered)');

console.log('018 — setting a branch');
await pick(1, 1, 'd4xx');
let d = await saved();
eq(d.stations[1].branches, { byAnswer: { River: 'd4xx' } }, 'saved as { choice text: station id }');
await open();
eq(await branch(1, 1).inputValue(), 'd4xx', 'a reload shows it');
await page.locator('tr[data-idx="3"] [data-move="-1"]').click(); await settle(page, 200);
eq(await branch(1, 1).inputValue(), 'd4xx', 'moving the target keeps the branch (ids, not positions)');
await page.locator('tr[data-idx="2"] [data-move="1"]').click(); await settle(page, 200);

console.log('018 — a branch that would strand a team is refused');
await pick(1, 0, 'c3xx');                       // Forest (the right answer) -> the choose-again station
eq((await saved()).stations[1].branches.byAnswer.Forest, 'c3xx', 'a right answer sent on is allowed while the target can finish');
await pick(1, 1, '');                           // River off, so the fork's only way on is the right answer
await pick(2, 0, 'b2xx');                       // Back (its right answer) -> the fork: a closed loop
ok(/never finish/.test(await msg()), 'the refusal says a team could never finish: ' + (await msg()));
eq(await branch(2, 0).inputValue(), '', 'and the select goes back to No branch');
ok(!('branches' in (await saved()).stations[2]), 'nothing was saved');
await pick(2, 1, 'b2xx');                       // On (a wrong choice) -> the fork: the other way out exists
eq((await saved()).stations[2].branches, { byAnswer: { On: 'b2xx' } }, 'a branch on the wrong choice is fine: the right answer still ends the hunt');
await page.locator('tr.detail-row').nth(1).locator('.f-choice-correct[data-ci="1"]').click();
await settle(page, 250);
ok(/never finish/.test(await msg()), 'moving the right answer onto a branched choice that closes the loop is refused too');
eq((await saved()).stations[2].correctChoice, 0, 'and the right answer is back where it was');
await pick(2, 1, '');
await pick(1, 1, 'd4xx');

console.log('018 — a rename keeps the branch with its choice');
const river = page.locator('tr.detail-row').nth(0).locator('.f-choice-text[data-ci="1"]');
await river.fill('Stream'); await settle(page, 300);
d = await saved();
eq(d.stations[1].branches.byAnswer.Stream, 'd4xx', 'the branch is under the new wording');
ok(!('River' in d.stations[1].branches.byAnswer), 'and not the old');
await river.fill('River'); await settle(page, 300);

console.log('018 — check-in: the branched choice sends the team on');
await tab('run');
await page.locator('#checkin-code').fill('K7Q'); await page.locator('#checkin-submit-btn').click(); await settle(page, 200);
const labels = await page.locator('.checkin-choice-btn').allTextContents();
ok(/River → Station 4/.test(labels[1]), 'the teacher\'s button shows where River goes: ' + labels[1]);
ok(!/→/.test(labels[2]), 'a choice without a branch shows none');
await page.locator('.checkin-choice-btn').nth(2).click(); await settle(page, 200);
ok(/Not correct yet/.test(await page.locator('#checkin-feedback').textContent()), 'a wrong choice with no branch is still wrong');
await page.locator('.checkin-choice-btn').nth(1).click(); await settle(page, 250);
ok(/Send them to Station 4/.test(await page.locator('#checkin-feedback').textContent()), 'the teacher is told where to send them');
d = await saved();
eq(d.run.teams[0].marks.b2xx.branch, 'd4xx', 'the route is on the mark');
eq(d.run.teams[0].marks.b2xx.correct, true, 'and the station counts as reached');
ok(/Next up: Station 4/.test(await status(0)) && /sent there by a branch/.test(await status(0)), 'Live Run sends the team to Station 4: ' + await status(0));

console.log('018 — clearing the mark clears the route; reaching the target moves on');
await page.locator('#team-progress-list .station-btn[data-team="0"][data-station="1"]').click(); await settle(page, 200);
ok(/Next up: Station 1/.test(await status(0)), 'with the mark gone the team is back to the first unreached station');
ok(!('b2xx' in (await saved()).run.teams[0].marks), 'no route kept');
await page.locator('#checkin-code').fill('K7Q'); await page.locator('#checkin-submit-btn').click(); await settle(page, 200);
await page.locator('.checkin-choice-btn').nth(1).click(); await settle(page, 200);
await page.locator('#team-progress-list .station-btn[data-team="0"][data-station="3"]').click(); await settle(page, 200);
ok(!/branch/.test(await status(0)), 'once the target is reached the branch no longer steers');

console.log('018 — the link carries the branch');
await tab('build');
const sent = await saved();
const url = await page.evaluate((h) => window.StateLink.buildShareUrl('hunt', window.Stations.shareState(h, { kind: 'hunt' }), {}), sent);
await page.evaluate(() => localStorage.clear());
await page.goto(url, { waitUntil: 'load' }); await settle(page, 400);
const got = await saved();
eq(got.stations[1].branches, sent.stations[1].branches, 'the arrival holds the same branches');
eq(got.stations[1].branches.byAnswer.Forest, got.stations[2].id, 'aimed at the arrival\'s own station ids');

console.log('018 — the answer key and route card show the branch');
await tab('build');
await page.locator('#print-answers-btn').click(); await settle(page, 200);
const keyRows = await page.locator('#answer-key-body tr').allTextContents();
ok(/Choice A .Forest. sends the team to Station 3/.test(keyRows[1]), 'the key says where Forest sends a team: ' + keyRows[1]);
ok(!/sends the team/.test(keyRows[0] + keyRows[3]), 'a station with no branch says nothing');
await tab('run');
if (!(await page.locator('#teams-body input').count())) { await page.locator('#add-team-btn').click(); await settle(page, 200); }
await page.locator('#print-routes-btn').click(); await settle(page, 200);
const note = await page.locator('#print-routes-grid .p-card').first().locator('.p-route-note').textContent();
ok(/answer decides where you go next/.test(note), 'the route card warns that some stops branch');
ok(!/Forest/.test(note), 'the route card does not give the branch away');

console.log('018 — removing the target drops the branch');
await tab('build');
await page.locator('tr[data-idx="2"] [data-remove]').click(); await settle(page, 250);
d = await saved();
ok(!JSON.stringify(d.stations[1].branches || {}).includes('c3xx'), 'a branch to the removed station is gone');
ok(page.__errs.length === 0, 'no console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));
await browser.close(); server.close();
console.log(`scavenger hunt branches: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
