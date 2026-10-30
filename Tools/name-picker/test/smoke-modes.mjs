// smoke-modes.mjs — Name Picker: each pick mode still runs through the page and names a winner.
//
//   node Tools/name-picker/test/smoke-modes.mjs
//
// Path 15 P1 steps 3 to 7 lifted jump, disappear, slot, multi, tournament, Team Draft and the winner dialogs (np-ui.js) into np-mode-*.js behind a host object the
// page builds. test:name-picker-modes holds the logic to the old code; this drives the real
// page: for each mode, with Let's Go Crazy off and on, one pick ends on the winner dialog
// with a name from the roster, and the rolling state is released again.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8605;
const BASE = `http://127.0.0.1:${PORT}`;
const ROSTER = ['Ada', 'Bo', 'Cy', 'Di', 'Ed'];
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

const server = await serve(PORT);
const browser = await launch();
for (const crazy of [false, true]) for (const mode of ['jump', 'disappear', 'slot']) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
  await page.click('#settingsBtn');
  await settle(page, 300);
  await page.fill('#namesInput', ROSTER.join('\n'));
  await page.click('#loadNames');
  await settle(page, 300);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.selectOption('#mode', mode);
  if (crazy) await page.evaluate(() => document.getElementById('crazyBtn').click());
  await page.evaluate(() => document.getElementById('pickBtn').click());
  const label = `${mode}${crazy ? ' + crazy' : ''}`;
  try {
    await page.waitForSelector('.modal-overlay .winner-name', { timeout: 20000 });
    const winner = (await page.textContent('.modal-overlay .winner-name')).trim();
    ok(ROSTER.includes(winner), `${label}: the dialog names someone on the roster (${winner})`);
    await page.evaluate(() => document.getElementById('modalDone').click());
    await settle(page, 400);
    ok(await page.evaluate(() => !document.getElementById('pickBtn').disabled), `${label}: the pick button is free again`);
  } catch (e) { failed++; console.log('  FAIL ' + label + ': no winner dialog (' + String(e.message).split('\n')[0] + ')'); }
  await page.context().close();
}
/* Pick several at once (np-mode-multi.js): three distinct names from the roster, and the pick lands in the history. */
for (const crazy of [false, true]) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
  await page.click('#settingsBtn');
  await settle(page, 300);
  await page.fill('#namesInput', ROSTER.join('\n'));
  await page.click('#loadNames');
  await settle(page, 300);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.evaluate(() => { const m = document.getElementById('multiPickCount'); m.value = '3'; m.dispatchEvent(new Event('change', { bubbles: true })); });
  if (crazy) await page.evaluate(() => document.getElementById('crazyBtn').click());
  await page.evaluate(() => document.getElementById('pickBtn').click());
  const label = `multi${crazy ? ' + crazy' : ''}`;
  try {
    await page.waitForSelector('.modal-overlay .multi-pick-name', { timeout: 20000 });
    const got = (await page.$$eval('.modal-overlay .multi-pick-name', els => els.map(e => e.textContent.trim())));
    ok(got.length === 3 && new Set(got).size === 3 && got.every(g => ROSTER.includes(g)), `${label}: three different names from the roster (${got.join(', ')})`);
    await page.evaluate(() => document.getElementById('multiDone').click());
    await settle(page, 400);
    ok(await page.evaluate(() => !document.getElementById('pickBtn').disabled), `${label}: the pick button is free again`);
  } catch (e) { failed++; console.log('  FAIL ' + label + ': no dialog (' + String(e.message).split('\n')[0] + ')'); }
  await page.context().close();
}
/* Tournament grid (np-mode-tournament.js): the spotlight sweep ends on the winner dialog. */
{
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
  await page.click('#settingsBtn');
  await settle(page, 300);
  await page.fill('#namesInput', ROSTER.join('\n'));
  await page.click('#loadNames');
  await settle(page, 300);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.evaluate(() => document.getElementById('tournamentBtn').click());
  await settle(page, 300);
  ok(await page.$$eval('.tournament-tile', t => t.length) === ROSTER.length, 'tournament: the grid shows every student');
  await page.evaluate(() => document.getElementById('pickBtn').click());
  try {
    await page.waitForSelector('.modal-overlay .winner-name', { timeout: 20000 });
    const winner = (await page.textContent('.modal-overlay .winner-name')).trim();
    ok(ROSTER.includes(winner), `tournament: the dialog names someone on the roster (${winner})`);
    ok(await page.$$eval('.tournament-tile.winner-tile', t => t.length) === 1, 'tournament: exactly one tile is marked the winner');
  } catch (e) { failed++; console.log('  FAIL tournament: no winner dialog (' + String(e.message).split('\n')[0] + ')'); }
  await page.context().close();
}
/* Team Draft (np-mode-draft.js): set up two teams, captains alternate through the roster, the draft ends complete, and a new roster clears it. */
{
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
  await page.click('#settingsBtn');
  await settle(page, 300);
  await page.fill('#namesInput', ROSTER.join('\n'));
  await page.click('#loadNames');
  await settle(page, 300);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.selectOption('#mode', 'draft');
  await settle(page, 300);
  ok(await page.$$eval('.draft-setup', e => e.length) === 1, 'draft: the setup card shows');
  await page.fill('.draft-team-name-input >> nth=0', 'Reds');
  await page.click('#draftStartBtn');
  await settle(page, 300);
  ok((await page.textContent('.draft-team-card.active-turn h4')).includes('Reds'), 'draft: Reds is up first');
  await page.click('[data-draft-pick="Cy"]');
  await settle(page, 300);
  ok((await page.textContent('.draft-team-card.active-turn h4')).includes('Team 2'), 'draft: the turn passes to Team 2');
  ok((await page.textContent('.draft-team-card h4')).includes('(1)'), 'draft: Reds shows one pick');
  for (const n of ROSTER.filter(r => r !== 'Cy')) { await page.click(`[data-draft-pick="${n}"]`); await settle(page, 100); }
  ok(await page.$$eval('.draft-complete', e => e.length) === 1, 'draft: complete once everyone is drafted');
  await page.click('#draftRestartBtn');
  await settle(page, 300);
  ok(await page.$$eval('[data-draft-pick]', e => e.length) === ROSTER.length, 'draft: a new draft with the same teams puts everyone back');
  await page.click('#draftReconfigureBtn');
  await settle(page, 300);
  ok(await page.$$eval('.draft-setup', e => e.length) === 1, 'draft: Reconfigure goes back to the setup card');
  await page.context().close();
}
/* The winner dialog (np-ui.js): a task prompt rides with the pick, "Same question, next student" holds it for the next one,
   and "Remove & Roll Again" takes the winner off the board. */
{
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
  await page.click('#settingsBtn');
  await settle(page, 300);
  await page.fill('#namesInput', ROSTER.join('\n'));
  await page.click('#loadNames');
  await page.evaluate(() => {
    document.getElementById('promptsInput').value = 'Q one\nQ two\nQ three\nQ four\nQ five';
    document.getElementById('savePrompts').click();
    document.getElementById('promptsEnabled').click();
  });
  await settle(page, 300);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.evaluate(() => document.getElementById('pickBtn').click());
  try {
    await page.waitForSelector('.modal-overlay #modalSameQ', { timeout: 20000 });
    const q1 = (await page.textContent('.modal-overlay .prompt-task')).trim();
    await page.evaluate(() => document.getElementById('modalSameQ').click());
    await page.waitForSelector('.modal-overlay #modalSameQ', { timeout: 20000 });
    const q2 = (await page.textContent('.modal-overlay .prompt-task')).trim();
    ok(q1 === q2 && q1.includes('Q '), `winner dialog: the same question rides to the next student (${q1})`);
    await page.evaluate(() => document.getElementById('modalRemoveRoll').click());
    await page.waitForSelector('.modal-overlay #modalDone', { timeout: 20000 });
    const left = await page.evaluate(() => document.querySelectorAll('.name-card:not(.fading)').length);
    ok(left <= ROSTER.length - 1, `winner dialog: Remove & Roll Again takes a name off the board (${left} left)`);
    await page.evaluate(() => document.getElementById('modalDone').click());
    await settle(page, 400);
    ok(await page.evaluate(() => !document.getElementById('pickBtn').disabled), 'winner dialog: the pick button is free again');
  } catch (e) { failed++; console.log('  FAIL winner dialog: ' + String(e.message).split('\n')[0]); }
  await page.context().close();
}
await browser.close();
server.close && server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
