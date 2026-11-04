// smoke-project-teams.mjs — 002's project teams on the page (AI-31, rank 111).
//
//   node Tools/group-team-generator/test/smoke-project-teams.mjs      (port 8678)
//
// Devon's answers of 2026-10-07 (DEVON-ANSWERS-2026-10-07.md 4.1 to 4.6), driven through the real page with its clock
// pinned: teams started from the groups on screen and kept until dissolved (4.1); a printed task list (4.2); a contract of
// his own wording with blanks, printed for signing on paper with nothing recorded (4.3); a school day counted once in the
// pair memory, never on a weekend, never for an absent student, never twice for one date (4.4); teams that are locked groups
// on screen, so Reshuffle works on `previous` and `lock` (4.5); a student moved by hand (4.6). It also holds that a class
// that never starts a team saves the string it always did, that no key is added, and that nothing about a team is in a
// share link. Every name is invented. Exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, prepPage, settle, a11yScan, SITE } from '../../board-check/harness.mjs';

const PORT = 8678;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/002-group-team-generator.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, label) => eq(JSON.stringify(a), JSON.stringify(b), label);

const NAMES = ['Ada Lin', 'Bo Rey', 'Cy Park', 'Di Moss', 'Eli Fox', 'Fay Dunn', 'Gus Hale', 'Hana Ito'];

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1200 });
let dialogs = [];
page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });

const at = (y, m, d) => new Date(y, m - 1, d, 10, 0, 0);
async function open(date) {
  await page.clock.setFixedTime(date);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 250);
  await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('results').innerHTML; window.__printTitle = document.getElementById('print-title').textContent; }; });
}
async function reload(date) {
  await page.clock.setFixedTime(date);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 250);
  await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById('results').innerHTML; window.__printTitle = document.getElementById('print-title').textContent; }; });
}
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('gtg:data:My Class')));
const pairCount = async (a, b) => {
  const s = await saved();
  const k = a < b ? a + '␟' + b : b + '␟' + a;
  return s.pairHistory && s.pairHistory[k] ? s.pairHistory[k].count : 0;
};
const cards = () => page.evaluate(() => [...document.querySelectorAll('#results .group-card')].map(c => ({
  label: c.querySelector('h3 > span').childNodes[0].textContent.trim(),
  locked: c.classList.contains('locked'),
  members: [...c.querySelectorAll('li > span:first-child')].map(x => x.textContent.trim())
})));
const floaters = () => page.evaluate(() => { const f = document.querySelector('#results .floater-box'); return f ? f.textContent : ''; });
const msg = () => page.evaluate(() => document.getElementById('msg').textContent);
const status = () => page.evaluate(() => document.getElementById('pt-status').textContent);
const keysNow = () => page.evaluate(() => Object.keys(localStorage).sort());

console.log('Group / Team Generator — project teams');

/* ── 1. a class that never starts a team ──────────────────────────────── */
await open(at(2026, 11, 3)); // a Tuesday
await page.fill('#names-input', NAMES.join('\n'));
await page.dispatchEvent('#names-input', 'input');
await page.fill('#split-value', '2');
await page.dispatchEvent('#split-value', 'input');
ok(await page.isDisabled('#pt-start-btn'), 'Start project teams is off before any groups are made');
ok(await page.isHidden('#pt-body'), 'the editor, contract and print buttons are hidden while there are no teams');
ok(await page.isHidden('#pt-show-btn'), 'so is Put the teams on screen');
ok((await status()).startsWith('No project teams yet'), 'the status says there are none');
await page.click('#generate-btn'); await settle(page, 250);
ok(!(await page.isDisabled('#pt-start-btn')), 'Start project teams is on once groups are on screen');
let s0 = await saved();
ok(!('projectTeams' in s0) && !('projectContract' in s0), 'a class with no teams saves no project field');
const keys0 = await keysNow();
await reload(at(2026, 11, 4)); // a Wednesday: no teams, so nothing is counted
const sNo = await saved();
eq(JSON.stringify(sNo.pairHistory), JSON.stringify(s0.pairHistory), 'a school day opened with no teams adds nothing to the pair memory');
ok(!('projectTeams' in sNo) && !('projectContract' in sNo), 'and still saves no project field');
await reload(at(2026, 11, 3));

