// smoke-handoff.mjs — Name Picker: a finished Team Draft sends its teams to the Group / Team Generator (002)
// and to the Bracket / Tournament Generator (020), and both pages open what arrives.
//
//   node Tools/name-picker/test/smoke-handoff.mjs
//
// Path 15 P5. Drives 007 through a four-student draft with two named teams, stubs window.open to catch the link
// _shared/handoffs.js builds, then opens that link in a fresh page and reads what the receiver shows.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8609;
const BASE = `http://127.0.0.1:${PORT}`;
const ROSTER = ['Ada', 'Bo', 'Cy', 'Di'];
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

const server = await serve(PORT);
const browser = await launch();
try {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return {}; }; });
  await page.click('#settingsBtn');
  await settle(page, 300);
  await page.fill('#namesInput', ROSTER.join('\n'));
  await page.click('#loadNames');
  await settle(page, 300);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.selectOption('#mode', 'draft');
  await settle(page, 300);
  ok(await page.$$eval('#draftToGroupsBtn', e => e.length) === 0, 'the buttons are not on the setup card');
  await page.fill('.draft-team-name-input >> nth=0', 'Reds');
  await page.fill('.draft-team-name-input >> nth=1', 'Blues');
  await page.click('#draftStartBtn');
  await settle(page, 300);
  ok(await page.$$eval('#draftToGroupsBtn', e => e.length) === 0, 'nor while the draft is running');
  for (const n of ROSTER) { await page.click(`[data-draft-pick="${n}"]`); await settle(page, 100); }
  ok(await page.$$eval('#draftToGroupsBtn, #draftToBracketBtn', e => e.length) === 2, 'the finished board offers Send to Groups and Send to Bracket');

  await page.click('#draftToGroupsBtn');
  await page.click('#draftToBracketBtn');
  const opened = await page.evaluate(() => window.__opened);
  ok(opened.length === 2, 'each button opened one link: ' + opened.length);
  ok(/\/Tools\/002-group-team-generator\.html\?groups=/.test(opened[0] || ''), '002\'s link');
  ok(/\/Tools\/020-bracket-tournament-generator\.html\?bracket=/.test(opened[1] || ''), '020\'s link');
  ok(/Sent the teams/.test(await page.textContent('#draftSendNote')), 'the board says what happened');
  ok(!/Ada|Reds/.test(opened.join('')), 'no name sits in the link in the clear');

  const gp = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await gp.goto(opened[0], { waitUntil: 'networkidle' });
  await settle(gp, 600);
  const gtext = await gp.evaluate(() => document.body.innerText);
  ok(/Reds/.test(gtext) && /Blues/.test(gtext), '002 shows both teams as groups');
  ok(['Ada', 'Bo', 'Cy', 'Di'].every(n => gtext.includes(n)), 'with everyone in them');

  const bp = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await bp.goto(opened[1], { waitUntil: 'networkidle' });
  await settle(bp, 600);
  const btext = await bp.evaluate(() => document.body.innerText);
  ok(/Reds/.test(btext) && /Blues/.test(btext), '020 shows the two teams as entrants');
  ok(/Loaded a shared bracket/.test(btext), '020 says it loaded a shared bracket');
  ok(/Ada/.test(btext), '020 lists the members');
  const saved = await bp.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('gvb-bracket:data:')));
  ok(saved.length === 1, 'and saved it as a new bracket: ' + saved.join());
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
