// smoke-rename-hint.mjs — what Class Roster Hub tells a teacher a rename will do.
//
//   node Tools/class-roster-hub/test/smoke-rename-hint.mjs
//
// The hint under "Other tools holding these students" used to say that renaming a
// student here never reaches the other tools. Eight tools have followed a rename
// through the stable id since Path 3 P4, so it was wrong for them and right for
// the rest. The hint now names which is which. Every name here is invented.
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8640;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/006-class-roster-hub.html';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};

const server = await serve(PORT);
const browser = await launch();

async function hintFor(extra) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.addInitScript(seed => {
    localStorage.setItem('np_rosters', JSON.stringify({ 'Period 1': ['Ada Quill', 'Bram Fenwick'] }));
    Object.keys(seed).forEach(k => localStorage.setItem(k, seed[k]));
  }, extra);
  await page.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
  await settle(page, 400);
  await page.selectOption('#rosterSwitch', 'Period 1');
  await settle(page, 250);
  const hint = await page.evaluate(() => document.getElementById('depHint').textContent);
  await page.close();
  return hint;
}

console.log('Class Roster Hub — the rename hint');

const names = JSON.stringify([{ name: 'Ada Quill' }, { name: 'Bram Fenwick' }]);
{
  const h = await hintFor({ 'hall-pass-log-sections': names });
  ok(/Renaming a student here is followed by Digital Hall Pass \/ Sign-Out Log the next time it opens\./.test(h), 'a following tool is named as following: ' + h);
  ok(!/does not carry over/.test(h), 'no by-name sentence when every tool follows: ' + h);
}
{
  const h = await hintFor({ 'gvb-certificate-maker:x': names });
  ok(/Certificate & Award Maker keys history to the student’s name, so a rename here does not carry over\./.test(h), 'a by-name tool is named as not following: ' + h);
  ok(!/is followed by/.test(h), 'no following sentence when none follows: ' + h);
}
{
  const h = await hintFor({ 'hall-pass-log-sections': names, 'behavior-points-tracker-sections': names, 'gvb-exit-ticket:y': names });
  ok(/followed by (Behavior & Points Tracker and Digital Hall Pass \/ Sign-Out Log|Digital Hall Pass \/ Sign-Out Log and Behavior & Points Tracker) the next time they open\./.test(h), 'two followers read as a list: ' + h);
  ok(/Exit Ticket \/ Bell Ringer Generator keys history/.test(h), 'the other tool is named beside them: ' + h);
}
{
  const h = await hintFor({});
  ok(h === 'Once you use this roster in Behavior Points, Hall Pass, SSR Log and the rest, they show up here — and this tool warns you before a delete or rename orphans that data.', 'no dependants keeps the old hint');
}

await browser.close();
server.close && server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