/* ── 2. start teams from the groups on screen (4.1, 4.5) ──────────────── */
await page.click('#generate-btn'); await settle(page, 250);
await page.click('#generate-btn'); await settle(page, 250);
ok(!(await page.isDisabled('#undo-btn')), 'Undo is on after two shuffles');
const groups = await cards();
eq(groups.length, 2, 'two groups of four');
const [g0, g1] = groups;
const [a, b] = g0.members, [c, d] = g1.members;
const beforeA_B = await pairCount(a, b);
const beforeA_C = await pairCount(a, c);
await page.click('#pt-start-btn'); await settle(page, 250);
let s1 = await saved();
ok(!!s1.projectTeams, 'Start project teams saves the teams in the class’s own record');
eq(s1.projectTeams.teams.length, 2, 'two teams');
same(s1.projectTeams.teams.map(t => t.name), [g0.label, g1.label], 'named as the groups were');
same(s1.projectTeams.teams.map(t => t.members), [g0.members, g1.members], 'with the same students');
eq(s1.projectTeams.since, '2026-11-03', 'started today, by the pinned clock');
eq(s1.projectTeams.days, 1, 'and today counted, since it is a Tuesday');
eq(await pairCount(a, b), beforeA_B + 1, 'two teammates have worked together one more time (4.4)');
eq(await pairCount(a, c), beforeA_C, 'two students on different teams have not');
ok(await page.isDisabled('#undo-btn'), 'counting a day clears Undo, which would otherwise put the memory back without it');
ok((await status()).includes('2 project teams') && (await status()).includes('1 school day'), 'the status says so');
ok(!(await page.isHidden('#pt-body')), 'the editor shows');
ok(!(await page.isHidden('#pt-show-btn')), 'and so does Put the teams on screen');
ok((await msg()).startsWith('Project teams started: 2'), 'and a message says what happened');
const keys1 = await keysNow();
same(keys1, keys0, 'no new localStorage key was added');
ok(Object.keys(s1).every(k => k in s0 || ['projectTeams', 'pairHistory', 'pairGen', 'groupHistory', 'roleHistory'].includes(k)), 'the record gained no field but projectTeams (and the memory it updates)');

/* ── 3. once a day, not on a weekend, not twice (4.4) ─────────────────── */
let n = await pairCount(a, b);
await reload(at(2026, 11, 3));
eq(await pairCount(a, b), n, 'opening the page again the same day does not count it again');
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
eq(await pairCount(a, b), n, 'nor does coming back to the tab');
await reload(at(2026, 11, 4));
eq(await pairCount(a, b), n + 1, 'the next school day counts once');
eq((await saved()).projectTeams.days, 2, 'two days');
await reload(at(2026, 11, 7));
eq(await pairCount(a, b), n + 1, 'a Saturday counts nothing');
await reload(at(2026, 11, 8));
eq(await pairCount(a, b), n + 1, 'a Sunday counts nothing');
await reload(at(2026, 11, 9));
eq(await pairCount(a, b), n + 2, 'the Monday after counts once, not once for each day between');
eq((await saved()).projectTeams.days, 3, 'three days');
await reload(at(2026, 11, 2));
eq(await pairCount(a, b), n + 2, 'a clock set back counts nothing');
eq(await pairCount(a, c), beforeA_C, 'students on different teams have still not worked together');

/* ── 4. an absent student is left out of that day ─────────────────────── */
await page.evaluate(n0 => { const cb = document.querySelector('[data-absent="' + n0 + '"]'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }, a);
const [nAB, nBd] = [await pairCount(a, b), await pairCount(b, g0.members[2])];
await reload(at(2026, 11, 10));
eq(await pairCount(a, b), nAB, 'a student marked absent has no pair counted that day');
eq(await pairCount(b, g0.members[2]), nBd + 1, 'the rest of the team is counted');
await page.evaluate(n0 => { const cb = document.querySelector('[data-absent="' + n0 + '"]'); cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }, a);

/* ── 5. moving a student by hand (4.6) ────────────────────────────────── */
const mover = g0.members[3];
await page.selectOption(`select[aria-label="Move ${mover} to another team"]`, { label: 'To ' + g1.label });
await settle(page, 150);
let s2 = await saved();
ok(!s2.projectTeams.teams[0].members.includes(mover) && s2.projectTeams.teams[1].members.includes(mover), 'a student moves between teams by hand');
const nMd = await pairCount(mover, d);
await reload(at(2026, 11, 11));
eq(await pairCount(mover, d), nMd + 1, 'and is counted with the new team from the next day');
await page.selectOption(`select[aria-label="Move ${mover} to another team"]`, { label: 'Take off the teams' });
s2 = await saved();
ok(s2.projectTeams.teams.every(t => !t.members.includes(mover)), 'a student is taken off the teams');
ok(await page.locator('select[aria-label^="Add a student to"]').first().evaluate((el, who) => [...el.options].some(o => o.value === who), mover), 'and can be added to a team again');
await page.selectOption('select[aria-label^="Add a student to"] >> nth=0', { value: mover });
s2 = await saved();
ok(s2.projectTeams.teams[0].members.includes(mover), 'added back to the first team');

/* ── 6. the task list (4.2): printed only ─────────────────────────────── */
const t0Name = s2.projectTeams.teams[0].name;
await page.fill('textarea[aria-label^="Tasks for"] >> nth=0', 'Choose a topic\nDraft the <b>poster</b>\n\nPractise the talk');
s2 = await saved();
eq(s2.projectTeams.teams[0].tasks, 'Choose a topic\nDraft the <b>poster</b>\n\nPractise the talk', 'tasks are saved as typed');
const resultsBefore = await page.evaluate(() => document.getElementById('results').innerHTML);
await page.click('#pt-print-tasks-btn');
const pr = await page.evaluate(() => ({ html: window.__printed, title: window.__printTitle, now: document.getElementById('results').innerHTML }));
eq((pr.html.match(/class="sheet-page p-tasks"/g) || []).length, 2, 'one task page for each team');
ok(pr.html.includes('Choose a topic') && pr.html.includes('Practise the talk'), 'the tasks are on the page');
ok(pr.html.includes('Draft the &lt;b&gt;poster&lt;/b&gt;') && !pr.html.includes('<b>poster'), 'and markup in a task is text');
eq((pr.html.match(/class="p-check"/g) || []).length, 3, 'with a box to tick in pen for each of the three tasks (the blank line is not one)');
ok(pr.html.includes('No tasks written for this team yet.'), 'the team with no tasks says so');
ok(pr.title.startsWith('Task lists'), 'the page is titled');
ok(!/<input|<button|<textarea/.test(pr.html), 'nothing on a task page can be ticked on a screen');
eq(pr.now, resultsBefore, 'the groups on screen come back after printing');

/* ── 7. the contract (4.3): his wording, with blanks, signed on paper ─── */
await page.click('#pt-print-contracts-btn');
let cp = await page.evaluate(() => window.__printed);
eq((cp.match(/class="sheet-page p-contract"/g) || []).length, 2, 'one contract for each team');
ok(cp.includes('Team contract for ' + t0Name.replace(/&/g, '&amp;')), 'the starter wording names the team');
ok((cp.match(/class="p-blank"/g) || []).length >= 12, 'with blanks to write in');
eq((cp.match(/class="p-sig"/g) || []).length, 8, 'and a signature line for each of the eight students');
await page.fill('#pt-contract', 'Our deal for {team}\nWe are {members}.\nWe promise to ______ by ____.');
s2 = await saved();
eq(s2.projectContract, 'Our deal for {team}\nWe are {members}.\nWe promise to ______ by ____.', 'his own wording is saved in the class’s record');
await page.click('#pt-print-contracts-btn');
cp = await page.evaluate(() => window.__printed);
ok(cp.includes('<h2>Our deal for ' + t0Name.replace(/&/g, '&amp;') + '</h2>'), 'and is what is printed');
eq((cp.match(/class="p-blank"/g) || []).length, 4, 'two blanks on each team’s page');
ok(!cp.includes('Team contract for'), 'the starter wording is not mixed in');
ok(!/<input|<button|<textarea/.test(cp), 'a contract has nothing to fill in on a screen');
await reload(at(2026, 11, 11));
eq(await page.inputValue('#pt-contract'), 'Our deal for {team}\nWe are {members}.\nWe promise to ______ by ____.', 'his wording is still there after a reload');
await page.click('#pt-contract-reset-btn');
s2 = await saved();
ok(!('projectContract' in s2), 'the starter wording is not stored (only wording that differs is)');
await page.fill('#pt-contract', 'Kept wording ___');
await page.fill('textarea[aria-label^="Tasks for"] >> nth=1', 'Second team task');

/* ── 8. teams on screen are locked groups (4.5) ───────────────────────── */
await page.click('#pt-show-btn'); await settle(page, 250);
let shown = await cards();
eq(shown.length, 2, 'both teams are on screen as groups');
ok(shown.every(x => x.locked), 'each is locked');
same(shown.map(x => x.label), (await saved()).projectTeams.teams.map(t => t.name), 'with the team’s name');
same(shown.map(x => x.members.slice().sort()), (await saved()).projectTeams.teams.map(t => t.members.slice().sort()), 'and the team’s students');
ok((await page.evaluate(() => document.getElementById('explain-area').textContent)).includes('project teams'), 'the explanation says what they are');
await page.click('#regenerate-btn'); await settle(page, 200);
ok((await msg()).startsWith('Every project team is locked'), 'Reshuffle with every team locked says there is nothing to deal');
same((await cards()).map(x => x.members), shown.map(x => x.members), 'and changes nothing');
await page.click('#print-tents-btn');
const tents = await page.evaluate(() => window.__printed);
ok(tents.includes(shown[0].label.replace(/&/g, '&amp;')) && tents.includes(shown[1].label.replace(/&/g, '&amp;')), 'table tents carry the team names');
await page.click('#print-sheets-btn');
const sheets = await page.evaluate(() => window.__printed);
ok(sheets.includes('<h2>' + shown[1].label.replace(/&/g, '&amp;') + '</h2>'), 'group sheets carry the team names');
same((await cards()).map(x => x.members), shown.map(x => x.members), 'the teams on screen come back after printing');
eq(await page.evaluate(() => document.getElementById('export-row').style.display), 'flex', 'and so does the export row');

// one student off the teams becomes a floater; unlocking a team lets the shuffle deal them in
const off = shown[0].members[0];
await page.selectOption(`select[aria-label="Move ${off} to another team"]`, { label: 'Take off the teams' });
await page.click('#pt-show-btn'); await settle(page, 250);
shown = await cards();
ok((await floaters()).includes(off), 'a student on no team is shown as not assigned to a group');
await page.click('[data-lock="0"]');
const keptTeam = (await cards())[1];
await page.click('#regenerate-btn'); await settle(page, 300);
const after = await cards();
same(after[1].members, keptTeam.members, 'the locked team is exactly as it was');
eq(after[1].label, keptTeam.label, 'and keeps its name');
ok(!after[0].locked, 'the unlocked one was dealt again');
ok(after[0].label !== shown[0].label || /^Group 1$/.test(after[0].label), 'and takes the naming style’s label, not the old team name');
ok(after[0].members.includes(off) || (await floaters()).includes(off) === false, 'the student on no team was dealt in');
ok(!(await floaters()).includes(off), 'and is no longer a floater');
const stillSaved = (await saved()).projectTeams;
ok(!stillSaved.teams.some(t => t.members.includes(off)), 'the saved teams are not changed by a reshuffle (moves are by hand)');

/* ── 9. nothing about a team is shared ────────────────────────────────── */
const html = fs.readFileSync(path.join(SITE, 'Tools/002-group-team-generator.html'), 'utf8');
const fn = html.slice(html.indexOf('function buildSharePayload'), html.indexOf('function looksLikeSharePayload'));
ok(fn.length > 100 && !/projectTeams|projectContract|tasks/.test(fn), 'the share payload reads no team, task or contract field');
ok(html.indexOf('projectTeams') > 0 && !/state-link|handoffs/.test(html.slice(html.indexOf('function countProjectDay'), html.indexOf('function countProjectDay') + 6000)), 'and the project-team code touches no link or hand-off');

/* ── 10. axe, a screen reader’s view of the editor ────────────────── */
await page.click('#pt-show-btn');
const ax = await a11yScan(page);
same(ax.map(x => x.id + ' ' + x.nodes.join(' ')), [], 'no serious or critical accessibility violation with teams started');

/* ── 11. dissolve ─────────────────────────────────────────────────────── */
dialogs = [];
const nDis = await pairCount(a, b);
await page.click('#pt-dissolve-btn'); await settle(page, 200);
eq(dialogs.length, 1, 'dissolving asks first');
ok(dialogs[0].includes('can’t be undone') && dialogs[0].includes('pairing memory keeps what they earned'), 'and says what is kept');
let s3 = await saved();
ok(!('projectTeams' in s3), 'the teams are gone from the record');
eq(s3.projectContract, 'Kept wording ___', 'his contract wording is kept for the next project');
eq(await pairCount(a, b), nDis, 'the pairing memory keeps what they earned');
ok(await page.isHidden('#pt-body'), 'the editor is hidden again');
ok((await status()).startsWith('No project teams yet'), 'the status says there are none');
await reload(at(2026, 11, 12));
eq(await pairCount(a, b), nDis, 'a school day after dissolving counts nothing');

/* ── 12. no error, no request off the site ────────────────────────────── */
same(page.__errs || [], [], 'no console or page error');
same(page.__blocked || [], [], 'no request left the site');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
